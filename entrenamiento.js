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
  if (modo === "twang") modo = "espectro"; // Espectro y Twang son una sola herramienta (enlaces antiguos ?tab=twang)
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
  // Espectro y Twang: una sola herramienta (nota, twang, espectrograma y curva).
  el("panel-espectro").hidden = modo !== "espectro";
  if (modo === "espectro") {
    dibujarHistorialTwang(performance.now());
    dibujarCurva();
  }
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
  for (const [clave, voz] of Object.entries(VOCES)) {
    if (clave === "completo" || clave === "personalizado") continue;
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

// Nota objetivo elegida tocando una tecla del piano mientras está abierto
// "Nota sostenida" (y no hay una toma en curso). Con objetivo, la aguja y la
// gráfica miden contra ESA nota; sin objetivo, contra la primera nota cantada.
let sostenidaObjetivoMidi = null;
let sostenidaOctavaCantada = 0;
let sostenidaOctavas = {}; // octava cantada respecto al objetivo -> nº de lecturas

function manejarClicPianoEntrenamiento(midi) {
  previsualizarNotaPiano(midi);
  if (el("panel-sostenida").hidden || entrenEnCurso) return;
  const eraLaMisma = sostenidaObjetivoMidi === midi;
  document.querySelectorAll("#piano .tecla.seleccionada").forEach((t) => t.classList.remove("seleccionada"));
  sostenidaObjetivoMidi = eraLaMisma ? null : midi;
  if (!eraLaMisma) {
    const tecla = el("piano").querySelector(`[data-midi="${midi}"]`);
    if (tecla) tecla.classList.add("seleccionada");
  }
  el("estadoEntrenamiento").textContent =
    sostenidaObjetivoMidi === null
      ? "Sin nota objetivo: se mide la primera nota que cantes."
      : `🎯 Nota objetivo: ${midiANombre(midi)}. Pulsa Empezar y canta esa nota.`;
}

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
  sostenidaFrecuenciaRef = sostenidaObjetivoMidi !== null ? midiAFrecuencia(sostenidaObjetivoMidi) : null;
  sostenidaOctavaCantada = 0;
  sostenidaOctavas = {};
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
    if (sostenidaInicioMs === null) {
      sostenidaInicioMs = ahora;
      if (sostenidaFrecuenciaRef === null) sostenidaFrecuenciaRef = lectura.frecuencia;
    }
    let cents = 1200 * Math.log2(lectura.frecuencia / sostenidaFrecuenciaRef);
    if (sostenidaObjetivoMidi !== null) {
      // Se mide la estabilidad dentro de la octava más cercana, pero la octava se anota: si no es la del
      // objetivo, la toma no cuenta (el resultado y el aviso en vivo lo dicen).
      sostenidaOctavaCantada = Math.round(cents / 1200);
      sostenidaOctavas[sostenidaOctavaCantada] = (sostenidaOctavas[sostenidaOctavaCantada] || 0) + 1;
      cents -= 1200 * sostenidaOctavaCantada;
    }
    sostenidaMuestrasCents.push(cents);
    actualizarAfinometro(cents);
    el("sostenidaTiempo").textContent = `${((ahora - sostenidaInicioMs) / 1000).toFixed(1)}s`;
    dibujarGraficoPitch(el("sostenidaGrafico"), sostenidaMuestrasCents);
    actualizarVibratoEnVivo();
    if (sostenidaObjetivoMidi !== null && sostenidaOctavaCantada !== 0) {
      el("sostenidaVibratoEnVivo").textContent =
        `⚠ Una octava ${sostenidaOctavaCantada > 0 ? "más arriba" : "más abajo"} del objetivo (${midiANombre(sostenidaObjetivoMidi)})`;
    }
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
  let octavaOk = true;
  if (sostenidaObjetivoMidi !== null) {
    const lecturas = Object.entries(sostenidaOctavas);
    const total = lecturas.reduce((a, [, n]) => a + n, 0);
    const enSuOctava = sostenidaOctavas[0] || 0;
    octavaOk = total === 0 || enSuOctava / total >= 0.8;
    if (octavaOk) {
      texto += ` ✅ Nota correcta: ${midiANombre(sostenidaObjetivoMidi)}.`;
    } else {
      const dominante = Number(lecturas.sort((a, b) => b[1] - a[1])[0][0]);
      texto +=
        ` ❌ El objetivo era ${midiANombre(sostenidaObjetivoMidi)} y cantaste ${midiANombre(sostenidaObjetivoMidi + 12 * dominante)} ` +
        `(${Math.abs(dominante) === 1 ? "una octava" : Math.abs(dominante) + " octavas"} ${dominante > 0 ? "más arriba" : "más abajo"}). No cuenta.`;
    }
  }
  if (analisis && analisis.tasaHz >= 3 && analisis.tasaHz <= 9 && analisis.profundidad >= 8) {
    texto += ` Vibrato detectado: ~${analisis.tasaHz.toFixed(1)} Hz, profundidad ~${Math.round(analisis.profundidad)} cents.`;
  } else if (analisis) {
    const v = Math.round(analisis.profundidad);
    const juicio = v <= 25 ? "bastante estable" : v <= 60 ? "con algo de oscilación" : "inestable";
    texto += ` Tu tono estuvo ${juicio} (variación ~${v} cents).`;
  }
  el("sostenidaResultado").textContent = texto;

  const record = octavaOk && duracion >= 1 && Progreso.actualizarRecord("sostenidaMejorSegundos", duracion, (n, a) => n > a);
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
// 0.012 exigía soplar bastante fuerte todo el rato para no cortar el
// contador -- un "sss"/"fff" normal, sostenido pero no forzado, se quedaba
// por debajo. Bajado a una fracción de eso -- valor de partida sin calibrar
// contra un micrófono real, así que si sigue quedando corto o ahora capta
// ruido de fondo de más, hay que reajustarlo de nuevo.
const AIRE_UMBRAL_SONIDO = 0.004;
const AIRE_SILENCIO_LIMITE_MS = 900;
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
let espectroFloat = null;
let detectorTwang = null;
let calibracionTwangFin = 0;

// --- Medidor de twang (la lógica pura está en twang.js) ---
const TWANG_CLAVE_PERFIL = "aleran-twang-perfil";
const TWANG_CLAVE_SENS = "aleran-twang-sensibilidad";
const twangClaveBase = (perfil) => `aleran-twang-base-${perfil}`;

function twangLeer(clave) {
  try {
    return localStorage.getItem(clave);
  } catch (e) {
    return null;
  }
}

function twangGuardar(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, String(valor));
  } catch (e) {
    /* sin almacenamiento: funciona igual, solo no recuerda */
  }
}

function twangPerfilActual() {
  const guardado = twangLeer(TWANG_CLAVE_PERFIL);
  return guardado && window.Twang.PERFILES[guardado] ? guardado : "otro";
}

function twangSensibilidadActual() {
  const n = Number(twangLeer(TWANG_CLAVE_SENS));
  return Number.isFinite(n) ? Math.max(-3, Math.min(3, n)) : 0;
}

function twangBaseGuardada(perfil) {
  const n = twangLeer(twangClaveBase(perfil));
  return n !== null && n !== "" && Number.isFinite(Number(n)) ? Number(n) : null;
}

function crearDetectorTwang() {
  const perfil = twangPerfilActual();
  return new window.Twang.DetectorTwang({
    perfil,
    base: twangBaseGuardada(perfil),
    sensibilidadDb: twangSensibilidadActual(),
  });
}

function textoSensibilidad(v) {
  if (v === 0) return "normal";
  return v > 0 ? `+${v} (más sensible)` : `${v} (menos sensible)`;
}

function actualizarTextosTwang() {
  const perfil = twangPerfilActual();
  el("twangAyuda").textContent = window.Twang.PERFILES[perfil].ayuda;
  const base = twangBaseGuardada(perfil);
  el("twangCalibEstado").textContent = base === null
    ? "Sin calibrar: usa un valor medio."
    : "Calibrado ✓ para este micrófono.";
  const sens = twangSensibilidadActual();
  el("twangSensValor").textContent = textoSensibilidad(sens);
  const umbral = Math.max(1.5, window.Twang.UMBRAL_DELTA_DB - sens);
  el("twangUmbral").style.left = `${window.Twang.porcentajeMedidor(umbral, umbral)}%`;
}

function pintarTwang(r) {
  const visor = el("twangVisor");
  let estado = "espera";
  let texto = "Canta una vocal sostenida";
  if (r) {
    if (r.sinAgudos) {
      estado = "sin-agudos";
      texto = "Tu micrófono casi no capta agudos: la medida no es fiable";
    } else if (r.estado === "twang") {
      estado = "twang";
      texto = "Posible twang detectado";
    } else if (r.estado === "voz") {
      estado = "voz";
      texto = "Sin twang todavía";
    }
  }
  visor.dataset.estado = estado;
  el("twangTexto").textContent = texto;
  el("twangBarra").style.width = `${r ? r.porcentaje : 0}%`;
  el("twangDelta").textContent = r && r.deltaDb !== null
    ? `${r.deltaDb >= 0 ? "+" : ""}${r.deltaDb.toFixed(1)}`
    : "—";
  el("twangUnidad").textContent = detectorTwang && detectorTwang.calibrado
    ? "dB sobre tu voz normal"
    : "dB sobre una voz media (sin calibrar)";
}

/** Ajusta el lienzo al tamaño real en pantalla (y a su densidad de píxeles) y dibuja en píxeles CSS: texto y líneas nítidos. */
function prepararCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.max(1, canvas.clientWidth);
  const ch = Math.max(1, canvas.clientHeight);
  const w = Math.round(cw * dpr);
  const h = Math.round(ch * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cw, h: ch };
}

// --- Twang: historial, racha y mejor marca (pestaña Twang) -------------------
const TWANG_VENTANA_MS = 12000;
const TWANG_CLAVE_MEJOR = "aleran-twang-mejor-racha";
let twangHist = [];
let twangSesion = { racha: 0, ultimo: 0, cuadrosVoz: 0, cuadrosTwang: 0, mejor: 0 };

function twangMejorGuardada() {
  const n = Number(twangLeer(TWANG_CLAVE_MEJOR));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function twangTextoSegundos(ms) {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

function twangReiniciarSesion() {
  twangHist = [];
  twangSesion = { racha: 0, ultimo: 0, cuadrosVoz: 0, cuadrosTwang: 0, mejor: twangMejorGuardada() };
  el("twangRacha").textContent = twangTextoSegundos(0);
  el("twangMejor").textContent = twangTextoSegundos(twangSesion.mejor);
  el("twangPorcentaje").textContent = "—";
  dibujarHistorialTwang(performance.now());
}

function twangRegistrar(r, ahora) {
  const s = twangSesion;
  const dt = s.ultimo ? Math.min(100, ahora - s.ultimo) : 0;
  s.ultimo = ahora;
  const conTwang = r.estado === "twang";
  if (conTwang) s.racha += dt;
  else s.racha = 0;
  if (r.estado === "voz" || conTwang) {
    s.cuadrosVoz++;
    if (conTwang) s.cuadrosTwang++;
  }
  if (s.racha > s.mejor) s.mejor = s.racha;
  twangHist.push({ t: ahora, d: r.deltaDb, act: conTwang });
  while (twangHist.length && ahora - twangHist[0].t > TWANG_VENTANA_MS) twangHist.shift();
  el("twangRacha").textContent = twangTextoSegundos(s.racha);
  el("twangMejor").textContent = twangTextoSegundos(s.mejor);
  el("twangPorcentaje").textContent = s.cuadrosVoz > 20 ? `${Math.round((100 * s.cuadrosTwang) / s.cuadrosVoz)} %` : "—";
}

function dibujarHistorialTwang(ahora) {
  const canvas = el("twangHistorial");
  if (!canvas) return;
  const { ctx, w, h } = prepararCanvas(canvas);
  const DB_MIN = -6;
  const DB_MAX = 14;
  const y = (db) => h - ((Math.max(DB_MIN, Math.min(DB_MAX, db)) - DB_MIN) / (DB_MAX - DB_MIN)) * h;
  ctx.clearRect(0, 0, w, h);
  const umbral = detectorTwang ? detectorTwang.umbralDb : window.Twang ? window.Twang.UMBRAL_DELTA_DB : 5;
  // zona de twang (por encima del umbral)
  ctx.fillStyle = "rgba(62, 207, 110, 0.10)";
  ctx.fillRect(0, 0, w, y(umbral));
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(237, 231, 225, 0.35)";
  ctx.beginPath();
  ctx.moveTo(0, y(0));
  ctx.lineTo(w, y(0));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(237, 231, 225, 0.85)";
  ctx.beginPath();
  ctx.moveTo(0, y(umbral));
  ctx.lineTo(w, y(umbral));
  ctx.stroke();
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "rgba(237, 231, 225, 0.6)";
  ctx.textAlign = "left";
  ctx.fillText("tu voz normal", 6, y(0) - 4);
  ctx.fillStyle = "rgba(237, 231, 225, 0.95)";
  ctx.fillText("twang", 6, y(umbral) - 4);
  // trazo: verde cuando cuenta como twang
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  let previo = null;
  for (const p of twangHist) {
    if (p.d === null) {
      previo = null;
      continue;
    }
    const x = w - ((ahora - p.t) / TWANG_VENTANA_MS) * w;
    if (previo) {
      ctx.strokeStyle = p.act ? "#3ecf6e" : "#c02241";
      ctx.beginPath();
      ctx.moveTo(previo.x, previo.y);
      ctx.lineTo(x, y(p.d));
      ctx.stroke();
    }
    previo = { x, y: y(p.d) };
  }
}

// --- Espectro: curva instantánea y toma guardada para comparar (pestaña Espectro) ---
const CURVA_PUNTOS = 96;
let curvaActual = new Float32Array(CURVA_PUNTOS);
let curvaReferencia = null;

function actualizarCurva(datos, sampleRate) {
  const nyquist = sampleRate / 2;
  const n = datos.length;
  for (let i = 0; i < CURVA_PUNTOS; i++) {
    const b1 = Math.min(n - 1, Math.floor(((i / CURVA_PUNTOS) * 4000 / nyquist) * n));
    const b2 = Math.min(n - 1, Math.max(b1, Math.floor((((i + 1) / CURVA_PUNTOS) * 4000 / nyquist) * n)));
    let suma = 0;
    for (let b = b1; b <= b2; b++) suma += datos[b];
    const v = suma / (b2 - b1 + 1) / 255;
    curvaActual[i] += 0.3 * (v - curvaActual[i]);
  }
}

function dibujarCurva() {
  const canvas = el("espectroCurva");
  if (!canvas) return;
  const { ctx, w, h } = prepararCanvas(canvas);
  const pie = 18;
  const alto = h - pie;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(192, 34, 65, 0.10)";
  const xZona = (2500 / 4000) * w;
  ctx.fillRect(xZona, 0, w - xZona, alto);
  ctx.strokeStyle = "rgba(237, 231, 225, 0.12)";
  ctx.lineWidth = 1;
  ctx.font = "11px sans-serif";
  for (let k = 0; k <= 4; k++) {
    const x = Math.round((k / 4) * (w - 1)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, alto);
    ctx.stroke();
    ctx.fillStyle = "rgba(237, 231, 225, 0.6)";
    ctx.textAlign = k === 0 ? "left" : k === 4 ? "right" : "center";
    ctx.fillText(k === 0 ? "0" : `${k} kHz`, x, h - 4);
  }
  const GANANCIA = 1.5;
  const camino = (curva) => {
    ctx.beginPath();
    for (let i = 0; i < CURVA_PUNTOS; i++) {
      const x = (i / (CURVA_PUNTOS - 1)) * w;
      // media con los vecinos: la curva se lee mejor y no baila tanto
      const v = (curva[Math.max(0, i - 1)] + 2 * curva[i] + curva[Math.min(CURVA_PUNTOS - 1, i + 1)]) / 4;
      const y = alto - Math.min(1, v * GANANCIA) * (alto - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  if (curvaReferencia) {
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = "rgba(237, 231, 225, 0.85)";
    ctx.lineWidth = 2;
    camino(curvaReferencia);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  camino(curvaActual);
  ctx.lineTo(w, alto);
  ctx.lineTo(0, alto);
  ctx.closePath();
  ctx.fillStyle = "rgba(192, 34, 65, 0.28)";
  ctx.fill();
  camino(curvaActual);
  ctx.strokeStyle = "#c02241";
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function guardarTomaCurva() {
  curvaReferencia = Float32Array.from(curvaActual);
  el("btnCurvaBorrar").disabled = false;
  dibujarCurva();
}

function borrarTomaCurva() {
  curvaReferencia = null;
  el("btnCurvaBorrar").disabled = true;
  dibujarCurva();
}

// --- Nota que estás cantando (pestaña Espectro y Twang) ---
let notaUltima = { t: 0 };

function pintarNota(lectura) {
  const nombre = el("notaNombre");
  const detalle = el("notaDetalle");
  if (!nombre || !detalle) return;
  const ahora = performance.now();
  if (lectura) {
    const midi = 69 + 12 * Math.log2(lectura.frecuencia / 440);
    const redondo = Math.round(midi);
    notaUltima = { t: ahora, nombre: midiANombre(redondo), hz: lectura.frecuencia, cents: Math.round((midi - redondo) * 100) };
  } else if (ahora - notaUltima.t > 300) {
    nombre.textContent = "—";
    detalle.textContent = "canta una vocal";
    detalle.dataset.afinacion = "";
    return;
  }
  if (!notaUltima.nombre) return;
  nombre.textContent = notaUltima.nombre;
  const c = notaUltima.cents;
  detalle.textContent = `${Math.round(notaUltima.hz)} Hz · ${c >= 0 ? "+" : ""}${c} cents`;
  detalle.dataset.afinacion = Math.abs(c) <= 10 ? "ok" : "fuera";
}

function botonesEspectro(enCurso) {
  ["btnEspectroIniciar", "btnTwangIniciar"].forEach((id) => {
    if (el(id)) el(id).disabled = enCurso;
  });
  ["btnEspectroDetener", "btnTwangDetener"].forEach((id) => {
    if (el(id)) el(id).disabled = !enCurso;
  });
}

function iniciarCalibracionTwang() {
  if (!detectorTwang || !entrenEnCurso) {
    el("twangCalibEstado").textContent = "Pulsa «Empezar» primero y vuelve a calibrar.";
    return;
  }
  detectorTwang.iniciarCalibracion();
  calibracionTwangFin = performance.now() + 4000;
  el("btnTwangCalibrar").disabled = true;
  el("twangCalibEstado").textContent = "🎤 Canta una vocal normal y sostenida, sin twang…";
}

function revisarCalibracionTwang(ahora) {
  if (!calibracionTwangFin) return;
  const restante = Math.ceil((calibracionTwangFin - ahora) / 1000);
  if (ahora < calibracionTwangFin) {
    el("twangCalibEstado").textContent = `🎤 Canta una vocal normal y sostenida, sin twang… ${restante}`;
    return;
  }
  calibracionTwangFin = 0;
  el("btnTwangCalibrar").disabled = false;
  const base = detectorTwang.terminarCalibracion(25);
  if (base === null) {
    el("twangCalibEstado").textContent = "No te oí lo bastante: canta más fuerte y sostenido, y repite.";
  } else {
    twangGuardar(twangClaveBase(detectorTwang.perfil), base);
    actualizarTextosTwang();
  }
}

function inicializarTwang() {
  if (!window.Twang || !el("twangDispositivo")) return;
  const sel = el("twangDispositivo");
  Object.entries(window.Twang.PERFILES).forEach(([clave, p]) => {
    const op = document.createElement("option");
    op.value = clave;
    op.textContent = p.etiqueta;
    sel.appendChild(op);
  });
  sel.value = twangPerfilActual();
  el("twangSensibilidad").value = String(twangSensibilidadActual());
  sel.addEventListener("change", () => {
    twangGuardar(TWANG_CLAVE_PERFIL, sel.value);
    if (detectorTwang) detectorTwang = crearDetectorTwang();
    actualizarTextosTwang();
  });
  el("twangSensibilidad").addEventListener("input", (e) => {
    twangGuardar(TWANG_CLAVE_SENS, e.target.value);
    if (detectorTwang) detectorTwang.sensibilidadDb = Number(e.target.value);
    actualizarTextosTwang();
  });
  el("btnTwangCalibrar").addEventListener("click", iniciarCalibracionTwang);
  actualizarTextosTwang();
  pintarTwang(null);
}

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
  if (!el("brilloValor")) return; // el brillo lo cubre ahora el medidor de twang
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
  const sampleRate = obtenerContexto().sampleRate;
  analizador.getByteFrequencyData(espectroDatos);
  dibujarColumnaEspectro(canvas, espectroDatos, sampleRate);
  actualizarCurva(espectroDatos, sampleRate);
  dibujarCurva();
  const lectura = window.MicrofonoEngine.leerPitch ? window.MicrofonoEngine.leerPitch() : null;
  pintarNota(lectura);
  if (detectorTwang && espectroFloat) {
    analizador.getFloatFrequencyData(espectroFloat);
    const ahora = performance.now();
    const r = detectorTwang.actualizar(espectroFloat, sampleRate, !!lectura, ahora);
    pintarTwang(r);
    twangRegistrar(r, ahora);
    dibujarHistorialTwang(ahora);
    revisarCalibracionTwang(ahora);
  }
  espectroAnimId = requestAnimationFrame(() => bucleEspectro(analizador, canvas));
}

async function iniciarEspectro() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estadoEntrenamiento").textContent = "Este navegador no permite usar el micrófono aquí.";
    return;
  }
  const canvas = el("espectroGrafico");
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  botonesEspectro(true);
  entrenEnCurso = true;
  twangReiniciarSesion();
  notaUltima = { t: 0 };

  try {
    el("estadoEntrenamiento").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
    el("estadoEntrenamiento").textContent = "🎤 Canta una vocal sostenida y observa nota, twang y espectro…";
  } catch (err) {
    el("estadoEntrenamiento").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    finalizarEspectro();
    return;
  }

  const analizador = window.MicrofonoEngine.obtenerAnalizador();
  espectroDatos = new Uint8Array(analizador.frequencyBinCount);
  espectroFloat = new Float32Array(analizador.frequencyBinCount);
  detectorTwang = window.Twang ? crearDetectorTwang() : null;
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
  botonesEspectro(false);
  pintarNota(null);
  if (twangSesion.mejor > twangMejorGuardada()) twangGuardar(TWANG_CLAVE_MEJOR, String(Math.round(twangSesion.mejor)));
  detectorTwang = null;
  calibracionTwangFin = 0;
  if (el("btnTwangCalibrar")) {
    el("btnTwangCalibrar").disabled = false;
    actualizarTextosTwang();
    pintarTwang(null);
  }
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
  inicializarTwang();
  if (window.Progreso) Progreso.marcarHerramientaUsada("entrenamiento");
  inicializarPiano(manejarClicPianoEntrenamiento); // teclado.js: previsualiza y, en "Nota sostenida", elige la nota objetivo
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
  el("btnCurvaGuardar").addEventListener("click", guardarTomaCurva);
  el("btnCurvaBorrar").addEventListener("click", borrarTomaCurva);
  dibujarCurva();
  twangReiniciarSesion();

  // Si se llegó desde Guía con "Ir a la herramienta" (?tab=messa, etc.), abre
  // esa pestaña de entrada -- si no hay parámetro o no coincide con ninguna
  // pestaña real, se queda en "rango" (la que ya marca el HTML por defecto).
  const tabPedida = new URLSearchParams(window.location.search).get("tab");
  const tabReal = tabPedida === "twang" ? "espectro" : tabPedida;
  if (tabReal && document.querySelector(`.subtab[data-entren="${tabReal}"]`)) {
    cambiarSubmodoEntrenamiento(tabReal);
  }
}

document.addEventListener("DOMContentLoaded", inicializarEntrenamiento);
