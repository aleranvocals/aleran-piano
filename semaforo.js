/* semaforo.js — Semáforo vocal: tres preguntas de sí o no y un color. Sin micrófono, solo lógica.
 * Regla fija: un «sí» en dolor, pérdida de voz o dificultad para respirar da ROJO siempre. */
(function () {
  "use strict";
  var CLAVE = "aleran-beta-semaforo";
  var PREGUNTAS = [
    { id: "dolor", texto: "¿Te duele al hablar o al tragar?", rojo: true },
    { id: "perdida", texto: "¿Has perdido la voz de golpe, o te cuesta respirar?", rojo: true },
    { id: "molestia", texto: "¿Notas molestia, un esfuerzo raro o ronquera?", rojo: false },
  ];
  var TEXTOS = {
    verde: "Puedes practicar. Si algo molesta, paras.",
    ambar: "Hoy, nada de voz: escucha, lee o prepara. Si se repite o dura más de dos semanas, consulta.",
    rojo: "Para y consulta a un profesional. Si te cuesta respirar, urgencias.",
  };
  var respuestas = {};

  function el(id) { return document.getElementById(id); }

  function color() {
    var rojo = PREGUNTAS.some(function (p) { return p.rojo && respuestas[p.id] === true; });
    if (rojo) return "rojo";
    if (respuestas.molestia === true) return "ambar";
    return "verde";
  }

  function completo() {
    return PREGUNTAS.every(function (p) { return typeof respuestas[p.id] === "boolean"; });
  }

  function guardarHoy(c) {
    try {
      var d = new Date();
      var fecha = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      localStorage.setItem(CLAVE, JSON.stringify({ fecha: fecha, color: c }));
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  function leerHoy() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || "null");
      var d = new Date();
      var fecha = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      return v && v.fecha === fecha ? v.color : null;
    } catch (e) { return null; }
  }

  // Un «sí» en dolor o pérdida de voz ya es ROJO: no hace falta contestar el resto para verlo.
  function rojoYa() {
    return PREGUNTAS.some(function (p) { return p.rojo && respuestas[p.id] === true; });
  }

  var NOMBRE_COLOR = { verde: "verde", ambar: "ámbar", rojo: "rojo" };

  function pintar() {
    var listo = completo() || rojoYa();
    var c = listo ? color() : null;
    ["verde", "ambar", "rojo"].forEach(function (k) {
      el("luz" + k.charAt(0).toUpperCase() + k.slice(1)).classList.toggle("on", c === k);
    });
    var res = el("semaforoResultado");
    res.hidden = !listo;
    el("semaforoAcciones").hidden = !listo;
    el("semaforoIr").hidden = c !== "verde";
    if (listo) {
      res.textContent = TEXTOS[c];
      guardarHoy(c);
      pintarHoy();
    }
  }

  function pintarHoy() {
    var h = leerHoy();
    var p = el("semaforoHoy");
    p.hidden = !h;
    if (h) p.textContent = "Hoy te salió: " + (NOMBRE_COLOR[h] || h);
  }

  function construir() {
    var cont = el("semaforoPreguntas");
    PREGUNTAS.forEach(function (p) {
      var fila = document.createElement("div");
      fila.className = "semaforo-pregunta";
      var t = document.createElement("span");
      t.textContent = p.texto;
      fila.appendChild(t);
      var grupo = document.createElement("div");
      grupo.className = "beta-fila";
      [["Sí", true], ["No", false]].forEach(function (par) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = par[0];
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () {
          respuestas[p.id] = par[1];
          Array.prototype.forEach.call(grupo.children, function (x) { x.classList.remove("activo"); x.setAttribute("aria-pressed", "false"); });
          b.classList.add("activo");
          b.setAttribute("aria-pressed", "true");
          pintar();
        });
        grupo.appendChild(b);
      });
      fila.appendChild(grupo);
      cont.appendChild(fila);
    });
    el("semaforoOtra").addEventListener("click", function () {
      respuestas = {};
      Array.prototype.forEach.call(document.querySelectorAll(".semaforo-pregunta .chip"), function (b) { b.classList.remove("activo"); });
      pintar();
    });
    pintarHoy();
  }

  window.BetaSemaforo = { color: function (r) { respuestas = r; return color(); } }; // para las pruebas
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", construir);
  else construir();
})();
