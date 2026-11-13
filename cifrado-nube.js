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
  // ?codigo=... ya no se vincula solo: antes se pide confirmación en la propia página (un enlace ajeno no debe
  // cambiar en silencio a qué cuenta se guardan tus canciones y tu progreso).
  let codigoPendiente = null;
  try {
    codigo = localStorage.getItem(CLAVE_CODIGO);
  } catch {
    codigo = null;
  }
  try {
    const url = new URL(window.location.href);
    const deUrl = (url.searchParams.get("codigo") || "").trim();
    if (deUrl) {
      url.searchParams.delete("codigo");
      window.history.replaceState(null, "", url);
      if (deUrl !== codigo) codigoPendiente = deUrl.slice(0, 200);
    }
  } catch {
    /* sin URL utilizable: se queda como estaba */
  }

  // Solo se enseña el final del código: basta para reconocerlo sin dejarlo entero a la vista.
  function codigoCorto(c) {
    const s = String(c || "");
    return s.length > 6 ? `…${s.slice(-6)}` : s;
  }

  function guardarCodigo(valor) {
    codigo = valor;
    try {
      localStorage.setItem(CLAVE_CODIGO, codigo);
    } catch {
      /* sin almacenamiento: funciona en esta sesión */
    }
  }

  function pedirConfirmacionCodigo(nuevo) {
    const fondo = document.createElement("div");
    fondo.className = "hoja-fondo";
    const caja = document.createElement("div");
    caja.className = "hoja nube-confirmar";
    caja.setAttribute("role", "dialog");
    caja.setAttribute("aria-modal", "true");
    caja.setAttribute("aria-label", "Vincular tu cuenta");
    const h = document.createElement("h2");
    h.textContent = "¿Vincular tu cuenta?";
    const texto = document.createElement("p");
    texto.className = "hoja-texto";
    texto.textContent = `Tus canciones de Cifrado y tu progreso se guardarán en la cuenta con código ${codigoCorto(nuevo)}.`;
    const cuenta = document.createElement("p");
    cuenta.className = "nube-confirmar-cuenta";
    cuenta.textContent = "Comprobando la cuenta…";
    caja.append(h, texto, cuenta);
    if (codigo && codigo !== nuevo) {
      const aviso = document.createElement("p");
      aviso.className = "nube-confirmar-aviso";
      aviso.textContent = `Ahora está vinculada otra cuenta (${codigoCorto(codigo)}). Si sigues, se cambia por esta.`;
      caja.appendChild(aviso);
    }
    const botones = document.createElement("div");
    botones.className = "nube-confirmar-botones";
    const no = document.createElement("button");
    no.type = "button";
    no.className = "boton";
    no.textContent = "Ahora no";
    const si = document.createElement("button");
    si.type = "button";
    si.className = "boton principal";
    si.textContent = "Vincular";
    botones.append(no, si);
    caja.appendChild(botones);
    fondo.appendChild(caja);
    document.body.appendChild(fondo);
    si.focus();

    const cerrar = () => {
      fondo.remove();
      document.removeEventListener("keydown", alTeclear);
    };
    const alTeclear = (e) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alTeclear);
    no.addEventListener("click", cerrar);
    fondo.addEventListener("click", (e) => {
      if (e.target === fondo) cerrar();
    });
    si.addEventListener("click", () => {
      cerrar();
      guardarCodigo(nuevo);
      mostrarVinculado();
      cargarLista();
    });

    // Dato de la cuenta, si lo hay: que el código existe y cuántas canciones tiene.
    pedir(`${API}?token=${encodeURIComponent(nuevo)}`)
      .then(({ canciones }) => {
        const n = Array.isArray(canciones) ? canciones.length : 0;
        cuenta.textContent = `Cuenta encontrada ✓ · ${n} canción${n === 1 ? "" : "es"} guardada${n === 1 ? "" : "s"}`;
        cuenta.classList.add("ok");
      })
      .catch((e) => {
        cuenta.textContent = e instanceof TypeError ? "No pude comprobar la cuenta ahora (¿sin conexión?)." : `${e.message}.`;
        cuenta.classList.add("malo");
      });
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
    guardarCodigo(valor);
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
  if (codigoPendiente) pedirConfirmacionCodigo(codigoPendiente);
  cargarLista(); // al abrir la página se precarga la lista de canciones de la cuenta
})();
