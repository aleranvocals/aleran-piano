/*
 * catalogo.js — página Catálogo: navega las 25+ escalas/patrones vocales
 * de escalas.js y escúchalas directamente, sin tener que configurar nada
 * en Piano primero. Todas se tocan desde la misma tónica fija (Do3) para
 * que sea fácil comparar unas con otras.
 */

const CATALOGO_TONICA = "Do3";
let catalogoReproduciendo = null;

function renderizarCatalogo() {
  const cont = el("catalogoLista");
  cont.innerHTML = "";
  const gruposPorCategoria = {};
  for (const [clave, patron] of Object.entries(PATRONES)) {
    const categoria = patron.categoria || "otras";
    if (!gruposPorCategoria[categoria]) gruposPorCategoria[categoria] = [];
    gruposPorCategoria[categoria].push([clave, patron]);
  }

  for (const [categoria, patrones] of Object.entries(gruposPorCategoria)) {
    const tituloCategoria = document.createElement("h2");
    tituloCategoria.className = "titulo-seccion";
    tituloCategoria.textContent = CATEGORIAS[categoria] || categoria;
    cont.appendChild(tituloCategoria);

    patrones.forEach(([clave, patron]) => {
      const fila = document.createElement("div");
      fila.className = "catalogo-item";
      const tecnicas = patron.tecnicas.map((t) => t.replace(/_/g, " ")).join(", ");
      const info = document.createElement("div");
      info.className = "catalogo-info";
      info.innerHTML = `<span class="catalogo-nombre">${patron.nombre}</span><span class="catalogo-detalle">${patron.descripcion} (técnicas: ${tecnicas})</span>`;

      const boton = document.createElement("button");
      boton.className = "boton";
      boton.textContent = "▶ Escuchar";
      boton.addEventListener("click", () => reproducirPatronCatalogo(clave, patron, boton));

      fila.append(info, boton);
      cont.appendChild(fila);
    });
  }
}

async function reproducirPatronCatalogo(clave, patron, boton) {
  if (!window.PianoEngine) {
    el("estadoCatalogo").textContent = "El piano todavía se está inicializando, espera un segundo…";
    return;
  }
  if (catalogoReproduciendo) return; // ya suena algo: ignora el clic hasta que termine
  let resultado;
  try {
    resultado = eventosModoEscala({
      voz: "tenor",
      patron: clave,
      notaInicial: CATALOGO_TONICA,
      pasoSemitonos: 1,
      soloSubida: false,
      duracionNota: 0.35,
      pausa: 0.08,
    });
  } catch (err) {
    el("estadoCatalogo").textContent = err.message;
    return;
  }
  catalogoReproduciendo = clave;
  boton.disabled = true;
  el("estadoCatalogo").textContent = `▶ ${patron.nombre}`;
  await window.PianoEngine.reproducirSecuencia(resultado.eventos, 0.85, {
    onNotaInicio: (midi) => marcarTeclaActiva(midi, true),
    onNotaFin: (midi) => marcarTeclaActiva(midi, false),
    onTerminar: () => {
      el("estadoCatalogo").textContent = "";
    },
  });
  catalogoReproduciendo = null;
  boton.disabled = false;
}

function inicializarCatalogo() {
  inicializarPiano(); // teclado.js: sin callback propio, tocar una tecla solo la previsualiza
  renderizarCatalogo();
}

document.addEventListener("DOMContentLoaded", inicializarCatalogo);
