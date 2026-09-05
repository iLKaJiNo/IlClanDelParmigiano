// ════════════════════════════════════════════════════════
//  Il Clan del Parmigiano — admin.js
//  Accesso admin via email, pannello di amministrazione, archivio, PDF.
// ════════════════════════════════════════════════════════

function apriAdmin(){
  mostraSchermata("admin-screen");
  _faseAperta = null;   // riparte dalla fase dedotta dai dati, non da dove si era rimasti ieri
  if(eAdmin) renderAdmin();
  else       renderAccessoAdmin();
  aggiornaVersioneViva();   // non `await`: la riga arriva quando arriva, non blocca il pannello
}

// ── LA VERSIONE VIVA ────────────────────────────────────────────────────────
// Una riga in fondo alla schermata admin che dice QUALE VERSIONE STA SERVENDO il
// service worker. Non è un numero scritto a mano nel sorgente: quello direbbe
// "cosa c'è nei file", e la domanda vera è un'altra. Sono due cose diverse ogni
// volta che la PWA serve dalla cache e aggiorna in sottofondo, cioè sempre.
//
// Perché esiste: è costata tre diagnosi in due giorni. Un collaudo della vibrazione
// fatto sul deploy della #4 credendolo #5 (31/08, scoperto solo perché nello
// screenshot il bottone diceva ancora "nuovo topolino"); l'eredità dei prezzi data
// per rotta quando era semplicemente non pubblicata (01/09); e in mezzo più di una
// diagnosi che ha dovuto cominciare da "ma è il codice giusto?". Ogni volta la
// risposta è arrivata PER INDIZI, cioè per fortuna.
//
// Il valore viene da `caches.keys()` e non da una costante: il service worker
// cancella in `activate` ogni cache che non sia la sua, quindi il nome rimasto è
// quello che sta servendo davvero. Durante un aggiornamento se ne vedono due — la
// nuova già installata, la vecchia non ancora cancellata — e in quel caso la riga
// lo DICE invece di sceglierne una a caso: una riga che sceglie a caso è
// esattamente il difetto che questa riga esiste per togliere.
var PREFISSO_CACHE = "clan-parmigiano-";   // il resto del nome è la versione, e sta in sw.js

// L'esito dell'install, che `sw.js` scrive DENTRO la cache dell'app: versione, quando, e
// l'elenco dei file che non ce l'hanno fatta. È un indirizzo finto — nessun
// `clan-parmigiano.local` esiste — e serve solo come chiave.
// ⚠️ La stessa stringa sta in `sw.js` (`ESITO_INSTALL`). Sono due file che devono dire la
// stessa identica cosa: se cambia l'una senza l'altra, la riga qui sotto torna a non
// saper distinguere una versione viva da un rottame, che è il difetto che ha appena finito
// di costare quattro sessioni.
var URL_ESITO = "https://clan-parmigiano.local/esito-install";

// "clan-parmigiano-v10" → 10. Un nome che non finisce con un numero vale -1 e finisce
// in cima: non è un caso previsto, ma non deve far scomparire gli altri.
function numeroCache(nome){
  var m = /(\d+)$/.exec(nome);
  return m ? parseInt(m[1], 10) : -1;
}

async function aggiornaVersioneViva(){
  var el = document.getElementById("versione-viva");
  if(!el) return;
  el.textContent = (await rigaCache()) + "\n" + indirizzoPagina() + rigaRicaricamento();
}

// ── SI È RICARICATA DA SOLA? ────────────────────────────────────────────────
// Il ricaricamento una tantum di `index.html` (R3) dura due secondi e poi non lascia
// traccia: per collaudarlo bisognava fotografarlo mentre succedeva, cioè chiedere alla
// PERSONA di essere veloce invece che allo STRUMENTO di ricordare. È lo stesso errore del
// marcatore che non sapeva distinguere una cache vuota da una versione, in un'altra forma.
//
// L'ora del ricaricamento è già scritta: la mette la guardia ③ in `index.html` prima di
// chiamare `location.reload()`. Qui non si aggiunge nessun dato, si legge quello che c'è.
// Sta in `sessionStorage`, quindi vale per questa scheda e muore con lei: se la riga
// compare, l'app si è ricaricata da sola **in questa apertura**.
//
// ⚠️ Non è impalcatura da togliere a fine fase. Il giorno che qualcuno dirà «l'app mi ha
// lampeggiato», questa riga è l'unica cosa che potrà rispondere sì o no.
function rigaRicaricamento(){
  try{
    var quando = +(sessionStorage.getItem("clan_parm_ricarica") || 0);
    if(!quando) return "";
    var s = Math.round((Date.now() - quando) / 1000);
    var fa = s < 90 ? s + (s === 1 ? " secondo fa" : " secondi fa")
                    : Math.round(s / 60) + " minuti fa";
    // ⚠️ DUE NUMERI, E NON SONO LO STESSO. «dopo 2,1 s» è il RITARDO: quanto ha aspettato
    // dall'apertura prima di ricaricarsi, ed è l'unico che dice se può arrivare addosso a
    // chi sta scrivendo una nota. «5 secondi fa» è quanto tempo è passato da allora, e
    // dentro c'è anche il tempo che ci hai messo tu ad arrivare fin qui.
    // Il 05/09 la riga aveva solo il secondo e l'ho letto come se fosse il primo, scrivendo
    // in due documenti un rischio quattro volte più grande del vero. Il numero che serve
    // dev'esserci, non dedursi.
    var dopo = sessionStorage.getItem("clan_parm_ricarica_dopo");
    return "\n\u21bb si è ricaricata da sola"
         + (dopo ? " dopo " + String(dopo).replace(".", ",") + " s dall'apertura" : "")
         + " (" + fa + ")";
  }catch(e){ return ""; }   // navigazione privata: la riga non c'è, e non è un guasto
}

// La prima riga: com'è andata l'installazione. Sta in una funzione sua perché ha sei uscite
// e una sola di quelle è la buona: infilarle tutte dentro `aggiornaVersioneViva()` fra un
// `textContent` e l'altro era il modo per non accorgersi che una mancava.
async function rigaCache(){
  // ⚠️ Prima di tutto il resto: `file://`. Lì un service worker non PUÒ esistere — non è
  // un contesto sicuro — e `caches` o manca o solleva. Senza questa riga il caso finiva in
  // «nessuna cache: l'app sta arrivando dalla rete» oppure in «versione non leggibile su
  // questo browser»: due frasi che mandano a cercare un guasto dove non ce n'è.
  // È la stessa classe di errore del rottame letto come versione, e costa allo stesso modo.
  if(location.protocol === "file:")
    return "aperta come file sul disco: qui un service worker non può esistere, e nessuna "
         + "cache nemmeno. Non è un guasto dell'app, è l'indirizzo: serve un server, anche locale.";
  try{
    if(!("caches" in window)) return "versione non leggibile su questo browser";
    // Ordinate per NUMERO, non alfabeticamente: `sort()` senza comparatore metterebbe
    // "…-v10" prima di "…-v9" e la riga si leggerebbe al contrario proprio nel momento
    // in cui serve — durante un aggiornamento.
    var nostre = (await caches.keys())
      .filter(function(k){ return k.indexOf(PREFISSO_CACHE) === 0; })
      .sort(function(a, b){ return numeroCache(a) - numeroCache(b); });
    var controllata = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    if(!nostre.length)
      return "nessuna cache: l'app sta arrivando dalla rete, non dal service worker";
    if(nostre.length > 1){
      // ⚠️ QUI IL MARCATORE ERA ANCORA CIECO, e ci è costato un'altra fermata. Con due
      // cache diceva «vNN → vMM — aggiornamento in corso» e si fermava lì: non apriva
      // nessuna delle due. Ma DUE CACHE NON VUOL DIRE AGGIORNAMENTO. Vuol dire una di tre
      // cose, e sono tre cose diverse da fare:
      //   · la nuova si sta installando davvero        → aspetta, si sistema da sé
      //   · la vecchia non è mai stata cancellata      → `activate` non ha fatto il suo giro
      //   · l'install della nuova è fallito            → la nuova è un guscio vuoto
      // Il 05/09 su CX questa frase è uscita tre volte di fila, anche dopo una chiusura
      // vera dell'app, e non permetteva di distinguerle. È lo stesso difetto che il passo 1
      // esiste per togliere — tolto dal caso a una cache e lasciato in piedi in questo ramo.
      // ⚠️ La frase dice ancora «chiudi e riapri». Quando il ricaricamento diventa
      // automatico (R3 passo 2) va riscritta: chiedere un gesto non più necessario è
      // peggio che non dire niente.
      var viva = nostre[nostre.length - 1];   // la più alta di numero: `nostre` è ordinata
      var resti = [];
      for(var i = 0; i < nostre.length - 1; i++) resti.push(await quantaRoba(nostre[i]));
      return (await descriviCache(viva, controllata))
           + "\n⚠️ resta in giro anche " + elenco(resti) + ". Chiudi e riapri: se non "
           + "sparisce, non è un aggiornamento in corso — è un residuo che nessuno cancella.";
    }
    return await descriviCache(nostre[0], controllata);
  }catch(e){
    return "versione non leggibile su questo browser";
  }
}

// ── DOVE SEI ────────────────────────────────────────────────────────────────
// Metà della confusione di quattro sessioni nasce dall'aver chiamato con lo stesso nome
// tre ambienti che su questo difetto si comportano in modo DIVERSO: il telefono via CX
// (`127.0.0.1:22318`, con il suo 403 sulla cartella nuda), il PC via `serve-locale.py`
// (`192.168.x.x`), GitHub Pages (`…github.io`, con intestazioni di cache tutte sue).
// Le osservazioni dei lotti 4, 5 e 6 mescolano i tre, e la contraddizione fra loro
// sembrava intermittenza. Questa riga serve a rendere impossibile la domanda «ma questa
// prova dove l'hai fatta?», che è la domanda che nessuno si è fatto per quattro sessioni.
//
// `file://` non ha host: lì il protocollo È la risposta, perché un service worker non può
// esistere e nessun'altra riga della schermata lo spiegherebbe.
function indirizzoPagina(){
  return "pagina aperta da " + (location.host || location.protocol.replace(":", ""));
}

// I nomi dei file come li direbbe una persona. L'elenco dei mancanti arriva da `sw.js` e
// contiene INDIRIZZI: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/…" non dice
// niente a chi legge, e questa riga esiste per essere letta da chi collauda, non da chi
// l'ha scritta. Un indirizzo che non riconosciamo esce col suo nome di file: meglio un
// nome brutto che nessun nome.
function nomeUmano(u){
  if(u === "./")                          return "l'indirizzo corto dell'app";
  if(u.indexOf("supabase") >= 0)          return "il collegamento al database";
  if(u.indexOf("fonts.googleapis") >= 0)  return "i caratteri";
  if(u.indexOf("jspdf") >= 0)             return "il generatore dei PDF";
  return u.replace(/^\.\//, "").replace(/^.*\//, "");
}

// Quanta roba c'è DENTRO una cache che non è quella viva, detta di fila in una frase.
// Una cache vecchia piena è un residuo di `activate`; una vuota è un install fallito. Il
// numero è la differenza fra le due, e senza il numero la frase non serve a niente.
async function quantaRoba(nome){
  var c = await caches.open(nome);
  var n = (await c.keys()).filter(function(r){ return r.url !== URL_ESITO; }).length;
  return "«" + nome + "» (" + (n ? n + " file" : "vuota") + ")";
}

// "a, b e c" — perché "a, b, c" in mezzo a una frase si legge come se la frase continuasse.
function elenco(a){
  return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " e " + a[a.length - 1];
}

// ── COSA C'È DAVVERO DENTRO QUELLA CACHE ────────────────────────────────────
// Il nome della cache dice solo che QUALCUNO ha chiamato `caches.open()`. Non dice se
// l'install è finito, e nemmeno se dentro c'è un file. Da qui in avanti la riga apre la
// cache e guarda: quante voci ha, e cosa dice l'esito che `sw.js` ci scrive dentro.
async function descriviCache(nome, controllata){
  var c = await caches.open(nome);   // esiste già: il nome arriva da `caches.keys()`
  var voci = (await c.keys()).filter(function(r){ return r.url !== URL_ESITO; }).length;
  var esito = null;
  var r = await c.match(URL_ESITO);
  if(r) try{ esito = await r.json(); }catch(e){}

  // ⚠️ IL CASO CHE CI HA INGANNATI PER GIORNI, e il motivo per cui esiste questa
  // riparazione. Una cache vuota, a `caches.keys()`, sembra una cache: fino al 05/09
  // qui si leggeva «clan-parmigiano-v51 — non ancora attiva su questa scheda», cioè
  // «fra un attimo si sistema», mentre la verità era «il service worker non è mai
  // esistito e quella è un guscio vuoto». Tre diagnosi sono partite di lì.
  // Il numero NON viene per primo, ed è deliberato: letto per primo, quel numero è la
  // bugia. Prima si dice che è fallito, poi si dice come si chiama il rottame.
  if(!voci)
    return "⚠️ installazione FALLITA — «" + nome + "» è una cache vuota, "
         + "non una versione. Il service worker non ce l'ha fatta: l'app sta arrivando tutta "
         + "dalla rete, senza rete non si apre, e quel numero non dice quale versione stai usando.";

  // Una cache piena ma senza esito è roba di prima della v52, quando l'esito non si
  // scriveva. Non è un rottame, ma non si può nemmeno dire che sia intera: e una riga che
  // non sa non deve fingere di sapere.
  if(!esito)
    return "⚠️ «" + nome + "» non dice com'è andata l'installazione: è una "
         + "cache di prima della v52. Non si può sapere se è arrivata intera — "
         + "il prossimo aggiornamento la sostituisce.";

  var mancati = (esito.mancati || []).map(nomeUmano);
  if(mancati.length){
    // L'accordo si fa a mano perché il caso di UN solo mancante è il più frequente: il
    // 05/09 su CX il mancante era uno, `'./'`. Una frase al plurale su un file solo si
    // legge come una frase scritta da un programma, e una riga che sembra scritta da un
    // programma non la legge nessuno.
    var uno = mancati.length === 1;
    return nome + " — arrivata a metà: " + (uno ? "manca " : "mancano ") + elenco(mancati)
         + ". L'app funziona lo stesso, ma " + (uno ? "quel pezzo lo richiede" : "quei pezzi li richiede")
         + " alla rete a ogni apertura: " + (uno ? "senza rete non c'è." : "senza rete non ci sono.");
  }

  // Tutto a posto. Qui la riga resta asciutta: una parola sola oltre al nome, che serve a
  // sapere che l'esito è stato letto davvero e non che manca il codice per leggerlo.
  // Senza controller la frase adesso è onesta: l'esito c'è, quindi l'install È riuscito e
  // «non ancora attiva» vuol dire davvero «fra un attimo».
  return nome + " — completa" + (controllata ? "" : ", ma non ancora attiva su questa scheda");
}
function chiudiAdmin(){
  mostraSchermataGiusta();
}

// ── ACCESSO ADMIN: EMAIL + PASSWORD ──
// Ha preso il posto del PIN, che non è diventato un secondo lucchetto: è stato smontato.
// Il PIN stava su UN dispositivo e chi lo sapeva lo sapeva per sempre; l'email autorizza
// una PERSONA, la segue su telefono e computer, e si toglie da un elenco.
// Una schermata sola, perché non c'è più niente da aspettare: la variante col codice via
// email è stata abbandonata quando si è visto che senza un SMTP proprio Supabase quel
// codice lo manda solo al proprietario del progetto (vedi `accediConPassword` in api.js).
// `_emailAccesso` sopravvive a un tentativo fallito perché ridigitare l'indirizzo è
// l'unico modo per sbagliarlo dopo averlo già scritto giusto.
var _emailAccesso = "";

function renderAccessoAdmin(){
  var el = document.getElementById("admin-content");
  el.innerHTML = '<div class="card">'
    + '<div style="text-align:center;font-size:3rem;">\uD83E\uDDC0</div>'
    + '<div class="card-titolo" style="text-align:center;">Area amministrazione</div>'
    + '<div class="hint">Email e password di amministratore. Non è una cosa che puoi darti '
    +   'da solo: te le crea chi amministra già.</div>'
    + '<div class="m-row"><label>Email</label>'
    +   '<input class="inp" id="acc-email" name="email-admin" type="email" inputmode="email"'
    +   ' autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"'
    +   ' value="' + escapeHtml(_emailAccesso) + '"'
    +   ' onkeydown="if(event.key===\'Enter\')document.getElementById(\'acc-password\').focus()"></div>'
    + '<div class="m-row"><label>Password</label>'
    +   '<input class="inp" id="acc-password" name="password-admin" type="password"'
    +   ' autocomplete="current-password"'
    +   ' onkeydown="if(event.key===\'Enter\')entraDaAdmin()"></div>'
    + '<div class="errore" id="acc-errore"></div>'
    + '<button class="btn btn-cheese" id="acc-entra" onclick="entraDaAdmin()">\uD83D\uDD10 Entra</button>'
    + '<button class="btn btn-ghost" style="margin-top:8px;" onclick="chiudiAdmin()">\u2190 Torna indietro</button>'
    + '</div>';
  var campo = document.getElementById(_emailAccesso ? "acc-password" : "acc-email");
  if(campo) campo.focus();
}

// La password giusta apre la PORTA, non la stanza: l'utente Supabase e l'autorizzazione ad
// amministrare sono due cose distinte, e la seconda vive in `admin_autorizzati`. Chi entra
// senza esserci dentro viene fatto uscire subito — ma DOPO avergli detto perché, altrimenti
// un accesso riuscito che rimbalza in silenzio si legge come "l'app è rotta" e non come
// "non sei autorizzato". È il caso che capiterà davvero la prima volta che qualcuno prova
// prima di essere stato aggiunto.
async function entraDaAdmin(){
  var err = document.getElementById("acc-errore");
  var email = normalizzaEmail(document.getElementById("acc-email").value);
  var password = document.getElementById("acc-password").value;
  if(!emailValida(email)){ err.textContent = "Questo non sembra un indirizzo email."; return; }
  if(!password){ err.textContent = "Manca la password."; return; }
  var btn = document.getElementById("acc-entra");
  err.textContent = "";
  if(btn){ btn.disabled = true; btn.textContent = "Verifico\u2026"; }
  try{
    await accediConPassword(email, password);
  }catch(e){
    if(btn){ btn.disabled = false; btn.textContent = "\uD83D\uDD10 Entra"; }
    _emailAccesso = email;
    err.textContent = messaggioAuth(e);
    return;
  }
  await aggiornaEAdmin();
  if(!eAdmin){
    await esciDaAdmin();
    _emailAccesso = email;
    renderAccessoAdmin();
    document.getElementById("acc-errore").textContent =
      "Questa email non è fra quelle autorizzate. Chiedi a un admin di aggiungerla.";
    return;
  }
  _emailAccesso = "";
  await caricaTutto();
  renderAdmin();
  dot("ok", "Sei dentro \uD83D\uDD10");
  proponiFlagAdmin();
}

// UN messaggio solo per "email sconosciuta" e "password sbagliata": sono la stessa
// credenziale vista da due lati, e distinguerle direbbe a chi prova quali indirizzi
// esistono. Supabase le restituisce già indistinguibili, e questa riga lo mantiene.
//
// "Email non confermata" resta invece DISTINTO, e si può perché è stato MISURATO — non
// dedotto. Prova del 01/09/2026 su un utente non confermato creato apposta e poi
// eliminato, chiamando `/auth/v1/token?grant_type=password`:
//
//   password sbagliata  -> invalid_credentials   (identico a un'email inesistente)
//   password giusta     -> email_not_confirmed
//
// Cioè quel messaggio lo vede SOLO chi ha già dimostrato di conoscere la password: non
// rivela niente che chi lo legge non sappia già, e non serve a enumerare gli indirizzi.
// La regola che ne esce, buona oltre questo caso: un messaggio d'errore può essere
// distinto quando compare solo a chi ha già superato la verifica; se compare prima,
// distingue per chi non ha diritto di sapere.
//
// E vale la pena tenerlo, perché è esattamente ciò che succede dimenticando l'`auto
// confirm` in dashboard: senza una frase che lo dica si passa un'ora a ridigitare una
// password che era giusta dall'inizio.
function messaggioAuth(e){
  var m = (e && e.message) ? String(e.message) : "Errore sconosciuto";
  if(/not confirmed/i.test(m))
    return "L'utente esiste ma la sua email non è confermata. In dashboard Supabase, "
         + "Authentication \u2192 Users: confermala, oppure ricrea l'utente con "
         + "\u201cauto confirm\u201d acceso.";
  if(/invalid login|invalid credentials|bad_credentials/i.test(m))
    return "Email o password non corrette.";
  if(/rate|too many|seconds/i.test(m))
    return "Troppi tentativi ravvicinati. Aspetta un minuto e riprova.";
  return m;
}

// Uscire non è più il "blocca" di prima, che costava un tocco e si riapriva col PIN:
// qui la sessione se ne va davvero, e per rientrare si ridigitano email e password. Per
// questo si conferma — e per questo il bottone dice "Esci" e non "Blocca".
async function esciAdmin(){
  if(!confirm("Esco dall'amministrazione su questo dispositivo?\n\n"
      + "Per rientrare ti serviranno di nuovo email e password.")) return;
  await esciDaAdmin();
  _emailAccesso = "";
  chiudiAdmin();
}

// `persone` è per-gruppo, quindi il flag va rimesso a ogni nuovo giro: un passaggio manuale
// da rifare ogni volta è un passaggio da dimenticare. Si propone da solo qui, che è l'unico
// momento in cui l'app sa con certezza che chi ha in mano il telefono è l'admin — prima era
// lo sblocco del PIN, adesso è il primo accesso con l'email. È l'unico pezzo del PIN che non
// si butta.
// Il "no" si ricorda per gruppo, come la × dell'invito all'installazione: una domanda che
// ritorna a ogni accesso viene chiusa senza leggerla.
function chiaveNoAdmin(){ return "clan_parm_no_admin_" + (gruppo ? gruppo.id : "none"); }
async function proponiFlagAdmin(){
  if(!gruppo || !mioId) return;
  var io = persone.find(function(x){ return x.id === mioId; });
  if(!io || io.is_admin) return;
  try{ if(localStorage.getItem(chiaveNoAdmin()) === "1") return; }catch(e){}
  if(!confirm("Sei entrato come admin e sei registrato come " + io.nome
      + ".\n\nTi segno come admin del gruppo, cos\u00ec gli altri sanno a chi chiedere?")){
    try{ localStorage.setItem(chiaveNoAdmin(), "1"); }catch(e){}
    return;
  }
  try{
    await setIsAdmin(io.id, true);
    await caricaTutto(); renderAdmin();
    dot("ok", "Segnato come admin \uD83D\uDC2D");
  }catch(e){ alert("Errore: " + e.message); }
}

// ── PANNELLO ADMIN: FISARMONICA A FASI ──
// Prima erano tredici card sempre tutte aperte, nell'ordine in cui erano state scritte:
// in piena raccolta ordini si scorreva sopra la quadratura dello scontrino, che serve
// due settimane dopo. La fase si DEDUCE dai dati — nessuna colonna, nessuna migrazione,
// niente stato da tenere allineato: se i dati dicono che i prezzi reali ci sono tutti e
// non c'è più nulla da incassare, la fase È 6, comunque ci si sia arrivati.
// Le fasi passate restano toccabili e si riaprono (la spedizione si corregge, i prezzi si
// ritoccano, gli ordini si riaprono); le future sono visibili ma chiuse.
function faseCorrente(){
  var conRighe   = righe.length > 0;
  var reali      = righe.filter(function(r){ return r.prezzo_reale != null; }).length;
  var tuttiReali = conRighe && reali === righe.length;
  var daIncassare = persone.some(function(p){ return !p.pagato && righeDi(p.id).length; });
  if(tuttiReali && !daIncassare) return 6;   // chiudo
  if(tuttiReali)                 return 5;   // incasso
  if(reali > 0)                  return 4;   // consegno
  if(arrivoSegnalato())          return 4;
  if(ordiniChiusi())             return 3;   // aspetto il negoziante
  if(conRighe)                   return 2;   // raccolgo
  return 1;                                  // preparo
}

var FASI = [
  { n: 1, titolo: "Preparo il gruppo",
    tocca: "Metti i prezzi al kg e la spedizione, poi gira il link e la password sul gruppo WhatsApp." },
  { n: 2, titolo: "Raccolgo gli ordini",
    tocca: "Lascia ordinare i topini. Quando sei pronto, copia l'ordine e mandalo al negoziante." },
  { n: 3, titolo: "Aspetto il negoziante",
    tocca: "Scrivi il totale della fattura appena il negoziante te lo manda." },
  { n: 4, titolo: "Consegno",
    tocca: "Apri un sacchetto per volta e batti gli importi letti dalle etichette." },
  { n: 5, titolo: "Incasso",
    tocca: "Conferma i pagamenti man mano che arrivano, e ricorda a chi manca." },
  { n: 6, titolo: "Chiudo",
    tocca: "Manda il PDF di riepilogo al gruppo e archivia questo giro." }
];
var CERCHIATI = ["①","②","③","④","⑤","⑥"];

// `null` = "segui i dati". Appena l'admin tocca una fase a mano comanda la sua scelta,
// altrimenti a ogni ridisegno si riaprirebbe da sola quella dedotta e non si potrebbe
// tornare indietro a correggere qualcosa.
var _faseAperta = null;
function faseAperta(){ return _faseAperta != null ? _faseAperta : faseCorrente(); }
function toggleFase(n){
  vibra(10);
  var apre = faseAperta() !== n;
  _faseAperta = apre ? n : 0;                   // 0 = tutte chiuse, e resta una scelta esplicita
  renderAdmin();
  // Solo in apertura. `renderAdmin()` riscrive tutto l'HTML: la pagina si accorcia o si
  // allunga SOPRA il punto in cui si sta guardando, ma lo scorrimento resta fermo in pixel
  // assoluti, e la vista finisce più in basso della fase appena aperta. Si porta in cima
  // l'intestazione, come fa `vaiAFase()` con la sua card; i 60 ms sono lì per lo stesso
  // motivo: `renderAdmin()` deve aver finito di scrivere il DOM. In chiusura non si muove
  // niente — non c'è nessun bersaglio da guardare.
  if(!apre) return;
  setTimeout(function(){
    var t = document.getElementById("fase-testa-" + n);
    if(!t) return;
    // `scrollIntoView({block:"start"})` la porterebbe al bordo della finestra, cioè dietro
    // `.top`, che sta appiccicato lì sopra. Il franco si misura sull'header vero invece di
    // ricopiarne l'altezza a mano: cambia con la safe-area del telefono.
    var testa = document.querySelector("#admin-screen .top");
    var franco = (testa ? testa.getBoundingClientRect().height : 0) + 8;
    window.scrollTo({
      top: Math.max(0, window.pageYOffset + t.getBoundingClientRect().top - franco),
      behavior: "smooth"
    });
  }, 60);
}
// Rimanda a una card che vive in un'altra fase: la apre e ci porta sopra, invece di
// duplicare il campo in due posti (due input sulla stessa colonna si desincronizzano
// al primo salvataggio parziale).
function vaiAFase(n, cardId){
  _faseAperta = n;
  renderAdmin();
  setTimeout(function(){
    var c = document.getElementById(cardId);
    if(!c) return;
    c.scrollIntoView({ behavior: "smooth", block: "center" });
    c.classList.add("evidenzia");
  }, 60);
}
function vaiAiPrezzi(){ vaiAFase(1, "card-prezzi"); }
function vaiAlloScontrino(){ vaiAFase(3, "card-scontrino"); }

// La pillola «← admin» nell'header: c'è un passo indietro da fare, o no?
// Un punto solo che la tocca, così non può restare accesa su una schermata che non ha
// nessun passo indietro — che è il modo in cui i bottoni di navigazione mentono.
function mostraTornaAdmin(on){
  var b = document.getElementById("btn-torna-admin");
  if(b) b.style.display = on ? "" : "none";
}

function renderAdmin(){
  mostraTornaAdmin(false);
  var el = document.getElementById("admin-content");
  if(!gruppo){
    el.innerHTML = '<div class="card"><div class="card-titolo">Nessun gruppo attivo</div>'
      + '<p class="card-nota">Crea il primo gruppo d\'acquisto per iniziare.</p>'
      + '<button class="btn btn-cheese" onclick="apriNuovoGruppo()">🧀 Crea nuovo gruppo</button></div>'
      + renderArchivioHtml();
    return;
  }

  var corrente = faseCorrente();
  var aperta = faseAperta();
  var corpi = {
    1: cardGruppoHtml() + cardPrezziHtml() + cardSpedizionePersoneHtml() + cardScadenzaHtml() + cardMessaggiHtml(),
    2: cardKgPerTipoHtml() + renderNegozianteHtml() + cardChiusuraHtml(),
    3: renderScontrinoHtml() + cardArrivoHtml(),
    4: cardConsegnaHtml() + renderQuadraturaHtml(),
    5: renderDaConfermareHtml() + renderRiepilogoHtml() + cardTopoliniHtml() + cardCoordinateHtml(),
    6: cardPdfHtml() + cardArchiviaHtml()
  };

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    + '<h2 style="color:var(--cheese-txt);">🧀 Admin</h2>'
    + '<button class="btn-pill" onclick="esciAdmin()">🚪 Esci</button></div>';

  html += bannerSegnalazioniHtml();
  html += fasiTestaHtml(corrente);

  html += FASI.map(function(f){
    var cls = "fase" + (f.n === aperta ? " aperta" : "") + (f.n === corrente ? " corrente" : "");
    return '<div class="' + cls + '">'
      + '<button class="fase-testa" id="fase-testa-' + f.n + '" onclick="toggleFase(' + f.n + ')" aria-expanded="' + (f.n === aperta) + '">'
      +   '<span class="fase-num">' + f.n + '</span>'
      +   '<span>' + escapeHtml(f.titolo) + '</span>'
      +   '<span class="fase-freccia">›</span>'
      + '</button>'
      + '<div class="fase-corpo">' + corpi[f.n] + '</div>'
      + '</div>';
  }).join("");

  // Fuori dalla fisarmonica: non appartengono a nessuna fase del giro.
  html += cardAmministratoriHtml();
  html += renderArchivioHtml();

  el.innerHTML = html;
  // La textarea si misura sul contenuto, e una misura presa mentre è chiusa vale zero.
  if(aperta === 2) notaAuto(document.getElementById("inp-note-negoziante"));
}

// Banner in cima, SOPRA la fisarmonica. La riga "Tocca a te" già lo dice, ma lo dice in
// mezzo a una frase da leggere: un banner colorato in cima si vede senza leggere, ed è la
// prima cosa che incontra chi apre l'admin proprio perché ha visto il pallino sul 🔐.
// Il numero è lo stesso di `segnalazioniInAttesa()`: quando la coda si svuota sparisce.
function bannerSegnalazioniHtml(){
  var n = segnalazioniInAttesa().length;
  if(!n) return "";
  return '<button class="banner-segnalazioni" onclick="toggleFase(5)">'
    + '<span class="bs-ico">⏳</span>'
    + '<span><b>' + n + (n === 1 ? ' topino ha' : ' topini hanno') + ' segnalato un pagamento</b>'
    + '<span class="bs-sub">Tocca per verificare e confermare nella fase ⑤</span></span>'
    + '<span class="bs-freccia">›</span></button>';
}

// La riga che dice cosa tocca adesso. È la cosa che si guarda ogni volta che si apre
// l'admin: la striscia dice a che punto è il giro, la frase dice cosa fare oggi.
function fasiTestaHtml(corrente){
  var h = '<div class="fasi-testa"><div class="fasi-striscia">';
  FASI.forEach(function(f, i){
    if(i) h += '<span class="fs-linea"></span>';
    var cls = "fs-passo" + (f.n === corrente ? " ora" : (f.n < corrente ? " fatto" : ""));
    h += '<button class="' + cls + '" onclick="toggleFase(' + f.n + ')" title="' + escapeHtml(f.titolo) + '"'
      + ' aria-label="Fase ' + f.n + ': ' + escapeHtml(f.titolo) + '">' + CERCHIATI[i] + '</button>';
  });
  h += '</div>';

  // Solo l'azione normale della fase corrente. La riga sulle segnalazioni in attesa
  // stava qui, ed è stata tolta quando è arrivato il banner qui sopra: due copie della
  // stessa frase a un centimetro non sono un avviso più forte, sono un avviso che si
  // legge una volta e la seconda si salta. Quel che resta sono due informazioni
  // DIVERSE impilate — il banner dice cosa è arrivato, questa riga cosa fare oggi —
  // e per questo la riga non deve mai restare vuota: `f.tocca` c'è per ogni fase.
  var f = FASI[corrente - 1];
  h += '<div class="fasi-tocca"><b>Tocca a te</b>' + escapeHtml(f.tocca);
  h += '</div></div>';
  return h;
}

// ── FASE 1: preparo il gruppo ──
function cardGruppoHtml(){
  var haPassword = !!passwordGruppoHash();
  return '<div class="card"><div class="card-titolo">Gruppo attivo</div>'
    + '<div class="m-row"><label>Titolo</label><div style="font-weight:800;">' + escapeHtml(gruppo.titolo) + '</div></div>'
    + '<div class="m-row"><label>Password d\'accesso</label>'
    + '<input class="inp" id="inp-password" name="chiave-gruppo-admin" type="text"'
    +   ' autocapitalize="none" autocorrect="off"'
    +   ' spellcheck="false" autocomplete="off" placeholder="'
    +   (haPassword ? "scrivi qui la nuova password" : "es. topogrigio26") + '"></div>'
    + '<div class="hint">' + (haPassword
        ? '🔒 Una password c\'è già. <b>Non posso mostrartela</b>: a DB ne resta solo l\'impronta, non il testo. Per cambiarla, scrivine una nuova.'
        : '🔓 Nessuna password: chiunque abbia il link entra. Scrivine una e girala sul gruppo WhatsApp.')
      + ' Cambiandola, tutti i dispositivi già entrati dovranno reinserirla.</div>'
    + '<div class="ar-actions">'
    +   '<button class="btn btn-cheese btn-mini" onclick="salvaPasswordGruppoAdmin()">Salva password</button>'
    +   (haPassword ? '<button class="btn btn-ghost btn-mini" onclick="rimuoviPasswordGruppoAdmin()">Togli la password</button>' : '')
    + '</div></div>';
}

// Prezzi al kg e spedizione stanno insieme: sono i numeri che fanno il conto di tutti, e
// `gruppo.spedizione_totale` ha QUI la sua unica fonte di verità — lo scontrino della
// fase ③ la mostra e basta, con un rimando a questa card.
function cardPrezziHtml(){
  return '<div class="card" id="card-prezzi"><div class="card-titolo">Prezzi al kg e spedizione</div>'
    + tipi.map(function(t){
        return '<div class="admin-row"><span class="ar-nome">' + escapeHtml(t.nome) + '</span>'
          + '<div class="ar-actions"><input class="inp" style="width:110px;height:38px;" type="number" min="0" step="0.01" name="prezzo-kg" autocomplete="off" id="prezzo-' + t.id + '" value="' + t.prezzo_kg + '">'
          + '<button class="btn btn-cheese btn-mini" onclick="salvaPrezzoTipo(\'' + t.id + '\')">Salva</button></div></div>';
      }).join("")
    + '<div class="m-row" style="margin-top:14px;"><label>Spedizione totale (€)</label>'
    + '<input class="inp" type="number" min="0" step="0.01" inputmode="decimal" name="spedizione-totale" autocomplete="off" id="inp-spedizione" value="' + gruppo.spedizione_totale + '"></div>'
    + '<div class="hint">Si divide fra le <b>quote</b> di chi partecipa: una a testa, di più per chi ritira anche per amici fuori dal Clan. Cambia con i kg totali, quindi è normale ritoccarla in corso d\'opera: se qualcuno ha già pagato te lo dico prima di salvare.</div>'
    + '<button class="btn btn-cheese btn-mini" onclick="salvaSpedizione()">Salva spedizione</button>'
    + '</div>';
}

function cardScadenzaHtml(){
  return '<div class="card"><div class="card-titolo">Scadenza degli ordini</div>'
    + '<div class="m-row"><label>Chiusura ordini</label>'
    + '<input class="inp" type="datetime-local" name="chiusura-ordini" autocomplete="off" id="inp-chiusura" value="' + isoToInputLocale(gruppo.chiusura_ordini) + '"></div>'
    + '<div class="hint">' + (ordiniChiusi()
        ? '🔒 Ordini <b>chiusi</b> dal ' + escapeHtml(fmtDataOra(gruppo.chiusura_ordini)) + '. I topini non possono più modificare.'
        : (gruppo.chiusura_ordini
            ? '⏰ Si chiudono il ' + escapeHtml(fmtDataOra(gruppo.chiusura_ordini)) + '.'
            : 'Nessuna scadenza: gli ordini restano aperti finché non li chiudi tu.')) + '</div>'
    + '<div class="ar-actions">'
    +   '<button class="btn btn-cheese btn-mini" onclick="salvaChiusuraOrdini()">Salva scadenza</button>'
    +   (gruppo.chiusura_ordini ? '<button class="btn btn-ghost btn-mini" onclick="riapriOrdini()">Togli la scadenza</button>' : '')
    + '</div></div>';
}

// ── FASE 1: i due messaggi pronti per il gruppo WhatsApp ──
// DUE testi e due bottoni, non uno che si adatta: sono messaggi diversi, mandati in momenti
// diversi della vita del Clan, e un testo che cambia da solo è un testo che l'admin deve
// rileggere ogni volta prima di incollarlo per sapere cosa sta per mandare.
// Stanno in fase ① perché è il momento in cui si mandano: il giro è appena aperto.

// L'indirizzo dell'app com'è adesso, senza query e senza frammento. NON si scrive a mano:
// un link incollato in un messaggio WhatsApp sopravvive più a lungo di qualunque altra cosa
// — resta nella cronologia del gruppo per anni — e un indirizzo scritto qui dentro
// continuerebbe a mandare i topini nel vuoto il giorno in cui l'app cambia posto.
// `index.html` in coda si toglie: è lo stesso identico posto, ed è più corto da leggere.
//
// ⚠️ CON UNA SOLA ECCEZIONE, e non è un ripensamento: quando si guarda l'app da un indirizzo
// di COLLAUDO — `localhost`, `127.0.0.1`, un IP di rete interna, un `file://` — `location`
// darebbe un link che per il gruppo non esiste. È successo davvero, il 04/09/2026: il primo
// collaudo dei messaggi ha prodotto `http://127.0.0.1:22318/SMB/0/…`. Lì, e solo lì, si
// ripiega sull'indirizzo pubblico, così il messaggio si può provare per davvero.
// In produzione comanda `location` come prima: se l'app cambia posto, il messaggio la segue.
// `INDIRIZZO_PUBBLICO` è l'unico posto in cui l'indirizzo è scritto a mano, ed è l'indirizzo
// di OGGI: se cambia, si cambia qui. La card lo mostra sempre prima di copiare, quindi un
// valore diventato falso si vede invece di partire per il gruppo.
var INDIRIZZO_PUBBLICO = "https://ilkajino.github.io/IlClanDelParmigiano/";

function indirizzoDiCollaudo(){
  var h = location.hostname;
  return location.protocol === "file:" || !h
      || h === "localhost" || h === "127.0.0.1" || h === "::1" || /\.local$/.test(h)
      || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
}
function linkApp(){
  if(indirizzoDiCollaudo()) return INDIRIZZO_PUBBLICO;
  return (location.origin + location.pathname).replace(/index\.html$/, "");
}

// Gli asterischi sono il grassetto di WhatsApp, e sono l'unico motivo per cui la prima riga
// non è scritta in maiuscolo: là dentro si vedono come un titolo, qui come due asterischi.
function testoPresentaApp(){
  return "🧀 *Il Clan del Parmigiano*\n\n"
    + "Ho messo su un'app per ordinare il parmigiano tutti insieme, direttamente dalla "
    + "latteria.\n\n"
    + "Apri il link, scrivi il tuo nome e dici quanti chili vuoi: ai conti pensa lei. "
    + "Dentro c'è una guida che spiega tutto in due minuti.\n\n"
    + "👉 " + linkApp();
}
// Volutamente corto, e senza scadenza: l'app non conosce nessuna data di chiusura del
// gruppo WhatsApp e non deve fingere di conoscerla. La aggiunge l'admin a mano, e la nota
// sotto al bottone glielo ricorda nel momento in cui copia.
//
// ⚠️ E senza link, per decisione di iL KaJiNo del 04/09/2026: a questo messaggio rispondono
// topini che nel Clan ci sono già e che l'app ce l'hanno installata sul telefono. Un link in
// fondo a ogni annuncio insegnerebbe ad aprire l'app dal browser invece che dall'icona, che
// è il contrario di quello per cui l'invito all'installazione esiste. Chi è nuovo riceve
// l'altro messaggio, che il link ce l'ha.
function testoGiroAperto(){
  return "🧀 *Ordini aperti!*\n\n"
    + "Il Clan riparte. Entrate e dite quanto formaggio volete — poi chiudo e ordino alla "
    + "latteria.";
}

function cardMessaggiHtml(){
  return '<div class="card"><div class="card-titolo">💬 Messaggi per il gruppo</div>'
    + '<div class="hint">Due testi pronti da incollare su WhatsApp, col link dell\'app già dentro.</div>'
    + '<button class="btn btn-cheese btn-mini msg-btn" onclick="copiaPresentaApp()">📋 Presenta l\'app</button>'
    + '<p class="card-nota">Una volta sola, o quando entra un topino nuovo: dice cos\'è il Clan '
    +   'e come si ordina.</p>'
    + '<button class="btn btn-cheese btn-mini msg-btn" onclick="copiaGiroAperto()">📋 Il giro è aperto</button>'
    + '<p class="card-nota">A ogni giro nuovo, e <b>senza link</b>: chi è già nel Clan apre '
    +   'l\'app dall\'icona. È corto apposta — <b>la scadenza aggiungila tu</b>, che l\'app '
    +   'non la conosce.</p>'
    // Il link si VEDE prima di copiare. Non è una decorazione: `linkApp()` riporta
    // l'indirizzo da cui stai guardando l'app in questo momento, e chi collauda in locale
    // guarda da `127.0.0.1` o da un IP di rete interna. Senza questa riga, il messaggio con
    // dentro un indirizzo che non funziona per nessuno si scopre DOPO averlo mandato al
    // gruppo. È l'unico pezzo dei due testi che può cambiare, quindi è l'unico da mostrare.
    + '<div class="hint hint-link">'
    +   (indirizzoDiCollaudo()
        ? 'Stai guardando l\'app da un indirizzo di collaudo: nel primo messaggio finisce '
          + 'comunque l\'<b>indirizzo pubblico</b>.<br>'
        : 'Nel primo messaggio finisce questo indirizzo:<br>')
    +   '<b class="hint-url">' + escapeHtml(linkApp()) + '</b></div>'
    + '</div>';
}
// `copiaTesto()` è la stessa del documento per la latteria, ramo `execCommand` compreso:
// fuori da HTTPS e su qualche WebView `navigator.clipboard` non esiste, e senza il ripiego
// il bottone non direbbe niente a nessuno. La conferma «Copiato 📋» la fa già lei, sul
// pallino di sincronia.
function copiaPresentaApp(){ copiaTesto(testoPresentaApp()); }
function copiaGiroAperto(){ copiaTesto(testoGiroAperto()); }

// ── FASE 2: raccolgo gli ordini ──
function cardKgPerTipoHtml(){
  var dati = kgPerTipo();
  var tot = dati.reduce(function(a, d){ return a + d.kg; }, 0);
  var quanti = persone.filter(function(p){ return righeDi(p.id).length; }).length;
  var h = '<div class="card"><div class="card-titolo">Kg per tipo</div>';
  if(!tot){
    h += '<div class="empty">Nessun kg ordinato ancora.</div>';
  } else {
    h += '<div class="pc-conti" style="border-top:none;padding-top:0;">';
    dati.forEach(function(d){
      h += '<div class="pc-riga"><span>' + escapeHtml(d.nome) + '</span><span>'
        + kgFmt(d.kg) + (d.kg > 0 ? ' · ' + pezziDa(d.kg) + ' pz' : '') + '</span></div>';
    });
    h += '<div class="pc-riga grande"><span>Totale</span><span>' + kgFmt(tot) + '</span></div>';
    // La spedizione si DECIDE nella fase ①, ma si RIVEDE qui: sale a scaglioni sui kg totali
    // del gruppo, quindi il numero da guardare e quello da ritoccare vanno visti insieme.
    // Stavano in due fasi diverse, e appena il primo topino ordinava la fisarmonica passava
    // a questa e chiudeva l'altra. Qui è mostrata, non ri-digitata: un secondo campo sulla
    // stessa colonna si desincronizza al primo salvataggio parziale — stessa ragione per
    // cui lo scontrino mostra la spedizione senza ridigitarla. Il collegamento è lo stesso
    // che usa lo scontrino, `vaiAiPrezzi()`, che apre la fase ① ed evidenzia la card.
    h += '<div class="pc-riga"><span>Spedizione'
      + '<button class="sc-mod" onclick="vaiAiPrezzi()">modifica</button></span><span>'
      + eur(parseFloat(gruppo.spedizione_totale) || 0) + '</span></div>';
    h += '</div>';
    h += '<div class="hint" style="margin-top:10px;margin-bottom:0;">' + quanti + ' topini su '
      + persone.length + ' hanno già ordinato.</div>';
  }
  return h + '</div>';
}

// Impostare la scadenza (fase ①) e chiudere adesso sono due gesti diversi: il primo si fa
// all'inizio e si dimentica, il secondo si fa quando si guarda l'ordine e si decide che
// basta così. Scrivono la stessa colonna, ma nel momento in cui servono sono lontanissimi.
function cardChiusuraHtml(){
  var chiusi = ordiniChiusi();
  var h = '<div class="card"><div class="card-titolo">Chiudi gli ordini</div>';
  h += '<div class="hint">' + (chiusi
      ? '🔒 <b>Chiusi</b> dal ' + escapeHtml(fmtDataOra(gruppo.chiusura_ordini)) + '.'
      : (gruppo.chiusura_ordini
          ? '⏰ Si chiudono da soli il ' + escapeHtml(fmtDataOra(gruppo.chiusura_ordini)) + ', ma puoi chiuderli adesso.'
          : 'Nessuna scadenza impostata: restano aperti finché non li chiudi tu.')) + '</div>';
  h += '<div class="ar-actions">'
    + (chiusi ? '' : '<button class="btn btn-cheese btn-mini" onclick="chiudiOrdiniAdesso()">🔒 Chiudi adesso</button>')
    + (gruppo.chiusura_ordini ? '<button class="btn btn-ghost btn-mini" onclick="riapriOrdini()">Riapri gli ordini</button>' : '')
    + '</div>';
  return h + '</div>';
}
async function chiudiOrdiniAdesso(){
  if(!confirm("Chiudo gli ordini adesso? I topini non potranno più toccare i loro kg.")) return;
  try{ await aggiornaChiusuraOrdini(new Date().toISOString()); await caricaTutto(); renderAdmin(); dot("ok", "Ordini chiusi 🔒"); }
  catch(e){ alert("Errore: " + e.message); }
}

// ── FASE 3: aspetto il negoziante ──
function cardArrivoHtml(){
  var arrivo = arrivoSegnalato();
  return '<div class="card"><div class="card-titolo">Arrivo del pacco</div>'
    + (arrivo
        ? '<div class="hint">🧀 Segnalato come <b>arrivato il '
          + escapeHtml(fmtData(arrivo)) + '</b>. Il banner verde è acceso in cima alla tab Ordina '
          + 'per tutti i topini.</div>'
          + '<div class="ar-actions">'
          +   '<button class="btn btn-ghost btn-mini" onclick="rimandaMessaggioArrivo()">📤 Rimanda il messaggio</button>'
          +   '<button class="btn btn-ghost btn-mini" onclick="annullaSegnalazioneArrivo()">↩️ Annulla la segnalazione</button>'
          + '</div>'
        : '<button class="btn btn-cheese" onclick="segnalaArrivoAlGruppo()">'
          + '<span class="svg-inv svg-formaggio-arrivato btn-ico-svg"></span> Segnala l\'arrivo al gruppo</button>'
          // ⚠️ Questa frase DESCRIVE il messaggio: se cambia `testoPaccoArrivato()`,
          // si rilegge. Diceva «con i totali» fino al 03/09/2026, quando i totali sono
          // usciti dal messaggio.
          + '<div class="hint" style="margin-bottom:0;">Accende il banner nell\'app per tutti e prepara '
          + 'l\'annuncio su WhatsApp: la chat e l\'invio li scegli tu.</div>')
    + '</div>';
}

// ── FASE 4: consegno ──
function cardConsegnaHtml(){
  var h = '<div class="card"><div class="card-titolo">Consegna — prezzi reali</div>';
  var conOrdine = persone.filter(function(p){ return righeDi(p.id).length; });
  if(!conOrdine.length){
    h += '<div class="empty">Nessun ordine ancora.</div>';
  } else {
    h += '<div class="hint">Tocca un nome per inserire gli importi letti dalle etichette.</div>';
    h += conOrdine.map(function(p){
      var mie = righeDi(p.id);
      var fatte = mie.filter(function(r){ return r.prezzo_reale != null; }).length;
      var completa = fatte === mie.length;
      return '<div class="admin-row cliccabile" onclick="apriReali(\'' + p.id + '\')">'
        + '<span class="ar-nome">' + escapeHtml(p.nome) + '</span>'
        + '<div class="ar-actions">'
        +   '<span class="badge ' + (completa ? "ok" : "no") + '">' + fatte + ' su ' + mie.length + '</span>'
        +   '<span class="ar-freccia">›</span>'
        + '</div></div>';
    }).join("");
  }
  return h + '</div>';
}

// ── FASE 5: incasso ──
function cardCoordinateHtml(){
  return '<div class="card"><div class="card-titolo">Coordinate di pagamento</div>'
    + '<div class="m-row"><label>IBAN</label><input class="inp" id="inp-iban" name="iban-gruppo" autocomplete="off" value="' + escapeHtml(impostazioni.iban || "") + '"></div>'
    + '<div class="m-row"><label>Link PayPal (es. paypal.me/tuonome)</label><input class="inp" id="inp-paypal" name="link-paypal" autocomplete="off" value="' + escapeHtml(impostazioni.paypal_link || "") + '"></div>'
    + '<div class="m-row"><label>Satispay (numero o tag, es. @topolino)</label><input class="inp" id="inp-satispay" name="tag-satispay" autocomplete="off" value="' + escapeHtml(impostazioni.satispay_link || "") + '"></div>'
    + '<div class="hint">Con un account personale non esiste un link con importo preimpostato: i topini digitano la cifra a mano.</div>'
    + '<button class="btn btn-cheese btn-mini" onclick="salvaPagamenti()">Salva coordinate</button>'
    + '</div>';
}

// Prima erano due pillole con convenzioni opposte nella stessa riga: `🚚 no sped.` diceva
// l'AZIONE, `❌ non pagato` diceva lo STATO. Affiancate, una era un comando e l'altra una
// constatazione — non un'etichetta infelice, grammatica incoerente. Due interruttori veri,
// etichettati sempre con lo stato.
// ── FASE ①: chi paga la spedizione, e per quante persone ──
// Sta in fase ① e non in ⑤ perché è una decisione dell'IMPOSTAZIONE del giro, non della
// riscossione: si sa chi partecipa prima di sapere chi ha pagato.
// Le due cose stanno su una riga sola perché sono la stessa domanda posta due volte —
// «questa persona paga la spedizione?» e «per quanti?». Separarle costringerebbe a
// cercare in due posti la ragione di un solo numero.
// ⚠️ L'admin qui non deve fare NIENTE perché il sistema funzioni: il default è 1 e
// l'interruttore nasce acceso. Questa card serve a CORREGGERE — un 10 battuto per
// sbaglio da un topino — non a configurare.
function cardSpedizionePersoneHtml(){
  var h = '<div class="card"><div class="card-titolo">🚚 Spedizione: chi partecipa</div>';
  if(!persone.length){
    return h + '<div class="empty">Nessun topino ancora.</div></div>';
  }
  h += '<div class="hint">Le <b>quote</b> dicono per quante persone ordina un topino, sé '
    +  'stesso compreso: chi ritira anche per due amici fuori dal Clan conta 3, perché sono '
    +  'tre consegne. Non c\'entrano con i kg né con il conto del formaggio. '
    +  'Ognuno se le imposta da sé nella tab Ordina — qui si correggono.</div>';
  h += persone.map(function(p){
    var q = parseInt(p.quote_spedizione, 10) || QUOTE_MIN;
    var esclusa = !p.partecipa_spedizione;
    return '<div class="persona-blocco">'
      + '<div class="admin-row"><span class="ar-nome">' + escapeHtml(p.nome) + '</span></div>'
      // Le parole restano «inclusa/esclusa» come prima: sono le stesse che `_swSposta()`
      // rimette dopo un tocco, e farle divergere qui darebbe un'etichetta che cambia parola
      // a seconda che tu abbia toccato l'interruttore o ricaricato la pagina.
      + swRigaHtml("Partecipa", "sw-sped-" + p.id, p.partecipa_spedizione,
                   "toggleSpedizionePersona('" + p.id + "', this)",
                   p.partecipa_spedizione ? "inclusa" : "esclusa")
      // Lo stepper resta attivo anche a spedizione esclusa: il valore resta scritto e
      // tornerebbe a contare se la partecipazione si riaccendesse, quindi è proprio lì
      // che un 10 sbagliato va potuto correggere. Lo dice l'etichetta, non un blocco.
      + '<div class="sw-riga"><span class="sw-nome">Quote</span>'
      +   '<div class="stepper">'
      +     '<button class="step-btn meno" ' + (q > QUOTE_MIN ? "" : "disabled ")
      +       'onclick="stepQuotePersona(\'' + p.id + '\',-1)" aria-label="Una quota in meno">−</button>'
      +     '<span class="step-val" id="qv-' + p.id + '">' + q + '</span>'
      +     '<button class="step-btn piu" ' + (q < QUOTE_MAX ? "" : "disabled ")
      +       'onclick="stepQuotePersona(\'' + p.id + '\',1)" aria-label="Una quota in più">+</button>'
      +   '</div>'
      // Etichetta corta per forza: fra il nome (92px fissi) e lo stepper qui restano una
      // novantina di pixel a 375px, e «non conta: esclusa» ci andava a capo tre volte.
      // A una quota sola non dice niente: lo stepper mostra già 1, e ripeterlo a parole
      // metterebbe una scritta su ogni riga della card per non aggiungere nulla.
      +   '<span class="sw-stato' + (esclusa ? " spento" : "") + '">'
      +     (esclusa ? "non conta" : (q === 1 ? "" : "+" + (q - 1) + " amici"))
      +   '</span>'
      + '</div>'
      + '</div>';
  }).join("");
  return h + '</div>';
}
// Stesso mestiere di `toggleSpedizionePersona`: ottimistico, con rollback se il server
// rifiuta. ⚠️ Scrive la STESSA colonna dello stepper del topino in tab Ordina: dopo il
// salvataggio `caricaTutto()` rilegge, quindi le due viste convergono sullo stesso valore
// e non esiste un ramo in cui una delle due tenga un numero suo.
async function stepQuotePersona(id, dir){
  var p = persone.find(function(x){ return x.id === id; });
  if(!p) return;
  var attuale = parseInt(p.quote_spedizione, 10) || QUOTE_MIN;
  var q = attuale + dir;
  if(q < QUOTE_MIN) q = QUOTE_MIN;
  if(q > QUOTE_MAX) q = QUOTE_MAX;
  if(q === attuale) return;
  vibra(10);   // PRIMA di qualunque await: dopo, l'attivazione utente è già scaduta
  p.quote_spedizione = q;
  var cella = document.getElementById("qv-" + id);
  if(cella) cella.textContent = q;
  try{
    await setQuoteSpedizione(id, q);
    await caricaTutto(); renderAdmin();
  }catch(e){
    p.quote_spedizione = attuale;
    if(cella) cella.textContent = attuale;
    dot("err", "Errore");
    alert("Errore: " + e.message);
  }
}

function cardTopoliniHtml(){
  var h = '<div class="card"><div class="card-titolo">Topini registrati (' + persone.length + ')</div>';
  if(!persone.length){
    h += '<div class="empty">Nessun topino ancora.</div>';
  } else {
    // Restava un solo interruttore su tre: gli altri due se ne sono andati dove servono —
    // «Spedizione» in fase ①, con le quote, e «Admin» nella card Amministratori, dove sta
    // già tutto il resto di chi amministra. Qui è la fase in cui si incassa, e «Pagato»
    // è l'unica delle tre cose che appartenga a questo momento del giro.
    h += '<div class="hint">Segna chi ha saldato. Accendere l\'interruttore vale come '
      +  '<b>confermare</b> il pagamento: chi aveva segnalato sparisce dalla coda qui sopra. '
      +  'Spegnerlo \u00e8 una smentita, e te lo chiedo prima di farlo.</div>';
    h += persone.map(function(p){
      return '<div class="persona-blocco">'
        + '<div class="admin-row"><span class="ar-nome">' + escapeHtml(p.nome)
        +   (p.pagamento_segnalato ? ' <span class="ar-flag">⏳ dice di aver pagato</span>' : '') + '</span>'
        +   '<div class="ar-actions">'
        +     '<button class="btn-pill" title="Rinomina" onclick="apriRinomina(\'' + p.id + '\')">✏️</button>'
        +     '<button class="btn-pill" title="Elimina" onclick="confermaEliminaPersona(\'' + p.id + '\')">🗑️</button>'
        +   '</div></div>'
        + swRigaHtml("Pagato", "sw-pag-" + p.id, p.pagato,
                     "togglePagatoPersona('" + p.id + "', this)",
                     p.pagato ? "sì" : "no")
        + '</div>';
    }).join("");
  }
  return h + '</div>';
}
// `opz` è opzionale: `{ disabilitato, titolo }`. Serve all'interruttore Admin, che è l'unico
// che si muove in una direzione sola (vedi `toggleAdminPersona`).
function swRigaHtml(nome, id, acceso, handler, stato, opz){
  var bloccato = !!(opz && opz.disabilitato);
  return '<div class="sw-riga"><span class="sw-nome">' + nome + '</span>'
    + '<button class="sw' + (acceso ? " on" : "") + '" id="' + id + '" type="button" role="switch"'
    +   ' aria-checked="' + (acceso ? "true" : "false") + '" aria-label="' + nome + '"'
    +   (bloccato ? ' disabled' : '')
    +   (opz && opz.titolo ? ' title="' + escapeHtml(opz.titolo) + '"' : '')
    +   ' onclick="' + handler + '"></button>'
    + '<span class="sw-stato' + (acceso ? "" : " spento") + '" id="' + id + '-lab">' + stato + '</span></div>';
}

// ── FASE 6: chiudo ──
function cardPdfHtml(){
  return '<div class="card"><div class="card-titolo">Riepilogo per il clan</div>'
    + '<button class="btn btn-cheese" onclick="esportaPDF()">📄 Riepilogo PDF per il gruppo</button>'
    + '<div class="hint" style="margin-bottom:0;">Un PDF per persona con ordine, conti e coordinate di pagamento, da girare su WhatsApp. '
    + 'Si adatta da solo: prima della consegna mostra gli importi attesi, dopo anche quelli reali.</div>'
    + '</div>';
}
// Il bottone rosso distruttivo stava in cima all'admin, a due dita dal campo spedizione
// che si tocca di continuo. Adesso sta in fondo all'ultima fase, che è il momento in cui
// archiviare è la cosa giusta da fare.
function cardArchiviaHtml(){
  return '<div class="card"><div class="card-titolo">Archivia il gruppo</div>'
    + '<div class="hint">Il gruppo diventa di sola lettura e finisce nell\'archivio qui sotto. '
    + 'I topini vedranno "nessun gruppo attivo" finché non ne crei un altro.</div>'
    + '<button class="btn btn-danger" onclick="confermaArchiviaGruppo()">📦 Archivia e chiudi questo gruppo</button>'
    + '</div>';
}

// ── FUORI DALLE FASI ──
// Chi può amministrare. Stava qui il "cambia il PIN": al suo posto c'è l'elenco delle
// persone autorizzate, che è la stessa domanda posta bene — non "qual è la parola
// d'ordine" ma "di chi mi fido".
// Gli indirizzi si passano per INDICE e non per stringa: un'email può contenere un
// apice, e un apice dentro un `onclick` rompe l'HTML invece di dare un errore leggibile.
function cardAmministratoriHtml(){
  var mia = authUser ? normalizzaEmail(authUser.email) : "";
  var h = '<div class="card"><div class="card-titolo">Amministratori</div>'
    + '<div class="hint">Chi è in questo elenco amministra da qualunque dispositivo. '
    +   'Chi non c\'è resta un topino come gli altri, <b>anche se ha fatto l\'accesso</b>.'
    +   '<br><br>Aggiungerne uno sono <b>due gesti</b>, e il secondo da solo non basta:'
    +   '<br>1. in <b>dashboard Supabase → Authentication → Users → Add user</b>, con email, '
    +   'password e <i>auto confirm</i> acceso;'
    +   '<br>2. la stessa email qui sotto.</div>';
  h += adminAutorizzati.map(function(a, i){
    var sonoIo = normalizzaEmail(a.email) === mia;
    return '<div class="admin-row"><span class="ar-nome">'
      + escapeHtml(a.etichetta || a.email)
      + (sonoIo ? ' <span class="ar-flag">sei tu</span>' : '')
      + (a.etichetta ? '<div class="ar-sub">' + escapeHtml(a.email) + '</div>' : '')
      + '</span><div class="ar-actions">'
      +   '<button class="btn-pill" title="Togli l\'autorizzazione" '
      +   'onclick="confermaRevocaAdmin(' + i + ')">🗑️</button>'
      + '</div></div>';
  }).join("");
  h += targhetteHtml();
  h += '<div class="m-row" style="margin-top:12px;"><label>Autorizza un altro amministratore</label>'
    +   '<input class="inp" id="aa-email" name="email-nuovo-admin" type="email" inputmode="email"'
    +   ' autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"'
    +   ' placeholder="email" style="margin-bottom:8px;"></div>'
    + '<div class="m-row"><input class="inp" id="aa-etichetta" name="etichetta-admin"'
    +   ' autocomplete="off" placeholder="nome, per riconoscerla nell\'elenco"></div>'
    + '<div class="errore" id="aa-errore"></div>'
    + '<button class="btn btn-cheese btn-mini" onclick="autorizzaNuovoAdmin()">➕ Autorizza</button>'
    + '<div class="hint" style="margin-bottom:0;">Scriverla qui senza aver fatto il primo '
    +   'gesto non serve a niente: senza utente in dashboard non esiste nessuna password '
    +   'con cui entrare.</div>'
    + '</div>';
  return h;
}
// ── LA TARGHETTA «admin» NELLA TABELLA ──
// Sta qui e non fra i topini della fase ⑤ perché è la stessa materia dell'elenco qui sopra:
// mettendola accanto, tutto ciò che riguarda «chi è admin» sta in un punto solo. E questa
// card è fuori dalla fisarmonica, quindi è sempre raggiungibile — la pulizia dopo una
// revoca non deve dipendere dalla fase in cui ci si trova.
// ⚠️ L'interruttore si muove in UNA DIREZIONE SOLA: si può solo spegnere. Non è una
// limitazione da togliere — è tutta la sua funzione. La targhetta si accende da sé quando
// quella persona amministra davvero; qui si ripulisce chi è rimasto segnato dopo una revoca.
// Trasformarlo in un'etichetta di sola lettura perderebbe esattamente quello, e con esso
// il `title` che lo spiega a chi ci mette il dito sopra.
function targhetteHtml(){
  var segnati = persone.filter(function(p){ return p.is_admin; });
  var h = '<div class="sotto-card"><div class="sc-titolo">La targhetta nella tabella</div>'
    + '<div class="hint">È una <b>targhetta, non un permesso</b>: dice al gruppo a chi '
    +   'chiedere, e non apre niente — chi amministra davvero è chi sta nell\'elenco qui '
    +   'sopra. <b>Si accende da sola</b> quando quella persona entra in amministrazione con '
    +   'la sua email; da qui si può solo <b>spegnere</b>, per ripulire chi è rimasto '
    +   'segnato dopo una revoca.</div>';
  if(!segnati.length){
    return h + '<div class="empty">Nessun topino porta la targhetta.</div></div>';
  }
  h += segnati.map(function(p){
    return swRigaHtml(escapeHtml(p.nome), "sw-adm-" + p.id, true,
                      "toggleAdminPersona('" + p.id + "', this)", "sì",
                      { titolo: "La targhetta si accende da sola al primo accesso "
                              + "amministrativo di questa persona. Da qui si può solo spegnere." });
  }).join("");
  return h + '</div>';
}
async function autorizzaNuovoAdmin(){
  var err = document.getElementById("aa-errore");
  var email = normalizzaEmail(document.getElementById("aa-email").value);
  var etichetta = document.getElementById("aa-etichetta").value.trim();
  if(!emailValida(email)){ err.textContent = "Questo non sembra un indirizzo email."; return; }
  if(adminAutorizzati.some(function(a){ return normalizzaEmail(a.email) === email; })){
    err.textContent = "Questo indirizzo è già nell'elenco."; return;
  }
  try{
    await autorizzaAdmin(email, etichetta);
    await caricaTutto();
    renderAdmin();
    dot("ok", "Amministratore autorizzato \uD83D\uDC2D");
  }catch(e){ err.textContent = "Errore: " + e.message; }
}
// L'ultimo non si toglie. Non è una cortesia: senza nessuno in tabella `e_admin()` risponde
// `false` a chiunque, le policy chiudono tutto, e si rientra solo scrivendo SQL a mano nel
// pannello di Supabase. Una porta che si chiude da sola con la chiave dentro.
async function confermaRevocaAdmin(i){
  var a = adminAutorizzati[i];
  if(!a) return;
  if(adminAutorizzati.length <= 1){
    alert("È l'ultimo amministratore rimasto.\n\nSe lo togli, l'app resta senza nessuno "
        + "che possa amministrarla e si rientra solo da SQL. Autorizza prima qualcun altro.");
    return;
  }
  var sonoIo = authUser && normalizzaEmail(a.email) === normalizzaEmail(authUser.email);
  var chi = a.etichetta ? a.etichetta + " (" + a.email + ")" : a.email;
  if(!confirm("Tolgo " + chi + " dagli amministratori?"
      + (sonoIo ? "\n\nSei tu: perdi l'accesso a questa schermata subito." : ""))) return;
  try{
    await revocaAdmin(a.email);
    await aggiornaEAdmin();
    if(!eAdmin){ _emailAccesso = ""; renderAccessoAdmin(); return; }
    await caricaTutto();
    renderAdmin();
    dot("ok", "Autorizzazione tolta");
  }catch(e){ alert("Errore: " + e.message); }
}

// Richieste in attesa: il topino segnala, qui l'admin verifica e conferma.
function renderDaConfermareHtml(){
  var attesa = segnalazioniInAttesa();
  if(!attesa.length) return "";
  var h = '<div class="card card-attesa"><div class="card-titolo">\u23F3 Pagamenti da confermare ('
    + attesa.length + ')</div>';
  h += '<div class="hint">Hanno segnalato di aver pagato. Confermi tu dopo aver verificato: '
    + 'la segnalazione da sola non li marca come pagati.</div>';
  h += attesa.map(function(p){
    // Qui c'è un totale da confermare: se è più alto degli altri, l'admin deve poter
    // leggere subito perché, invece di andarselo a cercare in un'altra schermata.
    var etQ = etichettaQuote(p);
    return '<div class="admin-row"><span class="ar-nome">' + escapeHtml(p.nome)
      + (etQ ? ' <span class="pill-quote">' + etQ + '</span>' : '')
      + '<div class="ar-sub">' + escapeHtml(nomeMetodo(p.metodo_segnalato)) + ' \u00b7 '
      + eur(totaleDovuto(p)) + '</div></span>'
      + '<div class="ar-actions">'
      +   '<button class="btn btn-cheese btn-mini" onclick="confermaIncasso(\'' + p.id + '\')">\u2705 Conferma</button>'
      +   '<button class="btn-pill" onclick="respingiSegnalazione(\'' + p.id + '\')" title="Rimetti in attesa">\u2715</button>'
      + '</div></div>';
  }).join("");
  h += '</div>';
  return h;
}
async function confermaIncasso(id){
  try{ await confermaPagamentoAdmin(id); await caricaTutto(); renderAdmin(); dot("ok", "Pagamento confermato \u2705"); }
  catch(e){ alert("Errore: " + e.message); }
}
async function respingiSegnalazione(id){
  var p = persone.find(function(x){ return x.id === id; });
  if(!confirm("Togliere la segnalazione di " + (p ? p.nome : "questa persona") + "? Tornerà a poterla rifare.")) return;
  try{ await annullaSegnalazione(id); await caricaTutto(); renderAdmin(); }
  catch(e){ alert("Errore: " + e.message); }
}

// Riepilogo admin: quanto ci si aspettava, quanto è venuto davvero, quanto è rientrato.
function renderRiepilogoHtml(){
  var atteso = 0, reale = 0, incassato = 0, daPrezzare = 0;
  persone.forEach(function(p){
    var sped = quotaSpedizione(p);
    atteso += totaleIpotetico(p.id) + sped;
    var dovuto = totaleDovuto(p);
    reale += dovuto;
    if(p.pagato) incassato += dovuto;
  });
  righe.forEach(function(r){ if(r.prezzo_reale == null) daPrezzare++; });
  var manca = reale - incassato;
  var scarto = reale - atteso;

  var h = '<div class="card"><div class="card-titolo">Riepilogo</div>';
  h += '<div class="pc-conti" style="border-top:none;padding-top:0;">';
  h +=   '<div class="pc-riga"><span>Atteso (dai prezzi al kg)</span><span>' + eur(atteso) + '</span></div>';
  h +=   '<div class="pc-riga"><span>Reale a oggi</span><span>' + eur(reale) + '</span></div>';
  if(Math.abs(scarto) >= 0.005){
    h += '<div class="pc-riga ' + (scarto > 0 ? "" : "reale") + '"><span>Scarto</span><span>'
      +  (scarto > 0 ? "+" : "\u2212") + eur(Math.abs(scarto)) + '</span></div>';
  }
  h +=   '<div class="pc-riga reale"><span>Segnato come pagato</span><span>' + eur(incassato) + '</span></div>';
  h +=   '<div class="pc-riga grande"><span>Ancora da incassare</span><span>' + eur(manca) + '</span></div>';
  h += '</div>';
  if(daPrezzare){
    h += '<div class="hint" style="margin-top:10px;margin-bottom:0;">\u26A0\uFE0F ' + daPrezzare
      + (daPrezzare === 1 ? ' riga non ha ancora' : ' righe non hanno ancora') + ' il prezzo reale: il totale può cambiare.</div>';
  }
  h += '</div>';
  return h;
}

// ── LO SCONTRINO E LA QUADRATURA ──
// Sono due cose, e stanno in due fasi diverse perché si fanno in due momenti diversi:
// in ③ si scrive il totale della fattura appena il negoziante lo manda, in ④ si guarda se
// gli importi delle etichette lo ricompongono.
//
// Principio: **l'admin digita solo numeri che ha davanti agli occhi.** La fattura che paga
// è UNA CIFRA SOLA, spedizione inclusa; chiedergli lo scorporo a mano significherebbe
// chiedergli una sottrazione su un numero che poi fa da checksum a TUTTE le etichette —
// e se sbaglia lì, la quadratura denuncia uno scarto inesistente e lo manda a ricontrollare
// etichette giuste. Le sottrazioni le fa l'app.
//
// Lo schema NON cambia: `costo_reale_totale` resta "solo formaggio", ed è giusto così —
// le etichette non contengono spedizione, inquinarlo romperebbe `quadratura()`.
function renderScontrinoHtml(){
  var sped = parseFloat(gruppo.spedizione_totale) || 0;
  var conSped = sped > 0;
  var scontrino = gruppo.costo_reale_totale != null ? parseFloat(gruppo.costo_reale_totale) : null;
  if(scontrino != null && isNaN(scontrino)) scontrino = null;
  // Il campo mostra la FATTURA, cioè il numero che l'admin ha davanti; a DB va il formaggio.
  var valore = scontrino == null ? "" : (Math.round((scontrino + (conSped ? sped : 0)) * 100) / 100);

  var h = '<div class="card" id="card-scontrino"><div class="card-titolo">🧾 Lo scontrino del negoziante</div>';
  h += '<div class="m-row"><label>' + (conSped
        ? 'Totale pagato al negoziante (€) — la fattura, così com\'è'
        : 'Scontrino parmigiano (€)') + '</label>'
    + '<input class="inp" type="number" min="0" step="0.01" inputmode="decimal" name="costo-fattura" autocomplete="off" id="inp-costo-reale"'
    + ' placeholder="quanto hai pagato tu" value="' + valore + '"></div>';
  h += '<div class="ar-actions">'
    +   '<button class="btn btn-cheese btn-mini" onclick="salvaCostoRealeTotale()">Salva scontrino</button>'
    +   (scontrino != null
          ? '<button class="btn btn-ghost btn-mini" onclick="azzeraCostoRealeTotale()">Togli</button>' : '')
    + '</div>';

  // La spedizione è MOSTRATA, non ri-digitata: unica fonte di verità `gruppo.spedizione_totale`,
  // che si modifica nella fase ①. Due input sulla stessa colonna in due card diverse si
  // desincronizzano al primo salvataggio parziale.
  if(conSped){
    h += '<div class="scontrino-calc">'
      + '<div class="sc-riga"><span>Totale pagato al negoziante</span><span>'
      +   (scontrino == null ? "—" : eur(scontrino + sped)) + '</span></div>'
      + '<div class="sc-riga"><span>− Spedizione'
      +   '<button class="sc-mod" onclick="vaiAiPrezzi()">modifica</button></span><span>'
      +   eur(sped) + '</span></div>'
      + '<div class="sc-riga risultato"><span>= Scontrino parmigiano</span><span>'
      +   (scontrino == null ? "—" : eur(scontrino)) + '</span></div>'
      + '</div>';
  }

  // Il margine sopra lo dà `.ar-actions + .hint` / `.scontrino-calc + .hint` in style.css:
  // questa spiegazione segue il bottone «Salva scontrino» in entrambi i rami.
  h += '<div class="hint" style="margin-bottom:0;">' + (conSped
      ? 'Scrivi il totale della fattura così com\'è. La spedizione la scorporo io: quello che resta è il formaggio, e diventa il controllo automatico su tutte le etichette.'
      : 'La spesa l\'hai anticipata tu, quindi il totale del parmigiano lo conosci già. Scrivilo qui e diventa un controllo automatico su tutti gli importi delle etichette.')
    + '</div>';
  return h + '</div>';
}

// La quadratura risponde a un'altra domanda del Riepilogo: quello dice CHI ha pagato,
// questa dice se gli importi battuti fanno il totale che l'admin ha anticipato. Se non
// torna, un'etichetta è stata battuta male — e si scopre subito, non quando un topino
// ha già pagato 12 € di troppo.
function renderQuadraturaHtml(){
  var q = quadratura();
  var assegnato = sommaPrezziReali();
  var h = '<div class="card"><div class="card-titolo">🧾 Quadratura sullo scontrino</div>';
  h += '<div class="pc-conti" style="border-top:none;padding-top:0;">';
  if(q) h += '<div class="pc-riga"><span>Scontrino parmigiano</span><span>' + eur(q.scontrino) + '</span></div>';
  h += '<div class="pc-riga reale"><span>Assegnato ai topini</span><span>' + eur(assegnato) + '</span></div>';
  if(q){
    var quadra = Math.abs(q.residuo) < 0.005;
    h += '<div class="pc-riga grande' + (quadra ? '' : ' non-quadra') + '"><span>'
      + (quadra ? 'Tutto quadra ✅'
                : (q.residuo > 0 ? 'Ancora da assegnare ⚠️' : 'Assegnato in più ⚠️'))
      + '</span><span>' + (quadra ? '' : eur(Math.abs(q.residuo))) + '</span></div>';
  }
  h += '</div>';
  h += '<div class="hint" style="margin-top:10px;margin-bottom:0;">' + (q
      ? 'La somma degli importi letti dalle etichette deve fare lo scontrino. Se non torna, una l\'hai battuta male: meglio accorgersene adesso che quando qualcuno ha già pagato di più.'
      : 'Manca il totale della fattura del negoziante: <button class="sc-mod" style="padding-left:0;" onclick="vaiAlloScontrino()">scrivilo nella fase ③</button> e questo diventa un controllo automatico su tutte le etichette.')
    + '</div>';
  return h + '</div>';
}

// L'admin scrive la FATTURA; a DB finisce il solo formaggio. La validazione serve al caso
// in cui i due numeri siano incompatibili: una fattura più bassa della sola spedizione
// vuol dire che uno dei due è sbagliato, e salvare produrrebbe uno scontrino negativo
// che poi denuncerebbe uno scarto inesistente su etichette giuste.
async function salvaCostoRealeTotale(){
  var raw = document.getElementById("inp-costo-reale").value.trim();
  var sped = parseFloat(gruppo.spedizione_totale) || 0;
  if(raw === ""){
    alert(sped > 0 ? "Scrivi il totale della fattura, oppure usa \"Togli\"."
                   : "Scrivi il totale dello scontrino, oppure usa \"Togli\".");
    return;
  }
  var v = parseFloat(raw);
  if(isNaN(v) || v < 0){ alert("Importo non valido."); return; }
  if(sped > 0){
    if(v < sped - 0.005){
      alert("Il totale della fattura (" + eurTesto(v) + ") è più basso della sola spedizione ("
        + eurTesto(sped) + "). Uno dei due numeri è sbagliato: controlla prima di salvare.");
      return;
    }
    v = Math.round((v - sped) * 100) / 100;
  }
  try{ await aggiornaCostoRealeTotale(v); await caricaTutto(); renderAdmin(); dot("ok", "Scontrino salvato 🧾"); }
  catch(e){ alert("Errore: " + e.message); }
}
async function azzeraCostoRealeTotale(){
  try{ await aggiornaCostoRealeTotale(null); await caricaTutto(); renderAdmin(); dot("ok", "Scontrino tolto"); }
  catch(e){ alert("Errore: " + e.message); }
}

// ── DOCUMENTO A: ordine per il negoziante ──
// Testo copiabile e basta, niente PDF: il bisogno reale è incollarlo in una email, e un
// allegato costringerebbe ad aprirlo. Il totale ipotetico sta FUORI dal testo, accanto al
// bottone: i prezzi li fa il negoziante, ed è la ragione per cui esiste `prezzo_reale`.
// Metterceli dentro suggerirebbe che glieli stiamo dettando.
function renderNegozianteHtml(){
  var ipotetico = persone.reduce(function(a, p){ return a + totaleIpotetico(p.id); }, 0);
  var kgTot = kgPerTipo().reduce(function(a, d){ return a + d.kg; }, 0);
  var h = '<div class="card"><div class="card-titolo">\uD83D\uDCE7 Ordine per il negoziante</div>';
  h += '<div class="hint">Aggregato per stagionatura, senza nomi e senza prezzi. Si copia e si incolla in una email.</div>';
  h += '<div class="m-row"><label>Note per il negoziante (finiscono in fondo al testo)</label>'
    + '<textarea id="inp-note-negoziante" class="nota-textarea nota-libera" rows="2" maxlength="500" oninput="notaAuto(this)"'
    + ' placeholder="es. se possibile un pezzo da 1 kg al posto di due da mezzo">'
    + escapeHtml(gruppo.note_negoziante || "") + '</textarea></div>';
  h += '<div class="ar-actions" style="margin-bottom:14px;">'
    + '<button class="btn btn-ghost btn-mini" onclick="salvaNoteNegoziante()">Salva le note</button></div>';
  h += '<pre class="doc-testo" id="doc-negoziante">' + escapeHtml(testoOrdineNegoziante()) + '</pre>';
  h += '<button class="btn btn-cheese" onclick="copiaOrdineNegoziante()">\uD83D\uDCCB Copia il testo</button>';
  h += '<div class="hint" style="margin-bottom:0;">Ai nostri prezzi farebbe <b>'
    + eur(ipotetico) + '</b> per ' + kgFmt(kgTot) + '. Questo numero <b>non</b> entra nel testo copiato.</div>';
  h += '</div>';
  return h;
}
async function salvaNoteNegoziante(){
  var v = document.getElementById("inp-note-negoziante").value.trim();
  try{ await aggiornaNoteNegoziante(v); await caricaTutto(); renderAdmin(); dot("ok", "Note salvate \uD83D\uDCDD"); }
  catch(e){ alert("Errore: " + e.message); }
}
function copiaOrdineNegoziante(){
  var el = document.getElementById("doc-negoziante");
  copiaTesto(el ? el.textContent : testoOrdineNegoziante());
}

function renderArchivioHtml(){
  var html = '<div class="card"><div class="card-titolo">Archivio gruppi passati</div>';
  if(!archivioGruppi.length){
    html += '<div class="empty">Nessun gruppo archiviato ancora.</div>';
  } else {
    html += archivioGruppi.map(function(g){
      return '<div class="archivio-item">'
        + '<div class="ai-testo" onclick="apriDettaglioArchivio(\'' + g.id + '\')">'
        +   '<div class="ai-nome">' + escapeHtml(g.titolo) + '</div>'
        +   '<div class="ai-meta">chiuso il ' + fmtData(g.chiuso_at) + '</div></div>'
        + '<div class="ar-actions">'
        +   '<button class="btn-pill" title="Elimina definitivamente" onclick="apriEliminaGruppo(\'' + g.id + '\')">\uD83D\uDDD1\uFE0F</button>'
        +   '<span class="ar-freccia" onclick="apriDettaglioArchivio(\'' + g.id + '\')">\u203A</span>'
        + '</div></div>';
    }).join("");
  }
  html += '</div>';
  return html;
}

// ── AZIONI ADMIN: spedizione / prezzi / pagamenti ──
// La spedizione varia con i kg totali, quindi si tocca in corso d'opera: non si impedisce,
// ma si dice. Due effetti da dichiarare prima di salvare, non dopo:
//  1. chi ha già pagato l'ha fatto sulla vecchia quota, e i suoi conti non tornano più;
//  2. la fattura del negoziante è UN FATTO e non cambia, quindi cambiando la spedizione
//     cambia lo scorporo: `costo_reale_totale` va ricalcolato tenendo ferma la fattura,
//     altrimenti il numero che l'admin ha digitato si muoverebbe da solo sotto ai suoi occhi.
async function salvaSpedizione(){
  var raw = document.getElementById("inp-spedizione").value.trim();
  var v = raw === "" ? 0 : parseFloat(raw);
  if(isNaN(v) || v < 0){ alert("Importo non valido."); return; }
  v = Math.round(v * 100) / 100;
  var vecchia = parseFloat(gruppo.spedizione_totale) || 0;
  if(Math.abs(v - vecchia) < 0.005){ dot("ok", "Già così 🧀"); return; }

  var avvisi = [];
  var n = quoteSpedizioneTotali();
  var pagati = persone.filter(function(p){ return p.pagato && p.partecipa_spedizione; }).length;
  if(pagati && n){
    avvisi.push("⚠️ " + pagati + (pagati === 1 ? " topino ha" : " topini hanno")
      + " già pagato sulla vecchia quota (" + eurTesto(vecchia / n) + " " + paroleATesta() + " → "
      + eurTesto(v / n) + "). Cambiandola i loro conti non tornano più.");
  }
  // Senza fattura registrata non c'è nulla da tenere fermo e nulla da ricalcolare: in fase ①
  // la spedizione si tocca di continuo, e un avviso a ogni salvataggio è il modo in cui gli
  // avvisi muoiono. Il secondo blocco resta muto, e se anche il primo tace non si chiede niente.
  var scontrinoNuovo = null;
  if(gruppo.costo_reale_totale != null){
    var fattura = parseFloat(gruppo.costo_reale_totale) + vecchia;
    scontrinoNuovo = Math.round((fattura - v) * 100) / 100;
    // Uno scontrino negativo farebbe dire assurdità alla quadratura. Si rifiuta il salvataggio,
    // non si corregge in silenzio: dei due numeri uno è sbagliato, e deve deciderlo l'admin.
    if(scontrinoNuovo < 0){
      alert("La spedizione (" + eurTesto(v) + ") supera la fattura registrata ("
        + eurTesto(fattura) + "): resterebbe un formaggio da \u2212"
        + eurTesto(Math.abs(scontrinoNuovo)) + ". Controlla l'una o l'altra.");
      return;
    }
    avvisi.push("🧾 La fattura resta " + eurTesto(fattura) + ": lo scontrino del solo parmigiano"
      + " passa da " + eurTesto(parseFloat(gruppo.costo_reale_totale)) + " a " + eurTesto(scontrinoNuovo)
      + ", e con lui la quadratura sulle etichette.");
  }
  if(avvisi.length && !confirm(avvisi.join("\n\n") + "\n\nContinuo?")) return;

  try{
    await aggiornaSpedizione(v);
    if(scontrinoNuovo != null) await aggiornaCostoRealeTotale(scontrinoNuovo);
    await caricaTutto(); renderAdmin(); dot("ok", "Salvato 🧀");
  }catch(e){ alert("Errore: " + e.message); }
}
// La password non torna più indietro dal DB: il campo parte sempre vuoto, e vuoto
// significa "non cambiare nulla", non "togli la password" — per quello c'è un bottone
// suo, altrimenti un Salva distratto aprirebbe il gruppo a chiunque.
async function salvaPasswordGruppoAdmin(){
  var v = document.getElementById("inp-password").value.trim();
  if(!v){ alert("Scrivi una password, oppure usa \"Togli la password\"."); return; }
  try{
    await aggiornaPasswordGruppo(await hashPassword(v));
    await caricaTutto();
    renderAdmin();
    dot("ok", "Password impostata \uD83D\uDD12");
  }catch(e){ alert("Errore: " + e.message); }
}
async function rimuoviPasswordGruppoAdmin(){
  if(!confirm("Togliere la password? Da quel momento chiunque abbia il link pu\u00f2 entrare.")) return;
  try{
    await aggiornaPasswordGruppo(null);
    await caricaTutto();
    renderAdmin();
    dot("ok", "Password rimossa");
  }catch(e){ alert("Errore: " + e.message); }
}
async function salvaPrezzoTipo(id){
  var v = parseFloat(document.getElementById("prezzo-" + id).value);
  if(!v || v <= 0) return;
  try{ await aggiornaPrezzoTipo(id, v); await caricaTutto(); renderAdmin(); dot("ok", "Salvato \uD83E\uDDC0"); }
  catch(e){ alert("Errore: " + e.message); }
}
async function salvaPagamenti(){
  var patch = {
    iban: document.getElementById("inp-iban").value.trim(),
    paypal_link: document.getElementById("inp-paypal").value.trim(),
    satispay_link: document.getElementById("inp-satispay").value.trim()
  };
  try{ await aggiornaImpostazioni(patch); await caricaTutto(); renderAdmin(); dot("ok", "Salvato \uD83E\uDDC0"); }
  catch(e){ alert("Errore: " + e.message); }
}

// ── AZIONI ADMIN: persone ──
function apriRinomina(id){
  var p = persone.find(function(x){ return x.id === id; });
  var nuovo = prompt("Nuovo nome per " + p.nome + ":", p.nome);
  if(nuovo && nuovo.trim()) eseguiRinomina(id, nuovo.trim());
}
// `persone.is_admin` È UNA TARGHETTA, NON UN RUOLO. Non tocca i permessi: quelli stanno in
// `admin_autorizzati` e li decide `e_admin()` a database. Questa colonna esiste per una
// ragione sola, e va tenuta a mente prima di toccarla: `admin_autorizzati` NON è leggibile
// da `anon`, quindi i topini non hanno nessun altro modo di sapere a chi chiedere. È la
// risposta pubblica a una domanda a cui la tabella dei permessi, giustamente, non risponde.
//
// DA QUI SI PUÒ SOLO SPEGNERE, e il perché è che la targhetta poteva mentire — e mentiva:
// nella lista c'erano due persone con l'interruttore su "sì" che non erano in
// `admin_autorizzati`. Per chiunque guardasse la tab Tabella erano amministratori, e non lo
// erano. Una targhetta sbagliata è peggio di una targhetta assente: manda a chiedere alla
// persona che non può rispondere.
//
// Accenderla a mano era l'unico gesto capace di renderla falsa, perché è l'unico che non
// passa da una prova d'identità. Ad accenderla resta `proponiFlagAdmin()`, al primo accesso
// amministrativo: l'unico momento in cui l'app SA con certezza che quella persona è admin.
// Così il flag non può più essere semplicemente sbagliato — al massimo resta acceso dopo una
// revoca, ed è esattamente il caso che questo interruttore serve a ripulire.
//
// Il rifiuto sta QUI e non solo nell'attributo `disabled` del bottone: un handler che si fida
// della propria interfaccia si fida di chiunque apra la console. (A database la scrittura
// passa comunque solo con `e_admin()`: questa è la terza rete, non la prima.)
async function toggleAdminPersona(id, el){
  if(!el.classList.contains("on")) return;   // solo spegnimento — vedi sopra
  vibra(10);
  _swSposta(el, false, "no");
  try{
    await setIsAdmin(id, false);
    await caricaTutto(); renderAdmin();
  }catch(e){
    _swSposta(el, true, "s\u00ec");
    dot("err", "Errore");
    alert("Errore: " + e.message);
  }
}
async function eseguiRinomina(id, nome){
  try{ await rinominaPersona(id, nome); await caricaTutto(); renderAdmin(); }
  catch(e){ alert("Errore: " + e.message); }
}
// Aggiornamento ottimistico con rollback, come lo stepper dei kg: l'interruttore si muove
// sotto il dito e torna indietro solo se il server rifiuta.
function _swSposta(el, acceso, stato){
  if(!el) return;
  el.classList.toggle("on", acceso);
  el.setAttribute("aria-checked", acceso ? "true" : "false");
  var lab = document.getElementById(el.id + "-lab");
  if(lab){ lab.textContent = stato; lab.classList.toggle("spento", !acceso); }
}
async function toggleSpedizionePersona(id, el){
  vibra(10);   // PRIMA di qualunque await: dopo, l'attivazione utente è già scaduta
  var val = !el.classList.contains("on");
  _swSposta(el, val, val ? "inclusa" : "esclusa");
  try{
    await setPartecipaSpedizione(id, val);
    await caricaTutto(); renderAdmin();
  }catch(e){
    _swSposta(el, !val, !val ? "inclusa" : "esclusa");
    dot("err", "Errore");
    alert("Errore: " + e.message);
  }
}
// "Pagato" ON deve passare da `confermaPagamentoAdmin`, non dalla `setPagato` grezza:
// altrimenti resta appeso un `pagamento_segnalato` a true su chi è già marcato pagato,
// e la persona ricompare nella coda "da confermare". Era un bug latente finché il gesto
// costava due tocchi; con l'interruttore diventerebbe frequente.
async function togglePagatoPersona(id, el){
  vibra(10);
  var val = !el.classList.contains("on");
  var p = persone.find(function(x){ return x.id === id; });
  // Spegnerlo è una smentita e va confermato; accenderlo no.
  if(!val && p && p.pagato
     && !confirm("Tolgo il \"pagato\" a " + p.nome + "? Torna nell'elenco di chi deve ancora saldare.")) return;
  _swSposta(el, val, val ? "sì" : "no");
  try{
    if(val) await confermaPagamentoAdmin(id);
    else    await setPagato(id, false);
    await caricaTutto(); renderAdmin();
  }catch(e){
    _swSposta(el, !val, !val ? "sì" : "no");
    dot("err", "Errore");
    alert("Errore: " + e.message);
  }
}
function confermaEliminaPersona(id){
  var p = persone.find(function(x){ return x.id === id; });
  if(confirm("Eliminare " + p.nome + " e tutti i suoi ordini?")) eseguiEliminaPersona(id);
}
async function eseguiEliminaPersona(id){
  try{ await eliminaPersona(id); await caricaTutto(); renderAdmin(); }
  catch(e){ alert("Errore: " + e.message); }
}

// ── NUOVO GRUPPO ──
// I quattro prezzi stavano cablati qui dentro. Cambiano ogni anno, e cablarli voleva dire
// toccare il codice e ripubblicare per un numero che l'admin ha già chiesto al negoziante —
// e infatti erano già sbagliati: il 48 mesi diceva 21,90 quando il prezzo vero era 21,80.
// Adesso il giro nuovo parte dai tipi dell'ULTIMO gruppo archiviato: nomi e prezzi sono già
// a database, sono quelli veri, e si aggiornano da soli a ogni giro.
// Questi quattro restano SOLO come ripiego per il primissimo gruppo, quando non c'è ancora
// un giro precedente da cui copiare. Se un giorno anche il ripiego risulta sbagliato, è
// perché non è mai stato usato da anni: è il posto giusto in cui invecchiare.
var TIPI_RIPIEGO = [
  { nome: "12 mesi", prezzo_kg: 15.9 },
  { nome: "24 mesi", prezzo_kg: 17.9 },
  { nome: "36 mesi", prezzo_kg: 19.9 },
  { nome: "48 mesi", prezzo_kg: 21.9 }
];
// Letti all'APERTURA del modale e non alla conferma, così l'admin vede con cosa parte prima
// di creare. Se il negoziante ha cambiato i prezzi lo scopre adesso, e la correzione in
// fase ① è un gesto consapevole invece di una cosa da ricordarsi.
var _tipiNuovoGruppo = null;

async function apriNuovoGruppo(){
  document.getElementById("ng-titolo").value = "";
  document.getElementById("ng-password").value = "";
  document.getElementById("ng-errore").textContent = "";
  _tipiNuovoGruppo = null;
  var org = document.getElementById("ng-origine");
  var coda = " La password va girata sul gruppo WhatsApp: serve una volta sola per dispositivo.";
  if(org) org.textContent = "Leggo i tipi dell'ultimo giro\u2026" + coda;
  openModal("modal-nuovo-gruppo");
  try{
    var t = await tipiUltimoGruppoArchiviato();
    if(!org) return;
    if(t.length){
      _tipiNuovoGruppo = t;
      org.textContent = "Parte dai tipi dell'ultimo giro archiviato: "
        + t.map(function(x){ return x.nome + " a " + eurTesto(x.prezzo_kg); }).join(", ")
        + " al kg. Li correggi subito dopo dall'admin se il negoziante ha cambiato i prezzi."
        + coda;
    } else {
      org.textContent = "Non c'\u00e8 ancora un giro archiviato da cui copiare: parte dai "
        + "quattro tipi standard a prezzi di ripiego, che sono quasi certamente da "
        + "correggere subito." + coda;
    }
  }catch(e){
    if(org) org.textContent = "Non riesco a leggere l'ultimo giro adesso. Se creo il gruppo "
      + "parte dai prezzi di ripiego, da correggere subito." + coda;
  }
}
function chiudiNuovoGruppo(){ closeModal("modal-nuovo-gruppo"); }
async function confermaNuovoGruppo(){
  var titolo = document.getElementById("ng-titolo").value.trim();
  var password = document.getElementById("ng-password").value.trim();
  if(!titolo){ document.getElementById("ng-errore").textContent = "Dai un nome al gruppo (es. Ottobre 2026)."; return; }
  var tipi = (_tipiNuovoGruppo && _tipiNuovoGruppo.length) ? _tipiNuovoGruppo : TIPI_RIPIEGO;
  try{
    await creaGruppo(titolo, await hashPassword(password), tipi);
    chiudiNuovoGruppo();
    await caricaTutto();
    renderAdmin();
  }catch(e){ document.getElementById("ng-errore").textContent = "Errore: " + e.message; }
}
function confermaArchiviaGruppo(){
  if(confirm('Archiviare "' + gruppo.titolo + '"? Tornerà consultabile dall\'archivio, ma non sarà più modificabile dagli utenti.')){
    eseguiArchiviaGruppo();
  }
}
async function eseguiArchiviaGruppo(){
  try{
    await archiviaGruppo();
    clearMiaIdentita();
    await caricaTutto();
    renderAdmin();
  }catch(e){ alert("Errore: " + e.message); }
}

// ── ELIMINAZIONE DEFINITIVA DI UN GRUPPO ARCHIVIATO ──
// Solo su gruppi archiviati: il gruppo attivo non si tocca. La conferma è ridigitare il
// titolo, non un confirm() — quello si clicca senza leggerlo, e da qui non si torna
// indietro: persone, righe e note se ne vanno in cascata insieme al gruppo.
var _gruppoDaEliminare = null;

function apriEliminaGruppo(id){
  var g = archivioGruppi.find(function(x){ return x.id === id; });
  if(!g) return;
  _gruppoDaEliminare = g;
  document.getElementById("eg-sub").innerHTML =
    'Spariscono per sempre <b>' + escapeHtml(g.titolo) + '</b>, i suoi topini, i loro ordini '
    + 'e le note della bacheca. Non c\'\u00e8 modo di recuperarli.';
  var inp = document.getElementById("eg-titolo");
  inp.value = "";
  document.getElementById("eg-errore").textContent = "";
  document.getElementById("eg-conferma").disabled = true;
  openModal("modal-elimina-gruppo");
  setTimeout(function(){ inp.focus(); }, 60);
}
function chiudiEliminaGruppo(){
  _gruppoDaEliminare = null;
  closeModal("modal-elimina-gruppo");
}
function titoloEliminaCombacia(){
  if(!_gruppoDaEliminare) return false;
  var v = document.getElementById("eg-titolo").value.trim().toLowerCase();
  return v !== "" && v === String(_gruppoDaEliminare.titolo).trim().toLowerCase();
}
function verificaTitoloElimina(){
  document.getElementById("eg-conferma").disabled = !titoloEliminaCombacia();
}
async function confermaEliminaGruppo(){
  if(!_gruppoDaEliminare) return;
  var err = document.getElementById("eg-errore");
  if(!titoloEliminaCombacia()){ err.textContent = "Il titolo non combacia."; return; }
  try{
    await eliminaGruppoArchiviato(_gruppoDaEliminare.id);
    chiudiEliminaGruppo();
    await caricaTutto();
    renderAdmin();
    dot("ok", "Gruppo eliminato");
  }catch(e){ err.textContent = "Errore: " + e.message; }
}

// ── DETTAGLIO ARCHIVIO ──
async function apriDettaglioArchivio(gruppoId){
  var d = await caricaDettaglioArchivio(gruppoId);
  var righeHtml = d.persone.map(function(p){
    var mieRighe = d.righe.filter(function(r){ return r.persona_id === p.id; });
    var dettaglio = mieRighe.map(function(r){
      var t = d.tipi.find(function(x){ return x.id === r.tipo_id; });
      return (t ? t.nome : "?") + " " + parseFloat(r.kg_nominale).toFixed(1) + "kg";
    }).join(", ") || "\u2014";
    var tot = mieRighe.reduce(function(a, r){
      if(r.prezzo_reale != null) return a + parseFloat(r.prezzo_reale);
      var t = d.tipi.find(function(x){ return x.id === r.tipo_id; });
      return a + (t ? parseFloat(t.prezzo_kg) : 0) * parseFloat(r.kg_nominale);
    }, 0);
    // L'unico punto che NON chiama `quotaSpedizione()`: qui si conta su una fotografia
    // (`d.persone`), non sulle persone vive. La formula però dev'essere la stessa — quote,
    // non teste — altrimenti l'archivio e il giro in corso userebbero due aritmetiche.
    // ⚠️ Il `|| 1` è ciò che protegge la storia: i giri chiusi prima della colonna
    // `quote_spedizione` non ce l'hanno, e con il fallback mostrano ESATTAMENTE le cifre
    // di prima. Un archivio che cambia numeri a posteriori è il danno peggiore possibile.
    var quoteDiFoto = function(x){
      return x.partecipa_spedizione ? (parseInt(x.quote_spedizione, 10) || 1) : 0;
    };
    var nQuote = d.persone.reduce(function(a, x){ return a + quoteDiFoto(x); }, 0);
    var mieQuote = quoteDiFoto(p);
    var quota = mieQuote && nQuote ? (parseFloat(d.gruppo.spedizione_totale) || 0) * mieQuote / nQuote : 0;
    return '<tr><td>' + escapeHtml(p.nome) + '</td><td>' + escapeHtml(dettaglio) + '</td><td>' + eur(tot + quota) + '</td>'
      + '<td>' + (p.pagato ? '<span class="badge ok">pagato</span>' : '<span class="badge no">non pagato</span>') + '</td></tr>';
  }).join("");
  var body = document.getElementById("admin-content");
  var backup = body.innerHTML;
  // Il ritorno all'admin sta nell'header, accanto all'altra uscita (vedi index.html).
  mostraTornaAdmin(true);
  body.innerHTML = '<div class="card"><div class="card-titolo">' + escapeHtml(d.gruppo.titolo) + '</div>'
    + '<div class="tabella-wrap"><table class="tb"><thead><tr><th>Nome</th><th>Ordine</th><th>Totale</th><th>Stato</th></tr></thead><tbody>'
    + righeHtml + '</tbody></table></div></div>';
}

// ── CALCOLATRICE (dalla Tana, invariata: solo + e −) ──
// Non sa nulla del contesto che l'ha aperta: riceve l'id del campo target, precarica
// il valore già presente e alla conferma ci riscrive dentro sparando un evento "input".
// Serve a SOMMARE più etichette quando una riga d'ordine è fatta di più pezzi fisici
// (es. 2 kg di 24 mesi = 4 pezzi da ~500 g), non a moltiplicare peso x prezzo.
var _calcTarget = null;
var _calcAcc = 0;        // accumulatore dei numeri già confermati con un operatore
var _calcOp = null;      // operatore in attesa ("+" o "-"); null sul primo numero
var _calcCur = "0";      // numero che si sta digitando (stringa)
var _calcFresh = true;   // true = il prossimo tasto cifra azzera _calcCur

function openCalc(targetId){
  _calcTarget = targetId;
  var campo = document.getElementById(targetId);
  var v = campo ? campo.value : "";
  _calcAcc = 0; _calcOp = null;
  _calcCur = (v && !isNaN(parseFloat(v))) ? String(parseFloat(v)) : "0";
  _calcFresh = true;
  _calcErrore("");
  calcRender();
  openModal("modal-calc");
}
function closeCalc(){ closeModal("modal-calc"); }
function _calcErrore(t){
  var e = document.getElementById("calc-errore");
  if(e) e.textContent = t || "";
}

function calcDigit(d){
  if(_calcFresh){ _calcCur = (d === "." ? "0." : d); _calcFresh = false; }
  else{
    if(d === "."){ if(_calcCur.indexOf(".") > -1) return; }   // una sola virgola
    if(_calcCur === "0" && d !== ".") _calcCur = d;           // niente zeri iniziali
    else _calcCur += d;
  }
  calcRender();
}
function calcBack(){
  if(_calcFresh) return;
  _calcCur = _calcCur.length > 1 ? _calcCur.slice(0, -1) : "0";
  if(_calcCur === "" || _calcCur === "-") _calcCur = "0";
  calcRender();
}
function _calcApplica(){
  var n = parseFloat(_calcCur) || 0;
  if(_calcOp === null) _calcAcc = n;
  else if(_calcOp === "+") _calcAcc = _calcAcc + n;
  else if(_calcOp === "-") _calcAcc = _calcAcc - n;
}
function calcOp(op){
  _calcApplica();
  _calcOp = op;
  _calcFresh = true;
  calcRender(true);
}
function calcClear(){ _calcAcc = 0; _calcOp = null; _calcCur = "0"; _calcFresh = true; calcRender(); }
// Se il campo bersaglio non c'è più (il modale che lo conteneva è stato chiuso, o
// rigenerato sotto), NON si chiude: il risultato resta a schermo e si dice perché.
// Un numero perso in silenzio è il difetto peggiore che questa app possa avere.
function calcConferma(){
  _calcApplica();
  var ris = Math.round(_calcAcc * 100) / 100;
  if(ris < 0) ris = 0;   // un importo negativo non ha senso in un campo prezzo
  var campo = _calcTarget ? document.getElementById(_calcTarget) : null;
  if(!campo){
    _calcErrore("Il campo di destinazione non c'\u00e8 pi\u00f9: riapri la riga e ridigita il totale. Il risultato resta qui.");
    dot("err", "Campo sparito");
    return;
  }
  campo.value = ris;
  // Senza `bubbles` l'handler `oninput` inline non scatta e la riga "ricevuti X kg (\u221216,2%)"
  // resterebbe ferma sul valore vecchio.
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  _calcErrore("");
  closeCalc();
}
function calcRender(mostraAcc){
  var expr = document.getElementById("calc-expr");
  var res = document.getElementById("calc-result");
  if(_calcOp !== null) expr.textContent = String(_calcAcc).replace(".", ",") + " " + (_calcOp === "+" ? "+" : "\u2212");
  else expr.innerHTML = "&nbsp;";
  res.textContent = String(mostraAcc ? _calcAcc : _calcCur).replace(".", ",");
}

// ── MODALE PREZZI REALI DI UNA PERSONA ──
// Meglio di una lista piatta di tutte le righe del gruppo: alla consegna si apre
// il sacchetto di una persona per volta.
var _realiPersona = null;

function apriReali(personaId){
  var p = persone.find(function(x){ return x.id === personaId; });
  if(!p) return;
  _realiPersona = personaId;
  var mie = righeDi(personaId);
  document.getElementById("mr-titolo").textContent = "\uD83D\uDC2D " + p.nome;
  // Il totale dei pezzi PRIMA delle istruzioni: è il numero che serve subito, con il topino
  // sulla porta e il sacchetto da riempire. I chili restano nelle righe, per il conto.
  var totPezzi = mie.reduce(function(a, r){ return a + pezziDa(parseFloat(r.kg_nominale)); }, 0);
  document.getElementById("mr-sub").innerHTML = mie.length
    ? "<b>" + escapeHtml(pezziBreve(totPezzi * PEZZATURA_KG)) + "</b> in tutto. "
      + "Leggi l'importo dall'etichetta di ogni pezzo; se una riga \u00e8 fatta di pi\u00f9 pezzi, sommali con la \uD83E\uDDEE."
    : "";
  document.getElementById("mr-errore").textContent = "";
  var el = document.getElementById("mr-righe");
  el.innerHTML = mie.length ? mie.map(function(r){
    var t = tipi.find(function(x){ return x.id === r.tipo_id; });
    var atteso = (t ? parseFloat(t.prezzo_kg) : 0) * parseFloat(r.kg_nominale);
    return '<div class="mr-riga">'
      + '<div class="mr-info"><div class="mr-tipo">' + escapeHtml(nomeTipo(r.tipo_id)) + '</div>'
      +   '<div class="mr-kg"><b>' + escapeHtml(pezziBreve(parseFloat(r.kg_nominale))) + '</b> \u00b7 '
      +     kgFmt(parseFloat(r.kg_nominale)) + ' \u00b7 atteso ' + eur(atteso) + '</div>'
      +   '<div class="mr-scarto" id="mr-scarto-' + r.id + '">' + testoScartoRiga(r, r.prezzo_reale) + '</div>'
      + '</div>'
      + '<div class="mr-campo inp-euro-wrap">'
      +   '<input class="inp" type="number" min="0" step="0.01" inputmode="decimal" name="prezzo-reale" autocomplete="off" placeholder="\u20ac reale"'
      +     ' id="mr-' + r.id + '" oninput="aggiornaScartoRiga(\'' + r.id + '\')"'
      +     ' value="' + (r.prezzo_reale != null ? r.prezzo_reale : "") + '">'
      +   '<button type="button" class="btn-calc-icon" onclick="openCalc(\'mr-' + r.id + '\')" title="Somma le etichette">\uD83E\uDDEE</button>'
      + '</div></div>';
  }).join("") : '<div class="empty">Questa persona non ha ordinato nulla.</div>';
  openModal("modal-reali");
}
// I kg ricevuti si DERIVANO dall'importo (prezzo_kg è fisso e concordato): niente pesi
// da registrare. Il confronto si ricalcola mentre l'admin digita, perché è lì che un typo
// si nota — 5-8% è il taglio a mano, 30% è un'etichetta battuta male.
function testoScartoRiga(r, valore){
  var k = kgRicevutiRiga(r, valore === "" ? null : valore);
  if(k == null) return "";
  var ord = parseFloat(r.kg_nominale);
  var sc = ord > 0 ? (k - ord) / ord : 0;
  return "ordinati " + kgFmt(ord) + " \u00b7 ricevuti " + kgFmtPreciso(k) + " (" + fmtScarto(sc) + ")";
}
function aggiornaScartoRiga(rigaId){
  var box = document.getElementById("mr-scarto-" + rigaId);
  var campo = document.getElementById("mr-" + rigaId);
  var r = righe.find(function(x){ return x.id === rigaId; });
  if(!box || !campo || !r) return;
  box.textContent = testoScartoRiga(r, campo.value.trim());
}
function chiudiReali(){
  _realiPersona = null;
  closeModal("modal-reali");
}
async function salvaRealiPersona(){
  if(!_realiPersona) return;
  var mie = righeDi(_realiPersona);
  var err = document.getElementById("mr-errore");
  try{
    for(var i = 0; i < mie.length; i++){
      var campo = document.getElementById("mr-" + mie[i].id);
      if(!campo) continue;
      var v = campo.value.trim() === "" ? null : parseFloat(campo.value);
      if(v !== null && (isNaN(v) || v < 0)){ err.textContent = "Un importo non è valido."; return; }
      // Scrivo solo ciò che è davvero cambiato: evita scritture inutili e sveglie del realtime
      var prima = mie[i].prezzo_reale == null ? null : parseFloat(mie[i].prezzo_reale);
      if(v !== prima) await setPrezzoReale(mie[i].id, v);
    }
    chiudiReali();
    await caricaTutto();
    renderAdmin();
    dot("ok", "Prezzi salvati \uD83E\uDDC0");
  }catch(e){ err.textContent = "Errore: " + e.message; }
}

// ── CHIUSURA ORDINI ──
async function salvaChiusuraOrdini(){
  var v = document.getElementById("inp-chiusura").value;
  if(!v){ alert("Scegli una data e un'ora, oppure usa \"Riapri gli ordini\"."); return; }
  var d = new Date(v);
  if(isNaN(d)){ alert("Data non valida."); return; }
  try{ await aggiornaChiusuraOrdini(d.toISOString()); await caricaTutto(); renderAdmin(); dot("ok", "Scadenza impostata \u23F0"); }
  catch(e){ alert("Errore: " + e.message); }
}
async function riapriOrdini(){
  try{ await aggiornaChiusuraOrdini(null); await caricaTutto(); renderAdmin(); dot("ok", "Ordini riaperti \uD83E\uDDC0"); }
  catch(e){ alert("Errore: " + e.message); }
}

// ── ARRIVO DEL PACCO: FLAG + MESSAGGIO, UNA SOLA AZIONE ──
// Segnalare l'arrivo e avvisare il gruppo sono UNITE di proposito: così il banner nella
// tab Ordina e il messaggio WhatsApp non possono divergere (banner acceso e nessun
// avviso mandato, o viceversa). Ordine: prima si scrive `arrivo_segnalato_at`, POI si
// propone il messaggio. Se l'admin annulla la condivisione, il banner resta acceso ed è
// corretto — il pacco è arrivato davvero.
//
// Non si può inviare in automatico senza WhatsApp Business API (sproporzionato qui):
// si prepara il testo e si apre WhatsApp, la chat e l'invio li sceglie l'utente.
// È un ANNUNCIO, non un estratto conto. Riscritto il 03/09/2026 su indicazione di
// iL KaJiNo: fuori i totali per persona, fuori l'elenco dei topini, fuori la spedizione
// e i riferimenti di pagamento.
//
// Perché è giusto anche al di là del gusto: questo testo finisce in una chat di gruppo,
// cioè nel posto MENO adatto a tenere dei numeri. Ogni cifra scritta qui è una copia che
// invecchia da sola — l'admin batte un'etichetta e il messaggio di ieri dice il prezzo
// sbagliato, ma resta lassù da leggere. I numeri vivi stanno nell'app, che è l'unico
// posto dove si aggiornano. E ci finiva dentro chi ha pagato e chi no, davanti a tutti.
//
// Il nome dell'app è scritto a mano e non viene da `gruppo`: è l'insegna del Clan, uguale
// per ogni giro. Quello che cambia è `gruppo.titolo`, la riga sotto.
function testoPaccoArrivato(){
  return "\uD83E\uDDC0 Il parmigiano \u00e8 arrivato!\n\n"
    + "*Il Clan del Parmigiano*\n"
    + gruppo.titolo + "\n\n"
    + "Tutti i topini a raccolta!! \uD83D\uDC01";
}
// Ritorna false se il browser ha rifiutato di aprire qualcosa: chi chiama deve
// avere un piano B, perché a quel punto il flag è già acceso.
function _apriWhatsApp(testo, finestra){
  var url = "https://wa.me/?text=" + encodeURIComponent(testo);
  if(finestra){ finestra.location.href = url; return true; }
  return !!window.open(url, "_blank", "noopener");
}

// Caso residuo: se il blocco popup impedisce anche la `window.open` SINCRONA, `w` è null
// e il messaggio non andrebbe da nessuna parte mentre il flag è già acceso — il difetto
// originale ridotto a caso raro, non eliminato. Il testo finisce negli appunti: l'admin
// ce l'ha comunque in mano, e resta un passaggio in più invece di un avviso perduto.
// `copiaTesto` è la stessa del documento per il negoziante, ramo `execCommand` incluso.
function _ripiegoAppunti(testo){
  copiaTesto(testo);
  // L'alert ruba il focus e la scrittura negli appunti lo richiede: le si lascia
  // finire il giro prima di bloccare il thread.
  setTimeout(function(){
    alert("Il browser ha bloccato l'apertura di WhatsApp.\n\n"
      + "Messaggio copiato: apri il gruppo e incollalo.");
  }, 120);
}

// Prima il flag, poi il messaggio — ma la finestra si apre SUBITO, dentro il gesto
// dell'utente: aperta dopo l'`await` sarebbe un popup senza gesto, e i browser mobili
// la bloccherebbero. Resta about:blank finché la scrittura non è andata a buon fine;
// se fallisce si chiude e il banner non si accende, che è il caso in cui i due
// effetti DEVONO restare allineati.
async function segnalaArrivoAlGruppo(){
  var w = window.open("", "_blank");
  try{ if(w) w.opener = null; }catch(e){}
  try{
    await segnalaArrivoPacco();
    await caricaTutto();
    renderAdmin();
    var testo = testoPaccoArrivato();
    if(w) _apriWhatsApp(testo, w); else _ripiegoAppunti(testo);
    dot("ok", "Arrivo segnalato \uD83E\uDDC0");
  }catch(e){
    if(w) w.close();
    alert("Non sono riuscito a segnalare l'arrivo: " + e.message);
  }
}

// Rimandare il messaggio NON riscrive la data: il pacco è arrivato quando è arrivato,
// e "arrivato il 12 ottobre" non deve diventare "il 15" perché l'admin ha rimandato
// l'avviso a chi non l'aveva letto.
function rimandaMessaggioArrivo(){
  var testo = testoPaccoArrivato();
  if(!_apriWhatsApp(testo, null)) _ripiegoAppunti(testo);
}

// Per il click sbagliato: rimette a NULL e il banner si spegne per tutti.
async function annullaSegnalazioneArrivo(){
  if(!confirm("Spengo il banner \"Il formaggio \u00e8 arrivato\" per tutti i topini. Confermi?")) return;
  try{
    await annullaArrivoPacco();
    await caricaTutto();
    renderAdmin();
    dot("ok", "Segnalazione annullata");
  }catch(e){ alert("Errore: " + e.message); }
}

// ── DOCUMENTO B: riepilogo PDF per il gruppo WhatsApp ──
// jsPDF sta NEL REPO, non su CDN: così l'export funziona anche offline e non si rompe il
// giorno che cdnjs cambia URL. (Prima era escluso dalla cache del service worker, quindi
// l'export richiedeva sempre connessione.) Resta caricato pigramente: 360 KB che servono
// una volta ogni tanto non devono pesare sull'apertura dell'app.
// `pdf-assets.js` (le immagini del banner) viaggia con lui, per la stessa ragione.
function _conJsPDF(cb){
  var mancanti = [];
  if(typeof window.jspdf    === "undefined") mancanti.push("./jspdf.umd.min.js");
  if(typeof window.PDF_LOGO === "undefined") mancanti.push("./pdf-assets.js");
  (function passo(){
    if(!mancanti.length){ cb(); return; }
    var s = document.createElement("script");
    s.src = mancanti.shift();
    s.onload = passo;
    s.onerror = function(){ alert("Non riesco a caricare il generatore PDF."); };
    document.head.appendChild(s);
  })();
}
function esportaPDF(){ _conJsPDF(_generaPDF); }

// Le font standard del PDF non hanno le emoji: senza questo diventano quadratini.
function _pdfStrip(s){
  return String(s || "").replace(/[\u{1F000}-\u{1FFFF}]/gu, "").replace(/[\u2600-\u27BF]/gu, "").replace(/\uFE0F/g, "").trim();
}

// UN SOLO bottone, non due: il documento si adatta da solo, con la stessa regola già usata
// da `renderMioTotale` — se esiste almeno un prezzo reale mostra atteso E reale, altrimenti
// solo l'atteso. Le coordinate di pagamento stanno sempre in fondo: è il documento che dice
// "adesso pagatemi". Fuori invece le segnalazioni in attesa — sono uno strumento di lavoro
// dell'admin, in un documento condiviso diventerebbero solo "perché lui è in attesa e io no".
// Privacy: espone i totali di tutti a tutti, esattamente come la tab Tabella che già vedono.
// Non è una nuova esposizione, è la stessa in un altro formato. Scelta consapevole.
function _generaPDF(){
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var _origText = doc.text.bind(doc);
  doc.text = function(str, x, y, opts){ return _origText(typeof str === "string" ? _pdfStrip(str) : str, x, y, opts); };

  var W = 210, margin = 14, destra = W - margin;
  var CHEESE = [201, 135, 31], DARK = [40, 28, 10], GRAY = [120, 100, 75], MOSS = [72, 106, 54];
  var conReale = righe.some(function(r){ return r.prezzo_reale != null; });

  // La colonna "reale" compare solo dopo la consegna; senza di lei le altre respirano.
  var col = conReale
    ? { ordine: 52, wOrdine: 60, atteso: 128, reale: 148, sped: 165, tot: 182 }
    : { ordine: 54, wOrdine: 72, atteso: 148,              sped: 165, tot: 182 };

  // Banner: logo a sinistra, striscia in filigrana a destra. `PDF_LOGO` e `PDF_STRIP`
  // stanno in `pdf-assets.js` come PNG base64 perché jsPDF non disegna SVG, e un
  // riferimento a un file mancante romperebbe il PDF in silenzio.
  // ⚠️ Il fondo delle due immagini è già APPIATTITO su #C9871F, cioè su CHEESE qui sotto:
  //    se cambia il colore del banner vanno RIGENERATE, altrimenti compaiono due
  //    rettangoli gialli del tono vecchio.
  // ⚠️ La filigrana deve restare decorazione periferica. Questo PDF è il documento in cui
  //    la gente legge quanto deve pagare: se un giorno la striscia diventa più marcata,
  //    l'importo smette di essere la cosa più visibile della pagina.
  function intestazione(){
    doc.setFillColor(CHEESE[0], CHEESE[1], CHEESE[2]);
    doc.rect(0, 0, W, 26, "F");
    doc.addImage(PDF_LOGO, "PNG", margin, 4, 18, 18);
    var sx = 118, sw = W - sx - 6;
    doc.addImage(PDF_STRIP, "PNG", sx, 4, sw, sw * 118 / 950);   // 950x118 = proporzioni native
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("Il Clan del Parmigiano", margin + 23, 12);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(gruppo.titolo + " \u2014 generato il " + new Date().toLocaleDateString("it-IT"), margin + 23, 19);
    return 34;
  }
  function intestazioneColonne(y){
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text("Nome", margin, y);
    doc.text("Ordine", col.ordine, y);
    doc.text(conReale ? "Atteso" : "Parmigiano", col.atteso, y, { align: "right" });
    if(conReale) doc.text("Reale", col.reale, y, { align: "right" });
    doc.text("Sped.", col.sped, y, { align: "right" });
    doc.text("Totale", col.tot, y, { align: "right" });
    doc.text("Stato", destra, y, { align: "right" });
    y += 2.5;
    doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.line(margin, y, destra, y);
    return y + 4.5;
  }

  var y = intestazioneColonne(intestazione());

  persone.forEach(function(p){
    if(y > 252){ doc.addPage(); y = intestazioneColonne(margin + 4); }
    var dettaglio = righeDi(p.id).map(function(r){
      return nomeTipo(r.tipo_id) + " " + kgTesto(parseFloat(r.kg_nominale));
    }).join(", ") || "-";
    var righeDett = doc.splitTextToSize(dettaglio, col.wOrdine);

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    // Il «+2» anche qui: il PDF è la riga che porta il totale di ciascuno, ed è il foglio
    // che gira fuori dall'app. Dove si vede un totale si deve vedere perché è più alto.
    var etQ = etichettaQuote(p);
    doc.text(p.nome + (etQ ? " " + etQ : ""), margin, y);

    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(righeDett, col.ordine, y);
    var altezzaOrdine = righeDett.length * 3.4;

    // I kg ricevuti sono derivati dagli importi delle etichette: nessun peso registrato.
    var cKg = confrontoKg(p.id);
    if(cKg){
      doc.setFontSize(6.8); doc.setTextColor(MOSS[0], MOSS[1], MOSS[2]);
      doc.text("ricevuti " + kgFmtPreciso(cKg.ricevuti).replace(/\u00a0/g, " ")
        + " (" + fmtScarto(cKg.scarto).replace("\u2212", "-") + ")", col.ordine, y + altezzaOrdine + 0.6);
      altezzaOrdine += 3.4;
    }

    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text(eurTesto(totaleIpotetico(p.id)), col.atteso, y, { align: "right" });
    if(conReale){
      doc.setTextColor(MOSS[0], MOSS[1], MOSS[2]);
      doc.text(eurTesto(totaleOrdine(p.id)), col.reale, y, { align: "right" });
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    }
    doc.text(eurTesto(quotaSpedizione(p)), col.sped, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(eurTesto(totaleDovuto(p)), col.tot, y, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(p.pagato ? "pagato" : "da pagare", destra, y, { align: "right" });

    y += Math.max(7, altezzaOrdine + 3);
  });

  // ── Totali di gruppo ──
  if(y > 246){ doc.addPage(); y = margin + 4; }
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.line(margin, y, destra, y);
  y += 6;
  var totGruppo = persone.reduce(function(a, p){ return a + totaleDovuto(p); }, 0);
  var kgGruppo = persone.reduce(function(a, p){ return a + kgTotaliDi(p.id); }, 0);
  var nPagati = persone.filter(function(p){ return p.pagato; }).length;
  var nQuotePdf = quoteSpedizioneTotali();
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Totale gruppo: " + eurTesto(totGruppo), margin, y);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(kgTesto(kgGruppo) + " di parmigiano \u00b7 spedizione "
    + eurTesto(parseFloat(gruppo.spedizione_totale) || 0) + " divisa fra "
    + nQuotePdf + " " + paroleDivisore(nQuotePdf)
    + " \u00b7 " + nPagati + " su " + persone.length + " hanno pagato",
    margin, y + 4.5);
  y += 14;

  // ── Come pagare: sempre in fondo, è il documento che dice "adesso pagatemi" ──
  var coordinate = [];
  if(impostazioni.iban) coordinate.push("IBAN: " + impostazioni.iban);
  if(impostazioni.paypal_link) coordinate.push("PayPal: " + impostazioni.paypal_link);
  if(impostazioni.satispay_link) coordinate.push("Satispay: " + impostazioni.satispay_link);
  coordinate.push("Oppure in contanti, di persona.");
  if(y + coordinate.length * 4.6 + 20 > 285){ doc.addPage(); y = margin + 4; }
  doc.setFillColor(250, 244, 232);
  doc.rect(margin, y, destra - margin, coordinate.length * 4.6 + 12, "F");
  y += 7;
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Come pagare", margin + 4, y);
  y += 5.5;
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
  coordinate.forEach(function(riga){ doc.text(riga, margin + 4, y); y += 4.6; });

  // La colonna "Stato" nel PDF RESTA: è decisione dell'utente, che conosce il gruppo.
  // Quello che resta vero comunque è il supporto: un PDF è una fotografia e gira su WhatsApp,
  // quello generato alle 18 circola ancora alle 21, quando tre persone hanno già pagato. La
  // riga qui sotto è DATATA di proposito — senza data contraddirebbe la colonna, con la data
  // ne diventa la didascalia e fa dichiarare al file la propria età. L'ora è quella di
  // generazione del PDF, nel formato già in uso nell'app.
  y += 4;
  doc.setFontSize(7.5); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text("Stato dei pagamenti aggiornato al " + fmtDataOra(new Date().toISOString())
    + ". In app è sempre aggiornato.", margin, y);

  doc.save("clan-parmigiano-" + gruppo.titolo.replace(/\s+/g, "-").toLowerCase() + ".pdf");
}
