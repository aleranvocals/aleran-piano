/* que-voz.js — «¿Qué voz tengo?» en 2 minutos.
 * Tres pasos con el micrófono: grave cómodo (sostenido), agudo cómodo (sostenido) y una sirena para el cambio
 * pecho→cabeza (salto automático o el botón «¡Aquí cambió!»). Al final guarda la zona como «Mi rango» (RangoVocal,
 * app-shell.js) y dice a qué tipo de voz se PARECE, sin etiquetas absolutas. */
(function () {
  "use strict";
  var A = window.BetaAfina;
  var CLAVE = "aleran-que-voz"; // último resultado: { fecha, min, max, cambio }
  var SEG = { grave: 15, agudo: 15, cambio: 14 };
  var PASOS = {
    grave: { n: 1, texto: "Di «aaah» relajado y baja hasta tu nota grave cómoda. Quédate ahí 2 segundos." },
    agudo: { n: 2, texto: "Ahora sube hasta la nota aguda que te salga sin apretar. Quédate ahí 2 segundos." },
    cambio: { n: 3, texto: "Sirena suave con «uuu», de grave a agudo. Toca el botón donde notes que la voz cambia." },
  };
  var paso = null, lecturas = [], parar = null, reloj = null, t0 = 0, toque = null;
  var res = { grave: null, agudo: null, cambio: null, cambioAuto: false };
  var anterior = null; // rango que había antes de guardar (para «Deshacer»)

  function el(id) { return document.getElementById(id); }
  function mostrar(id, si) { el(id).hidden = !si; }

  function pintarPasos() {
    var cont = el("qvPasos");
    cont.textContent = "";
    ["grave", "agudo", "cambio"].forEach(function (p) {
      var s = document.createElement("span");
      var hecho = res[p] !== null || (p === "cambio" && paso === "fin");
      s.className = "chip" + (paso === p ? " activo" : "") + (hecho && paso !== p ? " qv-hecho" : "");
      s.textContent = PASOS[p].n + " · " + { grave: "Grave", agudo: "Agudo", cambio: "Cambio" }[p];
      cont.appendChild(s);
    });
  }

  function detener() {
    if (parar) { parar(); parar = null; }
    if (reloj) { clearInterval(reloj); reloj = null; }
  }

  function tiempo() { return (performance.now() - t0) / 1000; }

  function alLeer(l) {
    lecturas.push(l);
    el("qvNota").textContent = l.m === null ? "—" : A.nombre(l.m);
  }

  function vistaPrevia() {
    // Lo encontrado hasta ahora en este paso (para habilitar «Listo»).
    if (paso === "cambio") return toque !== null || A.puro.cambioEnSirena(lecturas) !== null || lecturas.filter(function (l) { return l.m !== null; }).length > 30;
    return A.puro.notaSostenida(lecturas, paso, 700) !== null;
  }

  function empezarPaso(p) {
    detener();
    paso = p;
    lecturas = [];
    toque = null;
    pintarPasos();
    mostrar("qvInicio", false);
    mostrar("qvResultado", false);
    mostrar("qvPaso", true);
    el("qvInstruccion").textContent = PASOS[p].texto;
    el("qvNota").textContent = "—";
    el("qvAviso").textContent = "";
    mostrar("qvAqui", p === "cambio");
    mostrar("qvSaltar", p === "cambio");
    mostrar("qvRepetir", false);
    el("qvListo").disabled = true;
    el("qvBarra").style.width = "0%";
    el("qvEstado").textContent = "Abriendo el micrófono…";
    A.escuchar(alLeer).then(function (stop) {
      if (paso !== p) { stop(); return; } // se cambió de paso mientras se abría
      parar = stop;
      el("qvEstado").textContent = "";
      t0 = performance.now();
      reloj = setInterval(function () {
        var f = Math.min(1, tiempo() / SEG[p]);
        el("qvBarra").style.width = (f * 100).toFixed(1) + "%";
        el("qvListo").disabled = !vistaPrevia();
        if (f >= 1) terminarPaso();
      }, 120);
    }).catch(function (e) {
      el("qvEstado").textContent = "No pude usar el micrófono: " + (e && e.message ? e.message : "permiso denegado");
      volverAlInicio();
    });
  }

  function terminarPaso() {
    var p = paso;
    detener();
    if (p === "grave" || p === "agudo") {
      var n = A.puro.notaSostenida(lecturas, p, 700);
      if (n === null) {
        el("qvAviso").textContent = "No te oí sostener una nota. Acércate un poquito al micrófono y repite.";
        el("qvListo").disabled = true;
        mostrar("qvRepetir", true);
        return;
      }
      if (p === "agudo" && res.grave !== null && n - res.grave < 5) {
        el("qvAviso").textContent = "Esa nota está casi igual que tu grave (" + A.nombre(n) + "). Sube un poquito más, sin apretar.";
        mostrar("qvRepetir", true);
        return;
      }
      res[p] = n;
      empezarPaso(p === "grave" ? "agudo" : "cambio");
      return;
    }
    // cambio
    var auto = A.puro.cambioEnSirena(lecturas);
    var c = toque !== null ? toque : auto;
    if (c !== null && (c <= res.grave || c >= res.agudo)) c = null; // fuera de tu zona: no lo damos por bueno
    res.cambio = c;
    res.cambioAuto = toque === null && c !== null;
    final();
  }

  function aqui() {
    // El botón coge la última nota clara (la de justo antes de pulsar).
    for (var i = lecturas.length - 1; i >= 0 && i >= lecturas.length - 20; i--) {
      if (lecturas[i].m !== null) { toque = Math.round(lecturas[i].m); break; }
    }
    el("qvAviso").textContent = toque !== null ? "Anotado: " + A.nombre(toque) + ". Sigue o toca «Listo»." : "No te oí en ese momento. Sigue la sirena.";
    el("qvListo").disabled = !vistaPrevia();
  }

  function guardar() {
    var R = window.RangoVocal;
    if (!R) return false;
    var o = R.obtener();
    anterior = { clave: o.clave, elegido: o.elegido, min: o.midiMin, max: o.midiMax };
    R.establecer("personalizado", res.grave, res.agudo);
    try { localStorage.setItem(CLAVE, JSON.stringify({ fecha: new Date().toISOString(), min: res.grave, max: res.agudo, cambio: res.cambio })); } catch (e) { /* vale para esta visita */ }
    return true;
  }

  function deshacer() {
    var R = window.RangoVocal;
    if (!R || !anterior) return;
    if (!anterior.elegido) {
      // No había rango elegido: se vuelve al estado «sin elegir».
      try { localStorage.removeItem("aleran-rango-vocal"); } catch (e) { /* nada */ }
      location.reload();
      return;
    }
    if (anterior.clave === "personalizado") R.establecer("personalizado", anterior.min, anterior.max);
    else R.establecer(anterior.clave);
    el("qvGuardado").textContent = "Tu rango anterior está de vuelta.";
    mostrar("qvDeshacer", false);
  }

  function final() {
    paso = "fin";
    pintarPasos();
    mostrar("qvPaso", false);
    mostrar("qvResultado", true);
    el("qvZona").textContent = A.nombre(res.grave) + " – " + A.nombre(res.agudo);
    el("qvCambio").textContent = res.cambio !== null ? "cerca de " + A.nombre(res.cambio) : "sin quiebre a la vista";
    var v = A.puro.vozParecida(res.grave, res.agudo);
    var txt = "Hoy tu zona se parece más a la de " + articulo(v[0].nombre) + v[0].nombre;
    if (v[1] && v[1].dist - v[0].dist < 1.5) txt += " (o " + v[1].nombre + ")";
    el("qvVoz").textContent = txt + ".";
    var ok = guardar();
    el("qvGuardado").textContent = ok ? "✓ Guardado como tu rango (🎙). Las herramientas ya lo usan." : "";
    mostrar("qvDeshacer", ok);
    if (window.Progreso && window.Progreso.marcarHerramientaUsada) window.Progreso.marcarHerramientaUsada("que-voz");
  }

  function articulo(n) {
    return { bajo: "un ", "barítono": "un ", tenor: "un ", contralto: "una ", mezzo: "una ", soprano: "una " }[n] || "";
  }

  function volverAlInicio() {
    detener();
    paso = null;
    res = { grave: null, agudo: null, cambio: null, cambioAuto: false };
    pintarPasos();
    mostrar("qvPaso", false);
    mostrar("qvResultado", false);
    mostrar("qvInicio", true);
    el("qvEmpezar").disabled = false;
  }

  function pintarUltimo() {
    var u = null;
    try { u = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { u = null; }
    if (!u || !(u.max > u.min)) { el("qvUltimo").hidden = true; return; }
    el("qvUltimo").hidden = false;
    var f = "";
    try { f = new Date(u.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short" }); } catch (e) { f = ""; }
    el("qvUltimo").textContent = "La última vez (" + f + "): " + A.nombre(u.min) + " – " + A.nombre(u.max) + (u.cambio ? " · cambio cerca de " + A.nombre(u.cambio) : "");
  }

  function arrancar() {
    pintarPasos();
    pintarUltimo();
    el("qvEmpezar").addEventListener("click", function () { el("qvEmpezar").disabled = true; res = { grave: null, agudo: null, cambio: null, cambioAuto: false }; empezarPaso("grave"); });
    el("qvListo").addEventListener("click", terminarPaso);
    el("qvAqui").addEventListener("click", aqui);
    el("qvRepetir").addEventListener("click", function () { mostrar("qvRepetir", false); empezarPaso(paso); });
    el("qvSaltar").addEventListener("click", function () { if (paso === "cambio") { toque = null; lecturas = []; terminarPaso(); } });
    el("qvOtra").addEventListener("click", function () { mostrar("qvRepetir", false); volverAlInicio(); });
    el("qvCancelar").addEventListener("click", function () { mostrar("qvRepetir", false); volverAlInicio(); });
    el("qvDeshacer").addEventListener("click", deshacer);
    // En segundo plano el navegador frena los relojes: se para el paso y se repite al volver.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && (paso === "grave" || paso === "agudo" || paso === "cambio") && parar) {
        detener();
        el("qvAviso").textContent = "En pausa. Toca «Repetir» para seguir con este paso.";
        mostrar("qvRepetir", true);
      }
    });
    window.addEventListener("pagehide", detener);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
