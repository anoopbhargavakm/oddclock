export type ClockConcept = 'phase-dial' | 'lissajous' | 'spectrum' | 'spiral';
export type AnchorMode = 'solar' | 'frequency';
export type SweepMode = 'smooth' | 'quartz';
export type HarmonicScale = 'pentatonic' | 'quartz' | 'schumann';

export interface ClockConfig {
  hoursPerDay: number;
  minutesPerHour: number;
  secondsPerMinute: number;
  anchorMode: AnchorMode;
  customTickHz: number;
  concept: ClockConcept;
  sweepMode: SweepMode;
  timeScale: number;
  harmonicAnimSpeed: number;
  soundEnabled: boolean;
  harmonicScale: HarmonicScale;
  accentColor: string;
}

export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'cyan', name: 'Quantum Cyan', hex: '#06B6D4' },
  { id: 'azure', name: 'Cobalt Blue', hex: '#3B82F6' },
  { id: 'emerald', name: 'Emerald Pulse', hex: '#10B981' },
  { id: 'violet', name: 'Ultraviolet', hex: '#8B5CF6' },
  { id: 'rose', name: 'Crimson Rose', hex: '#F43F5E' },
  { id: 'amber', name: 'Solar Amber', hex: '#F59E0B' },
];

export interface ClockPreset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  hoursPerDay: number;
  minutesPerHour: number;
  secondsPerMinute: number;
  anchorMode: AnchorMode;
  customTickHz: number;
  recommendedConcept: ClockConcept;
}

export interface AlternateTimeSnapshot {
  hour: number;
  minute: number;
  second: number;
  subTick: number;
  dayPhase: number;
  hourPhase: number;
  minutePhase: number;
  secondPhase: number;
  totalTicksPerDay: number;
  totalTicksElapsed: number;
  tickHz: number;
  minuteHz: number;
  hourHz: number;
  dayHz: number;
  bpm: number;
  earthSecondsPerAltTick: number;
  altDayEarthHours: number;
  altDayEarthSeconds: number;
  altDayOffset: number;
  audibleOctaveHz: number;
  audibleOctaveMultiplier: number;
  nearestNote: string;
  frequencyInsight: string;
}

export const EARTH_SECONDS_PER_DAY = 86_400;

export const CLOCK_PRESETS: ClockPreset[] = [
  {
    id: 'decimal',
    name: 'French Decimal',
    subtitle: '10h · 100m · 100s',
    description: '100,000 metric ticks per solar day. Each beat runs 15.7% brisker than an Earth second.',
    hoursPerDay: 10,
    minutesPerHour: 100,
    secondsPerMinute: 100,
    anchorMode: 'solar',
    customTickHz: 100_000 / 86_400,
    recommendedConcept: 'phase-dial',
  },
  {
    id: 'allegro-120',
    name: '120 BPM Allegro',
    subtitle: '18h · 80m · 120s',
    description: '172,800 ticks locked to exactly 2.000 Hz — a crisp 120 BPM musical pulse across an Earth day.',
    hoursPerDay: 18,
    minutesPerHour: 80,
    secondsPerMinute: 120,
    anchorMode: 'solar',
    customTickHz: 2.0,
    recommendedConcept: 'spectrum',
  },
  {
    id: 'hex-byte',
    name: 'Hexadecimal 16-Bit',
    subtitle: '16h · 64m · 64s',
    description: '65,536 (2^16) ticks per solar day. Pure binary power-of-two quartz division at 0.7585 Hz.',
    hoursPerDay: 16,
    minutesPerHour: 64,
    secondsPerMinute: 64,
    anchorMode: 'solar',
    customTickHz: 65_536 / 86_400,
    recommendedConcept: 'lissajous',
  },
  {
    id: 'dozenal',
    name: 'Dozenal Symmetry',
    subtitle: '12h · 12m · 144s',
    description: '20,736 beats per day at a calm 0.24 Hz cadence — one breath every 4.17 Earth seconds.',
    hoursPerDay: 12,
    minutesPerHour: 12,
    secondsPerMinute: 144,
    anchorMode: 'solar',
    customTickHz: 20_736 / 86_400,
    recommendedConcept: 'spiral',
  },
  {
    id: 'schumann',
    name: 'Schumann Sub-Harmonic',
    subtitle: '16h · 45m · 60s',
    description: 'Frequency-locked to 1.9575 Hz (one-quarter of Earth’s 7.83 Hz ionospheric resonance).',
    hoursPerDay: 16,
    minutesPerHour: 45,
    secondsPerMinute: 60,
    anchorMode: 'frequency',
    customTickHz: 1.9575,
    recommendedConcept: 'lissajous',
  },
  {
    id: 'earth-standard',
    name: 'Earth Standard',
    subtitle: '24h · 60m · 60s',
    description: 'Classic 86,400-second solar day at 1.000 Hz (60 BPM) as a calibration baseline.',
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60,
    anchorMode: 'solar',
    customTickHz: 1.0,
    recommendedConcept: 'phase-dial',
  },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function findAudibleOctave(hz: number): {
  audibleHz: number;
  octaveShift: number;
  multiplier: number;
  nearestNote: string;
} {
  const safeHz = Math.max(hz, 0.0001);
  let audible = safeHz;
  let shift = 0;
  while (audible < 220 && shift < 24) {
    audible *= 2;
    shift += 1;
  }
  while (audible > 440 && shift > -12) {
    audible /= 2;
    shift -= 1;
  }
  const midi = Math.round(69 + 12 * Math.log2(audible / 440));
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return {
    audibleHz: audible,
    octaveShift: shift,
    multiplier: Math.pow(2, shift),
    nearestNote: `${noteName}${octave}`,
  };
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return Math.max(x, 1);
}

export function describeFrequencyPhenomenon(
  tickHz: number,
  earthSecPerAltTick: number,
  altDayEarthHours: number
): string {
  if (Math.abs(tickHz - 1.0) < 0.015) {
    return 'Calibrated to 1.00 Hz (60 BPM) — identical to standard Earth SI seconds.';
  }
  if (tickHz < 0.35) {
    return `Deep slow-wave pulse (${earthSecPerAltTick.toFixed(2)}s per tick) — mirrors slow tidal breathing.`;
  }
  if (tickHz < 0.85) {
    return `Relaxed tempo (${(tickHz * 60).toFixed(0)} BPM) — slower than an Earth second, stretches perceived moments.`;
  }
  if (tickHz <= 1.35) {
    return `Walking cadence (${(tickHz * 60).toFixed(0)} BPM) — brisk metric flow with ${altDayEarthHours.toFixed(1)}h day span.`;
  }
  if (tickHz <= 2.4) {
    return `Allegro heartbeat (${(tickHz * 60).toFixed(0)} BPM) — crisp energetic ticks with high temporal resolution.`;
  }
  return `High-frequency pulse (${tickHz.toFixed(2)} Hz / ${(tickHz * 60).toFixed(0)} BPM) — rapid sub-second subdivision.`;
}

export function computeAlternateTime(
  config: ClockConfig,
  earthSecondsSinceMidnight: number
): AlternateTimeSnapshot {
  const H = Math.max(2, Math.min(60, Math.round(config.hoursPerDay)));
  const M = Math.max(4, Math.min(120, Math.round(config.minutesPerHour)));
  const S = Math.max(4, Math.min(120, Math.round(config.secondsPerMinute)));

  const totalTicksPerDay = H * M * S;

  let tickHz: number;
  let earthSecondsPerAltTick: number;
  let altDayEarthSeconds: number;

  if (config.anchorMode === 'solar') {
    altDayEarthSeconds = EARTH_SECONDS_PER_DAY;
    tickHz = totalTicksPerDay / EARTH_SECONDS_PER_DAY;
    earthSecondsPerAltTick = EARTH_SECONDS_PER_DAY / totalTicksPerDay;
  } else {
    tickHz = Math.max(0.1, Math.min(12, config.customTickHz));
    earthSecondsPerAltTick = 1 / tickHz;
    altDayEarthSeconds = totalTicksPerDay / tickHz;
  }

  const normalizedEarthSeconds =
    ((earthSecondsSinceMidnight % altDayEarthSeconds) + altDayEarthSeconds) % altDayEarthSeconds;
  const dayPhase = normalizedEarthSeconds / altDayEarthSeconds;
  const altDayOffset = Math.floor(earthSecondsSinceMidnight / altDayEarthSeconds);

  const totalTicksExact = dayPhase * totalTicksPerDay;
  const totalTicksElapsed = Math.floor(totalTicksExact);
  const subTick = totalTicksExact - totalTicksElapsed;

  const ticksPerHour = M * S;
  const hour = Math.floor(totalTicksExact / ticksPerHour) % H;
  const minute = Math.floor(totalTicksExact / S) % M;
  const second = totalTicksElapsed % S;

  const hourPhase = (totalTicksExact % ticksPerHour) / ticksPerHour;
  const minutePhase = (totalTicksExact % S) / S;
  const secondPhase = subTick;

  const minuteHz = tickHz / S;
  const hourHz = minuteHz / M;
  const dayHz = hourHz / H;
  const bpm = tickHz * 60;
  const altDayEarthHours = altDayEarthSeconds / 3600;

  const { audibleHz, multiplier, nearestNote } = findAudibleOctave(tickHz);

  return {
    hour,
    minute,
    second,
    subTick,
    dayPhase,
    hourPhase,
    minutePhase,
    secondPhase,
    totalTicksPerDay,
    totalTicksElapsed,
    tickHz,
    minuteHz,
    hourHz,
    dayHz,
    bpm,
    earthSecondsPerAltTick,
    altDayEarthHours,
    altDayEarthSeconds,
    altDayOffset,
    audibleOctaveHz: audibleHz,
    audibleOctaveMultiplier: multiplier,
    nearestNote,
    frequencyInsight: describeFrequencyPhenomenon(tickHz, earthSecondsPerAltTick, altDayEarthHours),
  };
}

export function padClockUnit(value: number, maxVal: number): string {
  const digits = maxVal >= 100 ? 3 : 2;
  return String(Math.floor(value)).padStart(digits, '0');
}

export function formatAlternateDigital(snapshot: AlternateTimeSnapshot, config: ClockConfig): string {
  const h = padClockUnit(snapshot.hour, config.hoursPerDay);
  const m = padClockUnit(snapshot.minute, config.minutesPerHour);
  const s = padClockUnit(snapshot.second, config.secondsPerMinute);
  return `${h}:${m}:${s}`;
}

export function formatEarthTimeFromSeconds(secondsSinceMidnight: number): string {
  const sNorm = ((Math.floor(secondsSinceMidnight) % 86400) + 86400) % 86400;
  const hh = Math.floor(sNorm / 3600);
  const mm = Math.floor((sNorm % 3600) / 60);
  const ss = sNorm % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export type DilationHorizon = 'live' | 'today' | 'day' | 'year';

export interface TimeDilationSnapshot {
  earthElapsedSeconds: number;
  oddTotalTicks: number;
  oddDays: number;
  oddHours: number;
  oddMinutes: number;
  oddSeconds: number;
  oddFormatted: string;
  earthFormatted: string;
  tickSpeedFactor: number;
  daySpeedFactor: number;
  tickDelta: number;
  perceivedDayDeltaSeconds: number;
  earthSecondsPerOddTick: number;
  earthMinutesPerOddMinute: number;
  earthHoursPerOddHour: number;
  earthHoursPerOddDay: number;
  classification: 'accelerated' | 'dilated' | 'synchronized';
}

export function formatDurationSeconds(
  totalSeconds: number,
  options?: { showSubSeconds?: boolean; signed?: boolean }
): string {
  const sign = options?.signed ? (totalSeconds >= 0 ? '+' : '-') : totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(totalSeconds);
  const days = Math.floor(abs / 86400);
  const remAfterDays = abs - days * 86400;
  const hh = Math.floor(remAfterDays / 3600);
  const mm = Math.floor((remAfterDays % 3600) / 60);
  const ssFloat = remAfterDays % 60;
  const ss = Math.floor(ssFloat);
  const tenths = Math.floor((ssFloat - ss) * 10);

  const timeCore = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const withSub = options?.showSubSeconds && days === 0 ? `${timeCore}.${tenths}` : timeCore;
  return days > 0 ? `${sign}${days}d ${withSub}` : `${sign}${withSub}`;
}

export function computeTimeDilation(
  config: ClockConfig,
  earthElapsedSeconds: number,
  showSubSeconds = false
): TimeDilationSnapshot {
  const safeEarthSec = Math.max(0, earthElapsedSeconds);
  const H = Math.max(2, Math.min(60, Math.round(config.hoursPerDay)));
  const M = Math.max(4, Math.min(120, Math.round(config.minutesPerHour)));
  const S = Math.max(4, Math.min(120, Math.round(config.secondsPerMinute)));
  const totalTicksPerDay = H * M * S;

  let tickHz: number;
  let altDayEarthSeconds: number;
  if (config.anchorMode === 'solar') {
    altDayEarthSeconds = EARTH_SECONDS_PER_DAY;
    tickHz = totalTicksPerDay / EARTH_SECONDS_PER_DAY;
  } else {
    tickHz = Math.max(0.1, Math.min(12, config.customTickHz));
    altDayEarthSeconds = totalTicksPerDay / tickHz;
  }

  const oddTotalTicks = safeEarthSec * tickHz;
  const ticksFloored = Math.floor(oddTotalTicks);
  const ticksPerHour = M * S;

  const oddDays = Math.floor(ticksFloored / totalTicksPerDay);
  const remDayTicks = ticksFloored % totalTicksPerDay;
  const oddHours = Math.floor(remDayTicks / ticksPerHour) % H;
  const oddMinutes = Math.floor(remDayTicks / S) % M;
  const oddSeconds = remDayTicks % S;

  const oddCore = `${padClockUnit(oddHours, H)}:${padClockUnit(oddMinutes, M)}:${padClockUnit(oddSeconds, S)}`;
  const oddTenths = Math.floor((oddTotalTicks - ticksFloored) * 10);
  const oddSub = showSubSeconds && oddDays === 0 ? `${oddCore}.${oddTenths}` : oddCore;
  const oddFormatted = oddDays > 0 ? `${oddDays}d ${oddSub}` : oddSub;

  const tickSpeedFactor = tickHz;
  const daySpeedFactor = EARTH_SECONDS_PER_DAY / altDayEarthSeconds;
  const tickDelta = oddTotalTicks - safeEarthSec;
  const perceivedDayDeltaSeconds = safeEarthSec * (daySpeedFactor - 1);

  const earthSecondsPerOddTick = 1 / tickHz;
  const earthMinutesPerOddMinute = (S / tickHz) / 60;
  const earthHoursPerOddHour = (ticksPerHour / tickHz) / 3600;
  const earthHoursPerOddDay = altDayEarthSeconds / 3600;

  let classification: TimeDilationSnapshot['classification'] = 'synchronized';
  if (config.anchorMode === 'frequency') {
    if (daySpeedFactor > 1.005) classification = 'accelerated';
    else if (daySpeedFactor < 0.995) classification = 'dilated';
    else if (tickSpeedFactor > 1.005) classification = 'accelerated';
    else if (tickSpeedFactor < 0.995) classification = 'dilated';
  } else {
    if (tickSpeedFactor > 1.005) classification = 'accelerated';
    else if (tickSpeedFactor < 0.995) classification = 'dilated';
  }

  return {
    earthElapsedSeconds: safeEarthSec,
    oddTotalTicks,
    oddDays,
    oddHours,
    oddMinutes,
    oddSeconds,
    oddFormatted,
    earthFormatted: formatDurationSeconds(safeEarthSec, { showSubSeconds }),
    tickSpeedFactor,
    daySpeedFactor,
    tickDelta,
    perceivedDayDeltaSeconds,
    earthSecondsPerOddTick,
    earthMinutesPerOddMinute,
    earthHoursPerOddHour,
    earthHoursPerOddDay,
    classification,
  };
}

export function formatAlternateClockDate(
  altDayOffset: number,
  baseDate: Date = new Date()
): string {
  const target = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + altDayOffset
  );
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(target);
}

export function normalizeHexColor(hex: string | undefined, fallback = '#06B6D4'): string {
  if (!hex) return fallback;
  const cleaned = hex.trim();
  return /^#[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned.toUpperCase() : fallback;
}

function parseHexRgb(hex: string): [number, number, number] {
  const norm = normalizeHexColor(hex);
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return [r, g, b];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  const r = Math.round(r1 * (1 - w) + r2 * w);
  const g = Math.round(g1 * (1 - w) + g2 * w);
  const b = Math.round(b1 * (1 - w) + b2 * w);
  return (
    '#' +
    [r, g, b]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

const VALID_CONCEPTS: ClockConcept[] = ['phase-dial', 'lissajous', 'spectrum', 'spiral'];

export function parseClockConfigFromSearch(search: string): Partial<ClockConfig> | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  if (
    !params.has('h') &&
    !params.has('m') &&
    !params.has('s') &&
    !params.has('view') &&
    !params.has('accent') &&
    !params.has('hz')
  ) {
    return null;
  }

  const out: Partial<ClockConfig> = {};
  const h = Number(params.get('h'));
  const m = Number(params.get('m'));
  const s = Number(params.get('s'));
  if (Number.isFinite(h) && h >= 2 && h <= 60) out.hoursPerDay = Math.round(h);
  if (Number.isFinite(m) && m >= 4 && m <= 120) out.minutesPerHour = Math.round(m);
  if (Number.isFinite(s) && s >= 4 && s <= 120) out.secondsPerMinute = Math.round(s);

  const mode = params.get('mode');
  if (mode === 'solar' || mode === 'frequency') out.anchorMode = mode;

  const hz = Number(params.get('hz'));
  if (Number.isFinite(hz) && hz >= 0.1 && hz <= 12) out.customTickHz = hz;

  const view = params.get('view') as ClockConcept | null;
  if (view && VALID_CONCEPTS.includes(view)) out.concept = view;

  const sweep = params.get('sweep');
  if (sweep === 'smooth' || sweep === 'quartz') out.sweepMode = sweep;

  const anim = Number(params.get('anim'));
  if (Number.isFinite(anim) && anim >= 0 && anim <= 4) out.harmonicAnimSpeed = anim;

  const accent = params.get('accent');
  if (accent) {
    const rawHex = accent.startsWith('#') ? accent : `#${accent}`;
    out.accentColor = normalizeHexColor(rawHex);
  }

  return out;
}

export function buildClockShareUrl(config: ClockConfig, originUrl: string): string {
  const url = new URL(originUrl);
  url.search = '';
  url.searchParams.set('h', String(config.hoursPerDay));
  url.searchParams.set('m', String(config.minutesPerHour));
  url.searchParams.set('s', String(config.secondsPerMinute));
  url.searchParams.set('mode', config.anchorMode);
  if (config.anchorMode === 'frequency') {
    url.searchParams.set('hz', config.customTickHz.toFixed(3));
  }
  url.searchParams.set('view', config.concept);
  url.searchParams.set('sweep', config.sweepMode);
  if (config.harmonicAnimSpeed !== 1) {
    url.searchParams.set('anim', String(config.harmonicAnimSpeed));
  }
  url.searchParams.set('accent', normalizeHexColor(config.accentColor).slice(1));
  return url.toString();
}
