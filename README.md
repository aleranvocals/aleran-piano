# Herramientas de Áleran Vocals — sitio estático independiente

Varias páginas web estáticas (HTML + CSS + JS puro, sin frameworks ni paso
de build) con piano real, entrenamiento con micrófono y juegos de oído para
alumnos de canto. Todo ocurre en el propio navegador del visitante: no hay
servidor, no hay backend, no hay nada que instalar, no hay costes ni
cuentas de terceros.

## Estructura: varias páginas, no una sola

Cada herramienta es su propia página HTML con su propia URL, para que no se
vuelva inmanejable de navegar y para que cada una cargue solo lo que
necesita (ver "Qué carga cada página" más abajo). Todas comparten el mismo
`style.css` y los mismos "motores" (`escalas.js`, `audio.js`, `teclado.js`,
`progreso.js`), así que no hay nada duplicado.

- **`index.html`** — página de inicio, con tarjetas a cada herramienta.
- **`piano.html`** — 🎹 Nota individual, notas aleatorias, más de 25
  escalas/patrones vocales reales (calentamiento, diatónicas, modos griegos,
  pentatónicas/blues, arpegios, voz mixta/passaggio), notas personalizadas,
  Solfeo (do-re-mi movible: canta los grados de la escala mayor con
  sílabas de solfeo relativas a la tónica que elijas, no con nombres
  absolutos), metrónomo (50-350 BPM), **"🎤 Cantar y calificar"** (el
  programa toca la nota y escucha al alumno cantarla de vuelta, con aguja
  de afinación en vivo y calificación en "cents"), y **"🎧 Escucha e
  imita"** (toca la frase completa una sola vez y luego el alumno la canta
  de memoria, de corrido, calificada nota por nota — un eco melódico, no
  llamada-y-respuesta).
- **`entrenamiento.html`** — 🎤 Rango vocal (canta grave→agudo y te dice tu
  rango y tipo de voz más cercano), SOVT / Sirena (desliza libremente de
  grave a agudo haciendo trino de labios, pajita, zumbido o solo con la
  voz — para calentar o enfriar, sin medir nada al final), Nota sostenida
  (cronómetro + gráfica + detección de vibrato **en vivo**, no solo al
  terminar, para poder practicar activar y desactivar el vibrato a
  voluntad), Messa di voce (sostén una nota mientras haces un
  "globo" de crescendo-diminuendo; se mide con el RMS de la señal y se
  puntúa la forma de la curva y la estabilidad de la nota), Control de aire
  (soplido sostenido tipo "sss"/"fff", sin cuerdas vocales: mide cuánto
  aguantas y qué tan constante es el caudal de aire), Espectro en vivo
  (espectrograma 0-4000 Hz, con un índice aproximado de "brillo/proyección"
  — energía en la banda 2.5-3.5 kHz del formante del cantante frente al
  resto del espectro; no es una medición clínica, sirve para comparar
  dentro de la misma toma), y Grabadora (graba tomas cortas de práctica,
  ponles un nombre como "antes"/"después", y guárdalas para comparar más
  tarde — persisten en `IndexedDB`, no en `localStorage`, porque el audio
  no cabe ahí).
- **`oido.html`** — 🧠 Intervalos, Adivina la nota, y Simon dice. Ninguno usa
  micrófono.
- **`rutina.html`** — 📋 una rutina de calentamiento corta y distinta cada
  día (misma para todos los que la abran ese día), con racha de días
  completados, y un enlace al final sugiriendo cerrar con un enfriamiento
  SOVT en Entrenamiento.
- **`progreso.html`** — 📈 tarjetas con los récords guardados en
  `localStorage` (rango vocal, mejor sostenido, control de aire, % de
  aciertos, rachas), un calendario de racha tipo GitHub (18 semanas), un
  botón para descargar una tarjeta-resumen en PNG (dibujada con Canvas,
  lista para compartir), y una fila de **insignias** (rachas, precisión de
  oído, rango amplio, explorar las 4 herramientas principales...).
- **`guia.html`** — 🧭 "¿qué quieres trabajar hoy?": elige el problema que
  más te está costando (afinación, rango, vibrato, volumen, aire, ritmo, o
  "solo calentar") y te lleva directo a la herramienta del kit pensada
  para eso, con una razón breve de por qué. No mide nada por sí misma,
  solo dirige.
- **`catalogo.html`** — 🎼 las 25+ escalas y patrones vocales del kit,
  organizados por categoría, con un botón para escuchar cada uno al
  instante (siempre desde Do3) sin tener que configurar nada en Piano.
- **`glosario.html`** — 📖 términos de técnica vocal explicados en lenguaje
  llano (passaggio, twang, apoyo, resonancia, solfeo...), con un buscador.
- **`mapa-vocal.html`** — 🗺️ escribe las notas de los registros de un alumno
  (voz de pecho, voz de cabeza, passaggio, voz de silbido, emulación de
  canto mongol y una nota de belting, todos opcionales salvo los tres
  primeros — vienen precargados con un ejemplo) y genera un diagrama de
  rango vocal en SVG, en vivo mientras escribes, listo para descargar como
  PNG. Los colores de cada registro se pintan directamente sobre el
  teclado (transparencias superpuestas, no una franja aparte), pecho y
  cabeza comparten la misma zona con una línea diagonal marcando dónde se
  solapan, y las etiquetas de cada registro van debajo del teclado como
  líneas de cota, escalonadas para no chocar entre sí. La zona de paso
  (mix predominante pecho/cabeza) se calcula sola a partir del passaggio
  — no hace falta ninguna cuenta ni Corel. No usa audio ni micrófono: es
  puramente un generador de imágenes.

El teclado de piano, su zoom, el desplazamiento (rueda/slider) y la aguja de
afinación en vivo están en `teclado.js` y se repiten (mismo HTML) en las
páginas que lo necesitan — piano, entrenamiento, oído y rutina —, pero el
código no está duplicado.

### Modo claro / oscuro

Todas las páginas tienen un botón (arriba a la derecha de la cabecera) para
alternar entre el modo oscuro original (vino/carmesí sobre negro) y un modo
claro (los mismos colores, sobre un fondo marfil). La preferencia se
recuerda en este navegador (`tema.js` + `localStorage`) y se aplica antes
de pintar la página para que no haya parpadeo al cargar. Las teclas del
piano y el acento de color se mantienen iguales en ambos modos a propósito.

### Vincular la duración al tempo (novedad)

En `piano.html`, en vez de fijar la duración de cada nota a mano en
segundos, puedes marcar "Vincular la duración al tempo del metrónomo" y
elegir una figura rítmica (redonda, blanca, negra, corchea, semicorchea o
tresillo de negra): la duración se calcula sola a partir del BPM del
metrónomo (`60 / BPM × figura`) y se recalcula en vivo si cambias el tempo.
Así una escala se puede tocar "a tempo" real, no a una duración arbitraria.

## Qué carga cada página (optimización)

Ninguna página carga una librería que no vaya a usar:

| Página              | lamejs (MP3) | smplr (piano) | pitchy (mic) | teclado.js |
| ------------------- | :----------: | :-----------: | :----------: | :--------: |
| `index.html`        |      —       |       —       |      —       |     —      |
| `piano.html`        |      ✅      |      ✅       |      ✅      |     ✅     |
| `entrenamiento.html`|      —       |      ✅       |      ✅      |     ✅     |
| `oido.html`         |      —       |      ✅       |      —       |     ✅     |
| `rutina.html`       |      —       |      ✅       |      —       |     ✅     |
| `progreso.html`     |      —       |       —       |      —       |     —      |
| `guia.html`         |      —       |       —       |      —       |     —      |
| `catalogo.html`     |      —       |      ✅       |      —       |     ✅     |
| `glosario.html`     |      —       |       —       |      —       |     —      |
| `mapa-vocal.html`   |      —       |       —       |      —       |     —      |

`progreso.html`, `guia.html`, `glosario.html` y `mapa-vocal.html`, por
ejemplo, no descargan
ni el piano (66 KB) ni el codificador MP3 (169 KB) ni el detector de
afinación: solo lo justo para mostrar tarjetas de texto. `tema.js` (menos
de 1 KB) es la única excepción: se carga en las 9 páginas.

## Micrófono: requisitos importantes

El detector de afinación usa el algoritmo McLeod Pitch Method (librería
[`pitchy`](https://github.com/ianprime0509/pitchy), MIT, empaquetada
localmente como `pitchy.iife.js`) — el mismo tipo de algoritmo que usan los
afinadores profesionales, funcionando enteramente en el navegador del
alumno, sin ningún servicio de pago. **Importante:** el micrófono solo
funciona en un contexto seguro (HTTPS, o `http://localhost` en pruebas
locales) — Vercel ya sirve todo por HTTPS, pero si lo subes a DonDominio
comprueba que el hosting tenga certificado SSL activo, si no el navegador
bloqueará el permiso directamente.

## Archivos

**Páginas:** `index.html`, `piano.html`, `entrenamiento.html`, `oido.html`,
`rutina.html`, `progreso.html`, `guia.html`, `catalogo.html`, `glosario.html`,
`mapa-vocal.html`.

**Estilos:** `style.css` (paleta de Áleran Vocals: vino/carmesí, con modo
oscuro y modo claro; también los estilos del hub, la navegación, y cada
herramienta).

**Motores compartidos:**
- `escalas.js` — la "base de datos": tipos de voz, catálogo de 25+
  escalas/patrones vocales categorizados, parser de notas escritas a mano,
  conversiones nota↔MIDI↔frecuencia, y el atajo `el()` que usan todas las
  páginas.
- `audio.js` — piano real muestreado (`smplr`), reproducción en tiempo real
  y renderizado offline con fundido de salida adaptado a la duración,
  codificación a MP3 (`lamejs`), motor del metrónomo, y motor de
  micrófono/afinación (`pitchy`).
- `teclado.js` — el teclado visual (construcción, zoom, desplazamiento) y
  el afinómetro (aguja en vivo); cada página le pasa su propio callback de
  clic (elegir nota, responder un quiz...) o usa el de previsualizar por
  defecto. El teclado solo se desplaza cuando la nota que suena queda
  fuera de la parte visible — no re-centra la vista en cada nota.
- `progreso.js` — guardado de récords en `localStorage` (sin servidor).
- `tema.js` — botón de modo claro/oscuro, en las 9 páginas.

**Por página:**
- `piano.js` — los 6 modos de `piano.html` (incluido Solfeo), "Cantar y
  calificar", "Escucha e imita", el metrónomo, y la sincronización
  duración↔tempo.
- `entrenamiento.js` — Rango vocal, Nota sostenida, Messa di voce, Control
  de aire y Espectro en vivo (con el índice de brillo/proyección).
- `oido.js` — Intervalos, Adivina la nota y Simon dice.
- `rutina.js` — genera la rutina diaria, lleva la racha y guarda el
  historial de días completados.
- `progreso-vista.js` — renderiza las tarjetas, el calendario de racha y
  las insignias de `progreso.html`, y genera la tarjeta de progreso
  descargable (Canvas → PNG).
- `guia.js` — el mapeo de problemas → herramientas de `guia.html`.
- `grabadora.js` — graba, lista, reproduce y borra las tomas de práctica
  de la pestaña "Grabadora" en `entrenamiento.html` (`MediaRecorder` +
  `IndexedDB`).
- `catalogo.js` — genera y reproduce las 25+ tarjetas de `catalogo.html`.
- `glosario.js` — el buscador y la lista de `glosario.html`.
- `mapa-vocal.js` — construye el diagrama SVG de `mapa-vocal.html` (teclado,
  franjas de color, guías de passaggio/central/belting) y lo convierte a
  PNG descargable con Canvas.

**Librerías de terceros (empaquetadas localmente, MIT license, sin CDN
externo):**
- `lamejs.iife.js` — codificador MP3 en JavaScript puro.
- `smplr.iife.js` — reproductor de muestras de piano real (Steinway,
  "SplendidGrandPiano"), empaquetado con esbuild como script clásico (no
  módulo ES) para funcionar tanto con doble clic (`file://`) como en
  cualquier hosting.
- `pitchy.iife.js` — detector de afinación por micrófono (McLeod Pitch
  Method), empaquetado igual que `smplr.iife.js`.

## Cómo probarlo en local

Al ser HTML/CSS/JS puro, basta con abrir cualquier página con un servidor
estático simple (abrirlas con doble clic también funciona en la mayoría de
navegadores, pero un servidor evita cualquier restricción de `file://`):

```bash
python -m http.server 8877 --directory .
```

Y visitar `http://localhost:8877` (abre `index.html`, el hub con enlaces a
todo lo demás).

## Cómo publicarlo

Es una carpeta 100% estática: sirve tal cual en cualquier hosting.

- **Vercel**: crea un proyecto nuevo, "Other" / sin framework, y apunta el
  "Output Directory" a esta carpeta (o sube estos archivos sueltos si usas
  `vercel deploy` directamente dentro de ella).
- **DonDominio (hosting compartido)**: sube estos archivos por FTP/gestor de
  archivos a la carpeta pública (`public_html` o similar). No necesita PHP
  ni base de datos.
- **Como sección de una web existente**: puedes copiar toda esta carpeta a
  una subcarpeta (ej. `/herramientas/`) de cualquier sitio, o incrustar una
  página concreta en un `<iframe>` (con el atributo `allow="microphone"`
  para las páginas que usan el micrófono).

No hay variables de entorno ni configuración que ajustar.

## Notas técnicas

- El piano son muestras reales de un Steinway de cola (librería
  ["SplendidGrandPiano"](https://github.com/sfzinstruments/SplendidGrandPiano),
  servidas por el proyecto [`smplr`](https://github.com/danigb/smplr) desde
  `smpldsnds.github.io`). El código de `smplr` está empaquetado localmente,
  pero las muestras de audio en sí se siguen descargando de ese hosting la
  primera vez que se reproduce o exporta algo — el visitante necesita
  internet esa primera vez (el navegador las cachea después). Cada nota se
  reproduce a la velocidad de muestreo exacta para el semitono pedido
  (afinación exacta, no una aproximación), y el ataque percusivo real del
  martillo es lo que hace que notas seguidas suenen articuladas y no como
  un glissando.
- Si algún día se necesita que funcione sin conexión a internet en absoluto
  (o sin depender de ese hosting de terceros), se pueden descargar las
  muestras y servirlas desde esta misma carpeta — avisa y lo dejamos
  preparado.
- La exportación a MP3 (solo en `piano.html`) renderiza la secuencia
  completa "fuera de tiempo real" (`OfflineAudioContext`) y la codifica en
  el propio navegador con `lamejs`; para secuencias largas puede tardar
  unos segundos. El fundido de salida se calcula a partir de la duración de
  la última nota (notas largas → fundido más largo) y el buffer offline
  reserva cola de sobra para que ese fundido nunca se corte en seco.
- La duración de cada nota admite hasta 10 segundos manualmente, o se
  puede vincular al tempo del metrónomo (ver más arriba).
- Los rangos de voz son una tesitura cómoda de práctica, pensada para
  generar ejercicios seguros — no el límite teórico extremo de cada voz.

## Ideas para seguir (roadmap)

Todo lo planeado hasta ahora está construido. Próximas ideas se añadirán
aquí conforme surjan.
