/* retos.js — Retos semanales: un reto por semana (cambia el lunes), cada uno ligado a una herramienta que ya existe.
 * Se marca como hecho en este dispositivo (localStorage «aleran-retos»); no se envía a ningún sitio.
 * Pinta la página de retos (#retosPagina) y la tarjeta pequeña de Progreso (#retoProgreso). */
(function () {
  "use strict";
  var CLAVE = "aleran-retos"; // { hechos: { "S46": "calentar3", ... } }
  var EPOCA = new Date(2026, 0, 5); // un lunes: la semana 0
  var RETOS = [
    { id: "calentar3", icono: "🔥", texto: "Calienta 5 minutos tres días esta semana.", href: "calentar.html", ir: "Calentar" },
    { id: "repite3", icono: "🦜", texto: "Tres frases seguidas en verde en «Repite después de mí».", href: "repite.html", ir: "Repetir" },
    { id: "sirena5", icono: "🚨", texto: "Cinco sirenas seguidas de grave a agudo sin gallito. Si sale gallito, reseteas.", href: "entrenamiento.html?tab=sovt", ir: "Sirena" },
    { id: "diario4", icono: "📔", texto: "Graba tu diario de voz cuatro días.", href: "diario.html", ir: "Diario" },
    { id: "sostenida", icono: "⏱", texto: "Sostén una nota 10 segundos sin que se mueva.", href: "entrenamiento.html?tab=sostenida", ir: "Nota sostenida" },
    { id: "simon", icono: "🧠", texto: "Llega al nivel 5 de Simon dice.", href: "oido.html?tab=simon", ir: "Simon dice" },
    { id: "karaoke", icono: "🎤", texto: "Canta tu canción en Karaoke con la nota guía, y luego sin ella.", href: "karaoke.html", ir: "Karaoke" },
    { id: "messa", icono: "🎚", texto: "Messa di voce: de 0 a 100 y de vuelta, cinco veces seguidas.", href: "entrenamiento.html?tab=messa", ir: "Messa di voce" },
    { id: "twang", icono: "🔔", texto: "Encuentra el twang cinco veces seguidas, al primer intento.", href: "entrenamiento.html?tab=espectro", ir: "Medidor de twang" },
    { id: "respira", icono: "🫁", texto: "Respiración guiada: 5 ciclos, tres días esta semana.", href: "respiracion.html", ir: "Respirar" },
    { id: "cifrado", icono: "🎵", texto: "Saca las notas de una frase de tu canción en «Letra con notas».", href: "cifrado.html", ir: "Letra con notas" },
    { id: "quevoz", icono: "🗣", texto: "Haz «¿Qué voz tengo?» otra vez y compara con la última.", href: "que-voz.html", ir: "¿Qué voz tengo?" },
  ];

  function semana(fecha) {
    var d = fecha ? new Date(fecha) : new Date();
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor(Math.round((d - EPOCA) / 86400000) / 7);
  }
  function retoDe(s) { return RETOS[((s % RETOS.length) + RETOS.length) % RETOS.length]; }
  function clave(s) { return "S" + s; }

  function leer() {
    try { var d = JSON.parse(localStorage.getItem(CLAVE) || "null"); return d && d.hechos && typeof d.hechos === "object" ? d : { hechos: {} }; } catch (e) { return { hechos: {} }; }
  }
  function hecho(s) { return leer().hechos[clave(s)] === retoDe(s).id; }
  function marcar(s, si) {
    var d = leer();
    if (si) d.hechos[clave(s)] = retoDe(s).id; else delete d.hechos[clave(s)];
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (e) { /* vale para esta visita */ }
    window.dispatchEvent(new CustomEvent("retos-cambio"));
  }
  function cumplidos() { var h = leer().hechos; return Object.keys(h).length; }

  function crear(tag, clase, texto) { var e = document.createElement(tag); if (clase) e.className = clase; if (texto !== undefined) e.textContent = texto; return e; }

  function diasParaLunes() {
    var d = new Date().getDay(); // 0 = domingo
    return d === 0 ? 1 : 8 - d;
  }

  function tarjeta(cont, compacta) {
    var s = semana(), r = retoDe(s), ok = hecho(s);
    cont.textContent = "";
    var c = crear("div", "reto-tarjeta" + (ok ? " hecho" : ""));
    var cab = crear("p", "reto-texto");
    cab.appendChild(crear("span", "reto-icono", r.icono));
    cab.appendChild(document.createTextNode(" " + r.texto));
    c.appendChild(cab);
    var fila = crear("div", "beta-fila");
    var ir = crear("a", "boton" + (ok ? "" : " principal"), r.ir + " →");
    ir.href = r.href;
    var b = crear("button", "boton", ok ? "✓ Hecho" : "Lo hice");
    b.type = "button";
    b.setAttribute("aria-pressed", String(ok));
    b.addEventListener("click", function () { marcar(s, !hecho(s)); });
    fila.append(ir, b);
    c.appendChild(fila);
    var pie = crear("p", "beta-sub beta-centro", ok ? "Brutal. El lunes, uno nuevo." : "Cambia en " + diasParaLunes() + (diasParaLunes() === 1 ? " día." : " días."));
    if (compacta) {
      var ver = crear("a", "", "Ver retos");
      ver.href = "retos.html";
      pie.appendChild(document.createTextNode(" "));
      pie.appendChild(ver);
    }
    c.appendChild(pie);
    cont.appendChild(c);
  }

  function pintarPagina() {
    var cont = document.getElementById("retosPagina");
    if (!cont) return;
    tarjeta(cont, false);
    var n = cumplidos();
    document.getElementById("retosCuenta").textContent = n ? n + (n === 1 ? " reto cumplido" : " retos cumplidos") : "";
    var lista = document.getElementById("retosAnteriores");
    lista.textContent = "";
    var s = semana();
    for (var k = 1; k <= 4; k++) {
      var r = retoDe(s - k), ok = hecho(s - k);
      var p = crear("p", "reto-pasado" + (ok ? " hecho" : ""));
      p.appendChild(crear("span", "reto-marca", ok ? "✓" : "·"));
      p.appendChild(document.createTextNode(" " + r.icono + " " + r.texto));
      lista.appendChild(p);
    }
  }

  function pintarProgreso() {
    var cont = document.getElementById("retoProgreso");
    if (cont) tarjeta(cont, true);
  }

  function pintar() { pintarPagina(); pintarProgreso(); }

  window.RetosSemana = { semana: semana, retoDe: retoDe, hecho: hecho, marcar: marcar, RETOS: RETOS };
  window.addEventListener("retos-cambio", pintar);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pintar);
  else pintar();
})();
