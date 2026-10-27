/* beta-toma.js — «elige una toma» para Lista de revisión y Escucha con las cuatro capas.
 * Una toma es una grabación de la Grabadora (IndexedDB, solo lectura) o un archivo de audio del propio equipo.
 * Nada se sube a ningún servidor: el audio se reproduce desde un blob local. */
(function () {
  "use strict";
  var DB_NOMBRE = "aleran-piano-grabaciones-v1"; // la misma que grabadora.js
  var ALMACEN = "tomas";

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  // Abrir la base de datos de la Grabadora SIN crearla si no existe: si la creáramos vacía (sin su almacén),
  // la Grabadora ya no podría crear el suyo después. Si hay que crearla, se crea igual que ella.
  function abrirDbGrabadora() {
    return new Promise(function (resolve) {
      if (!window.indexedDB || !indexedDB.databases) return resolve(null);
      indexedDB.databases().then(function (lista) {
        var existe = (lista || []).some(function (d) { return d.name === DB_NOMBRE; });
        if (!existe) return resolve(null);
        var s = indexedDB.open(DB_NOMBRE, 1);
        s.onupgradeneeded = function () {
          var db = s.result;
          if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN, { keyPath: "id", autoIncrement: true });
        };
        s.onsuccess = function () { resolve(s.result); };
        s.onerror = function () { resolve(null); };
      }).catch(function () { resolve(null); });
    });
  }

  function leerTomas() {
    return abrirDbGrabadora().then(function (db) {
      if (!db || !db.objectStoreNames.contains(ALMACEN)) return [];
      return new Promise(function (resolve) {
        var r = db.transaction(ALMACEN, "readonly").objectStore(ALMACEN).getAll();
        r.onsuccess = function () { resolve((r.result || []).slice().reverse()); };
        r.onerror = function () { resolve([]); };
      });
    });
  }

  function fecha(iso) {
    try { return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ""; }
  }

  function montar(cont, alCambiar) {
    cont.textContent = "";
    cont.className = "toma-barra";
    var audio = el("audio");
    audio.controls = true;
    audio.hidden = true;
    var nombre = el("p", "beta-sub", "Sin toma elegida. También puedes seguir sin audio.");
    var fila = el("div", "beta-fila");
    var bMias = el("button", "boton", "Mis grabaciones");
    bMias.type = "button";
    var bArchivo = el("label", "boton", "Abrir un audio");
    var input = el("input");
    input.type = "file";
    input.accept = "audio/*,video/*";
    input.hidden = true;
    bArchivo.appendChild(input);
    fila.append(bMias, bArchivo);
    var lista = el("div", "toma-lista");
    lista.hidden = true;
    cont.append(audio, nombre, fila, lista);

    var urlActual = null;
    var estado = { clave: "sin-toma", nombre: "" };

    function usar(blob, clave, etiqueta) {
      if (urlActual) URL.revokeObjectURL(urlActual);
      urlActual = URL.createObjectURL(blob);
      audio.src = urlActual;
      audio.hidden = false;
      nombre.textContent = etiqueta;
      estado = { clave: clave, nombre: etiqueta };
      lista.hidden = true;
      if (alCambiar) alCambiar(estado);
    }

    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (!f) return;
      usar(f, "archivo-" + f.name + "-" + f.size, f.name);
    });

    bMias.addEventListener("click", function () {
      if (!lista.hidden) { lista.hidden = true; return; }
      lista.textContent = "";
      lista.hidden = false;
      lista.appendChild(el("p", "beta-sub", "Buscando…"));
      leerTomas().then(function (tomas) {
        lista.textContent = "";
        if (!tomas.length) {
          lista.appendChild(el("p", "beta-sub", "Aún no tienes grabaciones. Graba una en Entrena → Grabar."));
          return;
        }
        tomas.forEach(function (t) {
          var b = el("button", "chip", (t.etiqueta || "Toma") + " · " + fecha(t.fecha));
          b.type = "button";
          b.addEventListener("click", function () {
            if (t.blob) usar(t.blob, "toma-" + t.id, (t.etiqueta || "Toma") + " · " + fecha(t.fecha));
          });
          lista.appendChild(b);
        });
      });
    });

    window.addEventListener("pagehide", function () { if (urlActual) URL.revokeObjectURL(urlActual); });
    return { clave: function () { return estado.clave; }, nombre: function () { return estado.nombre; } };
  }

  window.BetaToma = { montar: montar };
})();
