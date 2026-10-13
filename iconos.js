/* iconos.js — iconos de línea propios (carmesí/hueso, sin emojis de colores).
 * Sustituye en la página el emoji que EMPIEZA un texto (botón, pestaña, tarjeta, título) por su icono SVG.
 * El mismo set vive en Maestro (src/components/Icono.tsx); si se cambia uno, se cambia en los dos. */
(function () {
  "use strict";
  var ICONOS = {
  "nota": "<path d=\"M9 18V6l10-2v12\"/><circle cx=\"6.5\" cy=\"18\" r=\"2.5\"/><circle cx=\"16.5\" cy=\"16\" r=\"2.5\"/>",
  "azar": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3\"/><circle cx=\"9\" cy=\"9\" r=\".9\" fill=\"currentColor\"/><circle cx=\"15\" cy=\"9\" r=\".9\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\".9\" fill=\"currentColor\"/><circle cx=\"9\" cy=\"15\" r=\".9\" fill=\"currentColor\"/><circle cx=\"15\" cy=\"15\" r=\".9\" fill=\"currentColor\"/>",
  "escalas": "<path d=\"M3 20h5v-4h5v-4h5V8h3\"/><path d=\"M3 20V4\"/>",
  "mi-melodia": "<path d=\"M4 20l1-4L16 5l3 3L8 19z\"/><path d=\"M14 7l3 3\"/>",
  "solfeo": "<path d=\"M4 6h16M4 12h10M4 18h13\"/>",
  "giros": "<path d=\"M20 12a8 8 0 1 1-2.3-5.7\"/><path d=\"M20 4v5h-5\"/>",
  "metronomo": "<path d=\"M8 21l2-17h4l2 17z\"/><path d=\"M12 16l4-8\"/><path d=\"M6 21h12\"/>",
  "rango": "<path d=\"M3 12h18\"/><path d=\"M3 7v10M21 7v10\"/><path d=\"M8 10v4M12 9v6M16 10v4\"/>",
  "sirena": "<path d=\"M2 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0\"/>",
  "sostener": "<path d=\"M7 4h10M7 20h10\"/><path d=\"M8 4v3l4 5-4 5v3M16 4v3l-4 5 4 5v3\"/>",
  "crescendo": "<path d=\"M5 18v-3M10 18v-6M15 18v-9M20 18V6\"/>",
  "aire": "<path d=\"M3 9h11a3 3 0 1 0-3-3\"/><path d=\"M3 15h15a3 3 0 1 1-3 3\"/><path d=\"M3 12h8\"/>",
  "twang": "<path d=\"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z\"/><path d=\"M10 21a2 2 0 0 0 4 0\"/>",
  "espectro": "<path d=\"M4 20V10M9 20V4M14 20V8M19 20v-7\"/>",
  "grabar": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"3\" fill=\"currentColor\"/>",
  "intervalos": "<path d=\"M12 4v16\"/><path d=\"M8 8l4-4 4 4M8 16l4 4 4-4\"/>",
  "acordes": "<path d=\"M3 7h18M3 12h18M3 17h18\"/><circle cx=\"8\" cy=\"7\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"8\" cy=\"12\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"8\" cy=\"17\" r=\"1.6\" fill=\"currentColor\"/>",
  "adivina": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"12\" cy=\"12\" r=\".8\" fill=\"currentColor\"/>",
  "simon": "<path d=\"M17 3l4 4-4 4\"/><path d=\"M3 11V9a2 2 0 0 1 2-2h16\"/><path d=\"M7 21l-4-4 4-4\"/><path d=\"M21 13v2a2 2 0 0 1-2 2H3\"/>",
  "pasillo": "<rect x=\"6\" y=\"3\" width=\"12\" height=\"18\" rx=\"1\"/><circle cx=\"15\" cy=\"12\" r=\"1\" fill=\"currentColor\"/>",
  "plataformas": "<path d=\"M6 8h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.5 1.7L16 14H8l-.5.7A3 3 0 0 1 2 13v-1a4 4 0 0 1 4-4z\"/><path d=\"M7 10.5v3M5.5 12h3\"/><circle cx=\"16\" cy=\"11\" r=\".8\" fill=\"currentColor\"/><circle cx=\"18\" cy=\"13\" r=\".8\" fill=\"currentColor\"/>",
  "eco-ritmo": "<ellipse cx=\"12\" cy=\"10\" rx=\"8\" ry=\"3\"/><path d=\"M4 10v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6\"/><path d=\"M7 3l4 5M17 3l-4 5\"/>",
  "ritmo": "<path d=\"M3 12h4l3-7 4 14 3-7h4\"/>",
  "rutina": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 4h6v3H9z\"/><path d=\"M9 14l2 2 4-4\"/>",
  "cifrado": "<path d=\"M7 3h8l4 4v14H7z\"/><path d=\"M15 3v4h4\"/><path d=\"M10 13h6M10 17h4\"/>",
  "catalogo": "<rect x=\"4\" y=\"4\" width=\"6.5\" height=\"6.5\" rx=\"1\"/><rect x=\"13.5\" y=\"4\" width=\"6.5\" height=\"6.5\" rx=\"1\"/><rect x=\"4\" y=\"13.5\" width=\"6.5\" height=\"6.5\" rx=\"1\"/><rect x=\"13.5\" y=\"13.5\" width=\"6.5\" height=\"6.5\" rx=\"1\"/>",
  "mapa-vocal": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"1\"/><path d=\"M8 6v12M12 6v12M16 6v12\"/>",
  "progreso": "<path d=\"M3 17l6-6 4 4 8-8\"/><path d=\"M15 7h6v6\"/>",
  "inicio": "<path d=\"M4 11l8-7 8 7v9H4z\"/><path d=\"M10 20v-6h4v6\"/>",
  "clases": "<rect x=\"6\" y=\"3\" width=\"13\" height=\"18\" rx=\"1.5\"/><path d=\"M3 8h4M3 12h4M3 16h4\"/><path d=\"M10 8h6\"/>",
  "voz": "<rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M5 11a7 7 0 0 0 14 0\"/><path d=\"M12 18v3\"/>",
  "practicar": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"1\"/><path d=\"M8 6v12M12 6v12M16 6v12\"/>",
  "cuenta": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c0-4 4-6 8-6s8 2 8 6\"/>",
  "oido": "<path d=\"M6 10a6 6 0 0 1 12 0c0 3-3 3.5-3 6.5a3 3 0 0 1-6 0\"/><path d=\"M9.5 10a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4\"/>",
  "glosario": "<path d=\"M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z\"/><path d=\"M4 5v16\"/><path d=\"M9 7h6\"/>",
  "guia": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M15.5 8.5l-2 5-5 2 2-5z\"/>",
  "soporte": "<path d=\"M4 5h16v11H9l-5 4z\"/>",
  "sol": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/>",
  "luna": "<path d=\"M20 14a8 8 0 1 1-10-10 6.5 6.5 0 0 0 10 10z\"/>"
};
  var MAPA = {
  "🎵": "nota",
  "🎲": "azar",
  "🪜": "escalas",
  "✍": "mi-melodia",
  "🔤": "solfeo",
  "🌀": "giros",
  "⏱": "metronomo",
  "📏": "rango",
  "🌊": "sirena",
  "⏳": "sostener",
  "🎈": "crescendo",
  "💨": "aire",
  "🔔": "twang",
  "📊": "espectro",
  "🔴": "grabar",
  "↕": "intervalos",
  "🎼": "acordes",
  "🎯": "adivina",
  "🔁": "simon",
  "🕹": "plataformas",
  "🥁": "eco-ritmo",
  "👏": "ritmo",
  "📋": "rutina",
  "🗺": "mapa-vocal",
  "📈": "progreso",
  "🏠": "inicio",
  "📓": "clases",
  "🎤": "voz",
  "🎹": "practicar",
  "⚙": "cuenta"
};
  var claves = Object.keys(MAPA).map(function (k) { return k; });
  var re = new RegExp("^(\s*)(" + claves.join("|") + ")️?", "u");
  var SALTAR = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, TITLE: 1, SVG: 1, NOSCRIPT: 1, CANVAS: 1 };

  var estilo = document.createElement("style");
  estilo.textContent = ".ico-l{display:inline-flex;vertical-align:-0.2em;margin-right:.4em;line-height:0}" +
    ".ico-l svg{width:1.15em;height:1.15em}";
  document.head.appendChild(estilo);

  function svg(id) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONOS[id] + "</svg>";
  }

  function procesar(raiz) {
    if (!raiz || raiz.nodeType === 8) return;
    var padre = raiz.nodeType === 3 ? raiz.parentNode : raiz;
    if (padre && padre.closest && padre.closest("[data-sin-ico]")) return;
    var walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || SALTAR[(p.nodeName || "").toUpperCase()]) return NodeFilter.FILTER_REJECT;
        return re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var lista = [];
    while (walker.nextNode()) lista.push(walker.currentNode);
    lista.forEach(function (n) {
      var m = re.exec(n.nodeValue);
      if (!m) return;
      var id = MAPA[m[2]];
      if (!id || !ICONOS[id]) return;
      var span = document.createElement("span");
      span.className = "ico-l";
      span.innerHTML = svg(id);
      var resto = n.nodeValue.slice(m[0].length).replace(/^\s+/, "");
      n.nodeValue = resto;
      n.parentNode.insertBefore(span, n);
      if (m[1]) n.parentNode.insertBefore(document.createTextNode(m[1]), span);
    });
  }

  function iniciar() {
    procesar(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (mu) {
        mu.addedNodes.forEach(function (n) { if (n.nodeType === 1 || n.nodeType === 3) procesar(n); });
        if (mu.type === "characterData") procesar(mu.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  window.iconoLinea = svg;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
