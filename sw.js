/* Service worker : rend l'arcade installable et l'ouvre même avec un réseau faible.
   Les pages et scripts du site sont pris sur le réseau en priorité (pour avoir toujours la dernière version),
   avec la copie en cache en secours. Les bibliothèques externes (3D, polices) sont gardées en cache. */
const CACHE = "arcade-v3";
const CORE = ["./", "index.html", "manifest.webmanifest", "firebase-config.js", "shared/games.js", "shared/online.js", "shared/app.js", "shared/lobby.js", "shared/neon.css", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match("index.html"))));
  } else if (/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|gstatic\.com\/firebasejs/.test(u.href)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok || res.type === "opaque") { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
  }
});
