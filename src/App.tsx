import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Hourglass,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ClockVisuals, ThemeMode } from './components/ClockVisuals';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { TimeDilatorView } from './components/TimeDilatorView';
import { WidgetStudioModal } from './components/WidgetStudioModal';
import { clockAudioSynth } from './engine/audioSynth';
import {
  ACCENT_PRESETS,
  AnchorMode,
  buildClockShareUrl,
  CLOCK_PRESETS,
  ClockConcept,
  ClockConfig,
  ClockPreset,
  computeAlternateTime,
  DilationHorizon,
  formatAlternateClockDate,
  formatAlternateDigital,
  formatEarthTimeFromSeconds,
  normalizeHexColor,
  parseClockConfigFromSearch,
  SweepMode,
} from './engine/clockEngine';

const CONCEPT_ITEMS: { id: ClockConcept; label: string }[] = [
  { id: 'phase-dial', label: 'Analog' },
  { id: 'lissajous', label: 'Harmonic' },
  { id: 'spectrum', label: 'Wave' },
  { id: 'spiral', label: 'Spiral' },
];

function getNowSecondsSinceMidnight(): number {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem('chronosynth-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage access errors
  }
  return 'dark';
}

const DEFAULT_CONFIG: ClockConfig = {
  hoursPerDay: 10,
  minutesPerHour: 100,
  secondsPerMinute: 100,
  anchorMode: 'solar',
  customTickHz: 100_000 / 86_400,
  concept: 'phase-dial',
  sweepMode: 'smooth',
  timeScale: 1,
  harmonicAnimSpeed: 1,
  soundEnabled: false,
  harmonicScale: 'pentatonic',
  accentColor: '#06B6D4',
};

function getInitialConfig(): ClockConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  const fromUrl = parseClockConfigFromSearch(window.location.search);
  try {
    const raw = window.localStorage.getItem('chronosynth-config');
    const parsed = raw ? (JSON.parse(raw) as Partial<ClockConfig>) : {};
    const isOldElon =
      parsed.anchorMode === 'frequency' &&
      parsed.customTickHz === 7 &&
      parsed.hoursPerDay === 24 &&
      parsed.minutesPerHour === 60 &&
      parsed.secondsPerMinute === 60;
    const base = isOldElon ? DEFAULT_CONFIG : { ...DEFAULT_CONFIG, ...parsed };
    const merged = fromUrl ? { ...base, ...fromUrl } : base;
    return {
      ...merged,
      soundEnabled: false,
      accentColor: normalizeHexColor(merged.accentColor, DEFAULT_CONFIG.accentColor),
    };
  } catch {
    return fromUrl ? { ...DEFAULT_CONFIG, ...fromUrl, soundEnabled: false } : DEFAULT_CONFIG;
  }
}

function findMatchingPresetId(cfg: ClockConfig): string | null {
  const match = CLOCK_PRESETS.find(
    (p) =>
      p.hoursPerDay === cfg.hoursPerDay &&
      p.minutesPerHour === cfg.minutesPerHour &&
      p.secondsPerMinute === cfg.secondsPerMinute &&
      p.anchorMode === cfg.anchorMode &&
      (p.anchorMode === 'solar' || Math.abs(p.customTickHz - cfg.customTickHz) < 0.001)
  );
  return match ? match.id : null;
}

interface MiniStepperProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

const MiniStepper: React.FC<MiniStepperProps> = ({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/15 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="min-w-[60px] text-center font-mono tabular-nums text-xs font-semibold text-cyan-800 dark:text-cyan-300">
          {Number.isInteger(step) ? value : value.toFixed(2)} {unit}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/15 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      className="w-full chrono-slider"
    />
  </div>
);

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [config, setConfig] = useState<ClockConfig>(getInitialConfig);
  const [activePresetId, setActivePresetId] = useState<string | null>(() =>
    findMatchingPresetId(getInitialConfig())
  );
  const [paused, setPaused] = useState(false);
  const [earthSeconds, setEarthSeconds] = useState<number>(() => getNowSecondsSinceMidnight());
  const [harmonicPhaseSec, setHarmonicPhaseSec] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [widgetStudioOpen, setWidgetStudioOpen] = useState(false);
  const [sharedCopied, setSharedCopied] = useState(false);
  const [dilatorMode, setDilatorMode] = useState(false);
  const [dilationHorizon, setDilationHorizon] = useState<DilationHorizon>('live');
  const [dilatorElapsedSec, setDilatorElapsedSec] = useState(0);
  const [dilatorPaused, setDilatorPaused] = useState(false);

  const lastFrameRef = useRef<number | null>(null);
  const prevTickRef = useRef<{ h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#07090E' : '#F8FAFC');
    }
    try {
      window.localStorage.setItem('chronosynth-theme', theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem('chronosynth-config', JSON.stringify(config));
    } catch {
      // Ignore storage access errors
    }
  }, [config]);

  useEffect(() => {
    if (paused) {
      lastFrameRef.current = null;
      return;
    }

    let rafId = 0;
    const step = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }
      const dtSec = Math.min(0.1, (timestamp - lastFrameRef.current) / 1000);
      lastFrameRef.current = timestamp;

      if (config.timeScale === 1) {
        setEarthSeconds(getNowSecondsSinceMidnight());
      } else {
        setEarthSeconds((prev) => prev + dtSec * config.timeScale);
      }
      if (config.harmonicAnimSpeed > 0) {
        setHarmonicPhaseSec((prev) => prev + dtSec * config.harmonicAnimSpeed);
      }
      if (dilatorMode && !dilatorPaused) {
        setDilatorElapsedSec((prev) => prev + dtSec * config.timeScale);
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [paused, config.timeScale, config.harmonicAnimSpeed, dilatorMode, dilatorPaused]);

  const snapshot = useMemo(
    () => computeAlternateTime(config, earthSeconds),
    [config, earthSeconds]
  );

  useEffect(() => {
    const prev = prevTickRef.current;
    const curr = { h: snapshot.hour, m: snapshot.minute, s: snapshot.second };
    prevTickRef.current = curr;

    if (!config.soundEnabled || paused || !prev) return;
    if (config.timeScale > 10) return;

    if (curr.h !== prev.h) {
      clockAudioSynth.triggerTick('hour', snapshot.audibleOctaveHz, config.harmonicScale);
    } else if (curr.m !== prev.m) {
      clockAudioSynth.triggerTick('minute', snapshot.audibleOctaveHz, config.harmonicScale);
    } else if (curr.s !== prev.s) {
      clockAudioSynth.triggerTick('second', snapshot.audibleOctaveHz, config.harmonicScale);
    }
  }, [
    snapshot.hour,
    snapshot.minute,
    snapshot.second,
    snapshot.audibleOctaveHz,
    config.soundEnabled,
    config.harmonicScale,
    config.timeScale,
    paused,
  ]);

  const handleApplyPreset = (preset: ClockPreset) => {
    setActivePresetId(preset.id);
    setConfig((prev) => ({
      ...prev,
      hoursPerDay: preset.hoursPerDay,
      minutesPerHour: preset.minutesPerHour,
      secondsPerMinute: preset.secondsPerMinute,
      anchorMode: preset.anchorMode,
      customTickHz: preset.customTickHz,
      concept: preset.recommendedConcept,
    }));
  };

  const handleUpdateConfig = (partial: Partial<ClockConfig>) => {
    if (
      partial.hoursPerDay !== undefined ||
      partial.minutesPerHour !== undefined ||
      partial.secondsPerMinute !== undefined ||
      partial.anchorMode !== undefined ||
      partial.customTickHz !== undefined
    ) {
      setActivePresetId(null);
    }
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleResetToStandard = () => {
    const standard = CLOCK_PRESETS.find((p) => p.id === 'earth-standard');
    if (standard) {
      handleApplyPreset(standard);
      setConfig((prev) => ({ ...prev, timeScale: 1, harmonicAnimSpeed: 1 }));
    }
  };

  const toggleSound = () => {
    if (!config.soundEnabled) {
      clockAudioSynth.unlock();
    }
    setConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const syncToNow = () => {
    setEarthSeconds(getNowSecondsSinceMidnight());
    setConfig((prev) => ({ ...prev, timeScale: 1 }));
    setPaused(false);
  };

  const handleShareClock = async () => {
    const shareUrl = buildClockShareUrl(config, window.location.href);
    const shareText = `Check out my ${config.hoursPerDay}h · ${config.minutesPerHour}m · ${config.secondsPerMinute}s (${snapshot.tickHz.toFixed(2)} Hz) OddClock!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'OddClock', text: shareText, url: shareUrl });
        return;
      }
    } catch {
      // Fall back to clipboard if share dialog was cancelled/unsupported
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSharedCopied(true);
      setTimeout(() => setSharedCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-cyan-50/70 to-amber-50/60 dark:from-[#05070C] dark:via-[#081320] dark:to-[#110D16] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200">
      {/* Ambient radial backdrop orbs for frosted glass refraction */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-28 -left-28 w-[28rem] h-[28rem] rounded-full bg-cyan-400/25 dark:bg-cyan-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-28 -right-28 w-[28rem] h-[28rem] rounded-full bg-amber-400/25 dark:bg-amber-500/15 blur-3xl"
      />

      {/* Single Self-Contained Glassmorphism Widget */}
      <section
        aria-label="OddClock Alternate Clock Widget"
        className="relative w-full max-w-[440px] bg-white/60 dark:bg-[#0B0F17]/55 backdrop-blur-2xl border border-white/75 dark:border-white/15 ring-1 ring-inset ring-white/50 dark:ring-white/10 rounded-[32px] p-5 sm:p-6 space-y-4 shadow-[0_28px_70px_-15px_rgba(15,23,42,0.18)] dark:shadow-[0_32px_80px_-15px_rgba(0,0,0,0.8)]"
      >
        {/* Widget Top Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-display text-xs font-semibold text-slate-900 dark:text-white shrink-0">
              OddClock
            </span>
            <span aria-hidden="true" className="text-slate-400 text-xs">·</span>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 truncate">
              {config.hoursPerDay}·{config.minutesPerHour}·{config.secondsPerMinute} · {snapshot.tickHz.toFixed(2)}Hz
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleShareClock}
              aria-label="Share this clock configuration link"
              title={sharedCopied ? 'Share Link Copied' : 'Share Clock Link'}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                sharedCopied
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-700 dark:text-cyan-300'
                  : 'bg-white/50 dark:bg-white/5 border-white/60 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10'
              }`}
            >
              {sharedCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={toggleSound}
              aria-label={config.soundEnabled ? 'Mute tick chime' : 'Enable tick chime'}
              title={config.soundEnabled ? 'Chime On' : 'Chime Off'}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                config.soundEnabled
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-700 dark:text-cyan-300'
                  : 'bg-white/50 dark:bg-white/5 border-white/60 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10'
              }`}
            >
              {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to Lunar light theme' : 'Switch to Deep Space dark theme'}
              title={theme === 'dark' ? 'Deep Space Theme' : 'Lunar Theme'}
              className="p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setWidgetStudioOpen(true)}
              aria-label="Apple and Android widget export"
              title="Apple & Android Widgets"
              className="p-1.5 rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              aria-label={showSettings ? 'Show clock face' : 'Configure widget'}
              title={showSettings ? 'Done' : 'Configure Clock'}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                showSettings
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'bg-white/50 dark:bg-white/5 border-white/60 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/10'
              }`}
            >
              {showSettings ? <Check className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
              <span>{showSettings ? 'Done' : 'Tune'}</span>
            </button>
          </div>
        </div>

        {showSettings ? (
          /* In-Widget Glass Configuration Panel */
          <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
            {/* Suggested Concepts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Suggested Clocks
                </span>
                <button
                  type="button"
                  onClick={handleResetToStandard}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CLOCK_PRESETS.map((preset) => {
                  const active = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`text-left px-2.5 py-2 rounded-xl border transition-colors cursor-pointer ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-slate-900 dark:text-white'
                          : 'bg-white/40 dark:bg-white/[0.04] border-white/60 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="text-[11px] font-semibold truncate">{preset.name}</div>
                      <div className="text-[10px] font-mono tabular-nums text-cyan-800 dark:text-cyan-300">
                        {preset.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Color Theme Picker */}
            <div className="space-y-2 pt-2 border-t border-slate-900/10 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Accent Color
                </span>
                <span className="font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300">
                  {normalizeHexColor(config.accentColor)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ACCENT_PRESETS.map((preset) => {
                    const active =
                      normalizeHexColor(config.accentColor) === preset.hex.toUpperCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleUpdateConfig({ accentColor: preset.hex })}
                        aria-label={`Use ${preset.name} accent color`}
                        title={preset.name}
                        className={`relative w-7 h-7 rounded-full flex items-center justify-center border transition-transform cursor-pointer ${
                          active
                            ? 'scale-110 border-slate-900 dark:border-white ring-2 ring-slate-900/15 dark:ring-white/25'
                            : 'border-white/70 dark:border-white/20 hover:scale-105'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="w-5.5 h-5.5">
                          <circle cx="12" cy="12" r="11" fill={preset.hex} />
                        </svg>
                        {active && (
                          <Check className="absolute w-3 h-3 text-white drop-shadow" strokeWidth={3} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/15 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer">
                  <input
                    type="color"
                    aria-label="Pick custom accent color"
                    value={normalizeHexColor(config.accentColor)}
                    onChange={(e) =>
                      handleUpdateConfig({ accentColor: normalizeHexColor(e.target.value) })
                    }
                    className="w-4 h-4 p-0 border-0 bg-transparent rounded cursor-pointer"
                  />
                  <span>Custom</span>
                </label>
              </div>
            </div>

            {/* Day Geometry Sliders */}
            <div className="space-y-2.5 pt-2 border-t border-slate-900/10 dark:border-white/10">
              <MiniStepper
                label="Hours / Day"
                unit="h"
                value={config.hoursPerDay}
                min={2}
                max={60}
                onChange={(val) => handleUpdateConfig({ hoursPerDay: val })}
              />
              <MiniStepper
                label="Minutes / Hour"
                unit="m"
                value={config.minutesPerHour}
                min={4}
                max={120}
                onChange={(val) => handleUpdateConfig({ minutesPerHour: val })}
              />
              <MiniStepper
                label="Seconds / Minute"
                unit="s"
                value={config.secondsPerMinute}
                min={4}
                max={120}
                onChange={(val) => handleUpdateConfig({ secondsPerMinute: val })}
              />
              <MiniStepper
                label="Harmonic Wave Speed"
                unit="x"
                value={config.harmonicAnimSpeed}
                min={0}
                max={4}
                step={0.25}
                onChange={(val) => handleUpdateConfig({ harmonicAnimSpeed: Number(val.toFixed(2)) })}
              />
            </div>

            {/* Anchor Mode & Movement */}
            <div className="space-y-2.5 pt-2 border-t border-slate-900/10 dark:border-white/10">
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-white/40 dark:bg-white/[0.04] border border-white/60 dark:border-white/10">
                {(['solar', 'frequency'] as AnchorMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleUpdateConfig({ anchorMode: mode })}
                    className={`py-1.5 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                      config.anchorMode === mode
                        ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {mode === 'solar' ? 'Solar 24h Day' : 'Custom Hz'}
                  </button>
                ))}
              </div>

              {config.anchorMode === 'frequency' && (
                <MiniStepper
                  label="Oscillator Rate"
                  unit="Hz"
                  value={config.customTickHz}
                  min={0.2}
                  max={8.0}
                  step={0.05}
                  onChange={(val) => handleUpdateConfig({ customTickHz: Number(val.toFixed(2)) })}
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-xl bg-white/40 dark:bg-white/[0.04] border border-white/60 dark:border-white/10">
                  {(['smooth', 'quartz'] as SweepMode[]).map((sweep) => (
                    <button
                      key={sweep}
                      type="button"
                      onClick={() => handleUpdateConfig({ sweepMode: sweep })}
                      className={`py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                        config.sweepMode === sweep
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {sweep === 'smooth' ? 'Sweep' : 'Quartz'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-0.5 p-0.5 rounded-xl bg-white/40 dark:bg-white/[0.04] border border-white/60 dark:border-white/10">
                  {[1, 10, 60, 600].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => handleUpdateConfig({ timeScale: scale })}
                      className={`py-1 text-[10px] font-mono tabular-nums rounded-lg transition-colors cursor-pointer ${
                        config.timeScale === scale
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {scale}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/15 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {paused ? <Play className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> : <Pause className="w-3.5 h-3.5" />}
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={syncToNow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/15 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Now
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Live Glass Clock Face or Time Dilator Mode */
          <>
            {/* Top Mode Switcher: Clock Face vs Time Dilator */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-white/60 dark:border-white/10">
              <button
                type="button"
                onClick={() => setDilatorMode(false)}
                className={`py-1.5 text-[11px] font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !dilatorMode
                    ? 'bg-white/85 dark:bg-white/15 text-cyan-800 dark:text-cyan-200 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Clock Face
              </button>
              <button
                type="button"
                onClick={() => setDilatorMode(true)}
                className={`inline-flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  dilatorMode
                    ? 'bg-white/85 dark:bg-white/15 text-cyan-800 dark:text-cyan-200 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Hourglass className="w-3 h-3" />
                <span>Time Dilator</span>
              </button>
            </div>

            {dilatorMode ? (
              <TimeDilatorView
                config={config}
                theme={theme}
                horizon={dilationHorizon}
                onHorizonChange={setDilationHorizon}
                liveElapsedSeconds={dilatorElapsedSec}
                livePaused={dilatorPaused}
                onToggleLivePause={() => setDilatorPaused((p) => !p)}
                onResetLive={() => setDilatorElapsedSec(0)}
                earthSecondsToday={earthSeconds}
              />
            ) : (
              <>
                {/* Compact Glass Concept Switcher */}
                <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-white/60 dark:border-white/10">
                  {CONCEPT_ITEMS.map((item) => {
                    const active = config.concept === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleUpdateConfig({ concept: item.id })}
                        className={`py-1.5 text-[11px] font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-white/85 dark:bg-white/15 text-cyan-800 dark:text-cyan-200 shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* Clock Dial / Wave Stage */}
                <div className="w-full max-w-[320px] mx-auto py-1">
                  <ClockVisuals
                    config={config}
                    snapshot={snapshot}
                    theme={theme}
                    animPhase={harmonicPhaseSec}
                    compact
                  />
                </div>

                {/* Bottom Widget Digital Readout */}
                <div className="flex items-end justify-between gap-3 pt-3 border-t border-slate-900/10 dark:border-white/10">
                  <div>
                    <h1 className="font-display text-3xl sm:text-4xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                      {formatAlternateDigital(snapshot, config)}
                    </h1>
                    <p className="mt-1 text-xs font-medium tracking-wide text-slate-700 dark:text-slate-200">
                      {formatAlternateClockDate(snapshot.altDayOffset)}
                      {snapshot.altDayOffset !== 0 && (
                        <span className="ml-1.5 font-mono tabular-nums text-[11px] text-amber-700 dark:text-amber-300">
                          {snapshot.altDayOffset > 0 ? `+${snapshot.altDayOffset}d` : `${snapshot.altDayOffset}d`}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] font-mono tabular-nums text-cyan-800 dark:text-cyan-300">
                      {snapshot.bpm.toFixed(1)} BPM · {snapshot.nearestNote} ({snapshot.audibleOctaveHz.toFixed(0)} Hz)
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Earth {formatEarthTimeFromSeconds(earthSeconds)}
                    </div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      {Math.round(snapshot.dayPhase * 100)}% day
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Direct 1-Click Install Action */}
            <PWAInstallButton fullWidth />
          </>
        )}
      </section>

      <WidgetStudioModal
        open={widgetStudioOpen}
        onClose={() => setWidgetStudioOpen(false)}
        config={config}
        snapshot={snapshot}
        theme={theme}
      />
      <OfflineIndicator />
    </main>
  );
}
