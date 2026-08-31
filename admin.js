// ════════════════════════════════════════════════════════
//  Il Clan del Parmigiano — admin.js
//  PIN gate, pannello di amministrazione, archivio, PDF.
// ════════════════════════════════════════════════════════

var ADMIN_SESSION_KEY = "clan_parm_admin_ok";
var _pinBuffer = "";

function apriAdmin(){
  mostraSchermata("admin-screen");
  _faseAperta = null;   // riparte dalla fase dedotta dai dati, non da dove si era rimasti ieri
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
      proponiFlagAdmin();
    }catch(e){
      document.getElementById("pin-errore").textContent = "Errore salvataggio: " + e.message;
    }
  } else {
    if(hash === impostazioni.pin_hash){
      adminOk = true;
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      renderAdmin();
      proponiFlagAdmin();
    } else {
      document.getElementById("pin-errore").textContent = "PIN errato.";
      _pinBuffer = "";
      renderPinDots();
    }
  }
}
// `persone` è per-gruppo, quindi il flag va rimesso a ogni nuovo giro: un passaggio manuale
// da rifare ogni volta è un passaggio da dimenticare. Si propone da solo qui, che è l'unico
// momento in cui l'app sa con certezza che chi ha in mano il telefono è l'admin.
// Il "no" si ricorda per gruppo, come la × dell'invito all'installazione: una domanda che
// ritorna a ogni sblocco viene chiusa senza leggerla.
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

function bloccaAdmin(){
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  adminOk = false;
  chiudiAdmin();
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
  _faseAperta = (faseAperta() === n) ? 0 : n;   // 0 = tutte chiuse, e resta una scelta esplicita
  renderAdmin();
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

function renderAdmin(){
  var el = document.getElementById("admin-content");
  if(!gruppo){
    el.innerHTML = '<div class="card"><div class="card-titolo">Nessun gruppo attivo</div>'
      + '<p style="font-family:\'Nunito\',sans-serif;font-size:.85rem;color:var(--dim);margin-bottom:12px;">Crea il primo gruppo d\'acquisto per iniziare.</p>'
      + '<button class="btn btn-cheese" onclick="apriNuovoGruppo()">🧀 Crea nuovo gruppo</button></div>'
      + renderArchivioHtml();
    return;
  }

  var corrente = faseCorrente();
  var aperta = faseAperta();
  var corpi = {
    1: cardGruppoHtml() + cardPrezziHtml() + cardScadenzaHtml(),
    2: cardKgPerTipoHtml() + renderNegozianteHtml() + cardChiusuraHtml(),
    3: renderScontrinoHtml() + cardArrivoHtml(),
    4: cardConsegnaHtml() + renderQuadraturaHtml(),
    5: renderDaConfermareHtml() + renderRiepilogoHtml() + cardTopoliniHtml() + cardCoordinateHtml(),
    6: cardPdfHtml() + cardArchiviaHtml()
  };

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
    + '<h2 style="color:var(--cheese-txt);">🧀 Admin</h2>'
    + '<button class="btn-pill" onclick="bloccaAdmin()">🔒 Blocca</button></div>';

  html += bannerSegnalazioniHtml();
  html += fasiTestaHtml(corrente, aperta);

  html += FASI.map(function(f){
    var cls = "fase" + (f.n === aperta ? " aperta" : "") + (f.n === corrente ? " corrente" : "");
    return '<div class="' + cls + '">'
      + '<button class="fase-testa" onclick="toggleFase(' + f.n + ')" aria-expanded="' + (f.n === aperta) + '">'
      +   '<span class="fase-num">' + f.n + '</span>'
      +   '<span>' + escapeHtml(f.titolo) + '</span>'
      +   '<span class="fase-freccia">›</span>'
      + '</button>'
      + '<div class="fase-corpo">' + corpi[f.n] + '</div>'
      + '</div>';
  }).join("");

  // Fuori dalla fisarmonica: non appartengono a nessuna fase del giro.
  html += cardSicurezzaHtml();
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
function fasiTestaHtml(corrente, aperta){
  var h = '<div class="fasi-testa"><div class="fasi-striscia">';
  FASI.forEach(function(f, i){
    if(i) h += '<span class="fs-linea"></span>';
    var cls = "fs-passo" + (f.n === corrente ? " ora" : (f.n < corrente ? " fatto" : ""));
    h += '<button class="' + cls + '" onclick="toggleFase(' + f.n + ')" title="' + escapeHtml(f.titolo) + '"'
      + ' aria-label="Fase ' + f.n + ': ' + escapeHtml(f.titolo) + '">' + CERCHIATI[i] + '</button>';
  });
  h += '</div>';

  var f = FASI[corrente - 1];
  h += '<div class="fasi-tocca"><b>Tocca a te</b>' + escapeHtml(f.tocca);

  // Una segnalazione di pagamento è urgente in qualunque fase, e sepolta dentro la ⑤
  // chiusa non la vedrebbe nessuno: qui sopra invece è la prima cosa che si legge.
  var attesa = segnalazioniInAttesa().length;
  if(attesa && aperta !== 5){
    h += '<br>⏳ ' + attesa + (attesa === 1 ? ' topino dice' : ' topini dicono')
      + ' di aver pagato: '
      + '<button class="sc-mod" style="padding-left:0;" onclick="toggleFase(5)">conferma nella fase ⑤</button>';
  }
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
    + '<div class="hint">Si divide tra i topini che partecipano. Cambia con i kg totali, quindi è normale ritoccarla in corso d\'opera: se qualcuno ha già pagato te lo dico prima di salvare.</div>'
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
    h += '<div class="pc-riga grande"><span>Totale</span><span>' + kgFmt(tot) + '</span></div></div>';
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
          + '<div class="hint" style="margin-bottom:0;">Accende il banner nell\'app per tutti e prepara il messaggio '
          + 'WhatsApp con i totali: la chat e l\'invio li scegli tu.</div>')
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
function cardTopoliniHtml(){
  var h = '<div class="card"><div class="card-titolo">Topini registrati (' + persone.length + ')</div>';
  if(!persone.length){
    h += '<div class="empty">Nessun topino ancora.</div>';
  } else {
    h += persone.map(function(p){
      return '<div class="persona-blocco">'
        + '<div class="admin-row"><span class="ar-nome">' + escapeHtml(p.nome)
        +   (p.pagamento_segnalato ? ' <span class="ar-flag">⏳ dice di aver pagato</span>' : '') + '</span>'
        +   '<div class="ar-actions">'
        +     '<button class="btn-pill" title="Rinomina" onclick="apriRinomina(\'' + p.id + '\')">✏️</button>'
        +     '<button class="btn-pill" title="Elimina" onclick="confermaEliminaPersona(\'' + p.id + '\')">🗑️</button>'
        +   '</div></div>'
        + swRigaHtml("Spedizione", "sw-sped-" + p.id, p.partecipa_spedizione,
                     "toggleSpedizionePersona('" + p.id + "', this)",
                     p.partecipa_spedizione ? "inclusa" : "esclusa")
        + swRigaHtml("Pagato", "sw-pag-" + p.id, p.pagato,
                     "togglePagatoPersona('" + p.id + "', this)",
                     p.pagato ? "sì" : "no")
        + swRigaHtml("Admin", "sw-adm-" + p.id, p.is_admin,
                     "toggleAdminPersona('" + p.id + "', this)",
                     p.is_admin ? "sì" : "no")
        + '</div>';
    }).join("");
  }
  return h + '</div>';
}
function swRigaHtml(nome, id, acceso, handler, stato){
  return '<div class="sw-riga"><span class="sw-nome">' + nome + '</span>'
    + '<button class="sw' + (acceso ? " on" : "") + '" id="' + id + '" type="button" role="switch"'
    +   ' aria-checked="' + (acceso ? "true" : "false") + '" aria-label="' + nome + '"'
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
function cardSicurezzaHtml(){
  return '<div class="card"><div class="card-titolo">Sicurezza</div>'
    + '<button class="btn btn-ghost" onclick="apriCambioPin()">🔐 Cambia il PIN admin</button></div>';
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

  h += '<div class="hint" style="margin-top:12px;margin-bottom:0;">' + (conSped
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
  var n = numeroPartecipantiSpedizione();
  var pagati = persone.filter(function(p){ return p.pagato && p.partecipa_spedizione; }).length;
  if(pagati && n){
    avvisi.push("⚠️ " + pagati + (pagati === 1 ? " topino ha" : " topini hanno")
      + " già pagato sulla vecchia quota (" + eurTesto(vecchia / n) + " a testa → "
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
// Non tocca i permessi — l'admin resta il PIN. Accende solo la pillola che dice al gruppo
// a chi chiedere, ed è per questo che si può accendere su più di una persona senza danno.
async function toggleAdminPersona(id, el){
  vibra(10);
  var val = !el.classList.contains("on");
  _swSposta(el, val, val ? "s\u00ec" : "no");
  try{
    await setIsAdmin(id, val);
    await caricaTutto(); renderAdmin();
  }catch(e){
    _swSposta(el, !val, !val ? "s\u00ec" : "no");
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
function apriNuovoGruppo(){
  document.getElementById("ng-titolo").value = "";
  document.getElementById("ng-password").value = "";
  document.getElementById("ng-errore").textContent = "";
  openModal("modal-nuovo-gruppo");
}
function chiudiNuovoGruppo(){ closeModal("modal-nuovo-gruppo"); }
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

// ── CAMBIO PIN ADMIN ──
function apriCambioPin(){
  ["cp-vecchio","cp-nuovo","cp-conferma"].forEach(function(id){ document.getElementById(id).value = ""; });
  document.getElementById("cp-errore").textContent = "";
  openModal("modal-pin");
}
function chiudiCambioPin(){ closeModal("modal-pin"); }
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
    // Il link PayPal va NUDO, senza importo: `linkPayPalConImporto` esiste per la tab
    // Pagamenti, dove il link si costruisce per persona. Qui il messaggio è uno solo per
    // tutti, e un paypal.me con l'importo dentro sarebbe l'importo sbagliato per chiunque
    // tranne uno. L'ordine IBAN → PayPal → Satispay è lo stesso del PDF e della tab.
    + (impostazioni.paypal_link ? "\nPayPal: " + impostazioni.paypal_link : "")
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
