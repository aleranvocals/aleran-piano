/*
 * sw.js — service worker mínimo, solo para cumplir el requisito de "app
 * instalable" (PWA / paquete de Android) y dar algo de resiliencia offline.
 * Red primero: si hay conexión, siempre sirve la versión más nueva (para no
 * dejar a nadie con JS/CSS viejo después de un despliegue); la caché solo
 * entra como respaldo cuando no hay red.
 */
const CACHE_NAME = "aleran-piano-v1";
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
  event.respondWith(
    fetch(event.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(event.request))
  );
});
