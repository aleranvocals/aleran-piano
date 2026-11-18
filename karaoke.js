/* karaoke.js — Karaoke de tu canción: la letra de «Letra con notas» (cifrado.html) se ilumina al tempo, sílaba a
 * sílaba, con una nota guía suave del piano (se puede apagar). Lee la canción autoguardada del Cifrado o un archivo
 * .json suyo; no escribe nada en el Cifrado. Ritmo: el del editor de ritmo si el verso lo tiene; si no, negras
 * parejas, igual que «Reproducir toda la canción» del Cifrado. */
(function () {
  "use strict";
  var CLAVE_CIFRADO = "aleran-piano-cifrado-autoguardado"; // la misma que cifrado.js
  var CLAVE_AJ = "aleran-karaoke"; // { bpm, guia }
  var BPM_MIN = 40, BPM_MAX = 200, VOL_GUIA = 0.32;
  var datos = null, plan = null, bpm = 90, guia = true;
  var estado = "parado", indice = 0, cuenta = null, token = 0;

  function el(id) { return document.getElementById(id); }
  function crear(tag, clase, texto) { var e = document.createElement(tag); if (clase) e.className = clase; if (texto !== undefined) e.textContent = texto; return e; }

  function leerAjustes() {
    try { var a = JSON.parse(localStorage.getItem(CLAVE_AJ) || "null"); if (a) { if (a.bpm >= BPM_MIN && a.bpm <= BPM_MAX) bpm = a.bpm; guia = a.guia !== false; } } catch (e) { /* nada */ }
  }
  function guardarAjustes() { try { localStorage.setItem(CLAVE_AJ, JSON.stringify({ bpm: bpm, guia: guia })); } catch (e) { /* nada */ } }

  // ---- lectura del formato del Cifrado
  function lineasDe(d) {
    if (!d || typeof d !== "object" || !Array.isArray(d.cancion)) return [];
    return d.cancion.filter(function (b) { return b && b.tipo === "linea" && Array.isArray(b.silabas) && b.silabas.length; });
  }

  function textoSilaba(s) {
    if (!s || typeof s !== "object") return "";
    var t = s.textoManual !== null && s.textoManual !== undefined ? s.textoManual : s.texto;
    return typeof t === "string" ? t : "";
  }

  // Igual que gruposDeNotas() de cifrado.js: sílabas enlazadas comparten una casilla de nota.
  function grupos(linea) {
    var g = [], ini = 0, n = linea.silabas.length, enl = Array.isArray(linea.enlaces) ? linea.enlaces : [];
    for (var i = 1; i <= n; i++) if (i === n || !enl[i - 1]) { g.push({ inicio: ini, fin: i - 1 }); ini = i; }
    return g;
  }

  function notasDe(texto) {
    if (typeof texto !== "string" || !texto.trim() || typeof interpretarNotas !== "function") return [];
    try { return interpretarNotas(texto.trim()).notas || []; } catch (e) { return []; }
  }

  // Plan: versos (con el texto de cada casilla) y la lista de eventos para el piano, con qué casilla ilumina cada uno.
  function construir(d, tempo) {
    var versos = [], eventos = [], ilumina = [], seccion = null;
    var pausa = 2 * (60 / tempo);
    d.cancion.forEach(function (b) {
      if (!b || typeof b !== "object") return;
      if (b.tipo === "seccion") { seccion = typeof b.texto === "string" ? b.texto : null; return; }
      if (b.tipo !== "linea" || !Array.isArray(b.silabas) || !b.silabas.length) return;
      var gs = grupos(b);
      var casillas = gs.map(function (g, k) {
        var t = "";
        for (var i = g.inicio; i <= g.fin; i++) {
          var s = b.silabas[i];
          t += (i > 0 && s && s.inicioPalabra ? " " : "") + textoSilaba(s);
        }
        return t;
      });
      var unidades, casillaDeUnidad;
      if (b.ritmo && Array.isArray(b.ritmo.unidades) && b.ritmo.unidades.length) {
        unidades = b.ritmo.unidades.map(function (u) { return u && typeof u === "object" ? u : { midi: null, figura: "negra" }; });
        casillaDeUnidad = unidades.map(function (_, i) { return Math.min(i, gs.length - 1); });
      } else {
        unidades = []; casillaDeUnidad = [];
        gs.forEach(function (g, k) {
          var ns = notasDe(b.silabas[g.inicio] && b.silabas[g.inicio].nota);
          if (!ns.length) { unidades.push({ midi: null, figura: "negra" }); casillaDeUnidad.push(k); return; }
          ns.forEach(function (n) { unidades.push({ midi: n.valido ? n.midi : null, figura: "negra" }); casillaDeUnidad.push(k); });
        });
      }
      var evs = unidadesAEventos(unidades, tempo), mapa = mapaUnidadAEvento(unidades), base = eventos.length;
      var v = versos.length;
      versos.push({ casillas: casillas, seccion: seccion });
      seccion = null;
      unidades.forEach(function (_, i) { var k = base + mapa[i]; if (!ilumina[k]) ilumina[k] = { verso: v, casilla: casillaDeUnidad[i] }; });
      evs.forEach(function (e) { eventos.push({ midi: e.midi, duracion: e.duracion }); });
      eventos.push({ midi: -1, duracion: pausa });
      ilumina[eventos.length - 1] = { verso: v, casilla: -1, pausa: true };
    });
    var hayNotas = eventos.some(function (e) { return e.midi !== -1; });
    return { versos: versos, eventos: eventos, ilumina: ilumina, hayNotas: hayNotas };
  }

  // ---- pantalla
  function pintarVerso(v, casilla) {
    var actual = el("karActual"), sig = el("karSiguiente");
    actual.textContent = ""; sig.textContent = "";
    var vs = plan.versos[v];
    el("karSeccion").textContent = vs && vs.seccion ? vs.seccion : "";
    if (!vs) return;
    vs.casillas.forEach(function (t, k) {
      var s = crear("span", "kar-sil" + (k < casilla ? " pasada" : k === casilla ? " sonando" : ""), t || "·");
      actual.appendChild(s);
    });
    var prox = plan.versos[v + 1];
    if (prox) sig.textContent = prox.casillas.join("");
  }

  function botones() {
    var b = el("karPlay");
    b.textContent = estado === "sonando" || estado === "cuenta" ? "⏸ Pausa" : estado === "pausa" ? "▶ Seguir" : "▶ Empezar";
    el("karParar").hidden = estado === "parado";
    el("karBpm").textContent = bpm;
    el("karGuia").textContent = guia ? "🔊 Nota guía" : "🔇 Sin nota guía";
    el("karGuia").setAttribute("aria-pressed", String(guia));
  }

  function lanzar(desde) {
    var P = window.PianoEngine;
    if (!P) { el("karEstado").textContent = "El sonido aún se está cargando. Prueba en un segundo."; estado = "parado"; botones(); return; }
    var mio = ++token;
    estado = "sonando";
    botones();
    P.reproducirSecuencia(plan.eventos.slice(desde), guia ? VOL_GUIA : 0, {
      onCargando: function (s) { if (mio === token) el("karEstado").textContent = s ? "Cargando el piano…" : ""; },
      onEventoInicio: function (i) {
        if (mio !== token) return;
        indice = desde + i;
        var il = plan.ilumina[indice];
        if (il) pintarVerso(il.pausa ? il.verso + 1 : il.verso, il.pausa ? -1 : il.casilla);
      },
    }).then(function () {
      if (mio !== token || estado !== "sonando") return;
      estado = "parado";
      indice = 0;
      el("karEstado").textContent = "¡Fin! Otra vez, o ahora sin la nota guía.";
      botones();
    }).catch(function (e) {
      if (mio !== token) return;
      estado = "parado";
      el("karEstado").textContent = "Error de sonido: " + (e && e.message ? e.message : "");
      botones();
    });
  }

  function empezar(desde) {
    el("karEstado").textContent = "";
    if (window.PianoEngine && window.PianoEngine.precargarPiano) window.PianoEngine.precargarPiano();
    var il = plan.ilumina[desde];
    pintarVerso(il ? (il.pausa ? il.verso + 1 : il.verso) : 0, -1);
    estado = "cuenta";
    botones();
    var n = 3;
    el("karCuenta").textContent = n;
    el("karCuenta").hidden = false;
    clearInterval(cuenta);
    cuenta = setInterval(function () {
      n--;
      if (n > 0) { el("karCuenta").textContent = n; return; }
      clearInterval(cuenta); cuenta = null;
      el("karCuenta").hidden = true;
      lanzar(desde);
    }, Math.round(60000 / bpm));
  }

  function pausar(msg) {
    if (estado === "cuenta") { clearInterval(cuenta); cuenta = null; el("karCuenta").hidden = true; estado = "pausa"; botones(); return; }
    if (estado !== "sonando") return;
    token++;
    if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
    estado = "pausa";
    if (msg) el("karEstado").textContent = msg;
    botones();
  }

  function parar() {
    token++;
    clearInterval(cuenta); cuenta = null;
    el("karCuenta").hidden = true;
    if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
    estado = "parado";
    indice = 0;
    if (plan) pintarVerso(0, -1);
    botones();
  }

  function alternar() {
    if (!plan) return;
    if (estado === "sonando" || estado === "cuenta") pausar("");
    else if (estado === "pausa") empezar(indice);
    else empezar(0);
  }

  function cambiarBpm(d) {
    var nuevo = Math.max(BPM_MIN, Math.min(BPM_MAX, bpm + d));
    if (nuevo === bpm) return;
    // Al cambiar de tempo, el plan se rehace; si estaba sonando, sigue desde la misma nota con el tempo nuevo.
    var seguia = estado === "sonando";
    if (seguia) pausar("");
    bpm = nuevo;
    guardarAjustes();
    plan = construir(datos, bpm);
    botones();
    if (seguia) empezar(indice);
  }

  function usar(d, origen) {
    var p;
    try { p = construir(d, bpm); } catch (e) { p = null; }
    if (!p || !p.versos.length) { mostrarError(origen === "archivo" ? "Ese archivo no tiene versos. ¿Es de «Letra con notas»?" : "Tu canción de «Letra con notas» no tiene versos todavía."); return; }
    parar();
    datos = d;
    plan = p;
    el("karVacio").hidden = true;
    el("karPanel").hidden = false;
    el("karError").textContent = "";
    el("karEstado").textContent = p.hayNotas ? "" : "Los versos aún no tienen notas: se iluminan sin nota guía.";
    pintarVerso(0, -1);
    botones();
  }

  function mostrarError(msg) {
    // Con una canción ya cargada, el aviso va debajo de ella y la canción sigue ahí.
    if (plan) { el("karEstado").textContent = msg; return; }
    el("karVacio").hidden = false;
    el("karError").textContent = msg;
  }

  function autoguardado() {
    try { var d = JSON.parse(localStorage.getItem(CLAVE_CIFRADO) || "null"); return lineasDe(d).length ? d : null; } catch (e) { return null; }
  }

  function abrirArchivo(f) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { mostrarError("Ese archivo es demasiado grande para ser de «Letra con notas»."); return; }
    f.text().then(function (t) {
      var j;
      try { j = JSON.parse(t); } catch (e) { mostrarError("No puedo leer ese archivo: no es un .json de «Letra con notas»."); return; }
      if (!lineasDe(j).length) { mostrarError("Ese archivo no tiene versos. ¿Es de «Letra con notas»?"); return; }
      usar(j, "archivo");
    }).catch(function () { mostrarError("No pude abrir el archivo."); });
  }

  function arrancar() {
    leerAjustes();
    var d = autoguardado();
    if (d) usar(d, "cifrado"); else el("karVacio").hidden = false;
    ["karArchivo", "karArchivo2"].forEach(function (id) {
      el(id).addEventListener("change", function () { abrirArchivo(el(id).files && el(id).files[0]); el(id).value = ""; });
    });
    el("karPlay").addEventListener("click", alternar);
    el("karParar").addEventListener("click", parar);
    el("karMenos").addEventListener("click", function () { cambiarBpm(-5); });
    el("karMas").addEventListener("click", function () { cambiarBpm(5); });
    el("karGuia").addEventListener("click", function () {
      guia = !guia;
      guardarAjustes();
      var seguia = estado === "sonando";
      if (seguia) { pausar(""); empezar(indice); } else botones();
    });
    el("karCifrado").addEventListener("click", function () {
      var a = autoguardado();
      if (a) usar(a, "cifrado"); else mostrarError("Aún no hay una canción en «Letra con notas».");
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pausar("En pausa. «Seguir» continúa desde donde ibas."); });
    window.addEventListener("pagehide", function () { if (window.PianoEngine) window.PianoEngine.detenerReproduccion(); });
    botones();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
