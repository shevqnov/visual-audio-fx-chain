import { useState, useRef, useCallback, useEffect } from 'react'

interface AudioEngineState {
  audioContext: AudioContext | null
  sourceNode: AudioBufferSourceNode | null
  gainNode: GainNode | null
  analyserNode: AnalyserNode | null
  audioBuffer: AudioBuffer | null
  isPlaying: boolean
  isPaused: boolean
  startTime: number
  pauseTime: number
}

const initialState: AudioEngineState = {
  audioContext: null,
  sourceNode: null,
  gainNode: null,
  analyserNode: null,
  audioBuffer: null,
  isPlaying: false,
  isPaused: false,
  startTime: 0,
  pauseTime: 0,
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function App() {
  const [state, setState] = useState<AudioEngineState>(initialState)
  const [fileName, setFileName] = useState<string>('')
  const [gainValue, setGainValue] = useState(100)
  const [error, setError] = useState<string>('')
  const [currentTime, setCurrentTime] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initAudioContext = useCallback(async () => {
    let ctx = state.audioContext
    if (!ctx) {
      ctx = new AudioContext()
      const gain = ctx.createGain()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      gain.connect(analyser)
      analyser.connect(ctx.destination)
      setState(s => ({ ...s, audioContext: ctx, gainNode: gain, analyserNode: analyser }))
    }
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    return ctx
  }, [state.audioContext])

  const loadAudioFile = useCallback(async (file: File) => {
    setError('')
    try {
      const ctx = await initAudioContext()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      setState(s => ({ ...s, audioBuffer, isPlaying: false, isPaused: false, pauseTime: 0 }))
      setFileName(file.name)
      setCurrentTime(0)
    } catch (err) {
      setError('Failed to decode audio file')
      console.error(err)
    }
  }, [initAudioContext])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      loadAudioFile(file)
    }
  }, [loadAudioFile])

  const handlePlay = useCallback(async () => {
    if (!state.audioBuffer || !state.audioContext) return
    
    const ctx = state.audioContext
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const source = ctx.createBufferSource()
    source.buffer = state.audioBuffer
    
    const gain = ctx.createGain()
    gain.gain.value = gainValue / 100
    
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    
    source.connect(gain)
    gain.connect(analyser)
    analyser.connect(ctx.destination)

    let startOffset = state.pauseTime
    if (!state.isPaused) {
      startOffset = 0
    }

    source.start(0, startOffset)
    
    setState(s => ({
      ...s,
      sourceNode: source,
      gainNode: gain,
      analyserNode: analyser,
      isPlaying: true,
      isPaused: false,
      startTime: ctx.currentTime - startOffset,
    }))

    source.onended = () => {
      setState(s => ({ ...s, isPlaying: false, isPaused: false, pauseTime: 0 }))
      setCurrentTime(0)
    }
  }, [state.audioBuffer, state.audioContext, state.pauseTime, gainValue])

  const handlePause = useCallback(() => {
    if (state.sourceNode && state.audioContext) {
      const elapsed = state.audioContext.currentTime - state.startTime
      state.sourceNode.stop()
      setState(s => ({ ...s, isPlaying: false, isPaused: true, pauseTime: elapsed, sourceNode: null }))
    }
  }, [state.sourceNode, state.audioContext, state.startTime])

  const handleStop = useCallback(() => {
    if (state.sourceNode && state.audioContext) {
      state.sourceNode.stop()
    }
    setState(s => ({ ...s, isPlaying: false, isPaused: false, pauseTime: 0, sourceNode: null }))
    setCurrentTime(0)
  }, [state.sourceNode, state.audioContext])

  const handleGainChange = useCallback((value: number) => {
    setGainValue(value)
    if (state.gainNode) {
      state.gainNode.gain.setValueAtTime(value / 100, state.audioContext!.currentTime)
    }
  }, [state.gainNode, state.audioContext])

  useEffect(() => {
    if (!state.audioContext) return

    let intervalId: number
    if (state.isPlaying && state.sourceNode) {
      intervalId = window.setInterval(() => {
        const elapsed = state.audioContext!.currentTime - state.startTime
        setCurrentTime(elapsed)
      }, 100)
    }
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [state.isPlaying, state.audioContext, state.startTime, state.sourceNode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const width = canvas.width
      const height = canvas.height
      
      ctx.fillStyle = '#0D1117'
      ctx.fillRect(0, 0, width, height)

      ctx.strokeStyle = '#30363D'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      if (state.analyserNode && state.isPlaying) {
        const bufferLength = state.analyserNode.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        state.analyserNode.getByteTimeDomainData(dataArray)

        ctx.lineWidth = 2
        ctx.strokeStyle = '#58A6FF'
        ctx.beginPath()

        const sliceWidth = width / bufferLength
        let x = 0

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = (v * height) / 2

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }

          x += sliceWidth
        }

        ctx.lineTo(width, height / 2)
        ctx.stroke()

        ctx.fillStyle = 'rgba(88, 166, 255, 0.1)'
        ctx.beginPath()
        ctx.moveTo(0, height / 2)
        
        x = 0
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = (v * height) / 2
          ctx.lineTo(x, y)
          x += sliceWidth
        }
        ctx.lineTo(width, height / 2)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.strokeStyle = '#30363D'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [state.analyserNode, state.isPlaying])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (container) {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  const duration = state.audioBuffer?.duration || 0

  return (
    <>
      <header className="header">
        <h1>Visual Audio FX Chain</h1>
        
        <div className="header-controls">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button 
            className="file-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Load Audio
          </button>
          
          {fileName && <span className="file-info">{fileName}</span>}

          <div className="transport">
            <button 
              className="transport-btn"
              onClick={handlePlay}
              disabled={!state.audioBuffer || state.isPlaying}
              title="Play"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            <button 
              className="transport-btn"
              onClick={handlePause}
              disabled={!state.isPlaying}
              title="Pause"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            </button>
            <button 
              className="transport-btn"
              onClick={handleStop}
              disabled={!state.audioBuffer}
              title="Stop"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h12v12H6z"/>
              </svg>
            </button>
          </div>

          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <main className="main-canvas">
        <div className="node-card">
          <div className="node-title">Source</div>
          <div className="node-ports">
            <div className="port input" title="Input" />
            <div className="port output" title="Output" />
          </div>
          <div className="node-params">
            <span className="param-label">Audio File</span>
          </div>
        </div>

        <div className="connection-line">→</div>

        <div className="node-card">
          <div className="node-title">Gain</div>
          <div className="node-ports">
            <div className="port input" title="Input" />
            <div className="port output" title="Output" />
          </div>
          <div className="node-params">
            <span className="param-label">
              <span>Volume</span>
              <span>{gainValue}%</span>
            </span>
            <input
              type="range"
              className="param-slider"
              min="0"
              max="200"
              value={gainValue}
              onChange={(e) => handleGainChange(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="connection-line">→</div>

        <div className="node-card">
          <div className="node-title">Output</div>
          <div className="node-ports">
            <div className="port input" title="Input" />
            <div className="port output" title="Output" />
          </div>
          <div className="node-params">
            <span className="param-label">Speakers</span>
          </div>
        </div>
      </main>

      <section className="visualizer-panel">
        <div className="visualizer-container">
          <canvas ref={canvasRef} className="visualizer-canvas" />
        </div>
      </section>
    </>
  )
}

export default App
