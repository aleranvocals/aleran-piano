/*
 * entrenamiento.js — página Entrenamiento: medidor de rango vocal,
 * cronómetro de nota sostenida (con análisis de vibrato), messa di voce
 * (control de volumen), control de aire (soplido sostenido) y
 * espectrograma en vivo. Usa
 * `el`/`midiANombre`/`nombreAMidi`/`VOCES` de escalas.js,
 * `marcarTeclaActiva`/`mostrarAfinometro`/`actualizarAfinometro` de
 * teclado.js, y `crearRng`... del motor de audio/mic de audio.js.
 */

let entrenModoActual = "rango";
let entrenEnCurso = false;

function cambiarSubmodoEntrenamiento(modo) {
  if (entrenEnCurso) detenerTodoEntrenamiento();
  entrenModoActual = modo;
  document.querySelectorAll(".subtab").forEach((btn) => {
    const activo = btn.dataset.entren === modo;
    btn.classList.toggle("activo", activo);
    btn.setAttribute("aria-selected", String(activo));
  });
  el("panel-rango").hidden = modo !== "rango";
  el("panel-sovt").hidden = modo !== "sovt";
  el("panel-sostenida").hidden = modo !== "sostenida";
  el("panel-messa").hidden = modo !== "messa";
  el("panel-aire").hidden = modo !== "aire";
  el("panel-espectro").hidden = modo !== "espectro";
  el("panel-grabadora").hidden = modo !== "grabadora";
  el("estadoEntrenamiento").textContent = "";
}

// --- Rango vocal ----------------------------------------------------------

let rangoMinDetectado = null;
let rangoMaxDetectado = null;
let rangoTeclaAnterior = null;

function sugerirTipoVoz(minMidi, maxMidi) {
  const centro = (minMidi + maxMidi) / 2;
  let mejor = null;
  let mejorDist = Infinity;
  for (const voz of Object.values(VOCES)) {
    const vCentro = (nombreAMidi(voz.rango[0]) + nombreAMidi(voz.rango[1])) / 2;
    const dist = Math.abs(centro - vCentro);
    if (dist < mejorDist) {
      mejorDist = dist;
      mejor = voz.nombre;
    }
  }
  return mejor;
}

async function iniciarRango() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estadoEntrenamiento").textContent = "Este navegador no permite usar el micrófono aquí.";
    return;
  }
  rangoMinDetectado = null;
  rangoMaxDetectado = null;
  rangoTeclaAnterior = null;
  el("rangoResultado").textContent = "";
  el("rangoNotaActual").textContent = "—";
  el("btnRangoIniciar").disabled = true;
  el("btnRangoDetener").disabled = false;
  entrenEnCurso = true;

  try {
    el("estadoEntrenamiento").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
    el("estadoEntrenamiento").textContent = "Canta de tu nota más grave a la más aguda, sube y baja las veces que quieras…";
  } catch (err) {
    el("estadoEntrenamiento").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    finalizarRango(false);
    return;
  }

  window.MicrofonoEngine.escucharContinuo((lectura) => {
    if (!entrenEnCurso) return;
    if (!lectura) {
      if (rangoTeclaAnterior !== null) {
        marcarTeclaActiva(rangoTeclaAnterior, false);
        rangoTeclaAnterior = null;
      }
      el("rangoNotaActual").textContent = "—";
      return;
    }
    const midiRedondeado = Math.round(lectura.midiExacto);
    if (midiRedondeado !== rangoTeclaAnterior) {
      if (rangoTeclaAnterior !== null) marcarTeclaActiva(rangoTeclaAnterior, false);
      marcarTeclaActiva(midiRedondeado, true);
      rangoTeclaAnterior = midiRedondeado;
    }
    el("rangoNotaActual").textContent = midiANombre(midiRedondeado);
    if (rangoMinDetectado === null || midiRedondeado < rangoMinDetectado) rangoMinDetectado = midiRedondeado;
    if (rangoMaxDetectado === null || midiRedondeado > rangoMaxDetectado) rangoMaxDetectado = midiRedondeado;
  });
}

function detenerRango() {
  finalizarRango(true);
}

function finalizarRango(mostrarResultado) {
  entrenEnCurso = false;
  if (window.MicrofonoEngine) {
    window.MicrofonoEngine.detenerContinuo();
  }
  if (rangoTeclaAnterior !== null) {
    marcarTeclaActiva(rangoTeclaAnterior, false);
    rangoTeclaAnterior = null;
  }
  el("btnRangoIniciar").disabled = false;
  el("btnRangoDetener").disabled = true;
  if (!mostrarResultado) return;

  if (rangoMinDetectado === null) {
    el("estadoEntrenamiento").textContent = "No pude detectar tu voz. Prueba de nuevo más cerca del micrófono.";
    return;
  }
  const semitonos = rangoMaxDetectado - rangoMinDetectado;
  const vozSugerida = sugerirTipoVoz(rangoMinDetectado, rangoMaxDetectado);
  el("rangoResultado").textContent =
    `Tu rango: ${midiANombre(rangoMinDetectado)} – ${midiANombre(rangoMaxDetectado)} (${semitonos} semitonos). Tipo de voz más cercano: ${vozSugerida}.`;

  const record = Progreso.actualizarRecord("rangoMinMidi", rangoMinDetectado, (n, a) => n < a);
  const record2 = Progreso.actualizarRecord("rangoMaxMidi", rangoMaxDetectado, (n, a) => n > a);
  el("estadoEntrenamiento").textContent = record || record2 ? "🏆 ¡Nuevo récord de rango vocal!" : "";
}

// --- SOVT / Sirena libre (calentamiento y enfriamiento) --------------------
// Deslizar libremente de grave a agudo mientras se hace una técnica de
// tracto vocal semi-ocluido (trino de labios, pajita, zumbido) o solo con
// la voz, tipo sirena. No mide nada al final: es un ejercicio de proceso,
// no de resultado — solo muestra la nota actual mientras el alumno se
// mueve por su rango, igual que "Rango vocal" pero sin resumen final.

const SOVT_INSTRUCCIONES = {
  voz: "🎤 Desliza tu voz libremente de grave a agudo y de vuelta, como una sirena.",
  trino: '🎤 Haz un trino de labios ("brrr") mientras deslizas de grave a agudo y de vuelta.',
  pajita: "🎤 Sopla y vocaliza a través de una pajita mientras deslizas de grave a agudo y de vuelta.",
  zumbido: '🎤 Zumba con los labios cerrados ("mmm") mientras deslizas de grave a agudo y de vuelta.',
};

let sovtInicioMs = null;
let sovtTeclaAnterior = null;

async function iniciarSovt() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estadoEntrenamiento").textContent = "Este navegador no permite usar el micrófono aquí.";
    return;
  }
  sovtInicioMs = null;
  sovtTeclaAnterior = null;
  el("sovtNotaActual").textContent = "—";
  el("sovtTiempo").textContent = "";
  el("btnSovtIniciar").disabled = true;
  el("btnSovtDetener").disabled = false;
  entrenEnCurso = true;

  try {
    el("estadoEntrenamiento").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
    el("estadoEntrenamiento").textContent = SOVT_INSTRUCCIONES[el("sovtTecnica").value];
  } catch (err) {
    el("estadoEntrenamiento").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    finalizarSovt(false);
    return;
  }

  sovtInicioMs = performance.now();
  window.MicrofonoEngine.escucharContinuo((lectura) => {
    if (!entrenEnCurso) return;
    if (sovtInicioMs !== null) {
      el("sovtTiempo").textContent = `Llevas: ${((performance.now() - sovtInicioMs) / 1000).toFixed(0)}s`;
    }
    if (!lectura) {
      if (sovtTeclaAnterior !== null) {
        marcarTeclaActiva(sovtTeclaAnterior, false);
        sovtTeclaAnterior = null;
      }
      el("sovtNotaActual").textContent = "—";
      return;
    }
    const midiRedondeado = Math.round(lectura.midiExacto);
    if (midiRedondeado !== sovtTeclaAnterior) {
      if (sovtTeclaAnterior !== null) marcarTeclaActiva(sovtTeclaAnterior, false);
      marcarTeclaActiva(midiRedondeado, true);
      sovtTeclaAnterior = midiRedondeado;
    }
    el("sovtNotaActual").textContent = midiANombre(midiRedondeado);
  });
}

function detenerSovt() {
  finalizarSovt(true);
}

function finalizarSovt(mostrarResultado) {
  entrenEnCurso = false;
  if (window.MicrofonoEngine) {
    window.MicrofonoEngine.detenerContinuo();
  }
  if (sovtTeclaAnterior !== null) {
    marcarTeclaActiva(sovtTeclaAnterior, false);
    sovtTeclaAnterior = null;
  }
  el("btnSovtIniciar").disabled = false;
  el("btnSovtDetener").disabled = true;
  if (!mostrarResultado) return;
  const duracion = sovtInicioMs !== null ? (performance.now() - sovtInicioMs) / 1000 : 0;
  el("estadoEntrenamiento").textContent = duracion >= 1 ? `Buen trabajo — ${duracion.toFixed(0)} segundos de práctica.` : "";
}

// --- Nota sostenida (+ vibrato) --------------------------------------------

let sostenidaMuestrasCents = [];
let sostenidaInicioMs = null;
let sostenidaFrecuenciaRef = null;
let sostenidaUltimoSonidoMs = null;
let sostenidaTemporizadorId = null;
const SOSTENIDA_SILENCIO_LIMITE_MS = 700;

function dibujarGraficoPitch(canvas, muestras) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#282020";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  if (muestras.length < 2) return;
  const limite = 100; // +-100 cents visibles; más allá se recorta en la gráfica
  ctx.strokeStyle = "#c02241";
  ctx.lineWidth = 2;
  ctx.beginPath();
  muestras.forEach((cents, i) => {
    const x = (i / (muestras.length - 1)) * w;
    const recortado = Math.max(-limite, Math.min(limite, cents));
    const y = h / 2 - (recortado / limite) * (h / 2 - 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function analizarVibrato(muestrasCents, duracionTotal) {
  if (muestrasCents.length < 10 || duracionTotal <= 0) return null;
  const media = muestrasCents.reduce((a, b) => a + b, 0) / muestrasCents.length;
  let cruces = 0;
  for (let i = 1; i < muestrasCents.length; i++) {
    if ((muestrasCents[i - 1] - media) * (muestrasCents[i] - media) < 0) cruces++;
  }
  const tasaHz = cruces / 2 / duracionTotal;
  const maximo = Math.max(...muestrasCents);
  const minimo = Math.min(...muestrasCents);
  return { tasaHz, profundidad: (maximo - minimo) / 2 };
}

async function iniciarSostenida() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estadoEntrenamiento").textContent = "Este navegador no permite usar el micrófono aquí.";
    return;
  }
  sostenidaMuestrasCents = [];
  sostenidaInicioMs = null;
  sostenidaFrecuenciaRef = null;
  sostenidaUltimoSonidoMs = null;
  el("sostenidaResultado").textContent = "";
  el("sostenidaTiempo").textContent = "0.0s";
  el("sostenidaVibratoEnVivo").textContent = "";
  dibujarGraficoPitch(el("sostenidaGrafico"), []);
  el("btnSostenidaIniciar").disabled = true;
  el("btnSostenidaDetener").disabled = false;
  entrenEnCurso = true;

  try {
    el("estadoEntrenamiento").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
    el("estadoEntrenamiento").textContent = "🎤 Canta y sostén la nota…";
  } catch (err) {
    el("estadoEntrenamiento").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    finalizarSostenida(false);
    return;
  }

  mostrarAfinometro(true);
  sostenidaTemporizadorId = setInterval(revisarSilencioSostenida, 100);

  window.MicrofonoEngine.escucharContinuo((lectura) => {
    if (!entrenEnCurso) return;
    if (!lectura) {
      actualizarAfinometro(null);
      return;
    }
    const ahora = performance.now();
    sostenidaUltimoSonidoMs = ahora;
    if (sostenidaFrecuenciaRef === null) {
      sostenidaFrecuenciaRef = lectura.frecuencia;
      sostenidaInicioMs = ahora;
    }
    const cents = 1200 * Math.log2(lectura.frecuencia / sostenidaFrecuenciaRef);
    sostenidaMuestrasCents.push(cents);
    actualizarAfinometro(cents);
    el("sostenidaTiempo").textContent = `${((ahora - sostenidaInicioMs) / 1000).toFixed(1)}s`;
    dibujarGraficoPitch(el("sostenidaGrafico"), sostenidaMuestrasCents);
    actualizarVibratoEnVivo();
  });
}

// Ventana deslizante de ~1.5s (a ~25 lecturas/seg) para dar feedback de
// vibrato en tiempo real, no solo al terminar — así se puede practicar
// activar y desactivar el vibrato a voluntad y ver el efecto al instante.
const SOSTENIDA_VENTANA_VIBRATO_MUESTRAS = 37;
const SOSTENIDA_INTERVALO_LECTURA_S = 0.04;

function actualizarVibratoEnVivo() {
  const elemento = el("sostenidaVibratoEnVivo");
  if (!elemento) return;
  if (sostenidaMuestrasCents.length < SOSTENIDA_VENTANA_VIBRATO_MUESTRAS) {
    elemento.textContent = "";
    return;
  }
  const ventana = sostenidaMuestrasCents.slice(-SOSTENIDA_VENTANA_VIBRATO_MUESTRAS);
  const analisis = analizarVibrato(ventana, ventana.length * SOSTENIDA_INTERVALO_LECTURA_S);
  if (analisis && analisis.tasaHz >= 3 && analisis.tasaHz <= 9 && analisis.profundidad >= 8) {
    elemento.textContent = `🎶 Vibrato activo (~${analisis.tasaHz.toFixed(1)} Hz)`;
  } else {
    elemento.textContent = "➖ Sonido estable (sin vibrato)";
  }
}

function revisarSilencioSostenida() {
  if (!entrenEnCurso || sostenidaUltimoSonidoMs === null) return;
  if (performance.now() - sostenidaUltimoSonidoMs > SOSTENIDA_SILENCIO_LIMITE_MS) {
    finalizarSostenida(true);
  }
}

function detenerSostenida() {
  finalizarSostenida(true);
}

function finalizarSostenida(mostrarResultado) {
  entrenEnCurso = false;
  mostrarAfinometro(false);
  if (sostenidaTemporizadorId) {
    clearInterval(sostenidaTemporizadorId);
    sostenidaTemporizadorId = null;
  }
  if (window.MicrofonoEngine) {
    window.MicrofonoEngine.detenerContinuo();
  }
  el("btnSostenidaIniciar").disabled = false;
  el("btnSostenidaDetener").disabled = true;
  if (!mostrarResultado) return;

  if (sostenidaInicioMs === null) {
    el("estadoEntrenamiento").textContent = "No pude detectar tu voz. Prueba de nuevo más cerca del micrófono.";
    return;
  }
  const finMs = Math.min(sostenidaUltimoSonidoMs ?? performance.now(), performance.now());
  const duracion = (finMs - sostenidaInicioMs) / 1000;
  el("sostenidaTiempo").textContent = `${duracion.toFixed(1)}s`;

  const analisis = analizarVibrato(sostenidaMuestrasCents, duracion);
  let texto = `Sostuviste la nota ${duracion.toFixed(1)} segundos.`;
  if (analisis && analisis.tasaHz >= 3 && analisis.tasaHz <= 9 && analisis.profundidad >= 8) {
    texto += ` Vibrato detectado: ~${analisis.tasaHz.toFixed(1)} Hz, profundidad ~${Math.round(analisis.profundidad)} cents.`;
  } else if (analisis) {
    texto += ` Mantuviste el tono bastante estable (variación media ~${Math.round(analisis.profundidad)} cents).`;
  }
  el("sostenidaResultado").textContent = texto;

  const record = duracion >= 1 && Progreso.actualizarRecord("sostenidaMejorSegundos", duracion, (n, a) => n > a);
  el("estadoEntrenamiento").textContent = record ? "🏆 ¡Nuevo récord de nota sostenida!" : "";
}

// --- Messa di voce (control de aire y volumen: crescendo-diminuendo) ------

let messaVolumenes = [];
let messaCentsMuestras = [];
let messaFrecuenciaRef = null;
let messaInicioMs = null;
let messaAnimId = null;
let messaAnalizador = null;
let messaBufferVolumen = null;
const MESSA_DURACION_MAXIMA_MS = 20000;

function dibujarGraficoVolumen(canvas, volumenes) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#282020";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 1);
  ctx.lineTo(w, h - 1);
  ctx.stroke();
  if (volumenes.length < 2) return;
  ctx.strokeStyle = "#c02241";
  ctx.lineWidth = 2;
  ctx.beginPath();
  volumenes.forEach((v, i) => {
    const x = (i / (volumenes.length - 1)) * w;
    // Escala aproximada: la voz cantada rara vez pasa de ~0.3 de RMS en
    // señal normalizada; se recorta a 1 para que picos fuertes no salgan
    // del lienzo.
    const y = h - Math.min(1, v * 6) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function fraccionMonotonaVolumen(muestras, creciente) {
  if (muestras.length < 2) return 1;
  let ok = 0;
  for (let i = 1; i < muestras.length; i++) {
    const delta = muestras[i] - muestras[i - 1];
    const bien = creciente ? delta >= -0.003 : delta <= 0.003;
    if (bien) ok++;
  }
  return ok / (muestras.length - 1);
}

function bucleMessa() {
  if (!entrenEnCurso) return;
  messaAnalizador.getFloatTimeDomainData(messaBufferVolumen);
  let sumaCuadrados = 0;
  for (let i = 0; i < messaBufferVolumen.length; i++) {
    sumaCuadrados += messaBufferVolumen[i] * messaBufferVolumen[i];
  }
  const rms = Math.sqrt(sumaCuadrados / messaBufferVolumen.length);
  messaVolumenes.push(rms);
  dibujarGraficoVolumen(el("messaGrafico"), messaVolumenes);
  if (performance.now() - messaInicioMs > MESSA_DURACION_MAXIMA_MS) {
    finalizarMessa(true);
    return;
  }
  messaAnimId = requestAnimationFrame(bucleMessa);
}

async function iniciarMessa() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estadoEntrenamiento").textContent = "Este navegador no permite usar el micrófono aquí.";
    return;
  }
  messaVolumenes = [];
  messaCentsMuestras = [];
  messaFrecuenciaRef = null;
  el("messaResultado").textContent = "";
  dibujarGraficoVolumen(el("messaGrafico"), []);
  el("btnMessaIniciar").disabled = true;
  el("btnMessaDetener").disabled = false;
  entrenEnCurso = true;

  try {
    el("estadoEntrenamiento").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
    el("estadoEntrenamiento").textContent =
      "🎤 Empieza muy suave, crece hasta el máximo y vuelve a bajar — misma nota, misma respiración…";
  } catch (err) {
    el("estadoEntrenamiento").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    finalizarMessa(false);
    return;
  }

  messaAnalizador = window.MicrofonoEngine.obtenerAnalizador();
  messaBufferVolumen = new Float32Array(messaAnalizador.fftSize);
  messaInicioMs = performance.now();
  mostrarAfinometro(true);
  bucleMessa();

  window.MicrofonoEngine.escucharContinuo((lectura) => {
    if (!entrenEnCurso) return;
    if (!lectura) {
      actualizarAfinometro(null);
      return;
    }
    if (messaFrecuenciaRef === null) messaFrecuenciaRef = lectura.frecuencia;
    const cents = 1200 * Math.log2(lectura.frecuencia / messaFrecuenciaRef);
    messaCentsMuestras.push(cents);
    actualizarAfinometro(cents);
  });
}

function detenerMessa() {
  finalizarMessa(true);
}

function finalizarMessa(mostrarResultado) {
  entrenEnCurso = false;
  mostrarAfinometro(false);
  if (messaAnimId) {
    cancelAnimationFrame(messaAnimId);
    messaAnimId = null;
  }
  if (window.MicrofonoEngine) {
    window.MicrofonoEngine.detenerContinuo();
  }
  el("btnMessaIniciar").disabled = false;
  el("btnMessaDetener").disabled = true;
  if (!mostrarResultado) return;

  if (messaVolumenes.length < 15) {
    el("messaResultado").textContent =
      "No pude captar suficiente señal. Prueba de nuevo, más cerca del micrófono y durante más tiempo.";
    return;
  }

  // Promedio móvil corto: puntúa la forma general, no el ruido muestra a muestra.
  const ventana = 5;
  const suavizado = messaVolumenes.map((_, i) => {
    const trozo = messaVolumenes.slice(Math.max(0, i - ventana), i + 1);
    return trozo.reduce((a, b) => a + b, 0) / trozo.length;
  });

  let picoIdx = 0;
  for (let i = 1; i < suavizado.length; i++) {
    if (suavizado[i] > suavizado[picoIdx]) picoIdx = i;
  }
  const posicionPico = picoIdx / (suavizado.length - 1);
  const pico = suavizado[picoIdx];
  const inicio = suavizado[0];
  const fin = suavizado[suavizado.length - 1];

  const fraccionSube = fraccionMonotonaVolumen(suavizado.slice(0, picoIdx + 1), true);
  const fraccionBaja = fraccionMonotonaVolumen(suavizado.slice(picoIdx), false);
  const contraste = pico - Math.min(inicio, fin);

  const avisos = [];
  if (posicionPico < 0.15 || posicionPico > 0.85) {
    avisos.push("el punto más fuerte quedó casi al principio o al final — repártelo más hacia la mitad");
  }
  if (contraste < 0.02) {
    avisos.push("hubo poco contraste entre el susurro y el máximo volumen — exagera más la diferencia");
  }
  if (fraccionSube < 0.6) {
    avisos.push("la subida fue irregular — intenta crecer de forma más continua, sin saltos");
  }
  if (fraccionBaja < 0.6) {
    avisos.push("la bajada fue irregular — intenta apagar el sonido de forma más continua");
  }
  const analisisPitch = analizarVibrato(messaCentsMuestras, (performance.now() - messaInicioMs) / 1000);
  if (analisisPitch && analisisPitch.profundidad > 60) {
    avisos.push("la nota se movió bastante — intenta mantener exactamente el mismo tono todo el tiempo");
  }

  el("messaResultado").textContent =
    avisos.length === 0
      ? "¡Muy buen globo! Crescendo y diminuendo continuos, con buen contraste de volumen."
      : "Para mejorar: " + avisos.join("; ") + ".";
}

// --- Control de aire (soplido sostenido, sin cuerdas vocales) --------------

let aireVolumenes = [];
let aireInicioMs = null;
let aireUltimoSonidoMs = null;
let aireAnimId = null;
let aireTemporizadorId = null;
let aireAnalizador = null;
let aireBufferVolumen = null;
const AIRE_UMBRAL_SONIDO = 0.012;
const AIRE_SILENCIO_LIMITE_MS = 700;
const AIRE_DURACION_MAXIMA_MS = 60000;

function bucleAire() {
  if (!entrenEnCurso) return;
  aireAnalizador.getFloatTimeDomainData(aireBufferVolumen);
  let sumaCuadrados = 0;
  for (let i = 0; i < aireBufferVolumen.length; i++) {
    sumaCuadrados += aireBufferVolumen[i] * aireBufferVolumen[i];
  }
  const rms = Math.sqrt(sumaCuadrados / aireBufferVolumen.length);
  const ahora = performance.now();
  if (rms >= AIRE_UMBRAL_SONIDO) {
    if (aireInicioMs === null) aireInicioMs = ahora;
    aireUltimoSonidoMs = ahora;
    aireVolumenes.push(rms);
  }
  if (aireInicioMs !== null) {
    el("aireTiempo").textContent = `${((ahora - aireInicioMs) / 1000).toFixed(1)}s`;
  }
  dibujarGraficoVolumen(el("aireGrafico"), aireVolumenes);
  if (aireInicioMs !== null && ahora - aireInicioMs > AIRE_DURACION_MAXIMA_MS) {
    finalizarAire(true);
    return;
  }
  aireAnimId = requestAnimationFrame(bucleAire);
}

function revisarSilencioAire() {
  if (!entrenEnCurso || aireUltimoSonidoMs === null) return;
  if (performance.now() - aireUltimoSonidoMs > AIRE_SILENCIO_LIMITE_MS) {
    finalizarAire(true);
  }
}

async function iniciarAire() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estadoEntrenamiento").textContent = "Este navegador no permite usar el micrófono aquí.";
    return;
  }
  aireVolumenes = [];
  aireInicioMs = null;
  aireUltimoSonidoMs = null;
  el("aireResultado").textContent = "";
  el("aireTiempo").textContent = "0.0s";
  dibujarGraficoVolumen(el("aireGrafico"), []);
  el("btnAireIniciar").disabled = true;
  el("btnAireDetener").disabled = false;
  entrenEnCurso = true;

  try {
    el("estadoEntrenamiento").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
    el("estadoEntrenamiento").textContent = "💨 Haz una 'sss' o 'fff' larga y pareja…";
  } catch (err) {
    el("estadoEntrenamiento").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    finalizarAire(false);
    return;
  }

  aireAnalizador = window.MicrofonoEngine.obtenerAnalizador();
  aireBufferVolumen = new Float32Array(aireAnalizador.fftSize);
  aireTemporizadorId = setInterval(revisarSilencioAire, 100);
  bucleAire();
}

function detenerAire() {
  finalizarAire(true);
}

function finalizarAire(mostrarResultado) {
  entrenEnCurso = false;
  if (aireAnimId) {
    cancelAnimationFrame(aireAnimId);
    aireAnimId = null;
  }
  if (aireTemporizadorId) {
    clearInterval(aireTemporizadorId);
    aireTemporizadorId = null;
  }
  el("btnAireIniciar").disabled = false;
  el("btnAireDetener").disabled = true;
  if (!mostrarResultado) return;

  if (aireInicioMs === null) {
    el("estadoEntrenamiento").textContent =
      "No detecté suficiente sonido. Acércate al micrófono y haz una 'sss' más fuerte.";
    return;
  }
  const finMs = Math.min(aireUltimoSonidoMs, performance.now());
  const duracion = (finMs - aireInicioMs) / 1000;
  el("aireTiempo").textContent = `${duracion.toFixed(1)}s`;

  let texto = `Aguantaste ${duracion.toFixed(1)} segundos de aire.`;
  if (aireVolumenes.length >= 10) {
    const media = aireVolumenes.reduce((a, b) => a + b, 0) / aireVolumenes.length;
    const varianza = aireVolumenes.reduce((a, b) => a + (b - media) ** 2, 0) / aireVolumenes.length;
    const coefVariacion = Math.sqrt(varianza) / media;
    if (coefVariacion < 0.25) {
      texto += " Muy buen control: mantuviste el caudal de aire prácticamente constante.";
    } else if (coefVariacion < 0.5) {
      texto += " Buen control, aunque el caudal varió un poco — intenta que no suba ni baje de volumen.";
    } else {
      texto += " El caudal de aire fue irregular — practica mantener la misma presión todo el tiempo, sin acentos ni caídas.";
    }
  }
  el("aireResultado").textContent = texto;

  const record = duracion >= 1 && Progreso.actualizarRecord("aireMejorSegundos", duracion, (n, a) => n > a);
  el("estadoEntrenamiento").textContent = record ? "🏆 ¡Nuevo récord de control de aire!" : "";
}

// --- Init -----------------------------------------------------------------

// --- Espectrograma en vivo -------------------------------------------------

let espectroAnimId = null;
let espectroDatos = null;

function colorParaIntensidad(valor) {
  const t = valor / 255;
  if (t < 0.35) return `rgba(20,14,14,${(t / 0.35) * 0.6})`;
  if (t < 0.7) {
    const p = (t - 0.35) / 0.35;
    return `rgb(${Math.round(90 + p * 100)}, ${Math.round(20 + p * 20)}, ${Math.round(30 + p * 10)})`;
  }
  const p = (t - 0.7) / 0.3;
  return `rgb(${Math.round(190 + p * 60)}, ${Math.round(40 + p * 140)}, ${Math.round(60 + p * 140)})`;
}

function dibujarColumnaEspectro(canvas, datos, sampleRate) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  // Desplaza todo el contenido un píxel a la izquierda (efecto "scroll")...
  const imagen = ctx.getImageData(1, 0, w - 1, h);
  ctx.putImageData(imagen, 0, 0);
  // ...y pinta la columna nueva a la derecha, solo hasta 4000 Hz (rango útil
  // de voz: fundamentales + primeros armónicos) para aprovechar el alto.
  const freqMax = 4000;
  const nyquist = sampleRate / 2;
  const binCount = datos.length;
  for (let y = 0; y < h; y++) {
    const freq = (1 - y / h) * freqMax;
    const bin = Math.min(binCount - 1, Math.round((freq / nyquist) * binCount));
    ctx.fillStyle = colorParaIntensidad(datos[bin]);
    ctx.fillRect(w - 1, y, 1, 1);
  }
}

/** Energía media (en las unidades 0-255 de getByteFrequencyData, no en dB
 * ni en potencia física real) dentro de uno o varios rangos [f1,f2] en Hz —
 * sirve para comparar bandas entre sí, no como medición acústica absoluta. */
function promedioEnergiaBandas(datos, sampleRate, rangos) {
  const nyquist = sampleRate / 2;
  const binCount = datos.length;
  const bin = (freq) => Math.min(binCount - 1, Math.max(0, Math.round((freq / nyquist) * binCount)));
  let suma = 0;
  let n = 0;
  for (const [f1, f2] of rangos) {
    for (let i = bin(f1); i <= bin(f2); i++) {
      suma += datos[i];
      n++;
    }
  }
  return n > 0 ? suma / n : 0;
}

/** Índice aproximado de "brillo"/proyección: cuánta energía hay en la banda
 * del formante del cantante (2.5-3.5 kHz) COMPARADA con el resto del rango
 * vocal útil (300 Hz-4 kHz, excluyendo esa banda) — no con el nivel general,
 * para que una señal plana no salga siempre al máximo. Una razón de 1.0
 * (misma energía que alrededor) se dibuja a mitad de barra; el doble de
 * energía relativa (2.0) llena la barra entera. No es una medición clínica
 * de twang ni de formantes reales, y depende del micrófono y de la vocal
 * cantada — sirve para comparar dentro de la misma toma, no entre sesiones
 * o dispositivos distintos. */
function indiceBrillo(datos, sampleRate) {
  const nivelGeneral = promedioEnergiaBandas(datos, sampleRate, [[300, 4000]]);
  if (nivelGeneral < 8) return null; // silencio o señal demasiado débil: no fiable
  const formante = promedioEnergiaBandas(datos, sampleRate, [[2500, 3500]]);
  const resto = promedioEnergiaBandas(datos, sampleRate, [
    [300, 2490],
    [3510, 4000],
  ]);
  const razon = resto > 0 ? formante / resto : formante > 0 ? 2 : 0;
  return Math.max(0, Math.min(100, Math.round((razon / 2) * 100)));
}

function actualizarMedidorBrillo(brillo) {
  if (brillo === null) {
    el("brilloValor").textContent = "—";
    el("brilloBarra").style.width = "0%";
    return;
  }
  el("brilloValor").textContent = `${brillo}%`;
  el("brilloBarra").style.width = `${brillo}%`;
}

function bucleEspectro(analizador, canvas) {
  if (!entrenEnCurso) return;
  analizador.getByteFrequencyData(espectroDatos);
  const sampleRate = obtenerContexto().sampleRate;
  dibujarColumnaEspectro(canvas, espectroDatos, sampleRate);
  actualizarMedidorBrillo(indiceBrillo(espectroDatos, sampleRate));
  espectroAnimId = requestAnimationFrame(() => bucleEspectro(analizador, canvas));
}

async function iniciarEspectro() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estadoEntrenamiento").textContent = "Este navegador no permite usar el micrófono aquí.";
    return;
  }
  const canvas = el("espectroGrafico");
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  actualizarMedidorBrillo(null);
  el("btnEspectroIniciar").disabled = true;
  el("btnEspectroDetener").disabled = false;
  entrenEnCurso = true;

  try {
    el("estadoEntrenamiento").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
    el("estadoEntrenamiento").textContent = "🎤 Canta o vocaliza y observa tu espectro…";
  } catch (err) {
    el("estadoEntrenamiento").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    finalizarEspectro();
    return;
  }

  const analizador = window.MicrofonoEngine.obtenerAnalizador();
  espectroDatos = new Uint8Array(analizador.frequencyBinCount);
  bucleEspectro(analizador, canvas);
}

function detenerEspectro() {
  finalizarEspectro();
  el("estadoEntrenamiento").textContent = "";
}

function finalizarEspectro() {
  entrenEnCurso = false;
  if (espectroAnimId) {
    cancelAnimationFrame(espectroAnimId);
    espectroAnimId = null;
  }
  el("btnEspectroIniciar").disabled = false;
  el("btnEspectroDetener").disabled = true;
  actualizarMedidorBrillo(null);
}

function detenerTodoEntrenamiento() {
  finalizarRango(false);
  finalizarSovt(false);
  finalizarSostenida(false);
  finalizarMessa(false);
  finalizarAire(false);
  finalizarEspectro();
  if (window.Grabadora) window.Grabadora.detener();
}

function inicializarEntrenamiento() {
  if (window.Progreso) Progreso.marcarHerramientaUsada("entrenamiento");
  inicializarPiano(); // teclado.js: sin callback propio, tocar una tecla solo la previsualiza
  document.querySelectorAll(".subtab").forEach((btn) => {
    btn.addEventListener("click", () => cambiarSubmodoEntrenamiento(btn.dataset.entren));
  });
  el("btnRangoIniciar").addEventListener("click", iniciarRango);
  el("btnRangoDetener").addEventListener("click", detenerRango);
  el("btnSovtIniciar").addEventListener("click", iniciarSovt);
  el("btnSovtDetener").addEventListener("click", detenerSovt);
  el("btnSostenidaIniciar").addEventListener("click", iniciarSostenida);
  el("btnSostenidaDetener").addEventListener("click", detenerSostenida);
  el("btnMessaIniciar").addEventListener("click", iniciarMessa);
  el("btnMessaDetener").addEventListener("click", detenerMessa);
  el("btnAireIniciar").addEventListener("click", iniciarAire);
  el("btnAireDetener").addEventListener("click", detenerAire);
  el("btnEspectroIniciar").addEventListener("click", iniciarEspectro);
  el("btnEspectroDetener").addEventListener("click", detenerEspectro);
}

document.addEventListener("DOMContentLoaded", inicializarEntrenamiento);
