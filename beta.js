/* beta.js — hub «Herramientas beta» y enlace directo por clase del curso.
 * beta.html            -> lista de herramientas.
 * beta.html?clase=C030 -> lleva a la herramienta de esa clase (si hay una sola, directamente). */
(function () {
  "use strict";
  var LISTA = window.HERRAMIENTAS_BETA || [];

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function conClase(href, codigo) {
    // Las herramientas nuevas reciben ?clase= para mostrar de qué clase vienen; las ya existentes lo ignoran.
    var sep = href.indexOf("?") >= 0 ? "&" : "?";
    var partes = href.split("#");
    return partes[0] + sep + "clase=" + codigo + (partes[1] ? "#" + partes[1] : "");
  }

  function pintarHub() {
    var cont = document.getElementById("betaHub");
    if (!cont) return;
    cont.textContent = "";
    LISTA.forEach(function (h) {
      var a = el("a", "hub-tarjeta");
      a.href = h.href;
      a.appendChild(el("span", "hub-icono", h.icono));
      a.appendChild(el("span", "hub-nombre", h.nombre));
      a.appendChild(el("span", "hub-detalle", h.detalle));
      cont.appendChild(a);
    });
  }

  function pintarClase(codigo, datos) {
    var cont = document.getElementById("betaClase");
    if (!cont) return;
    cont.hidden = false;
    cont.textContent = "";
    cont.appendChild(el("h2", "", "Clase " + parseInt(codigo.slice(1), 10) + " · " + datos.titulo));
    if (!datos.herramientas.length) {
      cont.appendChild(el("p", "descripcion", "Esta clase todavía no tiene herramienta en la web. Abajo tienes las demás."));
      return;
    }
    cont.appendChild(el("p", "descripcion", "Para practicar esta clase:"));
    var fila = el("div", "acciones");
    datos.herramientas.forEach(function (h) {
      var a = el("a", "boton principal", h.nombre + " →");
      a.href = conClase(h.href, codigo);
      fila.appendChild(a);
    });
    cont.appendChild(fila);
  }

  function iniciar() {
    pintarHub();
    var codigo = window.BetaComun && window.BetaComun.claseDeLaUrl();
    if (!codigo) return;
    var datos = (window.BETA_CLASES || {})[codigo];
    if (!datos) {
      var cont = document.getElementById("betaClase");
      if (cont) {
        cont.hidden = false;
        cont.textContent = "";
        cont.appendChild(el("p", "descripcion", "No conozco esa clase. Aquí tienes las herramientas."));
      }
      return;
    }
    // Una sola herramienta: se va directo. Si hay varias, se muestran los botones.
    if (datos.herramientas.length === 1) {
      location.replace(conClase(datos.herramientas[0].href, codigo));
      return;
    }
    // Desde la portada (?clase= en index.html) no hay dónde pintar los botones: se pasa al hub.
    if (!document.getElementById("betaClase")) {
      location.replace("beta.html?clase=" + codigo);
      return;
    }
    pintarClase(codigo, datos);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
