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
  var haPassword = !!passwordGruppoHash();
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
    + '<h2 style="color:var(--cheese-txt);">\uD83E\uDDC0 Admin</h2>'
    + '<button class="btn-pill" onclick="bloccaAdmin()">\uD83D\uDD12 Blocca</button></div>';

  // Gruppo + spedizione
  html += '<div class="card"><div class="card-titolo">Gruppo attivo</div>'
    + '<div class="m-row"><label>Titolo</label><div style="font-weight:800;">' + escapeHtml(gruppo.titolo) + '</div></div>'
    + '<div class="m-row"><label>Spedizione totale (\u20ac)</label>'
    + '<input class="inp" type="number" min="0" step="0.01" id="inp-spedizione" value="' + gruppo.spedizione_totale + '"></div>'
    + '<button class="btn btn-cheese btn-mini" onclick="salvaSpedizione()">Salva spedizione</button>'
    + '<div class="m-row" style="margin-top:14px;"><label>Password d\'accesso</label>'
    + '<input class="inp" id="inp-password" type="text" autocapitalize="none" autocorrect="off"'
    +   ' spellcheck="false" autocomplete="off" placeholder="'
    +   (haPassword ? "scrivi qui la nuova password" : "es. topogrigio26") + '"></div>'
    + '<div class="hint">' + (haPassword
        ? '\uD83D\uDD12 Una password c\'\u00e8 gi\u00e0. <b>Non posso mostrartela</b>: a DB ne resta solo l\'impronta, non il testo. Per cambiarla, scrivine una nuova.'
        : '\uD83D\uDD13 Nessuna password: chiunque abbia il link entra. Scrivine una e girala sul gruppo WhatsApp.')
      + ' Cambiandola, tutti i dispositivi gi\u00e0 entrati dovranno reinserirla.</div>'
    + '<div class="ar-actions">'
    +   '<button class="btn btn-cheese btn-mini" onclick="salvaPasswordGruppoAdmin()">Salva password</button>'
    +   (haPassword ? '<button class="btn btn-ghost btn-mini" onclick="rimuoviPasswordGruppoAdmin()">Togli la password</button>' : '')
    + '</div>'
    + '<div class="m-row" style="margin-top:14px;"><label>Chiusura ordini</label>'
    + '<input class="inp" type="datetime-local" id="inp-chiusura" value="' + isoToInputLocale(gruppo.chiusura_ordini) + '"></div>'
    + '<div class="hint">' + (ordiniChiusi()
        ? '\uD83D\uDD12 Ordini <b>chiusi</b> dal ' + escapeHtml(fmtDataOra(gruppo.chiusura_ordini)) + '. I topini non possono più modificare.'
        : (gruppo.chiusura_ordini
            ? '\u23F0 Si chiudono il ' + escapeHtml(fmtDataOra(gruppo.chiusura_ordini)) + '.'
            : 'Nessuna scadenza: gli ordini restano aperti.')) + '</div>'
    + '<div class="ar-actions">'
    +   '<button class="btn btn-cheese btn-mini" onclick="salvaChiusuraOrdini()">Salva scadenza</button>'
    +   (gruppo.chiusura_ordini ? '<button class="btn btn-ghost btn-mini" onclick="riapriOrdini()">Riapri gli ordini</button>' : '')
    + '</div>'
    + '<div style="margin-top:14px;"><button class="btn btn-danger" onclick="confermaArchiviaGruppo()">\uD83D\uDCE6 Archivia e chiudi questo gruppo</button></div>'
    + '</div>';

  html += renderRiepilogoHtml();
  html += renderQuadraturaHtml();
  html += renderDaConfermareHtml();

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
        return '<div class="admin-row"><span class="ar-nome">' + escapeHtml(p.nome)
          + (p.pagamento_segnalato ? ' <span class="ar-flag">\u23F3 dice di aver pagato</span>' : '') + '</span>'
          + '<div class="ar-actions">'
          + '<button class="btn-pill" onclick="apriRinomina(\'' + p.id + '\')">\u270F\uFE0F</button>'
          + '<button class="btn-pill" onclick="toggleSpedizionePersona(\'' + p.id + '\',' + !p.partecipa_spedizione + ')">' + (p.partecipa_spedizione ? "\uD83D\uDE9A no sped." : "\uD83D\uDE9A includi sped.") + '</button>'
          + '<button class="btn-pill" onclick="togglePagatoPersona(\'' + p.id + '\',' + !p.pagato + ')">' + (p.pagato ? "\u2705 pagato" : "\u274C non pagato") + '</button>'
          + '<button class="btn-pill" onclick="confermaEliminaPersona(\'' + p.id + '\')">\uD83D\uDDD1\uFE0F</button>'
          + '</div></div>';
      }).join("") : '<div class="empty">Nessun topolino ancora.</div>')
    + '</div>';

  // Consegna: si apre un sacchetto per persona, non si spulcia una lista di tutte le righe
  html += '<div class="card"><div class="card-titolo">Consegna — prezzi reali</div>';
  var conOrdine = persone.filter(function(p){ return righeDi(p.id).length; });
  if(!conOrdine.length){
    html += '<div class="empty">Nessun ordine ancora.</div>';
  } else {
    html += '<div class="hint">Tocca un nome per inserire gli importi letti dalle etichette.</div>';
    html += conOrdine.map(function(p){
      var mie = righeDi(p.id);
      var fatte = mie.filter(function(r){ return r.prezzo_reale != null; }).length;
      var completa = fatte === mie.length;
      return '<div class="admin-row cliccabile" onclick="apriReali(\'' + p.id + '\')">'
        + '<span class="ar-nome">' + escapeHtml(p.nome) + '</span>'
        + '<div class="ar-actions">'
        +   '<span class="badge ' + (completa ? "ok" : "no") + '">' + fatte + ' su ' + mie.length + '</span>'
        +   '<span class="ar-freccia">\u203A</span>'
        + '</div></div>';
    }).join("");
  }
  html += '</div>';

  // Coordinate pagamento
  html += '<div class="card"><div class="card-titolo">Coordinate di pagamento</div>'
    + '<div class="m-row"><label>IBAN</label><input class="inp" id="inp-iban" value="' + escapeHtml(impostazioni.iban || "") + '"></div>'
    + '<div class="m-row"><label>Link PayPal (es. paypal.me/tuonome)</label><input class="inp" id="inp-paypal" value="' + escapeHtml(impostazioni.paypal_link || "") + '"></div>'
    + '<div class="m-row"><label>Satispay (numero o tag, es. @topolino)</label><input class="inp" id="inp-satispay" value="' + escapeHtml(impostazioni.satispay_link || "") + '"></div>'
    + '<div class="hint">Con un account personale non esiste un link con importo preimpostato: i topini digitano la cifra a mano.</div>'
    + '<button class="btn btn-cheese btn-mini" onclick="salvaPagamenti()">Salva coordinate</button>'
    + '</div>';

  // Documento A: l'ordine da mandare al negoziante
  html += renderNegozianteHtml();

  // Documento B + avvisi
  html += '<div class="card"><div class="card-titolo">Riepilogo per il clan</div>'
    + '<button class="btn btn-cheese" onclick="esportaPDF()">\uD83D\uDCC4 Riepilogo PDF per il gruppo</button>'
    + '<div class="hint">Un PDF per persona con ordine, conti e coordinate di pagamento, da girare su WhatsApp. '
    + 'Si adatta da solo: prima della consegna mostra gli importi attesi, dopo anche quelli reali.</div>'
    + '</div>';

  // Arrivo del pacco: flag + avviso, un'azione sola (vedi `segnalaArrivoAlGruppo`)
  var arrivo = arrivoSegnalato();
  html += '<div class="card"><div class="card-titolo">Arrivo del pacco</div>'
    + (arrivo
        ? '<div class="hint">\uD83E\uDDC0 Segnalato come <b>arrivato il '
          + escapeHtml(fmtData(arrivo)) + '</b>. Il banner verde \u00e8 acceso in cima alla tab Ordina '
          + 'per tutti i topini.</div>'
          + '<div class="ar-actions">'
          +   '<button class="btn btn-ghost btn-mini" onclick="rimandaMessaggioArrivo()">\uD83D\uDCE4 Rimanda il messaggio</button>'
          +   '<button class="btn btn-ghost btn-mini" onclick="annullaSegnalazioneArrivo()">\u21A9\uFE0F Annulla la segnalazione</button>'
          + '</div>'
        : '<button class="btn btn-cheese" onclick="segnalaArrivoAlGruppo()">'
          + '<span class="svg-inv svg-formaggio-arrivato btn-ico-svg"></span> Segnala l\'arrivo al gruppo</button>'
          + '<div class="hint" style="margin-bottom:0;">Accende il banner nell\'app per tutti e prepara il messaggio '
          + 'WhatsApp con i totali: la chat e l\'invio li scegli tu.</div>')
    + '</div>';

  html += '<div class="card"><div class="card-titolo">Sicurezza</div>'
    + '<button class="btn btn-ghost" onclick="apriCambioPin()">\uD83D\uDD10 Cambia il PIN admin</button></div>';

  html += renderArchivioHtml();

  el.innerHTML = html;
  notaAuto(document.getElementById("inp-note-negoziante"));   // altezza iniziale sul contenuto
}

// Richieste in attesa: il topino segnala, qui l'admin verifica e conferma.
function renderDaConfermareHtml(){
  var attesa = persone.filter(function(p){ return p.pagamento_segnalato && !p.pagato; });
  if(!attesa.length) return "";
  var h = '<div class="card card-attesa"><div class="card-titolo">\u23F3 Pagamenti da confermare ('
    + attesa.length + ')</div>';
  h += '<div class="hint">Hanno segnalato di aver pagato. Confermi tu dopo aver verificato: '
    + 'la segnalazione da sola non li marca come pagati.</div>';
  h += attesa.map(function(p){
    return '<div class="admin-row"><span class="ar-nome">' + escapeHtml(p.nome)
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

// ── QUADRATURA SULLO SCONTRINO ──
// Sta accanto al Riepilogo ma resta un blocco a sé, perché risponde a un'altra domanda:
// il Riepilogo dice CHI ha pagato, questo dice se gli importi battuti fanno il totale
// che l'admin ha effettivamente anticipato. Mescolarli renderebbe illeggibili entrambi.
function renderQuadraturaHtml(){
  var q = quadratura();
  var assegnato = sommaPrezziReali();
  var h = '<div class="card"><div class="card-titolo">\uD83E\uDDFE Quadratura sullo scontrino</div>';
  h += '<div class="m-row"><label>Scontrino parmigiano (\u20ac) \u2014 solo formaggio, spedizione esclusa</label>'
    + '<input class="inp" type="number" min="0" step="0.01" inputmode="decimal" id="inp-costo-reale"'
    + ' placeholder="quanto hai pagato tu" value="'
    + (gruppo.costo_reale_totale != null ? gruppo.costo_reale_totale : "") + '"></div>';
  h += '<div class="ar-actions">'
    +   '<button class="btn btn-cheese btn-mini" onclick="salvaCostoRealeTotale()">Salva scontrino</button>'
    +   (gruppo.costo_reale_totale != null
          ? '<button class="btn btn-ghost btn-mini" onclick="azzeraCostoRealeTotale()">Togli</button>' : '')
    + '</div>';
  h += '<div class="pc-conti" style="margin-top:14px;">';
  if(q) h += '<div class="pc-riga"><span>Scontrino parmigiano</span><span>' + eur(q.scontrino) + '</span></div>';
  h += '<div class="pc-riga reale"><span>Assegnato ai topini</span><span>' + eur(assegnato) + '</span></div>';
  if(q){
    var quadra = Math.abs(q.residuo) < 0.005;
    h += '<div class="pc-riga grande' + (quadra ? '' : ' non-quadra') + '"><span>'
      + (quadra ? 'Tutto quadra \u2705'
                : (q.residuo > 0 ? 'Ancora da assegnare \u26A0\uFE0F' : 'Assegnato in pi\u00f9 \u26A0\uFE0F'))
      + '</span><span>' + (quadra ? '' : eur(Math.abs(q.residuo))) + '</span></div>';
  }
  h += '</div>';
  h += '<div class="hint" style="margin-top:10px;margin-bottom:0;">' + (q
      ? 'La somma degli importi letti dalle etichette deve fare lo scontrino. Se non torna, una l\'hai battuta male: meglio accorgersene adesso che quando qualcuno ha gi\u00e0 pagato di pi\u00f9.'
      : 'La spesa l\'hai anticipata tu, quindi il totale del parmigiano lo conosci gi\u00e0. Scrivilo qui e diventa un controllo automatico su tutti gli importi delle etichette.')
    + '</div>';
  h += '</div>';
  return h;
}
async function salvaCostoRealeTotale(){
  var raw = document.getElementById("inp-costo-reale").value.trim();
  if(raw === ""){ alert("Scrivi il totale dello scontrino, oppure usa \"Togli\"."); return; }
  var v = parseFloat(raw);
  if(isNaN(v) || v < 0){ alert("Importo non valido."); return; }
  try{ await aggiornaCostoRealeTotale(v); await caricaTutto(); renderAdmin(); dot("ok", "Scontrino salvato \uD83E\uDDFE"); }
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
    + '<textarea id="inp-note-negoziante" class="nota-textarea" rows="2" maxlength="500" oninput="notaAuto(this)"'
    + ' placeholder="es. se possibile un pezzo da 1 kg al posto di due da mezzo">'
    + escapeHtml(gruppo.note_negoziante || "") + '</textarea></div>';
  h += '<div class="ar-actions" style="margin-bottom:14px;">'
    + '<button class="btn btn-ghost btn-mini" onclick="salvaNoteNegoziante()">Salva le note</button></div>';
  h += '<pre class="doc-testo" id="doc-negoziante">' + escapeHtml(testoOrdineNegoziante()) + '</pre>';
  h += '<button class="btn btn-cheese" onclick="copiaOrdineNegoziante()">\uD83D\uDCCB Copia il testo</button>';
  h += '<div class="hint" style="margin-top:10px;margin-bottom:0;">Ai nostri prezzi farebbe <b>'
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
async function salvaSpedizione(){
  var v = parseFloat(document.getElementById("inp-spedizione").value) || 0;
  try{ await aggiornaSpedizione(v); await caricaTutto(); renderAdmin(); dot("ok", "Salvato \uD83E\uDDC0"); }
  catch(e){ alert("Errore: " + e.message); }
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
  document.getElementById("ng-password").value = "";
  document.getElementById("ng-errore").textContent = "";
  document.getElementById("modal-nuovo-gruppo").classList.add("open");
}
function chiudiNuovoGruppo(){ document.getElementById("modal-nuovo-gruppo").classList.remove("open"); }
async function confermaNuovoGruppo(){
  var titolo = document.getElementById("ng-titolo").value.trim();
  var password = document.getElementById("ng-password").value.trim();
  if(!titolo){ document.getElementById("ng-errore").textContent = "Dai un nome al gruppo (es. Ottobre 2026)."; return; }
  var tipiDefault = [
    { nome: "12 mesi", prezzo_kg: 15.9 },
    { nome: "24 mesi", prezzo_kg: 17.9 },
    { nome: "36 mesi", prezzo_kg: 19.9 },
    { nome: "48 mesi", prezzo_kg: 21.9 }
  ];
  try{
    await creaGruppo(titolo, await hashPassword(password), tipiDefault);
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
    'Spariscono per sempre <b>' + escapeHtml(g.titolo) + '</b>, i suoi topolini, i loro ordini '
    + 'e le note della bacheca. Non c\'\u00e8 modo di recuperarli.';
  var inp = document.getElementById("eg-titolo");
  inp.value = "";
  document.getElementById("eg-errore").textContent = "";
  document.getElementById("eg-conferma").disabled = true;
  document.getElementById("modal-elimina-gruppo").classList.add("open");
  setTimeout(function(){ inp.focus(); }, 60);
}
function chiudiEliminaGruppo(){
  _gruppoDaEliminare = null;
  document.getElementById("modal-elimina-gruppo").classList.remove("open");
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
  calcRender();
  document.getElementById("modal-calc").classList.add("open");
}
function closeCalc(){ document.getElementById("modal-calc").classList.remove("open"); }

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
function calcConferma(){
  _calcApplica();
  var ris = Math.round(_calcAcc * 100) / 100;
  if(ris < 0) ris = 0;   // un importo negativo non ha senso in un campo prezzo
  var campo = document.getElementById(_calcTarget);
  if(campo){
    campo.value = ris;
    campo.dispatchEvent(new Event("input"));
  }
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
  document.getElementById("mr-errore").textContent = "";
  var el = document.getElementById("mr-righe");
  el.innerHTML = mie.length ? mie.map(function(r){
    var t = tipi.find(function(x){ return x.id === r.tipo_id; });
    var atteso = (t ? parseFloat(t.prezzo_kg) : 0) * parseFloat(r.kg_nominale);
    return '<div class="mr-riga">'
      + '<div class="mr-info"><div class="mr-tipo">' + escapeHtml(nomeTipo(r.tipo_id)) + '</div>'
      +   '<div class="mr-kg">' + kgFmt(parseFloat(r.kg_nominale)) + ' \u00b7 atteso ' + eur(atteso) + '</div>'
      +   '<div class="mr-scarto" id="mr-scarto-' + r.id + '">' + testoScartoRiga(r, r.prezzo_reale) + '</div>'
      + '</div>'
      + '<div class="mr-campo inp-euro-wrap">'
      +   '<input class="inp" type="number" min="0" step="0.01" inputmode="decimal" placeholder="\u20ac reale"'
      +     ' id="mr-' + r.id + '" oninput="aggiornaScartoRiga(\'' + r.id + '\')"'
      +     ' value="' + (r.prezzo_reale != null ? r.prezzo_reale : "") + '">'
      +   '<button type="button" class="btn-calc-icon" onclick="openCalc(\'mr-' + r.id + '\')" title="Somma le etichette">\uD83E\uDDEE</button>'
      + '</div></div>';
  }).join("") : '<div class="empty">Questa persona non ha ordinato nulla.</div>';
  document.getElementById("modal-reali").classList.add("open");
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
  document.getElementById("modal-reali").classList.remove("open");
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

// ── CAMBIO PIN ADMIN ──
function apriCambioPin(){
  ["cp-vecchio","cp-nuovo","cp-conferma"].forEach(function(id){ document.getElementById(id).value = ""; });
  document.getElementById("cp-errore").textContent = "";
  document.getElementById("modal-pin").classList.add("open");
}
function chiudiCambioPin(){ document.getElementById("modal-pin").classList.remove("open"); }
async function confermaCambioPin(){
  var err = document.getElementById("cp-errore");
  var vecchio = document.getElementById("cp-vecchio").value.trim();
  var nuovo = document.getElementById("cp-nuovo").value.trim();
  var conferma = document.getElementById("cp-conferma").value.trim();
  if(!/^\d{6}$/.test(nuovo)){ err.textContent = "Il nuovo PIN deve essere di 6 cifre."; return; }
  if(nuovo !== conferma){ err.textContent = "I due nuovi PIN non coincidono."; return; }
  try{
    if(impostazioni.pin_hash && (await sha256(vecchio)) !== impostazioni.pin_hash){
      err.textContent = "Il PIN attuale non è corretto."; return;
    }
    var hash = await sha256(nuovo);
    await aggiornaImpostazioni({ pin_hash: hash });
    impostazioni.pin_hash = hash;
    chiudiCambioPin();
    dot("ok", "PIN aggiornato \uD83D\uDD10");
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
function testoPaccoArrivato(){
  var righeMsg = persone.map(function(p){
    return "\u2022 " + p.nome + ": " + eur(totaleDovuto(p)).replace("\u00a0", " ") + (p.pagato ? " (gi\u00e0 pagato)" : "");
  }).join("\n");
  var quota = numeroPartecipantiSpedizione()
    ? (parseFloat(gruppo.spedizione_totale) || 0) / numeroPartecipantiSpedizione() : 0;
  var t = "\uD83E\uDDC0 Il parmigiano \u00e8 arrivato!\n\n"
    + gruppo.titolo + "\n\n"
    + righeMsg + "\n\n"
    + "Spedizione: " + eur(gruppo.spedizione_totale).replace("\u00a0", " ")
    + " divisa tra " + numeroPartecipantiSpedizione() + " topini = " + eur(quota).replace("\u00a0", " ") + " a testa.\n"
    + (impostazioni.iban ? "\nIBAN: " + impostazioni.iban : "")
    + (impostazioni.satispay_link ? "\nSatispay: " + impostazioni.satispay_link : "")
    + "\n\nControllate il vostro totale nell'app prima di pagare!";
  return t;
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
    doc.text(p.nome, margin, y);

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
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Totale gruppo: " + eurTesto(totGruppo), margin, y);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(kgTesto(kgGruppo) + " di parmigiano \u00b7 spedizione "
    + eurTesto(parseFloat(gruppo.spedizione_totale) || 0) + " divisa tra "
    + numeroPartecipantiSpedizione() + " \u00b7 " + nPagati + " su " + persone.length + " hanno pagato",
    margin, y + 4.5);
  y += 14;

  // ── Come pagare: sempre in fondo, è il documento che dice "adesso pagatemi" ──
  var coordinate = [];
  if(impostazioni.iban) coordinate.push("IBAN: " + impostazioni.iban);
  if(impostazioni.paypal_link) coordinate.push("PayPal: " + impostazioni.paypal_link);
  if(impostazioni.satispay_link) coordinate.push("Satispay: " + impostazioni.satispay_link);
  coordinate.push("Oppure in contanti, di persona.");
  if(y + coordinate.length * 4.6 + 14 > 285){ doc.addPage(); y = margin + 4; }
  doc.setFillColor(250, 244, 232);
  doc.rect(margin, y, destra - margin, coordinate.length * 4.6 + 12, "F");
  y += 7;
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Come pagare", margin + 4, y);
  y += 5.5;
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
  coordinate.forEach(function(riga){ doc.text(riga, margin + 4, y); y += 4.6; });

  doc.save("clan-parmigiano-" + gruppo.titolo.replace(/\s+/g, "-").toLowerCase() + ".pdf");
}
