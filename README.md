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

Chi organizza ha in più un'area di **amministrazione**, in cui si entra con email e password, per
aprire e chiudere il
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

**Passa da `http://localhost:8777/pulisci` dopo ogni modifica, non solo a inizio sessione.** Non
è un vezzo: un normale `python3 -m http.server` lascia che il browser serva i `.js` della sessione
precedente, e soprattutto il service worker tiene una cache propria, cache-first, che nessun
header HTTP raggiunge. Il risultato è collaudare codice diverso da quello appena scritto, con
errori che non hanno alcun rapporto con il file che si sta leggendo. `serve-locale.py` risponde
`no-store` su tutto, e la pagina `/pulisci` deregistra i service worker e svuota le cache prima di
entrare nell'app. Lascia intatto `localStorage` — identità, tema e sblocchi restano — perché una
pulizia che cancella tutto diventa una pulizia che si salta.

⚠️ **Il punto è "dopo ogni modifica", ed è la parte che si sbaglia.** Il service worker **si
ri-registra al reload**: appena si ricarica la pagina è di nuovo lì e ricomincia a servire dalla
sua cache. Quindi non è un rito d'ingresso da fare una volta all'inizio — va rifatto ogni volta
che si tocca un file. E non c'è **nessun segnale** che avvisi: si modifica, si ricarica, e si sta
guardando la versione di prima. È esattamente il modo in cui si finisce a diagnosticare il file
sbagliato.

I dati sono quelli reali su Supabase, quindi occhio a cosa tocchi mentre provi.

## Pubblicare

L'hosting è GitHub Pages e non c'è nessun passaggio di build: si caricano i file.

**Prima di pubblicare, alza `CACHE_NAME` in `sw.js`** (`clan-parmigiano-v10` → `v11`, e così via).
È la riga che dice al service worker che quello che ha in cache è vecchio. Senza, chi ha l'app
installata in home continua a vedere la versione di prima, e non per qualche minuto.

**Dopo aver pubblicato, apri l'app due volte prima di concludere qualcosa.** Non è scaramanzia:
il service worker serve dalla cache e aggiorna in sottofondo (`return r || n` in `sw.js`). Alla
prima apertura la pagina è già stata servita dalla cache vecchia mentre il worker nuovo si
installava dietro; alla seconda il worker nuovo è al suo posto e i file sono quelli appena
pubblicati.

Non è un difetto da riparare — è il compromesso che fa funzionare l'app senza rete — ma è una
**procedura da sapere, non un sintomo da scoprire**: se dopo un deploy vedi ancora la schermata di
ieri, quasi sempre è questo e non la cosa che hai appena cambiato.

### Quale versione sto guardando: la riga in fondo all'admin

**In fondo alla schermata admin c'è una riga piccola con il nome della cache viva** — per esempio
`clan-parmigiano-v10`. È il posto dove si guarda quando una diagnosi comincia da *«ma è il codice
giusto?»*, e si legge senza entrare: c'è anche sulla schermata di accesso, sotto i due campi.

Il valore **non è una costante nel sorgente**: lo legge da `caches.keys()`, cioè dice **cosa il
service worker sta servendo**, non cosa c'è nei file. Sono due cose diverse ogni volta che si
pubblica, ed è esattamente la differenza che ha fatto collaudare più di una volta il deploy
precedente credendolo quello nuovo.

Come si legge:

| la riga dice | vuol dire |
|---|---|
| `clan-parmigiano-v10` | stai guardando la v10, ed è quella che ti sta servendo |
| `…v10 — non ancora attiva su questa scheda` | il worker è installato ma questa pagina è arrivata dalla rete: ricarica |
| `…v10 → …v11 — aggiornamento in corso` | il deploy nuovo è arrivato e si installa dietro: **chiudi e riapri**, poi rileggi la riga |
| `nessuna cache: … dalla rete` | nessun service worker attivo — normale dopo `/pulisci`, non normale sull'app installata |

**Dopo un deploy, la riga è il collaudo di sé stessa:** se mostra il numero nuovo, il marcatore
funziona *e* il deploy è arrivato, in un colpo solo.

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
