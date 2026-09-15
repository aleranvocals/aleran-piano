/*
 * escalas.js — base de datos de tipos de voz y escalas/patrones vocales,
 * más las utilidades de notas y MIDI. Sin dependencias externas.
 *
 * Convención: Do4 = nota MIDI 60 (Do central). Do1 = 24, Do6 = 84.
 */

// Atajo compartido por todas las páginas (se carga primero en todas).
const el = (id) => document.getElementById(id);

// Fecha de "hoy" en el huso horario LOCAL del alumno, como YYYY-MM-DD.
// OJO: nunca uses date.toISOString().slice(0,10) para esto — toISOString()
// da la fecha en UTC, así que para cualquiera al oeste de UTC (toda
// Latinoamérica, el público real de la app) el "día" cambiaría de fecha
// 4-8 horas antes de medianoche local, rompiendo la racha de práctica sin
// que el alumno entienda por qué.
function fechaLocalISO(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const NOMBRES_NOTA = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const ALIAS_BEMOL = { Reb: 1, Mib: 3, Solb: 6, Lab: 8, Sib: 10 };

const DO1_MIDI = 24;
const DO6_MIDI = 84;

function nombreAMidi(nombre) {
  nombre = nombre.trim();
  let idx = nombre.length;
  while (idx > 0 && /[0-9]/.test(nombre[idx - 1])) idx--;
  const letra = nombre.slice(0, idx);
  const octavaStr = nombre.slice(idx);
  let indice = NOMBRES_NOTA.indexOf(letra);
  if (indice === -1) indice = ALIAS_BEMOL[letra] ?? -1;
  if (indice === -1 || octavaStr === "") {
    throw new Error(`Nota invalida: "${nombre}" (ejemplos validos: Do4, Fa#3, Sol2)`);
  }
  return 12 * (parseInt(octavaStr, 10) + 1) + indice;
}

function midiANombre(midi) {
  const octava = Math.floor(midi / 12) - 1;
  return `${NOMBRES_NOTA[((midi % 12) + 12) % 12]}${octava}`;
}

function midiAFrecuencia(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Rango cómodo de práctica por tipo de voz (tesitura central, no el límite
// teórico extremo de cada cuerda vocal): sirve para generar ejercicios seguros.
const VOCES = {
  bajo: { nombre: "Bajo", rango: ["Mi2", "Mi4"] },
  baritono: { nombre: "Barítono", rango: ["Sol2", "Sol4"] },
  tenor: { nombre: "Tenor", rango: ["Do3", "Do5"] },
  contralto: { nombre: "Contralto", rango: ["Fa3", "Fa5"] },
  mezzosoprano: { nombre: "Mezzosoprano", rango: ["La3", "La5"] },
  soprano: { nombre: "Soprano", rango: ["Do4", "Do6"] },
};

// Offsets en semitonos desde la nota raíz (grado 1 = 0). Catálogo amplio de
// escalas/patrones reales usados en pedagogía vocal, agrupados por categoría
// (calentamiento, escalas diatónicas, modos griegos, pentatónicas, arpegios,
// intervalos y técnicas específicas de voz mixta/passaggio).
const CATEGORIAS = {
  calentamiento: "Calentamiento",
  diatonicas: "Escalas diatónicas",
  modos: "Modos griegos",
  pentatonicas: "Pentatónicas y blues",
  arpegios: "Arpegios",
  intervalos: "Intervalos y saltos",
  voz_mixta: "Voz mixta / passaggio",
};

const PATRONES = {
  cinco_notas: {
    nombre: "Escala de 5 notas (1-2-3-4-5-4-3-2-1)",
    categoria: "calentamiento",
    semitonos: [0, 2, 4, 5, 7, 5, 4, 2, 0],
    tecnicas: ["calentamiento"],
    descripcion: "El calentamiento clásico para abrir sesión: rango corto y seguro.",
  },
  octavas: {
    nombre: "Salto de octava (1-8-1)",
    categoria: "calentamiento",
    semitonos: [0, 12, 0],
    tecnicas: ["voz_mixta", "conexion_de_registros"],
    descripcion: 'Salto directo de octava: fuerza a conectar pecho y cabeza sin "romper".',
  },
  quinta: {
    nombre: "Salto de quinta (1-5-1)",
    categoria: "intervalos",
    semitonos: [0, 7, 0],
    tecnicas: ["resonancia", "afinacion"],
    descripcion: "Salto de 5ª justa: muy usado para trabajar resonancia y ataque limpio de la nota.",
  },
  terceras: {
    nombre: "Escala en terceras (1-3-2-4-3-5...)",
    categoria: "intervalos",
    semitonos: [0, 4, 2, 5, 4, 7, 5, 9, 7, 11, 9, 12, 11, 9, 7, 5, 4, 2, 0],
    tecnicas: ["agilidad", "afinacion"],
    descripcion:
      "Patrón clásico de agilidad: recorre la escala mayor saltando de 3ª en 3ª en vez de por grados conjuntos.",
  },
  mayor: {
    nombre: "Escala mayor completa (1-8-1)",
    categoria: "diatonicas",
    semitonos: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0],
    tecnicas: ["calentamiento", "amplitud_de_rango"],
    descripcion: "Escala mayor (jónico) ascendente-descendente; amplía el rango con tonalidad clara.",
  },
  menor_natural: {
    nombre: "Escala menor natural (1-8-1)",
    categoria: "diatonicas",
    semitonos: [0, 2, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 2, 0],
    tecnicas: ["afinacion", "color_tonal"],
    descripcion: "Menor natural (eólico): trabaja afinación de 3as y 6as menores; buen contraste con la mayor.",
  },
  menor_armonica: {
    nombre: "Escala menor armónica (1-8-1)",
    categoria: "diatonicas",
    semitonos: [0, 2, 3, 5, 7, 8, 11, 12, 11, 8, 7, 5, 3, 2, 0],
    tecnicas: ["afinacion", "agilidad"],
    descripcion: "El salto de 2ª aumentada (grado 6-7) exige mucha precisión auditiva.",
  },
  menor_melodica: {
    nombre: "Escala menor melódica (asc. distinta de desc.)",
    categoria: "diatonicas",
    semitonos: [0, 2, 3, 5, 7, 9, 11, 12, 10, 8, 7, 5, 3, 2, 0],
    tecnicas: ["afinacion", "agilidad"],
    descripcion:
      "Sube con 6ª y 7ª mayores (más brillante) y baja como menor natural: exige adaptar la afinación en tiempo real.",
  },
  dorico: {
    nombre: "Modo dórico (2º grado)",
    categoria: "modos",
    semitonos: [0, 2, 3, 5, 7, 9, 10, 12, 10, 9, 7, 5, 3, 2, 0],
    tecnicas: ["color_tonal", "afinacion"],
    descripcion: "Menor con 6ª mayor: color jazzero/folk, muy usado en pop y soul.",
  },
  frigio: {
    nombre: "Modo frigio (3º grado)",
    categoria: "modos",
    semitonos: [0, 1, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 1, 0],
    tecnicas: ["color_tonal", "afinacion"],
    descripcion: "La 2ª menor (grado 1-2) es un semitono muy expuesto: excelente para afinación fina.",
  },
  lidio: {
    nombre: "Modo lidio (4º grado)",
    categoria: "modos",
    semitonos: [0, 2, 4, 6, 7, 9, 11, 12, 11, 9, 7, 6, 4, 2, 0],
    tecnicas: ["color_tonal", "afinacion"],
    descripcion: "Mayor con 4ª aumentada: color 'flotante', habitual en bandas sonoras y balada moderna.",
  },
  mixolidio: {
    nombre: "Modo mixolidio (5º grado)",
    categoria: "modos",
    semitonos: [0, 2, 4, 5, 7, 9, 10, 12, 10, 9, 7, 5, 4, 2, 0],
    tecnicas: ["color_tonal", "afinacion"],
    descripcion: "Mayor con 7ª menor: el sonido característico del rock, blues y funk.",
  },
  locrio: {
    nombre: "Modo locrio (7º grado)",
    categoria: "modos",
    semitonos: [0, 1, 3, 5, 6, 8, 10, 12, 10, 8, 6, 5, 3, 1, 0],
    tecnicas: ["afinacion", "agilidad"],
    descripcion: "El modo más inestable (5ª disminuida): un reto de afinación, mejor en dosis cortas.",
  },
  pentatonica_mayor: {
    nombre: "Pentatónica mayor (1-2-3-5-6-8)",
    categoria: "pentatonicas",
    semitonos: [0, 2, 4, 7, 9, 12, 9, 7, 4, 2, 0],
    tecnicas: ["calentamiento", "agilidad"],
    descripcion: "Sin semitonos: suena bien en cualquier orden, ideal para principiantes o como final de sesión.",
  },
  pentatonica_menor: {
    nombre: "Pentatónica menor (1-b3-4-5-b7-8)",
    categoria: "pentatonicas",
    semitonos: [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0],
    tecnicas: ["agilidad", "color_tonal"],
    descripcion: "La base del blues, rock y soul vocal; muy natural de entonar.",
  },
  blues: {
    nombre: "Escala blues (con blue note)",
    categoria: "pentatonicas",
    semitonos: [0, 3, 5, 6, 7, 10, 12, 10, 7, 6, 5, 3, 0],
    tecnicas: ["color_tonal", "agilidad"],
    descripcion: "Pentatónica menor + la 'blue note' (5ª disminuida): ideal para fraseo con inflexiones.",
  },
  arpegio_mayor: {
    nombre: "Arpegio mayor (1-3-5-8-5-3-1)",
    categoria: "arpegios",
    semitonos: [0, 4, 7, 12, 7, 4, 0],
    tecnicas: ["resonancia", "colocacion"],
    descripcion: "Ideal para trabajar resonancia y colocación sin recorrer toda la escala.",
  },
  arpegio_menor: {
    nombre: "Arpegio menor (1-b3-5-8-5-b3-1)",
    categoria: "arpegios",
    semitonos: [0, 3, 7, 12, 7, 3, 0],
    tecnicas: ["resonancia", "color_tonal"],
    descripcion: "Variante menor del arpegio anterior.",
  },
  arpegio_mayor7: {
    nombre: "Arpegio mayor 7ª (1-3-5-7-8)",
    categoria: "arpegios",
    semitonos: [0, 4, 7, 11, 12, 11, 7, 4, 0],
    tecnicas: ["resonancia", "afinacion"],
    descripcion: "Añade la 7ª mayor: color jazzy, exige más precisión que el arpegio simple.",
  },
  arpegio_dominante7: {
    nombre: "Arpegio de dominante 7ª (1-3-5-b7-8)",
    categoria: "arpegios",
    semitonos: [0, 4, 7, 10, 12, 10, 7, 4, 0],
    tecnicas: ["resonancia", "color_tonal"],
    descripcion: "El sonido 'blues/soul' por excelencia; muy usado en riffs vocales.",
  },
  arpegio_menor7: {
    nombre: "Arpegio menor 7ª (1-b3-5-b7-8)",
    categoria: "arpegios",
    semitonos: [0, 3, 7, 10, 12, 10, 7, 3, 0],
    tecnicas: ["resonancia", "color_tonal"],
    descripcion: "Variante menor del arpegio de dominante; sonido suave tipo soul/R&B.",
  },
  arpegio_disminuido: {
    nombre: "Arpegio disminuido (1-b3-b5-6)",
    categoria: "arpegios",
    semitonos: [0, 3, 6, 9, 12, 9, 6, 3, 0],
    tecnicas: ["afinacion", "agilidad"],
    descripcion: "Simétrico (todo en terceras menores): muy exigente para la afinación, poco intuitivo.",
  },
  arpegio_aumentado: {
    nombre: "Arpegio aumentado (1-3-#5-8)",
    categoria: "arpegios",
    semitonos: [0, 4, 8, 12, 8, 4, 0],
    tecnicas: ["afinacion", "agilidad"],
    descripcion: "Simétrico (todo en terceras mayores): tan raro al oído como al cantarlo.",
  },
  nueve_tonos: {
    nombre: "Escala de 9 tonos (1-2-3-4-5-6-7-8-9-8...1)",
    categoria: "voz_mixta",
    semitonos: [0, 2, 4, 5, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 4, 2, 0],
    tecnicas: ["voz_mixta", "passaggio"],
    descripcion:
      "Patrón clásico (tipo Speech Level Singing) que atraviesa el passaggio de ida y vuelta para entrenar voz mixta sin quiebre.",
  },
  sirena: {
    nombre: "Sirena cromática (glissando aproximado)",
    categoria: "voz_mixta",
    semitonos: [...Array(13).keys(), ...[...Array(12).keys()].reverse()],
    tecnicas: ["voz_mixta", "legato", "passaggio"],
    descripcion:
      "Aproxima el glissando continuo de una octava con pasos cromáticos muy cortos; usa una duración de nota baja para que suene fluido.",
  },
};

const TECNICAS_DISPONIBLES = [...new Set(Object.values(PATRONES).flatMap((p) => p.tecnicas))].sort();

function crearRng(semilla) {
  if (semilla === null || semilla === undefined || semilla === "") {
    return { randint: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) };
  }
  let s = (semilla >>> 0) || 1;
  function siguiente() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return { randint: (a, b) => a + Math.floor(siguiente() * (b - a + 1)) };
}

function construirSecuenciaAleatoria(numNotas, semilla) {
  const rng = crearRng(semilla);
  const secuencia = [];
  for (let i = 0; i < numNotas; i++) secuencia.push(rng.randint(DO1_MIDI, DO6_MIDI));
  return secuencia;
}

function construirRaicesEscalera(rangoBajo, rangoAlto, techoPatron, paso, idaYVuelta) {
  const raices = [];
  let raiz = rangoBajo;
  while (raiz + techoPatron <= rangoAlto) {
    raices.push(raiz);
    raiz += paso;
  }
  if (idaYVuelta && raices.length > 1) raices.push(...raices.slice(0, -1).reverse());
  return raices;
}

// Cada evento: { midi, duracion }. midi === -1 significa silencio.

function eventosModoAleatorio({ numNotas, duracionNota, pausa, semilla }) {
  const secuencia = construirSecuenciaAleatoria(numNotas, semilla);
  const eventos = [];
  for (const midi of secuencia) {
    eventos.push({ midi, duracion: duracionNota });
    eventos.push({ midi: -1, duracion: pausa });
  }
  const info = `${secuencia.length} notas entre Do1 y Do6 — ` + secuencia.map(midiANombre).join(" · ");
  return { eventos, info };
}

function eventosModoEscala({ voz, patron, notaInicial, pasoSemitonos, soloSubida, duracionNota, pausa }) {
  const infoPatron = PATRONES[patron];
  const semitonos = infoPatron.semitonos;
  const techoPatron = Math.max(...semitonos);
  const infoVoz = VOCES[voz];
  const rangoBajo = nombreAMidi(infoVoz.rango[0]);
  const rangoAlto = nombreAMidi(infoVoz.rango[1]);

  let raices;
  if (notaInicial) {
    let raiz;
    try {
      raiz = nombreAMidi(notaInicial);
    } catch {
      throw new Error(`No entiendo la nota inicial "${notaInicial}" (ejemplos válidos: Do3, Fa#4, Sib2)`);
    }
    if (raiz < DO1_MIDI || raiz + techoPatron > DO6_MIDI) {
      throw new Error(
        `Con "${notaInicial}" como nota inicial, el patrón "${infoPatron.nombre}" se saldría del ` +
          `rango del piano (Do1 a Do6). Prueba con una nota inicial más grave.`
      );
    }
    raices = [raiz];
  } else {
    raices = construirRaicesEscalera(rangoBajo, rangoAlto, techoPatron, pasoSemitonos, !soloSubida);
  }
  if (raices.length === 0) {
    throw new Error(
      `El rango de ${infoVoz.nombre} es demasiado corto para el patrón "${infoPatron.nombre}" ` +
        `(necesita ${techoPatron} semitonos). Prueba otro patrón o fija una nota inicial.`
    );
  }

  const eventos = [];
  raices.forEach((raiz, indiceRaiz) => {
    for (const st of semitonos) {
      eventos.push({ midi: raiz + st, duracion: duracionNota });
      eventos.push({ midi: -1, duracion: pausa });
    }
    // Respiro entre cada repetición de la escalera (un paso más arriba o
    // abajo): sin esto, con la duración vinculada al tempo (pausa = 0) las
    // repeticiones sonaban pegadas sin dar tiempo a respirar. Se añade
    // siempre (esté o no vinculado al metrónomo), con la duración de una
    // nota para que la pausa tenga una lógica musical con el tempo.
    if (indiceRaiz < raices.length - 1) {
      eventos.push({ midi: -1, duracion: duracionNota });
    }
  });
  const info =
    `${infoVoz.nombre} · ${infoPatron.nombre} — raíces: ` + raices.map(midiANombre).join(", ");
  return { eventos, info };
}

/** Parsea texto tipo "Do3 Re#3 Mi3 Fa#3" (separado por espacios, comas o
 * saltos de línea) a una lista de notas MIDI. Lanza si alguna no es válida. */
function parsearNotasPersonalizadas(texto) {
  const tokens = texto
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    throw new Error("Escribe al menos una nota, por ejemplo: Do3 Re#3 Mi3 Fa#3");
  }
  return tokens.map((token) => {
    let midi;
    try {
      midi = nombreAMidi(token);
    } catch {
      throw new Error(`No entiendo la nota "${token}" (ejemplos válidos: Do3, Fa#4, Sib2)`);
    }
    if (midi < DO1_MIDI || midi > DO6_MIDI) {
      throw new Error(
        `"${token}" está fuera del rango del piano (Do1 a Do6). Usa una nota entre esas dos.`
      );
    }
    return midi;
  });
}

function eventosNotasPersonalizadas({ texto, duracionNota, pausa }) {
  const secuencia = parsearNotasPersonalizadas(texto);
  const eventos = [];
  for (const midi of secuencia) {
    eventos.push({ midi, duracion: duracionNota });
    eventos.push({ midi: -1, duracion: pausa });
  }
  const info = `Escala personalizada: ` + secuencia.map(midiANombre).join(" · ");
  return { eventos, info };
}
