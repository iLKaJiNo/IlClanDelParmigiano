// ════════════════════════════════════════════════════════
//  Il Clan del Parmigiano — admin.js
//  PIN gate, pannello di amministrazione, archivio, PDF.
// ════════════════════════════════════════════════════════

var ADMIN_SESSION_KEY = "clan_parm_admin_ok";
var _pinBuffer = "";

function apriAdmin(){
  mostraSchermata("admin-screen");
  if(sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"){
    adminOk = true;
    renderAdmin();
  } else {
    adminOk = false;
    renderPinGate();
  }
}
function chiudiAdmin(){
  mostraSchermataGiusta();
}

// ── PIN GATE ──
function renderPinGate(){
  var el = document.getElementById("admin-content");
  var primoAccesso = !impostazioni.pin_hash;
  el.innerHTML =
    '<div style="text-align:center;">'
    + '<div style="font-size:3rem;">\uD83E\uDDC0</div>'
    + '<h2 style="margin:8px 0 4px;">' + (primoAccesso ? "Imposta il PIN admin" : "PIN admin") + '</h2>'
    + '<p style="color:var(--dim);font-family:\'Nunito\',sans-serif;font-weight:600;font-size:.85rem;" id="pin-sub">'
    + (primoAccesso ? "Scegli un PIN di 6 cifre per proteggere le modifiche." : "Inserisci il PIN per sbloccare l'amministrazione.") + '</p>'
    + '<div class="pin-dots" id="pin-dots"></div>'
    + '<div class="errore" id="pin-errore"></div>'
    + '<div class="pin-pad">'
    + [1,2,3,4,5,6,7,8,9].map(function(n){ return '<button class="pin-key" onclick="pinDigit(' + n + ')">' + n + '</button>'; }).join("")
    + '<button class="pin-key" onclick="pinBack()">\u2190</button>'
    + '<button class="pin-key" onclick="pinDigit(0)">0</button>'
    + '<button class="pin-key" onclick="chiudiAdmin()">\u2715</button>'
    + '</div></div>';
  _pinBuffer = "";
  _pinNuovo = null;
  renderPinDots();
}
var _pinNuovo = null;
function renderPinDots(){
  var d = document.getElementById("pin-dots");
  var s = "";
  for(var i = 0; i < 6; i++) s += '<div class="pin-dot' + (i < _pinBuffer.length ? " filled" : "") + '"></div>';
  d.innerHTML = s;
}
function pinBack(){ _pinBuffer = _pinBuffer.slice(0, -1); renderPinDots(); }
async function pinDigit(n){
  if(_pinBuffer.length >= 6) return;
  _pinBuffer += n;
  renderPinDots();
  if(_pinBuffer.length === 6){
    var pin = _pinBuffer;
    setTimeout(function(){ verificaPin(pin); }, 150);
  }
}
async function verificaPin(pin){
  var hash = await sha256(pin);
  var primoAccesso = !impostazioni.pin_hash;
  if(primoAccesso){
    if(_pinNuovo === null){
      _pinNuovo = hash;
      _pinBuffer = "";
      document.getElementById("pin-sub").textContent = "Ripeti il PIN per confermare.";
      renderPinDots();
      return;
    }
    if(hash !== _pinNuovo){
      _pinNuovo = null; _pinBuffer = "";
      document.getElementById("pin-sub").textContent = "Scegli un PIN di 6 cifre per proteggere le modifiche.";
      document.getElementById("pin-errore").textContent = "I PIN non coincidono, riprova.";
      renderPinDots();
      return;
    }
    try{
      await aggiornaImpostazioni({ pin_hash: hash });
      impostazioni.pin_hash = hash;
      adminOk = true;
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      renderAdmin();
    }catch(e){
      document.getElementById("pin-errore").textContent = "Errore salvataggio: " + e.message;
    }
  } else {
    if(hash === impostazioni.pin_hash){
      adminOk = true;
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      renderAdmin();
    } else {
      document.getElementById("pin-errore").textContent = "PIN errato.";
      _pinBuffer = "";
      renderPinDots();
    }
  }
}
function bloccaAdmin(){
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  adminOk = false;
  chiudiAdmin();
}

// ── PANNELLO ADMIN ──
function renderAdmin(){
  var el = document.getElementById("admin-content");
  if(!gruppo){
    el.innerHTML = '<div class="card"><div class="card-titolo">Nessun gruppo attivo</div>'
      + '<p style="font-family:\'Nunito\',sans-serif;font-size:.85rem;color:var(--dim);margin-bottom:12px;">Crea il primo gruppo d\'acquisto per iniziare.</p>'
      + '<button class="btn btn-cheese" onclick="apriNuovoGruppo()">\uD83E\uDDC0 Crea nuovo gruppo</button></div>'
      + renderArchivioHtml();
    return;
  }
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
    + '<h2 style="color:var(--cheese);">\uD83E\uDDC0 Admin</h2>'
    + '<button class="btn-pill" onclick="bloccaAdmin()">\uD83D\uDD12 Blocca</button></div>';

  // Gruppo + spedizione
  html += '<div class="card"><div class="card-titolo">Gruppo attivo</div>'
    + '<div class="m-row"><label>Titolo</label><div style="font-weight:800;">' + escapeHtml(gruppo.titolo) + '</div></div>'
    + '<div class="m-row"><label>Spedizione totale (\u20ac)</label>'
    + '<input class="inp" type="number" min="0" step="0.01" id="inp-spedizione" value="' + gruppo.spedizione_totale + '"></div>'
    + '<button class="btn btn-cheese btn-mini" onclick="salvaSpedizione()">Salva spedizione</button>'
    + '<div style="margin-top:14px;"><button class="btn btn-danger" onclick="confermaArchiviaGruppo()">\uD83D\uDCE6 Archivia e chiudi questo gruppo</button></div>'
    + '</div>';

  // Prezzi tipi
  html += '<div class="card"><div class="card-titolo">Prezzi al kg</div>'
    + tipi.map(function(t){
        return '<div class="admin-row"><span class="ar-nome">' + escapeHtml(t.nome) + '</span>'
          + '<div class="ar-actions"><input class="inp" style="width:110px;height:38px;" type="number" min="0" step="0.01" id="prezzo-' + t.id + '" value="' + t.prezzo_kg + '">'
          + '<button class="btn btn-cheese btn-mini" onclick="salvaPrezzoTipo(\'' + t.id + '\')">Salva</button></div></div>';
      }).join("")
    + '</div>';

  // Persone
  html += '<div class="card"><div class="card-titolo">Topolini registrati (' + persone.length + ')</div>'
    + (persone.length ? persone.map(function(p){
        return '<div class="admin-row"><span class="ar-nome">' + escapeHtml(p.nome) + '</span>'
          + '<div class="ar-actions">'
          + '<button class="btn-pill" onclick="apriRinomina(\'' + p.id + '\')">\u270F\uFE0F</button>'
          + '<button class="btn-pill" onclick="toggleSpedizionePersona(\'' + p.id + '\',' + !p.partecipa_spedizione + ')">' + (p.partecipa_spedizione ? "\uD83D\uDE9A no sped." : "\uD83D\uDE9A includi sped.") + '</button>'
          + '<button class="btn-pill" onclick="togglePagatoPersona(\'' + p.id + '\',' + !p.pagato + ')">' + (p.pagato ? "\u2705 pagato" : "\u274C non pagato") + '</button>'
          + '<button class="btn-pill" onclick="confermaEliminaPersona(\'' + p.id + '\')">\uD83D\uDDD1\uFE0F</button>'
          + '</div></div>';
      }).join("") : '<div class="empty">Nessun topolino ancora.</div>')
    + '</div>';

  // Righe ordine — prezzo reale alla consegna
  html += '<div class="card"><div class="card-titolo">Consegna — prezzo reale (dall\'etichetta)</div>';
  if(!righe.length){
    html += '<div class="empty">Nessun ordine ancora.</div>';
  } else {
    html += righe.map(function(r){
      var p = persone.find(function(x){ return x.id === r.persona_id; });
      return '<div class="admin-row"><span class="ar-nome">' + escapeHtml(p ? p.nome : "?") + ' \u2014 ' + nomeTipo(r.tipo_id) + ' (' + parseFloat(r.kg_nominale).toFixed(1) + 'kg nom.)</span>'
        + '<div class="ar-actions"><input class="inp" style="width:110px;height:38px;" type="number" min="0" step="0.01" placeholder="\u20ac reale" id="reale-' + r.id + '" value="' + (r.prezzo_reale != null ? r.prezzo_reale : "") + '">'
        + '<button class="btn btn-cheese btn-mini" onclick="salvaPrezzoReale(\'' + r.id + '\')">Salva</button></div></div>';
    }).join("");
  }
  html += '</div>';

  // Coordinate pagamento
  html += '<div class="card"><div class="card-titolo">Coordinate di pagamento</div>'
    + '<div class="m-row"><label>IBAN</label><input class="inp" id="inp-iban" value="' + escapeHtml(impostazioni.iban || "") + '"></div>'
    + '<div class="m-row"><label>Link PayPal (es. paypal.me/tuonome)</label><input class="inp" id="inp-paypal" value="' + escapeHtml(impostazioni.paypal_link || "") + '"></div>'
    + '<div class="m-row"><label>Link Satispay</label><input class="inp" id="inp-satispay" value="' + escapeHtml(impostazioni.satispay_link || "") + '"></div>'
    + '<button class="btn btn-cheese btn-mini" onclick="salvaPagamenti()">Salva coordinate</button>'
    + '</div>';

  // Export PDF
  html += '<div class="card"><div class="card-titolo">Esporta</div>'
    + '<button class="btn btn-ghost" onclick="esportaPDF()">\uD83D\uDCC4 Scarica PDF ordine</button></div>';

  html += renderArchivioHtml();

  el.innerHTML = html;
}

function renderArchivioHtml(){
  var html = '<div class="card"><div class="card-titolo">Archivio gruppi passati</div>';
  if(!archivioGruppi.length){
    html += '<div class="empty">Nessun gruppo archiviato ancora.</div>';
  } else {
    html += archivioGruppi.map(function(g){
      return '<div class="archivio-item" onclick="apriDettaglioArchivio(\'' + g.id + '\')">'
        + '<div><div class="ai-nome">' + escapeHtml(g.titolo) + '</div><div class="ai-meta">chiuso il ' + fmtData(g.chiuso_at) + '</div></div>'
        + '<span>\u203A</span></div>';
    }).join("");
  }
  html += '</div>';
  return html;
}

// ── AZIONI ADMIN: spedizione / prezzi / pagamenti ──
async function salvaSpedizione(){
  var v = parseFloat(document.getElementById("inp-spedizione").value) || 0;
  try{ await aggiornaSpedizione(v); await caricaTutto(); renderAdmin(); dot("ok", "Salvato \uD83E\uDDC0"); }
  catch(e){ alert("Errore: " + e.message); }
}
async function salvaPrezzoTipo(id){
  var v = parseFloat(document.getElementById("prezzo-" + id).value);
  if(!v || v <= 0) return;
  try{ await aggiornaPrezzoTipo(id, v); await caricaTutto(); renderAdmin(); dot("ok", "Salvato \uD83E\uDDC0"); }
  catch(e){ alert("Errore: " + e.message); }
}
async function salvaPrezzoReale(id){
  var el = document.getElementById("reale-" + id);
  var v = el.value === "" ? null : parseFloat(el.value);
  try{ await setPrezzoReale(id, v); await caricaTutto(); renderAdmin(); dot("ok", "Salvato \uD83E\uDDC0"); }
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
async function eseguiRinomina(id, nome){
  try{ await rinominaPersona(id, nome); await caricaTutto(); renderAdmin(); }
  catch(e){ alert("Errore: " + e.message); }
}
async function toggleSpedizionePersona(id, val){
  try{ await setPartecipaSpedizione(id, val); await caricaTutto(); renderAdmin(); }
  catch(e){ alert("Errore: " + e.message); }
}
async function togglePagatoPersona(id, val){
  try{ await setPagato(id, val); await caricaTutto(); renderAdmin(); }
  catch(e){ alert("Errore: " + e.message); }
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
function apriNuovoGruppo(){
  document.getElementById("ng-titolo").value = "";
  document.getElementById("ng-errore").textContent = "";
  document.getElementById("modal-nuovo-gruppo").classList.add("open");
}
function chiudiNuovoGruppo(){ document.getElementById("modal-nuovo-gruppo").classList.remove("open"); }
async function confermaNuovoGruppo(){
  var titolo = document.getElementById("ng-titolo").value.trim();
  if(!titolo){ document.getElementById("ng-errore").textContent = "Dai un nome al gruppo (es. Ottobre 2026)."; return; }
  var tipiDefault = [
    { nome: "12 mesi", prezzo_kg: 15.9 },
    { nome: "24 mesi", prezzo_kg: 17.9 },
    { nome: "36 mesi", prezzo_kg: 19.9 },
    { nome: "48 mesi", prezzo_kg: 21.9 }
  ];
  try{
    await creaGruppo(titolo, tipiDefault);
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
    var nPart = d.persone.filter(function(x){ return x.partecipa_spedizione; }).length;
    var quota = p.partecipa_spedizione && nPart ? (parseFloat(d.gruppo.spedizione_totale) || 0) / nPart : 0;
    return '<tr><td>' + escapeHtml(p.nome) + '</td><td>' + escapeHtml(dettaglio) + '</td><td>' + eur(tot + quota) + '</td>'
      + '<td>' + (p.pagato ? '<span class="badge ok">pagato</span>' : '<span class="badge no">non pagato</span>') + '</td></tr>';
  }).join("");
  var body = document.getElementById("admin-content");
  var backup = body.innerHTML;
  body.innerHTML = '<button class="btn-pill" onclick="renderAdmin()">\u2190 Torna all\'admin</button>'
    + '<div class="card" style="margin-top:12px;"><div class="card-titolo">' + escapeHtml(d.gruppo.titolo) + '</div>'
    + '<div class="tabella-wrap"><table class="tb"><thead><tr><th>Nome</th><th>Ordine</th><th>Totale</th><th>Stato</th></tr></thead><tbody>'
    + righeHtml + '</tbody></table></div></div>';
}

// ── EXPORT PDF (jsPDF via CDN, come La Tana) ──
function _conJsPDF(cb){
  if(typeof window.jspdf !== "undefined"){ cb(); return; }
  var s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  s.onload = cb;
  s.onerror = function(){ alert("Impossibile caricare il generatore PDF. Controlla la connessione."); };
  document.head.appendChild(s);
}
function esportaPDF(){ _conJsPDF(_generaPDF); }
function _pdfStrip(s){
  return String(s || "").replace(/[\u{1F000}-\u{1FFFF}]/gu, "").replace(/[\u2600-\u27BF]/gu, "").replace(/\uFE0F/g, "").trim();
}
function _generaPDF(){
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var _origText = doc.text.bind(doc);
  doc.text = function(str, x, y, opts){ return _origText(typeof str === "string" ? _pdfStrip(str) : str, x, y, opts); };

  var W = 210, margin = 16, y = margin;
  var CHEESE = [201, 135, 31], DARK = [40, 28, 10], GRAY = [120, 100, 75];
  doc.setFillColor(CHEESE[0], CHEESE[1], CHEESE[2]);
  doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(40, 28, 10);
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("Il Clan del Parmigiano", margin, 11);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(gruppo.titolo + " \u2014 generato il " + new Date().toLocaleDateString("it-IT"), margin, 18);
  y = 34;

  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("Nome", margin, y);
  doc.text("Ordine", margin + 34, y);
  doc.text("Totale", W - margin - 26, y, { align: "left" });
  doc.text("Stato", W - margin, y, { align: "right" });
  y += 5;
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.line(margin, y, W - margin, y);
  y += 4;

  persone.forEach(function(p){
    if(y > 275){ doc.addPage(); y = margin; }
    var dettaglio = righeDi(p.id).map(function(r){ return nomeTipo(r.tipo_id) + " " + parseFloat(r.kg_nominale).toFixed(1) + "kg"; }).join(", ") || "-";
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text(p.nome, margin, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    var righeDettaglio = doc.splitTextToSize(dettaglio, 90);
    doc.text(righeDettaglio, margin + 34, y);
    doc.setFont("helvetica", "bold");
    doc.text(eur(totaleDovuto(p)).replace("\u00a0", " "), W - margin - 26, y);
    doc.setFont("helvetica", "normal");
    doc.text(p.pagato ? "pagato" : "da pagare", W - margin, y, { align: "right" });
    y += Math.max(6, righeDettaglio.length * 4 + 2);
  });

  y += 4;
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.line(margin, y, W - margin, y);
  y += 6;
  var totale = persone.reduce(function(a, p){ return a + totaleDovuto(p); }, 0);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Totale gruppo: " + eur(totale).replace("\u00a0", " "), margin, y);

  doc.save("clan-parmigiano-" + gruppo.titolo.replace(/\s+/g, "-").toLowerCase() + ".pdf");
}
