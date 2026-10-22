/* pulsos.js — el punto del metrónomo pasa a ser una fila de círculos, uno por pulso del compás (22/10/2026).
 * Cada página ya enciende su punto en cada pulso (clase «pulso», y «acento» en el primero del compás); aquí se
 * observa ese punto y se ilumina el círculo que toca. Con acento la cuenta vuelve al 1 en cada compás; sin acento
 * se muestran 4 que van rotando. No toca la lógica del metrónomo de ninguna página. */
(function () {
  "use strict";
  const PARES = [
    ["metronomoPunto", "metronomoAcento"],
    ["metronomoPuntoMini", "metroFlotAcento"],
  ];

  function montar(punto, selector) {
    const fila = document.createElement("div");
    fila.className = `pulsos${punto.classList.contains("mini") ? " mini" : ""}`;
    fila.setAttribute("aria-hidden", "true");
    punto.insertAdjacentElement("afterend", fila);
    punto.classList.add("punto-observado");
    let indice = -1;
    let apagado = 0;

    const cuantos = () => {
      const n = parseInt(selector ? selector.value : "0", 10);
      return n > 0 ? n : 4;
    };
    function dibujar() {
      const n = cuantos();
      if (fila.children.length !== n) {
        fila.textContent = "";
        for (let i = 0; i < n; i++) fila.appendChild(document.createElement("i"));
        indice = -1;
      }
    }
    function encender(acento) {
      dibujar();
      const n = fila.children.length;
      indice = acento ? 0 : (indice + 1) % n;
      Array.from(fila.children).forEach((c, i) => {
        c.classList.toggle("encendido", i === indice);
        c.classList.toggle("fuerte", i === indice && i === 0 && parseInt(selector ? selector.value : "0", 10) > 0);
        c.classList.toggle("pasado", i < indice);
      });
      const actual = fila.children[indice];
      actual.classList.remove("destello");
      void actual.offsetWidth; // reinicia la animación en cada pulso
      actual.classList.add("destello");
      clearTimeout(apagado);
      apagado = setTimeout(() => {
        Array.from(fila.children).forEach((c) => c.classList.remove("encendido", "fuerte", "pasado", "destello"));
        indice = -1;
      }, 2500); // metrónomo parado: la fila se apaga sola
    }

    new MutationObserver(() => {
      if (punto.classList.contains("pulso")) encender(punto.classList.contains("acento"));
    }).observe(punto, { attributes: true, attributeFilter: ["class"] });
    if (selector) selector.addEventListener("change", dibujar);
    dibujar();
  }

  function iniciar() {
    PARES.forEach(([idPunto, idSelector]) => {
      const punto = document.getElementById(idPunto);
      if (punto) montar(punto, document.getElementById(idSelector));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
