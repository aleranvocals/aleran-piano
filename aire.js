/* aire.js — Aire en la voz: un vaso que se llena según cuánto soplo suena sobre la nota, frente a TU voz limpia.
 * Usa la periodicidad de la señal (cuánto de ella es la nota y cuánto ruido). Ayuda para el oído, no un diagnóstico.
 * Si el vaso pasa del 80 % durante mucho rato, sugiere volver a la voz limpia. */
(function () {
  "use strict";
  var V = window.BetaVoz;
  var NOMBRES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  var an = null, tic = null, cal = null;
  var nivel = 0;            // 0..1
  var segundosAltos = 0;    // tiempo seguido por encima del 80 %
  var ultimo = 0;

  function el(id) { return document.getElementById(id); }
  function nota(midi) { var m = Math.round(midi); return NOMBRES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }

  function paso() {
    var ahora = performance.now();
    var dt = Math.min(0.2, (ahora - (ultimo || ahora)) / 1000);
    ultimo = ahora;
    var l = V.leer(an);
    var objetivo;
    if (l.voz) {
      objetivo = Math.max(0, Math.min(1, (cal.hnr - l.hnr) / 18));
      el("aiNota").textContent = nota(l.midi);
    } else if (l.nivelDb > -45) {
      objetivo = 1; // hay sonido pero sin nota clara (susurro o soplo)
      el("aiNota").textContent = "—";
    } else {
      objetivo = 0;
      el("aiNota").textContent = "—";
    }
    nivel += (objetivo - nivel) * 0.2;
    el("aiVaso").style.height = (nivel * 100).toFixed(0) + "%";
    if (nivel > 0.8) segundosAltos += dt; else segundosAltos = Math.max(0, segundosAltos - dt * 2);
    var aviso = el("aiAviso");
    if (segundosAltos > 5) aviso.textContent = "Mucho soplo seguido. Vuelve a la voz limpia.";
    else if (nivel > 0.15 && nivel <= 0.6) aviso.textContent = "Para cercanía, un poquito basta.";
    else aviso.textContent = "";
  }

  function calibrar() {
    var est = el("aiEstado");
    est.textContent = "Abriendo el micrófono…";
    if (tic) { clearInterval(tic); tic = null; }
    V.abrir().then(function (a) {
      an = a;
      est.textContent = "Canta una vocal limpia…";
      return V.calibrar(an, 3, function (f) { est.textContent = "Canta una vocal limpia… " + Math.round(f * 100) + " %"; });
    }).then(function (c) {
      if (!c) {
        est.textContent = "No te oí bien. Acércate un poco al micrófono y prueba de nuevo.";
        return;
      }
      cal = c;
      est.textContent = "Listo. Ahora añade un poco de aire a la misma nota.";
      el("aiPaso1").hidden = true;
      el("aiPaso2").hidden = false;
      nivel = 0; segundosAltos = 0; ultimo = 0;
      tic = setInterval(paso, 40);
    }).catch(function (e) {
      est.textContent = ("No pude usar el micrófono: " + (e && e.message ? e.message : "permiso denegado")).replace(/\.?$/, ".");
    });
  }

  function arrancar() {
    el("aiCalibrar").addEventListener("click", calibrar);
    el("aiRecalibrar").addEventListener("click", function () {
      if (tic) { clearInterval(tic); tic = null; }
      el("aiPaso1").hidden = false;
      el("aiPaso2").hidden = true;
      el("aiEstado").textContent = "";
    });
    window.addEventListener("pagehide", function () { if (tic) clearInterval(tic); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
