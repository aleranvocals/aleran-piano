/*
 * progreso-compartir.js — sincroniza un resumen de Progreso (localStorage)
 * con la ficha del alumno en alumnos-claude (maestro.aleranvocals.es), a
 * partir del identificador que el propio alumno escribe (la parte final de
 * su link "mi-clase/<identificador>"). Nunca se manda audio ni nada
 * personal -- solo los mismos récords que ya se ven en esta página.
 */
const PROGRESO_API_URL = "https://maestro.aleranvocals.es/api/mi-clase/progreso";
const PROGRESO_CODIGO_CLAVE = "aleran-piano-codigo-alumno";

/** Arma el mismo resumen que ya se ve en pantalla (progreso-vista.js), en la
 * forma exacta que espera el servidor -- si un campo se añade en un lado,
 * hay que añadirlo también en el otro (server/src/lib/types.ts PianoProgreso). */
function construirResumenProgreso() {
  const rangoMin = Progreso.obtener("rangoMinMidi", null);
  const rangoMax = Progreso.obtener("rangoMaxMidi", null);
  const datos = Progreso.cargar();
  return {
    rangoVocal: rangoMin !== null && rangoMax !== null ? `${midiANombre(rangoMin)}–${midiANombre(rangoMax)}` : null,
    sostenidaSegundos: Progreso.obtener("sostenidaMejorSegundos", null),
    aireSegundos: Progreso.obtener("aireMejorSegundos", null),
    intervalosAciertos: Progreso.obtener("intervalosAciertos", 0),
    intervalosTotal: Progreso.obtener("intervalosTotal", 0),
    notasAciertos: Progreso.obtener("notasquizAciertos", 0),
    notasTotal: Progreso.obtener("notasquizTotal", 0),
    simonMejorNivel: Progreso.obtener("simonMejorNivel", 0),
    rachaDias: Progreso.obtener("rutinaRachaDias", 0),
    diasPracticados: (Progreso.obtener("rutinaHistorialFechas", []) || []).length,
    insignias: LOGROS.filter((l) => l.cumplido(datos)).map((l) => l.nombre),
  };
}

async function sincronizarProgreso(codigo, { silencioso } = {}) {
  const aviso = el("vincularAviso");
  try {
    const respuesta = await fetch(PROGRESO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: codigo, resumen: construirResumenProgreso() }),
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      throw new Error(cuerpo.error || "No se pudo sincronizar");
    }
    if (!silencioso && aviso) {
      aviso.style.color = "";
      aviso.textContent = "Sincronizado con tu ficha ✓";
    }
    return true;
  } catch (err) {
    if (!silencioso && aviso) {
      aviso.style.color = "var(--crimson-bright)";
      aviso.textContent = err.message === "No encontramos ese código de alumno"
        ? "No encontramos ese identificador -- revísalo con Áleran."
        : "No se pudo sincronizar. Revisa tu conexión e inténtalo de nuevo.";
    }
    return false;
  }
}

function mostrarEstadoVinculado(codigo) {
  el("vincularFormulario").hidden = true;
  el("vincularEstadoActivo").hidden = false;
  el("vincularTextoActivo").textContent = `Vinculado como "${codigo}" ✓`;
}

function mostrarEstadoDesvinculado() {
  el("vincularFormulario").hidden = false;
  el("vincularEstadoActivo").hidden = true;
  el("vincularCodigo").value = "";
}

function inicializarVincularCoach() {
  const codigoGuardado = localStorage.getItem(PROGRESO_CODIGO_CLAVE);

  if (codigoGuardado) {
    mostrarEstadoVinculado(codigoGuardado);
    // Cada vez que el alumno mira su propio progreso, se reenvía en
    // silencio -- así su ficha se mantiene al día sin que tenga que acordarse
    // de pulsar nada.
    sincronizarProgreso(codigoGuardado, { silencioso: true });
  }

  el("btnVincularCoach").addEventListener("click", async () => {
    const boton = el("btnVincularCoach");
    const codigo = el("vincularCodigo").value.trim();
    if (!codigo) {
      el("vincularAviso").style.color = "var(--crimson-bright)";
      el("vincularAviso").textContent = "Escribe tu identificador primero.";
      return;
    }
    boton.disabled = true;
    boton.textContent = "Sincronizando…";
    const ok = await sincronizarProgreso(codigo);
    boton.disabled = false;
    boton.textContent = "Sincronizar";
    if (ok) {
      localStorage.setItem(PROGRESO_CODIGO_CLAVE, codigo);
      mostrarEstadoVinculado(codigo);
    }
  });

  el("btnVincularActualizar").addEventListener("click", async () => {
    const boton = el("btnVincularActualizar");
    boton.disabled = true;
    await sincronizarProgreso(codigoGuardado || localStorage.getItem(PROGRESO_CODIGO_CLAVE));
    boton.disabled = false;
  });

  el("btnVincularQuitar").addEventListener("click", () => {
    localStorage.removeItem(PROGRESO_CODIGO_CLAVE);
    mostrarEstadoDesvinculado();
    el("vincularAviso").textContent = "";
  });
}

document.addEventListener("DOMContentLoaded", inicializarVincularCoach);
