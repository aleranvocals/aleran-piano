/* beta-voz.js — medidas de voz compartidas por las herramientas beta (color, proyección, trémolo, aire).
 * Dos capas: funciones PURAS sobre arrays (se prueban con señales sintéticas en aleran-clon/herramientas/test_beta_voz.mjs)
 * y una capa «en vivo» que lee el micrófono con el motor que ya existe (MicrofonoEngine, audio.js).
 * Todo se compara con la voz calibrada del propio alumno, nunca con una voz ideal. */
(function (raiz) {
  "use strict";

  var EPS = 1e-12;
  function db20(x) { return 20 * Math.log10(Math.max(x, EPS)); }
  function db10(x) { return 10 * Math.log10(Math.max(x, EPS)); }

  function mediana(a) {
    var v = a.filter(function (x) { return typeof x === "number" && isFinite(x); }).sort(function (p, q) { return p - q; });
    if (!v.length) return null;
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  // ---- nivel
  function rms(buf) {
    var s = 0;
    for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  // ---- periodicidad (autocorrelación normalizada) -> r en 0..1, lag y f0 aproximada
  function autocorr(buf, sr, fmin, fmax) {
    fmin = fmin || 70; fmax = fmax || 1000;
    var n = buf.length;
    var lagMin = Math.floor(sr / fmax), lagMax = Math.min(Math.floor(sr / fmin), n - 2);
    var mejor = 0, mejorLag = 0;
    for (var lag = lagMin; lag <= lagMax; lag++) {
      var s = 0, a = 0, b = 0;
      for (var i = 0; i + lag < n; i++) { s += buf[i] * buf[i + lag]; a += buf[i] * buf[i]; b += buf[i + lag] * buf[i + lag]; }
      var r = s / Math.sqrt(a * b + EPS);
      if (r > mejor) { mejor = r; mejorLag = lag; }
    }
    return { r: Math.max(0, Math.min(1, mejor)), lag: mejorLag, f0: mejorLag ? sr / mejorLag : 0 };
  }

  // «Cuánto más fuerte es la parte periódica que el resto», en dB: mayor = voz más limpia.
  function hnrDb(r) {
    var x = Math.max(0.001, Math.min(0.999, r));
    return db10(x / (1 - x));
  }

  // ---- espectro (freqDb = dB por casilla, como getFloatFrequencyData)
  function potenciaBanda(freqDb, sr, fftSize, f1, f2) {
    var ancho = sr / fftSize, p = 0;
    var i1 = Math.max(1, Math.floor(f1 / ancho)), i2 = Math.min(freqDb.length - 1, Math.ceil(f2 / ancho));
    for (var i = i1; i <= i2; i++) p += Math.pow(10, freqDb[i] / 10);
    return p;
  }

  // Presencia: energía de 2–4 kHz respecto al total hasta 8 kHz, en dB (más alto = voz más «por delante»).
  function presenciaDb(freqDb, sr, fftSize) {
    return db10(potenciaBanda(freqDb, sr, fftSize, 2000, 4000) / potenciaBanda(freqDb, sr, fftSize, 80, 8000));
  }

  // Inclinación del espectro en dB por octava, medida sobre los armónicos de f0 (así subir de nota no la cambia).
  // Más cerca de 0 = más brillante (más claro); más negativa = más oscuro. null si hay pocos armónicos.
  function inclinacion(freqDb, sr, fftSize, f0) {
    if (!f0 || f0 < 60) return null;
    var ancho = sr / fftSize, xs = [], ys = [];
    for (var k = 1; k * f0 < 5000 && k * f0 < sr / 2 - ancho; k++) {
      var c = Math.round((k * f0) / ancho), m = -Infinity;
      for (var j = c - 1; j <= c + 1; j++) if (j > 0 && j < freqDb.length && freqDb[j] > m) m = freqDb[j];
      xs.push(Math.log2(k)); ys.push(m);
    }
    if (xs.length < 4) return null;
    var n = xs.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; }
    var den = n * sxx - sx * sx;
    return den ? (n * sxy - sx * sy) / den : null;
  }

  // ---- oscilaciones lentas (trémolo / vibrato)
  // Resta la tendencia lenta (media móvil de ~1 s), y devuelve amplitud pico a pico robusta y frecuencia de la oscilación.
  function oscilacion(serie, fps) {
    var v = serie.filter(function (x) { return typeof x === "number" && isFinite(x); });
    if (v.length < fps) return { p2p: 0, hz: 0 };
    var w = Math.max(3, Math.round(fps)), d = [];
    for (var i = 0; i < v.length; i++) {
      var a = Math.max(0, i - (w >> 1)), b = Math.min(v.length, i + (w >> 1) + 1), s = 0;
      for (var k = a; k < b; k++) s += v[k];
      d.push(v[i] - s / (b - a));
    }
    var ord = d.slice().sort(function (p, q) { return p - q; });
    var p2p = ord[Math.floor(ord.length * 0.95)] - ord[Math.floor(ord.length * 0.05)];
    var umbral = p2p * 0.12, cruces = 0, signo = 0;
    for (var j = 0; j < d.length; j++) {
      var sg = d[j] > umbral ? 1 : d[j] < -umbral ? -1 : 0;
      if (sg !== 0) { if (signo !== 0 && sg !== signo) cruces++; signo = sg; }
    }
    return { p2p: p2p, hz: cruces / 2 / (v.length / fps) };
  }

  // pitchCents y volDb: series de ~2 s a `fps`. Devuelve {tipo, pitch, vol, hz}.
  var UMBRAL = { vibratoCents: 30, tremoloDb: 3, tremoloMaxCents: 20, hzMin: 3, hzMax: 9 };
  function clasificarOscilacion(pitchCents, volDb, fps) {
    var p = oscilacion(pitchCents, fps), v = oscilacion(volDb, fps);
    var hz = p.p2p / UMBRAL.vibratoCents >= v.p2p / UMBRAL.tremoloDb ? p.hz : v.hz;
    var tipo = "ninguno";
    if (hz >= UMBRAL.hzMin && hz <= UMBRAL.hzMax) {
      if (p.p2p >= UMBRAL.vibratoCents && v.p2p / UMBRAL.tremoloDb <= 2.5 * (p.p2p / UMBRAL.vibratoCents)) tipo = "vibrato";
      else if (v.p2p >= UMBRAL.tremoloDb && p.p2p < UMBRAL.tremoloMaxCents) tipo = "tremolo";
      else if (p.p2p >= UMBRAL.vibratoCents || v.p2p >= UMBRAL.tremoloDb) tipo = "mixto";
    }
    return { tipo: tipo, pitch: p.p2p, vol: v.p2p, hz: hz };
  }

  // ---- en vivo (navegador) ----------------------------------------------------------------------------
  var tbuf = null, fbuf = null;

  function abrir() {
    var motor = raiz.MicrofonoEngine;
    if (!motor || !motor.disponible()) return Promise.reject(new Error("Este navegador no permite usar el micrófono aquí."));
    return motor.iniciar().then(function () {
      var an = motor.obtenerAnalizador();
      if (!an) throw new Error("No pude abrir el micrófono.");
      an.smoothingTimeConstant = 0.4;
      tbuf = new Float32Array(an.fftSize);
      fbuf = new Float32Array(an.frequencyBinCount);
      return an;
    });
  }

  // Una lectura del momento. `voz` es true solo si hay una nota clara con volumen suficiente.
  function leer(an) {
    var motor = raiz.MicrofonoEngine;
    var sr = an.context.sampleRate;
    an.getFloatTimeDomainData(tbuf);
    an.getFloatFrequencyData(fbuf);
    var nivel = db20(rms(tbuf));
    var p = motor.leerPitch(0.85);
    var ac = autocorr(tbuf, sr);
    var f0 = p ? p.frecuencia : 0;
    var voz = !!p && nivel > -50;
    return {
      nivelDb: nivel,
      voz: voz,
      f0: f0,
      midi: p ? 69 + 12 * Math.log2(p.frecuencia / 440) : null,
      hnr: hnrDb(ac.r),
      periodicidad: ac.r,
      inclinacion: voz ? inclinacion(fbuf, sr, an.fftSize, f0) : null,
      presDb: presenciaDb(fbuf, sr, an.fftSize),
    };
  }

  // Recoge lecturas con voz durante `seg` segundos y devuelve la mediana de cada medida.
  function calibrar(an, seg, alProgreso) {
    return new Promise(function (resolve) {
      var t0 = performance.now(), cols = { nivelDb: [], inclinacion: [], presDb: [], hnr: [] }, n = 0;
      var tic = setInterval(function () {
        var t = (performance.now() - t0) / 1000;
        var l = leer(an);
        if (l.voz) { n++; cols.nivelDb.push(l.nivelDb); cols.presDb.push(l.presDb); cols.hnr.push(l.hnr); if (l.inclinacion !== null) cols.inclinacion.push(l.inclinacion); }
        if (alProgreso) alProgreso(Math.min(1, t / seg), n);
        if (t >= seg) {
          clearInterval(tic);
          resolve(n >= 15 ? { nivelDb: mediana(cols.nivelDb), inclinacion: mediana(cols.inclinacion), presDb: mediana(cols.presDb), hnr: mediana(cols.hnr), lecturas: n } : null);
        }
      }, 30);
    });
  }

  raiz.BetaVoz = {
    puro: { rms: rms, autocorr: autocorr, hnrDb: hnrDb, presenciaDb: presenciaDb, inclinacion: inclinacion, oscilacion: oscilacion, clasificarOscilacion: clasificarOscilacion, mediana: mediana, UMBRAL: UMBRAL },
    abrir: abrir, leer: leer, calibrar: calibrar, db20: db20,
  };
})(typeof window !== "undefined" ? window : globalThis);
