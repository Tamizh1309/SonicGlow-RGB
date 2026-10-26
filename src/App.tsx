import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import {
  Activity, AudioLines, CircleHelp, Disc3, Headphones, Music2,
  Pause, Play, Radio, RotateCcw, Settings2, Sparkles, Upload, Volume2,
} from "lucide-react";

type Theme = "spectrum" | "cyberpunk" | "ocean" | "sunset";
type Effect = "spectrum" | "wave" | "pulse";

type Metrics = { bass: number; mid: number; treble: number; volume: number };

const THEMES: Record<Theme, { label: string; hue: number; colors: string[] }> = {
  spectrum: { label: "Spectrum", hue: 265, colors: ["#8b5cf6", "#06b6d4", "#ec4899"] },
  cyberpunk: { label: "Cyberpunk", hue: 315, colors: ["#ff2bd6", "#8b5cf6", "#22d3ee"] },
  ocean: { label: "Ocean", hue: 190, colors: ["#06b6d4", "#3b82f6", "#2dd4bf"] },
  sunset: { label: "Sunset", hue: 25, colors: ["#fb7185", "#f97316", "#facc15"] },
};

const EMPTY_METRICS: Metrics = { bass: 0, mid: 0, treble: 0, volume: 0 };

function averageBand(data: Uint8Array, startHz: number, endHz: number, sampleRate: number, fftSize: number) {
  const binHz = sampleRate / fftSize;
  const start = Math.max(1, Math.floor(startHz / binHz));
  const end = Math.min(data.length - 1, Math.ceil(endHz / binHz));
  if (end < start) return 0;
  let total = 0;
  for (let i = start; i <= end; i++) total += data[i];
  return total / (end - start + 1) / 255;
}

function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const smoothRef = useRef<Metrics>(EMPTY_METRICS);
  const [fileName, setFileName] = useState("Choose a track to begin");
  const [objectUrl, setObjectUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState<Theme>("spectrum");
  const [effect, setEffect] = useState<Effect>("spectrum");
  const [sensitivity, setSensitivity] = useState(1.25);
  const [brightness, setBrightness] = useState(75);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const selectedTheme = THEMES[theme];
  const colors = selectedTheme.colors;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const stopAnimation = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const startAudioGraph = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      let ctx = contextRef.current;
      if (!ctx) {
        ctx = new AudioContext();
        contextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.78;
        analyserRef.current = analyser;
        const source = ctx.createMediaElementSource(audio);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        freqRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        timeRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize));
      }
      if (ctx.state === "suspended") await ctx.resume();
      audio.play().catch(() => setError("Playback was blocked. Press Play again."));
      setError("");
    } catch {
      setError("Could not initialize audio analysis. Try refreshing the page.");
    }
  };

  useEffect(() => {
    let running = true;
    const draw = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      const freq = freqRef.current;
      const time = timeRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          const gradient = ctx.createLinearGradient(0, height, width, 0);
          gradient.addColorStop(0, colors[0]);
          gradient.addColorStop(0.5, colors[1]);
          gradient.addColorStop(1, colors[2]);
          const bandCount = 54;
          const gap = 3 * dpr;
          const barWidth = (width - gap * (bandCount - 1)) / bandCount;
          const active = analyser && freq && isPlaying;
          if (active && freq && time && analyser) {
            analyser.getByteFrequencyData(freq);
            analyser.getFloatTimeDomainData(time);
            const sr = contextRef.current?.sampleRate ?? 44100;
            const raw: Metrics = {
              bass: averageBand(freq, 30, 250, sr, analyser.fftSize),
              mid: averageBand(freq, 250, 2000, sr, analyser.fftSize),
              treble: averageBand(freq, 2000, 10000, sr, analyser.fftSize),
              volume: Math.sqrt(time.reduce((sum, sample) => sum + sample * sample, 0) / time.length),
            };
            const boost = (v: number) => Math.min(1, v * sensitivity * 1.9);
            const next: Metrics = {
              bass: boost(raw.bass),
              mid: boost(raw.mid),
              treble: boost(raw.treble),
              volume: Math.min(1, raw.volume * sensitivity * 3.5),
            };
            const old = smoothRef.current;
            const smoothed = {
              bass: old.bass * 0.72 + next.bass * 0.28,
              mid: old.mid * 0.72 + next.mid * 0.28,
              treble: old.treble * 0.72 + next.treble * 0.28,
              volume: old.volume * 0.72 + next.volume * 0.28,
            };
            smoothRef.current = smoothed;
            setMetrics(smoothed);

            for (let i = 0; i < bandCount; i++) {
              const bin = Math.min(freq.length - 1, Math.floor(Math.pow(i / bandCount, 1.7) * freq.length));
              const value = freq[bin] / 255;
              const heightRatio = Math.max(0.025, Math.min(1, value * sensitivity * 2.8));
              const barHeight = height * heightRatio * (0.32 + smoothed.volume * 0.68);
              const x = i * (barWidth + gap);
              ctx.fillStyle = gradient;
              ctx.globalAlpha = 0.55 + Math.min(0.45, value);
              if (effect === "wave") {
                const waveY = height * 0.5 + Math.sin(i * 0.35 + performance.now() * 0.002) * height * heightRatio * 0.35;
                ctx.fillRect(x, waveY, barWidth, Math.max(2 * dpr, barHeight * 0.3));
              } else {
                const h = effect === "pulse" ? barHeight * (0.4 + smoothed.bass * 1.4) : barHeight;
                ctx.fillRect(x, height - h, barWidth, h);
              }
            }
            ctx.globalAlpha = 1;
          } else {
            for (let i = 0; i < bandCount; i++) {
              const idle = 0.08 + Math.abs(Math.sin(i * 0.33 + performance.now() * 0.0007)) * 0.18;
              const barHeight = height * idle;
              ctx.fillStyle = gradient;
              ctx.globalAlpha = 0.42;
              ctx.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight);
            }
            ctx.globalAlpha = 1;
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      running = false;
      stopAnimation();
    };
    // Canvas animation intentionally reads current settings from this effect.
  }, [colors, effect, isPlaying, sensitivity]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    const onError = () => setError("This audio file could not be played. Try an MP3, WAV, OGG, or M4A file.");
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [objectUrl]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => () => {
    stopAnimation();
    void contextRef.current?.close();
  }, []);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Please choose an audio file.");
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    setFileName(file.name);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError("");
    smoothRef.current = EMPTY_METRICS;
    if (audioRef.current) audioRef.current.pause();
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !objectUrl) {
      fileInputRef.current?.click();
      return;
    }
    if (audio.paused) {
      await startAudioGraph();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const stopPlayback = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current && duration > 0) {
      audioRef.current.currentTime = (Number(event.target.value) / 100) * duration;
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const meterValue = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100);
  const glowStyle = useMemo(() => ({
    background: `radial-gradient(ellipse at 50% 80%, ${colors[0]}22 0%, transparent 55%), radial-gradient(ellipse at 80% 10%, ${colors[1]}18 0%, transparent 45%)`,
    "--accent": colors[0],
    "--accent-two": colors[1],
  } as CSSProperties), [colors]);

  return (
    <main className="app-shell" style={glowStyle}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="app-content">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon"><AudioLines size={23} /></div>
            <div><div className="brand-name">SonicGlow <span>RGB</span></div><div className="brand-subtitle">AUDIO REACTIVE STUDIO</div></div>
          </div>
          <div className="header-right">
            <span className="status-dot" />
            <span className="status-text">VISUALIZER READY</span>
            <button className="icon-button" title="MVP information" onClick={() => setError("MVP mode: audio files only. System-wide audio capture and physical RGB hardware are planned next.")}><CircleHelp size={18} /></button>
          </div>
        </header>

        <section className="hero">
          <div>
            <div className="eyebrow"><Sparkles size={14} /> YOUR MUSIC, IN COLOR</div>
            <h1>Feel the <span>frequency.</span></h1>
            <p className="hero-copy">Turn sound into a living spectrum of color. Every beat, every layer, every vibe.</p>
          </div>
          <div className="hero-orb"><div className="orb-core"><AudioLines size={32} /></div></div>
        </section>

        <section className="workspace">
          <div className="main-column">
            <section className="panel visualizer-panel">
              <div className="panel-heading">
                <div><div className="panel-title"><Activity size={17} /> Live visualizer</div><div className="panel-caption">Audio frequency response</div></div>
                <span className="live-tag"><span /> {isPlaying ? "LIVE" : "STANDBY"}</span>
              </div>
              <div className="canvas-wrap"><canvas ref={canvasRef} aria-label="Audio spectrum visualizer" /><div className="canvas-labels"><span>LOW</span><span>MID</span><span>HIGH</span></div></div>
              <div className="metrics-grid">
                <Metric label="BASS" value={meterValue(metrics.bass)} color="#fb7185" />
                <Metric label="MIDRANGE" value={meterValue(metrics.mid)} color="#a78bfa" />
                <Metric label="TREBLE" value={meterValue(metrics.treble)} color="#22d3ee" />
                <Metric label="ENERGY" value={meterValue(metrics.volume)} color="#34d399" />
              </div>
            </section>

            <section className="panel player-panel">
              <div className="panel-heading">
                <div><div className="panel-title"><Disc3 size={17} /> Audio player</div><div className="panel-caption">Load a local audio file to start</div></div>
                <button className="secondary-button" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Choose file</button>
              </div>
              <input ref={fileInputRef} className="hidden-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" onChange={handleFile} />
              <audio ref={audioRef} src={objectUrl || undefined} crossOrigin="anonymous" />
              <div className="track-row">
                <div className="track-art"><Music2 size={25} /></div>
                <div className="track-info"><strong title={fileName}>{fileName}</strong><span>{objectUrl ? "Local audio file" : "No track loaded"}</span></div>
                <div className="player-actions">
                  <button className="play-button" onClick={() => void togglePlayback()} title={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button>
                  <button className="icon-button" onClick={stopPlayback} title="Stop and rewind"><RotateCcw size={17} /></button>
                </div>
              </div>
              <div className="timeline"><span>{formatTime(currentTime)}</span><input aria-label="Seek audio" type="range" min="0" max="100" value={progress} onChange={seek} style={{ "--range-progress": `${progress}%` } as CSSProperties} /><span>{formatTime(duration)}</span></div>
              {error && <div className="error-message" role="status">{error}</div>}
            </section>
          </div>

          <aside className="side-column">
            <section className="panel settings-panel">
              <div className="panel-heading"><div><div className="panel-title"><Settings2 size={17} /> Light studio</div><div className="panel-caption">Shape your atmosphere</div></div></div>
              <div className="setting-block">
                <label className="setting-label">Color palette</label>
                <div className="theme-grid">{(Object.keys(THEMES) as Theme[]).map(key => <button key={key} className={`theme-option ${theme === key ? "selected" : ""}`} onClick={() => setTheme(key)}><span className="theme-swatches">{THEMES[key].colors.map(c => <i key={c} style={{ background: c }} />)}</span><span>{THEMES[key].label}</span></button>)}</div>
              </div>
              <div className="setting-block">
                <div className="label-line"><label htmlFor="effect">Animation style</label><span className="small-value">{effect.toUpperCase()}</span></div>
                <select id="effect" value={effect} onChange={e => setEffect(e.target.value as Effect)} className="select-control">
                  <option value="spectrum">Frequency spectrum</option><option value="wave">Flowing wave</option><option value="pulse">Bass pulse</option>
                </select>
              </div>
              <RangeControl label="Sensitivity" value={sensitivity} min={0.5} max={2.5} step={0.05} display={`${sensitivity.toFixed(2)}×`} onChange={setSensitivity} />
              <RangeControl label="Brightness" value={brightness} min={10} max={100} step={1} display={`${brightness}%`} onChange={setBrightness} />
              <div className="brightness-preview"><div className="brightness-light" style={{ opacity: brightness / 100, background: `linear-gradient(90deg, ${colors.join(", ")})`, boxShadow: `0 0 ${Math.round(brightness / 4)}px ${colors[0]}` }} /><span><Volume2 size={14} /> Brightness preview</span></div>
              <button className="reset-button" onClick={() => { setTheme("spectrum"); setEffect("spectrum"); setSensitivity(1.25); setBrightness(75); }}><RotateCcw size={14} /> Reset controls</button>
            </section>

            <section className="panel connection-panel">
              <div className="panel-title"><Radio size={17} /> Output connections</div>
              <div className="connection-row"><div className="connection-icon"><Headphones size={17} /></div><div className="connection-copy"><strong>System audio</strong><span>Planned for desktop build</span></div><span className="connection-status">NEXT</span></div>
              <div className="connection-row"><div className="connection-icon"><Sparkles size={17} /></div><div className="connection-copy"><strong>RGB hardware</strong><span>No device connected</span></div><span className="connection-status muted">LATER</span></div>
              <div className="connection-note">This MVP visualizes audio played inside the app. It does not yet capture sound from other desktop applications.</div>
            </section>
          </aside>
        </section>

        <footer className="footer"><span>SONICGLOW RGB <span className="footer-dot">•</span> MVP 0.1</span><span>BUILT FOR THE BEAT <span className="footer-dot">•</span> LOCAL AUDIO STAYS LOCAL</span></footer>
      </div>
    </main>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><strong>{value}%</strong></div><div className="meter-track"><div className="meter-fill" style={{ width: `${value}%`, background: color, boxShadow: `0 0 10px ${color}55` }} /></div></div>;
}

function RangeControl({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  const percent = ((value - min) / (max - min)) * 100;
  return <div className="setting-block range-block"><div className="label-line"><label htmlFor={id}>{label}</label><span className="small-value">{display}</span></div><input id={id} className="range-control" type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ "--range-progress": `${percent}%` } as CSSProperties} /></div>;
}

export default App;
