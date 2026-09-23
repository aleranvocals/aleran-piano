"use strict";

/* =========================================================
   Silabización gramatical del español
   ========================================================= */

const VOCALES = "aeiouáéíóúü";
const FUERTES = "aeoáéó";
const DEBILES_TONICAS = "íú";

// Pares consonánticos inseparables: siempre se quedan enteros con la sílaba
// siguiente (nunca se parten entre dos sílabas).
const INSEPARABLES = new Set([
  "pl", "bl", "cl", "gl", "fl", "tl",
  "pr", "br", "cr", "gr", "fr", "tr", "dr",
]);

function esVocal(ch) {
  return VOCALES.includes(ch.toLowerCase());
}
function esFuerte(ch) {
  return FUERTES.includes(ch.toLowerCase());
}
function esDebilTonica(ch) {
  return DEBILES_TONICAS.includes(ch.toLowerCase());
}
function esDigrafo(a, b) {
  const par = (a + b).toLowerCase();
  return par === "ch" || par === "ll" || par === "rr";
}

// "unidades" ya viene tokenizado (cada elemento es una letra suelta o una
// unidad de dos letras: dígrafo ch/ll/rr, o "qu"/"gu" con la u muda) — así no
// se pierde esa frontera al decidir dónde parte la sílaba.
function repartirConsonantes(unidades) {
  if (unidades.length === 0) return { colaAnterior: [], inicioSiguiente: [] };
  if (unidades.length === 1) return { colaAnterior: [], inicioSiguiente: unidades };

  if (unidades.length === 2) {
    const [a, b] = unidades;
    if (a.length === 1 && b.length === 1 && INSEPARABLES.has((a + b).toLowerCase())) {
      return { colaAnterior: [], inicioSiguiente: [a, b] };
    }
    return { colaAnterior: [a], inicioSiguiente: [b] };
  }

  const [penultima, ultima] = unidades.slice(-2);
  if (penultima.length === 1 && ultima.length === 1 && INSEPARABLES.has((penultima + ultima).toLowerCase())) {
    return { colaAnterior: unidades.slice(0, -2), inicioSiguiente: [penultima, ultima] };
  }
  return { colaAnterior: unidades.slice(0, -1), inicioSiguiente: [unidades[unidades.length - 1]] };
}

function silabizarPalabra(palabra) {
  const n = palabra.length;
  if (n === 0) return [];

  const tokens = [];
  for (let i = 0; i < n; i++) {
    const c = palabra[i];
    const cl = c.toLowerCase();
    if (esVocal(c)) {
      tokens.push({ tipo: "V", texto: c });
      continue;
    }
    if (
      (cl === "q" || cl === "g") &&
      i + 2 < n &&
      palabra[i + 1].toLowerCase() === "u" &&
      "eiéí".includes(palabra[i + 2].toLowerCase())
    ) {
      tokens.push({ tipo: "C", texto: c + palabra[i + 1] });
      i++;
      continue;
    }
    if (i + 1 < n && esDigrafo(c, palabra[i + 1])) {
      tokens.push({ tipo: "C", texto: c + palabra[i + 1] });
      i++;
      continue;
    }
    tokens.push({ tipo: "C", texto: c });
  }

  const runs = [];
  for (const t of tokens) {
    const ultimo = runs[runs.length - 1];
    if (ultimo && ultimo.tipo === t.tipo) {
      ultimo.tokens.push(t);
    } else {
      runs.push({ tipo: t.tipo, tokens: [t] });
    }
  }

  const nucleos = [];
  const consonantesEntre = [];
  // Cada "prefijo"/"consonantesEntre" es un ARREGLO de unidades (no un string
  // concatenado), para no perder la frontera de dígrafos/"qu"-"gu" al repartir.
  let prefijoActual = [];

  for (const run of runs) {
    if (run.tipo === "C") {
      prefijoActual = prefijoActual.concat(run.tokens.map((t) => t.texto));
      continue;
    }
    const letras = run.tokens.map((t) => t.texto);
    let grupoActual = [letras[0]];
    for (let i = 1; i < letras.length; i++) {
      const prev = grupoActual[grupoActual.length - 1];
      const cur = letras[i];
      const hiato = (esFuerte(prev) && esFuerte(cur)) || esDebilTonica(prev) || esDebilTonica(cur);
      if (hiato) {
        nucleos.push(grupoActual.join(""));
        consonantesEntre.push(prefijoActual);
        prefijoActual = [];
        grupoActual = [cur];
      } else {
        grupoActual.push(cur);
      }
    }
    nucleos.push(grupoActual.join(""));
    consonantesEntre.push(prefijoActual);
    prefijoActual = [];
  }
  const sufijoFinal = prefijoActual.join("");

  if (nucleos.length === 0) return [sufijoFinal];

  const silabas = [];
  for (let i = 0; i < nucleos.length; i++) {
    let inicioSilaba;
    if (i === 0) {
      inicioSilaba = consonantesEntre[0].join("");
    } else {
      const { colaAnterior, inicioSiguiente } = repartirConsonantes(consonantesEntre[i]);
      silabas[silabas.length - 1] += colaAnterior.join("");
      inicioSilaba = inicioSiguiente.join("");
    }
    silabas.push(inicioSilaba + nucleos[i]);
  }
  silabas[silabas.length - 1] += sufijoFinal;

  return silabas;
}

function separarPalabra(tokenBruto) {
  const m = tokenBruto.match(/^([^\p{L}]*)(\p{L}+)([^\p{L}]*)$/u);
  if (!m) return { pre: tokenBruto, nucleo: "", post: "" };
  return { pre: m[1], nucleo: m[2], post: m[3] };
}

/* =========================================================
   Silabización aproximada del inglés
   (la ortografía inglesa no es fonética como la española: esto es una
   aproximación razonable — grupos vocálicos = núcleo, "e" final muda,
   dígrafos comunes — no un diccionario de pronunciación. Las casillas
   son editables para corregir lo que falle.)
   ========================================================= */

const INSEPARABLES_EN_INICIO = new Set([
  "pl", "bl", "cl", "gl", "fl", "sl",
  "pr", "br", "cr", "gr", "fr", "tr", "dr",
  "sc", "sk", "sm", "sn", "sp", "st", "sw", "tw", "dw", "gw",
]);
const INSEPARABLES_EN_CODA = new Set(["ck", "ng", "tch", "dge"]);
const DIGRAFOS_EN_INICIO = new Set(["th", "sh", "ch", "ph", "wh", "gh"]);

function repartirConsonantesIngles(unidades) {
  if (unidades.length === 0) return { colaAnterior: [], inicioSiguiente: [] };

  const combo = unidades.join("").toLowerCase();
  if (unidades.length <= 3 && INSEPARABLES_EN_CODA.has(combo)) {
    return { colaAnterior: unidades, inicioSiguiente: [] };
  }
  if (unidades.length === 1) return { colaAnterior: [], inicioSiguiente: unidades };
  if (unidades.length === 2) {
    const [a, b] = unidades;
    if (a.length === 1 && b.length === 1 && INSEPARABLES_EN_INICIO.has((a + b).toLowerCase())) {
      return { colaAnterior: [], inicioSiguiente: [a, b] };
    }
    return { colaAnterior: [a], inicioSiguiente: [b] };
  }
  const ultimas2 = unidades.slice(-2).join("").toLowerCase();
  if (INSEPARABLES_EN_INICIO.has(ultimas2)) {
    return { colaAnterior: unidades.slice(0, -2), inicioSiguiente: unidades.slice(-2) };
  }
  return { colaAnterior: unidades.slice(0, -1), inicioSiguiente: [unidades[unidades.length - 1]] };
}

function silabizarPalabraIngles(palabraOriginal) {
  // Patrón "consonante + le" final (table, apple, little, people...): esa
  // parte es su propia sílaba (la "e" no es simplemente muda ahí), a
  // diferencia de "whale"/"pale" donde antes de la "l" hay una vocal.
  const silabico = palabraOriginal.match(/^(.+?)([bcdfgjklmnpqrstvwxz])le$/i);
  if (silabico) {
    return [...silabizarPalabraIngles(silabico[1]), silabico[2] + "le"];
  }

  let palabra = palabraOriginal;

  // "e" final muda (name, like, quiet...): no cuenta como núcleo propio,
  // salvo que sea la única vocal de la palabra.
  let sufijoMudo = "";
  const m = palabra.match(/^(.*[^aeiouyAEIOUY])(e)$/);
  if (m && /[aeiouy]/i.test(m[1])) {
    palabra = m[1];
    sufijoMudo = m[2];
  }

  const n = palabra.length;
  if (n === 0) return [sufijoMudo || palabraOriginal];

  const tokens = [];
  for (let i = 0; i < n; i++) {
    const c = palabra[i];
    const cl = c.toLowerCase();
    const esVocal = cl === "y" ? i > 0 : "aeiou".includes(cl);
    if (esVocal) {
      tokens.push({ tipo: "V", texto: c });
      continue;
    }
    if (i + 1 < n && DIGRAFOS_EN_INICIO.has((c + palabra[i + 1]).toLowerCase())) {
      tokens.push({ tipo: "C", texto: c + palabra[i + 1] });
      i++;
      continue;
    }
    tokens.push({ tipo: "C", texto: c });
  }

  const runs = [];
  for (const t of tokens) {
    const ultimo = runs[runs.length - 1];
    if (ultimo && ultimo.tipo === t.tipo) ultimo.tokens.push(t);
    else runs.push({ tipo: t.tipo, tokens: [t] });
  }

  // A diferencia del español, cada grupo vocálico es UN solo núcleo: la
  // ortografía inglesa no distingue diptongo/hiato de forma fiable por letra.
  const nucleos = [];
  const consonantesEntre = [];
  let prefijoActual = [];
  for (const run of runs) {
    if (run.tipo === "C") {
      prefijoActual = prefijoActual.concat(run.tokens.map((t) => t.texto));
      continue;
    }
    nucleos.push(run.tokens.map((t) => t.texto).join(""));
    consonantesEntre.push(prefijoActual);
    prefijoActual = [];
  }
  const sufijoFinal = prefijoActual;

  if (nucleos.length === 0) return [palabraOriginal];

  const silabas = [];
  for (let i = 0; i < nucleos.length; i++) {
    let inicioSilaba;
    if (i === 0) {
      inicioSilaba = consonantesEntre[0].join("");
    } else {
      const { colaAnterior, inicioSiguiente } = repartirConsonantesIngles(consonantesEntre[i]);
      silabas[silabas.length - 1] += colaAnterior.join("");
      inicioSilaba = inicioSiguiente.join("");
    }
    silabas.push(inicioSilaba + nucleos[i]);
  }
  silabas[silabas.length - 1] += sufijoFinal.join("") + sufijoMudo;

  return silabas;
}

/* =========================================================
   División del japonés (kana) en moras
   (cada carácter es una mora — el sistema ya "viene silabizado" — salvo
   los pequeños ゃゅょ/ァィゥェォ que se pegan a la mora anterior: きゃ,
   ファ... っ/ッ y ー cuentan como su propia mora, que es lo correcto.
   Un kanji suelto no tiene lectura deducible por reglas, así que se trata
   como una sola casilla — corrígelo a mano si en la canción son más de
   una mora.)
   ========================================================= */

const KANA_PEQUENA = new Set([
  "ゃ", "ゅ", "ょ", "ャ", "ュ", "ョ",
  "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ァ", "ィ", "ゥ", "ェ", "ォ",
]);

function silabizarPalabraJapones(nucleo) {
  const caracteres = Array.from(nucleo);
  const moras = [];
  for (const c of caracteres) {
    if (KANA_PEQUENA.has(c) && moras.length > 0) {
      moras[moras.length - 1] += c;
    } else {
      moras.push(c);
    }
  }
  return moras;
}

/* =========================================================
   Convenciones de color (basado en el póster "Sonar como un
   profesional" de Áleran Vocals)
   ========================================================= */

const CATEGORIAS_TECNICAS = [
  { id: "mecanismos", nombre: "Mecanismos Vocales", hue: 350 },
  { id: "colocaciones", nombre: "Colocaciones", hue: 210 },
  { id: "adornos", nombre: "Adornos", hue: 35 },
  { id: "efectos", nombre: "Efectos Vocales", hue: 268 },
];

const TECNICAS = [
  { id: "vocal-fry", categoria: "mecanismos", nombre: "Vocal Fry", corto: "Fry" },
  { id: "voz-pecho", categoria: "mecanismos", nombre: "Voz de Pecho", corto: "Pecho" },
  { id: "voz-mixta", categoria: "mecanismos", nombre: "Voz Mixta", corto: "Mixta" },
  { id: "voz-cabeza", categoria: "mecanismos", nombre: "Voz de Cabeza", corto: "Cabeza" },
  { id: "voz-silbido", categoria: "mecanismos", nombre: "Voz de Silbido", corto: "Silbido" },
  { id: "voz-difonica-gutural", categoria: "mecanismos", nombre: "Voz Difónica (Gutural)", corto: "Gutural" },
  { id: "voz-difonica-rasgado", categoria: "mecanismos", nombre: "Voz Difónica (Rasgado)", corto: "Rasgado" },
  { id: "voz-difonica-mongol", categoria: "mecanismos", nombre: "Voz Difónica (Canto Mongol)", corto: "Mongol" },

  { id: "central", categoria: "colocaciones", nombre: "Central", corto: "Central" },
  { id: "al-frente", categoria: "colocaciones", nombre: "Al Frente", corto: "Frente" },
  { id: "twang-nasal", categoria: "colocaciones", nombre: "Twang Nasal", corto: "Tw. Nasal" },
  { id: "twang-oral", categoria: "colocaciones", nombre: "Twang Oral", corto: "Tw. Oral" },
  { id: "engolada", categoria: "colocaciones", nombre: "Engolada", corto: "Engolada" },
  { id: "cubierta", categoria: "colocaciones", nombre: "Cubierta", corto: "Cubierta" },
  { id: "bostezo", categoria: "colocaciones", nombre: "Bostezo", corto: "Bostezo" },

  { id: "vibrato", categoria: "adornos", nombre: "Vibrato", corto: "Vibrato" },
  { id: "apoyatura", categoria: "adornos", nombre: "Apoyatura", corto: "Apoyat." },
  { id: "melisma", categoria: "adornos", nombre: "Melisma", corto: "Melisma" },
  { id: "tremolo", categoria: "adornos", nombre: "Trémolo", corto: "Trémolo" },
  { id: "mordente", categoria: "adornos", nombre: "Mordente", corto: "Mordente" },
  { id: "glissando", categoria: "adornos", nombre: "Glissando", corto: "Gliss." },
  { id: "grupeto", categoria: "adornos", nombre: "Grupeto", corto: "Grupeto" },

  { id: "distorsion", categoria: "efectos", nombre: "Distorsión", corto: "Distors." },
  { id: "raspy", categoria: "efectos", nombre: "Raspy Voice", corto: "Raspy" },
  { id: "crack", categoria: "efectos", nombre: "Crack / Flip / Yodel", corto: "Crack" },
  { id: "voz-aireada", categoria: "efectos", nombre: "Voz Aireada", corto: "Aireada" },
  { id: "vocal-fry-efecto", categoria: "efectos", nombre: "Vocal Fry", corto: "Fry" },
];

const COLOR_TECNICA = new Map();
const TECNICA_TEXTO_OSCURO = new Set();

(function calcularColores() {
  CATEGORIAS_TECNICAS.forEach((cat) => {
    const items = TECNICAS.filter((t) => t.categoria === cat.id);
    items.forEach((t, idx) => {
      const frac = items.length <= 1 ? 0.4 : idx / (items.length - 1);
      const l = Math.round(58 - frac * 26); // 58% (claro) -> 32% (oscuro)
      COLOR_TECNICA.set(t.id, `hsl(${cat.hue}, 62%, ${l}%)`);
      if (l >= 48) TECNICA_TEXTO_OSCURO.add(t.id);
    });
  });
})();

function categoriaDe(id) {
  return CATEGORIAS_TECNICAS.find((c) => c.id === TECNICAS.find((t) => t.id === id)?.categoria);
}

/* =========================================================
   Parseo de la letra completa
   ========================================================= */

function nuevaSilaba(texto, inicioPalabra) {
  return { texto, textoManual: null, inicioPalabra, marcas: new Set(), nota: "" };
}
function textoSilaba(s) {
  return s.textoManual !== null ? s.textoManual : s.texto;
}

function silabizarSegunIdioma(nucleo, idioma) {
  if (idioma === "en") return silabizarPalabraIngles(nucleo);
  if (idioma === "ja") return silabizarPalabraJapones(nucleo);
  return silabizarPalabra(nucleo);
}

// Id estable por línea (independiente de su posición en el array): hace
// falta para el viaje de ida y vuelta con el editor de ritmo por
// localStorage, que tiene que encontrar la línea correcta aunque el usuario
// haya editado otras cosas mientras tanto.
let siguienteLineaId = 1;

function construirLinea(textoLinea, idioma) {
  const palabras = textoLinea.split(/\s+/).filter(Boolean);
  const silabas = [];
  palabras.forEach((palabraBruta) => {
    const subTokens = palabraBruta.split("-");
    subTokens.forEach((sub, idxSub) => {
      const { pre, nucleo, post } = separarPalabra(sub);
      if (!nucleo) {
        if (pre + post) silabas.push(nuevaSilaba(pre + post, idxSub === 0));
        return;
      }
      const partes = silabizarSegunIdioma(nucleo, idioma);
      partes.forEach((sil, idx) => {
        let texto = sil;
        if (idx === 0) texto = pre + texto;
        if (idx === partes.length - 1) texto = texto + post;
        silabas.push(nuevaSilaba(texto, idxSub === 0 && idx === 0));
      });
    });
  });
  return {
    tipo: "linea",
    id: siguienteLineaId++,
    textoOriginal: textoLinea,
    silabas,
    enlaces: new Array(Math.max(0, silabas.length - 1)).fill(false),
    ritmo: null, // { unidades, bpm } una vez que vuelve del editor de ritmo
  };
}

/* =========================================================
   Detección automática de idioma (español / inglés / japonés)
   ========================================================= */

// Rangos Unicode de kana y kanji: si una línea tiene alguno, es japonesa —
// señal segura, no hace falta estadística para esto.
const RE_JAPONES = /[぀-ゟ゠-ヿ一-鿿]/;

function lineaEsJaponesa(linea) {
  return RE_JAPONES.test(linea);
}

// Palabras muy frecuentes de cada idioma (artículos, preposiciones,
// pronombres...): con pocas coincidencias ya alcanza para distinguir
// español de inglés, que comparten alfabeto y no se pueden separar por
// rango Unicode.
const PALABRAS_ES = new Set([
  "el", "la", "los", "las", "de", "del", "que", "y", "en", "un", "una", "unos", "unas",
  "es", "se", "no", "te", "lo", "le", "les", "su", "sus", "por", "con", "para", "como",
  "más", "pero", "si", "yo", "tu", "mí", "tú", "sí", "al", "o", "ya", "muy", "así",
  "este", "esta", "estos", "estas", "eso", "esa", "esos", "esas", "donde", "cuando",
  "porque", "también", "sin", "sobre", "entre", "hasta", "desde", "cada", "otro", "otra",
  "todo", "toda", "todos", "todas", "nada", "nunca", "siempre", "bien", "mal", "aquí",
  "allí", "soy", "eres", "somos", "son", "está", "están", "hay", "qué", "quién", "cómo",
]);
const PALABRAS_EN = new Set([
  "the", "and", "of", "to", "a", "in", "is", "you", "that", "it", "he", "was", "for",
  "on", "are", "as", "with", "his", "her", "they", "i", "at", "be", "this", "have",
  "from", "or", "one", "had", "by", "but", "not", "what", "all", "we", "when", "your",
  "can", "there", "an", "each", "which", "she", "do", "how", "their", "if", "will",
  "up", "other", "about", "out", "many", "then", "them", "these", "so", "some", "my",
  "me", "no", "just", "him", "know", "take", "into", "your", "im", "dont", "cant",
]);

function detectarIdiomaLatino(textoCompleto) {
  const palabras = (textoCompleto.toLowerCase().match(/\p{L}+/gu) || []);
  let puntosEs = 0;
  let puntosEn = 0;
  palabras.forEach((p) => {
    if (PALABRAS_ES.has(p)) puntosEs++;
    if (PALABRAS_EN.has(p)) puntosEn++;
  });
  return puntosEn > puntosEs ? "en" : "es";
}

function parsearCancion(textoBruto, idiomaElegido) {
  const auto = idiomaElegido === "auto";
  // El español/inglés se decide UNA vez con toda la letra (más señal que
  // línea por línea); el japonés se detecta línea por línea porque es una
  // señal segura por sí sola y así una canción mixta no rompe nada.
  const idiomaLatino = auto ? detectarIdiomaLatino(textoBruto) : idiomaElegido;

  return textoBruto.split(/\r?\n/).map((lineaBruta) => {
    const linea = lineaBruta.trim();
    if (linea === "") return { tipo: "espacio" };
    const m = linea.match(/^\[(.+)\]$/);
    if (m) return { tipo: "seccion", texto: m[1] };
    const idiomaLinea = auto && lineaEsJaponesa(linea) ? "ja" : idiomaLatino;
    return construirLinea(linea, idiomaLinea);
  });
}

function gruposDeNotas(lineaObj) {
  const grupos = [];
  let inicio = 0;
  const n = lineaObj.silabas.length;
  for (let i = 1; i <= n; i++) {
    if (i === n || !lineaObj.enlaces[i - 1]) {
      grupos.push({ inicio, fin: i - 1 });
      inicio = i;
    }
  }
  return grupos;
}

/* =========================================================
   Render
   ========================================================= */

let cancion = [];
let escalaCifrado = 1;

const elEntrada = document.getElementById("cifradoEntrada");
const elSalida = document.getElementById("cifradoSalida");
const elAcciones = document.getElementById("cifradoAcciones");
const elEstado = document.getElementById("estadoCifrado");
const elZoom = document.getElementById("cifradoZoom");
const elIdioma = document.getElementById("cifradoIdioma");

const SVG_ESLABON =
  '<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M9 15l6-6M8 16.5 5.6 18.9a3 3 0 0 1-4.2-4.2L4 12.1M16 7.5l2.4-2.4a3 3 0 0 1 4.2 4.2L20 11.9"/></svg>';

function renderCancion() {
  cerrarMenuMarcas();
  elSalida.innerHTML = "";
  // Solo la primera línea de verdad (ni "espacio" ni "seccion") lleva el
  // botón completo con texto -- repetido en cada línea de la canción entera
  // era demasiado ruido visual. Las demás llevan un ícono chiquito: sigue
  // siendo clicable en todas, solo ocupa mucho menos espacio.
  const primeraLinea = cancion.find((b) => b.tipo === "linea");
  cancion.forEach((bloque) => {
    if (bloque.tipo === "espacio") {
      const div = document.createElement("div");
      div.className = "cifrado-espacio";
      elSalida.appendChild(div);
      return;
    }
    if (bloque.tipo === "seccion") {
      const p = document.createElement("p");
      p.className = "cifrado-seccion";
      p.textContent = bloque.texto;
      elSalida.appendChild(p);
      return;
    }
    const contenedor = document.createElement("div");
    contenedor.className = "cifrado-linea-bloque";
    contenedor.appendChild(renderLinea(bloque));
    contenedor.appendChild(crearAccionesLinea(bloque, bloque === primeraLinea));
    elSalida.appendChild(contenedor);
  });
  elAcciones.hidden = cancion.length === 0;
  document.getElementById("cifradoAccionesCancion").hidden = cancion.length === 0;
}

function crearAccionesLinea(lineaObj, esPrimera) {
  const fila = document.createElement("div");
  fila.className = "cifrado-linea-acciones";

  const btnRitmo = document.createElement("button");
  btnRitmo.type = "button";
  btnRitmo.className = esPrimera ? "boton" : "boton boton-icono";
  btnRitmo.title = "Llevar al editor de ritmo";
  btnRitmo.setAttribute("aria-label", "Llevar al editor de ritmo");
  btnRitmo.textContent = esPrimera ? "🎵 Llevar al editor de ritmo" : "🎵";
  btnRitmo.addEventListener("click", () => llevarLineaAlEditorDeRitmo(lineaObj));
  fila.appendChild(btnRitmo);

  // Siempre visible, tenga o no ritmo real asignado -- sin .ritmo suena en
  // negras parejas con las notas que ya haya en la línea (ver reproducirLinea).
  const btnReproducir = document.createElement("button");
  btnReproducir.type = "button";
  btnReproducir.className = "boton principal";
  btnReproducir.textContent = "▶ Reproducir";
  btnReproducir.addEventListener("click", () => reproducirLinea(lineaObj));
  fila.appendChild(btnReproducir);

  lineaObj._elAcciones = fila;
  return fila;
}

function renderLineaEnSitio(lineaObj) {
  const viejo = lineaObj._el;
  const nuevo = renderLinea(lineaObj); // ojo: esto ya deja lineaObj._el = nuevo
  viejo.replaceWith(nuevo);
}

function renderLinea(lineaObj) {
  const fila = document.createElement("div");
  fila.className = "cifrado-linea";
  const n = lineaObj.silabas.length;
  const anchoHueco = Math.round(11 * escalaCifrado);
  fila.style.gridTemplateColumns = n <= 1 ? "auto" : `repeat(${n - 1}, auto ${anchoHueco}px) auto`;

  lineaObj.silabas.forEach((silaba, i) => {
    fila.appendChild(crearCelda(silaba, i));
    if (i < n - 1) fila.appendChild(crearEslabon(lineaObj, i));
  });

  gruposDeNotas(lineaObj).forEach((grupo) => {
    fila.appendChild(crearNotaGrupo(lineaObj, grupo));
  });

  lineaObj._el = fila;
  return fila;
}

function crearEslabon(lineaObj, i) {
  const activo = lineaObj.enlaces[i];
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cifrado-eslabon" + (activo ? " activo" : "");
  btn.title = activo
    ? "Separar: que cada sílaba tenga su propia nota"
    : "Unir: que estas dos sílabas compartan una sola nota (fraseo fonético)";
  btn.innerHTML = SVG_ESLABON;
  btn.style.gridColumn = String(2 * i + 2);
  btn.style.gridRow = "1";
  btn.addEventListener("click", () => {
    lineaObj.enlaces[i] = !lineaObj.enlaces[i];
    renderLineaEnSitio(lineaObj);
  });
  return btn;
}

function crearCelda(silaba, indiceCol) {
  const wrap = document.createElement("div");
  wrap.className = "cifrado-celda" + (silaba.inicioPalabra ? " inicio-palabra" : "");
  wrap.style.gridColumn = String(2 * indiceCol + 1);
  wrap.style.gridRow = "1";

  const chips = document.createElement("div");
  chips.className = "cifrado-chips";
  wrap.appendChild(chips);
  actualizarChips(silaba, chips);

  const texto = document.createElement("span");
  texto.className = "celda-texto";
  texto.contentEditable = "true";
  texto.spellcheck = false;
  texto.textContent = textoSilaba(silaba);
  texto.addEventListener("input", () => {
    silaba.textoManual = texto.textContent;
  });
  wrap.appendChild(texto);

  const btnMarca = document.createElement("button");
  btnMarca.type = "button";
  btnMarca.className = "celda-marca-btn";
  btnMarca.title = "Marcar técnica: vibrato, twang, voz de cabeza...";
  btnMarca.textContent = "+";
  btnMarca.addEventListener("click", (e) => {
    e.stopPropagation();
    abrirMenuMarcas(silaba, btnMarca, chips);
  });
  wrap.appendChild(btnMarca);

  return wrap;
}

function actualizarChips(silaba, elChips) {
  elChips.innerHTML = "";
  silaba.marcas.forEach((id) => {
    const tecnica = TECNICAS.find((t) => t.id === id);
    if (!tecnica) return;
    const chip = document.createElement("span");
    chip.className = "cifrado-chip";
    chip.style.background = COLOR_TECNICA.get(id);
    chip.style.color = TECNICA_TEXTO_OSCURO.has(id) ? "#1a1414" : "#fdf9f5";
    chip.title = tecnica.nombre;
    chip.textContent = tecnica.corto;
    elChips.appendChild(chip);
  });
}

function crearNotaGrupo(lineaObj, grupo) {
  const silabaBase = lineaObj.silabas[grupo.inicio];
  // Span editable (no <input>) para que la casilla crezca sola con el
  // contenido, igual que la sílaba — así "Sol#4" no se corta solo porque
  // la sílaba de arriba sea corta ("le").
  const span = document.createElement("span");
  span.className = "celda-nota" + (grupo.fin > grupo.inicio ? " celda-nota-fusionada" : "");
  span.contentEditable = "true";
  span.spellcheck = false;
  span.textContent = silabaBase.nota;
  span.style.gridColumn = `${2 * grupo.inicio + 1} / ${2 * grupo.fin + 2}`;
  span.style.gridRow = "2";
  marcarNotaCeldaSiInvalida(span, silabaBase.nota);
  span.addEventListener("input", () => {
    // Si queda vacía, limpia también el <br> residual que deja contenteditable
    // para que ":empty" (el punto de placeholder) siga funcionando.
    if (span.textContent.trim() === "") span.innerHTML = "";
    silabaBase.nota = span.textContent;
    marcarNotaCeldaSiInvalida(span, silabaBase.nota);
  });
  return span;
}

// Nota mal escrita en una sílaba: se marca con un borde ámbar sobre la
// propia celda (mismo helper que usan Mapa vocal/Piano) en vez de fallar en
// silencio -- antes una nota como "la2" simplemente sonaba a silencio al
// reproducir, sin ningún aviso de por qué.
function marcarNotaCeldaSiInvalida(span, notaTexto) {
  const r = interpretarNota(notaTexto);
  marcarCampoNotaInvalido(span, !r.valido && !r.vacio, r.mensaje);
}

/* =========================================================
   Menú flotante de marcas (convenciones)
   ========================================================= */

let menuMarcasActual = null;

function cerrarMenuMarcas() {
  if (!menuMarcasActual) return;
  menuMarcasActual.remove();
  menuMarcasActual = null;
  document.removeEventListener("click", manejarClicFueraMenu);
}

function manejarClicFueraMenu(e) {
  if (menuMarcasActual && !menuMarcasActual.contains(e.target)) cerrarMenuMarcas();
}

function abrirMenuMarcas(silaba, btnAncla, elChips) {
  const yaAbiertoParaEsta = menuMarcasActual && menuMarcasActual.dataset.silabaAbierta === "1";
  cerrarMenuMarcas();
  if (yaAbiertoParaEsta) return;

  const menu = document.createElement("div");
  menu.className = "marcas-menu";
  menu.dataset.silabaAbierta = "1";

  CATEGORIAS_TECNICAS.forEach((cat) => {
    const h = document.createElement("p");
    h.className = "marcas-menu-categoria";
    h.style.color = `hsl(${cat.hue}, 62%, 55%)`;
    h.textContent = cat.nombre;
    menu.appendChild(h);

    TECNICAS.filter((t) => t.categoria === cat.id).forEach((t) => {
      const fila = document.createElement("label");
      fila.className = "marcas-menu-item";

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = silaba.marcas.has(t.id);
      check.addEventListener("change", () => {
        if (check.checked) silaba.marcas.add(t.id);
        else silaba.marcas.delete(t.id);
        actualizarChips(silaba, elChips);
      });

      const swatch = document.createElement("span");
      swatch.className = "marcas-menu-swatch";
      swatch.style.background = COLOR_TECNICA.get(t.id);

      fila.appendChild(check);
      fila.appendChild(swatch);
      fila.appendChild(document.createTextNode(t.nombre));
      menu.appendChild(fila);
    });
  });

  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "marcas-menu-cerrar";
  cerrar.textContent = "Listo";
  cerrar.addEventListener("click", cerrarMenuMarcas);
  menu.appendChild(cerrar);

  document.body.appendChild(menu);
  const rect = btnAncla.getBoundingClientRect();
  const anchoMenu = 240;
  let left = window.scrollX + rect.left - anchoMenu / 2;
  left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - anchoMenu - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${window.scrollY + rect.bottom + 6}px`;

  menuMarcasActual = menu;
  setTimeout(() => document.addEventListener("click", manejarClicFueraMenu), 0);
}

/* =========================================================
   Leyenda de convenciones
   ========================================================= */

function renderLeyenda() {
  const cont = document.getElementById("cifradoLeyenda");
  if (!cont) return;
  cont.innerHTML = "";
  CATEGORIAS_TECNICAS.forEach((cat) => {
    const bloque = document.createElement("div");
    bloque.className = "leyenda-categoria";

    const titulo = document.createElement("p");
    titulo.className = "leyenda-titulo";
    titulo.style.color = `hsl(${cat.hue}, 62%, 55%)`;
    titulo.textContent = cat.nombre;
    bloque.appendChild(titulo);

    const lista = document.createElement("div");
    lista.className = "leyenda-lista";
    TECNICAS.filter((t) => t.categoria === cat.id).forEach((t) => {
      const item = document.createElement("span");
      item.className = "leyenda-item";
      const swatch = document.createElement("span");
      swatch.className = "leyenda-swatch";
      swatch.style.background = COLOR_TECNICA.get(t.id);
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(t.nombre));
      lista.appendChild(item);
    });
    bloque.appendChild(lista);
    cont.appendChild(bloque);
  });
}

/* =========================================================
   Enlace con el editor de ritmo (piano.html, pestaña Personalizada)
   ========================================================= */

const CLAVE_RITMO_ENVIO = "aleran-piano-ritmo-envio";
const CLAVE_RITMO_RESULTADO_PREFIJO = "aleran-piano-ritmo-resultado-";
const CLAVE_AUTOGUARDADO = "aleran-piano-cifrado-autoguardado";

const elBpm = document.getElementById("cifradoBpm");

function serializarBloque(bloque) {
  if (bloque.tipo !== "linea") return bloque;
  return {
    tipo: "linea",
    id: bloque.id,
    textoOriginal: bloque.textoOriginal,
    enlaces: bloque.enlaces,
    ritmo: bloque.ritmo,
    silabas: bloque.silabas.map((s) => ({
      texto: s.texto,
      textoManual: s.textoManual,
      inicioPalabra: s.inicioPalabra,
      marcas: Array.from(s.marcas),
      nota: s.nota,
    })),
  };
}

// Mismo objeto para las 3 formas de guardar la canción entera (autoguardado
// en localStorage, descarga a archivo): un solo formato, no tres.
function datosCancionActual() {
  return {
    textoEntrada: elEntrada.value,
    idioma: elIdioma.value,
    siguienteLineaId,
    cancion: cancion.map(serializarBloque),
  };
}

function aplicarDatosCancion(datos) {
  elEntrada.value = datos.textoEntrada || "";
  if (datos.idioma) elIdioma.value = datos.idioma;
  siguienteLineaId = datos.siguienteLineaId || 1;
  cancion = (datos.cancion || []).map((bloque) => {
    if (bloque.tipo !== "linea") return bloque;
    return { ...bloque, silabas: bloque.silabas.map((s) => ({ ...s, marcas: new Set(s.marcas) })) };
  });
}

// Justo antes de navegar a piano.html (por "Llevar al editor de ritmo") hay
// que guardar TODO el cifrado -- si no, al volver, la navegación se lo habría
// borrado entero, no solo la línea que se fue a editar.
function guardarCancionAutoguardado() {
  try {
    localStorage.setItem(CLAVE_AUTOGUARDADO, JSON.stringify(datosCancionActual()));
  } catch {
    /* localStorage lleno o bloqueado (privado/incógnito): no hay mucho más que hacer aquí. */
  }
}

function restaurarCancionAutoguardada() {
  let crudo;
  try {
    crudo = localStorage.getItem(CLAVE_AUTOGUARDADO);
  } catch {
    crudo = null;
  }
  if (!crudo) return false;
  try {
    aplicarDatosCancion(JSON.parse(crudo));
    return true;
  } catch {
    return false;
  }
}

// El autoguardado (localStorage) es solo para no perder el trabajo al ir y
// volver del editor de ritmo, o al recargar por accidente -- pero no
// sobrevive a borrar datos del navegador ni sirve para pasar la canción a
// otro dispositivo. Este archivo .json sí: es la copia de respaldo real, para
// cerrar la página tranquilo y seguir otro día (u otra máquina) donde quedó.
function descargarCancionJson() {
  const blob = new Blob([JSON.stringify(datosCancionActual(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `cifrado-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function abrirCancionDesdeArchivo(archivo) {
  const texto = await archivo.text();
  const datos = JSON.parse(texto);
  if (!Array.isArray(datos.cancion)) throw new Error("El archivo no tiene el formato esperado");
  aplicarDatosCancion(datos);
  renderCancion();
  guardarCancionAutoguardado();
}

// Cada línea presente busca si el editor de ritmo dejó un resultado suyo
// esperando (clave por id de línea) y, si lo hay, lo adopta y limpia la clave.
function aplicarResultadosDeRitmoPendientes() {
  let huboAlguno = false;
  cancion.forEach((bloque) => {
    if (bloque.tipo !== "linea") return;
    const clave = CLAVE_RITMO_RESULTADO_PREFIJO + bloque.id;
    let crudo;
    try {
      crudo = localStorage.getItem(clave);
    } catch {
      crudo = null;
    }
    if (!crudo) return;
    try {
      const datos = JSON.parse(crudo);
      bloque.ritmo = { unidades: datos.unidades, bpm: datos.bpm };
      huboAlguno = true;
    } catch {
      /* datos corruptos: se ignoran, no deben romper la carga de la página. */
    } finally {
      try {
        localStorage.removeItem(clave);
      } catch {
        /* no pasa nada si no se pudo limpiar */
      }
    }
  });
  return huboAlguno;
}

function llevarLineaAlEditorDeRitmo(lineaObj) {
  const unidades = lineaObj.silabas.map((s) => {
    let midi = null;
    const notaTexto = (s.nota || "").trim();
    if (notaTexto) {
      try {
        midi = nombreAMidi(notaTexto);
      } catch {
        midi = null; // nota mal escrita o vacía -> arranca como silencio, se corrige allá
      }
    }
    return { texto: textoSilaba(s), midi };
  });
  guardarCancionAutoguardado();
  try {
    localStorage.setItem(CLAVE_RITMO_ENVIO, JSON.stringify({ lineaId: lineaObj.id, unidades }));
  } catch {
    elEstado.textContent = "No se pudo mandar la línea al editor (almacenamiento del navegador lleno o bloqueado).";
    return;
  }
  window.location.href = "piano.html";
}

// Sin pasar por el editor de ritmo, cada grupo de notas (gruposDeNotas ya
// junta las sílabas enlazadas en una sola) suena como negra pareja -- un
// ritmo neutro pero real, para poder escuchar la melodía de inmediato sin
// obligar a nadie a armar un ritmo primero. Nota vacía o mal escrita ->
// silencio (nunca rompe la reproducción, igual que el resto del sitio).
function unidadesLineaPorDefecto(lineaObj) {
  return gruposDeNotas(lineaObj).map((grupo) => {
    const notaTexto = (lineaObj.silabas[grupo.inicio].nota || "").trim();
    let midi = null;
    if (notaTexto) {
      try {
        midi = nombreAMidi(notaTexto);
      } catch {
        midi = null;
      }
    }
    return { midi, figura: "negra" };
  });
}

async function reproducirLinea(lineaObj) {
  if (!window.PianoEngine) {
    elEstado.textContent = "El motor de audio todavía se está inicializando, espera un segundo…";
    return;
  }
  const bpm = parseInt(elBpm.value, 10) || (lineaObj.ritmo && lineaObj.ritmo.bpm) || 100;
  const unidades = lineaObj.ritmo ? lineaObj.ritmo.unidades : unidadesLineaPorDefecto(lineaObj);
  const eventos = unidadesAEventos(unidades, bpm);
  if (eventos.length === 0) return;

  // Una ligadura (solo posible tras pasar por el editor de ritmo, Modo
  // Músico) puede fundir varias unidades/celdas en un solo evento de audio,
  // desalineando el índice de evento del índice de celda -- mapaUnidadAEvento
  // (escalas.js) dice, para cada celda, a qué evento le tocó de verdad, así
  // que el resaltado sigue siendo exacto en vez de tener que desactivarlo
  // entero para cualquier línea que ya tuviera ritmo asignado.
  const celdas = lineaObj._el ? Array.from(lineaObj._el.querySelectorAll(".celda-nota")) : [];
  const mapaEventos = mapaUnidadAEvento(unidades);
  const celdasPorEvento = [];
  unidades.forEach((u, i) => {
    if (!celdas[i]) return;
    const evIdx = mapaEventos[i];
    (celdasPorEvento[evIdx] || (celdasPorEvento[evIdx] = [])).push(celdas[i]);
  });
  const metrica = parseInt(document.getElementById("cifradoMetrica").value, 10) || 4;
  if (window.MetronomoEngine) window.MetronomoEngine.iniciar(bpm, metrica);
  try {
    await window.PianoEngine.reproducirSecuencia(eventos, 0.8, {
      onEventoInicio: (i) => {
        (celdasPorEvento[i] || []).forEach((celda) => celda.classList.add("sonando"));
      },
      onEventoFin: (i) => {
        (celdasPorEvento[i] || []).forEach((celda) => celda.classList.remove("sonando"));
      },
    });
  } catch (err) {
    elEstado.textContent = `Error de audio: ${err.message}`;
  } finally {
    if (window.MetronomoEngine) window.MetronomoEngine.detener();
  }
}

// Junta las líneas de toda la canción en UNA sola llamada a
// reproducirSecuencia (mismo reloj de audio para todo, sin ir encadenando
// awaits línea por línea) con una pausa entre cada frase del largo de un
// compás completo según la métrica elegida (2, 3 o 4 tiempos -- el mismo
// número que acentúa el metrónomo) -- tanto entre líneas seguidas como tras
// un encabezado de sección ([Verso], [Coro]...), para que suene como una
// pausa real de respiración, no una nota pegada a la siguiente. Devuelve
// también el mapa de qué índice de evento resalta qué celda(s) -- una
// ligadura (Modo Músico) puede fundir varias celdas en un solo evento, de
// ahí la lista en vez de una sola celda (ver mapaUnidadAEvento en escalas.js).
function eventosCancionCompleta(bpm, metrica) {
  const PAUSA_ENTRE_FRASES = metrica * figuraASegundos("negra", bpm);
  const eventos = [];
  const resaltarPorIndice = new Map();

  cancion.forEach((bloque) => {
    if (bloque.tipo === "seccion") {
      if (eventos.length > 0) eventos.push({ midi: -1, duracion: PAUSA_ENTRE_FRASES });
      return;
    }
    if (bloque.tipo !== "linea") return; // "espacio": sin notas, se salta

    const unidades = bloque.ritmo ? bloque.ritmo.unidades : unidadesLineaPorDefecto(bloque);
    const eventosLineaActual = unidadesAEventos(unidades, bpm);
    if (eventosLineaActual.length === 0) return;

    const celdas = bloque._el ? Array.from(bloque._el.querySelectorAll(".celda-nota")) : [];
    const mapaEventos = mapaUnidadAEvento(unidades);
    const offsetEventos = eventos.length;
    unidades.forEach((u, i) => {
      if (!celdas[i]) return;
      const evIdxGlobal = offsetEventos + mapaEventos[i];
      if (!resaltarPorIndice.has(evIdxGlobal)) resaltarPorIndice.set(evIdxGlobal, []);
      resaltarPorIndice.get(evIdxGlobal).push(celdas[i]);
    });
    eventos.push(...eventosLineaActual);
    eventos.push({ midi: -1, duracion: PAUSA_ENTRE_FRASES });
  });

  return { eventos, resaltarPorIndice };
}

let cancionCompletaReproduciendo = false;

async function reproducirCancionCompleta() {
  if (!window.PianoEngine || cancionCompletaReproduciendo) return;
  const bpm = parseInt(elBpm.value, 10) || 100;
  const metrica = parseInt(document.getElementById("cifradoMetrica").value, 10) || 4;
  const { eventos, resaltarPorIndice } = eventosCancionCompleta(bpm, metrica);
  if (eventos.length === 0) {
    elEstado.textContent = "No hay ninguna línea con notas para reproducir todavía.";
    return;
  }

  cancionCompletaReproduciendo = true;
  const btnReproducir = document.getElementById("btnCifradoReproducirTodo");
  const btnDetener = document.getElementById("btnCifradoDetenerTodo");
  btnReproducir.disabled = true;
  btnDetener.disabled = false;
  elEstado.textContent = "";
  // El metrónomo suena por defecto mientras se reproduce, acentuando cada
  // "metrica" tiempos -- el mismo número que se usa para la pausa entre
  // frases, así el clic y la pausa cuentan el mismo compás.
  if (window.MetronomoEngine) window.MetronomoEngine.iniciar(bpm, metrica);
  try {
    await window.PianoEngine.reproducirSecuencia(eventos, 0.8, {
      onEventoInicio: (i) => {
        (resaltarPorIndice.get(i) || []).forEach((el) => el.classList.add("sonando"));
      },
      onEventoFin: (i) => {
        (resaltarPorIndice.get(i) || []).forEach((el) => el.classList.remove("sonando"));
      },
    });
  } catch (err) {
    elEstado.textContent = `Error de audio: ${err.message}`;
  } finally {
    cancionCompletaReproduciendo = false;
    btnReproducir.disabled = false;
    btnDetener.disabled = true;
    if (window.MetronomoEngine) window.MetronomoEngine.detener();
  }
}

function detenerCancionCompleta() {
  if (window.PianoEngine) window.PianoEngine.detenerReproduccion();
  if (window.MetronomoEngine) window.MetronomoEngine.detener();
}

/* =========================================================
   Acciones
   ========================================================= */

document.getElementById("btnCifradoGenerar").addEventListener("click", () => {
  const texto = elEntrada.value;
  if (!texto.trim()) {
    elEstado.textContent = "Pega primero la letra de la canción.";
    return;
  }
  cancion = parsearCancion(texto, elIdioma.value);
  renderCancion();
  elEstado.textContent = "";
});

elZoom.addEventListener("input", () => {
  escalaCifrado = parseFloat(elZoom.value);
  elSalida.style.setProperty("--cifrado-escala", escalaCifrado);
  renderCancion();
});

document.getElementById("btnCifradoReiniciar").addEventListener("click", () => {
  if (cancion.length && !confirm("¿Borrar todo el cifrado y empezar de nuevo?")) return;
  cancion = [];
  elEntrada.value = "";
  elEstado.textContent = "";
  try {
    localStorage.removeItem(CLAVE_AUTOGUARDADO);
  } catch {
    /* no pasa nada si no se pudo limpiar */
  }
  renderCancion();
});

document.getElementById("btnCifradoImprimir").addEventListener("click", () => {
  window.print();
});

document.getElementById("btnCifradoReproducirTodo").addEventListener("click", reproducirCancionCompleta);
document.getElementById("btnCifradoDetenerTodo").addEventListener("click", detenerCancionCompleta);

document.getElementById("btnCifradoCopiar").addEventListener("click", async () => {
  const texto = generarTextoPlano();
  try {
    await navigator.clipboard.writeText(texto);
    elEstado.textContent = "Copiado — ya lo puedes pegar donde quieras.";
  } catch {
    elEstado.textContent = "No se pudo copiar automáticamente. Usa Imprimir / PDF en su lugar.";
  }
});

document.getElementById("btnCifradoDescargar").addEventListener("click", () => {
  if (cancion.length === 0) {
    elEstado.textContent = "No hay nada que descargar todavía.";
    return;
  }
  descargarCancionJson();
  elEstado.textContent = "Descargado — abre ese archivo con \"📂 Abrir archivo\" para seguir donde quedaste.";
});

document.getElementById("btnCifradoAbrir").addEventListener("click", () => {
  document.getElementById("inputCifradoAbrir").click();
});

document.getElementById("inputCifradoAbrir").addEventListener("change", async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  try {
    await abrirCancionDesdeArchivo(archivo);
    elEstado.textContent = "Canción cargada.";
  } catch (err) {
    elEstado.textContent = `No se pudo abrir el archivo: ${err.message}`;
  } finally {
    e.target.value = "";
  }
});

function textoSilabaPlano(s) {
  const base = textoSilaba(s);
  if (s.marcas.size === 0) return base;
  const nombres = Array.from(s.marcas).map((id) => TECNICAS.find((t) => t.id === id)?.corto || id);
  return `${base}[${nombres.join(",")}]`;
}

function generarTextoPlano() {
  const lineas = [];
  cancion.forEach((bloque) => {
    if (bloque.tipo === "espacio") {
      lineas.push("");
      return;
    }
    if (bloque.tipo === "seccion") {
      lineas.push(`[${bloque.texto}]`);
      return;
    }
    lineas.push(bloque.silabas.map((s) => textoSilabaPlano(s)).join("-"));
    lineas.push(
      gruposDeNotas(bloque)
        .map((g) => bloque.silabas[g.inicio].nota || "·")
        .join("  ")
    );
  });
  return lineas.join("\n");
}

renderLeyenda();

// Si venimos de "Llevar al editor de ritmo" (o simplemente se recargó la
// página), recupera el cifrado completo y aplica cualquier ritmo que el
// editor haya dejado esperando.
if (restaurarCancionAutoguardada()) {
  aplicarResultadosDeRitmoPendientes();
  renderCancion();
}
