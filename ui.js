// ════════════════════════════════════════════════════════
//  Il Clan del Parmigiano — ui.js
//  Rendering: scelta identità, ordina, tabella, pagamenti.
// ════════════════════════════════════════════════════════

// ── SCHERMATA SENZA GRUPPO ATTIVO ──
// (gestita in index.html + admin.js: solo l'admin può creare il primo gruppo)

// ── AUTH: scelta/creazione nome ──
// La lista dei nomi è visibile subito; il cancello (conferma "sei tu?" + password
// di gruppo al primo ingresso da questo device) scatta al momento di entrare,
// sia scegliendo un nome esistente sia creandone uno nuovo.
function renderAuth(){
  document.getElementById("auth-gruppo-titolo").textContent = gruppo.titolo;
  var el = document.getElementById("lista-persone");
  // L'intestazione sparisce a lista vuota: "I topini già nel Clan" sopra "nessuno si è
  // ancora registrato" sono due frasi che si contraddicono a due righe di distanza.
  var titoloLista = document.getElementById("auth-lista-titolo");
  if(titoloLista) titoloLista.style.display = persone.length ? "" : "none";
  if(!persone.length){
    el.innerHTML = '<div class="empty">Nessuno si è ancora registrato.<br>Sii il primo topino! \uD83D\uDC2D</div>';
  } else {
    // Solo nome e topino: NIENTE stato del pagamento. Due ragioni, la prima da sola
    // basterebbe. (1) Questa schermata si vede una volta sola per dispositivo, quindi
    // un'informazione messa qui non raggiunge quasi nessuno. (2) Sta PRIMA della
    // password di gruppo: chiunque abbia il link — anche chi nel clan non c'è — vedrebbe
    // chi ha pagato e chi no. Non è il caso del PDF, che circola già fra membri.
    // Lo stato resta dov'era: tab Tabella e area admin.
    el.innerHTML = persone.map(function(p){
      return '<div class="persona-pick" onclick="sceglioPersona(\'' + p.id + '\')">'
        + '<span class="pp-emoji">\uD83D\uDC2D</span><span class="pp-nome">' + escapeHtml(p.nome) + '</span></div>';
    }).join("");
  }
  var lucchetto = document.getElementById("auth-lucchetto");
  if(lucchetto){
    var serve = passwordGruppoHash() && !gruppoSbloccato();
    lucchetto.style.display = serve ? "" : "none";
  }
  document.getElementById("nuovo-nome").value = "";
  document.getElementById("auth-errore").textContent = "";
}

// ── CANCELLO D'INGRESSO (conferma identità + password di gruppo) ──
var _ingressoPend = null;   // {tipo:"esistente", id} oppure {tipo:"nuovo", nome}

function sceglioPersona(id){
  var p = persone.find(function(x){ return x.id === id; });
  if(!p) return;
  apriIngresso({ tipo: "esistente", id: id }, "Sei tu, " + p.nome + "?");
}
function confermaNuovoNome(){
  var nome = document.getElementById("nuovo-nome").value.trim();
  var err = document.getElementById("auth-errore");
  if(!nome){ err.textContent = "Scrivi un nome."; return; }
  if(persone.some(function(p){ return p.nome.toLowerCase() === nome.toLowerCase(); })){
    err.textContent = "C'è già un topino con questo nome — sceglilo dalla lista, o aggiungi un'iniziale.";
    return;
  }
  err.textContent = "";
  apriIngresso({ tipo: "nuovo", nome: nome }, "Entri come " + nome + "?");
}

function apriIngresso(pend, titolo){
  _ingressoPend = pend;
  var serve = !gruppoSbloccato();
  document.getElementById("mi-titolo").textContent = titolo;
  document.getElementById("mi-sub").textContent = serve
    ? "Primo ingresso da questo dispositivo: serve la password del gruppo, quella che l'admin ha girato su WhatsApp."
    : "Se hai toccato il nome sbagliato, annulla e riprova.";
  document.getElementById("mi-pwd-row").style.display = serve ? "" : "none";
  document.getElementById("mi-pwd").value = "";
  document.getElementById("mi-errore").textContent = "";
  openModal("modal-ingresso");
  if(serve) setTimeout(function(){ document.getElementById("mi-pwd").focus(); }, 60);
}
function chiudiIngresso(){
  _ingressoPend = null;
  closeModal("modal-ingresso");
}
async function confermaIngresso(){
  if(!_ingressoPend) return;
  var err = document.getElementById("mi-errore");
  if(!gruppoSbloccato()){
    if(!(await passwordCorretta(document.getElementById("mi-pwd").value))){
      err.textContent = "Password sbagliata. Richiedila all'admin sul gruppo.";
      return;
    }
    segnaSbloccato();
  }
  err.textContent = "";
  var pend = _ingressoPend;
  try{
    var id = pend.id;
    if(pend.tipo === "nuovo"){
      var p = await creaPersona(pend.nome);
      persone.push(p);
      id = p.id;
    }
    chiudiIngresso();
    entraComePersona(id);
  }catch(e){ err.textContent = "Errore: " + e.message; }
}
function entraComePersona(id){
  mioId = id;
  setMiaIdentita(id);
  mostraSchermata("app-screen");
  renderApp();
}

// ── APP (dopo identità) ──
function renderApp(){
  var mia = persone.find(function(p){ return p.id === mioId; });
  document.getElementById("app-gruppo-titolo").textContent = gruppo ? gruppo.titolo : "";
  document.getElementById("app-mio-nome").textContent = mia ? mia.nome : "";
  aggiornaBadgeAdmin();
  switchTab(currentTab);
}

// Pallino col numero sul 🔐 della barra in alto. Sta in `renderApp` e non in `switchTab`
// perché appartiene all'header, non alla tab: si aggiorna a ogni ridisegno dell'app,
// realtime compreso, e si spegne da solo quando la coda si svuota.
// Solo per chi ha `is_admin` acceso: chi non è admin non deve vedere nulla.
function aggiornaBadgeAdmin(){
  var b = document.getElementById("admin-badge");
  if(!b) return;
  var n = sonoAdmin() ? segnalazioniInAttesa().length : 0;
  b.textContent = n > 9 ? "9+" : String(n);
  b.style.display = n ? "" : "none";
  var btn = document.getElementById("btn-admin");
  if(btn) btn.title = n
    ? n + (n === 1 ? " topino ha" : " topini hanno") + " segnalato un pagamento"
    : "Area admin";
}
function switchTab(tab){
  currentTab = tab;
  document.querySelectorAll(".tab-page").forEach(function(p){ p.classList.toggle("attiva", p.dataset.tab === tab); });
  document.querySelectorAll(".tab-btn").forEach(function(b){ b.classList.toggle("attiva", b.dataset.tab === tab); });
  if(tab === "ordina") renderOrdina();
  if(tab === "tabella") renderTabella();
  if(tab === "bacheca"){ renderBacheca(); renderStatistiche(); }
  if(tab === "pagamenti") renderPagamenti();
  aggiornaPallinoPagamenti();
  var main = document.querySelector("#app-screen .body");
  if(main){
    main.classList.remove("tab-switching");
    void main.offsetWidth;              // forza il reflow, altrimenti l'animazione non si ri-triggera
    main.classList.add("tab-switching");
  }
}

// ── SWIPE ORIZZONTALE TRA TAB (mobile) ──
// Soglie tarate sul campo: alzando il rapporto 0.65 lo swipe ruba gesti allo scroll
// verticale, abbassandolo diventa difficile da azzeccare.
function initTabSwipe(){
  var el = document.querySelector("#app-screen .body");
  if(!el || el.dataset.swipe === "1") return;
  el.dataset.swipe = "1";
  var sx = 0, sy = 0, st = 0;
  el.addEventListener("touchstart", function(e){
    var tag = e.target.tagName;
    if(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  el.addEventListener("touchend", function(e){
    if(!sx) return;
    var dx = e.changedTouches[0].clientX - sx;
    var dy = Math.abs(e.changedTouches[0].clientY - sy);
    var dt = Date.now() - st;
    if(dt < 350 && Math.abs(dx) > 70 && dy < Math.abs(dx) * 0.65){
      var i = TABS.indexOf(currentTab);
      if(dx < 0 && i < TABS.length - 1){ vibra(15); switchTab(TABS[i + 1]); }
      else if(dx > 0 && i > 0){ vibra(15); switchTab(TABS[i - 1]); }
    }
    sx = 0;
  }, { passive: true });
}
function cambioIdentita(){
  clearMiaIdentita();
  mioId = null;
  mostraSchermata("auth-screen");
  renderAuth();
}

// ── TAB ORDINA ──
// Una riga per persona+tipo: lo stepper modifica kg_nominale direttamente in upsert.
// Niente carrello, niente "Aggiungi": il valore mostrato È l'ordine.
// KG_STEP, KG_MAX e PEZZATURA_KG stanno in utils.js: il passo dello stepper È la
// pezzatura, e tenerli vicini è l'unico modo per non cambiarne uno solo per sbaglio.
var _kgLocale = {};   // tipo_id -> kg mostrato adesso, in attesa di conferma dal server
var _kgTimer  = {};   // tipo_id -> timeout del salvataggio debounced

// I kg che il topino vede: il valore ottimistico se c'è, altrimenti quello salvato.
function kgMio(tipoId){
  if(_kgLocale[tipoId] != null) return _kgLocale[tipoId];
  var r = righeDi(mioId).find(function(x){ return x.tipo_id === tipoId; });
  return r ? parseFloat(r.kg_nominale) : 0;
}
function rigaMia(tipoId){
  return righeDi(mioId).find(function(x){ return x.tipo_id === tipoId; });
}

function renderOrdina(){
  var el = document.getElementById("ordina-tipi");
  var chiusi = ordiniChiusi();
  renderBannerArrivo();
  renderBannerOrdini(chiusi);
  if(!tipi.length){ el.innerHTML = '<div class="empty">L\'admin non ha ancora impostato i tipi di parmigiano.</div>'; }
  else {
    el.innerHTML = tipi.map(function(t){
      var kg = kgMio(t.id);
      var pk = parseFloat(t.prezzo_kg) || 0;
      return '<div class="tipo-row' + (kg > 0 ? " attiva" : "") + (chiusi ? " bloccata" : "") + '" id="tipo-row-' + t.id + '">'
        + '<div class="tr-alto">'
        +   '<span class="tipo-nome">' + escapeHtml(t.nome) + '</span>'
        +   '<span class="tipo-tot" id="tipotot-' + t.id + '">' + (kg > 0 ? eur(kg * pk) : "\u2014") + '</span>'
        + '</div>'
        + '<div class="tr-basso">'
        +   '<span class="tipo-prezzo">' + eur(pk) + ' al kg</span>'
        +   '<div class="stepper">'
        +     '<button class="step-btn meno" ' + (kg > 0 && !chiusi ? "" : "disabled ") + 'onclick="stepKg(\'' + t.id + '\',-1)" aria-label="Mezzo chilo in meno">\u2212</button>'
        +     '<span class="step-val" id="step-' + t.id + '">' + kgFmt(kg) + '</span>'
        +     '<button class="step-btn piu" ' + (chiusi ? "disabled " : "") + 'onclick="stepKg(\'' + t.id + '\',1)" aria-label="Mezzo chilo in più">+</button>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }).join("");
  }
  renderMioTotale();
  renderSpedizione();
}

// Banner d'arrivo: sopra ogni altra cosa nella tab Ordina, e per TUTTI i topini.
// È l'unico punto in cui il gruppo viene avvisato dentro l'app invece che su WhatsApp,
// ed è la metà che conta di più della coppia bottone-admin / banner-utente.
// Sta fuori dalla card "Il tuo ordine" di proposito: è un annuncio al gruppo, non un
// dato del proprio ordine. Verde `--moss`: "buona notizia, c'è da fare qualcosa",
// distinto dal `--berry` degli ordini chiusi e dal `--cheese` delle info normali.
function renderBannerArrivo(){
  var b = document.getElementById("banner-arrivo");
  if(!b) return;
  var quando = arrivoSegnalato();
  if(!quando){ b.style.display = "none"; b.innerHTML = ""; return; }
  b.innerHTML = '<span class="svg-inv svg-formaggio-arrivato"></span>'
    + '<div class="ba-testo"><b>Il formaggio \u00e8 arrivato!</b>'
    + 'Consegnato il ' + escapeHtml(fmtData(quando))
    + '. Mettiti d\'accordo con l\'admin per il ritiro e per il pagamento.</div>';
  b.style.display = "";
}

// Banner in cima alla tab Ordina: scadenza in arrivo, oppure ordini già chiusi.
function renderBannerOrdini(chiusi){
  var b = document.getElementById("ordina-banner");
  var hint = document.getElementById("ordina-hint");
  if(!b) return;
  var scadenza = gruppo && gruppo.chiusura_ordini;

  // La riga sopra gli stepper dice sempre lo stato dei comandi, aperti o chiusi che siano.
  // Prima spariva a ordini chiusi, e la ragione stava solo nel banner in cima: adesso che
  // quel banner può tacere (sotto), chi prova a togliere mezzo chilo troverebbe
  // un'interfaccia morta senza modo di distinguere "chiuso" da "rotto". Questa riga è la
  // condizione che rende sicura la soppressione, non una rifinitura.
  if(hint){
    hint.className = "hint" + (chiusi ? " chiuso" : "");
    hint.innerHTML = chiusi
      ? "\uD83D\uDD12 <b>Ordini chiusi</b>: i tasti \u2212 e + non rispondono pi\u00F9. Per una modifica, parla con l'admin."
      : "Tocca \u2212 e + per scegliere quanti kg. Si salva da solo. \uD83E\uDDC0";
    hint.style.display = "";
  }

  // A pacco arrivato il banner rosso tace: la chiusura ordini è ormai informazione
  // esaurita, e due riquadri colorati in cima competerebbero proprio nel momento in cui
  // il verde deve vincere. Il "perché" non si perde: è nella riga qui sopra.
  if(chiusi && !arrivoSegnalato()){
    b.className = "banner-ordini chiuso";
    b.innerHTML = "\uD83D\uDD12 <b>Ordini chiusi</b> il " + escapeHtml(fmtDataOra(scadenza))
      + ".<br>Per una modifica, parla con l'admin.";
    b.style.display = "";
  } else if(!chiusi && scadenza){
    b.className = "banner-ordini aperto";
    b.innerHTML = "\u23F0 Puoi modificare il tuo ordine fino al <b>" + escapeHtml(fmtDataOra(scadenza)) + "</b>.";
    b.style.display = "";
  } else {
    b.style.display = "none";
  }
}

// Ridisegno mirato della sola riga toccata: rifare l'innerHTML di tutta la lista
// a ogni tap perderebbe il feedback :active del bottone sotto il dito.
function aggiornaRigaTipo(tipoId){
  var t = tipi.find(function(x){ return x.id === tipoId; });
  if(!t) return;
  var kg = kgMio(tipoId), pk = parseFloat(t.prezzo_kg) || 0;
  var val = document.getElementById("step-" + tipoId);
  var tot = document.getElementById("tipotot-" + tipoId);
  var row = document.getElementById("tipo-row-" + tipoId);
  if(val) val.textContent = kgFmt(kg);
  if(tot) tot.textContent = kg > 0 ? eur(kg * pk) : "\u2014";
  if(row){
    row.classList.toggle("attiva", kg > 0);
    var meno = row.querySelector(".step-btn.meno");
    if(meno) meno.disabled = (kg <= 0);
  }
}

function stepKg(tipoId, dir){
  if(ordiniChiusi()){ dot("err", "Ordini chiusi"); return; }
  var kg = Math.round((kgMio(tipoId) + dir * KG_STEP) * 10) / 10;
  if(kg < 0) kg = 0;
  if(kg > KG_MAX) kg = KG_MAX;
  _kgLocale[tipoId] = kg;
  aggiornaRigaTipo(tipoId);
  renderMioTotale();
  // Debounce: chi tocca "+" cinque volte di fila fa una sola scrittura, non cinque.
  clearTimeout(_kgTimer[tipoId]);
  dot("", "Salvataggio\u2026");
  _kgTimer[tipoId] = setTimeout(function(){ salvaKgTipo(tipoId); }, 600);
}

async function salvaKgTipo(tipoId){
  var kg = _kgLocale[tipoId];
  if(kg == null) return;
  try{
    await salvaKgRiga(mioId, tipoId, kg);
    // Solo se nel frattempo non è stato toccato ancora: altrimenti comanda il tap più recente.
    if(_kgLocale[tipoId] === kg) delete _kgLocale[tipoId];
    await caricaTutto();
    if(currentTab === "ordina") renderOrdina();
    dot("ok", "Ordine salvato \uD83E\uDDC0");
  }catch(e){
    if(_kgLocale[tipoId] === kg) delete _kgLocale[tipoId];   // rollback al valore reale
    renderOrdina();
    dot("err", "Errore");
    alert("Non sono riuscito a salvare: " + e.message);
  }
}

// La card dell'ordine mostra SOLO il parmigiano; la spedizione ha un riquadro suo,
// identico per tutti. Qui i quattro numeri che il topino deve poter confrontare:
// atteso e reale, ciascuno con e senza spedizione.
function renderMioTotale(){
  var el = document.getElementById("mio-totale");
  var mia = persone.find(function(p){ return p.id === mioId; });
  if(!el) return;
  if(!mia){ el.innerHTML = ""; return; }

  var atteso = 0, reale = 0, hoReale = false;
  tipi.forEach(function(t){
    var pk = parseFloat(t.prezzo_kg) || 0;
    var stima = kgMio(t.id) * pk;
    atteso += stima;
    var r = rigaMia(t.id);
    // Il prezzo reale vale solo finché i kg non sono stati toccati in locale.
    if(r && r.prezzo_reale != null && _kgLocale[t.id] == null){ hoReale = true; reale += parseFloat(r.prezzo_reale); }
    else reale += stima;
  });
  var sped = quotaSpedizione(mia);
  var cKg = confrontoKg(mioId);

  if(!hoReale){
    // Finché l'admin non ha pesato nulla, la colonna "reale" sarebbe identica all'attesa:
    // mostrarla sarebbe solo rumore.
    el.innerHTML = '<div class="mt-riga"><span>Parmigiano (atteso)</span><span>' + eur(atteso) + '</span></div>'
      + '<div class="mt-riga grande"><span>Con spedizione</span><span>' + eur(atteso + sped) + '</span></div>';
    return;
  }
  el.innerHTML = '<div class="mt-griglia">'
    + '<div class="mt-h"></div><div class="mt-h">solo parmigiano</div><div class="mt-h">con spedizione</div>'
    + '<div class="mt-l">Atteso</div>'
    +   '<div class="mt-v">' + eur(atteso) + '</div>'
    +   '<div class="mt-v">' + eur(atteso + sped) + '</div>'
    + '<div class="mt-l reale">Reale</div>'
    +   '<div class="mt-v reale">' + eur(reale) + '</div>'
    +   '<div class="mt-v reale forte">' + eur(reale + sped) + '</div>'
    + '</div>'
    + (cKg ? '<div class="mt-scarto">' + escapeHtml(testoConfrontoKg(cKg)) + '</div>' : '')
    + '<div class="mt-nota">Il "reale" viene dalle etichette dei pezzi: lo inserisce l\'admin alla consegna.</div>';
}

// Riquadro spedizione: stesso conto per tutti, con la divisione in chiaro.
function renderSpedizione(){
  var el = document.getElementById("spedizione-box");
  if(!el) return;
  var tot = gruppo ? parseFloat(gruppo.spedizione_totale) || 0 : 0;
  if(!tot){
    el.innerHTML = '<div class="sped-nota">Nessuna spesa di spedizione su questo giro. \uD83C\uDF89</div>';
    return;
  }
  var n = numeroPartecipantiSpedizione();
  var mia = persone.find(function(p){ return p.id === mioId; });
  var h = '<div class="sped-conto">'
    +   '<span class="sped-num">' + eur(tot) + '</span>'
    +   '<span class="sped-op">\u00f7</span>'
    +   '<span class="sped-num">' + n + (n === 1 ? " topino" : " topini") + '</span>'
    +   '<span class="sped-op">=</span>'
    +   '<span class="sped-quota">' + eur(n ? tot / n : 0) + ' a testa</span>'
    + '</div>';
  h += '<div class="sped-nota">' + (
        !n ? "Nessuno partecipa ancora alla spedizione."
        : (mia && mia.partecipa_spedizione
            ? "Uguale per tutti quelli che partecipano, te compreso."
            : "Tu non partecipi alla spedizione, quindi non la paghi.")
      ) + '</div>';
  // Finché gli ordini sono aperti la quota a testa è provvisoria per due ragioni insieme:
  // la spedizione dipende dai kg totali, e il numero di chi partecipa può ancora cambiare.
  // A ordini chiusi sparisce: lì il numero è definitivo e ripeterlo sarebbe rumore.
  if(!ordiniChiusi()){
    h += '<div class="sped-nota">\u2139\uFE0F La spedizione dipende dai kg totali del gruppo: '
      + 'finch\u00e9 l\'ordine \u00e8 aperto la quota a testa pu\u00f2 ancora cambiare. '
      + 'Pi\u00f9 formaggio si ordina, meno pesa su ciascuno.</div>';
  }
  el.innerHTML = h;
}

// ── TAB TABELLA ──
// Card impilate, una per topino. La tabella con scroll orizzontale era illeggibile
// sotto i 400px: qui ogni voce sta su una riga sua e non si scorre mai in laterale.
function renderTabella(){
  var el = document.getElementById("tabella-body");
  if(!persone.length){
    el.innerHTML = '<div class="empty">Ancora nessun topino registrato.</div>';
    return;
  }

  var grassi = topiniGrassi();
  var archiviato = gruppo && gruppo.stato === "archiviato";
  var h = persone.map(function(p){
    var mie   = righeDi(p.id);
    var ip    = totaleIpotetico(p.id);
    var reale = totaleOrdine(p.id);          // usa il prezzo reale dove c'è, il nominale altrove
    var conReale = haPrezziReali(p.id);
    var sped  = quotaSpedizione(p);
    var tot   = totaleDovuto(p);
    var io_   = (p.id === mioId);

    var voci = mie.length
      ? mie.map(function(r){
          return '<span class="pc-voce">' + escapeHtml(nomeTipo(r.tipo_id))
            + ' <b>' + kgFmt(parseFloat(r.kg_nominale)) + '</b></span>';
        }).join("")
      : '<span class="pc-voce vuota">nessun ordine</span>';

    var c = '<div class="persona-card' + (io_ ? " mia" : "") + '">';
    // Topino grasso: pulsa mentre il gruppo è aperto, diventa corona quando è archiviato
    var grasso = grassi.indexOf(p.id) > -1
      ? ' <span class="badge-grasso' + (archiviato ? " incoronato" : "") + '" title="Ha ordinato più kg di tutti">'
        + (archiviato ? "\uD83D\uDC51" : '<span class="svg-inv svg-topino topino-ico"></span>\uD83D\uDC51') + '</span>'
      : '';
    // Pillola e non un topo diverso: il topino è già il badge del "topino grasso", e due
    // topi diversi nella stessa colonna diventerebbero un rebus. La vedono TUTTI, che è
    // il punto: sapere a chi chiedere.
    var adminBadge = p.is_admin ? ' <span class="pill-admin">admin</span>' : '';
    c += '<div class="pc-testa">'
       +   '<span class="pc-nome">\uD83D\uDC2D ' + escapeHtml(p.nome) + adminBadge + grasso + (io_ ? ' <span class="pc-tu">sei tu</span>' : '') + '</span>'
       +   (p.pagato ? '<span class="badge ok">pagato</span>' : '<span class="badge no">da pagare</span>')
       + '</div>';
    c += '<div class="pc-voci">' + voci + '</div>';
    // I kg ricevuti sono derivati da prezzo_reale / prezzo_kg: dopo la consegna è il
    // prezzo la verità, e il numero ordinato è diventato storia. Si mostrano affiancati
    // perché lo scarto (taglio a mano ~5-8%) è l'informazione, non un dettaglio.
    var cKg = confrontoKg(p.id);
    if(mie.length){
      c += '<div class="pc-kg">' + kgFmt(kgTotaliDi(p.id)) + ' in tutto</div>';
      if(cKg) c += '<div class="pc-kg pc-ric">' + escapeHtml(testoConfrontoKg(cKg)) + '</div>';
    }
    c += '<div class="pc-conti">';
    c +=   '<div class="pc-riga"><span>Parmigiano' + (conReale ? " (stima)" : "") + '</span><span>' + eur(ip) + '</span></div>';
    if(conReale) c += '<div class="pc-riga reale"><span>Parmigiano (reale)</span><span>' + eur(reale) + '</span></div>';
    c +=   '<div class="pc-riga"><span>Spedizione' + (p.partecipa_spedizione ? "" : " (non partecipa)") + '</span><span>' + eur(sped) + '</span></div>';
    c +=   '<div class="pc-riga grande"><span>Totale</span><span>' + eur(tot) + '</span></div>';
    c += '</div></div>';
    return c;
  }).join("");

  var totGruppo  = persone.reduce(function(a, p){ return a + totaleDovuto(p); }, 0);
  var kgGruppo   = persone.reduce(function(a, p){ return a + kgTotaliDi(p.id); }, 0);
  var nPagati    = persone.filter(function(p){ return p.pagato; }).length;

  h += '<div class="persona-card totale-gruppo">'
     +   '<div class="pc-testa"><span class="pc-nome">\uD83E\uDDC0 Tutto il clan</span>'
     +     '<span class="badge ' + (nPagati === persone.length ? "ok" : "no") + '">' + nPagati + ' su ' + persone.length + ' pagati</span></div>'
     +   '<div class="pc-conti">'
     +     '<div class="pc-riga"><span>Parmigiano ordinato</span><span>' + kgFmt(kgGruppo) + '</span></div>'
     +     '<div class="pc-riga grande"><span>Totale gruppo</span><span>' + eur(totGruppo) + '</span></div>'
     +   '</div></div>';

  el.innerHTML = h;
}

// ── TAB BACHECA ──
// Permessi: autore + admin (decisione §6.2). Il controllo è COSMETICO — nasconde i bottoni,
// non protegge i dati, e resta così anche dopo la chiusura di RLS del 01/09/2026: la
// bacheca è deliberatamente fuori da quel giro. Verificare l'autore vorrebbe dire legare
// ogni topino a un'identità, che è il pezzo caro che si sta evitando; e una nota cancellata
// per dispetto fra amici è una seccatura, non un danno.
var _notaInModifica = null;

function puoiToccareNota(n){ return n.persona_id === mioId || eAdmin; }
function nomeAutore(personaId){
  var p = persone.find(function(x){ return x.id === personaId; });
  return p ? p.nome : "un topino sparito";
}
function notaAuto(t){
  if(!t) return;
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight, 200) + "px";   // textarea che cresce, con tetto
}

function renderBacheca(){
  var el = document.getElementById("bacheca-body");
  if(!el) return;
  var h = '<div class="nota-composer">'
    + '<textarea id="nota-nuova" class="nota-textarea" rows="1" maxlength="500"'
    +   ' placeholder="Scrivi una nota per tutti… (ritiro, orari, avvisi)" oninput="notaAuto(this)"></textarea>'
    + '<button class="btn btn-cheese btn-mini" onclick="aggiungiNota()">Appendi alla bacheca</button>'
    + '</div>';

  if(!note.length){
    h += '<div class="empty">Bacheca vuota. Attacca tu il primo bigliettino! 🐭</div>';
  } else {
    h += note.map(function(n){
      var modificata = n.aggiornata_il && n.creata_il
        && (new Date(n.aggiornata_il) - new Date(n.creata_il) > 1000);
      if(_notaInModifica === n.id){
        return '<div class="nota-item in-modifica">'
          + '<textarea id="nota-mod-' + n.id + '" class="nota-textarea" maxlength="500" oninput="notaAuto(this)">'
          +   escapeHtml(n.testo) + '</textarea>'
          + '<div class="nota-azioni-edit">'
          +   '<button class="btn btn-ghost btn-mini" onclick="_notaInModifica=null;renderBacheca()">Annulla</button>'
          +   '<button class="btn btn-cheese btn-mini" onclick="salvaModificaNota(\'' + n.id + '\')">Salva</button>'
          + '</div></div>';
      }
      return '<div class="nota-item' + (n.persona_id === mioId ? " mia" : "") + '">'
        + '<div class="nota-testo">' + escapeHtml(n.testo) + '</div>'
        + '<div class="nota-piede">'
        +   '<span class="nota-meta">\uD83D\uDC2D ' + escapeHtml(nomeAutore(n.persona_id))
        +     ' \u00b7 ' + escapeHtml(fmtDataOra(n.creata_il)) + (modificata ? " \u00b7 modificata" : "") + '</span>'
        +   (puoiToccareNota(n)
              ? '<span class="nota-azioni">'
                + '<button class="nota-ico" title="Modifica" onclick="iniziaModificaNota(\'' + n.id + '\')">\u270F\uFE0F</button>'
                + '<button class="nota-ico" title="Elimina" onclick="chiediEliminaNota(\'' + n.id + '\')">\uD83D\uDDD1\uFE0F</button>'
                + '</span>'
              : '')
        + '</div></div>';
    }).join("");
  }
  el.innerHTML = h;
}

async function aggiungiNota(){
  var t = document.getElementById("nota-nuova");
  var testo = t ? t.value.trim() : "";
  if(!testo){ if(t) t.focus(); return; }
  try{
    if(t){ t.value = ""; t.style.height = "auto"; }
    dot("", "Salvataggio\u2026");
    await creaNota(testo);
    await caricaTutto();
    renderBacheca();
    dot("ok", "Nota appesa \uD83D\uDCDD");
  }catch(e){ dot("err", "Errore"); alert("Non sono riuscito a salvare la nota: " + e.message); }
}
function iniziaModificaNota(id){
  _notaInModifica = id;
  renderBacheca();
  setTimeout(function(){
    var e = document.getElementById("nota-mod-" + id);
    if(e){ e.focus(); notaAuto(e); }
  }, 40);
}
async function salvaModificaNota(id){
  var e = document.getElementById("nota-mod-" + id);
  var nuovo = e ? e.value.trim() : "";
  if(!nuovo){ chiediEliminaNota(id); return; }   // svuotare una nota = volerla togliere
  try{
    _notaInModifica = null;
    dot("", "Salvataggio\u2026");
    await aggiornaNota(id, nuovo);
    await caricaTutto();
    renderBacheca();
    dot("ok", "Nota aggiornata");
  }catch(e2){ dot("err", "Errore"); alert("Errore: " + e2.message); }
}
// A differenza di sPiccioli qui la conferma c'è: la bacheca del Clan la vedono tutti
// e l'admin può cancellare anche le note altrui.
function chiediEliminaNota(id){
  var n = note.find(function(x){ return x.id === id; });
  if(!n) return;
  var mia = n.persona_id === mioId;
  if(!confirm(mia ? "Togliere la tua nota dalla bacheca?"
                  : "Togliere la nota di " + nomeAutore(n.persona_id) + "?")) return;
  eseguiEliminaNota(id);
}
async function eseguiEliminaNota(id){
  try{
    _notaInModifica = null;
    await eliminaNota(id);
    await caricaTutto();
    renderBacheca();
    dot("ok", "Nota tolta");
  }catch(e){ dot("err", "Errore"); alert("Errore: " + e.message); }
}

// ── STATISTICHE PUBBLICHE ──
function renderStatistiche(){
  var el = document.getElementById("stat-body");
  if(!el) return;
  var dati = kgPerTipo();
  var tot = dati.reduce(function(a, d){ return a + d.kg; }, 0);
  if(!tot){
    el.innerHTML = '<div class="empty">Ancora nessun kg ordinato: appena il clan si muove, qui compare il grafico.</div>';
    return;
  }
  // Il canvas è opaco agli screen reader: accanto ci va sempre la stessa informazione in testo.
  el.innerHTML = '<div class="grafico-wrap"><canvas id="grafico-kg" role="img"'
    + ' aria-label="Kg ordinati per stagionatura: ' + escapeHtml(dati.map(function(d){
        return d.nome + " " + kgFmt(d.kg); }).join(", ")) + '"></canvas></div>'
    + '<div class="stat-lista">' + dati.map(function(d){
        var perc = tot ? Math.round(d.kg / tot * 100) : 0;
        return '<div class="stat-riga"><span>' + escapeHtml(d.nome) + '</span>'
          + '<span>' + kgFmt(d.kg) + ' <span class="stat-perc">' + perc + '%</span></span></div>';
      }).join("")
    + '<div class="stat-riga totale"><span>Totale</span><span>' + kgFmt(tot) + '</span></div></div>';
  // Il canvas deve già stare nel DOM ed essere misurabile, altrimenti disegna a zero
  setTimeout(function(){ disegnaBarreKg(); }, 30);
}

function _roundRect(ctx, x, y, w, h, r){
  r = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);         ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function disegnaBarreKg(){
  var canvas = document.getElementById("grafico-kg");
  if(!canvas || !canvas.parentElement) return;
  var dati = kgPerTipo();
  var ctx = canvas.getContext("2d");
  var dpr = window.devicePixelRatio || 1;          // senza, su mobile il grafico è sfocato
  var W = canvas.parentElement.offsetWidth || 300, H = 200;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // I colori si leggono dal CSS, così il grafico segue il tema senza duplicare la palette in JS
  var css = getComputedStyle(document.body);
  var accento = (css.getPropertyValue("--cheese") || "#F2B33D").trim();
  var tenue = (css.getPropertyValue("--dim") || "#999").trim();
  var max = Math.max.apply(null, dati.map(function(d){ return d.kg; }).concat([1]));  // evita /0
  var padB = 38, padT = 14, padX = 6, gap = 10, n = dati.length || 1;
  var bw = Math.max(10, (W - padX * 2 - gap * (n - 1)) / n);
  ctx.textAlign = "center";
  dati.forEach(function(d, i){
    var x = padX + i * (bw + gap);
    var bh = (H - padB - padT) * (d.kg / max);
    var y = H - padB - bh;
    if(bh > 0){ ctx.fillStyle = accento; _roundRect(ctx, x, y, bw, bh, 6); ctx.fill(); }
    ctx.fillStyle = tenue;
    ctx.font = "700 11px 'Nunito',sans-serif";
    ctx.fillText(d.nome.replace(/\s*mesi/i, "m"), x + bw / 2, H - padB + 15);
    if(d.kg > 0){
      ctx.fillStyle = accento;
      ctx.font = "800 11px 'Nunito',sans-serif";
      ctx.fillText(kgFmt(d.kg), x + bw / 2, Math.max(y - 5, 11));
    }
  });
}
// Le statistiche si vedono anche da desktop, dove ridimensionare è normale: senza questo
// il grafico resterebbe della larghezza che aveva al primo disegno.
var _grResizeT = null;
window.addEventListener("resize", function(){
  clearTimeout(_grResizeT);
  _grResizeT = setTimeout(function(){
    if(currentTab === "bacheca") disegnaBarreKg();
  }, 150);
});

// ── TAB PAGAMENTI ──
function renderPagamenti(){
  var el = document.getElementById("pagamenti-body");
  var mia = persone.find(function(p){ return p.id === mioId; });
  var html = "";

  // Quanto devo: reale dove l'admin l'ha inserito, ipotetico altrove, spedizione inclusa.
  var dovuto = mia ? totaleDovuto(mia) : 0;
  if(mia){
    // Prima il caso opposto non diceva nulla, e il passaggio a definitivo è proprio ciò
    // che vale la pena vedere: stesso verde della colonna "reale" altrove nell'app.
    var stima = !haPrezziReali(mia.id);
    html += '<div class="pay-tot' + (stima ? "" : " reale") + '">'
      +   '<div class="pt-label">Il tuo totale' + (stima ? " (stimato)" : " \u00b7 reale") + '</div>'
      +   '<div class="pt-val">' + eur(dovuto) + '</div>'
      +   '<div class="pt-sub">parmigiano + spedizione</div>'
      + '</div>';
  }

  // ── Coordinate ──
  if(impostazioni.iban){
    html += '<div class="pay-link" onclick="copiaTesto(\'' + escapeHtml(impostazioni.iban) + '\')">'
      + '<span class="pl-ico">\uD83C\uDFE6</span><div class="pl-info"><div class="pl-nome">IBAN (tocca per copiare)</div>'
      + '<div class="pl-val">' + escapeHtml(impostazioni.iban) + '</div></div></div>';
  }
  if(impostazioni.paypal_link){
    var link = linkPayPalConImporto(impostazioni.paypal_link, dovuto);
    html += '<a class="pay-link" href="' + escapeHtml(link) + '" target="_blank" rel="noopener">'
      + '<span class="pl-ico">\uD83D\uDCB3</span><div class="pl-info">'
      +   '<div class="pl-nome">PayPal \u2014 ' + eur(dovuto) + ' già inseriti</div>'
      +   '<div class="pl-val">Controlla l\'importo prima di confermare: PayPal lascia modificarlo.</div>'
      + '</div></a>';
  }
  if(impostazioni.satispay_link){
    // Account personale: nessun link con importo (decisione §6.3). Si copia e si paga a mano.
    var sp = String(impostazioni.satispay_link).trim();
    var esterno = /^https?:\/\//i.test(sp);
    html += esterno
      ? '<a class="pay-link" href="' + escapeHtml(sp) + '" target="_blank" rel="noopener">'
        + '<span class="pl-ico">\uD83D\uDCF2</span><div class="pl-info"><div class="pl-nome">Satispay</div>'
        + '<div class="pl-val">Inserisci tu ' + eur(dovuto) + ' nell\'app.</div></div></a>'
      : '<div class="pay-link" onclick="copiaTesto(\'' + escapeHtml(sp) + '\')">'
        + '<span class="pl-ico">\uD83D\uDCF2</span><div class="pl-info">'
        +   '<div class="pl-nome">Satispay: ' + escapeHtml(sp) + ' (tocca per copiare)</div>'
        +   '<div class="pl-val">Inserisci tu ' + eur(dovuto) + ' nell\'app.</div></div></div>';
  }
  if(!impostazioni.iban && !impostazioni.paypal_link && !impostazioni.satispay_link){
    html += '<div class="empty">Coordinate di pagamento non ancora inserite.</div>';
  }
  html += '<div class="pay-contanti">\uD83D\uDCB6 Oppure in contanti, di persona.</div>';

  // ── Segnalazione "ho pagato" ──
  if(mia) html += renderSegnalazioneHtml(mia);
  el.innerHTML = html;
}

// Il topino segnala, l'admin conferma: `pagato` resta autorità dell'admin.
function renderSegnalazioneHtml(mia){
  if(mia.pagato){
    return '<div class="pay-stato confermato">\u2705 <b>Pagamento confermato</b>'
      + (mia.metodo_segnalato ? ' \u00b7 ' + escapeHtml(nomeMetodo(mia.metodo_segnalato)) : '')
      + '<div class="ps-sub">L\'admin ha verificato. Sei a posto!</div></div>';
  }
  if(mia.pagamento_segnalato){
    return '<div class="pay-stato attesa">\u23F3 <b>In attesa di conferma</b>'
      + (mia.metodo_segnalato ? ' \u00b7 ' + escapeHtml(nomeMetodo(mia.metodo_segnalato)) : '')
      + '<div class="ps-sub">Hai segnalato il pagamento. L\'admin lo conferma appena lo vede.</div>'
      + '<button class="btn btn-ghost btn-mini" style="margin-top:10px;" onclick="annullaMiaSegnalazione()">Annulla la segnalazione</button>'
      + '</div>';
  }
  return '<button class="btn btn-cheese" style="margin-top:14px;" onclick="apriSegnalaPagamento()">\u2705 Ho pagato</button>';
}

// Pallino sull'icona 💳 finché il totale è stimato. Un pallino e non una parola: a 320px
// la tab bar non ha spazio per un'etichetta in più.
function aggiornaPallinoPagamenti(){
  var d = document.getElementById("tab-dot-pagamenti");
  if(!d) return;
  var stima = mioId && righeDi(mioId).length && !haPrezziReali(mioId);
  d.style.display = stima ? "" : "none";
}

// Chi paga su un totale ancora stimato paga una cifra che cambierà: i pezzi non sono
// stati tagliati, quindi non si sa quanto pesano. NON si blocca — chi paga in contanti
// alla consegna deve poter procedere — ma glielo si dice prima, non dopo.
function apriSegnalaPagamento(){
  document.getElementById("sp-errore").textContent = "";
  if(!haPrezziReali(mioId)) mostraAvvisoStima();
  else mostraMetodiPagamento();
  openModal("modal-segnala");
}
function mostraAvvisoStima(){
  document.getElementById("sp-titolo").textContent = "\uD83E\uDDC0 Aspetta un attimo";
  document.getElementById("sp-sub").textContent = "";
  document.getElementById("sp-metodi").innerHTML = "";
  document.getElementById("sp-avviso").innerHTML =
    '<div class="avviso-stima">Il tuo totale \u00e8 ancora <b>stimato</b>: i pezzi non sono stati '
    + 'tagliati, quindi non si sa quanto pesano davvero. L\'importo cambier\u00e0, di solito di '
    + 'qualche euro in su o in gi\u00f9. Meglio aspettare che l\'admin inserisca gli importi '
    + 'delle etichette.</div>'
    + '<div class="m-btns" style="margin-bottom:4px;">'
    +   '<button class="btn btn-ghost" onclick="mostraMetodiPagamento()">Pago lo stesso</button>'
    +   '<button class="btn btn-cheese" onclick="chiudiSegnalaPagamento()">Aspetto</button>'
    + '</div>';
  // "Aspetto" è già l'uscita: lasciare anche l'"Annulla" del modale darebbe due bottoni
  // che fanno la stessa cosa accanto all'unico che ne fa un'altra.
  document.getElementById("sp-btns").style.display = "none";
}
function mostraMetodiPagamento(){
  document.getElementById("sp-titolo").textContent = "\u2705 Come hai pagato?";
  document.getElementById("sp-sub").textContent =
    "Segnali solo che hai pagato: l'admin conferma dopo aver verificato.";
  document.getElementById("sp-avviso").innerHTML = "";
  document.getElementById("sp-btns").style.display = "";
  document.getElementById("sp-metodi").innerHTML = METODI.map(function(m){
    return '<button class="metodo-btn" onclick="confermaSegnalazione(\'' + m.id + '\')">'
      + '<span class="mb-ico">' + m.ico + '</span><span>' + escapeHtml(m.nome) + '</span></button>';
  }).join("");
}
function chiudiSegnalaPagamento(){ closeModal("modal-segnala"); }

async function confermaSegnalazione(metodo){
  try{
    await segnalaPagamento(mioId, metodo);
    chiudiSegnalaPagamento();
    await caricaTutto();
    renderApp();
    dot("ok", "Segnalato \u2705");
  }catch(e){ document.getElementById("sp-errore").textContent = "Errore: " + e.message; }
}
async function annullaMiaSegnalazione(){
  try{ await annullaSegnalazione(mioId); await caricaTutto(); renderApp(); dot("ok", "Segnalazione annullata"); }
  catch(e){ alert("Errore: " + e.message); }
}

// Copia con ripiego: `navigator.clipboard` non esiste fuori da HTTPS e su qualche WebView
// vecchia, e senza il .catch un rifiuto sarebbe una promise persa senza dire niente a nessuno.
// ── INVITO ALL'INSTALLAZIONE (PWA) ──
// Il requisito tecnico è soddisfatto dalle icone: manifest completo, display standalone,
// service worker con handler fetch, HTTPS. Manca il piano umano, e per questo gruppo conta
// di più: l'app si distribuisce con un link su WhatsApp, e nessuno cercherà da sé
// "Aggiungi a schermata Home". Senza un invito esplicito i topini apriranno il link in
// una scheda del browser ogni volta.
// `_promptInstall` lo cattura lo script in <head>: l'evento può scattare prima che
// questo file sia stato eseguito.
var INSTALLA_KEY = "clan_parm_installa_chiuso";

// Safari non implementa `beforeinstallprompt`: su iOS l'unica via è il menu Condividi,
// quindi lì serve un testo illustrato, non un bottone che non potrebbe fare nulla.
function isIOS(){ return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }

// `navigator.standalone` è la proprietà NON standard di Safari, ed è il ramo che serve:
// senza, un utente iOS che ha già installato l'app continuerebbe a vedersi proporre
// di installarla.
function appGiaInstallata(){
  try{
    return window.matchMedia("(display-mode: standalone)").matches
        || window.navigator.standalone === true;
  }catch(e){ return false; }
}
function invitoRifiutato(){ try{ return localStorage.getItem(INSTALLA_KEY) === "1"; }catch(e){ return false; } }

function initInvitoInstalla(){
  if(_promptInstall || isIOS()) mostraInvitoInstalla();
}

// Due posti, un solo stato: in cima alla schermata d'accesso, dove non compete con nessun
// banner operativo ed è dove serve davvero (chi è al primo ingresso non ha ancora superato
// l'attrito), e in coda alla tab Ordina per chi il nome l'ha già scelto. `INSTALLA_KEY` è
// unico, quindi la × chiude entrambi per sempre.
var INVITI_INSTALLA = [
  { box: "installa-box",      testo: "installa-testo",      btn: "installa-btn" },
  { box: "installa-box-auth", testo: "installa-testo-auth", btn: "installa-btn-auth" }
];
function mostraInvitoInstalla(){
  if(appGiaInstallata() || invitoRifiutato()) return;
  var html, conBottone;
  if(_promptInstall){
    html = '<b>Tienila a portata di zampa.</b><br>Installala sul telefono: si apre come '
      + 'un\'app vera, senza ricercare il link su WhatsApp ogni volta.';
    conBottone = true;
  } else if(isIOS()){
    html = '<b>Tienila a portata di zampa.</b><br>Tocca <b>Condividi</b> \u2B06\uFE0F qui sotto, '
      + 'poi <b>Aggiungi a Home</b>: si apre come un\'app vera, senza ricercare il link '
      + 'su WhatsApp ogni volta.';
    conBottone = false;
  } else return;
  INVITI_INSTALLA.forEach(function(inv){
    var box = document.getElementById(inv.box);
    if(!box) return;
    var t = document.getElementById(inv.testo);
    var b = document.getElementById(inv.btn);
    if(t) t.innerHTML = html;
    if(b) b.style.display = conBottone ? "" : "none";
    box.style.display = "";
  });
}
function nascondiInvitoInstalla(){
  INVITI_INSTALLA.forEach(function(inv){
    var box = document.getElementById(inv.box);
    if(box) box.style.display = "none";
  });
}
// La × va ricordata: un banner che ricompare a ogni apertura, dalla seconda volta in poi
// viene chiuso senza leggerlo, e a quel punto tanto vale non averlo.
function chiudiInvitoInstalla(){
  try{ localStorage.setItem(INSTALLA_KEY, "1"); }catch(e){}
  nascondiInvitoInstalla();
}

// Niente `prompt()` all'apertura: senza un gesto dell'utente il browser lo blocca, e
// interrompere qualcuno mentre ordina è il modo migliore per farsi ignorare.
async function installaApp(){
  if(!_promptInstall) return;
  var e = _promptInstall;
  _promptInstall = null;      // l'oggetto NON è riutilizzabile: un secondo prompt() fallisce
  try{
    e.prompt();
    await e.userChoice;
  }catch(err){ /* prompt già consumato o annullato: non c'è nulla da dire all'utente */ }
  // In tutti e due i casi l'invito sparisce per questa sessione, senza ricordare un "no":
  // se ha rifiutato, Chrome rimanderà l'evento a una prossima visita.
  nascondiInvitoInstalla();
}

function copiaTesto(t){
  function fatto(){
    dot("ok", "Copiato \uD83D\uDCCB");
    setTimeout(function(){ dot("ok", "Sincronizzato \uD83E\uDDC0"); }, 1500);
  }
  function allaVecchia(){
    try{
      var ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if(ok){ fatto(); return; }
    }catch(e){}
    dot("err", "Non copiato");
    alert("Non sono riuscito a copiare: seleziona il testo e copialo a mano.");
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(fatto).catch(allaVecchia);
  } else allaVecchia();
}
