/*
 * teclado.js — el teclado de piano visual, el zoom, el desplazamiento
 * (rueda/slider) y la aguja de afinación en vivo (afinómetro). Compartido
 * por todas las páginas que lo necesitan: piano.html, entrenamiento.html,
 * oido.html y rutina.html. No depende de ninguna página en concreto: cada
 * una le pasa su propio callback para decidir qué hacer al tocar una tecla.
 */

let anchoBlanca = 34;
let anchoNegra = 20;
const ES_NEGRA = new Set([1, 3, 6, 8, 10]); // Do#, Re#, Fa#, Sol#, La#

/** Reconstruye solo las teclas (llamado también al cambiar el zoom). El
 * listener de clic se engancha una única vez en inicializarPiano(), por
 * delegación en el contenedor, así que sobrevive a estas reconstrucciones. */
function construirTeclasPiano() {
  const contenedor = el("piano");
  contenedor.innerHTML = "";
  contenedor.style.setProperty("--tecla-fuente", `${Math.max(7, Math.round(anchoBlanca * 0.32))}px`);
  // Aparte de --tecla-fuente (pensado para el ancho de una tecla BLANCA): las
  // negras necesitan su propio tamaño, calculado de SU propio ancho real, no
  // del de la blanca -- si no, un nombre largo como "Sol#1"/"Sol♭1" no cabe
  // y se sale de la tecla. (anchoNegra-2)/2.9 es, a ojo, lo más grande que
  // cabe un nombre de 5 caracteres en negrita sin desbordar.
  contenedor.style.setProperty("--tecla-fuente-negra", `${Math.max(5, Math.round((anchoNegra - 2) / 2.9))}px`);
  contenedor.classList.toggle("estrecho", anchoNegra < 16);

  const crearEtiqueta = (midi) => {
    const etiqueta = document.createElement("span");
    etiqueta.className = "tecla-etiqueta";
    // Una tecla negra tiene dos nombres (Fa#2 = Solb2, según de dónde venga el
    // alumno) -- se muestran las dos, sostenido arriba y bemol debajo, en vez
    // de forzar uno solo. Una tecla blanca es siempre natural: un nombre basta.
    const nombreBemol = midiANombreBemol(midi);
    if (nombreBemol) {
      const lineaSostenido = document.createElement("span");
      lineaSostenido.className = "tecla-etiqueta-linea";
      lineaSostenido.textContent = midiANombre(midi);
      const lineaBemol = document.createElement("span");
      lineaBemol.className = "tecla-etiqueta-linea tecla-etiqueta-bemol";
      lineaBemol.textContent = nombreBemol.replace("b", "♭"); // "Solb2" -> "Sol♭2"
      etiqueta.append(lineaSostenido, lineaBemol);
    } else {
      etiqueta.textContent = midiANombre(midi);
    }
    return etiqueta;
  };

  const blancas = [];
  for (let midi = DO1_MIDI; midi <= DO7_MIDI; midi++) {
    if (!ES_NEGRA.has(((midi % 12) + 12) % 12)) blancas.push(midi);
  }
  blancas.forEach((midi, i) => {
    const tecla = document.createElement("div");
    tecla.className = "tecla blanca";
    tecla.dataset.midi = String(midi);
    tecla.style.left = `${i * anchoBlanca}px`;
    tecla.style.width = `${anchoBlanca}px`;
    tecla.appendChild(crearEtiqueta(midi));
    contenedor.appendChild(tecla);
  });

  for (let midi = DO1_MIDI; midi <= DO7_MIDI; midi++) {
    const semitono = ((midi % 12) + 12) % 12;
    if (!ES_NEGRA.has(semitono)) continue;
    const indiceBlancaAnterior = blancas.filter((m) => m < midi).length - 1;
    const tecla = document.createElement("div");
    tecla.className = "tecla negra";
    tecla.dataset.midi = String(midi);
    tecla.style.left = `${(indiceBlancaAnterior + 1) * anchoBlanca - anchoNegra / 2}px`;
    tecla.style.width = `${anchoNegra}px`;
    tecla.appendChild(crearEtiqueta(midi));
    contenedor.appendChild(tecla);
  }

  contenedor.style.width = `${blancas.length * anchoBlanca}px`;
}

/** Al tocar una tecla sin más contexto (páginas que no necesitan decidir
 * nada especial), simplemente se previsualiza la nota. */
// Teclas que ahora mismo están pulsadas por un dedo/ratón/MIDI (se llenan en
// el listener de abajo y en manejarMensajeMidi, y se vacían al soltar).
const teclasSostenidas = new Set();

// Cada tecla es una nota libre e independiente (ver iniciarNotaLibre en
// audio.js): tocar una no corta las demás, así se pueden pulsar varias a la
// vez. Si la tecla sigue pulsada la nota se sostiene; si no hay un "soltar"
// detrás (p. ej. un clic hecho con el teclado), se suelta enseguida.
function previsualizarNotaPiano(midi) {
  if (!window.PianoEngine) return;
  const volumen = parseFloat(el("volumen") ? el("volumen").value : "0.85") || 0.85;
  const sostenida = teclasSostenidas.has(midi);
  // Primero se inicia y luego se marca: si esta misma tecla ya sonaba, el
  // "cortar" de la anterior apaga la marca, y así la nueva queda encendida.
  window.PianoEngine.iniciarNotaLibre(midi, volumen, () => marcarTeclaActiva(midi, false));
  marcarTeclaActiva(midi, true);
  if (!sostenida) window.PianoEngine.soltarNotaLibre(midi);
}

function soltarNotaPiano(midi) {
  teclasSostenidas.delete(midi);
  if (window.PianoEngine) window.PianoEngine.soltarNotaLibre(midi);
}

/** `manejarClic(midi)` es opcional: si no se indica, tocar una tecla solo
 * la previsualiza. Cada página que necesita un comportamiento distinto
 * (elegir nota, responder un quiz...) pasa su propio callback. */
function inicializarPiano(manejarClic) {
  construirTeclasPiano();
  // Precarga las muestras cuando el navegador esté ocioso (no compite con el
  // dibujado de la página) para que la primera tecla suene sin esperar.
  const precargar = () => {
    if (window.PianoEngine && window.PianoEngine.precargarPiano) window.PianoEngine.precargarPiano();
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(precargar, { timeout: 2500 });
  else setTimeout(precargar, 1200);
  const clic = manejarClic || previsualizarNotaPiano;

  // pointerdown (no click): cada dedo es un puntero distinto, así que con dos
  // pulgares (o dos dedos) suenan las dos teclas a la vez -- "click" no se
  // dispara para toques simultáneos. Además responde en cuanto se toca, sin
  // esperar a soltar. El "soltar" se escucha en window para que funcione
  // aunque el dedo/ratón termine fuera de la tecla.
  const teclasPorPuntero = new Map(); // pointerId -> midi
  el("piano").addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const tecla = e.target.closest(".tecla");
    if (!tecla) return;
    const midi = parseInt(tecla.dataset.midi, 10);
    teclasPorPuntero.set(e.pointerId, midi);
    teclasSostenidas.add(midi);
    clic(midi);
  });
  const soltarPuntero = (e) => {
    const midi = teclasPorPuntero.get(e.pointerId);
    if (midi === undefined) return;
    teclasPorPuntero.delete(e.pointerId);
    soltarNotaPiano(midi);
  };
  window.addEventListener("pointerup", soltarPuntero);
  window.addEventListener("pointercancel", soltarPuntero);
  // Un clic que NO viene de un puntero (detail === 0: activar con el teclado,
  // o un .click() programático) no pasa por pointerdown -- se atiende aquí.
  el("piano").addEventListener("click", (e) => {
    if (e.detail !== 0) return;
    const tecla = e.target.closest(".tecla");
    if (!tecla) return;
    clic(parseInt(tecla.dataset.midi, 10));
  });

  // El teclado va de Do1 a Do7, pero arrancar mostrando el extremo mas grave
  // (Do1) no le sirve a casi nadie -- se abre ya centrado en Do3-Do5, el
  // rango donde canta la mayoria, en vez de obligar a desplazarse a mano
  // cada vez que se abre la pagina. Tiene que ir ANTES de
  // configurarDesplazamientoPiano() para que el slider de abajo nazca ya
  // sincronizado con este scroll inicial, no con el 0 por defecto.
  const teclaDo3 = el("piano").querySelector('[data-midi="48"]');
  if (teclaDo3) el("pianoContenedor").scrollLeft = teclaDo3.offsetLeft;

  configurarDesplazamientoPiano();
  configurarZoomPiano();
  configurarMidi(clic);
}

/* ============================================================
   Control MIDI (opcional) -- un controlador físico por USB (pensado para
   el Arturia Keylab 61 de Áleran, pero sirve cualquiera) toca las mismas
   teclas que el ratón. Web MIDI solo existe en Chrome/Edge de escritorio
   (no en Safari ni en la mayoría de navegadores móviles), así que el botón
   avisa con claridad en vez de fallar en silencio si no está disponible.
   ============================================================ */

const CLAVE_MIDI_DISPOSITIVO = "aleran-piano-midi-dispositivo";
const CLAVE_MIDI_ACTIVO = "aleran-piano-midi-activo";

function pintarBotonMidi(btn, activo, nombre) {
  if (!btn) return;
  btn.classList.toggle("midi-conectado", activo);
  btn.classList.toggle("activo", activo);
  const texto = btn.querySelector(".midi-texto");
  if (texto) texto.textContent = activo ? "MIDI activo" : "MIDI apagado";
  btn.title = activo ? `MIDI activo: ${nombre}. Toca para apagarlo.` : "Activar el controlador MIDI";
}

function desconectarMidi(btn) {
  midiEntradas.forEach((e) => (e.onmidimessage = null));
  midiEntradas = [];
  try {
    localStorage.setItem(CLAVE_MIDI_ACTIVO, "0");
  } catch {
    /* sin consecuencias */
  }
  pintarBotonMidi(btn, false);
}
let midiManejarNota = null;
let midiEntradas = []; // todas las entradas MIDI activas (un teclado suele exponer 2 puertos)

function configurarMidi(manejarClic) {
  midiManejarNota = manejarClic;
  const filaZoom = el("pianoZoom") && el("pianoZoom").closest(".piano-zoom");
  if (!filaZoom) return;

  // El interruptor vive en la barra de herramientas de arriba (siempre a mano); si no existe, en la fila del zoom.
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chip-dock midi-boton";
  btn.title = "Activar o desactivar el controlador MIDI";
  btn.innerHTML = '<span class="punto"></span><span class="midi-texto">MIDI apagado</span>';
  const dock = document.getElementById("dockHerramientas");
  (dock || filaZoom).appendChild(btn);

  if (!navigator.requestMIDIAccess) {
    btn.addEventListener("click", () => {
      alert(
        "Este navegador no soporta control MIDI (Web MIDI). Funciona en Chrome o Edge de escritorio, conectando el controlador por USB."
      );
    });
    return;
  }

  // Encender y apagar: apagado, el piano ignora el controlador por completo (y no se vuelve a conectar solo).
  btn.addEventListener("click", () => {
    if (midiEntradas.length > 0) desconectarMidi(btn);
    else conectarMidi(btn);
  });
  intentarReconectarMidiGuardado(btn);
}

const AYUDA_MIDI_BLOQUEADO =
  "El navegador tiene bloqueado el acceso a MIDI para este sitio.\n\n" +
  "Para permitirlo: pulsa el icono a la izquierda de la dirección (candado o ajustes) → Configuración del sitio → " +
  "Dispositivos MIDI → Permitir, y recarga la página.\n\n" +
  "Si no aparece ahí, abre chrome://settings/content/midiDevices (o edge://settings/content/midiDevices) y quita este sitio de \"No permitido\".";

async function estadoPermisoMidi() {
  try {
    return (await navigator.permissions.query({ name: "midi" })).state; // "granted" | "prompt" | "denied"
  } catch {
    return "desconocido";
  }
}

async function conectarMidi(btn) {
  // Si el navegador ya lo tiene bloqueado ni siquiera sale el aviso de permiso:
  // se explica cómo desbloquearlo en vez de intentarlo y fallar.
  if ((await estadoPermisoMidi()) === "denied") {
    alert(AYUDA_MIDI_BLOQUEADO);
    return;
  }
  let acceso;
  try {
    acceso = await navigator.requestMIDIAccess();
  } catch (err) {
    const nombre = err && err.name ? err.name : "";
    if (nombre === "SecurityError" || nombre === "NotAllowedError") {
      alert(AYUDA_MIDI_BLOQUEADO);
    } else {
      alert(`No se pudo acceder a MIDI (${nombre || "error desconocido"}${err && err.message ? `: ${err.message}` : ""}).`);
    }
    return;
  }
  const entradas = Array.from(acceso.inputs.values());
  if (entradas.length === 0) {
    alert("No se detectó ningún controlador MIDI conectado por USB.");
    return;
  }
  // Se activan todas las entradas: un mismo teclado suele mostrarse como dos puertos y así nunca hay que elegir.
  conectarEntradasMidi(entradas, btn);
}

function conectarEntradasMidi(entradas, btn) {
  midiEntradas.forEach((e) => (e.onmidimessage = null));
  midiEntradas = entradas;
  entradas.forEach((e) => (e.onmidimessage = manejarMensajeMidi));
  try {
    localStorage.setItem(CLAVE_MIDI_DISPOSITIVO, entradas.map((e) => e.name).join("|"));
    localStorage.setItem(CLAVE_MIDI_ACTIVO, "1");
  } catch {
    /* no pasa nada si no se pudo guardar */
  }
  pintarBotonMidi(btn, true, entradas[0].name);
}

// Si ya se eligió un dispositivo antes, lo reconecta solo (sin volver a
// preguntar) apenas el navegador conceda el permiso -- Chrome lo recuerda
// entre visitas del mismo sitio, así que esto suele quedar instantáneo.
function intentarReconectarMidiGuardado(btn) {
  let nombreGuardado;
  let activo = true;
  try {
    nombreGuardado = localStorage.getItem(CLAVE_MIDI_DISPOSITIVO);
    activo = localStorage.getItem(CLAVE_MIDI_ACTIVO) !== "0"; // apagado a mano = no se vuelve a encender solo
  } catch {
    nombreGuardado = null;
  }
  if (!nombreGuardado || !activo) return;
  // Solo se reconecta solo si el permiso YA está concedido. Pedirlo al cargar
  // la página, sin que nadie haya tocado nada, hace que el navegador muestre
  // un aviso que casi todos ignoran -- y tras varias veces ignorado Chrome lo
  // bloquea solo para el sitio (de ahí el "permiso denegado" al pulsar el botón).
  estadoPermisoMidi().then((estado) => {
    if (estado !== "granted") return;
    navigator
      .requestMIDIAccess()
      .then((acceso) => {
        const entradas = Array.from(acceso.inputs.values());
        if (entradas.length > 0) conectarEntradasMidi(entradas, btn);
      })
      .catch(() => {
        /* se pedirá al pulsar el botón */
      });
  });
}

// Un mensaje MIDI trae 3 bytes: [estado, nota, velocidad]. El nibble alto del
// estado es el tipo (0x90 = Note On, 0x80 = Note Off); por convención MIDI,
// un Note On con velocidad 0 EQUIVALE a un Note Off (muchos controladores lo
// mandan así). Un Note On toca/escribe; el Note Off suelta la nota (igual que
// soltar el dedo en pantalla), así que un acorde mantenido suena entero.
function manejarMensajeMidi(evento) {
  // Con la pestaña en segundo plano el controlador se usa para otra cosa: que no suene el piano.
  if (document.hidden) return;
  const [estado, notaMidi, velocidad] = evento.data;
  const tipo = estado & 0xf0;
  if (tipo === 0x90 && velocidad > 0) {
    teclasSostenidas.add(notaMidi);
    if (midiManejarNota) midiManejarNota(notaMidi);
  } else if (tipo === 0x80 || (tipo === 0x90 && velocidad === 0)) {
    soltarNotaPiano(notaMidi);
  }
}

function configurarZoomPiano() {
  const zoomSlider = el("pianoZoom");
  zoomSlider.addEventListener("input", () => {
    anchoBlanca = parseInt(zoomSlider.value, 10);
    anchoNegra = Math.round(anchoBlanca * 0.58);
    construirTeclasPiano();
    if (typeof actualizarNotaSeleccionadaUI === "function") actualizarNotaSeleccionadaUI();
    el("pianoContenedor").dispatchEvent(new Event("scroll")); // recalcula límites del slider de desplazamiento
  });
}

/** Rueda del ratón (desktop) y slider (táctil/móvil) para mover el teclado,
 * que es más ancho que la pantalla. */
function configurarDesplazamientoPiano() {
  const contenedor = el("pianoContenedor");
  const slider = el("pianoDesplazamiento");

  contenedor.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      contenedor.scrollLeft += e.deltaY;
    },
    { passive: false }
  );

  const sincronizarSliderDesdeScroll = () => {
    const maximo = Math.max(1, Math.round(contenedor.scrollWidth - contenedor.clientWidth));
    slider.max = String(maximo);
    slider.value = String(Math.round(contenedor.scrollLeft));
  };

  contenedor.addEventListener("scroll", sincronizarSliderDesdeScroll);
  slider.addEventListener("input", () => {
    contenedor.scrollLeft = parseInt(slider.value, 10);
  });
  window.addEventListener("resize", sincronizarSliderDesdeScroll);
  sincronizarSliderDesdeScroll();
}

function marcarTeclaActiva(midi, activa) {
  const tecla = el("piano").querySelector(`[data-midi="${midi}"]`);
  if (!tecla) return;
  tecla.classList.toggle("activa", activa);
  if (activa) desplazarTeclaAlaVista(tecla);
}

// Si la nota queda fuera de la parte visible del teclado (saltos grandes, p.
// ej. de Re5 a La1) la desplazamos hasta ella -- solo el scroll HORIZONTAL
// del propio teclado, nunca el de la página. scrollIntoView() se probó antes
// aquí, pero también mueve el scroll vertical de la página entera para
// mantener la tecla a la vista, secuestrando el scroll del usuario mientras
// suena una secuencia (le impedía bajar a pulsar "Detener").
function desplazarTeclaAlaVista(tecla) {
  const contenedor = el("pianoContenedor");
  const cRect = contenedor.getBoundingClientRect();
  const tRect = tecla.getBoundingClientRect();
  if (tRect.left < cRect.left) {
    contenedor.scrollBy({ left: tRect.left - cRect.left, behavior: "smooth" });
  } else if (tRect.right > cRect.right) {
    contenedor.scrollBy({ left: tRect.right - cRect.right, behavior: "smooth" });
  }
}

function limpiarTeclasActivas() {
  el("piano")
    .querySelectorAll(".activa")
    .forEach((t) => t.classList.remove("activa"));
}

/** Afinómetro: un arco de bloques (rojo en los bordes, verde en el centro) que se enciende donde estás y te
 * dice «¡Bien!», «¡Casi! Sube un poquito» o «Baja…». Solo se muestra mientras el micrófono escucha con un objetivo
 * claro. Lo usan "Cantar y calificar", "Escucha e imita" (piano.js), "Nota sostenida" y "Sirena" (entrenamiento.js).
 * La lectura se suaviza (mediana + media) y el bloque solo cambia con histéresis: no «baila». */
const AFI_SEGMENTOS = 11;
const AFI_CENTRO = 5;
const AFI_CENTS_POR_SEGMENTO = 9;
let afiIdx = AFI_CENTRO;
let afiSuave = null;
let afiHistorial = [];
let afiUltimaLecturaMs = 0;

function construirAfinometro() {
  const cont = el("afinometro");
  if (!cont || cont.dataset.listo === "1") return;
  cont.dataset.listo = "1";
  cont.classList.add("afinometro-grande");
  cont.innerHTML = "";
  const arco = document.createElement("div");
  arco.className = "afi-arco";
  arco.setAttribute("aria-hidden", "true");
  for (let i = 0; i < AFI_SEGMENTOS; i++) {
    const s = document.createElement("span");
    const d = Math.abs(i - AFI_CENTRO);
    s.className = "afi-seg";
    s.dataset.zona = d <= 1 ? "verde" : d <= 3 ? "ambar" : "rojo";
    s.style.setProperty("--ang", `${-78 + (i / (AFI_SEGMENTOS - 1)) * 156}deg`);
    arco.appendChild(s);
  }
  const bemol = document.createElement("span");
  bemol.className = "afi-signo afi-bemol";
  bemol.textContent = "♭";
  const sost = document.createElement("span");
  sost.className = "afi-signo afi-sost";
  sost.textContent = "♯";
  arco.append(bemol, sost);
  const msg = document.createElement("div");
  msg.className = "afi-mensaje";
  msg.id = "afinometroMensaje";
  msg.setAttribute("role", "status");
  msg.setAttribute("aria-live", "polite");
  const det = document.createElement("div");
  det.className = "afinometro-texto";
  det.id = "afinometroTexto";
  cont.append(arco, msg, det);
}

function mostrarAfinometro(mostrar) {
  construirAfinometro();
  const cont = el("afinometro");
  if (!cont) return;
  cont.hidden = !mostrar;
  afiUltimaLecturaMs = 0; // empieza de cero: sin arrastrar la lectura anterior
  if (!mostrar) actualizarAfinometro(null);
  else actualizarAfinometro(null);
}

/** `cents`: cuánto te desvías del objetivo (negativo = grave, positivo = agudo), o null si no hay voz. */
function actualizarAfinometro(cents) {
  construirAfinometro();
  const cont = el("afinometro");
  if (!cont) return;
  const segs = cont.querySelectorAll(".afi-seg");
  const msg = el("afinometroMensaje");
  const det = el("afinometroTexto");
  const ahora = performance.now();
  if (cents === null || cents === undefined) {
    // Un respiro: la voz tiene huecos entre sílabas y el medidor no debe parpadear con cada uno.
    if (afiSuave !== null && afiUltimaLecturaMs && ahora - afiUltimaLecturaMs < 350) return;
    afiSuave = null;
    afiHistorial = [];
    afiIdx = AFI_CENTRO;
    segs.forEach((s) => s.classList.remove("activo"));
    cont.dataset.nivel = "";
    msg.textContent = "Escuchando…";
    det.textContent = "—";
    return;
  }
  afiUltimaLecturaMs = ahora;
  afiHistorial.push(cents);
  if (afiHistorial.length > 5) afiHistorial.shift();
  const orden = afiHistorial.slice().sort((a, b) => a - b);
  const mediana = orden[Math.floor(orden.length / 2)];
  afiSuave = afiSuave === null ? mediana : afiSuave + 0.3 * (mediana - afiSuave);
  const c = afiSuave;
  // Otra octava: se avisa aparte y el arco muestra solo el resto.
  const octavas = Math.abs(c) > 600 ? Math.round(c / 1200) : 0;
  const resto = c - 1200 * octavas;
  const crudo = AFI_CENTRO + resto / AFI_CENTS_POR_SEGMENTO;
  if (Math.abs(crudo - afiIdx) > 0.65) afiIdx = Math.max(0, Math.min(AFI_SEGMENTOS - 1, Math.round(crudo)));
  segs.forEach((s, i) => s.classList.toggle("activo", i === afiIdx));
  const d = Math.abs(afiIdx - AFI_CENTRO);
  let nivel;
  let texto;
  if (octavas !== 0) {
    nivel = "lejos";
    texto = `Estás ${Math.abs(octavas) === 1 ? "una octava" : Math.abs(octavas) + " octavas"} ${octavas > 0 ? "más arriba" : "más abajo"}`;
  } else if (d <= 1) {
    nivel = "bien";
    texto = "¡Bien!";
  } else if (d <= 3) {
    nivel = "casi";
    texto = resto < 0 ? "¡Casi! Sube un poquito ↑" : "¡Casi! Baja un poquito ↓";
  } else {
    nivel = "lejos";
    texto = Math.abs(resto) > 70 ? (resto < 0 ? "Sube más ↑↑" : "Baja más ↓↓") : resto < 0 ? "Sube ↑" : "Baja ↓";
  }
  cont.dataset.nivel = nivel;
  msg.textContent = texto;
  det.textContent = `${resto > 0 ? "+" : ""}${Math.round(resto)} cents`;
}


/* Lo que queda fuera de tu rango vocal (el que eliges en la barra de arriba) se atenúa en el teclado. */
function aplicarRangoEnTeclado() {
  const cont = document.getElementById("piano");
  if (!cont || !window.RangoVocal) return;
  const r = window.RangoVocal.obtener();
  const sinFiltro = !r.elegido || r.clave === "completo";
  cont.querySelectorAll(".tecla").forEach((t) => {
    const midi = parseInt(t.dataset.midi, 10);
    t.classList.toggle("fuera-rango", !sinFiltro && (midi < r.midiMin || midi > r.midiMax));
  });
}
window.addEventListener("rango-vocal-cambio", aplicarRangoEnTeclado);
document.addEventListener("DOMContentLoaded", () => setTimeout(aplicarRangoEnTeclado, 0));
// El teclado se reconstruye al cambiar el zoom: reaplicar el rango tras ese cambio.
document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "pianoZoom") setTimeout(aplicarRangoEnTeclado, 0);
});
