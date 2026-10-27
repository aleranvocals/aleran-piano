/* beta-ir.js — en la portada: aleran-piano.vercel.app/?clase=C030 lleva a la herramienta de esa clase del curso. */
(function () {
  "use strict";
  var c = new URLSearchParams(location.search).get("clase");
  if (c && /^c?\d{1,3}$/i.test(c.trim())) location.replace("beta.html?clase=" + encodeURIComponent(c.trim()));
})();
