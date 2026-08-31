// ════════════════════════════════════════════════════════
//  Il Clan del Parmigiano — api.js
//  Caricamento dati, realtime, azioni verso Supabase.
// ════════════════════════════════════════════════════════

function dot(cls, txt){
  var d = document.getElementById("dot");
  var t = document.getElementById("sync-txt");
  if(d) d.className = "sync-dot" + (cls ? " " + cls : "");
  if(t) t.textContent = txt || "";
}

async function appStart(){
  initTheme();          // prima del primo render, altrimenti si vede il lampo di tema sbagliato
  initTile();
  // L'innesco della vibrazione NON sta più qui: è nel <head> di index.html, perché un
  // listener registrato in una funzione `async` non c'è ancora quando arriva il primo
  // swipe ad app appena aperta. Vedi il commento accanto a `vibra()` in utils.js.
  dot("", "Annusando il formaggio...");
  await initAuth();     // la sessione admin, se su questo device c'è, PRIMA del primo render
  await caricaTutto();
  initRealtime();
  initTabSwipe();
  mostraSchermataGiusta();
  initInvitoInstalla();   // su iOS non c'è un evento che lo accenda: va valutato all'avvio
}

async function caricaTutto(){
  try{
    var rg = await sb.from("gruppi_acquisto").select("*").eq("stato", "attivo").order("created_at", { ascending: false }).limit(1);
    if(rg.error) throw rg.error;
    gruppo = (rg.data && rg.data[0]) || null;

    if(gruppo){
      var rt = await sb.from("tipi_parmigiano").select("*").eq("gruppo_id", gruppo.id).order("ordine", { ascending: true });
      var rp = await sb.from("persone").select("*").eq("gruppo_id", gruppo.id).order("created_at", { ascending: true });
      var pids = (rp.data || []).map(function(p){ return p.id; });
      var rr = pids.length
        ? await sb.from("righe_ordine").select("*").in("persona_id", pids)
        : { data: [] };
      if(rt.error) throw rt.error;
      if(rp.error) throw rp.error;
      if(rr.error) throw rr.error;
      var rn = await sb.from("note").select("*").eq("gruppo_id", gruppo.id).order("creata_il", { ascending: false });
      if(rn.error) throw rn.error;
      tipi = rt.data || [];
      persone = rp.data || [];
      righe = rr.data || [];
      note = rn.data || [];
    } else {
      tipi = []; persone = []; righe = []; note = [];
    }

    var ri = await sb.from("impostazioni").select("*").eq("id", 1).maybeSingle();
    if(!ri.error && ri.data) impostazioni = ri.data;

    var ra = await sb.from("gruppi_acquisto").select("id,titolo,chiuso_at,created_at").eq("stato", "archiviato").order("chiuso_at", { ascending: false });
    archivioGruppi = ra.data || [];

    // Solo per chi è admin: per tutti gli altri la tabella non esiste nemmeno in lettura.
    // Sta qui e non dentro `aggiornaEAdmin()` perché così il realtime la tiene fresca come
    // tutto il resto — un admin tolto da un altro dispositivo sparisce dall'elenco da solo.
    if(eAdmin) await caricaAdminAutorizzati();

    dot("ok", "Sincronizzato \uD83E\uDDC0");
  }catch(e){
    console.error(e);
    dot("err", "Offline");
  }
}

function mostraSchermataGiusta(){
  if(!gruppo){
    // Nessun gruppo attivo: solo l'admin può crearne uno
    mostraSchermata("nogruppo-screen");
    return;
  }
  var mia = getMiaIdentita();
  var esiste = mia && persone.some(function(p){ return p.id === mia; });
  // Se l'admin imposta (o cambia) la password del gruppo, i device già dentro
  // tornano al cancello: è esattamente ciò che serve per rimettere fuori un estraneo.
  if(esiste && gruppoSbloccato()){
    mioId = mia;
    mostraSchermata("app-screen");
    renderApp();
  } else {
    mioId = null;
    mostraSchermata("auth-screen");
    renderAuth();
  }
}

// ── AUTENTICAZIONE ADMIN: email + codice usa e getta ──
// Nessun `signInAnonymously`: ci si appoggia ai due ruoli che Supabase già distingue —
// `anon` per i topini, `authenticated` per chi ha fatto l'accesso. Un pezzo in meno da
// costruire e da mantenere.
// `signInWithOtp` CREA l'utente se non esiste, e va bene: essere autenticati non significa
// essere admin. L'autorità è la tabella `admin_autorizzati`, non l'aver ricevuto un'email.
async function initAuth(){
  try{
    var s = await sb.auth.getSession();
    authUser = (s.data && s.data.session && s.data.session.user) || null;
  }catch(e){ authUser = null; }
  await aggiornaEAdmin();
  // Autenticato ma NON autorizzato: una sessione così non serve a niente e fa danno.
  // Le policy trattano `authenticated` come "o sei admin, o non scrivi" — perché
  // autenticarsi non costa nulla, `signInWithOtp` crea l'utente a chiunque abbia una
  // casella. Quindi restare firmati senza essere admin toglierebbe al topino perfino
  // il proprio ordine, e con un messaggio d'errore che non spiegherebbe niente.
  // Si esce e si torna `anon`, che è il ruolo giusto per lui.
  if(authUser && !eAdmin) await esciDaAdmin();
}
// Il permesso non si deduce dal client: si CHIEDE al database, che è l'unico posto in cui
// vale qualcosa. Qui serve solo a decidere cosa disegnare — se questa riga mentisse, le
// policy direbbero di no lo stesso.
async function aggiornaEAdmin(){
  if(!authUser){ eAdmin = false; adminAutorizzati = []; return false; }
  try{
    var r = await sb.rpc("e_admin");
    eAdmin = !r.error && r.data === true;
  }catch(e){ eAdmin = false; }
  if(!eAdmin) adminAutorizzati = [];
  return eAdmin;
}
async function caricaAdminAutorizzati(){
  var r = await sb.from("admin_autorizzati").select("*").order("creato_il", { ascending: true });
  adminAutorizzati = r.error ? [] : (r.data || []);
}
async function inviaCodiceAccesso(email){
  var r = await sb.auth.signInWithOtp({ email: email });
  if(r.error) throw r.error;
}
async function verificaCodiceAccesso(email, codice){
  var r = await sb.auth.verifyOtp({ email: email, token: codice, type: "email" });
  if(r.error) throw r.error;
  authUser = (r.data && r.data.user) || null;
  return authUser;
}
// La sessione se ne va da `localStorage` e il client torna a parlare col database come
// chiunque altro. Non è più un lucchetto da riaprire a costo zero: per rientrare serve
// un'altra email, ed è la ragione per cui l'uscita si conferma.
async function esciDaAdmin(){
  try{ await sb.auth.signOut(); }catch(e){}
  authUser = null; eAdmin = false; adminAutorizzati = [];
}
async function autorizzaAdmin(email, etichetta){
  var r = await sb.from("admin_autorizzati").insert({ email: email, etichetta: etichetta || null });
  if(r.error) throw r.error;
}
async function revocaAdmin(email){
  var r = await sb.from("admin_autorizzati").delete().eq("email", email);
  if(r.error) throw r.error;
}

// ── REALTIME ──
// Ridisegnare mentre un modale è aperto è sempre sbagliato: l'admin sta digitando dentro
// a un form che verrebbe rifatto sotto le dita, e i campi che la calcolatrice ha come
// bersaglio tornerebbero a puntare nel vuoto. Il ridisegno non si perde: si differisce
// alla chiusura del modale (`renderAdminDifferito`).
var _rtTimer = null;
var _renderAdminInSospeso = false;
function initRealtime(){
  sb.channel("clan-parmigiano")
    .on("postgres_changes", { event: "*", schema: "public" }, function(){
      clearTimeout(_rtTimer);
      _rtTimer = setTimeout(async function(){
        if(modaleAperto()){ _renderAdminInSospeso = true; return; }
        await caricaTutto();
        if(document.getElementById("app-screen").classList.contains("attiva")) renderApp();
        if(document.getElementById("auth-screen").classList.contains("attiva")) renderAuth();
        if(document.getElementById("admin-screen").classList.contains("attiva")) renderAdmin();
      }, 600);
    })
    .subscribe();
}
// Chiamata da `closeModal` quando lo stack si svuota: recupera il ridisegno saltato.
async function renderAdminDifferito(){
  if(!_renderAdminInSospeso) return;
  _renderAdminInSospeso = false;
  await caricaTutto();
  if(document.getElementById("app-screen").classList.contains("attiva")) renderApp();
  if(document.getElementById("auth-screen").classList.contains("attiva")) renderAuth();
  if(document.getElementById("admin-screen").classList.contains("attiva")) renderAdmin();
}

// ── AZIONI: persone / identità ──
async function creaPersona(nome){
  var r = await sb.from("persone").insert({ gruppo_id: gruppo.id, nome: nome }).select().single();
  if(r.error) throw r.error;
  return r.data;
}
async function rinominaPersona(id, nome){
  var r = await sb.from("persone").update({ nome: nome }).eq("id", id);
  if(r.error) throw r.error;
}
async function setPartecipaSpedizione(id, val){
  var r = await sb.from("persone").update({ partecipa_spedizione: val }).eq("id", id);
  if(r.error) throw r.error;
}
// §5: il flag PUBBLICO del gruppo, quello che dice ai topini a chi chiedere. Non è il
// permesso — quello è `e_admin()` a DB, e non passa da questa colonna.
async function setIsAdmin(id, val){
  var r = await sb.from("persone").update({ is_admin: val }).eq("id", id);
  if(r.error) throw r.error;
}
async function setPagato(id, val){
  var r = await sb.from("persone").update({ pagato: val }).eq("id", id);
  if(r.error) throw r.error;
}
// Il topino SEGNALA di aver pagato; non si imposta `pagato`, che resta autorità dell'admin.
async function segnalaPagamento(id, metodo){
  var r = await sb.from("persone").update({ pagamento_segnalato: true, metodo_segnalato: metodo }).eq("id", id);
  if(r.error) throw r.error;
}
async function annullaSegnalazione(id){
  var r = await sb.from("persone").update({ pagamento_segnalato: false, metodo_segnalato: null }).eq("id", id);
  if(r.error) throw r.error;
}
// L'admin conferma: marca pagato e toglie la richiesta dalla lista "da confermare".
// `metodo_segnalato` resta, è la traccia di come ha pagato.
async function confermaPagamentoAdmin(id){
  var r = await sb.from("persone").update({ pagato: true, pagamento_segnalato: false }).eq("id", id);
  if(r.error) throw r.error;
}
async function eliminaPersona(id){
  var r = await sb.from("persone").delete().eq("id", id);
  if(r.error) throw r.error;
}

// ── AZIONI: righe ordine ──
// Una sola riga per persona+tipo (vincolo unique persona_id,tipo_id): mai insert, sempre upsert.
// Il payload contiene solo kg_nominale, quindi un prezzo_reale già inserito dall'admin
// sopravvive alla modifica dei kg (resta però riferito alla quantità vecchia: da rivedere
// quando arriverà la chiusura ordini del punto E).
async function salvaKgRiga(personaId, tipoId, kg){
  if(!(kg > 0)) return eliminaRigaDi(personaId, tipoId);   // CHECK kg_nominale > 0: lo zero non esiste, è un delete
  var r = await sb.from("righe_ordine")
    .upsert({ persona_id: personaId, tipo_id: tipoId, kg_nominale: kg },
            { onConflict: "persona_id,tipo_id" })
    .select().single();
  if(r.error) throw r.error;
  return r.data;
}
async function eliminaRigaDi(personaId, tipoId){
  var r = await sb.from("righe_ordine").delete().eq("persona_id", personaId).eq("tipo_id", tipoId);
  if(r.error) throw r.error;
  return null;
}
async function setPrezzoReale(id, val){
  var r = await sb.from("righe_ordine").update({ prezzo_reale: val }).eq("id", id);
  if(r.error) throw r.error;
}

// ── AZIONI: bacheca note ──
async function creaNota(testo){
  var r = await sb.from("note").insert({ gruppo_id: gruppo.id, persona_id: mioId, testo: testo }).select().single();
  if(r.error) throw r.error;
  return r.data;
}
async function aggiornaNota(id, testo){
  var r = await sb.from("note").update({ testo: testo, aggiornata_il: new Date().toISOString() }).eq("id", id);
  if(r.error) throw r.error;
}
async function eliminaNota(id){
  var r = await sb.from("note").delete().eq("id", id);
  if(r.error) throw r.error;
}

// ── AZIONI: admin — tipi/prezzi, spedizione, gruppo, impostazioni ──
async function aggiornaPrezzoTipo(id, prezzo){
  var r = await sb.from("tipi_parmigiano").update({ prezzo_kg: prezzo }).eq("id", id);
  if(r.error) throw r.error;
}
async function aggiornaSpedizione(totale){
  var r = await sb.from("gruppi_acquisto").update({ spedizione_totale: totale }).eq("id", gruppo.id);
  if(r.error) throw r.error;
}
async function aggiornaChiusuraOrdini(iso){
  var r = await sb.from("gruppi_acquisto").update({ chiusura_ordini: iso }).eq("id", gruppo.id);
  if(r.error) throw r.error;
}
async function aggiornaImpostazioni(patch){
  var r = await sb.from("impostazioni").update(patch).eq("id", 1);
  if(r.error) throw r.error;
}
// Riceve GIÀ l'hash: il testo in chiaro non deve mai arrivare fino a qui.
async function aggiornaPasswordGruppo(hash){
  var r = await sb.from("gruppi_acquisto").update({ password_hash: hash || null }).eq("id", gruppo.id);
  if(r.error) throw r.error;
}
// L'arrivo del pacco lo dichiara l'admin. Si scrive `now()` lato client, come tutte le
// altre date dell'app: il valore serve a un banner, non a un audit.
async function segnalaArrivoPacco(){
  var r = await sb.from("gruppi_acquisto").update({ arrivo_segnalato_at: new Date().toISOString() }).eq("id", gruppo.id);
  if(r.error) throw r.error;
}
async function annullaArrivoPacco(){
  var r = await sb.from("gruppi_acquisto").update({ arrivo_segnalato_at: null }).eq("id", gruppo.id);
  if(r.error) throw r.error;
}
async function aggiornaNoteNegoziante(testo){
  var r = await sb.from("gruppi_acquisto").update({ note_negoziante: testo || null }).eq("id", gruppo.id);
  if(r.error) throw r.error;
}
async function aggiornaCostoRealeTotale(val){
  var r = await sb.from("gruppi_acquisto").update({ costo_reale_totale: val }).eq("id", gruppo.id);
  if(r.error) throw r.error;
}
async function creaGruppo(titolo, passwordHash, tipiIniziali){
  var rg = await sb.from("gruppi_acquisto").insert({ titolo: titolo, password_hash: passwordHash || null }).select().single();
  if(rg.error) throw rg.error;
  var g = rg.data;
  var payload = tipiIniziali.map(function(t, i){
    return { gruppo_id: g.id, nome: t.nome, prezzo_kg: t.prezzo_kg, ordine: i };
  });
  var rt = await sb.from("tipi_parmigiano").insert(payload);
  if(rt.error) throw rt.error;
  return g;
}
async function archiviaGruppo(){
  var r = await sb.from("gruppi_acquisto").update({ stato: "archiviato", chiuso_at: new Date().toISOString() }).eq("id", gruppo.id);
  if(r.error) throw r.error;
}
// Eliminazione DEFINITIVA di un gruppo archiviato. Persone, righe e note se ne vanno
// con lui: le foreign key sono già `on delete cascade`, il lavoro lo fa il DB.
// Il filtro su `stato` è una cintura oltre alle bretelle: il gruppo attivo non si tocca,
// e cancellare l'ordine in corso non è un'operazione che si fa per sbaglio a mezzanotte.
async function eliminaGruppoArchiviato(gruppoId){
  var r = await sb.from("gruppi_acquisto").delete().eq("id", gruppoId).eq("stato", "archiviato");
  if(r.error) throw r.error;
}
async function caricaDettaglioArchivio(gruppoId){
  var rg = await sb.from("gruppi_acquisto").select("*").eq("id", gruppoId).single();
  var rt = await sb.from("tipi_parmigiano").select("*").eq("gruppo_id", gruppoId).order("ordine", { ascending: true });
  var rp = await sb.from("persone").select("*").eq("gruppo_id", gruppoId).order("created_at", { ascending: true });
  var pids = (rp.data || []).map(function(p){ return p.id; });
  var rr = pids.length ? await sb.from("righe_ordine").select("*").in("persona_id", pids) : { data: [] };
  return { gruppo: rg.data, tipi: rt.data || [], persone: rp.data || [], righe: rr.data || [] };
}
