// Chronosynth Core Horological Engine (Rust)
// Pure zero-dependency implementation of custom day-division and frequency-locked time math.
// Compile to WebAssembly with `wasm-pack build --target web` or run tests with `cargo test`.

pub const EARTH_SECONDS_PER_DAY: f64 = 86_400.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AnchorMode {
    /// Day length stays anchored to 86,400 Earth seconds; tick frequency scales dynamically.
    SolarLocked,
    /// Tick oscillator stays locked to `custom_tick_hz`; day duration scales dynamically.
    FrequencyLocked,
}

#[derive(Debug, Clone, Copy)]
pub struct ClockConfig {
    pub hours_per_day: u32,
    pub minutes_per_hour: u32,
    pub seconds_per_minute: u32,
    pub anchor_mode: AnchorMode,
    pub custom_tick_hz: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct AlternateTime {
    pub hour: u32,
    pub minute: u32,
    pub second: u32,
    pub sub_tick: f64,
    pub day_phase: f64,
    pub hour_phase: f64,
    pub minute_phase: f64,
    pub tick_hz: f64,
    pub bpm: f64,
    pub earth_seconds_per_alt_tick: f64,
    pub alt_day_earth_hours: f64,
    pub audible_octave_hz: f64,
}

impl ClockConfig {
    pub fn total_ticks_per_day(&self) -> u64 {
        (self.hours_per_day.max(2) as u64)
            * (self.minutes_per_hour.max(4) as u64)
            * (self.seconds_per_minute.max(4) as u64)
    }

    pub fn compute_at(&self, earth_seconds_since_midnight: f64) -> AlternateTime {
        let h = self.hours_per_day.clamp(2, 60);
        let m = self.minutes_per_hour.clamp(4, 120);
        let s = self.seconds_per_minute.clamp(4, 120);
        let total_ticks = (h as f64) * (m as f64) * (s as f64);

        let (tick_hz, earth_seconds_per_alt_tick, alt_day_earth_seconds) = match self.anchor_mode {
            AnchorMode::SolarLocked => (
                total_ticks / EARTH_SECONDS_PER_DAY,
                EARTH_SECONDS_PER_DAY / total_ticks,
                EARTH_SECONDS_PER_DAY,
            ),
            AnchorMode::FrequencyLocked => {
                let hz = self.custom_tick_hz.clamp(0.1, 12.0);
                (hz, 1.0 / hz, total_ticks / hz)
            }
        };

        let normalized_earth_s = earth_seconds_since_midnight.rem_euclid(alt_day_earth_seconds);
        let day_phase = normalized_earth_s / alt_day_earth_seconds;
        let total_ticks_exact = day_phase * total_ticks;
        let ticks_floored = total_ticks_exact.floor() as u64;
        let sub_tick = total_ticks_exact - (ticks_floored as f64);

        let ticks_per_hour = (m as u64) * (s as u64);
        let hour = ((ticks_floored / ticks_per_hour) % (h as u64)) as u32;
        let minute = ((ticks_floored / (s as u64)) % (m as u64)) as u32;
        let second = (ticks_floored % (s as u64)) as u32;

        let hour_phase = (total_ticks_exact % (ticks_per_hour as f64)) / (ticks_per_hour as f64);
        let minute_phase = (total_ticks_exact % (s as f64)) / (s as f64);

        let mut audible = tick_hz.max(0.0001);
        while audible < 220.0 {
            audible *= 2.0;
        }
        while audible > 440.0 {
            audible /= 2.0;
        }

        AlternateTime {
            hour,
            minute,
            second,
            sub_tick,
            day_phase,
            hour_phase,
            minute_phase,
            tick_hz,
            bpm: tick_hz * 60.0,
            earth_seconds_per_alt_tick,
            alt_day_earth_hours: alt_day_earth_seconds / 3600.0,
            audible_octave_hz: audible,
        }
    }

    pub fn compute_dilation(&self, earth_elapsed_seconds: f64) -> TimeDilationReport {
        let safe_earth = earth_elapsed_seconds.max(0.0);
        let h = self.hours_per_day.clamp(2, 60);
        let m = self.minutes_per_hour.clamp(4, 120);
        let s = self.seconds_per_minute.clamp(4, 120);
        let total_ticks_per_day = (h as u64) * (m as u64) * (s as u64);

        let (tick_hz, alt_day_earth_seconds) = match self.anchor_mode {
            AnchorMode::SolarLocked => (
                (total_ticks_per_day as f64) / EARTH_SECONDS_PER_DAY,
                EARTH_SECONDS_PER_DAY,
            ),
            AnchorMode::FrequencyLocked => {
                let hz = self.custom_tick_hz.clamp(0.1, 12.0);
                (hz, (total_ticks_per_day as f64) / hz)
            }
        };

        let odd_total_ticks = safe_earth * tick_hz;
        let ticks_floored = odd_total_ticks.floor() as u64;
        let ticks_per_hour = (m as u64) * (s as u64);

        let odd_days = ticks_floored / total_ticks_per_day;
        let rem_day_ticks = ticks_floored % total_ticks_per_day;
        let odd_hours = ((rem_day_ticks / ticks_per_hour) % (h as u64)) as u32;
        let odd_minutes = ((rem_day_ticks / (s as u64)) % (m as u64)) as u32;
        let odd_seconds = (rem_day_ticks % (s as u64)) as u32;

        let day_speed_factor = EARTH_SECONDS_PER_DAY / alt_day_earth_seconds;
        let tick_delta = odd_total_ticks - safe_earth;
        let perceived_day_delta_seconds = safe_earth * (day_speed_factor - 1.0);

        TimeDilationReport {
            earth_elapsed_seconds: safe_earth,
            odd_total_ticks,
            odd_days,
            odd_hours,
            odd_minutes,
            odd_seconds,
            tick_speed_factor: tick_hz,
            day_speed_factor,
            tick_delta,
            perceived_day_delta_seconds,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct TimeDilationReport {
    pub earth_elapsed_seconds: f64,
    pub odd_total_ticks: f64,
    pub odd_days: u64,
    pub odd_hours: u32,
    pub odd_minutes: u32,
    pub odd_seconds: u32,
    pub tick_speed_factor: f64,
    pub day_speed_factor: f64,
    pub tick_delta: f64,
    pub perceived_day_delta_seconds: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn french_decimal_noon_is_05_00_00() {
        let cfg = ClockConfig {
            hours_per_day: 10,
            minutes_per_hour: 100,
            seconds_per_minute: 100,
            anchor_mode: AnchorMode::SolarLocked,
            custom_tick_hz: 1.0,
        };
        let noon = cfg.compute_at(43_200.0);
        assert_eq!((noon.hour, noon.minute, noon.second), (5, 0, 0));
    }

    #[test]
    fn hex_16_bit_midnight_and_quarter_day() {
        let cfg = ClockConfig {
            hours_per_day: 16,
            minutes_per_hour: 64,
            seconds_per_minute: 64,
            anchor_mode: AnchorMode::SolarLocked,
            custom_tick_hz: 1.0,
        };
        assert_eq!(cfg.total_ticks_per_day(), 65_536);
        let q = cfg.compute_at(21_600.0);
        assert_eq!((q.hour, q.minute, q.second), (4, 0, 0));
    }

    #[test]
    fn frequency_locked_scales_day_duration() {
        let cfg = ClockConfig {
            hours_per_day: 16,
            minutes_per_hour: 45,
            seconds_per_minute: 60,
            anchor_mode: AnchorMode::FrequencyLocked,
            custom_tick_hz: 2.0,
        };
        let t = cfg.compute_at(10_800.0);
        assert!((t.tick_hz - 2.0).abs() < 1e-6);
        assert!((t.bpm - 120.0).abs() < 1e-6);
        assert!((t.alt_day_earth_hours - 6.0).abs() < 1e-6);
        assert_eq!(t.hour, 8);
    }

    #[test]
    fn dilation_reports_solar_and_frequency_gains() {
        let decimal = ClockConfig {
            hours_per_day: 10,
            minutes_per_hour: 100,
            seconds_per_minute: 100,
            anchor_mode: AnchorMode::SolarLocked,
            custom_tick_hz: 1.0,
        };
        let rep = decimal.compute_dilation(EARTH_SECONDS_PER_DAY);
        assert_eq!(rep.odd_days, 1);
        assert!((rep.tick_delta - 13_600.0).abs() < 1e-6);
        assert!(rep.perceived_day_delta_seconds.abs() < 1e-6);

        let fast = ClockConfig {
            hours_per_day: 24,
            minutes_per_hour: 60,
            seconds_per_minute: 60,
            anchor_mode: AnchorMode::FrequencyLocked,
            custom_tick_hz: 2.0,
        };
        let rep_fast = fast.compute_dilation(EARTH_SECONDS_PER_DAY);
        assert_eq!(rep_fast.odd_days, 2);
        assert!((rep_fast.day_speed_factor - 2.0).abs() < 1e-6);
        assert!((rep_fast.perceived_day_delta_seconds - EARTH_SECONDS_PER_DAY).abs() < 1e-6);
    }
}
