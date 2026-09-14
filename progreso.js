/*
 * progreso.js — guarda récords/estadísticas del alumno en localStorage.
 * Nada se envía a ningún servidor: vive solo en este navegador/dispositivo,
 * y desaparece si el alumno borra los datos del sitio.
 */
const PROGRESO_CLAVE = "aleran-piano-progreso-v1";

function progresoCargar() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESO_CLAVE)) || {};
  } catch {
    return {};
  }
}

function progresoGuardar(datos) {
  try {
    localStorage.setItem(PROGRESO_CLAVE, JSON.stringify(datos));
  } catch {
    // almacenamiento no disponible (modo privado, cuota llena...): no es critico, se ignora
  }
}

/** Actualiza `clave` a `nuevo` si no había valor previo o si
 * `comparador(nuevo, actual)` es true. Devuelve true si hubo récord nuevo. */
function progresoActualizarRecord(clave, nuevo, comparador) {
  const datos = progresoCargar();
  const actual = datos[clave];
  if (actual === undefined || actual === null || comparador(nuevo, actual)) {
    datos[clave] = nuevo;
    progresoGuardar(datos);
    return true;
  }
  return false;
}

function progresoIncrementar(clave, cantidad = 1) {
  const datos = progresoCargar();
  datos[clave] = (datos[clave] || 0) + cantidad;
  progresoGuardar(datos);
  return datos[clave];
}

function progresoObtener(clave, porDefecto) {
  const datos = progresoCargar();
  return datos[clave] !== undefined ? datos[clave] : porDefecto;
}

function progresoReiniciar() {
  try {
    localStorage.removeItem(PROGRESO_CLAVE);
  } catch {
    // nada que hacer si el almacenamiento no está disponible
  }
}

/** Marca que el alumno usó una herramienta al menos una vez (para la
 * insignia "Explorador"). `id` es un nombre corto fijo, ej. "piano". */
function progresoMarcarHerramientaUsada(id) {
  const datos = progresoCargar();
  const usadas = new Set(datos.herramientasUsadas || []);
  if (usadas.has(id)) return;
  usadas.add(id);
  progresoGuardar({ ...datos, herramientasUsadas: [...usadas] });
}

window.Progreso = {
  cargar: progresoCargar,
  guardar: progresoGuardar,
  actualizarRecord: progresoActualizarRecord,
  incrementar: progresoIncrementar,
  obtener: progresoObtener,
  reiniciar: progresoReiniciar,
  marcarHerramientaUsada: progresoMarcarHerramientaUsada,
};
