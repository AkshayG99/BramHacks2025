# 🎯 One-Click Live Detection - Updated!

## ✨ New Feature: Auto-Start Stream Button

The "Start Stream" button now **automatically launches the streaming server** for you! No need to manually run shell scripts or terminal commands.

## How It Works

### Before (Manual)
1. Open terminal
2. Run `./start_streaming.sh`
3. Wait for server to start
4. Go to web page
5. Click "Start Stream"

### After (One-Click)
1. Go to web page
2. Click **"Start Stream"** ✅
3. Done! 🎉

## Technical Implementation

### API Endpoint: `/api/stream/control`

Created a new Next.js API route that:
- Spawns the `start_streaming.sh` script as a child process
- Manages the server lifecycle (start/stop)
- Tracks process status
- Returns real-time status information

### Frontend Updates

The `live-fire-watch` page now:
- Calls the API when "Start Stream" is clicked
- Shows loading states while server initializes
- Displays helpful status messages
- Automatically polls for server readiness
- Handles errors gracefully

### File Changes

```
app/
├── api/
│   └── stream/
│       └── control/
│           └── route.ts         # NEW: Process control API
└── live-fire-watch/
    └── page.tsx                 # UPDATED: One-click functionality
```

## Usage

### Simple Mode (Recommended)
1. Navigate to: `http://localhost:3001/live-fire-watch`
2. Click **"Start Stream"**
3. Wait 3-5 seconds for initialization
4. Video feed appears automatically!

### Advanced Mode (Custom Settings)
If you need custom settings (different camera, threshold, etc.), you can still manually run:

```bash
python3 stream_server.py --camera 1 --conf-threshold 0.3
```

Then just click "Start Stream" on the web page.

## Button States

| State | Button Text | Description |
|-------|-------------|-------------|
| **Idle** | "Start Stream" (Green) | Ready to start |
| **Starting** | "Loading..." (Green, Disabled) | Server launching |
| **Running** | "Stop Stream" (Red) | Server active |
| **Stopping** | "Loading..." (Red, Disabled) | Server shutting down |

## Status Messages

| Message | Meaning |
|---------|---------|
| "Starting streaming server..." | Process is being spawned |
| "Server starting... Waiting for camera" | Server started, camera initializing |
| "Analyzing feed for wildfire signatures..." | Fully operational! |
| "Server not responding..." | Still warming up, give it a moment |

## API Endpoints

### Start Server
```bash
POST /api/stream/control
Body: { "action": "start" }
```

### Stop Server
```bash
POST /api/stream/control
Body: { "action": "stop" }
```

### Check Status
```bash
GET /api/stream/control
```

## Requirements

Make sure you have:
- ✅ `wildfire_detector_best.pth` in project root
- ✅ `model.py` in project root
- ✅ `start_streaming.sh` is executable (`chmod +x`)
- ✅ FastAPI and Uvicorn installed (`pip install fastapi uvicorn`)
- ✅ Camera permissions granted

## Process Management

### What Happens When You Click "Start Stream"?

1. **Frontend** → Sends POST to `/api/stream/control`
2. **API Route** → Spawns `bash start_streaming.sh`
3. **Shell Script** → Runs `python3 stream_server.py`
4. **Python Server** → Initializes camera & AI model
5. **FastAPI** → Starts streaming on port 8000
6. **Frontend** → Detects server, displays video feed

### What Happens When You Click "Stop Stream"?

1. **Frontend** → Sends POST with action "stop"
2. **API Route** → Sends SIGTERM to process
3. **Python Server** → Gracefully shuts down
4. **Camera** → Released
5. **Frontend** → Clears video feed

## Benefits

✅ **No Terminal Required** - Everything in the browser  
✅ **One-Click Operation** - Start and stop with a button  
✅ **Visual Feedback** - Loading states and status messages  
✅ **Error Handling** - Helpful error messages if something goes wrong  
✅ **Process Management** - Server lifecycle handled automatically  
✅ **User Friendly** - Perfect for demos and non-technical users  

## Troubleshooting

### "Failed to start streaming server"
- Check that `start_streaming.sh` exists and is executable
- Verify `wildfire_detector_best.pth` is in the project root
- Check console for detailed error messages

### Button stuck on "Loading..."
- Refresh the page
- Check if another instance is already running
- Verify camera permissions

### Server starts but no video
- Wait 5-10 seconds for full initialization
- Check camera permissions
- Try refreshing the page

### Port conflict
If port 8000 is busy, manually stop any existing servers:
```bash
lsof -ti:8000 | xargs kill -9
```

## Development Notes

The API route uses Node.js `child_process.spawn()` to manage the Python server. The process is stored in memory and tracked by PID. When the Next.js server restarts, you'll need to manually stop any orphaned Python processes.

---

**Now you can impress everyone with one-click fire detection! 🔥🚀**
