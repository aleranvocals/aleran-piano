/*
 * piano.js — la página Piano: los 5 modos (nota individual, aleatorias,
 * escala, personalizada, metrónomo), "Cantar y calificar", y el cableado
 * del teclado compartido (teclado.js) para esta página en concreto.
 */

// Respiro entre que el piano toca la nota de referencia y se empieza a
// escuchar al alumno -- ver silenciarPianoAhora() en audio.js para el porqué.
const PAUSA_ANTES_DE_ESCUCHAR_MS = 250;

let modoActual = "individual";
let notaIndividual = nombreAMidi("Do3");
let secuenciaActual = null; // cache: lo último generado, para que "Descargar" coincida con lo que sonó
let metronomoEnMarcha = false;
let cantoEnCurso = false;
let cantoCancelado = false;
let solfeoTonicaMidi = nombreAMidi("Do3");

// --- Personalizada: editor de ritmo (Modo Simple / Modo Músico) -----------
// unidadesPersonalizadas: [{ texto, midi: number|null, figura: idDeFigura,
// puntillo?, ligadura?, tresillo? }]. midi === null es un silencio (sin
// sonido, sí ocupa el tiempo de su figura). Los tres campos opcionales solo
// los pone/usa el Modo Músico -- en Modo Simple simplemente no existen.
let unidadesPersonalizadas = [];
// Si esta melodía llegó desde una línea de Cifrado, el id de esa línea --
// así "Guardar y volver" sabe a dónde mandar el resultado.
let personalizadaLineaId = null;
// Modo Músico: activa puntillo/ligadura/tresillo por nota + agrupación en
// compases según personalizadaMetrica -- mismo motor/datos que Modo Simple
// (unidadesAEventos en escalas.js ya entiende esos campos), solo cambian
// los controles que se muestran.
let personalizadaModoMusico = false;
let personalizadaMetrica = "4/4";
const CLAVE_RITMO_ENVIO = "aleran-piano-ritmo-envio";
const CLAVE_RITMO_RESULTADO_PREFIJO = "aleran-piano-ritmo-resultado-";

// --- Solfeo (do movible) --------------------------------------------------
// Sílabas cromáticas estándar (sistema Kodály, alteradas con la variante
// "bemol" -- Me/Le/Te/Ra en vez de Ri/Si/Li/Di -- por ser la que se lee y
// canta más intuitivamente al bajar un grado, que es lo que hace falta para
// nombrar los grados propios de la escala menor y de los modos griegos).
const SOLFEO_GRADOS = {
  0: "Do", 1: "Ra", 2: "Re", 3: "Me", 4: "Mi", 5: "Fa", 6: "Fi",
  7: "Sol", 8: "Le", 9: "La", 10: "Te", 11: "Si", 12: "Do",
};

const SOLFEO_CATEGORIAS = {
  basicos: "Básicos",
  escalas: "Escalas",
  modos: "Modos griegos",
  cadencias: "Cadencias y saltos",
};

const SOLFEO_PATRONES = {
  primeros_tres: {
    nombre: "Primeros tres grados (Do-Re-Mi)",
    categoria: "basicos",
    semitonos: [0, 2, 4, 2, 0],
  },
  primeros_cinco: {
    nombre: "Primeros cinco grados (Do-Re-Mi-Fa-Sol)",
    categoria: "basicos",
    semitonos: [0, 2, 4, 5, 7, 5, 4, 2, 0],
  },
  triada_mayor: {
    nombre: "Tríada mayor (Do-Mi-Sol-Do)",
    categoria: "basicos",
    semitonos: [0, 4, 7, 12, 7, 4, 0],
  },
  triada_menor: {
    nombre: "Tríada menor (Do-Me-Sol-Do)",
    categoria: "basicos",
    semitonos: [0, 3, 7, 12, 7, 3, 0],
  },
  escala_mayor: {
    nombre: "Escala mayor (Do-Re-Mi-Fa-Sol-La-Si-Do)",
    categoria: "escalas",
    semitonos: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0],
  },
  escala_menor_natural: {
    nombre: "Escala menor natural (Do-Re-Me-Fa-Sol-Le-Te-Do)",
    categoria: "escalas",
    semitonos: [0, 2, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 2, 0],
  },
  escala_menor_armonica: {
    nombre: "Escala menor armónica (Do-Re-Me-Fa-Sol-Le-Si-Do)",
    categoria: "escalas",
    semitonos: [0, 2, 3, 5, 7, 8, 11, 12, 11, 8, 7, 5, 3, 2, 0],
  },
  pentatonica_mayor: {
    nombre: "Pentatónica mayor (Do-Re-Mi-Sol-La-Do)",
    categoria: "escalas",
    semitonos: [0, 2, 4, 7, 9, 12, 9, 7, 4, 2, 0],
  },
  pentatonica_menor: {
    nombre: "Pentatónica menor (Do-Me-Fa-Sol-Te-Do)",
    categoria: "escalas",
    semitonos: [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0],
  },
  modo_dorico: {
    nombre: "Dórico (Do-Re-Me-Fa-Sol-La-Te-Do)",
    categoria: "modos",
    semitonos: [0, 2, 3, 5, 7, 9, 10, 12, 10, 9, 7, 5, 3, 2, 0],
  },
  modo_frigio: {
    nombre: "Frigio (Do-Ra-Me-Fa-Sol-Le-Te-Do)",
    categoria: "modos",
    semitonos: [0, 1, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 1, 0],
  },
  modo_lidio: {
    nombre: "Lidio (Do-Re-Mi-Fi-Sol-La-Si-Do)",
    categoria: "modos",
    semitonos: [0, 2, 4, 6, 7, 9, 11, 12, 11, 9, 7, 6, 4, 2, 0],
  },
  modo_mixolidio: {
    nombre: "Mixolidio (Do-Re-Mi-Fa-Sol-La-Te-Do)",
    categoria: "modos",
    semitonos: [0, 2, 4, 5, 7, 9, 10, 12, 10, 9, 7, 5, 4, 2, 0],
  },
  cadencia_iv_v_i: {
    nombre: "Cadencia IV-V-I (Do-Fa-Sol-Do)",
    categoria: "cadencias",
    semitonos: [0, 5, 7, 12],
  },
  salto_quinta: {
    nombre: "Salto de 5ª (Do-Sol-Do-Sol)",
    categoria: "cadencias",
    semitonos: [0, 7, 12, 7],
  },
  salto_octava: {
    nombre: "Salto de 8ª (Do-Do agudo-Do)",
    categoria: "cadencias",
    semitonos: [0, 12, 0],
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
  const gruposSolfeoPorCategoria = {};
  for (const [clave, patron] of Object.entries(SOLFEO_PATRONES)) {
    const categoria = patron.categoria || "otras";
    if (!gruposSolfeoPorCategoria[categoria]) {
      const grupo = document.createElement("optgroup");
      grupo.label = SOLFEO_CATEGORIAS[categoria] || categoria;
      gruposSolfeoPorCategoria[categoria] = grupo;
      selectSolfeoPatron.appendChild(grupo);
    }
    const opt = document.createElement("option");
    opt.value = clave;
    opt.textContent = patron.nombre;
    gruposSolfeoPorCategoria[categoria].appendChild(opt);
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
  el("metroFlotToggle").textContent = "▶";
  el("metroFlotToggle").classList.remove("en-marcha");
}

/** Aplica un BPM nuevo a los dos sitios donde se puede tocar (la pestaña
 * detallada y la barra compacta), al motor si está sonando, y a la
 * duración de nota si está vinculada al tempo. */
function fijarBpm(bpm) {
  el("bpmSlider").value = bpm;
  el("bpmValor").textContent = bpm;
  el("metroFlotBpm").value = bpm;
  el("metroFlotBpmValor").textContent = bpm;
  el("personalizadaBpmTexto").textContent = bpm;
  if (metronomoEnMarcha && window.MetronomoEngine) window.MetronomoEngine.ajustarBpm(bpm);
  if (el("sincronizarTempo").checked) {
    actualizarDuracionCalculada();
    invalidarSecuencia();
  }
  if (modoActual === "personalizada") invalidarSecuencia();
}

function fijarVolumenMetronomo(volumen) {
  el("metroFlotVolumen").value = volumen;
  if (window.MetronomoEngine) window.MetronomoEngine.ajustarVolumen(volumen);
}

function cambiarModo(modo) {
  // El metrónomo YA NO se para al cambiar de pestaña -- sigue sonando de
  // fondo, mezclado con lo que suene en cualquier otro modo, y se controla
  // desde la barra compacta (metronomoFlotante) visible en todas ellas.
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
  el("panel-ritmo").hidden = modo !== "ritmo";

  const esMetronomo = modo === "metronomo";
  // Ritmo (palmas) es independiente del piano -- no toca teclas, no usa
  // duración/pausa compartidas ni "cantar y calificar" (no es para cantar).
  const esRitmo = modo === "ritmo";
  // Personalizada ya no usa duración/pausa compartidas -- cada nota lleva su
  // propia figura musical (Modo Simple del editor de ritmo).
  el("panelComunes").hidden = esMetronomo || esRitmo || modo === "personalizada";
  el("accionesPiano").hidden = esMetronomo || esRitmo;
  el("pianoContenedor").hidden = esMetronomo || esRitmo;
  el("pianoDesplazamiento").hidden = esMetronomo || esRitmo;
  // "Cantar y calificar": tiene sentido en cualquier modo que genere una
  // nota o secuencia concreta que repetir (todos menos el metrónomo y el ritmo).
  el("btnCantar").hidden = esMetronomo || esRitmo;
  // "Escucha e imita" solo tiene sentido con una frase de varias notas
  // (con una sola nota es exactamente lo mismo que "Cantar y calificar").
  el("btnImitar").hidden = esMetronomo || esRitmo || modo === "individual";

  // La barra compacta del metrónomo es redundante con el panel detallado
  // cuando ya se está en la pestaña Metrónomo -- se oculta solo ahí.
  el("metronomoFlotante").hidden = esMetronomo;

  actualizarVisibilidadDuracion(); // también decide si "pausa" tiene sentido en este modo
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
  // Con la duración vinculada al tempo, el espacio entre notas ya lo marca
  // el propio pulso -- una pausa adicional encima no tiene sentido y solo
  // desincroniza la secuencia del metrónomo.
  el("campoPausa").hidden = sincronizado || modoActual === "individual";
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

// --- Personalizada: editor de ritmo (Modo Simple / Modo Músico) -----------
// Reutiliza el mismo lenguaje visual que Cifrado (.cifrado-linea/.cifrado-celda/
// .celda-texto) en vez de inventar uno nuevo, tal como se pidió. Modo Músico
// no es un sistema aparte: son controles extra sobre las mismas unidades.

function fijarModoMusico(activo) {
  personalizadaModoMusico = activo;
  el("btnModoSimple").classList.toggle("activo", !activo);
  el("btnModoSimple").setAttribute("aria-selected", String(!activo));
  el("btnModoMusico").classList.toggle("activo", activo);
  el("btnModoMusico").setAttribute("aria-selected", String(activo));
  el("descModoSimple").hidden = activo;
  el("descModoMusico").hidden = !activo;
  el("campoMetricaMusico").hidden = !activo;
  renderPersonalizada();
  invalidarSecuencia();
}

function renderPersonalizada() {
  const lista = el("personalizadaLista");
  lista.innerHTML = "";
  lista.style.gridTemplateColumns = unidadesPersonalizadas.length
    ? `repeat(${unidadesPersonalizadas.length}, auto)`
    : "";
  el("personalizadaVacio").hidden = unidadesPersonalizadas.length > 0;
  el("accionesVolverCifrado").hidden = personalizadaLineaId === null;

  const agrupado = personalizadaModoMusico
    ? agruparEnCompases(unidadesPersonalizadas, personalizadaMetrica)
    : null;

  unidadesPersonalizadas.forEach((unidad, indice) => {
    lista.appendChild(crearCeldaPersonalizada(unidad, indice, agrupado));
  });

  actualizarAvisoCompases(agrupado);
}

/** Aviso textual (no bloqueante) de qué compases no cuadran con la métrica
 * elegida -- el divisor visual en las celdas ya lo muestra, pero un número
 * de compás concreto es más fácil de ubicar que solo una raya. */
function actualizarAvisoCompases(agrupado) {
  const aviso = el("personalizadaCompasesAviso");
  if (!agrupado) {
    aviso.hidden = true;
    return;
  }
  const numerosQueNoCuadran = agrupado.grupos
    .map((g, i) => (g.cuadra ? null : i + 1))
    .filter((n) => n !== null);
  aviso.hidden = numerosQueNoCuadran.length === 0;
  if (!aviso.hidden) {
    const plural = numerosQueNoCuadran.length > 1 ? "s" : "";
    aviso.textContent = `⚠️ El compás${plural} ${numerosQueNoCuadran.join(", ")} no cuadra${plural} con la métrica elegida (solo un aviso, no bloquea nada).`;
  }
}

function crearCeldaPersonalizada(unidad, indice, agrupado) {
  const wrap = document.createElement("div");
  wrap.className = "cifrado-celda";
  wrap.style.gridColumn = String(indice + 1);
  wrap.style.gridRow = "1";
  if (agrupado && indice > 0 && agrupado.compasDeUnidad[indice] !== agrupado.compasDeUnidad[indice - 1]) {
    wrap.classList.add("compas-inicio");
  }

  const texto = document.createElement("span");
  texto.className = "celda-texto";
  texto.contentEditable = "true";
  texto.spellcheck = false;
  texto.textContent = unidad.texto;
  // El texto de la celda no siempre es una nota (puede ser una sílaba
  // traída de Cifrado), así que no se valida en cada tecleo como en Mapa
  // vocal/Cifrado -- eso daría falsos positivos constantes. Solo se marca
  // cuando este texto vino de un "Do3" puesto como relleno automático (ver
  // silencioBtn más abajo), y se limpia en cuanto la persona la toca.
  if (unidad._necesitaCorregirNota) marcarCampoNotaInvalido(texto, true, "Nota puesta automáticamente -- revisa y corrige si hace falta.");
  texto.addEventListener("input", () => {
    unidad.texto = texto.textContent;
    unidad._necesitaCorregirNota = false;
    marcarCampoNotaInvalido(texto, false);
  });
  wrap.appendChild(texto);

  const figuraSelect = document.createElement("select");
  figuraSelect.className = "celda-figura";
  FIGURAS.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = `${f.simbolo} ${f.nombre}`;
    figuraSelect.appendChild(opt);
  });
  figuraSelect.value = unidad.figura;
  figuraSelect.addEventListener("change", () => {
    unidad.figura = figuraSelect.value;
  });
  wrap.appendChild(figuraSelect);

  const filaBotones = document.createElement("div");
  filaBotones.className = "celda-fila-botones";

  const silencioBtn = document.createElement("button");
  silencioBtn.type = "button";
  silencioBtn.className = "celda-marca-btn";
  const esSilencio = unidad.midi === null;
  silencioBtn.title = esSilencio ? "Ponerle sonido de nuevo" : "Marcar como silencio";
  silencioBtn.textContent = esSilencio ? "🔇" : "🔊";
  silencioBtn.addEventListener("click", () => {
    if (unidad.midi === null) {
      // OJO: el texto de la celda no siempre es un nombre de nota -- si esta
      // unidad llegó de Cifrado como sílaba ("la", "vi"...) el texto es la
      // letra de la canción, no una nota, así que nombreAMidi() falla aquí a
      // propósito. Antes eso se resolvía sustituyendo Do3 en silencio, sin
      // avisar de nada; ahora se avisa con claridad y se marca la celda para
      // que quede obvio cuál hay que corregir a mano.
      const r = interpretarNota(unidad.texto);
      if (r.valido) {
        unidad.midi = r.midi;
      } else if (unidad._ultimoMidi != null) {
        unidad.midi = unidad._ultimoMidi;
      } else {
        unidad.midi = nombreAMidi("Do3");
        unidad._necesitaCorregirNota = true;
        avisarPersonalizada(`"${unidad.texto || "(vacío)"}" no es una nota reconocible -- se le puso Do3 de punto de partida, corrígela escribiendo el nombre real (ej. Do4, A4, Fa#3) en esa celda.`);
      }
    } else {
      unidad._ultimoMidi = unidad.midi;
      unidad.midi = null;
    }
    renderPersonalizada();
  });
  filaBotones.appendChild(silencioBtn);

  if (personalizadaModoMusico) {
    const btnPuntillo = document.createElement("button");
    btnPuntillo.type = "button";
    btnPuntillo.className = "celda-marca-btn" + (unidad.puntillo ? " activo" : "");
    btnPuntillo.title = "Puntillo (alarga la figura la mitad de su valor)";
    btnPuntillo.textContent = "•";
    btnPuntillo.addEventListener("click", () => {
      unidad.puntillo = !unidad.puntillo;
      renderPersonalizada();
    });
    filaBotones.appendChild(btnPuntillo);

    const btnTresillo = document.createElement("button");
    btnTresillo.type = "button";
    btnTresillo.className = "celda-marca-btn" + (unidad.tresillo ? " activo" : "");
    btnTresillo.title = "Tresillo (marca esta nota junto con otras 2 seguidas: las 3 ocupan el tiempo de 2)";
    btnTresillo.textContent = "3";
    btnTresillo.addEventListener("click", () => {
      unidad.tresillo = !unidad.tresillo;
      renderPersonalizada();
    });
    filaBotones.appendChild(btnTresillo);

    const puedeLigar = indice < unidadesPersonalizadas.length - 1 && unidad.midi !== null;
    const btnLigadura = document.createElement("button");
    btnLigadura.type = "button";
    btnLigadura.className = "celda-marca-btn" + (unidad.ligadura ? " activo" : "");
    btnLigadura.title = puedeLigar
      ? "Ligadura (se funde con la siguiente nota en un solo sonido, sin volver a atacarla)"
      : "La ligadura necesita una nota siguiente (no un silencio) para fundirse con ella";
    btnLigadura.textContent = "🔗";
    btnLigadura.disabled = !puedeLigar;
    btnLigadura.addEventListener("click", () => {
      unidad.ligadura = !unidad.ligadura;
      renderPersonalizada();
    });
    filaBotones.appendChild(btnLigadura);
  }

  const btnBorrar = document.createElement("button");
  btnBorrar.type = "button";
  btnBorrar.className = "celda-marca-btn";
  btnBorrar.title = "Quitar esta nota";
  btnBorrar.textContent = "×";
  btnBorrar.addEventListener("click", () => {
    unidadesPersonalizadas.splice(indice, 1);
    renderPersonalizada();
  });
  filaBotones.appendChild(btnBorrar);

  wrap.appendChild(filaBotones);
  return wrap;
}

function eventosPersonalizadaConRitmo() {
  if (unidadesPersonalizadas.length === 0) {
    throw new Error('Todavía no hay notas en Personalizada -- escribe algunas o mándalas desde Cifrado con "Llevar al editor de ritmo".');
  }
  const bpm = parseInt(el("bpmSlider").value, 10) || 100;
  const eventos = unidadesAEventos(unidadesPersonalizadas, bpm);
  const modo = personalizadaModoMusico ? `Modo Músico, ${personalizadaMetrica}` : "Modo Simple";
  const info = `Personalizada (${modo}) — ${unidadesPersonalizadas.length} unidades a ${bpm} BPM`;
  return { eventos, info };
}

/** Si venimos de "Llevar al editor de ritmo" en Cifrado, hay una melodía
 * esperando en localStorage -- se carga, se cambia a esta pestaña, y se
 * borra esa clave (ya está consumida). */
function cargarPersonalizadaDesdeCifradoSiHaceFalta() {
  let crudo;
  try {
    crudo = localStorage.getItem(CLAVE_RITMO_ENVIO);
  } catch {
    crudo = null;
  }
  if (!crudo) return;
  try {
    const datos = JSON.parse(crudo);
    unidadesPersonalizadas = datos.unidades.map((u) => ({
      texto: u.texto,
      midi: typeof u.midi === "number" ? u.midi : null,
      figura: "negra",
    }));
    personalizadaLineaId = datos.lineaId;
    cambiarModo("personalizada");
    renderPersonalizada();
  } catch {
    // Datos corruptos: no hay mucho que hacer salvo no romper la carga de la página.
  } finally {
    try {
      localStorage.removeItem(CLAVE_RITMO_ENVIO);
    } catch {
      /* localStorage bloqueado (privado/incógnito): no pasa nada, solo no se limpia. */
    }
  }
}

// El #estado compartido de la página queda varias secciones por debajo de
// los botones propios de Personalizada (Usar notas/Descargar/Abrir) -- sin
// esto, un error ahí era técnicamente visible pero fuera de la vista en
// cualquier pantalla que no fuera muy alta, sobre todo en móvil.
function avisarPersonalizada(mensaje) {
  el("estado").textContent = mensaje;
  const local = el("estadoPersonalizada");
  if (local) local.textContent = mensaje;
}

function inicializarPersonalizada() {
  el("btnModoSimple").addEventListener("click", () => fijarModoMusico(false));
  el("btnModoMusico").addEventListener("click", () => fijarModoMusico(true));
  el("personalizadaMetrica").addEventListener("change", () => {
    personalizadaMetrica = el("personalizadaMetrica").value;
    renderPersonalizada();
  });

  el("btnUsarNotas").addEventListener("click", () => {
    let midis;
    try {
      midis = parsearNotasPersonalizadas(el("notasPersonalizadas").value);
    } catch (err) {
      marcarCampoNotaInvalido(el("notasPersonalizadas"), true, err.message);
      avisarPersonalizada(err.message);
      return;
    }
    marcarCampoNotaInvalido(el("notasPersonalizadas"), false);
    avisarPersonalizada("");
    midis.forEach((midi) => unidadesPersonalizadas.push({ texto: midiANombre(midi), midi, figura: "negra" }));
    el("notasPersonalizadas").value = "";
    invalidarSecuencia();
    renderPersonalizada();
  });
  el("notasPersonalizadas").addEventListener("input", () => marcarCampoNotaInvalido(el("notasPersonalizadas"), false));

  el("btnLimpiarPersonalizada").addEventListener("click", () => {
    if (unidadesPersonalizadas.length && !confirm("¿Vaciar toda la lista de Personalizada?")) return;
    unidadesPersonalizadas = [];
    personalizadaLineaId = null;
    invalidarSecuencia();
    renderPersonalizada();
  });

  el("btnDescargarMelodia").addEventListener("click", () => {
    if (unidadesPersonalizadas.length === 0) {
      avisarPersonalizada("No hay nada que descargar todavía.");
      return;
    }
    const datos = {
      bpm: parseInt(el("bpmSlider").value, 10) || 100,
      modoMusico: personalizadaModoMusico,
      metrica: personalizadaMetrica,
      unidades: unidadesPersonalizadas,
    };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `melodia-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  el("btnAbrirMelodia").addEventListener("click", () => el("inputAbrirMelodia").click());
  el("inputAbrirMelodia").addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      const datos = JSON.parse(texto);
      if (!Array.isArray(datos.unidades)) throw new Error("El archivo no tiene el formato esperado");
      unidadesPersonalizadas = datos.unidades;
      if (datos.bpm) fijarBpm(datos.bpm);
      if (datos.metrica) {
        personalizadaMetrica = datos.metrica;
        el("personalizadaMetrica").value = datos.metrica;
      }
      fijarModoMusico(!!datos.modoMusico);
      personalizadaLineaId = null;
      invalidarSecuencia();
      avisarPersonalizada("Melodía cargada.");
    } catch (err) {
      avisarPersonalizada(`No se pudo abrir el archivo: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  });

  el("btnGuardarYVolver").addEventListener("click", () => {
    if (personalizadaLineaId === null) return;
    try {
      localStorage.setItem(
        CLAVE_RITMO_RESULTADO_PREFIJO + personalizadaLineaId,
        JSON.stringify({ unidades: unidadesPersonalizadas, bpm: parseInt(el("bpmSlider").value, 10) || 100 })
      );
    } catch {
      /* localStorage lleno o bloqueado -- no hay mucho más que hacer aquí. */
    }
    window.location.href = "cifrado.html";
  });

  renderPersonalizada();
}

// --- Generación de eventos ----------------------------------------------

/** Envuelve generarResultadoInterno para que todo resultado tenga `grupos`
 * (las "frases" que "Escucha e imita" toca y para a imitar una por una):
 * los modos que no arman sus propios grupos (todos menos la escalera de
 * "Escala vocal") caen en un único grupo con todos los eventos, que es
 * exactamente el comportamiento de siempre. */
function generarResultado() {
  const resultado = generarResultadoInterno();
  if (!resultado.grupos) resultado.grupos = [resultado.eventos];
  return resultado;
}

function generarResultadoInterno() {
  const duracionNota = duracionNotaActual();
  const pausa = el("sincronizarTempo").checked ? 0 : parseFloat(el("pausa").value);

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
    return eventosPersonalizadaConRitmo();
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

    // El piano suena con muestras reales: aunque la nota "termine", sigue
    // resonando un poco por los altavoces (como un piano de verdad). Sin
    // silenciarla y dar un respiro, esa cola se cuela en el micrófono justo
    // al empezar a escuchar y se calificaba como si fuera la voz del alumno.
    if (window.PianoEngine) window.PianoEngine.silenciarPianoAhora();
    await new Promise((r) => setTimeout(r, PAUSA_ANTES_DE_ESCUCHAR_MS));
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

/** Flujo "escucha e imita": el programa toca una frase, se calla y el
 * alumno la canta de memoria, de corrido (sin repetir cada nota justo antes
 * de cantarla, a diferencia de "Cantar y calificar" — es un eco melódico,
 * no llamada-y-respuesta). Con varias frases (la escalera de "Escala
 * vocal" trae una por raíz) se hace una por una: toca, para, escucha, y
 * recién ahí pasa a la siguiente — nunca toca la escalera entera de
 * corrido antes de dejar imitar. */
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

  try {
    el("estado").textContent = "Pidiendo permiso del micrófono…";
    await window.MicrofonoEngine.iniciar();
  } catch (err) {
    el("estado").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    cantoEnCurso = false;
    fijarEstadoBotones({ escuchando: false });
    return;
  }

  const grupos = resultado.grupos.filter((g) => g.some((e) => e.midi !== -1));
  const totalFrases = grupos.length;
  const puntuaciones = [];
  let notasTotales = 0;

  for (let i = 0; i < grupos.length; i++) {
    if (cantoCancelado) break;
    const grupo = grupos[i];
    const notasGrupo = grupo.filter((e) => e.midi !== -1);
    notasTotales += notasGrupo.length;
    const prefijo = totalFrases > 1 ? `Frase ${i + 1}/${totalFrases}: ` : "";

    el("estado").textContent = `🔊 ${prefijo}Escucha…`;
    await window.PianoEngine.reproducirSecuencia(grupo, parseFloat(el("volumen").value), {
      onNotaInicio: (midi) => marcarTeclaActiva(midi, true),
      onNotaFin: (midi) => marcarTeclaActiva(midi, false),
    });
    if (cantoCancelado) break;

    // Mismo respiro que en "Cantar y calificar": la última nota de la
    // frase (muestra real de piano) sigue resonando un poco tras
    // "terminar", y sin esto esa cola se colaba en el micrófono al
    // empezar a escuchar.
    window.PianoEngine.silenciarPianoAhora();
    await new Promise((r) => setTimeout(r, PAUSA_ANTES_DE_ESCUCHAR_MS));
    if (cantoCancelado) break;

    el("estado").textContent = `🎤 ${prefijo}Canta de memoria, nota por nota…`;

    for (const evento of notasGrupo) {
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
  }

  cantoEnCurso = false;
  fijarEstadoBotones({ escuchando: false });

  if (cantoCancelado) {
    el("estado").textContent = "Práctica detenida.";
  } else if (puntuaciones.length === 0) {
    el("estado").textContent = "No pude detectar tu voz. Acércate al micrófono o canta un poco más fuerte.";
  } else {
    const media = Math.round(puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length);
    el("estado").textContent = `Puntuación media: ${media}/100 (${puntuaciones.length}/${notasTotales} notas detectadas).`;
  }
}

// --- Metrónomo -----------------------------------------------------------

function inicializarMetronomo() {
  const bpmSlider = el("bpmSlider");
  const acentoSelect = el("metronomoAcento");
  const punto = el("metronomoPunto");
  const puntoMini = el("metronomoPuntoMini");
  const btnIniciar = el("btnMetronomoIniciar");
  const btnDetener = el("btnMetronomoDetener");
  const metroFlotBpm = el("metroFlotBpm");
  const metroFlotBpmValor = el("metroFlotBpmValor");
  const metroFlotAcento = el("metroFlotAcento");
  const metroFlotVolumen = el("metroFlotVolumen");
  const metroFlotToggle = el("metroFlotToggle");

  bpmSlider.addEventListener("input", () => fijarBpm(parseInt(bpmSlider.value, 10)));
  metroFlotBpm.addEventListener("input", () => {
    metroFlotBpmValor.textContent = metroFlotBpm.value;
    fijarBpm(parseInt(metroFlotBpm.value, 10));
  });

  // La métrica se puede cambiar tanto desde el panel detallado como desde la
  // barra compacta -- se mantienen los dos selects sincronizados entre sí,
  // igual que ya se hace con el BPM.
  function fijarAcento(valor) {
    acentoSelect.value = valor;
    metroFlotAcento.value = valor;
    if (metronomoEnMarcha && window.MetronomoEngine) window.MetronomoEngine.ajustarAcento(parseInt(valor, 10));
  }
  acentoSelect.addEventListener("change", () => fijarAcento(acentoSelect.value));
  metroFlotAcento.addEventListener("change", () => fijarAcento(metroFlotAcento.value));

  metroFlotVolumen.addEventListener("input", () => fijarVolumenMetronomo(parseFloat(metroFlotVolumen.value)));

  function iniciar() {
    if (!window.MetronomoEngine || metronomoEnMarcha) return;
    metronomoEnMarcha = true;
    btnIniciar.disabled = true;
    btnDetener.disabled = false;
    metroFlotToggle.textContent = "⏹";
    metroFlotToggle.classList.add("en-marcha");
    window.MetronomoEngine.ajustarVolumen(parseFloat(metroFlotVolumen.value));
    window.MetronomoEngine.iniciar(parseInt(bpmSlider.value, 10), parseInt(acentoSelect.value, 10), (acento) => {
      [punto, puntoMini].forEach((p) => {
        p.classList.remove("pulso", "acento");
        void p.offsetWidth; // fuerza reflow para reiniciar la animación en cada pulso
        p.classList.add("pulso");
        if (acento) p.classList.add("acento");
      });
    });
  }

  btnIniciar.addEventListener("click", iniciar);
  btnDetener.addEventListener("click", detenerMetronomoSiHaceFalta);
  metroFlotToggle.addEventListener("click", () => {
    if (metronomoEnMarcha) detenerMetronomoSiHaceFalta();
    else iniciar();
  });
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
  inicializarPersonalizada();
  inicializarRitmo();
  cambiarModo("individual");
  cargarPersonalizadaDesdeCifradoSiHaceFalta();

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
    el("estado").textContent = `Grabando ${Math.ceil(duracionTotal)}s de audio (tarda lo mismo que escucharla)…`;
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
