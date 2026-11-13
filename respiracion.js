/* respiracion.js — Respiración guiada: un círculo que crece al entrar el aire y se encoge al salir.
 * Solo animación y temporizador. Nunca retiene el aire (no hay fase de pausa). */
(function () {
  "use strict";
  var RITMOS = [[4, 4], [4, 6], [4, 8]];
  var CICLOS = [3, 5, 8];
  var MIN = 0.45, MAX = 1;
  var ritmo = RITMOS[1];
  var ciclos = 5;
  var corriendo = false;
  var tic = null;

  function el(id) { return document.getElementById(id); }

  function chips(contId, valores, etiqueta, actual, alElegir) {
    var cont = el(contId);
    cont.textContent = "";
    valores.forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (etiqueta(v) === etiqueta(actual()) ? " activo" : "");
      b.textContent = etiqueta(v);
      b.addEventListener("click", function () {
        if (corriendo) return;
        alElegir(v);
        Array.prototype.forEach.call(cont.children, function (x) { x.classList.remove("activo"); });
        b.classList.add("activo");
        pintarCiclos(0);
      });
      cont.appendChild(b);
    });
  }

  function pintarCiclos(n) { el("respCiclos").textContent = n + " / " + ciclos; }

  function escala(s) { el("respCirculo").style.transform = "scale(" + s.toFixed(3) + ")"; }

  function parar(mensaje) {
    corriendo = false;
    if (tic) clearInterval(tic);
    tic = null;
    el("respIniciar").hidden = false;
    el("respParar").hidden = true;
    el("respFase").textContent = mensaje || "Listo";
    escala(MIN);
    bloquearOpciones(false);
  }

  function bloquearOpciones(si) {
    document.querySelectorAll("#respRitmos .chip, #respCiclosOpc .chip").forEach(function (b) { b.disabled = si; });
  }

  function iniciar() {
    if (corriendo) return;
    corriendo = true;
    el("respIniciar").hidden = true;
    el("respParar").hidden = false;
    bloquearOpciones(true);
    var t0 = performance.now();
    var dur = (ritmo[0] + ritmo[1]) * 1000;
    pintarCiclos(0);
    function paso() {
      if (!corriendo) return;
      var t = performance.now() - t0;
      var ciclo = Math.floor(t / dur);
      if (ciclo >= ciclos) { pintarCiclos(ciclos); parar("Bien. Respira normal."); return; }
      var dentro = (t % dur) / 1000;
      var entra = dentro < ritmo[0];
      var s = entra ? MIN + (MAX - MIN) * (dentro / ritmo[0]) : MAX - (MAX - MIN) * ((dentro - ritmo[0]) / ritmo[1]);
      escala(s);
      var fase = entra ? "Entra" : "Sale";
      if (el("respFase").textContent !== fase) el("respFase").textContent = fase;
      pintarCiclos(ciclo);
    }
    tic = setInterval(paso, 40);
  }

  function arrancar() {
    chips("respRitmos", RITMOS, function (r) { return r[0] + " – " + r[1]; }, function () { return ritmo; }, function (v) { ritmo = v; });
    chips("respCiclosOpc", CICLOS, function (c) { return String(c); }, function () { return ciclos; }, function (v) { ciclos = v; });
    pintarCiclos(0);
    escala(MIN);
    el("respIniciar").addEventListener("click", iniciar);
    el("respParar").addEventListener("click", function () { parar("Listo"); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && corriendo) parar("Listo"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
