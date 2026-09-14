/*
 * mapa-vocal.js — genera un diagrama de registros vocales (voz de pecho,
 * voz de cabeza, passaggio, zona de paso, voz de silbido, emulación de
 * canto mongol, belting) como SVG a partir de las notas que escriba el
 * profesor, y lo deja descargar como PNG. No usa el motor de audio ni el
 * micrófono: es un generador de imágenes, nada más.
 *
 * El diseño sigue el mapa vocal de referencia del profesor: los colores de
 * cada registro se pintan DIRECTAMENTE SOBRE el teclado (transparencias
 * recortadas con la forma real de cada tecla, no una franja rectangular
 * pareja), la voz de pecho nunca toca el passaggio (esa tecla se resalta en
 * rojo sólido aparte) y la zona de paso justo antes del passaggio se pinta
 * con un corte diagonal limpio (pecho abajo-izquierda, cabeza arriba-derecha,
 * sin línea divisoria ni mezcla de colores). Debajo del teclado va una
 * "línea de cota" (bracket) con el nombre de cada registro para poder
 * leerlos aunque los colores se superpongan encima de las teclas.
 *
 * El SVG siempre se dibuja con colores fijos (fondo blanco, texto oscuro)
 * en vez de los tokens de tema del sitio: es un documento pensado para
 * descargarse e imprimirse, así que debe verse igual sin importar el modo
 * claro/oscuro de quien lo genera.
 */

const MAPA_ES_NEGRA = new Set([1, 3, 6, 8, 10]);

const MAPA_COLORES = {
  pecho: "#3f9b52",
  cabeza: "#e08a2e",
  mongol: "#8a63b8",
  silbido: "#c7ae1f",
  mixPecho: { relleno: "#8a68b0", borde: "#5f4283" },
  mixCabeza: { relleno: "#d94f95", borde: "#a12f77" },
  passaggio: "#c0392b",
  central: "#3a8fc7",
  belting: "#2f7a4d",
  solapamiento: "#3a2e22",
};

function mapaLeerNota(idCampo, etiqueta, opcional) {
  const valor = el(idCampo).value.trim();
  if (!valor) {
    if (opcional) return null;
    throw new Error(`Falta "${etiqueta}".`);
  }
  let midi;
  try {
    midi = nombreAMidi(valor);
  } catch {
    throw new Error(`No entiendo la nota "${valor}" en "${etiqueta}" (ejemplos válidos: Do3, Fa#4, Sib2).`);
  }
  // nombreAMidi() no valida el rango por sí sola -- acepta "Do0" o "Sol99"
  // igual de bien que "Do3". Este mapa NO está atado al piano interactivo
  // (Do1-Do6, limitado a las muestras cargadas): aquí el registro de silbido
  // legítimamente sube más arriba (el propio valor de ejemplo es Sol6). El
  // límite de abajo es solo para pillar errores de verdad (typos, un cero de
  // más), no para recortar el rango vocal real.
  if (midi < nombreAMidi("Do0") || midi > nombreAMidi("Do9")) {
    throw new Error(`"${valor}" en "${etiqueta}" es una nota fuera de cualquier rango vocal real -- revisa si es un error de escritura.`);
  }
  return midi;
}

/** Redondea el rango al Do de abajo y al Do de arriba: el teclado siempre
 * empieza y termina en un "Do" completo (un Re2 suelto hace que arranque en
 * Do2; un Sol6 suelto hace que llegue hasta Do7), nunca a mitad de octava
 * ni justo en el límite de un registro. */
function mapaRedondearRango(midiMin, midiMax) {
  const inicio = midiMin - (((midiMin % 12) + 12) % 12);
  const restoMax = ((midiMax % 12) + 12) % 12;
  const fin = restoMax === 0 ? midiMax : midiMax - restoMax + 12;
  return [inicio, fin];
}

function mapaConstruirPosiciones(midiMin, midiMax, anchoBlanca) {
  const blancas = [];
  for (let midi = midiMin; midi <= midiMax; midi++) {
    if (!MAPA_ES_NEGRA.has(((midi % 12) + 12) % 12)) blancas.push(midi);
  }
  const anchoNegra = anchoBlanca * 0.58;
  const posiciones = {};
  blancas.forEach((midi, i) => {
    posiciones[midi] = { x: i * anchoBlanca, ancho: anchoBlanca, negra: false };
  });
  for (let midi = midiMin; midi <= midiMax; midi++) {
    const semitono = ((midi % 12) + 12) % 12;
    if (!MAPA_ES_NEGRA.has(semitono)) continue;
    const indiceBlancaAnterior = blancas.filter((m) => m < midi).length - 1;
    posiciones[midi] = { x: (indiceBlancaAnterior + 1) * anchoBlanca - anchoNegra / 2, ancho: anchoNegra, negra: true };
  }
  return { posiciones, anchoTotal: blancas.length * anchoBlanca, blancas };
}

function escaparXml(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mapaBordes(pos, desdeMidi, hastaMidi) {
  const x1 = pos.posiciones[desdeMidi].x;
  const p2 = pos.posiciones[hastaMidi];
  return [x1, p2.x + p2.ancho];
}

/** El borde x que separan dos notas VECINAS (midiAntes y midiAntes+1), para
 * usar como frontera compartida entre dos franjas de color contiguas. Una
 * tecla negra está centrada sobre el límite entre dos blancas, así que su
 * propio rectángulo se mete un poco en la tecla de cada lado — si dos
 * franjas usaran cada una el borde de "su" nota tal cual, se pisarían un
 * poco ahí y esa doble transparencia se ve más oscura. Promediando los dos
 * bordes se obtiene un único límite sin hueco y sin solape. */
function mapaLimite(pos, midiAntes, midiDespues) {
  const antes = pos.posiciones[midiAntes];
  const despues = pos.posiciones[midiDespues];
  return ((antes.x + antes.ancho) + despues.x) / 2;
}

/** Puntos de un polígono con la forma REAL de una tecla — para resaltar
 * (passaggio, nota central) UNA tecla concreta sin que el resalte quede
 * como un rectángulo parejo tapando la tecla negra vecina. Una blanca es
 * angosta arriba (donde una negra vecina se le monta encima) y ancha del
 * todo abajo; una negra es, simplemente, su propio rectángulo más corto.
 * Todos los Do, por ejemplo, tienen la misma forma (angosto solo a la
 * derecha, porque Si-Do no tiene negra en medio) — esta función lo calcula
 * para cualquier nota, no hace falta un caso especial por nota. */
function mapaFormaTecla(pos, midi, yTope, altoNegra, altoBlanca) {
  const p = pos.posiciones[midi];
  if (p.negra) {
    return `${p.x},${yTope} ${p.x + p.ancho},${yTope} ${p.x + p.ancho},${yTope + altoNegra} ${p.x},${yTope + altoNegra}`;
  }
  const x1 = p.x;
  const x2 = p.x + p.ancho;
  const negraIzq = pos.posiciones[midi - 1] && pos.posiciones[midi - 1].negra;
  const negraDer = pos.posiciones[midi + 1] && pos.posiciones[midi + 1].negra;
  const xArribaIzq = negraIzq ? pos.posiciones[midi - 1].x + pos.posiciones[midi - 1].ancho : x1;
  const xArribaDer = negraDer ? pos.posiciones[midi + 1].x : x2;
  const yNegra = yTope + altoNegra;
  const yBlanca = yTope + altoBlanca;
  return `${xArribaIzq},${yTope} ${xArribaDer},${yTope} ${xArribaDer},${yNegra} ${x2},${yNegra} ${x2},${yBlanca} ${x1},${yBlanca} ${x1},${yNegra} ${xArribaIzq},${yNegra}`;
}

/** Pinta un registro TECLA POR TECLA con la forma real de cada una
 * (`mapaFormaTecla`) en vez de un único rectángulo de borde a borde. Dos
 * teclas vecinas encajan exactas (comparten el mismo filo, sin hueco ni
 * solape), así que varias teclas seguidas del mismo color se siguen viendo
 * como una sola franja continua — pero si la frontera con el registro
 * vecino cae justo en una tecla negra, esa tecla queda COMPLETA de un solo
 * color en vez de partida a la mitad entre dos colores distintos (que es lo
 * que pasaba antes al usar una única línea vertical promediada ahí). */
function mapaZonaPorTeclas(pos, desdeMidi, hastaMidi, yTope, altoNegra, altoBlanca, color, opacidad) {
  let partes = "";
  for (let midi = desdeMidi; midi <= hastaMidi; midi++) {
    if (!pos.posiciones[midi]) continue;
    partes += `<polygon points="${mapaFormaTecla(pos, midi, yTope, altoNegra, altoBlanca)}" fill="${color}" fill-opacity="${opacidad}" />`;
  }
  return partes;
}

/** Una franja de color translúcida SOBRE el teclado — varias de estas se
 * superponen en la misma columna cuando los registros se pisan
 * (pecho/cabeza), como acetatos de color puestos encima de las teclas. */
function mapaBandaSvg(pos, desdeMidi, hastaMidi, y, alto, color, opacidad) {
  const [x1, x2] = mapaBordes(pos, desdeMidi, hastaMidi);
  return `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${alto}" fill="${color}" fill-opacity="${opacidad}" />`;
}

/** Una "línea de cota" (bracket): línea horizontal con topes en los
 * extremos y el nombre de la zona centrado debajo — así se identifica cada
 * franja de color sin escribir texto encima de colores que se superponen. */
let mapaCtxMedida = null;
/** Ancho real (en px) de un texto con la fuente del diagrama — para poder
 * decidir si centrarlo cabe, o si hay que pegarlo a un borde en vez de
 * dejar que se salga del SVG (como le pasaba a "Emulación canto mongol"
 * cuando su franja de color es más angosta que su propio nombre). */
function mapaAnchoTexto(texto, tamanoFuente) {
  if (!mapaCtxMedida) mapaCtxMedida = document.createElement("canvas").getContext("2d");
  mapaCtxMedida.font = `700 ${tamanoFuente}px 'Work Sans', sans-serif`;
  return mapaCtxMedida.measureText(texto).width;
}

/** Una "línea de cota" (bracket): línea horizontal con topes en los
 * extremos y el nombre de la zona centrado debajo — así se identifica cada
 * franja de color sin escribir texto encima de colores que se superponen.
 * Si la franja es más angosta que su propio nombre, el texto se pega al
 * borde del SVG en vez de centrarse y salirse del dibujo. */
function mapaBracketSvg(pos, desdeMidi, hastaMidi, yLinea, color, etiqueta, tamanoFuente, anchoSvg, evitarXs, anclarAlCentroDeTecla) {
  // Por defecto la cota va de borde a borde (todo el ancho de la primera y
  // la última tecla, igual que la franja de color de arriba). Pero para las
  // zonas con guía arriba (Voz de pecho/cabeza, canto mongol, silbido) el
  // profesor pidió que la cota empiece/termine justo en el CENTRO de esas
  // teclas, para coincidir con la línea punteada que ya marca esa nota en el
  // centro -- no se toca la guía de arriba, se ajusta la cota de abajo.
  const [x1, x2] = anclarAlCentroDeTecla
    ? [pos.posiciones[desdeMidi].x + pos.posiciones[desdeMidi].ancho / 2, pos.posiciones[hastaMidi].x + pos.posiciones[hastaMidi].ancho / 2]
    : mapaBordes(pos, desdeMidi, hastaMidi);
  const centro = (x1 + x2) / 2;
  const fuente = tamanoFuente || 11;
  const margen = 2;
  const anchoTexto = mapaAnchoTexto(etiqueta, fuente);

  // Tres posiciones candidatas para el texto: centrada (la de siempre), y
  // pegada a cada extremo de ESTA MISMA cota -- nunca fuera de x1/x2, para
  // no invadir la cota vecina. Se elige la primera que no quede tachada por
  // ninguna de las líneas verticales de "zona de paso" que le pasen cerca
  // (si las hay) y que además quepa dentro del SVG.
  const candidatos = [
    { anclaX: centro, anclaTipo: "middle" },
    { anclaX: x1 + margen, anclaTipo: "start" },
    { anclaX: x2 - margen, anclaTipo: "end" },
  ];
  const rangoDe = ({ anclaX, anclaTipo }) => {
    if (anclaTipo === "start") return [anclaX, anclaX + anchoTexto];
    if (anclaTipo === "end") return [anclaX - anchoTexto, anclaX];
    return [anclaX - anchoTexto / 2, anclaX + anchoTexto / 2];
  };
  const holguraColision = 4;
  const chocaConLinea = (c) => {
    if (!evitarXs) return false;
    const [izq, der] = rangoDe(c);
    return evitarXs.some((ex) => ex !== undefined && ex > izq - holguraColision && ex < der + holguraColision);
  };
  const seSaleDelSvg = (c) => {
    const [izq, der] = rangoDe(c);
    return izq < margen || (anchoSvg !== undefined && der > anchoSvg - margen);
  };

  const elegido =
    candidatos.find((c) => !chocaConLinea(c) && !seSaleDelSvg(c)) ||
    candidatos.find((c) => !seSaleDelSvg(c)) ||
    candidatos[0];
  const { anclaX, anclaTipo } = elegido;
  return `
    <line x1="${x1}" y1="${yLinea}" x2="${x2}" y2="${yLinea}" stroke="${color}" stroke-width="2" />
    <line x1="${x1}" y1="${yLinea - 5}" x2="${x1}" y2="${yLinea + 5}" stroke="${color}" stroke-width="2" />
    <line x1="${x2}" y1="${yLinea - 5}" x2="${x2}" y2="${yLinea + 5}" stroke="${color}" stroke-width="2" />
    <text x="${anclaX}" y="${yLinea + 15}" text-anchor="${anclaTipo}" font-size="${fuente}" font-weight="700" fill="${color}" font-family="'Work Sans', sans-serif">${escaparXml(etiqueta)}</text>
  `;
}

/** Divide una etiqueta tipo "Passaggio (La4)" en ["Passaggio", "(La4)"] para
 * dibujarla en dos líneas más angostas; un nombre de nota suelto como
 * "Sol#4" no tiene paréntesis y se queda en una sola línea. */
function mapaLineasEtiqueta(etiqueta) {
  const m = etiqueta.match(/^(.*?)\s*(\(.*\))$/);
  return m ? [m[1], m[2]] : [etiqueta];
}

/** Línea guía vertical con el nombre de la nota EN HORIZONTAL sobre la franja
 * oscura de encima del teclado (nunca inclinado) — para marcar una nota
 * concreta (passaggio, nota central, o el inicio/final de un registro)
 * atravesando el teclado. La línea siempre sale de la nota real (`xLinea`);
 * el texto puede estar centrado ahí mismo o desplazado (`anclaX`/`anclaTipo`)
 * si `mapaAcomodarFila` decidió correrlo para no chocar con el de al lado. */
function mapaGuiaSvg(xLinea, anclaX, anclaTipo, yBase, yLineaHasta, color, etiqueta, fuente) {
  const lineas = mapaLineasEtiqueta(etiqueta);
  const interlineado = fuente + 2;
  let textos = "";
  lineas.forEach((linea, i) => {
    const y = yBase - (lineas.length - 1 - i) * interlineado;
    textos += `<text x="${anclaX}" y="${y}" text-anchor="${anclaTipo}" font-size="${fuente}" font-weight="700" fill="${color}" font-family="'Work Sans', sans-serif">${escaparXml(linea)}</text>`;
  });
  return `
    ${textos}
    <line x1="${xLinea}" y1="${yBase + 3}" x2="${xLinea}" y2="${yLineaHasta}" stroke="${color}" stroke-width="1.5" stroke-dasharray="3,2" />
  `;
}

/** Acomoda una lista de guías (ya ordenadas por `x`) en UNA SOLA fila: si
 * dos chocarían centradas en su propia nota, primero se reduce el tamaño de
 * letra de la que choca (hasta `fuenteMinima`) y, si ni así cabe, se pega
 * justo después de la anterior en vez de mandarla a una fila nueva — así
 * dos notas juntas nunca generan una fila extra y el espacio vertical de
 * sobra que eso deja. La línea guía de cada una sigue saliendo de su nota
 * real; solo el TEXTO se achica o se corre. */
function mapaAcomodarFila(items, medirAncho, fuenteBase, fuenteMinima, margen, anchoSvg) {
  let borde = margen;
  items.forEach((item) => {
    let fuente = fuenteBase;
    let ancho = medirAncho(item, fuente);
    while (fuente > fuenteMinima && item.x - ancho / 2 < borde) {
      fuente -= 1;
      ancho = medirAncho(item, fuente);
    }
    let anclaX = item.x;
    let anclaTipo = "middle";
    if (item.x - ancho / 2 < borde) {
      anclaX = borde;
      anclaTipo = "start";
    }
    item.fuente = fuente;
    item.anclaX = anclaX;
    item.anclaTipo = anclaTipo;
    item.anchoTexto = ancho;
    borde = (anclaTipo === "start" ? anclaX + ancho : item.x + ancho / 2) + margen;
  });
  if (items.length && anchoSvg !== undefined) {
    const ultimo = items[items.length - 1];
    const derecha = ultimo.anclaTipo === "start" ? ultimo.anclaX + ultimo.anchoTexto : ultimo.x + ultimo.anchoTexto / 2;
    if (derecha > anchoSvg - margen) {
      ultimo.anclaX = anchoSvg - margen;
      ultimo.anclaTipo = "end";
    }
  }
}

function mapaTeclasSvg(pos, midiMin, midiMax, y, altoBlanca, altoNegra) {
  let partes = "";
  pos.blancas.forEach((midi) => {
    const p = pos.posiciones[midi];
    partes += `<rect x="${p.x}" y="${y}" width="${p.ancho}" height="${altoBlanca}" fill="#faf7f2" stroke="#c9beb2" stroke-width="1" />`;
  });
  for (let midi = midiMin; midi <= midiMax; midi++) {
    const semitono = ((midi % 12) + 12) % 12;
    if (!MAPA_ES_NEGRA.has(semitono)) continue;
    const p = pos.posiciones[midi];
    partes += `<rect x="${p.x}" y="${y}" width="${p.ancho}" height="${altoNegra}" fill="#241f1c" stroke="#000" stroke-width="1" />`;
  }
  return partes;
}

/** Los mismos rectángulos que `mapaTeclasSvg`, pero sin relleno ni trazo —
 * solo geometría, para usarlos dentro de un <clipPath>. Recorta los colores
 * de encima con la forma REAL de cada tecla (una blanca hasta su base, una
 * negra solo hasta su propia altura, más corta), así un sostenido nunca
 * queda "a medio cubrir" por una franja rectangular más alta que él. */
function mapaTeclasRecorteSvg(pos, midiMin, midiMax, y, altoBlanca, altoNegra) {
  let partes = "";
  pos.blancas.forEach((midi) => {
    const p = pos.posiciones[midi];
    partes += `<rect x="${p.x}" y="${y}" width="${p.ancho}" height="${altoBlanca}" />`;
  });
  for (let midi = midiMin; midi <= midiMax; midi++) {
    const semitono = ((midi % 12) + 12) % 12;
    if (!MAPA_ES_NEGRA.has(semitono)) continue;
    const p = pos.posiciones[midi];
    partes += `<rect x="${p.x}" y="${y}" width="${p.ancho}" height="${altoNegra}" />`;
  }
  return partes;
}

/** `silencioso`: true cuando se llama automáticamente mientras el profesor
 * todavía está escribiendo (edición en vivo) — en ese caso no se muestra
 * ningún error de campo vacío o nota a medio escribir (ej. "Sol" antes de
 * llegar a "Sol4"), simplemente no hay mapa todavía. Los errores de orden
 * ilógico (inicio más agudo que el final...) sí se muestran igual, porque
 * solo aparecen cuando ambas notas ya están completas y bien escritas. */
function generarMapaVocal(silencioso) {
  const estado = el("estadoMapa");
  estado.textContent = "";

  const tieneMongol = el("mapaTieneMongol").checked;
  const tieneSilbido = el("mapaTieneSilbido").checked;

  let datos;
  try {
    datos = {
      pechoInicio: mapaLeerNota("mapaPechoInicio", "Inicio voz de pecho", false),
      passaggio: mapaLeerNota("mapaPassaggio", "Passaggio", false),
      cabezaInicio: mapaLeerNota("mapaCabezaInicio", "Inicio voz de cabeza", false),
      cabezaFinal: mapaLeerNota("mapaCabezaFinal", "Final voz de cabeza", false),
      silbidoFinal: tieneSilbido ? mapaLeerNota("mapaSilbidoFinal", "Hasta dónde sube el silbido", false) : null,
      mongolInicio: tieneMongol ? mapaLeerNota("mapaMongolInicio", "Hasta dónde baja el canto mongol", false) : null,
      belting: mapaLeerNota("mapaBeltingNota", "Nota de belting", true),
    };
  } catch (err) {
    el("btnMapaDescargar").hidden = true;
    if (silencioso) return; // todavía escribiendo (campo vacío o nota a medias): sin aviso
    estado.textContent = err.message;
    return;
  }

  // La voz de pecho nunca toca el passaggio: siempre termina un semitono
  // antes — eso no se pregunta. El inicio de la voz de cabeza SÍ es un dato
  // real e independiente: de él depende dónde y cuánto se solapa con el
  // pecho (la zona de paso, en cambio, es un cálculo aparte, siempre ±3
  // tonos del passaggio, sin relación con este valor).
  datos.pechoFinal = datos.passaggio - 1;

  if (datos.pechoInicio >= datos.passaggio) {
    el("btnMapaDescargar").hidden = true;
    estado.textContent = "La voz de pecho debe empezar antes del passaggio.";
    return;
  }
  if (datos.cabezaInicio >= datos.cabezaFinal) {
    el("btnMapaDescargar").hidden = true;
    estado.textContent = 'El "inicio" de la voz de cabeza debe ser más grave que el "final".';
    return;
  }
  if (datos.cabezaFinal <= datos.passaggio) {
    el("btnMapaDescargar").hidden = true;
    estado.textContent = "La voz de cabeza debe terminar después del passaggio.";
    return;
  }

  // El silbido y el canto mongol nunca se solapan con cabeza/pecho: siempre
  // empiezan justo en el semitono siguiente/anterior — no se preguntan, se
  // calculan solos.
  datos.silbidoInicio = tieneSilbido ? datos.cabezaFinal + 1 : null;
  datos.mongolFinal = tieneMongol ? datos.pechoInicio - 1 : null;

  if (tieneSilbido && datos.silbidoFinal <= datos.cabezaFinal) {
    el("btnMapaDescargar").hidden = true;
    estado.textContent = "El silbido debe llegar más agudo que el final de la voz de cabeza.";
    return;
  }
  if (tieneMongol && datos.mongolInicio >= datos.pechoInicio) {
    el("btnMapaDescargar").hidden = true;
    estado.textContent = "El canto mongol debe llegar más grave que el inicio de la voz de pecho.";
    return;
  }

  try {
    const svg = mapaConstruirSvg(datos);
    el("mapaContenedor").innerHTML = svg;
    el("btnMapaDescargar").hidden = false;
  } catch (err) {
    el("btnMapaDescargar").hidden = true;
    estado.textContent = `No se pudo generar el mapa: ${err.message}`;
  }
}

let mapaRegenerarTimeoutId = null;

/** Programa una regeneración silenciosa un momento después de que el
 * profesor deje de teclear, para que el mapa se sienta "en vivo" sin
 * regenerar (ni lanzar errores) en cada pulsación. */
function mapaProgramarRegeneracionEnVivo() {
  clearTimeout(mapaRegenerarTimeoutId);
  mapaRegenerarTimeoutId = setTimeout(() => generarMapaVocal(true), 450);
}

function mapaConstruirSvg(datos) {
  const ANCHO_BLANCA = 15;
  const ALTO_BLANCA = 85;
  const ALTO_NEGRA = 52;
  const GAP_BANDA_TECLADO = 3;
  const GAP_TECLADO_BRACKETS = 6;
  // Cada fila necesita más de 22px reales (tope del bracket ±5 + texto que
  // baja hasta ~17px bajo su línea) — con menos, el tope de una fila pisa el
  // texto de la fila de arriba cuando pecho y cabeza quedan apiladas.
  const FILA_ALTO = 24;

  // La nota "central" de referencia depende de la tesitura: Do4 si el
  // passaggio cae en Fa4 o más agudo, Do3 si es más grave (barítono) — se
  // decide sola a partir del passaggio, no hay que elegirla a mano.
  const FA4_MIDI = nombreAMidi("Fa4");
  const centralEsDo4 = datos.passaggio >= FA4_MIDI;
  const centralMidi = centralEsDo4 ? nombreAMidi("Do4") : nombreAMidi("Do3");
  const centralEtiqueta = centralEsDo4 ? "Do4 (central)" : "Do3 (central)";

  const notasRango = [
    datos.pechoInicio,
    datos.pechoFinal,
    datos.cabezaInicio,
    datos.cabezaFinal,
    datos.passaggio,
    centralMidi,
    datos.passaggio - 6, // asegura que la zona de paso completa siempre quepa
    datos.passaggio + 6, // en el teclado, aunque pecho/cabeza sean más cortos
  ];
  if (datos.silbidoInicio !== null) notasRango.push(datos.silbidoInicio, datos.silbidoFinal);
  if (datos.mongolInicio !== null) notasRango.push(datos.mongolInicio, datos.mongolFinal);
  if (datos.belting !== null) notasRango.push(datos.belting);
  // Si pecho y cabeza se solapan, el cálculo de la diagonal más abajo lee
  // cabezaInicio-1 (mapaLimite) — sin esto, cuando cabezaInicio ya es la nota
  // más grave del mapa, esa tecla queda fuera del teclado dibujado y revienta
  // con "Cannot read properties of undefined (reading 'x')".
  if (datos.cabezaInicio <= datos.pechoFinal) notasRango.push(datos.cabezaInicio - 1);

  const [midiMin, midiMax] = mapaRedondearRango(Math.min(...notasRango), Math.max(...notasRango));
  const pos = mapaConstruirPosiciones(midiMin, midiMax, ANCHO_BLANCA);

  // Zonas para las líneas de cota de abajo (nombre completo del registro,
  // tal como lo escribió el profesor — el color de encima puede no cubrir
  // el 100% de este rango, pero el registro en sí sí llega hasta ahí).
  const zonas = [];
  if (datos.mongolInicio !== null) {
    zonas.push({ tipo: "mongol", desde: datos.mongolInicio, hasta: datos.mongolFinal, etiqueta: "Emulación canto mongol" });
  }
  if (datos.silbidoInicio !== null) {
    zonas.push({ tipo: "silbido", desde: datos.silbidoInicio, hasta: datos.silbidoFinal, etiqueta: "Voz de silbido" });
  }
  zonas.push({ tipo: "pecho", desde: datos.pechoInicio, hasta: datos.pechoFinal, etiqueta: "Voz de pecho" });
  zonas.push({ tipo: "cabeza", desde: datos.cabezaInicio, hasta: datos.cabezaFinal, etiqueta: "Voz de cabeza" });

  // El único solapamiento real es pecho/cabeza: son los únicos dos que
  // necesitan alturas distintas para sus "cotas" de abajo. Mongol nunca se
  // pisa con pecho (termina justo antes de que empiece) y silbido nunca se
  // pisa con cabeza (empieza justo después de que termina), así que cada
  // uno puede ir PEGADO, en la misma fila que su vecino, en vez de saltar a
  // una fila propia — eso es lo que generaba tanto espacio en blanco abajo.
  const hayColapsoPechoCabeza = datos.cabezaInicio <= datos.pechoFinal;
  const filaPechoGrupo = 0;
  const filaCabezaGrupo = hayColapsoPechoCabeza ? 1 : 0;
  zonas.forEach((zona) => {
    zona.fila = zona.tipo === "mongol" || zona.tipo === "pecho" ? filaPechoGrupo : filaCabezaGrupo;
  });
  const filasZonas = hayColapsoPechoCabeza ? 2 : 1;

  // Zona de paso: passaggio ± 3 tonos (6 semitonos) — un cálculo TEÓRICO
  // aparte, sin relación con dónde el profesor puso cabezaInicio de verdad.
  const mixPechoDesde = Math.max(midiMin, datos.passaggio - 6);
  const mixCabezaHasta = Math.min(midiMax, datos.passaggio + 6);
  // x de las dos líneas que van a bajar desde estas teclas hasta la cota de
  // "Mix pecho"/"Mix cabeza" -- se calculan ya aquí porque las etiquetas de
  // "Voz de pecho"/"Voz de cabeza" de abajo necesitan saber por dónde van a
  // pasar, para poder correrse a un lado y no quedar tachadas por ellas.
  const [zpX1] = mapaBordes(pos, mixPechoDesde, mixPechoDesde);
  const [, zpX2] = mapaBordes(pos, mixCabezaHasta, mixCabezaHasta);

  // --- Guías de arriba: las notas "importantes" (passaggio y central, con
  // su nombre en dos líneas) en su propia fila, y el inicio/final de cada
  // registro (una sola línea, solo la nota) en otra, más pegada al teclado.
  // CADA GRUPO OCUPA UNA SOLA FILA: si dos notas quedan muy juntas no se
  // manda ninguna a una fila nueva (eso deja espacio vertical de sobra) —
  // se le achica la letra o se corre horizontalmente (`mapaAcomodarFila`).
  const centroDeNota = (midi) => pos.posiciones[midi].x + pos.posiciones[midi].ancho / 2;
  const FUENTE_PRINCIPAL = 7;
  const FUENTE_PRINCIPAL_MIN = 5;
  const FUENTE_NOTA = 6;
  const FUENTE_NOTA_MIN = 5;
  const MARGEN_ENTRE_GUIAS = 4;

  // El belting NO va arriba con el resto de guías — se marca aparte, muy
  // pequeño, directamente sobre su propia tecla (más abajo).
  const guiasPrincipales = [{ midi: datos.passaggio, color: MAPA_COLORES.passaggio, etiqueta: `Passaggio (${midiANombre(datos.passaggio)})` }];
  if (pos.posiciones[centralMidi]) guiasPrincipales.push({ midi: centralMidi, color: MAPA_COLORES.central, etiqueta: centralEtiqueta });
  guiasPrincipales.sort((a, b) => centroDeNota(a.midi) - centroDeNota(b.midi));
  guiasPrincipales.forEach((g) => (g.x = centroDeNota(g.midi)));
  const medirPrincipal = (item, fuente) => Math.max(...mapaLineasEtiqueta(item.etiqueta).map((l) => mapaAnchoTexto(l, fuente)));
  mapaAcomodarFila(guiasPrincipales, medirPrincipal, FUENTE_PRINCIPAL, FUENTE_PRINCIPAL_MIN, MARGEN_ENTRE_GUIAS, pos.anchoTotal);

  const guiasNotas = [];
  const agregarGuiaNota = (midi, color) => {
    if (pos.posiciones[midi]) guiasNotas.push({ midi, color, etiqueta: midiANombre(midi) });
  };
  agregarGuiaNota(datos.pechoInicio, MAPA_COLORES.pecho);
  agregarGuiaNota(datos.pechoFinal, MAPA_COLORES.pecho);
  agregarGuiaNota(datos.cabezaInicio, MAPA_COLORES.cabeza);
  agregarGuiaNota(datos.cabezaFinal, MAPA_COLORES.cabeza);
  if (datos.mongolInicio !== null) {
    agregarGuiaNota(datos.mongolInicio, MAPA_COLORES.mongol);
    agregarGuiaNota(datos.mongolFinal, MAPA_COLORES.mongol);
  }
  if (datos.silbidoInicio !== null) {
    agregarGuiaNota(datos.silbidoInicio, MAPA_COLORES.silbido);
    agregarGuiaNota(datos.silbidoFinal, MAPA_COLORES.silbido);
  }
  guiasNotas.sort((a, b) => centroDeNota(a.midi) - centroDeNota(b.midi));
  guiasNotas.forEach((g) => (g.x = centroDeNota(g.midi)));
  const medirNota = (item, fuente) => mapaAnchoTexto(item.etiqueta, fuente);
  mapaAcomodarFila(guiasNotas, medirNota, FUENTE_NOTA, FUENTE_NOTA_MIN, MARGEN_ENTRE_GUIAS, pos.anchoTotal);

  const MARGEN_BANDA = 5;
  const yBaseNotas = MARGEN_BANDA + FUENTE_NOTA; // única fila de notas, la más cercana al teclado
  const yBasePrincipales = yBaseNotas + (FUENTE_NOTA + 4) + 8; // única fila de principales, encima de esa
  const ALTO_BANDA_SUPERIOR = yBasePrincipales + MARGEN_BANDA;

  const yKeyboard = ALTO_BANDA_SUPERIOR + GAP_BANDA_TECLADO;
  const yBrackets = yKeyboard + ALTO_BLANCA + GAP_TECLADO_BRACKETS;
  // +10 extra de margen: el texto de la última fila de zonas (p. ej. "Voz de
  // cabeza") baja hasta yLinea+17 aprox., y los topes del bracket de "Mix
  // pecho/cabeza" empiezan en yMix-5 — sin este margen se llegan a tocar.
  const yMix = yBrackets + 8 + filasZonas * FILA_ALTO + 10;
  const yZonaPasoTexto = yMix + 30;
  const alturaTotal = yZonaPasoTexto + 26;

  let cuerpo = "";

  // --- Franja oscura encima del teclado: aquí van, en horizontal, los
  // avisos de las notas clave (passaggio, nota central, belting) y el
  // inicio/final de cada registro. -------------------------------------
  cuerpo += `<rect x="0" y="0" width="${pos.anchoTotal}" height="${ALTO_BANDA_SUPERIOR}" fill="#211c19" />`;

  // --- Teclado. --------------------------------------------------------
  cuerpo += mapaTeclasSvg(pos, midiMin, midiMax, yKeyboard, ALTO_BLANCA, ALTO_NEGRA);

  // --- Colores de registro, recortados con la FORMA real de cada tecla
  // (una negra no se colorea más abajo de su propia altura, más corta que
  // una blanca) para que ningún sostenido quede "a medio cubrir". ----------
  const idRecorte = "mapaRecorteTeclas";
  cuerpo += `<clipPath id="${idRecorte}">${mapaTeclasRecorteSvg(pos, midiMin, midiMax, yKeyboard, ALTO_BLANCA, ALTO_NEGRA)}</clipPath>`;
  cuerpo += `<g clip-path="url(#${idRecorte})">`;

  // Cada registro se pinta TECLA POR TECLA (`mapaZonaPorTeclas`) con la forma
  // real de cada una — igual que ya se hacía solo para el passaggio y la nota
  // central. Antes, la frontera entre dos registros de color distinto (ej.
  // cabeza|silbido, mongol|pecho) se resolvía con una única línea vertical
  // promediada (`mapaLimite`); si la nota justo en esa frontera era una tecla
  // negra, esa tecla quedaba partida a la mitad entre los dos colores — una
  // misma nota no puede ser "mitad cabeza, mitad silbido". Pintando tecla por
  // tecla, cada nota pertenece siempre a un solo color completo, y como dos
  // teclas vecinas encajan exactas (mismo filo, sin hueco ni solape), la
  // franja se sigue viendo continua.
  const yTope = yKeyboard, yPie = yKeyboard + ALTO_BLANCA;

  if (datos.mongolInicio !== null) {
    cuerpo += mapaZonaPorTeclas(pos, datos.mongolInicio, datos.mongolFinal, yTope, ALTO_NEGRA, ALTO_BLANCA, MAPA_COLORES.mongol, 0.45);
  }
  if (datos.silbidoInicio !== null) {
    cuerpo += mapaZonaPorTeclas(pos, datos.silbidoInicio, datos.silbidoFinal, yTope, ALTO_NEGRA, ALTO_BLANCA, MAPA_COLORES.silbido, 0.45);
  }

  // El solapamiento real de pecho y cabeza depende de dónde el profesor puso
  // CADA registro (cabezaInicio es un dato independiente, no la zona de
  // paso) — si cabezaInicio cae en o antes del final del pecho, se pisan y
  // esa columna se pinta en diagonal; el ancho de esa diagonal cambia según
  // qué tan grave sea cabezaInicio, así que su ángulo no es siempre el
  // mismo. Si no llegan a tocarse, cada uno es sólido y no hay diagonal.
  // El propio corte diagonal SÍ sigue usando un único límite promediado en
  // vez de tecla por tecla: es un degradado visual deliberado entre dos
  // registros que de verdad se solapan, no una frontera dura entre dos
  // registros que no se tocan (que es el caso que sí había que arreglar).
  const hayColapso = datos.cabezaInicio <= datos.pechoFinal;

  // El diagonal para justo en el borde real de la nota vecina al passaggio
  // (passaggio-1) — coincide exactamente con el filo de la muesca que
  // `mapaFormaTecla` le deja al passaggio de ese lado (ver más abajo), así
  // que no hay hueco entre uno y otro.
  const limiteDiagonalPassaggio = mapaBordes(pos, datos.passaggio - 1, datos.passaggio - 1)[1];

  if (hayColapso) {
    const pechoSolidoHasta = datos.cabezaInicio - 1;
    const limitePechoDiagonal = mapaLimite(pos, datos.cabezaInicio - 1, datos.cabezaInicio);
    if (datos.pechoInicio <= pechoSolidoHasta) {
      cuerpo += mapaZonaPorTeclas(pos, datos.pechoInicio, pechoSolidoHasta, yTope, ALTO_NEGRA, ALTO_BLANCA, MAPA_COLORES.pecho, 0.45);
    }
    // Corte diagonal limpio: pecho abajo a la izquierda, cabeza arriba a la
    // derecha, SIN línea divisoria ni relleno doble.
    cuerpo += `<polygon points="${limitePechoDiagonal},${yTope} ${limiteDiagonalPassaggio},${yTope} ${limitePechoDiagonal},${yPie}" fill="${MAPA_COLORES.pecho}" fill-opacity="0.45" />`;
    cuerpo += `<polygon points="${limitePechoDiagonal},${yPie} ${limiteDiagonalPassaggio},${yPie} ${limiteDiagonalPassaggio},${yTope}" fill="${MAPA_COLORES.cabeza}" fill-opacity="0.45" />`;
  } else {
    // No se tocan: la voz de pecho es sólida en todo su rango, sin diagonal.
    cuerpo += mapaZonaPorTeclas(pos, datos.pechoInicio, datos.pechoFinal, yTope, ALTO_NEGRA, ALTO_BLANCA, MAPA_COLORES.pecho, 0.45);
  }

  // Voz de cabeza: sólida desde justo después del passaggio (o desde su
  // propio inicio, si empieza más agudo que eso) hasta el final que
  // escribió el profesor.
  const cabezaSolidoDesde = Math.max(datos.cabezaInicio, datos.passaggio + 1);
  if (cabezaSolidoDesde <= datos.cabezaFinal) {
    cuerpo += mapaZonaPorTeclas(pos, cabezaSolidoDesde, datos.cabezaFinal, yTope, ALTO_NEGRA, ALTO_BLANCA, MAPA_COLORES.cabeza, 0.45);
  }

  // La tecla del passaggio: resaltada con SU PROPIA forma real (angosta
  // arriba si es blanca y tiene una negra vecina montada encima, del ancho
  // completo de su propia negra si es negra), semitransparente, y dibujada
  // AL FINAL de este grupo — es una frontera prohibida, no un color más de
  // la mezcla, pero ya no tapa ni un pelo de la tecla negra de al lado.
  cuerpo += `<polygon points="${mapaFormaTecla(pos, datos.passaggio, yTope, ALTO_NEGRA, ALTO_BLANCA)}" fill="${MAPA_COLORES.passaggio}" fill-opacity="0.55" />`;

  // La nota central: igual que el passaggio, resalta SU PROPIA tecla con su
  // forma real, semitransparente. Todos los "Do" tienen la misma forma
  // (angosta solo del lado derecho, porque Si-Do no tiene negra en medio),
  // así que `mapaFormaTecla` ya la recorta sin necesitar un caso especial.
  if (pos.posiciones[centralMidi]) {
    cuerpo += `<polygon points="${mapaFormaTecla(pos, centralMidi, yTope, ALTO_NEGRA, ALTO_BLANCA)}" fill="${MAPA_COLORES.central}" fill-opacity="0.55" />`;
  }

  cuerpo += `</g>`;

  // Belting: NO se marca arriba con el resto de guías — un texto diminuto y
  // VERTICAL en la mitad inferior de su propia tecla, sin ningún halo, sin
  // salirse de esa tecla (usa la altura real: corta si es negra).
  if (datos.belting !== null && pos.posiciones[datos.belting]) {
    const xBelting = centroDeNota(datos.belting);
    const altoTeclaBelting = pos.posiciones[datos.belting].negra ? ALTO_NEGRA : ALTO_BLANCA;
    const yBelting = yKeyboard + altoTeclaBelting * 0.72;
    cuerpo += `<text x="${xBelting}" y="${yBelting}" text-anchor="middle" dominant-baseline="central" font-size="6" font-weight="700" fill="${MAPA_COLORES.belting}" font-family="'Work Sans', sans-serif" transform="rotate(-90 ${xBelting} ${yBelting})">Belting</text>`;
  }

  // --- Líneas de cota con el nombre de cada zona, DEBAJO del teclado,
  // pegadas a él. Solo pecho y cabeza (el único solapamiento real) usan
  // alturas distintas; mongol comparte la fila de pecho y silbido la de
  // cabeza, porque nunca se pisan con ellas. Se les pasa zpX1/zpX2 para que
  // la etiqueta ("Voz de pecho"/"Voz de cabeza"...) se corra a un lado si
  // alguna de las dos líneas de la zona de paso le pasa por encima -- sin
  // salirse nunca de su propia cota (mapaBracketSvg no la deja cruzar
  // desde/hasta). ------------------------------------------------------
  zonas.forEach((zona) => {
    const yLinea = yBrackets + 8 + zona.fila * FILA_ALTO;
    cuerpo += mapaBracketSvg(pos, zona.desde, zona.hasta, yLinea, MAPA_COLORES[zona.tipo], zona.etiqueta, 9, pos.anchoTotal, [zpX1, zpX2], true);
  });

  // --- Zona de paso: dos líneas de cota pequeñas y anidadas ("mix pecho" /
  // "mix cabeza", ± 3 tonos del passaggio) con el mismo lenguaje visual que
  // el resto de zonas, y debajo la etiqueta general en negrita. Sus dos
  // fronteras (± 3 tonos) se marcan además con una línea que baja desde la
  // tecla en el teclado hasta SU PROPIA cota de "Mix pecho"/"Mix cabeza" del
  // todo abajo (yMix) -- cruza por encima de "Voz de cabeza" a propósito,
  // para que se vea de un vistazo qué tecla exacta corresponde a cada
  // frontera de la zona de paso (antes se cortaba en la base del teclado y
  // quedaba un hueco sin conectar con su propia cota).
  cuerpo += mapaBracketSvg(pos, mixPechoDesde, datos.passaggio - 1, yMix, MAPA_COLORES.mixPecho.borde, "Mix pecho", 7, pos.anchoTotal);
  cuerpo += mapaBracketSvg(pos, datos.passaggio + 1, mixCabezaHasta, yMix, MAPA_COLORES.mixCabeza.borde, "Mix cabeza", 7, pos.anchoTotal);
  cuerpo += `<text x="${(zpX1 + zpX2) / 2}" y="${yZonaPasoTexto}" text-anchor="middle" font-size="10" font-weight="700" fill="#2a2320" font-family="'Work Sans', sans-serif">ZONA DE PASO</text>`;
  cuerpo += `<line x1="${zpX1}" y1="${yKeyboard}" x2="${zpX1}" y2="${yMix}" stroke="${MAPA_COLORES.mixPecho.borde}" stroke-width="1.5" stroke-dasharray="3,2" />`;
  cuerpo += `<line x1="${zpX2}" y1="${yKeyboard}" x2="${zpX2}" y2="${yMix}" stroke="${MAPA_COLORES.mixCabeza.borde}" stroke-width="1.5" stroke-dasharray="3,2" />`;

  // --- Guías verticales: nombre en HORIZONTAL sobre la franja oscura,
  // nunca inclinado. Cada grupo va en una sola fila; `mapaAcomodarFila` ya
  // decidió el tamaño de letra y si el texto de cada una se corrió a un
  // lado para no chocar con la de al lado. --------------------------------
  guiasNotas.forEach((guia) => {
    cuerpo += mapaGuiaSvg(guia.x, guia.anclaX, guia.anclaTipo, yBaseNotas, yKeyboard + ALTO_BLANCA, guia.color, guia.etiqueta, guia.fuente);
  });
  guiasPrincipales.forEach((guia) => {
    cuerpo += mapaGuiaSvg(guia.x, guia.anclaX, guia.anclaTipo, yBasePrincipales, yKeyboard + ALTO_BLANCA, guia.color, guia.etiqueta, guia.fuente);
  });

  // Nombres de nota en los límites blancos del rango, bajo la última fila.
  cuerpo += `<text x="4" y="${alturaTotal - 4}" font-size="10" fill="#5b4a42" font-family="'Work Sans', sans-serif">${escaparXml(midiANombre(midiMin))}</text>`;
  cuerpo += `<text x="${pos.anchoTotal - 4}" y="${alturaTotal - 4}" text-anchor="end" font-size="10" fill="#5b4a42" font-family="'Work Sans', sans-serif">${escaparXml(midiANombre(midiMax))}</text>`;

  const anchoSvg = pos.anchoTotal + 16;
  return `<svg id="mapaSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${anchoSvg} ${alturaTotal}" width="${anchoSvg}" height="${alturaTotal}" font-family="'Work Sans', sans-serif">
    <rect x="0" y="0" width="${anchoSvg}" height="${alturaTotal}" fill="#ffffff" />
    <g transform="translate(8,0)">${cuerpo}</g>
  </svg>`;
}

async function descargarMapaVocal() {
  const svgElemento = document.getElementById("mapaSvg");
  if (!svgElemento) return;
  const boton = el("btnMapaDescargar");
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Generando…";
  try {
    const anchoSvg = parseFloat(svgElemento.getAttribute("width"));
    const altoSvg = parseFloat(svgElemento.getAttribute("height"));
    const escala = 2; // más resolución para imprimir
    const serializador = new XMLSerializer();
    const textoSvg = serializador.serializeToString(svgElemento);
    const urlSvg = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(textoSvg);

    const imagen = new Image();
    await new Promise((resolve, reject) => {
      imagen.onload = resolve;
      imagen.onerror = () => reject(new Error("No se pudo convertir el SVG a imagen"));
      imagen.src = urlSvg;
    });

    const canvas = document.createElement("canvas");
    canvas.width = anchoSvg * escala;
    canvas.height = altoSvg * escala;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);

    await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `mapa-vocal-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        resolve();
      }, "image/png");
    });
  } catch (err) {
    el("estadoMapa").textContent = `No se pudo descargar la imagen: ${err.message}`;
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

const MAPA_CAMPOS_EN_VIVO = [
  "mapaPechoInicio",
  "mapaPassaggio",
  "mapaCabezaInicio",
  "mapaCabezaFinal",
  "mapaSilbidoFinal",
  "mapaMongolInicio",
  "mapaBeltingNota",
];
const MAPA_CASILLAS_EN_VIVO = ["mapaTieneSilbido", "mapaTieneMongol"];

function inicializarMapaVocal() {
  el("btnMapaGenerar").addEventListener("click", () => generarMapaVocal(false));
  el("btnMapaDescargar").addEventListener("click", descargarMapaVocal);

  MAPA_CAMPOS_EN_VIVO.forEach((id) => el(id).addEventListener("input", mapaProgramarRegeneracionEnVivo));
  MAPA_CASILLAS_EN_VIVO.forEach((id) => el(id).addEventListener("change", () => generarMapaVocal(false)));

  generarMapaVocal(true); // los campos ya vienen con valores por defecto
}

document.addEventListener("DOMContentLoaded", inicializarMapaVocal);
