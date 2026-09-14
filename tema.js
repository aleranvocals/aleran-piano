/*
 * tema.js — modo claro/oscuro para todo el sitio. Por defecto oscuro (la
 * identidad original de Áleran Vocals); el alumno puede cambiarlo con el
 * botón de la barra de navegación y se recuerda en este navegador.
 *
 * La detección y aplicación del tema guardado ocurre en un <script> muy
 * pequeño en el <head> de cada página (antes de este archivo, antes de
 * pintar nada) para que no haya parpadeo de "oscuro y luego claro" al
 * cargar. Este archivo solo añade el botón y el clic para cambiarlo.
 */

const TEMA_CLAVE = "aleran-piano-tema";

function temaActual() {
  return document.documentElement.getAttribute("data-tema") === "claro" ? "claro" : "oscuro";
}

function aplicarTema(tema) {
  if (tema === "claro") {
    document.documentElement.setAttribute("data-tema", "claro");
  } else {
    document.documentElement.removeAttribute("data-tema");
  }
  try {
    localStorage.setItem(TEMA_CLAVE, tema);
  } catch {
    // almacenamiento no disponible (modo privado, cuota llena...): el tema
    // igual se aplica para esta visita, solo no se recuerda para la próxima
  }
  actualizarBotonTema();
}

function actualizarBotonTema() {
  const boton = document.getElementById("btnTema");
  if (!boton) return;
  const claro = temaActual() === "claro";
  boton.textContent = claro ? "🌙" : "☀️";
  boton.title = claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro";
  boton.setAttribute("aria-label", boton.title);
}

function inicializarTema() {
  const cabecera = document.querySelector(".cabecera");
  if (!cabecera) return;
  const boton = document.createElement("button");
  boton.id = "btnTema";
  boton.type = "button";
  boton.className = "boton-tema";
  boton.addEventListener("click", () => aplicarTema(temaActual() === "claro" ? "oscuro" : "claro"));
  cabecera.appendChild(boton);
  actualizarBotonTema();
}

document.addEventListener("DOMContentLoaded", inicializarTema);
