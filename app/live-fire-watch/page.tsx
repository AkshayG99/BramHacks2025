'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Video, AlertCircle, Activity } from 'lucide-react'

export default function LiveFireWatch() {
  const router = useRouter()
  const [isStreaming, setIsStreaming] = useState(false)
  const [serverStatus, setServerStatus] = useState<{
    camera_ready: boolean
    model_loaded: boolean
    device: string | null
  } | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  // Check server status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/status')
        if (response.ok) {
          const data = await response.json()
          setServerStatus(data)
          setStreamError(null)
        }
      } catch (error) {
        if (isStreaming) {
          setStreamError('Server not responding. It may still be starting up...')
        } else {
          setStreamError(null)
        }
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 3000) // Check every 3 seconds

    return () => clearInterval(interval)
  }, [isStreaming])

  // Handle start/stop streaming
  const handleStreamToggle = async () => {
    if (isStreaming) {
      // Stop streaming
      try {
        setIsStarting(true)
        const response = await fetch('/api/stream/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop' })
        })
        
        const data = await response.json()
        if (data.success) {
          setIsStreaming(false)
          setServerStatus(null)
          setStreamError(null)
        } else {
          console.error('Failed to stop stream:', data.message)
        }
      } catch (error) {
        console.error('Error stopping stream:', error)
      } finally {
        setIsStarting(false)
      }
    } else {
      // Start streaming
      try {
        setIsStarting(true)
        setStreamError('Starting streaming server... This may take a few seconds.')
        
        const response = await fetch('/api/stream/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' })
        })
        
        const data = await response.json()
        if (data.success) {
          setIsStreaming(true)
          setStreamError('Server starting... Waiting for camera to initialize.')
          
          // Wait a bit longer for the server to fully initialize
          setTimeout(() => {
            setStreamError(null)
          }, 3000)
        } else {
          setStreamError(data.message || 'Failed to start streaming server')
          setIsStreaming(false)
        }
      } catch (error) {
        console.error('Error starting stream:', error)
        setStreamError('Failed to start streaming server. Check console for details.')
        setIsStreaming(false)
      } finally {
        setIsStarting(false)
      }
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Map
            </button>
            <div className="h-6 w-px bg-white/20" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                BramFire Labs
              </p>
              <p className="text-base font-semibold text-white">Live Fire Detection</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
              <Activity className="h-3 w-3 animate-pulse" />
              AI Model Active
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Info Banner */}
        <div className="mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-300">Real-Time Wildfire Detection</p>
              <p className="mt-1 text-sm text-blue-200/70">
                This system uses YOLOv3-based AI to detect wildfires from live camera feeds in real-time.
                Connect your camera to start monitoring for fire threats.
              </p>
            </div>
          </div>
        </div>

        {/* Video Container */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Live Camera Feed</h2>
              <p className="mt-1 text-sm text-white/60">
                {isStreaming ? 'Analyzing feed for wildfire signatures...' : 'Waiting for camera connection'}
              </p>
            </div>
            
            <button
              onClick={handleStreamToggle}
              disabled={isStarting}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isStreaming
                  ? 'border border-rose-500/30 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
            >
              {isStarting ? 'Loading...' : isStreaming ? 'Stop Stream' : 'Start Stream'}
            </button>
          </div>

          {/* Video Stream */}
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50">
            {streamError ? (
              <div className="flex h-full flex-col items-center justify-center px-8">
                <AlertCircle className="h-16 w-16 text-yellow-400/60" />
                <p className="mt-4 text-sm font-medium text-white/80 text-center">{streamError}</p>
                {streamError.includes('starting') && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <p className="text-xs text-white/60">Please wait...</p>
                  </div>
                )}
              </div>
            ) : isStreaming && serverStatus?.camera_ready ? (
              <>
                <img 
                  src="http://127.0.0.1:8000/stream" 
                  alt="Live wildfire detection feed"
                  className="h-full w-full object-contain"
                  onError={() => setStreamError('Failed to load video stream')}
                />
              </>
            ) : isStreaming && !serverStatus?.camera_ready ? (
              <div className="flex h-full flex-col items-center justify-center">
                <Video className="h-16 w-16 text-white/20 animate-pulse" />
                <p className="mt-4 text-sm font-medium text-white/40">Waiting for camera...</p>
                <p className="mt-2 text-xs text-white/30">Initializing detection system</p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center">
                <Video className="h-16 w-16 text-white/20" />
                <p className="mt-4 text-sm font-medium text-white/40">Camera Offline</p>
                <p className="mt-2 text-xs text-white/30">Click "Start Stream" to begin monitoring</p>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Model</p>
              <p className="mt-1 text-lg font-semibold text-white">YOLOv3</p>
              <p className="text-xs text-white/40">
                {serverStatus?.model_loaded ? 'Loaded' : 'Not loaded'}
              </p>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Device</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {serverStatus?.device?.toUpperCase() || 'Unknown'}
              </p>
              <p className="text-xs text-white/40">Processing device</p>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Camera Status</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {serverStatus?.camera_ready ? 'Ready' : 'Offline'}
              </p>
              <p className="text-xs text-white/40">
                {serverStatus?.camera_ready ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">How to Start Live Detection</h3>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <p className="flex items-start gap-2">
              <span className="font-semibold text-white">1.</span>
              Make sure you have the trained model file: <code className="rounded bg-white/10 px-2 py-0.5 text-xs">wildfire_detector_best.pth</code> in the project root
            </p>
            <p className="flex items-start gap-2">
              <span className="font-semibold text-white">2.</span>
              Click the <strong className="text-emerald-400">"Start Stream"</strong> button above - it will automatically launch the streaming server!
            </p>
            <p className="flex items-start gap-2">
              <span className="font-semibold text-white">3.</span>
              Wait a few seconds for the camera to initialize and the video feed will appear
            </p>
            <p className="flex items-start gap-2">
              <span className="font-semibold text-white">4.</span>
              Click <strong className="text-rose-400">"Stop Stream"</strong> when you're done to release the camera
            </p>
            <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">Advanced Options</p>
              <p className="text-xs text-amber-200/70">
                To customize settings, manually run: <code className="rounded bg-white/10 px-2 py-0.5">./start_streaming.sh</code> 
                or <code className="rounded bg-white/10 px-2 py-0.5">python3 stream_server.py --conf-threshold 0.3 --camera 1</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
