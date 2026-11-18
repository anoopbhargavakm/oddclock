import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Equal, Pause, Play, RotateCcw } from 'lucide-react';
import {
  ClockConfig,
  computeTimeDilation,
  DilationHorizon,
  EARTH_SECONDS_PER_DAY,
  formatDurationSeconds,
  hexToRgba,
  mixHex,
  normalizeHexColor,
} from '../engine/clockEngine';
import { ThemeMode } from './ClockVisuals';

interface TimeDilatorViewProps {
  config: ClockConfig;
  theme: ThemeMode;
  horizon: DilationHorizon;
  onHorizonChange: (horizon: DilationHorizon) => void;
  liveElapsedSeconds: number;
  livePaused: boolean;
  onToggleLivePause: () => void;
  onResetLive: () => void;
  earthSecondsToday: number;
}

const HORIZON_OPTIONS: { id: DilationHorizon; label: string }[] = [
  { id: 'live', label: 'Live Timer' },
  { id: 'today', label: 'Today' },
  { id: 'day', label: '24h Day' },
  { id: 'year', label: '1 Year' },
];

export const TimeDilatorView: React.FC<TimeDilatorViewProps> = ({
  config,
  theme,
  horizon,
  onHorizonChange,
  liveElapsedSeconds,
  livePaused,
  onToggleLivePause,
  onResetLive,
  earthSecondsToday,
}) => {
  const isDark = theme === 'dark';
  const accent = normalizeHexColor(config.accentColor);
  const accentGlow = isDark ? mixHex(accent, '#FFFFFF', 0.28) : mixHex(accent, '#000000', 0.16);
  const trackBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
  const earthBarColor = isDark ? 'rgba(148, 163, 184, 0.55)' : 'rgba(71, 85, 105, 0.45)';
  const gridTextColor = isDark ? 'rgba(226, 232, 240, 0.72)' : 'rgba(30, 41, 59, 0.78)';
  const mutedTextColor = isDark ? 'rgba(148, 163, 184, 0.78)' : 'rgba(71, 85, 105, 0.78)';

  const targetEarthSeconds = useMemo(() => {
    switch (horizon) {
      case 'live':
        return liveElapsedSeconds;
      case 'today':
        return earthSecondsToday;
      case 'day':
        return EARTH_SECONDS_PER_DAY;
      case 'year':
        return EARTH_SECONDS_PER_DAY * 365.2425;
    }
  }, [horizon, liveElapsedSeconds, earthSecondsToday]);

  const dilation = useMemo(
    () => computeTimeDilation(config, targetEarthSeconds, horizon === 'live'),
    [config, targetEarthSeconds, horizon]
  );

  // Visual bar ratios (0..1) comparing Earth vs OddClock rates side by side
  const maxTickRate = Math.max(1, dilation.tickSpeedFactor);
  const earthTickWidth = (1 / maxTickRate) * 236;
  const oddTickWidth = (dilation.tickSpeedFactor / maxTickRate) * 236;

  const maxDayRate = Math.max(1, dilation.daySpeedFactor);
  const earthDayWidth = (1 / maxDayRate) * 236;
  const oddDayWidth = (dilation.daySpeedFactor / maxDayRate) * 236;

  // Animated traveling pulse positions (smooth loop along each bar)
  const earthPulseFrac = (targetEarthSeconds % 10) / 10;
  const oddPulseFrac = ((targetEarthSeconds * dilation.tickSpeedFactor) % 10) / 10;

  const tickPercentDelta = (dilation.tickSpeedFactor - 1) * 100;
  const dayPercentDelta = (dilation.daySpeedFactor - 1) * 100;

  const formatCompactCount = (n: number): string => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${Math.round(n).toLocaleString()}`;
    if (abs >= 100) return Math.round(n).toLocaleString();
    return n.toFixed(1);
  };

  const statusBadge = (() => {
    if (dilation.classification === 'accelerated') {
      return {
        label: 'Time Compressed (Faster Gain)',
        icon: <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />,
        toneClass: 'text-emerald-700 dark:text-emerald-300',
      };
    }
    if (dilation.classification === 'dilated') {
      return {
        label: 'Time Stretched (Slower Cadence)',
        icon: <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />,
        toneClass: 'text-amber-700 dark:text-amber-300',
      };
    }
    return {
      label: 'Earth-Synchronized (1.00×)',
      icon: <Equal className="w-3.5 h-3.5 shrink-0" />,
      toneClass: 'text-slate-700 dark:text-slate-200',
    };
  })();

  const signedTickDelta = `${dilation.tickDelta >= 0 ? '+' : ''}${formatCompactCount(dilation.tickDelta)} ticks`;
  const signedTickPct = `${tickPercentDelta >= 0 ? '+' : ''}${tickPercentDelta.toFixed(1)}%`;

  const dayDeltaDisplay =
    config.anchorMode === 'solar'
      ? '0h 00m (Solar-locked 24h day)'
      : `${formatDurationSeconds(dilation.perceivedDayDeltaSeconds, { signed: true })} (${dayPercentDelta >= 0 ? '+' : ''}${dayPercentDelta.toFixed(1)}%)`;

  return (
    <div className="space-y-3.5">
      {/* Horizon Selector */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-white/60 dark:border-white/10">
        {HORIZON_OPTIONS.map((opt) => {
          const active = horizon === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onHorizonChange(opt.id)}
              className={`py-1.5 text-[11px] font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-white/85 dark:bg-white/15 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Live Stopwatch Controls when in Live Timer horizon */}
      {horizon === 'live' && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
            Session comparator · {config.timeScale}× rate
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleLivePause}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/55 dark:bg-white/5 border border-white/65 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              {livePaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              <span>{livePaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              type="button"
              onClick={onResetLive}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white/55 dark:bg-white/5 border border-white/65 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}

      {/* Dual-Stream Temporal Dilation SVG Gauge */}
      <div className="rounded-2xl bg-white/35 dark:bg-black/25 border border-white/60 dark:border-white/10 px-3 py-2.5">
        <svg
          viewBox="0 0 340 132"
          className="w-full h-auto block"
          role="img"
          aria-label="OddClock vs Earth time dilation comparison bars"
        >
          <defs>
            <linearGradient id="odd-dilator-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={hexToRgba(accent, 0.72)} />
              <stop offset="100%" stopColor={accentGlow} />
            </linearGradient>
          </defs>

          {/* Section 1: Tick Cadence Comparison */}
          <text x="4" y="13" fill={gridTextColor} fontSize="10" fontWeight="600">
            Beat Cadence
          </text>
          <text
            x="336"
            y="13"
            textAnchor="end"
            fill={accentGlow}
            fontSize="10"
            fontFamily="IBM Plex Mono, monospace"
          >
            {dilation.tickSpeedFactor.toFixed(2)}× ticks/s
          </text>

          {/* Earth Beat Bar */}
          <text x="4" y="30" fill={mutedTextColor} fontSize="9.5" fontFamily="IBM Plex Mono, monospace">
            Earth
          </text>
          <rect x="64" y="21" width="236" height="10" rx="5" fill={trackBg} />
          <rect x="64" y="21" width={Math.max(4, earthTickWidth)} height="10" rx="5" fill={earthBarColor} />
          <circle
            cx={64 + Math.max(4, earthTickWidth) * earthPulseFrac}
            cy="26"
            r="2.4"
            fill={isDark ? '#F8FAFC' : '#0F172A'}
          />
          <text
            x="336"
            y="29"
            textAnchor="end"
            fill={mutedTextColor}
            fontSize="9"
            fontFamily="IBM Plex Mono, monospace"
          >
            1.00 Hz
          </text>

          {/* OddClock Beat Bar */}
          <text x="4" y="48" fill={accentGlow} fontSize="9.5" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
            OddClock
          </text>
          <rect x="64" y="39" width="236" height="10" rx="5" fill={trackBg} />
          <rect
            x="64"
            y="39"
            width={Math.max(4, oddTickWidth)}
            height="10"
            rx="5"
            fill="url(#odd-dilator-grad)"
          />
          <circle
            cx={64 + Math.max(4, oddTickWidth) * oddPulseFrac}
            cy="44"
            r="2.6"
            fill="#FFFFFF"
            stroke={accent}
            strokeWidth="1.2"
          />
          <text
            x="336"
            y="47"
            textAnchor="end"
            fill={accentGlow}
            fontSize="9"
            fontFamily="IBM Plex Mono, monospace"
          >
            {dilation.tickSpeedFactor.toFixed(2)} Hz
          </text>

          {/* Hairline divider */}
          <line
            x1="4"
            y1="64"
            x2="336"
            y2="64"
            stroke={isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'}
            strokeWidth="1"
          />

          {/* Section 2: Day-Cycle Rate Comparison */}
          <text x="4" y="81" fill={gridTextColor} fontSize="10" fontWeight="600">
            Day-Cycle Velocity
          </text>
          <text
            x="336"
            y="81"
            textAnchor="end"
            fill={accentGlow}
            fontSize="10"
            fontFamily="IBM Plex Mono, monospace"
          >
            {dilation.daySpeedFactor.toFixed(2)}× days/24h
          </text>

          {/* Earth Day Bar */}
          <text x="4" y="98" fill={mutedTextColor} fontSize="9.5" fontFamily="IBM Plex Mono, monospace">
            Earth
          </text>
          <rect x="64" y="89" width="236" height="10" rx="5" fill={trackBg} />
          <rect x="64" y="89" width={Math.max(4, earthDayWidth)} height="10" rx="5" fill={earthBarColor} />
          <text
            x="336"
            y="97"
            textAnchor="end"
            fill={mutedTextColor}
            fontSize="9"
            fontFamily="IBM Plex Mono, monospace"
          >
            24.0h
          </text>

          {/* OddClock Day Bar */}
          <text x="4" y="116" fill={accentGlow} fontSize="9.5" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
            OddClock
          </text>
          <rect x="64" y="107" width="236" height="10" rx="5" fill={trackBg} />
          <rect
            x="64"
            y="107"
            width={Math.max(4, oddDayWidth)}
            height="10"
            rx="5"
            fill="url(#odd-dilator-grad)"
          />
          <text
            x="336"
            y="115"
            textAnchor="end"
            fill={accentGlow}
            fontSize="9"
            fontFamily="IBM Plex Mono, monospace"
          >
            {dilation.earthHoursPerOddDay.toFixed(1)}h
          </text>
        </svg>
      </div>

      {/* Elapsed Time Readout Comparison */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Earth Time Elapsed
          </div>
          <div className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white leading-tight">
            {dilation.earthFormatted}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
            {formatCompactCount(dilation.earthElapsedSeconds)} Earth s
          </div>
        </div>

        <div className="space-y-0.5 text-right">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            OddClock Elapsed
          </div>
          <div className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white leading-tight">
            {dilation.oddFormatted}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-cyan-800 dark:text-cyan-300">
            {formatCompactCount(dilation.oddTotalTicks)} Odd ticks
          </div>
        </div>
      </div>

      {/* Perceived Gain / Loss Summary */}
      <div className="pt-2.5 border-t border-slate-900/10 dark:border-white/10 space-y-1.5">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${statusBadge.toneClass}`}>
          {statusBadge.icon}
          <span>{statusBadge.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Beat Delta: </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {signedTickDelta} ({signedTickPct})
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 dark:text-slate-400">Day Gain: </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {config.anchorMode === 'solar'
                ? '0m (24h lock)'
                : formatDurationSeconds(dilation.perceivedDayDeltaSeconds, { signed: true })}
            </span>
          </div>
        </div>

        <p className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {dayDeltaDisplay}
        </p>

        {/* Unit Equivalences (unboxed typographic line with · separators) */}
        <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 pt-0.5">
          1 Odd s = {dilation.earthSecondsPerOddTick.toFixed(2)}s
          <span aria-hidden="true"> · </span>
          1 Odd m = {dilation.earthMinutesPerOddMinute.toFixed(2)}m
          <span aria-hidden="true"> · </span>
          1 Odd h = {dilation.earthHoursPerOddHour.toFixed(2)}h
        </p>
      </div>
    </div>
  );
};
