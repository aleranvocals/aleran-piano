/*
 * oido.js — página Oído: intervalos, adivina la nota y Simon dice. Ninguno
 * necesita micrófono; todos usan el piano de teclado.js (sonido real vía
 * PianoEngine de audio.js) y guardan sus récords con progreso.js.
 */

let oidoModoActual = "intervalos";

function volumenActual() {
  return parseFloat(el("volumen").value) || 0.85;
}

function cambiarSubmodoOido(modo) {
  oidoModoActual = modo;
  document.querySelectorAll(".subtab").forEach((btn) => {
    const activo = btn.dataset.oido === modo;
    btn.classList.toggle("activo", activo);
    btn.setAttribute("aria-selected", String(activo));
  });
  el("panel-intervalos").hidden = modo !== "intervalos";
  el("panel-notasquiz").hidden = modo !== "notas";
  el("panel-simon").hidden = modo !== "simon";
}

// --- Intervalos -------------------------------------------------------

const INTERVALOS = [
  { semitonos: 1, nombre: "2ª menor" },
  { semitonos: 2, nombre: "2ª mayor" },
  { semitonos: 3, nombre: "3ª menor" },
  { semitonos: 4, nombre: "3ª mayor" },
  { semitonos: 5, nombre: "4ª justa" },
  { semitonos: 6, nombre: "4ª aum. / 5ª dism." },
  { semitonos: 7, nombre: "5ª justa" },
  { semitonos: 8, nombre: "6ª menor" },
  { semitonos: 9, nombre: "6ª mayor" },
  { semitonos: 10, nombre: "7ª menor" },
  { semitonos: 11, nombre: "7ª mayor" },
  { semitonos: 12, nombre: "8ª (octava)" },
];

let intervaloRaiz = null;
let intervaloCorrecto = null;

function reproducirIntervalo() {
  if (intervaloRaiz === null) return;
  window.PianoEngine.reproducirSecuencia(
    [
      { midi: intervaloRaiz, duracion: 0.6 },
      { midi: -1, duracion: 0.15 },
      { midi: intervaloRaiz + intervaloCorrecto, duracion: 0.6 },
    ],
    volumenActual(),
    {}
  );
}

function nuevaPreguntaIntervalo() {
  const margenMax = DO6_MIDI - 12;
  const margenMin = DO1_MIDI;
  intervaloRaiz = margenMin + Math.floor(Math.random() * (margenMax - margenMin + 1));
  const opcion = INTERVALOS[Math.floor(Math.random() * INTERVALOS.length)];
  intervaloCorrecto = opcion.semitonos;

  const cont = el("intervalosOpciones");
  cont.innerHTML = "";
  INTERVALOS.forEach((intervalo) => {
    const btn = document.createElement("button");
    btn.textContent = intervalo.nombre;
    btn.addEventListener("click", () => responderIntervalo(intervalo.semitonos, btn));
    cont.appendChild(btn);
  });
  el("intervalosFeedback").textContent = "";
  el("btnIntervaloRepetir").disabled = false;
  reproducirIntervalo();
}

function responderIntervalo(semitonosElegidos, boton) {
  const total = Progreso.incrementar("intervalosTotal");
  const botones = Array.from(el("intervalosOpciones").children);
  botones.forEach((b) => (b.disabled = true));

  if (semitonosElegidos === intervaloCorrecto) {
    boton.classList.add("correcta");
    Progreso.incrementar("intervalosAciertos");
    const racha = Progreso.incrementar("intervalosRachaActual");
    Progreso.actualizarRecord("intervalosMejorRacha", racha, (n, a) => n > a);
    el("intervalosFeedback").textContent = "✅ ¡Correcto!";
  } else {
    boton.classList.add("incorrecta");
    Progreso.guardar({ ...Progreso.cargar(), intervalosRachaActual: 0 });
    const correctoBtn = botones.find((b) => b.textContent === INTERVALOS.find((i) => i.semitonos === intervaloCorrecto).nombre);
    if (correctoBtn) correctoBtn.classList.add("correcta");
    el("intervalosFeedback").textContent = `❌ Era: ${INTERVALOS.find((i) => i.semitonos === intervaloCorrecto).nombre}`;
  }
  el("intervalosAciertos").textContent = Progreso.obtener("intervalosAciertos", 0);
  el("intervalosTotal").textContent = total;
  el("intervalosRacha").textContent = Progreso.obtener("intervalosRachaActual", 0);
}

// --- Adivina la nota ----------------------------------------------------

let notaquizObjetivo = null;
let notaquizEsperando = false;

function rangoNotaquiz() {
  if (el("notasquizRango").value === "completo") return [DO1_MIDI, DO6_MIDI];
  return [nombreAMidi("Do3"), nombreAMidi("Do5")];
}

function nuevaPreguntaNota() {
  const [bajo, alto] = rangoNotaquiz();
  notaquizObjetivo = bajo + Math.floor(Math.random() * (alto - bajo + 1));
  notaquizEsperando = true;
  el("notasquizFeedback").textContent = "";
  el("btnNotaquizRepetir").disabled = false;
  window.PianoEngine.reproducirSecuencia([{ midi: notaquizObjetivo, duracion: 0.7 }], volumenActual(), {});
}

function repetirNota() {
  if (notaquizObjetivo === null) return;
  window.PianoEngine.reproducirSecuencia([{ midi: notaquizObjetivo, duracion: 0.7 }], volumenActual(), {});
}

/** Devuelve true si consumió el clic (pregunta de "adivina la nota" activa). */
function manejarClicNotaquiz(midi) {
  if (!notaquizEsperando) return false;
  notaquizEsperando = false;
  const total = Progreso.incrementar("notasquizTotal");
  marcarTeclaActiva(midi, true);
  setTimeout(() => marcarTeclaActiva(midi, false), 400);

  if (midi === notaquizObjetivo) {
    Progreso.incrementar("notasquizAciertos");
    const racha = Progreso.incrementar("notasquizRachaActual");
    Progreso.actualizarRecord("notasquizMejorRacha", racha, (n, a) => n > a);
    el("notasquizFeedback").textContent = "✅ ¡Correcto!";
  } else {
    Progreso.guardar({ ...Progreso.cargar(), notasquizRachaActual: 0 });
    el("notasquizFeedback").textContent = `❌ Era ${midiANombre(notaquizObjetivo)}, tocaste ${midiANombre(midi)}`;
    window.PianoEngine.reproducirSecuencia([{ midi: notaquizObjetivo, duracion: 0.6 }], volumenActual(), {});
  }
  el("notasquizAciertos").textContent = Progreso.obtener("notasquizAciertos", 0);
  el("notasquizTotal").textContent = total;
  el("notasquizRacha").textContent = Progreso.obtener("notasquizRachaActual", 0);
  return true;
}

// --- Simon dice ----------------------------------------------------------

let simonSecuencia = [];
let simonEntrada = [];
let simonNivel = 0;
let simonEsperandoEntrada = false;
let simonReproduciendo = false;

let simonSecuenciaProgramada = [];

function empezarSimon() {
  simonSecuencia = [];
  simonNivel = 0;
  el("simonFeedback").textContent = "";
  el("simonRecord").textContent = Progreso.obtener("simonMejorNivel", 0);

  if (el("simonProgramado").checked) {
    try {
      simonSecuenciaProgramada = parsearNotasPersonalizadas(el("simonNotasProgramadas").value);
      marcarCampoNotaInvalido(el("simonNotasProgramadas"), false);
    } catch (err) {
      marcarCampoNotaInvalido(el("simonNotasProgramadas"), true, err.message);
      el("simonFeedback").textContent = err.message;
      return;
    }
  }
  siguienteRondaSimon();
}

function siguienteRondaSimon() {
  if (el("simonProgramado").checked) {
    if (simonNivel >= simonSecuenciaProgramada.length) {
      el("simonFeedback").textContent = "🎉 ¡Completaste la secuencia entera! Pulsa Empezar para repetirla.";
      return;
    }
    simonSecuencia.push(simonSecuenciaProgramada[simonNivel]);
  } else {
    const bajo = nombreAMidi("Do3");
    const alto = nombreAMidi("Do5");
    simonSecuencia.push(bajo + Math.floor(Math.random() * (alto - bajo + 1)));
  }
  simonNivel++;
  simonEntrada = [];
  el("simonNivel").textContent = simonNivel;
  el("simonFeedback").textContent = "Escucha…";
  reproducirSecuenciaSimon();
}

async function reproducirSecuenciaSimon() {
  simonReproduciendo = true;
  simonEsperandoEntrada = false;
  const eventos = [];
  simonSecuencia.forEach((midi, i) => {
    eventos.push({ midi, duracion: 0.5 });
    if (i < simonSecuencia.length - 1) eventos.push({ midi: -1, duracion: 0.15 });
  });
  await window.PianoEngine.reproducirSecuencia(eventos, volumenActual(), {
    onNotaInicio: (midi) => marcarTeclaActiva(midi, true),
    onNotaFin: (midi) => marcarTeclaActiva(midi, false),
  });
  simonReproduciendo = false;
  simonEsperandoEntrada = true;
  el("simonFeedback").textContent = "Tu turno: repite la secuencia";
}

/** Devuelve true si consumió el clic (Simon dice esperando tu turno). */
function manejarClicSimon(midi) {
  if (!simonEsperandoEntrada || simonReproduciendo) return false;
  marcarTeclaActiva(midi, true);
  setTimeout(() => marcarTeclaActiva(midi, false), 250);
  window.PianoEngine.reproducirSecuencia([{ midi, duracion: 0.3 }], volumenActual(), {});

  simonEntrada.push(midi);
  const indice = simonEntrada.length - 1;
  if (simonEntrada[indice] !== simonSecuencia[indice]) {
    simonEsperandoEntrada = false;
    const nivelAlcanzado = simonNivel - 1;
    const record = Progreso.actualizarRecord("simonMejorNivel", nivelAlcanzado, (n, a) => n > a);
    el("simonFeedback").textContent = `❌ Fallaste en el nivel ${simonNivel}. ${record ? "🏆 ¡Nuevo récord!" : ""} Pulsa Empezar para reintentar.`;
    el("simonRecord").textContent = Progreso.obtener("simonMejorNivel", 0);
    return true;
  }
  if (simonEntrada.length === simonSecuencia.length) {
    simonEsperandoEntrada = false;
    el("simonFeedback").textContent = "✅ ¡Bien! Siguiente ronda…";
    setTimeout(siguienteRondaSimon, 900);
  }
  return true;
}

// --- Punto de entrada compartido desde el clic del piano ------------------

/** Pasado a teclado.js como el manejador de clic de esta página: si hay una
 * ronda activa de "adivina la nota" o "Simon dice" se queda con el clic
 * como respuesta; si no, simplemente previsualiza la nota tocada. */
function manejarClicTeclaOido(midi) {
  if (oidoModoActual === "notas" && manejarClicNotaquiz(midi)) return;
  if (oidoModoActual === "simon" && manejarClicSimon(midi)) return;
  previsualizarNotaPiano(midi);
}

function inicializarOido() {
  if (window.Progreso) Progreso.marcarHerramientaUsada("oido");
  inicializarPiano(manejarClicTeclaOido); // teclado.js
  document.querySelectorAll(".subtab").forEach((btn) => {
    btn.addEventListener("click", () => cambiarSubmodoOido(btn.dataset.oido));
  });

  el("btnIntervaloNueva").addEventListener("click", nuevaPreguntaIntervalo);
  el("btnIntervaloRepetir").addEventListener("click", reproducirIntervalo);

  el("btnNotaquizNueva").addEventListener("click", nuevaPreguntaNota);
  el("btnNotaquizRepetir").addEventListener("click", repetirNota);

  el("btnSimonEmpezar").addEventListener("click", empezarSimon);
  el("simonRecord").textContent = Progreso.obtener("simonMejorNivel", 0);
  el("simonProgramado").addEventListener("change", () => {
    el("campoSimonNotas").hidden = !el("simonProgramado").checked;
  });
  el("simonNotasProgramadas").addEventListener("input", () => marcarCampoNotaInvalido(el("simonNotasProgramadas"), false));
}

document.addEventListener("DOMContentLoaded", inicializarOido);
