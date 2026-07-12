// Campus Food Finder service worker — caches the static app shell (JS/CSS
// bundles, icons, manifest) for fast repeat loads. Deliberately does NOT
// cache navigation requests or API responses: listings must always be fetched
// live so "happening now" data never goes stale (see design-system/MASTER.md).

const CACHE_NAME = "cff-shell-v1";
const SHELL_CACHE_PATTERNS = [/^\/_next\/static\//, /^\/icons\//, /^\/manifest\.json$/];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  const isShellAsset = SHELL_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname));
  if (!isShellAsset) return; // let navigation/API requests hit the network untouched

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});
