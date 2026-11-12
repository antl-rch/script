import { useEffect, useRef } from 'react';
import { useToast } from '../../../hooks/index.ts';

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

async function readBuildSignature(): Promise<string | null> {
  try {
    const response = await fetch(`/_antl-build.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache'
      }
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const sha = typeof payload?.sha === 'string' ? payload.sha.trim() : '';
    const workflowRun = typeof payload?.workflowRun === 'string' ? payload.workflowRun.trim() : '';
    if (!sha && !workflowRun) {
      return null;
    }
    return `${sha}:${workflowRun}`;
  } catch {
    return null;
  }
}

export default function ServiceWorkerUpdateNotifier() {
  const { confirm } = useToast();
  const updatePromptedRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.MODE !== 'production') {
      return undefined;
    }

    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installingWorker: ServiceWorker | null = null;
    let initialBuildSignature: string | null = null;
    const hadController = Boolean(navigator.serviceWorker.controller);

    const notifyUpdate = async () => {
      if (disposed || updatePromptedRef.current) {
        return;
      }

      updatePromptedRef.current = true;
      const shouldReload = await confirm({
        type: 'info',
        title: 'Mise à jour disponible',
        message: 'Une nouvelle version du Script est disponible. Voulez-vous la charger maintenant ?',
        confirmText: 'Recharger',
        cancelText: 'Plus tard'
      });

      if (shouldReload && !disposed) {
        try {
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
          }
          registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          // Ignorer les erreurs de nettoyage de cache avant rechargement
        }
        window.location.reload();
      } else {
        updatePromptedRef.current = false;
      }
    };

    const attachInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) {
        return;
      }
      installingWorker?.removeEventListener('statechange', handleInstallingWorkerStateChange);
      installingWorker = worker;
      installingWorker.addEventListener('statechange', handleInstallingWorkerStateChange);
    };

    const handleInstallingWorkerStateChange = () => {
      if (!installingWorker) {
        return;
      }
      if (
        (installingWorker.state === 'installed' || installingWorker.state === 'activated') &&
        (hadController || Boolean(navigator.serviceWorker.controller))
      ) {
        void notifyUpdate();
      }
    };

    const handleUpdateFound = () => {
      attachInstallingWorker(registration?.installing ?? null);
    };

    const checkForUpdates = async () => {
      if (disposed || updatePromptedRef.current) {
        return;
      }
      try {
        await registration?.update();
        if (registration?.waiting && (hadController || Boolean(navigator.serviceWorker.controller))) {
          void notifyUpdate();
          return;
        }
      } catch {
        // Ignorer les erreurs réseau temporaires lors de la vérification du SW
      }

      const latestSignature = await readBuildSignature();
      if (!latestSignature) {
        return;
      }
      if (!initialBuildSignature) {
        initialBuildSignature = latestSignature;
        return;
      }
      if (latestSignature !== initialBuildSignature) {
        initialBuildSignature = latestSignature;
        void notifyUpdate();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    };

    const handleWindowFocus = () => {
      void checkForUpdates();
    };

    const registerServiceWorker = async () => {
      try {
        initialBuildSignature = await readBuildSignature();
        registration = await navigator.serviceWorker.register('/sw.js');
        registration.addEventListener('updatefound', handleUpdateFound);

        if (registration.waiting && (hadController || Boolean(navigator.serviceWorker.controller))) {
          void notifyUpdate();
        } else if (registration.installing) {
          attachInstallingWorker(registration.installing);
        }

        await checkForUpdates();
      } catch (registrationError) {
        console.error('SW registration failed:', registrationError);
      }
    };

    void registerServiceWorker();

    const intervalId = window.setInterval(() => {
      void checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      registration?.removeEventListener('updatefound', handleUpdateFound);
      installingWorker?.removeEventListener('statechange', handleInstallingWorkerStateChange);
    };
  }, [confirm]);

  return null;
}
