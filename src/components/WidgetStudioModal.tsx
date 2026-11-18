import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Code2, Copy, Download, Package, X } from 'lucide-react';
import {
  AlternateTimeSnapshot,
  ClockConfig,
  formatAlternateDigital,
  mixHex,
  normalizeHexColor,
  padClockUnit,
} from '../engine/clockEngine';
import {
  generateAndroidGlanceKotlin,
  generateAndroidProjectFiles,
  generateAndroidWidgetXml,
  generateAppleWidgetSwift,
} from '../engine/widgetCodeGen';
import { buildZipBlob } from '../utils/zipBuilder';
import { ThemeMode } from './ClockVisuals';
import { PWAInstallButton } from './PWAInstallButton';

interface WidgetStudioModalProps {
  open: boolean;
  onClose: () => void;
  config: ClockConfig;
  snapshot: AlternateTimeSnapshot;
  theme: ThemeMode;
}

type WidgetPlatformTab = 'apple-swift' | 'android-kotlin' | 'android-xml';

export const WidgetStudioModal: React.FC<WidgetStudioModalProps> = ({
  open,
  onClose,
  config,
  snapshot,
  theme,
}) => {
  const [activeTab, setActiveTab] = useState<WidgetPlatformTab>('apple-swift');
  const [copied, setCopied] = useState(false);
  const [showNativeCode, setShowNativeCode] = useState(false);

  const codeContent = useMemo(() => {
    if (activeTab === 'apple-swift') return generateAppleWidgetSwift(config, theme);
    if (activeTab === 'android-kotlin') return generateAndroidGlanceKotlin(config, theme);
    return generateAndroidWidgetXml();
  }, [activeTab, config, theme]);

  if (!open) return null;

  const fileNames: Record<WidgetPlatformTab, string> = {
    'apple-swift': 'OddClockWidget.swift',
    'android-kotlin': 'OddClockWidget.kt',
    'android-xml': 'oddclock_widget_info.xml',
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleDownload = () => {
    const blob = new Blob([codeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileNames[activeTab];
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAndroidProject = () => {
    const files = generateAndroidProjectFiles(config, theme);
    const blob = buildZipBlob(files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'OddClock-Android-Widget.zip';
    link.click();
    URL.revokeObjectURL(url);
  };

  const digital = formatAlternateDigital(snapshot, config);
  const dayCircumference = 2 * Math.PI * 26;
  const hourCircumference = 2 * Math.PI * 19;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 dark:bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="widget-studio-title"
    >
      <div className="w-full max-w-4xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="widget-studio-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Android &amp; Apple Widget Studio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live mobile widget previews, home-screen PWA install, and native WidgetKit / Glance code for your{' '}
              {config.hoursPerDay}h × {config.minutesPerHour}m × {config.secondsPerMinute}s clock
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Widget Studio"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* 1-Click Home Screen Install & Android APK Project Download */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-[#07090E] border border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  1-Click Web App Install
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pin OddClock directly to Android, iOS, or desktop as a standalone app.
                </p>
              </div>
              <PWAInstallButton />
            </div>

            <div className="flex flex-col justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-[#07090E] border border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Android Home-Screen Widget (.apk Project)
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Includes Jetpack Glance widget, Pin button, and GitHub Actions APK builder—upload to GitHub Actions or open in Android Studio to get your .apk.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadAndroidProject}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Package className="w-3.5 h-3.5" />
                Download Android APK Project (.zip)
              </button>
            </div>
          </div>

          {/* Live Side-by-Side Apple & Android Glassmorphism Widget Previews */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Apple WidgetKit Preview */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Apple WidgetKit Preview
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  iOS · macOS (Glass Material)
                </span>
              </div>
              <div className="relative overflow-hidden p-4 rounded-[28px] bg-gradient-to-br from-cyan-100/80 via-slate-100 to-amber-100/70 dark:from-[#0C1D2E] dark:via-[#0A0F1A] dark:to-[#1C1410]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-8 -left-8 w-32 h-32 rounded-full bg-cyan-400/35 dark:bg-cyan-500/25 blur-2xl"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-amber-400/35 dark:bg-amber-500/20 blur-2xl"
                />

                <div className="relative p-4 rounded-[22px] bg-white/55 dark:bg-white/[0.07] backdrop-blur-xl border border-white/75 dark:border-white/20 ring-1 ring-inset ring-white/50 dark:ring-white/10 shadow-lg flex items-center gap-4">
                  <svg viewBox="0 0 72 72" className="w-18 h-18 shrink-0">
                    <circle
                      cx="36"
                      cy="36"
                      r="26"
                      fill="none"
                      stroke={theme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.10)'}
                      strokeWidth="5"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r="26"
                      fill="none"
                      stroke={theme === 'dark' ? '#F59E0B' : '#D97706'}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${snapshot.dayPhase * dayCircumference} ${dayCircumference}`}
                      transform="rotate(-90 36 36)"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r="19"
                      fill="none"
                      stroke={
                        theme === 'dark'
                          ? mixHex(normalizeHexColor(config.accentColor), '#FFFFFF', 0.22)
                          : mixHex(normalizeHexColor(config.accentColor), '#0F172A', 0.18)
                      }
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={`${snapshot.hourPhase * hourCircumference} ${hourCircumference}`}
                      transform="rotate(-90 36 36)"
                    />
                    <text
                      x="36"
                      y="36"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="font-mono text-[13px] font-semibold"
                      fill={theme === 'dark' ? '#FBBF24' : '#B45309'}
                    >
                      {padClockUnit(snapshot.hour, config.hoursPerDay)}
                    </text>
                  </svg>

                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono tracking-wider text-slate-600 dark:text-slate-300/75">
                      ODDCLOCK
                    </div>
                    <div className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                      {digital}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-cyan-800 dark:text-cyan-300 mt-0.5 truncate">
                      {config.hoursPerDay}h · {config.minutesPerHour}m · {snapshot.tickHz.toFixed(3)} Hz
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Android Jetpack Glance Preview */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Android Glance Preview
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Translucent Glass (3×2 Cell)
                </span>
              </div>
              <div className="relative overflow-hidden p-4 rounded-[28px] bg-gradient-to-br from-amber-100/70 via-slate-100 to-cyan-100/80 dark:from-[#18121B] dark:via-[#0A111D] dark:to-[#0A1E29]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full bg-cyan-400/35 dark:bg-cyan-500/25 blur-2xl"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-amber-400/30 dark:bg-amber-500/20 blur-2xl"
                />

                <div className="relative p-3.5 rounded-[22px] bg-white/50 dark:bg-[#0B0F17]/55 backdrop-blur-xl border border-white/75 dark:border-white/15 ring-1 ring-inset ring-white/50 dark:ring-white/10 space-y-2 shadow-lg">
                  <div className="flex items-center justify-between px-1 text-[11px]">
                    <span className="font-medium text-slate-700 dark:text-slate-200">OddClock</span>
                    <span className="font-mono tabular-nums text-amber-800 dark:text-amber-300">
                      {Math.round(snapshot.dayPhase * 100)}% day
                    </span>
                  </div>
                  <div className="px-3.5 py-2.5 rounded-2xl bg-white/55 dark:bg-white/[0.06] border border-white/70 dark:border-white/12 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {digital}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-cyan-800 dark:text-cyan-300">
                        {config.hoursPerDay}h · {config.minutesPerHour}m · {snapshot.tickHz.toFixed(3)} Hz
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {snapshot.bpm.toFixed(0)} BPM
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-300">
                        {snapshot.nearestNote}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Native Developer Code (.swift / .kt) */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setShowNativeCode((s) => !s)}
              aria-expanded={showNativeCode}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090E] border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Native Developer Code (.swift / .kt)
              </span>
              {showNativeCode ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showNativeCode && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#07090E] border border-slate-200 dark:border-slate-800 rounded-lg">
                    {(
                      [
                        { id: 'apple-swift', label: 'Apple WidgetKit (.swift)' },
                        { id: 'android-kotlin', label: 'Android Glance (.kt)' },
                        { id: 'android-xml', label: 'Android Provider (.xml)' },
                      ] as { id: WidgetPlatformTab; label: string }[]
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeTab === tab.id
                            ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/25 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download {fileNames[activeTab]}
                    </button>
                  </div>
                </div>

                <pre className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07090E] overflow-auto max-h-72 text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-300">
                  <code>{codeContent}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
