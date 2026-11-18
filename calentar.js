/* calentar.js — Calentamiento de 5 minutos con un botón.
 * Sin elegir nada: siete pasos seguidos con temporizador y notas de referencia del piano dentro de tu rango.
 * Los ejercicios salen tal cual del calentamiento de Áleran («Predisposición total del aparato fonador»: cuerpo,
 * respiración 4-4-8, humming, vocal fry, lip roll, sirena con «A») y de sus rutinas (escala con «NEI» sin peso). */
(function () {
  "use strict";
  var A = window.BetaAfina;
  var CLAVE = "aleran-calentar"; // { fechas: ["2026-11-18", ...] }

  // patron: grados en semitonos desde la nota de partida; cada «vuelta» sube medio tono (y baja al llegar arriba).
  var PASOS = [
    { id: "cuerpo", icono: "🧍", nombre: "Cuerpo", seg: 30, texto: "Hombros y cuello: círculos suaves. Suelta." },
    { id: "resp", icono: "🫁", nombre: "Respiración", seg: 32, texto: "Entra 4 · sostén 4 · sale 8. Sin subir los hombros." },
    { id: "humming", icono: "🐝", nombre: "Humming", seg: 45, texto: "«Mmm» con los labios cerrados, sin peso.", patron: [0, 2, 4, 2, 0], dur: 0.6, pausa: 1.5 },
    { id: "fry", icono: "🥱", nombre: "Vocal fry", seg: 25, texto: "Vocal fry suave, como recién despierto con pereza." },
    { id: "liproll", icono: "💋", nombre: "Lip roll", seg: 60, texto: "Lip roll («brrr») siguiendo el piano.", patron: [0, 4, 7, 4, 0], dur: 0.5, pausa: 1.5 },
    { id: "sirena", icono: "🚨", nombre: "Sirena con «A»", seg: 45, texto: "Sirena con «A» de la nota grave a la aguda y vuelta. Liviano.", sirena: true },
    { id: "nei", icono: "🎶", nombre: "Escala «NEI»", seg: 63, texto: "Escala con «NEI», sin peso. Al 70.", patron: [0, 2, 4, 5, 7, 5, 4, 2, 0], dur: 0.4, pausa: 1.2 },
  ];
  var TOTAL = PASOS.reduce(function (a, p) { return a + p.seg; }, 0);

  var estado = "parado"; // parado | sonando | pausa | fin
  var hecho = 0;          // segundos completados (de todo el calentamiento)
  var marcaT = 0;         // performance.now() del último arranque
  var tic = null, pasoSonando = -1, conPiano = true;

  function el(id) { return document.getElementById(id); }
  function hoyISO() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function mmss(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  function transcurrido() { return estado === "sonando" ? hecho + (performance.now() - marcaT) / 1000 : hecho; }

  function pasoEn(t) {
    var acum = 0;
    for (var i = 0; i < PASOS.length; i++) {
      if (t < acum + PASOS[i].seg) return { i: i, dentro: t - acum };
      acum += PASOS[i].seg;
    }
    return { i: PASOS.length, dentro: 0 };
  }

  // Vueltas de notas de un paso: la primera nota de cada vuelta sube medio tono y, al llegar a lo alto de tu zona
  // cómoda (3/4 de tu rango), vuelve a bajar.
  function vueltas(p, r) {
    var lo = r.min + 3, techo = Math.round(r.min + (r.max - r.min) * 0.75);
    if (p.sirena) {
      var alto = Math.min(lo + 12, r.max - 3);
      return { len: 4.4, notas: function () { return [{ midi: lo, duracion: 1.2 }, { midi: alto, duracion: 1.2 }, { midi: -1, duracion: 2 }]; } };
    }
    var ancho = Math.max.apply(null, p.patron);
    var arriba = Math.max(lo, techo - ancho);
    var len = p.patron.length * p.dur + p.pausa;
    return {
      len: len,
      notas: function (k) {
        var ciclo = Math.max(1, (arriba - lo) * 2);
        var pos = k % ciclo;
        var base = lo + (pos <= arriba - lo ? pos : ciclo - pos);
        return p.patron.map(function (g) { return { midi: base + g, duracion: p.dur }; }).concat([{ midi: -1, duracion: p.pausa }]);
      },
    };
  }

  function sonarDesde(i, dentro) {
    var P = window.PianoEngine;
    pasoSonando = i;
    if (!P) return;
    P.detenerReproduccion();
    var p = PASOS[i];
    if (!conPiano || !p || (!p.patron && !p.sirena)) return;
    var v = vueltas(p, A.rango());
    var k0 = Math.ceil(dentro / v.len), eventos = [];
    var espera = k0 * v.len - dentro; // hasta que empiece la próxima vuelta entera
    if (espera > 0.05) eventos.push({ midi: -1, duracion: espera });
    for (var k = k0; (k + 1) * v.len <= p.seg + 0.01; k++) eventos = eventos.concat(v.notas(k));
    if (eventos.length) P.reproducirSecuencia(eventos, 0.7).catch(function () { /* el audio no debe parar el reloj */ });
  }

  function pintar() {
    var t = transcurrido();
    var pe = pasoEn(t);
    el("calBarra").style.width = Math.min(100, (t / TOTAL) * 100).toFixed(1) + "%";
    el("calTotal").textContent = mmss(TOTAL - t);
    var lista = el("calPasos").children;
    for (var j = 0; j < lista.length; j++) {
      lista[j].classList.toggle("activo", j === pe.i && estado !== "parado" && estado !== "fin");
      lista[j].classList.toggle("qv-hecho", j < pe.i || estado === "fin");
    }
    if (estado === "fin" || pe.i >= PASOS.length) return;
    var p = PASOS[pe.i];
    if (estado === "parado") return;
    el("calIcono").textContent = p.icono;
    el("calNombre").textContent = p.nombre;
    el("calTexto").textContent = p.texto;
    el("calCuenta").textContent = mmss(p.seg - pe.dentro);
    if (p.id === "resp") {
      var f = pe.dentro % 16;
      el("calFase").textContent = f < 4 ? "Entra · " + (Math.floor(f) + 1) : f < 8 ? "Sostén · " + (Math.floor(f - 4) + 1) : "Sale · " + (Math.floor(f - 8) + 1);
    } else el("calFase").textContent = "";
  }

  function paso() {
    var t = transcurrido();
    if (t >= TOTAL) { terminar(); return; }
    var pe = pasoEn(t);
    if (pe.i !== pasoSonando) sonarDesde(pe.i, pe.dentro);
    pintar();
  }

  function botones() {
    el("calEmpezar").hidden = estado !== "parado" && estado !== "fin";
    el("calEmpezar").textContent = estado === "fin" ? "▶ Otra vez" : "▶ Empezar";
    el("calPausa").hidden = estado !== "sonando" && estado !== "pausa";
    el("calPausa").textContent = estado === "pausa" ? "▶ Seguir" : "⏸ Pausa";
    el("calSiguiente").hidden = estado !== "sonando" && estado !== "pausa";
    el("calParar").hidden = estado !== "sonando" && estado !== "pausa";
    el("calEnCurso").hidden = estado === "parado" || estado === "fin";
    el("calFin").hidden = estado !== "fin";
  }

  function empezar() {
    hecho = 0;
    estado = "sonando";
    marcaT = performance.now();
    pasoSonando = -1;
    if (window.PianoEngine && window.PianoEngine.precargarPiano) window.PianoEngine.precargarPiano();
    botones();
    if (tic) clearInterval(tic);
    tic = setInterval(paso, 200);
    paso();
  }

  function pausar(motivo) {
    if (estado !== "sonando") return;
    hecho = transcurrido();
    estado = "pausa";
    pasoSonando = -1;
    if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
    el("calEstado").textContent = motivo || "";
    botones();
    pintar();
  }

  function seguir() {
    if (estado !== "pausa") return;
    estado = "sonando";
    marcaT = performance.now();
    el("calEstado").textContent = "";
    botones();
    paso();
  }

  function siguiente() {
    var pe = pasoEn(transcurrido());
    var acum = 0;
    for (var i = 0; i <= pe.i && i < PASOS.length; i++) acum += PASOS[i].seg;
    hecho = Math.min(TOTAL, acum);
    marcaT = performance.now();
    pasoSonando = -1;
    if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
    paso();
  }

  function parar() {
    if (tic) { clearInterval(tic); tic = null; }
    if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
    estado = "parado";
    hecho = 0;
    pasoSonando = -1;
    el("calEstado").textContent = "";
    botones();
    pintar();
  }

  function leerHistorial() {
    try { var d = JSON.parse(localStorage.getItem(CLAVE) || "null"); return d && Array.isArray(d.fechas) ? d : { fechas: [] }; } catch (e) { return { fechas: [] }; }
  }

  function terminar() {
    if (tic) { clearInterval(tic); tic = null; }
    if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
    estado = "fin";
    hecho = TOTAL;
    var h = leerHistorial(), hoy = hoyISO();
    if (h.fechas.indexOf(hoy) < 0) h.fechas.push(hoy);
    h.fechas = h.fechas.slice(-120);
    try { localStorage.setItem(CLAVE, JSON.stringify(h)); } catch (e) { /* vale para esta visita */ }
    if (window.Progreso && window.Progreso.marcarHerramientaUsada) window.Progreso.marcarHerramientaUsada("calentar");
    botones();
    pintar();
    pintarHoy();
  }

  function pintarHoy() {
    var h = leerHistorial();
    var hoy = hoyISO();
    var semana = h.fechas.filter(function (f) { return (new Date(hoy) - new Date(f)) / 86400000 < 7; }).length;
    el("calHoy").textContent = h.fechas.indexOf(hoy) >= 0 ? "✓ Hoy ya calentaste · " + semana + " de 7 días esta semana" : semana ? semana + " de 7 días esta semana" : "";
  }

  function pintarRango() {
    var r = A.rango();
    el("calRango").hidden = r.elegido;
  }

  function arrancar() {
    var cont = el("calPasos");
    PASOS.forEach(function (p) {
      var s = document.createElement("span");
      s.className = "chip";
      s.textContent = p.icono + " " + p.nombre;
      cont.appendChild(s);
    });
    el("calTotal").textContent = mmss(TOTAL);
    el("calEmpezar").addEventListener("click", empezar);
    el("calPausa").addEventListener("click", function () { if (estado === "pausa") seguir(); else pausar(""); });
    el("calSiguiente").addEventListener("click", siguiente);
    el("calParar").addEventListener("click", parar);
    el("calPiano").addEventListener("click", function () {
      conPiano = !conPiano;
      el("calPiano").textContent = conPiano ? "🔊 Piano" : "🔇 Sin piano";
      el("calPiano").setAttribute("aria-pressed", String(conPiano));
      pasoSonando = -1;
      if (!conPiano && window.PianoEngine) window.PianoEngine.detenerReproduccion();
      if (estado === "sonando") paso();
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pausar("En pausa mientras estabas fuera. «Seguir» y continúas."); });
    window.addEventListener("rango-vocal-cambio", function () { pintarRango(); if (estado === "sonando") { pasoSonando = -1; paso(); } });
    pintarRango();
    pintarHoy();
    botones();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
