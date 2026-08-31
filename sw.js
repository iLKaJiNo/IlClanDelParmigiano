const CACHE_NAME = 'clan-parmigiano-v8';
// `logo-icona.svg` e `genera-icone.sh` NON stanno qui: sono sorgenti di build, non
// roba che il browser chiede. Nemmeno `serve-locale.py` e `.claude/launch.json`, che
// servono solo al collaudo in locale.
const ASSETS = [
  './', './index.html', './style.css',
  './utils.js', './api.js', './ui.js', './admin.js', './app.js',
  './manifest.json', './logo.svg',
  './tile-formaggio.svg', './topino.svg', './topo-monete.svg', './formaggio-arrivato.svg',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  './jspdf.umd.min.js', './pdf-assets.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:wght@600;700&display=swap'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  var u = e.request.url;
  if (u.includes('.supabase.co')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE_NAME).then(c => c.match(e.request).then(r => {
      var n = fetch(e.request).then(s => { if (s.status === 200) c.put(e.request, s.clone()); return s; }).catch(() => r);
      return r || n;
    }))
  );
});
