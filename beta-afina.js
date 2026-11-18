/* beta-afina.js — lo que comparten «¿Qué voz tengo?», «Repite después de mí» y el Calentamiento de 5 minutos.
 * Funciones PURAS sobre lecturas de afinación (se prueban sin micrófono en aleran-clon/herramientas/test_beta_voz.mjs)
 * y dos ayudas «en vivo»: escuchar el micrófono con el motor que ya existe (MicrofonoEngine.escucharContinuo, audio.js)
 * y leer el rango elegido por el alumno (RangoVocal, app-shell.js). */
(function (raiz) {
  "use strict";

  var NOMBRES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  function nombre(m) { m = Math.round(m); return NOMBRES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }

  function mediana(a) {
    var v = a.filter(function (x) { return typeof x === "number" && isFinite(x); }).sort(function (p, q) { return p - q; });
    if (!v.length) return null;
    var k = Math.floor(v.length / 2);
    return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2;
  }

  // ---- tramos estables («notas») dentro de una serie de lecturas [{t: ms, m: midi decimal | null}]
  // Un tramo sigue mientras la nota no se aleja más de `salto` semitonos de lo que lleva; un silencio de más de
  // `hueco` ms lo cierra. Los tramos cortos (saltos de octava del detector, ataques) se descartan y los vecinos
  // con la misma nota se vuelven a unir.
  function tramos(lecturas, op) {
    op = op || {};
    var salto = op.salto || 0.7, hueco = op.hueco || 160, minDur = op.minDur || 200;
    var res = [], act = null, ultimoT = null;
    function cerrar() {
      if (act && act.vals.length) {
        var desde = Math.floor(act.vals.length * 0.2); // el ataque no cuenta
        act.m = mediana(act.vals.slice(desde));
        act.dur = act.fin - act.ini;
        res.push(act);
      }
      act = null;
    }
    lecturas.forEach(function (l) {
      if (l.m === null || l.m === undefined || !isFinite(l.m)) {
        if (act && l.t - act.fin > hueco) cerrar();
        return;
      }
      if (act && (l.t - act.fin > hueco || Math.abs(l.m - mediana(act.vals.slice(-8))) > salto)) cerrar();
      if (!act) act = { ini: l.t, fin: l.t, vals: [] };
      act.vals.push(l.m);
      act.fin = l.t;
      ultimoT = l.t;
    });
    cerrar();
    var largos = res.filter(function (s) { return s.dur >= minDur; });
    var unidos = [];
    largos.forEach(function (s) {
      var p = unidos[unidos.length - 1];
      if (p && Math.abs(p.m - s.m) < 0.5 && s.ini - p.fin < hueco * 3) {
        p.vals = p.vals.concat(s.vals);
        p.fin = s.fin;
        p.dur = p.fin - p.ini;
        p.m = mediana(p.vals.slice(Math.floor(p.vals.length * 0.2)));
      } else unidos.push({ ini: s.ini, fin: s.fin, dur: s.dur, m: s.m, vals: s.vals.slice() });
    });
    unidos.forEach(function (s) { delete s.vals; });
    return unidos;
  }

  // ---- ¿Qué voz tengo?
  // Nota sostenida más grave (o más aguda) de un paso: solo cuentan las notas que se aguantaron `minDur` ms.
  function notaSostenida(lecturas, extremo, minDur) {
    var t = tramos(lecturas, { minDur: minDur || 700 });
    if (!t.length) return null;
    var ms = t.map(function (s) { return s.m; });
    return Math.round(extremo === "grave" ? Math.min.apply(null, ms) : Math.max.apply(null, ms));
  }

  // Punto de cambio en una sirena que sube: el salto brusco de nota más grande (entre 2,5 y 9 semitonos en menos de
  // 150 ms, aunque en medio haya una lectura sin nota clara; 12 sería un error de octava del detector). Una sirena
  // rápida y lisa sube como mucho ~2 semitonos en ese tiempo. Devuelve la nota de ANTES del salto, o null si no hubo.
  function cambioEnSirena(lecturas) {
    var mejor = null, prev = null;
    lecturas.forEach(function (l) {
      if (l.m === null || l.m === undefined) return;
      if (prev && l.t - prev.t <= 150) {
        var d = l.m - prev.m;
        if (d >= 2.5 && d <= 9 && (!mejor || d > mejor.d)) mejor = { d: d, desde: prev.m };
      }
      prev = l;
    });
    return mejor ? Math.round(mejor.desde) : null;
  }

  // Tipo de voz cuya zona se parece más a la tuya (por el centro). Devuelve las dos más cercanas.
  var VOCES = [
    { clave: "bajo", nombre: "bajo", min: 40, max: 64 },
    { clave: "baritono", nombre: "barítono", min: 43, max: 67 },
    { clave: "tenor", nombre: "tenor", min: 48, max: 72 },
    { clave: "contralto", nombre: "contralto", min: 53, max: 77 },
    { clave: "mezzosoprano", nombre: "mezzo", min: 57, max: 81 },
    { clave: "soprano", nombre: "soprano", min: 60, max: 84 },
  ];
  function vozParecida(min, max) {
    var c = (min + max) / 2;
    return VOCES.map(function (v) { return { clave: v.clave, nombre: v.nombre, dist: Math.abs(c - (v.min + v.max) / 2) }; })
      .sort(function (a, b) { return a.dist - b.dist; }).slice(0, 2);
  }

  // ---- Repite después de mí
  var MAYOR = [0, 2, 4, 5, 7, 9, 11, 12];
  var MENOR = [0, 2, 3, 5, 7, 8, 10, 12];
  // Grados de la escala (0 = la primera). Nunca dos iguales seguidas: así cada nota es un tramo distinto.
  var NIVELES = [
    { escala: MAYOR, frases: [[0, 1, 2], [2, 1, 0]] },
    { escala: MAYOR, frases: [[0, 1, 0], [1, 2, 1], [2, 1, 2], [0, 2, 1], [1, 0, 1]] },
    { escala: MAYOR, frases: [[0, 2, 4], [4, 2, 0], [0, 2, 0], [2, 4, 2], [4, 3, 2]] },
    { escala: MAYOR, frases: [[0, 4, 2], [0, 3, 4], [4, 3, 0], [2, 4, 0], [0, 4, 0], [4, 0, 2]] },
    { escala: MENOR, frases: [[0, 2, 3], [3, 2, 0], [0, 3, 4], [4, 3, 0], [0, 4, 2], [2, 3, 4]] },
    { escala: MAYOR, frases: [[0, 4, 7], [7, 4, 0], [0, 5, 4], [4, 7, 5], [7, 2, 4], [0, 7, 4]] },
    { escala: MENOR, frases: [[0, 4, 7], [7, 4, 0], [0, 5, 4], [7, 5, 3], [0, 6, 7], [4, 7, 0]] },
  ];

  // Frase de 3 notas para el nivel `n` (1..7) que cabe en [min, max], con su primera nota en la zona cómoda
  // (abajo-medio de tu rango). En un rango estrecho solo salen las frases que caben; si ninguna cabe, las del nivel anterior.
  function frase(n, min, max, azar) {
    azar = azar || Math.random;
    n = Math.max(1, Math.min(NIVELES.length, n));
    var nv = NIVELES[n - 1];
    function ancho(f) { return Math.max.apply(null, f.map(function (g) { return nv.escala[g]; })); }
    var caben = nv.frases.filter(function (f) { return ancho(f) <= max - min; });
    if (!caben.length) return n > 1 ? frase(n - 1, min, max, azar) : [min, min + 1, min].map(function (m) { return Math.min(m, max); });
    var f = caben[Math.floor(azar() * caben.length)];
    var alto = ancho(f);
    var margen = Math.min(2, Math.floor((max - min - alto) / 2));
    var lo = min + margen, techo = max - margen - alto;
    var hi = Math.max(lo, Math.min(techo, Math.round(min + (max - min) * 0.6) - alto));
    var base = lo + Math.floor(azar() * (hi - lo + 1));
    return f.map(function (g) { return base + nv.escala[g]; });
  }

  // Compara lo cantado con lo pedido, nota a nota. Una octava justa arriba o abajo también vale (pasa con voces
  // de hombre y mujer sobre el mismo piano).
  function evaluarFrase(objetivos, tramosCantados, tol) {
    tol = tol || 45;
    return objetivos.map(function (obj, i) {
      var s = tramosCantados[i];
      if (!s) return { ok: false, cantada: null, cents: null, octava: false };
      var c = (s.m - obj) * 100, octava = false;
      if (Math.abs(c) > tol) {
        [-1200, 1200].forEach(function (o) { if (Math.abs(c + o) <= tol) { c = c + o; octava = true; } });
      }
      return { ok: Math.abs(c) <= tol, cantada: Math.round(s.m), cents: Math.round(c), octava: octava };
    });
  }

  // ---- en vivo ------------------------------------------------------------------------------------------------
  // Zona cómoda del alumno: su rango elegido (🎙) o, si no eligió, el de tenor que trae la web por defecto.
  function rango() {
    var r = raiz.RangoVocal ? raiz.RangoVocal.obtener() : null;
    if (r && r.midiMin && r.midiMax) return { min: r.midiMin, max: r.midiMax, elegido: !!r.elegido, nombre: r.nombre, texto: r.min + "–" + r.max };
    return { min: 48, max: 72, elegido: false, nombre: "Tenor", texto: "Do3–Do5" };
  }

  // Abre el micrófono (el elegido en el chip 🎤) y llama a `alLeer({t, m})` unas 30 veces por segundo.
  // Devuelve una promesa con la función para parar.
  function escuchar(alLeer, claridad) {
    var M = raiz.MicrofonoEngine;
    if (!M || !M.disponible()) return Promise.reject(new Error("Este navegador no deja usar el micrófono aquí."));
    return M.iniciar().then(function () {
      var vivo = true;
      M.escucharContinuo(function (l) {
        if (!vivo) return;
        alLeer({ t: performance.now(), m: l ? l.midiExacto : null });
      }, claridad || 0.85);
      return function parar() { if (vivo) { vivo = false; M.detenerContinuo(); } };
    });
  }

  function tocar(midis, dur, vol, cb) {
    var P = raiz.PianoEngine;
    if (!P) return Promise.resolve();
    return P.reproducirSecuencia(midis.map(function (m) { return { midi: m, duracion: dur }; }), vol === undefined ? 0.8 : vol, cb || {});
  }

  raiz.BetaAfina = {
    puro: { tramos: tramos, notaSostenida: notaSostenida, cambioEnSirena: cambioEnSirena, vozParecida: vozParecida, frase: frase, evaluarFrase: evaluarFrase, mediana: mediana, nombre: nombre, NIVELES: NIVELES },
    nombre: nombre, rango: rango, escuchar: escuchar, tocar: tocar,
  };
})(typeof window !== "undefined" ? window : globalThis);
