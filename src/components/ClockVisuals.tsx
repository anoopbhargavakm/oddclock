import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlternateTimeSnapshot,
  ClockConfig,
  formatEarthTimeFromSeconds,
  gcd,
  hexToRgba,
  mixHex,
  normalizeHexColor,
  padClockUnit,
} from '../engine/clockEngine';

export type ThemeMode = 'dark' | 'light';

interface ClockVisualsProps {
  config: ClockConfig;
  snapshot: AlternateTimeSnapshot;
  theme: ThemeMode;
  animPhase: number;
  compact?: boolean;
}

const CX = 300;
const CY = 300;

interface SvgPalette {
  dialBg: string;
  outerRing: string;
  gridLine: string;
  majorTick: string;
  minorTick: string;
  numeral: string;
  numeralMuted: string;
  hourColor: string;
  hourText: string;
  minuteColor: string;
  minuteArc: string;
  secondColor: string;
  secondHighlight: string;
  waveStroke: string;
  haloCyan: string;
  haloAmber: string;
  carrierCyan: string;
  pivotFill: string;
  spiralTrack: string;
}

function getSvgPalette(theme: ThemeMode, compact?: boolean, accentColor?: string): SvgPalette {
  const accent = normalizeHexColor(accentColor, '#06B6D4');

  if (theme === 'dark') {
    return {
      dialBg: compact ? 'rgba(7, 9, 14, 0.42)' : '#07090E',
      outerRing: compact ? 'rgba(255, 255, 255, 0.14)' : '#1E293B',
      gridLine: '#162032',
      majorTick: '#475569',
      minorTick: '#1E293B',
      numeral: '#CBD5E1',
      numeralMuted: '#94A3B8',
      hourColor: '#F59E0B',
      hourText: '#FBBF24',
      minuteColor: '#F8FAFC',
      minuteArc: '#E2E8F0',
      secondColor: accent,
      secondHighlight: mixHex(accent, '#FFFFFF', 0.25),
      waveStroke: hexToRgba(accent, 0.3),
      haloCyan: hexToRgba(accent, 0.24),
      haloAmber: 'rgba(245, 158, 11, 0.24)',
      carrierCyan: mixHex(accent, '#FFFFFF', 0.38),
      pivotFill: '#07090E',
      spiralTrack: 'rgba(148, 163, 184, 0.22)',
    };
  }
  const lightAccent = mixHex(accent, '#0F172A', 0.18);
  return {
    dialBg: compact ? 'rgba(255, 255, 255, 0.52)' : '#F8FAFC',
    outerRing: compact ? 'rgba(15, 23, 42, 0.12)' : '#CBD5E1',
    gridLine: '#E2E8F0',
    majorTick: '#64748B',
    minorTick: '#CBD5E1',
    numeral: '#334155',
    numeralMuted: '#64748B',
    hourColor: '#D97706',
    hourText: '#B45309',
    minuteColor: '#0F172A',
    minuteArc: '#334155',
    secondColor: lightAccent,
    secondHighlight: mixHex(accent, '#0F172A', 0.32),
    waveStroke: hexToRgba(lightAccent, 0.32),
    haloCyan: hexToRgba(lightAccent, 0.22),
    haloAmber: 'rgba(217, 119, 6, 0.20)',
    carrierCyan: mixHex(accent, '#0F172A', 0.08),
    pivotFill: '#FFFFFF',
    spiralTrack: 'rgba(100, 116, 139, 0.26)',
  };
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const clampedEnd = Math.min(endAngle, startAngle + 359.99);
  const start = polarToCartesian(cx, cy, radius, clampedEnd);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = clampedEnd - startAngle <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/**
 * Analog Dial: Hour, Minute, and Second hands aligned directly to their concentric tracks
 * plus an outer harmonic carrier ring.
 */
const PhaseDialClock: React.FC<ClockVisualsProps> = ({ config, snapshot, theme, animPhase, compact }) => {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const p = getSvgPalette(theme, compact, config.accentColor);

  const H = config.hoursPerDay;
  const M = config.minutesPerHour;
  const S = config.secondsPerMinute;

  const secondAngle =
    config.sweepMode === 'smooth' ? snapshot.minutePhase * 360 : (snapshot.second / S) * 360;
  const minuteAngle = snapshot.hourPhase * 360;
  const hourAngle = snapshot.dayPhase * 360;
  const labelStep = H <= 24 ? 1 : H <= 40 ? 2 : 3;

  const hoveredEarthTime = useMemo(() => {
    if (hoveredHour === null) return null;
    const altDaySeconds = H * M * S * snapshot.earthSecondsPerAltTick;
    const earthSecAtHour = (hoveredHour / H) * altDaySeconds;
    return formatEarthTimeFromSeconds(earthSecAtHour);
  }, [hoveredHour, H, M, S, snapshot.earthSecondsPerAltTick]);

  const wavePoints = useMemo(() => {
    const pts: string[] = [];
    const segments = Math.max(180, H * 10);
    const waveFreq = Math.min(Math.max(H, 4), 32);
    const pulseAmp = 5 + Math.sin(animPhase * Math.PI * 2 * snapshot.tickHz) * 2.2;
    const travelPhase = animPhase * 0.75;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const r = 172 + Math.sin(theta * waveFreq - travelPhase) * pulseAmp;
      const x = CX + r * Math.sin(theta);
      const y = CY - r * Math.cos(theta);
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ') + ' Z';
  }, [H, animPhase, snapshot.tickHz]);

  const hourR = 144;
  const minuteR = 198;
  const secondR = 236;

  const hourPointer = polarToCartesian(CX, CY, hourR, hourAngle);
  const minutePointer = polarToCartesian(CX, CY, minuteR, minuteAngle);
  const secondPointer = polarToCartesian(CX, CY, secondR, secondAngle);
  const secondTail = polarToCartesian(CX, CY, -34, secondAngle);

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[560px] aspect-square mx-auto">
      <svg
        viewBox="0 0 600 600"
        className="w-full h-full select-none"
        role="img"
        aria-label={`Analog dial showing ${snapshot.hour} hours, ${snapshot.minute} minutes, ${snapshot.second} seconds`}
      >
        <circle cx={CX} cy={CY} r={278} fill={p.dialBg} stroke={p.outerRing} strokeWidth="1.2" />
        <circle cx={CX} cy={CY} r={secondR} fill="none" stroke={p.outerRing} strokeWidth="1" strokeDasharray="2 4" />
        <circle cx={CX} cy={CY} r={minuteR} fill="none" stroke={p.outerRing} strokeWidth="1" />
        <circle cx={CX} cy={CY} r={hourR} fill="none" stroke={p.outerRing} strokeWidth="1" />

        <path d={wavePoints} fill="none" stroke={p.waveStroke} strokeWidth="1.5" />

        {/* Progress arcs aligned directly with each hand's radius */}
        <path
          d={describeArc(CX, CY, hourR, 0, Math.max(0.5, hourAngle))}
          fill="none"
          stroke={p.hourColor}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d={describeArc(CX, CY, minuteR, 0, Math.max(0.5, minuteAngle))}
          fill="none"
          stroke={p.minuteArc}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d={describeArc(CX, CY, secondR, 0, Math.max(0.5, secondAngle))}
          fill="none"
          stroke={p.secondColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Outer Hour divisions (0 .. H-1) */}
        {Array.from({ length: H }).map((_, idx) => {
          const angle = (idx / H) * 360;
          const inner = polarToCartesian(CX, CY, 244, angle);
          const outer = polarToCartesian(CX, CY, 255, angle);
          const labelPos = polarToCartesian(CX, CY, 266, angle);
          const isCurrent = idx === snapshot.hour;
          const isHovered = idx === hoveredHour;
          const showLabel = idx % labelStep === 0 || isCurrent || isHovered;

          return (
            <g
              key={`h-${idx}`}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredHour(idx)}
              onMouseLeave={() => setHoveredHour(null)}
            >
              <circle cx={labelPos.x} cy={labelPos.y} r={14} fill="transparent" />
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={isCurrent || isHovered ? p.hourColor : p.majorTick}
                strokeWidth={isCurrent || isHovered ? '2.5' : '1.4'}
              />
              {showLabel && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono text-[14px] font-semibold"
                  fill={isCurrent || isHovered ? p.hourText : p.numeral}
                >
                  {idx}
                </text>
              )}
            </g>
          );
        })}

        {/* Minute ticks on minute track (r = 198) */}
        {Array.from({ length: M }).map((_, idx) => {
          const angle = (idx / M) * 360;
          const major = idx % Math.max(1, Math.round(M / 12)) === 0;
          const inner = polarToCartesian(CX, CY, major ? minuteR - 10 : minuteR - 5, angle);
          const outer = polarToCartesian(CX, CY, minuteR, angle);
          const isCurrent = idx === snapshot.minute;
          return (
            <line
              key={`m-${idx}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isCurrent ? p.minuteColor : major ? p.majorTick : p.minorTick}
              strokeWidth={isCurrent ? '2.2' : '1'}
            />
          );
        })}

        {/* Second ticks on second track (r = 236) */}
        {Array.from({ length: Math.min(S, 120) }).map((_, idx) => {
          const angle = (idx / S) * 360;
          const major = idx % Math.max(1, Math.round(S / 12)) === 0;
          const inner = polarToCartesian(CX, CY, major ? secondR - 8 : secondR - 4, angle);
          const outer = polarToCartesian(CX, CY, secondR, angle);
          const isCurrent = idx === snapshot.second;
          return (
            <line
              key={`s-${idx}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isCurrent ? p.secondHighlight : major ? p.majorTick : p.minorTick}
              strokeWidth={isCurrent ? '2' : '0.9'}
            />
          );
        })}

        {/* Hands */}
        <line
          x1={CX}
          y1={CY}
          x2={hourPointer.x}
          y2={hourPointer.y}
          stroke={p.hourColor}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1={CX}
          y1={CY}
          x2={minutePointer.x}
          y2={minutePointer.y}
          stroke={p.minuteColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1={secondTail.x}
          y1={secondTail.y}
          x2={secondPointer.x}
          y2={secondPointer.y}
          stroke={p.secondColor}
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        <circle cx={CX} cy={CY} r={7.5} fill={p.pivotFill} stroke={p.secondColor} strokeWidth="2.2" />
        <circle cx={CX} cy={CY} r={2.5} fill={p.hourColor} />
      </svg>

      {hoveredHour !== null && hoveredEarthTime && (
        <div className="absolute top-3 left-3 bg-white/95 dark:bg-[#0B0F17]/95 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-md text-xs font-mono text-slate-700 dark:text-slate-300 tabular-nums pointer-events-none">
          Hour {padClockUnit(hoveredHour, H)} · Solar Equivalent {hoveredEarthTime}
        </div>
      )}
    </div>
  );
};

/**
 * Harmonic Knot (Lissajous): Encodes the exact H:M ratio as a phase-coupled
 * resonance curve where the cyan tracer tracks live second progress (minutePhase).
 */
const LissajousClock: React.FC<ClockVisualsProps> = ({ config, snapshot, theme, animPhase, compact }) => {
  const p = getSvgPalette(theme, compact, config.accentColor);
  const H = config.hoursPerDay;
  const M = config.minutesPerHour;
  const minuteAngle = snapshot.hourPhase * 360;
  const hourAngle = snapshot.dayPhase * 360;

  const divisor = gcd(H, M);
  let freqA = Math.max(1, Math.round(H / divisor));
  let freqB = Math.max(1, Math.round(M / divisor));
  if (freqA > 9 || freqB > 9) {
    const scale = Math.max(freqA, freqB) / 7;
    freqA = Math.max(1, Math.round(freqA / scale));
    freqB = Math.max(2, Math.round(freqB / scale));
  }
  if (freqA === freqB) {
    freqB = freqA + 1;
  }

  const delta = snapshot.hourPhase * Math.PI * 2 + animPhase * 0.2;
  const R = 166;

  const lissajousPath = useMemo(() => {
    const steps = 360;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = CX + R * Math.sin(freqA * t + delta);
      const y = CY + R * Math.sin(freqB * t);
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ') + ' Z';
  }, [freqA, freqB, delta]);

  // Tracer follows real minutePhase (seconds within current minute) around the harmonic knot
  const tHead = snapshot.minutePhase * Math.PI * 2;
  const headX = CX + R * Math.sin(freqA * tHead + delta);
  const headY = CY + R * Math.sin(freqB * tHead);

  const hourDot = polarToCartesian(CX, CY, 224, hourAngle);
  const minuteDot = polarToCartesian(CX, CY, 244, minuteAngle);
  const labelStep = H <= 24 ? 1 : H <= 40 ? 2 : 3;

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[560px] aspect-square mx-auto">
      <svg
        viewBox="0 0 600 600"
        className="w-full h-full select-none"
        role="img"
        aria-label={`Harmonic resonance clock at ratio ${freqA}:${freqB}`}
      >
        <circle cx={CX} cy={CY} r={278} fill={p.dialBg} stroke={p.outerRing} strokeWidth="1.2" />
        <line x1={76} y1={CY} x2={524} y2={CY} stroke={p.gridLine} strokeWidth="1" />
        <line x1={CX} y1={76} x2={CX} y2={524} stroke={p.gridLine} strokeWidth="1" />
        <circle cx={CX} cy={CY} r={202} fill="none" stroke={p.gridLine} strokeWidth="1" />
        <circle cx={CX} cy={CY} r={224} fill="none" stroke={p.outerRing} strokeWidth="1" />
        <circle cx={CX} cy={CY} r={244} fill="none" stroke={p.outerRing} strokeWidth="1" />

        {Array.from({ length: H }).map((_, idx) => {
          const angle = (idx / H) * 360;
          const p1 = polarToCartesian(CX, CY, 218, angle);
          const p2 = polarToCartesian(CX, CY, 230, angle);
          const labelPos = polarToCartesian(CX, CY, 262, angle);
          const isCurr = idx === snapshot.hour;
          const show = idx % labelStep === 0 || isCurr;
          return (
            <g key={`lh-${idx}`}>
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={isCurr ? p.hourColor : p.majorTick}
                strokeWidth={isCurr ? '2.4' : '1.2'}
              />
              {show && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono text-[13px] font-semibold"
                  fill={isCurr ? p.hourText : p.numeralMuted}
                >
                  {idx}
                </text>
              )}
            </g>
          );
        })}

        <path d={lissajousPath} fill="none" stroke={p.secondColor} strokeWidth="2.2" opacity="0.9" />

        <path
          d={describeArc(CX, CY, 224, 0, Math.max(0.5, hourAngle))}
          fill="none"
          stroke={p.hourColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d={describeArc(CX, CY, 244, 0, Math.max(0.5, minuteAngle))}
          fill="none"
          stroke={p.minuteArc}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />

        <circle cx={hourDot.x} cy={hourDot.y} r={6} fill={p.hourColor} stroke={p.pivotFill} strokeWidth="1.5" />
        <circle cx={minuteDot.x} cy={minuteDot.y} r={4.5} fill={p.minuteColor} stroke={p.pivotFill} strokeWidth="1.5" />

        {/* Live Second tracer orbiting the Lissajous knot */}
        <circle cx={headX} cy={headY} r={12} fill={p.haloCyan} />
        <circle cx={headX} cy={headY} r={5} fill={p.secondHighlight} stroke={p.pivotFill} strokeWidth="1.5" />

        <text
          x={CX}
          y={CY + 190}
          textAnchor="middle"
          className="font-mono text-[13px]"
          fill={p.numeralMuted}
        >
          {H}:{M} ratio ({freqA}:{freqB})
        </text>
      </svg>
    </div>
  );
};

/**
 * Wave Clock: 3 time channels (Day, Hour, Minute) + true superposed interference wave
 * summing the exact active frequencies and phases.
 */
const SpectrumClock: React.FC<ClockVisualsProps> = ({ config, snapshot, theme, animPhase, compact }) => {
  const p = getSvgPalette(theme, compact, config.accentColor);
  const H = config.hoursPerDay;
  const M = config.minutesPerHour;
  const S = config.secondsPerMinute;

  const channels = [
    {
      label: 'Day Progress',
      value: `${(snapshot.dayPhase * 100).toFixed(1)}%`,
      freq: `${(snapshot.dayHz * 1000).toFixed(3)} mHz`,
      phase: snapshot.dayPhase,
      wavePhase: animPhase * 0.08,
      cycles: 1,
      weight: 0.35,
      color: p.hourColor,
    },
    {
      label: `Hour Wave (1/${H})`,
      value: `${padClockUnit(snapshot.hour, H)} / ${H}`,
      freq: `${(snapshot.hourHz * 1000).toFixed(2)} mHz`,
      phase: snapshot.hourPhase,
      wavePhase: animPhase * 0.16,
      cycles: Math.min(H, 12),
      weight: 0.3,
      color: p.minuteArc,
    },
    {
      label: `Minute Wave (1/${M})`,
      value: `${padClockUnit(snapshot.minute, M)} / ${M}`,
      freq: `${snapshot.minuteHz.toFixed(3)} Hz`,
      phase: snapshot.minutePhase,
      wavePhase: animPhase * 0.35,
      cycles: Math.min(Math.max(Math.round(M / 5), 2), 16),
      weight: 0.2,
      color: p.carrierCyan,
    },
    {
      label: `Second Beat (1/${S})`,
      value: `${padClockUnit(snapshot.second, S)} / ${S}`,
      freq: `${snapshot.tickHz.toFixed(3)} Hz`,
      phase: snapshot.secondPhase,
      wavePhase: animPhase * snapshot.tickHz * 0.5,
      cycles: Math.min(Math.max(Math.round(S / 4), 3), 24),
      weight: 0.15,
      color: p.secondColor,
    },
  ];

  const buildWave = (cycles: number, phaseOffset: number, yBase: number, amp: number) => {
    const width = 520;
    const startX = 40;
    const pts: string[] = [];
    for (let i = 0; i <= 180; i++) {
      const u = i / 180;
      const x = startX + u * width;
      const y = yBase + Math.sin((u * cycles - phaseOffset) * Math.PI * 2) * amp;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const buildSumWave = (yBase: number) => {
    const width = 520;
    const startX = 40;
    const pts: string[] = [];
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      let sum = 0;
      for (const ch of channels) {
        sum += ch.weight * Math.sin((u * ch.cycles - ch.wavePhase) * Math.PI * 2);
      }
      const x = startX + u * width;
      const y = yBase + sum * 34;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[620px] mx-auto">
      <svg
        viewBox="0 0 600 540"
        className={`w-full h-auto select-none rounded-2xl border ${
          compact
            ? 'bg-white/35 dark:bg-black/25 border-white/50 dark:border-white/10'
            : 'bg-slate-50 dark:bg-[#07090E] border-slate-200 dark:border-slate-800'
        }`}
        role="img"
        aria-label="Four-channel wave clock spectrum"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
          const x = 40 + frac * 520;
          return <line key={`vg-${idx}`} x1={x} y1={24} x2={x} y2={512} stroke={p.gridLine} strokeWidth="1" />;
        })}

        {channels.map((ch, idx) => {
          const yBase = 76 + idx * 96;
          const cursorX = 40 + ch.phase * 520;
          return (
            <g key={ch.label}>
              <line x1={40} y1={yBase} x2={560} y2={yBase} stroke={p.outerRing} strokeWidth="1" strokeDasharray="3 4" />
              <text x={40} y={yBase - 34} fill={p.numeral} className="text-[15px] font-sans font-semibold">
                {ch.label}
              </text>
              <text
                x={560}
                y={yBase - 34}
                textAnchor="end"
                fill={ch.color}
                className="text-[14px] font-mono tabular-nums font-medium"
              >
                {ch.value} · {ch.freq}
              </text>
              <path d={buildWave(ch.cycles, ch.wavePhase, yBase, 22)} fill="none" stroke={ch.color} strokeWidth="2.2" opacity="0.92" />
              <line x1={cursorX} y1={yBase - 26} x2={cursorX} y2={yBase + 26} stroke={ch.color} strokeWidth="1.8" opacity="0.75" />
              <circle cx={cursorX} cy={yBase} r={5} fill={ch.color} stroke={p.pivotFill} strokeWidth="1.5" />
            </g>
          );
        })}

        <g>
          <line x1={40} y1={468} x2={560} y2={468} stroke={p.outerRing} strokeWidth="1" />
          <text x={40} y={422} fill={p.numeral} className="text-[15px] font-sans font-semibold">
            Combined Wave Clock
          </text>
          <text x={560} y={422} textAnchor="end" fill={p.numeralMuted} className="text-[14px] font-mono tabular-nums">
            {snapshot.bpm.toFixed(1)} BPM · {snapshot.nearestNote}
          </text>
          <path d={buildSumWave(468)} fill="none" stroke={p.secondHighlight} strokeWidth="2.4" />
        </g>
      </svg>
    </div>
  );
};

/**
 * Archimedean Spiral Clock:
 * Each full 360° coil = 1 Hour (H coils from center to rim).
 * Radial ticks around the rim mark Minutes (0 .. M-1), so the glowing amber cursor
 * on coil `hour` always points directly to the exact current minute fraction!
 */
const SpiralClock: React.FC<ClockVisualsProps> = ({ config, snapshot, theme, animPhase, compact }) => {
  const p = getSvgPalette(theme, compact, config.accentColor);
  const H = config.hoursPerDay;
  const M = config.minutesPerHour;
  const S = config.secondsPerMinute;

  const secondAngle =
    config.sweepMode === 'smooth' ? snapshot.minutePhase * 360 : (snapshot.second / S) * 360;

  const spiralTurns = H;
  const minR = 38;
  const maxR = 228;
  const trackWidth = H > 36 ? 1.4 : H > 20 ? 2.0 : 2.6;

  const { fullSpiralPath, activeSpiralPath, cursorPos } = useMemo(() => {
    const totalPts = Math.min(2160, Math.max(420, H * 36));
    const allPts: string[] = [];
    const activePts: string[] = [];
    const activeLimit = snapshot.dayPhase;

    const getPoint = (u: number) => {
      const r = minR + u * (maxR - minR);
      const angle = u * spiralTurns * Math.PI * 2 - Math.PI / 2;
      return {
        x: CX + r * Math.cos(angle),
        y: CY + r * Math.sin(angle),
      };
    };

    for (let i = 0; i <= totalPts; i++) {
      const u = i / totalPts;
      const pt = getPoint(u);
      allPts.push(`${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`);
      if (u <= activeLimit) {
        activePts.push(`${activePts.length === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`);
      }
    }

    const cursor = getPoint(activeLimit);
    if (activePts.length > 0) {
      activePts.push(`L ${cursor.x.toFixed(2)} ${cursor.y.toFixed(2)}`);
    }

    return {
      fullSpiralPath: allPts.join(' '),
      activeSpiralPath: activePts.join(' '),
      cursorPos: cursor,
    };
  }, [H, spiralTurns, snapshot.dayPhase]);

  const secOrbitPos = polarToCartesian(CX, CY, 250, secondAngle);
  const haloPulseR = 11 + Math.sin(animPhase * Math.PI * 2 * snapshot.tickHz) * 3.5;

  // Pick clean major minute subdivisions for any M (e.g. 100 -> every 10, 60 -> every 5, 64 -> every 8)
  const majorEvery =
    M <= 16
      ? 1
      : M % 10 === 0 && M / 10 <= 12
        ? 10
        : M % 12 === 0 && M / 12 <= 10
          ? Math.max(5, Math.round(M / 12))
          : M % 8 === 0
            ? M / 8
            : Math.max(1, Math.round(M / 10));

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[560px] aspect-square mx-auto">
      <svg
        viewBox="0 0 600 600"
        className="w-full h-full select-none"
        role="img"
        aria-label={`Archimedean spiral clock on hour coil ${snapshot.hour + 1} of ${H}, minute ${snapshot.minute}`}
      >
        <circle cx={CX} cy={CY} r={278} fill={p.dialBg} stroke={p.outerRing} strokeWidth="1.2" />
        <circle cx={CX} cy={CY} r={250} fill="none" stroke={p.outerRing} strokeWidth="1" />

        {/* Minute spokes around the rim (matching spiral angular position) */}
        {Array.from({ length: M }).map((_, idx) => {
          const angle = (idx / M) * 360;
          const isMajor = idx % majorEvery === 0;
          const isCurr = idx === snapshot.minute;
          const inner = polarToCartesian(CX, CY, isMajor ? 40 : 234, angle);
          const outer = polarToCartesian(CX, CY, 244, angle);
          const labelPos = polarToCartesian(CX, CY, 265, angle);
          return (
            <g key={`sp-m-${idx}`}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={isCurr ? p.hourColor : isMajor ? p.gridLine : p.minorTick}
                strokeWidth={isCurr ? '1.6' : '1'}
              />
              {isMajor && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="font-mono text-[13px] font-semibold"
                  fill={isCurr ? p.hourText : p.numeralMuted}
                >
                  {idx}
                </text>
              )}
            </g>
          );
        })}

        <path d={fullSpiralPath} fill="none" stroke={p.spiralTrack} strokeWidth={trackWidth} strokeLinecap="round" />
        {activeSpiralPath && (
          <path d={activeSpiralPath} fill="none" stroke={p.hourColor} strokeWidth={trackWidth + 0.8} strokeLinecap="round" />
        )}

        {/* Outer Second sweep ring */}
        <path
          d={describeArc(CX, CY, 250, 0, Math.max(0.5, secondAngle))}
          fill="none"
          stroke={p.secondColor}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx={secOrbitPos.x} cy={secOrbitPos.y} r={5} fill={p.secondColor} stroke={p.pivotFill} strokeWidth="1.5" />

        {/* Live Hour/Minute spiral cursor */}
        <circle cx={cursorPos.x} cy={cursorPos.y} r={haloPulseR} fill={p.haloAmber} />
        <circle cx={cursorPos.x} cy={cursorPos.y} r={5.5} fill={p.hourText} stroke={p.pivotFill} strokeWidth="1.5" />

        {/* Center Hour badge */}
        <circle cx={CX} cy={CY} r={24} fill={p.pivotFill} stroke={p.hourColor} strokeWidth="1.8" />
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono text-[16px] font-bold"
          fill={p.hourText}
        >
          {padClockUnit(snapshot.hour, H)}
        </text>
      </svg>
    </div>
  );
};

export const ClockVisuals: React.FC<ClockVisualsProps> = ({
  config,
  snapshot,
  theme,
  animPhase,
  compact = false,
}) => {
  const prefersReducedMotion = useReducedMotion();

  const renderConcept = () => {
    switch (config.concept) {
      case 'phase-dial':
        return (
          <PhaseDialClock
            config={config}
            snapshot={snapshot}
            theme={theme}
            animPhase={animPhase}
            compact={compact}
          />
        );
      case 'lissajous':
        return (
          <LissajousClock
            config={config}
            snapshot={snapshot}
            theme={theme}
            animPhase={animPhase}
            compact={compact}
          />
        );
      case 'spectrum':
        return (
          <SpectrumClock
            config={config}
            snapshot={snapshot}
            theme={theme}
            animPhase={animPhase}
            compact={compact}
          />
        );
      case 'spiral':
        return (
          <SpiralClock
            config={config}
            snapshot={snapshot}
            theme={theme}
            animPhase={animPhase}
            compact={compact}
          />
        );
    }
  };

  return (
    <div
      className={
        compact
          ? 'flex items-center justify-center'
          : 'min-h-[380px] sm:min-h-[540px] flex items-center justify-center'
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={config.concept}
          className="w-full"
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.988 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.988 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
          }
        >
          {renderConcept()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
