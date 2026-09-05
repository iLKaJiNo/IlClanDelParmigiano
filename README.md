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

⚠️ **E il numero, da solo, non basta.** `cache.add()` passa per la cache HTTP del browser: con
un `max-age` come quello di Pages, il worker nuovo può farsi dare dal browser i file **vecchi** e
nascere con una cache che ha il nome nuovo e il contenuto vecchio. Per questo l'install chiede i
file con `cache: "reload"` (vedi `fresca()` in `sw.js`) — misurato il 05/09/2026: senza,
la cache `v57` conteneva l'`index.html` della `v56`.

**Dopo aver pubblicato, apri l'app una volta.** Si ricarica da sola: quando il service worker
nuovo prende il comando della scheda scatta `controllerchange`, e il blocco nel `<head>` di
`index.html` fa un ricaricamento una tantum. La seconda apertura la fa il browser al posto tuo.
Fra l'apertura e il ricaricamento passano dai 2 ai 10 secondi — **aspetta che sia successo prima
di concludere qualcosa**, e la riga in fondo all'admin te lo conferma con `↻ si è ricaricata da
sola N secondi fa`.

*Fino al 05/09/2026 qui c'era scritto «apri l'app due volte»: era una procedura manuale, e una
procedura manuale la fa chi se la ricorda. Aveva già fatto collaudare tre volte il deploy
sbagliato. Se dopo un deploy vedi ancora la schermata di ieri, guarda i due marcatori prima di
sospettare la modifica che hai appena fatto.*

### Quale versione sto guardando: la riga in fondo all'admin

**In fondo alla schermata admin ci sono due righe piccole**: la prima dice com'è andata
l'installazione della cache viva, la seconda **da quale indirizzo è aperta la pagina**. È il posto
dove si guarda quando una diagnosi comincia da *«ma è il codice giusto?»*, e si legge senza
entrare: c'è anche sulla schermata di accesso, sotto i due campi.

Il valore **non è una costante nel sorgente**: lo legge da `caches.keys()`, cioè dice **cosa il
service worker sta servendo**, non cosa c'è nei file. Sono due cose diverse ogni volta che si
pubblica, ed è esattamente la differenza che ha fatto collaudare più di una volta il deploy
precedente credendolo quello nuovo.

⚠️ **Un nome di cache, da solo, non è una prova.** Fino al 05/09/2026 questa riga mostrava il
nome e basta, e una cache **vuota** — quella che resta quando l'install fallisce — le sembrava una
versione come le altre. Sul telefono ha detto per giorni *«v51 — non ancora attiva su questa
scheda»*, che si legge *«fra un attimo si sistema»*, mentre il service worker non era mai
esistito: tre diagnosi sono partite di lì. Adesso la riga **apre la cache e guarda dentro**, e
legge l'esito che `sw.js` ci scrive alla fine dell'install.

Come si legge — prima riga:

| la riga dice | vuol dire |
|---|---|
| `clan-parmigiano-v11 — completa` | tutto a posto: la v11 è installata intera ed è quella che ti sta servendo |
| `… — completa, ma non ancora attiva su questa scheda` | l'install è riuscito, ma questa pagina è arrivata dalla rete: ricarica |
| `… — arrivata a metà: manca …` | l'app funziona, ma quei pezzi non sono in cache e li richiede alla rete a ogni apertura: **senza rete non ci sono** |
| `⚠️ installazione FALLITA — … è una cache vuota` | **non è una versione, è un rottame.** Il service worker non ce l'ha fatta: quel numero non dice quale versione stai usando, e senza rete l'app non si apre |
| `⚠️ … non dice com'è andata l'installazione` | cache di prima della v52, quando l'esito non si scriveva: non si può sapere se è intera |
| `⚠️ resta in giro anche «…v10» (20 file)` | c'è più di una cache. Il **numero fra parentesi** dice quale dei tre casi è: tante voci = una vecchia che `activate` non ha cancellato; `vuota` = un install fallito che ha lasciato il guscio; e se sparisce riaprendo, era davvero un aggiornamento in corso |
| `nessuna cache: … dalla rete` | nessun service worker attivo — normale dopo `/pulisci`, non normale sull'app installata |
| `aperta come file sul disco` | l'hai aperta con un `file://`: lì un service worker non può esistere. Serve un server, anche locale |

Seconda riga — **`pagina aperta da …`**: `…github.io` è GitHub Pages, `localhost:8777` il PC
via `serve-locale.py`, `127.0.0.1:22318` il telefono via CX Explorer, `file` un doppio clic
sulla cartella. Non è un dettaglio: questi ambienti si comportano in modo **diverso** proprio
sulle cache, e per quattro sessioni sono stati chiamati con lo stesso nome. La riga esiste per
rendere impossibile la domanda *«ma questa prova dove l'hai fatta?»*.

⚠️ **Dove NON si collauda niente che riguardi cache o service worker** — deciso il 05/09/2026,
dopo che due ambienti su tre avevano prodotto letture inconfrontabili:

- **doppio clic sulla cartella (`file://`)**: lì un service worker **non può esistere**. Qualunque
  cosa si osservi sulle cache, non riguarda l'app pubblicata.
- **CX Explorer sul telefono**: comodissimo per guardare grafica e testi al volo, e va benissimo
  per quello. Ma CX serve **tutto** da un solo indirizzo, `127.0.0.1:22318`, e cache e
  registrazioni stanno appese all'indirizzo, non alla cartella: su quell'origine si accumula la
  storia di ogni copia dell'app mai aperta da lì, comprese quelle di mesi fa. Ci si trovano cache
  vecchie che su `…github.io` non possono esistere. Ha già dato quello che aveva da dare — il 403
  sulla cartella nuda, che ha portato alla riparazione della v52.

Gli ambienti veri sono **Pages** (installata e non) e **`serve-locale.py`**.

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
