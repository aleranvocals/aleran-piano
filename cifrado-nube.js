/*
 * cifrado-nube.js — «Mis canciones»: las canciones de Cifrado guardadas en la cuenta del alumno (Maestro), para tenerlas
 * en cualquier dispositivo. Usa el mismo código de alumno que la sincronización del progreso (la parte final del enlace de
 * su espacio privado); si llega con ?codigo=... (botón del espacio privado) se vincula solo.
 * Las canciones que prepara Áleran con «Audio a Cifrado» aparecen aquí sin que el alumno haga nada.
 */
(function () {
  "use strict";

  const API = "https://maestro.aleranvocals.es/api/mi-clase/cifrados";
  const CLAVE_CODIGO = "aleran-piano-codigo-alumno"; // la misma que usa progreso-compartir.js

  const $ = (id) => document.getElementById(id);
  const lista = $("nubeLista");
  const estado = $("nubeEstado");
  if (!lista || !estado) return;

  let codigo = null;
  try {
    const url = new URL(window.location.href);
    const deUrl = (url.searchParams.get("codigo") || "").trim();
    if (deUrl) {
      localStorage.setItem(CLAVE_CODIGO, deUrl);
      url.searchParams.delete("codigo");
      window.history.replaceState(null, "", url);
    }
    codigo = localStorage.getItem(CLAVE_CODIGO);
  } catch {
    codigo = null;
  }

  function mensaje(texto, malo) {
    estado.textContent = texto;
    estado.style.color = malo ? "var(--crimson-bright)" : "";
  }

  function fechaCorta(iso) {
    try {
      return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  }

  async function pedir(ruta, opciones) {
    const r = await fetch(ruta, opciones);
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(cuerpo.error || "No se pudo conectar con tu cuenta");
    return cuerpo;
  }

  function pintarLista(canciones) {
    lista.textContent = "";
    if (canciones.length === 0) {
      mensaje("Todavía no tienes canciones guardadas. Genera una y pulsa «Guardar en mi cuenta».");
      return;
    }
    mensaje(`${canciones.length} canción${canciones.length === 1 ? "" : "es"} en tu cuenta.`);
    canciones.forEach((c) => {
      const fila = document.createElement("div");
      fila.className = "nube-fila";
      const nombre = document.createElement("span");
      nombre.className = "nube-nombre";
      nombre.textContent = c.titulo;
      const meta = document.createElement("span");
      meta.className = "nube-meta";
      meta.textContent = (c.origen === "aleran" ? "preparada por Áleran · " : "") + fechaCorta(c.actualizadoEn);
      const abrir = document.createElement("button");
      abrir.type = "button";
      abrir.className = "boton";
      abrir.textContent = "Abrir";
      abrir.addEventListener("click", () => abrirCancion(c));
      const borrar = document.createElement("button");
      borrar.type = "button";
      borrar.className = "boton nube-borrar";
      borrar.textContent = "Borrar";
      borrar.setAttribute("aria-label", `Borrar ${c.titulo}`);
      borrar.addEventListener("click", () => borrarCancion(c));
      fila.append(nombre, meta, abrir, borrar);
      lista.appendChild(fila);
    });
  }

  async function cargarLista() {
    if (!codigo) return;
    try {
      const { canciones } = await pedir(`${API}?token=${encodeURIComponent(codigo)}`);
      pintarLista(canciones);
    } catch (e) {
      mensaje(e.message, true);
    }
  }

  async function abrirCancion(c) {
    mensaje(`Abriendo «${c.titulo}»…`);
    try {
      const { datos, titulo } = await pedir(`${API}/${c.id}?token=${encodeURIComponent(codigo)}`);
      if (!Array.isArray(datos.cancion)) throw new Error("La canción guardada no tiene el formato esperado");
      aplicarDatosCancion(datos);
      renderCancion();
      guardarCancionAutoguardado();
      notasCopiadas = null;
      if (typeof actualizarBotonesPegar === "function") actualizarBotonesPegar();
      if (typeof registrarCheckpoint === "function") registrarCheckpoint();
      $("nubeTitulo").value = titulo;
      mensaje(`«${titulo}» abierta. Si la cambias, pulsa «Guardar en mi cuenta» para conservar los cambios.`);
    } catch (e) {
      mensaje(e.message, true);
    }
  }

  async function borrarCancion(c) {
    if (!window.confirm(`¿Borrar «${c.titulo}» de tu cuenta?`)) return;
    try {
      await pedir(`${API}/${c.id}?token=${encodeURIComponent(codigo)}`, { method: "DELETE" });
      await cargarLista();
    } catch (e) {
      mensaje(e.message, true);
    }
  }

  async function guardarCancion() {
    if (!codigo) return;
    if (typeof cancion === "undefined" || cancion.length === 0) {
      mensaje("Primero genera o abre una canción.", true);
      return;
    }
    const titulo = $("nubeTitulo").value.trim();
    if (!titulo) {
      mensaje("Ponle un nombre a la canción para guardarla.", true);
      $("nubeTitulo").focus();
      return;
    }
    const boton = $("btnNubeGuardar");
    boton.disabled = true;
    try {
      await pedir(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: codigo, titulo, datos: datosCancionActual() }),
      });
      await cargarLista();
      mensaje(`«${titulo}» guardada en tu cuenta ✓`);
    } catch (e) {
      mensaje(e.message, true);
    } finally {
      boton.disabled = false;
    }
  }

  function vincular() {
    const valor = $("nubeCodigo").value.trim();
    if (!valor) {
      mensaje("Escribe tu código primero.", true);
      return;
    }
    codigo = valor;
    try {
      localStorage.setItem(CLAVE_CODIGO, codigo);
    } catch {
      /* sin almacenamiento: funciona en esta sesión */
    }
    mostrarVinculado();
    cargarLista();
  }

  function mostrarVinculado() {
    $("nubeSinCodigo").hidden = Boolean(codigo);
    $("nubeConCodigo").hidden = !codigo;
  }

  $("btnNubeVincular").addEventListener("click", vincular);
  $("btnNubeGuardar").addEventListener("click", guardarCancion);
  $("btnNubeDesvincular").addEventListener("click", () => {
    try {
      localStorage.removeItem(CLAVE_CODIGO);
    } catch {
      /* nada */
    }
    codigo = null;
    lista.textContent = "";
    mostrarVinculado();
    mensaje("");
  });

  mostrarVinculado();
  cargarLista(); // al abrir la página se precarga la lista de canciones de la cuenta
})();
