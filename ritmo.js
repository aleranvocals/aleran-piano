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

// unidades: [{ figura: idDeFigura, silencio: bool }]. No fuerza alineación
// estricta a compás -- aquí basta con sentir el pulso y la subdivisión.
function generarRitmoNivel(nivel, compases, pulsosPorCompas) {
  const cfg = configNivelRitmo(nivel);
  const totalPulsos = Math.max(1, compases) * pulsosPorCompas;
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
  ritmoUnidades = generarRitmoNivel(nivel, compases, pulsosPorCompasMetronomo());
  renderRitmoTira();
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

function simboloCelda(celda) {
  return celda.unidades.map((u) => (u.silencio ? figuraPorId(u.figura).simboloSilencio : figuraPorId(u.figura).simbolo)).join(" ");
}

const SVG_NS = "http://www.w3.org/2000/svg";
function crearElementoSvg(tag, attrs) {
  const elemento = document.createElementNS(SVG_NS, tag);
  for (const clave in attrs) elemento.setAttribute(clave, attrs[clave]);
  return elemento;
}

const RUEDA_CENTRO = { x: 220, y: 220 };
const RUEDA_RADIO_HUB = 34;
const RUEDA_RADIO_SPOKE = 108;
const RUEDA_RADIO_LABEL = 150;

let ruedaCeldasActuales = [];
let ruedaPuntos = [];
let ruedaIndiceActivo = -1;
let ruedaGirando = false;

function renderRuedaSvg() {
  const svg = el("ruedaSvg");
  if (!svg) return;
  if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
  svg.innerHTML = "";
  const nivel = parseInt(el("ritmoNivel").value, 10) || 1;
  ruedaCeldasActuales = celdasRuedaDesbloqueadas(nivel);
  ruedaPuntos = [];
  ruedaIndiceActivo = -1;
  ruedaGirando = false;
  const n = ruedaCeldasActuales.length;

  ruedaCeldasActuales.forEach((celda, i) => {
    const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const puntaX = RUEDA_CENTRO.x + RUEDA_RADIO_SPOKE * Math.cos(angulo);
    const puntaY = RUEDA_CENTRO.y + RUEDA_RADIO_SPOKE * Math.sin(angulo);
    const labelX = RUEDA_CENTRO.x + RUEDA_RADIO_LABEL * Math.cos(angulo);
    const labelY = RUEDA_CENTRO.y + RUEDA_RADIO_LABEL * Math.sin(angulo);
    ruedaPuntos.push({ x: puntaX, y: puntaY });

    svg.appendChild(crearElementoSvg("line", {
      x1: RUEDA_CENTRO.x, y1: RUEDA_CENTRO.y, x2: puntaX, y2: puntaY,
      class: "rueda-rayo", "data-indice": i,
    }));

    const simbolo = crearElementoSvg("text", {
      x: puntaX, y: puntaY, class: "rueda-simbolo", "data-indice": i,
      "text-anchor": "middle", "dominant-baseline": "middle",
    });
    simbolo.textContent = simboloCelda(celda);
    svg.appendChild(simbolo);

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
  const hubTexto = crearElementoSvg("text", {
    x: RUEDA_CENTRO.x, y: RUEDA_CENTRO.y, class: "rueda-hub-texto",
    "text-anchor": "middle", "dominant-baseline": "middle",
  });
  hubTexto.textContent = "♩";
  svg.appendChild(hubTexto);

  svg.appendChild(crearElementoSvg("circle", {
    cx: RUEDA_CENTRO.x, cy: RUEDA_CENTRO.y, r: 9, class: "rueda-bola", id: "ruedaBola", opacity: 0,
  }));

  if (el("btnRuedaRepetir")) el("btnRuedaRepetir").disabled = true;
  if (el("ruedaEstado")) el("ruedaEstado").textContent = 'Dale a "Girar" para empezar.';
}

function easeOutCubicRueda(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animarBolaRuedaHacia(destino, duracionMs) {
  return new Promise((resolve) => {
    const bola = el("ruedaBola");
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
  await window.PianoEngine.reproducirRitmo(eventos, 0.9, {});
}

async function girarRueda() {
  if (ruedaGirando || ruedaCeldasActuales.length === 0) return;
  ruedaGirando = true;
  el("btnRuedaGirar").disabled = true;
  el("btnRuedaRepetir").disabled = true;
  limpiarActivaRueda();
  el("ruedaEstado").textContent = "Girando…";
  const indice = Math.floor(Math.random() * ruedaCeldasActuales.length);
  await animarBolaRuedaHacia(ruedaPuntos[indice], 550);
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
    if (ritmoReproduciendo) detenerRitmoUI();
    renderRitmoTira(); // las rayas de compás dependen del acento -- se recalculan sin tocar el contenido ya generado
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
  if (window.Progreso) Progreso.marcarHerramientaUsada("ritmo");
  inicializarMetronomoFlotanteRitmo();
  inicializarRitmo();
  inicializarRuedaRitmo();
}

document.addEventListener("DOMContentLoaded", inicializarPaginaRitmo);
