/* horario.js — Horario de práctica: días y hora, una sesión repartida en tramos y un plan de 4 semanas.
 * Se guarda en este navegador. Exporta un .ics (el recordatorio lo da el calendario del alumno, no la web). */
(function () {
  "use strict";
  var CLAVE = "aleran-beta-horario";
  var DIAS = [["MO", "L", "Lunes"], ["TU", "M", "Martes"], ["WE", "X", "Miércoles"], ["TH", "J", "Jueves"], ["FR", "V", "Viernes"], ["SA", "S", "Sábado"], ["SU", "D", "Domingo"]];
  var TRAMOS = ["Preparar", "Voz", "Escuchar", "Apuntar"];
  var PRIORIDADES = ["Aire", "Colocación", "Afinación", "Adornos", "Mi canción", "Repaso"];
  var d;

  function porDefecto() {
    return { dias: ["MO", "WE", "FR"], hora: "19:00", tramos: [3, 12, 3, 2], inicio: "", semanas: ["", "", "", ""] };
  }
  function el(id) { return document.getElementById(id); }
  function cargar() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || "null");
      d = v && Array.isArray(v.tramos) && v.tramos.length === 4 ? Object.assign(porDefecto(), v) : porDefecto();
    } catch (e) { d = porDefecto(); }
  }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } }
  function total() { return d.tramos.reduce(function (a, b) { return a + b; }, 0); }

  function iso(f) { return f.getFullYear() + "-" + ("0" + (f.getMonth() + 1)).slice(-2) + "-" + ("0" + f.getDate()).slice(-2); }
  function proximoLunes() {
    var f = new Date();
    var dif = (8 - (f.getDay() || 7)) % 7 || 7;
    f.setDate(f.getDate() + dif);
    return iso(f);
  }

  function pintarDias() {
    var c = el("horDias");
    c.textContent = "";
    DIAS.forEach(function (x) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (d.dias.indexOf(x[0]) >= 0 ? " activo" : "");
      b.textContent = x[1];
      b.title = x[2];
      b.setAttribute("aria-label", x[2]);
      b.addEventListener("click", function () {
        var k = d.dias.indexOf(x[0]);
        if (k >= 0) d.dias.splice(k, 1); else d.dias.push(x[0]);
        guardar(); pintarDias();
      });
      c.appendChild(b);
    });
  }

  function pintarSesion() {
    el("horTotal").textContent = total();
    var barra = el("horBarra");
    barra.textContent = "";
    d.tramos.forEach(function (m, i) {
      var s = document.createElement("div");
      s.style.flex = String(m);
      s.textContent = m >= 3 ? TRAMOS[i] : "";
      s.title = TRAMOS[i] + " · " + m + " min";
      barra.appendChild(s);
    });
    var cont = el("horTramos");
    cont.textContent = "";
    TRAMOS.forEach(function (nombre, i) {
      var fila = document.createElement("div");
      fila.className = "tramo";
      var t = document.createElement("span");
      t.textContent = nombre;
      var menos = document.createElement("button");
      menos.type = "button"; menos.className = "paso"; menos.textContent = "−";
      var val = document.createElement("strong");
      val.className = "paso-valor"; val.textContent = d.tramos[i] + " min";
      var mas = document.createElement("button");
      mas.type = "button"; mas.className = "paso"; mas.textContent = "+";
      menos.addEventListener("click", function () { if (d.tramos[i] > 1) { d.tramos[i]--; guardar(); pintarSesion(); } });
      mas.addEventListener("click", function () { if (total() < 90) { d.tramos[i]++; guardar(); pintarSesion(); } });
      var der = document.createElement("div");
      der.className = "beta-fila";
      der.style.margin = "0";
      der.append(menos, val, mas);
      fila.append(t, der);
      cont.appendChild(fila);
    });
  }

  function pintarSemanas() {
    var cont = el("horSemanas");
    cont.textContent = "";
    var hoy = iso(new Date());
    d.semanas.forEach(function (sel, i) {
      var caja = document.createElement("div");
      caja.className = "semana";
      if (d.inicio) {
        var ini = new Date(d.inicio + "T00:00:00");
        ini.setDate(ini.getDate() + 7 * i);
        var fin = new Date(ini); fin.setDate(fin.getDate() + 6);
        if (hoy >= iso(ini) && hoy <= iso(fin)) caja.classList.add("actual");
      }
      var h = document.createElement("strong");
      h.textContent = "Semana " + (i + 1);
      caja.appendChild(h);
      var fila = document.createElement("div");
      fila.className = "beta-fila";
      PRIORIDADES.forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (sel === p ? " activo" : "");
        b.textContent = p;
        b.addEventListener("click", function () { d.semanas[i] = sel === p ? "" : p; guardar(); pintarSemanas(); });
        fila.appendChild(b);
      });
      caja.appendChild(fila);
      cont.appendChild(caja);
    });
  }

  // ---- .ics ----
  function esc(t) { return String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
  function cuando(fecha, hhmm, sumarMin) {
    var p = hhmm.split(":");
    var f = new Date(fecha + "T00:00:00");
    f.setHours(Number(p[0]), Number(p[1]) + (sumarMin || 0), 0, 0);
    return f.getFullYear() + ("0" + (f.getMonth() + 1)).slice(-2) + ("0" + f.getDate()).slice(-2) + "T" + ("0" + f.getHours()).slice(-2) + ("0" + f.getMinutes()).slice(-2) + "00";
  }
  function primeraFecha(inicioIso, byday) {
    var idx = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }[byday];
    var f = new Date(inicioIso + "T00:00:00");
    for (var i = 0; i < 7; i++) { if (f.getDay() === idx) break; f.setDate(f.getDate() + 1); }
    return iso(f);
  }
  function generarIcs() {
    var inicio = d.inicio || proximoLunes();
    var descr = "Preparar " + d.tramos[0] + " · Voz " + d.tramos[1] + " · Escuchar " + d.tramos[2] + " · Apuntar " + d.tramos[3] + " (min). Si algo molesta, paras.";
    var prioridades = d.semanas.map(function (s, i) { return s ? "Semana " + (i + 1) + ": " + s : ""; }).filter(Boolean);
    if (prioridades.length) descr += " " + prioridades.join(" · ");
    var sello = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    var l = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aleran Vocals//Horario de practica//ES", "CALSCALE:GREGORIAN"];
    d.dias.forEach(function (byday, n) {
      var fecha = primeraFecha(inicio, byday);
      l.push("BEGIN:VEVENT", "UID:aleran-practica-" + byday + "-" + inicio + "@aleran-piano", "DTSTAMP:" + sello,
        "DTSTART:" + cuando(fecha, d.hora, 0), "DTEND:" + cuando(fecha, d.hora, total()),
        "RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=" + byday, "SUMMARY:" + esc("Práctica de canto (" + total() + " min)"),
        "DESCRIPTION:" + esc(descr), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("Práctica de canto"), "TRIGGER:-PT10M", "END:VALARM", "END:VEVENT");
    });
    l.push("END:VCALENDAR");
    // El formato pide líneas de máximo 75 bytes: las largas se parten y la continuación empieza con un espacio.
    var plegado = [];
    l.forEach(function (linea) {
      while (linea.length > 60) { plegado.push(linea.slice(0, 60)); linea = " " + linea.slice(60); }
      plegado.push(linea);
    });
    return plegado.join("\r\n") + "\r\n";
  }
  function descargarIcs() {
    if (!d.dias.length) { el("horEstado").textContent = "Marca al menos un día."; return; }
    var blob = new Blob([generarIcs()], { type: "text/calendar;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "practica-canto.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    el("horEstado").textContent = "Listo: ábrelo para añadirlo a tu calendario.";
  }

  function arrancar() {
    cargar();
    el("horHora").value = d.hora;
    el("horInicio").value = d.inicio || proximoLunes();
    el("horHora").addEventListener("change", function () { d.hora = el("horHora").value || "19:00"; guardar(); });
    el("horInicio").addEventListener("change", function () { d.inicio = el("horInicio").value; guardar(); pintarSemanas(); });
    el("horIcs").addEventListener("click", descargarIcs);
    pintarDias(); pintarSesion(); pintarSemanas();
  }
  window.BetaHorario = { icsDe: function (datos) { d = Object.assign(porDefecto(), datos); return generarIcs(); } }; // para las pruebas
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
