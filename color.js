/* color.js — Medidor de color (?vista=color) y Medidor de proyección (?vista=presencia).
 * Color: inclinación del espectro sobre los armónicos de la nota (no cambia al subir de nota) frente a TU voz central.
 * Presencia: energía de 2–4 kHz respecto al total, frente al volumen, ambos frente a TU voz calibrada.
 * Ayuda para el oído; no es un diagnóstico. */
(function () {
  "use strict";
  var V = window.BetaVoz;
  var vista = new URLSearchParams(location.search).get("vista") === "presencia" ? "presencia" : "color";
  var cal = null;
  var an = null;
  var tic = null;
  var suave = { incl: null, vol: null, pres: null };
  var ALFA = 0.13; // ~300 ms de suavizado a 25 lecturas por segundo

  function el(id) { return document.getElementById(id); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ema(prev, x) { return prev === null ? x : prev + (x - prev) * ALFA; }

  function aplicarVista() {
    var presencia = vista === "presencia";
    var h1 = document.querySelector(".cabecera h1");
    var sub = document.querySelector(".cabecera .subtitulo");
    if (presencia) {
      h1.textContent = "📐 Medidor de proyección";
      sub.textContent = "Que suba la presencia, no el volumen.";
      document.title = "Medidor de proyección — Áleran Vocals";
    }
    el("colVistaColor").hidden = presencia;
    el("colVistaPresencia").hidden = !presencia;
    var cont = el("colVistas");
    cont.textContent = "";
    [["color", "Color"], ["presencia", "Presencia"]].forEach(function (p) {
      var a = document.createElement("a");
      a.className = "chip" + (vista === p[0] ? " activo" : "");
      a.textContent = p[1];
      a.href = "color.html" + (p[0] === "presencia" ? "?vista=presencia" : "");
      cont.appendChild(a);
    });
  }

  function pintarCentro() {
    el("colMarcaVol").style.left = "50%";
    el("colMarcaPres").style.left = "50%";
  }

  function paso() {
    var l = V.leer(an);
    var bola = el("colBola");
    var aviso = el("colAviso");
    if (!l.voz) {
      bola.classList.add("quieta");
      return;
    }
    bola.classList.remove("quieta");
    suave.vol = ema(suave.vol, l.nivelDb);
    suave.pres = ema(suave.pres, l.presDb);
    var dN = suave.vol - cal.nivelDb;
    var dP = suave.pres - cal.presDb;
    if (vista === "color") {
      if (l.inclinacion !== null) {
        suave.incl = ema(suave.incl, l.inclinacion);
        var x = clamp((suave.incl - cal.inclinacion) / 6, -1, 1);
        bola.style.left = (50 + 50 * x * 0.94).toFixed(1) + "%";
      }
      aviso.textContent = dN > 10 ? "Eso es volumen, no color." : "";
    } else {
      el("colBarraVol").style.width = (clamp(0.5 + dN / 24, 0, 1) * 100).toFixed(1) + "%";
      el("colBarraPres").style.width = (clamp(0.5 + dP / 12, 0, 1) * 100).toFixed(1) + "%";
      if (dN > 6 && dP < 2) aviso.textContent = "Eso es volumen, no presencia.";
      else if (dP >= 3 && Math.abs(dN) <= 3) aviso.textContent = "Más presencia con el mismo volumen.";
      else aviso.textContent = "";
    }
  }

  function empezarMedir() {
    el("colPaso1").hidden = true;
    el("colPaso2").hidden = false;
    suave = { incl: null, vol: null, pres: null };
    pintarCentro();
    el("colBola").classList.add("quieta");
    el("colBola").style.left = "50%";
    el("colBarraVol").style.width = "50%";
    el("colBarraPres").style.width = "50%";
    el("colAviso").textContent = "";
    if (tic) clearInterval(tic);
    tic = setInterval(paso, 40);
  }

  function calibrar() {
    var est = el("colEstado");
    est.textContent = "Abriendo el micrófono…";
    if (tic) { clearInterval(tic); tic = null; }
    V.abrir().then(function (a) {
      an = a;
      est.textContent = "Habla o canta tu voz central…";
      return V.calibrar(an, 3, function (f) { est.textContent = "Habla o canta tu voz central… " + Math.round(f * 100) + " %"; });
    }).then(function (c) {
      if (!c || c.inclinacion === null) {
        est.textContent = "No te oí bien. Acércate un poco al micrófono y prueba de nuevo.";
        el("colPaso1").hidden = false;
        el("colPaso2").hidden = true;
        return;
      }
      cal = c;
      est.textContent = "Listo. La marca blanca es tu voz central.";
      empezarMedir();
    }).catch(function (e) {
      est.textContent = "No pude usar el micrófono: " + (e && e.message ? e.message : "permiso denegado") + ".";
    });
  }

  function arrancar() {
    aplicarVista();
    el("colCalibrar").addEventListener("click", calibrar);
    el("colRecalibrar").addEventListener("click", function () {
      if (tic) { clearInterval(tic); tic = null; }
      el("colPaso1").hidden = false;
      el("colPaso2").hidden = true;
      el("colEstado").textContent = "";
    });
    window.addEventListener("pagehide", function () { if (tic) clearInterval(tic); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
