/* revision.js — Lista de revisión: cinco preguntas sobre una toma, cada una revisado / pendiente / no procede.
 * Solo interfaz. Se guarda en este navegador, por toma. Se puede descargar como texto. */
(function () {
  "use strict";
  var PREGUNTAS = [
    "¿Qué mensaje entiendo?",
    "¿Cuál es la referencia de las notas?",
    "¿Empieza y termina a tiempo?",
    "¿Se entiende la palabra importante?",
    "¿Cómo fue cantarlo?",
  ];
  var ESTADOS = [["revisado", "Revisado"], ["pendiente", "Pendiente"], ["noprocede", "No procede"]];
  var PREFIJO = "aleran-beta-revision-";
  var toma = null;
  var datos = vacio();

  function vacio() { return { filas: PREGUNTAS.map(function () { return { estado: "", nota: "" }; }), conservo: "", pendiente: "", siguiente: "" }; }
  function el(id) { return document.getElementById(id); }
  function clave() { return PREFIJO + (toma ? toma.clave() : "sin-toma"); }

  function guardar() { try { localStorage.setItem(clave(), JSON.stringify(datos)); } catch (e) { /* sin almacenamiento */ } }
  function cargar() {
    try {
      var d = JSON.parse(localStorage.getItem(clave()) || "null");
      datos = d && Array.isArray(d.filas) && d.filas.length === PREGUNTAS.length ? d : vacio();
    } catch (e) { datos = vacio(); }
  }

  function pintar() {
    var cont = el("revFilas");
    cont.textContent = "";
    PREGUNTAS.forEach(function (texto, i) {
      var fila = document.createElement("div");
      fila.className = "fila-revision";
      var t = document.createElement("strong");
      t.textContent = (i + 1) + ". " + texto;
      fila.appendChild(t);
      var botones = document.createElement("div");
      botones.className = "beta-fila";
      ESTADOS.forEach(function (par) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (datos.filas[i].estado === par[0] ? " activo" : "");
        b.textContent = par[1];
        b.addEventListener("click", function () {
          datos.filas[i].estado = datos.filas[i].estado === par[0] ? "" : par[0];
          guardar();
          pintar();
        });
        botones.appendChild(b);
      });
      fila.appendChild(botones);
      var nota = document.createElement("input");
      nota.type = "text";
      nota.placeholder = "Nota corta (opcional)";
      nota.maxLength = 160;
      nota.value = datos.filas[i].nota;
      nota.addEventListener("input", function () { datos.filas[i].nota = nota.value; guardar(); });
      fila.appendChild(nota);
      cont.appendChild(fila);
    });
    el("revConservo").value = datos.conservo;
    el("revPendiente").value = datos.pendiente;
    el("revSiguiente").value = datos.siguiente;
  }

  function texto() {
    var l = ["LISTA DE REVISIÓN" + (toma && toma.nombre() ? " — " + toma.nombre() : ""), ""];
    PREGUNTAS.forEach(function (p, i) {
      var f = datos.filas[i];
      var est = (ESTADOS.filter(function (e) { return e[0] === f.estado; })[0] || ["", "sin marcar"])[1];
      l.push((i + 1) + ". " + p + " — " + est + (f.nota ? " · " + f.nota : ""));
    });
    l.push("", "Conservo: " + datos.conservo, "Queda pendiente: " + datos.pendiente, "Mi siguiente acción: " + datos.siguiente);
    return l.join("\n");
  }

  function descargar() {
    var blob = new Blob([texto()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "revision-" + new Date().toISOString().slice(0, 10) + ".txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    el("revEstado").textContent = "Descargada.";
  }

  function arrancar() {
    toma = window.BetaToma.montar(el("revTomaCaja"), function () { cargar(); pintar(); });
    cargar();
    pintar();
    ["revConservo:conservo", "revPendiente:pendiente", "revSiguiente:siguiente"].forEach(function (par) {
      var p = par.split(":");
      el(p[0]).addEventListener("input", function () { datos[p[1]] = el(p[0]).value; guardar(); });
    });
    el("revDescargar").addEventListener("click", descargar);
    el("revLimpiar").addEventListener("click", function () { datos = vacio(); guardar(); pintar(); el("revEstado").textContent = ""; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
