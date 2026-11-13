/*
 * sw.js — service worker mínimo, solo para cumplir el requisito de "app
 * instalable" (PWA / paquete de Android) y dar algo de resiliencia offline.
 * Red primero: si hay conexión, siempre sirve la versión más nueva (para no
 * dejar a nadie con JS/CSS viejo después de un despliegue); la caché solo
 * entra como respaldo cuando no hay red.
 */
const CACHE_NAME = "aleran-piano-v2"; // v2: se vacía la caché vieja, que guardaba también otros dominios
const NUCLEO = ["index.html", "style.css"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(NUCLEO)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Solo archivos de esta web. Lo de otros dominios (API de Maestro con el código del alumno, muestras de
  // piano, fuentes) lo gestiona el navegador: no debe quedar copiado aquí ni servirse viejo sin conexión.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(event.request))
  );
});
