/*
 * rutina.js — genera una rutina de calentamiento corta y distinta cada día,
 * combinando patrones de `escalas.js` (calentamiento + diatónica/modo +
 * arpegio + técnica de voz mixta), y lleva la racha de días completados.
 */

const RUTINA_CATEGORIAS = ["calentamiento", "diatonicas", "arpegios", "voz_mixta"];
const RUTINA_VOZ_POR_DEFECTO = "tenor";

let rutinaEjercicios = [];
let rutinaVarianteExtra = 0;

function hashCadena(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function generarRutina(varianteExtra) {
  const fecha = fechaLocalISO();
  const rng = crearRng(hashCadena(`${fecha}:${varianteExtra}`));
  return RUTINA_CATEGORIAS.map((categoria) => {
    const opciones = Object.entries(PATRONES).filter(([, p]) => p.categoria === categoria);
    // "diatonicas" a veces se sustituye por un modo o una pentatónica para variar más
    let pool = opciones;
    if (categoria === "diatonicas" && rng.randint(0, 1) === 1) {
      const alternativa = Object.entries(PATRONES).filter(([, p]) => p.categoria === "modos" || p.categoria === "pentatonicas");
      if (alternativa.length > 0) pool = alternativa;
    }
    const [clave, patron] = pool[rng.randint(0, pool.length - 1)];
    return { clave, patron };
  });
}

function diasEntre(fechaA, fechaB) {
  const a = new Date(`${fechaA}T00:00:00`);
  const b = new Date(`${fechaB}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

const RUTINA_HISTORIAL_MAX_DIAS = 371; // ~53 semanas: de sobra para el calendario de racha

function marcarRutinaCompletadaHoy() {
  const hoy = fechaLocalISO();
  const ultima = Progreso.obtener("rutinaUltimaFecha", null);
  if (ultima === hoy) return;
  let racha = Progreso.obtener("rutinaRachaDias", 0);
  racha = ultima !== null && diasEntre(ultima, hoy) === 1 ? racha + 1 : 1;
  const historial = Progreso.obtener("rutinaHistorialFechas", []);
  historial.push(hoy);
  while (historial.length > RUTINA_HISTORIAL_MAX_DIAS) historial.shift();
  Progreso.guardar({
    ...Progreso.cargar(),
    rutinaUltimaFecha: hoy,
    rutinaRachaDias: racha,
    rutinaHistorialFechas: historial,
  });
  el("rutinaRacha").textContent = racha;
}

function reproducirEjercicioRutina(patronClave, boton) {
  let resultado;
  try {
    resultado = eventosModoEscala({
      voz: RUTINA_VOZ_POR_DEFECTO,
      patron: patronClave,
      notaInicial: null,
      pasoSemitonos: 1,
      soloSubida: false,
      duracionNota: 0.4,
      pausa: 0.1,
    });
  } catch (err) {
    return; // patrón no cabe en el rango por defecto: no debería pasar con estas categorías, pero por si acaso
  }
  boton.disabled = true;
  window.PianoEngine.reproducirSecuencia(resultado.eventos, parseFloat(el("volumen").value) || 0.85, {
    onNotaInicio: (midi) => marcarTeclaActiva(midi, true),
    onNotaFin: (midi) => marcarTeclaActiva(midi, false),
    onTerminar: () => (boton.disabled = false),
  });
}

function renderizarRutina() {
  const cont = el("rutinaLista");
  cont.innerHTML = "";
  rutinaEjercicios.forEach(({ clave, patron }, i) => {
    const fila = document.createElement("div");
    fila.className = "rutina-item";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.id = `rutinaCheck${i}`;
    check.addEventListener("change", () => {
      fila.classList.toggle("completado", check.checked);
      const todas = Array.from(cont.querySelectorAll('input[type="checkbox"]'));
      if (todas.every((c) => c.checked)) marcarRutinaCompletadaHoy();
    });

    const info = document.createElement("label");
    info.className = "rutina-info";
    info.htmlFor = check.id;
    info.innerHTML = `<span class="rutina-nombre">${patron.nombre}</span><span class="rutina-detalle">${CATEGORIAS[patron.categoria] || patron.categoria} · ${patron.descripcion}</span>`;

    const btnPlay = document.createElement("button");
    btnPlay.textContent = "▶";
    btnPlay.title = "Escuchar este ejercicio";
    btnPlay.addEventListener("click", () => reproducirEjercicioRutina(clave, btnPlay));

    fila.append(check, info, btnPlay);
    cont.appendChild(fila);
  });
}

/** Metrónomo de fondo para marcar el pulso mientras se hace la rutina --
 * mismo motor (audio.js) y misma barra compacta que en Piano, aquí como
 * único control (no hay pestaña detallada que abrir en esta página). */
function inicializarMetronomoFlotante() {
  const toggle = el("metroFlotToggle");
  const bpm = el("metroFlotBpm");
  const bpmValor = el("metroFlotBpmValor");
  const volumen = el("metroFlotVolumen");
  const punto = el("metronomoPuntoMini");
  let enMarcha = false;

  bpm.addEventListener("input", () => {
    bpmValor.textContent = bpm.value;
    if (enMarcha && window.MetronomoEngine) window.MetronomoEngine.ajustarBpm(parseInt(bpm.value, 10));
  });

  volumen.addEventListener("input", () => {
    if (window.MetronomoEngine) window.MetronomoEngine.ajustarVolumen(parseFloat(volumen.value));
  });

  toggle.addEventListener("click", () => {
    if (!window.MetronomoEngine) return;
    if (enMarcha) {
      window.MetronomoEngine.detener();
      enMarcha = false;
      toggle.textContent = "▶";
      toggle.classList.remove("en-marcha");
      return;
    }
    enMarcha = true;
    toggle.textContent = "⏹";
    toggle.classList.add("en-marcha");
    window.MetronomoEngine.ajustarVolumen(parseFloat(volumen.value));
    window.MetronomoEngine.iniciar(parseInt(bpm.value, 10), 4, () => {
      punto.classList.remove("pulso");
      void punto.offsetWidth; // fuerza reflow para reiniciar la animación en cada pulso
      punto.classList.add("pulso");
    });
  });
}

function inicializarRutina() {
  if (window.Progreso) Progreso.marcarHerramientaUsada("rutina");
  inicializarPiano(); // teclado.js: sin callback propio, tocar una tecla solo la previsualiza
  inicializarMetronomoFlotante();
  rutinaEjercicios = generarRutina(rutinaVarianteExtra);
  renderizarRutina();
  el("rutinaRacha").textContent = Progreso.obtener("rutinaRachaDias", 0);

  el("btnRutinaNueva").addEventListener("click", () => {
    rutinaVarianteExtra++;
    rutinaEjercicios = generarRutina(rutinaVarianteExtra);
    renderizarRutina();
  });
}

document.addEventListener("DOMContentLoaded", inicializarRutina);
