/**
 * app-shell.js — capa común de todas las páginas: menú simplificado, barra de herramientas siempre a mano
 * (rango vocal + MIDI), ayudas «?» y desplegables convertidos en botones.
 *
 * Se carga justo después de escalas.js (para poder añadir «Completo» y «Mi rango» a VOCES antes de que las
 * páginas rellenen sus selectores) y antes de teclado.js (que cuelga el interruptor de MIDI de la barra).
 */
(function () {
  "use strict";

  const CLAVE_RANGO = "aleran-rango-vocal";
  const NOMBRES_NOTA = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

  // Tesitura cómoda de práctica por tipo de voz (la misma tabla que escalas.js, para las páginas que no la cargan).
  const VOCES_BASE = {
    bajo: { nombre: "Bajo", rango: ["Mi2", "Mi4"] },
    baritono: { nombre: "Barítono", rango: ["Sol2", "Sol4"] },
    tenor: { nombre: "Tenor", rango: ["Do3", "Do5"] },
    contralto: { nombre: "Contralto", rango: ["Fa3", "Fa5"] },
    mezzosoprano: { nombre: "Mezzo", rango: ["La3", "La5"] },
    soprano: { nombre: "Soprano", rango: ["Do4", "Do6"] },
  };
  const COMPLETO = ["Do2", "Do6"];
  const PERSONALIZADO_INICIAL = [48, 72]; // Do3–Do5

  function nombreAMidiLocal(nombre) {
    const m = /^(Do|Re|Mi|Fa|Sol|La|Si)(#|b|♭)?(-?\d)$/i.exec(String(nombre).trim());
    if (!m) return null;
    const base = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 }[m[1].toLowerCase()];
    const alt = m[2] === "#" ? 1 : m[2] ? -1 : 0;
    return 12 * (parseInt(m[3], 10) + 1) + base + alt;
  }

  function midiANombreLocal(midi) {
    return NOMBRES_NOTA[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  // ---------------------------------------------------------------- rango vocal (estado global)
  function leerGuardado() {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_RANGO) || "null");
      if (g && typeof g.clave === "string") return g;
    } catch {
      /* sin datos guardados */
    }
    return null;
  }

  let estado = leerGuardado() || { clave: "tenor", elegido: false };
  if (estado.clave === "personalizado" && !(estado.min >= 24 && estado.max > estado.min)) {
    estado = { clave: "personalizado", elegido: true, min: PERSONALIZADO_INICIAL[0], max: PERSONALIZADO_INICIAL[1] };
  }

  const escuchas = [];

  function rangoDe(clave) {
    if (clave === "personalizado") {
      const min = estado.min || PERSONALIZADO_INICIAL[0];
      const max = estado.max || PERSONALIZADO_INICIAL[1];
      return { nombre: "Mi rango", min: midiANombreLocal(min), max: midiANombreLocal(max), midiMin: min, midiMax: max };
    }
    if (clave === "completo") {
      return { nombre: "Completo", min: COMPLETO[0], max: COMPLETO[1], midiMin: nombreAMidiLocal(COMPLETO[0]), midiMax: nombreAMidiLocal(COMPLETO[1]) };
    }
    const v = VOCES_BASE[clave] || VOCES_BASE.tenor;
    return { nombre: v.nombre, min: v.rango[0], max: v.rango[1], midiMin: nombreAMidiLocal(v.rango[0]), midiMax: nombreAMidiLocal(v.rango[1]) };
  }

  function obtener() {
    return { clave: estado.clave, elegido: Boolean(estado.elegido), ...rangoDe(estado.clave) };
  }

  // Mantiene VOCES (escalas.js) al día: así «Completo» y «Mi rango» funcionan en todo lo que ya usa VOCES.
  function sincronizarVoces() {
    if (typeof VOCES === "undefined") return;
    VOCES.completo = { nombre: "Rango completo", rango: COMPLETO.slice() };
    const p = rangoDe("personalizado");
    VOCES.personalizado = { nombre: "Mi rango", rango: [p.min, p.max] };
  }

  function establecer(clave, min, max) {
    estado = { clave, elegido: true };
    if (clave === "personalizado") {
      estado.min = Math.max(24, Math.min(min, max - 1));
      estado.max = Math.min(96, Math.max(max, min + 1));
    }
    try {
      localStorage.setItem(CLAVE_RANGO, JSON.stringify(estado));
    } catch {
      /* si no se puede guardar, vale para esta visita */
    }
    sincronizarVoces();
    pintarChipRango();
    const detalle = obtener();
    escuchas.forEach((fn) => fn(detalle));
    window.dispatchEvent(new CustomEvent("rango-vocal-cambio", { detail: detalle }));
  }

  window.RangoVocal = {
    obtener,
    establecer,
    alCambiar: (fn) => escuchas.push(fn),
    // Clave utilizable en VOCES (escalas.js): una de las seis voces, «completo» o «personalizado».
    claveVoz: () => estado.clave,
    voces: () => Object.entries(VOCES_BASE).map(([clave, v]) => ({ clave, nombre: v.nombre, rango: v.rango })),
  };
  sincronizarVoces();

  // ---------------------------------------------------------------- utilidades de DOM
  function crear(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  // ---------------------------------------------------------------- menú simplificado
  const PRINCIPALES = [
    { href: "piano.html", texto: "🎹 Solfeo" },
    { href: "entrenamiento.html", texto: "🎤 Entrena" },
    { href: "oido.html", texto: "🧠 Oído" },
    { href: "ritmo.html", texto: "🥁 Ritmo" },
    { href: "cifrado.html", texto: "🎵 Cifrado" },
  ];
  const MAS = [
    { href: "guia.html", texto: "🧭 Guía" },
    { href: "rutina.html", texto: "📋 Rutina" },
    { href: "catalogo.html", texto: "🎼 Catálogo" },
    { href: "progreso.html", texto: "📈 Progreso" },
    { href: "juegos.html", texto: "🎮 Juegos" },
    { href: "mapa-vocal.html", texto: "🗺️ Mapa vocal" },
    { href: "glosario.html", texto: "📖 Glosario" },
    { href: "soporte.html", texto: "💬 Soporte" },
  ];

  function paginaActual() {
    const f = location.pathname.split("/").pop();
    return f || "index.html";
  }

  // El menú de cada página se queda como estaba (sus filas de botones siempre visibles): solo se marca la activa.
  function construirMenu() {
    return document.querySelector(".nav-principal");
  }

  // ---------------------------------------------------------------- barra de herramientas (rango + MIDI)
  let chipRango = null;

  function pintarChipRango() {
    if (!chipRango) return;
    const r = obtener();
    chipRango.textContent = r.elegido ? `🎙 ${r.nombre} · ${r.min}–${r.max}` : "🎙 Elige tu rango";
    chipRango.classList.toggle("sin-elegir", !r.elegido);
  }

  function construirDock(nav) {
    const dock = crear("div", "dock");
    dock.id = "dockHerramientas";
    chipRango = crear("button", "chip-dock");
    chipRango.type = "button";
    chipRango.id = "chipRango";
    chipRango.title = "Tu rango vocal: todas las herramientas se adaptan a él";
    chipRango.addEventListener("click", abrirHoja);
    dock.appendChild(chipRango);
    chipMic = crear("button", "chip-dock");
    chipMic.type = "button";
    chipMic.id = "chipMic";
    chipMic.addEventListener("click", abrirHojaMic);
    dock.appendChild(chipMic);
    const cabecera = document.querySelector(".cabecera");
    if (nav) nav.insertAdjacentElement("afterend", dock);
    else if (cabecera) cabecera.insertAdjacentElement("afterend", dock);
    else document.querySelector(".app")?.prepend(dock);
    pintarChipRango();
    pintarChipMic();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", pintarChipMic);
    }
    return dock;
  }

  // ---------------------------------------------------------------- micrófono (entrada de audio de toda la web)
  const CLAVE_MIC = "aleran-mic-dispositivo";
  let chipMic = null;

  function micGuardado() {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE_MIC) || "null");
      return v && v.id ? v : null;
    } catch {
      return null;
    }
  }

  function nombreMicCorto(n) {
    return String(n || "")
      .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "")
      .replace(/^(Predeterminado|Default)\s*-\s*/i, "")
      .trim();
  }

  function pintarChipMic() {
    if (!chipMic) return;
    const g = micGuardado();
    const corto = g ? nombreMicCorto(g.nombre) : "Predeterminado";
    chipMic.textContent = `🎤 ${corto.length > 24 ? corto.slice(0, 23) + "…" : corto}`;
    chipMic.title = g ? `Micrófono elegido: ${g.nombre}` : "Micrófono: el predeterminado del sistema. Toca para elegir otro.";
  }

  function guardarMic(id, nombre) {
    try {
      if (id) localStorage.setItem(CLAVE_MIC, JSON.stringify({ id, nombre }));
      else localStorage.removeItem(CLAVE_MIC);
    } catch {
      /* sin consecuencias */
    }
    // Si había un micrófono abierto, se cierra: el siguiente ejercicio abre el nuevo.
    if (window.MicrofonoEngine && window.MicrofonoEngine.detener) window.MicrofonoEngine.detener();
    pintarChipMic();
    window.dispatchEvent(new CustomEvent("mic-cambio", { detail: { id, nombre } }));
  }

  async function abrirHojaMic() {
    cerrarHoja();
    hoja = crear("div", "hoja-fondo");
    const caja = crear("div", "hoja");
    caja.setAttribute("role", "dialog");
    caja.setAttribute("aria-label", "Tu micrófono");
    hoja.appendChild(caja);
    const cab = crear("div", "hoja-cabecera");
    cab.appendChild(crear("h2", "", "Tu micrófono"));
    const cerrar = crear("button", "hoja-cerrar", "✕");
    cerrar.type = "button";
    cerrar.setAttribute("aria-label", "Cerrar");
    cerrar.addEventListener("click", cerrarHoja);
    cab.appendChild(cerrar);
    caja.appendChild(cab);
    caja.appendChild(crear("p", "hoja-texto", "La entrada que usan todas las herramientas con micrófono."));
    const lista = crear("div", "rango-rejilla mic-lista");
    caja.appendChild(lista);
    hoja.addEventListener("click", (e) => {
      if (e.target === hoja) cerrarHoja();
    });
    document.body.appendChild(hoja);

    const pintarLista = async () => {
      lista.innerHTML = "";
      let dispositivos = [];
      try {
        dispositivos = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
      } catch {
        dispositivos = [];
      }
      const g = micGuardado();
      const reales = dispositivos.filter((d) => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");
      const opciones = [{ id: "", nombre: "Predeterminado del sistema" }, ...reales.map((d) => ({ id: d.deviceId, nombre: d.label || "Micrófono" }))];
      opciones.forEach((o) => {
        const b = crear("button", "rango-opcion");
        b.type = "button";
        b.innerHTML = "<strong></strong>";
        b.firstChild.textContent = o.nombre;
        if ((g ? g.id : "") === o.id) b.classList.add("activo");
        b.addEventListener("click", () => {
          guardarMic(o.id, o.nombre);
          cerrarHoja();
        });
        lista.appendChild(b);
      });
      const sinNombres = reales.length === 0 || reales.every((d) => !d.label);
      if (sinNombres && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const permitir = crear("button", "rango-opcion", "Permitir el micrófono para ver cuáles tienes");
        permitir.type = "button";
        permitir.addEventListener("click", async () => {
          try {
            const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
            flujo.getTracks().forEach((t) => t.stop());
          } catch {
            /* el navegador ya mostró su aviso */
          }
          pintarLista();
        });
        lista.appendChild(permitir);
      }
    };
    pintarLista();
  }

  // ---------------------------------------------------------------- hoja «Tu rango vocal»
  let hoja = null;

  function cerrarHoja() {
    if (hoja) {
      hoja.remove();
      hoja = null;
    }
  }

  function abrirHoja() {
    cerrarHoja();
    const actual = obtener();
    hoja = crear("div", "hoja-fondo");
    const caja = crear("div", "hoja");
    caja.setAttribute("role", "dialog");
    caja.setAttribute("aria-label", "Tu rango vocal");
    hoja.appendChild(caja);

    const cab = crear("div", "hoja-cabecera");
    cab.appendChild(crear("h2", "", "Tu rango vocal"));
    const cerrar = crear("button", "hoja-cerrar", "✕");
    cerrar.type = "button";
    cerrar.setAttribute("aria-label", "Cerrar");
    cerrar.addEventListener("click", cerrarHoja);
    cab.appendChild(cerrar);
    caja.appendChild(cab);
    caja.appendChild(crear("p", "hoja-texto", "Elígelo una vez: los ejercicios usan estas notas."));

    const rejilla = crear("div", "rango-rejilla");
    const opciones = [
      ...Object.entries(VOCES_BASE).map(([clave, v]) => ({ clave, nombre: v.nombre, detalle: `${v.rango[0]}–${v.rango[1]}` })),
      { clave: "completo", nombre: "Completo", detalle: `${COMPLETO[0]}–${COMPLETO[1]}` },
      { clave: "personalizado", nombre: "Personalizado", detalle: "tú eliges" },
    ];
    const zonaPersonal = crear("div", "rango-personal");
    zonaPersonal.hidden = actual.clave !== "personalizado";

    opciones.forEach((o) => {
      const b = crear("button", "rango-opcion");
      b.type = "button";
      b.innerHTML = `<strong>${o.nombre}</strong><span>${o.detalle}</span>`;
      if (o.clave === actual.clave && actual.elegido) b.classList.add("activo");
      b.addEventListener("click", () => {
        if (o.clave === "personalizado") {
          const p = rangoDe("personalizado");
          establecer("personalizado", p.midiMin, p.midiMax);
          abrirHoja();
          return;
        }
        establecer(o.clave);
        cerrarHoja();
      });
      rejilla.appendChild(b);
    });
    caja.appendChild(rejilla);

    // Personalizado: dos selectores de nota (− nota +), uno para la más grave y otro para la más aguda.
    if (actual.clave === "personalizado") {
      const p = rangoDe("personalizado");
      const par = [p.midiMin, p.midiMax];
      const etiquetas = ["Desde", "Hasta"];
      etiquetas.forEach((et, i) => {
        const fila = crear("div", "rango-fila");
        fila.appendChild(crear("span", "", et));
        const menos = crear("button", "paso", "−");
        const valor = crear("strong", "paso-valor", midiANombreLocal(par[i]));
        const mas = crear("button", "paso", "+");
        [menos, mas].forEach((b) => (b.type = "button"));
        const mover = (d) => {
          par[i] += d;
          par[0] = Math.max(24, Math.min(par[0], par[1] - 1));
          par[1] = Math.min(96, Math.max(par[1], par[0] + 1));
          establecer("personalizado", par[0], par[1]);
          abrirHoja();
        };
        menos.addEventListener("click", () => mover(-1));
        mas.addEventListener("click", () => mover(1));
        fila.append(menos, valor, mas);
        zonaPersonal.appendChild(fila);
      });
      zonaPersonal.hidden = false;
      caja.appendChild(zonaPersonal);
    }

    hoja.addEventListener("click", (e) => {
      if (e.target === hoja) cerrarHoja();
    });
    document.body.appendChild(hoja);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarHoja();
  });

  // ---------------------------------------------------------------- ayuda «?» bajo demanda
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".ayuda-btn");
    if (!btn) return;
    e.preventDefault();
    const contenedor = btn.closest("p, h2, h3, label, div") || btn.parentElement;
    const previa = contenedor.nextElementSibling;
    if (previa && previa.classList.contains("ayuda-pop")) {
      previa.remove();
      btn.setAttribute("aria-expanded", "false");
      return;
    }
    const pop = crear("div", "ayuda-pop");
    pop.setAttribute("role", "note");
    pop.textContent = btn.dataset.ayuda || "";
    contenedor.insertAdjacentElement("afterend", pop);
    btn.setAttribute("aria-expanded", "true");
  });

  // ---------------------------------------------------------------- desplegables → botones
  const COMO_PASO = new Set(["solfeoTonica", "girosTonica"]);

  function mejorarSelect(sel) {
    if (sel.dataset.mejorado || sel.dataset.sinBotones !== undefined || sel.multiple) return;
    sel.dataset.mejorado = "1";
    const esPaso = COMO_PASO.has(sel.id);
    const cont = crear("div", esPaso ? "stepper" : "grupo-botones");
    if (!esPaso) cont.setAttribute("role", "radiogroup");
    sel.classList.add("select-oculto");
    sel.insertAdjacentElement("afterend", cont);

    const elegir = (valor) => {
      if (sel.value === valor) return;
      sel.value = valor;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      sincronizar();
    };

    function pintar() {
      cont.textContent = "";
      const opciones = Array.from(sel.options);
      if (esPaso) {
        const menos = crear("button", "paso", "−");
        const valor = crear("strong", "paso-valor", "");
        const mas = crear("button", "paso", "+");
        [menos, mas].forEach((b) => (b.type = "button"));
        menos.addEventListener("click", () => {
          if (sel.selectedIndex > 0) elegir(opciones[sel.selectedIndex - 1].value);
        });
        mas.addEventListener("click", () => {
          if (sel.selectedIndex < opciones.length - 1) elegir(opciones[sel.selectedIndex + 1].value);
        });
        cont.append(menos, valor, mas);
        cont._valor = valor;
        sincronizar();
        return;
      }
      let ultimoGrupo = null;
      Array.from(sel.children).forEach((nodo) => {
        const lista = nodo.tagName === "OPTGROUP" ? Array.from(nodo.children) : [nodo];
        if (nodo.tagName === "OPTGROUP" && nodo.label) {
          ultimoGrupo = crear("div", "grupo-titulo", nodo.label);
          cont.appendChild(ultimoGrupo);
        }
        lista.forEach((opt) => {
          if (opt.tagName !== "OPTION") return;
          const b = crear("button", "chip");
          b.type = "button";
          b.textContent = sel.id === "girosPatron" ? opt.textContent.replace(/^Giro\s+/, "") : opt.textContent;
          b.dataset.valor = opt.value;
          b.setAttribute("role", "radio");
          b.addEventListener("click", () => elegir(opt.value));
          cont.appendChild(b);
        });
      });
      sincronizar();
    }

    function sincronizar() {
      if (esPaso) {
        if (cont._valor) {
          const o = sel.options[sel.selectedIndex];
          cont._valor.textContent = o ? o.textContent : "—";
        }
        return;
      }
      cont.querySelectorAll(".chip").forEach((b) => {
        const activo = b.dataset.valor === sel.value;
        b.classList.toggle("activo", activo);
        b.setAttribute("aria-checked", String(activo));
      });
    }

    new MutationObserver(pintar).observe(sel, { childList: true, subtree: true });
    sel.addEventListener("change", sincronizar);
    // El código de cada página cambia `select.value` sin lanzar «change»: un repaso ligero mantiene los botones al día.
    setInterval(sincronizar, 400);
    pintar();
  }

  function mejorarTodosLosSelects() {
    document.querySelectorAll("select").forEach(mejorarSelect);
  }

  // ---------------------------------------------------------------- arranque
  const nav = construirMenu();
  construirDock(nav);

  function alCargar() {
    mejorarTodosLosSelects();
    // Primera visita: una sola pregunta, saltable, para que todas las herramientas partan de tu rango.
    if (!estado.elegido && document.getElementById("piano") && !sessionStorage.getItem("aleran-rango-saltado")) {
      setTimeout(() => {
        if (!estado.elegido && !hoja) abrirHoja();
        sessionStorage.setItem("aleran-rango-saltado", "1");
      }, 600);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", alCargar);
  else alCargar();
  // Los selects que rellenan las páginas en su propio DOMContentLoaded se recogen en una segunda pasada.
  window.addEventListener("load", mejorarTodosLosSelects);

  window.AppShell = { dock: () => document.getElementById("dockHerramientas"), abrirRango: abrirHoja, abrirMic: abrirHojaMic, mejorarSelect };
})();
