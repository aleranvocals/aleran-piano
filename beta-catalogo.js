/* beta-catalogo.js — lista única de las «Herramientas beta». Alimenta el hub (beta.html) y el enlace por clase.
 * Si una herramienta cambia de nombre o de página, se cambia SOLO aquí (y en gen_beta_clases.py del curso). */
window.HERRAMIENTAS_BETA = [
  { id: "semaforo", nombre: "Semáforo vocal", icono: "🚦", detalle: "Tres preguntas antes de practicar", href: "semaforo.html", clases: ["C012"] },
  { id: "respiracion", nombre: "Respiración guiada", icono: "🫁", detalle: "Un círculo que entra y sale", href: "respiracion.html", clases: ["C016"] },
  { id: "color", nombre: "Medidor de color", icono: "🌈", detalle: "¿Más clara u oscura que tu voz central?", href: "color.html", clases: ["C030", "C031", "C036", "C037", "C038", "C041", "C086"] },
  { id: "proyeccion", nombre: "Medidor de proyección", icono: "📐", detalle: "Presencia sin subir el volumen", href: "color.html?vista=presencia", clases: ["C051", "C093"] },
  { id: "tremolo", nombre: "Medidor de trémolo", icono: "📳", detalle: "Trémolo o vibrato", href: "tremolo.html", clases: ["C077"] },
  { id: "aire", nombre: "Aire en la voz", icono: "💧", detalle: "Cuánto soplo suena sobre la nota", href: "aire.html", clases: ["C047"] },
  { id: "capas", nombre: "Escucha con las cuatro capas", icono: "🔬", detalle: "Mecanismo, colocación, adornos, efectos", href: "capas.html", clases: ["C081", "C083"] },
  { id: "revision", nombre: "Lista de revisión", icono: "🪞", detalle: "Cinco preguntas sobre tu toma", href: "revision.html", clases: ["C094"] },
  { id: "transportador", nombre: "Transportador", icono: "🔼", detalle: "Sube o baja tu canción medio tono", href: "transportador.html", clases: ["C092"] },
  { id: "horario", nombre: "Horario de práctica", icono: "🗓", detalle: "Días, 20 minutos y 4 semanas", href: "horario.html", clases: ["C005", "C097", "C099"] },
  { id: "efectos", nombre: "Adivina el efecto", icono: "🎭", detalle: "Reconoce cinco efectos de oído", href: "efectos.html", clases: ["C043"] },
];
