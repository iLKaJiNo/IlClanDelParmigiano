#!/usr/bin/env python3
"""Server di sviluppo per Il Clan del Parmigiano.

Esiste per una ragione sola, ed è §7 della continuità: con un normale
`python3 -m http.server` la cache HTTP del browser continua a servire i .js
vecchi, e si finisce per collaudare codice che non è quello appena scritto.
Qui ogni risposta esce con Cache-Control: no-store.

Ma `no-store` NON BASTA, e questa è la parte che è già costata tre sessioni:
il service worker ha una cache sua, cache-first, che gli header HTTP non
toccano. Un SW rimasto da una sessione precedente serve tranquillamente i file
di ieri mentre il disco ha quelli di oggi, e l'errore che ne esce non ha alcun
rapporto col codice che si sta leggendo.

Per questo la contromisura non è più solo scritta qui: è una PAGINA.

    python3 serve-locale.py                     ->  http://localhost:8777
    poi, DOPO OGNI MODIFICA:                        http://localhost:8777/pulisci

Sì, dopo ogni modifica, non una volta a inizio sessione: il service worker SI
RI-REGISTRA AL RELOAD. Ricaricata la pagina è di nuovo lì, e riprende a servire
dalla sua cache. Non c'è nessun segnale che lo dica — si modifica un file, si
ricarica, e si sta guardando la versione di prima. Misurato il 01/09/2026: un
`32px` appena scritto continuava a leggersi `0px`.

`/pulisci` deregistra i service worker, svuota le cache e poi passa all'app.
Non tocca `localStorage`: identità, tema e sblocchi di gruppo restano, perché
buttarli via a ogni collaudo renderebbe la pagina un fastidio da evitare — e
una contromisura che si evita non è una contromisura.
"""
import http.server, socketserver, os

PORTA = 8777
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PAGINA_PULISCI = b"""<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pulizia collaudo</title>
<style>
 body{background:#241708;color:#f7ecd8;font:16px/1.6 system-ui,sans-serif;
      display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;}
 .box{max-width:26rem;} h1{font-size:1.2rem;margin:0 0 .6rem;color:#F2B33D;}
 ul{margin:.6rem 0;padding-left:1.1rem;} li{opacity:.85;}
 a{color:#F2B33D;} code{color:#F2B33D;}
</style></head><body><div class="box">
<h1>Pulizia dell'ambiente di collaudo</h1>
<ul id="esito"><li>lavoro in corso...</li></ul>
<p id="poi"></p>
</div>
<script>
(async function(){
  var righe = [];
  try{
    var regs = await navigator.serviceWorker.getRegistrations();
    for(var i=0;i<regs.length;i++) await regs[i].unregister();
    righe.push("service worker deregistrati: " + regs.length);
  }catch(e){ righe.push("service worker: " + e.message); }
  try{
    var ks = await caches.keys();
    for(var j=0;j<ks.length;j++) await caches.delete(ks[j]);
    righe.push("cache svuotate: " + (ks.length ? ks.join(", ") : "nessuna"));
  }catch(e){ righe.push("cache: " + e.message); }
  righe.push("localStorage lasciato intatto (identita, tema, sblocchi)");
  document.getElementById("esito").innerHTML =
    righe.map(function(r){ return "<li>" + r + "</li>"; }).join("");
  document.getElementById("poi").innerHTML =
    'Vado all\\'app fra un istante &mdash; <a href="./index.html">o entra subito</a>.';
  setTimeout(function(){ location.href = "./index.html"; }, 1200);
})();
</script></body></html>"""

class SenzaCache(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0].rstrip("/") == "/pulisci":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(PAGINA_PULISCI)))
            self.end_headers()
            self.wfile.write(PAGINA_PULISCI)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORTA), SenzaCache) as httpd:
    print("")
    print("  Il Clan del Parmigiano  ->  http://localhost:%d" % PORTA)
    print("")
    print("  PRIMA di collaudare:    ->  http://localhost:%d/pulisci" % PORTA)
    print("  (deregistra i service worker e svuota le cache: no-store da solo NON basta,")
    print("   il SW ha una cache sua, cache-first, che gli header HTTP non toccano)")
    print("")
    print("  Ctrl-C per fermare.")
    print("")
    httpd.serve_forever()
