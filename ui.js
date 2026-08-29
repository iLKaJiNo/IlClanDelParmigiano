// ════════════════════════════════════════════════════════
//  Il Clan del Parmigiano — ui.js
//  Rendering: scelta identità, ordina, tabella, pagamenti.
// ════════════════════════════════════════════════════════

// ── SCHERMATA SENZA GRUPPO ATTIVO ──
// (gestita in index.html + admin.js: solo l'admin può creare il primo gruppo)

// ── AUTH: scelta/creazione nome ──
function renderAuth(){
  document.getElementById("auth-gruppo-titolo").textContent = gruppo.titolo;
  var el = document.getElementById("lista-persone");
  if(!persone.length){
    el.innerHTML = '<div class="empty">Nessuno si è ancora registrato.<br>Sii il primo topolino! \uD83D\uDC2D</div>';
  } else {
    el.innerHTML = persone.map(function(p){
      var badge = p.pagato ? '<span class="pp-badge pagato">pagato</span>' : '<span class="pp-badge attesa">in attesa</span>';
      return '<div class="persona-pick" onclick="sceglioPersona(\'' + p.id + '\')">'
        + '<span class="pp-emoji">\uD83D\uDC2D</span><span class="pp-nome">' + escapeHtml(p.nome) + '</span>' + badge + '</div>';
    }).join("");
  }
  document.getElementById("nuovo-nome").value = "";
  document.getElementById("auth-errore").textContent = "";
}
function sceglioPersona(id){
  mioId = id;
  setMiaIdentita(id);
  mostraSchermata("app-screen");
  renderApp();
}
async function confermaNuovoNome(){
  var nome = document.getElementById("nuovo-nome").value.trim();
  var err = document.getElementById("auth-errore");
  if(!nome){ err.textContent = "Scrivi un nome."; return; }
  if(persone.some(function(p){ return p.nome.toLowerCase() === nome.toLowerCase(); })){
    err.textContent = "C'è già un topolino con questo nome — sceglilo dalla lista, o aggiungi un'iniziale.";
    return;
  }
  err.textContent = "";
  try{
    var p = await creaPersona(nome);
    persone.push(p);
    sceglioPersona(p.id);
  }catch(e){ err.textContent = "Errore: " + e.message; }
}

// ── APP (dopo identità) ──
function renderApp(){
  var mia = persone.find(function(p){ return p.id === mioId; });
  document.getElementById("app-gruppo-titolo").textContent = gruppo ? gruppo.titolo : "";
  document.getElementById("app-mio-nome").textContent = mia ? mia.nome : "";
  switchTab(currentTab);
}
function switchTab(tab){
  currentTab = tab;
  document.querySelectorAll(".tab-page").forEach(function(p){ p.classList.toggle("attiva", p.dataset.tab === tab); });
  document.querySelectorAll(".tab-btn").forEach(function(b){ b.classList.toggle("attiva", b.dataset.tab === tab); });
  if(tab === "ordina") renderOrdina();
  if(tab === "tabella") renderTabella();
  if(tab === "pagamenti") renderPagamenti();
}
function cambioIdentita(){
  clearMiaIdentita();
  mioId = null;
  mostraSchermata("auth-screen");
  renderAuth();
}

// ── TAB ORDINA ──
var stepperKg = {}; // tipo_id -> kg selezionati (non ancora aggiunti al carrello)

function renderOrdina(){
  var el = document.getElementById("ordina-tipi");
  el.innerHTML = tipi.map(function(t){
    if(stepperKg[t.id] == null) stepperKg[t.id] = 0.5;
    return '<div class="tipo-row">'
      + '<div><div class="tipo-nome">' + escapeHtml(t.nome) + '</div>'
      + '<div class="tipo-prezzo">' + eur(t.prezzo_kg) + '/kg</div></div>'
      + '<div class="stepper">'
      + '<button class="step-btn" onclick="stepKg(\'' + t.id + '\',-0.5)">\u2212</button>'
      + '<span class="step-val" id="step-' + t.id + '">' + stepperKg[t.id].toFixed(1) + ' kg</span>'
      + '<button class="step-btn" onclick="stepKg(\'' + t.id + '\',0.5)">+</button>'
      + '<button class="btn btn-cheese btn-mini" onclick="aggiungiAlCarrello(\'' + t.id + '\')">Aggiungi</button>'
      + '</div></div>';
  }).join("");
  renderCarrello();
  renderMieRighe();
}
function stepKg(tipoId, delta){
  var v = Math.max(0.5, Math.round((stepperKg[tipoId] + delta) * 10) / 10);
  stepperKg[tipoId] = v;
  document.getElementById("step-" + tipoId).textContent = v.toFixed(1) + " kg";
}
function aggiungiAlCarrello(tipoId){
  carrello.push({ tipo_id: tipoId, kg: stepperKg[tipoId] });
  renderCarrello();
}
function rimuoviDalCarrello(idx){
  carrello.splice(idx, 1);
  renderCarrello();
}
function renderCarrello(){
  var el = document.getElementById("carrello-list");
  var wrap = document.getElementById("carrello-wrap");
  if(!carrello.length){ wrap.style.display = "none"; el.innerHTML = ""; return; }
  wrap.style.display = "block";
  el.innerHTML = carrello.map(function(r, i){
    var t = tipi.find(function(x){ return x.id === r.tipo_id; });
    var tot = (t ? parseFloat(t.prezzo_kg) : 0) * r.kg;
    return '<div class="riga-carrello"><div class="rc-info">' + escapeHtml(t ? t.nome : "?") + ' \u2014 ' + r.kg.toFixed(1) + ' kg</div>'
      + '<div class="rc-tot">' + eur(tot) + '</div>'
      + '<button class="rc-del" onclick="rimuoviDalCarrello(' + i + ')">\u00d7</button></div>';
  }).join("");
}
async function confermaCarrello(){
  if(!carrello.length) return;
  try{
    await salvaRigheCarrello(mioId, carrello);
    carrello = [];
    await caricaTutto();
    renderApp();
    dot("ok", "Ordine salvato \uD83E\uDDC0");
  }catch(e){ alert("Errore: " + e.message); }
}
function renderMieRighe(){
  var el = document.getElementById("mie-righe");
  var mie = righeDi(mioId);
  if(!mie.length){ el.innerHTML = '<div class="empty">Non hai ancora ordinato nulla.</div>'; return; }
  el.innerHTML = mie.map(function(r){
    var tot = r.prezzo_reale != null ? parseFloat(r.prezzo_reale) : null;
    var t = tipi.find(function(x){ return x.id === r.tipo_id; });
    var ipotetico = (t ? parseFloat(t.prezzo_kg) : 0) * parseFloat(r.kg_nominale);
    return '<div class="riga-carrello"><div class="rc-info">' + nomeTipo(r.tipo_id) + ' \u2014 ' + parseFloat(r.kg_nominale).toFixed(1) + ' kg'
      + (tot != null ? ' <span style="color:var(--moss);">(reale ' + eur(tot) + ')</span>' : ' <span style="color:var(--dim);">(ipotetico)</span>') + '</div>'
      + '<div class="rc-tot">' + eur(tot != null ? tot : ipotetico) + '</div>'
      + '<button class="rc-del" onclick="eliminaMiaRiga(\'' + r.id + '\')" title="Elimina">\u00d7</button></div>';
  }).join("");
  var mia = persone.find(function(p){ return p.id === mioId; });
  document.getElementById("mio-totale").innerHTML = mia
    ? 'Totale ordine: <strong>' + eur(totaleOrdine(mioId)) + '</strong> + spedizione <strong>' + eur(quotaSpedizione(mia)) + '</strong> = <strong style="color:var(--cheese);">' + eur(totaleDovuto(mia)) + '</strong>'
    : "";
}
async function eliminaMiaRiga(id){
  if(!confirm("Rimuovere questa riga dal tuo ordine?")) return;
  try{ await eliminaRiga(id); await caricaTutto(); renderApp(); }
  catch(e){ alert("Errore: " + e.message); }
}

// ── TAB TABELLA ──
function renderTabella(){
  var el = document.getElementById("tabella-body");
  if(!persone.length){ el.innerHTML = '<div class="empty">Ancora nessun topolino registrato.</div>'; return; }
  var righeHtml = persone.map(function(p){
    var mieRighe = righeDi(p.id);
    var dettaglio = mieRighe.map(function(r){
      return nomeTipo(r.tipo_id) + " " + parseFloat(r.kg_nominale).toFixed(1) + "kg";
    }).join(", ") || "\u2014";
    return '<tr><td>' + escapeHtml(p.nome) + '</td><td>' + escapeHtml(dettaglio) + '</td>'
      + '<td>' + kgTotaliDi(p.id).toFixed(1) + ' kg</td>'
      + '<td>' + eur(totaleOrdine(p.id)) + '</td>'
      + '<td>' + eur(quotaSpedizione(p)) + '</td>'
      + '<td><strong>' + eur(totaleDovuto(p)) + '</strong></td>'
      + '<td>' + (p.pagato ? '<span class="badge ok">pagato</span>' : '<span class="badge no">non pagato</span>') + '</td></tr>';
  }).join("");
  var totaleGenerale = persone.reduce(function(a, p){ return a + totaleDovuto(p); }, 0);
  el.innerHTML = '<div class="tabella-wrap"><table class="tb"><thead><tr>'
    + '<th>Nome</th><th>Ordine</th><th>Kg tot.</th><th>Parmigiano</th><th>Sped.</th><th>Totale</th><th>Stato</th>'
    + '</tr></thead><tbody>' + righeHtml
    + '<tr class="tot-riga"><td colspan="5"><strong>Totale gruppo</strong></td><td colspan="2"><strong>' + eur(totaleGenerale) + '</strong></td></tr>'
    + '</tbody></table></div>';
}

// ── TAB PAGAMENTI ──
function renderPagamenti(){
  var el = document.getElementById("pagamenti-body");
  var html = "";
  if(impostazioni.iban){
    html += '<div class="pay-link" onclick="copiaTesto(\'' + escapeHtml(impostazioni.iban) + '\')">'
      + '<span class="pl-ico">\uD83C\uDFE6</span><div class="pl-info"><div class="pl-nome">IBAN (tocca per copiare)</div>'
      + '<div class="pl-val">' + escapeHtml(impostazioni.iban) + '</div></div></div>';
  }
  if(impostazioni.paypal_link){
    html += '<a class="pay-link" href="' + escapeHtml(impostazioni.paypal_link) + '" target="_blank" rel="noopener">'
      + '<span class="pl-ico">\uD83D\uDCB3</span><div class="pl-info"><div class="pl-nome">PayPal</div>'
      + '<div class="pl-val">' + escapeHtml(impostazioni.paypal_link) + '</div></div></a>';
  }
  if(impostazioni.satispay_link){
    html += '<a class="pay-link" href="' + escapeHtml(impostazioni.satispay_link) + '" target="_blank" rel="noopener">'
      + '<span class="pl-ico">\uD83D\uDCF2</span><div class="pl-info"><div class="pl-nome">Satispay</div>'
      + '<div class="pl-val">' + escapeHtml(impostazioni.satispay_link) + '</div></div></a>';
  }
  if(!html) html = '<div class="empty">Coordinate di pagamento non ancora inserite.</div>';
  el.innerHTML = html;
}
function copiaTesto(t){
  navigator.clipboard.writeText(t).then(function(){ dot("ok", "Copiato \uD83D\uDCCB"); setTimeout(function(){ dot("ok", "Sincronizzato \uD83E\uDDC0"); }, 1500); });
}
