# 🔥 Live Wildfire Detection - Web Integration

## Overview

This integration allows you to view the wildfire detection system **directly in your web browser** instead of in a separate OpenCV window. The CV2 video feed has been transformed into a streaming web service!

## What Changed?

### Before:
- ❌ `detect.py` opened a separate CV2 window
- ❌ Not embeddable in web applications
- ❌ Required pressing 'q' to quit

### After:
- ✅ Video streams to web browser
- ✅ Embedded in Next.js web interface
- ✅ Multiple users can view simultaneously
- ✅ RESTful API for status checks

## Quick Start

### 1. Start the Streaming Server

```bash
./start_streaming.sh
```

Or manually:

```bash
python3 stream_server.py --model wildfire_detector_best.pth --conf-threshold 0.4
```

### 2. Start the Web Client

In a separate terminal:

```bash
npm run dev
```

### 3. View Live Detection

Open your browser and navigate to:
```
http://localhost:3000/live-fire-watch
```

Click **"Start Stream"** to begin viewing the live detection feed!

## File Structure

```
BramHacks2025/
├── stream_server.py          # NEW: FastAPI streaming server
├── start_streaming.sh         # NEW: Quick start script
├── model.py                   # Copied from WildfireCNN
├── detect.py                  # Original (still works!)
├── wildfire_detector_best.pth # Your trained model
├── LIVE_STREAMING_SETUP.md    # Detailed documentation
└── app/
    └── live-fire-watch/
        └── page.tsx           # UPDATED: Web UI for stream
```

## Features

### Web Interface
- ✨ Real-time video stream display
- 📊 Live status indicators (camera, model, device)
- 🎯 Fire detection overlays with confidence scores
- 📱 Responsive design that works on mobile
- 🔴 Visual indicators for fire detection

### Streaming Server
- 🚀 FastAPI backend with WebSocket-like streaming
- 🎥 MJPEG video streaming via HTTP
- 🤖 Same AI detection logic as original `detect.py`
- 📡 RESTful API endpoints for status and control
- 🔄 CORS enabled for Next.js frontend

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check |
| `GET /stream` | MJPEG video stream |
| `GET /status` | Server status (camera, model, device) |

## Command Line Options

```bash
python3 stream_server.py [OPTIONS]

Options:
  --model PATH           Path to model (default: wildfire_detector_best.pth)
  --conf-threshold FLOAT Confidence threshold (default: 0.4)
  --smooth-frames INT    Temporal smoothing frames (default: 10)
  --camera INT           Camera index (default: 0)
  --device STR           cuda/cpu/auto (default: auto)
  --port INT             Server port (default: 8000)
  --host STR             Server host (default: 127.0.0.1)
```

## Examples

### High Sensitivity (More Detections)
```bash
python3 stream_server.py --conf-threshold 0.3
```

### Smoother Detections (Less Jitter)
```bash
python3 stream_server.py --smooth-frames 15
```

### Use External Camera
```bash
python3 stream_server.py --camera 1
```

### Force CPU (No GPU)
```bash
python3 stream_server.py --device cpu
```

## Troubleshooting

### "Server not running" Error
- Make sure `stream_server.py` is running
- Check that it's on port 8000
- Look for errors in the server terminal

### Camera Permission Denied
- macOS: System Preferences → Security & Privacy → Camera
- Grant permission to Terminal or your IDE

### No Video Appears
- Check browser console (F12) for errors
- Verify stream URL: `http://127.0.0.1:8000/stream`
- Try refreshing the page

### Low Frame Rate
- Use GPU if available (CUDA)
- Lower confidence threshold to reduce processing
- Close other camera-using applications

### Port Already in Use
```bash
python3 stream_server.py --port 8001
```
Then update frontend to use port 8001

## Technical Details

### How Streaming Works

1. **Capture**: OpenCV captures frames from webcam
2. **Detection**: YOLOv3 model processes each frame
3. **Annotation**: Bounding boxes drawn on detections
4. **Encoding**: Frame encoded as JPEG
5. **Streaming**: JPEG sent via HTTP multipart response
6. **Display**: Browser decodes and displays in `<img>` tag

### Why MJPEG?

- Simple to implement (no WebRTC complexity)
- Works with standard `<img>` tags
- Low latency for local networks
- No special browser support needed
- Easy to debug and monitor

## Comparison: detect.py vs stream_server.py

| Feature | detect.py | stream_server.py |
|---------|-----------|------------------|
| Display | CV2 Window | Web Browser |
| Multi-user | ❌ | ✅ |
| Embeddable | ❌ | ✅ |
| API Access | ❌ | ✅ |
| Remote View | ❌ | ✅ (with port forwarding) |
| Detection Logic | ✅ | ✅ (Same!) |

## Next Steps

### Enhancements You Could Add:
- 📹 Record detection events
- 📧 Email/SMS alerts on fire detection
- 📊 Detection statistics and graphs
- 🗺️ Integration with map coordinates
- 🎛️ Dynamic confidence threshold adjustment
- 🔐 Authentication for secure access

## Dependencies

```bash
pip install fastapi uvicorn torch torchvision opencv-python numpy Pillow
```

All dependencies are in `requirements.txt`

## License & Credits

- Built with ❤️ for BramHacks 2025
- Uses YOLOv3 architecture for fire detection
- FastAPI for modern Python web services
- Next.js for beautiful web interface

---

**Happy Fire Detecting! Stay safe! 🚒🔥**
