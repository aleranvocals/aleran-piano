/*
 * juegos.js — Juegos de entrenamiento con la voz y el ritmo (no son un pasatiempo: cada uno trabaja una cosa).
 *
 *  🎯 Pasillo      — afinación: la bola sube y baja con tu voz y tienes que pasar por el hueco de cada puerta
 *                    (la nota objetivo). Entrena cantar la nota exacta y sostenerla.
 *  🕹️ Plataformas — escalas: un personaje en píxeles; cada GRADO de la escala es una acción
 *                    (tónica = avanzar, tercera = saltar, quinta = atacar). Entrena a ir a un grado de la escala
 *                    a voluntad, no cromático.
 *  🥁 Eco de ritmo — suena un patrón y lo repites (con la voz «ta», palmas o tocando); mide cuántos ms te desvías.
 *
 * Usa el micrófono y el rango vocal ya elegidos en la barra de arriba (audio.js / app-shell.js).
 * Sin micrófono se puede jugar con el teclado (↑↓ para la altura, 1·2·3 para las acciones, Espacio para el ritmo).
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const NOMBRES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  const nombreNota = (m) => {
    const r = Math.round(m);
    return NOMBRES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
  };
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const ESCALAS = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], pentatonica: [0, 2, 4, 7, 9] };
  const NOMBRE_ESCALA = { mayor: "mayor", menor: "menor", pentatonica: "pentatónica" };

  // ---------------------------------------------------------------- configuración que se recuerda
  const CLAVE_CONFIG = "aleran-juegos-config";
  const config = Object.assign(
    { velocidad: "lento", escala: "mayor", tonica: 0, octava: "exacta", guia: "si", entrada: "mic", ritmoBpm: 70, ritmoNivel: 1, juego: "pasillo" },
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

  // ---------------------------------------------------------------- entrada de tono (micrófono o teclado)
  const Tono = {
    activo: false,
    midi: null,
    t: 0,
    simulado: null, // altura virtual (teclado o pruebas)
    teclas: { 1: false, 2: false, 3: false },
    async iniciar() {
      if (config.entrada === "teclado") {
        if (this.simulado === null) this.simulado = (rangoActual()[0] + rangoActual()[1]) / 2;
        return true;
      }
      if (this.activo) return true;
      if (!window.MicrofonoEngine || !window.MicrofonoEngine.disponible()) return false;
      await window.MicrofonoEngine.iniciar();
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
    },
    /** Altura actual en semitonos (decimal), o null si no hay voz. */
    leer() {
      if (config.entrada === "teclado" || this.simulado !== null) return this.simulado;
      return this.midi !== null && performance.now() - this.t < 220 ? this.midi : null;
    },
  };

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
    }
    if (juego && !g.terminado) rafId = requestAnimationFrame(bucle);
    else rafId = null;
  }

  function arrancar(nuevo) {
    detener(false);
    juego = nuevo;
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
      for (const e of this.estrellas) {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.75 * Math.abs(Math.sin(t * 0.9 + e.f))})`;
        ctx.fillRect(e.x, e.y, e.r, e.r);
      }
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
              if (Math.abs(diferencia(m, p.nota)) <= 0.45) p.dentro += dt;
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
          ctx.font = "bold 10px Consolas, monospace";
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
            ctx.fillStyle = base[0];
            ctx.fillRect(p.x, y0, ANCHO_PUERTA, y1 - y0);
            ctx.fillStyle = base[1];
            ctx.fillRect(p.x, y0, 4, y1 - y0);
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
          ctx.font = "bold 13px Consolas, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#fff";
          ctx.fillText(nombreNota(p.nota), p.x + ANCHO_PUERTA / 2, yPlaca + 14);
        }
        // ---- el espíritu de la voz (sprite de 12×9 píxeles) y su estela
        const yb = yDe(Math.max(vmin, Math.min(vmax, midiSuave)));
        const objetivo = puertas.find((q) => !q.hecho && q.x + ANCHO_PUERTA > BOLA_X - 10);
        const afinada = hayVoz && objetivo && Math.abs(diferencia(midiSuave, objetivo.nota)) <= 0.45;
        if (hayVoz && Math.random() < 0.9) Arte.estela(BOLA_X - 14, yb + 2, afinada ? "#3ecf6e" : "#7fd4ff");
        const aleteo = Math.floor(t * 9) % 2;
        const S = 3;
        const filas = aleteo
          ? ["....BBBB....", "..BBBBBBBB..", ".BBBLLLBBBB.", "WBBLWKBBBBBM", "WWBBBBBBBBMM", ".WBBBBBBBB..", "..BBBBBBB...", "...BB..BB..."]
          : ["....BBBB....", "..BBBBBBBB..", ".BBBLLLBBBB.", ".BBLWKBBBBBM", "WWBBBBBBBBMM", "WWWBBBBBBB..", "..BBBBBBB...", "...BB..BB..."];
        const paleta = { B: hayVoz ? (afinada ? "#5ee08a" : "#7fd4ff") : "#4d6a86", L: "#bfefff", W: hayVoz ? "#3a8fd0" : "#33485c", K: "#10101a", M: "#ff5c7a" };
        if (afinada) {
          ctx.fillStyle = "rgba(94,224,138,0.25)";
          ctx.beginPath();
          ctx.arc(BOLA_X + 6, yb, 26 + 2 * Math.sin(t * 10), 0, Math.PI * 2);
          ctx.fill();
        }
        Arte.sprite(ctx, filas, paleta, BOLA_X - 18, yb - 12 + Math.sin(t * 8) * 1.5, S);
        ctx.font = "bold 12px Consolas, monospace";
        ctx.textAlign = "left";
        Arte.pastilla(ctx, BOLA_X + 22, yb - 10, 40, 18, "rgba(10,6,24,0.85)");
        ctx.fillStyle = hayVoz ? "#fff" : "#8a7fa8";
        ctx.fillText(hayVoz ? nombreNota(midiSuave) : "canta…", BOLA_X + 26, yb + 3);
        Arte.dibujar(ctx);
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

  // ================================================================ 🕹️ PLATAFORMAS (escalas)
  function crearPlataformas() {
    const LW = 160;
    const LH = 90;
    const ESC = 4; // 160×90 lógicos → 640×360
    const pasos = ESCALAS[config.escala];
    const [lo, hi] = rangoActual();
    const centro = (lo + hi) / 2;
    // El MIDI más cercano al centro de tu rango para cada grado que se usa como acción.
    const cerca = (pc) => {
      let mejor = null;
      for (let m = lo - 6; m <= hi + 6; m++) if (mod12(m) === mod12(pc) && (mejor === null || Math.abs(m - centro) < Math.abs(mejor - centro))) mejor = m;
      return mejor;
    };
    const acciones = {
      avanzar: { pc: config.tonica + pasos[0], etiqueta: "Avanzar", grado: "1º (tónica)" },
      saltar: { pc: config.tonica + pasos[2], etiqueta: "Saltar", grado: "3º" },
      atacar: { pc: config.tonica + 7, etiqueta: "Atacar", grado: "5º" },
    };
    for (const a of Object.values(acciones)) a.midi = cerca(a.pc);
    const LARGO = 700;
    const SUELO = 70;

    // nivel: fosos y enemigos a intervalos; el primero a distancia suficiente para entender el juego
    const obstaculos = [];
    let x = 110;
    let alt = true;
    while (x < LARGO - 60) {
      obstaculos.push(alt ? { tipo: "foso", x, w: 20 } : { tipo: "enemigo", x, vivo: true });
      alt = !alt;
      x += 70 + Math.floor(Math.random() * 30);
    }
    const jug = { y: SUELO, vy: 0, suelo: true, ataque: 0, vidas: 3, enfriamiento: 0, parpadeo: 0, nota: { avanzar: 0, saltar: 0, atacar: 0 } };
    let cam = 0;
    let puntos = 0;
    let caida = false;

    function activa(clave, m) {
      if (Tono.teclas[{ avanzar: 1, saltar: 2, atacar: 3 }[clave]]) return true;
      if (m === null) return false;
      const t = acciones[clave].midi;
      let d = m - t;
      if (config.octava !== "exacta") d = ((d + 6) % 12 + 12) % 12 - 6;
      return Math.abs(d) <= 0.5;
    }

    const j = {
      terminado: false,
      acciones,
      obstaculos,
      jug,
      get cam() {
        return cam;
      },
      actualizar(dt) {
        const m = Tono.leer();
        for (const k of ["avanzar", "saltar", "atacar"]) jug.nota[k] = activa(k, m) ? jug.nota[k] + dt : 0;
        jug.enfriamiento = Math.max(0, jug.enfriamiento - dt);
        jug.parpadeo = Math.max(0, jug.parpadeo - dt);
        if (jug.nota.avanzar > 0.12 && jug.suelo) cam += 26 * dt;
        if (jug.nota.avanzar > 0.12 && !jug.suelo) cam += 20 * dt;
        if (jug.nota.saltar > 0.12 && jug.suelo && jug.enfriamiento === 0) {
          jug.vy = -118;
          jug.suelo = false;
          jug.enfriamiento = 0.35;
        }
        if (jug.nota.atacar > 0.12 && jug.ataque <= 0 && jug.enfriamiento === 0) {
          jug.ataque = 0.28;
          jug.enfriamiento = 0.4;
        }
        jug.ataque = Math.max(0, jug.ataque - dt);
        // física
        if (!jug.suelo || caida) {
          jug.vy += 330 * dt;
          jug.y += jug.vy * dt;
        }
        const enFoso = obstaculos.find((o) => o.tipo === "foso" && 30 + cam > o.x + 2 && 30 + cam < o.x + o.w - 2);
        if (jug.y >= SUELO && !enFoso && !caida) {
          jug.y = SUELO;
          jug.vy = 0;
          jug.suelo = true;
        } else if (jug.y >= SUELO && enFoso && jug.suelo) {
          caida = true; // pisó un foso sin saltar
          jug.suelo = false;
          jug.vy = 0;
        }
        if (caida && jug.y > LH + 20) {
          perderVida("¡Al foso! Salta (3º grado) antes de llegar.");
          cam = Math.max(0, enFoso ? enFoso.x - 38 : cam - 30);
          caida = false;
          jug.y = SUELO;
          jug.vy = 0;
          jug.suelo = true;
        }
        // enemigos
        for (const o of obstaculos) {
          if (o.tipo !== "enemigo" || !o.vivo) continue;
          const dx = o.x - (30 + cam);
          if (jug.ataque > 0 && dx > -4 && dx < 22) {
            o.vivo = false;
            puntos += 10;
            estado("¡Enemigo derrotado! (5º grado)", "ok");
          } else if (Math.abs(dx) < 6 && jug.y > SUELO - 8 && jug.parpadeo === 0) {
            perderVida("Te tocó un enemigo: ataca (5º grado) cuando esté cerca.");
            cam = Math.max(0, cam - 24);
            jug.parpadeo = 1.2;
          }
        }
        if (cam >= LARGO - 40 && !this.terminado) {
          this.terminado = true;
          let record = false;
          try {
            if (window.Progreso) record = Progreso.actualizarRecord("juegoPlataformaPuntos", puntos + jug.vidas * 20, (n, a) => n > a);
          } catch {
            /* sin récord */
          }
          estado(`¡Nivel completado! ${puntos} puntos y ${jug.vidas} vida${jug.vidas === 1 ? "" : "s"}.${record ? " 🏆 ¡Récord!" : ""}`, "ok");
          detener(false);
        }
      },
      dibujar(ctx) {
        fondo(ctx, "#0e0f18");
        ctx.setTransform(ESC, 0, 0, ESC, 0, 0);
        ctx.imageSmoothingEnabled = false;
        // estrellas y colinas
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 24; i++) ctx.fillRect(((i * 37 - cam * 0.1) % LW + LW) % LW, (i * 13) % 50, 1, 1);
        ctx.fillStyle = "#1b1e33";
        for (let i = 0; i < 6; i++) {
          const bx = ((i * 60 - cam * 0.3) % (LW + 60) + LW + 60) % (LW + 60) - 30;
          ctx.fillRect(bx, SUELO - 18 - (i % 3) * 6, 36, 40);
        }
        // suelo con fosos
        for (let sx = 0; sx < LW; sx++) {
          const wx = sx + cam;
          const foso = obstaculos.some((o) => o.tipo === "foso" && wx >= o.x && wx < o.x + o.w);
          if (foso) continue;
          ctx.fillStyle = "#3b7d4f";
          ctx.fillRect(sx, SUELO, 1, 2);
          ctx.fillStyle = (Math.floor(wx / 4) + 0) % 2 ? "#6b4a2d" : "#7a5634";
          ctx.fillRect(sx, SUELO + 2, 1, LH - SUELO - 2);
        }
        // enemigos
        for (const o of obstaculos) {
          if (o.tipo !== "enemigo" || !o.vivo) continue;
          const sx = o.x - cam;
          if (sx < -10 || sx > LW + 10) continue;
          ctx.fillStyle = "#4cd15b";
          ctx.fillRect(sx, SUELO - 6, 9, 6);
          ctx.fillRect(sx + 1, SUELO - 8, 7, 2);
          ctx.fillStyle = "#0b2a12";
          ctx.fillRect(sx + 2, SUELO - 5, 1, 1);
          ctx.fillRect(sx + 6, SUELO - 5, 1, 1);
        }
        // meta
        const metaX = LARGO - 30 - cam;
        if (metaX < LW + 10) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(metaX, SUELO - 28, 1, 28);
          ctx.fillStyle = "#c02241";
          ctx.fillRect(metaX + 1, SUELO - 28, 10, 7);
        }
        // personaje
        if (!(jug.parpadeo > 0 && Math.floor(jug.parpadeo * 12) % 2)) {
          const px = 26;
          const py = Math.round(jug.y);
          ctx.fillStyle = "#c02241";
          ctx.fillRect(px, py - 12, 8, 7); // torso
          ctx.fillStyle = "#f2c9a0";
          ctx.fillRect(px + 1, py - 18, 6, 6); // cabeza
          ctx.fillStyle = "#222";
          ctx.fillRect(px + 5, py - 16, 1, 1);
          ctx.fillStyle = "#2b2b46";
          ctx.fillRect(px + 1, py - 5, 3, 5);
          ctx.fillRect(px + 4, py - 5, 3, 5);
          if (jug.ataque > 0) {
            ctx.fillStyle = "#fff";
            ctx.fillRect(px + 8, py - 14, 14, 2);
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fillRect(px + 8, py - 18, 12, 10);
          }
        }
        // HUD
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#efe6e0";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("♥".repeat(jug.vidas) + "  " + puntos + " pts", 10, 20);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(10, 28, 140, 6);
        ctx.fillStyle = "#c02241";
        ctx.fillRect(10, 28, 140 * Math.min(1, cam / (LARGO - 40)), 6);
      },
    };

    function perderVida(msg) {
      jug.vidas -= 1;
      estado(msg, "mal");
      if (jug.vidas <= 0) {
        j.terminado = true;
        estado(`Sin vidas. Llegaste al ${Math.round((100 * cam) / (LARGO - 40))} % del nivel con ${puntos} puntos. ¡Otra vez!`, "mal");
        detener(false);
      }
    }
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
          estado(config.entrada === "teclado" ? "¡Tu turno! Toca con la barra espaciadora o haciendo clic." : "¡Tu turno! Di «ta», da palmas o toca la pantalla.");
        } else if (fase === "tu-turno") {
          // detección de golpes con el micrófono (palmas o sílaba)
          if (config.entrada !== "teclado" && window.MicrofonoEngine && window.MicrofonoEngine.obtenerAnalizador) {
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
      ayuda: "Entrena afinar y sostener una nota concreta. Antes de cada puerta suena la nota guía (puedes quitarla). La puerta cuenta como pasada si estuviste dentro del hueco (±45 cents) al menos 0,45 s. Empieza en «Lento»: sube la velocidad cuando salgan 8 de 10.",
    },
    plataforma: {
      titulo: "🕹️ Plataformas",
      texto: "Cada grado de la escala es una acción: tónica avanzar, tercera saltar, quinta atacar.",
      ayuda: "Entrena ir a un grado de la escala a voluntad (no cromático). Mantén la nota ~0,12 s para que cuente. Los fosos se saltan con la tercera; los enemigos se atacan con la quinta cuando están cerca. Las notas salen de tu rango vocal y de la tónica y escala que elijas.",
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
    const tonicas = NOMBRES.map((n, i) => [i, n]);
    const entrada = grupo("Entrada", "entrada", [["mic", "🎤 Micrófono"], ["teclado", "⌨️ Teclado"]]);
    if (config.juego === "pasillo") {
      cont.append(
        grupo("Velocidad", "velocidad", [["lento", "Lento"], ["normal", "Normal"], ["rapido", "Rápido"]]),
        grupo("Escala", "escala", [["mayor", "Mayor"], ["menor", "Menor"], ["pentatonica", "Pentatónica"]]),
        grupo("Tónica", "tonica", tonicas),
        grupo("Octava", "octava", [["exacta", "Exacta"], ["cualquiera", "Cualquiera"]]),
        grupo("Nota guía", "guia", [["si", "Sí"], ["no", "No"]]),
        entrada
      );
    } else if (config.juego === "plataforma") {
      cont.append(
        grupo("Escala", "escala", [["mayor", "Mayor"], ["menor", "Menor"], ["pentatonica", "Pentatónica"]]),
        grupo("Tónica", "tonica", tonicas),
        grupo("Octava", "octava", [["exacta", "Exacta"], ["cualquiera", "Cualquiera"]]),
        entrada
      );
      pintarLeyendaPlataforma(cont);
    } else {
      cont.append(
        grupo("Tempo", "ritmoBpm", [[60, "60"], [70, "70"], [85, "85"], [100, "100"]]),
        grupo("Nivel", "ritmoNivel", [[1, "1 · negras"], [2, "2 · corcheas"], [3, "3 · síncopas"]]),
        grupo("Entrada", "entrada", [["mic", "🎤 Voz o palmas"], ["teclado", "⌨️ Tocar / espacio"]])
      );
    }
  }

  function pintarLeyendaPlataforma(cont) {
    const pasos = ESCALAS[config.escala];
    const [lo, hi] = rangoActual();
    const centro = (lo + hi) / 2;
    const cerca = (pc) => {
      let mejor = null;
      for (let m = lo - 6; m <= hi + 6; m++) if (mod12(m) === mod12(pc) && (mejor === null || Math.abs(m - centro) < Math.abs(mejor - centro))) mejor = m;
      return mejor;
    };
    const leyenda = document.createElement("div");
    leyenda.className = "leyenda-plataforma";
    const items = [
      ["Avanzar", config.tonica + pasos[0], "1ª (tónica)"],
      ["Saltar", config.tonica + pasos[2], "3ª"],
      ["Atacar", config.tonica + 7, "5ª"],
    ];
    leyenda.innerHTML = items
      .map(([a, pc, g]) => {
        const m = cerca(pc);
        return `<span><b>${a}</b> = ${config.octava === "exacta" ? nombreNota(m) : NOMBRES[mod12(pc)]} <i>${g}</i></span>`;
      })
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
    if (!juego) return;
    if (config.entrada === "teclado" || Tono.simulado !== null) {
      if (e.key === "ArrowUp") {
        Tono.simulado = (Tono.simulado ?? 60) + 0.5;
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        Tono.simulado = (Tono.simulado ?? 60) - 0.5;
        e.preventDefault();
      }
    }
    if (e.key === "1" || e.key === "2" || e.key === "3") Tono.teclas[e.key] = true;
    if ((e.code === "Space" || e.key === " ") && config.juego === "ritmo" && !e.repeat) {
      e.preventDefault();
      if (j_registrar) j_registrar(performance.now());
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "1" || e.key === "2" || e.key === "3") Tono.teclas[e.key] = false;
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
  }

  // ganchos para pruebas automáticas
  window.JuegosTest = {
    config,
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
