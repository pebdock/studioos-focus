/* STUDIOOS Focus · service worker della versione autonoma.
   Mette in cache solo i file dell'app (stessa origine). Le chiamate a Google non passano mai dalla cache. */
const VERSION = "studioos-focus-202611150326";
const CORE = ["./", "./index.html", "./app.js", "./adapter.js", "./manifest.webmanifest", "./setup.html", "./setup.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-64.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE))); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("studioos-focus-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(Promise.race([fetch(req), timeout(5000)]).then(r => {
      if (r && r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put("./index.html", c)); }
      return r;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(m => m || fetch(req).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
    return r;
  })));
});
