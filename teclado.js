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
let midiManejarNota = null;
let midiEntradaActual = null;

function configurarMidi(manejarClic) {
  midiManejarNota = manejarClic;
  const filaZoom = el("pianoZoom") && el("pianoZoom").closest(".piano-zoom");
  if (!filaZoom) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "boton pequeno midi-boton";
  btn.title = "Conectar un controlador MIDI (teclado físico por USB)";
  btn.textContent = "🎹 MIDI";
  filaZoom.appendChild(btn);

  if (!navigator.requestMIDIAccess) {
    btn.addEventListener("click", () => {
      alert(
        "Este navegador no soporta control MIDI (Web MIDI). Funciona en Chrome o Edge de escritorio, conectando el controlador por USB."
      );
    });
    return;
  }

  btn.addEventListener("click", () => conectarMidi(btn));
  intentarReconectarMidiGuardado(btn);
}

async function conectarMidi(btn) {
  let acceso;
  try {
    acceso = await navigator.requestMIDIAccess();
  } catch {
    alert("No se pudo acceder a MIDI (permiso denegado por el navegador).");
    return;
  }
  const entradas = Array.from(acceso.inputs.values());
  if (entradas.length === 0) {
    alert("No se detectó ningún controlador MIDI conectado por USB.");
    return;
  }
  let elegida = entradas[0];
  if (entradas.length > 1) {
    const lista = entradas.map((e, i) => `${i + 1}. ${e.name}`).join("\n");
    const respuesta = prompt(`Hay varios dispositivos MIDI conectados:\n${lista}\n\nEscribe el número:`, "1");
    const indice = parseInt(respuesta, 10) - 1;
    if (entradas[indice]) elegida = entradas[indice];
  }
  conectarEntradaMidi(elegida, btn);
}

function conectarEntradaMidi(entrada, btn) {
  if (midiEntradaActual) midiEntradaActual.onmidimessage = null;
  midiEntradaActual = entrada;
  entrada.onmidimessage = manejarMensajeMidi;
  try {
    localStorage.setItem(CLAVE_MIDI_DISPOSITIVO, entrada.name);
  } catch {
    /* no pasa nada si no se pudo guardar -- solo tendrá que elegirlo de nuevo */
  }
  if (btn) {
    btn.classList.add("midi-conectado");
    btn.title = `MIDI conectado: ${entrada.name}`;
  }
}

// Si ya se eligió un dispositivo antes, lo reconecta solo (sin volver a
// preguntar) apenas el navegador conceda el permiso -- Chrome lo recuerda
// entre visitas del mismo sitio, así que esto suele quedar instantáneo.
function intentarReconectarMidiGuardado(btn) {
  let nombreGuardado;
  try {
    nombreGuardado = localStorage.getItem(CLAVE_MIDI_DISPOSITIVO);
  } catch {
    nombreGuardado = null;
  }
  if (!nombreGuardado) return;
  navigator
    .requestMIDIAccess()
    .then((acceso) => {
      const entrada = Array.from(acceso.inputs.values()).find((e) => e.name === nombreGuardado);
      if (entrada) conectarEntradaMidi(entrada, btn);
    })
    .catch(() => {
      /* sin permiso concedido todavía: se pedirá al pulsar el botón */
    });
}

// Un mensaje MIDI trae 3 bytes: [estado, nota, velocidad]. El nibble alto del
// estado es el tipo (0x90 = Note On, 0x80 = Note Off); por convención MIDI,
// un Note On con velocidad 0 EQUIVALE a un Note Off (muchos controladores lo
// mandan así). Un Note On toca/escribe; el Note Off suelta la nota (igual que
// soltar el dedo en pantalla), así que un acorde mantenido suena entero.
function manejarMensajeMidi(evento) {
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

/** Aguja de afinación en vivo (como un afinador de guitarra): solo se
 * muestra mientras el micrófono está escuchando algo con un objetivo claro
 * (una nota a cantar, o la referencia de una nota sostenida), no todo el
 * rato. La usan "Cantar y calificar" (piano.js) y "Nota sostenida"
 * (entrenamiento.js). */
function mostrarAfinometro(mostrar) {
  el("afinometro").hidden = !mostrar;
  if (!mostrar) actualizarAfinometro(null);
}

function actualizarAfinometro(cents) {
  const aguja = el("afinometroAguja");
  if (cents === null || cents === undefined) {
    aguja.style.transform = "rotate(0deg)";
    aguja.className = "afinometro-aguja";
    el("afinometroTexto").textContent = "—";
    return;
  }
  const limitado = Math.max(-50, Math.min(50, cents));
  aguja.style.transform = `rotate(${(limitado / 50) * 45}deg)`;
  const abs = Math.abs(cents);
  aguja.className = "afinometro-aguja" + (abs <= 10 ? " centrado" : abs <= 30 ? " cerca" : "");
  el("afinometroTexto").textContent = `${cents > 0 ? "+" : ""}${Math.round(cents)}¢`;
}
