/* transportador.js — Transportador: mueve todas las notas del Cifrado medio tono arriba o abajo y compara con tu rango.
 * Lee la canción autoguardada del Cifrado (o un archivo .json suyo). No escribe nada en el Cifrado: guarda una copia aparte. */
(function () {
  "use strict";
  var CLAVE_CIFRADO = "aleran-piano-cifrado-autoguardado"; // la misma que usa cifrado.js
  var MIDI_MIN = 21, MIDI_MAX = 108;
  var original = null; // datos del Cifrado tal cual
  var desp = 0;
  var sonando = false;

  function el(id) { return document.getElementById(id); }

  function cargarAutoguardado() {
    try {
      var d = JSON.parse(localStorage.getItem(CLAVE_CIFRADO) || "null");
      return d && Array.isArray(d.cancion) ? d : null;
    } catch (e) { return null; }
  }

  function lineas(datos) { return datos.cancion.filter(function (b) { return b && b.tipo === "linea" && Array.isArray(b.silabas); }); }

  // Todas las notas válidas (en orden) de una canción.
  function midis(datos) {
    var res = [];
    lineas(datos).forEach(function (l) {
      l.silabas.forEach(function (s) {
        interpretarNotas(s.nota).notas.forEach(function (n) { if (n.valido) res.push(n.midi); });
      });
    });
    return res;
  }

  // Texto de una casilla de nota movida `d` semitonos ("Sib4 - Lab4" -> "La#4 - Sol#4"). Si algo no es válido, se deja igual.
  function mover(texto, d) {
    if (d === 0) return texto;
    var r = interpretarNotas(texto);
    if (r.vacio || !r.todoValido) return texto;
    return r.notas.map(function (n) { return midiANombre(n.midi + d); }).join(" - ");
  }

  function transportada(datos, d) {
    var copia = JSON.parse(JSON.stringify(datos));
    lineas(copia).forEach(function (l) { l.silabas.forEach(function (s) { s.nota = mover(s.nota, d); }); });
    return copia;
  }

  function fueraDeLimites(d) {
    var m = midis(original);
    if (!m.length) return false;
    return Math.min.apply(null, m) + d < MIDI_MIN || Math.max.apply(null, m) + d > MIDI_MAX;
  }

  function pintar() {
    var m = midis(original).map(function (x) { return x + desp; });
    el("trValor").textContent = desp === 0 ? "Original" : (desp > 0 ? "+" : "−") + Math.abs(desp) + (Math.abs(desp) === 1 ? " semitono" : " semitonos");
    if (!m.length) {
      el("trRango").textContent = "No hay notas escritas en la canción.";
      el("trCabe").textContent = "";
    } else {
      var lo = Math.min.apply(null, m), hi = Math.max.apply(null, m);
      el("trRango").textContent = midiANombre(lo) + " – " + midiANombre(hi);
      var r = window.RangoVocal ? window.RangoVocal.obtener() : null;
      var cab = el("trCabe");
      if (!r || !r.elegido) cab.textContent = "Elige tu rango (🎙, arriba) para ver si te cabe.";
      else if (lo >= r.midiMin && hi <= r.midiMax) cab.textContent = "Cabe en tu rango (" + r.min + "–" + r.max + ").";
      else {
        var partes = [];
        if (hi > r.midiMax) partes.push((hi - r.midiMax) + " por arriba");
        if (lo < r.midiMin) partes.push((r.midiMin - lo) + " por abajo");
        cab.textContent = "Se sale de tu rango (" + r.min + "–" + r.max + "): " + partes.join(" y ") + " (semitonos).";
      }
    }
    var cont = el("trNotas");
    cont.textContent = "";
    lineas(original).forEach(function (l) {
      var p = document.createElement("div");
      p.textContent = l.silabas.map(function (s) {
        var n = mover(s.nota, desp);
        return n ? s.texto + "(" + n + ")" : s.texto;
      }).join(" ");
      cont.appendChild(p);
    });
  }

  function aplicar(datos) {
    original = datos;
    desp = 0;
    el("trVacio").hidden = true;
    el("trPanel").hidden = false;
    pintar();
  }

  function cambiar(d) {
    if (fueraDeLimites(desp + d)) { el("trEstado").textContent = "Más allá de eso las notas salen del piano."; return; }
    el("trEstado").textContent = "";
    desp += d;
    pintar();
  }

  function oir() {
    if (!window.PianoEngine) return;
    if (sonando) { window.PianoEngine.detenerReproduccion(); sonando = false; el("trOir").textContent = "▶ Escuchar con piano"; return; }
    var notas = midis(original).map(function (x) { return x + desp; }).slice(0, 40);
    if (!notas.length) return;
    sonando = true;
    el("trOir").textContent = "⏹ Parar";
    window.PianoEngine.reproducirSecuencia(notas.map(function (n) { return { midi: n, duracion: 0.45 }; }), 0.85, {
      onTerminar: function () { sonando = false; el("trOir").textContent = "▶ Escuchar con piano"; },
    });
  }

  function guardar() {
    var copia = transportada(original, desp);
    var blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cifrado-transportado-" + (desp >= 0 ? "mas" : "menos") + Math.abs(desp) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    el("trEstado").textContent = "Guardada aparte. Ábrela desde el Cifrado con «Abrir».";
  }

  function arrancar() {
    var d = cargarAutoguardado();
    // Un autoguardado con forma rara no debe dejar la página sin botones.
    try {
      if (d && lineas(d).length) aplicar(d); else el("trVacio").hidden = false;
    } catch (e) {
      original = null;
      el("trPanel").hidden = true;
      el("trVacio").hidden = false;
    }
    el("trMenos").addEventListener("click", function () { cambiar(-1); });
    el("trMas").addEventListener("click", function () { cambiar(1); });
    el("trReset").addEventListener("click", function () { desp = 0; el("trEstado").textContent = ""; pintar(); });
    el("trOir").addEventListener("click", oir);
    el("trGuardar").addEventListener("click", guardar);
    el("trArchivo").addEventListener("change", function () {
      var f = el("trArchivo").files && el("trArchivo").files[0];
      if (!f) return;
      f.text().then(function (t) {
        var j = JSON.parse(t);
        if (!Array.isArray(j.cancion)) throw new Error("formato");
        aplicar(j);
      }).catch(function () { el("trError").textContent = "Ese archivo no parece del Cifrado."; });
    });
    window.addEventListener("rango-vocal-cambio", function () { if (original) pintar(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
