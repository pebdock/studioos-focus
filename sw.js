/* STUDIOOS Focus · service worker della versione autonoma.
   Mette in cache solo i file dell'app (stessa origine). Le chiamate a Google non passano mai dalla cache.
   Ogni aggiornamento serve un pacchetto completo: HTML e script della stessa versione. */
const VERSION = "studioos-focus-202611161038";
const CORE = ["./", "./index.html", "./app.js", "./sync.js", "./progress.js", "./career.js", "./learning.js", "./learning-ui.js", "./learning.css", "./motion.js", "./navigation.js", "./refinement.css", "./interaction.css", "./ios.css", "./liquid.css", "./liquid.js", "./prerequisites.js", "./sections.js", "./release.js", "./adapter.js", "./picker-config.js", "./manifest.webmanifest", "./setup.html", "./setup.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-64.png"];
const CORE_URLS = new Set(CORE.map(path => new URL(path, self.location.href).href));
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" }))))); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("studioos-focus-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  url.hash = ""; url.search = "";
  if (url.pathname.endsWith("/")) url.pathname += "index.html";
  if (!CORE_URLS.has(url.href)) return;
  e.respondWith(caches.open(VERSION).then(async cache => (await cache.match(url.href)) || fetch(req)));
});


