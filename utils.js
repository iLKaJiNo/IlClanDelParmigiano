// ════════════════════════════════════════════════════════
//  Il Clan del Parmigiano — utils.js
//  Config Supabase, stato globale, helper puri.
// ════════════════════════════════════════════════════════

var SUPABASE_URL = "https://tsijezusxvljxmobpvtc.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaWplenVzeHZsanhtb2JwdnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTQxMTUsImV4cCI6MjEwMzU3MDExNX0.U_pLSUmD8sciYhvunjD07F8BpO53tHzzLnoJeQxQadw";
var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── STATO GLOBALE ──
var gruppo = null;          // gruppo_acquisto attivo
var tipi = [];               // tipi_parmigiano del gruppo attivo
var persone = [];            // persone del gruppo attivo
var righe = [];               // righe_ordine (di tutte le persone, per la tabella)
var impostazioni = { pin_hash: null, iban: "", paypal_link: "", satispay_link: "" };
var archivioGruppi = [];     // gruppi archiviati (solo id/titolo/date, per la lista)
var note = [];               // bacheca del gruppo attivo, dalla più recente

var mioId = null;            // persona.id scelta su questo device (per il gruppo corrente)
var adminOk = false;         // sbloccato in questa sessione di tab (sessionStorage)

var currentTab = "ordina";
var TABS = ["ordina", "tabella", "bacheca", "pagamenti"]; // + "admin" sempre visibile a parte

// ── TEMA E SFONDO (per-device: dipendono dal display, non dalla persona) ──
// Il Clan nasce scuro, quindi qui è :root a essere scuro e `body.chiaro` a
// ridefinire le stesse variabili — l'opposto della Tana, stesso principio.
var THEME_KEY = "clan_parm_tema";
var TILE_KEY  = "clan_parm_tile";

// Chrome ignora `navigator.vibrate()` finché l'utente non ha interagito col documento
// (*sticky user activation*); su iOS Safari `navigator.vibrate` non esiste proprio.
// Non è un difetto dell'app: è una regola della piattaforma. Tre cose misurate, non
// dedotte — la frase che stava qui prima («un `vibrate(0)` attiva il documento») era
// falsa, ed è costata tre sessioni di giri a vuoto:
//  1. l'attivazione la concede SOLO il browser, dispatchando un evento di gesto.
//     Chiamare `vibrate()` non ne concede: dopo `navigator.vibrate(1)`,
//     `navigator.userActivation.hasBeenActive` resta `false`. Un'API gated non si
//     scalda chiamandola — l'innesco nel <head> di index.html è una sonda, non una cura;
//  2. non tutti gli eventi di un gesto danno attivazione. La danno `keydown`,
//     `mousedown`, `mouseup`, `click`, `pointerup` e `touchend`; `pointerdown` solo se
//     `pointerType` è `"mouse"`. Su un telefono l'inizio del gesto non conta, ed è per
//     questo che l'innesco ascolta anche `pointerup`/`touchend`;
//  3. `vibra()` va chiamata come PRIMA istruzione di un handler, mai dopo un `await`:
//     l'attivazione utente scade, e dopo l'await il browser non la riconosce più.
// Collaudo su telefono del 01/09/2026: con queste tre regole rispettate il primo swipe
// di una sessione vibra. Lo swipe È un gesto sufficiente per Chrome.
function vibra(ms){
  try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){}
}

function applyTheme(chiaro){
  // La classe di pre-paint su <html> ha specificità maggiore di body.chiaro:
  // se restasse, il toggle verso lo scuro non avrebbe alcun effetto.
  document.documentElement.classList.remove("pre-chiaro");
  document.body.classList.toggle("chiaro", chiaro);
  var b = document.getElementById("btn-tema");
  if(b){ b.textContent = chiaro ? "\uD83C\uDF19" : "\u2600\uFE0F"; b.title = chiaro ? "Passa al tema scuro" : "Passa al tema chiaro"; }
  var meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", chiaro ? "#F6EAD3" : "#241708");
}
function toggleTema(){
  var chiaro = !document.body.classList.contains("chiaro");
  try{ localStorage.setItem(THEME_KEY, chiaro ? "chiaro" : "scuro"); }catch(e){}
  vibra(12);
  applyTheme(chiaro);
}
function initTheme(){
  var saved = null;
  try{ saved = localStorage.getItem(THEME_KEY); }catch(e){}
  applyTheme(saved === "chiaro");   // default: scuro, è l'identità visiva dell'app
}

function applyTile(on){
  document.documentElement.classList.remove("pre-tile");
  document.body.classList.toggle("tile-on", on);
  var b = document.getElementById("btn-tile");
  if(b){ b.classList.toggle("spento", !on); b.title = on ? "Nascondi lo sfondo" : "Mostra lo sfondo a formaggio"; }
}
function toggleTile(){
  var on = !document.body.classList.contains("tile-on");
  try{ localStorage.setItem(TILE_KEY, on ? "on" : "off"); }catch(e){}
  vibra(12);
  applyTile(on);
}
function initTile(){
  var saved = null;
  try{ saved = localStorage.getItem(TILE_KEY); }catch(e){}
  applyTile(saved !== "off");       // default: acceso
}

// ── SCHERMATE ──
function mostraSchermata(id){
  document.querySelectorAll(".screen").forEach(function(s){ s.classList.toggle("attiva", s.id === id); });
}

// ── HELPER FORMATO ──
function eur(n){
  return (Math.round((n||0)*100)/100).toFixed(2).replace(".", ",") + "\u00a0\u20ac";
}
function kgFmt(n){
  var v = Math.round((n || 0) * 10) / 10;
  return (v === Math.trunc(v) ? String(v) : v.toFixed(1).replace(".", ",")) + "\u00a0kg";
}
// kg a due decimali: serve per i kg RICEVUTI, dove i grammi sono l'informazione
// (2,16 kg contro 2,2 kg: la seconda forma nasconde proprio lo scarto che si vuole vedere).
function kgFmtPreciso(n){
  return (Math.round((n || 0) * 100) / 100).toFixed(2).replace(".", ",") + "\u00a0kg";
}
// Varianti per il testo che esce dall'app (copia-incolla, PDF, WhatsApp): lo spazio
// unificatore va benissimo a schermo, ma incollato altrove diventa un carattere strano.
function eurTesto(n){ return eur(n).replace(/\u00a0/g, " "); }
function kgTesto(n){ return kgFmt(n).replace(/\u00a0/g, " "); }
function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function fmtData(iso){
  if(!iso) return "";
  var d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

// ── HASH PIN (SHA-256) ──
async function sha256(str){
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2, "0"); }).join("");
}

// ── PEZZATURA E PASSO DELL'ORDINE ──
// PEZZATURA_KG e KG_STEP sono ACCOPPIATE: lo stepper si muove di un pezzo per volta.
// Se un giorno arrivassero pezzi da 1 kg andrebbero portate a 1 tutte e due, altrimenti
// si finirebbe per ordinare mezzo pezzo. Cambiarne una sola è un bug, non una svista.
// Le pezzature anomale occasionali si scrivono a parole in `gruppi_acquisto.note_negoziante`:
// non si modellano.
var PEZZATURA_KG = 0.5;
var KG_STEP = 0.5;
var KG_MAX = 50;

// Numero di pezzi sottovuoto: esatto, perché i kg sono sempre multipli della pezzatura.
function pezziDa(kg){ return Math.round((kg || 0) / PEZZATURA_KG); }
function pezziTesto(kg){
  var n = pezziDa(kg);
  return n + (n === 1 ? " pezzo" : " pezzi") + " sottovuoto da " + kgTesto(PEZZATURA_KG);
}

// ── CALCOLI ──
// Righe di una persona
function righeDi(personaId){
  return righe.filter(function(r){ return r.persona_id === personaId; });
}
// Totale ordine di una persona: prezzo_reale se presente, altrimenti kg_nominale * prezzo_kg del tipo
function totaleOrdine(personaId){
  return righeDi(personaId).reduce(function(a, r){
    if(r.prezzo_reale != null) return a + parseFloat(r.prezzo_reale);
    return a + parseFloat(r.kg_nominale) * prezzoKgDi(r.tipo_id);
  }, 0);
}
// Costo parmigiano "ipotetico": sempre kg_nominale x prezzo_kg, anche dove esiste già
// il prezzo reale. Serve per mostrare atteso e reale affiancati invece che alternati.
function totaleIpotetico(personaId){
  return righeDi(personaId).reduce(function(a, r){
    return a + parseFloat(r.kg_nominale) * prezzoKgDi(r.tipo_id);
  }, 0);
}
// Vero se l'admin ha già inserito almeno un prezzo dall'etichetta per questa persona
function haPrezziReali(personaId){
  return righeDi(personaId).some(function(r){ return r.prezzo_reale != null; });
}
// Quanti partecipano alla spedizione (per dividerla)
function numeroPartecipantiSpedizione(){
  return persone.filter(function(p){ return p.partecipa_spedizione; }).length;
}
function quotaSpedizione(persona){
  if(!persona.partecipa_spedizione) return 0;
  var n = numeroPartecipantiSpedizione();
  if(n <= 0) return 0;
  return (gruppo ? parseFloat(gruppo.spedizione_totale) || 0 : 0) / n;
}
function totaleDovuto(persona){
  return totaleOrdine(persona.id) + quotaSpedizione(persona);
}
function kgTotaliDi(personaId){
  return righeDi(personaId).reduce(function(a, r){ return a + parseFloat(r.kg_nominale); }, 0);
}
// ── KG RICEVUTI: derivati, mai registrati ──
// Il prezzo al kg è fisso e concordato; varia solo il peso dei pezzi, perché il taglio è
// a mano. Quindi `prezzo_reale / prezzo_kg` È il peso ricevuto — esatto, non stimato.
// L'admin continua a battere solo gli importi delle etichette: nessun peso da digitare.
function prezzoKgDi(tipoId){
  var t = tipi.find(function(x){ return x.id === tipoId; });
  return t ? parseFloat(t.prezzo_kg) || 0 : 0;
}
// `valore` permette di derivare i kg da un importo ancora non salvato (il campo che l'admin
// sta digitando), oltre che da quello già a DB.
function kgRicevutiRiga(r, valore){
  if(!r) return null;
  var v = (valore === undefined) ? r.prezzo_reale : valore;
  if(v == null || v === "") return null;
  v = parseFloat(v);
  if(isNaN(v)) return null;
  var pk = prezzoKgDi(r.tipo_id);
  if(!(pk > 0)) return null;         // guardia: senza prezzo al kg la divisione non esiste
  return v / pk;
}
// Confronto ordinato/ricevuto, limitato alle righe che hanno GIÀ il prezzo reale:
// mescolare righe prezzate e righe ancora vuote darebbe uno scarto inventato.
function confrontoKg(personaId){
  var ord = 0, ric = 0, n = 0;
  righeDi(personaId).forEach(function(r){
    var k = kgRicevutiRiga(r);
    if(k == null) return;
    ord += parseFloat(r.kg_nominale); ric += k; n++;
  });
  if(!n || !(ord > 0)) return null;
  return { ordinati: ord, ricevuti: ric, scarto: (ric - ord) / ord };
}
// Lo scarto si mostra, non si interpreta: 5–8% è il taglio a mano, 30% è un'etichetta
// battuta male. Chi guarda capisce al volo; il codice non deve decidere al posto suo,
// e così intercetta anche i typo.
function fmtScarto(fr){
  var p = (fr || 0) * 100;
  return (p < 0 ? "\u2212" : "+")
    + (Math.round(Math.abs(p) * 10) / 10).toFixed(1).replace(".", ",") + "%";
}
function testoConfrontoKg(c){
  return "ordinati " + kgFmt(c.ordinati) + " \u00b7 ricevuti " + kgFmtPreciso(c.ricevuti)
    + " (" + fmtScarto(c.scarto) + ")";
}

// ── QUADRATURA SULLO SCONTRINO ──
// Somma degli importi letti dalle etichette, su tutto il gruppo. Solo parmigiano:
// la spedizione vive in `gruppo.spedizione_totale` e non entra qui.
function sommaPrezziReali(){
  return righe.reduce(function(a, r){
    return r.prezzo_reale == null ? a : a + parseFloat(r.prezzo_reale);
  }, 0);
}
// L'admin anticipa la spesa, quindi conosce il totale reale del parmigiano PRIMA di
// distribuire i pezzi: è un checksum. Se la somma degli importi assegnati non fa quel
// numero, un'etichetta è stata battuta male — e si scopre subito, non quando un topino
// ha già pagato 12 € di troppo.
function quadratura(){
  if(!gruppo || gruppo.costo_reale_totale == null) return null;
  var tot = parseFloat(gruppo.costo_reale_totale);
  if(isNaN(tot)) return null;
  var assegnato = sommaPrezziReali();
  return { scontrino: tot, assegnato: assegnato, residuo: tot - assegnato };
}

// Kg totali per tipo, su tutto il gruppo (statistiche pubbliche)
function kgPerTipo(){
  return tipi.map(function(t){
    var kg = righe.reduce(function(a, r){
      return r.tipo_id === t.id ? a + parseFloat(r.kg_nominale) : a;
    }, 0);
    return { tipo: t, nome: t.nome, kg: kg };
  });
}
// ── DOCUMENTO A: l'ordine per il negoziante ──
// Testo copiabile, non PDF: il bisogno reale è incollarlo in una email, e un allegato
// costringerebbe ad aprirlo. Bonus: nessuna dipendenza, funziona anche offline.
// Aggregato PER TIPO (il negoziante non deve sapere chi ha ordinato cosa), righe a zero
// omesse, nessun nome e NESSUN PREZZO: i prezzi li fa lui, ed è la ragione per cui esiste
// `prezzo_reale`. Il totale ipotetico si mostra in app accanto al bottone, fuori dal testo.
function testoOrdineNegoziante(){
  var dati = kgPerTipo().filter(function(d){ return d.kg > 0; });
  var tot = dati.reduce(function(a, d){ return a + d.kg; }, 0);
  var t = "Ordine parmigiano \u2014 " + (gruppo ? gruppo.titolo : "") + "\n\n";
  t += (dati.length
        ? dati.map(function(d){
            return d.nome + " \u2014 " + kgTesto(d.kg) + " (" + pezziTesto(d.kg) + ")";
          }).join("\n")
        : "Nessun ordine.") + "\n\n";
  t += "Totale: " + kgTesto(tot);
  var n = gruppo && gruppo.note_negoziante ? String(gruppo.note_negoziante).trim() : "";
  if(n) t += "\n\n" + n;
  return t;
}

// "Topino grasso": chi ha ordinato più kg. Solo client, nessuna colonna in più.
// In caso di parità vincono tutti — è una medaglia scherzosa, non una classifica.
function topiniGrassi(){
  var max = 0;
  persone.forEach(function(p){ var k = kgTotaliDi(p.id); if(k > max) max = k; });
  if(max <= 0) return [];
  return persone.filter(function(p){ return kgTotaliDi(p.id) === max; }).map(function(p){ return p.id; });
}
function nomeTipo(tipoId){
  var t = tipi.find(function(x){ return x.id === tipoId; });
  return t ? t.nome : "?";
}

// ── METODI DI PAGAMENTO ──
var METODI = [
  { id: "bonifico", nome: "Bonifico / IBAN", ico: "\uD83C\uDFE6" },
  { id: "paypal",   nome: "PayPal",          ico: "\uD83D\uDCB3" },
  { id: "satispay", nome: "Satispay",        ico: "\uD83D\uDCF2" },
  { id: "contanti", nome: "Contanti",        ico: "\uD83D\uDCB6" }
];
function metodoDi(id){
  return METODI.find(function(m){ return m.id === id; }) || null;
}
function nomeMetodo(id){
  var m = metodoDi(id);
  return m ? m.ico + " " + m.nome : (id || "\u2014");
}

// L'importo che il topino deve pagare: `totaleDovuto` usa già il prezzo reale dove l'admin
// l'ha inserito e ripiega sull'ipotetico altrove, spedizione inclusa. È esattamente la
// regola descritta in §5.F0, quindi non serve un secondo calcolo che potrebbe divergere.

// paypal.me accetta l'importo nel percorso: paypal.me/nome/12.34 — punto decimale, non virgola.
// Il pagante può comunque modificarlo prima di confermare: limite noto di PayPal.me,
// non aggirabile, per questo l'importo resta anche scritto in chiaro accanto al bottone.
function linkPayPalConImporto(base, importo){
  if(!base) return null;
  var b = String(base).trim().replace(/\/+$/, "");
  if(!/^https?:\/\//i.test(b)) b = "https://" + b;
  if(b.toLowerCase().indexOf("paypal.me") === -1) return b;   // non è un paypal.me: lascio com'è
  return b + "/" + (Math.round((importo || 0) * 100) / 100).toFixed(2);
}

// ── IDENTITÀ (per-device, per-gruppo) ──
function chiaveIdentita(){ return "clan_parm_persona_" + (gruppo ? gruppo.id : "none"); }
function getMiaIdentita(){ try{ return localStorage.getItem(chiaveIdentita()); }catch(e){ return null; } }
function setMiaIdentita(id){ try{ localStorage.setItem(chiaveIdentita(), id); }catch(e){} }
function clearMiaIdentita(){ try{ localStorage.removeItem(chiaveIdentita()); }catch(e){} }
// `persone.is_admin` è il flag pubblico del gruppo, non il PIN: dice a tutti a chi
// chiedere, e qui serve a decidere chi deve vedere la coda delle segnalazioni.
// Chi non è admin non deve vedere nulla, nemmeno il pallino.
function sonoAdmin(){
  var io = mioId && persone.find(function(p){ return p.id === mioId; });
  return !!(io && io.is_admin);
}

// ── SEGNALAZIONI DI PAGAMENTO IN ATTESA ──
// Nessuno stato nuovo a DB: la coda si conta da `pagamento_segnalato`, e si svuota da sola
// quando l'admin conferma (`pagato` a true azzera anche il flag). Una sola funzione perché
// il numero compare in quattro posti — pallino, banner, riga "Tocca a te", card della ⑤ —
// e quattro filtri copiati sono quattro occasioni di divergere.
function segnalazioniInAttesa(){
  return persone.filter(function(p){ return p.pagamento_segnalato && !p.pagato; });
}

// ── CHIUSURA ORDINI ──
// Vincolo lato client, come tutto il resto dell'app: serve a non far pasticciare
// per distrazione, non a impedire una modifica a chi apre la console.
function ordiniChiusi(){
  if(!gruppo || !gruppo.chiusura_ordini) return false;
  var t = new Date(gruppo.chiusura_ordini);
  return !isNaN(t) && Date.now() > t.getTime();
}
function fmtDataOra(iso){
  if(!iso) return "";
  var d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("it-IT",
    { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
// ISO -> valore per <input type="datetime-local">, che vuole l'ora LOCALE senza fuso
function isoToInputLocale(iso){
  if(!iso) return "";
  var d = new Date(iso);
  if(isNaN(d)) return "";
  function p(n){ return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
    + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

// ── ARRIVO DEL PACCO ──
// Flag ESPLICITO, non derivato da `prezzo_reale`: i due eventi non coincidono. L'admin
// può battere il primo prezzo mentre spacchetta a casa — e in quel momento un "passa a
// ritirare" parlerebbe a gente che non ha ancora un pezzo pronto; oppure può voler
// avvisare il gruppo appena il corriere consegna, prima di aver letto una sola etichetta.
// L'arrivo è un fatto che l'admin DECIDE, non la conseguenza di un dato.
// Timestamp e non booleano perché il banner deve poter dire "arrivato il 12 ottobre":
// tre settimane dopo è più utile di un generico "è arrivato", e costa uguale.
function arrivoSegnalato(){ return (gruppo && gruppo.arrivo_segnalato_at) || null; }

// ── PASSWORD DI GRUPPO (per-device, chiesta al primo ingresso) ──
// A DB c'è solo l'impronta SHA-256, mai il testo: stesso trattamento del PIN admin.
// NON è sicurezza vera — chi ha la anon key legge l'hash e può provare a forzarlo — ma
// toglie l'unica credenziale che stava in chiaro nel database, e conserva la proprietà
// utile: il device ricorda l'hash, quindi cambiando password decadono tutti gli sblocchi.
// La normalizzazione (trim + minuscole) sta DENTRO l'hash, non nel confronto: la password
// gira su WhatsApp e viene ridigitata a mano su tastiere che maiuscolano da sole.
function normalizzaPassword(s){ return String(s == null ? "" : s).trim().toLowerCase(); }
async function hashPassword(s){
  var t = normalizzaPassword(s);
  return t ? await sha256(t) : null;
}
// Restituisce l'IMPRONTA, non la password: il testo in chiaro non esiste più da nessuna parte.
function passwordGruppoHash(){
  var v = gruppo && gruppo.password_hash;
  return (v && String(v).trim()) ? String(v).trim() : null;
}
function chiaveSblocco(){ return "clan_parm_sblocco_" + (gruppo ? gruppo.id : "none"); }
function gruppoSbloccato(){
  var h = passwordGruppoHash();
  if(!h) return true;                    // nessuna password impostata: porta aperta
  try{ return localStorage.getItem(chiaveSblocco()) === h; }catch(e){ return false; }
}
function segnaSbloccato(){
  var h = passwordGruppoHash();
  if(!h) return;
  try{ localStorage.setItem(chiaveSblocco(), h); }catch(e){}
}
async function passwordCorretta(tentativo){
  var h = passwordGruppoHash();
  if(!h) return true;
  return (await hashPassword(tentativo)) === h;
}

// ── STACK DEI MODALI ──
// Tutti gli overlay hanno lo stesso `z-index:1000` in CSS: a parità vince l'ordine nel DOM,
// quindi un modale aperto DOPO poteva finire SOTTO a uno aperto prima (la calcolatrice
// sepolta dal modale dei prezzi reali). Lo z-index non si decide più a mano nel CSS: lo
// decide l'ordine di apertura, che è l'unico che conosce chi sta sopra a chi.
var _modalStack = [];
function openModal(id){
  var el = document.getElementById(id);
  if(!el || _modalStack.indexOf(id) > -1) return;
  el.style.zIndex = 1000 + _modalStack.length * 10;
  _modalStack.push(id);
  el.classList.add("open");
  document.body.classList.add("modal-aperto");
}
function closeModal(id){
  var el = document.getElementById(id);
  if(!el) return;
  el.classList.remove("open");
  el.style.zIndex = "";
  _modalStack = _modalStack.filter(function(x){ return x !== id; });
  if(!_modalStack.length){
    document.body.classList.remove("modal-aperto");
    // Il realtime si è tenuto da parte i ridisegni saltati mentre il modale era aperto.
    if(typeof renderAdminDifferito === "function") renderAdminDifferito();
  }
}
// Chi sta in cima. Serve ai click sullo sfondo: senza, un tocco a lato della calcolatrice
// chiuderebbe il modale che sta sotto e si ricadrebbe nel bug di partenza.
function topModal(){ return _modalStack[_modalStack.length - 1] || null; }
function modaleAperto(){ return _modalStack.length > 0; }
