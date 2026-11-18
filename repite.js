/* repite.js — «Repite después de mí»: el piano toca 3 notas dentro de tu rango, las cantas y ves nota a nota si
 * quedaron afinadas (verde) o no (rojo). Tres frases seguidas en verde = subes de nivel. Tolerancia: ±45 cents
 * (casi medio semitono): pensada para quien empieza. Una octava justa arriba o abajo también vale. */
(function () {
  "use strict";
  var A = window.BetaAfina;
  var CLAVE = "aleran-repite"; // { nivel, maxNivel, racha }
  var TOL = 45, PARA_SUBIR = 3, NIVEL_MAX = A.puro.NIVELES.length;
  var DUR_NOTA = 0.75, ESCUCHA_MAX = 7000;
  var est = leer();
  var frase = null, lecturas = [], parar = null, reloj = null, t0 = 0, ocupado = false;

  function el(id) { return document.getElementById(id); }
  function leer() {
    try {
      var d = JSON.parse(localStorage.getItem(CLAVE) || "null");
      if (d && d.nivel >= 1) return { nivel: Math.min(d.nivel, NIVEL_MAX), maxNivel: Math.min(Math.max(d.maxNivel || 1, d.nivel), NIVEL_MAX), racha: d.racha || 0 };
    } catch (e) { /* sin datos */ }
    return { nivel: 1, maxNivel: 1, racha: 0 };
  }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(est)); } catch (e) { /* vale para esta visita */ } }

  function pintarNivel() {
    el("rpNivel").textContent = "Nivel " + est.nivel;
    el("rpMenos").disabled = est.nivel <= 1 || ocupado;
    el("rpMas").disabled = est.nivel >= est.maxNivel || ocupado;
    var r = el("rpRacha");
    r.textContent = "";
    for (var i = 0; i < PARA_SUBIR; i++) {
      var p = document.createElement("span");
      p.className = "rp-punto" + (i < est.racha ? " lleno" : "");
      r.appendChild(p);
    }
    r.setAttribute("aria-label", est.racha + " de " + PARA_SUBIR + " seguidas");
  }

  // Cajas a distinta altura según la nota: se ve el dibujo de la melodía sin saber leer música.
  function pintarCajas(resultado, vivo) {
    var cont = el("rpNotas");
    cont.textContent = "";
    if (!frase) return;
    var lo = Math.min.apply(null, frase), hi = Math.max.apply(null, frase);
    frase.forEach(function (m, i) {
      var c = document.createElement("div");
      c.className = "rp-nota";
      c.style.marginTop = (hi === lo ? 30 : Math.round((hi - m) / (hi - lo) * 60)) + "px";
      var r = resultado && resultado[i];
      if (r) c.classList.add(r.ok ? "ok" : "no");
      if (vivo && vivo.indice === i) c.classList.add("ahora");
      var marca = document.createElement("b");
      marca.textContent = r ? (r.ok ? "✓" : r.cantada === null ? "·" : r.cents < 0 ? "↑" : "↓") : String(i + 1);
      c.appendChild(marca);
      var pie = document.createElement("small");
      pie.textContent = r ? (r.ok ? (r.octava ? "octava" : "bien") : r.cantada === null ? "no te oí" : r.cents < 0 ? "sube" : "baja") : vivo && vivo.indice === i && vivo.nota ? vivo.nota : "";
      c.appendChild(pie);
      cont.appendChild(c);
    });
  }

  function botones(ocup) {
    ocupado = ocup;
    el("rpEmpezar").disabled = ocup;
    el("rpOtraVez").disabled = ocup || !frase;
    el("rpParar").hidden = !ocup;
    pintarNivel();
  }

  function detener() {
    if (parar) { parar(); parar = null; }
    if (reloj) { clearInterval(reloj); reloj = null; }
  }

  function cancelar(msg) {
    detener();
    if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
    botones(false);
    pintarCajas(null);
    el("rpMensaje").textContent = msg || "";
  }

  function nuevaFrase() {
    var r = A.rango();
    frase = A.puro.frase(est.nivel, r.min, r.max);
  }

  function ronda(repetir) {
    if (ocupado) return;
    if (!repetir || !frase) nuevaFrase();
    botones(true);
    el("rpMensaje").textContent = "Escucha…";
    el("rpEstado").textContent = "";
    pintarCajas(null);
    // Primero se abre el micrófono (el permiso no debe interrumpir la escucha), luego suena la frase.
    var M = window.MicrofonoEngine;
    var abrir = M && M.disponible() ? M.iniciar() : Promise.reject(new Error("Este navegador no deja usar el micrófono aquí."));
    abrir.then(function () {
      if (!ocupado) return null;
      var i = 0;
      return A.tocar(frase, DUR_NOTA, 0.85, {
        onEventoInicio: function (k) { i = k; pintarCajas(null, { indice: k }); },
        onCargando: function (s) { if (s) el("rpMensaje").textContent = "Cargando el piano…"; },
      });
    }).then(function () {
      if (!ocupado) return;
      // El final de la nota del piano aún suena un instante: se espera para no confundirlo con tu voz.
      setTimeout(escuchar, 380);
    }).catch(function (e) {
      cancelar("");
      el("rpEstado").textContent = "No pude usar el micrófono: " + (e && e.message ? e.message : "permiso denegado");
    });
  }

  function escuchar() {
    if (!ocupado) return;
    lecturas = [];
    el("rpMensaje").textContent = "Ahora tú.";
    pintarCajas(null, { indice: 0 });
    A.escuchar(function (l) { lecturas.push(l); }).then(function (stop) {
      if (!ocupado) { stop(); return; }
      parar = stop;
      t0 = performance.now();
      reloj = setInterval(revisar, 100);
    }).catch(function (e) {
      cancelar("");
      el("rpEstado").textContent = "No pude usar el micrófono: " + (e && e.message ? e.message : "permiso denegado");
    });
  }

  function revisar() {
    var ahora = performance.now();
    var tr = A.puro.tramos(lecturas, { minDur: 220 });
    var ultima = null;
    for (var i = lecturas.length - 1; i >= 0; i--) if (lecturas[i].m !== null) { ultima = lecturas[i]; break; }
    var cantando = ultima && ahora - ultima.t < 200;
    var indice = Math.min(frase.length - 1, cantando && tr.length && ahora - tr[tr.length - 1].fin < 200 ? tr.length - 1 : tr.length);
    pintarCajas(null, { indice: indice, nota: cantando ? A.nombre(ultima.m) : "" });
    var listo = tr.length >= frase.length && !cantando && ahora - tr[frase.length - 1].fin > 300;
    if (listo || ahora - t0 > ESCUCHA_MAX) terminar(tr);
  }

  function terminar(tr) {
    detener();
    var r = A.puro.evaluarFrase(frase, tr, TOL);
    var bien = r.filter(function (x) { return x.ok; }).length;
    var oidas = r.filter(function (x) { return x.cantada !== null; }).length;
    var msg;
    if (oidas === 0) { msg = "No te oí. Canta las tres notas después del piano."; }
    else if (bien === frase.length) {
      est.racha++;
      if (est.racha >= PARA_SUBIR && est.nivel < NIVEL_MAX) {
        est.nivel++;
        est.maxNivel = Math.max(est.maxNivel, est.nivel);
        est.racha = 0;
        msg = "¡Tremendo! Subes al nivel " + est.nivel + ".";
        frase = null;
      } else msg = est.racha >= PARA_SUBIR ? "Brutal. Estás en el nivel más alto." : ["Bien, bien. Ahí está.", "Perfecto. Otra.", "Re bien."][est.racha % 3];
    } else {
      est.racha = 0;
      msg = bien >= 2 ? "Casi, casi. Otra vez." : "No pasa nada. Escúchala otra vez y prueba.";
    }
    guardar();
    botones(false);
    pintarCajas(oidas ? r : null);
    el("rpMensaje").textContent = msg;
    if (window.Progreso && window.Progreso.marcarHerramientaUsada) window.Progreso.marcarHerramientaUsada("repite");
  }

  function pintarRango() {
    var r = A.rango();
    el("rpRango").textContent = r.elegido ? "" : "Sin rango elegido: uso el de tenor. ";
    el("rpRangoLink").hidden = r.elegido;
  }

  function arrancar() {
    pintarNivel();
    pintarRango();
    window.addEventListener("rango-vocal-cambio", function () { frase = null; pintarRango(); pintarCajas(null); });
    el("rpEmpezar").addEventListener("click", function () { ronda(false); });
    el("rpOtraVez").addEventListener("click", function () { ronda(true); });
    el("rpParar").addEventListener("click", function () { cancelar("Parado."); });
    el("rpMenos").addEventListener("click", function () { if (est.nivel > 1) { est.nivel--; est.racha = 0; frase = null; guardar(); pintarNivel(); pintarCajas(null); } });
    el("rpMas").addEventListener("click", function () { if (est.nivel < est.maxNivel) { est.nivel++; est.racha = 0; frase = null; guardar(); pintarNivel(); pintarCajas(null); } });
    document.addEventListener("visibilitychange", function () { if (document.hidden && ocupado) cancelar("En pausa. Toca «Escuchar» para seguir."); });
    window.addEventListener("pagehide", detener);
    botones(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
