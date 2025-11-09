#!/bin/bash

# Quick start script for wildfire detection streaming server

echo "🔥 BramFire - Live Wildfire Detection Streaming Server"
echo "========================================================"
echo ""

# Check if model file exists
if [ ! -f "wildfire_detector_best.pth" ]; then
    echo "❌ Error: wildfire_detector_best.pth not found!"
    echo "   Please ensure the model file is in the current directory."
    exit 1
fi

# Check if model.py exists
if [ ! -f "model.py" ]; then
    echo "❌ Error: model.py not found!"
    echo "   Please copy model.py from WildfireCNN directory."
    exit 1
fi

echo "✓ Model file found"
echo "✓ Starting streaming server..."
echo ""
echo "Server will be available at: http://127.0.0.1:8000"
echo "Stream endpoint: http://127.0.0.1:8000/stream"
echo ""
echo "Open your web browser and navigate to:"
echo "http://localhost:3000/live-fire-watch"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "========================================================"
echo ""

# Start the server with default parameters
python3 stream_server.py \
    --model wildfire_detector_best.pth \
    --conf-threshold 0.4 \
    --smooth-frames 10 \
    --camera 0 \
    --port 8000
