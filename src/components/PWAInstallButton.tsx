import React, { useState } from 'react';
import { Download, ExternalLink, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  fullWidth?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ fullWidth = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const baseClass = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
    fullWidth ? 'w-full' : ''
  }`;

  // 1-click native browser install prompt (Android Chrome / Desktop Chrome / Edge)
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`${baseClass} bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm`}
      >
        <Download className="w-3.5 h-3.5" />
        Install OddClock
      </button>
    );
  }

  // Inside preview iframe: 1-click opens standalone browser tab where browser install prompt works
  if (isIframe) {
    const directUrl = typeof window !== 'undefined' ? window.location.href : '/';
    return (
      <a
        href={directUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClass} bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm`}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open &amp; Install Widget
      </a>
    );
  }

  // iOS Safari, Android fallback, or desktop browsers before prompt fires
  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`${baseClass} bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm`}
      >
        <Smartphone className="w-3.5 h-3.5" />
        {isIOS ? 'Add to Home Screen' : 'Install OddClock'}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-xl border border-slate-200 dark:border-white/15 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isIOS ? 'Add OddClock to Home Screen' : 'Install OddClock Widget'}
            </h3>
            {isIOS ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                1. Tap the <strong>Share</strong> button in Safari.
                <br />
                2. Tap <strong>Add to Home Screen</strong>.
              </p>
            ) : isAndroid ? (
              <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  1. Tap the <strong>⋮</strong> menu in Chrome.
                  <br />
                  2. Tap <strong>Add to home screen</strong> → <strong>Install</strong>.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Note: On private AI Studio preview URLs that require Google login, Android Chrome can only create a browser shortcut (which opens in Chrome). Deploy or share the app publicly to install as a standalone app without the browser bar.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Click the <strong>Install</strong> icon in your browser’s address bar (or browser menu →{' '}
                <strong>Install OddClock</strong>) to pin it as a standalone widget.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full rounded-xl bg-slate-100 dark:bg-white/10 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      Offline Mode — Running locally
    </div>
  );
};
