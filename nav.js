/*
 * nav.js — en pantallas angostas el menú principal es una sola fila que se
 * desliza (ver style.css, @media max-width:480px), en vez de envolverse en
 * varias filas. Sin esto, la página activa podía quedar fuera de vista a la
 * derecha del todo al cargar -- el resaltado de "dónde estoy" no serviría de
 * nada si nunca se ve sin deslizar primero.
 */
function centrarEnlaceActivoNav() {
  const nav = document.querySelector(".nav-principal");
  const activo = nav ? nav.querySelector("a.activo") : null;
  if (!nav || !activo) return;
  if (nav.scrollWidth <= nav.clientWidth) return; // todo cabe: no hay nada que desplazar
  const centro = activo.offsetLeft + activo.offsetWidth / 2 - nav.clientWidth / 2;
  nav.scrollLeft = Math.max(0, centro);
}

document.addEventListener("DOMContentLoaded", centrarEnlaceActivoNav);
