/**
 * salud-vocal.js — dos avisos discretos en TODAS las páginas (lo carga app-shell.js):
 *  1) Pausa: tras 20 minutos de práctica seguida (en cualquier herramienta, aunque cambies de página), un aviso para
 *     beber agua y descansar, con sus tres preguntas: ¿te pica? ¿te raspa? ¿te duele? Si duele: parar.
 *  2) Volumen: si el micrófono oye que cantas MUY fuerte durante mucho rato (1 minuto de los últimos 2), te lo dice
 *     con amabilidad. No juzga la técnica: solo el volumen. El umbral se ajusta en «Cuida tu voz» (salud.html).
 * Los dos se pueden silenciar. Nada sale del navegador: solo se guardan tiempos y ajustes en localStorage.
 */
(function () {
  "use strict";
  if (window.SaludVocal) return;

  var CLAVE_AJ = "aleran-salud-vocal";
  var CLAVE_SES = "aleran-practica-sesion";
  var PAUSA_MS = 20 * 60000;     // 20 minutos de práctica seguida
  var HUECO_MS = 5 * 60000;      // 5 minutos sin practicar = la sesión empieza de cero
  var INACTIVO_MS = 90000;       // sin tocar nada ni micrófono abierto en 90 s = no cuenta como práctica
  var VENTANA_MS = 120000;       // se miran los últimos 2 minutos…
  var FUERTE_MS = 60000;         // …y avisa si 1 minuto de ellos fue por encima del umbral
  var ESPERA_VOL_MS = 10 * 60000;
  var NIVELES = { baja: -9, media: -13, alta: -18 }; // dBFS RMS: «alta» sensibilidad avisa antes

  function leerJSON(clave) { try { return JSON.parse(localStorage.getItem(clave) || "null"); } catch (e) { return null; } }
  function guardarJSON(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch (e) { /* vale para esta visita */ } }

  function ajustes() {
    var a = leerJSON(CLAVE_AJ) || {};
    return { pausa: a.pausa !== false, volumen: a.volumen !== false, nivel: NIVELES[a.nivel] ? a.nivel : "media" };
  }
  function guardarAjustes(a) {
    guardarJSON(CLAVE_AJ, { pausa: !!a.pausa, volumen: !!a.volumen, nivel: NIVELES[a.nivel] ? a.nivel : "media" });
    window.dispatchEvent(new CustomEvent("salud-vocal-cambio", { detail: ajustes() }));
  }
  function umbral() { return NIVELES[ajustes().nivel]; }

  // ---------------------------------------------------------------- estilos (van aquí: esto vive en todas las páginas)
  function estilos() {
    if (document.getElementById("estiloSaludVocal")) return;
    var s = document.createElement("style");
    s.id = "estiloSaludVocal";
    s.textContent =
      ".salud-aviso{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:120;width:min(360px,calc(100vw - 24px));box-sizing:border-box;" +
      "padding:.8rem .9rem;background:var(--panel-2,#221a1a);border:1px solid var(--crimson-bright,#c02241);border-radius:14px;" +
      "box-shadow:0 12px 30px rgba(0,0,0,.55);color:var(--bone,#f2e9e4);font:400 .9rem var(--font-body,system-ui);animation:saludEntra .25s ease-out}" +
      ".salud-aviso p{margin:.15rem 0 .5rem}.salud-aviso strong{font-weight:700}" +
      ".salud-preg{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin:.3rem 0}" +
      ".salud-preg .chip{min-height:34px;padding:.2rem .8rem}" +
      ".salud-fila{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:flex-end;margin-top:.5rem}" +
      ".salud-fila .boton{min-height:36px;padding:.3rem .8rem}" +
      ".salud-cerrar{position:absolute;top:4px;right:6px;background:none;border:0;color:var(--bone-dim,#a8968f);font-size:1rem;cursor:pointer;padding:.3rem}" +
      ".salud-reco{font-weight:600}" +
      "@keyframes saludEntra{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}" +
      "@media print{.salud-aviso{display:none!important}}";
    document.head.appendChild(s);
  }

  function crear(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  var aviso = null;
  function cerrarAviso() { if (aviso) { aviso.remove(); aviso = null; } }

  function caja(etiqueta) {
    cerrarAviso();
    estilos();
    aviso = crear("div", "salud-aviso");
    aviso.setAttribute("role", "status");
    aviso.setAttribute("aria-label", etiqueta);
    var x = crear("button", "salud-cerrar", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Cerrar");
    x.addEventListener("click", cerrarAviso);
    aviso.appendChild(x);
    return aviso;
  }

  function silenciar(que) {
    var a = ajustes();
    a[que] = false;
    guardarAjustes(a);
    cerrarAviso();
  }

  // ---------------------------------------------------------------- 1) pausa
  var ultimaInteraccion = Date.now();
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, function () { ultimaInteraccion = Date.now(); }, { passive: true, capture: true });
  });

  function micAbierto() {
    var M = window.MicrofonoEngine;
    return !!(M && M.obtenerAnalizador && M.obtenerAnalizador());
  }

  function sesion() { var s = leerJSON(CLAVE_SES); return s && s.inicio ? s : null; }

  function minutosSeguidos() {
    var s = sesion();
    if (!s || Date.now() - s.ultimo > HUECO_MS) return 0;
    return Math.floor((s.ultimo - s.inicio) / 60000);
  }

  function latidoPausa() {
    var ahora = Date.now();
    var activo = !document.hidden && (micAbierto() || ahora - ultimaInteraccion < INACTIVO_MS);
    if (!activo) return;
    var s = sesion();
    if (!s || ahora - s.ultimo > HUECO_MS) s = { inicio: ahora, ultimo: ahora };
    s.ultimo = ahora;
    guardarJSON(CLAVE_SES, s);
    if (ajustes().pausa && ahora - s.inicio >= PAUSA_MS && !aviso) mostrarPausa();
  }

  function reiniciarSesion() { var ahora = Date.now(); guardarJSON(CLAVE_SES, { inicio: ahora, ultimo: ahora }); }

  function mostrarPausa() {
    var c = caja("Pausa para tu voz");
    var min = Math.max(20, minutosSeguidos());
    var p = crear("p");
    p.appendChild(crear("strong", "", "💧 Llevas " + min + " minutos."));
    p.appendChild(document.createTextNode(" Agua y un respiro."));
    c.appendChild(p);
    var resp = {};
    var reco = crear("p", "salud-reco");
    [["pica", "¿Te pica?"], ["raspa", "¿Te raspa?"], ["duele", "¿Te duele?"]].forEach(function (q) {
      var fila = crear("div", "salud-preg");
      fila.appendChild(crear("span", "", q[1]));
      var grupo = crear("span");
      ["Sí", "No"].forEach(function (t) {
        var b = crear("button", "chip", t);
        b.type = "button";
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () {
          resp[q[0]] = t === "Sí";
          Array.prototype.forEach.call(grupo.children, function (o) { o.classList.toggle("activo", o === b); o.setAttribute("aria-pressed", String(o === b)); });
          recomendar();
        });
        grupo.appendChild(b);
      });
      fila.appendChild(grupo);
      c.appendChild(fila);
    });
    c.appendChild(reco);
    function recomendar() {
      if (resp.duele) reco.textContent = "Para por hoy. Que duela es una alarma del cuerpo. Si sigue en unos días, que te vea un otorrino o un logopeda.";
      else if (resp.pica || resp.raspa) reco.textContent = "Descansa 5 minutitos y bebe agua. Al volver, más suave: al 70.";
      else if (resp.pica === false && resp.raspa === false && resp.duele === false) reco.textContent = "Bien. Bebe agua y sigue, liviano.";
      else reco.textContent = "";
    }
    var fila = crear("div", "salud-fila");
    var callar = crear("button", "boton", "Silenciar");
    callar.type = "button";
    callar.title = "Se vuelve a activar en «Cuida tu voz» (Herramientas beta)";
    callar.addEventListener("click", function () { silenciar("pausa"); });
    var ok = crear("button", "boton principal", "Vale");
    ok.type = "button";
    ok.addEventListener("click", cerrarAviso);
    fila.append(callar, ok);
    c.appendChild(fila);
    document.body.appendChild(c);
    reiniciarSesion(); // el siguiente aviso, en otros 20 minutos
  }

  // ---------------------------------------------------------------- 2) volumen
  // Por tiempo real (no por número de lecturas): si el navegador va lento y lee menos veces, la cuenta sigue siendo justa.
  var lecturasVol = [], fuerteMs = 0, ultimaT = 0, buf = null, ultimoAvisoVol = 0;

  function nivelDb() {
    var M = window.MicrofonoEngine;
    var an = M && M.obtenerAnalizador ? M.obtenerAnalizador() : null;
    if (!an) return null;
    if (!buf || buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    var s = 0;
    for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return 20 * Math.log10(Math.max(Math.sqrt(s / buf.length), 1e-9));
  }

  function vaciarVentana() { lecturasVol = []; fuerteMs = 0; ultimaT = 0; }

  function latidoVolumen() {
    if (document.hidden || !ajustes().volumen) { ultimaT = 0; return; }
    var db = nivelDb();
    if (db === null) { if (lecturasVol.length) vaciarVentana(); return; }
    var ahora = performance.now();
    var dt = ultimaT ? Math.min(500, ahora - ultimaT) : 0; // un hueco largo (pestaña dormida) no cuenta
    ultimaT = ahora;
    if (db > umbral() && dt) { lecturasVol.push({ t: ahora, dt: dt }); fuerteMs += dt; }
    while (lecturasVol.length && ahora - lecturasVol[0].t > VENTANA_MS) fuerteMs -= lecturasVol.shift().dt;
    if (fuerteMs >= FUERTE_MS && Date.now() - ultimoAvisoVol > ESPERA_VOL_MS && !aviso) mostrarVolumen();
  }

  function mostrarVolumen() {
    ultimoAvisoVol = Date.now();
    vaciarVentana();
    var c = caja("Aviso de volumen");
    var p = crear("p");
    p.appendChild(crear("strong", "", "🔊 Llevas un rato cantando muy fuerte."));
    c.appendChild(p);
    c.appendChild(crear("p", "", "Prueba al 70: el mismo sonido con menos empuje. Y un sorbito de agua."));
    var fila = crear("div", "salud-fila");
    var callar = crear("button", "boton", "Silenciar");
    callar.type = "button";
    callar.title = "Se vuelve a activar en «Cuida tu voz» (Herramientas beta)";
    callar.addEventListener("click", function () { silenciar("volumen"); });
    var ok = crear("button", "boton principal", "Vale");
    ok.type = "button";
    ok.addEventListener("click", cerrarAviso);
    fila.append(callar, ok);
    c.appendChild(fila);
    document.body.appendChild(c);
  }

  setInterval(latidoPausa, 5000);
  setInterval(latidoVolumen, 100);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarAviso(); });

  window.SaludVocal = {
    ajustes: ajustes,
    guardar: guardarAjustes,
    umbral: umbral,
    NIVELES: NIVELES,
    nivelDb: nivelDb,
    minutosSeguidos: minutosSeguidos,
    probarPausa: mostrarPausa,
    probarVolumen: mostrarVolumen,
    cerrar: cerrarAviso,
  };
})();
