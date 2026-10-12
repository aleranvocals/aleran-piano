/*
 * Medidor de twang — lógica pura (sin DOM), para poder probarla fuera del navegador.
 *
 * Qué mide: el twang (estrechamiento del epilarinx / esfínter ariepiglótico) no es «más energía en 3 kHz»:
 * es una RELACIÓN dentro del espectro. Una nota aguda o cantada fuerte también sube esa banda; lo que
 * distingue al twang es que (1) el grupo de formantes F3-F5 (~2,5–4 kHz) destaca sobre los medios, (2) los
 * medios (1–2 kHz) suben respecto a los graves (F0 y F1), y (3) hay un pico definido en esa zona y no un
 * aumento general de todo lo agudo (que sería simplemente cantar más fuerte, o ruido).
 *
 * Por eso se miden tres bandas —graves (100–1000 Hz), medios (1–2 kHz) y agudos (2,5–4 kHz)— más dos
 * bandas de comparación (el flanco 2–2,45 kHz y el «aire» 5–8 kHz), y se combinan en un índice en dB:
 *     índice = 0,60·residuo + 0,20·(medios − graves) + 0,20·(agudos − promedio(flanco, aire))
 * donde «residuo» es cuánto SOBRESALE la banda de agudos por encima de la línea (en escala logarítmica)
 * que une medios y aire: cantar más fuerte aplana toda la inclinación del espectro y sube todo lo agudo
 * a la vez (sin pico), mientras que el clúster F3-F5 del twang sobresale de esa línea.
 * Ese índice se compara con TU voz normal, y la referencia se guarda POR REGISTRO (grave, medio, agudo)
 * porque la relación cambia con la altura de la nota (la literatura lo señala: el ajuste del tracto
 * necesario para el twang es distinto en cada altura). El aire y las consonantes (s, t) se descartan.
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
  const PESOS = { residuo: 0.6, medioBajo: 0.2, prominencia: 0.2 };
// Posición (en escala log de frecuencia) del centro de agudos entre el centro de medios y el de aire.
const T_AGUDOS = Math.log(Math.sqrt(2500 * 4000) / Math.sqrt(1000 * 2000)) / Math.log(Math.sqrt(5000 * 8000) / Math.sqrt(1000 * 2000));
  const BASE_DEFECTO_DB = -4; // índice típico de una voz sin twang (sin calibrar)
  const REL_MEDIOS_DEFECTO = -22; // dB de los medios respecto a los graves en una voz normal (solo para dibujar)
  const REL_ALTOS_DEFECTO = -36; // idem para los agudos
  const UMBRAL_DELTA_DB = 4.5; // cuántos dB por encima de tu voz normal (del mismo registro) cuenta como «posible twang»
  const ENERGIA_VOZ_DB = -78; // al calibrar, un cuerpo de voz por encima de esto cuenta como voz aunque la nota no sea limpia
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

  /** Nivel (dB) de cada banda del espectro. */
  function medirBandas(espectroDb, sampleRate) {
    const b = {};
    for (const [nombre, [f1, f2]] of Object.entries(BANDAS)) b[nombre] = potenciaMediaDb(espectroDb, sampleRate, f1, f2);
    return b;
  }

  /** Índice de twang (dB) a partir de los niveles de las bandas: ver la explicación de arriba. */
  function indiceTwang(b) {
    const esperado = b.medios + T_AGUDOS * (b.aire - b.medios); // dónde estarían los agudos si el espectro fuese una recta
    const residuo = b.altos - esperado;
    const medioBajo = b.medios - b.bajos;
    const prominencia = b.altos - (b.flanco + b.aire) / 2;
    return PESOS.residuo * residuo + PESOS.medioBajo * medioBajo + PESOS.prominencia * prominencia;
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
      // Referencias de tu voz normal por registro: {grave|medio|agudo: {indice, medios, altos}} (o null).
      this.bases = { grave: null, medio: null, agudo: null };
      if (o.bases && typeof o.bases === "object") {
        for (const r of REGISTROS) if (o.bases[r] && typeof o.bases[r].indice === "number") this.bases[r] = o.bases[r];
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

    get umbralDb() {
      return Math.max(1.5, UMBRAL_DELTA_DB - this.sensibilidadDb);
    }

    iniciarCalibracion() {
      this.calibrando = [];
    }

    /**
     * Termina la calibración: guarda la voz normal de cada registro en el que hubo suficiente voz y devuelve
     * las referencias (todas), o null si no hubo suficiente voz en ninguno.
     */
    terminarCalibracion(minimoMuestras) {
      const muestras = this.calibrando || [];
      this.calibrando = null;
      this.ultimasMuestras = muestras.length;
      const minimo = minimoMuestras || 15;
      let alguno = false;
      for (const reg of REGISTROS) {
        const del = muestras.filter((m) => m.reg === reg);
        if (del.length < minimo) continue;
        this.bases[reg] = {
          indice: mediana(del.map((m) => m.indice)),
          medios: mediana(del.map((m) => m.medios)),
          altos: mediana(del.map((m) => m.altos)),
        };
        alguno = true;
      }
      this.ema = null;
      return alguno ? this.bases : null;
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
      return { r: { indice: BASE_DEFECTO_DB, medios: REL_MEDIOS_DEFECTO, altos: REL_ALTOS_DEFECTO }, exacta: false };
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

      // Calibrando: basta voz con energía real (muy pegado al micro la nota no siempre se reconoce).
      const vozPorEnergia = this.calibrando !== null && cuerpoDb > ENERGIA_VOZ_DB;
      if ((!vozActiva && !vozPorEnergia) || cuerpoDb < PISO_BASE_DB) {
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
      if (b.aire > b.altos + 2 && this.calibrando === null) {
        return { estado: "ruido", deltaDb: null, porcentaje: 0, detectado: false, sinAgudos: false, registro: reg };
      }

      const indice = indiceTwang(b) + perfil.ajusteDb;
      const relMedios = b.medios - b.bajos;
      const relAltos = b.altos - b.bajos;
      if (this.calibrando) this.calibrando.push({ reg, indice, medios: relMedios, altos: relAltos });
      this.ema = this.ema === null ? indice : this.ema + SUAVIZADO * (indice - this.ema);

      const ref = this.referencia(reg);
      const delta = this.ema - ref.r.indice;
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
        registro: reg,
        referenciaPropia: ref.exacta, // false = aún no calibrada en este registro
        // Relación graves-medios-agudos de ahora (dB respecto a los graves) y la de tu voz normal, para dibujarla.
        bandasRel: { medios: relMedios, altos: relAltos },
        refRel: { medios: ref.r.medios, altos: ref.r.altos },
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
    BANDAS,
    REGISTROS,
    BASE_DEFECTO_DB,
    UMBRAL_DELTA_DB,
    DetectorTwang,
    potenciaMediaDb,
    medirBandas,
    indiceTwang,
    registroDe,
    porcentajeMedidor,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  raiz.Twang = api;
})(typeof window !== "undefined" ? window : globalThis);
