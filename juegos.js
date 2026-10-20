/*
 * juegos.js — Juegos de entrenamiento con la voz y el ritmo (no son un pasatiempo: cada uno trabaja una cosa).
 *
 *  🎯 Pasillo      — afinación: la bola sube y baja con tu voz y tienes que pasar por el hueco de cada puerta
 *                    (la nota objetivo). Entrena cantar la nota exacta y sostenerla.
 *  🕹️ Plataformas — escala completa: el héroe corre solo y cada GRADO de la escala es una acción
 *                    (agacharse, saltos de 3 alturas, atacar, escudo, embestida). Cada obstáculo muestra la nota que lo
 *                    resuelve: entrena a ir a un grado concreto de la escala a voluntad y en el momento justo.
 *  🥁 Eco de ritmo — suena un patrón y lo repites (con la voz «ta», palmas o tocando); mide cuántos ms te desvías.
 *
 * Usa el micrófono y el rango vocal ya elegidos en la barra de arriba (audio.js / app-shell.js).
 * Sin micrófono se puede jugar con un piano MIDI (o el de pantalla / teclado del ordenador) o con el teclado (↑↓ para la altura, 1 a 7 para las acciones, Espacio para el ritmo).
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const ESCALAS = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], pentatonica: [0, 2, 4, 7, 9] };

  // ---- ortografía musical correcta: cada grado de la escala lleva una LETRA distinta (Do Re Mi Fa Sol La Si) y la
  // alteración (# o b) que haga falta. Do menor es Do Re Mib Fa Sol Lab Sib, no «Do Re Re# Fa Sol Sol# La#».
  const LETRAS = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
  const NATURAL = [0, 2, 4, 5, 7, 9, 11];
  // tónica de cada tonalidad según la clase de nota: [índice de letra, alteración] (la grafía habitual: Reb, Mib, Lab, Sib…)
  const TONICA_MAYOR = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  const TONICA_MENOR = [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0]];
  const LETRA_DE_GRADO = { mayor: [0, 1, 2, 3, 4, 5, 6], menor: [0, 1, 2, 3, 4, 5, 6], pentatonica: [0, 1, 2, 4, 5] };
  const FALLBACK_SOSTENIDOS = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
  const FALLBACK_BEMOLES = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
  const sufijoAlt = (a) => (a === 1 ? "#" : a === -1 ? "b" : a === 2 ? "x" : a === -2 ? "bb" : "");
  const NOMBRES = FALLBACK_SOSTENIDOS.map(([l, a]) => LETRAS[l] + sufijoAlt(a)); // sin contexto de tonalidad
  let _ortoClave = "";
  let _orto = null;
  /** Mapa clase de nota → [letra, alteración] para la escala y tónica elegidas (con caché). */
  function ortografia() {
    const clave = `${config.notacion}|${config.escala}|${config.tonica}`;
    if (clave === _ortoClave && _orto) return _orto;
    if (config.notacion !== "teorica") {
      // notación simple (sostenidos) o «ambas» (Re#/Mib): las dos usan el mismo mapa de sostenidos
      _ortoClave = clave;
      _orto = { mapa: {}, bemoles: false };
      return _orto;
    }
    const menor = config.escala === "menor";
    const tp = mod12(config.tonica);
    const [li] = (menor ? TONICA_MENOR : TONICA_MAYOR)[tp];
    const pasos = ESCALAS[config.escala] || ESCALAS.mayor;
    const letraDeGrado = LETRA_DE_GRADO[config.escala] || LETRA_DE_GRADO.mayor;
    const mapa = {};
    let bem = 0;
    let sos = 0;
    pasos.forEach((p, i) => {
      const l = (li + letraDeGrado[i]) % 7;
      const pc = mod12(tp + p);
      const a = ((pc - NATURAL[l] + 18) % 12) - 6;
      mapa[pc] = [l, a];
      if (a < 0) bem += 1;
      if (a > 0) sos += 1;
    });
    _ortoClave = clave;
    _orto = { mapa, bemoles: bem > sos };
    return _orto;
  }
  /** Nombre de una clase de nota (sin octava) en la tonalidad elegida. */
  const NEGRAS_DOBLES = [null, ["Do#", "Reb"], null, ["Re#", "Mib"], null, null, ["Fa#", "Solb"], null, ["Sol#", "Lab"], null, ["La#", "Sib"], null];
  function nombreClase(pc) {
    if (config.notacion === "ambas" && NEGRAS_DOBLES[mod12(pc)]) return NEGRAS_DOBLES[mod12(pc)].join("/");
    const o = ortografia();
    const [l, a] = o.mapa[mod12(pc)] || (o.bemoles ? FALLBACK_BEMOLES : FALLBACK_SOSTENIDOS)[mod12(pc)];
    return LETRAS[l] + sufijoAlt(a);
  }
  /** Nombre de la nota con octava (Do4 = Do central) escrito como corresponde a la tonalidad. */
  /** Margen de afinación para dar una nota por buena (en cents; 100 = un semitono). */
  const TOLERANCIA_CENTS = 20;
  const nombreNota = (m) => {
    const r = Math.round(m);
    if (config.notacion === "ambas" && NEGRAS_DOBLES[mod12(r)]) return NEGRAS_DOBLES[mod12(r)].join("/") + (Math.floor(r / 12) - 1);
    const o = ortografia();
    const [l, a] = o.mapa[mod12(r)] || (o.bemoles ? FALLBACK_BEMOLES : FALLBACK_SOSTENIDOS)[mod12(r)];
    return LETRAS[l] + sufijoAlt(a) + (Math.floor((r - a) / 12) - 1);
  };
  /** Nombre de la tónica i (0–11) según el modo elegido: en menor Mib menor, en mayor Mib mayor… */
  function nombreTonica(i) {
    if (config.notacion === "ambas" && NEGRAS_DOBLES[mod12(i)]) return NEGRAS_DOBLES[mod12(i)].join("/");
    if (config.notacion !== "teorica") return NOMBRES[mod12(i)];
    const [l, a] = (config.escala === "menor" ? TONICA_MENOR : TONICA_MAYOR)[mod12(i)];
    return LETRAS[l] + sufijoAlt(a);
  }
  const NOMBRE_ESCALA = { mayor: "mayor", menor: "menor", pentatonica: "pentatónica" };

  // ---------------------------------------------------------------- configuración que se recuerda
  const CLAVE_CONFIG = "aleran-juegos-config";
  const config = Object.assign(
    { velocidad: "lento", escala: "mayor", tonica: 0, octava: "exacta", guia: "si", ritmoBpm: 70, ritmoNivel: 1, juego: "pasillo", plataformaNivel: "medio", notacion: "ambas", plataformaMapa: "0", entrada: "todo" },
    (() => {
      try {
        return JSON.parse(localStorage.getItem(CLAVE_CONFIG) || "{}");
      } catch {
        return {};
      }
    })()
  );
  function guardarConfig() {
    try {
      localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config));
    } catch {
      /* sin consecuencias */
    }
  }

  // ---------------------------------------------------------------- rango vocal elegido
  function rangoActual() {
    let min = 48;
    let max = 72;
    if (window.RangoVocal) {
      const r = window.RangoVocal.obtener();
      if (r && Number.isFinite(r.midiMin)) {
        min = r.midiMin;
        max = r.midiMax;
      }
    }
    if (max - min < 9) max = min + 9;
    if (max - min > 30) max = min + 30;
    return [min, max];
  }

  // ---------------------------------------------------------------- piano (MIDI, teclado de pantalla y teclado del ordenador)
  const Piano = {
    notas: [], // notas sostenidas, la última pulsada manda
    activo: false,
    midiNombre: "",
    entradasMidi: [],
    teclasPc: {},
    pulsadasPantalla: new Set(),
    marcas: {},
    nota() {
      return this.notas.length ? this.notas[this.notas.length - 1] : null;
    },
    tocar(m) {
      if (!this.notas.includes(m)) this.notas.push(m);
      tocarNota(m, 0.6);
      this.refrescar();
      if (config.juego === "ritmo" && juego && j_registrar) j_registrar(performance.now());
    },
    soltar(m) {
      this.notas = this.notas.filter((x) => x !== m);
      this.refrescar();
    },
    soltarTodas() {
      this.notas = [];
      this.refrescar();
    },
    refrescar() {
      const cont = $("pianoJuego");
      if (!cont) return;
      cont.querySelectorAll("[data-midi]").forEach((k) => {
        const m = Number(k.dataset.midi);
        k.classList.toggle("pulsada", this.notas.includes(m));
        const marca = this.marcas[m];
        k.style.setProperty("--marca", marca || "transparent");
        k.classList.toggle("marcada", Boolean(marca));
      });
    },
    marcar(mapa) {
      const firma = JSON.stringify(mapa || {});
      if (firma === this._firma) return;
      this._firma = firma;
      this.marcas = mapa || {};
      this.refrescar();
    },
    construir() {
      let cont = $("pianoJuego");
      if (!cont) {
        cont = document.createElement("div");
        cont.id = "pianoJuego";
        const lienzoCont = document.querySelector(".lienzo-juego");
        lienzoCont.parentNode.insertBefore(cont, lienzoCont.nextSibling);
        const css = document.createElement("style");
        css.textContent = `
          #pianoJuego{position:relative;margin:10px 0 2px;width:100%;max-width:100%;box-sizing:border-box}
          #pianoJuego .scroll{overflow-x:auto;padding-bottom:4px}
          #pianoJuego .teclas{position:relative;height:104px;margin:0 auto}
          #pianoJuego .blanca{position:absolute;top:0;height:104px;background:#efe6e0;border:1px solid #20161a;border-radius:0 0 6px 6px;box-sizing:border-box;
            color:#3a2a30;font:700 11px/1 'Work Sans',sans-serif;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;cursor:pointer;user-select:none;touch-action:none}
          #pianoJuego .negra{position:absolute;top:0;height:64px;background:#1a1216;border:1px solid #000;border-radius:0 0 4px 4px;z-index:2;cursor:pointer;box-sizing:border-box;
            color:#e8dde2;font:700 9px/1.15 'Work Sans',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:4px;user-select:none;touch-action:none}
          #pianoJuego .negra .b{color:#a8c8ff;font-weight:600}
          #pianoJuego .marcada{box-shadow:inset 0 -6px 0 var(--marca)}
          #pianoJuego .blanca.pulsada{background:#ff8fa3}
          #pianoJuego .negra.pulsada{background:#c02241}
          #pianoJuego .estado-midi{font-size:12px;color:#a8998f;margin-top:6px;line-height:1.4}
        `;
        document.head.appendChild(css);
      }
      // Solo DOS octavas (la 4 y la 5; la 3 y la 4 si la voz es grave): más claro y con teclas grandes.
      const [lo, hi] = rangoActual();
      let centro = (lo + hi) / 2;
      const notasJuego = juego && juego.notasPiano ? juego.notasPiano() : null;
      let inicioOct = centro < 58 ? 3 : 4;
      if (notasJuego && notasJuego.length) {
        const mn = Math.min(...notasJuego);
        const mx = Math.max(...notasJuego);
        while (mn < (inicioOct + 1) * 12 && inicioOct > 1) inicioOct -= 1;
        while (mx > (inicioOct + 3) * 12 && inicioOct < 6) inicioOct += 1;
      }
      const desde = (inicioOct + 1) * 12; // Do de la octava inicial (Do4 = 60)
      const hasta = desde + 24; // dos octavas completas + el Do siguiente
      const blancasEnRango = [];
      for (let m = desde; m <= hasta; m++) if (![1, 3, 6, 8, 10].includes(mod12(m))) blancasEnRango.push(m);
      const ANCHO = 44; // ancho de una tecla blanca
      cont.innerHTML = `<div class="scroll"><div class="teclas" style="width:${blancasEnRango.length * ANCHO}px"></div></div><div class="estado-midi" id="pianoEstado"></div>`;
      const fila = cont.querySelector(".teclas");
      const nBlancas = new Map();
      blancasEnRango.forEach((m, i) => {
        nBlancas.set(m, i);
        const k = document.createElement("div");
        k.className = "blanca";
        k.dataset.midi = String(m);
        k.style.left = `${i * ANCHO}px`;
        k.style.width = `${ANCHO}px`;
        const nom = LETRAS[NATURAL.indexOf(mod12(m))];
        k.textContent = mod12(m) === 0 ? nom + (Math.floor(m / 12) - 1) : nom;
        fila.appendChild(k);
      });
      for (let m = desde; m <= hasta; m++) {
        if (![1, 3, 6, 8, 10].includes(mod12(m))) continue;
        const izq = nBlancas.get(m - 1);
        if (izq === undefined) continue;
        const [sost, bem] = NEGRAS_DOBLES[mod12(m)];
        const n = document.createElement("div");
        n.className = "negra";
        n.dataset.midi = String(m);
        n.style.width = `${Math.round(ANCHO * 0.62)}px`;
        n.style.left = `${(izq + 1) * ANCHO - Math.round(ANCHO * 0.31)}px`;
        n.innerHTML = `<span>${sost}</span><span class="b">${bem}</span>`;
        fila.appendChild(n);
      }
      const alPulsar = (e) => {
        const k = e.target.closest("[data-midi]");
        if (!k) return;
        e.preventDefault();
        const m = Number(k.dataset.midi);
        this.pulsadasPantalla.add(m);
        this.tocar(m);
      };
      const alSoltar = () => {
        this.pulsadasPantalla.forEach((m) => this.soltar(m));
        this.pulsadasPantalla.clear();
      };
      fila.onpointerdown = alPulsar;
      if (!this._escuchasGlobales) {
        window.addEventListener("pointerup", alSoltar);
        window.addEventListener("pointercancel", alSoltar);
        this._escuchasGlobales = true;
      }
      this._desde = desde;
      cont.style.display = "block";
      this.refrescar();
    },
    ocultar() {
      const cont = $("pianoJuego");
      if (cont) cont.style.display = "none";
    },
    async iniciar() {
      this.activo = true;
      this.construir();
      const info = $("pianoEstado");
      const pon = (txt) => {
        if (info) info.textContent = txt;
      };
      pon("Toca las teclas de pantalla o del ordenador (A S D F G H J K · W E T Y U). Buscando un piano MIDI…");
      if (!navigator.requestMIDIAccess) {
        pon("Este navegador no tiene MIDI: usa el piano de pantalla o el teclado del ordenador (A S D F G H J K · W E T Y U).");
        return;
      }
      try {
        const acceso = await navigator.requestMIDIAccess();
        const conectar = () => {
          const entradas = Array.from(acceso.inputs.values());
          entradas.forEach((e) => {
            e.onmidimessage = (ev) => {
              if (document.hidden) return;
              const [estado, nota, vel] = ev.data;
              const tipo = estado & 0xf0;
              if (tipo === 0x90 && vel > 0) this.tocar(nota);
              else if (tipo === 0x80 || (tipo === 0x90 && vel === 0)) this.soltar(nota);
            };
          });
          this.entradasMidi = entradas;
          const nombres = Array.from(new Set(entradas.map((e) => e.name.replace(/\s*\(.*\)\s*$/, "").replace(/^MIDIIN\d+\s*/i, "").trim() || e.name)));
          pon(
            entradas.length
              ? `🎹 MIDI conectado: ${nombres[0]}${entradas.length > 1 ? ` (${entradas.length} puertos)` : ""}. También puedes tocar el piano de pantalla o el teclado del ordenador.`
              : "No veo ningún piano MIDI conectado: usa el piano de pantalla o el teclado del ordenador (A S D F G H J K · W E T Y U)."
          );
        };
        conectar();
        acceso.onstatechange = conectar;
      } catch (err) {
        pon("No pude abrir el MIDI (" + (err && err.name ? err.name : "permiso") + "): usa el piano de pantalla o el teclado del ordenador.");
      }
    },
    detener() {
      this.entradasMidi.forEach((e) => (e.onmidimessage = null));
      this.entradasMidi = [];
      this.soltarTodas();
      this.activo = false;
    },
  };
  // teclado del ordenador como piano (A S D F G H J K = Do Re Mi Fa Sol La Si Do; W E T Y U = sostenidos)
  const MAPA_TECLAS_PIANO = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15 };
  function baseTeclasPiano() {
    if (Piano._desde !== undefined) return Piano._desde; // el Do de la izquierda del piano de pantalla
    const [lo, hi] = rangoActual();
    return Math.round(((lo + hi) / 2 - 6) / 12) * 12;
  }

  // ---------------------------------------------------------------- entrada de tono (micrófono, teclado o piano)
  const Tono = {
    activo: false,
    midi: null,
    t: 0,
    simulado: null, // altura virtual (teclado o pruebas)
    teclas: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false },
    async iniciar() {
      const e = config.entrada;
      const usaPiano = e === "piano" || e === "todo";
      const usaMic = e === "mic" || e === "todo";
      if (usaPiano) Piano.iniciar(); // sin esperar: el aviso de permiso MIDI no debe retrasar el juego
      else Piano.ocultar();
      if (e === "teclado") {
        if (this.simulado === null) this.simulado = (rangoActual()[0] + rangoActual()[1]) / 2;
        return true;
      }
      if (!usaMic) return true;
      if (this.activo) return true;
      if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) return e === "todo";
      try {
        await window.MicrofonoEngine.iniciar();
      } catch (err) {
        if (e === "todo") return true; // con «Todo» el piano y el teclado siguen funcionando aunque el micro falle
        throw err;
      }
      Medidor.reiniciar();
      window.MicrofonoEngine.escucharContinuo((l) => {
        if (l) {
          this.midi = l.midiExacto;
          this.t = performance.now();
        }
      });
      this.activo = true;
      return true;
    },
    detener() {
      if (this.activo && window.MicrofonoEngine) window.MicrofonoEngine.detenerContinuo();
      this.activo = false;
      this.midi = null;
      Piano.detener();
    },
    /** Volumen instantáneo (RMS 0–1) de lo que llega por el micrófono elegido, o null si no hay micrófono abierto. */
    nivel() {
      const an = window.MicrofonoEngine && window.MicrofonoEngine.obtenerAnalizador && window.MicrofonoEngine.obtenerAnalizador();
      if (!an) return null;
      if (!this._bufNivel || this._bufNivel.length !== an.fftSize) this._bufNivel = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(this._bufNivel);
      let s = 0;
      for (let i = 0; i < this._bufNivel.length; i++) s += this._bufNivel[i] * this._bufNivel[i];
      return Math.sqrt(s / this._bufNivel.length);
    },
    /** Altura actual en semitonos (decimal), o null si no hay voz. */
    leer() {
      if (config.entrada === "piano") return Piano.nota();
      if (config.entrada === "teclado") return this.simulado;
      if (config.entrada === "todo") {
        const pn = Piano.nota(); // si hay una tecla pulsada manda; si no, la voz
        if (pn !== null) return pn;
      }
      return this.midi !== null && performance.now() - this.t < 220 ? this.midi : null;
    },
  };

  // ---------------------------------------------------------------- medidor del micrófono (para saber QUÉ oye el juego)
  const Medidor = {
    el: null,
    inicio: 0,
    ultimoSonido: 0,
    ultimaNota: 0,
    nombreDispositivo() {
      try {
        const v = JSON.parse(localStorage.getItem("aleran-mic-dispositivo") || "null");
        if (v && v.nombre) return v.nombre.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "");
      } catch {
        /* sin nombre */
      }
      return "el micrófono predeterminado";
    },
    construir() {
      if (this.el) return this.el;
      const e = document.createElement("div");
      e.id = "medidorMic";
      e.innerHTML =
        '<div class="mm-fila"><span class="mm-nombre" id="mmNombre"></span><div class="mm-barra"><i id="mmBarra"></i></div><span class="mm-nota" id="mmNota">—</span></div>' +
        '<div class="mm-msg" id="mmMsg"></div>';
      const ref = document.querySelector(".lienzo-juego");
      ref.parentNode.insertBefore(e, ref.nextSibling);
      const css = document.createElement("style");
      css.textContent = `
        #medidorMic{margin:8px 0 2px;padding:8px 10px;border:1px solid #322423;border-radius:10px;background:#151010}
        #medidorMic .mm-fila{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        #medidorMic .mm-nombre{font-size:12px;color:#a8998f;max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        #medidorMic .mm-barra{flex:1;min-width:90px;height:10px;border-radius:6px;background:#2a1d1f;overflow:hidden}
        #medidorMic .mm-barra i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3ecf6e,#c02241);transition:width .08s}
        #medidorMic .mm-nota{font:700 15px Consolas,monospace;min-width:74px;text-align:right;color:#efe6e0}
        #medidorMic .mm-msg{font-size:12.5px;margin-top:6px;color:#a8998f;min-height:1em}
        #medidorMic .mm-msg.mal{color:#ff8d9a}
        #medidorMic .mm-msg.ok{color:#7dffa8}
      `;
      document.head.appendChild(css);
      this.el = e;
      return e;
    },
    ocultar() {
      if (this.el) this.el.style.display = "none";
    },
    tick() {
      if ((config.entrada !== "mic" && config.entrada !== "todo") || !Tono.activo) {
        this.ocultar();
        return;
      }
      const e = this.construir();
      e.style.display = "block";
      const ahora = performance.now();
      if (!this.inicio) this.inicio = ahora;
      const rms = Tono.nivel();
      const nota = Tono.leer();
      if (rms !== null && rms > 0.008) this.ultimoSonido = ahora;
      if (nota !== null) this.ultimaNota = ahora;
      $("mmNombre").textContent = "🎤 " + this.nombreDispositivo();
      $("mmBarra").style.width = Math.min(100, Math.round((rms || 0) * 600)) + "%";
      $("mmNota").textContent = nota !== null ? nombreNota(nota) : "—";
      const msg = $("mmMsg");
      let texto = "";
      let tipo = "";
      if (ahora - this.inicio > 2500 && ahora - this.ultimoSonido > 2500) {
        texto = `⚠ No oigo ningún sonido por «${this.nombreDispositivo()}». Si cantas por otro micrófono, elígelo en el chip 🎤 de arriba (en Voicemeeter, «Out B1» suele llevar el audio del PC, no tu micro).`;
        tipo = "mal";
      } else if (ahora - this.inicio > 4000 && ahora - this.ultimaNota > 4000 && ahora - this.ultimoSonido < 1500) {
        texto = "Oigo sonido pero no una nota clara: canta una vocal sostenida («aaa») o acércate un poco al micrófono.";
        tipo = "mal";
      } else if (nota !== null) {
        texto = "✔ Te oigo bien.";
        tipo = "ok";
      } else {
        texto = "Canta una nota para comprobarlo.";
      }
      msg.textContent = texto;
      msg.className = "mm-msg " + tipo;
    },
    reiniciar() {
      this.inicio = performance.now();
      this.ultimoSonido = 0;
      this.ultimaNota = 0;
    },
  };
  setInterval(() => Medidor.tick(), 120);

  // ---------------------------------------------------------------- sonidos
  function contexto() {
    return typeof obtenerContexto === "function" ? obtenerContexto() : null;
  }
  function clic(tiempoCtx, agudo, volumen = 0.5) {
    const ctx = contexto();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = agudo ? 1800 : 1100;
    g.gain.setValueAtTime(volumen, tiempoCtx);
    g.gain.exponentialRampToValueAtTime(0.001, tiempoCtx + 0.06);
    osc.connect(g).connect(ctx.destination);
    osc.start(tiempoCtx);
    osc.stop(tiempoCtx + 0.08);
  }
  function tocarNota(midi, dur = 0.7) {
    try {
      if (window.PianoEngine) window.PianoEngine.reproducirSecuencia([{ midi: Math.round(midi), duracion: dur }], 0.8, {});
    } catch {
      /* sin sonido de guía: el juego sigue */
    }
  }

  // ---------------------------------------------------------------- lienzo y bucle
  const lienzo = $("lienzo");
  const ctx2d = lienzo.getContext("2d");
  const W = lienzo.width;
  const H = lienzo.height;
  let juego = null; // el juego en marcha
  let rafId = null;
  let ultimoTs = 0;

  function bucle(ts) {
    const dt = Math.min(0.05, (ts - ultimoTs) / 1000 || 0.016);
    ultimoTs = ts;
    const g = juego; // el juego puede detenerse a sí mismo al terminar (juego pasa a null)
    if (g) {
      g.actualizar(dt);
      g.dibujar(ctx2d);
      if ((config.entrada === "piano" || config.entrada === "todo") && g.marcasPiano) Piano.marcar(g.marcasPiano());
    }
    if (juego && !g.terminado) rafId = requestAnimationFrame(bucle);
    else rafId = null;
  }

  function arrancar(nuevo) {
    detener(false);
    juego = nuevo;
    if ((config.entrada === "piano" || config.entrada === "todo") && Piano.activo) Piano.construir();
    Arte.particulas.length = 0;
    $("btnJugar").disabled = true;
    $("btnParar").disabled = false;
    ultimoTs = performance.now();
    if (!window.__JUEGOS_MANUAL) rafId = requestAnimationFrame(bucle);
  }

  function detener(mostrarMensaje) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (juego && mostrarMensaje) estado("Juego detenido.");
    juego = null;
    $("btnJugar").disabled = false;
    $("btnParar").disabled = true;
  }

  function estado(texto, tipo) {
    const e = $("juegoEstado");
    e.textContent = texto;
    e.dataset.tipo = tipo || "";
  }

  function fondo(ctx, color = "#0d0b0b") {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
  }

  // ================================================================ arte compartido (pixel art sencillo, sin imágenes)
  const Arte = {
    estrellas: Array.from({ length: 70 }, (_, i) => ({ x: (i * 97 + 13) % 640, y: (i * 53 + 7) % 270, r: i % 5 === 0 ? 2 : 1, f: i * 0.73 })),
    particulas: [],
    cielo(ctx, t, c1, c2) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // nebulosas suaves que derivan despacio
      for (let k = 0; k < 3; k++) {
        const nx = ((k * 260 + t * (6 + k * 3)) % (W + 300)) - 150;
        const ny = 70 + k * 80 + Math.sin(t * 0.2 + k) * 14;
        const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 190);
        ng.addColorStop(0, k === 1 ? "rgba(147,23,44,0.20)" : "rgba(98,60,180,0.16)");
        ng.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ng;
        ctx.fillRect(nx - 190, ny - 190, 380, 380);
      }
      for (const e of this.estrellas) {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.75 * Math.abs(Math.sin(t * 0.9 + e.f))})`;
        ctx.fillRect(e.x, e.y, e.r, e.r);
      }
    },
    /** Resplandor suave (suma luz): sirve de halo para notas, gemas y personajes. */
    brillo(ctx, x, y, r, rgb, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = prev;
    },
    /** Oscurece los bordes: da sensación de pantalla de cine y centra la mirada. */
    vineta(ctx, fuerza = 0.5) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${fuerza})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
    luna(ctx, x, y, r, fondo) {
      ctx.fillStyle = "#f3e9ff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fondo;
      ctx.beginPath();
      ctx.arc(x + r * 0.45, y - r * 0.25, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    },
    montanas(ctx, desp, color, base, alto, paso, semilla) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) {
        const xx = x + desp;
        const y = base - alto * (0.55 + 0.45 * Math.sin((xx / paso) * 1.7 + semilla) * Math.cos((xx / paso) * 0.6 + semilla * 2));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    },
    /** Fija ctx.font al mayor tamaño (≤ tam) con el que `txt` cabe en `ancho` píxeles. */
    ajustar(ctx, txt, ancho, tam, familia = "Consolas, monospace") {
      let s = tam;
      ctx.font = `bold ${s}px ${familia}`;
      while (s > 7 && ctx.measureText(txt).width > ancho) {
        s -= 1;
        ctx.font = `bold ${s}px ${familia}`;
      }
    },
    texto(ctx, txt, x, y, tam, color, align = "left") {
      ctx.font = `900 ${tam}px "Segoe UI Black", Impact, sans-serif`;
      ctx.textAlign = align;
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(3, tam / 4);
      ctx.strokeStyle = "rgba(8,4,14,0.9)";
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = color;
      ctx.fillText(txt, x, y);
    },
    pastilla(ctx, x, y, w, h, color, borde) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(8, h / 2));
      ctx.fill();
      if (borde) {
        ctx.strokeStyle = borde;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },
    sprite(ctx, filas, paleta, x, y, s) {
      filas.forEach((fila, j) => {
        for (let i = 0; i < fila.length; i++) {
          const c = paleta[fila[i]];
          if (!c) continue;
          ctx.fillStyle = c;
          ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s);
        }
      });
    },
    emitir(x, y, n, color, vel = 110, vida = 0.7, grav = 160) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = vel * (0.35 + Math.random() * 0.65);
        this.particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, vida, v0: vida, c: color, g: grav, s: 2 + Math.floor(Math.random() * 3) });
      }
    },
    estela(x, y, color) {
      this.particulas.push({ x, y: y + (Math.random() - 0.5) * 6, vx: -45 - Math.random() * 30, vy: (Math.random() - 0.5) * 20, vida: 0.45, v0: 0.45, c: color, g: 0, s: 3 });
    },
    actualizar(dt) {
      for (const p of this.particulas) {
        p.vida -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.g * dt;
      }
      this.particulas = this.particulas.filter((p) => p.vida > 0).slice(-260);
    },
    dibujar(ctx) {
      for (const p of this.particulas) {
        ctx.globalAlpha = Math.max(0, p.vida / p.v0);
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      }
      ctx.globalAlpha = 1;
    },
  };

  // ================================================================ 🎯 PASILLO (afinación)
  function crearPasillo() {
    const [lo, hi] = rangoActual();
    const vmin = lo - 1.5;
    const vmax = hi + 1.5;
    const pasos = ESCALAS[config.escala];
    let notas = [];
    for (let m = lo; m <= hi; m++) if (pasos.includes(mod12(m - config.tonica))) notas.push(m);
    if (notas.length < 3) notas = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const v = { lento: 48, normal: 72, rapido: 100 }[config.velocidad];
    const separacion = { lento: 240, normal: 210, rapido: 190 }[config.velocidad];
    const TOTAL = 10;
    const BOLA_X = 120;
    const ANCHO_PUERTA = 58;
    const yDe = (m) => H - 26 - ((m - vmin) / (vmax - vmin)) * (H - 52);

    const puertas = [];
    let ultimaNota = null;
    for (let i = 0; i < TOTAL; i++) {
      let n;
      do {
        n = i === 0 ? notas.find((x) => mod12(x - config.tonica) === 0) || notas[0] : notas[Math.floor(Math.random() * notas.length)];
      } while (n === ultimaNota && notas.length > 1);
      ultimaNota = n;
      puertas.push({ x: W + 60 + i * separacion, nota: n, dentro: 0, ventana: 0, hecho: false, ok: false, guiaTocada: false, cantadas: [] });
    }
    let midiSuave = (lo + hi) / 2;
    let hayVoz = false;
    const resultados = [];
    let aviso = null; // {texto, ok, t}

    function diferencia(m, objetivo) {
      let d = m - objetivo;
      if (config.octava !== "exacta") d = ((d + 6) % 12 + 12) % 12 - 6; // cualquier octava: se compara con la más cercana
      return d;
    }

    const j = {
      terminado: false,
      marcasPiano() {
        const sig = puertas.find((q) => !q.hecho && q.x + ANCHO_PUERTA > BOLA_X - 10);
        return sig ? { [sig.nota]: "#ff3b6e" } : {};
      },
      notasPiano() {
        return notas.slice();
      },
      puertas,
      resultados,
      actualizar(dt) {
        this.t = (this.t || 0) + dt;
        this.dist = (this.dist || 0) + v * dt;
        Arte.actualizar(dt);
        const m = Tono.leer();
        hayVoz = m !== null;
        if (hayVoz) midiSuave += 0.4 * (m - midiSuave);
        for (const p of puertas) {
          p.x -= v * dt;
          if (config.guia === "si" && !p.guiaTocada && p.x < W - 10) {
            p.guiaTocada = true;
            tocarNota(p.nota, 0.9);
          }
          const solapa = BOLA_X + 10 > p.x && BOLA_X - 10 < p.x + ANCHO_PUERTA;
          if (solapa && !p.hecho) {
            p.ventana += dt;
            if (hayVoz) {
              p.cantadas.push(m);
              if (Math.abs(diferencia(m, p.nota)) <= TOLERANCIA_CENTS / 100) p.dentro += dt;
            }
          }
          if (!p.hecho && p.x + ANCHO_PUERTA < BOLA_X - 10) {
            p.hecho = true;
            p.ok = p.dentro >= Math.min(0.45, p.ventana * 0.4) && p.ventana > 0;
            const ord = p.cantadas.slice().sort((a, b) => a - b);
            const med = ord.length ? ord[Math.floor(ord.length / 2)] : null;
            resultados.push({ nota: p.nota, ok: p.ok, cantada: med });
            aviso = {
              ok: p.ok,
              t: 1.4,
              texto: p.ok ? `¡Bien! ${nombreNota(p.nota)}` : med === null ? `No te oí · era ${nombreNota(p.nota)}` : `Era ${nombreNota(p.nota)} · cantaste ${nombreNota(med)}`,
            };
            estado(aviso.texto, p.ok ? "ok" : "mal");
            Arte.emitir(BOLA_X + 10, yDe(p.nota), p.ok ? 26 : 12, p.ok ? "#3ecf6e" : "#ff3b4e", p.ok ? 150 : 90);
          }
        }
        if (aviso) aviso.t -= dt;
        if (!this.terminado && resultados.length >= TOTAL) {
          this.terminado = true;
          const aciertos = resultados.filter((r) => r.ok).length;
          let record = false;
          try {
            if (window.Progreso) record = Progreso.actualizarRecord("juegoPasilloMejor", aciertos, (n, a) => n > a);
          } catch {
            /* sin récord guardado */
          }
          estado(`Terminado: ${aciertos} de ${TOTAL} puertas (${Math.round((100 * aciertos) / TOTAL)} %).${record ? " 🏆 ¡Nuevo récord!" : ""}`, aciertos >= 7 ? "ok" : "");
          detener(false);
        }
      },
      dibujar(ctx) {
        const t = this.t || 0;
        const dist = this.dist || 0;
        // ---- fondo: cielo, luna y dos capas de montañas con parallax
        Arte.cielo(ctx, t, "#0b0820", "#2b1236");
        Arte.luna(ctx, 560, 62, 22, "#1a0f33");
        Arte.montanas(ctx, dist * 0.12, "#1b1038", H - 96, 80, 110, 1.3);
        Arte.montanas(ctx, dist * 0.3, "#26164a", H - 52, 56, 70, 3.1);
        // techo y suelo de piedra
        ctx.fillStyle = "#120a26";
        ctx.fillRect(0, H - 16, W, 16);
        ctx.fillRect(0, 0, W, 10);
        ctx.fillStyle = "#3a2766";
        ctx.fillRect(0, H - 16, W, 2);
        ctx.fillRect(0, 10, W, 2);
        // ---- pauta: una línea por nota de la escala (la tónica, en carmesí)
        let yAnterior = -99;
        for (const n of notas) {
          const y = yDe(n);
          const esTonica = mod12(n - config.tonica) === 0;
          ctx.strokeStyle = esTonica ? "rgba(224,51,85,0.55)" : "rgba(180,160,255,0.14)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(44, y);
          ctx.lineTo(W, y);
          ctx.stroke();
          if (!esTonica && Math.abs(yAnterior - y) < 15) continue; // sin amontonar etiquetas
          yAnterior = y;
          Arte.pastilla(ctx, 4, y - 7, 38, 14, esTonica ? "#93172c" : "rgba(40,28,76,0.9)");
          Arte.ajustar(ctx, nombreNota(n), 36, 10);
          ctx.textAlign = "center";
          ctx.fillStyle = "#efe6e0";
          ctx.fillText(nombreNota(n), 23, y + 3.5);
        }
        // ---- puertas: pilares de piedra con ladrillos, capitel y un hueco que brilla
        for (const p of puertas) {
          if (p.x > W + 8 || p.x + ANCHO_PUERTA < -8) continue;
          const yHueco = yDe(p.nota);
          const mitad = ((H - 52) / (vmax - vmin)) * 0.6;
          const arriba = yHueco - mitad;
          const abajo = yHueco + mitad;
          const base = p.hecho ? (p.ok ? ["#2f8f55", "#3ecf6e"] : ["#8f2f3c", "#ff3b4e"]) : ["#46347f", "#6a54b3"];
          const bloque = (y0, y1) => {
            if (y1 <= y0) return;
            const gp = ctx.createLinearGradient(p.x, 0, p.x + ANCHO_PUERTA, 0);
            gp.addColorStop(0, base[1]);
            gp.addColorStop(0.18, base[0]);
            gp.addColorStop(1, "rgba(8,4,20,0.95)");
            ctx.fillStyle = gp;
            ctx.fillRect(p.x, y0, ANCHO_PUERTA, y1 - y0);
            ctx.fillStyle = "rgba(0,0,0,0.28)";
            for (let yy = Math.ceil(y0 / 14) * 14; yy < y1; yy += 14) {
              ctx.fillRect(p.x, yy, ANCHO_PUERTA, 1);
              const off = (Math.floor(yy / 14) % 2) * 15;
              for (let xx = p.x + off + 14; xx < p.x + ANCHO_PUERTA; xx += 29) ctx.fillRect(xx, yy, 1, 14);
            }
          };
          bloque(10, arriba);
          bloque(abajo, H - 16);
          // capiteles
          ctx.fillStyle = base[1];
          ctx.fillRect(p.x - 5, arriba - 8, ANCHO_PUERTA + 10, 8);
          ctx.fillRect(p.x - 5, abajo, ANCHO_PUERTA + 10, 8);
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(p.x - 5, arriba - 2, ANCHO_PUERTA + 10, 2);
          // luz del hueco
          const grad = ctx.createLinearGradient(p.x, 0, p.x + ANCHO_PUERTA, 0);
          const luz = p.hecho ? (p.ok ? "62,207,110" : "255,59,78") : "224,51,85";
          grad.addColorStop(0, `rgba(${luz},0)`);
          grad.addColorStop(0.5, `rgba(${luz},${p.hecho ? 0.35 : 0.2 + 0.08 * Math.sin(t * 6)})`);
          grad.addColorStop(1, `rgba(${luz},0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(p.x, arriba, ANCHO_PUERTA, abajo - arriba);
          // placa con la nota (sobre el pilar de arriba, o debajo si no cabe)
          const yPlaca = arriba - 30 > 14 ? arriba - 32 : abajo + 16;
          Arte.pastilla(ctx, p.x + 4, yPlaca, ANCHO_PUERTA - 8, 20, "rgba(10,6,24,0.92)", base[1]);
          Arte.ajustar(ctx, nombreNota(p.nota), ANCHO_PUERTA - 12, 13);
          ctx.textAlign = "center";
          ctx.fillStyle = "#fff";
          ctx.fillText(nombreNota(p.nota), p.x + ANCHO_PUERTA / 2, yPlaca + 14);
        }
        // ---- el espíritu de la voz: orbe luminoso con alas y una estela en cinta
        const yb = yDe(Math.max(vmin, Math.min(vmax, midiSuave)));
        const objetivo = puertas.find((q) => !q.hecho && q.x + ANCHO_PUERTA > BOLA_X - 10);
        const afinada = hayVoz && objetivo && Math.abs(diferencia(midiSuave, objetivo.nota)) <= TOLERANCIA_CENTS / 100;
        this.hist = this.hist || [];
        this.hist.unshift(yb);
        if (this.hist.length > 36) this.hist.pop();
        const rgbE = afinada ? "94,224,138" : hayVoz ? "127,212,255" : "90,110,140";
        const prevOp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = "lighter";
        for (let i = this.hist.length - 1; i >= 0; i--) {
          const a = (1 - i / this.hist.length) * (hayVoz ? 0.5 : 0.18);
          ctx.fillStyle = `rgba(${rgbE},${a})`;
          ctx.beginPath();
          ctx.arc(BOLA_X - i * 4.5, this.hist[i], 7 * (1 - i / this.hist.length) + 1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = prevOp;
        Arte.brillo(ctx, BOLA_X, yb, afinada ? 46 + 4 * Math.sin(t * 10) : 34, rgbE, afinada ? 0.55 : 0.35);
        // alas
        const bat = Math.sin(t * 15) * 0.5;
        ctx.fillStyle = `rgba(${rgbE},0.55)`;
        for (const dir of [-1, 1]) {
          ctx.save();
          ctx.translate(BOLA_X - 2, yb - 2);
          ctx.rotate(dir * (0.7 + bat));
          ctx.beginPath();
          ctx.ellipse(0, -10, 5, 13, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // cuerpo
        const cg = ctx.createRadialGradient(BOLA_X - 3, yb - 4, 1, BOLA_X, yb, 13);
        cg.addColorStop(0, "#ffffff");
        cg.addColorStop(0.45, afinada ? "#7dffa8" : hayVoz ? "#9fdcff" : "#6f879f");
        cg.addColorStop(1, afinada ? "#2f8f55" : hayVoz ? "#3a8fd0" : "#33485c");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(BOLA_X, yb + Math.sin(t * 8) * 1.2, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#10101a";
        ctx.fillRect(BOLA_X + 3, yb - 3, 2.4, 3);
        ctx.fillRect(BOLA_X + 7, yb - 3, 2.4, 3);
        ctx.font = "bold 12px Consolas, monospace";
        ctx.textAlign = "left";
        const textoEsp = hayVoz ? nombreNota(midiSuave) : "canta…";
        Arte.pastilla(ctx, BOLA_X + 22, yb - 10, Math.max(40, ctx.measureText(textoEsp).width + 10), 18, "rgba(10,6,24,0.85)");
        ctx.fillStyle = hayVoz ? "#fff" : "#8a7fa8";
        ctx.fillText(hayVoz ? nombreNota(midiSuave) : "canta…", BOLA_X + 26, yb + 3);
        Arte.dibujar(ctx);
        Arte.vineta(ctx, 0.5);
        // ---- marcador: una casilla por puerta
        const pip = 18;
        const x0 = W / 2 - (TOTAL * (pip + 4)) / 2;
        for (let i = 0; i < TOTAL; i++) {
          const r = resultados[i];
          Arte.pastilla(ctx, x0 + i * (pip + 4), 16, pip, 12, r ? (r.ok ? "#3ecf6e" : "#ff3b4e") : "rgba(255,255,255,0.14)");
        }
        Arte.texto(ctx, `${resultados.filter((r) => r.ok).length} / ${TOTAL}`, W - 14, 30, 18, "#efe6e0", "right");
        // ---- mensaje flotante de la última puerta
        if (aviso && aviso.t > 0) {
          const sube = (1.4 - aviso.t) * 22;
          ctx.globalAlpha = Math.min(1, aviso.t * 2);
          Arte.texto(ctx, aviso.texto, W / 2, 70 - sube, 20, aviso.ok ? "#7dffa8" : "#ff7d8a", "center");
          ctx.globalAlpha = 1;
        }
      },
    };
    return j;
  }

  // ================================================================ 🕹️ PLATAFORMAS (escala completa)
  // El héroe CORRE SOLO; tu voz decide qué hace en cada momento. Cada grado de la escala es una acción distinta y
  // cada obstáculo muestra la nota que lo resuelve (como en Pasillo): hay que cantar la nota justa EN EL MOMENTO justo.
  const ACCIONES_ORDEN = ["agacharse", "saltoBajo", "saltoMedio", "atacar", "saltoAlto", "escudo", "embestida"];
  const INFO_ACCION = {
    agacharse: { etq: "Agacharse", color: "#7fd4ff" },
    saltoBajo: { etq: "Salto corto", color: "#7dffa8" },
    saltoMedio: { etq: "Salto", color: "#3ecf6e" },
    atacar: { etq: "Atacar", color: "#ff7d8a" },
    saltoAlto: { etq: "Salto alto", color: "#c58bff" },
    escudo: { etq: "Escudo", color: "#5ec8ff" },
    embestida: { etq: "Embestida", color: "#ff5cc8" },
  };
  const GRADOS = ["1º", "2º", "3º", "4º", "5º", "6º", "7º"];

  /** Qué nota hace qué: depende de la escala, la tónica, el nivel y tu rango vocal. */
  function planPlataformas() {
    const pasos = ESCALAS[config.escala];
    const [lo, hi] = rangoActual();
    const centro = (lo + hi) / 2;
    let acts;
    let idxs;
    if (config.plataformaNivel === "basico") {
      acts = ["agacharse", "saltoMedio", "atacar"];
      idxs = [0, 2, 4];
    } else if (config.plataformaNivel === "medio" || pasos.length < 7) {
      acts = ["agacharse", "saltoBajo", "saltoMedio", "atacar", "saltoAlto"];
      idxs = [0, 1, 2, 3, 4];
    } else {
      acts = ACCIONES_ORDEN.slice();
      idxs = [0, 1, 2, 3, 4, 5, 6];
    }
    const alto = pasos[idxs[idxs.length - 1]];
    // la tónica más cercana a que TODA la escala utilizada quepa en tu rango
    let T = null;
    for (let m = lo - 12; m <= hi; m++) {
      if (mod12(m) !== mod12(config.tonica)) continue;
      const penal = Math.max(0, lo - m) * 3 + Math.max(0, m + alto - hi) * 3;
      const pt = penal + Math.abs(m + alto / 2 - centro);
      if (T === null || pt < T.pt) T = { m, pt };
    }
    const base = T ? T.m : lo;
    const lista = acts.map((clave, i) => ({
      clave,
      etq: INFO_ACCION[clave].etq,
      color: INFO_ACCION[clave].color,
      midi: base + pasos[idxs[i]],
      grado: GRADOS[idxs[i]] || `${idxs[i] + 1}º`,
      tecla: i + 1,
    }));
    return { lista, base };
  }

  // paisajes de los mapas (sin amarillos ni dorados: mantienen la paleta de la marca)
  const TEMAS = [
    { cielo: ["#0a0716", "#2b1240", "#6e1d3f"], monts: ["#2a1648", "#1d0f35", "#150a29"], pasto: "#4f9a4b", pasto2: "#3a7a3a", tierra: ["#5a3a2a", "#664331"], arboles: "#0d061a", luna: "#f6ecff" },
    { cielo: ["#050b1c", "#0f2a4d", "#2c5f8f"], monts: ["#17304f", "#10253f", "#0a1a2e"], pasto: "#cfe8ff", pasto2: "#9cc7ee", tierra: ["#3a4a63", "#445672"], arboles: "#06101f", luna: "#e8f4ff" },
    { cielo: ["#04120f", "#0b3a33", "#1b6a5a"], monts: ["#12483f", "#0c3630", "#08241f"], pasto: "#59d68a", pasto2: "#2e9b61", tierra: ["#2e3b2a", "#37482f"], arboles: "#03100c", luna: "#d9ffe8" },
    { cielo: ["#14040a", "#4a0e1e", "#a3262f"], monts: ["#5a1424", "#3f0d19", "#2a0710"], pasto: "#7a3a35", pasto2: "#5e2a2a", tierra: ["#3b1a1a", "#4a2020"], arboles: "#1c0508", luna: "#ffd0d6" },
    { cielo: ["#0b0912", "#1d1a2e", "#3b3556"], monts: ["#2a2640", "#1d1a30", "#12101f"], pasto: "#8d86a8", pasto2: "#6a6486", tierra: ["#2f2b3f", "#37334a"], arboles: "#0a0814", luna: "#e0dcff" },
    { cielo: ["#050615", "#14214a", "#3a2a7a"], monts: ["#1c2a5c", "#141d45", "#0d1330"], pasto: "#5ec8ff", pasto2: "#3a8fd0", tierra: ["#1f2c4d", "#27375f"], arboles: "#060a1c", luna: "#f0eaff" },
  ];

  function crearPlataformas() {
    const LW = 160;
    const LH = 90;
    const ESC = 4; // 160×90 lógicos → 640×360
    const SUELO = 70;
    const plan = planPlataformas();
    const acciones = {};
    plan.lista.forEach((a) => (acciones[a.clave] = a));
    const tieneAccion = (c) => Boolean(acciones[c]);
    const VEL = { lento: 34, normal: 44, rapido: 56 }[config.velocidad] || 34;
    const SALTOS = { saltoBajo: -80, saltoMedio: -105, saltoAlto: -135 };
    const G = 260;
    const JUGADOR_X = 30;
    // El juego va en «cámara lenta» respecto a la primera versión: mismas distancias y alturas, más segundos para reaccionar.
    const TS = { lento: 0.6, normal: 0.78, rapido: 1 }[config.velocidad] || 0.6;
    let LARGO = 0;

    // ---------------------------------------------------------------- nivel
    // tipos: qué acción mínima los resuelve (la más baja disponible que sirva)
    const primeraDisponible = (lista) => lista.find(tieneAccion) || null;
    const TIPOS = {
      piedra: { w: 6, h: 5, req: primeraDisponible(["saltoBajo", "saltoMedio", "saltoAlto"]) },
      tronco: { w: 7, h: 10, req: primeraDisponible(["saltoMedio", "saltoAlto"]) },
      muro: { w: 5, h: 20, req: primeraDisponible(["saltoAlto"]) },
      fosoCorto: { w: 12, h: 0, req: primeraDisponible(["saltoBajo", "saltoMedio", "saltoAlto"]) },
      fosoMedio: { w: 20, h: 0, req: primeraDisponible(["saltoMedio", "saltoAlto"]) },
      fosoLargo: { w: 27, h: 0, req: primeraDisponible(["saltoAlto"]) },
      murcielago: { w: 9, h: 13, req: tieneAccion("agacharse") ? "agacharse" : null },
      slime: { w: 9, h: 8, req: tieneAccion("atacar") ? "atacar" : null },
      flecha: { w: 8, h: 4, req: tieneAccion("escudo") ? "escudo" : null },
      cristal: { w: 5, h: 30, req: tieneAccion("embestida") ? "embestida" : null },
    };
    const disponibles = Object.keys(TIPOS).filter((k) => TIPOS[k].req);

    // ---- mapas: cada uno es una SEMILLA fija (misma partida cada vez) con su paisaje y su estilo de obstáculos.
    // «Aleatorio» (0) sortea una semilla nueva. Los obstáculos se reparten por igual entre las acciones del nivel.
    const MAPAS = [
      { nombre: "Atardecer", semilla: 11, prefiere: null },
      { nombre: "Noche helada", semilla: 23, prefiere: "foso" },
      { nombre: "Bosque encantado", semilla: 37, prefiere: "solido" },
      { nombre: "Volcán", semilla: 41, prefiere: "foso" },
      { nombre: "Cripta", semilla: 59, prefiere: "solido" },
      { nombre: "Aurora", semilla: 73, prefiere: null },
    ];
    let mapaIdx = Number(config.plataformaMapa) || 0;
    let semilla;
    if (mapaIdx >= 1 && mapaIdx <= MAPAS.length) {
      semilla = MAPAS[mapaIdx - 1].semilla + plan.lista.length * 1000;
    } else {
      semilla = Math.floor(Math.random() * 2 ** 31);
      mapaIdx = (semilla % MAPAS.length) + 1;
    }
    const mapa = MAPAS[mapaIdx - 1];
    let _s = semilla >>> 0;
    const rnd = () => {
      _s = (_s + 0x6d2b79f5) >>> 0;
      let z = Math.imul(_s ^ (_s >>> 15), 1 | _s);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    const elegirDe = (arr) => arr[Math.floor(rnd() * arr.length)];

    // reparto equitativo: K obstáculos por cada acción (42 en total con 7 acciones y K = 6)
    const K = { basico: 10, medio: 7, completo: 6 }[config.plataformaNivel] || 7;
    const accionesNivel = plan.lista.map((a) => a.clave);
    const resto = [];
    for (const a of accionesNivel) for (let k = 1; k < K; k++) resto.push(a); // la primera de cada una va en la introducción
    for (let i = resto.length - 1; i > 0; i--) {
      const j2 = Math.floor(rnd() * (i + 1));
      [resto[i], resto[j2]] = [resto[j2], resto[i]];
    }
    // sin la misma acción dos veces seguidas (semialeatorio)
    let previa = accionesNivel[accionesNivel.length - 1];
    for (let i = 0; i < resto.length; i++) {
      if (resto[i] === previa) {
        const sw = resto.findIndex((a, q) => q > i && a !== previa && (i + 1 >= resto.length || a !== resto[i + 1] || true));
        if (sw > -1) [resto[i], resto[sw]] = [resto[sw], resto[i]];
      }
      previa = resto[i];
    }
    const secuenciaAcciones = [...accionesNivel, ...resto];
    // introducción: cada acción se presenta con el obstáculo más claro para ella
    const INTRO = { agacharse: "murcielago", saltoBajo: "fosoCorto", saltoMedio: "tronco", atacar: "slime", saltoAlto: "muro", escudo: "flecha", embestida: "cristal" };
    const esFoso = (tt) => tt.startsWith("foso");
    const tipoParaAccion = (a, primera) => {
      const cands = disponibles.filter((tt) => TIPOS[tt].req === a);
      if (primera && INTRO[a] && cands.includes(INTRO[a])) return INTRO[a];
      if (mapa.prefiere && cands.length > 1 && rnd() < 0.7) {
        const pref = cands.filter((tt) => (mapa.prefiere === "foso" ? esFoso(tt) : !esFoso(tt)));
        if (pref.length) return elegirDe(pref);
      }
      return elegirDe(cands);
    };
    const secuencia = secuenciaAcciones.map((a, i) => tipoParaAccion(a, i < accionesNivel.length));
    const obstaculos = [];
    let x = 120;
    for (const t of secuencia) {
      const d = TIPOS[t];
      const o = { tipo: t, x, w: d.w, h: d.h, req: d.req, vivo: true, resuelto: false, golpeado: false, nuevo: obstaculos.every((q) => q.tipo !== t), fase: rnd() * 6 };
      obstaculos.push(o);
      x += 62 + Math.floor(rnd() * 26) + (t === "fosoLargo" || t === "muro" ? 16 : 0);
    }
    LARGO = obstaculos[obstaculos.length - 1].x + 70;
    // Checkpoints: un lugar SEGURO (a medio camino entre dos obstáculos) cada 5-6 obstáculos. Al perder una vida se
    // reaparece en el último checkpoint alcanzado (o en el inicio), nunca justo antes del peligro.
    const checkpoints = [{ x: JUGADOR_X, activo: true }];
    for (let i = 5; i + 1 < obstaculos.length - 1; i += 6) {
      const a = obstaculos[i];
      const b = obstaculos[i + 1];
      checkpoints.push({ x: Math.round((a.x + a.w + b.x) / 2), activo: false });
    }
    let ultimoCheckpoint = checkpoints[0];
    let pausaRespawn = 0; // segundos de calma tras reaparecer
    let pendienteSalto = null; // salto «guardado» si cantas la nota un instante antes de aterrizar

    const heroe = {
      y: SUELO,
      vy: 0,
      suelo: true,
      agachado: false,
      escudo: false,
      ataque: 0,
      embestida: 0,
      vidas: 3,
      parpadeo: 0,
      alto: 18,
    };
    const sost = {}; // segundos sosteniendo la nota de cada acción
    const armado = {}; // ya se disparó en esta pulsación
    plan.lista.forEach((a) => {
      sost[a.clave] = 0;
      armado[a.clave] = false;
    });
    let cam = 0;
    let puntos = 0;
    let racha = 0;
    let caida = false;
    let t = 0;
    let flash = 0;
    let sacudida = 0;
    let anuncio = null; // {texto, color, t}
    const popups = []; // textos flotantes en coordenadas del mundo
    let introMostrada = new Set();
    anuncio = { texto: `Mapa ${mapaIdx}: ${mapa.nombre}${config.plataformaMapa === "0" ? " (aleatorio)" : ""} · ${secuencia.length} obstáculos`, color: "#efe6e0", t: 3.2 };

    function activa(a, m) {
      if (Tono.teclas[a.tecla]) return true;
      if (m === null) return false;
      let d = m - a.midi;
      if (config.octava !== "exacta") d = ((d + 6) % 12 + 12) % 12 - 6;
      return Math.abs(d) <= TOLERANCIA_CENTS / 100;
    }

    function popup(texto, wx, color) {
      popups.push({ texto, x: JUGADOR_X + cam + 4, y: SUELO - 30, t: 1.1, color }); // sale de encima del héroe
    }

    function perderVida(msg) {
      if (heroe.parpadeo > 0 || heroe.embestida > 0) return;
      heroe.vidas -= 1;
      heroe.parpadeo = 1.3;
      racha = 0;
      sacudida = 0.35;
      flash = 0.25;
      Arte.emitir(JUGADOR_X * ESC + 20, (heroe.y - 8) * ESC, 22, "#ff3b4e", 160, 0.7);
      if (heroe.vidas <= 0) {
        estado(msg, "mal");
        j.terminado = true;
        estado(`Sin vidas. Llegaste al ${Math.round((100 * cam) / LARGO)} % del nivel con ${puntos} puntos. ¡Otra vez!`, "mal");
        detener(false);
        return;
      }
      reaparecer(msg);
    }

    /** Vuelve al último checkpoint (o al principio) con unos segundos de calma y los obstáculos de ahí en adelante restaurados. */
    function reaparecer(msg) {
      const dondeX = ultimoCheckpoint.x;
      cam = Math.max(0, dondeX - JUGADOR_X);
      caida = false;
      heroe.y = SUELO;
      heroe.vy = 0;
      heroe.suelo = true;
      heroe.agachado = false;
      heroe.escudo = false;
      heroe.ataque = 0;
      heroe.embestida = 0;
      heroe.parpadeo = 2.2;
      pausaRespawn = 1.4;
      for (const a of plan.lista) {
        sost[a.clave] = 0;
        armado[a.clave] = true; // no dispara hasta soltar la nota
      }
      for (const o of obstaculos) {
        if (o.x + o.w > cam + JUGADOR_X + 4) {
          o.golpeado = false;
          o.vivo = true;
          o.resuelto = false;
        }
      }
      const donde = ultimoCheckpoint === checkpoints[0] ? "el inicio" : "el checkpoint";
      anuncio = { texto: `Vuelves a ${donde} · te quedan ${heroe.vidas} vida${heroe.vidas === 1 ? "" : "s"}`, color: "#efe6e0", t: 2.4 };
      estado(`${msg} Vuelves a ${donde}.`, "mal");
    }

    function resolver(o, texto) {
      if (o.resuelto) return;
      o.resuelto = true;
      racha += 1;
      const bonus = Math.min(5, racha) * 2;
      puntos += 10 + bonus;
      popup(texto || "¡Bien!", o.x + o.w / 2, "#7dffa8");
    }

    const j = {
      terminado: false,
      acciones,
      obstaculos,
      jug: heroe,
      plan,
      mapa: { idx: mapaIdx, nombre: mapa.nombre, semilla, secuencia },
      get cam() {
        return cam;
      },
      marcasPiano() {
        const mapa = {};
        plan.lista.forEach((a) => (mapa[a.midi] = a.color));
        return mapa;
      },
      notasPiano() {
        return plan.lista.map((a) => a.midi);
      },
      actualizar(dtReal) {
        const dt = dtReal * TS; // tiempo del juego (más lento); el tiempo real se usa para tu voz y las animaciones
        t += dtReal;
        Arte.actualizar(dtReal);
        const m = Tono.leer();
        // ---- tu voz: sostener cada nota
        for (const a of plan.lista) {
          const on = activa(a, m);
          sost[a.clave] = on ? sost[a.clave] + dtReal : 0;
          if (!on) armado[a.clave] = false;
        }
        pausaRespawn = Math.max(0, pausaRespawn - dtReal);
        const listo = (c) => tieneAccion(c) && sost[c] > 0.07;
        heroe.agachado = listo("agacharse") && heroe.suelo;
        heroe.escudo = listo("escudo");
        const dispara = (c) => {
          if (!listo(c) || armado[c]) return false;
          armado[c] = true;
          return true;
        };
        const despegar = (c) => {
          heroe.vy = SALTOS[c];
          heroe.suelo = false;
          pendienteSalto = null;
          Arte.emitir(JUGADOR_X * ESC + 14, SUELO * ESC, 8, "#d8c9a8", 70, 0.4);
          tocarNota(acciones[c].midi, 0.18);
        };
        for (const c of ["saltoBajo", "saltoMedio", "saltoAlto"]) {
          if (dispara(c)) {
            if (heroe.suelo) despegar(c);
            else pendienteSalto = { c, t: 0.4 }; // la nota se cantó con el héroe aún en el aire: salta al aterrizar
          }
        }
        if (pendienteSalto) {
          pendienteSalto.t -= dt;
          if (pendienteSalto.t <= 0) pendienteSalto = null;
        }
        if (dispara("atacar") && heroe.ataque <= 0) {
          heroe.ataque = 0.32;
          tocarNota(acciones.atacar.midi, 0.18);
        }
        if (dispara("embestida") && heroe.embestida <= 0) {
          heroe.embestida = 0.55;
          tocarNota(acciones.embestida.midi, 0.18);
        }
        heroe.ataque = Math.max(0, heroe.ataque - dt);
        heroe.embestida = Math.max(0, heroe.embestida - dt);
        heroe.parpadeo = Math.max(0, heroe.parpadeo - dt);
        heroe.alto = heroe.agachado ? 9 : 18;

        // ---- el héroe corre solo
        if (pausaRespawn <= 0) cam += VEL * (heroe.embestida > 0 ? 1.7 : 1) * dt;
        // ---- física vertical
        const enFoso = obstaculos.find((o) => o.h === 0 && o.tipo.startsWith("foso") && JUGADOR_X + 4 + cam > o.x + 1 && JUGADOR_X + 4 + cam < o.x + o.w - 1);
        if (!heroe.suelo || caida) {
          heroe.vy += G * dt;
          heroe.y += heroe.vy * dt;
        }
        if (heroe.y >= SUELO && !caida) {
          if (!enFoso) {
            heroe.y = SUELO;
            heroe.vy = 0;
            if (!heroe.suelo) Arte.emitir(JUGADOR_X * ESC + 14, SUELO * ESC, 6, "#d8c9a8", 50, 0.3);
            heroe.suelo = true;
          } else if (heroe.suelo) {
            caida = true; // pisó un foso sin saltar
            heroe.suelo = false;
            heroe.vy = 0;
          } else {
            // aterrizando justo sobre el foso: cae
            caida = true;
          }
        }
        if (pendienteSalto && heroe.suelo && !caida) despegar(pendienteSalto.c);
        if (caida && heroe.y > LH + 24) {
          heroe.parpadeo = 0; // la caída siempre cuenta
          heroe.embestida = 0;
          perderVida("¡Al foso! Salta antes de llegar (la nota del foso está encima).");
          if (j.terminado) return;
        }
        // ---- checkpoints
        for (const cp of checkpoints) {
          if (!cp.activo && JUGADOR_X + cam >= cp.x) {
            cp.activo = true;
            ultimoCheckpoint = cp;
            puntos += 5;
            popup("¡Checkpoint!", cp.x, "#7fd4ff");
            anuncio = { texto: "Checkpoint guardado: si pierdes una vida, vuelves aquí", color: "#7fd4ff", t: 2.2 };
            Arte.emitir((cp.x - cam) * ESC + 10, (SUELO - 14) * ESC, 24, "#7fd4ff", 140, 0.7);
          }
        }
        // ---- obstáculos
        const hx = JUGADOR_X + cam; // x del héroe en el mundo
        for (const o of obstaculos) {
          const dx = o.x - hx; // distancia por delante
          // aviso de «nuevo»
          if (o.nuevo && !introMostrada.has(o.tipo) && dx < 96 && dx > 0) {
            introMostrada.add(o.tipo);
            const a = acciones[o.req];
            anuncio = { texto: `¡Nuevo! ${a.etq}: canta ${nombreNota(a.midi)}`, color: a.color, t: 3 };
            estado(`Nuevo obstáculo: ${a.etq} (${a.grado} = ${nombreNota(a.midi)})`, "");
          }
          if (!o.vivo || o.golpeado) continue;
          const solapaX = hx + 6 > o.x && hx + 2 < o.x + o.w;
          if (o.h === 0) {
            if (!o.resuelto && o.x + o.w < hx && heroe.suelo) resolver(o, "¡Salto!");
            continue;
          }
          if (o.tipo === "piedra" || o.tipo === "tronco" || o.tipo === "muro") {
            if (solapaX && heroe.y > SUELO - o.h + 0.5) {
              o.golpeado = true;
              perderVida(`Chocaste: aquí hacía falta ${INFO_ACCION[o.req].etq.toLowerCase()} (${nombreNota(acciones[o.req].midi)}).`);
            } else if (!o.resuelto && o.x + o.w < hx) resolver(o, "¡Salto!");
          } else if (o.tipo === "murcielago") {
            const arriba = heroe.y - heroe.alto;
            if (solapaX && arriba < SUELO - 13 && heroe.y > SUELO - 26) {
              o.golpeado = true;
              perderVida(`El murciélago te dio: agáchate cantando ${nombreNota(acciones.agacharse.midi)}.`);
            } else if (!o.resuelto && o.x + o.w < hx) resolver(o, "¡Esquivado!");
          } else if (o.tipo === "slime") {
            const delante = o.x - hx;
            if (heroe.ataque > 0 && delante > -2 && delante < 24) {
              o.vivo = false;
              resolver(o, "¡Derrotado!");
              puntos += 5;
              Arte.emitir((o.x - cam) * ESC + 14, (SUELO - 4) * ESC, 22, "#6ee06e", 130, 0.6);
            } else if (heroe.embestida > 0 && solapaX) {
              o.vivo = false;
              resolver(o, "¡Arrollado!");
              Arte.emitir((o.x - cam) * ESC + 14, (SUELO - 4) * ESC, 18, "#6ee06e", 130, 0.6);
            } else if (solapaX && heroe.y > SUELO - 8) {
              o.golpeado = true;
              perderVida(`El slime te tocó: ataca cantando ${nombreNota(acciones.atacar.midi)} cuando esté cerca.`);
            } else if (!o.resuelto && o.x + o.w < hx) resolver(o, "¡Saltado!");
          } else if (o.tipo === "flecha") {
            if (solapaX && heroe.y > SUELO - 12) {
              if (heroe.escudo || heroe.embestida > 0) {
                o.vivo = false;
                resolver(o, "¡Bloqueado!");
                Arte.emitir((o.x - cam) * ESC + 14, (SUELO - 8) * ESC, 16, "#5ec8ff", 120, 0.5);
              } else {
                o.golpeado = true;
                perderVida(`Te alcanzó la bola de fuego: levanta el escudo cantando ${nombreNota(acciones.escudo.midi)}.`);
              }
            }
          } else if (o.tipo === "cristal") {
            if (solapaX && heroe.embestida > 0) {
              o.vivo = false;
              resolver(o, "¡Roto!");
              puntos += 5;
              Arte.emitir((o.x - cam) * ESC + 14, (SUELO - 14) * ESC, 30, "#ff8ee0", 170, 0.7);
            } else if (solapaX) {
              o.golpeado = true;
              perderVida(`Pared de cristal: embiste cantando ${nombreNota(acciones.embestida.midi)}.`);
            }
          }
        }
        // popups
        for (const p of popups) {
          p.t -= dt;
          p.y -= 14 * dt;
        }
        while (popups.length && popups[0].t <= 0) popups.shift();
        if (anuncio) anuncio.t -= dt;
        flash = Math.max(0, flash - dt);
        sacudida = Math.max(0, sacudida - dt);
        if (cam >= LARGO && !this.terminado) {
          this.terminado = true;
          const total = puntos + heroe.vidas * 20;
          let record = false;
          try {
            if (window.Progreso) record = Progreso.actualizarRecord("juegoPlataformaPuntos", total, (n, a) => n > a);
          } catch {
            /* sin récord */
          }
          estado(`¡Nivel completado! ${puntos} puntos y ${heroe.vidas} vida${heroe.vidas === 1 ? "" : "s"}.${record ? " 🏆 ¡Récord!" : ""}`, "ok");
          detener(false);
        }
      },
      dibujar(ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = true;
        const sx = sacudida > 0 ? (Math.random() - 0.5) * 6 * (sacudida / 0.35) : 0;
        const sy = sacudida > 0 ? (Math.random() - 0.5) * 6 * (sacudida / 0.35) : 0;
        ctx.translate(sx, sy);
        // ---- cielo de atardecer morado → carmesí en el horizonte
        const TEMA = TEMAS[(mapaIdx - 1) % TEMAS.length];
        const cielo = ctx.createLinearGradient(0, 0, 0, SUELO * ESC);
        cielo.addColorStop(0, TEMA.cielo[0]);
        cielo.addColorStop(0.55, TEMA.cielo[1]);
        cielo.addColorStop(1, TEMA.cielo[2]);
        ctx.fillStyle = cielo;
        ctx.fillRect(-10, -10, W + 20, H + 20);
        // estrellas
        for (let i = 0; i < 46; i++) {
          const ex = (((i * 71 - cam * 0.6) % W) + W) % W;
          const ey = (i * 37) % 170;
          ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * Math.abs(Math.sin(t * 0.8 + i))})`;
          ctx.fillRect(ex, ey, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
        }
        // luna con halo
        const lx = 520 - (cam * 0.5) % 1400;
        Arte.brillo(ctx, lx, 70, 70, "255,220,255", 0.25);
        ctx.fillStyle = TEMA.luna;
        ctx.beginPath();
        ctx.arc(lx, 70, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d9c8ee";
        ctx.beginPath();
        ctx.arc(lx - 6, 64, 4, 0, Math.PI * 2);
        ctx.arc(lx + 7, 76, 3, 0, Math.PI * 2);
        ctx.fill();
        // montañas en 3 capas con parallax
        const capas = [
          [TEMA.monts[0], 130, 54, 0.15, 90, 1.3],
          [TEMA.monts[1], 105, 44, 0.32, 70, 3.1],
          [TEMA.monts[2], 88, 30, 0.55, 52, 5.2],
        ];
        for (const [color, base, alto, par, paso, sem] of capas) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let px = 0; px <= W + 8; px += 8) {
            const xx = px + cam * par * ESC;
            const py = (SUELO * ESC) - base + 40 - alto * (0.5 + 0.5 * Math.sin((xx / paso) * 1.7 + sem) * Math.cos((xx / paso) * 0.6 + sem * 2));
            ctx.lineTo(px, py);
          }
          ctx.lineTo(W, H);
          ctx.closePath();
          ctx.fill();
        }
        // árboles / pinos en silueta (cerca)
        ctx.fillStyle = TEMA.arboles;
        for (let i = 0; i < 9; i++) {
          const tx = ((((i * 90 - cam * 0.8 * ESC) % (W + 120)) + W + 120) % (W + 120)) - 60;
          const th = 40 + (i % 3) * 14;
          ctx.beginPath();
          ctx.moveTo(tx, SUELO * ESC);
          ctx.lineTo(tx + 14, SUELO * ESC - th);
          ctx.lineTo(tx + 28, SUELO * ESC);
          ctx.closePath();
          ctx.fill();
        }
        // ---- mundo (en unidades lógicas, vectores suaves)
        ctx.save();
        ctx.scale(ESC, ESC);
        // suelo con fosos
        const wx0 = cam;
        for (let px = 0; px < LW; px += 1) {
          const wx = px + wx0;
          const foso = obstaculos.some((o) => o.h === 0 && o.tipo.startsWith("foso") && wx >= o.x && wx < o.x + o.w);
          if (foso) continue;
          ctx.fillStyle = TEMA.pasto;
          ctx.fillRect(px, SUELO, 1.05, 2.2);
          ctx.fillStyle = TEMA.pasto2;
          ctx.fillRect(px, SUELO + 1.6, 1.05, 1);
          ctx.fillStyle = Math.floor(wx / 6) % 2 ? TEMA.tierra[0] : TEMA.tierra[1];
          ctx.fillRect(px, SUELO + 2.6, 1.05, LH - SUELO);
        }
        // fosos: oscuridad con lava carmesí al fondo
        for (const o of obstaculos) {
          if (!(o.h === 0 && o.tipo.startsWith("foso"))) continue;
          const fx = o.x - cam;
          if (fx > LW + 4 || fx + o.w < -4) continue;
          const g = ctx.createLinearGradient(0, SUELO, 0, LH);
          g.addColorStop(0, "#08040f");
          g.addColorStop(0.7, "#2a0a18");
          g.addColorStop(1, "#c02241");
          ctx.fillStyle = g;
          ctx.fillRect(fx, SUELO, o.w, LH - SUELO);
        }
        // elementos del suelo
        for (const o of obstaculos) {
          const ox = o.x - cam;
          if (ox > LW + 20 || ox < -30) continue;
          if (o.tipo === "piedra") {
            ctx.fillStyle = "#8d8a99";
            ctx.beginPath();
            ctx.ellipse(ox + 3.5, SUELO - 2, 3.8, 3, 0, Math.PI, 0);
            ctx.lineTo(ox + 7.3, SUELO);
            ctx.lineTo(ox - 0.3, SUELO);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.25)";
            ctx.fillRect(ox + 1.5, SUELO - 4, 2, 1);
          } else if (o.tipo === "tronco") {
            ctx.fillStyle = "#6b4426";
            ctx.fillRect(ox, SUELO - 10, 7, 10);
            ctx.fillStyle = "#8a5a33";
            ctx.fillRect(ox, SUELO - 10, 2, 10);
            ctx.fillStyle = "#c79a62";
            ctx.beginPath();
            ctx.ellipse(ox + 3.5, SUELO - 10, 3.5, 1.3, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (o.tipo === "muro") {
            const g = ctx.createLinearGradient(ox, 0, ox + 5, 0);
            g.addColorStop(0, "#7a7396");
            g.addColorStop(1, "#4a4468");
            ctx.fillStyle = g;
            ctx.fillRect(ox, SUELO - 20, 5, 20);
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            for (let yy = SUELO - 20; yy < SUELO; yy += 5) ctx.fillRect(ox, yy, 5, 0.5);
          } else if (o.tipo === "cristal" && o.vivo) {
            const g = ctx.createLinearGradient(ox, 0, ox + 5, 0);
            g.addColorStop(0, "rgba(255,142,224,0.85)");
            g.addColorStop(1, "rgba(127,212,255,0.7)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(ox + 2.5, SUELO - 30);
            ctx.lineTo(ox + 5, SUELO - 22);
            ctx.lineTo(ox + 4, SUELO);
            ctx.lineTo(ox + 1, SUELO);
            ctx.lineTo(ox, SUELO - 20);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.fillRect(ox + 1.2, SUELO - 26, 0.8, 18);
          } else if (o.tipo === "slime" && o.vivo && !o.golpeado) {
            const sq = Math.sin(t * 6 + o.fase) * 0.6;
            ctx.fillStyle = "#58d65e";
            ctx.beginPath();
            ctx.ellipse(ox + 4.5, SUELO - 3 - sq / 2, 4.8 + sq * 0.4, 3.6 - sq * 0.4, 0, Math.PI, 0);
            ctx.lineTo(ox + 9.3, SUELO);
            ctx.lineTo(ox - 0.3, SUELO);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.fillRect(ox + 2, SUELO - 5.2 - sq / 2, 2, 1);
            ctx.fillStyle = "#0b2a12";
            ctx.fillRect(ox + 2.4, SUELO - 3.2, 1.2, 1.4);
            ctx.fillRect(ox + 5.6, SUELO - 3.2, 1.2, 1.4);
          } else if (o.tipo === "murcielago" && !o.golpeado) {
            const aleteo = Math.sin(t * 14 + o.fase);
            const cy = SUELO - 19.5;
            ctx.fillStyle = "#2a1636";
            ctx.beginPath();
            ctx.ellipse(ox + 4.5, cy, 2.6, 3.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(ox + 2.5, cy);
            ctx.quadraticCurveTo(ox - 3, cy - 5 - aleteo * 2.5, ox - 3.5, cy + 1.5);
            ctx.quadraticCurveTo(ox, cy + 0.5, ox + 2.5, cy + 2);
            ctx.moveTo(ox + 6.5, cy);
            ctx.quadraticCurveTo(ox + 12, cy - 5 - aleteo * 2.5, ox + 12.5, cy + 1.5);
            ctx.quadraticCurveTo(ox + 9, cy + 0.5, ox + 6.5, cy + 2);
            ctx.fill();
            ctx.fillStyle = "#ff3b4e";
            ctx.fillRect(ox + 3.4, cy - 1, 0.9, 0.9);
            ctx.fillRect(ox + 5.2, cy - 1, 0.9, 0.9);
          } else if (o.tipo === "flecha" && o.vivo && !o.golpeado) {
            const bx = ox + 4;
            const by = SUELO - 6;
            ctx.globalCompositeOperation = "lighter";
            const g = ctx.createRadialGradient(bx, by, 0, bx, by, 9);
            g.addColorStop(0, "rgba(255,200,120,0.95)");
            g.addColorStop(0.35, "rgba(255,90,60,0.7)");
            g.addColorStop(1, "rgba(255,40,80,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(bx, by, 9, 0, Math.PI * 2);
            ctx.fill();
            for (let k = 1; k < 5; k++) {
              ctx.fillStyle = `rgba(255,${90 + k * 20},60,${0.35 - k * 0.06})`;
              ctx.beginPath();
              ctx.arc(bx + k * 3.2, by + Math.sin(t * 20 + k) * 0.8, 3 - k * 0.4, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalCompositeOperation = "source-over";
          }
        }
        // checkpoints: poste con banderín y un halo en el suelo (zona segura)
        for (const cp of checkpoints) {
          if (cp === checkpoints[0]) continue;
          const cx = cp.x - cam;
          if (cx < -20 || cx > LW + 20) continue;
          const col = cp.activo ? "#5ec8ff" : "#8d86a8";
          ctx.fillStyle = "rgba(94,200,255," + (cp.activo ? 0.14 : 0.06) + ")";
          ctx.beginPath();
          ctx.ellipse(cx, SUELO + 0.5, 16, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#cfc6e6";
          ctx.fillRect(cx, SUELO - 22, 1.2, 22);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(cx + 1.2, SUELO - 22);
          ctx.lineTo(cx + 12, SUELO - 18 + Math.sin(t * 5 + cp.x) * 0.8);
          ctx.lineTo(cx + 1.2, SUELO - 14);
          ctx.closePath();
          ctx.fill();
        }
        // meta: pórtico con bandera
        const metaX = LARGO + 40 - cam;
        if (metaX < LW + 12) {
          ctx.fillStyle = "#cfc6e6";
          ctx.fillRect(metaX, SUELO - 34, 1.4, 34);
          ctx.fillRect(metaX + 20, SUELO - 34, 1.4, 34);
          ctx.fillRect(metaX, SUELO - 34, 21.4, 1.4);
          ctx.fillStyle = "#c02241";
          ctx.beginPath();
          ctx.moveTo(metaX + 1.4, SUELO - 32);
          ctx.lineTo(metaX + 20, SUELO - 32);
          ctx.lineTo(metaX + 20, SUELO - 22 + Math.sin(t * 4) * 1.2);
          ctx.lineTo(metaX + 10.7, SUELO - 26);
          ctx.lineTo(metaX + 1.4, SUELO - 22 + Math.sin(t * 4 + 1) * 1.2);
          ctx.closePath();
          ctx.fill();
        }
        // ---- el héroe
        if (!(heroe.parpadeo > 0 && Math.floor(heroe.parpadeo * 14) % 2)) {
          const px = JUGADOR_X;
          const py = heroe.y;
          const agachado = heroe.agachado;
          const aire = !heroe.suelo;
          const paso = Math.sin(t * 16) * 2;
          // sombra
          if (heroe.suelo) {
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.ellipse(px + 4, SUELO + 0.8, 5, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          // estela de embestida
          if (heroe.embestida > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#ff5cc8";
            ctx.fillRect(px - 16, py - 12, 18, 7);
            ctx.fillStyle = "#ffd0f0";
            ctx.fillRect(px - 10, py - 10, 10, 3);
            ctx.globalAlpha = 1;
          }
          // capa
          ctx.fillStyle = "#93172c";
          ctx.beginPath();
          ctx.moveTo(px + 1, py - (agachado ? 7 : 14));
          ctx.quadraticCurveTo(px - 6 - Math.abs(paso), py - (agachado ? 4 : 8), px - 4 - (aire ? 3 : 0), py - (agachado ? 1 : 4));
          ctx.lineTo(px + 3, py - (agachado ? 3 : 6));
          ctx.fill();
          // piernas
          ctx.fillStyle = "#1e1b36";
          if (agachado) {
            ctx.fillRect(px + 1, py - 3, 3, 3);
            ctx.fillRect(px + 4.5, py - 3, 3, 3);
          } else if (aire) {
            ctx.fillRect(px + 1, py - 6, 2.6, 5);
            ctx.fillRect(px + 4.6, py - 5, 2.6, 4);
          } else {
            ctx.fillRect(px + 1.5 + paso * 0.5, py - 6, 2.6, 6);
            ctx.fillRect(px + 4.5 - paso * 0.5, py - 6, 2.6, 6);
          }
          // torso
          const ty = agachado ? py - 9 : py - 15;
          ctx.fillStyle = "#c02241";
          ctx.beginPath();
          ctx.roundRect(px, ty, 8, agachado ? 6 : 9, 2);
          ctx.fill();
          ctx.fillStyle = "#e8d7b0";
          ctx.fillRect(px, ty + (agachado ? 3.5 : 6), 8, 1.2);
          // cabeza y pelo
          ctx.fillStyle = "#f2c9a0";
          ctx.beginPath();
          ctx.roundRect(px + 1, ty - 6, 6.4, 6, 2);
          ctx.fill();
          ctx.fillStyle = "#2a1636";
          ctx.beginPath();
          ctx.moveTo(px + 0.5, ty - 5);
          ctx.quadraticCurveTo(px + 4, ty - 9.5, px + 8, ty - 4.5);
          ctx.lineTo(px + 8, ty - 2.5);
          ctx.lineTo(px + 6.5, ty - 4.5);
          ctx.lineTo(px + 1, ty - 4);
          ctx.fill();
          ctx.fillStyle = "#111";
          ctx.fillRect(px + 5, ty - 3.5, 1, 1);
          // espada / ataque
          if (heroe.ataque > 0) {
            const a = 1 - heroe.ataque / 0.32;
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px + 6, ty + 2, 15, -1.2 + a * 0.6, 0.8 + a * 0.6);
            ctx.stroke();
            ctx.strokeStyle = "rgba(255,124,138,0.7)";
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "#fff";
            ctx.fillRect(px + 8, ty + 2.5, 15, 1.6);
          } else {
            ctx.fillStyle = "#cfc6e6";
            ctx.fillRect(px + 7, ty + 4, 2, 5);
          }
          // escudo
          if (heroe.escudo) {
            ctx.globalCompositeOperation = "lighter";
            const g = ctx.createRadialGradient(px + 4, py - 9, 3, px + 4, py - 9, 14);
            g.addColorStop(0, "rgba(94,200,255,0.1)");
            g.addColorStop(0.8, "rgba(94,200,255,0.55)");
            g.addColorStop(1, "rgba(94,200,255,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px + 4, py - 9, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          }
        }
        ctx.restore();
        // ---- notas encima de cada obstáculo cercano (en píxeles de pantalla, nítidas)
        for (const o of obstaculos) {
          if (!o.vivo || o.golpeado) continue;
          const ox = (o.x - cam) * ESC;
          if (ox > W + 10 || ox + o.w * ESC < JUGADOR_X * ESC) continue;
          const a = acciones[o.req];
          const cx = ox + (o.w * ESC) / 2;
          const yTop = o.tipo === "murcielago" ? (SUELO - 30) * ESC : (SUELO - Math.max(o.h, 8) - 16) * ESC;
          const cerca = ox < (JUGADOR_X + 64) * ESC;
          const ya = (o.x - (cam + JUGADOR_X)) < VEL * 0.55 && (o.x - (cam + JUGADOR_X)) > -o.w;
          ctx.globalAlpha = cerca ? 1 : 0.62;
          if (ya) Arte.brillo(ctx, cx, yTop + 9, 52 + 6 * Math.sin(t * 16), "255,255,255", 0.45);
          Arte.pastilla(ctx, cx - 30, yTop - 6, 60, 30, ya ? a.color : "rgba(10,6,24,0.88)", ya ? "#fff" : a.color);
          Arte.ajustar(ctx, nombreNota(a.midi), 54, 14);
          ctx.textAlign = "center";
          ctx.fillStyle = ya ? "#10101a" : "#fff";
          ctx.fillText(nombreNota(a.midi), cx, yTop + 9);
          ctx.font = "bold 9px 'Work Sans', sans-serif";
          ctx.fillStyle = ya ? "#10101a" : a.color;
          ctx.fillText(a.etq.toUpperCase(), cx, yTop + 20);
          ctx.globalAlpha = 1;
        }
        // popups
        for (const p of popups) {
          ctx.globalAlpha = Math.min(1, p.t * 2);
          Arte.texto(ctx, p.texto, (p.x - cam) * ESC, p.y * ESC, 15, p.color, "center");
          ctx.globalAlpha = 1;
        }
        Arte.dibujar(ctx);
        // vignette + destello al recibir un golpe
        Arte.vineta(ctx, 0.5);
        if (flash > 0) {
          ctx.fillStyle = `rgba(255,40,70,${flash * 1.2})`;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // ---- HUD superior: corazones, puntos, racha y progreso
        for (let i = 0; i < 3; i++) {
          const hx0 = 16 + i * 22;
          ctx.fillStyle = i < heroe.vidas ? "#ff3b5c" : "rgba(255,255,255,0.15)";
          ctx.beginPath();
          ctx.moveTo(hx0 + 8, 30);
          ctx.bezierCurveTo(hx0 - 6, 16, hx0 + 4, 6, hx0 + 8, 14);
          ctx.bezierCurveTo(hx0 + 12, 6, hx0 + 22, 16, hx0 + 8, 30);
          ctx.fill();
        }
        Arte.texto(ctx, `${puntos}`, 100, 28, 20, "#efe6e0");
        if (racha >= 2) Arte.texto(ctx, `x${Math.min(6, racha)} racha`, 160, 28, 14, "#7dffa8");
        const prog = Math.min(1, cam / LARGO);
        Arte.pastilla(ctx, W - 214, 14, 200, 10, "rgba(255,255,255,0.15)");
        Arte.pastilla(ctx, W - 214, 14, Math.max(8, 200 * prog), 10, "#c02241");
        if (pausaRespawn > 0) {
          Arte.texto(ctx, pausaRespawn > 0.6 ? "¿Listo?" : "¡Ya!", W / 2, 150, 34, "#fff", "center");
        }
        if (anuncio && anuncio.t > 0) {
          ctx.globalAlpha = Math.min(1, anuncio.t);
          Arte.texto(ctx, anuncio.texto, W / 2, 62, 17, anuncio.color, "center");
          ctx.globalAlpha = 1;
        }
        // ---- barra inferior: todas tus notas y lo que hacen; se enciende la que estás cantando
        const n = plan.lista.length;
        const ancho = Math.min(88, (W - 20) / n);
        const x0 = W / 2 - (ancho * n) / 2;
        for (let i = 0; i < n; i++) {
          const a = plan.lista[i];
          const on = sost[a.clave] > 0.05;
          Arte.pastilla(ctx, x0 + i * ancho + 2, H - 40, ancho - 4, 34, on ? a.color : "rgba(14,8,28,0.82)", on ? "#fff" : a.color);
          ctx.textAlign = "center";
          Arte.ajustar(ctx, nombreNota(a.midi), ancho - 10, 12);
          ctx.fillStyle = on ? "#10101a" : "#fff";
          ctx.fillText(nombreNota(a.midi), x0 + i * ancho + ancho / 2, H - 24);
          ctx.font = "bold 9px 'Work Sans', sans-serif";
          ctx.fillStyle = on ? "#10101a" : a.color;
          ctx.fillText(a.etq.toUpperCase(), x0 + i * ancho + ancho / 2, H - 12);
        }
      },
    };
    return j;
  }

  // ================================================================ 🥁 ECO DE RITMO
  const PATRONES = {
    1: [[0, 1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]],
    2: [[0, 1, 1.5, 2, 3], [0, 0.5, 1, 2, 2.5, 3], [0, 1, 2, 2.5, 3]],
    3: [[0, 0.75, 1.5, 2.5, 3], [0.5, 1.5, 2.5, 3.5], [0, 1, 1.5, 2.75, 3.5]],
  };

  function crearRitmo() {
    const bpm = config.ritmoBpm;
    const beat = 60 / bpm; // segundos
    const RONDAS = 6;
    const patrones = PATRONES[config.ritmoNivel];
    let ronda = 0;
    let fase = "inicio"; // inicio → cuenta1 → escucha → cuenta2 → tu-turno → resultado
    let tFase = 0; // segundos desde que empezó la fase
    let esperados = []; // tiempos (s, relativos al inicio de tu turno) de cada golpe esperado
    let golpes = []; // tus golpes {t, delta, cat}
    let patron = patrones[0];
    const resultadosRonda = [];
    let ultimoOnset = -1;
    let rmsMedio = 0.01;
    let buf = null;
    const latencia = 0; // ajustable más adelante
    const ctxA = contexto();
    const programados = []; // tiempos de ctx ya programados (para ignorar su eco en el micro)

    function programarClics(inicioCtx, golpes_, agudos) {
      golpes_.forEach((b) => {
        clic(inicioCtx + b * beat, agudos, 0.5);
        programados.push(performance.now() + (inicioCtx + b * beat - ctxA.currentTime) * 1000);
      });
    }

    function empezarFase(nueva) {
      fase = nueva;
      tFase = 0;
      if (!ctxA) return;
      const ahora = ctxA.currentTime + 0.08;
      if (nueva === "cuenta1" || nueva === "cuenta2") programarClics(ahora, [0, 1, 2, 3], false);
      if (nueva === "escucha") programarClics(ahora, patron, true);
      if (nueva === "tu-turno") {
        j._inicioTurnoPerf = performance.now() + 80;
        golpes = [];
        // un clic muy flojo marca los 4 pulsos para que no te pierdas
        programarClics(ahora, [0, 1, 2, 3], false);
      }
    }

    function registrarGolpe(tPerf) {
      if (fase !== "tu-turno") return;
      const t = (tPerf - j._inicioTurnoPerf) / 1000 - latencia;
      golpes.push({ t });
      Arte.emitir(112 + (Math.max(0, Math.min(4 * beat, t)) / (4 * beat)) * (W - 40 - 112), 196, 12, "#7fd4ff", 90, 0.5);
    }
    j_registrar = registrarGolpe;

    function evaluar() {
      const usados = new Set();
      const detalles = esperados.map((e) => {
        let mejor = -1;
        let dm = 9;
        golpes.forEach((g, i) => {
          if (usados.has(i)) return;
          const d = Math.abs(g.t - e);
          if (d < dm && d <= 0.22) {
            dm = d;
            mejor = i;
          }
        });
        if (mejor < 0) return { esperado: e, delta: null, cat: "fallo" };
        usados.add(mejor);
        const delta = (golpes[mejor].t - e) * 1000;
        const a = Math.abs(delta);
        return { esperado: e, delta, cat: a <= 45 ? "perfecto" : a <= 90 ? "bien" : "casi" };
      });
      const extras = golpes.length - usados.size;
      const puntos = detalles.reduce((s, d) => s + (d.cat === "perfecto" ? 100 : d.cat === "bien" ? 75 : d.cat === "casi" ? 45 : 0), 0);
      const media = detalles.filter((d) => d.delta !== null);
      const tendencia = media.length ? media.reduce((s, d) => s + d.delta, 0) / media.length : 0;
      return { detalles, extras, puntos: Math.max(0, puntos / Math.max(1, detalles.length) - extras * 8), tendencia };
    }

    const j = {
      terminado: false,
      _inicioTurnoPerf: 0,
      actualizar(dt) {
        this.t = (this.t || 0) + dt;
        Arte.actualizar(dt);
        tFase += dt;
        const cuatro = 4 * beat + 0.2;
        if (fase === "inicio") {
          patron = patrones[ronda % patrones.length];
          esperados = patron.map((b) => b * beat);
          empezarFase("cuenta1");
          estado(`Ronda ${ronda + 1} de ${RONDAS}: cuenta 4 pulsos…`);
        } else if (fase === "cuenta1" && tFase >= cuatro) {
          empezarFase("escucha");
          estado("Escucha el patrón…");
        } else if (fase === "escucha" && tFase >= cuatro) {
          empezarFase("cuenta2");
          estado("Prepárate: cuenta de 4…");
        } else if (fase === "cuenta2" && tFase >= cuatro) {
          empezarFase("tu-turno");
          estado(config.entrada === "teclado" ? "¡Tu turno! Toca con la barra espaciadora o haciendo clic." : config.entrada === "piano" ? "¡Tu turno! Toca cualquier tecla del piano al ritmo." : config.entrada === "todo" ? "¡Tu turno! Di «ta», da palmas, toca una tecla o la barra espaciadora." : "¡Tu turno! Di «ta», da palmas o toca la pantalla.");
        } else if (fase === "tu-turno") {
          // detección de golpes con el micrófono (palmas o sílaba)
          if ((config.entrada === "mic" || config.entrada === "todo") && window.MicrofonoEngine && window.MicrofonoEngine.obtenerAnalizador) {
            const an = window.MicrofonoEngine.obtenerAnalizador();
            if (an) {
              if (!buf || buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
              an.getFloatTimeDomainData(buf);
              let s = 0;
              for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
              const rms = Math.sqrt(s / buf.length);
              const ahora = performance.now();
              const eco = programados.some((p) => ahora - p > -5 && ahora - p < 90); // el propio clic del metrónomo
              if (rms > Math.max(0.035, rmsMedio * 3) && ahora - ultimoOnset > 150 && !eco) {
                ultimoOnset = ahora;
                registrarGolpe(ahora);
              }
              rmsMedio = rmsMedio * 0.96 + rms * 0.04;
            }
          }
          if (tFase >= cuatro + 0.25) {
            const r = evaluar();
            resultadosRonda.push(r);
            ronda += 1;
            const perf = r.detalles.filter((d) => d.cat === "perfecto").length;
            const sentido = r.tendencia > 25 ? "un poco tarde" : r.tendencia < -25 ? "un poco pronto" : "en el punto";
            estado(`${perf} de ${esperados.length} perfectos · vas ${sentido} (${Math.round(r.tendencia)} ms)${r.extras ? ` · ${r.extras} golpe${r.extras > 1 ? "s" : ""} de más` : ""}`, perf === esperados.length ? "ok" : "");
            fase = "resultado";
            tFase = 0;
            this._ultimo = r;
          }
        } else if (fase === "resultado" && tFase >= 1.8) {
          if (ronda >= RONDAS) {
            this.terminado = true;
            const media = resultadosRonda.reduce((s, r) => s + r.puntos, 0) / resultadosRonda.length;
            let record = false;
            try {
              if (window.Progreso) record = Progreso.actualizarRecord("juegoRitmoPuntos", Math.round(media), (n, a) => n > a);
            } catch {
              /* sin récord */
            }
            estado(`Terminado: precisión media ${Math.round(media)} / 100.${record ? " 🏆 ¡Nuevo récord!" : ""}`, media >= 70 ? "ok" : "");
            detener(false);
          } else {
            fase = "inicio";
          }
        }
      },
      dibujar(ctx) {
        const t = this.t || 0;
        const x0 = 112;
        const x1 = W - 40;
        const yL = 196;
        const px = (tt) => x0 + (tt / (4 * beat)) * (x1 - x0);
        const enCuenta = fase === "cuenta1" || fase === "cuenta2";
        const fracBeat = enCuenta || fase === "escucha" || fase === "tu-turno" ? (tFase / beat) % 1 : 1;
        const pulso = Math.max(0, 1 - fracBeat * 3.2);
        // ---- escenario: fondo cálido de teatro, focos y tarima
        Arte.cielo(ctx, t, "#150818", "#3b0f2a");
        for (let k = 0; k < 3; k++) {
          const cx = 130 + k * 190 + Math.sin(t * 0.7 + k) * 24;
          const g = ctx.createLinearGradient(cx, 0, cx, 250);
          g.addColorStop(0, "rgba(255,120,170,0.20)");
          g.addColorStop(1, "rgba(255,120,170,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(cx - 10, 0);
          ctx.lineTo(cx + 10, 0);
          ctx.lineTo(cx + 70, 250);
          ctx.lineTo(cx - 70, 250);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "#1d0d18";
        ctx.fillRect(0, 262, W, H - 262);
        ctx.fillStyle = "#4a1c34";
        ctx.fillRect(0, 262, W, 3);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        for (let x = 0; x < W; x += 46) ctx.fillRect(x, 265, 2, H - 265);
        // ---- tambor (pulsa con cada pulso)
        const dx = 20;
        const dy = 150 + pulso * 3;
        const ancho = 62 + pulso * 6;
        ctx.fillStyle = "#6e2442";
        ctx.fillRect(dx - pulso * 3, dy, ancho, 74);
        ctx.fillStyle = "#93172c";
        ctx.fillRect(dx - pulso * 3, dy + 14, ancho, 8);
        ctx.fillRect(dx - pulso * 3, dy + 52, ancho, 8);
        ctx.fillStyle = "#f4e7ee";
        ctx.beginPath();
        ctx.ellipse(dx + 31, dy, ancho / 2, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c02241";
        ctx.lineWidth = 3;
        ctx.stroke();
        // ---- riel de pulsos
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, "rgba(224,51,85,0.15)");
        g.addColorStop(0.5, "rgba(224,51,85,0.55)");
        g.addColorStop(1, "rgba(224,51,85,0.15)");
        ctx.fillStyle = g;
        ctx.fillRect(x0 - 12, yL - 3, x1 - x0 + 24, 6);
        for (let b = 0; b < 4; b++) {
          const x = px(b * beat);
          const activo = (enCuenta || fase === "escucha" || fase === "tu-turno") && Math.floor(tFase / beat) === b;
          ctx.fillStyle = activo ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)";
          ctx.fillRect(x - 1, yL - 62, 3, 124);
          Arte.pastilla(ctx, x - 14, yL + 72, 28, 24, activo ? "#c02241" : "rgba(60,26,48,0.95)", activo ? "#ff5c7a" : "rgba(255,255,255,0.12)");
          ctx.font = "900 15px Consolas, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#fff";
          ctx.fillText(String(b + 1), x, yL + 90);
        }
        // ---- golpes esperados: «gemas» de tambor que se iluminan cuando pasa el cabezal
        const sonando = fase === "escucha" ? tFase : fase === "tu-turno" ? tFase : -1;
        esperados.forEach((e) => {
          const visible = fase === "escucha" || fase === "tu-turno" || fase === "resultado";
          const pasada = sonando >= 0 && sonando >= e;
          const x = px(e);
          const reciente = pasada && sonando - e < 0.22;
          if (!visible) {
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.beginPath();
            ctx.arc(x, yL, 8, 0, Math.PI * 2);
            ctx.fill();
            return;
          }
          const r = 13 + (reciente ? 7 * (1 - (sonando - e) / 0.22) : 0);
          if (pasada || fase === "resultado") {
            ctx.fillStyle = `rgba(255,92,122,${reciente ? 0.45 : 0.16})`;
            ctx.beginPath();
            ctx.arc(x, yL, r + 9, 0, Math.PI * 2);
            ctx.fill();
          }
          Arte.brillo(ctx, x, yL, r + 22, "255,92,122", reciente ? 0.6 : pasada || fase === "resultado" ? 0.28 : 0.14);
          ctx.fillStyle = pasada || fase === "resultado" ? "#ff5c7a" : "#c02241";
          ctx.beginPath();
          ctx.arc(x, yL, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.beginPath();
          ctx.arc(x - r * 0.3, yL - r * 0.3, r * 0.28, 0, Math.PI * 2);
          ctx.fill();
        });
        // ---- tus golpes (cometas que cambian de color con la precisión)
        if (fase === "tu-turno" || fase === "resultado") {
          const r = this._ultimo;
          golpes.forEach((gp) => {
            const x = px(Math.max(0, Math.min(4 * beat, gp.t)));
            let color = "#7fd4ff";
            let etiqueta = "";
            if (fase === "resultado" && r) {
              const cerca = r.detalles.find((d) => d.delta !== null && Math.abs(gp.t - d.esperado) < 0.23 && Math.abs((gp.t - d.esperado) * 1000 - d.delta) < 1);
              if (cerca) {
                color = cerca.cat === "perfecto" ? "#3ecf6e" : cerca.cat === "bien" ? "#f08a24" : "#ff3b4e";
                etiqueta = cerca.cat === "perfecto" ? "PERFECTO" : cerca.cat === "bien" ? "BIEN" : "CASI";
                etiqueta += ` ${cerca.delta > 0 ? "+" : ""}${Math.round(cerca.delta)} ms`;
              } else {
                color = "#8c8199";
                etiqueta = "de más";
              }
            }
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x) - 3, yL - 46, 6, 92);
            ctx.beginPath();
            ctx.moveTo(x - 9, yL - 46);
            ctx.lineTo(x + 9, yL - 46);
            ctx.lineTo(x, yL - 30);
            ctx.closePath();
            ctx.fill();
            if (etiqueta) {
              ctx.font = "bold 11px Consolas, monospace";
              ctx.textAlign = "center";
              ctx.fillStyle = color;
              ctx.fillText(etiqueta, x, yL - 54);
            }
          });
        }
        // ---- cabezal
        let tc = null;
        if (enCuenta || fase === "escucha" || fase === "tu-turno") tc = Math.min(4 * beat, tFase);
        if (tc !== null) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(Math.round(px(tc)) - 1, yL - 70, 3, 140);
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.moveTo(px(tc) - 7, yL - 70);
          ctx.lineTo(px(tc) + 7, yL - 70);
          ctx.lineTo(px(tc), yL - 58);
          ctx.closePath();
          ctx.fill();
        }
        Arte.actualizar(0);
        Arte.dibujar(ctx);
        Arte.vineta(ctx, 0.45);
        // ---- cabecera: fase, cuenta atrás y rondas
        const titulo = { inicio: "…", cuenta1: "CUENTA", escucha: "ESCUCHA", cuenta2: "PREPÁRATE", "tu-turno": "¡TU TURNO!", resultado: "RESULTADO" }[fase];
        const colorFase = fase === "tu-turno" ? "#ff5c7a" : fase === "escucha" ? "#7fd4ff" : "#efe6e0";
        Arte.texto(ctx, titulo, 16, 34, 26 + (fase === "tu-turno" ? pulso * 3 : 0), colorFase);
        if (enCuenta) Arte.texto(ctx, String(Math.min(4, Math.floor(tFase / beat) + 1)), W / 2, 118, 64 + pulso * 10, "#fff", "center");
        ctx.font = "bold 13px Consolas, monospace";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(237,231,225,0.7)";
        ctx.fillText(`${bpm} BPM · nivel ${config.ritmoNivel}`, 18, 54);
        const pip = 20;
        const px0 = W - 16 - RONDAS * (pip + 4);
        for (let i = 0; i < RONDAS; i++) {
          const rr = resultadosRonda[i];
          let c = "rgba(255,255,255,0.14)";
          if (rr) {
            const perf = rr.detalles.filter((d) => d.cat === "perfecto").length / Math.max(1, rr.detalles.length);
            c = perf >= 0.99 ? "#3ecf6e" : perf >= 0.5 ? "#f08a24" : "#ff3b4e";
          } else if (i === ronda) c = "#7fd4ff";
          Arte.pastilla(ctx, px0 + i * (pip + 4), 18, pip, 12, c);
        }
      },
    };
    return j;
  }
  let j_registrar = null;

  // ================================================================ interfaz (opciones, textos, eventos)
  const DESCRIPCIONES = {
    pasillo: {
      titulo: "🎯 Pasillo",
      texto: "Tu voz mueve la bola. Pasa por el hueco de cada puerta cantando la nota que indica.",
      ayuda: "Entrena afinar y sostener una nota concreta. Antes de cada puerta suena la nota guía (puedes quitarla). La puerta cuenta como pasada si estuviste dentro del hueco (±20 cents) al menos 0,45 s. Empieza en «Lento»: sube la velocidad cuando salgan 8 de 10.",
    },
    plataforma: {
      titulo: "🕹️ Plataformas",
      texto: "El héroe corre solo: canta la nota de cada obstáculo (agacharte, saltar, atacar, escudo…) justo a tiempo.",
      ayuda: "Cada grado de la escala es una acción y cada obstáculo muestra la nota que lo resuelve. Mantén la nota unos 0,1 s para que cuente. «Básico» usa 3 notas, «Medio» 5 y «Escala completa» 7 (con escudo y embestida). Las notas salen de tu rango vocal, de la tónica y de la escala que elijas; abajo siempre ves qué nota hace qué.",
    },
    ritmo: {
      titulo: "🥁 Eco de ritmo",
      texto: "Suena un patrón. Repítelo con «ta», palmas o tocando.",
      ayuda: "Cuenta 4 pulsos, escuchas el patrón, vuelve a contar y lo repites. Mide cuántos milisegundos te desvías de cada golpe (perfecto ≤ 45 ms). Con micrófono, usa auriculares para que el metrónomo no se cuele. Empieza en nivel 1 y 70 BPM.",
    },
  };

  function grupo(titulo, clave, opciones) {
    const cont = document.createElement("div");
    cont.className = "opcion-juego";
    const t = document.createElement("span");
    t.className = "opcion-titulo";
    t.textContent = titulo;
    const fila = document.createElement("div");
    fila.className = "grupo-botones";
    opciones.forEach(([valor, etiqueta]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (String(config[clave]) === String(valor) ? " activo" : "");
      b.textContent = etiqueta;
      b.addEventListener("click", () => {
        config[clave] = typeof valor === "number" ? valor : valor;
        guardarConfig();
        pintarOpciones();
      });
      fila.appendChild(b);
    });
    cont.append(t, fila);
    return cont;
  }

  function pintarOpciones() {
    const cont = $("opcionesJuego");
    cont.innerHTML = "";
    const tonicas = Array.from({ length: 12 }, (_, i) => [i, nombreTonica(i)]);
    const entrada = grupo("Entrada", "entrada", [["todo", "✨ Todo"], ["mic", "🎤 Micrófono"], ["piano", "🎹 Piano"], ["teclado", "⌨️ Teclado"]]);
    if (config.juego === "pasillo") {
      cont.append(
        grupo("Velocidad", "velocidad", [["lento", "Lento"], ["normal", "Normal"], ["rapido", "Rápido"]]),
        grupo("Escala", "escala", [["mayor", "Mayor"], ["menor", "Menor"], ["pentatonica", "Pentatónica"]]),
        grupo("Notas", "notacion", [["ambas", "Las dos (Re#/Mib)"], ["sostenidos", "Solo sostenidos"], ["teorica", "Teórica (bemoles)"]]),
        grupo("Tónica", "tonica", tonicas),
        grupo("Octava", "octava", [["exacta", "Exacta"], ["cualquiera", "Cualquiera"]]),
        grupo("Nota guía", "guia", [["si", "Sí"], ["no", "No"]]),
        entrada
      );
    } else if (config.juego === "plataforma") {
      cont.append(
        grupo("Notas en juego", "plataformaNivel", [["basico", "Básico · 3"], ["medio", "Medio · 5"], ["completo", "Escala completa · 7"]]),
        grupo("Mapa", "plataformaMapa", [["0", "🎲 Aleatorio"], ["1", "1 · Atardecer"], ["2", "2 · Noche helada"], ["3", "3 · Bosque"], ["4", "4 · Volcán"], ["5", "5 · Cripta"], ["6", "6 · Aurora"]]),
        grupo("Velocidad", "velocidad", [["lento", "Lento"], ["normal", "Normal"], ["rapido", "Rápido"]]),
        grupo("Escala", "escala", [["mayor", "Mayor"], ["menor", "Menor"], ["pentatonica", "Pentatónica"]]),
        grupo("Notas", "notacion", [["ambas", "Las dos (Re#/Mib)"], ["sostenidos", "Solo sostenidos"], ["teorica", "Teórica (bemoles)"]]),
        grupo("Tónica", "tonica", tonicas),
        grupo("Octava", "octava", [["exacta", "Exacta"], ["cualquiera", "Cualquiera"]]),
        entrada
      );
      pintarLeyendaPlataforma(cont);
    } else {
      cont.append(
        grupo("Tempo", "ritmoBpm", [[60, "60"], [70, "70"], [85, "85"], [100, "100"]]),
        grupo("Nivel", "ritmoNivel", [[1, "1 · negras"], [2, "2 · corcheas"], [3, "3 · síncopas"]]),
        grupo("Entrada", "entrada", [["todo", "✨ Todo"], ["mic", "🎤 Voz o palmas"], ["piano", "🎹 Piano"], ["teclado", "⌨️ Tocar / espacio"]])
      );
    }
  }

  function pintarLeyendaPlataforma(cont) {
    const plan = planPlataformas();
    const leyenda = document.createElement("div");
    leyenda.className = "leyenda-plataforma";
    leyenda.innerHTML = plan.lista
      .map((a) => `<span><b>${a.etq}</b> = ${config.octava === "exacta" ? nombreNota(a.midi) : nombreClase(a.midi)} <i>${a.grado}</i></span>`)
      .join("");
    cont.appendChild(leyenda);
  }

  function pintarDescripcion() {
    const d = DESCRIPCIONES[config.juego];
    $("juegoDescripcion").firstChild.textContent = d.texto + " ";
    $("juegoAyuda").dataset.ayuda = d.ayuda;
    document.querySelectorAll("[data-juego]").forEach((b) => {
      const activo = b.dataset.juego === config.juego;
      b.classList.toggle("activo", activo);
      b.setAttribute("aria-selected", String(activo));
    });
  }

  function elegirJuego(nombre) {
    detener(false);
    config.juego = nombre;
    guardarConfig();
    pintarDescripcion();
    pintarOpciones();
    estado("");
    fondo(ctx2d);
    pintarPortada();
    if (config.entrada === "piano" || config.entrada === "todo") Piano.construir();
  }

  function pintarPortada() {
    const d = DESCRIPCIONES[config.juego];
    ctx2d.fillStyle = "#efe6e0";
    ctx2d.font = "bold 28px Georgia, serif";
    ctx2d.textAlign = "center";
    ctx2d.fillText(d.titulo, W / 2, H / 2 - 12);
    ctx2d.font = "15px sans-serif";
    ctx2d.fillStyle = "rgba(237,231,225,0.75)";
    ctx2d.fillText("Pulsa «Jugar»", W / 2, H / 2 + 22);
  }

  async function jugar() {
    let ok = false;
    try {
      ok = await Tono.iniciar();
    } catch (e) {
      estado("No pude usar el micrófono: " + e.message + " (puedes jugar con el teclado).", "mal");
      return;
    }
    if (!ok) {
      estado("Este navegador no permite usar el micrófono aquí. Cambia la entrada a «Teclado».", "mal");
      return;
    }
    estado("");
    const creadores = { pasillo: crearPasillo, plataforma: crearPlataformas, ritmo: crearRitmo };
    arrancar(creadores[config.juego]());
    if (config.juego === "ritmo") {
      lienzo.focus();
    }
  }

  // teclado
  document.addEventListener("keydown", (e) => {
    if (juego && (config.entrada === "piano" || config.entrada === "todo") && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const semi = MAPA_TECLAS_PIANO[e.key.toLowerCase()];
      if (semi !== undefined) {
        e.preventDefault();
        Piano.tocar(baseTeclasPiano() + semi);
        return;
      }
    }
    if (!juego) return;
    if (config.entrada === "teclado") {
      if (e.key === "ArrowUp") {
        Tono.simulado = (Tono.simulado ?? 60) + 0.5;
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        Tono.simulado = (Tono.simulado ?? 60) - 0.5;
        e.preventDefault();
      }
    }
    if (/^[1-7]$/.test(e.key)) Tono.teclas[e.key] = true;
    if ((e.code === "Space" || e.key === " ") && config.juego === "ritmo" && !e.repeat) {
      e.preventDefault();
      if (j_registrar) j_registrar(performance.now());
    }
  });
  document.addEventListener("keyup", (e) => {
    if (config.entrada === "piano" || config.entrada === "todo") {
      const semi = MAPA_TECLAS_PIANO[e.key.toLowerCase()];
      if (semi !== undefined) Piano.soltar(baseTeclasPiano() + semi);
    }
    if (/^[1-7]$/.test(e.key)) Tono.teclas[e.key] = false;
  });
  lienzo.addEventListener("pointerdown", () => {
    if (juego && config.juego === "ritmo" && j_registrar) j_registrar(performance.now());
  });

  function iniciarPagina() {
    // Enlace directo desde Maestro / la guía: juegos.html?tab=pasillo | plataforma | ritmo
    const pedido = new URLSearchParams(window.location.search).get("tab");
    if (pedido && DESCRIPCIONES[pedido]) config.juego = pedido;
    document.querySelectorAll("[data-juego]").forEach((b) => b.addEventListener("click", () => elegirJuego(b.dataset.juego)));
    $("btnJugar").addEventListener("click", jugar);
    const acc = document.querySelector(".acciones");
    if (acc && !$("btnProbarMic")) {
      const b = document.createElement("button");
      b.id = "btnProbarMic";
      b.type = "button";
      b.className = "boton";
      b.textContent = "🎤 Probar micrófono";
      b.addEventListener("click", async () => {
        if (juego) return;
        if (config.entrada !== "mic" && config.entrada !== "todo") {
          estado("La prueba es para el micrófono: pon «Entrada → Micrófono» (o «Todo») abajo.", "mal");
          return;
        }
        if (Tono.activo) {
          Tono.detener();
          b.textContent = "🎤 Probar micrófono";
          estado("");
          return;
        }
        try {
          await Tono.iniciar();
          b.textContent = "■ Dejar de probar";
          estado("Canta una nota: abajo ves el volumen y la nota que oigo.", "");
        } catch (e) {
          estado("No pude abrir el micrófono: " + e.message, "mal");
        }
      });
      acc.insertBefore(b, $("btnJugar").nextSibling);
    }
    $("btnParar").addEventListener("click", () => {
      detener(true);
      Tono.detener();
    });
    window.addEventListener("rango-vocal-cambio", () => {
      if (!juego) pintarOpciones();
    });
    if (window.Progreso && Progreso.marcarHerramientaUsada) Progreso.marcarHerramientaUsada("juegos");
    pintarDescripcion();
    pintarOpciones();
    fondo(ctx2d);
    pintarPortada();
    $("btnParar").disabled = true;
    if (config.entrada === "piano" || config.entrada === "todo") Piano.construir();
  }

  // ganchos para pruebas automáticas
  window.JuegosTest = {
    config,
    Piano,
    nombreNota,
    nombreClase,
    nombreTonica,
    Tono,
    arrancar: (n) => ({ pasillo: crearPasillo, plataforma: crearPlataformas, ritmo: crearRitmo })[n](),
    iniciarJuego: (n) => {
      const creadores = { pasillo: crearPasillo, plataforma: crearPlataformas, ritmo: crearRitmo };
      config.juego = n;
      arrancar(creadores[n]());
      return juego;
    },
    paso: (dt) => {
      const g = juego;
      if (g) {
        g.actualizar(dt);
        g.dibujar(ctx2d);
      }
      return g;
    },
    registrarGolpe: (t) => j_registrar && j_registrar(t),
    juego: () => juego,
  };

  document.addEventListener("DOMContentLoaded", iniciarPagina);
})();
