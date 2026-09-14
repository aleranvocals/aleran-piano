/*
 * piano.js — la página Piano: los 5 modos (nota individual, aleatorias,
 * escala, personalizada, metrónomo), "Cantar y calificar", y el cableado
 * del teclado compartido (teclado.js) para esta página en concreto.
 */

let modoActual = "individual";
let notaIndividual = nombreAMidi("Do3");
let secuenciaActual = null; // cache: lo último generado, para que "Descargar" coincida con lo que sonó
let metronomoEnMarcha = false;
let cantoEnCurso = false;
let cantoCancelado = false;
let solfeoTonicaMidi = nombreAMidi("Do3");

// --- Solfeo (do movible): solo escalas mayores por ahora --------------------

const SOLFEO_GRADOS = { 0: "Do", 2: "Re", 4: "Mi", 5: "Fa", 7: "Sol", 9: "La", 11: "Si", 12: "Do" };

const SOLFEO_PATRONES = {
  primeros_tres: { nombre: "Primeros tres grados (Do-Re-Mi)", semitonos: [0, 2, 4, 2, 0] },
  primeros_cinco: { nombre: "Primeros cinco grados (Do-Re-Mi-Fa-Sol)", semitonos: [0, 2, 4, 5, 7, 5, 4, 2, 0] },
  triada_mayor: { nombre: "Tríada mayor (Do-Mi-Sol-Do)", semitonos: [0, 4, 7, 12, 7, 4, 0] },
  escala_mayor: {
    nombre: "Escala mayor completa (Do-Re-Mi-Fa-Sol-La-Si-Do)",
    semitonos: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0],
  },
};

function silabaSolfeo(semitono) {
  return SOLFEO_GRADOS[semitono] || "?";
}

/** Nombre que se le muestra al alumno para una nota: absoluto (Sol3) en
 * casi todos los modos, o su sílaba de solfeo (Sol) si está en modo Solfeo. */
function etiquetaNota(midi) {
  if (modoActual === "solfeo") return silabaSolfeo(midi - solfeoTonicaMidi);
  return midiANombre(midi);
}

function poblarSelects() {
  const selectVoz = el("voz");
  for (const [clave, voz] of Object.entries(VOCES)) {
    const opt = document.createElement("option");
    opt.value = clave;
    opt.textContent = `${voz.nombre} (${voz.rango[0]}–${voz.rango[1]})`;
    selectVoz.appendChild(opt);
  }
  selectVoz.value = "tenor";

  const selectPatron = el("patron");
  const gruposPorCategoria = {};
  for (const [clave, patron] of Object.entries(PATRONES)) {
    const categoria = patron.categoria || "otras";
    if (!gruposPorCategoria[categoria]) {
      const grupo = document.createElement("optgroup");
      grupo.label = CATEGORIAS[categoria] || categoria;
      gruposPorCategoria[categoria] = grupo;
      selectPatron.appendChild(grupo);
    }
    const opt = document.createElement("option");
    opt.value = clave;
    opt.textContent = patron.nombre;
    gruposPorCategoria[categoria].appendChild(opt);
  }
  selectPatron.value = "cinco_notas";

  const selectTonica = el("solfeoTonica");
  for (let midi = nombreAMidi("Do2"); midi <= nombreAMidi("Fa4"); midi++) {
    const opt = document.createElement("option");
    opt.value = midiANombre(midi);
    opt.textContent = midiANombre(midi);
    selectTonica.appendChild(opt);
  }
  selectTonica.value = "Do3";

  const selectSolfeoPatron = el("solfeoPatron");
  for (const [clave, patron] of Object.entries(SOLFEO_PATRONES)) {
    const opt = document.createElement("option");
    opt.value = clave;
    opt.textContent = patron.nombre;
    selectSolfeoPatron.appendChild(opt);
  }
}

function actualizarDescripcionPatron() {
  const patron = PATRONES[el("patron").value];
  const tecnicas = patron.tecnicas.map((t) => t.replace(/_/g, " ")).join(", ");
  el("descripcionPatron").textContent = `${patron.descripcion} (técnicas: ${tecnicas})`;
}

function actualizarVisibilidadNotaInicial() {
  el("campoNotaInicial").hidden = el("escalera").checked;
}

function invalidarSecuencia() {
  secuenciaActual = null;
}

function detenerMetronomoSiHaceFalta() {
  if (!metronomoEnMarcha) return;
  if (window.MetronomoEngine) window.MetronomoEngine.detener();
  metronomoEnMarcha = false;
  el("btnMetronomoIniciar").disabled = false;
  el("btnMetronomoDetener").disabled = true;
}

function cambiarModo(modo) {
  if (modoActual === "metronomo" && modo !== "metronomo") detenerMetronomoSiHaceFalta();
  if (modo !== modoActual) cancelarCantoSiHaceFalta();
  modoActual = modo;

  document.querySelectorAll(".tab").forEach((btn) => {
    const activo = btn.dataset.modo === modo;
    btn.classList.toggle("activo", activo);
    btn.setAttribute("aria-selected", String(activo));
  });

  el("panel-individual").hidden = modo !== "individual";
  el("panel-aleatorio").hidden = modo !== "aleatorio";
  el("panel-escala").hidden = modo !== "escala";
  el("panel-personalizada").hidden = modo !== "personalizada";
  el("panel-solfeo").hidden = modo !== "solfeo";
  el("panel-metronomo").hidden = modo !== "metronomo";

  const esMetronomo = modo === "metronomo";
  el("panelComunes").hidden = esMetronomo;
  el("accionesPiano").hidden = esMetronomo;
  el("pianoContenedor").hidden = esMetronomo;
  el("pianoDesplazamiento").hidden = esMetronomo;
  // "Cantar y calificar": tiene sentido en cualquier modo que genere una
  // nota o secuencia concreta que repetir (todos menos el metrónomo).
  el("btnCantar").hidden = esMetronomo;
  // "Escucha e imita" solo tiene sentido con una frase de varias notas
  // (con una sola nota es exactamente lo mismo que "Cantar y calificar").
  el("btnImitar").hidden = esMetronomo || modo === "individual";

  el("campoPausa").hidden = modo === "individual"; // una sola nota no necesita pausa
  el("resultado").hidden = true;
  el("estado").textContent = "";
  invalidarSecuencia();
}

// --- Teclado: qué hacer al tocar una tecla en esta página -----------------

function manejarClicPianoIndividual(midi) {
  let duracion = 0.6;
  if (modoActual === "individual") {
    notaIndividual = midi;
    invalidarSecuencia();
    actualizarNotaSeleccionadaUI();
    duracion = duracionNotaActual();
  }
  reproducirEventos([{ midi, duracion }]);
}

// --- Duración de nota vinculada al tempo del metrónomo ---------------------
// Por defecto la duración es el slider en segundos de siempre, pero se puede
// vincular al tempo (BPM) + una figura rítmica (negra, corchea...), para que
// una escala se pueda tocar "a tempo" en vez de a una duración arbitraria.

function figuraSegundos() {
  const bpm = parseInt(el("bpmSlider").value, 10) || 100;
  const factor = parseFloat(el("figuraRitmica").value) || 1;
  return (60 / bpm) * factor;
}

function duracionNotaActual() {
  if (el("sincronizarTempo").checked) return figuraSegundos();
  return parseFloat(el("duracionNota").value);
}

function actualizarVisibilidadDuracion() {
  const sincronizado = el("sincronizarTempo").checked;
  el("campoFiguraRitmica").hidden = !sincronizado;
  el("campoDuracionManual").hidden = sincronizado;
  if (sincronizado) actualizarDuracionCalculada();
}

function actualizarDuracionCalculada() {
  el("tempoSincronizadoBpm").textContent = el("bpmSlider").value;
  el("duracionCalculadaTexto").textContent = `${figuraSegundos().toFixed(2)}s`;
}

function actualizarNotaSeleccionadaUI() {
  el("piano")
    .querySelectorAll(".seleccionada")
    .forEach((t) => t.classList.remove("seleccionada"));
  const tecla = el("piano").querySelector(`[data-midi="${notaIndividual}"]`);
  if (tecla) tecla.classList.add("seleccionada");
  el("notaSeleccionadaTexto").textContent = midiANombre(notaIndividual);
}

// --- Generación de eventos ----------------------------------------------

function generarResultado() {
  const duracionNota = duracionNotaActual();
  const pausa = parseFloat(el("pausa").value);

  if (modoActual === "individual") {
    return {
      eventos: [{ midi: notaIndividual, duracion: duracionNota }],
      info: `Nota individual: ${midiANombre(notaIndividual)} (${duracionNota}s)`,
    };
  }

  if (modoActual === "aleatorio") {
    const numNotas = parseInt(el("numNotas").value, 10);
    const semillaTexto = el("semilla").value.trim();
    const semilla = semillaTexto === "" ? null : parseInt(semillaTexto, 10);
    return eventosModoAleatorio({ numNotas, duracionNota, pausa, semilla });
  }

  if (modoActual === "personalizada") {
    return eventosNotasPersonalizadas({ texto: el("notasPersonalizadas").value, duracionNota, pausa });
  }

  if (modoActual === "solfeo") {
    solfeoTonicaMidi = nombreAMidi(el("solfeoTonica").value);
    const patron = SOLFEO_PATRONES[el("solfeoPatron").value];
    const techo = solfeoTonicaMidi + Math.max(...patron.semitonos);
    const piso = solfeoTonicaMidi + Math.min(...patron.semitonos);
    if (techo > DO6_MIDI || piso < DO1_MIDI) {
      throw new Error(
        `Con "${el("solfeoTonica").value}" como Do, ese patrón se sale del rango del piano (Do1 a Do6). Elige una tónica más grave.`
      );
    }
    const eventos = [];
    for (const st of patron.semitonos) {
      eventos.push({ midi: solfeoTonicaMidi + st, duracion: duracionNota });
      eventos.push({ midi: -1, duracion: pausa });
    }
    return { eventos, info: `Solfeo (${el("solfeoTonica").value} = Do) · ${patron.nombre}` };
  }

  const voz = el("voz").value;
  const patron = el("patron").value;
  const escaleraActiva = el("escalera").checked;
  const notaInicial = escaleraActiva ? null : el("notaInicial").value.trim() || null;
  const pasoSemitonos = parseInt(el("pasoSemitonos").value, 10) || 1;
  const soloSubida = el("soloSubida").checked;
  return eventosModoEscala({ voz, patron, notaInicial, pasoSemitonos, soloSubida, duracionNota, pausa });
}

/** Devuelve la secuencia "actual": la reutiliza si ya hay una (para que
 * Descargar coincida siempre con lo último generado/escuchado), o la genera
 * si no hay ninguna todavía o si se pide forzar una nueva (aleatorio). */
function obtenerSecuencia(forzarNueva) {
  if (forzarNueva || !secuenciaActual) secuenciaActual = generarResultado();
  return secuenciaActual;
}

function fijarEstadoBotones({ escuchando }) {
  el("btnEscuchar").disabled = escuchando;
  el("btnDetener").disabled = !escuchando;
  el("btnDescargar").disabled = escuchando;
  if (!el("btnCantar").hidden) el("btnCantar").disabled = escuchando;
  if (!el("btnImitar").hidden) el("btnImitar").disabled = escuchando;
}

function nombreArchivoSugerido() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (modoActual === "individual") return `nota-${midiANombre(notaIndividual)}-${ts}.mp3`;
  if (modoActual === "aleatorio") return `piano-aleatorio-${ts}.mp3`;
  if (modoActual === "personalizada") return `escala-personalizada-${ts}.mp3`;
  if (modoActual === "solfeo") return `solfeo-${el("solfeoTonica").value}-${el("solfeoPatron").value}-${ts}.mp3`;
  return `escala-${el("voz").value}-${el("patron").value}-${ts}.mp3`;
}

/** Reproduce una lista de eventos ya construida, con resaltado del teclado. */
async function reproducirEventos(eventos) {
  if (!window.PianoEngine) {
    el("estado").textContent = "El piano todavía se está inicializando, espera un segundo…";
    return;
  }
  limpiarTeclasActivas(); // por si quedó alguna "pegada" de una reproducción detenida a medias
  fijarEstadoBotones({ escuchando: true });
  try {
    await window.PianoEngine.reproducirSecuencia(eventos, parseFloat(el("volumen").value), {
      onCargando: (cargando) => {
        el("estado").textContent = cargando ? "Cargando piano (solo la primera vez)…" : "";
      },
      onNotaInicio: (midi) => marcarTeclaActiva(midi, true),
      onNotaFin: (midi) => marcarTeclaActiva(midi, false),
      onTerminar: () => fijarEstadoBotones({ escuchando: false }),
    });
  } catch (err) {
    el("estado").textContent = `Error de audio: ${err.message}`;
    fijarEstadoBotones({ escuchando: false });
  }
}

// --- "Cantar y calificar" (micrófono) ------------------------------------

function cancelarCantoSiHaceFalta() {
  if (!cantoEnCurso) return;
  cantoCancelado = true;
  if (window.PianoEngine) window.PianoEngine.detenerReproduccion(); // también corta la escucha del mic
}

function calificarCents(cents) {
  const abs = Math.abs(cents);
  if (abs <= 12) return { emoji: "✅", texto: "¡Perfecto!", puntos: 100 };
  if (abs <= 30) return { emoji: "🙂", texto: cents > 0 ? "Un poco alto" : "Un poco bajo", puntos: 80 };
  if (abs <= 60) return { emoji: "😐", texto: cents > 0 ? "Alto" : "Bajo", puntos: 50 };
  return { emoji: "❌", texto: cents > 0 ? "Muy alto" : "Muy bajo", puntos: 20 };
}

function agregarBadgeResultado(texto) {
  const item = document.createElement("div");
  item.className = "resultado-nota";
  item.textContent = texto;
  el("resultadosCanto").appendChild(item);
}

/** Flujo de "llamada y respuesta": el programa toca cada nota y, justo
 * después, escucha al alumno cantarla de vuelta por el micrófono, comparando
 * la afinación real contra la nota objetivo (en cents) y mostrando una
 * calificación por nota y una puntuación media al final. */
async function cantarYCalificar() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estado").textContent = "Este navegador no permite usar el micrófono aquí (hace falta https, o probarlo en local).";
    return;
  }
  let resultado;
  try {
    resultado = obtenerSecuencia(modoActual === "aleatorio");
  } catch (err) {
    el("estado").textContent = err.message;
    return;
  }
  el("resultado").hidden = false;
  el("infoSecuencia").textContent = resultado.info;
  el("resultadosCanto").innerHTML = "";

  cantoEnCurso = true;
  cantoCancelado = false;
  el("btnEscuchar").disabled = true;
  el("btnDescargar").disabled = true;
  el("btnCantar").disabled = true;
  el("btnDetener").disabled = false;

  try {
    el("estado").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
  } catch (err) {
    el("estado").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    cantoEnCurso = false;
    fijarEstadoBotones({ escuchando: false });
    return;
  }

  const notas = resultado.eventos.filter((e) => e.midi !== -1);
  const puntuaciones = [];

  for (const evento of notas) {
    if (cantoCancelado) break;

    marcarTeclaActiva(evento.midi, true);
    el("estado").textContent = `Escucha: ${etiquetaNota(evento.midi)}…`;
    await window.PianoEngine.reproducirSecuencia(
      [{ midi: evento.midi, duracion: evento.duracion }],
      parseFloat(el("volumen").value),
      {}
    );
    if (cantoCancelado) {
      marcarTeclaActiva(evento.midi, false);
      break;
    }

    el("estado").textContent = `🎤 Ahora canta: ${etiquetaNota(evento.midi)}…`;
    mostrarAfinometro(true);
    const analisis = await window.MicrofonoEngine.escucharYPuntuar(evento.midi, Math.max(1, evento.duracion), (cents) =>
      actualizarAfinometro(cents)
    );
    mostrarAfinometro(false);
    marcarTeclaActiva(evento.midi, false);
    if (cantoCancelado) break;

    if (!analisis.detectado) {
      agregarBadgeResultado(`${etiquetaNota(evento.midi)}: 🔇 no te oí bien`);
    } else {
      const cal = calificarCents(analisis.centsPromedio);
      const signo = analisis.centsPromedio > 0 ? "+" : "";
      agregarBadgeResultado(
        `${etiquetaNota(evento.midi)}: ${cal.emoji} ${cal.texto} (${signo}${Math.round(analisis.centsPromedio)}¢)`
      );
      puntuaciones.push(cal.puntos);
    }
  }

  cantoEnCurso = false;
  fijarEstadoBotones({ escuchando: false });

  if (cantoCancelado) {
    el("estado").textContent = "Práctica detenida.";
  } else if (puntuaciones.length === 0) {
    el("estado").textContent = "No pude detectar tu voz. Acércate al micrófono o canta un poco más fuerte.";
  } else {
    const media = Math.round(puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length);
    el("estado").textContent = `Puntuación media: ${media}/100 (${puntuaciones.length}/${notas.length} notas detectadas).`;
  }
}

/** Flujo "escucha e imita": el programa toca la frase completa una sola vez
 * (a su tempo real) y luego el alumno la canta de memoria, de corrido; se
 * escucha nota a nota (por el mismo tiempo que duró cada una al sonar) y se
 * califica igual que en "Cantar y calificar", pero sin repetir cada nota
 * justo antes de cantarla — es un eco melódico, no llamada-y-respuesta. */
async function escucharEImitar() {
  if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) {
    el("estado").textContent = "Este navegador no permite usar el micrófono aquí (hace falta https, o probarlo en local).";
    return;
  }
  let resultado;
  try {
    resultado = obtenerSecuencia(modoActual === "aleatorio");
  } catch (err) {
    el("estado").textContent = err.message;
    return;
  }
  el("resultado").hidden = false;
  el("infoSecuencia").textContent = resultado.info;
  el("resultadosCanto").innerHTML = "";

  cantoEnCurso = true;
  cantoCancelado = false;
  el("btnEscuchar").disabled = true;
  el("btnDescargar").disabled = true;
  el("btnCantar").disabled = true;
  el("btnImitar").disabled = true;
  el("btnDetener").disabled = false;

  const notas = resultado.eventos.filter((e) => e.midi !== -1);

  el("estado").textContent = "🔊 Escucha la frase completa…";
  await window.PianoEngine.reproducirSecuencia(resultado.eventos, parseFloat(el("volumen").value), {
    onNotaInicio: (midi) => marcarTeclaActiva(midi, true),
    onNotaFin: (midi) => marcarTeclaActiva(midi, false),
  });
  if (cantoCancelado) {
    cantoEnCurso = false;
    fijarEstadoBotones({ escuchando: false });
    el("estado").textContent = "Práctica detenida.";
    return;
  }

  try {
    el("estado").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
  } catch (err) {
    el("estado").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    cantoEnCurso = false;
    fijarEstadoBotones({ escuchando: false });
    return;
  }

  el("estado").textContent = "🎤 Ahora canta la frase completa de memoria, nota por nota…";
  const puntuaciones = [];

  for (const evento of notas) {
    if (cantoCancelado) break;

    marcarTeclaActiva(evento.midi, true);
    mostrarAfinometro(true);
    const analisis = await window.MicrofonoEngine.escucharYPuntuar(evento.midi, Math.max(1, evento.duracion), (cents) =>
      actualizarAfinometro(cents)
    );
    mostrarAfinometro(false);
    marcarTeclaActiva(evento.midi, false);
    if (cantoCancelado) break;

    if (!analisis.detectado) {
      agregarBadgeResultado(`${etiquetaNota(evento.midi)}: 🔇 no te oí bien`);
    } else {
      const cal = calificarCents(analisis.centsPromedio);
      const signo = analisis.centsPromedio > 0 ? "+" : "";
      agregarBadgeResultado(
        `${etiquetaNota(evento.midi)}: ${cal.emoji} ${cal.texto} (${signo}${Math.round(analisis.centsPromedio)}¢)`
      );
      puntuaciones.push(cal.puntos);
    }
  }

  cantoEnCurso = false;
  fijarEstadoBotones({ escuchando: false });

  if (cantoCancelado) {
    el("estado").textContent = "Práctica detenida.";
  } else if (puntuaciones.length === 0) {
    el("estado").textContent = "No pude detectar tu voz. Acércate al micrófono o canta un poco más fuerte.";
  } else {
    const media = Math.round(puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length);
    el("estado").textContent = `Puntuación media: ${media}/100 (${puntuaciones.length}/${notas.length} notas detectadas).`;
  }
}

// --- Metrónomo -----------------------------------------------------------

function inicializarMetronomo() {
  const bpmSlider = el("bpmSlider");
  const bpmValor = el("bpmValor");
  const acentoSelect = el("metronomoAcento");
  const punto = el("metronomoPunto");
  const btnIniciar = el("btnMetronomoIniciar");
  const btnDetener = el("btnMetronomoDetener");

  bpmSlider.addEventListener("input", () => {
    bpmValor.textContent = bpmSlider.value;
    if (metronomoEnMarcha && window.MetronomoEngine) {
      window.MetronomoEngine.ajustarBpm(parseInt(bpmSlider.value, 10));
    }
    if (el("sincronizarTempo").checked) {
      actualizarDuracionCalculada();
      invalidarSecuencia();
    }
  });

  acentoSelect.addEventListener("change", () => {
    if (metronomoEnMarcha && window.MetronomoEngine) {
      window.MetronomoEngine.ajustarAcento(parseInt(acentoSelect.value, 10));
    }
  });

  btnIniciar.addEventListener("click", () => {
    if (!window.MetronomoEngine) return;
    metronomoEnMarcha = true;
    btnIniciar.disabled = true;
    btnDetener.disabled = false;
    window.MetronomoEngine.iniciar(parseInt(bpmSlider.value, 10), parseInt(acentoSelect.value, 10), (acento) => {
      punto.classList.remove("pulso", "acento");
      void punto.offsetWidth; // fuerza reflow para reiniciar la animación en cada pulso
      punto.classList.add("pulso");
      if (acento) punto.classList.add("acento");
    });
  });

  btnDetener.addEventListener("click", detenerMetronomoSiHaceFalta);
}

function inicializar() {
  if (window.Progreso) Progreso.marcarHerramientaUsada("piano");
  poblarSelects();
  actualizarDescripcionPatron();
  actualizarVisibilidadNotaInicial();
  inicializarPiano(manejarClicPianoIndividual);
  actualizarNotaSeleccionadaUI();
  inicializarMetronomo();
  actualizarVisibilidadDuracion();
  cambiarModo("individual");

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => cambiarModo(btn.dataset.modo));
  });

  el("patron").addEventListener("change", () => {
    actualizarDescripcionPatron();
    invalidarSecuencia();
  });
  el("escalera").addEventListener("change", () => {
    actualizarVisibilidadNotaInicial();
    invalidarSecuencia();
  });

  const conectarSalida = (idInput, idSalida, sufijo = "") =>
    el(idInput).addEventListener("input", () => {
      el(idSalida).textContent = `${el(idInput).value}${sufijo}`;
      invalidarSecuencia();
    });
  conectarSalida("numNotas", "numNotasValor");
  conectarSalida("duracionNota", "duracionNotaValor", "s");
  conectarSalida("pausa", "pausaValor", "s");

  el("sincronizarTempo").addEventListener("change", () => {
    actualizarVisibilidadDuracion();
    invalidarSecuencia();
  });
  el("figuraRitmica").addEventListener("change", () => {
    actualizarDuracionCalculada();
    invalidarSecuencia();
  });

  ["semilla", "voz", "notaInicial", "pasoSemitonos", "soloSubida", "notasPersonalizadas"].forEach((id) => {
    el(id).addEventListener("input", invalidarSecuencia);
    el(id).addEventListener("change", invalidarSecuencia);
  });

  el("btnEscuchar").addEventListener("click", () => {
    let resultado;
    try {
      resultado = obtenerSecuencia(true);
    } catch (err) {
      el("estado").textContent = err.message;
      return;
    }
    el("resultado").hidden = false;
    el("infoSecuencia").textContent = resultado.info;
    reproducirEventos(resultado.eventos);
  });

  el("btnDetener").addEventListener("click", () => {
    if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
    cancelarCantoSiHaceFalta();
    limpiarTeclasActivas();
    if (!cantoEnCurso) {
      fijarEstadoBotones({ escuchando: false });
    } else {
      // "Cantar y calificar"/"Escucha e imita" no se pueden cortar al
      // instante (la nota o la escucha en curso tiene que terminar su
      // temporizador para que el bucle compruebe la cancelación), así que
      // al menos se avisa de inmediato en vez de parecer que no hizo nada.
      el("btnDetener").disabled = true;
      el("estado").textContent = "Deteniendo…";
    }
  });

  el("btnCantar").addEventListener("click", cantarYCalificar);
  el("btnImitar").addEventListener("click", escucharEImitar);

  el("btnDescargar").addEventListener("click", async () => {
    if (!window.PianoEngine) {
      el("estado").textContent = "El piano todavía se está inicializando, espera un segundo…";
      return;
    }
    let resultado;
    try {
      resultado = obtenerSecuencia(false);
    } catch (err) {
      el("estado").textContent = err.message;
      return;
    }
    el("resultado").hidden = false;
    el("infoSecuencia").textContent = resultado.info;

    const duracionTotal = resultado.eventos.reduce((acc, e) => acc + e.duracion, 0);
    const LIMITE_SEGUNDOS = 240;
    if (duracionTotal > LIMITE_SEGUNDOS) {
      el("estado").textContent =
        `Esa combinación generaría ${Math.round(duracionTotal)}s de audio (límite: ${LIMITE_SEGUNDOS}s). ` +
        `Reduce el número de notas, la duración por nota o desactiva la escalera.`;
      return;
    }

    const boton = el("btnDescargar");
    boton.disabled = true;
    el("btnEscuchar").disabled = true;
    el("estado").textContent = "Generando MP3 (puede tardar unos segundos)…";
    try {
      await window.PianoEngine.exportarMp3(resultado.eventos, parseFloat(el("volumen").value), nombreArchivoSugerido());
      el("estado").textContent = "Listo — revisa tus descargas.";
    } catch (err) {
      el("estado").textContent = `Error al generar el MP3: ${err.message}`;
    } finally {
      boton.disabled = false;
      el("btnEscuchar").disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", inicializar);
