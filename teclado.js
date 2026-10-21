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

/** Afinador visual (22/10/2026, pedido de Áleran: «más gráfico, con afinador» y tolerancia de ±10 cents).
 * Dial con aguja de −50 a +50 cents (franja verde = ±10, afinado), la nota objetivo en grande, cuánto te
 * desvías y una línea que dibuja tu voz de los últimos segundos sobre la nota objetivo. Solo se muestra mientras
 * el micrófono escucha con un objetivo claro. Lo usan "Cantar y calificar", "Escucha e imita" (piano.js),
 * "Nota sostenida" y "Sirena" (entrenamiento.js).
 * La lectura se suaviza (mediana de 5 + media móvil) y la aguja se desliza: no «baila». */
const AFINACION_TOLERANCIA_CENTS = 10; // dentro de ±10 cents = afinado
const AFINACION_CASI_CENTS = 25;
const AFI_RANGO_DIAL = 50; // el dial va de −50 a +50 cents (medio semitono)
const AFI_TRAZO_MS = 4000; // segundos de voz que dibuja la línea
let afiSuave = null;
let afiHistorial = [];
let afiUltimaLecturaMs = 0;
let afiTrazo = [];
let afiMidiObjetivo = null;
let afiDestino = null; // hacia dónde va la aguja (cents, sin octavas), o null sin voz
let afiAguja = 0;
let afiAnimacion = 0;

function construirAfinometro() {
  const cont = el("afinometro");
  if (!cont || cont.dataset.listo === "2") return;
  cont.dataset.listo = "2";
  cont.className = "afinometro afinometro-grande afinador-v2";
  cont.innerHTML =
    '<div class="afi-cab"><div class="afi-objetivo" id="afiObjetivoCaja"><small>Canta</small><b id="afiObjetivo">—</b></div>' +
    '<div class="afi-lcd" id="afinometroTexto">—</div></div>' +
    '<canvas class="afi-dial" id="afiDial" width="560" height="290" aria-hidden="true"></canvas>' +
    '<div class="afi-mensaje" id="afinometroMensaje" role="status" aria-live="polite">Escuchando…</div>' +
    '<canvas class="afi-trazo" id="afiTrazo" width="560" height="110" aria-hidden="true"></canvas>' +
    `<div class="afi-ley"><i></i>±${AFINACION_TOLERANCIA_CENTS} cents = afinado</div>`;
}

function nivelAfinacion(cents) {
  const a = Math.abs(cents);
  return a <= AFINACION_TOLERANCIA_CENTS ? "bien" : a <= AFINACION_CASI_CENTS ? "casi" : "lejos";
}

const AFI_COLORES = { bien: "#3ecf6e", casi: "#f08a24", lejos: "#ff3b4e" };

function dibujarDial(cv, cents, conVoz) {
  const g = cv.getContext("2d");
  const W = cv.width;
  const H = cv.height;
  const cx = W / 2;
  const cy = H - 26;
  const R = 228;
  const estilo = getComputedStyle(document.documentElement);
  const tenue = estilo.getPropertyValue("--line").trim() || "#322423";
  const texto = estilo.getPropertyValue("--bone-dim").trim() || "#a8968f";
  const ang = (c) => ((Math.max(-AFI_RANGO_DIAL, Math.min(AFI_RANGO_DIAL, c)) / AFI_RANGO_DIAL) * 70 - 90) * (Math.PI / 180);
  g.clearRect(0, 0, W, H);
  g.lineCap = "butt";
  // Pista de fondo y zonas: verde ±10, naranja hasta ±25, rojo hasta ±50. La zona donde estás se ilumina.
  const nivel = conVoz ? nivelAfinacion(cents) : null;
  const zonas = [
    [-50, -25, "lejos"], [-25, -10, "casi"], [-10, 10, "bien"], [10, 25, "casi"], [25, 50, "lejos"],
  ];
  g.lineWidth = 26;
  g.strokeStyle = tenue;
  g.beginPath();
  g.arc(cx, cy, R, ang(-50), ang(50));
  g.stroke();
  zonas.forEach(([a, b, z]) => {
    const encendida = nivel === z && cents >= a - 0.01 && cents <= b + 0.01;
    g.globalAlpha = encendida ? 1 : z === "bien" ? 0.5 : 0.28;
    g.strokeStyle = AFI_COLORES[z];
    g.lineWidth = encendida ? 30 : 22;
    g.beginPath();
    g.arc(cx, cy, R, ang(a) + 0.006, ang(b) - 0.006);
    g.stroke();
  });
  g.globalAlpha = 1;
  // Marcas cada 5 cents y números en 0, ±10, ±25, ±50.
  g.strokeStyle = texto;
  g.fillStyle = texto;
  g.font = "600 17px Inter, 'Work Sans', system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let c = -50; c <= 50; c += 5) {
    const a = ang(c);
    const grande = c === 0 || Math.abs(c) === 10 || Math.abs(c) === 25 || Math.abs(c) === 50;
    const r1 = R - 22;
    const r2 = r1 - (grande ? 16 : 8);
    g.lineWidth = grande ? 2.5 : 1.2;
    g.beginPath();
    g.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    g.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
    g.stroke();
    if (grande) {
      const rt = r2 - 16;
      g.fillText(c > 0 ? `+${c}` : String(c), cx + rt * Math.cos(a), cy + rt * Math.sin(a));
    }
  }
  g.font = "700 26px Inter, 'Work Sans', system-ui, sans-serif";
  g.fillText("♭", cx - R - 6, cy - 4);
  g.fillText("♯", cx + R + 6, cy - 4);
  // Aguja.
  const a = ang(cents);
  const color = conVoz ? AFI_COLORES[nivel] : texto;
  g.strokeStyle = color;
  g.lineCap = "round";
  g.lineWidth = 6;
  g.globalAlpha = conVoz ? 1 : 0.35;
  if (conVoz) {
    g.shadowColor = color;
    g.shadowBlur = 14;
  }
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + (R - 6) * Math.cos(a), cy + (R - 6) * Math.sin(a));
  g.stroke();
  g.shadowBlur = 0;
  g.globalAlpha = 1;
  g.fillStyle = color;
  g.beginPath();
  g.arc(cx, cy, 13, 0, Math.PI * 2);
  g.fill();
}

function dibujarTrazo(cv, ahora) {
  const g = cv.getContext("2d");
  const W = cv.width;
  const H = cv.height;
  const estilo = getComputedStyle(document.documentElement);
  const tenue = estilo.getPropertyValue("--line").trim() || "#322423";
  const y = (c) => H / 2 - (Math.max(-AFI_RANGO_DIAL, Math.min(AFI_RANGO_DIAL, c)) / AFI_RANGO_DIAL) * (H / 2 - 6);
  g.clearRect(0, 0, W, H);
  // Franja de «afinado» y línea de la nota objetivo.
  g.fillStyle = "rgba(62, 207, 110, 0.16)";
  g.fillRect(0, y(AFINACION_TOLERANCIA_CENTS), W, y(-AFINACION_TOLERANCIA_CENTS) - y(AFINACION_TOLERANCIA_CENTS));
  g.strokeStyle = tenue;
  g.lineWidth = 1;
  [-25, 25].forEach((c) => {
    g.beginPath();
    g.moveTo(0, y(c));
    g.lineTo(W, y(c));
    g.stroke();
  });
  g.strokeStyle = "rgba(62, 207, 110, 0.85)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, H / 2);
  g.lineTo(W, H / 2);
  g.stroke();
  // La voz: cada tramo con el color de lo afinado que estaba.
  g.lineWidth = 3.5;
  g.lineCap = "round";
  g.lineJoin = "round";
  let prev = null;
  afiTrazo.forEach((p) => {
    if (p.c === null) {
      prev = null;
      return;
    }
    const x = W - ((ahora - p.t) / AFI_TRAZO_MS) * W;
    if (prev) {
      g.strokeStyle = AFI_COLORES[nivelAfinacion(p.c)];
      g.beginPath();
      g.moveTo(prev.x, prev.y);
      g.lineTo(x, y(p.c));
      g.stroke();
    }
    prev = { x, y: y(p.c) };
  });
}

function animarAfinometro() {
  const dial = el("afiDial");
  const trazo = el("afiTrazo");
  if (!dial || !trazo) return;
  const ahora = performance.now();
  if (afiDestino !== null) afiAguja += (afiDestino - afiAguja) * 0.25;
  else afiAguja += (0 - afiAguja) * 0.15;
  afiTrazo = afiTrazo.filter((p) => ahora - p.t <= AFI_TRAZO_MS);
  dibujarDial(dial, afiAguja, afiDestino !== null);
  dibujarTrazo(trazo, ahora);
  afiAnimacion = requestAnimationFrame(animarAfinometro);
}

/** `midiObjetivo` (opcional): la nota que hay que cantar, para mostrarla en grande. */
function mostrarAfinometro(mostrar, midiObjetivo) {
  construirAfinometro();
  const cont = el("afinometro");
  if (!cont) return;
  cont.hidden = !mostrar;
  afiUltimaLecturaMs = 0; // empieza de cero: sin arrastrar la lectura anterior
  afiTrazo = [];
  afiMidiObjetivo = Number.isFinite(midiObjetivo) ? midiObjetivo : null;
  const nombre = (m) => (typeof etiquetaNota === "function" ? etiquetaNota(m) : midiANombre(m));
  el("afiObjetivoCaja").hidden = afiMidiObjetivo === null;
  el("afiObjetivo").textContent = afiMidiObjetivo === null ? "—" : nombre(afiMidiObjetivo);
  actualizarAfinometro(null);
  cancelAnimationFrame(afiAnimacion);
  if (mostrar) afiAnimacion = requestAnimationFrame(animarAfinometro);
}

/** `cents`: cuánto te desvías del objetivo (negativo = grave, positivo = agudo), o null si no hay voz. */
function actualizarAfinometro(cents) {
  construirAfinometro();
  const cont = el("afinometro");
  if (!cont) return;
  const msg = el("afinometroMensaje");
  const det = el("afinometroTexto");
  const ahora = performance.now();
  if (cents === null || cents === undefined) {
    // Un respiro: la voz tiene huecos entre sílabas y el medidor no debe parpadear con cada uno.
    if (afiSuave !== null && afiUltimaLecturaMs && ahora - afiUltimaLecturaMs < 350) return;
    afiSuave = null;
    afiHistorial = [];
    afiDestino = null;
    if (afiTrazo.length && afiTrazo[afiTrazo.length - 1].c !== null) afiTrazo.push({ t: ahora, c: null });
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
  afiSuave = afiSuave === null ? mediana : afiSuave + 0.35 * (mediana - afiSuave);
  const c = afiSuave;
  // Otra octava: se avisa aparte y el dial muestra solo el resto.
  const octavas = Math.abs(c) > 600 ? Math.round(c / 1200) : 0;
  const resto = c - 1200 * octavas;
  afiDestino = resto;
  afiTrazo.push({ t: ahora, c: resto });
  let nivel = nivelAfinacion(resto);
  let texto;
  if (octavas !== 0) {
    nivel = "lejos";
    texto = `Estás ${Math.abs(octavas) === 1 ? "una octava" : Math.abs(octavas) + " octavas"} ${octavas > 0 ? "más arriba" : "más abajo"}`;
  } else if (nivel === "bien") {
    texto = "¡Afinado!";
  } else if (nivel === "casi") {
    texto = resto < 0 ? "Casi: sube un poquito ↑" : "Casi: baja un poquito ↓";
  } else {
    texto = Math.abs(resto) > 70 ? (resto < 0 ? "Sube más ↑↑" : "Baja más ↓↓") : resto < 0 ? "Sube ↑" : "Baja ↓";
  }
  cont.dataset.nivel = nivel;
  msg.textContent = texto;
  const cantada = afiMidiObjetivo === null ? "" : `${midiANombre(Math.round(afiMidiObjetivo + c / 100))} · `;
  det.textContent = `${cantada}${resto > 0 ? "+" : ""}${Math.round(resto)} ¢`;
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
