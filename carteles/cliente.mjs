// CARTELES DE LA SEMANA — la ventana (21-10). La carga site/carteles/arranque.js al pulsar el botón
// (en la web publicada, solo con `?carteles`): la primera vez pide su CSS, la ventana y las filas de la
// temporada que dejó el build (carteles/ventana.html y carteles/filas.json, de site/paginas.mjs →
// ficherosCarteles). Aquí se corta el periodo de jueves a miércoles (el cartel se sube el jueves), se
// pintan los carteles (site/carteles/pintar.mjs), se ven a pantalla completa en el visor y se
// ofrecen para descargar o compartir.
import { CAMPOS, botonesCartel, cartelesDelPeriodo, plataformaDe, acotarPeriodo, juevesPorDefecto, nombreFichero, periodosPermitidos, sumarDias, textoPeriodo } from './datos.mjs';
import { cargarEscudos, cargarRecursos, maquetar, pintarCartel } from './pintar.mjs';

const BASE = new URL('./', import.meta.url);

// «Hoy» en Madrid, la hora del club, sea cual sea la del equipo que abre la web.
const hoyMadrid = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

const aBlob = (canvas) => new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo crear la imagen'))), 'image/png'));

/** La primera vez: CSS, ventana y filas, y los manejadores. Devuelve la función que abre la ventana. */
async function preparar() {
  const estilo = document.createElement('link');
  estilo.rel = 'stylesheet';
  estilo.href = new URL('carteles.css', BASE).href;
  const cargado = new Promise((ok, mal) => { estilo.onload = ok; estilo.onerror = () => mal(new Error('sin carteles.css')); });
  document.head.append(estilo);
  const pedir = (f) => fetch(new URL(f, BASE)).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r; });
  const [ventana, filasPorCampo] = await Promise.all([
    pedir('ventana.html').then((r) => r.text()),
    pedir('filas.json').then((r) => r.json()),
    cargado,
  ]);
  // La ventana viene hecha del build: aquí solo se cuelga.
  document.querySelector('.marco').insertAdjacentHTML('beforeend', ventana);

  const dialogo = document.getElementById('carteles-dialogo');
  const fechas = document.getElementById('carteles-fechas');
  const lista = document.getElementById('carteles-lista');
  const anterior = dialogo.querySelector('[data-semana="-1"]');
  const siguiente = dialogo.querySelector('[data-semana="1"]');
  const ficha = document.getElementById('cartel-ficha');
  const vacio = document.getElementById('cartel-vacio');
  const nota = document.getElementById('carteles-nota');
  // Pantalla táctil (móvil o tableta): ahí manda «Compartir / Guardar en fotos».
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  const plataforma = plataformaDe({ uaPlataforma: navigator.userAgentData?.platform, ua: navigator.userAgent, puntosTactiles: navigator.maxTouchPoints });
  let actual = null; // el jueves del periodo
  let recursos = null;
  let urls = [];
  let turno = 0;
  let listos = []; // los carteles pintados del periodo, para el visor: { url, titulo }

  // VISOR (21-10, Luismi): el cartel a pantalla completa, encajado entero sobre fondo oscuro. Se cierra
  // con la X, Esc o un clic fuera de la imagen; ← → (o sus botones) pasan entre los del periodo.
  const visor = document.getElementById('cartel-visor');
  const visorImagen = document.getElementById('visor-imagen');
  const visorPie = document.getElementById('visor-pie');
  let enVisor = 0;
  const verEnVisor = (i) => {
    enVisor = (i + listos.length) % listos.length;
    const c = listos[enVisor];
    visorImagen.src = c.url;
    visorImagen.alt = c.titulo;
    visorPie.textContent = listos.length > 1 ? `${c.titulo} · ${enVisor + 1} de ${listos.length}` : c.titulo;
    for (const b of visor.querySelectorAll('[data-visor="-1"], [data-visor="1"]')) b.hidden = listos.length < 2;
  };
  visor.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-visor]');
    if (boton) {
      if (boton.dataset.visor === 'cerrar') visor.close();
      else verEnVisor(enVisor + Number(boton.dataset.visor));
    } else if (e.target === visor) visor.close(); // el fondo, fuera de la imagen
  });
  visor.addEventListener('keydown', (e) => {
    if (listos.length < 2 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    verEnVisor(enVisor + (e.key === 'ArrowRight' ? 1 : -1));
  });

  async function pintar() {
    const mio = (turno += 1);
    fechas.textContent = textoPeriodo(actual);
    // Las flechas mueven 7 días; no van más allá del primer y el último periodo con partidos.
    // Solo la semana de hoy y la siguiente (26-10, Luismi): fuera de ahí las flechas se apagan.
    const limites = periodosPermitidos(hoyMadrid());
    anterior.disabled = actual <= limites.primero;
    siguiente.disabled = actual >= limites.ultimo;
    anterior.setAttribute('aria-disabled', String(anterior.disabled));
    siguiente.setAttribute('aria-disabled', String(siguiente.disabled));
    const periodo = cartelesDelPeriodo(filasPorCampo, actual);
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    listos = [];
    lista.replaceChildren();
    // Primero las fichas en esqueleto (el hueco del cartel en gris) y luego cada imagen.
    const trabajos = [];
    for (const campo of CAMPOS) {
      const filas = periodo[campo.slug] ?? [];
      if (!filas.length) {
        const nota = vacio.content.firstElementChild.cloneNode(true);
        nota.textContent = `${campo.nombre}: sin partidos en estos días, no hay cartel.`;
        lista.append(nota);
        continue;
      }
      const partes = maquetar(campo.slug, filas.length, actual);
      partes.forEach((trozo, i) => {
        const nodo = ficha.content.firstElementChild.cloneNode(true);
        const n = trozo.hasta - trozo.desde;
        const titulo = `${campo.nombre}${partes.length > 1 ? ` (${i + 1}/${partes.length})` : ''}`;
        nodo.querySelector('.cartel__nombre').textContent = `${titulo} · ${n} ${n === 1 ? 'partido' : 'partidos'}`;
        lista.append(nodo);
        trabajos.push({ nodo, campo, titulo, filas: filas.slice(trozo.desde, trozo.hasta), alto: trozo.alto, parte: i + 1, partes: partes.length });
      });
    }
    try {
      recursos ??= await cargarRecursos(BASE.href);
    } catch (error) {
      if (mio === turno) lista.prepend(Object.assign(vacio.content.firstElementChild.cloneNode(true), { textContent: `No se han podido cargar la letra o los fondos: ${error.message}` }));
      return;
    }
    for (const tr of trabajos) {
      if (mio !== turno) return;
      const escudos = await cargarEscudos(tr.filas);
      if (mio !== turno) return;
      const canvas = document.createElement('canvas');
      pintarCartel(canvas, { slug: tr.campo.slug, filas: tr.filas, alto: tr.alto, parte: tr.parte, partes: tr.partes, fondo: await recursos.fondo(tr.campo.slug, actual), escudos });
      const blob = await aBlob(canvas);
      if (mio !== turno) return;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      const nombre = nombreFichero(tr.campo.slug, actual, tr.parte, tr.partes);
      const titulo = `${tr.titulo}, ${textoPeriodo(actual).toLowerCase()}`;
      const indice = listos.push({ url, titulo }) - 1;
      const img = tr.nodo.querySelector('.cartel__imagen');
      img.src = url;
      img.alt = `Cartel de ${titulo}`;
      img.removeAttribute('aria-busy');
      const ampliar = tr.nodo.querySelector('.cartel__ampliar');
      ampliar.disabled = false;
      ampliar.setAttribute('aria-label', `Ver a pantalla completa: ${tr.titulo}`);
      ampliar.addEventListener('click', () => { verEnVisor(indice); visor.showModal(); });
      const descargar = tr.nodo.querySelector('[data-descargar]');
      descargar.href = url;
      descargar.download = nombre;
      descargar.removeAttribute('aria-disabled');
      // GUARDAR Y COMPARTIR según la plataforma (21-10, Luismi: «no se me descarga a fotos en el
      // móvil»): qué botones y en qué orden lo decide botonesCartel() (datos.mjs). En Android la
      // galería se llena DESCARGANDO (Download/), en iOS desde la hoja de compartir.
      const archivo = new File([blob], nombre, { type: 'image/png' });
      const compartir = tr.nodo.querySelector('[data-compartir]');
      const botones = botonesCartel({ plataforma, tactil, puedeCompartir: Boolean(navigator.canShare?.({ files: [archivo] })) });
      const caja = tr.nodo.querySelector('.cartel__acciones');
      const nodoDe = { descargar, compartir };
      descargar.hidden = true;
      compartir.hidden = true;
      for (const b of botones.lista) {
        const n = nodoDe[b.accion];
        n.hidden = false;
        n.lastChild.textContent = b.texto;
        n.classList.toggle('boton--primario', b.principal);
        caja.append(n);
      }
      if (botones.nota) nota.hidden = false;
      compartir.addEventListener('click', () => {
        navigator.share({ files: [archivo], title: titulo }).catch(() => {});
      });
    }
  }

  const irA = (jueves) => { actual = acotarPeriodo(jueves, periodosPermitidos(hoyMadrid())); pintar(); };
  anterior.addEventListener('click', () => irA(sumarDias(actual, -7)));
  siguiente.addEventListener('click', () => irA(sumarDias(actual, 7)));
  // Al cerrar, fuera los PNG de memoria (las URLs de los blobs); al volver a abrir se pintan otra vez.
  dialogo.addEventListener('close', () => {
    turno += 1;
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    listos = [];
    lista.replaceChildren();
  });
  return () => {
    dialogo.showModal();
    irA(juevesPorDefecto(hoyMadrid()));
  };
}

let abrirVentana = null;
/** Abre la ventana de carteles (la prepara la primera vez). */
export async function abrir() {
  abrirVentana ??= await preparar();
  abrirVentana();
}
