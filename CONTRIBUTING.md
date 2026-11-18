# Contributing to OddClock

Thank you for helping push alternate horology forward! Whether you are proposing a new mathematical clock preset, tuning the Web Audio synthesizer, adding a visualizer mode, or extending the Rust/Android/Apple exports, this guide will get you set up fast.

---

## Development Setup

### Prerequisites
- **Node.js** `>= 20` and **npm**
- **Rust toolchain** (`cargo` & `rustc`) if editing [`src/engine/chronos_engine.rs`](src/engine/chronos_engine.rs)

### Local Run & Checks

```bash
# Install dependencies
npm install

# Start the Vite dev server on http://localhost:3000
npm run dev

# Run strict TypeScript type-checking
npm run lint

# Build production bundle + service worker
npm run build

# Run Rust horological kernel tests
cargo test --verbose
```

---

## Where to Contribute

- **Clock Presets**: Add mathematically interesting or historically grounded time divisions in `CLOCK_PRESETS` inside [`src/engine/clockEngine.ts`](src/engine/clockEngine.ts).
- **Visualizers**: Extend [`src/components/ClockVisuals.tsx`](src/components/ClockVisuals.tsx). Keep geometry strictly coupled to `snapshot` phases (`hourPhase`, `minutePhase`, `secondPhase`, `dayPhase`) and respect `config.accentColor`.
- **Rust Parity**: If you change core time-conversion math in `clockEngine.ts`, mirror the formula and add unit tests in [`src/engine/chronos_engine.rs`](src/engine/chronos_engine.rs).
- **Native Widgets**: Improve the Jetpack Glance Kotlin project or SwiftUI WidgetKit templates in [`src/engine/widgetCodeGen.ts`](src/engine/widgetCodeGen.ts).

---

## Pull Request Guidelines

1. Keep UI clean using Tailwind CSS utility classes (no inline `style={{}}` attributes).
2. Ensure `npm run lint` and `npm run build` pass cleanly with zero warnings or errors.
3. Update `cargo test` cases if touching `chronos_engine.rs`.
4. Include a shareable OddClock URL (`?h=...&m=...&s=...`) or screenshot when showcasing visual or preset changes.
