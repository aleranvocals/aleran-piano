/* beta-comun.js — lo que comparten todas las páginas de herramientas beta:
 * etiqueta BETA junto al título y, si se llegó desde una clase del curso (?clase=C030), una línea que lo dice. */
(function () {
  "use strict";
  function claseDeLaUrl() {
    var c = new URLSearchParams(location.search).get("clase");
    if (!c) return null;
    var n = String(c).trim().toUpperCase().replace(/^C/, "");
    if (!/^\d{1,3}$/.test(n)) return null;
    return "C" + ("00" + n).slice(-3);
  }
  function iniciar() {
    var h1 = document.querySelector(".cabecera h1");
    if (h1 && !h1.querySelector(".beta-etiqueta")) {
      var e = document.createElement("span");
      e.className = "beta-etiqueta";
      e.textContent = "beta";
      h1.appendChild(e);
    }
    var codigo = claseDeLaUrl();
    var datos = codigo && window.BETA_CLASES && window.BETA_CLASES[codigo];
    var cab = document.querySelector(".cabecera");
    if (datos && cab) {
      var p = document.createElement("p");
      p.className = "beta-clase";
      p.textContent = "Clase " + parseInt(codigo.slice(1), 10) + " · " + datos.titulo;
      cab.appendChild(p);
    }
  }
  window.BetaComun = { claseDeLaUrl: claseDeLaUrl };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
