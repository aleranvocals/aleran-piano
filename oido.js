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
  el("panel-acordes").hidden = modo !== "acordes";
  el("panel-notasquiz").hidden = modo !== "notas";
  el("panel-simon").hidden = modo !== "simon";
}

// El piano es la ayuda visual central del kit: cada nota (o cada nota de un
// acorde) se resalta al sonar, para que el cantante asocie lo que oye con
// dónde vive en el teclado -- en vez de solo escuchar sin ver nada. Pasado
// como callbacks a reproducirSecuencia(); con un acorde (midi = array),
// audio.js llama a estos callbacks una vez por cada nota del array.
const RESALTAR_TECLAS = {
  onNotaInicio: (midi) => marcarTeclaActiva(midi, true),
  onNotaFin: (midi) => marcarTeclaActiva(midi, false),
};

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

// Progresión pensada como la de Ritmo (ritmo.js): primero los intervalos más
// consonantes/fáciles de distinguir (5ª, 8ª), luego los que suenan "dulces"
// (3ªs, 6ªs), luego segundas, y al final los más difíciles de oído (2ª menor,
// 7ªs, el tritono) -- en vez de tirar los 12 desde el nivel 1, que es como
// venía antes y abrumaba a quien recién empieza.
const NIVELES_INTERVALOS = [
  { semitonos: [7, 12], descripcion: "Los dos intervalos más fáciles de distinguir: 5ª justa y 8ª." },
  { semitonos: [5, 7, 12], descripcion: "Se suma la 4ª justa." },
  { semitonos: [3, 4, 5, 7, 12], descripcion: "Entran las 3ªs (menor y mayor) -- el color «dulce» vs «triste»." },
  { semitonos: [3, 4, 5, 7, 8, 9, 12], descripcion: "Se suman las 6ªs." },
  { semitonos: [2, 3, 4, 5, 7, 8, 9, 12], descripcion: "Entra la 2ª mayor." },
  { semitonos: [1, 2, 3, 4, 5, 7, 8, 9, 12], descripcion: "Entra la 2ª menor -- de las más difíciles de oído." },
  { semitonos: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12], descripcion: "Se suman las 7ªs (menor y mayor)." },
  { semitonos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], descripcion: "Los 12 intervalos, incluido el tritono -- nivel completo." },
];

function configNivelIntervalos(nivel) {
  const i = Math.max(1, Math.min(8, nivel)) - 1;
  return NIVELES_INTERVALOS[i];
}

function poolIntervalosNivel(nivel) {
  const semitonosPermitidos = new Set(configNivelIntervalos(nivel).semitonos);
  return INTERVALOS.filter((intervalo) => semitonosPermitidos.has(intervalo.semitonos));
}

function actualizarDescripcionNivelIntervalos() {
  const nivel = parseInt(el("intervalosNivel").value, 10) || 1;
  el("intervalosNivelValor").textContent = String(nivel);
  el("intervalosNivelDescripcion").textContent = configNivelIntervalos(nivel).descripcion;
}

let intervaloRaiz = null;
let intervaloCorrecto = null;
let intervaloDireccionActual = "ascendente";

function eventosIntervalo(raiz, semitonos, direccion) {
  const agudo = raiz + semitonos;
  if (direccion === "armonico") return [{ midi: [raiz, agudo], duracion: 0.9 }];
  if (direccion === "descendente") {
    return [
      { midi: agudo, duracion: 0.6 },
      { midi: -1, duracion: 0.15 },
      { midi: raiz, duracion: 0.6 },
    ];
  }
  return [
    { midi: raiz, duracion: 0.6 },
    { midi: -1, duracion: 0.15 },
    { midi: agudo, duracion: 0.6 },
  ];
}

function reproducirIntervalo() {
  if (intervaloRaiz === null) return;
  window.PianoEngine.reproducirSecuencia(
    eventosIntervalo(intervaloRaiz, intervaloCorrecto, intervaloDireccionActual),
    volumenActual(),
    RESALTAR_TECLAS
  );
}

function nuevaPreguntaIntervalo() {
  const nivel = parseInt(el("intervalosNivel").value, 10) || 1;
  const pool = poolIntervalosNivel(nivel);
  intervaloDireccionActual = el("intervalosDireccion").value;

  // El margen de abajo deja sitio de sobra para el intervalo más grande del
  // nivel (hasta una octava) sin salirse del piano cargado (Do1-Do6).
  const margenMax = DO6_MIDI - 12;
  const margenMin = DO1_MIDI;
  intervaloRaiz = margenMin + Math.floor(Math.random() * (margenMax - margenMin + 1));
  const opcion = pool[Math.floor(Math.random() * pool.length)];
  intervaloCorrecto = opcion.semitonos;

  const cont = el("intervalosOpciones");
  cont.innerHTML = "";
  pool.forEach((intervalo) => {
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

// --- Acordes -------------------------------------------------------------

// Tipos de tríada/tétrada más útiles para un cantante (reconocer sobre qué
// armonía está cantando), no el catálogo completo de un instrumentista --
// mismo criterio que el resto del kit (herramienta de canto, no de teoría
// exhaustiva). Los intervalos son respecto a la fundamental (0).
const TIPOS_ACORDE = [
  { id: "mayor", nombre: "Mayor", semitonos: [0, 4, 7] },
  { id: "menor", nombre: "Menor", semitonos: [0, 3, 7] },
  { id: "disminuido", nombre: "Disminuido", semitonos: [0, 3, 6] },
  { id: "aumentado", nombre: "Aumentado", semitonos: [0, 4, 8] },
  { id: "dominante7", nombre: "7ª de dominante", semitonos: [0, 4, 7, 10] },
  { id: "mayor7", nombre: "Mayor con 7ª", semitonos: [0, 4, 7, 11] },
  { id: "menor7", nombre: "Menor con 7ª", semitonos: [0, 3, 7, 10] },
];

// Igual que en Intervalos: mayor/menor primero (el contraste más audible),
// disminuido y aumentado después (menos frecuentes pero muy reconocibles por
// su tensión), y las tétradas con 7ª al final (más notas que distinguir).
const NIVELES_ACORDES = [
  { tipos: ["mayor", "menor"], descripcion: "El contraste más básico: mayor (alegre) vs menor (triste)." },
  { tipos: ["mayor", "menor", "disminuido"], descripcion: "Se suma el disminuido -- suena tenso/inestable." },
  { tipos: ["mayor", "menor", "disminuido", "aumentado"], descripcion: "Se suma el aumentado -- suena «flotante», sin resolver." },
  { tipos: ["mayor", "menor", "disminuido", "aumentado", "dominante7"], descripcion: "Entra la 7ª de dominante -- la que más pide resolver." },
  { tipos: ["mayor", "menor", "dominante7", "mayor7"], descripcion: "Se suma el mayor con 7ª -- más notas que distinguir." },
  { tipos: ["mayor", "menor", "disminuido", "aumentado", "dominante7", "mayor7", "menor7"], descripcion: "Los 7 tipos -- nivel completo." },
];

function configNivelAcordes(nivel) {
  const i = Math.max(1, Math.min(6, nivel)) - 1;
  return NIVELES_ACORDES[i];
}

function poolAcordesNivel(nivel) {
  const idsPermitidos = new Set(configNivelAcordes(nivel).tipos);
  return TIPOS_ACORDE.filter((tipo) => idsPermitidos.has(tipo.id));
}

function actualizarDescripcionNivelAcordes() {
  const nivel = parseInt(el("acordesNivel").value, 10) || 1;
  el("acordesNivelValor").textContent = String(nivel);
  el("acordesNivelDescripcion").textContent = configNivelAcordes(nivel).descripcion;
}

let acordeRaiz = null;
let acordeCorrecto = null;

function eventosAcorde(raiz, semitonos, modo) {
  const notas = semitonos.map((s) => raiz + s);
  if (modo === "arpegiado") return notas.map((midi) => ({ midi, duracion: 0.45 }));
  return [{ midi: notas, duracion: 1.1 }];
}

function reproducirAcordeActual() {
  if (acordeRaiz === null) return;
  window.PianoEngine.reproducirSecuencia(
    eventosAcorde(acordeRaiz, acordeCorrecto, el("acordesModo").value),
    volumenActual(),
    RESALTAR_TECLAS
  );
}

function nuevaPreguntaAcorde() {
  const nivel = parseInt(el("acordesNivel").value, 10) || 1;
  const pool = poolAcordesNivel(nivel);
  const opcion = pool[Math.floor(Math.random() * pool.length)];
  acordeCorrecto = opcion.semitonos;

  // El acorde más ancho (7ª, hasta 11 semitonos sobre la fundamental) debe
  // caber entero por debajo de Do6.
  const margenMax = DO6_MIDI - 11;
  const margenMin = DO1_MIDI;
  acordeRaiz = margenMin + Math.floor(Math.random() * (margenMax - margenMin + 1));

  const cont = el("acordesOpciones");
  cont.innerHTML = "";
  pool.forEach((tipo) => {
    const btn = document.createElement("button");
    btn.textContent = tipo.nombre;
    btn.addEventListener("click", () => responderAcorde(tipo.id, btn));
    cont.appendChild(btn);
  });
  el("acordesFeedback").textContent = "";
  el("btnAcordeRepetir").disabled = false;
  reproducirAcordeActual();
}

function responderAcorde(idElegido, boton) {
  const idCorrecto = TIPOS_ACORDE.find((t) => t.semitonos === acordeCorrecto).id;
  const total = Progreso.incrementar("acordesTotal");
  const botones = Array.from(el("acordesOpciones").children);
  botones.forEach((b) => (b.disabled = true));

  if (idElegido === idCorrecto) {
    boton.classList.add("correcta");
    Progreso.incrementar("acordesAciertos");
    const racha = Progreso.incrementar("acordesRachaActual");
    Progreso.actualizarRecord("acordesMejorRacha", racha, (n, a) => n > a);
    el("acordesFeedback").textContent = "✅ ¡Correcto!";
  } else {
    boton.classList.add("incorrecta");
    Progreso.guardar({ ...Progreso.cargar(), acordesRachaActual: 0 });
    const nombreCorrecto = TIPOS_ACORDE.find((t) => t.id === idCorrecto).nombre;
    const correctoBtn = botones.find((b) => b.textContent === nombreCorrecto);
    if (correctoBtn) correctoBtn.classList.add("correcta");
    el("acordesFeedback").textContent = `❌ Era: ${nombreCorrecto}`;
  }
  el("acordesAciertos").textContent = Progreso.obtener("acordesAciertos", 0);
  el("acordesTotal").textContent = total;
  el("acordesRacha").textContent = Progreso.obtener("acordesRachaActual", 0);
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
  el("intervalosNivel").addEventListener("input", actualizarDescripcionNivelIntervalos);
  actualizarDescripcionNivelIntervalos();

  el("btnAcordeNueva").addEventListener("click", nuevaPreguntaAcorde);
  el("btnAcordeRepetir").addEventListener("click", reproducirAcordeActual);
  el("acordesNivel").addEventListener("input", actualizarDescripcionNivelAcordes);
  actualizarDescripcionNivelAcordes();

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
