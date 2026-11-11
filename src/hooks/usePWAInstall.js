import { useEffect, useState } from 'react';

const DISMISS_KEY = 'hear-install-dismissed';

// Capture beforeinstallprompt globally before any component mounts
let deferredInstallPrompt = null;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyListeners();
  });
}

function checkIsStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function checkIsIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function usePWAInstall() {
  const [canPromptNatively, setCanPromptNatively] = useState(() => Boolean(deferredInstallPrompt));
  const [isInstalled, setIsInstalled] = useState(() => checkIsStandalone());
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = () => {
      setCanPromptNatively(Boolean(deferredInstallPrompt));
      setIsInstalled(checkIsStandalone());
    };
    listeners.add(sync);

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => setIsInstalled(checkIsStandalone());
    mediaQuery?.addEventListener?.('change', onDisplayChange);

    const onAppInstalled = () => {
      deferredInstallPrompt = null;
      setCanPromptNatively(false);
      setIsInstalled(true);
    };
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      listeners.delete(sync);
      mediaQuery?.removeEventListener?.('change', onDisplayChange);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredInstallPrompt) return 'unavailable';
    try {
      await deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredInstallPrompt = null;
        setCanPromptNatively(false);
        setIsInstalled(true);
      }
      return outcome;
    } catch (err) {
      console.warn('[PWAInstall] Prompt error:', err);
      return 'unavailable';
    }
  };

  const dismissPopup = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore storage quota / private mode failures
    }
  };

  return {
    isInstalled,
    canPromptNatively,
    isIOS: checkIsIOS(),
    isDismissed,
    promptInstall,
    dismissPopup,
  };
}

