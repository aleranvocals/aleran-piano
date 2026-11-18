/* diario.js — Diario de voz: 10 segundos al día (una frase o una nota) y comparar con hace una semana y hace un mes.
 * Todo vive en este dispositivo (IndexedDB «aleran-diario-voz-v1»): ningún audio sale del navegador.
 * Una grabación por día; grabar otra vez el mismo día la sustituye. */
(function () {
  "use strict";
  var A = window.BetaAfina;
  var DB = "aleran-diario-voz-v1", ALMACEN = "entradas", SEG = 10;
  var CLAVE_MODO = "aleran-diario-modo";
  var FRASE = "«Mañana compro pan, mañana compro pan»";
  var modo = "frase", db = null, urls = [], grabando = false, rec = null, flujo = null, reloj = null;

  function el(id) { return document.getElementById(id); }
  function crear(tag, clase, texto) { var e = document.createElement(tag); if (clase) e.className = clase; if (texto !== undefined) e.textContent = texto; return e; }
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function hoy() { return iso(new Date()); }
  function dias(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }
  function bonita(f) { try { return new Date(f + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return f; } }

  // ---- IndexedDB
  function abrir() {
    if (db) return Promise.resolve(db);
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("Este navegador no deja guardar audio aquí.")); return; }
      var s = indexedDB.open(DB, 1);
      s.onupgradeneeded = function () { if (!s.result.objectStoreNames.contains(ALMACEN)) s.result.createObjectStore(ALMACEN, { keyPath: "fecha" }); };
      s.onsuccess = function () { db = s.result; resolve(db); };
      s.onerror = function () { reject(new Error("No pude abrir tu diario en este navegador (¿modo privado?).")); };
      s.onblocked = function () { reject(new Error("Cierra las otras pestañas de la web y recarga.")); };
    });
  }
  function op(modoTx, fn) {
    return abrir().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(ALMACEN, modoTx), r = fn(tx.objectStore(ALMACEN));
        tx.oncomplete = function () { resolve(r && r.result); };
        tx.onerror = tx.onabort = function () { reject(tx.error || new Error("No se pudo guardar.")); };
      });
    });
  }
  function todas() { return op("readonly", function (s) { return s.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }); }); }

  // ---- grabar
  function micGuardado() { try { var v = JSON.parse(localStorage.getItem("aleran-mic-dispositivo") || "null"); return v && v.id ? v : null; } catch (e) { return null; } }

  function pedirMic() {
    var g = micGuardado();
    var base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    var con = g ? Object.assign({}, base, { deviceId: { exact: g.id } }) : base;
    return navigator.mediaDevices.getUserMedia({ audio: con }).catch(function (e) {
      if (g && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) return navigator.mediaDevices.getUserMedia({ audio: base });
      throw e;
    }).catch(function (e) {
      var M = window.MicrofonoEngine;
      throw M && M.errorLegible ? M.errorLegible(e) : e;
    });
  }

  function soltarMic() { if (flujo) { flujo.getTracks().forEach(function (t) { t.stop(); }); flujo = null; } }

  function notaReferencia() { var r = A.rango(); return Math.round(r.min + (r.max - r.min) * 0.4); }

  function grabar() {
    if (grabando) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      el("diaEstado").textContent = "Este navegador no deja grabar aquí. Prueba con Chrome, Edge o Safari al día.";
      return;
    }
    grabando = true;
    el("diaGrabar").disabled = true;
    el("diaEstado").textContent = "Abriendo el micrófono…";
    var nota = modo === "nota" ? notaReferencia() : null;
    pedirMic().then(function (f) {
      flujo = f;
      return cuentaAtras(nota);
    }).then(function () {
      if (!grabando) return;
      var tipo = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
      rec = tipo ? new MediaRecorder(flujo, { mimeType: tipo }) : new MediaRecorder(flujo);
      var trozos = [], t0 = performance.now();
      rec.ondataavailable = function (e) { if (e.data && e.data.size) trozos.push(e.data); };
      rec.onstop = function () {
        clearInterval(reloj);
        soltarMic();
        var dur = (performance.now() - t0) / 1000;
        var blob = new Blob(trozos, { type: rec.mimeType || "audio/webm" });
        rec = null;
        el("diaParar").hidden = true;
        el("diaBarra").style.width = "0%";
        if (!grabando) return; // cancelado
        grabando = false;
        el("diaGrabar").disabled = false;
        if (dur < 2 || !blob.size) { el("diaEstado").textContent = "Muy cortita: no la guardé. Prueba otra vez."; return; }
        var entrada = { fecha: hoy(), creado: new Date().toISOString(), blob: blob, tipo: blob.type, modo: modo, nota: nota, seg: Math.round(dur * 10) / 10 };
        op("readwrite", function (s) { return s.put(entrada); }).then(function () {
          el("diaEstado").textContent = "✓ Guardada la de hoy.";
          pintar();
        }).catch(function (e) { el("diaEstado").textContent = "No pude guardarla: " + (e && e.message ? e.message : "sin espacio"); });
      };
      rec.start(250);
      el("diaParar").hidden = false;
      el("diaEstado").textContent = modo === "nota" ? "Grabando… sostén la nota." : "Grabando… " + FRASE;
      reloj = setInterval(function () {
        var t = (performance.now() - t0) / 1000;
        el("diaBarra").style.width = Math.min(100, (t / SEG) * 100).toFixed(1) + "%";
        if (t >= SEG && rec && rec.state === "recording") rec.stop();
      }, 100);
    }).catch(function (e) {
      cancelar();
      el("diaEstado").textContent = "No pude usar el micrófono: " + (e && e.message ? e.message : "permiso denegado");
    });
  }

  function cuentaAtras(nota) {
    return new Promise(function (resolve) {
      var n = 3;
      if (nota !== null && window.PianoEngine) A.tocar([nota], 2.6, 0.75).catch(function () {});
      el("diaEstado").textContent = (nota !== null ? "Escucha la nota… " : "Prepárate… ") + n;
      var t = setInterval(function () {
        n--;
        if (!grabando) { clearInterval(t); resolve(); return; }
        if (n <= 0) { clearInterval(t); resolve(); return; }
        el("diaEstado").textContent = (nota !== null ? "Escucha la nota… " : "Prepárate… ") + n;
      }, 1000);
    });
  }

  function cancelar() {
    grabando = false;
    clearInterval(reloj);
    if (rec && rec.state === "recording") rec.stop();
    soltarMic();
    el("diaGrabar").disabled = false;
    el("diaParar").hidden = true;
    el("diaBarra").style.width = "0%";
  }

  // ---- comparar
  function cercana(lista, objetivo, margen, excluir) {
    var mejor = null;
    lista.forEach(function (e) {
      if (e.fecha === excluir) return;
      var d = Math.abs(dias(e.fecha, objetivo));
      if (d <= margen && (!mejor || d < mejor.d)) mejor = { e: e, d: d };
    });
    return mejor && mejor.e;
  }

  function soltarUrls() { urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = []; }

  function tarjeta(titulo, e, vacio) {
    var c = crear("div", "dia-tarjeta");
    c.appendChild(crear("p", "barra-etiqueta", titulo));
    if (!e) { c.appendChild(crear("p", "beta-sub", vacio)); c.classList.add("vacia"); return c; }
    c.appendChild(crear("p", "beta-sub", bonita(e.fecha) + (e.modo === "nota" && e.nota ? " · " + A.nombre(e.nota) : "")));
    var a = crear("audio");
    a.controls = true;
    a.preload = "metadata";
    var u = URL.createObjectURL(e.blob);
    urls.push(u);
    a.src = u;
    c.appendChild(a);
    return c;
  }

  function pintar() {
    return todas().then(function (lista) {
      soltarUrls();
      var h = hoy();
      var deHoy = lista.filter(function (e) { return e.fecha === h; })[0] || null;
      var semana = new Date(); semana.setDate(semana.getDate() - 7);
      var mes = new Date(); mes.setDate(mes.getDate() - 30);
      var cont = el("diaComparar");
      cont.textContent = "";
      cont.appendChild(tarjeta("Hoy", deHoy, "Aún no grabas hoy."));
      cont.appendChild(tarjeta("Hace una semana", cercana(lista, iso(semana), 3, h), "Vuelve en unos días."));
      cont.appendChild(tarjeta("Hace un mes", cercana(lista, iso(mes), 7, h), "Aquí verás tu voz de hace un mes."));
      el("diaGrabar").textContent = deHoy ? "🎙 Grabar de nuevo hoy" : "🎙 Grabar hoy (10 s)";
      el("diaCuenta").textContent = lista.length ? lista.length + (lista.length === 1 ? " día grabado" : " días grabados") : "";
      var todo = el("diaLista");
      todo.textContent = "";
      lista.forEach(function (e) {
        var b = crear("button", "chip", bonita(e.fecha));
        b.type = "button";
        b.addEventListener("click", function () { elegir(e); });
        todo.appendChild(b);
      });
      el("diaTodas").hidden = lista.length < 2;
    }).catch(function (e) {
      el("diaEstado").textContent = e && e.message ? e.message : "No pude leer tu diario.";
    });
  }

  function elegir(e) {
    var cont = el("diaElegida");
    cont.textContent = "";
    cont.hidden = false;
    cont.appendChild(tarjeta("Elegida", e));
    var fila = crear("div", "beta-fila");
    var desc = crear("a", "boton", "⬇ Descargar");
    var u = URL.createObjectURL(e.blob);
    urls.push(u);
    desc.href = u;
    desc.download = "diario-voz-" + e.fecha + (/mp4/.test(e.tipo || "") ? ".m4a" : ".webm");
    var borrar = crear("button", "boton", "🗑 Borrar");
    borrar.type = "button";
    borrar.addEventListener("click", function () {
      if (!confirm("¿Borrar la grabación del " + bonita(e.fecha) + "? No se puede recuperar.")) return;
      op("readwrite", function (s) { return s.delete(e.fecha); }).then(function () { cont.hidden = true; cont.textContent = ""; pintar(); });
    });
    fila.append(desc, borrar);
    cont.appendChild(fila);
  }

  function pintarModo() {
    Array.prototype.forEach.call(el("diaModos").children, function (b) { b.classList.toggle("activo", b.dataset.modo === modo); b.setAttribute("aria-pressed", String(b.dataset.modo === modo)); });
    el("diaQue").textContent = modo === "nota" ? "Suena una nota de tu rango y la sostienes 10 segundos." : "Di o canta " + FRASE + ". Siempre la misma.";
  }

  function arrancar() {
    try { modo = localStorage.getItem(CLAVE_MODO) === "nota" ? "nota" : "frase"; } catch (e) { modo = "frase"; }
    Array.prototype.forEach.call(el("diaModos").children, function (b) {
      b.addEventListener("click", function () {
        if (grabando) return;
        modo = b.dataset.modo;
        try { localStorage.setItem(CLAVE_MODO, modo); } catch (e) { /* nada */ }
        pintarModo();
      });
    });
    pintarModo();
    el("diaGrabar").addEventListener("click", grabar);
    el("diaParar").addEventListener("click", function () { if (rec && rec.state === "recording") rec.stop(); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && grabando) { cancelar(); el("diaEstado").textContent = "Paré la grabación al salir de la pestaña. Graba otra vez."; }
    });
    window.addEventListener("pagehide", function () { cancelar(); soltarUrls(); });
    pintar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
