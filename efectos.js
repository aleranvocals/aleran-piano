/* efectos.js — Adivina el efecto: suena un clip de Áleran y se elige entre los efectos. Sin micrófono.
 * Los clips se declaran en efectos/manifest.json. Sin clips de al menos dos efectos, la herramienta muestra «pronto». */
(function () {
  "use strict";
  var EFECTOS = [
    { id: "distorsion", nombre: "Distorsión", sirve: "Da agresividad y potencia, típica del rock y el metal." },
    { id: "raspada", nombre: "Voz raspada", sirve: "Un borde áspero puntual para dar intención a una palabra." },
    { id: "crack", nombre: "Crack / flip / yodel", sirve: "Un quiebre a propósito, como adorno o emoción." },
    { id: "aireada", nombre: "Voz aireada", sirve: "Cercanía e intimidad, en dosis pequeña." },
    { id: "fry", nombre: "Fry", sirve: "Un toque grave y crepitante al inicio o al final de la frase." },
  ];
  var clips = [];   // {efecto, url}
  var activos = []; // efectos con clips
  var actual = null;
  var anterior = null;
  var respondido = false;
  var racha = 0;
  var audio = new Audio();

  function el(id) { return document.getElementById(id); }
  function aleatorio(a) { return a[Math.floor(Math.random() * a.length)]; }
  function efecto(id) { return EFECTOS.filter(function (e) { return e.id === id; })[0]; }

  function elegirClip() {
    var candidatos = clips.filter(function (c) { return c.url !== anterior; });
    if (!candidatos.length) candidatos = clips;
    actual = aleatorio(candidatos);
    anterior = actual.url;
    respondido = false;
    el("efResultado").textContent = "";
    el("efResultado").className = "aviso-vivo";
    el("efSiguiente").hidden = true;
    Array.prototype.forEach.call(el("efBotones").children, function (b) { b.disabled = false; });
  }

  function oir() {
    if (!actual) elegirClip();
    audio.src = actual.url;
    audio.currentTime = 0;
    audio.play().catch(function () { el("efResultado").textContent = "No pude reproducir el audio."; });
  }

  function responder(id) {
    if (respondido || !actual) return;
    respondido = true;
    var correcto = id === actual.efecto;
    var e = efecto(actual.efecto);
    if (correcto) {
      racha++;
      el("efResultado").className = "aviso-vivo efecto-ok";
      el("efResultado").textContent = "Sí: " + e.nombre + ". " + e.sirve;
    } else {
      racha = 0;
      el("efResultado").className = "aviso-vivo efecto-no";
      el("efResultado").textContent = "Era " + e.nombre + ". " + e.sirve;
      oir();
    }
    el("efRacha").textContent = racha;
    el("efSiguiente").hidden = false;
    Array.prototype.forEach.call(el("efBotones").children, function (b) { b.disabled = true; });
  }

  function iniciar(manifiesto) {
    EFECTOS.forEach(function (e) {
      (manifiesto[e.id] || []).forEach(function (f) { clips.push({ efecto: e.id, url: "efectos/" + f }); });
    });
    activos = EFECTOS.filter(function (e) { return clips.some(function (c) { return c.efecto === e.id; }); });
    if (activos.length < 2) {
      var lista = el("efLista");
      if (lista) {
        EFECTOS.forEach(function (e) {
          var fila = document.createElement("p");
          var n = document.createElement("strong");
          n.textContent = e.nombre;
          fila.append(n, document.createTextNode(": " + e.sirve.charAt(0).toLowerCase() + e.sirve.slice(1)));
          lista.appendChild(fila);
        });
      }
      el("efFalta").hidden = false;
      return;
    }
    el("efJuego").hidden = false;
    var cont = el("efBotones");
    activos.forEach(function (e) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "boton";
      b.textContent = e.nombre;
      b.addEventListener("click", function () { responder(e.id); });
      cont.appendChild(b);
    });
    el("efOir").addEventListener("click", oir);
    el("efSiguiente").addEventListener("click", function () { elegirClip(); oir(); });
    elegirClip();
  }

  function arrancar() {
    fetch("efectos/manifest.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(iniciar);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
