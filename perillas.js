/* perillas.js — convierte algunos deslizadores en perillas giratorias, como las del Conversor (22/10/2026).
 * El <input type="range"> de siempre sigue ahí (oculto) y el resto del código no cambia: la perilla le pone
 * el valor y le lanza los mismos eventos «input» y «change»; si el código cambia el valor del input, la perilla
 * se mueve sola.
 * Uso: arrastrar arriba/abajo (o a los lados), rueda del ratón, flechas del teclado; doble clic = valor inicial;
 * Mayús = ajuste fino. */
(function () {
  "use strict";
  const IDS = [
    "volumen", "metroFlotVolumen", "numNotas", "bpmSlider", "duracionNota", "pausa",
    "twangSensibilidad", "intervalosNivel", "acordesNivel", "ritmoNivel", "cifradoZoom",
  ];
  // Cómo se enseña el valor: volúmenes y tamaños en % (0,85 → 85 %), el resto tal cual.
  const EN_PORCENTAJE = new Set(["volumen", "metroFlotVolumen", "cifradoZoom"]);
  const GIRO = 270; // grados de recorrido, de −135° a +135°
  const NS = "http://www.w3.org/2000/svg";
  const descriptorValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  function nodo(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  }

  function arco(cx, cy, r, desde, hasta) {
    const p = (a) => {
      const rad = ((a - 90) * Math.PI) / 180;
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    };
    const [x1, y1] = p(desde);
    const [x2, y2] = p(hasta);
    const grande = hasta - desde > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  function decimales(paso) {
    const s = String(paso);
    return s.includes(".") ? s.split(".")[1].length : 0;
  }

  function crearPerilla(input) {
    if (input.dataset.perilla) return;
    input.dataset.perilla = "1";
    const min = parseFloat(input.min || "0");
    const max = parseFloat(input.max || "100");
    const paso = parseFloat(input.step || "1") || 1;
    const dec = decimales(input.step || "1");
    const inicial = parseFloat(input.defaultValue || input.value);

    const perilla = document.createElement("div");
    perilla.className = "perilla";
    perilla.tabIndex = 0;
    perilla.setAttribute("role", "slider");
    perilla.setAttribute("aria-valuemin", String(min));
    perilla.setAttribute("aria-valuemax", String(max));
    const etiqueta = input.getAttribute("aria-label") || (input.closest("label") && input.closest("label").querySelector("span") ? input.closest("label").querySelector("span").textContent.split(":")[0].trim() : "");
    if (etiqueta) perilla.setAttribute("aria-label", etiqueta);
    perilla.title = "Arrastra, usa la rueda o las flechas · doble clic = valor inicial";

    const svg = nodo("svg", { viewBox: "0 0 64 64", "aria-hidden": "true" });
    const defs = nodo("defs", {});
    const grad = nodo("radialGradient", { id: `pg-${input.id}`, cx: "35%", cy: "30%", r: "75%" });
    grad.append(nodo("stop", { offset: "0%", "stop-color": "#7a6a68" }), nodo("stop", { offset: "70%", "stop-color": "#241b1b" }));
    defs.appendChild(grad);
    const pista = nodo("path", { class: "p-pista", d: arco(32, 32, 27, -GIRO / 2, GIRO / 2) });
    const valor = nodo("path", { class: "p-valor", d: "" });
    const cuerpo = nodo("circle", { class: "p-cuerpo", cx: 32, cy: 32, r: 19, fill: `url(#pg-${input.id})` });
    const marca = nodo("line", { class: "p-marca", x1: 32, y1: 18, x2: 32, y2: 24 });
    svg.append(defs, pista, valor, cuerpo, marca);
    perilla.appendChild(svg);

    // Si la etiqueta ya enseña el valor (un <output>), no se repite; si no, una pequeña pantalla LCD.
    const label = input.closest("label");
    const tieneOutput = label && label.querySelector("output");
    let lcd = null;
    if (!tieneOutput) {
      lcd = document.createElement("span");
      lcd.className = "perilla-lcd";
    }

    input.classList.add("perilla-oculta");
    input.tabIndex = -1;
    input.insertAdjacentElement("beforebegin", perilla);
    if (lcd) input.insertAdjacentElement("afterend", lcd);
    if (label && label.classList.contains("campo")) label.classList.add("con-perilla");
    // El volumen suelto (Entrena, Oído, Rutina) no merece una línea entera: va a la barra de arriba, junto al rango y el micro.
    const dock = document.getElementById("dockHerramientas");
    if (label && label.classList.contains("campo-volumen") && dock) {
      label.classList.add("en-dock");
      dock.appendChild(label);
    }

    function pintar() {
      const v = parseFloat(descriptorValor.get.call(input));
      const t = max > min ? (v - min) / (max - min) : 0;
      const ang = -GIRO / 2 + t * GIRO;
      valor.setAttribute("d", t > 0.001 ? arco(32, 32, 27, -GIRO / 2, ang) : "");
      marca.setAttribute("transform", `rotate(${ang} 32 32)`);
      perilla.setAttribute("aria-valuenow", String(v));
      if (lcd) lcd.textContent = EN_PORCENTAJE.has(input.id) ? `${Math.round(v * 100)}%` : v.toFixed(dec);
    }

    function fijar(v, final) {
      const ajustado = Math.min(max, Math.max(min, Math.round((v - min) / paso) * paso + min));
      const texto = ajustado.toFixed(dec);
      if (descriptorValor.get.call(input) !== texto) {
        descriptorValor.set.call(input, texto);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (final) input.dispatchEvent(new Event("change", { bubbles: true }));
      pintar();
    }

    // El código de cada herramienta a veces cambia el valor a mano (input.value = …): la perilla se entera.
    Object.defineProperty(input, "value", {
      configurable: true,
      get() {
        return descriptorValor.get.call(this);
      },
      set(v) {
        descriptorValor.set.call(this, v);
        pintar();
      },
    });
    input.addEventListener("input", pintar);
    input.addEventListener("change", pintar);

    let arrastre = null;
    perilla.addEventListener("pointerdown", (e) => {
      perilla.setPointerCapture(e.pointerId);
      perilla.focus();
      arrastre = { x: e.clientX, y: e.clientY, v: parseFloat(descriptorValor.get.call(input)) };
      e.preventDefault();
    });
    perilla.addEventListener("pointermove", (e) => {
      if (!arrastre) return;
      const px = (arrastre.y - e.clientY) + (e.clientX - arrastre.x); // arriba o a la derecha = más
      const recorrido = e.shiftKey ? 900 : 180; // píxeles para ir de mínimo a máximo
      fijar(arrastre.v + (px / recorrido) * (max - min), false);
    });
    const soltar = () => {
      if (!arrastre) return;
      arrastre = null;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    perilla.addEventListener("pointerup", soltar);
    perilla.addEventListener("pointercancel", soltar);
    perilla.addEventListener("wheel", (e) => {
      e.preventDefault();
      const n = e.shiftKey ? 1 : Math.max(1, Math.round((max - min) / paso / 40));
      fijar(parseFloat(descriptorValor.get.call(input)) + (e.deltaY < 0 ? n : -n) * paso, true);
    }, { passive: false });
    perilla.addEventListener("keydown", (e) => {
      const v = parseFloat(descriptorValor.get.call(input));
      const grande = Math.max(paso, (max - min) / 10);
      const mapa = { ArrowUp: paso, ArrowRight: paso, ArrowDown: -paso, ArrowLeft: -paso, PageUp: grande, PageDown: -grande };
      if (e.key in mapa) fijar(v + mapa[e.key], true);
      else if (e.key === "Home") fijar(min, true);
      else if (e.key === "End") fijar(max, true);
      else return;
      e.preventDefault();
    });
    perilla.addEventListener("dblclick", () => fijar(inicial, true));
    pintar();
  }

  function iniciar() {
    IDS.forEach((id) => {
      const input = document.getElementById(id);
      if (input && input.type === "range") crearPerilla(input);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
