/* STUDIOOS Focus · service worker della versione autonoma.
   Mette in cache solo i file dell'app (stessa origine). Le chiamate a Google non passano mai dalla cache.
   Pagine: rete prima (senza cache HTTP), copia locale se offline. File statici: copia locale subito e aggiornamento in background. */
const VERSION = "studioos-focus-202611150343";
const CORE = ["./", "./index.html", "./app.js", "./adapter.js", "./manifest.webmanifest", "./setup.html", "./setup.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-64.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" }))))); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("studioos-focus-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }
function pageKey(url) { const u = new URL(url); u.hash = ""; u.search = ""; return u.pathname.endsWith("/") ? u.href + "index.html" : u.href; }
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    const key = pageKey(req.url);
    e.respondWith(Promise.race([fetch(req.url, { cache: "no-cache", credentials: "same-origin" }), timeout(5000)]).then(r => {
      if (r && r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(key, c)); }
      return r;
    }).catch(() => caches.match(key).then(m => m || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.open(VERSION).then(cache => cache.match(req, { ignoreSearch: true }).then(m => {
    const net = fetch(req, { cache: "no-cache" }).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => m);
    if (m) { e.waitUntil(net); return m; }
    return net;
  })));
});
