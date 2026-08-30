# 🧀 Il Clan del Parmigiano

Web app per gestire un **gruppo d'acquisto di parmigiano tra amici**: ognuno prenota i suoi
chili, la tabella si aggiorna per tutti in tempo reale, e alla fine i conti tornano da soli.

👉 **[Apri l'app](https://ilkajino.github.io/IlClanDelParmigiano/)**

È una PWA: dal browser del telefono puoi installarla in home come una app vera, e continua a
mostrare l'ultimo stato anche senza rete.

---

## Cosa fa

Le persone si registrano da sole scegliendo un nome, poi ordinano a step di mezzo chilo tra le
stagionature disponibili (12, 24, 36, 48 mesi). L'app è divisa in quattro schede:

| Scheda | A cosa serve |
|---|---|
| 🧀 **Ordina** | Scegli stagionatura e chili, con il totale stimato che si aggiorna mentre tocchi |
| 📋 **Tabella** | Chi ha ordinato cosa, i totali del gruppo, lo stato della spedizione |
| 📝 **Bacheca** | Note libere del gruppo e comunicazioni del negoziante |
| 💳 **Pagamenti** | Quanto devi davvero, come pagare (IBAN, PayPal, Satispay) e segnalazione del pagamento |

Chi organizza ha in più un'area di **amministrazione**, protetta da PIN, per aprire e chiudere il
ciclo d'ordine, fissare i prezzi al chilo, ripartire la spedizione, segnalare l'arrivo del pacco,
inserire i pesi e i prezzi **reali** pezzo per pezzo (le forme non escono mai esatte) e spuntare
chi ha pagato.

Da lì escono anche i due documenti che servono davvero fuori dall'app: l'**ordine per il
negoziante**, come testo aggregato per stagionatura da incollare in una email — senza nomi e
senza prezzi, che li fa lui — e il **riepilogo in PDF** da girare sul gruppo WhatsApp, che mostra
i conti attesi e, quando ci sono, quelli reali.

### Il conto è la parte seria

I chili prenotati sono una cosa, quelli che arrivano dal negoziante sono un'altra. L'app tiene
separati **nominale** e **reale**, e ricalcola le quote su ciò che è arrivato per davvero,
spedizione inclusa e ripartita solo tra chi partecipa.

Una regola sta scritta in tutto il codice: **nessun arrotondamento intermedio**. Si arrotonda a
due decimali solo per mostrare un numero a schermo, mai su un valore che poi rientra in un
calcolo. È il modo per non ritrovarsi con quei due centesimi che non tornano e che nessuno sa
spiegare.

---

## Stack

- **Frontend**: HTML, CSS e JavaScript vanilla. Nessun framework, nessun passaggio di build.
- **Backend**: [Supabase](https://supabase.com) (Postgres + API REST).
- **PDF**: [jsPDF](https://github.com/parallax/jsPDF), incluso nel repo invece che da CDN, così
  l'export funziona anche offline.
- **Hosting**: GitHub Pages.
- **PWA**: service worker con cache degli asset e manifest installabile.

## Struttura

```
index.html            markup dell'app e delle finestre modali
style.css             tutto il foglio di stile, tema topi & formaggio
utils.js              configurazione, formattazione, funzioni di calcolo
api.js                lettura e scrittura verso Supabase
ui.js                 rendering delle schede e interazione
admin.js              area amministrazione e generazione dei PDF
app.js                avvio dell'applicazione
sw.js                 service worker (cache offline)
manifest.json         manifest PWA
pdf-assets.js         immagini del banner dei PDF, in PNG base64
jspdf.umd.min.js      libreria jsPDF
genera-icone.sh       rigenera le icone PWA da logo-icona.svg (richiede ImageMagick)
serve-locale.py       server di sviluppo senza cache, con pagina /pulisci
```

I file si caricano in ordine — `utils` → `api` → `ui` → `admin` → `app` — e comunicano tramite
funzioni globali. È una scelta voluta: il progetto deve restare leggibile e modificabile
direttamente, senza toolchain da rimettere in piedi tra un anno.

## Provarla in locale

Serve un server, perché il service worker e il manifest non funzionano aprendo il file da disco:

```bash
python3 serve-locale.py
```

Poi apri `http://localhost:8777`.

**Prima di ogni collaudo passa da `http://localhost:8777/pulisci`.** Non è un vezzo: un normale
`python3 -m http.server` lascia che il browser serva i `.js` della sessione precedente, e
soprattutto il service worker tiene una cache propria, cache-first, che nessun header HTTP
raggiunge. Il risultato è collaudare codice diverso da quello appena scritto, con errori che non
hanno alcun rapporto con il file che si sta leggendo. `serve-locale.py` risponde `no-store` su
tutto, e la pagina `/pulisci` deregistra i service worker e svuota le cache prima di entrare
nell'app. Lascia intatto `localStorage` — identità, tema e sblocchi restano — perché una pulizia
che cancella tutto diventa una pulizia che si salta.

I dati sono quelli reali su Supabase, quindi occhio a cosa tocchi mentre provi.

## Icone

Le icone PWA si rigenerano dal logo vettoriale, così non ci sono PNG ridimensionati a mano:

```bash
./genera-icone.sh
```

---

## Note

La chiave Supabase presente nel codice è la chiave **anon**, quella pensata per stare nel client:
è pubblica per progetto, e gli accessi sono regolati lato server. Nessuna credenziale
amministrativa vive in questo repository.

Il tema grafico — topi, formaggio e toni caldi — è parte della stessa famiglia di
**[La Tana degli Orsi](https://github.com/iLKaJiNo/LaTanaDegliOrsi)** e **sPiccioli**, ma con
personalità propria.
