// CARTELES DE LA SEMANA — pintado en el navegador con Canvas 2D, sin librerías (21-10).
//
// Fondo: la página de la plantilla de Canva sin la tabla (site/carteles/fondo-*.webp, de
// herramientas/fondos-carteles.py). Encima, la tabla con la estética de la plantilla: cabecera de
// color, columna EQUIPO melocotón y columna PARTIDO más clara, rejilla de 1.5 pt y texto morado
// centrado. Desde el 21-10 (Luismi) la columna EQUIPO es más estrecha que en la plantilla y lleva el
// entrenador en una segunda línea; PARTIDO, el local y el visitante en una línea cada uno (sin «VS»),
// con su escudo a cada lado, y la fecha en naranja debajo.
//
// Todo se mide en PUNTOS del PDF (810×1080) y el lienzo se escala 4/3 → 1080×1440 px. Lo que difiere
// de la plantilla: la letra. Las de Canva van en subconjunto dentro del PDF y no sirven para texto
// nuevo; aquí todo es League Spartan Bold (la de la columna PARTIDO de la plantilla).
import { repartirFilas } from './datos.mjs';
import { encaje, normalizarEscudo } from './normalizar-escudo.mjs';

export const ANCHO = 1080;
export const ALTO = 1440;
const ESCALA = ANCHO / 810;
const FUENTE = '"League Spartan", sans-serif';

// Geometría y colores sacados del PDF (los imprime herramientas/fondos-carteles.py). Plantilla v2
// (21-10, «CUADRANTE PARTIDOS SEMANALES v2.pdf»): blanco, negro y grises, la misma en los dos campos.
// Cabecera negra con texto blanco, EQUIPO gris claro (#d9d9d9), rejilla blanca de 4,5 pt y texto
// negro. Las letras siguen siendo las de la v1 (Kief Montaser y League Spartan; aquí, League Spartan).
const COMUN = {
  cabecera: 46.5,          // alto de la fila EQUIPO | PARTIDO
  fila: 54,                // alto de fila de la plantilla
  minimo: 39.5,            // el más bajo que se lee bien; por debajo, otra imagen (39,5: con la tabla
                           // de la v2, más baja, así siguen cabiendo 10 partidos en una imagen)
  limite: 862,             // por encima del adorno «O X» (empieza en 871) y de los patrocinadores
  grosor: 4.5,
  colorCabecera: '#000000',
  borde: '#f2f2f2',        // un solo gris, casi blanco, para toda la rejilla (21-10, Luismi)
  columnaEquipo: '#d9d9d9',
  // Blanco (21-10, Luismi): casi todos los escudos traen fondo blanco. En la plantilla, #b4b4b4.
  columnaPartido: '#ffffff',
  texto: '#000000',
  // La fecha, en el naranja del escudo del club: en la plantilla va en blanco sobre el gris, que en
  // la celda blanca no se vería.
  fecha: '#f7660f',
  textoCabecera: '#ffffff',
  letraCabecera: 14.7,
  letraEquipo: 13.7,
  letraPartido: 9.75,      // la del « VS », el 75 % de los nombres (21-10, Luismi: «más pequeño que los nombres»)
  letraNombres: 13,        // los nombres, un punto más (21-10, Luismi: «que hay hueco»)
  letraFecha: 11,          // un punto menos que los nombres (21-10, Luismi)
  interlineaPartido: 16.5,
  entrenador: '#5c5c5c',   // gris oscuro: se distingue del equipo (negro) sobre el gris claro
  letraEntrenador: 0.8,    // respecto a la del equipo
  parteEquipo: 0.36,       // ancho de la columna EQUIPO sobre el de la tabla (en la plantilla, la mitad)
  margen: 12,              // aire mínimo a cada lado del texto dentro de su celda
  letraMinima: 9,          // «LOCAL VS VISITANTE» baja hasta aquí en una línea; si ni así cabe, en dos (21-10)
  margenEscudo: 4,         // arriba y abajo del escudo: su caja es el alto de la fila menos esto (21-10)
  huecoEscudo: 6,          // entre el escudo y el texto
};
// `xm`, la línea entre EQUIPO y PARTIDO, sale de `parteEquipo` (en la plantilla estaba en la mitad).
const plantilla = (p) => ({ ...COMUN, ...p, xm: p.x0 + (p.x1 - p.x0) * COMUN.parteEquipo });
export const PLANTILLAS = {
  'la-mosca': plantilla({ fondo: 'fondo-la-mosca.webp', x0: 39.6, x1: 770.4, y0: 416 }),
  'valle-inclan': plantilla({ fondo: 'fondo-valle-inclan.webp', x0: 39.6, x1: 770.4, y0: 416 }),
};

// FONDOS POR PERIODO (26-10, Luismi: «para esta semana solamente, usa esta plantilla»): un periodo
// (jueves → miércoles) puede llevar otros fondos. La TABLA es la misma de siempre; solo cambian el
// fondo y, si su decoración sube más, el límite de la zona libre. Fondos con
// herramientas/fondos-carteles.py <pdf> <sufijo>.
export const FONDOS_POR_PERIODO = [
  // Halloween: murciélagos, bruja y calabazas desde y = 847,6 pt (a los lados y en el centro): la tabla
  // acaba como mucho en 842 (caben 7 filas a tamaño normal; con más se aprietan o se parten en dos).
  { desde: '2026-10-29', hasta: '2026-11-04', sufijo: 'halloween', limite: 842 },
];

/** La plantilla de un campo para el periodo que empieza el jueves `jueves` («AAAA-MM-DD»). */
export function plantillaDe(slug, jueves) {
  const t = PLANTILLAS[slug];
  const especial = jueves && FONDOS_POR_PERIODO.find((p) => jueves >= p.desde && jueves <= p.hasta);
  if (!especial) return t;
  return { ...t, fondo: t.fondo.replace(/.webp$/, `-${especial.sufijo}.webp`), limite: especial.limite ?? t.limite };
}

/** Qué filas van en cada imagen de un campo (ver repartirFilas en datos.mjs). */
export function maquetar(slug, n, jueves) {
  const t = plantillaDe(slug, jueves);
  return repartirFilas(n, { alto: t.limite - t.y0 - t.cabecera, fila: t.fila, minimo: t.minimo });
}

/**
 * La fuente, antes de pintar nada (con la letra sin cargar, el canvas usa otra), y los fondos:
 * `fondos` (los de siempre, por campo) y `fondo(slug, jueves)`, el del periodo, cargado una vez.
 */
export async function cargarRecursos(base = 'carteles/') {
  // La letra se registra aquí y no en un @font-face del CSS: así no depende de que la hoja esté ya
  // cargada (el lienzo no espera a nadie y pintaría con la de reserva).
  const letra = new FontFace('League Spartan', `url(${new URL('league-spartan-700-latin.woff2', new URL(base, document.baseURI)).href}) format('woff2')`, { weight: '700' });
  document.fonts.add(await letra.load());
  const fondos = {};
  await Promise.all(Object.entries(PLANTILLAS).map(async ([slug, t]) => {
    const img = new Image();
    img.src = base + t.fondo;
    await img.decode();
    fondos[slug] = img;
  }));
  const cache = new Map();
  const fondo = async (slug, jueves) => {
    const fichero = plantillaDe(slug, jueves).fondo;
    if (fichero === PLANTILLAS[slug].fondo) return fondos[slug];
    if (!cache.has(fichero)) {
      const img = new Image();
      img.src = base + fichero;
      cache.set(fichero, img.decode().then(() => img));
    }
    return cache.get(fichero);
  };
  return { fondos, fondo };
}

/**
 * Los escudos de unas filas (rutas de la web, «img/escudos/…»), cargados: ruta → imagen, o null si no
 * carga (entonces va el hueco). Se piden solo al pintar: en la web publicada, solo con ?carteles.
 */
const cacheEscudos = new Map();
export async function cargarEscudos(filas) {
  const rutas = [...new Set(filas.flatMap((f) => [f.local?.escudo, f.visitante?.escudo]).filter(Boolean))];
  await Promise.all(rutas.map((ruta) => {
    if (!cacheEscudos.has(ruta)) {
      const img = new Image();
      img.src = new URL(ruta, document.baseURI).href;
      // Recortado a su parte útil al cargarlo (normalizar-escudo.mjs): una vez por escudo.
      cacheEscudos.set(ruta, img.decode().then(() => normalizarEscudo(img), () => null));
    }
    return cacheEscudos.get(ruta);
  }));
  return new Map(await Promise.all(rutas.map(async (r) => [r, await cacheEscudos.get(r)])));
}

/**
 * Los nombres de la celda PARTIDO (21-10, Luismi: «ya puedo poner CB EL PALO vs EQUIPO VISITANTE en
 * una línea»): «LOCAL VS VISITANTE» en UNA línea, como en la plantilla, a su letra o, si no cabe,
 * más pequeña hasta `minima`. Solo si ni así cabe, en DOS partidas por « VS » («LOCAL» / «VS
 * VISITANTE»), con la letra que pida la más larga. Nunca se corta. Los nombres van a `letra` y el
 * « VS » a `letraVs` (un punto menos): cada línea es una lista de trozos { texto, letra } y, al
 * reducir, bajan todos en la misma proporción. Pura: `medir(texto, letra)` da el ancho (en el
 * navegador, measureText). Devuelve { lineas, letra } (`letra`: la de los nombres al final).
 */
/**
 * Los nombres del partido eligiendo entre nombre y SIGLAS (21-10, Luismi: «si no cabe, pon CBRV»): si
 * con los nombres la letra tendría que bajar de la suya, se prueba con las siglas de quien las tenga
 * y se queda la que deje la letra más grande. `local`/`visitante`: { nombre, siglas }.
 */
export function nombresPartido(local, visitante, opciones) {
  const conNombres = lineasPartido(local.nombre, visitante.nombre, opciones);
  if (conNombres.letra >= opciones.letra - 1e-9 || !(local.siglas || visitante.siglas)) return conNombres;
  const conSiglas = lineasPartido(local.siglas || local.nombre, visitante.siglas || visitante.nombre, opciones);
  return conSiglas.letra > conNombres.letra ? conSiglas : conNombres;
}

export function lineasPartido(local, visitante, { medir, ancho, letra, letraVs = letra, minima }) {
  const anchoDe = (linea) => linea.reduce((suma, t) => suma + medir(t.texto, t.letra), 0);
  const ajustar = (lineas) => {
    const mayor = Math.max(...lineas.map(anchoDe));
    const f = mayor > ancho ? ancho / mayor : 1;
    return { lineas: lineas.map((l) => l.map((t) => ({ ...t, letra: t.letra * f }))), letra: letra * f };
  };
  const una = ajustar([[{ texto: local, letra }, { texto: ' VS ', letra: letraVs }, { texto: visitante, letra }]]);
  return una.letra >= minima ? una : ajustar([[{ texto: local, letra }], [{ texto: 'VS ', letra: letraVs }, { texto: visitante, letra }]]);
}

/** Una línea de trozos con su propia letra, centrada en (cx, cy) y en la misma línea base. */
function trozosCentrados(ctx, trozos, { cx, cy, color }) {
  const anchos = trozos.map((t) => { ctx.font = `700 ${t.letra}px ${FUENTE}`; return ctx.measureText(t.texto).width; });
  ctx.font = `700 ${Math.max(...trozos.map((t) => t.letra))}px ${FUENTE}`;
  const base = cy + ctx.measureText('H').actualBoundingBoxAscent / 2;
  let x = cx - anchos.reduce((a, b) => a + b, 0) / 2;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  trozos.forEach((t, i) => {
    ctx.font = `700 ${t.letra}px ${FUENTE}`;
    ctx.fillText(t.texto, x, base);
    x += anchos[i];
  });
}

/**
 * Un escudo reducido a w×h píxeles del lienzo con buena calidad (21-10, Luismi: «los escudos salen
 * pixelados»). La FAB los da de 200 px de alto y el de El Palo es de 320 px; pintados de golpe a
 * unos 37 px, el navegador reduce casi 6 veces en un paso y salen dientes. Aquí se reduce POR MITADES
 * (cada paso con suavizado alto) hasta el tamaño final, nunca se agranda, y se guarda por tamaño.
 */
const reducidos = new WeakMap();
function reducido(img, w, h) {
  const porTamano = reducidos.get(img) ?? new Map();
  reducidos.set(img, porTamano);
  const clave = `${w}x${h}`;
  if (porTamano.has(clave)) return porTamano.get(clave);
  const lienzo = (ancho, alto, fuente) => {
    const c = document.createElement('canvas');
    c.width = ancho;
    c.height = alto;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(fuente, 0, 0, ancho, alto);
    return c;
  };
  let fuente = img;
  let [fw, fh] = [img.naturalWidth ?? img.width, img.naturalHeight ?? img.height];
  while (fw / 2 >= w && fh / 2 >= h) {
    [fw, fh] = [Math.round(fw / 2), Math.round(fh / 2)];
    fuente = lienzo(fw, fh, fuente);
  }
  const final = lienzo(w, h, fuente);
  porTamano.set(clave, final);
  return final;
}

/**
 * Escudo (ya recortado) en su caja cuadrada de lado `lado` (en puntos) centrada en (cx, cy), por ÁREA
 * (encaje(), normalizar-escudo.mjs) y nunca más grande que el original; sin imagen, nada (el hueco).
 * Se pinta en píxeles ENTEROS del lienzo, sin la escala de puntos a píxeles: así la imagen ya
 * reducida se copia tal cual, sin reescalar dos veces.
 */
function escudoEn(ctx, img, { cx, cy, lado }) {
  if (!img) return;
  const [iw, ih] = [img.naturalWidth ?? img.width, img.naturalHeight ?? img.height];
  const { ancho } = encaje({ w: iw, h: ih }, lado * ESCALA);
  const r = Math.min(ancho / iw, 1);
  const w = Math.max(1, Math.round(iw * r));
  const h = Math.max(1, Math.round(ih * r));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(reducido(img, w, h), Math.round(cx * ESCALA - w / 2), Math.round(cy * ESCALA - h / 2));
  ctx.restore();
}

/**
 * Una línea de varios trozos (texto, color y escala de letra propios) centrada en (cx, cy) y en la
 * misma línea base: «PROVINCIAL FEMENINO SERGIO RISOTO» con el entrenador en otro color. Si no cabe
 * en `ancho`, baja la letra de todos a la vez; nunca se corta.
 */
function enLinea(ctx, trozos, { cx, cy, ancho, letra }) {
  const hueco = 0.35;
  const medir = (l) => trozos.reduce((suma, tr) => { ctx.font = `700 ${l * tr.escala}px ${FUENTE}`; return suma + ctx.measureText(tr.texto).width; }, 0) + l * hueco * (trozos.length - 1);
  const final = medir(letra) > ancho ? letra * (ancho / medir(letra)) : letra;
  ctx.font = `700 ${final}px ${FUENTE}`;
  const base = cy + ctx.measureText('H').actualBoundingBoxAscent / 2;
  let x = cx - medir(final) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const tr of trozos) {
    ctx.font = `700 ${final * tr.escala}px ${FUENTE}`;
    ctx.fillStyle = tr.color;
    ctx.fillText(tr.texto, x, base);
    x += ctx.measureText(tr.texto).width + final * hueco;
  }
}

/** Texto centrado en (cx, cy) que nunca se sale de `ancho`: si no cabe, se reduce la letra. */
function centrado(ctx, texto, { cx, cy, ancho, letra, color }) {
  ctx.font = `700 ${letra}px ${FUENTE}`;
  const medido = ctx.measureText(texto).width;
  const final = medido > ancho ? letra * (ancho / medido) : letra;
  ctx.font = `700 ${final}px ${FUENTE}`;
  // Centrado por la altura de las mayúsculas, no por la caja de la fuente: así queda en el medio.
  const mayus = ctx.measureText('H').actualBoundingBoxAscent;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(texto, cx, cy + mayus / 2);
}

/**
 * Pinta un cartel en `canvas` (lo deja a 1080×1440). `filas`: las de esta imagen; `alto`: el alto de
 * fila que dio maquetar(); `parte`/`partes`: «1/2» en la cabecera cuando un campo va en varias.
 */
export function pintarCartel(canvas, { slug, filas, alto, parte = 1, partes = 1, fondo, escudos = new Map() }) {
  const t = PLANTILLAS[slug];
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
  ctx.drawImage(fondo, 0, 0, 810, 1080);

  const yFilas = t.y0 + t.cabecera;
  const yFin = yFilas + alto * filas.length;
  ctx.fillStyle = t.colorCabecera;
  ctx.fillRect(t.x0, t.y0, t.x1 - t.x0, t.cabecera);
  ctx.fillStyle = t.columnaEquipo;
  ctx.fillRect(t.x0, yFilas, t.xm - t.x0, yFin - yFilas);
  ctx.fillStyle = t.columnaPartido;
  ctx.fillRect(t.xm, yFilas, t.x1 - t.xm, yFin - yFilas);

  // Rejilla: el contorno, la línea entre columnas y una bajo la cabecera y bajo cada fila.
  ctx.strokeStyle = t.borde;
  ctx.lineWidth = t.grosor;
  ctx.beginPath();
  ctx.rect(t.x0, t.y0, t.x1 - t.x0, yFin - t.y0);
  ctx.moveTo(t.xm, t.y0);
  ctx.lineTo(t.xm, yFin);
  for (let i = 0; i < filas.length; i += 1) {
    ctx.moveTo(t.x0, yFilas + alto * i);
    ctx.lineTo(t.x1, yFilas + alto * i);
  }
  ctx.stroke();

  const anchoEquipo = t.xm - t.x0 - 2 * t.margen;
  const anchoPartido = t.x1 - t.xm - 2 * t.margen;
  const cxEquipo = (t.x0 + t.xm) / 2;
  const cxPartido = (t.xm + t.x1) / 2;
  const cyCabecera = t.y0 + t.cabecera / 2;
  centrado(ctx, 'EQUIPO', { cx: cxEquipo, cy: cyCabecera, ancho: anchoEquipo, letra: t.letraCabecera, color: t.textoCabecera });
  centrado(ctx, 'PARTIDO', { cx: cxPartido, cy: cyCabecera, ancho: anchoPartido, letra: t.letraCabecera, color: t.textoCabecera });
  if (partes > 1) {
    ctx.font = `700 ${t.letraCabecera}px ${FUENTE}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = t.textoCabecera;
    ctx.fillText(`${parte}/${partes}`, t.x1 - t.margen, cyCabecera + ctx.measureText('H').actualBoundingBoxAscent / 2);
  }

  // Con las filas apretadas, la letra baja con ellas (hasta un 91 % en el alto mínimo).
  const k = Math.min(1, alto / 46);
  filas.forEach((f, i) => {
    const cy = yFilas + alto * i + alto / 2;
    // EQUIPO: el equipo y, debajo, su entrenador más pequeño y en morado claro. En un derbi (dos
    // equipos del club, local arriba) no caben cuatro líneas legibles: cada equipo va en una, con su
    // entrenador detrás en el mismo morado claro.
    const pasoEquipo = Math.min(t.letraEquipo * k * 1.18, (alto - 6) / 2);
    const trozos = (e) => [{ texto: e.nombre, color: t.texto, escala: 1 }, ...(e.entrenador ? [{ texto: e.entrenador, color: t.entrenador, escala: t.letraEntrenador }] : [])];
    const lineasEquipo = f.equipo.length > 1 ? f.equipo.map(trozos) : trozos(f.equipo[0]).map((tr) => [tr]);
    lineasEquipo.forEach((linea, j) => {
      const letra = Math.min(t.letraEquipo * k * (f.equipo.length > 1 ? 0.85 : 1), pasoEquipo / 1.1);
      enLinea(ctx, linea, { cx: cxEquipo, cy: cy + (j - (lineasEquipo.length - 1) / 2) * pasoEquipo, ancho: anchoEquipo, letra });
    });
    // PARTIDO: escudo del local a la izquierda y del visitante a la derecha (el orden del texto); en
    // medio, «LOCAL VS VISITANTE» (o en dos líneas si no cabe) y la fecha debajo, centrados en la fila.
    // La caja del escudo: todo el alto de la fila menos un margen (baja con las filas apretadas).
    const lado = alto - 2 * t.margenEscudo;
    const anchoTexto = anchoPartido - 2 * (lado + t.huecoEscudo);
    escudoEn(ctx, escudos.get(f.local?.escudo), { cx: t.xm + t.margen + lado / 2, cy, lado });
    escudoEn(ctx, escudos.get(f.visitante?.escudo), { cx: t.x1 - t.margen - lado / 2, cy, lado });
    const medir = (texto, letra) => { ctx.font = `700 ${letra}px ${FUENTE}`; return ctx.measureText(texto).width; };
    const nombres = nombresPartido(f.local, f.visitante, { medir, ancho: anchoTexto, letra: t.letraNombres * k, letraVs: t.letraPartido * k, minima: t.letraMinima });
    const total = nombres.lineas.length + 1;
    const pasoPartido = Math.min(t.interlineaPartido * k, (alto - 8) / total);
    // Si la fila no da para la letra, todo baja en la misma proporción.
    const tope = Math.min(1, pasoPartido / 1.15 / nombres.letra);
    nombres.lineas.forEach((linea, j) => {
      trozosCentrados(ctx, linea.map((tr) => ({ ...tr, letra: tr.letra * tope })), { cx: cxPartido, cy: cy + (j - (total - 1) / 2) * pasoPartido, color: t.texto });
    });
    centrado(ctx, f.cuando, { cx: cxPartido, cy: cy + ((total - 1) / 2) * pasoPartido, ancho: anchoTexto, letra: Math.min(t.letraFecha * k, pasoPartido / 1.15), color: t.fecha });
  });
}
