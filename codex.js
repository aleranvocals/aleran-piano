/* codex.js — el Codex: las infografías pedagógicas de Áleran como láminas HTML (22/10/2026).
 * Cada lámina se dibuja a partir de codex-datos.js, a su tamaño real (1080×1350, 1600×1000…) y escalada a la pantalla.
 * Modo «Ver»: tocar un término abre su definición del Glosario y el botón para practicarlo; en las tesituras,
 * tocar una voz la hace sonar. Modo «Editar»: los textos se cambian en la propia lámina y se guardan en este
 * navegador. Exporta la lámina a PNG (a doble resolución, para imprimir) y un carrusel de Instagram (1080×1350
 * por diapositiva, en un .zip). */
(function () {
  "use strict";
  const { LAMINAS, CONTACTO, ORIGINALES } = window.CODEX;
  const CLAVE_EDICIONES = "aleran-codex-ediciones-v1";
  const NOMBRES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  const VERDE_CABEZA = "#6fdc4a";

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ------------------------------------------------------------------ ediciones guardadas (este navegador)
  function leerEdiciones() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_EDICIONES) || "{}") || {};
    } catch {
      return {};
    }
  }
  function guardarEdicion(laminaId, k, texto) {
    const todo = leerEdiciones();
    todo[laminaId] = todo[laminaId] || {};
    todo[laminaId][k] = texto;
    try {
      localStorage.setItem(CLAVE_EDICIONES, JSON.stringify(todo));
    } catch {
      /* sin almacenamiento: la edición vale hasta recargar */
    }
  }
  function borrarEdiciones(laminaId) {
    const todo = leerEdiciones();
    delete todo[laminaId];
    try {
      localStorage.setItem(CLAVE_EDICIONES, JSON.stringify(todo));
    } catch {
      /* nada que borrar */
    }
  }

  // ------------------------------------------------------------------ términos tocables
  let terminos = [];
  /** Texto editable (data-k) y, si tiene término o herramienta, tocable en modo «Ver» (data-t). */
  function txt(k, texto, item, etiqueta = "span", clase = "") {
    let t = "";
    if (item && (item.termino || item.practicar)) {
      terminos.push(item);
      t = ` data-t="${terminos.length - 1}"`;
    }
    return `<${etiqueta} class="${clase}${t ? " tocable" : ""}" data-k="${esc(k)}"${t}>${esc(texto)}</${etiqueta}>`;
  }

  // ------------------------------------------------------------------ iconos de línea de las láminas
  const ICONOS = {
    micro: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    cabeza: '<path d="M8 21v-3a6 6 0 1 1 8-5.5L18 15h-2v3h-3v3"/><path d="M3 9a9 9 0 0 1 2-4M1 10a12 12 0 0 1 2-6" opacity=".7"/>',
    nota: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    rayo: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    cuerpo: '<circle cx="12" cy="4" r="2"/><path d="M4 8h16M12 8v7M8 22l4-7 4 7"/>',
    mente: '<path d="M9 21v-3a7 7 0 1 1 7-1v4"/><path d="M10 9h4M12 7v4"/>',
    pulmones: '<path d="M12 3v8M12 11c-2 0-3-2-5-2-2 0-4 4-4 8 0 2 1 3 3 3 3 0 4-2 6-5M12 11c2 0 3-2 5-2 2 0 4 4 4 8 0 2-1 3-3 3-3 0-4-2-6-5"/>',
    diapason: '<path d="M9 3v7a3 3 0 0 0 6 0V3M12 13v8"/><path d="M4 8a6 6 0 0 0 0 6M20 8a6 6 0 0 1 0 6" opacity=".7"/>',
    mascara: '<path d="M4 5c5-2 11-2 16 0 0 9-3 15-8 15S4 14 4 5z"/><path d="M8 10h2M14 10h2M9 15c2 1.5 4 1.5 6 0"/>',
    cuerdas: '<path d="M7 3v18M17 3v18M7 7l5 5 5-5M7 17l5-5 5 5"/>',
    oreja: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M10 9a2 2 0 0 1 4 0"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z"/>',
  };
  const icono = (id, tam = 24, color = "currentColor") =>
    `<svg class="cx-ico" viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONOS[id] || ""}</svg>`;

  const pie = (estrecho) => `
    <div class="cx-pie${estrecho ? " estrecho" : ""}">
      <img src="recursos/codex/logo-aleran.png" alt="Áleran" class="cx-logo" />
      <span class="cx-contacto">${icono("whatsapp", 26, "#3ecf6e")} ${esc(CONTACTO.whatsapp)}</span>
      <span class="cx-usuario">@${esc(CONTACTO.usuario)}</span>
    </div>`;

  // ------------------------------------------------------------------ notas → teclado
  function nombreAMidi(n) {
    const m = /^(Do|Re|Mi|Fa|Sol|La|Si)(#?)(-?\d)$/.exec(n);
    if (!m) return null;
    const base = { Do: 0, Re: 2, Mi: 4, Fa: 5, Sol: 7, La: 9, Si: 11 }[m[1]];
    return 12 * (parseInt(m[3], 10) + 1) + base + (m[2] ? 1 : 0);
  }
  const esNegra = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

  // ------------------------------------------------------------------ lámina: Control total de la voz
  function rueda(l, cx, cy, rExt, rInt) {
    const n = l.rueda.length;
    let s = "";
    l.rueda.forEach((item, i) => {
      const a0 = (-90 + (360 / n) * i + 2) * (Math.PI / 180);
      const a1 = (-90 + (360 / n) * (i + 1) - 2) * (Math.PI / 180);
      const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
      s += `<path d="M ${p(rInt, a0)} L ${p(rExt, a0)} A ${rExt} ${rExt} 0 0 1 ${p(rExt, a1)} L ${p(rInt, a1)} A ${rInt} ${rInt} 0 0 0 ${p(rInt, a0)} Z" class="cx-sector"/>`;
      const am = (a0 + a1) / 2;
      const rm = (rExt + rInt) / 2;
      const giro = (am * 180) / Math.PI + 90;
      const derecho = giro > 90 && giro < 270 ? giro + 180 : giro;
      const ancho = Math.max(170, (rExt - rInt) * 1.6);
      s += `<foreignObject x="${cx + rm * Math.cos(am) - ancho / 2}" y="${cy + rm * Math.sin(am) - 18}" width="${ancho}" height="36" transform="rotate(${derecho.toFixed(1)} ${cx + rm * Math.cos(am)} ${cy + rm * Math.sin(am)})">${txt(`rueda.${i}`, item.nombre, item, "div", "cx-sector-txt")}</foreignObject>`;
    });
    return `<svg class="cx-rueda" viewBox="0 0 ${cx * 2} ${cy * 2}" width="${cx * 2}" height="${cy * 2}">
      <defs><radialGradient id="cxBrillo"><stop offset="0" stop-color="#3a1418"/><stop offset="1" stop-color="#120909"/></radialGradient></defs>
      ${s}
      <circle cx="${cx}" cy="${cy}" r="${rInt - 10}" fill="url(#cxBrillo)" stroke="#f07a24" stroke-width="3" class="cx-centro"/>
      <foreignObject x="${cx - rInt - 20}" y="${cy - 34}" width="${rInt * 2 + 40}" height="68">${txt("centro", l.centro, null, "div", "cx-centro-txt")}</foreignObject>
    </svg>`;
  }

  function caja(c, x, y, w, h, extra = "") {
    return `<div class="cx-caja" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;--c:${c.color}${extra}">
      <h3 style="color:${c.color}">${txt(`caja.${c.id}.titulo`, c.titulo)}</h3>
      <div class="cx-caja-ico">${icono(c.icono, 64, c.color)}</div>
      <ul>${c.items.map((it, i) => `<li>${txt(`caja.${c.id}.${i}`, it.nombre, it)}</li>`).join("")}</ul>
      ${c.nota ? `<small>${txt(`caja.${c.id}.nota`, c.nota)}</small>` : ""}
    </div>`;
  }

  function laminaMacros(l) {
    const [mec, col, ado, efe, cui] = l.cajas;
    return `
      <div class="cx-fondo rayos"></div>
      <header class="cx-cabecera"><h1>${txt("titulo", l.titulo, null, "span", "cx-titulo-metal")}</h1>
        <img src="recursos/codex/emblema-an.png" alt="" class="cx-emblema" /></header>
      <h2 class="cx-subtitulo">${txt("subtitulo", l.subtitulo)}</h2>
      ${caja(mec, 40, 350, 300, 470)}
      ${caja(col, 740, 350, 300, 470)}
      <div class="cx-rueda-pos" style="left:340px;top:420px">${rueda(l, 200, 200, 196, 96)}</div>
      ${caja(ado, 40, 850, 300, 380)}
      ${caja(efe, 740, 850, 300, 380)}
      ${caja(cui, 375, 1000, 330, 230)}
      ${pie(true)}`;
  }

  // ------------------------------------------------------------------ lámina: imagen con zonas (Colocaciones)
  function laminaImagen(l) {
    return `<img src="${esc(l.imagen)}" alt="${esc(l.nombre)}" class="cx-imagen" />
      ${l.zonas.map((z) => {
        terminos.push(z);
        return `<button type="button" class="cx-zona tocable" data-t="${terminos.length - 1}" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%" aria-label="${esc(z.nombre)}"></button>`;
      }).join("")}`;
  }

  // ------------------------------------------------------------------ lámina: tesituras (dibujadas desde las notas)
  function laminaTesituras(l) {
    const lo = nombreAMidi(l.teclado[0]);
    const hi = nombreAMidi(l.teclado[1]);
    const blancas = [];
    for (let m = lo; m <= hi; m++) if (!esNegra(m)) blancas.push(m);
    const X0 = 380;
    const ANCHO = 1180;
    const kw = ANCHO / blancas.length;
    const Y0 = 300;
    const FILA = 78;
    const ALTO = l.voces.length * FILA + 40;
    const idx = (m) => blancas.indexOf(esNegra(m) ? m - 1 : m) + (esNegra(m) ? 0.65 : 0);
    const izq = (m) => X0 + idx(m) * kw;
    const der = (m) => X0 + idx(m) * kw + (esNegra(m) ? kw * 0.7 : kw);
    let teclas = blancas.map((m, i) => `<rect x="${X0 + i * kw}" y="${Y0}" width="${kw - 1.5}" height="${ALTO}" class="cx-blanca"/>`).join("");
    for (let m = lo; m <= hi; m++) {
      if (esNegra(m)) teclas += `<rect x="${izq(m)}" y="${Y0}" width="${kw * 0.7}" height="${ALTO * 0.6}" class="cx-negra"/>`;
    }
    const etiquetas = blancas.filter((m) => m % 12 === 0).map((m) => `<text x="${izq(m) + kw / 2}" y="${Y0 + ALTO + 30}" class="cx-tecla-txt">Do${Math.floor(m / 12) - 1}</text>`).join("");
    const barras = l.voces.map((v, i) => {
      const y = Y0 + 22 + i * FILA;
      const [d, p, pa, c, h] = [v.desde, v.pecho, v.passaggio, v.cabeza, v.hasta].map(nombreAMidi);
      const gid = `gp${l.id}${i}`;
      const xPecho = der(p);
      const xCabeza = izq(c);
      const xPas = izq(pa) + (esNegra(pa) ? kw * 0.35 : kw / 2);
      return `<g class="cx-voz" data-voz="${i}">
        <defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0" stop-color="${v.color}" stop-opacity=".75"/><stop offset=".5" stop-color="#c9c4c0" stop-opacity=".55"/><stop offset="1" stop-color="${VERDE_CABEZA}" stop-opacity=".65"/></linearGradient></defs>
        <rect x="${izq(d)}" y="${y}" width="${xPecho - izq(d)}" height="40" fill="${v.color}" fill-opacity=".72" stroke="${v.color}" stroke-width="2"/>
        <rect x="${xPecho}" y="${y}" width="${Math.max(0, xCabeza - xPecho)}" height="40" fill="url(#${gid})" stroke="#e8e2dc" stroke-opacity=".5" stroke-width="2"/>
        <rect x="${xCabeza}" y="${y}" width="${der(h) - xCabeza}" height="40" fill="${VERDE_CABEZA}" fill-opacity=".55" stroke="${VERDE_CABEZA}" stroke-width="2"/>
        <path d="M${xPas + 6} ${y - 6} l-14 28 h11 l-6 24 18-30 h-11 l8-22z" class="cx-rayo"/>
        <rect x="${izq(d)}" y="${y - 8}" width="${der(h) - izq(d)}" height="56" fill="transparent" class="cx-voz-zona"/>
      </g>`;
    }).join("");
    const nombres = l.voces.map((v, i) => `<div class="cx-voz-nombre" style="top:${Y0 + 22 + i * FILA - 4}px;color:${v.color}" data-voz="${i}">${txt(`voz.${i}`, v.nombre)}<small>${esc(v.desde)}–${esc(v.hasta)}</small></div>`).join("");
    return `
      <div class="cx-fondo rayos"></div>
      <header class="cx-cabecera ancha"><h1>${txt("titulo", l.titulo, null, "span", "cx-titulo-metal")}</h1>
        <img src="recursos/codex/emblema-an.png" alt="" class="cx-emblema" /></header>
      <svg class="cx-teclado" viewBox="0 0 1600 ${Y0 + ALTO + 50}" width="1600" height="${Y0 + ALTO + 50}">
        <defs><linearGradient id="cxRayo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3a"/><stop offset="1" stop-color="#c02241"/></linearGradient></defs>
        ${teclas}${barras}${etiquetas}</svg>
      ${nombres}
      <div class="cx-leyenda">
        <span><i class="pecho"></i>${txt("ley.pecho", "Voz de pecho")}</span>
        <span><i style="background:${VERDE_CABEZA}"></i>${txt("ley.cabeza", "Voz de cabeza")}</span>
        <span><i class="paso"></i>${txt("ley.paso", "Zona de paso")}</span>
        <span><svg viewBox="0 0 24 24" width="26" height="26"><path d="M14 1L6 13h6l-3 10 9-13h-6z" fill="url(#cxRayo)"/></svg>${txt("ley.passaggio", "Passaggio", { termino: "Passaggio" })}</span>
      </div>
      ${pie(false)}`;
  }

  // ------------------------------------------------------------------ lámina: calentamiento
  function bloque(b, y, alto, i) {
    const tabla = b.tabla;
    const items = tabla
      ? `<table class="cx-tabla">${b.items.map((it, j) => `<tr><th>${txt(`b.${b.id}.${j}.n`, it.nombre, it)}</th><td>${txt(`b.${b.id}.${j}.d`, it.detalle)}</td></tr>`).join("")}</table>`
      : `<div class="cx-items" style="--n:${Math.min(b.items.length, b.items.some((x) => x.detalle) ? 7 : 3)}">${b.items.map((it, j) => `
          <div class="cx-item">${txt(`b.${b.id}.${j}.n`, it.nombre, it, "b")}${it.detalle ? txt(`b.${b.id}.${j}.d`, it.detalle, null, "p") : ""}</div>`).join("")}</div>`;
    return `<section class="cx-bloque" style="top:${y}px;height:${alto}px;--c:${b.color}" data-bloque="${i}">
      <div class="cx-bloque-lado">${icono(b.icono, 78, b.color)}<h3 style="color:${b.color}">${txt(`b.${b.id}.t`, b.titulo)}</h3></div>
      <div class="cx-bloque-cuerpo">
        <h4>${txt(`b.${b.id}.lema`, b.lema)}</h4>
        <p class="cx-indicacion">${txt(`b.${b.id}.ind`, b.indicacion)}</p>
        ${items}
      </div>
    </section>`;
  }

  function laminaCalentamiento(l) {
    const Y = 200;
    const ALTO = 268;
    const SEP = 14;
    return `
      <div class="cx-fondo rayos"></div>
      <header class="cx-cabecera centrada"><h1>${txt("titulo", l.titulo, null, "span", "cx-titulo-metal")}</h1>
        <h2 class="cx-subtitulo">${txt("subtitulo", l.subtitulo)}</h2></header>
      ${l.bloques.map((b, i) => bloque(b, Y + i * (ALTO + SEP), ALTO, i)).join("")}
      <p class="cx-cierre" style="top:${Y + l.bloques.length * (ALTO + SEP) + 6}px">${txt("cierre", l.cierre)}</p>
      ${pie(false)}`;
  }

  const DIBUJAR = { macros: laminaMacros, imagen: laminaImagen, tesituras: laminaTesituras, calentamiento: laminaCalentamiento };

  // ------------------------------------------------------------------ diapositivas del carrusel (1080×1350)
  function diapositivas(l) {
    const marco = (contenido, clase = "") => `<div class="cx-lamina cx-diapo ${clase}" style="width:1080px;height:1350px">${contenido}</div>`;
    if (l.tipo === "macros") {
      const marcoM = (contenido) => marco(contenido, "tipo-macros");
      return [
        marcoM(`<div class="cx-fondo rayos"></div><header class="cx-cabecera"><h1><span class="cx-titulo-metal">${esc(l.titulo)}</span></h1><img src="recursos/codex/emblema-an.png" alt="" class="cx-emblema"/></header>
          <h2 class="cx-subtitulo">${esc(l.subtitulo)}</h2><div class="cx-rueda-pos" style="left:180px;top:400px">${rueda(l, 360, 360, 340, 165)}</div>${pie(true)}`),
        ...l.cajas.map((c) => marcoM(`<div class="cx-fondo rayos"></div><div class="cx-caja grande" style="--c:${c.color}">
          <div class="cx-caja-ico">${icono(c.icono, 150, c.color)}</div><h3 style="color:${c.color}">${esc(c.titulo)}</h3>
          <ul>${c.items.map((it) => `<li>${esc(it.nombre)}</li>`).join("")}</ul>${c.nota ? `<small>${esc(c.nota)}</small>` : ""}</div>${pie(true)}`)),
      ];
    }
    if (l.tipo === "calentamiento") {
      return [
        marco(`<div class="cx-fondo rayos"></div><header class="cx-cabecera centrada portada"><h1><span class="cx-titulo-metal">${esc(l.titulo)}</span></h1><h2 class="cx-subtitulo">${esc(l.subtitulo)}</h2></header>
          <ol class="cx-indice">${l.bloques.map((b) => `<li style="--c:${b.color}">${icono(b.icono, 54, b.color)}<span>${esc(b.titulo)}</span></li>`).join("")}</ol>${pie(true)}`),
        ...l.bloques.map((b, i) => marco(`<div class="cx-fondo rayos"></div>${bloque(b, 120, 1090, i)}${pie(true)}`, "diapo-bloque")),
        marco(`<div class="cx-fondo rayos"></div><p class="cx-cierre grande">${esc(l.cierre)}</p>${pie(true)}`),
      ];
    }
    // Tesituras y colocaciones: la lámina entera encajada en el formato 4:5.
    const escala = Math.min(1080 / l.ancho, 1350 / l.alto);
    return [marco(`<div class="cx-fondo rayos"></div><div class="cx-lamina cx-encajada" style="width:${l.ancho}px;height:${l.alto}px;transform:translate(-50%,-50%) scale(${escala})">${DIBUJAR[l.tipo](l)}</div>`)];
  }

  // ------------------------------------------------------------------ pantalla
  let actual = LAMINAS[0];
  let modo = "ver";
  const lienzo = () => $("#codexLamina");

  function aplicarEdiciones(raiz, laminaId) {
    const ed = leerEdiciones()[laminaId] || {};
    raiz.querySelectorAll("[data-k]").forEach((el) => {
      if (Object.prototype.hasOwnProperty.call(ed, el.dataset.k)) el.textContent = ed[el.dataset.k];
    });
  }

  function pintar() {
    terminos = [];
    const l = actual;
    const el = lienzo();
    el.className = `cx-lamina tipo-${l.tipo}${modo === "editar" ? " editando" : ""}`;
    el.style.width = `${l.ancho}px`;
    el.style.height = `${l.alto}px`;
    el.innerHTML = DIBUJAR[l.tipo](l);
    aplicarEdiciones(el, l.id);
    el.querySelectorAll("[data-k]").forEach((n) => {
      n.contentEditable = modo === "editar" ? "true" : "false";
      n.spellcheck = false;
    });
    document.querySelectorAll("[data-lamina]").forEach((b) => b.classList.toggle("activo", b.dataset.lamina === l.id));
    $("#codexAvisoTesituras").hidden = l.tipo !== "tesituras";
    $("#codexAvisoImagen").hidden = !(l.tipo === "imagen" && modo === "editar");
    cerrarFicha();
    ajustarEscala();
    try {
      const url = new URL(location.href);
      url.searchParams.set("lamina", l.id);
      history.replaceState(null, "", url);
    } catch {
      /* sin historial */
    }
  }

  function ajustarEscala() {
    const caja = $("#codexEscenario");
    const el = lienzo();
    const escala = Math.min(1, (caja.clientWidth - 2) / actual.ancho);
    el.style.transform = `scale(${escala})`;
    caja.style.height = `${actual.alto * escala}px`;
  }

  // ------------------------------------------------------------------ ficha de un término (modo «Ver»)
  function definicion(termino) {
    if (!termino || typeof GLOSARIO_TERMINOS === "undefined") return null;
    return GLOSARIO_TERMINOS.find((t) => t.termino === termino) || null;
  }
  function abrirFicha(item, ancla) {
    const ficha = $("#codexFicha");
    const def = definicion(item.termino);
    ficha.innerHTML = `<button type="button" class="cx-ficha-x" aria-label="Cerrar">✕</button>
      <h3>${esc(item.nombre)}</h3>
      ${def ? `<p>${esc(def.definicion)}</p><a class="cx-ficha-glosario" href="glosario.html">Ver en el glosario →</a>` : ""}
      ${item.practicar ? `<a class="boton principal" href="${esc(item.practicar)}">Practicarlo →</a>` : ""}`;
    ficha.hidden = false;
    const r = ancla.getBoundingClientRect();
    const fw = Math.min(340, window.innerWidth - 24);
    ficha.style.width = `${fw}px`;
    ficha.style.left = `${Math.max(12, Math.min(window.innerWidth - fw - 12, r.left + r.width / 2 - fw / 2))}px`;
    ficha.style.top = `${r.bottom + window.scrollY + 8}px`;
    $(".cx-ficha-x", ficha).addEventListener("click", cerrarFicha);
  }
  function cerrarFicha() {
    const f = $("#codexFicha");
    if (f) f.hidden = true;
  }

  // Tesituras: tocar una voz la hace sonar (de su nota más grave al passaggio y a la más aguda).
  async function sonarVoz(i) {
    const v = actual.voces && actual.voces[i];
    if (!v || !window.PianoEngine) return;
    const notas = [v.desde, v.pecho, v.passaggio, v.cabeza, v.hasta].map(nombreAMidi);
    lienzo().querySelectorAll(".cx-voz").forEach((g) => g.classList.toggle("sonando", g.dataset.voz === String(i)));
    $("#codexEstado").textContent = `${v.nombre}: ${v.desde} · pecho hasta ${v.pecho} · passaggio ${v.passaggio} · cabeza desde ${v.cabeza} · ${v.hasta}`;
    try {
      await window.PianoEngine.reproducirSecuencia(notas.map((midi) => ({ midi, duracion: 0.7 })), 0.8, {});
    } finally {
      lienzo().querySelectorAll(".cx-voz.sonando").forEach((g) => g.classList.remove("sonando"));
    }
  }

  // ------------------------------------------------------------------ exportar
  // Las fuentes de Google vienen de otro dominio y html-to-image no puede leerlas solo: sin esto el PNG salía con
  // una letra genérica. Se descargan una vez (solo latín y latín extendido) y se incrustan en base64.
  const URL_FUENTES = "https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap";
  let cssFuentes = null;
  async function fuentesIncrustadas() {
    if (cssFuentes) return cssFuentes;
    const css = await (await fetch(URL_FUENTES)).text();
    const bloques = css.split("/* ").filter((b) => /^latin(-ext)? \*\//.test(b)).map((b) => b.replace(/^[^*]*\*\/\s*/, ""));
    const aDataUrl = async (url) => {
      const blob = await (await fetch(url)).blob();
      return new Promise((r) => {
        const lector = new FileReader();
        lector.onload = () => r(lector.result);
        lector.readAsDataURL(blob);
      });
    };
    const piezas = await Promise.all(
      bloques.map(async (b) => {
        const m = /url\((https:[^)]+)\)/.exec(b);
        return m ? b.replace(m[1], await aDataUrl(m[1])) : b;
      })
    );
    cssFuentes = piezas.join("\n");
    return cssFuentes;
  }

  async function aPng(nodo, ancho, alto, ratio) {
    let fontEmbedCSS;
    try {
      fontEmbedCSS = await fuentesIncrustadas();
    } catch {
      fontEmbedCSS = undefined; // sin conexión: sale con la letra que haya
    }
    return window.htmlToImage.toPng(nodo, { width: ancho, height: alto, pixelRatio: ratio, cacheBust: true, fontEmbedCSS, style: { transform: "none" } });
  }
  function descargar(url, nombre) {
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function exportarPng() {
    const el = lienzo();
    const estado = $("#codexEstado");
    estado.textContent = "Preparando la imagen…";
    el.classList.add("exportando");
    try {
      const url = await aPng(el, actual.ancho, actual.alto, 2);
      descargar(url, `aleran-${actual.id}.png`);
      estado.textContent = `Lámina descargada (${actual.ancho * 2}×${actual.alto * 2} px).`;
    } catch (err) {
      estado.textContent = `No pude crear la imagen: ${err && err.message ? err.message : err}`;
    } finally {
      el.classList.remove("exportando");
    }
  }

  // ZIP mínimo sin compresión (los PNG ya van comprimidos).
  const TABLA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(archivos) {
    const enc = new TextEncoder();
    const partes = [];
    const central = [];
    let desplazamiento = 0;
    archivos.forEach(({ nombre, datos }) => {
      const n = enc.encode(nombre);
      const crc = crc32(datos);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, datos.length, true);
      local.setUint32(22, datos.length, true);
      local.setUint16(26, n.length, true);
      partes.push(new Uint8Array(local.buffer), n, datos);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, datos.length, true);
      c.setUint32(24, datos.length, true);
      c.setUint16(28, n.length, true);
      c.setUint32(42, desplazamiento, true);
      central.push(new Uint8Array(c.buffer), n);
      desplazamiento += 30 + n.length + datos.length;
    });
    const tamCentral = central.reduce((s, p) => s + p.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true);
    fin.setUint16(8, archivos.length, true);
    fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamCentral, true);
    fin.setUint32(16, desplazamiento, true);
    return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: "application/zip" });
  }

  async function exportarCarrusel() {
    const estado = $("#codexEstado");
    const taller = $("#codexTaller");
    const htmls = diapositivas(actual);
    const archivos = [];
    try {
      for (let i = 0; i < htmls.length; i++) {
        estado.textContent = `Creando diapositiva ${i + 1} de ${htmls.length}…`;
        taller.innerHTML = htmls[i];
        const nodo = taller.firstElementChild;
        aplicarEdicionesDiapo(nodo);
        await Promise.all(Array.from(nodo.querySelectorAll("img")).map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
        const url = await aPng(nodo, 1080, 1350, 1);
        const bin = atob(url.split(",")[1]);
        const datos = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) datos[k] = bin.charCodeAt(k);
        archivos.push({ nombre: `${String(i + 1).padStart(2, "0")}-${actual.id}.png`, datos });
      }
      const blob = zip(archivos);
      descargar(URL.createObjectURL(blob), `carrusel-${actual.id}.zip`);
      estado.textContent = `Carrusel listo: ${archivos.length} diapositiva${archivos.length === 1 ? "" : "s"} de 1080×1350 en un .zip.`;
    } catch (err) {
      estado.textContent = `No pude crear el carrusel: ${err && err.message ? err.message : err}`;
    } finally {
      taller.innerHTML = "";
    }
  }
  // En el carrusel no hay data-k (se escribe el texto directamente): se aplican las ediciones por texto original.
  function aplicarEdicionesDiapo(nodo) {
    const ed = leerEdiciones()[actual.id];
    if (!ed) return;
    const original = document.createElement("div");
    const guardados = terminos; // la lámina de pantalla sigue usando sus términos tocables
    terminos = [];
    original.innerHTML = DIBUJAR[actual.tipo](actual);
    terminos = guardados;
    const cambios = new Map();
    original.querySelectorAll("[data-k]").forEach((n) => {
      if (Object.prototype.hasOwnProperty.call(ed, n.dataset.k) && ed[n.dataset.k] !== n.textContent) cambios.set(n.textContent, ed[n.dataset.k]);
    });
    if (!cambios.size) return;
    const recorrer = document.createTreeWalker(nodo, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = recorrer.nextNode())) {
      const limpio = t.nodeValue.trim();
      if (cambios.has(limpio)) t.nodeValue = t.nodeValue.replace(limpio, cambios.get(limpio));
    }
  }

  // ------------------------------------------------------------------ arranque
  function iniciar() {
    const lista = $("#codexLista");
    lista.innerHTML = LAMINAS.map((l) => `<button type="button" class="chip" data-lamina="${l.id}">${esc(l.nombre)}</button>`).join("");
    lista.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lamina]");
      if (!b) return;
      actual = LAMINAS.find((l) => l.id === b.dataset.lamina) || actual;
      pintar();
    });
    document.querySelectorAll("[data-modo-codex]").forEach((b) =>
      b.addEventListener("click", () => {
        modo = b.dataset.modoCodex;
        document.querySelectorAll("[data-modo-codex]").forEach((x) => x.classList.toggle("activo", x === b));
        pintar();
      })
    );
    $("#codexPng").addEventListener("click", exportarPng);
    $("#codexCarrusel").addEventListener("click", exportarCarrusel);
    $("#codexOriginal").addEventListener("click", () => window.open(ORIGINALES[actual.id], "_blank", "noopener"));
    $("#codexRestaurar").addEventListener("click", () => {
      if (!confirm("¿Volver a los textos originales de esta lámina? Se pierden tus cambios en ella.")) return;
      borrarEdiciones(actual.id);
      pintar();
    });
    const el = lienzo();
    el.addEventListener("input", (e) => {
      const n = e.target.closest("[data-k]");
      if (n && modo === "editar") guardarEdicion(actual.id, n.dataset.k, n.textContent);
    });
    el.addEventListener("click", (e) => {
      if (modo !== "ver") return;
      const voz = e.target.closest("[data-voz]");
      if (voz) {
        sonarVoz(Number(voz.dataset.voz));
        return;
      }
      const t = e.target.closest("[data-t]");
      if (t) {
        e.stopPropagation();
        abrirFicha(terminos[Number(t.dataset.t)], t);
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#codexFicha") && !e.target.closest("[data-t]")) cerrarFicha();
    });
    window.addEventListener("resize", ajustarEscala);
    const pedida = new URLSearchParams(location.search).get("lamina");
    actual = LAMINAS.find((l) => l.id === pedida) || LAMINAS[0];
    pintar();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarEscala);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  window.CodexApp = { diapositivas: () => diapositivas(actual), pintar, aPng };
})();
