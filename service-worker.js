const CACHE = "medora-shell-v5-flex-plans";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./app.js",
  "./wall-integration.js",
  "./life-mind.css",
  "./planner-brain.js",
  "./planner-duration-patch.js",
  "./wall.html",
  "./wall.css",
  "./wall-config.js",
  "./wall.js",
  "./manifest.webmanifest",
  "./assets/medora-mark.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
    )
  );
});
