/* tremolo.js — Medidor de trémolo: la nota arriba, el volumen abajo, y un veredicto.
 * Trémolo = pulsa el volumen con la nota quieta. Vibrato = se mueve la nota. Ayuda para el oído, no un diagnóstico.
 * Los umbrales viven en BetaVoz.puro.UMBRAL y se afinarán con los ejemplos de Áleran. */
(function () {
  "use strict";
  var V = window.BetaVoz;
  var FPS = 33;
  var VENTANA = Math.round(FPS * 2.4);
  var an = null;
  var tic = null;
  var pitch = []; // midi (o null si no hay nota clara)
  var vol = [];   // dB

  function el(id) { return document.getElementById(id); }

  function centsRelativos(serie) {
    var validos = serie.filter(function (x) { return x !== null; });
    if (!validos.length) return [];
    var m = V.puro.mediana(validos);
    return serie.map(function (x) { return x === null ? null : (x - m) * 100; });
  }

  function dibujar() {
    var c = el("trmLienzo"), g = c.getContext("2d"), w = c.width, h = c.height;
    var estilo = getComputedStyle(document.documentElement);
    var rojo = (estilo.getPropertyValue("--crimson-bright") || "#c02241").trim();
    var hueso = (estilo.getPropertyValue("--bone-dim") || "#a8968f").trim();
    var linea = (estilo.getPropertyValue("--line") || "#322423").trim();
    g.clearRect(0, 0, w, h);
    g.strokeStyle = linea; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    var cents = centsRelativos(pitch);
    function trazo(serie, y0, alto, escala, color) {
      g.strokeStyle = color; g.lineWidth = 2.5; g.beginPath();
      var abierto = false;
      serie.forEach(function (v, i) {
        if (v === null) { abierto = false; return; }
        var x = (i / (VENTANA - 1)) * w;
        var y = y0 + alto / 2 - Math.max(-1, Math.min(1, v / escala)) * (alto / 2 - 6);
        if (!abierto) { g.moveTo(x, y); abierto = true; } else g.lineTo(x, y);
      });
      g.stroke();
    }
    trazo(cents, 0, h / 2, 80, rojo);
    var mv = V.puro.mediana(vol);
    trazo(vol.map(function (v) { return v === null ? null : v - mv; }), h / 2, h / 2, 8, hueso);
  }

  function evaluar() {
    var sonando = pitch.filter(function (x) { return x !== null; }).length;
    if (pitch.length < VENTANA || sonando < VENTANA * 0.7) {
      el("trmVeredicto").textContent = "—";
      el("trmVelocidad").textContent = pitch.length < VENTANA ? "" : "Sostén una nota con la voz.";
      return;
    }
    var cents = centsRelativos(pitch).map(function (x) { return x === null ? 0 : x; });
    var r = V.puro.clasificarOscilacion(cents, vol.map(function (x) { return x === null ? 0 : x; }), FPS);
    var txt = { vibrato: "ESO ES VIBRATO", tremolo: "TRÉMOLO", mixto: "SE MUEVEN LA NOTA Y EL VOLUMEN", ninguno: "—" }[r.tipo];
    el("trmVeredicto").textContent = txt;
    el("trmVelocidad").textContent = r.tipo === "ninguno" ? "Deja que la nota oscile un poco." : r.hz.toFixed(1).replace(".", ",") + " pulsos por segundo";
  }

  function paso() {
    var l = V.leer(an);
    pitch.push(l.voz ? l.midi : null);
    vol.push(l.voz ? l.nivelDb : null);
    if (pitch.length > VENTANA) { pitch.shift(); vol.shift(); }
    dibujar();
    evaluar();
  }

  function iniciar() {
    var est = el("trmEstado");
    est.textContent = "Abriendo el micrófono…";
    V.abrir().then(function (a) {
      an = a;
      est.textContent = "Escuchando. Canta una nota larga.";
      pitch = []; vol = [];
      el("trmIniciar").hidden = true;
      el("trmParar").hidden = false;
      tic = setInterval(paso, Math.round(1000 / FPS));
    }).catch(function (e) {
      est.textContent = ("No pude usar el micrófono: " + (e && e.message ? e.message : "permiso denegado")).replace(/\.?$/, ".");
    });
  }

  function parar() {
    if (tic) clearInterval(tic);
    tic = null;
    el("trmIniciar").hidden = false;
    el("trmParar").hidden = true;
    el("trmEstado").textContent = "";
  }

  function arrancar() {
    el("trmIniciar").addEventListener("click", iniciar);
    el("trmParar").addEventListener("click", parar);
    window.addEventListener("pagehide", parar);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
