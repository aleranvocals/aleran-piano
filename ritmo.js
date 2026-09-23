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

// El acento del metrónomo (0/2/3/4/6) SÍ dice cuántos pulsos tiene cada
// compás -- "Sin acento" (0) no fija ninguna métrica real, así que ahí se
// sigue agrupando de a 4 solo para la tira visual, no porque sea 4/4 de verdad.
function pulsosPorCompasMetronomo() {
  const valor = parseInt(el("metroFlotAcento").value, 10);
  return valor > 0 ? valor : 4;
}

/** Refleja en el texto del panel el tempo/métrica reales que se van a usar
 * (los del metrónomo compartido) -- se llama al abrir la pestaña Ritmo, no
 * hace falta mantenerlo sincronizado a cada cambio porque solo se lee ahí. */
function actualizarInfoMetronomoRitmo() {
  const bpmTexto = el("ritmoBpmTexto");
  const acentoTexto = el("ritmoAcentoTexto");
  if (!bpmTexto || !acentoTexto) return;
  bpmTexto.textContent = el("metroFlotBpm").value;
  const valorAcento = parseInt(el("metroFlotAcento").value, 10);
  acentoTexto.textContent = valorAcento > 0 ? `${valorAcento} pulsos por compás` : "sin acento fijo, 4 pulsos por compás";
}

// unidades: [{ figura: idDeFigura, silencio: bool }]. Se rellena COMPÁS POR
// COMPÁS, no la secuencia entera de un tirón -- antes se elegía cada figura
// solo mirando cuánto quedaba de la secuencia COMPLETA, así que una redonda
// podía arrancar a mitad de un compás y terminar a mitad del siguiente
// (nada raro en una partitura real, ahí se ata con una ligadura -- pero
// Ritmo/Modo Simple no tiene ligaduras, así que se sentía como que los
// compases venían mal contados y el acento caía en cualquier lado). Reiniciar
// el resto disponible en cada compás garantiza que cada figura queda
// completa DENTRO de su compás, sin cruzarlo nunca.
function generarRitmoNivel(nivel, compases, pulsosPorCompas) {
  const cfg = configNivelRitmo(nivel);
  const unidades = [];
  for (let c = 0; c < Math.max(1, compases); c++) {
    let restanteCompas = pulsosPorCompas;
    while (restanteCompas > 1e-6) {
      const candidatas = cfg.figuras.filter((id) => figuraPorId(id).pulsos <= restanteCompas + 1e-9);
      const elegibles = candidatas.length > 0 ? candidatas : ["semicorchea"];
      const figura = elegibles[Math.floor(Math.random() * elegibles.length)];
      const silencio = Math.random() < cfg.probSilencio;
      unidades.push({ figura, silencio });
      restanteCompas -= figuraPorId(figura).pulsos;
    }
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
  const pulsosPorCompas = pulsosPorCompasMetronomo();
  let acumulado = 0;
  ritmoUnidades.forEach((u, i) => {
    const fig = figuraPorId(u.figura);
    const celda = document.createElement("div");
    celda.className = "ritmo-celda" + (u.silencio ? " silencio" : "");
    // Divisor visual cada compás (según el acento del metrónomo) -- solo
    // cuando de verdad cae justo en el límite (una redonda a mitad de compás
    // puede desalinearlo, y no pasa nada: no es una raya de compás rigurosa,
    // solo orientación).
    if (i > 0 && Math.abs(acumulado % pulsosPorCompas) < 1e-6) celda.classList.add("compas-inicio");
    const svgIcono = crearElementoSvg("svg", { viewBox: ICONOS_FIGURA_VIEWBOX, class: "ritmo-celda-icono" });
    svgIcono.appendChild(crearUsoNota(u.figura, u.silencio, 0, 0, 24, 34));
    celda.appendChild(svgIcono);
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
  limpiarActivaSecuencia();
  ritmoReproduciendo = false;
  el("btnRitmoEscuchar").disabled = false;
  el("btnRitmoDetener").disabled = true;
}

function nuevoRitmo() {
  if (ritmoReproduciendo) detenerRitmoUI();
  const nivel = parseInt(el("ritmoNivel").value, 10) || 1;
  const compases = Math.max(1, Math.min(8, parseInt(el("ritmoCompases").value, 10) || 4));
  ritmoUnidades = generarRitmoNivel(nivel, compases, pulsosPorCompasMetronomo());
  renderRitmoTira();
  renderSecuenciaRueda();
  actualizarInfoMetronomoRitmo();
}

function actualizarDescripcionNivelRitmo() {
  const nivel = parseInt(el("ritmoNivel").value, 10) || 1;
  el("ritmoNivelValor").textContent = String(nivel);
  el("ritmoNivelDescripcion").textContent = configNivelRitmo(nivel).descripcion;
}

async function reproducirRitmoActual() {
  if (!window.PianoEngine || ritmoUnidades.length === 0 || ritmoReproduciendo) return;
  const bpm = parseInt(el("metroFlotBpm").value, 10) || 100;
  const eventos = unidadesRitmoAEventos(ritmoUnidades, bpm);
  ritmoReproduciendo = true;
  el("btnRitmoEscuchar").disabled = true;
  el("btnRitmoDetener").disabled = false;
  await window.PianoEngine.reproducirRitmo(eventos, 0.75, {
    onEventoInicio: (i) => {
      marcarCeldaActivaRitmo(i);
      const u = ritmoUnidades[i];
      if (u) marcarActivaSecuencia(u.figura, u.silencio);
    },
    onTerminar: () => {
      limpiarCeldaActivaRitmo();
      limpiarActivaSecuencia();
    },
  });
  ritmoReproduciendo = false;
  el("btnRitmoEscuchar").disabled = false;
  el("btnRitmoDetener").disabled = true;
}

function inicializarRitmo() {
  el("ritmoNivel").addEventListener("input", () => {
    actualizarDescripcionNivelRitmo();
    nuevoRitmo();
    renderRuedaSvg();
  });
  el("ritmoCompases").addEventListener("change", nuevoRitmo);
  el("btnRitmoNuevo").addEventListener("click", nuevoRitmo);
  el("btnRitmoEscuchar").addEventListener("click", reproducirRitmoActual);
  el("btnRitmoDetener").addEventListener("click", detenerRitmoUI);

  actualizarDescripcionNivelRitmo();
  nuevoRitmo();
}

// -- Rueda de patrones -------------------------------------------------
// Complemento visual a la tira: en vez de una secuencia larga para leer,
// la rueda muestra de un vistazo los patrones de UN pulso disponibles a
// este nivel (mismo catálogo de figuras que NIVELES_RITMO, pero fijo y
// curado -- no tendría sentido generar "un pulso" al azar con las mismas
// probabilidades que una tira larga: casi siempre saldría una negra sola).
// Girar elige uno al azar, lo resalta con una bolita que viaja desde el
// centro, y lo aplaude por ti una vez -- pensado para practicar patrón por
// patrón en vez de leer una tira entera de corrido.
const CELDAS_RUEDA = [
  { id: "negra", nombreCorto: "Negra", nombre: "Negra (un solo golpe)", nivelMin: 1, unidades: [{ figura: "negra", silencio: false }] },
  { id: "silencio", nombreCorto: "Silencio", nombre: "Silencio de negra (no aplaudas)", nivelMin: 1, unidades: [{ figura: "negra", silencio: true }] },
  { id: "dos-corcheas", nombreCorto: "2 corcheas", nombre: "Dos corcheas", nivelMin: 3, unidades: [{ figura: "corchea", silencio: false }, { figura: "corchea", silencio: false }] },
  { id: "corchea-semi-semi", nombreCorto: "♪ + 2 semi", nombre: "Corchea + dos semicorcheas", nivelMin: 5, unidades: [{ figura: "corchea", silencio: false }, { figura: "semicorchea", silencio: false }, { figura: "semicorchea", silencio: false }] },
  { id: "semi-semi-corchea", nombreCorto: "2 semi + ♪", nombre: "Dos semicorcheas + corchea", nivelMin: 5, unidades: [{ figura: "semicorchea", silencio: false }, { figura: "semicorchea", silencio: false }, { figura: "corchea", silencio: false }] },
  { id: "cuatro-semi", nombreCorto: "4 semicorcheas", nombre: "Cuatro semicorcheas", nivelMin: 7, unidades: [{ figura: "semicorchea", silencio: false }, { figura: "semicorchea", silencio: false }, { figura: "semicorchea", silencio: false }, { figura: "semicorchea", silencio: false }] },
];

function celdasRuedaDesbloqueadas(nivel) {
  return CELDAS_RUEDA.filter((c) => c.nivelMin <= nivel);
}

const SVG_NS = "http://www.w3.org/2000/svg";
function crearElementoSvg(tag, attrs) {
  const elemento = document.createElementNS(SVG_NS, tag);
  for (const clave in attrs) elemento.setAttribute(clave, attrs[clave]);
  return elemento;
}

// El glifo Unicode de las figuras (𝅘𝅥𝅯 y compañía, y sus silencios 𝄻𝄼𝄽𝄾𝄿)
// depende de que el sistema tenga un font con ese rango Unicode -- sin eso
// salía deformado (Android), y en Noto Music cada glifo trae una posición
// vertical "de partitura" propia, así que varias figuras seguidas quedaban
// en zigzag y las notas y los silencios terminaban con tamaños distintos
// entre sí. Los 10 (nota + silencio × 5 figuras) se dibujan a mano, todos en
// el MISMO recuadro (mismo viewBox, misma cabeza/bloque base), así que
// cualquier combinación -- sola, en fila, nota junto a silencio -- sale
// exactamente al mismo tamaño, sin depender de ninguna fuente.
const ICONOS_FIGURA_VIEWBOX = "0 0 24 34";

// Las 5 notas comparten EXACTAMENTE la misma cabeza (mismo centro, mismo
// radio) -- solo cambia si está rellena o hueca, si tiene plica y cuántos
// corchetes.
const ICONOS_NOTA = {
  redonda: '<ellipse cx="8" cy="27" rx="6.2" ry="4.6" transform="rotate(-20 8 27)" fill="none" stroke="currentColor" stroke-width="2.1"/>',
  blanca:
    '<ellipse cx="8" cy="27" rx="6.2" ry="4.6" transform="rotate(-20 8 27)" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<rect x="12.6" y="5" width="2" height="21" fill="currentColor"/>',
  negra:
    '<ellipse cx="8" cy="27" rx="6.2" ry="4.6" transform="rotate(-20 8 27)" fill="currentColor"/>' +
    '<rect x="12.6" y="5" width="2" height="21" fill="currentColor"/>',
  corchea:
    '<ellipse cx="8" cy="27" rx="6.2" ry="4.6" transform="rotate(-20 8 27)" fill="currentColor"/>' +
    '<rect x="12.6" y="5" width="2" height="21" fill="currentColor"/>' +
    '<path d="M14.6,5 C20,7.5 20.5,13 16,16.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  semicorchea:
    '<ellipse cx="8" cy="27" rx="6.2" ry="4.6" transform="rotate(-20 8 27)" fill="currentColor"/>' +
    '<rect x="12.6" y="5" width="2" height="21" fill="currentColor"/>' +
    '<path d="M14.6,5 C20,7.5 20.5,13 16,16.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M14.6,10.5 C20,13 20.5,18.5 16,22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

// Los 5 silencios, en el mismo recuadro que las notas (0-24 de ancho, 0-34
// de alto) y con la misma "masa" de tinta aproximada, para que ningún
// silencio se vea más chico o más grande que una nota al lado.
const ICONOS_SILENCIO = {
  // Redonda: bloque colgando de una línea imaginaria justo debajo del centro.
  redonda: '<rect x="7" y="15" width="9" height="4.5" fill="currentColor"/>',
  // Blanca: mismo bloque, apoyado arriba de esa misma línea (en vez de colgar).
  blanca: '<rect x="7" y="14.5" width="9" height="4.5" fill="currentColor"/>',
  // Negra: garabato en zigzag, clásico de este silencio.
  negra: '<path d="M11,6 L16.5,13 L10.5,18 L16,23 Q10,26 10.5,30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  // Corchea: trazo diagonal + un gancho relleno (misma familia visual que el
  // corchete de la corchea/semicorchea, pero como un "moño" en vez de una curva).
  corchea:
    '<path d="M9,28 L17,7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="17.3" cy="10.5" rx="3.1" ry="2.5" transform="rotate(35 17.3 10.5)" fill="currentColor"/>',
  // Semicorchea: igual, con un segundo gancho más abajo.
  semicorchea:
    '<path d="M9,28 L18,6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="18.3" cy="9.5" rx="3" ry="2.4" transform="rotate(35 18.3 9.5)" fill="currentColor"/>' +
    '<ellipse cx="15" cy="16" rx="3" ry="2.4" transform="rotate(35 15 16)" fill="currentColor"/>',
};

/** Crea un <symbol> reutilizable (una sola vez) por cada figura y cada
 * silencio, dentro de un <svg><defs> oculto -- así cualquier
 * <use href="#figura-negra">/<use href="#figura-silencio-negra"> en
 * cualquier parte de la página (la tira, cualquiera de las dos ruedas)
 * dibuja exactamente el mismo ícono, sin duplicar el path a mano en cada
 * sitio. */
function asegurarSimbolosNota() {
  if (document.getElementById("defsIconosNota")) return;
  const svg = crearElementoSvg("svg", { id: "defsIconosNota", "aria-hidden": "true", style: "position:absolute;width:0;height:0;overflow:hidden" });
  const defs = crearElementoSvg("defs", {});
  Object.keys(ICONOS_NOTA).forEach((figuraId) => {
    const symbol = crearElementoSvg("symbol", { id: `figura-${figuraId}`, viewBox: ICONOS_FIGURA_VIEWBOX });
    symbol.innerHTML = ICONOS_NOTA[figuraId];
    defs.appendChild(symbol);
  });
  Object.keys(ICONOS_SILENCIO).forEach((figuraId) => {
    const symbol = crearElementoSvg("symbol", { id: `figura-silencio-${figuraId}`, viewBox: ICONOS_FIGURA_VIEWBOX });
    symbol.innerHTML = ICONOS_SILENCIO[figuraId];
    defs.appendChild(symbol);
  });
  svg.appendChild(defs);
  document.body.appendChild(svg);
}

/** Crea un <use> apuntando al ícono de esa figura (nota o, si silencio es
 * true, su silencio), ya posicionado en x/y con ancho/alto width/height
 * (coordenadas del <svg> contenedor). */
function crearUsoNota(figuraId, silencio, x, y, width, height, extraAttrs) {
  const uso = crearElementoSvg("use", Object.assign({ x, y, width, height }, extraAttrs || {}));
  uso.setAttribute("href", silencio ? `#figura-silencio-${figuraId}` : `#figura-${figuraId}`);
  return uso;
}

// Centro y radios iguales en las dos ruedas (antes cada <svg> tenía su
// propio viewBox descuadrado con este centro) -- y el hueco entre la punta
// del rayo y la etiqueta se agrandó a propósito: con notas todas del mismo
// tamaño real (ver ICONOS_FIGURA_VIEWBOX), una fila de 4 semicorcheas mide
// ~105 de ancho, y en un rayo en diagonal esa fila se acerca a la etiqueta
// de al lado mucho más de lo que parece a simple vista -- terminaban
// pisándose. 90 de hueco (100 a 190) deja sitio de sobra incluso para la
// fila más ancha en el ángulo más desfavorable.
const RUEDA_CENTRO = { x: 250, y: 250 };
const RUEDA_RADIO_HUB = 34;
const RUEDA_RADIO_SPOKE = 100;
const RUEDA_RADIO_LABEL = 190;

let ruedaCeldasActuales = [];
let ruedaPuntos = [];
let ruedaIndiceActivo = -1;
let ruedaGirando = false;

/** Dibuja una rueda (rayo + símbolo + etiqueta por celda, más el hub y la
 * bolita) dentro del <svg> indicado. Genérica a propósito: la usan tanto la
 * rueda de patrones (celdas curadas y fijas) como la rueda de la secuencia
 * (celdas derivadas de lo que salió en la tira) -- misma geometría, dos
 * fuentes de datos distintas. Devuelve los puntos de cada rayo (en
 * coordenadas del viewBox) para poder mover la bolita hacia ellos después. */
function construirRuedaEnSvg(idSvg, celdas) {
  const svg = el(idSvg);
  if (!svg) return [];
  svg.innerHTML = "";
  const puntos = [];
  const n = celdas.length;
  if (n === 0) return puntos;

  celdas.forEach((celda, i) => {
    const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const puntaX = RUEDA_CENTRO.x + RUEDA_RADIO_SPOKE * Math.cos(angulo);
    const puntaY = RUEDA_CENTRO.y + RUEDA_RADIO_SPOKE * Math.sin(angulo);
    const labelX = RUEDA_CENTRO.x + RUEDA_RADIO_LABEL * Math.cos(angulo);
    const labelY = RUEDA_CENTRO.y + RUEDA_RADIO_LABEL * Math.sin(angulo);
    puntos.push({ x: puntaX, y: puntaY });

    svg.appendChild(crearElementoSvg("line", {
      x1: RUEDA_CENTRO.x, y1: RUEDA_CENTRO.y, x2: puntaX, y2: puntaY,
      class: "rueda-rayo", "data-indice": i,
    }));

    // Una celda puede tener varias unidades (los patrones combinados de la
    // rueda de patrones: "2 corcheas", "4 semicorcheas"...) -- cada una se
    // coloca a mano, en fila, centrada en la punta del rayo, en vez de
    // depender de que la fuente alinee varios glifos seguidos. El tamaño del
    // ícono es SIEMPRE el mismo (34 de alto), esté solo o en fila -- lo que
    // cambia es el ancho de la fila entera, nunca el tamaño de cada ícono.
    const unidades = celda.unidades;
    const iconoAlto = 34;
    const iconoAncho = iconoAlto * (24 / 34);
    const espacio = 3;
    const anchoTotal = unidades.length * iconoAncho + (unidades.length - 1) * espacio;
    let x = puntaX - anchoTotal / 2;
    unidades.forEach((u) => {
      svg.appendChild(crearUsoNota(u.figura, u.silencio, x, puntaY - iconoAlto / 2, iconoAncho, iconoAlto, { class: "rueda-nota-uso", "data-indice": i }));
      x += iconoAncho + espacio;
    });

    const etiqueta = crearElementoSvg("text", {
      x: labelX, y: labelY, class: "rueda-etiqueta", "data-indice": i,
      "text-anchor": "middle", "dominant-baseline": "middle",
    });
    etiqueta.textContent = celda.nombreCorto;
    svg.appendChild(etiqueta);
  });

  svg.appendChild(crearElementoSvg("circle", {
    cx: RUEDA_CENTRO.x, cy: RUEDA_CENTRO.y, r: RUEDA_RADIO_HUB, class: "rueda-hub",
  }));
  svg.appendChild(crearUsoNota("negra", false, RUEDA_CENTRO.x - 9, RUEDA_CENTRO.y - 13, 18, 25.5, { class: "rueda-hub-uso" }));

  svg.appendChild(crearElementoSvg("circle", {
    cx: RUEDA_CENTRO.x, cy: RUEDA_CENTRO.y, r: 9, class: "rueda-bola", opacity: 0,
  }));

  return puntos;
}

function renderRuedaSvg() {
  if (!el("ruedaSvg")) return;
  if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
  const nivel = parseInt(el("ritmoNivel").value, 10) || 1;
  ruedaCeldasActuales = celdasRuedaDesbloqueadas(nivel);
  ruedaIndiceActivo = -1;
  ruedaGirando = false;
  ruedaPuntos = construirRuedaEnSvg("ruedaSvg", ruedaCeldasActuales);

  if (el("btnRuedaRepetir")) el("btnRuedaRepetir").disabled = true;
  if (el("ruedaEstado")) el("ruedaEstado").textContent = 'Dale a "Girar" para empezar.';
}

// -- Rueda sincronizada con la secuencia (tira larga) -------------------
// A diferencia de la rueda de patrones (celdas curadas, fijas), esta rueda
// muestra únicamente las figuras que de verdad salieron en la tira actual
// (sin repetir), y se resalta sola, en tiempo real, con cada nota que suena
// -- no es un juego aparte, es la MISMA secuencia vista de otra forma.
let secuenciaCeldas = [];
let secuenciaPuntos = [];

function idFiguraSilencio(figuraId, silencio) {
  return (silencio ? "silencio-" : "") + figuraId;
}

function nombreFiguraSilencio(figuraId, silencio) {
  const fig = figuraPorId(figuraId);
  return silencio ? `Silencio (${fig.nombre.toLowerCase()})` : fig.nombre;
}

function celdasUnicasDeUnidades(unidades) {
  const vistas = new Map();
  unidades.forEach((u) => {
    const id = idFiguraSilencio(u.figura, u.silencio);
    if (!vistas.has(id)) {
      const nombre = nombreFiguraSilencio(u.figura, u.silencio);
      vistas.set(id, { id, nombreCorto: nombre, nombre, unidades: [{ figura: u.figura, silencio: u.silencio }] });
    }
  });
  return [...vistas.values()];
}

function renderSecuenciaRueda() {
  if (!el("secuenciaRuedaSvg")) return;
  secuenciaCeldas = celdasUnicasDeUnidades(ritmoUnidades);
  secuenciaPuntos = construirRuedaEnSvg("secuenciaRuedaSvg", secuenciaCeldas);
}

function marcarActivaSecuencia(figuraId, silencio) {
  const svg = el("secuenciaRuedaSvg");
  if (!svg) return;
  svg.querySelectorAll(".activa").forEach((nodo) => nodo.classList.remove("activa"));
  const indice = secuenciaCeldas.findIndex((c) => c.id === idFiguraSilencio(figuraId, silencio));
  if (indice < 0) return;
  svg.querySelectorAll(`[data-indice="${indice}"]`).forEach((nodo) => nodo.classList.add("activa"));
  const bola = svg.querySelector(".rueda-bola");
  const punto = secuenciaPuntos[indice];
  if (bola && punto) {
    bola.setAttribute("opacity", "1");
    bola.setAttribute("cx", String(punto.x));
    bola.setAttribute("cy", String(punto.y));
  }
}

function limpiarActivaSecuencia() {
  const svg = el("secuenciaRuedaSvg");
  if (!svg) return;
  svg.querySelectorAll(".activa").forEach((nodo) => nodo.classList.remove("activa"));
  const bola = svg.querySelector(".rueda-bola");
  if (bola) bola.setAttribute("opacity", "0");
}

function easeOutCubicRueda(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animarBolaRuedaHacia(idSvg, destino, duracionMs) {
  return new Promise((resolve) => {
    const bola = el(idSvg).querySelector(".rueda-bola");
    const origenX = RUEDA_CENTRO.x;
    const origenY = RUEDA_CENTRO.y;
    bola.setAttribute("opacity", "1");
    const inicio = performance.now();
    function paso(ahora) {
      const t = Math.min(1, (ahora - inicio) / duracionMs);
      const p = easeOutCubicRueda(t);
      bola.setAttribute("cx", String(origenX + (destino.x - origenX) * p));
      bola.setAttribute("cy", String(origenY + (destino.y - origenY) * p));
      if (t < 1) requestAnimationFrame(paso);
      else resolve();
    }
    requestAnimationFrame(paso);
  });
}

function limpiarActivaRueda() {
  el("ruedaSvg").querySelectorAll(".activa").forEach((nodo) => nodo.classList.remove("activa"));
}

function marcarActivaRueda(indice) {
  el("ruedaSvg").querySelectorAll(`[data-indice="${indice}"]`).forEach((nodo) => nodo.classList.add("activa"));
}

async function reproducirCeldaRueda(celda) {
  if (!window.PianoEngine) return;
  const bpm = parseInt(el("metroFlotBpm").value, 10) || 100;
  const eventos = unidadesRitmoAEventos(celda.unidades, bpm);
  el("ruedaEstado").textContent = `Patrón: ${celda.nombre} — aplaude tú también.`;
  await window.PianoEngine.reproducirRitmo(eventos, 0.75, {});
}

async function girarRueda() {
  if (ruedaGirando || ruedaCeldasActuales.length === 0) return;
  ruedaGirando = true;
  el("btnRuedaGirar").disabled = true;
  el("btnRuedaRepetir").disabled = true;
  limpiarActivaRueda();
  el("ruedaEstado").textContent = "Girando…";
  const indice = Math.floor(Math.random() * ruedaCeldasActuales.length);
  await animarBolaRuedaHacia("ruedaSvg", ruedaPuntos[indice], 550);
  ruedaIndiceActivo = indice;
  marcarActivaRueda(indice);
  await reproducirCeldaRueda(ruedaCeldasActuales[indice]);
  ruedaGirando = false;
  el("btnRuedaGirar").disabled = false;
  el("btnRuedaRepetir").disabled = false;
}

function repetirCeldaRueda() {
  if (ruedaGirando || ruedaIndiceActivo < 0) return;
  reproducirCeldaRueda(ruedaCeldasActuales[ruedaIndiceActivo]);
}

function cambiarVistaRitmo(vista) {
  const esRueda = vista === "rueda";
  el("panelRitmoTira").hidden = esRueda;
  el("panelRitmoRueda").hidden = !esRueda;
  el("btnRitmoVistaTira").classList.toggle("activo", !esRueda);
  el("btnRitmoVistaTira").setAttribute("aria-selected", String(!esRueda));
  el("btnRitmoVistaRueda").classList.toggle("activo", esRueda);
  el("btnRitmoVistaRueda").setAttribute("aria-selected", String(esRueda));
  if (ritmoReproduciendo) detenerRitmoUI();
  if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
}

function inicializarRuedaRitmo() {
  el("btnRitmoVistaTira").addEventListener("click", () => cambiarVistaRitmo("tira"));
  el("btnRitmoVistaRueda").addEventListener("click", () => cambiarVistaRitmo("rueda"));
  el("btnRuedaGirar").addEventListener("click", girarRueda);
  el("btnRuedaRepetir").addEventListener("click", repetirCeldaRueda);
  renderRuedaSvg();
}

/** Ritmo ya no vive dentro de Piano -- tiene su propia página con su propia
 * barra de metrónomo compacta (mismo HTML que Piano/Rutina), así que
 * necesita su propio cableado en vez de compartir el de piano.js. */
function inicializarMetronomoFlotanteRitmo() {
  const toggle = el("metroFlotToggle");
  const bpm = el("metroFlotBpm");
  const bpmNumero = el("metroFlotBpmNumero");
  const acento = el("metroFlotAcento");
  const volumen = el("metroFlotVolumen");
  const punto = el("metronomoPuntoMini");
  let enMarcha = false;

  function aplicarBpm(valor) {
    valor = Math.max(50, Math.min(350, parseInt(valor, 10) || 100));
    bpm.value = valor;
    bpmNumero.value = valor;
    if (enMarcha && window.MetronomoEngine) window.MetronomoEngine.ajustarBpm(valor);
    actualizarInfoMetronomoRitmo();
    if (ritmoReproduciendo) detenerRitmoUI();
  }
  bpm.addEventListener("input", () => aplicarBpm(bpm.value));
  // "change" (al salir del campo o Enter), no "input" (cada tecleo) -- si no,
  // escribir "100" pasa primero por "1" y aplicarBpm() lo recorta a 50 (el
  // mínimo) a mitad de tecleo, peleando contra lo que la persona está escribiendo.
  bpmNumero.addEventListener("change", () => aplicarBpm(bpmNumero.value));

  acento.addEventListener("change", () => {
    if (enMarcha && window.MetronomoEngine) window.MetronomoEngine.ajustarAcento(parseInt(acento.value, 10));
    actualizarInfoMetronomoRitmo();
    // Ahora que cada figura queda DENTRO de su compás (nunca lo cruza), el
    // número de pulsos por compás es parte real de cómo se generó la
    // secuencia -- cambiar la métrica sin regenerar dejaría las rayas de
    // compás mostrando límites que ya no corresponden a las figuras.
    nuevoRitmo();
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
    window.MetronomoEngine.iniciar(parseInt(bpm.value, 10), parseInt(acento.value, 10), (acento2) => {
      punto.classList.remove("pulso", "acento");
      void punto.offsetWidth; // fuerza reflow para reiniciar la animación en cada pulso
      punto.classList.add("pulso");
      if (acento2) punto.classList.add("acento");
    });
  });
}

function inicializarPaginaRitmo() {
  asegurarSimbolosNota();
  if (window.Progreso) Progreso.marcarHerramientaUsada("ritmo");
  inicializarMetronomoFlotanteRitmo();
  inicializarRitmo();
  inicializarRuedaRitmo();
}

document.addEventListener("DOMContentLoaded", inicializarPaginaRitmo);
