# Visual Audio FX Chain - Prototype Specification

## Project Overview
- **Name**: Visual Audio FX Chain
- **Type**: Web Application (Audio Processing Pipeline)
- **Core Functionality**: Node-based audio editor where users can load audio files, process them through effects chain, and visualize the output in real-time
- **Target Users**: Audio enthusiasts, content creators, podcasters
- **Tech Stack**: React 18, TypeScript, Vite, Web Audio API

## UI/UX Specification

### Layout Structure
- **Header**: App title, transport controls (play/pause/stop), file upload button
- **Main Canvas**: Horizontal flow of audio nodes (Source → Gain → Destination)
- **Visualizer Panel**: Real-time waveform display at the bottom

### Responsive Breakpoints
- Desktop-first (1024px+)
- Tablet support (768px)
- Mobile: Not primary target for prototype

### Visual Design

#### Color Palette
- **Background**: #0D1117 (deep dark)
- **Surface**: #161B22 (card backgrounds)
- **Border**: #30363D
- **Primary**: #58A6FF (blue accent)
- **Secondary**: #8B949E (muted text)
- **Text**: #F0F6FC
- **Waveform**: #58A6FF with #58A6FF33 fill
- **Node Input**: #7EE787 (green)
- **Node Output**: #F778BA (pink)

#### Typography
- **Font Family**: "JetBrains Mono", monospace
- **Headings**: 18px bold
- **Body**: 14px regular
- **Labels**: 12px medium

#### Spacing
- Base unit: 8px
- Card padding: 16px
- Gap between nodes: 24px

#### Visual Effects
- Node cards: subtle box-shadow (0 4px 12px rgba(0,0,0,0.4))
- Hover states: border-color transition to primary
- Smooth waveform animation

### Components

#### 1. Header Bar
- App logo/title
- File upload button (styled)
- Transport controls: Play, Pause, Stop buttons
- Time display (current position / total duration)

#### 2. Audio Node Card
- Title (e.g., "Source", "Gain", "Output")
- Input port (left side, circular)
- Output port (right side, circular)
- Parameters panel (for Gain: volume slider 0-200%)
- Connected state indicators

#### 3. Waveform Visualizer
- Canvas element showing real-time audio waveform
- Background grid lines
- Center line at 0 amplitude

## Functionality Specification

### Core Features

#### 1. Audio File Loading
- Click "Load Audio" button to open file picker
- Accept audio files: mp3, wav, ogg, flac
- Decode audio using AudioContext.decodeAudioData()
- Display file name and duration after loading

#### 2. Audio Playback Pipeline
- Source: AudioBufferSourceNode (loaded audio file)
- Gain: GainNode (volume control 0-2)
- Destination: AudioContext.destination (speakers)
- Connections: Source → Gain → Analyser → Destination

#### 3. Transport Controls
- Play: Start/resume audio playback
- Pause: Pause playback
- Stop: Stop and reset to beginning

#### 4. Parameter Control
- Gain slider: Range 0-200%, default 100%
- Real-time parameter updates via AudioParam

#### 5. Visualization
- AnalyserNode connected to output
- requestAnimationFrame loop for canvas drawing
- Time-domain data (oscilloscope style)

### User Interactions
1. Click "Load Audio" → File picker opens → Select file → Audio loads → Nodes become active
2. Click "Play" → Audio plays through chain → Visualizer animates
3. Adjust Gain slider → Volume changes in real-time
4. Click "Stop" → Playback stops, position resets

### Edge Cases
- No file loaded: Disable play button
- File decode error: Show error message
- AudioContext suspended: Resume on user interaction
- Browser doesn't support Web Audio: Show warning

## Acceptance Criteria

### Visual Checkpoints
- [ ] Dark theme with specified colors applied
- [ ] Three node cards displayed horizontally
- [ ] Node ports visible (input left, output right)
- [ ] Gain slider functional
- [ ] Waveform visualizer renders

### Functional Checkpoints
- [ ] Can load audio file via button
- [ ] Audio plays through Source → Gain → Output chain
- [ ] Gain parameter affects volume in real-time
- [ ] Play/Pause/Stop controls work correctly
- [ ] Visualizer shows animated waveform during playback
- [ ] Time display updates during playback
