/* STUDIOOS Focus · Ripasso · service worker della sola sezione (scope ./ripasso/).
   Rete prima, copia locale se offline: il ripasso funziona anche senza connessione dopo la prima apertura.
   Cache con prefisso proprio, così Focus (studioos-focus-*) non la cancella e questa non tocca quella di Focus. */
const VERSION = "studioos-ripasso-202611230100";
const CORE = ["./", "./index.html", "./ripasso.css", "./core.js", "./gen.js", "./bank.js", "./app.js", "../tokens.css", "../icons/favicon-64.png", "../icons/apple-touch-icon.png", "../manifest.webmanifest"];
const URLS = new Set(CORE.map(p => new URL(p, self.location.href).href));
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("studioos-ripasso-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  url.hash = ""; url.search = "";
  if (url.pathname.endsWith("/")) url.pathname += "index.html";
  const key = URLS.has(url.href) ? url.href : null;
  if (!key) return;
  const fromCache = () => caches.open(VERSION).then(c => c.match(key));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const fin = r => { if (!done && r) { done = true; resolve(r); } };
    const slow = setTimeout(() => fromCache().then(fin), 3500);
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
      clearTimeout(slow); fin(res);
    }).catch(() => fromCache().then(hit => { clearTimeout(slow); fin(hit || Response.error()); }));
  }));
});
