/*
 * grabadora.js — pestaña "Grabadora" de entrenamiento.html: graba tomas
 * cortas de práctica con el micrófono y las guarda en IndexedDB (no en
 * localStorage: los audios son demasiado grandes para eso) para poder
 * escucharlas más tarde y comparar cómo sonaba el alumno antes y después.
 * Usa su propio acceso al micrófono, independiente del motor de afinación
 * de audio.js, porque MediaRecorder necesita el MediaStream crudo.
 */

const GRABADORA_DB_NOMBRE = "aleran-piano-grabaciones-v1";
const GRABADORA_ALMACEN = "tomas";

let grabadoraDB = null;
let grabadoraStream = null;
let grabadoraMediaRecorder = null;
// URLs de blob creadas para el <audio> de cada toma en el render actual — hay
// que revocarlas antes de volver a renderizar, si no el navegador mantiene ese
// audio en memoria indefinidamente aunque el <audio> ya no esté en el DOM.
let grabadoraUrlsActivas = [];
let grabadoraTrozos = [];
let grabadoraInicioMs = null;

function abrirGrabadoraDB() {
  if (grabadoraDB) return Promise.resolve(grabadoraDB);
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Este navegador no permite guardar grabaciones aquí."));
      return;
    }
    const solicitud = indexedDB.open(GRABADORA_DB_NOMBRE, 1);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      if (!db.objectStoreNames.contains(GRABADORA_ALMACEN)) {
        db.createObjectStore(GRABADORA_ALMACEN, { keyPath: "id", autoIncrement: true });
      }
    };
    solicitud.onsuccess = () => {
      grabadoraDB = solicitud.result;
      resolve(grabadoraDB);
    };
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function guardarToma(toma) {
  const db = await abrirGrabadoraDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GRABADORA_ALMACEN, "readwrite");
    tx.objectStore(GRABADORA_ALMACEN).add(toma);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function listarTomas() {
  const db = await abrirGrabadoraDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GRABADORA_ALMACEN, "readonly");
    const solicitud = tx.objectStore(GRABADORA_ALMACEN).getAll();
    solicitud.onsuccess = () => resolve(solicitud.result.sort((a, b) => b.id - a.id));
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function eliminarToma(id) {
  const db = await abrirGrabadoraDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GRABADORA_ALMACEN, "readwrite");
    tx.objectStore(GRABADORA_ALMACEN).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function formatoDuracionGrabacion(segundos) {
  const s = Math.round(segundos);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatoFechaGrabacion(iso) {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${fecha}, ${hora}`;
}

async function renderizarTomas() {
  const cont = el("listaGrabaciones");
  let tomas;
  try {
    tomas = await listarTomas();
  } catch {
    cont.innerHTML = "";
    return;
  }
  grabadoraUrlsActivas.forEach((url) => URL.revokeObjectURL(url));
  grabadoraUrlsActivas = [];
  cont.innerHTML = "";
  if (tomas.length === 0) {
    cont.innerHTML = '<p class="descripcion">Todavía no has grabado ninguna toma — la primera que grabes aparecerá aquí.</p>';
    return;
  }
  tomas.forEach((toma) => {
    const fila = document.createElement("div");
    fila.className = "grabacion-item";

    const info = document.createElement("div");
    info.className = "grabacion-info";
    const nombre = toma.etiqueta || "Toma sin nombre";
    info.innerHTML = `<span class="grabacion-etiqueta">${nombre}</span><span class="grabacion-detalle">${formatoFechaGrabacion(toma.fecha)} · ${formatoDuracionGrabacion(toma.duracionSeg)}</span>`;

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    const url = URL.createObjectURL(toma.blob);
    grabadoraUrlsActivas.push(url);
    audio.src = url;

    const btnBorrar = document.createElement("button");
    btnBorrar.className = "boton";
    btnBorrar.textContent = "🗑";
    btnBorrar.title = "Borrar esta toma";
    btnBorrar.addEventListener("click", async () => {
      if (!confirm("¿Borrar esta grabación? No se puede deshacer.")) return;
      await eliminarToma(toma.id);
      renderizarTomas();
    });

    fila.append(info, audio, btnBorrar);
    cont.appendChild(fila);
  });
}

async function iniciarGrabacion() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    el("estadoEntrenamiento").textContent = "Este navegador no permite grabar audio aquí.";
    return;
  }
  el("estadoEntrenamiento").textContent = "Pidiendo permiso del micrófono…";
  el("btnGrabarIniciar").disabled = true;
  try {
    grabadoraStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    el("estadoEntrenamiento").textContent = `No se pudo acceder al micrófono: ${err.message}`;
    el("btnGrabarIniciar").disabled = false;
    return;
  }

  const tipo = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
  grabadoraMediaRecorder = tipo ? new MediaRecorder(grabadoraStream, { mimeType: tipo }) : new MediaRecorder(grabadoraStream);
  grabadoraTrozos = [];
  grabadoraInicioMs = performance.now();

  grabadoraMediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) grabadoraTrozos.push(e.data);
  };
  grabadoraMediaRecorder.onstop = async () => {
    const duracionSeg = (performance.now() - grabadoraInicioMs) / 1000;
    const blob = new Blob(grabadoraTrozos, { type: grabadoraMediaRecorder.mimeType || "audio/webm" });
    if (grabadoraStream) grabadoraStream.getTracks().forEach((t) => t.stop());
    grabadoraStream = null;
    if (duracionSeg >= 0.5 && blob.size > 0) {
      const etiqueta = el("grabacionEtiqueta").value.trim();
      try {
        await guardarToma({ etiqueta, fecha: new Date().toISOString(), duracionSeg, blob });
        el("grabacionEtiqueta").value = "";
        el("estadoEntrenamiento").textContent = "Toma guardada.";
      } catch (err) {
        el("estadoEntrenamiento").textContent = `No se pudo guardar la grabación: ${err.message}`;
      }
    } else {
      el("estadoEntrenamiento").textContent = "Grabación demasiado corta, no se guardó.";
    }
    renderizarTomas();
  };

  grabadoraMediaRecorder.start();
  el("estadoEntrenamiento").textContent = "🔴 Grabando…";
  el("btnGrabarDetener").disabled = false;
}

function detenerGrabacion() {
  if (grabadoraMediaRecorder && grabadoraMediaRecorder.state !== "inactive") {
    grabadoraMediaRecorder.stop();
  }
  el("btnGrabarIniciar").disabled = false;
  el("btnGrabarDetener").disabled = true;
}

// Si el alumno cierra la pestaña o navega fuera a mitad de una grabación, el
// stream crudo del micrófono no queda liberado hasta que el navegador destruye
// el contexto por su cuenta — mejor pararlo explícitamente, como ya se hace
// para el motor de afinación en audio.js.
window.addEventListener("pagehide", () => {
  if (grabadoraMediaRecorder && grabadoraMediaRecorder.state !== "inactive") {
    grabadoraMediaRecorder.stop();
  } else if (grabadoraStream) {
    grabadoraStream.getTracks().forEach((t) => t.stop());
    grabadoraStream = null;
  }
});

function inicializarGrabadora() {
  el("btnGrabarIniciar").addEventListener("click", iniciarGrabacion);
  el("btnGrabarDetener").addEventListener("click", detenerGrabacion);
  renderizarTomas();
}

window.Grabadora = { detener: detenerGrabacion };

document.addEventListener("DOMContentLoaded", inicializarGrabadora);
