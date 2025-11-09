"""
Wildfire Detection Streaming Server
Streams webcam feed with wildfire detection to web client via FastAPI
"""
import argparse
import cv2
import torch
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from typing import Optional
import io

from model import WildfireYOLO

app = FastAPI()

# Add CORS middleware to allow Next.js frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model and camera
model: Optional[WildfireYOLO] = None
device: Optional[torch.device] = None
cap: Optional[cv2.VideoCapture] = None
args: Optional[argparse.Namespace] = None
detection_history = []


def preprocess_frame(frame: np.ndarray, image_size: int = 416) -> torch.Tensor:
    """Preprocess a frame for model input."""
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(frame_rgb)
    
    transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    tensor = transform(pil_image).unsqueeze(0)
    return tensor


def draw_detections(
    frame: np.ndarray,
    detections: torch.Tensor,
    conf_threshold: float = 0.3
) -> np.ndarray:
    """Draw bounding boxes and labels on frame."""
    frame_h, frame_w = frame.shape[:2]
    
    for detection in detections:
        x_min, y_min, x_max, y_max, conf, class_id = detection
        
        if conf < conf_threshold:
            continue
        
        x1 = int(x_min * frame_w)
        y1 = int(y_min * frame_h)
        x2 = int(x_max * frame_w)
        y2 = int(y_max * frame_h)
        
        x1 = max(0, min(frame_w - 1, x1))
        y1 = max(0, min(frame_h - 1, y1))
        x2 = max(0, min(frame_w - 1, x2))
        y2 = max(0, min(frame_h - 1, y2))
        
        color = (0, 0, 255)
        thickness = 2
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
        
        label = f"Wildfire: {conf:.2f}"
        
        (text_width, text_height), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1
        )
        
        cv2.rectangle(
            frame,
            (x1, y1 - text_height - baseline - 5),
            (x1 + text_width, y1),
            color,
            -1
        )
        
        cv2.putText(
            frame,
            label,
            (x1, y1 - baseline - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1,
            cv2.LINE_AA
        )
    
    return frame


def generate_frames():
    """Generate frames with wildfire detection."""
    global detection_history
    frame_count = 0
    
    while True:
        if cap is None or not cap.isOpened():
            break
            
        ret, frame = cap.read()
        if not ret:
            break
        
        display_frame = frame.copy()
        input_tensor = preprocess_frame(frame, args.image_size).to(device)
        
        with torch.no_grad():
            predictions = model(input_tensor)
            detections = model.decode_predictions(
                predictions,
                conf_threshold=args.conf_threshold,
                nms_threshold=args.nms_threshold
            )
        
        has_fire = False
        if len(detections) > 0 and len(detections[0]) > 0:
            dets_tensor = detections[0]
            confidences = dets_tensor[:, 4]
            mask = confidences >= args.conf_threshold
            filtered_dets = dets_tensor[mask]
            
            if len(filtered_dets) > 0:
                if args.smooth_frames > 1:
                    detection_history.append(filtered_dets.cpu().numpy())
                    
                    if len(detection_history) > args.smooth_frames:
                        detection_history.pop(0)
                    
                    if len(detection_history) >= 2:
                        smoothed_dets = []
                        for hist_frame in detection_history:
                            if len(hist_frame) > 0:
                                best_idx = np.argmax(hist_frame[:, 4])
                                smoothed_dets.append(hist_frame[best_idx])
                        
                        if smoothed_dets:
                            smoothed_dets = np.array(smoothed_dets)
                            weights = smoothed_dets[:, 4]
                            weights = weights / weights.sum()
                            
                            avg_box = np.average(smoothed_dets[:, :4], axis=0, weights=weights)
                            avg_conf = np.average(smoothed_dets[:, 4], weights=weights)
                            
                            if avg_conf >= args.conf_threshold:
                                smoothed_tensor = torch.tensor(
                                    [[avg_box[0], avg_box[1], avg_box[2], avg_box[3], avg_conf, 0]], 
                                    device=filtered_dets.device, 
                                    dtype=filtered_dets.dtype
                                )
                                display_frame = draw_detections(
                                    display_frame,
                                    smoothed_tensor,
                                    conf_threshold=args.conf_threshold
                                )
                                has_fire = True
                    else:
                        display_frame = draw_detections(
                            display_frame,
                            filtered_dets,
                            conf_threshold=args.conf_threshold
                        )
                        has_fire = True
                else:
                    display_frame = draw_detections(
                        display_frame,
                        filtered_dets,
                        conf_threshold=args.conf_threshold
                    )
                    has_fire = True
            else:
                if len(detection_history) > 0:
                    detection_history.pop(0)
        else:
            if len(detection_history) > 0:
                detection_history.pop(0)
        
        # Add status overlay
        status_text = "FIRE DETECTED" if has_fire else "No Fire"
        status_color = (0, 0, 255) if has_fire else (0, 255, 0)
        cv2.putText(
            display_frame,
            status_text,
            (10, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            status_color,
            2
        )
        
        frame_count += 1
        cv2.putText(
            display_frame,
            f"Frame: {frame_count}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )
        
        # Encode frame as JPEG
        ret, buffer = cv2.imencode('.jpg', display_frame)
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        
        # Yield frame in multipart format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')


@app.get("/")
async def root():
    return {"status": "Wildfire Detection Server Running"}


@app.get("/stream")
async def video_feed():
    """Video streaming route. Put this in the src attribute of an img tag."""
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/status")
async def status():
    """Check if camera and model are ready."""
    return {
        "camera_ready": cap is not None and cap.isOpened(),
        "model_loaded": model is not None,
        "device": str(device) if device else None
    }


def initialize_model(model_path: str, image_size: int, dev: torch.device):
    """Initialize the wildfire detection model."""
    global model
    
    print(f"Loading model from {model_path}...")
    model = WildfireYOLO(
        num_classes=1,
        num_anchors=1,
        image_size=image_size
    ).to(dev)
    
    checkpoint = torch.load(model_path, map_location=dev, weights_only=False)
    if 'model_state_dict' in checkpoint:
        model.load_state_dict(checkpoint['model_state_dict'])
        print(f"Loaded checkpoint from epoch {checkpoint.get('epoch', 'unknown')}")
    else:
        model.load_state_dict(checkpoint)
    
    model.eval()
    print("Model loaded successfully!")


def main():
    global device, cap, args
    
    parser = argparse.ArgumentParser(description='Wildfire Detection Streaming Server')
    parser.add_argument('--model', type=str, default='wildfire_detector_best.pth',
                        help='Path to trained model checkpoint')
    parser.add_argument('--image-size', type=int, default=416,
                        help='Input image size')
    parser.add_argument('--conf-threshold', type=float, default=0.4,
                        help='Confidence threshold for detections')
    parser.add_argument('--smooth-frames', type=int, default=10,
                        help='Number of frames for temporal smoothing')
    parser.add_argument('--nms-threshold', type=float, default=0.4,
                        help='NMS IoU threshold')
    parser.add_argument('--camera', type=int, default=0,
                        help='Camera index')
    parser.add_argument('--device', type=str, default='auto',
                        help='Device (cuda/cpu/auto)')
    parser.add_argument('--port', type=int, default=8000,
                        help='Server port')
    parser.add_argument('--host', type=str, default='127.0.0.1',
                        help='Server host')
    
    args = parser.parse_args()
    
    # Device setup
    if args.device == 'auto':
        if torch.cuda.is_available():
            device = torch.device('cuda')
            print(f"✓ CUDA is available! Using GPU: {torch.cuda.get_device_name(0)}")
        else:
            device = torch.device('cpu')
            print("⚠ CUDA not available, using CPU")
    else:
        device = torch.device(args.device)
        if device.type == 'cuda' and not torch.cuda.is_available():
            print("⚠ Warning: CUDA requested but not available, falling back to CPU")
            device = torch.device('cpu')
    
    print(f"Using device: {device}")
    
    # Initialize model
    initialize_model(args.model, args.image_size, device)
    
    # Initialize webcam
    print(f"Initializing webcam (index {args.camera})...")
    cap = cv2.VideoCapture(args.camera)
    
    if not cap.isOpened():
        print(f"Error: Could not open camera {args.camera}")
        return
    
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    print(f"\nServer starting on http://{args.host}:{args.port}")
    print(f"Stream available at: http://{args.host}:{args.port}/stream")
    print("Press Ctrl+C to stop")
    
    # Run server
    import uvicorn
    try:
        uvicorn.run(app, host=args.host, port=args.port)
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        if cap is not None:
            cap.release()
        print("Server stopped.")


if __name__ == "__main__":
    main()
