/**
 * barra.js — la barra fija de abajo, común a todas las páginas (la carga app-shell.js).
 *
 * Cuatro botones siempre a mano: Nota (toque = suena la primera nota de tu rango; mantener = sostenida),
 * Afinador (la aguja de teclado.js, en pequeño), Metrónomo (el mismo y único metrónomo de toda la web, con su tempo
 * compartido) y Piano (dos octavas de tu rango). Se pliega y recuerda cómo la dejaste.
 *
 * Las páginas que no cargan el motor de sonido (Guía, Glosario, Progreso, las beta...) lo cargan aquí la primera vez
 * que se toca un botón: smplr + pitchy + audio.js (y teclado.js para la aguja).
 * En Cifrado no hay un segundo piano: el piano flotante de la página pasa a vivir dentro de la barra.
 */
(function () {
  "use strict";

  if (window.BarraComun) return;

  const CLAVE_ABIERTA = "aleran-barra-abierta";
  const CLAVE_BPM = "aleran-metronomo-bpm"; // la misma que audio.js
  const BPM_MIN = 40;
  const BPM_MAX = 220;
  const VERSION_AUDIO = "17";
  const VERSION_TECLADO = "14";
  const NOMBRES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  const ES_NEGRA = new Set([1, 3, 6, 8, 10]);

  const nombreNota = (m) => NOMBRES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

  function leer(clave) {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  }
  function guardar(clave, valor) {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      /* sin almacenamiento: vale para esta visita */
    }
  }

  function crear(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function boton(clase, texto, etiqueta) {
    const b = crear("button", clase, texto);
    b.type = "button";
    if (etiqueta) b.setAttribute("aria-label", etiqueta);
    return b;
  }

  // ------------------------------------------------------------ carga perezosa del motor de sonido
  function cargarScript(src) {
    return new Promise((resolver, rechazar) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolver;
      s.onerror = () => rechazar(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  let promesaAudio = null;
  function asegurarAudio() {
    if (window.PianoEngine && window.MetronomoEngine && window.MicrofonoEngine) return Promise.resolve();
    if (!promesaAudio) {
      promesaAudio = (async () => {
        if (typeof window.smplrLib === "undefined") await cargarScript("smplr.iife.js");
        if (typeof window.pitchyLib === "undefined") await cargarScript("pitchy.iife.js");
        // audio.js solo necesita estas dos constantes de escalas.js (que no todas las páginas cargan).
        if (typeof DO1_MIDI === "undefined") window.DO1_MIDI = 24;
        if (typeof DO7_MIDI === "undefined") window.DO7_MIDI = 96;
        await cargarScript("audio.js?v=" + VERSION_AUDIO);
        conectarMotor();
      })().catch((e) => {
        promesaAudio = null;
        throw e;
      });
    }
    return promesaAudio;
  }

  let promesaDial = null;
  function asegurarDial() {
    if (typeof dibujarDial === "function") return Promise.resolve();
    if (!promesaDial) {
      promesaDial = cargarScript("teclado.js?v=" + VERSION_TECLADO).catch((e) => {
        promesaDial = null;
        throw e;
      });
    }
    return promesaDial;
  }

  // ------------------------------------------------------------ rango del alumno
  function rango() {
    const r = window.RangoVocal ? window.RangoVocal.obtener() : { midiMin: 48, midiMax: 72, clave: "tenor" };
    return r;
  }
  function notaReferencia() {
    return rango().midiMin;
  }

  // ------------------------------------------------------------ DOM
  let raiz;
  let paneles;
  let fila;
  let asa;
  let panelAbierto = null; // "afinador" | "metronomo" | "piano" | null
  const botones = {};
  const secciones = {};
  let pianoDePagina = null; // Cifrado: { cuerpo, toggle }

  function construir() {
    raiz = crear("div", "barra-comun");
    raiz.id = "barraComun";
    raiz.setAttribute("data-sin-ico", ""); // los iconos los pone la barra (iconos.js no debe tocar los rótulos)
    paneles = crear("div", "barra-paneles");
    fila = crear("div", "barra-fila");
    fila.setAttribute("role", "toolbar");
    fila.setAttribute("aria-label", "Herramientas rápidas");

    botones.nota = botonBarra("nota", "Nota", "Nota de referencia: toca para oírla, mantén para que suene sostenida");
    botones.afinador = botonBarra("afinador", "Afinador", "Afinador");
    botones.metronomo = botonBarra("metronomo", "Metrónomo", "Metrónomo");
    botones.piano = botonBarra("piano", "Piano", "Piano de tu rango");
    const punto = crear("i", "barra-punto");
    punto.setAttribute("aria-hidden", "true");
    botones.metronomo.querySelector(".barra-ico").appendChild(punto);
    const plegar = boton("barra-plegar", "▾", "Plegar la barra");
    plegar.title = "Plegar";
    fila.append(botones.nota, botones.afinador, botones.metronomo, botones.piano, plegar);

    asa = boton("barra-asa", "", "Abrir herramientas: nota, afinador, metrónomo y piano");
    asa.innerHTML = '<span class="barra-asa-ico"></span><span>Herramientas</span><i class="barra-punto" aria-hidden="true"></i><span aria-hidden="true">▴</span>';
    if (window.iconoLinea) asa.querySelector(".barra-asa-ico").innerHTML = window.iconoLinea("metronomo");

    raiz.append(paneles, fila, asa);
    document.body.appendChild(raiz);

    construirAfinador();
    construirMetronomo();
    construirPiano();
    configurarNota();

    botones.afinador.addEventListener("click", () => alternarPanel("afinador"));
    botones.metronomo.addEventListener("click", () => alternarPanel("metronomo"));
    botones.piano.addEventListener("click", () => alternarPanel("piano"));
    plegar.addEventListener("click", () => fijarAbierta(false));
    asa.addEventListener("click", () => fijarAbierta(true));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panelAbierto && !document.querySelector(".hoja-fondo")) cerrarPanel();
    });

    fijarAbierta(leer(CLAVE_ABIERTA) !== "0", true);
    pintarNota();
    pintarMetronomo();
    window.addEventListener("rango-vocal-cambio", () => {
      pintarNota();
      if (panelAbierto === "piano" && !pianoDePagina) pintarTeclas();
    });

    // Lo que ocupa la barra se reserva abajo en la página (padding), para que nunca tape el final.
    const medir = () => {
      const visible = raiz.classList.contains("abierta") ? raiz.offsetHeight : asa.offsetHeight + 16;
      document.documentElement.style.setProperty("--barra-h", `${visible}px`);
    };
    if (window.ResizeObserver) new ResizeObserver(medir).observe(raiz);
    window.addEventListener("resize", medir);
    raiz._medir = medir;
    medir();
    document.body.classList.add("con-barra");
  }

  function botonBarra(id, texto, etiqueta) {
    const b = boton("barra-boton", "", etiqueta);
    b.dataset.barra = id;
    const ico = crear("span", "barra-ico");
    const ICONOS = { nota: "nota", afinador: "voz", metronomo: "metronomo", piano: "practicar" };
    if (window.iconoLinea) ico.innerHTML = window.iconoLinea(ICONOS[id]);
    const rot = crear("span", "barra-rotulo", texto);
    b.append(ico, rot);
    if (id !== "nota") b.setAttribute("aria-expanded", "false");
    return b;
  }

  function fijarAbierta(abierta, inicial) {
    raiz.classList.toggle("abierta", abierta);
    if (!inicial) guardar(CLAVE_ABIERTA, abierta ? "1" : "0");
    // Al plegar solo se cierra el afinador (deja de escuchar); el piano o el metrónomo siguen ahí al desplegar.
    if (!abierta && panelAbierto === "afinador") cerrarPanel();
    if (raiz._medir) raiz._medir();
    if (!inicial) (abierta ? botones.nota : asa).focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ paneles (uno a la vez)
  function seccion(id, titulo) {
    const s = crear("section", "barra-panel");
    s.dataset.panel = id;
    s.hidden = true;
    s.setAttribute("aria-label", titulo);
    paneles.appendChild(s);
    secciones[id] = s;
    return s;
  }

  function alternarPanel(id) {
    if (panelAbierto === id) cerrarPanel();
    else abrirPanel(id);
  }

  function abrirPanel(id) {
    if (panelAbierto) cerrarPanel();
    panelAbierto = id;
    botones[id].setAttribute("aria-expanded", "true");
    botones[id].classList.add("activo");
    if (id === "piano" && pianoDePagina) {
      if (pianoDePagina.cuerpo.hidden) pianoDePagina.toggle.click();
    } else {
      secciones[id].hidden = false;
    }
    if (id === "afinador") arrancarAfinador();
    if (id === "piano" && !pianoDePagina) pintarTeclas();
    if (raiz._medir) raiz._medir();
  }

  function cerrarPanel() {
    if (!panelAbierto) return;
    const id = panelAbierto;
    panelAbierto = null;
    botones[id].setAttribute("aria-expanded", "false");
    botones[id].classList.remove("activo");
    if (id === "piano" && pianoDePagina) {
      if (!pianoDePagina.cuerpo.hidden) pianoDePagina.toggle.click();
    } else {
      secciones[id].hidden = true;
    }
    if (id === "afinador") pararAfinador();
    if (raiz._medir) raiz._medir();
  }

  // ------------------------------------------------------------ Nota de referencia
  let notaSonando = null;

  function pintarNota() {
    const m = notaReferencia();
    botones.nota.querySelector(".barra-rotulo").textContent = nombreNota(m);
    botones.nota.title = `${nombreNota(m)}: la primera nota de tu rango. Toca para oírla; mantén pulsado para que siga sonando.`;
  }

  function configurarNota() {
    const b = botones.nota;
    const soltar = () => {
      if (!notaSonando) return;
      const { midi, inicio } = notaSonando;
      notaSonando = null;
      b.classList.remove("sonando");
      if (!window.PianoEngine) return;
      // Toque corto: que suene un momento (1,5 s). Mantener: suena mientras el dedo siga encima.
      const pulsado = performance.now() - inicio;
      if (pulsado < 350) setTimeout(() => window.PianoEngine.soltarNotaLibre(midi), 1500 - pulsado);
      else window.PianoEngine.soltarNotaLibre(midi);
    };
    b.addEventListener("pointerdown", async (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      if (notaSonando) soltar();
      const midi = notaReferencia();
      const yo = { midi, inicio: performance.now() };
      notaSonando = yo;
      b.classList.add("sonando");
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura: se suelta igual al levantar */
      }
      try {
        await asegurarAudio();
      } catch {
        notaSonando = null;
        b.classList.remove("sonando");
        return;
      }
      window.PianoEngine.iniciarNotaLibre(midi, 0.85);
      // Si ya se soltó mientras se cargaba el sonido, el temporizador de soltar se programa ahora.
      if (notaSonando !== yo) setTimeout(() => window.PianoEngine.soltarNotaLibre(midi), 1500);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => b.addEventListener(ev, soltar));
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    // Teclado (Enter/Espacio): un toque.
    b.addEventListener("click", async (e) => {
      if (e.detail !== 0) return;
      await asegurarAudio();
      const midi = notaReferencia();
      window.PianoEngine.iniciarNotaLibre(midi, 0.85);
      setTimeout(() => window.PianoEngine.soltarNotaLibre(midi), 1500);
    });
  }

  // ------------------------------------------------------------ Afinador
  let afi = {};
  let afiBucle = 0;
  let afiAnim = 0;
  let afiAguja = 0;
  let afiDestino = null;
  let afiHistorial = [];
  let afiUltima = 0;

  function construirAfinador() {
    const s = seccion("afinador", "Afinador");
    s.innerHTML =
      '<div class="barra-afi">' +
      '<canvas class="barra-afi-dial" width="560" height="290" aria-hidden="true"></canvas>' +
      '<div class="barra-afi-lectura"><b class="barra-afi-nota">—</b><span class="barra-afi-cents"></span></div>' +
      '<p class="barra-afi-msg" role="status" aria-live="polite">Canta una nota</p>' +
      "</div>";
    afi = {
      dial: s.querySelector("canvas"),
      nota: s.querySelector(".barra-afi-nota"),
      cents: s.querySelector(".barra-afi-cents"),
      msg: s.querySelector(".barra-afi-msg"),
      caja: s.querySelector(".barra-afi"),
    };
  }

  async function arrancarAfinador() {
    afi.msg.textContent = "Abriendo el micrófono…";
    afi.caja.dataset.nivel = "";
    try {
      await asegurarAudio();
      await asegurarDial();
      if (!window.MicrofonoEngine.disponible()) throw new Error("Este navegador no deja usar el micrófono aquí.");
      await window.MicrofonoEngine.iniciar();
    } catch (e) {
      if (panelAbierto !== "afinador") return;
      if (typeof dibujarDial === "function") dibujarDial(afi.dial, 0, false); // la aguja en reposo, aunque no haya micrófono
      const legible = window.MicrofonoEngine && window.MicrofonoEngine.errorLegible ? window.MicrofonoEngine.errorLegible(e) : e;
      afi.msg.textContent = `Sin micrófono: ${legible.message || legible}`;
      return;
    }
    if (panelAbierto !== "afinador") return;
    afi.msg.textContent = "Canta una nota";
    afiHistorial = [];
    afiDestino = null;
    clearInterval(afiBucle);
    // Lee del mismo micrófono que el resto de la página, sin quitarle la escucha a ningún ejercicio.
    afiBucle = setInterval(leerAfinador, 40);
    cancelAnimationFrame(afiAnim);
    afiAnim = requestAnimationFrame(animarAfinador);
  }

  function pararAfinador() {
    clearInterval(afiBucle);
    cancelAnimationFrame(afiAnim);
    afiBucle = 0;
    afiDestino = null;
  }

  function nivel(c) {
    const a = Math.abs(c);
    return a <= 10 ? "bien" : a <= 25 ? "casi" : "lejos";
  }

  function leerAfinador() {
    const ahora = performance.now();
    const lectura = window.MicrofonoEngine && window.MicrofonoEngine.leerPitch ? window.MicrofonoEngine.leerPitch() : null;
    if (!lectura) {
      // Un respiro entre sílabas: la aguja no parpadea con cada hueco.
      if (afiUltima && ahora - afiUltima < 400) return;
      afiHistorial = [];
      afiDestino = null;
      afi.caja.dataset.nivel = "";
      afi.msg.textContent = "Canta una nota";
      afi.cents.textContent = "";
      return;
    }
    afiUltima = ahora;
    const exacto = 69 + 12 * Math.log2(lectura.frecuencia / 440);
    afiHistorial.push(exacto);
    if (afiHistorial.length > 5) afiHistorial.shift();
    const orden = afiHistorial.slice().sort((a, b) => a - b);
    const mediana = orden[Math.floor(orden.length / 2)];
    const cercana = Math.round(mediana);
    const cents = (mediana - cercana) * 100;
    afiDestino = cents;
    const n = nivel(cents);
    afi.caja.dataset.nivel = n;
    afi.nota.textContent = nombreNota(cercana);
    afi.cents.textContent = `${cents > 0 ? "+" : ""}${Math.round(cents)} ¢`;
    afi.msg.textContent = n === "bien" ? "¡Afinado!" : cents < 0 ? (n === "casi" ? "Sube un poquito ↑" : "Sube ↑") : n === "casi" ? "Baja un poquito ↓" : "Baja ↓";
  }

  function animarAfinador() {
    if (panelAbierto !== "afinador") return;
    afiAguja += ((afiDestino === null ? 0 : afiDestino) - afiAguja) * (afiDestino === null ? 0.15 : 0.25);
    if (typeof dibujarDial === "function") dibujarDial(afi.dial, afiAguja, afiDestino !== null);
    afiAnim = requestAnimationFrame(animarAfinador);
  }

  // ------------------------------------------------------------ Metrónomo (el único de la web)
  let met = {};
  let motorConectado = false;

  function bpmGuardado() {
    if (window.MetronomoEngine && window.MetronomoEngine.bpmCompartido) return window.MetronomoEngine.bpmCompartido();
    const g = parseInt(leer(CLAVE_BPM), 10);
    return g >= 40 && g <= 350 ? g : 100;
  }

  function construirMetronomo() {
    const s = seccion("metronomo", "Metrónomo");
    const caja = crear("div", "barra-met");
    met.toggle = boton("boton principal barra-met-toggle", "▶", "Arrancar el metrónomo");
    met.menos = boton("paso", "−", "Más lento");
    met.valor = crear("strong", "paso-valor barra-met-bpm", "100");
    met.mas = boton("paso", "+", "Más rápido");
    const unidad = crear("span", "barra-met-unidad", "BPM");
    met.punto = crear("i", "barra-met-punto");
    met.punto.setAttribute("aria-hidden", "true");
    met.dueno = crear("p", "barra-met-dueno");
    const pasos = crear("div", "stepper barra-met-pasos");
    pasos.append(met.menos, met.valor, met.mas);
    caja.append(met.toggle, pasos, unidad, met.punto);
    s.append(caja, met.dueno);

    met.toggle.addEventListener("click", async () => {
      try {
        await asegurarAudio();
      } catch {
        return;
      }
      const motor = window.MetronomoEngine;
      if (motor.enMarcha()) {
        motor.detener(); // para el que suene, sea de quien sea: hay uno solo
      } else {
        motor.ajustarVolumen(0.7);
        motor.iniciar(limitar(bpmGuardado(), BPM_MIN, BPM_MAX), 0, null, "barra");
      }
      pintarMetronomo();
    });
    const paso = (d) => async () => {
      const motor = window.MetronomoEngine;
      const e = motor && motor.estado ? motor.estado() : null;
      const base = e && e.activo ? e.bpm : bpmGuardado();
      const nuevo = limitar(base + d, BPM_MIN, BPM_MAX);
      if (motor) motor.fijarBpmCompartido(nuevo);
      else guardar(CLAVE_BPM, String(nuevo));
      pintarMetronomo();
    };
    met.menos.addEventListener("click", paso(-5));
    met.mas.addEventListener("click", paso(5));
  }

  const NOMBRE_DUENO = { solfeo: "Solfeo", ritmo: "Ritmo", rutina: "Rutina", sostener: "Sostener", cifrado: "Cifrado", "ritmo-ruleta": "la ruleta de Ritmo" };

  function pintarMetronomo() {
    const motor = window.MetronomoEngine;
    const e = motor && motor.estado ? motor.estado() : { activo: false, bpm: bpmGuardado(), dueno: null };
    const ejercicio = e.activo && (e.dueno === "cifrado" || e.dueno === "ritmo-ruleta");
    met.toggle.textContent = e.activo ? "⏹" : "▶";
    met.toggle.setAttribute("aria-label", e.activo ? "Parar el metrónomo" : "Arrancar el metrónomo");
    met.toggle.classList.toggle("en-marcha", e.activo);
    met.valor.textContent = String(e.activo ? e.bpm : limitar(bpmGuardado(), BPM_MIN, BPM_MAX));
    met.menos.disabled = ejercicio;
    met.mas.disabled = ejercicio;
    met.dueno.textContent = e.activo && e.dueno && e.dueno !== "barra" ? `Suena el de ${NOMBRE_DUENO[e.dueno] || "esta página"}` : "";
    raiz.classList.toggle("met-en-marcha", Boolean(e.activo));
  }

  function latir() {
    raiz.querySelectorAll(".barra-punto, .barra-met-punto").forEach((p) => {
      p.classList.remove("late");
      void p.offsetWidth; // reinicia la animación en cada pulso
      p.classList.add("late");
    });
  }

  function conectarMotor() {
    if (motorConectado || !window.MetronomoEngine || !window.MetronomoEngine.alCambiar) return;
    motorConectado = true;
    window.MetronomoEngine.alCambiar(pintarMetronomo);
    window.MetronomoEngine.alPulso(latir);
    pintarMetronomo();
  }

  // ------------------------------------------------------------ Piano (2 octavas de tu rango)
  let teclado;

  function construirPiano() {
    // Cifrado ya tiene su piano flotante (escribe notas en la letra): se integra en la barra en vez de duplicarlo.
    const cuerpo = document.getElementById("pianoFlotanteCuerpo");
    const toggle = document.getElementById("btnPianoFlotanteToggle");
    const flotante = document.getElementById("pianoFlotante");
    if (cuerpo && toggle && flotante) {
      pianoDePagina = { cuerpo, toggle, flotante };
      document.body.classList.add("barra-piano-pagina");
      paneles.appendChild(cuerpo);
      secciones.piano = cuerpo;
      // El estado plegado/desplegado lo sigue guardando Cifrado; la barra solo lo refleja.
      new MutationObserver(() => {
        const visible = !cuerpo.hidden;
        if (visible && panelAbierto !== "piano") {
          if (panelAbierto) cerrarPanel();
          panelAbierto = "piano";
          botones.piano.classList.add("activo");
          botones.piano.setAttribute("aria-expanded", "true");
        } else if (!visible && panelAbierto === "piano") {
          panelAbierto = null;
          botones.piano.classList.remove("activo");
          botones.piano.setAttribute("aria-expanded", "false");
        }
        if (raiz._medir) raiz._medir();
      }).observe(cuerpo, { attributes: true, attributeFilter: ["hidden"] });
      if (!cuerpo.hidden) {
        panelAbierto = "piano";
        botones.piano.classList.add("activo");
        botones.piano.setAttribute("aria-expanded", "true");
      }
      seguirTecladoDelMovil();
      return;
    }
    const s = seccion("piano", "Piano");
    teclado = crear("div", "barra-teclado");
    s.appendChild(teclado);
    const pulsadas = new Map(); // pointerId -> midi
    const soltar = (id) => {
      const midi = pulsadas.get(id);
      if (midi === undefined) return;
      pulsadas.delete(id);
      const t = teclado.querySelector(`[data-midi="${midi}"]`);
      if (t && ![...pulsadas.values()].includes(midi)) t.classList.remove("pulsada");
      if (window.PianoEngine) window.PianoEngine.soltarNotaLibre(midi);
    };
    teclado.addEventListener("pointerdown", async (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const t = e.target.closest("[data-midi]");
      if (!t) return;
      e.preventDefault();
      const midi = parseInt(t.dataset.midi, 10);
      pulsadas.set(e.pointerId, midi);
      t.classList.add("pulsada");
      try {
        await asegurarAudio();
      } catch {
        return;
      }
      window.PianoEngine.iniciarNotaLibre(midi, 0.8);
      if (!pulsadas.has(e.pointerId)) window.PianoEngine.soltarNotaLibre(midi);
    });
    ["pointerup", "pointercancel"].forEach((ev) => window.addEventListener(ev, (e) => soltar(e.pointerId)));
    teclado.addEventListener("pointerleave", (e) => soltar(e.pointerId));
    teclado.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function pintarTeclas() {
    if (!teclado) return;
    const r = rango();
    let inicio = r.clave === "completo" ? 48 : r.midiMin;
    while (ES_NEGRA.has(((inicio % 12) + 12) % 12)) inicio--;
    let fin = inicio + 24;
    if (ES_NEGRA.has(fin % 12)) fin++;
    if (teclado.dataset.desde === String(inicio)) return;
    teclado.dataset.desde = String(inicio);
    teclado.textContent = "";
    for (let m = inicio; m <= fin; m++) {
      if (ES_NEGRA.has(m % 12)) continue;
      const blanca = crear("div", "barra-tecla blanca");
      blanca.dataset.midi = String(m);
      blanca.setAttribute("role", "button");
      blanca.setAttribute("aria-label", nombreNota(m));
      if (m % 12 === 0 || m === r.midiMin) blanca.appendChild(crear("span", "barra-tecla-nombre", nombreNota(m)));
      if (m === r.midiMin) blanca.classList.add("inicio-rango");
      if (m + 1 <= fin && ES_NEGRA.has((m + 1) % 12)) {
        const negra = crear("div", "barra-tecla negra");
        negra.dataset.midi = String(m + 1);
        negra.setAttribute("role", "button");
        negra.setAttribute("aria-label", nombreNota(m + 1));
        blanca.appendChild(negra);
      }
      teclado.appendChild(blanca);
    }
  }

  // Cifrado en el móvil: al escribir en la letra sale el teclado del sistema y tapa lo que esté fijo abajo. La barra
  // (con el piano de Cifrado dentro) sube justo encima de él y se compacta. Lo mismo que hacía el piano flotante.
  function seguirTecladoDelMovil() {
    const vv = window.visualViewport;
    if (!vv) return;
    const ajustar = () => {
      const tapado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const abierto = tapado > 120;
      raiz.style.bottom = abierto ? `${tapado}px` : "";
      raiz.classList.toggle("compacta", abierto);
    };
    vv.addEventListener("resize", ajustar);
    vv.addEventListener("scroll", ajustar);
  }

  // ------------------------------------------------------------ arranque
  function iniciar() {
    if (document.getElementById("barraComun")) return;
    construir();
    conectarMotor();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
  // Si audio.js de la página llega después que la barra, se conecta en cuanto avisa.
  window.addEventListener("piano-engine-listo", conectarMotor);
  window.addEventListener("load", conectarMotor);

  window.BarraComun = { abrir: abrirPanel, cerrar: cerrarPanel, plegar: () => fijarAbierta(false), desplegar: () => fijarAbierta(true) };
})();
