/*
 * ritmo.js — pestaña "Ritmo" (palmas): generador de ritmos con dificultad
 * progresiva (niveles 1-10), independiente del piano y del metrónomo -- su
 * propia métrica y su propio tempo. Usa las figuras de escalas.js
 * (FIGURAS/figuraPorId/figuraASegundos) y el sintetizador de palmada de
 * audio.js (PianoEngine.reproducirRitmo) -- nunca toca el piano de muestras,
 * así que no depende de que sus samples hayan cargado.
 */

// Cada nivel es un conjunto de figuras permitidas + probabilidad de
// silencio. La progresión es gradual: primero se afianza el pulso (redonda/
// blanca/negra, sin silencios), luego entran los silencios, luego las
// subdivisiones (corchea, semicorchea), y los niveles altos mezclan todo con
// más silencios. Sin compases/métrica estrictos ni puntillo/ligadura/tresillo
// -- eso es Modo Músico, todavía sin construir (igual que en escalas.js).
const NIVELES_RITMO = [
  { figuras: ["redonda", "blanca", "negra"], probSilencio: 0, descripcion: "Solo redondas, blancas y negras, sin silencios — para agarrar el pulso." },
  { figuras: ["redonda", "blanca", "negra"], probSilencio: 0.12, descripcion: "Igual que el nivel 1, pero con algún silencio de por medio." },
  { figuras: ["blanca", "negra"], probSilencio: 0.15, descripcion: "Más negras: ritmo más regular y algo más rápido de leer." },
  { figuras: ["blanca", "negra", "corchea"], probSilencio: 0.15, descripcion: "Aparece la corchea (dos palmadas por pulso)." },
  { figuras: ["negra", "corchea"], probSilencio: 0.18, descripcion: "Corcheas más frecuentes — ritmo más ágil." },
  { figuras: ["blanca", "negra", "corchea"], probSilencio: 0.22, descripcion: "Más silencios entremezclados: hay que contar bien los huecos." },
  { figuras: ["negra", "corchea", "semicorchea"], probSilencio: 0.2, descripcion: "Aparece la semicorchea (cuatro palmadas por pulso)." },
  { figuras: ["corchea", "semicorchea"], probSilencio: 0.22, descripcion: "Semicorcheas frecuentes — ritmo denso." },
  { figuras: ["negra", "corchea", "semicorchea"], probSilencio: 0.26, descripcion: "Mezcla de subdivisiones con silencios frecuentes." },
  { figuras: ["redonda", "blanca", "negra", "corchea", "semicorchea"], probSilencio: 0.3, descripcion: "Todo mezclado: de redondas a semicorcheas, con silencios en cualquier punto." },
];

function configNivelRitmo(nivel) {
  const i = Math.max(1, Math.min(10, nivel)) - 1;
  return NIVELES_RITMO[i];
}

// unidades: [{ figura: idDeFigura, silencio: bool }]. No fuerza alineación
// estricta a compás -- aquí basta con sentir el pulso y la subdivisión.
function generarRitmoNivel(nivel, compases) {
  const cfg = configNivelRitmo(nivel);
  const totalPulsos = Math.max(1, compases) * 4;
  const unidades = [];
  let restante = totalPulsos;
  while (restante > 1e-6) {
    const candidatas = cfg.figuras.filter((id) => figuraPorId(id).pulsos <= restante + 1e-9);
    const elegibles = candidatas.length > 0 ? candidatas : ["semicorchea"];
    const figura = elegibles[Math.floor(Math.random() * elegibles.length)];
    const silencio = Math.random() < cfg.probSilencio;
    unidades.push({ figura, silencio });
    restante -= figuraPorId(figura).pulsos;
  }
  return unidades;
}

function unidadesRitmoAEventos(unidades, bpm) {
  return unidades.map((u) => ({ duracion: figuraASegundos(u.figura, bpm), silencio: u.silencio }));
}

let ritmoUnidades = [];
let ritmoReproduciendo = false;

function renderRitmoTira() {
  const contenedor = el("ritmoTira");
  contenedor.innerHTML = "";
  let acumulado = 0;
  ritmoUnidades.forEach((u, i) => {
    const fig = figuraPorId(u.figura);
    const celda = document.createElement("div");
    celda.className = "ritmo-celda" + (u.silencio ? " silencio" : "");
    // Divisor visual cada 4 pulsos -- solo cuando de verdad cae justo en el
    // límite del compás (una redonda a mitad de compás puede desalinearlo,
    // y no pasa nada: no es una raya de compás rigurosa, solo orientación).
    if (i > 0 && Math.abs(acumulado % 4) < 1e-6) celda.classList.add("compas-inicio");
    celda.textContent = u.silencio ? fig.simboloSilencio : fig.simbolo;
    celda.dataset.indice = String(i);
    contenedor.appendChild(celda);
    acumulado += fig.pulsos;
  });
}

function limpiarCeldaActivaRitmo() {
  const contenedor = el("ritmoTira");
  contenedor.querySelectorAll(".ritmo-celda.activa").forEach((c) => c.classList.remove("activa"));
}

function marcarCeldaActivaRitmo(indice) {
  limpiarCeldaActivaRitmo();
  const celda = el("ritmoTira").querySelector(`[data-indice="${indice}"]`);
  if (celda) celda.classList.add("activa");
}

/** Corta cualquier reproducción de ritmo en curso y deja los botones/celdas
 * en reposo. Se usa tanto al pulsar "Detener" como antes de regenerar el
 * ritmo (nivel/compases/"Ritmo nuevo") -- sin esto, cambiar de nivel a
 * mitad de una reproducción dejaba el resaltado marcando celdas del patrón
 * VIEJO sobre la tira NUEVA (índices que ya no correspondían a nada real). */
function detenerRitmoUI() {
  if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
  limpiarCeldaActivaRitmo();
  ritmoReproduciendo = false;
  el("btnRitmoEscuchar").disabled = false;
  el("btnRitmoDetener").disabled = true;
}

function nuevoRitmo() {
  if (ritmoReproduciendo) detenerRitmoUI();
  const nivel = parseInt(el("ritmoNivel").value, 10) || 1;
  const compases = Math.max(1, Math.min(8, parseInt(el("ritmoCompases").value, 10) || 4));
  ritmoUnidades = generarRitmoNivel(nivel, compases);
  renderRitmoTira();
}

function actualizarDescripcionNivelRitmo() {
  const nivel = parseInt(el("ritmoNivel").value, 10) || 1;
  el("ritmoNivelValor").textContent = String(nivel);
  el("ritmoNivelDescripcion").textContent = configNivelRitmo(nivel).descripcion;
}

async function reproducirRitmoActual() {
  if (!window.PianoEngine || ritmoUnidades.length === 0 || ritmoReproduciendo) return;
  const bpm = parseInt(el("ritmoBpm").value, 10) || 90;
  const eventos = unidadesRitmoAEventos(ritmoUnidades, bpm);
  ritmoReproduciendo = true;
  el("btnRitmoEscuchar").disabled = true;
  el("btnRitmoDetener").disabled = false;
  await window.PianoEngine.reproducirRitmo(eventos, 0.9, {
    onEventoInicio: (i) => marcarCeldaActivaRitmo(i),
    onTerminar: limpiarCeldaActivaRitmo,
  });
  ritmoReproduciendo = false;
  el("btnRitmoEscuchar").disabled = false;
  el("btnRitmoDetener").disabled = true;
}

function inicializarRitmo() {
  el("ritmoNivel").addEventListener("input", () => {
    actualizarDescripcionNivelRitmo();
    nuevoRitmo();
  });
  el("ritmoCompases").addEventListener("change", nuevoRitmo);
  el("ritmoBpm").addEventListener("input", () => {
    el("ritmoBpmValor").textContent = el("ritmoBpm").value;
  });
  el("btnRitmoNuevo").addEventListener("click", nuevoRitmo);
  el("btnRitmoEscuchar").addEventListener("click", reproducirRitmoActual);
  el("btnRitmoDetener").addEventListener("click", detenerRitmoUI);

  actualizarDescripcionNivelRitmo();
  nuevoRitmo();
}
