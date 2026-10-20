/*
 * progreso-nube.js — lleva los récords y el historial del alumno (localStorage, ver progreso.js) a su ficha y los
 * recupera en otro dispositivo, usando el mismo identificador que el alumno ya puso en «Progreso».
 * Sin identificador no hace nada. Nunca manda audio; solo números, fechas y nombres de insignias.
 */
(function () {
  const API = "https://maestro.aleranvocals.es/api/mi-clase/progreso";
  const CLAVE_CODIGO = "aleran-piano-codigo-alumno";

  function codigoGuardado() {
    try {
      return localStorage.getItem(CLAVE_CODIGO);
    } catch {
      return null;
    }
  }

  /** Une lo de este dispositivo con lo de la ficha sin perder nada: números → el mayor (son récords y rachas),
   * listas → unión sin repetidos, lo demás → lo local manda y si no hay, lo de la ficha. */
  function mezclar(local, remoto) {
    const salida = { ...remoto, ...local };
    for (const clave of Object.keys(remoto || {})) {
      const a = local ? local[clave] : undefined;
      const b = remoto[clave];
      if (a === undefined) {
        salida[clave] = b;
      } else if (typeof a === "number" && typeof b === "number") {
        salida[clave] = Math.max(a, b);
      } else if (Array.isArray(a) && Array.isArray(b)) {
        const union = Array.from(new Set([...a, ...b]));
        salida[clave] = union.every((x) => typeof x === "string") ? union.sort() : union;
      }
    }
    return salida;
  }

  async function traer(codigo) {
    const r = await fetch(`${API}?token=${encodeURIComponent(codigo)}`);
    if (!r.ok) throw new Error("sin ficha");
    return (await r.json()).datos || {};
  }

  /** Trae lo de la ficha, lo mezcla con lo local, lo guarda aquí y lo sube ya unido. Devuelve true si funcionó. */
  async function sincronizar(codigo) {
    const cod = codigo || codigoGuardado();
    if (!cod || !window.Progreso) return false;
    try {
      const unido = mezclar(window.Progreso.cargar(), await traer(cod));
      window.Progreso.guardar(unido);
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cod, datos: unido }),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Sube lo local al salir de la página (así un récord nuevo llega a la ficha sin pulsar nada). */
  function subirAlSalir() {
    const cod = codigoGuardado();
    if (!cod || !window.Progreso) return;
    try {
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cod, datos: window.Progreso.cargar() }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      /* sin conexión */
    }
  }

  window.ProgresoNube = { sincronizar, mezclar, codigoGuardado };

  document.addEventListener("DOMContentLoaded", () => {
    if (codigoGuardado()) sincronizar();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") subirAlSalir();
  });
})();
