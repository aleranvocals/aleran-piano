/*
 * Medidor de twang — lógica pura (sin DOM), para poder probarla fuera del navegador.
 *
 * Qué mide: el twang (estrechamiento del epilarinx / esfínter ariepiglótico) concentra energía
 * en la zona de ~2.5–4 kHz (el "ping" del sonido). Se compara la energía de esa banda con la del
 * "cuerpo" de la voz (300–2000 Hz), en dB, y se mira cuánto SUBE respecto a la voz normal de
 * quien canta. Como cada micrófono "pinta" esas frecuencias a su manera, hay un perfil por
 * tipo de dispositivo y una calibración de 4 segundos con la voz normal.
 *
 * Límites honestos: la literatura científica no fija una banda exacta (hay estudios que sitúan
 * el aumento en 2–3 kHz, otros entre 2.8 y 4.3 kHz, y la constricción ariepiglótica también
 * aparece en belting y ópera), y los perfiles de micrófono son ajustes orientativos basados en
 * respuestas típicas, no medidas de tu equipo. Es una ayuda para encontrar el twang, no un
 * diagnóstico.
 */
(function (raiz) {
  "use strict";

  const BANDA_TWANG = [2500, 4000]; // Hz
  const BANDA_BASE = [300, 2000]; // Hz: el "cuerpo" de la voz cantada
  const BASE_DEFECTO_DB = -28; // relación típica twang/cuerpo de una voz sin twang (sin calibrar)
  const UMBRAL_DELTA_DB = 5; // cuántos dB por encima de tu voz normal cuenta como "posible twang"
  const PISO_BASE_DB = -85; // por debajo no hay voz suficiente
  const SUAVIZADO = 0.2; // media móvil exponencial por cuadro
  const MS_PARA_ACTIVAR = 200;
  const MS_PARA_SOLTAR = 300;
  const MS_MANTENER = 700;
  const HISTERESIS_DB = 1.5;

  // ajusteDb se SUMA a la relación medida para compensar cómo el micrófono realza o recorta la banda de twang.
  // Valores orientativos (ver arriba): el SM58 y similares tienen un pico de presencia entre ~2 y 7 kHz;
  // los micros integrados de portátil Windows suelen recortar agudos; los de móvil y Mac son más neutros.
  const PERFILES = {
    movil: {
      etiqueta: "Móvil (micrófono del teléfono)",
      ajusteDb: 0,
      ayuda: "Acércalo a unos 20 cm de la boca y desactiva «mejora de voz» o el modo videollamada si lo tienes.",
    },
    dinamico: {
      etiqueta: "Micrófono dinámico (tipo SM58)",
      ajusteDb: -3,
      ayuda: "Estos micros tienen un pico de presencia que ya realza los agudos, así que se resta para no dar falsos positivos.",
    },
    condensador: {
      etiqueta: "Micrófono de condensador (estudio o USB)",
      ajusteDb: -0.5,
      ayuda: "Suele ser el más neutro. Los de diafragma grande a veces añaden un poco de brillo.",
    },
    pc: {
      etiqueta: "Integrado de portátil con Windows",
      ajusteDb: 1.5,
      ayuda: "Suelen recortar agudos y aplicar procesado del fabricante: se compensa un poco y conviene calibrar.",
    },
    mac: {
      etiqueta: "Integrado de Mac",
      ajusteDb: 0,
      ayuda: "Bastante neutro. Si usas «Aislamiento de voz» del sistema, desactívalo para esta prueba.",
    },
    otro: {
      etiqueta: "No lo sé / auriculares / otro",
      ajusteDb: 0,
      ayuda: "Sin compensación. Calibrar con tu voz normal es lo que más ayuda aquí.",
    },
  };

  /** Potencia media (en dB) de la banda [f1, f2] de un espectro en dB (como getFloatFrequencyData). */
  function potenciaMediaDb(espectroDb, sampleRate, f1, f2) {
    const n = espectroDb.length;
    const nyquist = sampleRate / 2;
    const bin = (f) => Math.min(n - 1, Math.max(0, Math.round((f / nyquist) * n)));
    let suma = 0;
    let cuenta = 0;
    for (let i = bin(f1); i <= bin(f2); i++) {
      const db = espectroDb[i];
      suma += Number.isFinite(db) ? Math.pow(10, db / 10) : 0;
      cuenta++;
    }
    return 10 * Math.log10(suma / Math.max(1, cuenta) + 1e-20);
  }

  function mediana(valores) {
    const v = valores.slice().sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  class DetectorTwang {
    constructor(opciones) {
      const o = opciones || {};
      this.perfil = PERFILES[o.perfil] ? o.perfil : "otro";
      this.base = typeof o.base === "number" ? o.base : null; // relación de tu voz normal, calibrada
      this.sensibilidadDb = typeof o.sensibilidadDb === "number" ? o.sensibilidadDb : 0; // + = más sensible
      this.reiniciar();
    }

    reiniciar() {
      this.ema = null;
      this.superaDesde = null;
      this.bajaDesde = null;
      this.activo = false;
      this.ultimaActivacion = -Infinity;
      this.ultimoCuadroVozMs = -Infinity;
      this.calibrando = null;
    }

    get calibrado() {
      return this.base !== null;
    }

    get umbralDb() {
      return Math.max(1.5, UMBRAL_DELTA_DB - this.sensibilidadDb);
    }

    iniciarCalibracion() {
      this.calibrando = [];
    }

    /** Termina la calibración y guarda la relación de la voz normal; null si no hubo suficiente voz. */
    terminarCalibracion(minimoMuestras) {
      const muestras = this.calibrando || [];
      this.calibrando = null;
      if (muestras.length < (minimoMuestras || 25)) return null;
      this.base = mediana(muestras);
      this.ema = null;
      return this.base;
    }

    /**
     * Procesa un cuadro. `vozActiva` debe ser true solo si hay una nota cantada clara (detector de pitch),
     * para no confundir con «s», «t» o ruido, que también tienen energía por encima de 2.5 kHz.
     */
    actualizar(espectroDb, sampleRate, vozActiva, ahoraMs) {
      const perfil = PERFILES[this.perfil];
      const baseDb = potenciaMediaDb(espectroDb, sampleRate, BANDA_BASE[0], BANDA_BASE[1]);
      const twangDb = potenciaMediaDb(espectroDb, sampleRate, BANDA_TWANG[0], BANDA_TWANG[1]);

      if (!vozActiva || baseDb < PISO_BASE_DB) {
        if (ahoraMs - this.ultimoCuadroVozMs > 400) {
          this.ema = null;
          this.superaDesde = null;
        }
        if (this.activo && ahoraMs - this.ultimaActivacion > MS_MANTENER && ahoraMs - this.ultimoCuadroVozMs > 400) {
          this.activo = false;
        }
        return { estado: "silencio", deltaDb: null, porcentaje: 0, detectado: this.activo, sinAgudos: false };
      }
      this.ultimoCuadroVozMs = ahoraMs;

      // La banda alta casi no existe: el micrófono (o el modo de llamada) no deja pasar agudos y no se puede medir.
      if (twangDb < baseDb - 60) {
        return { estado: "sin-agudos", deltaDb: null, porcentaje: 0, detectado: false, sinAgudos: true };
      }

      const relacion = twangDb - baseDb + perfil.ajusteDb;
      if (this.calibrando) this.calibrando.push(relacion);
      this.ema = this.ema === null ? relacion : this.ema + SUAVIZADO * (relacion - this.ema);

      const referencia = this.base !== null ? this.base : BASE_DEFECTO_DB;
      const delta = this.ema - referencia;
      const umbral = this.umbralDb;

      if (delta >= umbral) {
        this.bajaDesde = null;
        if (this.superaDesde === null) this.superaDesde = ahoraMs;
        if (!this.activo && ahoraMs - this.superaDesde >= MS_PARA_ACTIVAR) {
          this.activo = true;
          this.ultimaActivacion = ahoraMs;
        } else if (this.activo) {
          this.ultimaActivacion = ahoraMs;
        }
      } else if (delta < umbral - HISTERESIS_DB) {
        this.superaDesde = null;
        if (this.activo) {
          if (this.bajaDesde === null) this.bajaDesde = ahoraMs;
          if (ahoraMs - this.bajaDesde >= MS_PARA_SOLTAR && ahoraMs - this.ultimaActivacion >= MS_MANTENER) {
            this.activo = false;
            this.bajaDesde = null;
          }
        }
      }

      return {
        estado: this.activo ? "twang" : "voz",
        deltaDb: delta,
        porcentaje: porcentajeMedidor(delta, umbral),
        detectado: this.activo,
        sinAgudos: false,
      };
    }
  }

  /** De −4 dB a (umbral + 6) dB sobre tu voz normal → 0 a 100 %; el umbral cae siempre en el mismo punto de la barra. */
  function porcentajeMedidor(deltaDb, umbralDb) {
    const min = -4;
    const max = umbralDb + 6;
    return Math.max(0, Math.min(100, Math.round(((deltaDb - min) / (max - min)) * 100)));
  }

  const api = {
    PERFILES,
    BANDA_TWANG,
    BANDA_BASE,
    BASE_DEFECTO_DB,
    UMBRAL_DELTA_DB,
    DetectorTwang,
    potenciaMediaDb,
    porcentajeMedidor,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  raiz.Twang = api;
})(typeof window !== "undefined" ? window : globalThis);
