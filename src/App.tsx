import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ChangeEvent, CSSProperties, DragEvent } from "react";
import {
  Activity, AudioLines, Disc3, Headphones, Music2,
  Pause, Play, Radio, RotateCcw, Settings2, Sparkles, Upload, Volume2,
  VolumeX, Mic, MicOff, Maximize2, Minimize2, Sliders, Waves, Zap,
  Flame, Layers, RefreshCw
} from "lucide-react";

export type Theme =
  | "spectrum"
  | "cyberpunk"
  | "ocean"
  | "sunset"
  | "matrix"
  | "bloodmoon"
  | "synthwave"
  | "rainbow"
  | "hyperwhite"
  | "royal";

export type Effect =
  | "spectrum"
  | "radial"
  | "wave"
  | "pulse"
  | "particles"
  | "stereo"
  | "matrix";

export type AudioSourceType = "file" | "synth" | "mic";

export type Metrics = {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  peak: number;
};

export interface ThemeData {
  label: string;
  colors: string[];
  description: string;
}

export const THEMES: Record<Theme, ThemeData> = {
  spectrum: {
    label: "Spectrum",
    colors: ["#8b5cf6", "#06b6d4", "#ec4899"],
    description: "Classic neon tri-color aura",
  },
  cyberpunk: {
    label: "Cyberpunk",
    colors: ["#ff007f", "#7928ca", "#00f0ff"],
    description: "High-contrast neon Tokyo night",
  },
  ocean: {
    label: "Ocean Aurora",
    colors: ["#06b6d4", "#3b82f6", "#10b981"],
    description: "Deep bioluminescent currents",
  },
  sunset: {
    label: "Sunset Mirage",
    colors: ["#fb7185", "#f97316", "#facc15"],
    description: "Warm dusk horizon glow",
  },
  matrix: {
    label: "Emerald Matrix",
    colors: ["#22c55e", "#10b981", "#06d6a0"],
    description: "Acid terminal cyber energy",
  },
  bloodmoon: {
    label: "Bloodmoon",
    colors: ["#ef4444", "#ea580c", "#831843"],
    description: "Fierce crimson flame radiance",
  },
  synthwave: {
    label: "Synthwave 80s",
    colors: ["#d946ef", "#fb923c", "#38bdf8"],
    description: "Outrun retro purple & peach",
  },
  rainbow: {
    label: "Prism Rainbow",
    colors: ["#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ec4899"],
    description: "Full dynamic chromatic cycle",
  },
  hyperwhite: {
    label: "Hyper White",
    colors: ["#ffffff", "#94a3b8", "#38bdf8"],
    description: "Crystalline diamond brilliance",
  },
  royal: {
    label: "Imperial Gold",
    colors: ["#f59e0b", "#fbbf24", "#6366f1"],
    description: "Luxurious amber & royal velvet",
  },
};

const EMPTY_METRICS: Metrics = { bass: 0, mid: 0, treble: 0, volume: 0, peak: 0 };

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface MatrixDrop {
  x: number;
  y: number;
  speed: number;
  chars: string[];
}

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
  // Audio & Graph Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const synthTimerRef = useRef<number | null>(null);
  const synthGainRef = useRef<GainNode | null>(null);

  // Animation Refs
  const rafRef = useRef<number | null>(null);
  const freqRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const peakBarsRef = useRef<number[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const matrixDropsRef = useRef<MatrixDrop[]>([]);
  const smoothRef = useRef<Metrics>(EMPTY_METRICS);

  // Playback & Source State
  const [activeSource, setActiveSource] = useState<AudioSourceType>("synth");
  const [fileName, setFileName] = useState("Synthwave Demo Generator");
  const [objectUrl, setObjectUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [synthPreset, setSynthPreset] = useState<"cyber" | "synthwave" | "chill">("synthwave");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);

  // Visualizer Settings
  const [theme, setTheme] = useState<Theme>("spectrum");
  const [effect, setEffect] = useState<Effect>("spectrum");
  const [sensitivity, setSensitivity] = useState(1.3);
  const [smoothing, setSmoothing] = useState(0.8);
  const [brightness, setBrightness] = useState(85);
  const [glowIntensity, setGlowIntensity] = useState(70);
  const [showAmbilight, setShowAmbilight] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRigSim, setShowRigSim] = useState(true);

  // Equalizer Settings
  const [bassGain, setBassGain] = useState(3); // in dB
  const [midGain, setMidGain] = useState(1);
  const [trebleGain, setTrebleGain] = useState(2);

  // Dynamic Metrics & UI State
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [bpmEstimate, setBpmEstimate] = useState(128);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const selectedTheme = THEMES[theme];
  const colors = selectedTheme.colors;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Initialize Audio Context and Filter Pipeline
  const getAudioContext = useCallback(() => {
    if (!contextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      contextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = smoothing;
      analyserRef.current = analyser;

      // 3-Band Equalizer Filters
      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 220;
      bass.gain.value = bassGain;
      bassFilterRef.current = bass;

      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1100;
      mid.Q.value = 1.0;
      mid.gain.value = midGain;
      midFilterRef.current = mid;

      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 3500;
      treble.gain.value = trebleGain;
      trebleFilterRef.current = treble;

      const master = ctx.createGain();
      master.gain.value = isMuted ? 0 : volume / 100;
      masterGainRef.current = master;

      const synthGain = ctx.createGain();
      synthGain.gain.value = 0.8;
      synthGainRef.current = synthGain;

      // EQ routing to Master Gain then Analyser then Destination
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(master);
      master.connect(analyser);
      analyser.connect(ctx.destination);

      synthGain.connect(bass);

      freqRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      timeRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize));
    }
    return contextRef.current;
  }, [bassGain, midGain, trebleGain, isMuted, volume, smoothing]);

  // Update EQ and Volume Nodes dynamically
  useEffect(() => {
    if (bassFilterRef.current) bassFilterRef.current.gain.value = bassGain;
  }, [bassGain]);

  useEffect(() => {
    if (midFilterRef.current) midFilterRef.current.gain.value = midGain;
  }, [midGain]);

  useEffect(() => {
    if (trebleFilterRef.current) trebleFilterRef.current.gain.value = trebleGain;
  }, [trebleGain]);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = isMuted ? 0 : volume / 100;
    }
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.smoothingTimeConstant = smoothing;
    }
  }, [smoothing]);

  // Audio Synth Engine (Zero External Audio File Required)
  const stopSynth = useCallback(() => {
    if (synthTimerRef.current !== null) {
      window.clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
  }, []);

  const startSynth = useCallback(() => {
    stopSynth();
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    let step = 0;
    const synthNode = synthGainRef.current;
    if (!synthNode) return;

    const chords = [
      [130.81, 164.81, 196.00], // C3 minor
      [116.54, 146.83, 174.61], // Bb2 major
      [103.83, 130.81, 155.56], // Ab2 major
      [116.54, 146.83, 174.61], // Bb2
    ];

    const arpNotes = [261.63, 311.13, 392.00, 523.25, 466.16, 392.00, 311.13, 261.63];

    const interval = window.setInterval(() => {
      const now = ctx.currentTime;
      const isKick = step % 4 === 0;
      const isSnare = step % 8 === 4;
      const isHiHat = step % 2 === 1;

      // 1. Kick Drum
      if (isKick) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(synthPreset === "cyber" ? 170 : 130, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.14);
        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(synthNode);
        osc.start(now);
        osc.stop(now + 0.2);
      }

      // 2. Snare / Noise Clap
      if (isSnare) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1400, now);
        filter.Q.setValueAtTime(2.5, now);
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(synthNode);
        osc.start(now);
        osc.stop(now + 0.17);
      }

      // 3. Hi-Hat
      if (isHiHat) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(9500, now);
        filter.type = "highpass";
        filter.frequency.setValueAtTime(7000, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(synthNode);
        osc.start(now);
        osc.stop(now + 0.05);
      }

      // 4. Synth Arpeggio / Melodic Pulse
      const arpFreq = arpNotes[step % arpNotes.length] * (synthPreset === "cyber" ? 1.5 : 1);
      const arpOsc = ctx.createOscillator();
      const arpGain = ctx.createGain();
      const arpFilter = ctx.createBiquadFilter();
      arpOsc.type = synthPreset === "cyber" ? "sawtooth" : "triangle";
      arpOsc.frequency.setValueAtTime(arpFreq, now);
      arpFilter.type = "lowpass";
      arpFilter.frequency.setValueAtTime(1200 + Math.sin(step * 0.4) * 800, now);
      arpGain.gain.setValueAtTime(0.24, now);
      arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      arpOsc.connect(arpFilter);
      arpFilter.connect(arpGain);
      arpGain.connect(synthNode);
      arpOsc.start(now);
      arpOsc.stop(now + 0.15);

      // 5. Ambient Sub-Bass Chords
      if (step % 8 === 0) {
        const chordIndex = Math.floor(step / 8) % chords.length;
        chords[chordIndex].forEach((freq) => {
          const padOsc = ctx.createOscillator();
          const padGain = ctx.createGain();
          padOsc.type = "sine";
          padOsc.frequency.setValueAtTime(freq, now);
          padGain.gain.setValueAtTime(0.12, now);
          padGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
          padOsc.connect(padGain);
          padGain.connect(synthNode);
          padOsc.start(now);
          padOsc.stop(now + 0.9);
        });
      }

      step++;
    }, 125); // 120 BPM 16th notes

    synthTimerRef.current = interval;
  }, [getAudioContext, stopSynth, synthPreset]);

  // Connect Audio File to Graph
  const connectAudioElement = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const ctx = getAudioContext();
    if (!sourceNodeRef.current) {
      const source = ctx.createMediaElementSource(audio);
      sourceNodeRef.current = source;
      if (bassFilterRef.current) {
        source.connect(bassFilterRef.current);
      }
    }
  }, [getAudioContext]);

  // Handle Switch to Live Microphone
  const startMicrophone = useCallback(async () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      micStreamRef.current = stream;
      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
      }
      const micSource = ctx.createMediaStreamSource(stream);
      micSourceRef.current = micSource;

      // Connect directly to analyser to avoid acoustic feedback loop into speakers!
      if (analyserRef.current) {
        micSource.connect(analyserRef.current);
      }

      stopSynth();
      if (audioRef.current) audioRef.current.pause();

      setActiveSource("mic");
      setIsPlaying(true);
      setFileName("Live Microphone / Audio Input");
      setError("");
      setInfoMessage("Microphone active! Speak, play music nearby, or hum.");
    } catch {
      setError("Microphone access was denied or not available. Please allow mic permission.");
    }
  }, [getAudioContext, stopSynth]);

  const stopMicrophone = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
  }, []);

  // Playback Control Handlers
  const togglePlay = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    if (activeSource === "synth") {
      if (isPlaying) {
        stopSynth();
        setIsPlaying(false);
      } else {
        startSynth();
        setIsPlaying(true);
      }
    } else if (activeSource === "file") {
      const audio = audioRef.current;
      if (!audio || !objectUrl) {
        fileInputRef.current?.click();
        return;
      }
      if (audio.paused) {
        connectAudioElement();
        audio.play().catch(() => setError("Playback was blocked. Click play again."));
        setIsPlaying(true);
        setError("");
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } else if (activeSource === "mic") {
      if (isPlaying) {
        stopMicrophone();
        setIsPlaying(false);
      } else {
        void startMicrophone();
      }
    }
  }, [activeSource, connectAudioElement, getAudioContext, isPlaying, objectUrl, startMicrophone, startSynth, stopMicrophone, stopSynth]);

  const stopAudio = useCallback(() => {
    if (activeSource === "file" && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (activeSource === "synth") stopSynth();
    if (activeSource === "mic") stopMicrophone();
    setIsPlaying(false);
    setCurrentTime(0);
  }, [activeSource, stopMicrophone, stopSynth]);

  // Handle Drag & Drop Files
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      stopSynth();
      stopMicrophone();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      setFileName(file.name);
      setActiveSource("file");
      setIsPlaying(false);
      setCurrentTime(0);
      setError("");
      setInfoMessage(`Loaded: ${file.name}`);
    } else {
      setError("Please drop a valid audio file (.mp3, .wav, .flac, .ogg, .m4a)");
    }
  }, [objectUrl, stopMicrophone, stopSynth]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file.");
      return;
    }
    stopSynth();
    stopMicrophone();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setFileName(file.name);
    setActiveSource("file");
    setIsPlaying(false);
    setCurrentTime(0);
    setError("");
    setInfoMessage(`Loaded: ${file.name}`);
  };

  // Switch to Synth Preset
  const selectSynthPreset = (preset: "cyber" | "synthwave" | "chill") => {
    setSynthPreset(preset);
    setActiveSource("synth");
    stopMicrophone();
    if (audioRef.current) audioRef.current.pause();
    const titles = {
      cyber: "Cyber Bass Drop Demo (128 BPM)",
      synthwave: "Neon Synthwave Demo (120 BPM)",
      chill: "Cosmic Aurora Demo (90 BPM)",
    };
    setFileName(titles[preset]);
    if (isPlaying) {
      startSynth();
    }
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
      if (e.key === " " && e.target === document.body) {
        e.preventDefault();
        void togglePlay();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, togglePlay]);

  // Audio Element Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (!isLooping) setIsPlaying(false);
    };
    const onError = () => setError("Could not decode audio. Try another audio format.");

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
  }, [isLooping, objectUrl]);

  // Initialize Canvas Particles & Matrix Drops
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.003,
        vy: (Math.random() - 0.5) * 0.003,
        size: Math.random() * 3 + 1,
        hue: Math.random() * 360,
        alpha: Math.random() * 0.7 + 0.3,
        life: Math.random() * 100,
        maxLife: Math.random() * 100 + 100,
      });
    }
    particlesRef.current = particles;

    const drops: MatrixDrop[] = [];
    const glyphs = "0101XYZ01AB789!#%*+~";
    for (let i = 0; i < 45; i++) {
      drops.push({
        x: i / 45,
        y: Math.random(),
        speed: Math.random() * 0.008 + 0.004,
        chars: Array.from({ length: 12 }, () => glyphs[Math.floor(Math.random() * glyphs.length)]),
      });
    }
    matrixDropsRef.current = drops;
  }, []);

  // Main Canvas Animation Render Loop
  useEffect(() => {
    let running = true;
    let rainbowHue = 0;

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

          // Dynamic Color Selection
          rainbowHue = (rainbowHue + 0.6) % 360;
          let themeCol1 = colors[0];
          let themeCol2 = colors[1] || colors[0];
          let themeCol3 = colors[2] || colors[0];

          if (theme === "rainbow") {
            themeCol1 = `hsl(${rainbowHue}, 90%, 60%)`;
            themeCol2 = `hsl(${(rainbowHue + 120) % 360}, 90%, 60%)`;
            themeCol3 = `hsl(${(rainbowHue + 240) % 360}, 90%, 60%)`;
          }

          const gradient = ctx.createLinearGradient(0, height, width, 0);
          gradient.addColorStop(0, themeCol1);
          gradient.addColorStop(0.5, themeCol2);
          gradient.addColorStop(1, themeCol3);

          const active = analyser && freq && isPlaying;

          let rawBass = 0;
          let rawMid = 0;
          let rawTreble = 0;
          let rawVolume = 0;

          if (active && freq && time && analyser) {
            analyser.getByteFrequencyData(freq);
            analyser.getFloatTimeDomainData(time);
            const sr = contextRef.current?.sampleRate ?? 44100;
            rawBass = averageBand(freq, 20, 240, sr, analyser.fftSize);
            rawMid = averageBand(freq, 240, 2400, sr, analyser.fftSize);
            rawTreble = averageBand(freq, 2400, 11000, sr, analyser.fftSize);
            rawVolume = Math.sqrt(time.reduce((sum, sample) => sum + sample * sample, 0) / time.length);
          }

          const boost = (v: number) => Math.min(1, v * sensitivity * 2.1);
          const nextMetrics: Metrics = {
            bass: boost(rawBass),
            mid: boost(rawMid),
            treble: boost(rawTreble),
            volume: Math.min(1, rawVolume * sensitivity * 3.8),
            peak: Math.max(boost(rawBass), boost(rawMid), boost(rawTreble)),
          };

          const old = smoothRef.current;
          const smoothed: Metrics = {
            bass: old.bass * 0.7 + nextMetrics.bass * 0.3,
            mid: old.mid * 0.7 + nextMetrics.mid * 0.3,
            treble: old.treble * 0.7 + nextMetrics.treble * 0.3,
            volume: old.volume * 0.7 + nextMetrics.volume * 0.3,
            peak: Math.max(old.peak * 0.85, nextMetrics.peak),
          };
          smoothRef.current = smoothed;
          setMetrics(smoothed);

          // Update dynamic BPM estimation display
          if (smoothed.bass > 0.65) {
            setBpmEstimate(Math.round(118 + smoothed.bass * 24));
          }

          // Visualizer Rendering by Effect Mode
          const glowAlpha = (glowIntensity / 100);
          ctx.shadowBlur = glowIntensity > 0 ? 16 * glowAlpha : 0;
          ctx.shadowColor = themeCol1;

          // 1. SPECTRUM BARS WITH FLOATING PEAKS
          if (effect === "spectrum") {
            const bandCount = 64;
            const gap = 3 * dpr;
            const barWidth = Math.max(2, (width - gap * (bandCount - 1)) / bandCount);

            if (peakBarsRef.current.length !== bandCount) {
              peakBarsRef.current = new Array(bandCount).fill(0);
            }

            for (let i = 0; i < bandCount; i++) {
              let value = 0;
              if (active && freq) {
                const bin = Math.min(freq.length - 1, Math.floor(Math.pow(i / bandCount, 1.65) * freq.length));
                value = freq[bin] / 255;
              } else {
                value = 0.08 + Math.abs(Math.sin(i * 0.3 + performance.now() * 0.001)) * 0.16;
              }

              const barHeight = Math.max(4, height * Math.min(1, value * sensitivity * 1.8) * (0.35 + smoothed.volume * 0.65));
              const x = i * (barWidth + gap);
              const y = height - barHeight;

              // Falling peak tracking
              if (barHeight > peakBarsRef.current[i]) {
                peakBarsRef.current[i] = barHeight;
              } else {
                peakBarsRef.current[i] = Math.max(0, peakBarsRef.current[i] - 1.8 * dpr);
              }

              // Draw Bar
              ctx.fillStyle = gradient;
              ctx.globalAlpha = 0.75 + value * 0.25;
              ctx.fillRect(x, y, barWidth, barHeight);

              // Draw Peak Cap
              const peakY = height - peakBarsRef.current[i] - 3 * dpr;
              ctx.fillStyle = themeCol3;
              ctx.globalAlpha = 0.9;
              ctx.fillRect(x, Math.max(0, peakY), barWidth, 2 * dpr);
            }
          }

          // 2. RADIAL / CIRCULAR SONIC STARBURST
          else if (effect === "radial") {
            const cx = width / 2;
            const cy = height / 2;
            const baseRadius = Math.min(width, height) * 0.22 + smoothed.bass * 25 * dpr;
            const rays = 72;

            // Pulsing Center Orb
            const radialGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius);
            radialGrad.addColorStop(0, `${themeCol2}cc`);
            radialGrad.addColorStop(0.7, `${themeCol1}66`);
            radialGrad.addColorStop(1, "transparent");
            ctx.fillStyle = radialGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
            ctx.fill();

            // Radiating Frequency Spokes
            ctx.lineWidth = 2.5 * dpr;
            ctx.strokeStyle = gradient;
            ctx.lineCap = "round";

            for (let i = 0; i < rays; i++) {
              const angle = (i / rays) * Math.PI * 2;
              let val = 0;
              if (active && freq) {
                const bin = Math.min(freq.length - 1, Math.floor((i / rays) * (freq.length / 2)));
                val = (freq[bin] / 255) * sensitivity * 1.6;
              } else {
                val = 0.15 + Math.sin(i * 0.4 + performance.now() * 0.0015) * 0.12;
              }

              const len = baseRadius + val * (Math.min(width, height) * 0.32);
              const x1 = cx + Math.cos(angle) * (baseRadius + 4);
              const y1 = cy + Math.sin(angle) * (baseRadius + 4);
              const x2 = cx + Math.cos(angle) * len;
              const y2 = cy + Math.sin(angle) * len;

              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }

          // 3. FLUID MULTI-LAYER NEON WAVE
          else if (effect === "wave") {
            const layers = 3;
            for (let l = 0; l < layers; l++) {
              ctx.beginPath();
              ctx.lineWidth = (3 - l) * dpr;
              ctx.strokeStyle = l === 0 ? themeCol1 : l === 1 ? themeCol2 : themeCol3;
              ctx.globalAlpha = 0.85 - l * 0.2;

              const points = 80;
              for (let i = 0; i <= points; i++) {
                const nx = (i / points) * width;
                let ny = height * 0.5;

                if (active && time) {
                  const sampleIndex = Math.floor((i / points) * (time.length - 1));
                  const sampleVal = time[sampleIndex] || 0;
                  const waveAmp = (height * 0.35) * (0.6 + smoothed.volume * 1.2) * sensitivity;
                  ny += sampleVal * waveAmp + Math.sin(i * 0.18 + performance.now() * 0.002 + l) * 15;
                } else {
                  ny += Math.sin(i * 0.14 + performance.now() * 0.002 + l * 1.5) * (30 * dpr);
                }

                if (i === 0) ctx.moveTo(nx, ny);
                else ctx.lineTo(nx, ny);
              }
              ctx.stroke();
            }
          }

          // 4. ACOUSTIC SHOCKWAVE PULSE
          else if (effect === "pulse") {
            const cx = width / 2;
            const cy = height / 2;
            const rings = 7;
            const maxR = Math.hypot(cx, cy);

            for (let r = 0; r < rings; r++) {
              const speed = (performance.now() * 0.0012 + (r / rings)) % 1;
              const radius = speed * maxR;
              const ringAlpha = (1 - speed) * (0.3 + smoothed.bass * 0.7);

              ctx.beginPath();
              ctx.arc(cx, cy, Math.max(1, radius), 0, Math.PI * 2);
              ctx.lineWidth = (4 + smoothed.bass * 8) * dpr;
              ctx.strokeStyle = r % 2 === 0 ? themeCol1 : themeCol2;
              ctx.globalAlpha = Math.max(0, ringAlpha);
              ctx.stroke();
            }

            // Central Sonic Heart
            const heartR = 24 * dpr + smoothed.bass * 35 * dpr;
            ctx.beginPath();
            ctx.arc(cx, cy, heartR, 0, Math.PI * 2);
            ctx.fillStyle = themeCol3;
            ctx.globalAlpha = 0.8 + smoothed.bass * 0.2;
            ctx.fill();
          }

          // 5. COSMIC PARTICLE GALAXY
          else if (effect === "particles") {
            const particles = particlesRef.current;
            const bassKick = smoothed.bass > 0.5 ? smoothed.bass * 2.5 : 1;

            particles.forEach((p) => {
              p.x += p.vx * bassKick;
              p.y += p.vy * bassKick;
              if (p.x < 0) p.x = 1;
              if (p.x > 1) p.x = 0;
              if (p.y < 0) p.y = 1;
              if (p.y > 1) p.y = 0;

              const px = p.x * width;
              const py = p.y * height;
              const size = (p.size + smoothed.treble * 5) * dpr;

              ctx.fillStyle = gradient;
              ctx.globalAlpha = p.alpha * (0.4 + smoothed.volume * 0.6);
              ctx.beginPath();
              ctx.arc(px, py, size, 0, Math.PI * 2);
              ctx.fill();
            });
          }

          // 6. SYMMETRIC STEREO EQUALIZER
          else if (effect === "stereo") {
            const bars = 48;
            const cx = width / 2;
            const barW = (cx / bars) * 0.82;
            const gap = (cx / bars) * 0.18;

            for (let i = 0; i < bars; i++) {
              let val = 0;
              if (active && freq) {
                const bin = Math.min(freq.length - 1, Math.floor((i / bars) * (freq.length / 2)));
                val = (freq[bin] / 255) * sensitivity * 1.8;
              } else {
                val = 0.1 + Math.sin(i * 0.2 + performance.now() * 0.001) * 0.15;
              }

              const barH = Math.max(3, height * Math.min(1, val) * 0.85);
              const leftX = cx - (i + 1) * (barW + gap);
              const rightX = cx + i * (barW + gap);
              const y = (height - barH) / 2;

              ctx.fillStyle = gradient;
              ctx.globalAlpha = 0.8;
              ctx.fillRect(leftX, y, barW, barH);
              ctx.fillRect(rightX, y, barW, barH);
            }
          }

          // 7. CYBERPUNK MATRIX STREAM
          else if (effect === "matrix") {
            const drops = matrixDropsRef.current;
            const rainBoost = 1 + smoothed.volume * 3;

            ctx.font = `${Math.floor(13 * dpr)}px monospace`;
            drops.forEach((d) => {
              d.y += d.speed * rainBoost;
              if (d.y > 1.2) d.y = -0.2;

              const dx = d.x * width;
              d.chars.forEach((char, ci) => {
                const cy = (d.y - ci * 0.03) * height;
                if (cy > 0 && cy < height) {
                  ctx.fillStyle = ci === 0 ? "#ffffff" : themeCol1;
                  ctx.globalAlpha = Math.max(0.1, 1 - ci * 0.08);
                  ctx.fillText(char, dx, cy);
                }
              });
            });
          }

          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [colors, effect, glowIntensity, isPlaying, sensitivity, theme]);

  // Clean up on unmount
  useEffect(() => () => {
    stopSynth();
    stopMicrophone();
    if (contextRef.current) void contextRef.current.close();
  }, [stopMicrophone, stopSynth]);

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs)) return "0:00";
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${mins}:${remainder}`;
  };

  const seekAudio = (e: ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current && duration > 0) {
      const targetTime = (Number(e.target.value) / 100) * duration;
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  const meterValue = (val: number) => Math.round(Math.max(0, Math.min(1, val)) * 100);

  // Dynamic Ambient Backlight and CSS Variables
  const glowStyle = useMemo(() => {
    const c1 = colors[0];
    const c2 = colors[1] || colors[0];
    const ambilightOpacity = showAmbilight ? Math.min(0.42, 0.12 + metrics.bass * 0.3) : 0;
    return {
      background: `radial-gradient(ellipse at 50% 85%, ${c1}33 0%, transparent 60%), radial-gradient(ellipse at 85% 15%, ${c2}26 0%, transparent 50%), #080a10`,
      "--accent": c1,
      "--accent-two": c2,
      "--ambilight-color": c1,
      "--ambilight-opacity": ambilightOpacity,
      "--rig-bass-brightness": Math.min(1, 0.2 + metrics.bass * 0.9),
      "--rig-mid-brightness": Math.min(1, 0.2 + metrics.mid * 0.9),
      "--rig-treble-brightness": Math.min(1, 0.2 + metrics.treble * 0.9),
      "--rig-energy-brightness": Math.min(1, 0.2 + metrics.volume * 0.9),
    } as CSSProperties;
  }, [colors, metrics, showAmbilight]);

  return (
    <main
      className={`app-shell ${isFullscreen ? "fullscreen-active" : ""}`}
      style={glowStyle}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Immersive Screen Ambilight Edge Aura */}
      {showAmbilight && <div className="screen-ambilight" />}
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-box">
            <Upload size={48} className="drag-icon" />
            <h2>Drop your audio file here</h2>
            <p>Supports MP3, WAV, FLAC, OGG, AAC & M4A</p>
          </div>
        </div>
      )}

      <div className="app-content">
        {/* Top Header / Navigation */}
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">
              <AudioLines size={24} />
            </div>
            <div>
              <div className="brand-name">
                SonicGlow <span>RGB Studio</span>
              </div>
              <div className="brand-subtitle">PRO AUDIO REACTIVE LIGHTING SUITE</div>
            </div>
          </div>

          <div className="header-badges">
            <div className="audio-source-badge">
              {activeSource === "file" && <><Disc3 size={14} /> FILE MODE</>}
              {activeSource === "synth" && <><Zap size={14} /> SYNTH GENERATOR</>}
              {activeSource === "mic" && <><Mic size={14} /> LIVE MIC ACTIVE</>}
            </div>

            <div className="header-stat">
              <span className="stat-label">BPM:</span>
              <span className="stat-num">{isPlaying ? bpmEstimate : "--"}</span>
            </div>

            <div className="header-stat">
              <span className={`status-dot ${isPlaying ? "live-pulse" : ""}`} />
              <span className="status-text">{isPlaying ? "ACTIVE" : "STANDBY"}</span>
            </div>

            <button
              className="icon-button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Visualizer"}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </header>

        {/* Hero Banner Section */}
        <section className="hero">
          <div>
            <div className="eyebrow">
              <Sparkles size={14} /> REAL-TIME FREQUENCY VISUALIZATION & AMBILIGHT SIMULATION
            </div>
            <h1>
              Sync sound with <span>pure light.</span>
            </h1>
            <p className="hero-copy">
              Professional audio reactive spectrum analyzer, real-time 3-band equalizer,
              10 bespoke RGB palettes, dynamic effects, and virtual LED hardware emulation.
            </p>
          </div>

          <div className="source-picker-card">
            <div className="source-picker-title">QUICK AUDIO INPUT</div>
            <div className="source-button-group">
              <button
                className={`source-btn ${activeSource === "synth" ? "active" : ""}`}
                onClick={() => selectSynthPreset("synthwave")}
              >
                <Zap size={15} /> Demo Beats
              </button>
              <button
                className={`source-btn ${activeSource === "file" ? "active" : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} /> Upload Audio
              </button>
              <button
                className={`source-btn ${activeSource === "mic" ? "active" : ""}`}
                onClick={() => {
                  if (activeSource === "mic" && isPlaying) stopMicrophone();
                  else void startMicrophone();
                }}
              >
                {activeSource === "mic" && isPlaying ? <MicOff size={15} /> : <Mic size={15} />}
                {activeSource === "mic" && isPlaying ? "Mute Mic" : "Live Mic"}
              </button>
            </div>
          </div>
        </section>

        {/* Global Notifications */}
        {error && (
          <div className="banner-alert banner-error">
            <span>{error}</span>
            <button onClick={() => setError("")}>✕</button>
          </div>
        )}
        {infoMessage && (
          <div className="banner-alert banner-info">
            <span>{infoMessage}</span>
            <button onClick={() => setInfoMessage("")}>✕</button>
          </div>
        )}

        {/* Main Workspace Layout */}
        <section className="workspace">
          {/* Main Visualizer & Player Column */}
          <div className="main-column">
            {/* Visualizer Viewport Panel */}
            <section className={`panel visualizer-panel ${isFullscreen ? "visualizer-fullscreen" : ""}`}>
              <div className="panel-heading">
                <div>
                  <div className="panel-title">
                    <Activity size={18} /> Audio Spectrum Viewport
                  </div>
                  <div className="panel-caption">
                    Rendering mode: <strong>{effect.toUpperCase()}</strong> • Theme: <strong>{selectedTheme.label}</strong>
                  </div>
                </div>

                <div className="panel-actions-row">
                  {/* Visualizer Effect Tabs */}
                  <div className="effect-pill-nav">
                    {(["spectrum", "radial", "wave", "pulse", "particles", "stereo", "matrix"] as Effect[]).map((mode) => (
                      <button
                        key={mode}
                        className={`pill-btn ${effect === mode ? "active" : ""}`}
                        onClick={() => setEffect(mode)}
                      >
                        {mode === "spectrum" && "Bars"}
                        {mode === "radial" && "Radial"}
                        {mode === "wave" && "Wave"}
                        {mode === "pulse" && "Pulse"}
                        {mode === "particles" && "Cosmic"}
                        {mode === "stereo" && "Stereo"}
                        {mode === "matrix" && "Matrix"}
                      </button>
                    ))}
                  </div>

                  <button
                    className="icon-button"
                    onClick={toggleFullscreen}
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  </button>
                </div>
              </div>

              {/* Canvas Visualizer Canvas */}
              <div className="canvas-wrap">
                <canvas ref={canvasRef} aria-label="Live audio spectrum visualizer" />
                <div className="canvas-labels">
                  <span>SUB-BASS (20-60Hz)</span>
                  <span>MIDRANGE (250-2kHz)</span>
                  <span>HIGH AIR (6-16kHz)</span>
                </div>
              </div>

              {/* Real-time Frequency Energy Meters */}
              <div className="metrics-grid">
                <Metric label="BASS IMPACT" value={meterValue(metrics.bass)} color={colors[0]} icon={<Flame size={13} />} />
                <Metric label="MID CLARITY" value={meterValue(metrics.mid)} color={colors[1] || colors[0]} icon={<Waves size={13} />} />
                <Metric label="TREBLE SHINE" value={meterValue(metrics.treble)} color={colors[2] || colors[0]} icon={<Sparkles size={13} />} />
                <Metric label="RMS ENERGY" value={meterValue(metrics.volume)} color="#10b981" icon={<Zap size={13} />} />
              </div>
            </section>

            {/* Simulated Virtual RGB Light Hardware Rig */}
            {showRigSim && (
              <section className="panel rgb-rig-panel">
                <div className="panel-heading">
                  <div>
                    <div className="panel-title">
                      <Layers size={18} /> Simulated RGB Hardware Rig
                    </div>
                    <div className="panel-caption">
                      Virtual LED peripheral zones synced to live frequency bands
                    </div>
                  </div>
                  <div className="rig-mode-tag">
                    <span className="dot" /> 4-ZONE CHROMA EMULATOR
                  </div>
                </div>

                <div className="rgb-rig-stage">
                  {/* Left Speaker Tower */}
                  <div className="rig-device speaker-left" title="Left Speaker: Low Frequencies">
                    <div className="device-label">LEFT TOWER (BASS)</div>
                    <div className="led-pillar" style={{ "--led-color": colors[0], opacity: "var(--rig-bass-brightness)" } as CSSProperties}>
                      <span /><span /><span /><span /><span />
                    </div>
                  </div>

                  {/* Center Monitor Lightbar */}
                  <div className="rig-device center-monitor">
                    <div className="device-label">MONITOR TOP AMBILIGHT</div>
                    <div className="monitor-frame">
                      <div className="monitor-top-bar" style={{ "--led-color": colors[1] || colors[0], opacity: "var(--rig-treble-brightness)" } as CSSProperties} />
                      <div className="monitor-screen-preview">
                        <Activity size={24} className={isPlaying ? "screen-icon pulse" : "screen-icon"} />
                        <span>LIVE AUDIO FEED</span>
                      </div>
                    </div>
                    <div className="desk-underglow" style={{ "--led-color": colors[2] || colors[0], opacity: "var(--rig-energy-brightness)" } as CSSProperties}>
                      <span className="underglow-beam" />
                    </div>
                  </div>

                  {/* Right Speaker Tower */}
                  <div className="rig-device speaker-right" title="Right Speaker: Mid Frequencies">
                    <div className="device-label">RIGHT TOWER (MIDS)</div>
                    <div className="led-pillar" style={{ "--led-color": colors[1] || colors[0], opacity: "var(--rig-mid-brightness)" } as CSSProperties}>
                      <span /><span /><span /><span /><span />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Audio Source & Player Control Station */}
            <section className="panel player-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-title">
                    <Disc3 size={18} /> Audio Playback Deck
                  </div>
                  <div className="panel-caption">
                    {activeSource === "file" && "Local track playback & scrubbing"}
                    {activeSource === "synth" && "In-browser synthesizer demo generator"}
                    {activeSource === "mic" && "Real-time microphone / line-in audio input"}
                  </div>
                </div>

                {activeSource === "synth" && (
                  <div className="synth-preset-group">
                    <button
                      className={`preset-btn ${synthPreset === "synthwave" ? "active" : ""}`}
                      onClick={() => selectSynthPreset("synthwave")}
                    >
                      Synthwave
                    </button>
                    <button
                      className={`preset-btn ${synthPreset === "cyber" ? "active" : ""}`}
                      onClick={() => selectSynthPreset("cyber")}
                    >
                      Cyber Bass
                    </button>
                    <button
                      className={`preset-btn ${synthPreset === "chill" ? "active" : ""}`}
                      onClick={() => selectSynthPreset("chill")}
                    >
                      Aurora Chill
                    </button>
                  </div>
                )}

                {activeSource === "file" && (
                  <button
                    className="secondary-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={15} /> Switch File
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                className="hidden-input"
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
                onChange={handleFileChange}
              />
              <audio
                ref={audioRef}
                src={objectUrl || undefined}
                loop={isLooping}
                crossOrigin="anonymous"
              />

              {/* Track Info & Transport Row */}
              <div className="track-row">
                <div className={`track-art ${isPlaying ? "spinning" : ""}`}>
                  <Music2 size={26} />
                </div>
                <div className="track-info">
                  <strong title={fileName}>{fileName}</strong>
                  <span>
                    {activeSource === "file" && (objectUrl ? "Local audio file loaded" : "Ready for audio")}
                    {activeSource === "synth" && "Algorithmic Web Audio Synth Beat (120 BPM)"}
                    {activeSource === "mic" && "Listening to live microphone audio"}
                  </span>
                </div>

                <div className="player-actions">
                  <button
                    className="play-button"
                    onClick={() => void togglePlay()}
                    title={isPlaying ? "Pause playback" : "Start playback"}
                  >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                  <button
                    className="icon-button"
                    onClick={stopAudio}
                    title="Stop & Rewind"
                  >
                    <RotateCcw size={17} />
                  </button>
                </div>
              </div>

              {/* File Timeline Slider (When file mode active) */}
              {activeSource === "file" && (
                <div className="timeline">
                  <span>{formatTime(currentTime)}</span>
                  <input
                    aria-label="Seek audio timeline"
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={seekAudio}
                    style={{ "--range-progress": `${progress}%` } as CSSProperties}
                  />
                  <span>{formatTime(duration)}</span>
                </div>
              )}

              {/* Extra Transport Bar (Loop, Speed, Master Volume) */}
              <div className="player-transport-sub">
                <div className="transport-left">
                  {activeSource === "file" && (
                    <>
                      <button
                        className={`chip-button ${isLooping ? "active" : ""}`}
                        onClick={() => setIsLooping(!isLooping)}
                        title="Toggle Loop"
                      >
                        <RefreshCw size={13} /> Loop
                      </button>

                      <div className="speed-selector">
                        {[0.75, 1, 1.25, 1.5].map((rate) => (
                          <button
                            key={rate}
                            className={`rate-btn ${playbackRate === rate ? "active" : ""}`}
                            onClick={() => changePlaybackRate(rate)}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Volume Slider Control */}
                <div className="volume-control">
                  <button
                    className="icon-button-sm"
                    onClick={() => setIsMuted(!isMuted)}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(Number(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    style={{ "--range-progress": `${isMuted ? 0 : volume}%` } as CSSProperties}
                    aria-label="Master volume"
                    className="volume-slider"
                  />
                  <span className="vol-percent">{isMuted ? "0%" : `${volume}%`}</span>
                </div>
              </div>
            </section>
          </div>

          {/* Right Customization & Studio Sidebar */}
          <aside className="side-column">
            {/* Color Palette Studio */}
            <section className="panel settings-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-title">
                    <Sparkles size={18} /> RGB Color Themes
                  </div>
                  <div className="panel-caption">10 Custom Chromatic Palettes</div>
                </div>
              </div>

              <div className="theme-grid">
                {(Object.keys(THEMES) as Theme[]).map((key) => {
                  const item = THEMES[key];
                  return (
                    <button
                      key={key}
                      className={`theme-option ${theme === key ? "selected" : ""}`}
                      onClick={() => setTheme(key)}
                    >
                      <span className="theme-swatches">
                        {item.colors.slice(0, 3).map((c, i) => (
                          <i key={i} style={{ background: c }} />
                        ))}
                      </span>
                      <div className="theme-meta">
                        <span className="theme-name">{item.label}</span>
                        <span className="theme-desc">{item.description}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Studio Tuning & Real-time Equalizer */}
            <section className="panel equalizer-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-title">
                    <Sliders size={18} /> 3-Band Equalizer (EQ)
                  </div>
                  <div className="panel-caption">Real-time hardware filter shaping</div>
                </div>
                <button
                  className="icon-button-sm"
                  onClick={() => { setBassGain(0); setMidGain(0); setTrebleGain(0); }}
                  title="Flat EQ"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              <div className="eq-sliders-row">
                <EqSlider
                  label="BASS"
                  value={bassGain}
                  min={-10}
                  max={12}
                  unit="dB"
                  color={colors[0]}
                  onChange={setBassGain}
                />
                <EqSlider
                  label="MID"
                  value={midGain}
                  min={-10}
                  max={12}
                  unit="dB"
                  color={colors[1] || colors[0]}
                  onChange={setMidGain}
                />
                <EqSlider
                  label="TREBLE"
                  value={trebleGain}
                  min={-10}
                  max={12}
                  unit="dB"
                  color={colors[2] || colors[0]}
                  onChange={setTrebleGain}
                />
              </div>
            </section>

            {/* Dynamics & Visualizer Fine-Tuning */}
            <section className="panel fine-tuning-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-title">
                    <Settings2 size={18} /> Visualizer Dynamics
                  </div>
                  <div className="panel-caption">Responsiveness & bloom physics</div>
                </div>
              </div>

              <RangeControl
                label="Sensor Sensitivity"
                value={sensitivity}
                min={0.5}
                max={2.5}
                step={0.05}
                display={`${sensitivity.toFixed(2)}x`}
                onChange={setSensitivity}
              />

              <RangeControl
                label="FFT Smoothing Factor"
                value={smoothing}
                min={0.2}
                max={0.95}
                step={0.05}
                display={`${Math.round(smoothing * 100)}%`}
                onChange={setSmoothing}
              />

              <RangeControl
                label="Neon Bloom & Glow"
                value={glowIntensity}
                min={0}
                max={100}
                step={5}
                display={`${glowIntensity}%`}
                onChange={setGlowIntensity}
              />

              <RangeControl
                label="Master LED Brightness"
                value={brightness}
                min={10}
                max={100}
                step={5}
                display={`${brightness}%`}
                onChange={setBrightness}
              />

              {/* Toggles */}
              <div className="toggles-list">
                <label className="toggle-item">
                  <span>Simulate Room Ambilight</span>
                  <input
                    type="checkbox"
                    checked={showAmbilight}
                    onChange={(e) => setShowAmbilight(e.target.checked)}
                  />
                </label>

                <label className="toggle-item">
                  <span>Display 4-Zone Hardware Rig</span>
                  <input
                    type="checkbox"
                    checked={showRigSim}
                    onChange={(e) => setShowRigSim(e.target.checked)}
                  />
                </label>
              </div>

              <button
                className="reset-button"
                onClick={() => {
                  setTheme("spectrum");
                  setEffect("spectrum");
                  setSensitivity(1.3);
                  setSmoothing(0.8);
                  setGlowIntensity(70);
                  setBrightness(85);
                  setBassGain(3);
                  setMidGain(1);
                  setTrebleGain(2);
                }}
              >
                <RotateCcw size={14} /> Restore Studio Defaults
              </button>
            </section>

            {/* Device Integration Info */}
            <section className="panel connection-panel">
              <div className="panel-title">
                <Radio size={17} /> Hardware Bridge Status
              </div>
              <div className="connection-row">
                <div className="connection-icon"><Mic size={17} /></div>
                <div className="connection-copy">
                  <strong>Microphone / Room Capture</strong>
                  <span>Active via Web Audio API</span>
                </div>
                <span className="connection-status live">READY</span>
              </div>
              <div className="connection-row">
                <div className="connection-icon"><Headphones size={17} /></div>
                <div className="connection-copy">
                  <strong>System Audio Loopback</strong>
                  <span>Desktop WASAPI driver build</span>
                </div>
                <span className="connection-status">NEXT</span>
              </div>
              <div className="connection-row">
                <div className="connection-icon"><Sparkles size={17} /></div>
                <div className="connection-copy">
                  <strong>iCUE & Chroma Bridge</strong>
                  <span>WebHID & OpenRGB protocol</span>
                </div>
                <span className="connection-status muted">PLANNED</span>
              </div>
            </section>
          </aside>
        </section>

        {/* Footer */}
        <footer className="footer">
          <span>
            SONICGLOW RGB STUDIO <span className="footer-dot">•</span> V0.2 PRO EDITION
          </span>
          <span>
            ALL AUDIO PROCESSED LOCALLY IN BROWSER <span className="footer-dot">•</span> ZERO LATENCY FFT
          </span>
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span className="metric-label-group">
          {icon} {label}
        </span>
        <strong>{value}%</strong>
      </div>
      <div className="meter-track">
        <div
          className="meter-fill"
          style={{
            width: `${value}%`,
            background: color,
            boxShadow: `0 0 12px ${color}88`,
          }}
        />
      </div>
    </div>
  );
}

function EqSlider({
  label,
  value,
  min,
  max,
  unit,
  color,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  color: string;
  onChange: (val: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="eq-slider-col">
      <div className="eq-db">{value > 0 ? `+${value}` : value}{unit}</div>
      <div className="eq-track-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="eq-vertical-input"
          style={{ "--range-progress": `${percent}%`, "--eq-color": color } as CSSProperties}
          aria-label={label}
        />
      </div>
      <div className="eq-name">{label}</div>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="setting-block range-block">
      <div className="label-line">
        <label htmlFor={id}>{label}</label>
        <span className="small-value">{display}</span>
      </div>
      <input
        id={id}
        className="range-control"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--range-progress": `${percent}%` } as CSSProperties}
      />
    </div>
  );
}

export default App;
