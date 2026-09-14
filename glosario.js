/*
 * glosario.js — página Glosario: términos de técnica vocal explicados en
 * lenguaje llano, con un buscador simple. Contenido puramente de
 * referencia, no depende de ningún motor de audio.
 */

const GLOSARIO_TERMINOS = [
  {
    termino: "Apoyo (appoggio)",
    definicion:
      "El control de la respiración que sostiene el sonido sin tensión en la garganta — la sensación de que el aire \"empuja desde abajo\" (diafragma y abdomen) en vez de la garganta empujando hacia afuera.",
  },
  {
    termino: "Passaggio",
    definicion:
      "La zona de transición entre el registro de pecho y el de cabeza, donde la voz tiende a \"romperse\" si no se maneja con cuidado. Cada tipo de voz lo tiene en una altura distinta.",
  },
  {
    termino: "Registro de pecho (chest voice)",
    definicion: "El registro vocal más grave y \"pesado\", con más vibración sentida en el pecho.",
  },
  {
    termino: "Registro de cabeza (head voice)",
    definicion: "El registro más agudo y ligero, con más resonancia sentida en la cabeza y la cara.",
  },
  {
    termino: "Voz mixta (mixed voice)",
    definicion:
      "Una combinación equilibrada de registro de pecho y de cabeza, usada para cruzar el passaggio sin que el sonido se rompa ni se sienta forzado.",
  },
  {
    termino: "Belting",
    definicion:
      "Técnica de cantar notas agudas con la intensidad y el color del registro de pecho llevado más alto de lo habitual. Requiere buen apoyo para no forzar la garganta.",
  },
  {
    termino: "Twang",
    definicion:
      "Un ajuste del tracto vocal (un ligero estrechamiento cerca de la epiglotis) que da un sonido brillante y proyectado, muy usado en musical theatre y en pop.",
  },
  {
    termino: "Formante del cantante (singer's formant)",
    definicion:
      "Un refuerzo acústico natural entre 2.5 y 3.5 kHz que permite a una voz entrenada destacar sobre una orquesta sin necesidad de cantar más fuerte. Es lo que mide, de forma aproximada, el \"índice de brillo\" del Espectro en vivo.",
  },
  {
    termino: "Vibrato",
    definicion:
      "La oscilación regular y natural del tono (normalmente entre 4.5 y 7 Hz) que le da calidez y viveza a una nota sostenida. Se puede medir en la herramienta \"Nota sostenida\".",
  },
  {
    termino: "Messa di voce",
    definicion:
      "Un crescendo-diminuendo controlado sobre una sola nota sostenida — subir el volumen y volver a bajarlo sin cambiar de nota ni de respiración. Un clásico ejercicio de control de aire y dinámica.",
  },
  {
    termino: "Tesitura (rango cómodo)",
    definicion:
      "El rango de notas en el que una voz suena más cómoda y con mejor calidad — distinto del rango extremo que se puede alcanzar forzando un poco.",
  },
  {
    termino: "Fach",
    definicion:
      "Sistema de clasificación de voces (usado sobre todo en ópera) según el color, el peso y el rango — por ejemplo \"soprano lírica\" o \"bajo profundo\".",
  },
  {
    termino: "Legato",
    definicion: "Cantar conectando las notas entre sí, sin cortes ni separaciones audibles.",
  },
  {
    termino: "Staccato",
    definicion: "Lo opuesto a legato: notas separadas y cortas, cada una claramente independiente.",
  },
  {
    termino: "Solfeo (do movible)",
    definicion:
      "Sistema de sílabas (Do, Re, Mi...) para cantar y reconocer los grados de una escala, sin importar en qué tonalidad real esté sonando. Se practica en la pestaña \"Solfeo\" de Piano.",
  },
  {
    termino: "SOVT (tracto vocal semi-ocluido)",
    definicion:
      "Ejercicios como el trino de labios o la pajita (straw phonation) que crean una pequeña resistencia en la boca, ayudando a las cuerdas vocales a vibrar de forma más eficiente con menos esfuerzo. Muy usados para calentar y para enfriar la voz.",
  },
  {
    termino: "Resonancia",
    definicion:
      "La amplificación y coloración natural del sonido al vibrar dentro de las cavidades del tracto vocal: garganta, boca y cavidades nasales.",
  },
  {
    termino: "Nasalidad",
    definicion:
      "Cuando parte del sonido escapa por la nariz. En exceso puede sonar \"gangoso\", pero un poco de resonancia nasal es normal y no es ningún defecto.",
  },
  {
    termino: "Ataque vocal",
    definicion:
      "Cómo empieza el sonido de una nota: aspirado (suave, con algo de aire antes del tono), duro (un golpe seco de las cuerdas vocales), o equilibrado — el más saludable en la mayoría de los estilos.",
  },
  {
    termino: "Melisma / riff / run",
    definicion:
      "Cantar varias notas distintas sobre una sola sílaba, típico del gospel, el R&B y el pop. Requiere buen control de aire y agilidad vocal.",
  },
  {
    termino: "Cents",
    definicion:
      "Unidad de medida de afinación: 100 cents equivalen a un semitono. Se usa para medir qué tan cerca o lejos está una nota de su afinación exacta — es lo que califica \"Cantar y calificar\".",
  },
  {
    termino: "Intervalo",
    definicion:
      "La distancia entre dos notas, medida en tonos y semitonos — por ejemplo, una 3ª mayor o una 5ª justa. Se entrena en la herramienta \"Intervalos\" de Oído.",
  },
  {
    termino: "Arpegio",
    definicion: "Las notas de un acorde cantadas o tocadas una tras otra, en vez de todas juntas al mismo tiempo.",
  },
  {
    termino: "Modo griego",
    definicion:
      "Cada una de las 7 escalas que resultan de empezar una escala mayor desde un grado distinto (dórico, frigio, lidio, mixolidio, locrio...), cada una con un color y una sensación característicos.",
  },
  {
    termino: "Diafragma",
    definicion:
      "El músculo principal de la respiración, ubicado debajo de los pulmones. Su control consciente es la base del \"apoyo\" al cantar.",
  },
  {
    termino: "Adornos vocales (ornamentos)",
    definicion:
      "Variaciones melódicas breves (mordentes, grupetos, deslizamientos, notas de paso) que decoran una nota o frase sin cambiar la melodía principal — dan personalidad a una interpretación.",
    // TODO: pega aquí el link real del reel de Instagram sobre este tema
    // (Áleran lo mencionó como ejemplo del término con más vídeo asociado)
    // y aparecerá automáticamente el botón "Ver ejemplo en Instagram" abajo.
    instagram: null,
  },
];

/** Algunos términos tienen un reel de Instagram con un ejemplo real -- se
 * confirma antes de salir de la app, en vez de abrirlo directo. */
function abrirEjemploInstagram(url) {
  if (confirm("Vas a salir de esta página para ver el ejemplo en Instagram. ¿Continuar?")) {
    window.open(url, "_blank", "noopener");
  }
}

function renderizarGlosario(filtro) {
  const cont = el("glosarioLista");
  cont.innerHTML = "";
  const texto = (filtro || "").trim().toLowerCase();
  const terminos = GLOSARIO_TERMINOS.filter(
    (t) => !texto || t.termino.toLowerCase().includes(texto) || t.definicion.toLowerCase().includes(texto)
  );
  if (terminos.length === 0) {
    cont.innerHTML = '<p class="descripcion">Ningún término coincide con esa búsqueda.</p>';
    return;
  }
  terminos.forEach((t) => {
    const div = document.createElement("div");
    div.className = "glosario-termino";
    div.innerHTML = `<h3>${t.termino}</h3><p>${t.definicion}</p>`;
    if (t.instagram) {
      const btn = document.createElement("button");
      btn.className = "boton glosario-instagram";
      btn.textContent = "▶ Ver ejemplo en Instagram";
      btn.addEventListener("click", () => abrirEjemploInstagram(t.instagram));
      div.appendChild(btn);
    }
    cont.appendChild(div);
  });
}

function inicializarGlosario() {
  renderizarGlosario("");
  el("glosarioFiltro").addEventListener("input", (e) => renderizarGlosario(e.target.value));
}

document.addEventListener("DOMContentLoaded", inicializarGlosario);
