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
  contenedor.classList.toggle("estrecho", anchoNegra < 16);

  const crearEtiqueta = (midi) => {
    const etiqueta = document.createElement("span");
    etiqueta.className = "tecla-etiqueta";
    etiqueta.textContent = midiANombre(midi);
    return etiqueta;
  };

  const blancas = [];
  for (let midi = DO1_MIDI; midi <= DO6_MIDI; midi++) {
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

  for (let midi = DO1_MIDI; midi <= DO6_MIDI; midi++) {
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
let ultimaNotaPrevisualizada = null;

function previsualizarNotaPiano(midi) {
  if (!window.PianoEngine) return;
  // reproducirSecuencia() usa un token compartido para poder cortar en seco
  // una reproducción vieja cuando arranca una nueva (correcto para
  // secuencias largas) -- pero eso significa que si tocas otra tecla antes
  // de que termine la previsualización de 0.6s de la anterior, el onNotaFin
  // de la vieja NUNCA llega a dispararse (el token ya cambió), y esa tecla
  // se queda "encendida" para siempre aunque ya no suene nada. Se apaga a
  // mano aquí, sin depender de ese callback que puede no llegar.
  if (ultimaNotaPrevisualizada !== null) marcarTeclaActiva(ultimaNotaPrevisualizada, false);
  ultimaNotaPrevisualizada = midi;

  const volumen = parseFloat(el("volumen") ? el("volumen").value : "0.85") || 0.85;
  window.PianoEngine.reproducirSecuencia([{ midi, duracion: 0.6 }], volumen, {
    onNotaInicio: (m) => marcarTeclaActiva(m, true),
    onNotaFin: (m) => {
      marcarTeclaActiva(m, false);
      if (ultimaNotaPrevisualizada === m) ultimaNotaPrevisualizada = null;
    },
  });
}

/** `manejarClic(midi)` es opcional: si no se indica, tocar una tecla solo
 * la previsualiza. Cada página que necesita un comportamiento distinto
 * (elegir nota, responder un quiz...) pasa su propio callback. */
function inicializarPiano(manejarClic) {
  construirTeclasPiano();
  const clic = manejarClic || previsualizarNotaPiano;

  el("piano").addEventListener("click", (e) => {
    const tecla = e.target.closest(".tecla");
    if (!tecla) return;
    clic(parseInt(tecla.dataset.midi, 10));
  });

  configurarDesplazamientoPiano();
  configurarZoomPiano();
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
