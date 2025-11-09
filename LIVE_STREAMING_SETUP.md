# Live Wildfire Detection - Web Streaming Setup

This setup allows you to view the wildfire detection feed directly in your web browser instead of a separate OpenCV window.

## Architecture

- **Backend**: FastAPI server (`stream_server.py`) that captures webcam feed, runs AI detection, and streams video
- **Frontend**: Next.js web client (`/live-fire-watch`) that displays the video stream

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install fastapi uvicorn torch torchvision opencv-python numpy Pillow
```

Or install from requirements.txt:

```bash
pip install -r requirements.txt
```

### 2. Start the Streaming Server

```bash
python stream_server.py --model wildfire_detector_best.pth --conf-threshold 0.4 --smooth-frames 10
```

**Available Options:**
- `--model`: Path to your trained model (default: `wildfire_detector_best.pth`)
- `--conf-threshold`: Confidence threshold (default: 0.4, lower = more sensitive)
- `--smooth-frames`: Temporal smoothing frames (default: 10, reduces jitter)
- `--camera`: Camera index (default: 0 for built-in webcam)
- `--device`: Processing device (cuda/cpu/auto)
- `--port`: Server port (default: 8000)
- `--host`: Server host (default: 127.0.0.1)

### 3. Start the Next.js Frontend

In a separate terminal:

```bash
npm run dev
```

### 4. Open the Live Detection Page

Navigate to: http://localhost:3000/live-fire-watch

Click "Start Stream" to begin viewing the live detection feed.

## How It Works

1. **Backend Stream Processing**:
   - `stream_server.py` captures frames from your webcam
   - Runs wildfire detection using the trained YOLOv3 model
   - Draws bounding boxes and labels on detected fires
   - Encodes frames as JPEG and streams via HTTP multipart

2. **Frontend Display**:
   - Web page fetches stream from `http://127.0.0.1:8000/stream`
   - Displays video in an `<img>` tag using the stream URL
   - Shows real-time status (camera ready, model loaded, device)

3. **Real-time Detection**:
   - Fire detections appear as red bounding boxes
   - Confidence scores shown on each detection
   - Status overlay shows "FIRE DETECTED" or "No Fire"

## API Endpoints

- `GET /`: Server health check
- `GET /stream`: Video stream (multipart/x-mixed-replace)
- `GET /status`: Server status (camera, model, device info)

## Troubleshooting

### Camera not accessible
- Make sure no other application is using the webcam
- Try a different camera index: `--camera 1`
- Check camera permissions in System Preferences (macOS)

### Stream not loading in browser
- Ensure the server is running on port 8000
- Check browser console for errors
- Try restarting both server and frontend

### Low frame rate
- Use GPU if available (CUDA)
- Reduce image size: `--image-size 320`
- Increase confidence threshold to reduce processing

### Too many false positives
- Increase confidence threshold: `--conf-threshold 0.6`
- Increase smooth frames: `--smooth-frames 15`

## Stopping the Server

Press `Ctrl+C` in the terminal running `stream_server.py`

The server will gracefully shut down and release the camera.

## Comparison with Original detect.py

**Original `detect.py`**:
- Opens OpenCV window (separate application)
- Can't be embedded in web interfaces
- Press 'q' to quit

**New `stream_server.py`**:
- Streams to web browser
- Can be embedded in web applications
- Multiple clients can view the same stream
- RESTful API for status checks

Both use the same detection logic and model!
