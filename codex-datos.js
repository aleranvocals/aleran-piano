/* codex-datos.js — contenido de las láminas del Codex (22/10/2026).
 * Son las infografías pedagógicas de Áleran (5. Clases\Material) pasadas a datos: el texto es el suyo, tal cual.
 * Las tesituras se dibujan a partir de NOTAS (no de porcentajes): están medidas sobre sus infografías y
 * Áleran debe revisarlas; si cambia una nota aquí, la lámina se redibuja sola.
 * Los colores evitan el amarillo y el dorado (regla de marca): donde la infografía usaba amarillo hay otro tono.
 * «termino» enlaza con una definición del Glosario y «practicar» con la herramienta para practicarlo. */
(function () {
  "use strict";
  const H = {
    afinacion: "piano.html?tab=individual#practicaVoz",
    escalas: "piano.html?tab=escala",
    rango: "entrenamiento.html?tab=rango",
    sirena: "entrenamiento.html?tab=sovt",
    sostener: "entrenamiento.html?tab=sostenida",
    crescendo: "entrenamiento.html?tab=messa",
    aire: "entrenamiento.html?tab=aire",
    twang: "entrenamiento.html?tab=espectro",
    intervalos: "oido.html?tab=intervalos",
    adivina: "oido.html?tab=notas",
    giros: "piano.html?tab=giros",
    metronomo: "piano.html?tab=metronomo",
    rutina: "rutina.html",
    cifrado: "cifrado.html",
    mapa: "mapa-vocal.html",
  };
  const T = (nombre, termino, practicar) => ({ nombre, termino: termino || null, practicar: practicar || null });

  const CONTACTO = { whatsapp: "+34 632 92 67 26", usuario: "aleran_vocals" };

  const MACROS = {
    id: "macros",
    nombre: "Control total de la voz",
    tipo: "macros",
    ancho: 1080,
    alto: 1350,
    titulo: "Sonar como un\nprofesional",
    subtitulo: "Control total de la voz",
    centro: "Técnica",
    rueda: [
      T("Tesitura", "Tesitura (rango cómodo)", H.rango),
      T("Postura"),
      T("Respiración", "Apoyo (appoggio)", H.aire),
      T("Articulación"),
      T("Afinación", "Cents", H.afinacion),
      T("Proyección", "Resonancia"),
    ],
    cajas: [
      {
        id: "mecanismos", titulo: "Mecanismos vocales", color: "#e0303a", icono: "micro",
        items: [T("Vocal fry"), T("Voz de pecho", "Registro de pecho (chest voice)", H.rango), T("Voz mixta", "Voz mixta (mixed voice)", H.rango),
          T("Voz de cabeza", "Registro de cabeza (head voice)", H.rango), T("Voz de silbido"), T("Voces difónicas")],
        nota: "(gutural, rasgado, canto mongol)",
      },
      {
        id: "colocaciones", titulo: "Colocaciones", color: "#3fb6c6", icono: "cabeza",
        items: [T("Central", "Resonancia"), T("Al frente", "Resonancia"), T("Twang nasal", "Nasalidad", H.twang), T("Twang oral", "Twang", H.twang),
          T("Engolada"), T("Cubierta"), T("Bostezo")],
      },
      {
        id: "adornos", titulo: "Adornos", color: "#f07a24", icono: "nota",
        items: [T("Vibrato", "Vibrato", H.sostener), T("Apoyatura", "Adornos vocales (ornamentos)", H.giros), T("Melisma", "Melisma / riff / run", H.cifrado),
          T("Trémolo", "Adornos vocales (ornamentos)", H.giros), T("Mordente", "Adornos vocales (ornamentos)", H.giros), T("Glissando", null, H.sirena),
          T("Inflexión", "Adornos vocales (ornamentos)", H.giros)],
      },
      {
        id: "efectos", titulo: "Efectos vocales", color: "#ff3b4e", icono: "rayo",
        items: [T("Distorsión"), T("Raspy voice"), T("Crack / Flip / Yodel", "Passaggio"), T("Voz aireada", null, H.aire), T("Vocal fry")],
      },
      {
        id: "cuidado", titulo: "Cuidado vocal", color: "#c02241", icono: "escudo",
        items: [T("Calentamiento", null, H.rutina), T("Alimentación"), T("Hábitos")],
      },
    ],
  };

  const COLOCACIONES = {
    id: "colocaciones",
    nombre: "Colocaciones vocales",
    tipo: "imagen",
    ancho: 1080,
    alto: 1529,
    imagen: "recursos/codex/colocaciones.jpg",
    // Zonas que se pueden tocar sobre la ilustración (en % del ancho y del alto de la imagen).
    zonas: [
      { x: 13, y: 31.5, w: 22, h: 6, ...T("Voz nasal o twang nasal", "Nasalidad", H.twang) },
      { x: 46, y: 32.5, w: 22, h: 6, ...T("Twang o twang oral", "Twang", H.twang) },
      { x: 68, y: 44.5, w: 22, h: 4, ...T("Voz engolada") },
      { x: 6, y: 48.5, w: 20, h: 4, ...T("Voz al frente", "Resonancia") },
      { x: 9, y: 63, w: 18, h: 4, ...T("Voz central", "Resonancia") },
      { x: 64, y: 63, w: 19, h: 4, ...T("Voz cubierta") },
      { x: 31, y: 71, w: 22, h: 4, ...T("Voz de bostezo") },
    ],
  };

  // Tesituras: desde · pecho (hasta dónde llega el pecho) · passaggio · cabeza (desde dónde) · hasta.
  // Medidas sobre las infografías de Áleran: REVISAR antes de usarlas como referencia en clase.
  const TESITURAS_FEMENINAS = {
    id: "tesituras-femeninas",
    nombre: "Tesituras femeninas",
    tipo: "tesituras",
    ancho: 1600,
    alto: 1000,
    titulo: "Tesituras femeninas",
    teclado: ["Do3", "Do7"],
    voces: [
      { nombre: "Contralto", color: "#e0303a", desde: "Re3", pecho: "Mi4", passaggio: "La4", cabeza: "Re5", hasta: "Fa5" },
      { nombre: "Mezzosoprano", color: "#f07a24", desde: "Mi3", pecho: "Fa4", passaggio: "Si4", cabeza: "Fa5", hasta: "La5" },
      { nombre: "Soprano", color: "#3fb6c6", desde: "Sol3", pecho: "La3", passaggio: "Re4", cabeza: "Sol4", hasta: "Re6" },
      { nombre: "Soprano con coloratura", color: "#b04ad0", desde: "Sol3", pecho: "La3", passaggio: "Re4", cabeza: "Sol4", hasta: "Fa6" },
    ],
  };
  const TESITURAS_MASCULINAS = {
    id: "tesituras-masculinas",
    nombre: "Tesituras masculinas",
    tipo: "tesituras",
    ancho: 1600,
    alto: 1000,
    titulo: "Tesituras masculinas",
    teclado: ["Do2", "Do6"],
    voces: [
      { nombre: "Bajo", color: "#e0303a", desde: "Do2", pecho: "Si3", passaggio: "Mi4", cabeza: "La4", hasta: "Mi5" },
      { nombre: "Barítono", color: "#f07a24", desde: "Mi2", pecho: "Re4", passaggio: "Sol4", cabeza: "Do5", hasta: "Fa5" },
      { nombre: "Tenor", color: "#e05a9a", desde: "Sol2", pecho: "Mi4", passaggio: "La4", cabeza: "Re5", hasta: "La5" },
      { nombre: "Contratenor", color: "#3fb6c6", desde: "La2", pecho: "Fa4", passaggio: "Do5", cabeza: "Fa5", hasta: "Si5" },
      { nombre: "Sopranista", color: "#b04ad0", desde: "Do3", pecho: "Fa3", passaggio: "Do4", cabeza: "Sol4", hasta: "Do6" },
    ],
  };

  const B = (nombre, detalle, termino, practicar) => ({ nombre, detalle, termino: termino || null, practicar: practicar || null });
  const CALENTAMIENTO = {
    id: "calentamiento",
    nombre: "Calentamiento vocal",
    tipo: "calentamiento",
    ancho: 1080,
    alto: 2360,
    titulo: "Calentamiento vocal",
    subtitulo: "Predisposición total del aparato fonador",
    cierre: "Crea tu propia rutina de 10 a 15 minutos combinando los ejercicios a tu gusto y necesidad",
    bloques: [
      {
        id: "cuerpo", titulo: "Cuerpo", color: "#e0303a", icono: "cuerpo",
        lema: "Liberar tensiones con ejercicios de estiramiento y activación", indicacion: "10 segundos o 10 movimientos por ejercicio",
        items: [B("Tobillos", "10 movimientos circulares en cada pie"), B("Rodillas", "10 segundos de movimientos de adelante y atrás"),
          B("Cadera", "10 movimientos circulares con buena extensión"), B("Columna", "10 segundos de bajar a tocar los pies y 10 s de vuelta"),
          B("Hombros", "10 movimientos circulares con cada hombro"), B("Brazos", "10 segundos de estiramiento con apoyo en codo"),
          B("Cuello", "10 segundos de extensión hacia izq-der-adl-atr")],
      },
      {
        id: "mente", titulo: "Mente", color: "#f07a24", icono: "mente",
        lema: "Liberar tensiones mentales con ejercicios de control y consciencia", indicacion: "Inhalar 4 segundos · Sostener 4 segundos · Exhalar 8 segundos",
        items: [B("Consciencia plena"), B("Liberar todas las preocupaciones"), B("Soltar los nervios"), B("Recobrar motivación"),
          B("Aislar malos pensamientos"), B("Sentir cada movimiento")],
      },
      {
        id: "respiracion", titulo: "Respiración", color: "#8fd14f", icono: "pulmones",
        lema: "Disponer el aparato respiratorio para cantar",
        indicacion: "Necesitarás metrónomo a 100 bpm y cronómetro (R: respiración · TS: expulsión de aire con los dientes)",
        tabla: true,
        items: [B("Disposición del aire", "Respiración baja: 1. Abdomen 2. Intercostales 3. Todo (procurar no subir hombros)", "Apoyo (appoggio)", H.aire),
          B("Conex. con diafragma", "Poner firme el diafragma para expulsar el aire (ej. al reír, o al ir al baño, pero sin tensión)", "Diafragma", H.aire),
          B("Capacidad pulmonar", "R y sostener aire tanto como se pueda, cronometrando los tiempos", null, H.aire),
          B("Resistencia", "R y TS, TS, TS, TS, TS, TS tantas veces puedas. Cronómetro y metrónomo a 100 bpm", null, H.metronomo),
          B("Oxigenación", "R, TS, R TS, R, TS tantas veces puedas. Cronómetro y metrónomo a 100 bpm", null, H.metronomo),
          B("Dosificación", "R y TSSSSSSSSSSSSSS tanto como puedas. Cronómetro", null, H.aire)],
      },
      {
        id: "resonadores", titulo: "Resonadores", color: "#3ecf6e", icono: "diapason",
        lema: "Activar resonadores principales para aumentar la proyección",
        indicacion: "Respirar como se indica en el apartado anterior. Emplear únicamente notas cómodas. Sin peso en la voz",
        items: [B("Tecleteo", "Masajes y golpecitos suaves alrededor de los resonadores faciales", "Resonancia"),
          B("Humming", "En una nota cómoda «mmmmmm»", "SOVT (tracto vocal semi-ocluido)", H.sostener),
          B("Sing's", "En una nota cómoda «Sinnnnnnnng»", null, H.sostener),
          B("Sirena", "Glissandos con la vocal «A» desde una nota baja cómoda hasta una nota alta cómoda", null, H.sirena)],
      },
      {
        id: "facial", titulo: "Musculatura facial / cuello", color: "#3f8fe0", icono: "mascara",
        lema: "Disponer la musculatura facial y del cuello para mejorar la articulación",
        indicacion: "Dejamos la «vergüenza» a un lado y podemos hacerlo frente a un espejo o con la cámara frontal del teléfono",
        items: [B("Masajes", "Realizamos un masaje cuidadoso en el rostro (estiramos, apretamos, amasamos) y en el cuello"),
          B("Rostros exagerados", "Apertura extrema, gestos teatrales, sacar la lengua, arrugar la nariz, cerrar los ojos fuertemente, sonreír mostrando los dientes"),
          B("Bostezo consciente", "Buscamos una apertura consciente. Realizamos el gesto de bostezo para que la laringe baje, la lengua abra espacio y el velo del paladar se suba")],
      },
      {
        id: "cuerdas", titulo: "Cuerdas vocales", color: "#8a5ad0", icono: "cuerdas",
        lema: "Preparar los pliegues vocales para emitir sonidos complejos",
        indicacion: "Todo debe realizarse con absoluta comodidad, cero tensión y sin peso en la voz, laringe baja y notas cómodas",
        items: [B("Vocal fry", "Generamos el sonido de voz cansada, como si acabásemos de despertar con pereza"),
          B("Lip roll", "Vibrar los labios emitiendo sonidos cómodos libremente cruzando de voz de pecho a voz de cabeza", "SOVT (tracto vocal semi-ocluido)", H.sirena),
          B("Tongue trill", "Vibrar la lengua con una «r» emitiendo sonidos cómodos libremente cruzando de voz de pecho a voz de cabeza", "SOVT (tracto vocal semi-ocluido)", H.sirena),
          B("Glissando", "Glissandos de notas muy bajas a notas muy altas cómodas, con algún tipo de oclusión. Ej: un vaso con agua y una pajilla", "SOVT (tracto vocal semi-ocluido)", H.sirena)],
      },
      {
        id: "oido", titulo: "Oído", color: "#d040a0", icono: "oreja",
        lema: "Predisponer el oído para mejorar la precisión en la afinación",
        indicacion: "Todo debe realizarse con absoluta comodidad, cero tensión y sin peso en la voz. Sílabas: Ma, Nei, Lea, Miau, Ah, Uh",
        items: [B("Escalas", "Realizamos escalas adaptadas a nuestras necesidades. Ej: escala mayor «1-2-3-4-5-4-3-2-1-5-1» o «1-3-5-8-5-3-1», entre otras", "Arpegio", H.escalas),
          B("Escucha y repite", "Escuchas una nota y su nombre y la repites, verificando con una app de afinador que la nota es precisa", "Cents", H.afinacion),
          B("Entrenamiento auditivo", "Escucha una nota, analízala y trata de decir qué nota es. Verifica con una app y, si fallas, aprende y corrige", null, H.adivina),
          B("Intervalos", "Escucha una nota y emite su armonía. Ej: suena un Do, debes emitir su tercera o su quinta", "Intervalo", H.intervalos)],
      },
    ],
  };

  window.CODEX = {
    CONTACTO,
    LAMINAS: [MACROS, COLOCACIONES, TESITURAS_FEMENINAS, TESITURAS_MASCULINAS, CALENTAMIENTO],
    ORIGINALES: {
      macros: "recursos/codex/original-macros.jpg",
      colocaciones: "recursos/codex/colocaciones.jpg",
      "tesituras-femeninas": "recursos/codex/original-tesituras-femeninas.jpg",
      "tesituras-masculinas": "recursos/codex/original-tesituras-masculinas.jpg",
      calentamiento: "recursos/codex/original-calentamiento.jpg",
    },
  };
})();
