// HISTORIAS DE INSTAGRAM (25-11) — la página historias.html (site/paginas.mjs → paginaHistorias).
//
// 25-11, Luismi: «en vez de un modal, que las Historias sean una página». «Añadir fotos» (varias a la
// vez) crea UNA FILA POR FOTO con su crónica al lado, así cada crónica va con su foto sin fiarse del
// orden. Cada fila: la miniatura, la crónica, la plantilla (se elige sola por el texto), «Vista previa»
// (un modal para ajustar texto y foto: arrastrar, zoom, cambiarla) y «Generar». Debajo de la lista,
// «Generar todo». Las fotos NO salen del dispositivo: todo se pinta aquí, en el navegador.
import { GEOMETRIA, PALABRAS_LARGA, contarPalabras, crearZip, nombreFichero, plantillaPorTexto } from './datos.mjs';
import { ajusteDe, cargarFoto, cargarRecursos, pintarHistoria, pintarMiniatura } from './pintar.mjs';
import { botonesCartel, plataformaDe } from '../carteles/datos.mjs';
import {
  correccionesDe, erroresFrecuentes, espaciosQueFaltan, mayusculasDeFrase, nombresPropios, puntoFinal, revisarEnLanguageTool,
  signosDeApertura, unirLineas,
} from './ortografia.mjs';

// Nombres de equipos y ciudades para el revisor (los deja el build en la página).
const NOMBRES = (() => { try { return JSON.parse(document.getElementById('historias-nombres')?.textContent || '[]'); } catch { return []; } })();

const BASE = new URL('./', import.meta.url);
const PREVIA = 0.5; // la vista previa del modal, a 540×960
const TIPO = 'image/jpeg'; // con una foto dentro, ~5 veces menos que el PNG; Instagram lo recomprime igual
const CALIDAD = 0.92;

const hoyMadrid = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const exportar = (canvas) => new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo crear la imagen'))), TIPO, CALIDAD));
const descargarBlob = (blob, nombre) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
};
const esImagen = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);

// ── El editor de la crónica (con formato) ───────────────────────────────────────────────────────
// Un contenteditable en cada fila y otro en la vista previa (25-11, Luismi: «seleccionar el color y
// formateo básico como negrita y cursiva»). El formato se lee del estilo CALCULADO de cada trozo de
// texto, así da igual si el navegador escribe <b>, <strong> o <span style>: el editor tiene el color
// de la plantilla (CSS .editor), y un trozo con ese color va como «sin color» (el de la plantilla).
const aHex = (rgb) => {
  const m = rgb.match(/\d+(\.\d+)?/g);
  return m ? `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : null;
};
function trozosDelEditor(editor) {
  const trozos = [];
  const base = aHex(getComputedStyle(editor).color);
  const recorrido = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    if (!n.data) continue;
    const cs = getComputedStyle(n.parentElement);
    const color = aHex(cs.color);
    trozos.push({ texto: n.data.replace(/\s+/g, ' '), negrita: Number(cs.fontWeight) >= 600, cursiva: cs.fontStyle !== 'normal', color: color === base ? null : color });
  }
  return trozos;
}
// Pegar siempre como texto (lo que viene de WhatsApp o de una web traería su letra y sus colores) y en
// una sola línea; Intro no parte la crónica (en la historia no hay saltos de línea).
function prepararEditor(editor) {
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    // Cada salto de línea, fin de frase (así escriben en WhatsApp: «formación & competición⏎Seguimos!!»).
    const texto = unirLineas(e.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, texto);
  });
  editor.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  editor.addEventListener('drop', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
}
const vaciarSiVacio = (editor) => { if (!editor.textContent.trim()) editor.replaceChildren(); };

const lista = document.getElementById('historias-lista');
// La zona de soltar (25-11, Luismi: «que el área de las fotos sea clicable y pueda arrastrar fotos»):
// grande mientras no hay historias; con historias, una franja bajo la lista para añadir más.
const soltar = document.getElementById('historias-soltar');
const pie = document.getElementById('historias-pie');
const cuenta = document.getElementById('historias-cuenta');
const todas = document.getElementById('historias-todas');
const fila = document.getElementById('historia-fila');
const previa = document.getElementById('historia-previa');
const previaTitulo = document.getElementById('previa-titulo');
const previaCanvas = document.getElementById('previa-canvas');
const previaTexto = document.getElementById('previa-texto');
const previaAviso = document.getElementById('previa-aviso');
const previaPlantilla = document.getElementById('previa-plantilla');
const previaZoom = document.getElementById('previa-zoom');
const previaFoto = document.getElementById('previa-foto');
const previaAcciones = document.getElementById('previa-acciones');

const tactil = window.matchMedia('(pointer: coarse)').matches;
const plataforma = plataformaDe({ uaPlataforma: navigator.userAgentData?.platform, ua: navigator.userAgent, puntosTactiles: navigator.maxTouchPoints });
const fecha = hoyMadrid();
const lienzoExportar = document.createElement('canvas');
const recursosListos = cargarRecursos(BASE);

/** Cada historia: su fila, su foto y su crónica. */
const historias = [];
let actual = null; // la que está abierta en la vista previa

// ── El fichero final (1080×1920) ─────────────────────────────────────────────────────────────────
// Se prepara en cuanto la historia se queda quieta: «Compartir» lo necesita listo al tocarlo (Safari
// solo deja compartir dentro del gesto del usuario).
async function archivoDe(h) {
  if (!h.sucio && h.archivo) return h.archivo;
  pintarHistoria(lienzoExportar, h, await recursosListos, 1);
  const blob = await exportar(lienzoExportar);
  h.archivo = new File([blob], nombreFichero(fecha, historias.indexOf(h) + 1, h.plantilla), { type: TIPO });
  h.sucio = false;
  return h.archivo;
}
let temporizador = 0;
const preparando = new Set();
function programarExportacion() {
  clearTimeout(temporizador);
  temporizador = setTimeout(async () => {
    for (const h of historias) {
      if (!h.sucio || !h.foto || !h.texto || preparando.has(h)) continue;
      preparando.add(h);
      try { await archivoDe(h); } finally { preparando.delete(h); }
      pintarAcciones(h);
    }
  }, 500);
}

// ── Botones Generar / Compartir ──────────────────────────────────────────────────────────────────
// Qué botones y en qué orden lo decide botonesCartel() (el mismo criterio que los carteles: en Android
// «Guardar en la galería», en iOS la hoja de compartir); «Descargar» se llama aquí «Generar».
function botonesEn(caja, h) {
  const listo = Boolean(h.foto && h.texto && h.archivo && !h.sucio);
  const botones = botonesCartel({ plataforma, tactil, puedeCompartir: Boolean(listo && navigator.canShare?.({ files: [h.archivo] })) });
  const nodoDe = { descargar: caja.querySelector('[data-descargar]'), compartir: caja.querySelector('[data-compartir]') };
  nodoDe.descargar.hidden = true;
  nodoDe.compartir.hidden = true;
  for (const b of botones.lista) {
    const n = nodoDe[b.accion];
    n.hidden = false;
    n.lastChild.textContent = b.texto === 'Descargar' ? 'Generar' : b.texto;
    n.classList.toggle('boton--primario', b.principal);
    // Generar (descargar) se puede siempre que haya texto y foto: pinta al tocarlo. Compartir, solo
    // con el fichero ya hecho.
    n.disabled = b.accion === 'compartir' ? !listo : !(h.foto && h.texto);
    n.title = h.texto ? '' : 'Falta la crónica';
    caja.append(n);
  }
}
function pintarAcciones(h) {
  botonesEn(h.nodo.querySelector('.historia__acciones'), h);
  if (h === actual) botonesEn(previaAcciones, h);
}

// ── Avisos y resumen ────────────────────────────────────────────────────────────────────────────
// Los avisos SUGIEREN, no ordenan (25-11, Luismi): la historia se genera igual; si es muy larga, con
// la letra más pequeña para que no se salga del bocadillo.
function avisoDe(h) {
  if (!h.texto) return { texto: '', fuerte: false };
  const ajuste = ajusteDe(h);
  h.cabe = ajuste.cabe;
  const palabras = contarPalabras(h.texto);
  if (!ajuste.cabe) return { texto: `Es bastante larga (${palabras} palabras) y la letra sale muy pequeña. Te sugerimos acortarla un poco para que se lea bien en el móvil.`, fuerte: true };
  if (palabras > PALABRAS_LARGA) return { texto: `Algo larga (${palabras} palabras): cabe, con la letra un poco más pequeña.`, fuerte: false };
  return { texto: '', fuerte: false };
}
function pintarAviso(nodo, aviso, contenedor) {
  nodo.textContent = aviso.texto;
  nodo.hidden = !aviso.texto;
  contenedor.classList.toggle('historia--aviso', aviso.fuerte);
}

function resumen() {
  soltar.classList.toggle('historias__soltar--franja', historias.length > 0);
  pie.hidden = historias.length === 0;
  const sinTexto = historias.filter((h) => !h.texto).length;
  const noCaben = historias.filter((h) => h.texto && h.cabe === false).length;
  const partes = [`${historias.length} ${historias.length === 1 ? 'historia' : 'historias'}`];
  if (sinTexto) partes.push(`${sinTexto} sin crónica`);
  if (noCaben) partes.push(`${noCaben} con la letra muy pequeña`);
  cuenta.textContent = partes.join(' · ');
  historias.forEach((h, i) => { h.nodo.querySelector('.historia__numero').textContent = `${i + 1}`; });
  const listas = historias.filter((h) => h.foto && h.texto).length;
  todas.disabled = listas === 0;
  // Si alguna está a medias (sin crónica), el botón dice cuántas saldrán: «Generar 2 de 3».
  todas.lastChild.textContent = listas && listas < historias.length ? `Generar ${listas} de ${historias.length}` : 'Generar todo';
}

/** Algo cambió en la historia: fila, vista previa si está abierta, avisos, resumen y exportación. */
function cambio(h) {
  h.sucio = true;
  pintarMiniatura(h.nodo.querySelector('.historia__miniatura canvas'), h);
  pintarAviso(h.nodo.querySelector('.historia__aviso'), avisoDe(h), h.nodo);
  if (h === actual) pintarPrevia();
  pintarAcciones(h);
  resumen();
  programarExportacion();
}

// ── Filas ───────────────────────────────────────────────────────────────────────────────────────
function nuevaFila(fichero) {
  const nodo = fila.content.firstElementChild.cloneNode(true);
  const h = { nodo, texto: '', trozos: [], plantilla: 'cantera', plantillaAMano: false, foto: null, encuadre: { zoom: 1, cx: 0.5, cy: 0.5 }, archivo: null, sucio: true, cabe: true };
  historias.push(h);
  const editor = nodo.querySelector('.historia__texto');
  const selector = nodo.querySelector('.historia__plantilla');
  selector.value = h.plantilla;
  prepararEditor(editor);
  // La fila es la que manda: la vista previa copia aquí lo que escribe y dispara este mismo evento.
  editor.addEventListener('input', () => {
    vaciarSiVacio(editor);
    h.texto = editor.textContent.replace(/\s+/g, ' ').trim();
    h.trozos = trozosDelEditor(editor);
    if (!h.plantillaAMano) selector.value = h.plantilla = plantillaPorTexto(h.texto);
    cambio(h);
  });
  selector.addEventListener('change', () => { h.plantilla = selector.value; h.plantillaAMano = true; cambio(h); });
  for (const b of nodo.querySelectorAll('[data-previa]')) b.addEventListener('click', () => abrirPrevia(h));
  nodo.querySelector('[data-descargar]').addEventListener('click', async () => { const a = await archivoDe(h); descargarBlob(a, a.name); pintarAcciones(h); });
  nodo.querySelector('[data-compartir]').addEventListener('click', () => compartir(h));
  nodo.querySelector('[data-revisar]').addEventListener('click', () => revisar([h], nodo.querySelector('[data-revisar]')));
  // Si se vuelve a escribir, el resumen de la revisión ya no vale.
  editor.addEventListener('beforeinput', () => mostrarRevision(h, ''));
  nodo.querySelector('.historia__quitar').addEventListener('click', () => {
    historias.splice(historias.indexOf(h), 1);
    h.foto?.close();
    nodo.remove();
    for (const x of historias) x.sucio = true; // el número de orden va en el nombre del fichero
    resumen();
    programarExportacion();
  });
  // Soltar una foto encima de la fila la cambia (en el PC).
  nodo.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); nodo.classList.add('historia--soltar'); } });
  nodo.addEventListener('dragleave', () => nodo.classList.remove('historia--soltar'));
  nodo.addEventListener('drop', (e) => {
    nodo.classList.remove('historia--soltar');
    const f = [...(e.dataTransfer?.files ?? [])].find(esImagen);
    if (!f) return;
    e.preventDefault();
    ponerFoto(h, f);
  });
  lista.append(nodo);
  pintarAcciones(h);
  ponerFoto(h, fichero);
  return h;
}

async function ponerFoto(h, fichero) {
  h.nodo.setAttribute('aria-busy', 'true');
  try {
    const foto = await cargarFoto(fichero);
    h.foto?.close();
    h.foto = foto;
    h.encuadre = { zoom: 1, cx: 0.5, cy: 0.5 };
    h.nodo.querySelector('.historia__miniatura').setAttribute('aria-label', `Vista previa de la historia (foto ${fichero.name})`);
    cambio(h);
  } catch (error) {
    window.alert(`No se ha podido abrir la foto «${fichero.name}»: ${error.message}`);
  } finally {
    h.nodo.removeAttribute('aria-busy');
  }
}

async function anadirFotos(ficheros) {
  const nuevas = [...ficheros].filter(esImagen).map((f) => nuevaFila(f));
  resumen();
  // A escribir la primera crónica nueva.
  const primera = nuevas[0];
  if (primera) {
    primera.nodo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    primera.nodo.querySelector('.historia__texto').focus({ preventScroll: true });
  }
  return nuevas;
}
for (const entrada of document.querySelectorAll('.historias__anadir input, .historias__anadir-mas input, .historias__soltar input')) {
  entrada.addEventListener('change', () => { anadirFotos(entrada.files); entrada.value = ''; });
}
// Soltar fotos en cualquier sitio de la página (fuera de una fila) añade filas; mientras se arrastra,
// la zona de soltar se ilumina para que se vea dónde.
let arrastrando = 0;
const marcarSoltar = (si) => soltar.classList.toggle('historias__soltar--activa', si);
document.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { arrastrando += 1; marcarSoltar(true); } });
document.addEventListener('dragleave', () => { arrastrando = Math.max(0, arrastrando - 1); if (!arrastrando) marcarSoltar(false); });
document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  arrastrando = 0;
  marcarSoltar(false);
  if (e.defaultPrevented || !e.dataTransfer?.files.length) return;
  e.preventDefault();
  anadirFotos(e.dataTransfer.files);
});

function compartir(h) {
  if (h.archivo && !h.sucio) navigator.share({ files: [h.archivo] }).catch(() => {});
}

// ── Vista previa (modal) ────────────────────────────────────────────────────────────────────────
async function pintarPrevia() {
  const h = actual;
  const { encaje } = pintarHistoria(previaCanvas, h, await recursosListos, PREVIA);
  if (encaje) Object.assign(h.encuadre, { cx: encaje.cx, cy: encaje.cy });
  pintarAviso(previaAviso, avisoDe(h), previaAviso);
}
let fotograma = 0;
const repintarPrevia = () => { fotograma ||= requestAnimationFrame(() => { fotograma = 0; cambio(actual); }); };

function abrirPrevia(h) {
  actual = h;
  previaTitulo.textContent = `Historia ${historias.indexOf(h) + 1}`;
  previaTexto.innerHTML = h.nodo.querySelector('.historia__texto').innerHTML;
  previaPlantilla.value = h.plantilla;
  previaZoom.value = String(h.encuadre.zoom);
  pintarPrevia();
  botonesEn(previaAcciones, h);
  previa.showModal();
}
previa.addEventListener('close', () => {
  // Al cerrar, la fila se queda con el texto ya formateado de la vista previa (por si acaso).
  if (actual) actual.nodo.querySelector('.historia__texto').innerHTML = previaTexto.innerHTML;
  actual = null;
});
prepararEditor(previaTexto);
previaTexto.addEventListener('input', () => {
  const h = actual;
  vaciarSiVacio(previaTexto);
  const editor = h.nodo.querySelector('.historia__texto');
  editor.innerHTML = previaTexto.innerHTML;
  editor.dispatchEvent(new Event('input')); // la fila es la que manda: texto, formato, plantilla y avisos
  previaPlantilla.value = h.plantilla;
});

// Barra de formato: negrita, cursiva y color sobre lo seleccionado; sin selección, sobre toda la
// crónica. mousedown sin defecto para no perder la selección al pulsar.
const barra = previa.querySelector('.formato');
barra.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
function aplicarFormato(orden, valor) {
  const sel = window.getSelection();
  const dentro = sel.rangeCount && previaTexto.contains(sel.anchorNode) && !sel.isCollapsed;
  if (!dentro) {
    previaTexto.focus();
    const r = document.createRange();
    r.selectNodeContents(previaTexto);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(orden, false, valor);
  previaTexto.dispatchEvent(new Event('input'));
}
barra.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.formato) aplicarFormato(b.dataset.formato);
  else if (b.dataset.color) aplicarFormato('foreColor', b.dataset.color);
});
const colorOtro = barra.querySelector('[data-color-otro]');
// El selector de color del sistema roba el foco: se guarda la selección antes y se repone al elegir.
let seleccionGuardada = null;
colorOtro.addEventListener('pointerdown', () => {
  const sel = window.getSelection();
  seleccionGuardada = sel.rangeCount && previaTexto.contains(sel.anchorNode) && !sel.isCollapsed ? sel.getRangeAt(0).cloneRange() : null;
});
colorOtro.addEventListener('change', () => {
  const sel = window.getSelection();
  sel.removeAllRanges();
  if (seleccionGuardada) sel.addRange(seleccionGuardada);
  aplicarFormato('foreColor', colorOtro.value);
});
previaPlantilla.addEventListener('change', () => {
  const selector = actual.nodo.querySelector('.historia__plantilla');
  selector.value = previaPlantilla.value;
  selector.dispatchEvent(new Event('change'));
});
previaZoom.addEventListener('input', () => { actual.encuadre.zoom = Number(previaZoom.value); repintarPrevia(); });
previaFoto.addEventListener('change', async () => {
  if (previaFoto.files[0]) {
    await ponerFoto(actual, previaFoto.files[0]);
    previaZoom.value = '1';
  }
  previaFoto.value = '';
});
previaAcciones.querySelector('[data-descargar]').addEventListener('click', async () => { const a = await archivoDe(actual); descargarBlob(a, a.name); pintarAcciones(actual); });
previaAcciones.querySelector('[data-compartir]').addEventListener('click', () => compartir(actual));

// Arrastrar la foto: px de pantalla → fracción de la foto.
let arrastre = null;
previaCanvas.addEventListener('pointerdown', (e) => {
  if (!actual?.foto) return;
  previaCanvas.setPointerCapture(e.pointerId);
  arrastre = { x: e.clientX, y: e.clientY, cx: actual.encuadre.cx, cy: actual.encuadre.cy };
});
previaCanvas.addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const h = actual;
  const porPx = GEOMETRIA.ancho / previaCanvas.getBoundingClientRect().width; // px de la historia por px de pantalla
  const escala = Math.max(GEOMETRIA.foto.w / h.foto.width, GEOMETRIA.foto.h / h.foto.height) * h.encuadre.zoom;
  h.encuadre.cx = arrastre.cx - ((e.clientX - arrastre.x) * porPx) / escala / h.foto.width;
  h.encuadre.cy = arrastre.cy - ((e.clientY - arrastre.y) * porPx) / escala / h.foto.height;
  repintarPrevia();
});
for (const t of ['pointerup', 'pointercancel']) previaCanvas.addEventListener(t, () => { arrastre = null; });
previaCanvas.addEventListener('keydown', (e) => {
  const paso = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] }[e.key];
  if (!actual?.foto || !paso) return;
  e.preventDefault();
  actual.encuadre.cx += paso[0];
  actual.encuadre.cy += paso[1];
  repintarPrevia();
});

// ── Generar todo ────────────────────────────────────────────────────────────────────────────────
// En el móvil, a la hoja de compartir con todas (de ahí a Instagram o a «Guardar»); en el PC, o si el
// móvil no deja compartir varias, un ZIP. Solo las que tienen foto y crónica.
todas.addEventListener('click', async () => {
  const listas = historias.filter((h) => h.foto && h.texto);
  if (!listas.length) return;
  todas.setAttribute('aria-busy', 'true');
  todas.disabled = true;
  try {
    const archivos = [];
    for (const h of listas) {
      archivos.push(await archivoDe(h));
      pintarAcciones(h);
    }
    if (tactil && navigator.canShare?.({ files: archivos })) {
      try {
        await navigator.share({ files: archivos });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return; // lo cerró el CM
      }
    }
    const ficheros = await Promise.all(archivos.map(async (a) => ({ nombre: a.name, datos: new Uint8Array(await a.arrayBuffer()) })));
    descargarBlob(new Blob([crearZip(ficheros)], { type: 'application/zip' }), `historias-${fecha}.zip`);
  } finally {
    todas.removeAttribute('aria-busy');
    resumen();
  }
});

// ── Revisor ortográfico (26-11) ─────────────────────────────────────────────────────────────────
// Las reglas están en ortografia.mjs. Aquí se aplican al editor de la FILA (el que manda) sin perder
// el formato: cada cambio va al nodo de texto donde cae. Orden: espacios y mayúsculas (código) →
// LanguageTool (todas las crónicas en una petición) → signos ¡ ¿ (código). Se puede deshacer.

/** Aplica cambios { offset, length, value } al texto de un editor, nodo a nodo, de atrás hacia delante. */
function cambiarEnEditor(editor, cambios) {
  for (const c of [...cambios].sort((a, b) => b.offset - a.offset)) {
    const nodos = [];
    const recorrido = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) nodos.push(n);
    let acumulado = 0;
    let i = nodos.findIndex((n) => { const dentro = c.offset < acumulado + n.data.length; if (!dentro) acumulado += n.data.length; return dentro; });
    if (i < 0) { i = nodos.length - 1; acumulado -= nodos[i]?.data.length ?? 0; } // al final del todo
    if (i < 0) continue;
    let local = c.offset - acumulado;
    let quedan = c.length;
    let valor = c.value;
    for (; i < nodos.length && (valor !== null || quedan > 0); i += 1) {
      const n = nodos[i];
      const quita = Math.min(quedan, n.data.length - local);
      n.data = n.data.slice(0, local) + (valor ?? '') + n.data.slice(local + quita);
      quedan -= quita;
      valor = null;
      local = 0;
    }
  }
}
const textoDe = (editor) => editor.textContent.replace(/ /g, ' ');

function mostrarRevision(h, texto, deshacer) {
  for (const nodo of [h.nodo.querySelector('.historia__revision'), h === actual ? document.getElementById('previa-revision') : null]) {
    if (!nodo) continue;
    nodo.replaceChildren(texto);
    nodo.hidden = !texto;
    if (deshacer) {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'historia__deshacer', textContent: 'Deshacer' });
      b.addEventListener('click', deshacer);
      nodo.append(' ', b);
    }
  }
}

const listaCambios = (cambios) => cambios.filter((c) => c.antes.trim()).map((c) => `${c.antes.trim()} → ${c.value.trim()}`);

async function revisar(cuales, boton) {
  const filas = cuales.filter((h) => h.texto);
  if (!filas.length) return;
  boton?.setAttribute('aria-busy', 'true');
  if (boton) boton.disabled = true;
  const editores = filas.map((h) => h.nodo.querySelector('.historia__texto'));
  const antes = editores.map((e) => e.innerHTML);
  const hechos = filas.map(() => []);
  try {
    // 1) Por código: espacios, mayúsculas de frase, errores frecuentes y nombres propios.
    editores.forEach((e, i) => {
      cambiarEnEditor(e, espaciosQueFaltan(textoDe(e)));
      const may = mayusculasDeFrase(textoDe(e));
      cambiarEnEditor(e, may);
      hechos[i].mayusculas = may.length;
      const frecuentes = erroresFrecuentes(textoDe(e));
      cambiarEnEditor(e, frecuentes);
      const propios = nombresPropios(textoDe(e), NOMBRES);
      cambiarEnEditor(e, propios);
      hechos[i].push(...frecuentes, ...propios);
    });
    // 2) LanguageTool, una sola petición.
    const textos = editores.map(textoDe);
    const porCronica = await revisarEnLanguageTool(textos);
    editores.forEach((e, i) => {
      const lt = correccionesDe(textos[i], porCronica[i]);
      cambiarEnEditor(e, lt);
      // 3) Por código: signos de apertura y punto final.
      const signos = signosDeApertura(textoDe(e));
      cambiarEnEditor(e, signos);
      const punto = puntoFinal(textoDe(e));
      cambiarEnEditor(e, punto);
      hechos[i].push(...lt, ...signos);
      hechos[i].punto = punto.length > 0;
    });
    filas.forEach((h, i) => {
      const e = editores[i];
      e.dispatchEvent(new Event('input'));
      if (h === actual) previaTexto.innerHTML = e.innerHTML;
      const cambiados = listaCambios(hechos[i]);
      const signos = hechos[i].filter((c) => !c.antes && c.value.trim()).length;
      const partes = [];
      if (cambiados.length) partes.push(cambiados.join(', '));
      if (hechos[i].punto) partes.push('punto final');
      if (hechos[i].mayusculas) partes.push(`${hechos[i].mayusculas} ${hechos[i].mayusculas === 1 ? 'mayúscula' : 'mayúsculas'} al empezar frase`);
      if (signos) partes.push(`${signos} ${signos === 1 ? 'signo añadido' : 'signos añadidos'} (¡ ¿)`);
      if (!partes.length) { mostrarRevision(h, 'Revisada: no hay nada que corregir.'); return; }
      mostrarRevision(h, `Corregido: ${partes.join('; ')}.`, () => {
        e.innerHTML = antes[i];
        e.dispatchEvent(new Event('input'));
        if (h === actual) previaTexto.innerHTML = e.innerHTML;
        mostrarRevision(h, '');
      });
    });
  } catch (error) {
    // Sin red o el corrector no contesta: se deshace lo hecho por código para no dejarla a medias.
    editores.forEach((e, i) => { e.innerHTML = antes[i]; });
    filas.forEach((h) => mostrarRevision(h, `No se ha podido revisar: ${error.message === 'Failed to fetch' ? 'sin conexión con el corrector' : error.message}. Inténtalo en un momento.`));
  } finally {
    boton?.removeAttribute('aria-busy');
    if (boton) boton.disabled = false;
  }
}
document.getElementById('historias-revisar-todas').addEventListener('click', (e) => revisar(historias, e.currentTarget));
document.getElementById('previa-revisar').addEventListener('click', (e) => { if (actual) revisar([actual], e.currentTarget); });

resumen();
