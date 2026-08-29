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

var mioId = null;            // persona.id scelta su questo device (per il gruppo corrente)
var carrello = [];           // righe non ancora salvate: {tipo_id, kg}
var adminOk = false;         // sbloccato in questa sessione di tab (sessionStorage)

var currentTab = "ordina";
var TABS = ["ordina", "tabella", "pagamenti"]; // + "admin" sempre visibile a parte

// ── SCHERMATE ──
function mostraSchermata(id){
  document.querySelectorAll(".screen").forEach(function(s){ s.classList.toggle("attiva", s.id === id); });
}

// ── HELPER FORMATO ──
function eur(n){
  return (Math.round((n||0)*100)/100).toFixed(2).replace(".", ",") + "\u00a0\u20ac";
}
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

// ── CALCOLI ──
// Righe di una persona
function righeDi(personaId){
  return righe.filter(function(r){ return r.persona_id === personaId; });
}
// Totale ordine di una persona: prezzo_reale se presente, altrimenti kg_nominale * prezzo_kg del tipo
function totaleOrdine(personaId){
  return righeDi(personaId).reduce(function(a, r){
    if(r.prezzo_reale != null) return a + parseFloat(r.prezzo_reale);
    var t = tipi.find(function(x){ return x.id === r.tipo_id; });
    var pk = t ? parseFloat(t.prezzo_kg) : 0;
    return a + parseFloat(r.kg_nominale) * pk;
  }, 0);
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
function nomeTipo(tipoId){
  var t = tipi.find(function(x){ return x.id === tipoId; });
  return t ? t.nome : "?";
}

// ── IDENTITÀ (per-device, per-gruppo) ──
function chiaveIdentita(){ return "clan_parm_persona_" + (gruppo ? gruppo.id : "none"); }
function getMiaIdentita(){ try{ return localStorage.getItem(chiaveIdentita()); }catch(e){ return null; } }
function setMiaIdentita(id){ try{ localStorage.setItem(chiaveIdentita(), id); }catch(e){} }
function clearMiaIdentita(){ try{ localStorage.removeItem(chiaveIdentita()); }catch(e){} }
