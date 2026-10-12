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
        fondo(ctx);
        // rejilla de notas de la escala (para leer dónde estás)
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        for (const n of notas) {
          const y = yDe(n);
          const esTonica = mod12(n - config.tonica) === 0;
          ctx.strokeStyle = esTonica ? "rgba(192,34,65,0.55)" : "rgba(237,231,225,0.10)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(40, y);
          ctx.lineTo(W, y);
          ctx.stroke();
          ctx.fillStyle = esTonica ? "#c02241" : "rgba(237,231,225,0.55)";
          ctx.fillText(nombreNota(n), 4, y + 4);
        }
        // puertas
        for (const p of puertas) {
          if (p.x > W + 5 || p.x + ANCHO_PUERTA < 0) continue;
          const yHueco = yDe(p.nota);
          const mitad = ((H - 52) / (vmax - vmin)) * 0.6;
          const color = p.hecho ? (p.ok ? "#3ecf6e" : "#ff3b4e") : "#b07a4a";
          ctx.fillStyle = color;
          ctx.fillRect(p.x, 0, ANCHO_PUERTA, yHueco - mitad);
          ctx.fillRect(p.x, yHueco + mitad, ANCHO_PUERTA, H - (yHueco + mitad));
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          for (let k = 0; k < 4; k++) ctx.fillRect(p.x + 8 + k * 13, 0, 2, H);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(nombreNota(p.nota), p.x + ANCHO_PUERTA / 2, Math.max(16, yHueco - mitad - 8));
        }
        // bola (tu voz)
        const yb = yDe(Math.max(vmin, Math.min(vmax, midiSuave)));
        ctx.beginPath();
        ctx.arc(BOLA_X, yb, 10, 0, Math.PI * 2);
        ctx.fillStyle = hayVoz ? "#7fd4ff" : "rgba(127,212,255,0.35)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(hayVoz ? nombreNota(midiSuave) : "…", BOLA_X + 16, yb + 4);
        // marcador
        ctx.textAlign = "right";
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = "#efe6e0";
        ctx.fillText(`${resultados.filter((r) => r.ok).length} / ${resultados.length} · puerta ${Math.min(TOTAL, resultados.length + 1)} de ${TOTAL}`, W - 10, 20);
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
        fondo(ctx);
        const x0 = 60;
        const x1 = W - 40;
        const yL = 190;
        const px = (t) => x0 + (t / (4 * beat)) * (x1 - x0);
        // pulsos
        ctx.strokeStyle = "rgba(237,231,225,0.25)";
        ctx.fillStyle = "rgba(237,231,225,0.7)";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        for (let b = 0; b <= 4; b++) {
          const x = px(b * beat);
          ctx.beginPath();
          ctx.moveTo(x, yL - 70);
          ctx.lineTo(x, yL + 70);
          ctx.stroke();
          if (b < 4) ctx.fillText(String(b + 1), x + 14, yL - 78);
        }
        // patrón esperado
        ctx.fillStyle = fase === "escucha" || fase === "tu-turno" || fase === "resultado" ? "#c02241" : "rgba(192,34,65,0.35)";
        esperados.forEach((e) => {
          ctx.beginPath();
          ctx.arc(px(e), yL, 14, 0, Math.PI * 2);
          ctx.fill();
        });
        // tus golpes
        if (fase === "tu-turno" || fase === "resultado") {
          const r = this._ultimo;
          golpes.forEach((g, i) => {
            const x = px(Math.max(0, Math.min(4 * beat, g.t)));
            let color = "#7fd4ff";
            if (fase === "resultado" && r) {
              const cerca = r.detalles.find((d) => d.delta !== null && Math.abs(g.t - d.esperado) < 0.23 && Math.abs((g.t - d.esperado) * 1000 - d.delta) < 1);
              color = cerca ? (cerca.cat === "perfecto" ? "#3ecf6e" : cerca.cat === "bien" ? "#f08a24" : "#ff3b4e") : "#888";
            }
            ctx.fillStyle = color;
            ctx.fillRect(x - 2, yL - 40, 4, 80);
          });
        }
        // cabezal
        let t = null;
        if (fase === "escucha" || fase === "cuenta1" || fase === "cuenta2" || fase === "tu-turno") t = Math.min(4 * beat, tFase);
        if (t !== null) {
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.fillRect(px(t) - 1, yL - 70, 2, 140);
        }
        ctx.fillStyle = "#efe6e0";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "left";
        const titulo = { inicio: "…", cuenta1: "Cuenta", escucha: "Escucha", cuenta2: "Prepárate", "tu-turno": "¡Tu turno!", resultado: "Resultado" }[fase];
        ctx.fillText(`${titulo} · ronda ${Math.min(RONDAS, ronda + (fase === "resultado" ? 0 : 1))} de ${RONDAS}`, 16, 30);
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "rgba(237,231,225,0.7)";
        ctx.fillText(`${bpm} BPM · nivel ${config.ritmoNivel}`, 16, 52);
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
