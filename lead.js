(function () {
  const ENDPOINT = "https://panel.aleranvocals.es/api/leads";
  const PDF_URL = "recursos/Rutina-Calentamiento-Aleran.pdf";

  function inicializarCapturaLead() {
    const form = document.getElementById("formCapturaLead");
    if (!form) return;

    const campoEmail = document.getElementById("capturaEmail");
    const campoHoneypot = document.getElementById("capturaEmpresa");
    const boton = form.querySelector("button[type='submit']");
    const estado = document.getElementById("capturaEstado");
    const descarga = document.getElementById("capturaDescarga");

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      if (campoHoneypot && campoHoneypot.value.trim() !== "") {
        // Bot detectado: fingimos éxito sin llamar a la API ni gastar cuota.
        mostrarExito();
        return;
      }

      const email = campoEmail.value.trim();
      if (!email || !email.includes("@")) {
        mostrarEstado("Escribe un email válido.", "error");
        return;
      }

      boton.disabled = true;
      estado.textContent = "";
      estado.className = "captura-estado";

      try {
        const resp = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, origen: "rutina-calentamiento-pdf" }),
        });
        if (!resp.ok) throw new Error("fallo-servidor");
        mostrarExito();
      } catch (err) {
        mostrarEstado("No se pudo enviar. Inténtalo de nuevo en un momento.", "error");
        boton.disabled = false;
      }
    });

    function mostrarEstado(texto, tipo) {
      estado.textContent = texto;
      estado.className = "captura-estado " + tipo;
    }

    function mostrarExito() {
      form.hidden = true;
      estado.textContent = "";
      descarga.hidden = false;
      descarga.querySelector("a").focus();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarCapturaLead);
  } else {
    inicializarCapturaLead();
  }

  window.CapturaLead = { PDF_URL };
})();
