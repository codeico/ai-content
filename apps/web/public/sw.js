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
/*
 * Cache version.
 *
 * Bumped by hand, and that is a real hazard worth naming: forget it on a
 * release and a returning visitor keeps serving the previous release's chunks
 * from cache-first storage. Only people who visited before are affected,
 * which is why it goes unnoticed.
 *
 * What makes it survivable here rather than merely documented: nothing that
 * changes between releases is cached under a stable URL. Chunk filenames are
 * content-hashed, so new HTML asks for new filenames and a stale entry is
 * simply never requested again - it wastes a little storage instead of
 * serving wrong code. Navigations are network-first, so page HTML is never
 * stale. Only the four shell assets sit at stable paths, and of those, only
 * the icons and manifest could go out of date; a wrong icon is cosmetic.
 *
 * So the failure mode of forgetting is bounded to dead storage and a possibly
 * old icon. If a future change ever caches something mutable at a stable URL,
 * that stops being true and this constant becomes load-bearing.
 */
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const OFFLINE_URL = '/offline';

/** Identity-free assets. No HTML, no API responses, no RSC payloads. */
const SHELL_ASSETS = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

/*
 * On skipWaiting + clients.claim.
 *
 * Together these hand control of already-open tabs to a new worker
 * immediately, which raises the obvious question: can a claimed tab end up
 * running old JS against newly cached chunks?
 *
 * It cannot, and this was measured rather than assumed. Chunk filenames are
 * content-hashed: editing one client component and rebuilding produced
 * exactly one new filename out of seventeen, with the other sixteen
 * unchanged. Old HTML therefore requests the old filenames, which are either
 * still in the cache or still on the origin - it never asks for a name whose
 * contents moved underneath it. New HTML requests new names. The two sets do
 * not collide, so there is no version to skew.
 *
 * What skipWaiting does change is that an open tab starts being served by a
 * worker it did not install. That is safe here only because this worker
 * caches nothing mutable at a stable URL; if that ever stops being true,
 * skipWaiting becomes the thing that ships stale code to a live tab.
 */
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

/*
 * On cache priming by a signed-out visitor.
 *
 * Everything in this cache is identity-free by construction: four static
 * assets and content-hashed build output, none of which vary by user. So the
 * order in which they were fetched carries no information - a signed-out
 * visitor priming the cache leaves exactly what a signed-in one would.
 *
 * The offline page is the case worth stating explicitly, because it is the
 * only cached HTML. It is a static route that reads no cookies and touches no
 * database, so it renders identically for everyone. Verified in production:
 * the cached copy contains no email address and no workspace name.
 */
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
