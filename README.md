# SonicGlow RGB MVP v0.1

A React + TypeScript browser MVP that plays a local audio file and visualizes its frequency energy in real time.

## Requirements
- Node.js LTS
- npm
- VS Code (recommended)

## Run
```powershell
npm install
npm run dev
```
Open the local URL printed by Vite (normally http://localhost:5173).

## Production build
```powershell
npm run build
npm run preview
```

## Features
- Local audio-file playback
- Web Audio API analyser (FFT frequency bins + time-domain RMS estimate)
- Bass, midrange, treble and energy meters
- Animated canvas spectrum, wave and bass-pulse effects
- Color themes, sensitivity and brightness controls
- Responsive dark UI

## Scope and limitations
This MVP only analyzes audio played by its in-app audio player. It does not capture system-wide audio from Spotify, YouTube, VLC, or games. It does not yet control physical RGB devices. Those require a desktop audio-capture layer (for example, Tauri/Rust + Windows WASAPI loopback) and a compatible hardware integration.

The audio file is processed locally in the browser; the app does not upload it.

If the Google Fonts import is unavailable, the app falls back to local system fonts.
