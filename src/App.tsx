import { useState, useRef, useCallback, useEffect } from 'react'

// Интерфейсы для типизации
interface AudioEngineState {
  audioContext: AudioContext | null
  sourceNode: AudioBufferSourceNode | null
  gainNode: GainNode | null
  compressorNode: DynamicsCompressorNode | null
  reverbNode: ConvolverNode | null
  analyserNode: AnalyserNode | null
  audioBuffer: AudioBuffer | null
  isPlaying: boolean
  isPaused: boolean
  startTime: number
  pauseTime: number
}

// Начальное состояние
const initialState: AudioEngineState = {
  audioContext: null,
  sourceNode: null,
  gainNode: null,
  compressorNode: null,
  reverbNode: null,
  analyserNode: null,
  audioBuffer: null,
  isPlaying: false,
  isPaused: false,
  startTime: 0,
  pauseTime: 0,
}

// Вспомогательная функция для форматирования времени
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Хук для управления аудио-движком
function useAudioEngine() {
  const [state, setState] = useState<AudioEngineState>(initialState)
  const [fileName, setFileName] = useState<string>('')
  const [gainValue, setGainValue] = useState<number>(100)
  const [compressorThreshold, setCompressorThreshold] = useState<number>(-24)
  const [compressorRatio, setCompressorRatio] = useState<number>(4)
  const [reverbValue, setReverbValue] = useState<number>(30)
  const [compressorBypass, setCompressorBypass] = useState<boolean>(false)
  const [reverbBypass, setReverbBypass] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<number>(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Создание импульсного отклика для reverb
  const createReverbImpulse = useCallback((ctx: AudioContext, duration: number = 2, decay: number = 2): AudioBuffer => {
    const sampleRate = ctx.sampleRate
    const length = sampleRate * duration
    const impulse = ctx.createBuffer(2, length, sampleRate)
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    
    return impulse
  }, [])
  
  // Инициализация аудио контекста
  const initAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    let ctx = state.audioContext
    if (!ctx) {
      try {
        ctx = new AudioContext()
        const gain = ctx.createGain()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        gain.connect(analyser)
        analyser.connect(ctx.destination)
        setState(s => ({ ...s, audioContext: ctx, gainNode: gain, analyserNode: analyser }))
      } catch (err) {
        setError('Failed to create audio context')
        console.error(err)
        return null
      }
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (err) {
        setError('Failed to resume audio context')
        console.error(err)
      }
    }
    return ctx
  }, [state.audioContext])

  // Загрузка аудиофайла
  const loadAudioFile = useCallback(async (file: File) => {
    setError('')
    try {
      const ctx = await initAudioContext()
      if (!ctx) return
      
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      setState(s => ({ 
        ...s, 
        audioBuffer, 
        isPlaying: false, 
        isPaused: false, 
        pauseTime: 0 
      }))
      setFileName(file.name)
      setCurrentTime(0)
    } catch (err) {
      setError('Failed to decode audio file')
      console.error(err)
    }
  }, [initAudioContext])

  // Обработка изменения файла
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      loadAudioFile(file)
    }
  }, [loadAudioFile])

  // Воспроизведение
  const handlePlay = useCallback(async () => {
    if (!state.audioBuffer || !state.audioContext) return
    
    const ctx = state.audioContext
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (err) {
        setError('Failed to resume audio context')
        console.error(err)
        return
      }
    }

    // Создание новых узлов для воспроизведения
    const source = ctx.createBufferSource()
    source.buffer = state.audioBuffer
    
    const gain = ctx.createGain()
    gain.gain.value = gainValue / 100
    
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = compressorThreshold
    compressor.ratio.value = compressorRatio
    compressor.attack.value = 0.003
    compressor.release.value = 0.25
    
    const compressorDry = ctx.createGain()
    compressorDry.gain.value = compressorBypass ? 1 : 0
    const compressorWet = ctx.createGain()
    compressorWet.gain.value = compressorBypass ? 0 : 1
    
    const reverb = ctx.createConvolver()
    reverb.buffer = createReverbImpulse(ctx, 2, 2)
    
    const reverbGain = ctx.createGain()
    reverbGain.gain.value = reverbValue / 100
    
    const reverbDry = ctx.createGain()
    reverbDry.gain.value = reverbBypass ? 1 : 0
    const reverbWet = ctx.createGain()
    reverbWet.gain.value = reverbBypass ? 0 : (reverbValue / 100)
    
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    
    // Цепочка с поддержкой bypass
    // Source → Gain → Compressor → [dry/wet] → Reverb → [dry/wet] → Analyser → Destination
    source.connect(gain)
    gain.connect(compressor)
    
    // Compressor split: dry path и wet path
    compressor.connect(compressorDry)
    compressor.connect(compressorWet)
    
    // Reverb receives from compressor
    compressorWet.connect(reverb)
    reverb.connect(reverbWet)
    
    // Dry signal bypasses reverb
    compressorDry.connect(reverbDry)
    
    // Connect to analyser
    reverbDry.connect(analyser)
    reverbWet.connect(analyser)
    compressorWet.connect(analyser)
    
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
      compressorNode: compressor,
      reverbNode: reverb,
      analyserNode: analyser,
      isPlaying: true,
      isPaused: false,
      startTime: ctx.currentTime - startOffset,
    }))

    source.onended = () => {
      setState(s => ({ ...s, isPlaying: false, isPaused: false, pauseTime: 0 }))
      setCurrentTime(0)
    }
  }, [state.audioBuffer, state.audioContext, state.pauseTime, gainValue, compressorThreshold, compressorRatio, reverbValue, createReverbImpulse])

  // Пауза
  const handlePause = useCallback(() => {
    if (state.sourceNode && state.audioContext) {
      const elapsed = state.audioContext.currentTime - state.startTime
      state.sourceNode.stop()
      setState(s => ({ ...s, isPlaying: false, isPaused: true, pauseTime: elapsed, sourceNode: null }))
    }
  }, [state.sourceNode, state.audioContext, state.startTime])

  // Остановка
  const handleStop = useCallback(() => {
    if (state.sourceNode && state.audioContext) {
      state.sourceNode.stop()
    }
    setState(s => ({ ...s, isPlaying: false, isPaused: false, pauseTime: 0, sourceNode: null }))
    setCurrentTime(0)
  }, [state.sourceNode, state.audioContext])

  // Изменение громкости
  const handleGainChange = useCallback((value: number) => {
    setGainValue(value)
    if (state.gainNode && state.audioContext) {
      state.gainNode.gain.setValueAtTime(value / 100, state.audioContext.currentTime)
    }
  }, [state.gainNode, state.audioContext])

  // Изменение порога компрессора
  const handleCompressorThresholdChange = useCallback((value: number) => {
    setCompressorThreshold(value)
    if (state.compressorNode) {
      state.compressorNode.threshold.setValueAtTime(value, state.audioContext!.currentTime)
    }
  }, [state.compressorNode, state.audioContext])

  // Изменение ratio компрессора
  const handleCompressorRatioChange = useCallback((value: number) => {
    setCompressorRatio(value)
    if (state.compressorNode) {
      state.compressorNode.ratio.setValueAtTime(value, state.audioContext!.currentTime)
    }
  }, [state.compressorNode, state.audioContext])

  // Изменение reverb
  const handleReverbChange = useCallback((value: number) => {
    setReverbValue(value)
  }, [])

  // Toggle compressor bypass
  const handleCompressorBypassToggle = useCallback(() => {
    setCompressorBypass(prev => !prev)
  }, [])

  // Toggle reverb bypass
  const handleReverbBypassToggle = useCallback(() => {
    setReverbBypass(prev => !prev)
  }, [])

  // Эффект для обновления времени воспроизведения
  useEffect(() => {
    if (!state.audioContext) return

    let intervalId: number | null = null
    if (state.isPlaying && state.sourceNode) {
      intervalId = window.setInterval(() => {
        if (state.audioContext) {
          const elapsed = state.audioContext.currentTime - state.startTime
          setCurrentTime(elapsed)
        }
      }, 100)
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [state.isPlaying, state.audioContext, state.startTime, state.sourceNode])

  // Эффект для визуализации
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
          const y = v * height / 2

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
          const y = v * height / 2
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

  // Эффект для изменения размера холста
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

  return {
    state,
    fileName,
    gainValue,
    compressorThreshold,
    compressorRatio,
    compressorBypass,
    reverbValue,
    reverbBypass,
    error,
    currentTime,
    canvasRef,
    fileInputRef,
    handleFileChange,
    handlePlay,
    handlePause,
    handleStop,
    handleGainChange,
    handleCompressorThresholdChange,
    handleCompressorRatioChange,
    handleCompressorBypassToggle,
    handleReverbChange,
    handleReverbBypassToggle,
    duration: state.audioBuffer?.duration || 0
  }
}

// Основной компонент
function App() {
  const {
    state,
    fileName,
    gainValue,
    compressorThreshold,
    compressorRatio,
    compressorBypass,
    reverbValue,
    reverbBypass,
    error,
    currentTime,
    canvasRef,
    fileInputRef,
    handleFileChange,
    handlePlay,
    handlePause,
    handleStop,
    handleGainChange,
    handleCompressorThresholdChange,
    handleCompressorRatioChange,
    handleCompressorBypassToggle,
    handleReverbChange,
    handleReverbBypassToggle,
    duration
  } = useAudioEngine()

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

        <div className={`node-card ${compressorBypass ? 'bypassed' : 'effect'}`}>
          <div className="node-title">
            Compressor
            <button 
              className={`bypass-btn ${compressorBypass ? 'active' : ''}`}
              onClick={handleCompressorBypassToggle}
              title={compressorBypass ? 'Enable' : 'Bypass'}
            >
              {compressorBypass ? 'OFF' : 'ON'}
            </button>
          </div>
          <div className="node-ports">
            <div className="port input" title="Input" />
            <div className="port output" title="Output" />
          </div>
          <div className="node-params">
            <span className="param-label">
              <span>Threshold</span>
              <span>{compressorThreshold} dB</span>
            </span>
            <input
              type="range"
              className="param-slider"
              min="-60"
              max="0"
              value={compressorThreshold}
              onChange={(e) => handleCompressorThresholdChange(Number(e.target.value))}
              disabled={compressorBypass}
            />
            <span className="param-label">
              <span>Ratio</span>
              <span>{compressorRatio}:1</span>
            </span>
            <input
              type="range"
              className="param-slider"
              min="1"
              max="20"
              step="0.5"
              value={compressorRatio}
              onChange={(e) => handleCompressorRatioChange(Number(e.target.value))}
              disabled={compressorBypass}
            />
          </div>
        </div>

        <div className="connection-line">→</div>

        <div className={`node-card ${reverbBypass ? 'bypassed' : 'effect'}`}>
          <div className="node-title">
            Reverb
            <button 
              className={`bypass-btn ${reverbBypass ? 'active' : ''}`}
              onClick={handleReverbBypassToggle}
              title={reverbBypass ? 'Enable' : 'Bypass'}
            >
              {reverbBypass ? 'OFF' : 'ON'}
            </button>
          </div>
          <div className="node-ports">
            <div className="port input" title="Input" />
            <div className="port output" title="Output" />
          </div>
          <div className="node-params">
            <span className="param-label">
              <span>Mix</span>
              <span>{reverbValue}%</span>
            </span>
            <input
              type="range"
              className="param-slider"
              min="0"
              max="100"
              value={reverbValue}
              onChange={(e) => handleReverbChange(Number(e.target.value))}
              disabled={reverbBypass}
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
