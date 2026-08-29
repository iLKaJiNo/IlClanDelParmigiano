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
  dot("", "Annusando il formaggio...");
  await caricaTutto();
  initRealtime();
  mostraSchermataGiusta();
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
      tipi = rt.data || [];
      persone = rp.data || [];
      righe = rr.data || [];
    } else {
      tipi = []; persone = []; righe = [];
    }

    var ri = await sb.from("impostazioni").select("*").eq("id", 1).maybeSingle();
    if(!ri.error && ri.data) impostazioni = ri.data;

    var ra = await sb.from("gruppi_acquisto").select("id,titolo,chiuso_at,created_at").eq("stato", "archiviato").order("chiuso_at", { ascending: false });
    archivioGruppi = ra.data || [];

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
  if(esiste){
    mioId = mia;
    mostraSchermata("app-screen");
    renderApp();
  } else {
    mioId = null;
    mostraSchermata("auth-screen");
    renderAuth();
  }
}

// ── REALTIME ──
var _rtTimer = null;
function initRealtime(){
  sb.channel("clan-parmigiano")
    .on("postgres_changes", { event: "*", schema: "public" }, function(){
      clearTimeout(_rtTimer);
      _rtTimer = setTimeout(async function(){
        await caricaTutto();
        if(document.getElementById("app-screen").classList.contains("attiva")) renderApp();
        if(document.getElementById("auth-screen").classList.contains("attiva")) renderAuth();
        if(document.getElementById("admin-screen").classList.contains("attiva")) renderAdmin();
      }, 600);
    })
    .subscribe();
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
async function setPagato(id, val){
  var r = await sb.from("persone").update({ pagato: val }).eq("id", id);
  if(r.error) throw r.error;
}
async function eliminaPersona(id){
  var r = await sb.from("persone").delete().eq("id", id);
  if(r.error) throw r.error;
}

// ── AZIONI: righe ordine ──
async function salvaRigheCarrello(personaId, righeCarrello){
  var payload = righeCarrello.map(function(r){
    return { persona_id: personaId, tipo_id: r.tipo_id, kg_nominale: r.kg };
  });
  var r = await sb.from("righe_ordine").insert(payload);
  if(r.error) throw r.error;
}
async function eliminaRiga(id){
  var r = await sb.from("righe_ordine").delete().eq("id", id);
  if(r.error) throw r.error;
}
async function setPrezzoReale(id, val){
  var r = await sb.from("righe_ordine").update({ prezzo_reale: val }).eq("id", id);
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
async function aggiornaImpostazioni(patch){
  var r = await sb.from("impostazioni").update(patch).eq("id", 1);
  if(r.error) throw r.error;
}
async function creaGruppo(titolo, tipiIniziali){
  var rg = await sb.from("gruppi_acquisto").insert({ titolo: titolo }).select().single();
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
async function caricaDettaglioArchivio(gruppoId){
  var rg = await sb.from("gruppi_acquisto").select("*").eq("id", gruppoId).single();
  var rt = await sb.from("tipi_parmigiano").select("*").eq("gruppo_id", gruppoId).order("ordine", { ascending: true });
  var rp = await sb.from("persone").select("*").eq("gruppo_id", gruppoId).order("created_at", { ascending: true });
  var pids = (rp.data || []).map(function(p){ return p.id; });
  var rr = pids.length ? await sb.from("righe_ordine").select("*").in("persona_id", pids) : { data: [] };
  return { gruppo: rg.data, tipi: rt.data || [], persone: rp.data || [], righe: rr.data || [] };
}
