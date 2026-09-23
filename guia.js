/*
 * guia.js — página Guía: "¿qué quieres trabajar hoy?". Un mapeo simple de
 * problemas comunes de canto a las herramientas ya construidas en el kit,
 * para que un alumno que no conoce todas las páginas sepa por dónde
 * empezar. No mide ni diagnostica nada por sí misma — solo dirige.
 */

const GUIA_PROBLEMAS = [
  {
    icono: "🎯",
    etiqueta: "Afinación: no doy con la nota exacta",
    recomendaciones: [
      {
        pagina: "piano.html",
        paginaNombre: "Solfeo",
        herramienta: "Cantar y calificar",
        razon: "El piano toca una nota y tú la cantas de vuelta; te califica en cents con una aguja de afinación en vivo.",
        modo: "individual",
      },
      {
        pagina: "oido.html",
        paginaNombre: "Oído",
        herramienta: "Adivina la nota",
        razon: "Entrena tu oído para reconocer notas antes de cantarlas, no solo después.",
        modo: "notas",
      },
    ],
  },
  {
    icono: "📏",
    etiqueta: "Rango vocal: me faltan agudos o graves",
    recomendaciones: [
      {
        pagina: "entrenamiento.html",
        paginaNombre: "Entrenamiento",
        herramienta: "Rango vocal",
        razon: "Canta de tu nota más grave a la más aguda y descubre tu tesitura actual y tu tipo de voz más cercano.",
        modo: "rango",
      },
      {
        pagina: "piano.html",
        paginaNombre: "Solfeo",
        herramienta: "Escala vocal → Voz mixta / passaggio",
        razon: "Patrones pensados específicamente para trabajar el paso de registro (passaggio).",
        modo: "escala",
      },
    ],
  },
  {
    icono: "〰️",
    etiqueta: "El sonido tiembla o no tengo vibrato",
    recomendaciones: [
      {
        pagina: "entrenamiento.html",
        paginaNombre: "Entrenamiento",
        herramienta: "Nota sostenida",
        razon: "Mide cuánto aguantas una nota y analiza en vivo la tasa y profundidad de tu vibrato.",
        modo: "sostenida",
      },
    ],
  },
  {
    icono: "🔊",
    etiqueta: "Control del volumen / dinámica",
    recomendaciones: [
      {
        pagina: "entrenamiento.html",
        paginaNombre: "Entrenamiento",
        herramienta: "Messa di voce",
        razon: "El clásico crescendo-diminuendo sostenido en una sola nota: puntúa la forma de la curva de volumen.",
        modo: "messa",
      },
    ],
  },
  {
    icono: "💨",
    etiqueta: "Aire y respiración",
    recomendaciones: [
      {
        pagina: "entrenamiento.html",
        paginaNombre: "Entrenamiento",
        herramienta: "Control de aire",
        razon: "Una \"sss\" o \"fff\" larga sin usar las cuerdas vocales: mide cuánto aguantas y qué tan constante es tu caudal de aire.",
        modo: "aire",
      },
    ],
  },
  {
    icono: "🥁",
    etiqueta: "Ritmo y oído musical",
    recomendaciones: [
      {
        pagina: "oido.html",
        paginaNombre: "Oído",
        herramienta: "Intervalos y Simon dice",
        razon: "Entrenan el reconocimiento de intervalos y la memoria auditiva directamente con el piano.",
        modo: "intervalos",
      },
      {
        pagina: "piano.html",
        paginaNombre: "Solfeo",
        herramienta: "Metrónomo",
        razon: "Practica a un tempo fijo, de 50 a 350 BPM, con la duración de las notas vinculada al tempo si quieres.",
        modo: "metronomo",
      },
    ],
  },
  {
    icono: "☀️",
    etiqueta: "Solo quiero calentar hoy",
    recomendaciones: [
      {
        pagina: "rutina.html",
        paginaNombre: "Rutina",
        herramienta: "Rutina diaria",
        razon: "Una rutina corta y distinta cada día, lista para empezar sin tener que elegir nada.",
      },
    ],
  },
];

function renderizarOpcionesGuia() {
  const cont = el("opcionesGuia");
  cont.innerHTML = "";
  GUIA_PROBLEMAS.forEach((problema) => {
    const boton = document.createElement("button");
    boton.className = "opcion-guia";
    boton.innerHTML = `<span class="opcion-guia-icono">${problema.icono}</span><span>${problema.etiqueta}</span>`;
    boton.addEventListener("click", () => mostrarRecomendacionGuia(problema));
    cont.appendChild(boton);
  });
}

function mostrarRecomendacionGuia(problema) {
  el("opcionesGuia").hidden = true;
  el("resultadoGuia").hidden = false;
  const cont = el("recomendacionesGuia");
  cont.innerHTML = "";
  problema.recomendaciones.forEach((rec) => {
    const div = document.createElement("div");
    div.className = "recomendacion";
    // `?tab=<valor>` le dice a la página destino qué pestaña abrir de
    // entrada -- cada página (piano.js/entrenamiento.js/oido.js) lo lee al
    // iniciar y llama a su propio cambiador de pestaña. Sin esto, "Ir a la
    // herramienta" siempre caía en la primera pestaña sin importar cuál
    // recomendaba esta tarjeta.
    const href = rec.modo ? `${rec.pagina}?tab=${rec.modo}` : rec.pagina;
    div.innerHTML = `
      <span class="recomendacion-pagina">${rec.paginaNombre}</span>
      <h3>${rec.herramienta}</h3>
      <p>${rec.razon}</p>
      <a class="boton principal" href="${href}">Ir a la herramienta →</a>
    `;
    cont.appendChild(div);
  });
}

function inicializarGuia() {
  renderizarOpcionesGuia();
  el("btnGuiaOtra").addEventListener("click", () => {
    el("resultadoGuia").hidden = true;
    el("opcionesGuia").hidden = false;
  });
}

document.addEventListener("DOMContentLoaded", inicializarGuia);
