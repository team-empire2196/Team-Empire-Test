// Team Empire service worker: network first (so new data always shows when online), cache fallback (so the app still opens offline).
const C = "te-v2", SHELL = ["./", "index.html", "fx.js", "updater.js", "logo.png", "icon-192.png", "icon-512.png", "manifest.webmanifest", "vendor/jszip.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match("index.html"))));
});
