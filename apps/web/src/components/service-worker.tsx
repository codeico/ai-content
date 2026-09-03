'use client';

import { useEffect } from 'react';

/**
 * Registers the app-shell service worker.
 *
 * Named ...Registrar because `ServiceWorker` is a built-in DOM interface and
 * shadowing it makes the JSX unusable as a component type.
 *
 * Registered from a client component after mount rather than in the document
 * head: a worker that installs during hydration competes with the page it is
 * meant to accelerate. Failure is silent by design - the app works fully
 * without it, and a console error would be noise for a progressive
 * enhancement.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Dev builds change output on every edit; a cached shell there would
    // serve stale chunks and look like a broken app.
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Registration can fail on unsupported browsers or blocked storage.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
