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
  // Qui stava, in un'altra vita, un innesco della vibrazione. Non c'è più da nessuna
  // parte: è stato misurato inutile il 02/09/2026 e tolto anche dal <head>. Nessun
  // innesco può funzionare — vedi il commento accanto a `vibra()` in utils.js.
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
    // Anche chi rientra: la guida si apre da sola finché non l'ha vista in questa versione.
    // Sta qui e non in `renderApp()`, che il realtime richiama in continuazione.
    forseApriGuida();
  } else {
    mioId = null;
    mostraSchermata("auth-screen");
    renderAuth();
  }
}

// ── AUTENTICAZIONE ADMIN: email + password ──
// Nessun `signInAnonymously`: ci si appoggia ai due ruoli che Supabase già distingue —
// `anon` per i topini, `authenticated` per chi ha fatto l'accesso. Un pezzo in meno da
// costruire e da mantenere.
// Essere autenticati NON significa essere admin: l'autorità è la tabella
// `admin_autorizzati`, e la si interroga con `e_admin()` subito dopo ogni accesso.
async function initAuth(){
  try{
    var s = await sb.auth.getSession();
    authUser = (s.data && s.data.session && s.data.session.user) || null;
  }catch(e){ authUser = null; }
  await aggiornaEAdmin();
  // Autenticato ma NON autorizzato: una sessione così non serve a niente e fa danno.
  // Le policy trattano `authenticated` come "o sei admin, o non scrivi", ed è la sola
  // cosa che impedisce a un utente creato per errore in dashboard di scrivere ovunque —
  // il ruolo `authenticated` porta con sé i grant pieni che Supabase concede per default.
  // Quindi restare firmati senza essere admin toglierebbe al topino perfino il proprio
  // ordine, con un errore che non spiegherebbe niente. Si esce e si torna `anon`.
  //
  // Qui il `signOut()` è MUTO di proposito, ed è l'unico posto in cui lo è: si tratta di
  // una sessione ripescata da `localStorage` all'avvio, di solito perché a qualcuno è
  // stata revocata l'autorizzazione. Non c'è nessuna schermata su cui scrivere e nessun
  // gesto a cui rispondere; l'avviso arriverebbe come un pop-up dal nulla. Chi prova ad
  // ENTRARE, invece, il perché lo legge — vedi `entraDaAdmin()` in admin.js.
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
// PASSWORD e non codice via email, e non è un ripiego. Senza un SMTP proprio Supabase manda
// le email di autenticazione SOLO agli indirizzi dei membri dell'organizzazione del progetto,
// due all'ora: il proprietario riceverebbe il codice e chiunque altro no. Il difetto sarebbe
// comparso al primo accesso di una persona diversa da chi ha creato il progetto — cioè
// esattamente quando serve, e nel momento peggiore per accorgersene.
// Gli utenti si creano a mano in dashboard (Authentication → Users → Add user, con
// `auto confirm` acceso): sono due, e si fa una volta sola.
// Tutto il resto non cambia di una riga — `admin_autorizzati`, `e_admin()`, le policy, i
// grant di colonna: `e_admin()` legge `auth.jwt() ->> 'email'`, che in una sessione da
// password c'è identico a com'era in una da codice.
async function accediConPassword(email, password){
  var r = await sb.auth.signInWithPassword({ email: email, password: password });
  if(r.error) throw r.error;
  authUser = (r.data && r.data.user) || null;
  return authUser;
}
// La sessione se ne va da `localStorage` e il client torna a parlare col database come
// chiunque altro. Non è più un lucchetto da riaprire a costo zero: per rientrare si
// ridigitano email e password, ed è la ragione per cui l'uscita si conferma.
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
        ridisegnaSchermataViva();
      }, 600);
    })
    .subscribe();
}
// Chiamata da `closeModal` quando lo stack si svuota: recupera il ridisegno saltato.
async function renderAdminDifferito(){
  if(!_renderAdminInSospeso) return;
  _renderAdminInSospeso = false;
  await caricaTutto();
  ridisegnaSchermataViva();
}

// Ridisegna la schermata che si sta guardando, dopo che i dati sono cambiati sotto.
//
// ⚠️ IL GIRO PUÒ SPARIRE SOTTO I PIEDI. L'admin archivia, il realtime ricarica, e `gruppo`
// diventa `null` mentre un topino sta guardando l'app o la schermata d'accesso: da lì in
// poi `renderApp()` disegnerebbe un'app senza nome con quattro tab vuote, e `renderAuth()`
// andrebbe proprio in errore su `gruppo.titolo`. È l'unica strada per cui quel buco si vede
// davvero — chi APRE il link fra due giri passa da `mostraSchermataGiusta()` e trova la
// schermata «Nessun giro aperto» — e va chiusa qui, dove il buco si apre.
// L'admin no: sta archiviando apposta, e buttarlo fuori dal pannello mentre apre il giro
// successivo sarebbe togliergli la scrivania da sotto le mani. Per lui `renderAdmin()` ha
// già la sua card «Nessun gruppo attivo».
function ridisegnaSchermataViva(){
  var inAdmin = document.getElementById("admin-screen").classList.contains("attiva");
  if(!gruppo && !inAdmin){ mostraSchermataGiusta(); return; }
  if(document.getElementById("app-screen").classList.contains("attiva")) renderApp();
  if(document.getElementById("auth-screen").classList.contains("attiva")) renderAuth();
  if(inAdmin) renderAdmin();
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
// Per quante persone ordina questo topino, ai fini della SOLA spedizione, sé stesso
// compreso. Il vincolo 1..10 sta anche a DB (`quote_spedizione_range`): lo
// stepper è un consiglio, quello è la regola.
async function setQuoteSpedizione(id, val){
  var r = await sb.from("persone").update({ quote_spedizione: val }).eq("id", id);
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
// I tipi dell'ULTIMO gruppo archiviato, per farci partire il giro nuovo (vedi
// `confermaNuovoGruppo` in admin.js). Sono già a database, sono quelli chiesti al
// negoziante, e si aggiornano da soli a ogni giro senza che nessuno se ne occupi.
// `nullsFirst:false` non è un vezzo: in Postgres un `order by … desc` mette i NULL PRIMI,
// quindi un archiviato senza `chiuso_at` vincerebbe sul più recente. `created_at` è lo
// spareggio per i due archiviati nello stesso istante.
// Solleva invece di restituire una lista vuota: "non riesco a leggere" e "non c'è un giro
// precedente" portano a due frasi diverse per l'admin, e confonderle gli farebbe credere
// che sia il primo gruppo quando invece è caduta la rete.
async function tipiUltimoGruppoArchiviato(){
  var rg = await sb.from("gruppi_acquisto").select("id").eq("stato", "archiviato")
    .order("chiuso_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if(rg.error) throw rg.error;
  if(!rg.data || !rg.data.length) return [];
  var rt = await sb.from("tipi_parmigiano").select("nome,prezzo_kg")
    .eq("gruppo_id", rg.data[0].id).order("ordine", { ascending: true });
  if(rt.error) throw rt.error;
  return rt.data || [];
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
