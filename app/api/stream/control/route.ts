import { NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

// Store the streaming process globally
let streamingProcess: ChildProcess | null = null

export async function POST(request: Request) {
  try {
    const { action } = await request.json()

    if (action === 'start') {
      // Check if process is already running
      if (streamingProcess && !streamingProcess.killed) {
        return NextResponse.json({ 
          success: false, 
          message: 'Streaming server is already running',
          status: 'running'
        })
      }

      // Path to the shell script
      const scriptPath = path.join(process.cwd(), 'start_streaming.sh')
      
      // Start the streaming server using the shell script
      streamingProcess = spawn('bash', [scriptPath], {
        cwd: process.cwd(),
        detached: false,
        stdio: 'pipe'
      })

      // Log output
      streamingProcess.stdout?.on('data', (data) => {
        console.log(`[Stream Server]: ${data}`)
      })

      streamingProcess.stderr?.on('data', (data) => {
        console.error(`[Stream Server Error]: ${data}`)
      })

      streamingProcess.on('close', (code) => {
        console.log(`Stream server process exited with code ${code}`)
        streamingProcess = null
      })

      // Wait a bit to ensure it started
      await new Promise(resolve => setTimeout(resolve, 2000))

      return NextResponse.json({ 
        success: true, 
        message: 'Streaming server started',
        status: 'running',
        pid: streamingProcess.pid
      })

    } else if (action === 'stop') {
      if (streamingProcess && !streamingProcess.killed) {
        streamingProcess.kill('SIGTERM')
        streamingProcess = null
        
        return NextResponse.json({ 
          success: true, 
          message: 'Streaming server stopped',
          status: 'stopped'
        })
      }

      return NextResponse.json({ 
        success: false, 
        message: 'Streaming server is not running',
        status: 'stopped'
      })

    } else if (action === 'status') {
      const isRunning = streamingProcess && !streamingProcess.killed
      
      return NextResponse.json({ 
        success: true, 
        status: isRunning ? 'running' : 'stopped',
        pid: streamingProcess?.pid || null
      })
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Invalid action' 
    }, { status: 400 })

  } catch (error) {
    console.error('Stream control error:', error)
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

export async function GET() {
  const isRunning = streamingProcess && !streamingProcess.killed
  
  return NextResponse.json({ 
    success: true, 
    status: isRunning ? 'running' : 'stopped',
    pid: streamingProcess?.pid || null
  })
}
