/*
 * Medidor de twang — lógica pura (sin DOM), para poder probarla fuera del navegador.
 *
 * Qué mide (v3, 22/10/2026): el twang (estrechamiento del epilarinx) concentra energía en el grupo de formantes
 * F3-F5 (~2,4–4,2 kHz): ese «ping». Se mide como el SINGING POWER RATIO (Omori y cols., 1996), la medida estándar
 * del «anillo» de la voz cantada: el PICO más alto entre 2,4 y 4,2 kHz menos el PICO más alto entre 80 Hz y 2 kHz,
 * en dB, combinado con la relación entre bandas de la v2 (ver indiceTwang). Con la v2 sola, un twang claro subía
 * unos 3 dB y el umbral fijo pedía 4,5: por eso no detectaba twangs evidentes y a veces marcaba todo.
 *
 * Calibración en dos pasos POR REGISTRO (grave, medio, agudo): tu voz normal y tu voz con twang. El umbral se pone
 * a medio camino entre las dos, así que se adapta a tu voz y a tu micrófono (antes era un margen fijo de 4,5 dB para
 * todo el mundo: de ahí las «tolerancias raras»). Si solo calibras la voz normal, se usa un margen genérico.
 * Solo se calibra con cuadros con nota reconocible: el aire, las consonantes y el ruido ya no ensucian la referencia.
 *
 * Límites honestos: no existe una definición cuantitativa única del twang; los pesos y umbrales son
 * decisiones de diseño razonadas con lo que se sabe (clúster F3-F5, pico cerca de 3 kHz, cambios por debajo
 * de 2 kHz), no valores clínicos. Cada micrófono pinta esas bandas a su manera, por eso hay perfiles y
 * calibración con tu propia voz. Es una ayuda para encontrar y comparar el twang, no un diagnóstico.
 */
(function (raiz) {
  "use strict";

  const BANDA_TWANG = [2500, 4000]; // Hz (compatibilidad)
  const BANDA_BASE = [300, 2000]; // Hz: el «cuerpo» de la voz cantada
  const BANDAS = {
    bajos: [100, 1000],
    medios: [1000, 2000],
    flanco: [2000, 2450],
    altos: [2500, 4000],
    aire: [5000, 8000],
  };
  const BANDA_PICO_ALTO = [2400, 4200]; // Hz: dónde suena el «ping» del twang (F3-F5)
  const BANDA_PICO_BAJO = [80, 2000]; // Hz: fundamental y primeros formantes
  const BASE_DEFECTO_DB = -16; // índice típico de una voz cantada sin twang (sin calibrar)
  // Posición (en escala log de frecuencia) del centro de agudos entre el centro de medios y el de aire.
  const T_AGUDOS = Math.log(Math.sqrt(2500 * 4000) / Math.sqrt(1000 * 2000)) / Math.log(Math.sqrt(5000 * 8000) / Math.sqrt(1000 * 2000));
  const SEPARACION_MINIMA_DB = 2.5; // si tu twang y tu voz normal se separan menos, la calibración de twang no sirve
  const REL_MEDIOS_DEFECTO = -22; // dB de los medios respecto a los graves en una voz normal (solo para dibujar)
  const REL_ALTOS_DEFECTO = -36; // idem para los agudos
  const UMBRAL_DELTA_DB = 4; // sin calibrar el twang: cuántos dB sobre tu voz normal cuentan como «posible twang»
  const PISO_BASE_DB = -100; // por debajo no hay voz suficiente (límite del analizador); la voz la confirma el detector de nota
  const SUAVIZADO = 0.2; // media móvil exponencial por cuadro
  const MS_PARA_ACTIVAR = 200;
  const MS_PARA_SOLTAR = 300;
  const MS_MANTENER = 700;
  const HISTERESIS_DB = 1.5;
  const REGISTROS = ["grave", "medio", "agudo"];

  // ajusteDb se SUMA al índice medido para compensar cómo el micrófono realza o recorta la banda de twang.
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

  /** Pico (en dB) de la banda [f1, f2]: el armónico más fuerte que cae en ella. */
  function picoDb(espectroDb, sampleRate, f1, f2) {
    const n = espectroDb.length;
    const nyquist = sampleRate / 2;
    const bin = (f) => Math.min(n - 1, Math.max(0, Math.round((f / nyquist) * n)));
    let max = -Infinity;
    for (let i = bin(f1); i <= bin(f2); i++) if (Number.isFinite(espectroDb[i]) && espectroDb[i] > max) max = espectroDb[i];
    return Number.isFinite(max) ? max : -200;
  }

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

  /** Media y dispersión del 80 % central: ni el arranque de la nota ni un cuadro raro mueven la referencia. */
  function estadisticaRecortada(valores) {
    const v = valores.slice().sort((a, b) => a - b);
    const q = Math.floor(v.length / 10);
    const centro = v.slice(q, v.length - q);
    const media = centro.reduce((a, b) => a + b, 0) / Math.max(1, centro.length);
    const sd = Math.sqrt(centro.reduce((a, b) => a + (b - media) ** 2, 0) / Math.max(1, centro.length));
    return { media, sd };
  }

  /** Nivel (dB) de cada banda del espectro. */
  function medirBandas(espectroDb, sampleRate) {
    const b = {};
    for (const [nombre, [f1, f2]] of Object.entries(BANDAS)) b[nombre] = potenciaMediaDb(espectroDb, sampleRate, f1, f2);
    return b;
  }

  /** Singing Power Ratio (dB): pico de 2,4–4,2 kHz menos pico de 80 Hz–2 kHz. */
  function singingPowerRatio(espectroDb, sampleRate) {
    return picoDb(espectroDb, sampleRate, BANDA_PICO_ALTO[0], BANDA_PICO_ALTO[1]) - picoDb(espectroDb, sampleRate, BANDA_PICO_BAJO[0], BANDA_PICO_BAJO[1]);
  }

  /** Relación entre bandas (la medida de v2): cuánto sobresalen los agudos de la recta medios-aire, más medios/graves. */
  function relacionBandas(b) {
    const esperado = b.medios + T_AGUDOS * (b.aire - b.medios);
    return 0.6 * (b.altos - esperado) + 0.2 * (b.medios - b.bajos) + 0.2 * (b.altos - (b.flanco + b.aire) / 2);
  }

  /**
   * Índice de twang (dB) = ½·Singing Power Ratio + relación entre bandas. Probado con voces sintéticas (5 vocales ×
   * 6 notas): juntas separan twang / no twang mejor que cada una sola (razón salto/dispersión 1,58 frente a 1,31),
   * porque fallan en casos distintos (la de picos con la nota, la de bandas con la vocal).
   */
  function indiceTwang(espectroDb, sampleRate) {
    return 0.5 * singingPowerRatio(espectroDb, sampleRate) + relacionBandas(medirBandas(espectroDb, sampleRate));
  }

  /** Registro de la nota cantada (la referencia del twang se guarda por registro). */
  function registroDe(f0) {
    if (!f0 || !Number.isFinite(f0)) return "medio";
    if (f0 < 196) return "grave"; // por debajo de Sol3
    if (f0 < 392) return "medio"; // hasta Sol4
    return "agudo";
  }

  class DetectorTwang {
    constructor(opciones) {
      const o = opciones || {};
      this.perfil = PERFILES[o.perfil] ? o.perfil : "otro";
      // Referencias por registro: {grave|medio|agudo: {normal, twang (o null), medios, altos}} (o null).
      this.bases = { grave: null, medio: null, agudo: null };
      if (o.bases && typeof o.bases === "object") {
        for (const r of REGISTROS) if (o.bases[r] && typeof o.bases[r].normal === "number") this.bases[r] = o.bases[r];
      }
      this.sensibilidadDb = typeof o.sensibilidadDb === "number" ? o.sensibilidadDb : 0; // + = más sensible
      this.ultimasMuestras = 0;
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
      return REGISTROS.some((r) => this.bases[r] !== null);
    }

    get registrosCalibrados() {
      return REGISTROS.filter((r) => this.bases[r] !== null);
    }

    /** Margen genérico (sin calibrar el twang), ajustado por la sensibilidad. */
    get umbralDb() {
      return Math.max(1.5, UMBRAL_DELTA_DB - this.sensibilidadDb);
    }

    /**
     * Cuántos dB sobre tu voz normal hacen falta en ese registro. Con el twang calibrado, el punto entre tu voz
     * normal y tu twang donde las dos se confunden igual de poco: más lejos de la que más oscila (si tu voz normal
     * varía mucho de una nota a otra, el umbral se aleja de ella). Sin el twang calibrado, un margen genérico que
     * nunca queda dentro de lo que oscila tu voz normal.
     */
    umbralPara(ref) {
      const sdN = typeof ref.sdNormal === "number" ? Math.max(0.5, ref.sdNormal) : 1.5;
      const sep = typeof ref.twang === "number" ? ref.twang - ref.normal : null;
      let base;
      if (sep !== null && sep >= SEPARACION_MINIMA_DB) {
        const sdT = typeof ref.sdTwang === "number" ? Math.max(0.5, ref.sdTwang) : sdN;
        base = (sep * sdN) / (sdN + sdT);
      } else {
        base = Math.max(UMBRAL_DELTA_DB, 2 * sdN);
      }
      return Math.max(1.5, base - this.sensibilidadDb);
    }

    /** `tipo`: "normal" (tu voz sin twang) o "twang" (tu voz con twang). */
    iniciarCalibracion(tipo) {
      this.calibrando = [];
      this.tipoCalibracion = tipo === "twang" ? "twang" : "normal";
    }

    /**
     * Termina la calibración. Devuelve {bases, registros, separacion} (separacion: dB entre twang y normal por
     * registro, solo al calibrar el twang), o null si no hubo suficiente voz en ningún registro.
     */
    terminarCalibracion(minimoMuestras) {
      const muestras = this.calibrando || [];
      const tipo = this.tipoCalibracion || "normal";
      this.calibrando = null;
      this.ultimasMuestras = muestras.length;
      const minimo = minimoMuestras || 15;
      const registros = [];
      const separacion = {};
      for (const reg of REGISTROS) {
        const del = muestras.filter((m) => m.reg === reg);
        if (del.length < minimo) continue;
        const { media: valor, sd } = estadisticaRecortada(del.map((m) => m.indice));
        if (tipo === "normal") {
          const previa = this.bases[reg];
          this.bases[reg] = {
            normal: valor,
            sdNormal: sd,
            twang: previa && typeof previa.twang === "number" ? previa.twang : null,
            sdTwang: previa && typeof previa.sdTwang === "number" ? previa.sdTwang : null,
            medios: mediana(del.map((m) => m.medios)),
            altos: mediana(del.map((m) => m.altos)),
          };
        } else {
          if (!this.bases[reg]) continue; // el twang se compara con tu voz normal de ese registro
          this.bases[reg] = { ...this.bases[reg], twang: valor, sdTwang: sd };
          separacion[reg] = valor - this.bases[reg].normal;
        }
        registros.push(reg);
      }
      this.ema = null;
      return registros.length ? { bases: this.bases, registros, separacion } : null;
    }

    /** Referencia de tu voz normal para ese registro: la suya, la del registro calibrado más cercano, o la genérica. */
    referencia(reg) {
      if (this.bases[reg]) return { r: this.bases[reg], exacta: true };
      const orden = { grave: 0, medio: 1, agudo: 2 };
      let mejor = null;
      let dist = 99;
      for (const k of REGISTROS) {
        if (!this.bases[k]) continue;
        const d = Math.abs(orden[k] - orden[reg]);
        if (d < dist) {
          dist = d;
          mejor = this.bases[k];
        }
      }
      if (mejor) return { r: mejor, exacta: false };
      return { r: { normal: BASE_DEFECTO_DB, twang: null, medios: REL_MEDIOS_DEFECTO, altos: REL_ALTOS_DEFECTO }, exacta: false };
    }

    /**
     * Procesa un cuadro. `vozActiva` debe ser true solo si hay una voz con nota reconocible (detector de pitch),
     * para no confundir con «s», «t» o ruido, que también tienen energía por encima de 2.5 kHz.
     * `f0` (Hz, opcional) es la altura de la nota: elige la referencia del registro correcto.
     */
    actualizar(espectroDb, sampleRate, vozActiva, ahoraMs, f0) {
      const perfil = PERFILES[this.perfil];
      const b = medirBandas(espectroDb, sampleRate);
      const cuerpoDb = potenciaMediaDb(espectroDb, sampleRate, BANDA_BASE[0], BANDA_BASE[1]);
      const reg = registroDe(f0);

      // Solo cuenta la voz con nota reconocible (al calibrar se acepta una nota menos limpia, con su f0):
      // así el aire, las consonantes y el ruido no entran ni en la medida ni en la referencia.
      const hayVoz = vozActiva || (this.calibrando !== null && !!f0);
      if (!hayVoz || cuerpoDb < PISO_BASE_DB) {
        if (ahoraMs - this.ultimoCuadroVozMs > 400) {
          this.ema = null;
          this.superaDesde = null;
        }
        if (this.activo && ahoraMs - this.ultimaActivacion > MS_MANTENER && ahoraMs - this.ultimoCuadroVozMs > 400) {
          this.activo = false;
        }
        return { estado: "silencio", deltaDb: null, porcentaje: 0, detectado: this.activo, sinAgudos: false, registro: reg };
      }
      this.ultimoCuadroVozMs = ahoraMs;

      // La banda alta casi no existe: el micrófono (o el modo de llamada) no deja pasar agudos y no se puede medir.
      if (b.altos < b.bajos - 60) {
        return { estado: "sin-agudos", deltaDb: null, porcentaje: 0, detectado: false, sinAgudos: true, registro: reg };
      }
      // Más energía en el «aire» (5–8 kHz) que en la zona de twang: es una consonante o soplo, no una vocal con twang.
      if (b.aire > b.altos + 2) {
        return { estado: "ruido", deltaDb: null, porcentaje: 0, detectado: false, sinAgudos: false, registro: reg };
      }

      const indice = indiceTwang(espectroDb, sampleRate) + perfil.ajusteDb;
      const relMedios = b.medios - b.bajos;
      const relAltos = b.altos - b.bajos;
      if (this.calibrando) this.calibrando.push({ reg, indice, medios: relMedios, altos: relAltos });
      this.ema = this.ema === null ? indice : this.ema + SUAVIZADO * (indice - this.ema);

      const ref = this.referencia(reg);
      const delta = this.ema - ref.r.normal;
      const umbral = this.umbralPara(ref.r);

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
        registro: reg,
        referenciaPropia: ref.exacta, // false = aún no calibrada en este registro
        umbralDb: umbral,
        // Relación graves-medios-agudos de ahora (dB respecto a los graves) y la de tu voz normal, para dibujarla.
        bandasRel: { medios: relMedios, altos: relAltos },
        refRel: { medios: ref.r.medios, altos: ref.r.altos },
      };
    }
  }

  const PORCENTAJE_UMBRAL = 60; // el umbral (sea cual sea el de tu registro) cae siempre aquí en la barra

  /** Barra en dos tramos: de −4 dB al umbral → 0 a 60 %; del umbral a umbral + 6 dB → 60 a 100 %. */
  function porcentajeMedidor(deltaDb, umbralDb) {
    const t = deltaDb <= umbralDb
      ? ((deltaDb + 4) / Math.max(0.1, umbralDb + 4)) * PORCENTAJE_UMBRAL
      : PORCENTAJE_UMBRAL + ((deltaDb - umbralDb) / 6) * (100 - PORCENTAJE_UMBRAL);
    return Math.max(0, Math.min(100, Math.round(t)));
  }

  const api = {
    PERFILES,
    BANDA_TWANG,
    BANDA_BASE,
    BANDAS,
    REGISTROS,
    BASE_DEFECTO_DB,
    UMBRAL_DELTA_DB,
    SEPARACION_MINIMA_DB,
    DetectorTwang,
    picoDb,
    potenciaMediaDb,
    medirBandas,
    indiceTwang,
    registroDe,
    porcentajeMedidor,
    PORCENTAJE_UMBRAL,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  raiz.Twang = api;
})(typeof window !== "undefined" ? window : globalThis);
