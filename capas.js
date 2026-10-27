/* capas.js — Escucha con las cuatro capas: mecanismo, colocación, adornos y efectos.
 * No analiza el audio: guía la escucha. En cada capa se separa lo que se OYE de lo que GUSTA y de lo que SERVIRÍA.
 * Las opciones salen del método de Áleran (Glosario y Láminas). */
(function () {
  "use strict";
  var CAPAS = [
    { id: "mecanismo", nombre: "Mecanismo", pregunta: "¿Con qué mecanismo suena?", opciones: ["Pecho", "Cabeza", "Mixta", "Fry", "Silbido"] },
    { id: "colocacion", nombre: "Colocación", pregunta: "¿Qué color tiene?", opciones: ["Al frente", "Twang", "Cubierta", "Central", "Engolada"] },
    { id: "adornos", nombre: "Adornos", pregunta: "¿Qué adornos oyes?", opciones: ["Vibrato", "Apoyatura", "Melisma", "Trémolo", "Mordente", "Glissando", "Inflexión", "Ninguno"] },
    { id: "efectos", nombre: "Efectos", pregunta: "¿Hay algún efecto?", opciones: ["Distorsión", "Raspada", "Crack / flip", "Aireada", "Fry", "Ninguno"] },
  ];
  var estado;
  var abierta;

  function nuevo() {
    estado = {};
    CAPAS.forEach(function (c) { estado[c.id] = { oigo: [], gusta: false, serviria: false }; });
    abierta = 0;
  }
  function el(id) { return document.getElementById(id); }

  function chip(texto, activo, alClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (activo ? " activo" : "");
    b.textContent = texto;
    b.addEventListener("click", alClick);
    return b;
  }

  function pintar() {
    var cont = el("capasLista");
    cont.textContent = "";
    CAPAS.forEach(function (c, i) {
      if (i > abierta) return;
      var caja = document.createElement("div");
      caja.className = "capa" + (i < abierta ? " cerrada" : "");
      var h = document.createElement("h3");
      h.textContent = (i + 1) + ". " + c.nombre;
      caja.appendChild(h);
      var q = document.createElement("p");
      q.className = "beta-sub";
      q.textContent = c.pregunta + " (marca las que oigas)";
      caja.appendChild(q);
      var op = document.createElement("div");
      op.className = "beta-fila";
      c.opciones.forEach(function (o) {
        var sel = estado[c.id].oigo.indexOf(o) >= 0;
        op.appendChild(chip(o, sel, function () {
          var lista = estado[c.id].oigo;
          var k = lista.indexOf(o);
          if (o === "Ninguno") { estado[c.id].oigo = k >= 0 ? [] : ["Ninguno"]; }
          else {
            if (k >= 0) lista.splice(k, 1); else { lista.push(o); var n = lista.indexOf("Ninguno"); if (n >= 0) lista.splice(n, 1); }
          }
          pintar();
        }));
      });
      caja.appendChild(op);
      var extra = document.createElement("div");
      extra.className = "beta-fila";
      extra.appendChild(chip("Me gusta", estado[c.id].gusta, function () { estado[c.id].gusta = !estado[c.id].gusta; pintar(); }));
      extra.appendChild(chip("Me serviría", estado[c.id].serviria, function () { estado[c.id].serviria = !estado[c.id].serviria; pintar(); }));
      caja.appendChild(extra);
      if (i === abierta) {
        var sig = document.createElement("button");
        sig.type = "button";
        sig.className = "boton principal";
        sig.textContent = i === CAPAS.length - 1 ? "Ver mi escucha" : "Siguiente capa →";
        sig.addEventListener("click", function () { abierta++; pintar(); });
        var f = document.createElement("div");
        f.className = "acciones";
        f.appendChild(sig);
        caja.appendChild(f);
      }
      cont.appendChild(caja);
    });
    var fin = abierta >= CAPAS.length;
    el("capasResumen").hidden = !fin;
    if (fin) el("capasTexto").textContent = resumen();
  }

  function resumen() {
    var titulo = (window.BetaCapasToma && window.BetaCapasToma.nombre()) || "";
    var l = ["MI ESCUCHA" + (titulo ? " — " + titulo : "")];
    CAPAS.forEach(function (c) {
      var e = estado[c.id];
      var oigo = e.oigo.length ? e.oigo.join(", ") : "sin marcar";
      var extras = [e.gusta ? "me gusta" : "", e.serviria ? "me serviría" : ""].filter(Boolean).join(" · ");
      l.push(c.nombre + ": " + oigo + (extras ? " — " + extras : ""));
    });
    return l.join("\n");
  }

  function descargar() {
    var blob = new Blob([resumen()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "escucha-" + new Date().toISOString().slice(0, 10) + ".txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function arrancar() {
    window.BetaCapasToma = window.BetaToma.montar(el("capasTomaCaja"));
    nuevo();
    pintar();
    el("capasDescargar").addEventListener("click", descargar);
    el("capasCopiar").addEventListener("click", function () {
      var t = resumen();
      var ok = function () { el("capasEstado").textContent = "Copiado."; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { el("capasEstado").textContent = "No pude copiar; usa Descargar."; });
      else el("capasEstado").textContent = "No pude copiar; usa Descargar.";
    });
    el("capasOtra").addEventListener("click", function () { nuevo(); el("capasEstado").textContent = ""; pintar(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
