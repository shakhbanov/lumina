import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS exposes a proprietary flag rather than the standard media query.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function usePwaInstall() {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Also reflect when the PWA is launched fresh in standalone mode.
    const mq = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = () => setInstalled(isStandalone());
    mq.addEventListener?.('change', onDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    platform,
    installed,
    canInstallNative: !!deferredPrompt,
    install,
  };
}
