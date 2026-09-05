// Il nome di questa cache è la VERSIONE VIVA dell'app: `aggiornaVersioneViva()` in
// admin.js lo legge da `caches.keys()` e lo mostra in fondo alla schermata admin.
// Se un giorno cambia il prefisso `clan-parmigiano-`, va cambiato anche là.
// ⚠️ Il suffisso del passo è TEMPORANEO (vedi "MARCATORE DI PASSO" in index.html):
// sale a ogni passo dell'handoff estetico, così il service worker riscarica TUTTI
// gli asset insieme invece di aggiornarli uno alla volta in sottofondo. A fine fase
// resta un normale `clan-parmigiano-vNN`.
const CACHE_NAME = 'clan-parmigiano-v56';

// ── DUE LISTE, E NON È PEDANTERIA ───────────────────────────────────────────
// `addAll` è tutto-o-niente: UN solo file che non si scarica e l'install intero viene
// buttato via, la registrazione con lui, e sul posto non resta niente tranne una cache
// VUOTA creata un istante prima da `caches.open()`.
//
// Non è teoria. Misurato il 05/09/2026 sul telefono: `'./'` — la cartella nuda — riceve
// 403 dal server interno di CX Explorer. Gli altri 21 file rispondevano 200. Per quel
// solo 403 il service worker su quel telefono non si è installato MAI: `register()`
// riusciva, l'install moriva in 160 ms, la registrazione spariva. E nessuno se ne
// accorgeva, perché l'unico segnale era un `console.log` che sul telefono non legge
// nessuno — mentre il marcatore in fondo all'admin diceva «v51 — non ancora attiva su
// questa scheda», che è la frase sbagliata: quella cache era un guscio vuoto.
//
// Quindi le liste sono due, e a dividerle è una domanda sola:
//   **senza questo file, l'app esiste ancora?**
//
// Sì per le icone, i disegni, il PDF, le due risorse esterne e perfino `'./'`. No per
// il guscio: pagina, foglio di stile, i cinque script. Quelli o entrano tutti o l'install
// deve fallire davvero, perché una cache col guscio a metà è peggio di nessuna cache.
const ESSENZIALI = [
  './index.html', './style.css',
  './utils.js', './api.js', './ui.js', './admin.js', './app.js'
];
// `logo-icona.svg` e `genera-icone.sh` NON stanno qui: sono sorgenti di build, non
// roba che il browser chiede. Nemmeno `serve-locale.py` e `.claude/launch.json`, che
// servono solo al collaudo in locale.
//
// `'./'` sta in questa lista e non fra gli essenziali: su GitHub Pages è l'indirizzo con
// cui l'app si apre davvero e va in cache, ma dove il server la rifiuta non deve poter
// affondare tutto il resto. Chi copre il caso in cui manchi è il ripiego in `fetch`.
const UTILI = [
  './',
  './manifest.json', './logo.svg',
  './tile-formaggio.svg', './topino.svg', './topo-monete.svg', './formaggio-arrivato.svg',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  './jspdf.umd.min.js', './pdf-assets.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:wght@600;700&display=swap'
];

// L'esito dell'install, scritto DENTRO la cache dell'app: così invecchia e sparisce
// insieme a lei, e `activate` non ha bisogno di sapere che esiste. Il prefisso non è
// `clan-parmigiano-`, quindi `aggiornaVersioneViva()` non la conta come una versione.
// Serve a una cosa sola, ed è la cosa che è mancata per giorni: **poter dire che un
// aggiornamento è arrivato monco, invece di lasciarlo credere completo.**
const ESITO_INSTALL = 'https://clan-parmigiano.local/esito-install';

function scriviEsito(c, mancati){
  return c.put(new Request(ESITO_INSTALL), new Response(JSON.stringify({
    versione: CACHE_NAME, quando: Date.now(), mancati: mancati
  }), { headers: { 'Content-Type': 'application/json' } })).catch(function(){});
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c =>
    // Il guscio: tutto-o-niente, e qui è giusto così.
    c.addAll(ESSENZIALI)
      // Il resto: uno per uno, così chi cade cade da solo. `c.add(u)` restituisce il
      // nome del file se fallisce, `null` se va bene: quello che resta è l'elenco dei
      // mancanti, ed è l'elenco che vogliamo poter leggere dopo.
      .then(() => Promise.all(UTILI.map(u => c.add(u).then(() => null, () => u))))
      .then(mancati => scriviEsito(c, mancati.filter(Boolean)))
  ).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // ⚠️ QUI QUALCUNO VORRÀ AGGIUNGERE `clients.claim()`. Non farlo, ed è già costata mezza
  // sessione la volta scorsa. L'idea è che serva a far prendere al worker nuovo il comando
  // delle schede aperte, e quindi a riparare R3. **Misurato il 05/09/2026, 3 prove su 3:
  // `controllerchange` scatta già senza, fra +1,6 e +2,1 s dall'apertura** — `skipWaiting()`
  // il comando delle schede GIÀ CONTROLLATE lo prende da solo.
  // `clients.claim()` serve alle schede che un controller non ce l'hanno: cioè il primissimo
  // ingresso, esattamente il caso in cui il ricaricamento una tantum in `index.html` deve
  // NON scattare. Aggiungerlo non ripara niente e alza la posta della guardia ②: da prudenza
  // diventerebbe l'unica cosa che impedisce all'app di lampeggiare in faccia a un topino
  // nuovo mentre gli si apre la guida davanti.
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  var u = e.request.url;
  if (u.includes('.supabase.co')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE_NAME).then(c => c.match(e.request).then(r => {
      // Il ripiego per la navigazione. Serve perché `'./'` può non essere in cache: dove
      // il server la rifiuta (403, il caso di CX) non ci entra, e chi apre la cartella
      // nuda invece di `index.html` si ritroverebbe con la pagina d'errore del server o
      // con niente. `index.html` è essenziale, quindi in cache c'è per forza.
      // Due strade, perché sono due guasti diversi: la rete che CADE (`catch`) e la rete
      // che RISPONDE MALE (`!s.ok`) — un 403 non fa fallire `fetch`, e la prima versione
      // di questa riga se lo lasciava sfuggire.
      var ripiego = () => e.request.mode === 'navigate' ? c.match('./index.html') : undefined;
      var n = fetch(e.request).then(s => {
        if (s.status === 200) c.put(e.request, s.clone());
        if (!s.ok) return Promise.resolve(ripiego()).then(f => f || s);
        return s;
      }).catch(() => r || ripiego());
      return r || n;
    }))
  );
});
