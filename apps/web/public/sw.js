/*
 * Service worker: app shell only.
 *
 * Deliberately narrow. This app is a thin client over Supabase where every
 * page is force-dynamic and authorisation is decided per request, so caching
 * HTML would risk serving one user's workspace to another. Only static assets
 * that carry no identity are cached, plus an offline fallback page.
 *
 * Navigations are network-first with an offline fallback: a stale shell that
 * shows nothing useful is worse than an honest "you are offline" screen.
 */
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const OFFLINE_URL = '/offline';

/** Identity-free assets. No HTML, no API responses, no RSC payloads. */
const SHELL_ASSETS = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll rejects the whole install if one asset 404s; individual puts
      // let the worker install even if an icon is renamed later.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache anything that depends on who is signed in.
  if (url.pathname.startsWith('/auth') || url.searchParams.has('_rsc')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return (
          cached ??
          new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        );
      }),
    );
    return;
  }

  // Immutable build output and public icons: cache-first is safe because the
  // filenames are content-hashed or the assets never carry user data.
  //
  // Deliberately '/_next/static/' and NOT '/_next/': the image optimiser lives
  // at /_next/image?url=... , is not content-hashed, and proxies whatever URL
  // it is given - including a signed or private one. Widening this prefix
  // would quietly make it cacheable.
  const isStatic = url.pathname.startsWith('/_next/static/') || SHELL_ASSETS.includes(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && isCacheable(response)) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

/**
 * Belt and braces on top of the path allowlist: never store a response the
 * origin itself marked as user-specific. If a future edit widens the
 * allowlist, these headers still keep a personalised response out of a shared
 * cache.
 */
function isCacheable(response) {
  const cacheControl = response.headers.get('Cache-Control') ?? '';

  if (/\bprivate\b|\bno-store\b/i.test(cacheControl)) return false;
  if (response.headers.has('Set-Cookie')) return false;

  // Vary: Cookie means the body depends on who asked.
  const vary = response.headers.get('Vary') ?? '';
  if (/cookie|authorization/i.test(vary)) return false;

  return true;
}
