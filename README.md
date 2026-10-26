# SonicGlow RGB Studio v0.2 Pro

A high-performance React + TypeScript audio-reactive lighting suite and spectrum analyzer built with the Web Audio API.

## Features

### 🎵 Multi-Source Audio Engine
- **In-Browser Web Audio Synthesizer**: Instant demo generation with 3 presets (*Neon Synthwave*, *Cyber Bass Drop*, *Aurora Chill*) — zero audio files required to test!
- **Local Audio Player**: Full drag-and-drop support for `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a` files with time scrubbing, loop toggle, and variable playback speeds (0.75x–1.5x).
- **Live Microphone Input**: Real-time room and voice audio capture via `getUserMedia` with automatic acoustic feedback isolation.

### 🎨 10 Bespoke RGB Chromatic Palettes
- **Spectrum**: Classic neon violet, cyan, and hot pink
- **Cyberpunk**: High-contrast neon magenta, electric purple, and cyan
- **Ocean Aurora**: Deep bioluminescent aqua, sapphire, and mint teal
- **Sunset Mirage**: Warm rose coral, flame orange, and golden sunlight
- **Emerald Matrix**: Toxic acid green and cyber emerald
- **Bloodmoon**: Fierce crimson flame and volcanic violet
- **Synthwave 80s**: Outrun retro fuchsia, sunset peach, and sky blue
- **Prism Rainbow**: Dynamic 360° continuous chromatic hue cycling
- **Hyper White**: Platinum diamond and frosted azure
- **Imperial Gold**: Luxurious amber gold and royal indigo

### ✨ 7 Canvas Visualizer Animation Modes
1. **Bars (Spectrum)**: Dynamic frequency bars with falling peak hold indicators
2. **Radial**: 360° circular sonic starburst around a pulsating sub-bass center
3. **Wave**: Smooth multi-layered flowing neon oscillograms
4. **Pulse**: Concentric acoustic shockwaves rippling outward on beat drops
5. **Cosmic**: 90+ audio-reactive stardust particles with physics acceleration
6. **Stereo**: Dual-channel symmetrical center-out equalizer
7. **Matrix**: Digital neon rain columns that accelerate with audio energy

### 🎛️ Sound Shaping & Hardware Rig Emulation
- **3-Band Equalizer (EQ)**: Real-time Lowshelf, Peaking, and Highshelf Biquad filters (-10dB to +12dB).
- **4-Zone Chroma Emulator**: Simulated physical LED hardware (Left Speaker Tower, Top Lightbar, Right Speaker Tower, and Desk Underglow).
- **Room Ambilight Effect**: Immersive edge glow projection synced to the music.
- **Fullscreen Stage View**: Press the fullscreen button or `Esc` to toggle cinema mode.

## Development

```powershell
npm install
npm run dev
```

## Production Build

```powershell
npm run build
npm run preview
```

## License
MIT
