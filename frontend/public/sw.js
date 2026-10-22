const CACHE = "merabakil-pwa-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Never serve framework chunks from a service-worker fallback. Their names
  // change on every build, and a stale response turns into a ChunkLoadError.
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/")) return;

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
