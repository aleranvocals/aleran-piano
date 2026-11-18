/* salud.js — página «Cuida tu voz»: activar/silenciar los avisos de pausa y de volumen (salud-vocal.js) y ajustar
 * el umbral de volumen mirando tu propio nivel en vivo. */
(function () {
  "use strict";
  var midiendo = null;

  function el(id) { return document.getElementById(id); }

  function S() { return window.SaludVocal; }

  function chips(cont, opciones, actual, alElegir) {
    cont.textContent = "";
    opciones.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (o[0] === actual ? " activo" : "");
      b.textContent = o[1];
      b.setAttribute("aria-pressed", String(o[0] === actual));
      b.addEventListener("click", function () { alElegir(o[0]); });
      cont.appendChild(b);
    });
  }

  function pintar() {
    var s = S();
    if (!s) return;
    var a = s.ajustes();
    chips(el("salPausaSi"), [[true, "Avisarme"], [false, "Silenciado"]], a.pausa, function (v) { a.pausa = v; s.guardar(a); });
    chips(el("salVolSi"), [[true, "Avisarme"], [false, "Silenciado"]], a.volumen, function (v) { a.volumen = v; s.guardar(a); });
    chips(el("salNivel"), [["baja", "Poca"], ["media", "Normal"], ["alta", "Mucha"]], a.nivel, function (v) { a.nivel = v; s.guardar(a); });
    el("salNivelFila").hidden = !a.volumen;
    // Marca del umbral sobre el medidor (de -60 a 0 dBFS).
    el("salMarca").style.left = (((s.umbral() + 60) / 60) * 100).toFixed(1) + "%";
    var m = s.minutosSeguidos();
    el("salMinutos").textContent = m ? "Llevas " + m + " min seguidos." : "";
  }

  function medir() {
    var s = S(), M = window.MicrofonoEngine;
    if (midiendo) { clearInterval(midiendo); midiendo = null; if (M) M.detener(); el("salProbar").textContent = "🎤 Probar mi volumen"; el("salBarra").style.width = "0%"; el("salLectura").textContent = ""; return; }
    if (!M || !M.disponible()) { el("salEstado").textContent = "Este navegador no deja usar el micrófono aquí."; return; }
    el("salEstado").textContent = "Abriendo el micrófono…";
    M.iniciar().then(function () {
      el("salEstado").textContent = "";
      el("salProbar").textContent = "⏹ Parar";
      var suave = null;
      midiendo = setInterval(function () {
        var db = s.nivelDb();
        if (db === null) return;
        suave = suave === null ? db : suave + (db - suave) * 0.3;
        var x = Math.max(0, Math.min(1, (suave + 60) / 60));
        el("salBarra").style.width = (x * 100).toFixed(1) + "%";
        el("salLectura").textContent = suave > s.umbral() ? "Esto ya es «muy fuerte»" : "";
      }, 80);
    }).catch(function (e) {
      el("salEstado").textContent = "No pude usar el micrófono: " + (e && e.message ? e.message : "permiso denegado");
    });
  }

  // salud-vocal.js lo carga app-shell.js y puede llegar un poco después que esta página: los botones se enganchan
  // ya (un toque temprano no se pierde) y lo que necesita SaludVocal espera a que esté.
  function cuandoEste(fn) { if (S()) fn(); else setTimeout(function () { cuandoEste(fn); }, 100); }

  function arrancar() {
    el("salProbarPausa").addEventListener("click", function () { cuandoEste(function () { S().probarPausa(); }); });
    el("salProbarVol").addEventListener("click", function () { cuandoEste(function () { S().probarVolumen(); }); });
    el("salProbar").addEventListener("click", function () { cuandoEste(medir); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && midiendo) medir(); });
    if (location.hash === "#volumen") { var v = el("volumen"); if (v) v.scrollIntoView(); }
    cuandoEste(function () {
      pintar();
      window.addEventListener("salud-vocal-cambio", pintar);
      setInterval(pintar, 15000);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
