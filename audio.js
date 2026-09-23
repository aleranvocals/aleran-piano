/*
 * audio.js — motor de sonido, ahora sobre muestras reales de piano (Steinway,
 * "SplendidGrandPiano") vía la librería smplr, en vez de síntesis aditiva.
 *
 * Esto es lo que soluciona la afinación: cada nota es una grabación real
 * reproducida a la velocidad exacta (2^((nota-muestra)/12)) para dar el tono
 * pedido, en vez de una aproximación sintética. El ataque percusivo real del
 * martillo también es lo que evita que notas seguidas suenen a "glissando".
 *
 * smplr viene empaquetado localmente en smplr.iife.js (ver ese archivo) como
 * script clásico -- no como módulo ES -- para que funcione tanto abriendo
 * index.html con doble clic (file://, donde los módulos ES no cargan) como
 * en cualquier hosting, sin depender de que un CDN externo responda a tiempo.
 * Las muestras de audio en sí (los .mp3/.ogg del piano) sí se siguen
 * descargando de internet la primera vez que se reproduce una nota.
 */
const { SplendidGrandPiano, SampleLoader } = smplrLib;
// DO1_MIDI / DO7_MIDI ya están declaradas por escalas.js (se carga antes).

// Sin esto, SplendidGrandPiano carga las 5 capas de velocidad completas del
// piano entero (~200+ archivos de audio decodificados en memoria a la vez),
// que es lo que saturó la RAM y colgó el equipo. Limitamos a las notas que
// de verdad usamos (Do1-Do7) y a una sola capa de velocidad.
const NOTAS_A_CARGAR = Array.from({ length: DO7_MIDI - DO1_MIDI + 1 }, (_, i) => DO1_MIDI + i);
const OPCIONES_PIANO = { notesToLoad: { notes: NOTAS_A_CARGAR, velocityRange: [85, 100] } };

let contextoAudio = null;
let pianoEnVivo = null;
let cargadorCompartido = null;
let tokenReproduccion = 0;

function obtenerContexto() {
  if (!contextoAudio) contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
  if (contextoAudio.state === "suspended") contextoAudio.resume();
  return contextoAudio;
}

function obtenerCargador() {
  if (!cargadorCompartido) cargadorCompartido = SampleLoader(obtenerContexto());
  return cargadorCompartido;
}

function obtenerPianoEnVivo() {
  if (!pianoEnVivo) {
    pianoEnVivo = SplendidGrandPiano(obtenerContexto(), { ...OPCIONES_PIANO, loader: obtenerCargador() });
  }
  return pianoEnVivo;
}

function duracionTotal(eventos) {
  return eventos.reduce((acc, e) => acc + e.duracion, 0);
}

function clampMidi(midi) {
  return Math.max(DO1_MIDI, Math.min(DO7_MIDI, midi));
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Notas ya agendadas (vía piano.start({..., time})) de la reproducción en
// curso, con su función de cancelación (la que devuelve piano.start), más
// los setTimeout de UI (resaltado de teclas, onTerminar) pendientes. Hace
// falta llevar la cuenta a mano porque piano.stop() solo calla voces que YA
// están sonando -- no cancela notas agendadas a futuro en el planificador
// interno de smplr -- así que sin esto, una reproducción "detenida" o
// reemplazada por una nueva podía dejar sonando notas que aún no habían
// llegado a su turno.
let cancelacionesActivas = [];
let temporizadoresUiActivos = [];
let resolverEsperaActiva = null;

// piano.start({..., time}) programa la nota contra el reloj del audio, pero
// la promesa de reproducirSecuencia() sigue debiendo resolverse justo
// cuando esa reproducción de verdad termina (o se cancela) -- de eso
// dependen "Cantar y calificar"/"Escucha e imita"/Simon dice, que esperan
// con await antes de escuchar el micrófono o pasar a la siguiente ronda.
function cancelarProgramacionActiva() {
  cancelacionesActivas.forEach((cancelar) => cancelar());
  cancelacionesActivas = [];
  temporizadoresUiActivos.forEach((id) => clearTimeout(id));
  temporizadoresUiActivos = [];
  scheduleActivo = null;
  if (resolverEsperaActiva) {
    const resolver = resolverEsperaActiva;
    resolverEsperaActiva = null;
    resolver(); // libera a quien esté esperando esta reproducción (ahora cancelada/reemplazada)
  }
}

/**
 * Agenda la secuencia entera de una sola vez contra el reloj del propio
 * AudioContext (con piano.start({..., time}), que smplr programa con la
 * precisión del hardware de audio) en vez de ir nota a nota esperando con
 * setTimeout entre una y otra. Encadenar setTimeouts acumula una pequeña
 * imprecisión en cada espera (los temporizadores de JS son "como mínimo X
 * ms", nunca exactos) que con una secuencia larga se nota cada vez más --
 * el piano terminaba desincronizándose del metrónomo (que sí usa el reloj
 * de audio) aunque hubiera empezado perfecto. Al anclar todo al mismo
 * reloj, ninguno de los dos se desvía del otro sin importar cuánto dure.
 *
 * callbacks admite: onCargando(bool), onNotaInicio(midi), onNotaFin(midi),
 * onEventoInicio(indice), onEventoFin(indice), onTerminar().
 *
 * onNotaInicio/onNotaFin identifican la nota por su midi -- ambiguo si dos
 * eventos distintos comparten la misma nota (pasa seguido en una canción
 * completa). onEventoInicio/onEventoFin identifican por posición en el
 * array `eventos` en cambio, sin ambigüedad -- para resaltar la celda
 * exacta que está sonando (Cifrado), no solo "alguna nota igual a esta".
 */
async function reproducirSecuencia(eventos, volumen, callbacks = {}) {
  const { onCargando, onNotaInicio, onNotaFin, onEventoInicio, onEventoFin, onTerminar } = callbacks;
  const miToken = ++tokenReproduccion;
  const piano = obtenerPianoEnVivo();
  piano.stop();
  cancelarProgramacionActiva();

  const yaListo = piano.loadProgress && piano.loadProgress.loaded >= piano.loadProgress.total;
  if (onCargando) onCargando(!yaListo);
  await piano.ready;
  if (tokenReproduccion !== miToken) return; // se pidió detener mientras cargaba
  if (onCargando) onCargando(false);

  piano.output.volume = Math.round(Math.max(0, Math.min(1, volumen)) * 127);

  const ctx = obtenerContexto();
  // Si el metrónomo está sonando, no arrancar a destiempo: anclar el primer
  // evento a su próximo pulso fuerte (o al próximo pulso si suena sin
  // acento) en vez de a "ahora mismo".
  const pulso = tiempoProximoPulsoFuerte();
  let cuando = pulso !== null ? pulso : ctx.currentTime + 0.05;

  const ahora = ctx.currentTime;
  // `midi` normalmente es un número (o -1 para silencio) -- pero también
  // puede ser un array de números, para un ACORDE: todas esas notas arrancan
  // en el mismo instante `tiempoInicio` y comparten la misma duración, en vez
  // de sonar una tras otra. Se agenda igual que una nota suelta (mismo
  // piano.start/time), así que sigue viviendo en el mismo reloj y en el
  // mismo sistema de cancelación que el resto -- "Detener" también corta un
  // acorde a medias.
  const programados = eventos.map(({ midi, duracion }, indice) => {
    const tiempoInicio = cuando;
    cuando += duracion;
    const notas = Array.isArray(midi) ? midi : midi !== -1 ? [midi] : [];
    const retrasoMs = Math.max(0, (tiempoInicio - ahora) * 1000);
    notas.forEach((nota) => {
      const cancelar = piano.start({ note: clampMidi(nota), duration: duracion, time: tiempoInicio });
      if (typeof cancelar === "function") cancelacionesActivas.push(cancelar);
      if (onNotaInicio) {
        temporizadoresUiActivos.push(
          setTimeout(() => {
            if (tokenReproduccion === miToken) onNotaInicio(nota);
          }, retrasoMs)
        );
      }
      if (onNotaFin) {
        temporizadoresUiActivos.push(
          setTimeout(() => {
            if (tokenReproduccion === miToken) onNotaFin(nota);
          }, retrasoMs + duracion * 1000)
        );
      }
    });
    if (onEventoInicio) {
      temporizadoresUiActivos.push(
        setTimeout(() => {
          if (tokenReproduccion === miToken) onEventoInicio(indice);
        }, retrasoMs)
      );
    }
    if (onEventoFin) {
      temporizadoresUiActivos.push(
        setTimeout(() => {
          if (tokenReproduccion === miToken) onEventoFin(indice);
        }, retrasoMs + duracion * 1000)
      );
    }
    return { midi, duracion, tiempoInicio };
  });
  const tiempoFinal = cuando;
  scheduleActivo = { eventos: programados, tiempoFinal, token: miToken };

  await new Promise((resolve) => {
    resolverEsperaActiva = resolve;
    temporizadoresUiActivos.push(
      setTimeout(() => {
        if (tokenReproduccion === miToken && onTerminar) onTerminar();
        resolverEsperaActiva = null;
        resolve();
      }, Math.max(0, (tiempoFinal - ahora) * 1000))
    );
  });
}

// Qué hay agendado ahora mismo (ver más arriba) -- lo usa el metrónomo para
// saber, si arranca a mitad de una reproducción, en qué instante entrar
// para coincidir con el arranque del siguiente evento en vez de a destiempo.
let scheduleActivo = null;

function proximoLimiteNotaCtx() {
  if (!scheduleActivo || scheduleActivo.token !== tokenReproduccion) return null;
  const ahora = obtenerContexto().currentTime;
  if (ahora >= scheduleActivo.tiempoFinal) return null; // ya terminó
  for (const ev of scheduleActivo.eventos) {
    const fin = ev.tiempoInicio + ev.duracion;
    if (fin > ahora) return fin;
  }
  return null;
}

function detenerReproduccion() {
  tokenReproduccion++; // invalida cualquier reproducción en curso: no se agenda ninguna nota más
  cancelarProgramacionActiva(); // cancela lo que ya estaba agendado a futuro
  if (pianoEnVivo) pianoEnVivo.stop(); // corta en seco lo que esté sonando ahora mismo
  escuchaMicrofonoCancelada = true; // si había una escucha de "cantar y calificar" en curso, se corta ya
}

/**
 * Corta en seco cualquier nota que siga sonando, SIN invalidar el token ni
 * cancelar una escucha de micrófono en curso (a diferencia de
 * detenerReproduccion). Se usa justo antes de empezar a escuchar al alumno
 * en "Cantar y calificar"/"Escucha e imita": el piano usa muestras reales,
 * que se apagan con una cola de resonancia natural (como un piano de
 * verdad) en vez de cortar en seco al llegar a la duración pedida -- sin
 * esto, esa cola todavía sonando por los altavoces se cuela en el
 * micrófono justo al empezar a escuchar y se calificaba como si fuera la
 * voz del alumno (perfecta, porque es la nota exacta de referencia).
 */
function silenciarPianoAhora() {
  if (pianoEnVivo) pianoEnVivo.stop();
}

function ultimaDuracionNota(eventos) {
  for (let i = eventos.length - 1; i >= 0; i--) {
    if (eventos[i].midi !== -1) return eventos[i].duracion;
  }
  return 0.5;
}

/**
 * Graba la secuencia completa y devuelve un AudioBuffer.
 *
 * ANTES esto usaba smplr.renderOffline() (instantáneo, sin esperar el tiempo
 * real de la secuencia). Se retiró: confirmado con un repro mínimo sin
 * ningún código de este proyecto de por medio, renderOffline() de smplr solo
 * reproduce la PRIMERA nota de cualquier secuencia con más de una -- el resto
 * queda en silencio absoluto aunque el buffer dure lo correcto (por eso las
 * descargas de más de una nota sonaban "cortadas" a la primera). Es un bug
 * de la librería, no nuestro.
 *
 * Workaround: se graba la reproducción real (igual que reproducirSecuencia,
 * pero en un AudioContext e instrumento aparte, no conectado a los
 * altavoces) con MediaRecorder, y se decodifica el resultado de vuelta a un
 * AudioBuffer. Tarda lo mismo que escuchar la secuencia entera, pero suena
 * completa.
 */
async function grabarSecuencia(eventos, volumen) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const decayTime = Math.min(1.8, Math.max(0.3, ultimaDuracionNota(eventos) * 0.25));
  const piano = SplendidGrandPiano(ctx, { ...OPCIONES_PIANO, loader: obtenerCargador(), decayTime });
  await piano.ready;
  piano.output.volume = Math.round(Math.max(0, Math.min(1, volumen)) * 127);

  const destino = ctx.createMediaStreamDestination();
  piano.output.input.connect(destino);

  const tipo = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
  const grabadora = tipo ? new MediaRecorder(destino.stream, { mimeType: tipo }) : new MediaRecorder(destino.stream);
  const trozos = [];
  grabadora.ondataavailable = (e) => {
    if (e.data.size > 0) trozos.push(e.data);
  };
  const terminada = new Promise((resolve) => (grabadora.onstop = resolve));
  grabadora.start();

  for (const { midi, duracion } of eventos) {
    if (midi !== -1) piano.start({ note: clampMidi(midi), duration: duracion });
    await esperar(duracion * 1000);
  }
  await esperar((decayTime + 0.4) * 1000); // deja sonar la cola de decaimiento de la última nota

  grabadora.stop();
  await terminada;
  piano.dispose();
  ctx.close();

  const blob = new Blob(trozos, { type: grabadora.mimeType || "audio/webm" });
  const arrBuf = await blob.arrayBuffer();
  const ctxDecodificacion = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await ctxDecodificacion.decodeAudioData(arrBuf);
  ctxDecodificacion.close();
  return audioBuffer;
}

// lamejs.iife.js pesa 169 KB (la librería más pesada del sitio) y solo hace falta
// si el alumno pulsa "Descargar MP3" -- se carga bajo demanda en vez de en cada
// visita a piano.html, para no penalizar a quien solo quiere tocar/escuchar.
let lamejsCargaPromesa = null;
function cargarLamejs() {
  if (window.lamejs) return Promise.resolve();
  if (!lamejsCargaPromesa) {
    lamejsCargaPromesa = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "lamejs.iife.js";
      script.onload = () => resolve();
      script.onerror = () => {
        lamejsCargaPromesa = null;
        reject(new Error("No se pudo cargar el codificador MP3. Comprueba tu conexión e inténtalo de nuevo."));
      };
      document.head.appendChild(script);
    });
  }
  return lamejsCargaPromesa;
}

function audioBufferAMp3(buffer, kbps = 128) {
  const canal = buffer.getChannelData(0);
  const muestras = new Int16Array(canal.length);
  for (let i = 0; i < canal.length; i++) {
    const s = Math.max(-1, Math.min(1, canal[i]));
    muestras[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const encoder = new lamejs.Mp3Encoder(1, buffer.sampleRate, kbps);
  const tamanoBloque = 1152;
  const partes = [];
  for (let i = 0; i < muestras.length; i += tamanoBloque) {
    const trozo = muestras.subarray(i, i + tamanoBloque);
    const mp3buf = encoder.encodeBuffer(trozo);
    if (mp3buf.length > 0) partes.push(mp3buf);
  }
  const cierre = encoder.flush();
  if (cierre.length > 0) partes.push(cierre);
  return new Blob(partes, { type: "audio/mp3" });
}

async function exportarMp3(eventos, volumen, nombreArchivo) {
  const [buffer] = await Promise.all([grabarSecuencia(eventos, volumen), cargarLamejs()]);
  const blob = audioBufferAMp3(buffer);
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// --- Ritmo (palmas) ------------------------------------------------------
// Sonido de palmada sintetizado (ruido blanco filtrado en banda + envolvente
// corta) en vez de una nota de piano -- así la pestaña Ritmo no depende para
// nada de que las muestras del piano hayan cargado, y suena a percusión, no
// a tecla. reproducirRitmo() agenda todo de una sola vez contra el reloj del
// AudioContext, igual que reproducirSecuencia() (misma precisión), pero solo
// con este sonido -- nunca toca pianoEnVivo.

let bufferRuidoPalmada = null;
function obtenerBufferRuidoPalmada(ctx) {
  if (bufferRuidoPalmada) return bufferRuidoPalmada;
  const duracion = 0.09;
  const tam = Math.floor(ctx.sampleRate * duracion);
  const buffer = ctx.createBuffer(1, tam, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < tam; i++) datos[i] = Math.random() * 2 - 1;
  bufferRuidoPalmada = buffer;
  return buffer;
}

function reproducirPalmada(ctx, tiempo, volumen) {
  const fuente = ctx.createBufferSource();
  fuente.buffer = obtenerBufferRuidoPalmada(ctx);
  const filtro = ctx.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.frequency.value = 1200;
  filtro.Q.value = 0.7;
  const gain = ctx.createGain();
  const pico = 0.9 * Math.max(0, Math.min(1, volumen));
  gain.gain.setValueAtTime(0.0001, tiempo);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, pico), tiempo + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, tiempo + 0.09);
  fuente.connect(filtro).connect(gain).connect(ctx.destination);
  fuente.start(tiempo);
  fuente.stop(tiempo + 0.1);
  return () => {
    try {
      fuente.stop();
    } catch {
      // ya estaba parada -- no pasa nada
    }
  };
}

/**
 * eventos: [{ duracion, silencio }]. callbacks admite onEventoInicio(indice,
 * silencio), onTerminar(). Comparte el mecanismo de cancelación con el piano
 * (detenerReproduccion también corta un ritmo en marcha).
 */
async function reproducirRitmo(eventos, volumen, callbacks = {}) {
  const { onEventoInicio, onTerminar } = callbacks;
  const miToken = ++tokenReproduccion;
  if (pianoEnVivo) pianoEnVivo.stop();
  cancelarProgramacionActiva();

  const ctx = obtenerContexto();
  const pulso = tiempoProximoPulsoFuerte();
  let cuando = pulso !== null ? pulso : ctx.currentTime + 0.05;
  const ahora = ctx.currentTime;

  const programados = eventos.map((evento, i) => {
    const tiempoInicio = cuando;
    cuando += evento.duracion;
    if (!evento.silencio) {
      const cancelar = reproducirPalmada(ctx, tiempoInicio, volumen);
      cancelacionesActivas.push(cancelar);
    }
    if (onEventoInicio) {
      const retrasoMs = Math.max(0, (tiempoInicio - ahora) * 1000);
      temporizadoresUiActivos.push(
        setTimeout(() => {
          if (tokenReproduccion === miToken) onEventoInicio(i, evento.silencio);
        }, retrasoMs)
      );
    }
    return { midi: evento.silencio ? -1 : -2, duracion: evento.duracion, tiempoInicio };
  });
  const tiempoFinal = cuando;
  // Misma forma que usa reproducirSecuencia -- así si el metrónomo arranca a
  // mitad de un ritmo, también sabe esperar al final del evento en curso.
  scheduleActivo = { eventos: programados, tiempoFinal, token: miToken };

  await new Promise((resolve) => {
    resolverEsperaActiva = resolve;
    temporizadoresUiActivos.push(
      setTimeout(() => {
        if (tokenReproduccion === miToken && onTerminar) onTerminar();
        resolverEsperaActiva = null;
        resolve();
      }, Math.max(0, (tiempoFinal - ahora) * 1000))
    );
  });
}

// --- Metrónomo (50-350 bpm) --------------------------------------------
// Patrón estándar de "lookahead scheduler": en vez de disparar cada clic con
// un setTimeout (que se desincroniza con el tiempo real), se programan con
// antelación en el propio AudioContext y solo se revisa cada poco si hay que
// programar el siguiente. Así el tempo no se acumula ni se desvía.

const METRONOMO_ANTICIPO_S = 0.12; // cuánto se programa por delante
const METRONOMO_INTERVALO_MS = 25; // cada cuánto se revisa si toca programar más

let metronomoActivo = false;
let metronomoBpm = 100;
let metronomoAcentoCada = 4; // 0 = sin acento
let metronomoVolumen = 0.7;
let metronomoSiguienteTiempo = 0;
let metronomoContadorPulso = 0;
let metronomoTimerId = null;

function reproducirClicMetronomo(ctx, tiempo, acento) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = acento ? 1600 : 1000;
  const pico = (acento ? 0.55 : 0.32) * metronomoVolumen;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, tiempo);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, pico), tiempo + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, tiempo + 0.045);
  osc.connect(gain).connect(ctx.destination);
  osc.start(tiempo);
  osc.stop(tiempo + 0.06);
}

// No se conecta a un piano ni depende de qué pestaña esté abierta -- una vez
// iniciado, sigue sonando (mezclado con lo que sea que suene en el piano)
// aunque el alumno cambie de modo/pestaña dentro de la página.
function iniciarMetronomo(bpm, acentoCada, onPulso) {
  detenerMetronomo();
  const ctx = obtenerContexto();
  metronomoBpm = bpm;
  metronomoAcentoCada = acentoCada;
  metronomoActivo = true;
  metronomoContadorPulso = 0;
  // Si ya hay una nota/secuencia sonando cuando se arranca el metrónomo, no
  // empezar a destiempo: esperar a que termine el evento actual (nota o
  // silencio) para que el primer clic coincida justo con el arranque del
  // siguiente, en vez de caer en medio de una nota ya sonando.
  const limiteNota = proximoLimiteNotaCtx();
  metronomoSiguienteTiempo = limiteNota !== null && limiteNota > ctx.currentTime ? limiteNota : ctx.currentTime + 0.05;

  function programar() {
    if (!metronomoActivo) return;
    while (metronomoSiguienteTiempo < ctx.currentTime + METRONOMO_ANTICIPO_S) {
      const acento = metronomoAcentoCada > 0 && metronomoContadorPulso % metronomoAcentoCada === 0;
      reproducirClicMetronomo(ctx, metronomoSiguienteTiempo, acento);
      if (onPulso) {
        const retrasoMs = Math.max(0, (metronomoSiguienteTiempo - ctx.currentTime) * 1000);
        setTimeout(() => {
          if (metronomoActivo) onPulso(acento);
        }, retrasoMs);
      }
      metronomoSiguienteTiempo += 60 / metronomoBpm;
      metronomoContadorPulso++;
    }
    metronomoTimerId = setTimeout(programar, METRONOMO_INTERVALO_MS);
  }
  programar();
}

function detenerMetronomo() {
  metronomoActivo = false;
  if (metronomoTimerId) clearTimeout(metronomoTimerId);
  metronomoTimerId = null;
}

function metronomoEnMarchaMotor() {
  return metronomoActivo;
}

/** Tiempo (en el reloj del AudioContext) del próximo pulso "fuerte": el
 * siguiente pulso acentuado si hay acento configurado, o simplemente el
 * siguiente pulso si el metrónomo suena sin acento (ahí cualquier pulso
 * vale). Devuelve null si el metrónomo no está sonando. */
function tiempoProximoPulsoFuerte() {
  if (!metronomoActivo) return null;
  const ctx = obtenerContexto();
  const periodo = 60 / metronomoBpm;
  let tiempo = metronomoSiguienteTiempo;
  let contador = metronomoContadorPulso;
  while (tiempo < ctx.currentTime) {
    tiempo += periodo;
    contador++;
  }
  if (metronomoAcentoCada > 0) {
    while (contador % metronomoAcentoCada !== 0) {
      tiempo += periodo;
      contador++;
    }
  }
  return tiempo;
}

/** Cuántos milisegundos hay que esperar, desde ahora, para que arrancar una
 * reproducción del piano coincida con el próximo pulso fuerte del
 * metrónomo. 0 si el metrónomo no está sonando (nada que esperar). */
function retrasoHastaProximoPulsoFuerte() {
  const tiempo = tiempoProximoPulsoFuerte();
  if (tiempo === null) return 0;
  return Math.max(0, (tiempo - obtenerContexto().currentTime) * 1000);
}

function ajustarBpmMetronomo(bpm) {
  metronomoBpm = bpm;
}

function ajustarAcentoMetronomo(acentoCada) {
  metronomoAcentoCada = acentoCada;
}

function ajustarVolumenMetronomo(volumen) {
  metronomoVolumen = Math.max(0, Math.min(1, volumen));
}

// --- Micrófono / detección de afinación ---------------------------------
// Usa `pitchy` (algoritmo McLeod Pitch Method, el mismo tipo que usan los
// afinadores profesionales), empaquetado localmente en pitchy.iife.js igual
// que smplr/lamejs -- sin CDN externo, sin servicio de pago, 100% en el
// navegador. Requiere HTTPS o localhost (exigencia del propio navegador para
// dar acceso al micrófono) y que el alumno conceda el permiso.

const PITCH_FFT_SIZE = 2048;
const PITCH_CLARIDAD_MINIMA = 0.9; // por debajo de esto, pitchy no está seguro (ruido/silencio)
const PITCH_FREC_MIN = 55; // ~La1, por debajo es casi seguro ruido de fondo
const PITCH_FREC_MAX = 1500; // ~Fa#6, por encima no es una voz cantando

let streamMicrofono = null;
let analizadorMicrofono = null;
let detectorPitch = null;
let bufferPitch = null;
let escuchaMicrofonoCancelada = false;

function microfonoDisponible() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

async function iniciarMicrofono() {
  if (streamMicrofono) return;
  if (!microfonoDisponible()) {
    throw new Error("Este navegador no permite usar el micrófono aquí (¿estás en HTTP sin https?).");
  }
  streamMicrofono = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = obtenerContexto();
  const fuente = ctx.createMediaStreamSource(streamMicrofono);
  analizadorMicrofono = ctx.createAnalyser();
  analizadorMicrofono.fftSize = PITCH_FFT_SIZE;
  fuente.connect(analizadorMicrofono);
  detectorPitch = pitchyLib.PitchDetector.forFloat32Array(PITCH_FFT_SIZE);
  bufferPitch = new Float32Array(PITCH_FFT_SIZE);
}

function detenerMicrofono() {
  if (streamMicrofono) streamMicrofono.getTracks().forEach((t) => t.stop());
  streamMicrofono = null;
  analizadorMicrofono = null;
  detectorPitch = null;
}

/** Una lectura instantánea del micrófono, o null si no hay una nota clara
 * (silencio, ruido, o el alumno todavía no ha respirado para cantar). */
function leerPitchInstantaneo() {
  if (!analizadorMicrofono || !detectorPitch) return null;
  analizadorMicrofono.getFloatTimeDomainData(bufferPitch);
  const [frecuencia, claridad] = detectorPitch.findPitch(bufferPitch, obtenerContexto().sampleRate);
  if (claridad < PITCH_CLARIDAD_MINIMA || frecuencia < PITCH_FREC_MIN || frecuencia > PITCH_FREC_MAX) {
    return null;
  }
  return { frecuencia, claridad };
}

/** Escucha el micrófono durante `segundos` comparando lo que canta el
 * alumno contra `midiObjetivo`, y devuelve el promedio de desviación en
 * "cents" (100 cents = 1 semitono) durante todas las lecturas válidas. */
async function escucharYPuntuar(midiObjetivo, segundos, onLectura) {
  const frecuenciaObjetivo = midiAFrecuencia(midiObjetivo);
  const inicio = performance.now();
  const centavos = [];
  escuchaMicrofonoCancelada = false;
  while (performance.now() - inicio < segundos * 1000) {
    if (escuchaMicrofonoCancelada) break;
    const lectura = leerPitchInstantaneo();
    if (lectura) {
      const cents = 1200 * Math.log2(lectura.frecuencia / frecuenciaObjetivo);
      centavos.push(cents);
      if (onLectura) onLectura(cents, lectura.frecuencia);
    } else if (onLectura) {
      onLectura(null, null);
    }
    await esperar(40); // ~25 lecturas/seg -- de sobra para el vibrato de una voz
  }
  if (centavos.length === 0) return { detectado: false };
  const centsPromedio = centavos.reduce((a, b) => a + b, 0) / centavos.length;
  return { detectado: true, centsPromedio, numLecturas: centavos.length };
}

function frecuenciaAMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

// Token de generación (mismo patrón que tokenReproduccion más arriba): un
// simple booleano "activa" no basta, porque Entrenamiento cambia de submodo
// (Rango vocal, SOVT, Nota sostenida...) llamando a detenerContinuo() y
// luego, casi en el mismo instante, a escucharContinuo() del modo nuevo. Con
// un booleano compartido existe una ventana real donde el bucle viejo aún no
// ha revisado el flag (duerme en el `await esperar(40)` de abajo) cuando el
// bucle nuevo ya lo puso otra vez en `true` -- el viejo "revive" al
// despertar, y quedan DOS bucles corriendo a la vez, cada uno marcando/
// desmarcando su propia tecla en el teclado según lo que detecta el
// micrófono en ese instante: el síntoma es exactamente teclas que se quedan
// pegadas en rojo, porque el bucle que las encendió ya no es el que el resto
// del código cree que es el activo. Con un contador que se incrementa en
// cada llamada, un bucle viejo solo puede compararse con SU propio número de
// generación, nunca con el de uno que arrancó después.
let escuchaContinuaToken = 0;

/** Escucha el micrófono de forma continua (sin nota objetivo ni límite de
 * tiempo) hasta que se llame a detenerEscuchaContinua(). La usan el medidor
 * de rango vocal y el cronómetro de nota sostenida. `onLectura` recibe
 * `{ frecuencia, midiExacto, claridad }` o `null` cuando no hay voz clara. */
async function escucharContinuo(onLectura) {
  const miToken = ++escuchaContinuaToken;
  escuchaMicrofonoCancelada = false;
  while (escuchaContinuaToken === miToken && !escuchaMicrofonoCancelada) {
    const lectura = leerPitchInstantaneo();
    onLectura(lectura ? { ...lectura, midiExacto: frecuenciaAMidi(lectura.frecuencia) } : null);
    await esperar(40); // ~25 lecturas/seg
  }
}

function detenerEscuchaContinua() {
  escuchaContinuaToken++; // invalida cualquier bucle en curso, sin poder "revivirlo" luego
}

window.PianoEngine = { reproducirSecuencia, reproducirRitmo, detenerReproduccion, exportarMp3, silenciarPianoAhora };
window.MetronomoEngine = {
  iniciar: iniciarMetronomo,
  detener: detenerMetronomo,
  enMarcha: metronomoEnMarchaMotor,
  ajustarBpm: ajustarBpmMetronomo,
  ajustarAcento: ajustarAcentoMetronomo,
  ajustarVolumen: ajustarVolumenMetronomo,
};
window.MicrofonoEngine = {
  disponible: microfonoDisponible,
  iniciar: iniciarMicrofono,
  detener: detenerMicrofono,
  escucharYPuntuar,
  escucharContinuo,
  detenerContinuo: detenerEscuchaContinua,
  // Da acceso al AnalyserNode crudo (para el espectrograma en vivo); no hace
  // falta crear un segundo analizador, el mismo sirve para pitch y espectro.
  obtenerAnalizador: () => analizadorMicrofono,
};

// El micrófono se queda abierto entre ejercicios de la misma página a propósito
// (evita que el navegador pida permiso de nuevo cada vez que el alumno cambia
// de ejercicio) — solo se libera de verdad al salir de la página.
window.addEventListener("pagehide", detenerMicrofono);
window.dispatchEvent(new Event("piano-engine-listo"));
