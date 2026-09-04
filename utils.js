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
var impostazioni = { iban: "", paypal_link: "", satispay_link: "" };
var archivioGruppi = [];     // gruppi archiviati (solo id/titolo/date, per la lista)
var note = [];               // bacheca del gruppo attivo, dalla più recente

var mioId = null;            // persona.id scelta su questo device (per il gruppo corrente)

// ── AUTENTICAZIONE ADMIN ──
// L'autorizzazione sta sull'EMAIL, non sul dispositivo. È la scelta che fa funzionare
// tutto il resto: si può autorizzare qualcuno PRIMA che entri, e la sua identità lo segue
// su telefono e computer senza righe da gestire. Chi non è admin non si autentica affatto
// e continua con la chiave anonima, esattamente come prima, senza accorgersi di nulla.
var authUser = null;         // utente Supabase autenticato su questo device, o null
var eAdmin = false;          // risposta di e_admin(): l'autorità è la TABELLA, non l'accesso
var adminAutorizzati = [];   // le email autorizzate — la lista non è leggibile da `anon`

var currentTab = "ordina";
var TABS = ["ordina", "tabella", "bacheca", "pagamenti"]; // + "admin" sempre visibile a parte

// ── TEMA E SFONDO (per-device: dipendono dal display, non dalla persona) ──
// Il Clan nasce scuro, quindi qui è :root a essere scuro e `body.chiaro` a
// ridefinire le stesse variabili — l'opposto della Tana, stesso principio.
var THEME_KEY = "clan_parm_tema";
var ORDINE_KEY = "clan_parm_ordine_tabella";
var TILE_KEY  = "clan_parm_tile";

// ── LA VERSIONE DELLA GUIDA ──
// La guida si apre da sola al primo ingresso di un topino, e poi mai più — a meno che non
// CAMBI. Non si riapre a ogni giro nuovo, ed è una scelta: una guida che ricompare quando
// la conosci già insegna a chiuderla senza leggerla, e poi fallisce l'unica volta che
// conta davvero, con un topino nuovo. Ma una guida che è cambiata merita di essere rivista.
//
// Quindi un intero solo. `GUIDA_VERSIONE` sale quando i testi cambiano davvero (col voto
// al formaggio del lotto 9 diventerà 2), e chi ha visto una versione più bassa la rivede
// UNA volta. Alzarla per una virgola corretta è il modo di rendere di nuovo insignificante
// la riapertura: si alza quando c'è qualcosa di nuovo da raccontare.
//
// ⚠️ La chiave è PER DISPOSITIVO, non per persona, come il tema e lo sfondo: su un telefono
// condiviso, o cambiando identità, la guida non si riapre. È coerente con le altre
// preferenze e va saputo, non scoperto.
//
// ⚠️ Il giorno in cui questo arriva in mano ai topini, la guida si apre a TUTTI, anche a chi
// usa l'app da settimane. Approvato da iL KaJiNo il 04/09/2026: è l'occasione di raccontare
// a un gruppo che non l'ha chiesto le cose nuove degli ultimi giri.
var GUIDA_KEY = "clan_parm_guida_vista";
var GUIDA_VERSIONE = 1;

// `false` anche quando `localStorage` non c'è (navigazione privata, storage negato): senza
// un posto dove ricordare che l'hai vista, l'alternativa sarebbe riaprirla a ogni singolo
// ingresso — che è precisamente il difetto che questo meccanismo esiste per evitare.
function guidaDaMostrare(){
  try{ return (parseInt(localStorage.getItem(GUIDA_KEY), 10) || 0) < GUIDA_VERSIONE; }
  catch(e){ return false; }
}
// Si segna all'APERTURA, non alla chiusura: se un topino la chiude subito, la sua risposta
// è "non adesso" e riproporgliela al prossimo ingresso non la renderebbe più convincente.
// Le tre porte restano aperte per quando la vorrà davvero.
function segnaGuidaVista(){
  try{ localStorage.setItem(GUIDA_KEY, String(GUIDA_VERSIONE)); }catch(e){}
}

// Chrome ignora `navigator.vibrate()` finché l'utente non ha interagito col documento
// (*sticky user activation*); su iOS Safari `navigator.vibrate` non esiste proprio.
// Non è un difetto dell'app: è una regola della piattaforma. Tre cose misurate, non
// dedotte — la frase che stava qui prima («un `vibrate(0)` attiva il documento») era
// falsa, ed è costata tre sessioni di giri a vuoto:
//  1. l'attivazione la concede SOLO il browser, dispatchando un evento di gesto.
//     Chiamare `vibrate()` non ne concede: dopo `navigator.vibrate(1)`,
//     `navigator.userActivation.hasBeenActive` resta `false`. Un'API gated non si
//     scalda chiamandola — per questo l'innesco che stava nel <head> è stato tolto;
//  2. non tutti gli eventi di un gesto danno attivazione. La danno `keydown`,
//     `mousedown`, `mouseup`, `click`, `pointerup` e `touchend`; `pointerdown` solo se
//     `pointerType` è `"mouse"`;
//  3. `vibra()` va chiamata come PRIMA istruzione di un handler, mai dopo un `await`:
//     l'attivazione utente scade, e dopo l'await il browser non la riconosce più.
//
// ⚠️ E UNA QUARTA, MISURATA IL 02/09/2026 SU GALAXY S25 / CHROME, che smentisce quel che
// era scritto qui il giorno prima («lo swipe È un gesto sufficiente per Chrome»: falso).
// Sonda montata dentro `touchend`, subito prima di `vibra(15)`, con l'app aperta a freddo
// e lo swipe come primissimo gesto del documento:
//     swipe come primo gesto  →  hasBeenActive 0, isActive 0, vibrate() rifiutata
//     dopo un tocco qualsiasi →  hasBeenActive 1, isActive 1, vibrate() accettata
// `hasBeenActive` resta 0 anche dopo il SECONDO swipe: non è questione di un istante
// troppo presto. Chrome legge lo swipe come un pan e non lo conta come attivazione, per
// nessuno dei suoi eventi, `touchend` compreso.
// CONSEGUENZA: se il primo gesto di una sessione è uno swipe, quello swipe non vibra, e
// non c'è codice che possa aggiustarlo — è una regola della piattaforma, non un difetto
// dell'app. Dal primo tocco in poi l'attivazione è sticky e vale per tutta la sessione,
// quindi ogni altro swipe vibra. Non cercare più una cura per questo caso: è stato
// misurato, non dedotto.
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

// ── HASH (SHA-256) ──
// Nata per il PIN admin, che dal 01/09/2026 non esiste più: l'accesso all'amministrazione
// è l'email. Resta perché serve ancora alla password di gruppo — NON si tocca.
async function sha256(str){
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2, "0"); }).join("");
}

// ── EMAIL DELL'ADMIN ──
// Normalizzazione a monte, come per la password di gruppo. `admin_autorizzati.email` è una
// chiave primaria, quindi "Kajino@Gmail.com" e "kajino@gmail.com" sarebbero due righe
// diverse; `e_admin()` confronta con `lower()` sui due lati e le tratterebbe come la stessa.
// Il disallineamento non darebbe errori: darebbe un doppione nell'elenco che nessuno sa
// spiegare. Meglio che a DB ci arrivi una forma sola.
function normalizzaEmail(s){ return String(s == null ? "" : s).trim().toLowerCase(); }
function emailValida(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizzaEmail(s)); }

// ── PEZZATURA E PASSO DELL'ORDINE ──
// PEZZATURA_KG e KG_STEP sono ACCOPPIATE: lo stepper si muove di un pezzo per volta.
// Se un giorno arrivassero pezzi da 1 kg andrebbero portate a 1 tutte e due, altrimenti
// si finirebbe per ordinare mezzo pezzo. Cambiarne una sola è un bug, non una svista.
// Le pezzature anomale occasionali si scrivono a parole in `gruppi_acquisto.note_negoziante`:
// non si modellano.
var PEZZATURA_KG = 0.5;
var KG_STEP = 0.5;
var KG_MAX = 50;

// ── QUOTE DI SPEDIZIONE ──
// Chi ritira anche per amici fuori dal Clan paga più di una quota: sono più consegne, non
// più formaggio. Il 10 non è una misura, viene dall'esempio di iL KaJiNo («2 o 3 o 10»).
// ⚠️ Il limite vero è il vincolo `quote_spedizione_range` sul database: queste due
// costanti governano solo lo stepper. Se un giorno cambia il vincolo, vanno cambiate
// insieme — uno stepper più largo del vincolo darebbe un errore invece che un rifiuto.
var QUOTE_MIN = 1;
var QUOTE_MAX = 10;

// Numero di pezzi sottovuoto: esatto, perché i kg sono sempre multipli della pezzatura.
function pezziDa(kg){ return Math.round((kg || 0) / PEZZATURA_KG); }
// Due forme dello stesso conto, e la regola del plurale sta in un posto solo: la forma
// breve serve dove il contesto dice già di cosa si parla (la consegna, dove i pezzi sono
// in mano), quella lunga dove va spiegato — il documento per il negoziante.
function pezziBreve(kg){
  var n = pezziDa(kg);
  return n + (n === 1 ? " pezzo" : " pezzi");
}
function pezziTesto(kg){
  return pezziBreve(kg) + " sottovuoto da " + kgTesto(PEZZATURA_KG);
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
// ── SPEDIZIONE: si divide per QUOTE, non per teste ──
// Le quote di UNA persona. Il fallback a 1 non è cosmetico: le fotografie archiviate
// prima della colonna `quote_spedizione` non ce l'hanno, e senza fallback diventerebbero
// NaN — cioè un archivio che cambia i numeri a posteriori.
// ⚠️ Il filtro su `partecipa_spedizione` è obbligatorio: sommare le quote di chi non
// partecipa diluirebbe la spedizione su teste che non c'entrano, e il totale continuerebbe
// a tornare senza che nessuno se ne accorga.
function quoteDi(persona){
  if(!persona || !persona.partecipa_spedizione) return 0;
  return parseInt(persona.quote_spedizione, 10) || 1;
}
// Quante quote di spedizione ci sono in tutto. NON è il numero dei topini: un topino che
// ordina anche per due amici fuori dal Clan conta per tre, perché sono tre consegne.
function quoteSpedizioneTotali(){
  return persone.reduce(function(a, p){ return a + quoteDi(p); }, 0);
}
// Quanto vale UNA quota: è la cifra che un amico fuori dal Clan deve a chi ha ordinato
// per lui, ed è uguale per tutti — chi ordina per tre compreso.
function quotaSpedizioneSingola(){
  var tot = quoteSpedizioneTotali();
  if(tot <= 0) return 0;
  return (gruppo ? parseFloat(gruppo.spedizione_totale) || 0 : 0) / tot;
}
// Quanto deve all'admin questa persona: TUTTE le sue quote messe insieme.
// ⚠️ Si moltiplica prima e si divide una volta sola — `totale * mie / tot`, non
// `(totale / tot) * mie`: la regola del nessun arrotondamento intermedio vale anche qui.
function quotaSpedizione(persona){
  var mie = quoteDi(persona);
  if(!mie) return 0;
  var tot = quoteSpedizioneTotali();
  if(tot <= 0) return 0;
  return (gruppo ? parseFloat(gruppo.spedizione_totale) || 0 : 0) * mie / tot;
}
function totaleDovuto(persona){
  return totaleOrdine(persona.id) + quotaSpedizione(persona);
}

// ── LE PAROLE DELLA SPEDIZIONE ──
// La parola segue il fatto. Finché nessuno ha alzato il proprio contatore le quote SONO le
// teste, e «topini» è insieme vero e più chiaro; appena qualcuno lo alza diventa «quote».
// Una condizione sola, in un posto solo: l'etichetta deve descrivere ciò che viene diviso,
// non una convenzione. La usano la card Spedizione, due punti dell'admin e il PDF.
function spedizionePerQuote(){
  var teste = persone.filter(function(p){ return p.partecipa_spedizione; }).length;
  return quoteSpedizioneTotali() !== teste;
}
function paroleDivisore(n){
  if(spedizionePerQuote()) return n === 1 ? "quota" : "quote";
  return n === 1 ? "topino" : "topini";
}
function paroleATesta(){ return spedizionePerQuote() ? "a quota" : "a testa"; }

// Il «+2» accanto a un nome: quante persone questo topino porta OLTRE sé stesso.
// È la contromisura del permesso di scrittura concesso ai topini — chi alza il proprio
// contatore cambia il conto di tutti gli altri, e la difesa non è un lucchetto: è che si veda.
// ⚠️ Chi non partecipa alla spedizione non porta quote, e `quoteDi()` gli dà 0: niente
// etichetta. Mostrargli un «+2» direbbe una cosa falsa proprio accanto a un conto che è zero.
function etichettaQuote(persona){
  var q = quoteDi(persona);
  return q > 1 ? "+" + (q - 1) : "";
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
// È la 👑 delle sei medaglie qui sotto, e ha il conto suo perché esisteva prima di loro.
function topiniGrassi(){
  var max = 0;
  persone.forEach(function(p){ var k = kgTotaliDi(p.id); if(k > max) max = k; });
  if(max <= 0) return [];
  return persone.filter(function(p){ return kgTotaliDi(p.id) === max; }).map(function(p){ return p.id; });
}
// ── LE SEI MEDAGLIE ──
// Regola di composizione: il topino si scrive UNA volta sola — è il gancio — e i simboli si
// accumulano dopo di lui (`🐁 👑 🍀`, mai `🐁 👑 🐁 🍀`). Stanno su una riga propria sotto
// il nome, che compare SOLO se c'è almeno una medaglia: un topino senza niente addosso ha la
// card identica a prima. Tutte usano dati già in memoria: nessuna colonna, nessuna chiamata.
//
// L'ordine di questa lista È l'ordine sulla riga, e non cambia mai: un ordine fisso fa sì che
// l'occhio impari le posizioni, uno che cambia costringe a rileggere ogni volta.
// `breve` è il `title` sulla medaglia, `testo` la spiegazione lunga della guida. Stanno nella
// stessa riga di tabella di proposito: la stessa medaglia non può spiegarsi in due modi
// diversi a due centimetri di distanza, e con due elenchi separati prima o poi succede.
var MEDAGLIE = [
  { id:"goloso", ico:"\uD83D\uDC51", nome:"Il topino goloso",
    breve:"Ha preso pi\u00F9 formaggio di tutti",
    testo:"Ha preso pi\u00F9 formaggio di tutti. Non \u00E8 una gara, ma se lo fosse l'avrebbe vinta lui." },
  { id:"raffinato", ico:"✨", nome:"Il raffinato",
    breve:"Ha il prezzo al chilo pi\u00F9 alto del clan",
    testo:"Ha il prezzo al chilo pi\u00F9 alto del clan. Magari ha preso mezzo etto, ma della stagionatura giusta." },
  { id:"fortunato", ico:"\uD83C\uDF40", nome:"Gli \u00E8 andata grassa",
    breve:"Nel pacco gli sono finiti pi\u00F9 grammi in pi\u00F9 che a tutti",
    testo:"Il taglio \u00E8 a mano, e a qualcuno finiscono sempre ottanta grammi in pi\u00F9 nel pacco. Stavolta \u00E8 toccato a lui." },
  { id:"collezionista", ico:"\uD83C\uDFAD", nome:"Il collezionista",
    breve:"Ha preso pi\u00F9 stagionature diverse di tutti",
    testo:"Non \u00E8 riuscito a sceglierne una. Ha preso un po' di tutto, e va benissimo cos\u00EC." },
  { id:"minimalista", ico:"\uD83E\uDEB6", nome:"Il minimalista",
    breve:"Il minimo sindacale, con dignit\u00E0",
    testo:"Il minimo sindacale, con dignit\u00E0. Sa quello che vuole e ne vuole poco." },
  { id:"chiacchierone", ico:"\uD83D\uDCAC", nome:"Il chiacchierone",
    breve:"Ha scritto pi\u00F9 note in bacheca di chiunque altro",
    testo:"Ha scritto pi\u00F9 note in bacheca di chiunque altro. Qualcuno doveva pur farlo." }
];
function medagliaDi(id){
  return MEDAGLIE.find(function(m){ return m.id === id; }) || null;
}

// I vincitori di un premio: il massimo fra i `concorrenti` — o il minimo, con `minimo` —
// e i pari merito vincono tutti, perché è una medaglia scherzosa e non una classifica.
// `soglia`: il valore vincente deve arrivarci, altrimenti la medaglia non si assegna a
// nessuno (🎭 vuole almeno due stagionature, 💬 almeno una nota).
//
// ① Un premio che vincono TUTTI i concorrenti non è un premio. Serve a un caso reale: se
// tutti hanno ordinato la stessa stagionatura hanno tutti lo stesso prezzo al kg, e ✨
// finirebbe addosso all'intero clan.
//
// ⚠️ I valori vanno arrotondati dal chiamante alla precisione a cui si VEDONO — i centesimi
// per un prezzo, il decimo di punto per uno scarto. Due numeri che sullo schermo sono
// uguali devono essere pari merito: altrimenti la medaglia va a chi ha vinto per una cifra
// che nessuno può leggere, e da fuori sembra assegnata a caso.
function vincitoriMedaglia(concorrenti, valore, minimo, soglia){
  if(!concorrenti.length) return [];
  var best = null;
  concorrenti.forEach(function(p){
    var v = valore(p);
    if(best === null || (minimo ? v < best : v > best)) best = v;
  });
  if(soglia != null && !(best >= soglia)) return [];
  var vinc = concorrenti.filter(function(p){ return valore(p) === best; });
  if(vinc.length === concorrenti.length) return [];                       // ①
  return vinc.map(function(p){ return p.id; });
}

// Tutti e sei i conti in una passata sola: `renderTabella()` la chiama UNA volta e poi
// legge la mappa, invece di rifare sei scansioni del clan per ogni card.
// Restituisce { id_persona: ["goloso", "raffinato", …] }, già nell'ordine di MEDAGLIE.
function medaglieDelClan(){
  var out = {};
  function assegna(chiave, ids){
    ids.forEach(function(id){ if(!out[id]) out[id] = []; out[id].push(chiave); });
  }
  // Il campo di gara di quasi tutte: chi ha ordinato qualcosa. Chi non ha kg non concorre —
  // e senza kg il prezzo medio sarebbe una divisione per zero.
  var conKg = persone.filter(function(p){ return kgTotaliDi(p.id) > 0; });

  // 👑 il goloso — la medaglia che c'era già, con il suo conto di sempre.
  var golosi = topiniGrassi();
  assegna("goloso", golosi);

  // ✨ il raffinato — prezzo medio al kg più alto, al centesimo.
  assegna("raffinato", vincitoriMedaglia(conKg, function(p){
    return Math.round(totaleOrdine(p.id) / kgTotaliDi(p.id) * 100) / 100;
  }));

  // 🍀 gli è andata grassa — lo scarto positivo più alto. Esiste solo DOPO che l'admin ha
  // battuto i prezzi delle etichette: prima non c'è nessuno scarto da premiare, e la
  // medaglia semplicemente non c'è. Concorre chi ha già righe prezzate, e la soglia dello
  // 0,1% tiene fuori chi ha ricevuto esattamente quello che aveva ordinato.
  var conScarto = persone.filter(function(p){ return confrontoKg(p.id) != null; });
  assegna("fortunato", vincitoriMedaglia(conScarto, function(p){
    return Math.round(confrontoKg(p.id).scarto * 1000) / 1000;
  }, false, 0.001));

  // 🎭 il collezionista — più stagionature DIVERSE. ③ ne vuole almeno due: con una sola
  // non si sta collezionando niente.
  assegna("collezionista", vincitoriMedaglia(conKg, function(p){
    var visti = [];
    righeDi(p.id).forEach(function(r){ if(visti.indexOf(r.tipo_id) < 0) visti.push(r.tipo_id); });
    return visti.length;
  }, false, 2));

  // 🪶 il minimalista — meno kg di tutti, ma ha ordinato.
  // ② non si posa MAI su chi ha già 👑: con un topino solo che ha ordinato il massimo e il
  // minimo coincidono, e la stessa persona sarebbe insieme la più golosa e la più sobria.
  // Questa regola sola chiude tutti i casi degeneri.
  assegna("minimalista", vincitoriMedaglia(conKg, function(p){
    return kgTotaliDi(p.id);
  }, true).filter(function(id){ return golosi.indexOf(id) < 0; }));

  // 💬 il chiacchierone — più note in bacheca. Concorre TUTTO il clan e non solo chi ha
  // scritto: la bacheca è aperta a tutti, e restringere il campo a chi ha già scritto farebbe
  // sparire la medaglia ogni volta che due topini hanno una nota a testa (regola ①). Con
  // zero note nessun chiacchierone: la soglia è una nota.
  assegna("chiacchierone", vincitoriMedaglia(persone, function(p){
    return note.filter(function(n){ return n.persona_id === p.id; }).length;
  }, false, 1));

  return out;
}

// ── L'ORDINAMENTO DELLA TABELLA ──
// Quattro chiavi, ognuna con la SUA direzione naturale, e nessuna inversione: toccare due
// volte la stessa pillola non capovolge niente. Uno stato nascosto dentro una pillola è una
// cosa che nessuno scopre e che fa dubitare di quello che si sta guardando.
//
// «Ingresso» è il predefinito perché è già l'ordine di oggi (`api.js` carica le persone con
// `.order("created_at")`): chi apre la tab domani vede esattamente quello di ieri, e scopre
// che si può cambiare solo se guarda.
//
// ⚠️ Il goloso NON resta in cima. Un elenco ordinato per nome con un'eccezione in cima non
// è ordinato per nome, e la domanda «chi viene prima di chi» smette di avere una risposta
// sola. Quando si ordina per kg il goloso ci arriva da solo, per merito.
var ORDINAMENTI = [
  { id:"ingresso", ico:"\uD83D\uDCC5", nome:"Ingresso" },
  { id:"nome",     ico:"\uD83D\uDD24", nome:"Nome"     },
  { id:"kg",       ico:"\u2696\uFE0F", nome:"Kg"       },
  { id:"spesa",    ico:"\uD83D\uDCB0", nome:"Spesa"    }
];
// La scelta sopravvive alla chiusura dell'app: un ordinamento da ripescare ogni volta è un
// ordinamento che si smette di usare. Chiave globale e non per gruppo — è una preferenza di
// chi guarda, come il tema, non un dato del giro.
function ordinamentoTabella(){
  var v = null;
  try{ v = localStorage.getItem(ORDINE_KEY); }catch(e){}
  return ORDINAMENTI.some(function(o){ return o.id === v; }) ? v : "ingresso";
}
function setOrdinamentoTabella(id){
  try{ localStorage.setItem(ORDINE_KEY, id); }catch(e){}
}
// ⚠️ Si ordina una COPIA. `persone` è l'ordine di caricamento e lo usano altre funzioni:
// `persone.sort(...)` riscriverebbe l'array globale e «Ingresso» non tornerebbe più indietro.
// I pari merito restano nell'ordine d'ingresso, perché `sort` è stabile: due topini con gli
// stessi kg non si scambiano di posto a ogni ridisegno.
function personeOrdinate(){
  var copia = persone.slice();
  switch(ordinamentoTabella()){
    case "nome":
      // ⚠️ `localeCompare` con la lingua, mai `<`: il confronto fra stringhe sbaglia sulle
      // maiuscole (Z prima di a) e sulle accentate, e in un elenco di nomi si vede subito.
      return copia.sort(function(a, b){
        return String(a.nome || "").localeCompare(String(b.nome || ""), "it");
      });
    case "kg":
      return copia.sort(function(a, b){ return kgTotaliDi(b.id) - kgTotaliDi(a.id); });
    case "spesa":
      // La stessa cifra della riga «Totale» della card: se l'ordine non tornasse con il
      // numero che si legge accanto, sembrerebbe sbagliato uno dei due.
      return copia.sort(function(a, b){ return totaleDovuto(b) - totaleDovuto(a); });
    default:
      return copia;              // ingresso: è già l'ordine di caricamento
  }
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
// `persone.is_admin` è il flag pubblico del gruppo, non il permesso: dice a tutti a chi
// chiedere, e qui serve a decidere chi deve vedere la coda delle segnalazioni.
// Il permesso vero è `e_admin()` a DB, e con questa colonna non ha niente a che vedere:
// accenderla su cinque persone non dà a nessuna di loro un potere in più.
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
// A DB c'è solo l'impronta SHA-256, mai il testo.
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
