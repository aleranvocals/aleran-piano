/*
 * soporte.js — los botones de "Reportar un fallo" arman el mensaje de
 * WhatsApp/email a partir de lo que la persona escribió en el textarea (si
 * escribió algo), y en paralelo mandan ese mismo texto completo a un chat de
 * Telegram dedicado a soporte (dashboard-aleran, /api/soporte-piano) -- así
 * el reporte queda capturado ahí de inmediato, sin depender de que la
 * persona de verdad termine de enviarlo en WhatsApp o en su app de correo.
 * "¿Tienes una duda?" es más conversacional -- ese solo manda un aviso corto
 * (sin el contenido, que se escribe ya dentro de WhatsApp).
 *
 * Best-effort: si el aviso a Telegram falla o tarda, no bloquea ni retrasa
 * la apertura de WhatsApp/el correo -- esos siguen su camino igual.
 */
const SOPORTE_API_URL = "https://panel.aleranvocals.es/api/soporte-piano";

function avisarSoporte(tipo, texto) {
  try {
    fetch(SOPORTE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, texto }),
      keepalive: true, // sigue en vuelo aunque la pestaña se vaya a WhatsApp/el correo
    }).catch(() => {});
  } catch {
    // fetch no disponible o bloqueado: los botones de WhatsApp/email siguen funcionando solos
  }
}

function inicializarSoporte() {
  const duda = el("btnDudaWhatsapp");
  if (duda) {
    duda.addEventListener("click", () => {
      avisarSoporte("duda", "Alguien pulsó \"Escribir por WhatsApp\" desde Soporte.");
    });
  }

  const detalleEl = el("falloDetalle");
  const falloWhatsapp = el("btnFalloWhatsapp");
  const falloEmail = el("btnFalloEmail");

  if (falloWhatsapp) {
    falloWhatsapp.addEventListener("click", () => {
      const detalle = detalleEl.value.trim();
      avisarSoporte("fallo", detalle || "(Reportó por WhatsApp sin escribir el detalle aquí primero.)");
      const cuerpo = detalle
        ? `Hola Áleran! Encontré un fallo en las herramientas de práctica:\n\n${detalle}`
        : "Hola Áleran! Encontré un fallo en las herramientas de práctica.\n\n📱 Herramienta: \n📲 Dispositivo/navegador: \n🐛 Qué pasó: ";
      window.open(`https://wa.me/34632926726?text=${encodeURIComponent(cuerpo)}`, "_blank", "noopener");
    });
  }

  if (falloEmail) {
    falloEmail.addEventListener("click", () => {
      const detalle = detalleEl.value.trim();
      avisarSoporte("fallo", detalle || "(Reportó por email sin escribir el detalle aquí primero.)");
      const cuerpo = detalle ? detalle : "Herramienta: \nDispositivo/navegador: \nQué pasó: ";
      window.location.href = `mailto:aleranvocals@gmail.com?subject=${encodeURIComponent(
        "Fallo en herramientas de práctica"
      )}&body=${encodeURIComponent(cuerpo)}`;
    });
  }
}

document.addEventListener("DOMContentLoaded", inicializarSoporte);
