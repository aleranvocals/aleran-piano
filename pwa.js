/*
 * pwa.js — registra el service worker (sw.js) para que el kit sea instalable
 * como app (Android TWA / "Añadir a pantalla de inicio"). No hace nada más;
 * la lógica de caché vive entera en sw.js.
 */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Sin service worker el sitio sigue funcionando igual, solo sin
      // instalación offline -- no hace falta avisar al alumno de esto.
    });
  });
}
