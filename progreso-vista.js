/*
 * progreso-vista.js — página Progreso: muestra las tarjetas de récords
 * guardados por progreso.js (localStorage) y el botón de borrado.
 */

function renderizarProgreso() {
  const cont = el("tarjetasProgreso");
  cont.innerHTML = "";
  const agregar = (etiqueta, valor) => {
    const div = document.createElement("div");
    div.className = "tarjeta-progreso";
    div.innerHTML = `<span class="valor">${valor}</span><span class="etiqueta">${etiqueta}</span>`;
    cont.appendChild(div);
  };

  const rangoMin = Progreso.obtener("rangoMinMidi", null);
  const rangoMax = Progreso.obtener("rangoMaxMidi", null);
  agregar(
    "Rango vocal más amplio detectado",
    rangoMin !== null && rangoMax !== null ? `${midiANombre(rangoMin)} – ${midiANombre(rangoMax)}` : "—"
  );

  const sostenida = Progreso.obtener("sostenidaMejorSegundos", null);
  agregar("Mejor nota sostenida", sostenida !== null ? `${sostenida.toFixed(1)}s` : "—");

  const aire = Progreso.obtener("aireMejorSegundos", null);
  agregar("Mejor control de aire", aire !== null ? `${aire.toFixed(1)}s` : "—");

  const intAciertos = Progreso.obtener("intervalosAciertos", 0);
  const intTotal = Progreso.obtener("intervalosTotal", 0);
  agregar("Intervalos acertados", intTotal > 0 ? `${intAciertos}/${intTotal} (${Math.round((intAciertos / intTotal) * 100)}%)` : "—");

  const acAciertos = Progreso.obtener("acordesAciertos", 0);
  const acTotal = Progreso.obtener("acordesTotal", 0);
  agregar("Acordes acertados", acTotal > 0 ? `${acAciertos}/${acTotal} (${Math.round((acAciertos / acTotal) * 100)}%)` : "—");

  const notaAciertos = Progreso.obtener("notasquizAciertos", 0);
  const notaTotal = Progreso.obtener("notasquizTotal", 0);
  agregar(
    "Notas acertadas de oído",
    notaTotal > 0 ? `${notaAciertos}/${notaTotal} (${Math.round((notaAciertos / notaTotal) * 100)}%)` : "—"
  );

  const simonRecord = Progreso.obtener("simonMejorNivel", 0);
  agregar("Récord en Simon dice", simonRecord > 0 ? `Nivel ${simonRecord}` : "—");

  const rachaRutina = Progreso.obtener("rutinaRachaDias", 0);
  agregar("Racha de la rutina diaria", rachaRutina > 0 ? `${rachaRutina} día${rachaRutina === 1 ? "" : "s"} 🔥` : "—");
}

function renderizarCalendarioRacha() {
  const cont = el("calendarioRacha");
  cont.innerHTML = "";
  const historial = new Set(Progreso.obtener("rutinaHistorialFechas", []));

  const SEMANAS = 18;
  const hoy = new Date();
  const hoyIso = fechaLocalISO(hoy);
  // Ancla la última columna al domingo de la semana actual (domingo = 0).
  const finSemana = new Date(hoy);
  finSemana.setDate(finSemana.getDate() + (6 - finSemana.getDay()));
  const inicioGrid = new Date(finSemana);
  inicioGrid.setDate(inicioGrid.getDate() - (SEMANAS * 7 - 1));

  const grid = document.createElement("div");
  grid.className = "calendario-grid";
  const cursor = new Date(inicioGrid);
  for (let semana = 0; semana < SEMANAS; semana++) {
    const columna = document.createElement("div");
    columna.className = "calendario-semana";
    for (let dia = 0; dia < 7; dia++) {
      const iso = fechaLocalISO(cursor);
      const celda = document.createElement("div");
      celda.className = "calendario-dia";
      if (historial.has(iso)) celda.classList.add("completado");
      if (iso === hoyIso) celda.classList.add("hoy");
      if (cursor <= hoy) {
        celda.title = `${iso}${historial.has(iso) ? " — practicaste" : ""}`;
      } else {
        celda.style.visibility = "hidden"; // días futuros de la última semana: relleno invisible
      }
      columna.appendChild(celda);
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.appendChild(columna);
  }
  cont.appendChild(grid);

  const leyenda = document.createElement("p");
  leyenda.className = "calendario-leyenda";
  leyenda.textContent =
    historial.size > 0
      ? "Cada cuadro es un día — en rojo, los días que completaste la rutina."
      : "Completa la rutina diaria en la página Rutina para empezar a llenar este calendario.";
  cont.appendChild(leyenda);
}

// --- Insignias / logros -----------------------------------------------------

const LOGROS = [
  {
    icono: "🔥",
    nombre: "Primera racha",
    descripcion: "Completa la rutina diaria un día.",
    cumplido: (d) => (d.rutinaRachaDias || 0) >= 1,
  },
  {
    icono: "🔥",
    nombre: "Una semana seguida",
    descripcion: "Completa la rutina diaria 7 días seguidos.",
    cumplido: (d) => (d.rutinaRachaDias || 0) >= 7,
  },
  {
    icono: "🔥",
    nombre: "Un mes seguido",
    descripcion: "Completa la rutina diaria 30 días seguidos.",
    cumplido: (d) => (d.rutinaRachaDias || 0) >= 30,
  },
  {
    icono: "👂",
    nombre: "Oído entrenado",
    descripcion: "Responde 50 preguntas entre Intervalos, Acordes y Adivina la nota.",
    cumplido: (d) => (d.intervalosTotal || 0) + (d.acordesTotal || 0) + (d.notasquizTotal || 0) >= 50,
  },
  {
    icono: "🎯",
    nombre: "Precisión de oro",
    descripcion: "Al menos 20 preguntas de oído respondidas con 80% de aciertos o más.",
    cumplido: (d) => {
      const total = (d.intervalosTotal || 0) + (d.acordesTotal || 0) + (d.notasquizTotal || 0);
      const aciertos = (d.intervalosAciertos || 0) + (d.acordesAciertos || 0) + (d.notasquizAciertos || 0);
      return total >= 20 && aciertos / total >= 0.8;
    },
  },
  {
    icono: "💨",
    nombre: "Pulmones de acero",
    descripcion: "Aguanta 20 segundos en Control de aire.",
    cumplido: (d) => (d.aireMejorSegundos || 0) >= 20,
  },
  {
    icono: "🎵",
    nombre: "Fiato largo",
    descripcion: "Sostén una nota 15 segundos.",
    cumplido: (d) => (d.sostenidaMejorSegundos || 0) >= 15,
  },
  {
    icono: "📏",
    nombre: "Rango amplio",
    descripcion: "Detecta un rango vocal de 2 octavas (24 semitonos) o más.",
    cumplido: (d) => d.rangoMinMidi != null && d.rangoMaxMidi != null && d.rangoMaxMidi - d.rangoMinMidi >= 24,
  },
  {
    icono: "🧠",
    nombre: "Memoria de Simon",
    descripcion: "Llega al nivel 10 en Simon dice.",
    cumplido: (d) => (d.simonMejorNivel || 0) >= 10,
  },
  {
    icono: "🗺️",
    nombre: "Explorador",
    descripcion: "Usa Piano, Entrenamiento, Oído y Rutina al menos una vez cada una.",
    cumplido: (d) => (d.herramientasUsadas || []).length >= 4,
  },
  {
    icono: "📈",
    nombre: "Persistente",
    descripcion: "Completa la rutina diaria 20 días distintos (no hace falta que sean seguidos).",
    cumplido: (d) => (d.rutinaHistorialFechas || []).length >= 20,
  },
];

function renderizarLogros() {
  const cont = el("logrosLista");
  cont.innerHTML = "";
  const datos = Progreso.cargar();
  LOGROS.forEach((logro) => {
    const conseguido = logro.cumplido(datos);
    const div = document.createElement("div");
    div.className = "logro" + (conseguido ? " conseguido" : "");
    div.title = logro.descripcion;
    div.innerHTML = `<span class="logro-icono">${logro.icono}</span><span class="logro-nombre">${logro.nombre}</span>`;
    cont.appendChild(div);
  });
}

// --- Tarjeta de progreso compartible (imagen PNG) --------------------------

function redondearRectangulo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function envolverTexto(ctx, texto, x, y, anchoMaximo, alturaLinea) {
  const palabras = texto.split(" ");
  let linea = "";
  let cursorY = y;
  for (const palabra of palabras) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (linea && ctx.measureText(prueba).width > anchoMaximo) {
      ctx.fillText(linea, x, cursorY);
      linea = palabra;
      cursorY += alturaLinea;
    } else {
      linea = prueba;
    }
  }
  if (linea) ctx.fillText(linea, x, cursorY);
}

async function generarTarjetaProgreso() {
  const ancho = 1000;
  const alto = 640;
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");

  try {
    await Promise.all([
      document.fonts.load('600 44px "Cormorant Garamond"'),
      document.fonts.load('700 32px "Work Sans"'),
      document.fonts.load('500 20px "Work Sans"'),
    ]);
  } catch {
    // si las fuentes tardan en cargar, se dibuja igual con la fuente de
    // respaldo del sistema — no es un error crítico para una imagen
  }

  const degradado = ctx.createLinearGradient(0, 0, ancho, alto);
  degradado.addColorStop(0, "#120e0e");
  degradado.addColorStop(1, "#0a0808");
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.strokeStyle = "#282020";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, ancho - 2, alto - 2);

  ctx.fillStyle = "#ede7e1";
  ctx.font = '600 44px "Cormorant Garamond", Georgia, serif';
  ctx.fillText("🎤 Áleran Vocals", 50, 82);

  const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  ctx.fillStyle = "#8a8078";
  ctx.font = '500 20px "Work Sans", sans-serif';
  ctx.fillText(`Mi progreso · ${fecha}`, 50, 116);

  ctx.strokeStyle = "#282020";
  ctx.beginPath();
  ctx.moveTo(50, 146);
  ctx.lineTo(ancho - 50, 146);
  ctx.stroke();

  const rangoMin = Progreso.obtener("rangoMinMidi", null);
  const rangoMax = Progreso.obtener("rangoMaxMidi", null);
  const sostenida = Progreso.obtener("sostenidaMejorSegundos", null);
  const aire = Progreso.obtener("aireMejorSegundos", null);
  const intAciertos = Progreso.obtener("intervalosAciertos", 0);
  const intTotal = Progreso.obtener("intervalosTotal", 0);
  const notaAciertos = Progreso.obtener("notasquizAciertos", 0);
  const notaTotal = Progreso.obtener("notasquizTotal", 0);
  const racha = Progreso.obtener("rutinaRachaDias", 0);

  const tarjetas = [
    {
      valor: rangoMin !== null && rangoMax !== null ? `${midiANombre(rangoMin)}–${midiANombre(rangoMax)}` : "—",
      etiqueta: "Rango vocal más amplio",
    },
    { valor: sostenida !== null ? `${sostenida.toFixed(1)}s` : "—", etiqueta: "Mejor nota sostenida" },
    { valor: aire !== null ? `${aire.toFixed(1)}s` : "—", etiqueta: "Mejor control de aire" },
    {
      valor: intTotal > 0 ? `${Math.round((intAciertos / intTotal) * 100)}%` : "—",
      etiqueta: "Aciertos en intervalos",
    },
    {
      valor: notaTotal > 0 ? `${Math.round((notaAciertos / notaTotal) * 100)}%` : "—",
      etiqueta: "Aciertos de oído",
    },
    { valor: racha > 0 ? `${racha} día${racha === 1 ? "" : "s"} 🔥` : "—", etiqueta: "Racha de rutina diaria" },
  ];

  const columnas = 3;
  const margen = 50;
  const espacio = 24;
  const anchoTarjeta = (ancho - margen * 2 - espacio * (columnas - 1)) / columnas;
  const altoTarjeta = 150;
  const filaY0 = 186;

  tarjetas.forEach((t, i) => {
    const col = i % columnas;
    const fila = Math.floor(i / columnas);
    const x = margen + col * (anchoTarjeta + espacio);
    const y = filaY0 + fila * (altoTarjeta + espacio);

    ctx.fillStyle = "#1a1414";
    redondearRectangulo(ctx, x, y, anchoTarjeta, altoTarjeta, 12);
    ctx.fill();
    ctx.strokeStyle = "#282020";
    ctx.lineWidth = 1;
    redondearRectangulo(ctx, x, y, anchoTarjeta, altoTarjeta, 12);
    ctx.stroke();

    ctx.fillStyle = "#ede7e1";
    ctx.font = '700 32px "Work Sans", sans-serif';
    ctx.fillText(t.valor, x + 22, y + 60);

    ctx.fillStyle = "#8a8078";
    ctx.font = '500 16px "Work Sans", sans-serif';
    envolverTexto(ctx, t.etiqueta, x + 22, y + 96, anchoTarjeta - 44, 21);
  });

  ctx.fillStyle = "#8a8078";
  ctx.font = '400 15px "Work Sans", sans-serif';
  ctx.fillText("Hecho con el kit de práctica vocal de Áleran Vocals", 50, alto - 28);

  return canvas;
}

async function descargarTarjetaProgreso() {
  const boton = el("btnProgresoCompartir");
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Generando…";
  try {
    const canvas = await generarTarjetaProgreso();
    await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `aleran-vocals-progreso-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        resolve();
      }, "image/png");
    });
  } catch {
    // Falló la generación de la imagen (navegador muy antiguo, sin soporte
    // de canvas...); no hay nada más que intentar aquí.
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

function inicializarProgreso() {
  renderizarProgreso();
  renderizarCalendarioRacha();
  renderizarLogros();
  el("btnProgresoCompartir").addEventListener("click", descargarTarjetaProgreso);
  el("btnProgresoReiniciar").addEventListener("click", () => {
    if (!confirm("¿Borrar todos tus récords guardados en este navegador? No se puede deshacer.")) return;
    Progreso.reiniciar();
    renderizarProgreso();
    renderizarCalendarioRacha();
    renderizarLogros();
  });
}

document.addEventListener("DOMContentLoaded", inicializarProgreso);
