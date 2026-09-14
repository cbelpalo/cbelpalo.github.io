// HISTORIAS DE INSTAGRAM (25-11) — la lógica sin navegador: separar las crónicas pegadas, elegir
// plantilla, ajustar el texto al bocadillo, encuadrar la foto y empaquetar el ZIP. El pintado está en
// pintar.mjs y la ventana en cliente.mjs. Probado en tests/historias.test.mjs.
//
// El encargo: al CM le llegan cada semana decenas de crónicas de ~20 palabras (por WhatsApp) y las
// monta a mano en la plantilla de Canva «JORNADA DE PARTIDO» (foto en medio, texto en el bocadillo).
// Aquí las pega todas de golpe, elige las fotos y sale una historia 1080×1920 por crónica.

/** Las dos páginas de la plantilla (herramientas/plantillas-historias.py). */
export const PLANTILLAS = [
  { slug: 'cantera', nombre: 'Cantera', fondo: 'plantilla-cantera.webp' },
  { slug: 'sub22-senior', nombre: 'Sub 22 / Sénior', fondo: 'plantilla-sub22-senior.webp' },
];

// Medido en píxeles sobre la plantilla y sobre una historia real del CM (la de las preinfantiles):
// la foto ocupa todo el ancho entre «CANTERA» y los logos; el texto, centrado en el bocadillo, entre
// las comillas verdes (acaban en y=1464) y el borde de abajo (blanco hasta y=1647). Color del texto:
// el gris azulado de la historia del CM, que es el --tinta-suave de la web.
export const GEOMETRIA = {
  ancho: 1080,
  alto: 1920,
  foto: { x: 0, y: 450, w: 1080, h: 710 },
  // Ancho: la historia del CM llega a 937 px; 920 es lo que deja el borde redondeado a la altura de la
  // última línea (y≈1620: blanco de x=74 a x=1005).
  texto: { cx: 540, cy: 1555, ancho: 920, alto: 168 },
  letraMax: 46, // la de la historia del CM, con 3 líneas
  letraMin: 30, // por debajo ya no se lee bien en el móvil: la fila sugiere acortarla
  letraForzada: 22, // pero se baja hasta aquí antes que dejar que se salga del bocadillo
  interlinea: 1.18,
  lineasMax: 4,
  color: '#46546a',
  fuente: 'Questrial',
};

/** A partir de aquí la crónica es «larga»: cabe, pero con letra más pequeña. */
export const PALABRAS_LARGA = 30;

// Lo que WhatsApp antepone al copiar varios mensajes: «[14:03, 24/11/2026] Nombre: ».
const PREFIJO_WHATSAPP = /^\s*\[\d{1,2}:\d{2}(?::\d{2})?,? \d{1,2}\/\d{1,2}\/\d{2,4}\]\s*[^:]{1,60}:\s*/;
const COMILLAS = /^[\s"“”«»'‘’]+|[\s"“”«»'‘’]+$/g;

/** Limpia una crónica: sin prefijo de WhatsApp, sin comillas alrededor, espacios simples. */
export function limpiarCronica(texto) {
  return String(texto)
    .split(/\r?\n/)
    .map((l) => l.replace(PREFIJO_WHATSAPP, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(COMILLAS, '')
    .trim();
}

/**
 * Las crónicas de un texto pegado: separadas por una línea en blanco. Si no hay ninguna línea en blanco
 * pero cada línea lleva el prefijo de WhatsApp, cada mensaje es una crónica (así se pegan del chat).
 */
export function separarCronicas(texto) {
  const lineas = String(texto ?? '').split(/\r?\n/);
  const conPrefijo = lineas.filter((l) => PREFIJO_WHATSAPP.test(l)).length;
  let bloques;
  if (conPrefijo >= 2) {
    bloques = [];
    for (const l of lineas) {
      if (PREFIJO_WHATSAPP.test(l) || !bloques.length) bloques.push([l]);
      else bloques.at(-1).push(l);
    }
    bloques = bloques.map((b) => b.join('\n'));
  } else {
    bloques = String(texto ?? '').split(/\r?\n\s*\r?\n/);
  }
  return bloques.map(limpiarCronica).filter(Boolean);
}

export const contarPalabras = (texto) => (String(texto).match(/\S+/g) ?? []).length;

/** Plantilla según la crónica: sénior, sub 22 y N1 van en la suya; lo demás es cantera. */
export function plantillaPorTexto(texto) {
  return /\bs[eé]nior\b|\bsub[ -]?22\b|\bu22\b|\bn1\b|\bnacional\b/i.test(texto) ? 'sub22-senior' : 'cantera';
}

/** Reparto voraz en líneas de como mucho `ancho` (una palabra más larga va sola en su línea). */
export function partirLineas(texto, medir, ancho) {
  const lineas = [];
  let actual = '';
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || medir(prueba) <= ancho) actual = prueba;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// FORMATO (25-11, Luismi: «seleccionar el color y formateo básico como negrita y cursiva»): la crónica
// es una lista de TROZOS { texto, negrita, cursiva, color } (color null = el de la plantilla). Para
// repartirla en líneas se parte en PALABRAS, y cada palabra es la lista de sus trozos (una palabra puede
// llevar media en negrita).

/** Las palabras de unos trozos: [[{ texto, negrita, cursiva, color }]], sin los espacios. */
export function palabrasDe(trozos) {
  const palabras = [];
  let actual = [];
  for (const t of trozos) {
    for (const parte of String(t.texto ?? '').split(/(\s+)/)) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) {
        if (actual.length) palabras.push(actual);
        actual = [];
      } else actual.push({ negrita: false, cursiva: false, color: null, ...t, texto: parte });
    }
  }
  if (actual.length) palabras.push(actual);
  return palabras;
}

/** Reparto voraz de palabras en líneas de como mucho `ancho`; `anchoDe(palabra)`, `espacio` en px. */
function partirPalabras(palabras, anchoDe, espacio, ancho) {
  const lineas = [];
  let actual = [];
  let medida = 0;
  for (const p of palabras) {
    const a = anchoDe(p);
    if (actual.length && medida + espacio + a > ancho) {
      lineas.push(actual);
      actual = [];
      medida = 0;
    }
    medida += (actual.length ? espacio : 0) + a;
    actual.push(p);
  }
  if (actual.length) lineas.push(actual);
  return lineas;
}

/**
 * El tamaño de letra y las líneas de una crónica con formato: el mayor tamaño (de letraMax a letraMin)
 * con el que cabe en lineasMax líneas dentro del alto del bocadillo; después se equilibran las líneas
 * (el ancho más estrecho que da el mismo número de líneas, para no dejar una palabra sola al final).
 * Si ni a letraMin cabe, la letra sigue bajando hasta letraForzada para que NUNCA se salga del
 * bocadillo, y `cabe` es false (la fila sugiere acortarla).
 * `medirCon(tam)` → (texto, trozo) → ancho en px con esa letra y ese estilo.
 * → { tam, lineas: [[palabra]], cabe, alto }.
 */
export function ajustarRico(trozos, medirCon, g = GEOMETRIA) {
  const t = g.texto;
  const palabras = palabrasDe(trozos);
  const intento = (tam) => {
    const medir = medirCon(tam);
    const anchoDe = (p) => p.reduce((s, x) => s + medir(x.texto, x), 0);
    const espacio = medir(' ', { negrita: false, cursiva: false });
    const lineas = partirPalabras(palabras, anchoDe, espacio, t.ancho);
    const alto = lineas.length * tam * g.interlinea;
    // Con letra legible, como mucho lineasMax líneas; por debajo (forzada), las que quepan en el alto.
    const maxLineas = tam >= g.letraMin ? g.lineasMax : Math.floor(t.alto / (tam * g.interlinea));
    return { lineas, alto, anchoDe, espacio, cabeAqui: lineas.length <= maxLineas && alto <= t.alto };
  };
  for (let tam = g.letraMax; tam >= g.letraForzada; tam -= 1) {
    const r = intento(tam);
    if (r.cabeAqui) {
      const lineas = equilibrar(palabras, r.anchoDe, r.espacio, t.ancho, r.lineas.length);
      return { tam, lineas, cabe: tam >= g.letraMin, alto: r.alto };
    }
  }
  const r = intento(g.letraForzada);
  return { tam: g.letraForzada, lineas: r.lineas, cabe: false, alto: r.alto };
}

function equilibrar(palabras, anchoDe, espacio, ancho, n) {
  if (n < 2) return partirPalabras(palabras, anchoDe, espacio, ancho);
  let lo = ancho * 0.5;
  let hi = ancho;
  for (let i = 0; i < 12; i += 1) {
    const mitad = (lo + hi) / 2;
    if (partirPalabras(palabras, anchoDe, espacio, mitad).length <= n) hi = mitad;
    else lo = mitad;
  }
  return partirPalabras(palabras, anchoDe, espacio, hi);
}

/** El texto de una línea de ajustarRico, como cadena. */
export const textoDeLinea = (linea) => linea.map((p) => p.map((x) => x.texto).join('')).join(' ');

/**
 * Lo mismo para texto sin formato (un solo trozo). `medirCon(tam)` → texto → ancho.
 * → { tam, lineas: [cadena], cabe, alto }.
 */
export function ajustarTexto(texto, medirCon, g = GEOMETRIA) {
  const r = ajustarRico([{ texto }], (tam) => { const m = medirCon(tam); return (s) => m(s); }, g);
  return { ...r, lineas: r.lineas.map(textoDeLinea) };
}

/**
 * El trozo de la foto que llena la caja (como object-fit: cover) con un zoom (≥ 1) y un centro
 * (cx, cy entre 0 y 1, sobre la foto). El centro se acota para que nunca asome el fondo.
 * → { sx, sy, sw, sh, cx, cy } (el centro ya acotado).
 */
export function encuadre(foto, caja, { zoom = 1, cx = 0.5, cy = 0.5 } = {}) {
  const escala = Math.max(caja.w / foto.w, caja.h / foto.h) * Math.max(1, zoom);
  const sw = caja.w / escala;
  const sh = caja.h / escala;
  const acotar = (c, visible, total) => {
    const medio = visible / 2 / total;
    return Math.min(1 - medio, Math.max(medio, c));
  };
  const x = acotar(cx, sw, foto.w);
  const y = acotar(cy, sh, foto.h);
  return { sx: x * foto.w - sw / 2, sy: y * foto.h - sh / 2, sw, sh, cx: x, cy: y, escala };
}

/**
 * Nombre de la imagen: fecha, número de orden y plantilla, para que el ZIP salga en el orden pegado.
 * JPEG y no PNG: con una foto dentro pesa ~5 veces menos, e Instagram la recomprime igual.
 */
export const nombreFichero = (fecha, n, slug) => `historia-${fecha}-${String(n).padStart(2, '0')}-${slug}.jpg`;

// ZIP sin comprimir (método «stored»): los PNG ya van comprimidos, así que no ganaríamos nada y no
// hace falta librería. Formato: cabecera local + datos por fichero, directorio central y su final.
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos) {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i += 1) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** [{ nombre, datos: Uint8Array }] → Uint8Array con el ZIP. Nombres en UTF-8 (bit 11). */
export function crearZip(ficheros, fecha = new Date()) {
  const cod = new TextEncoder();
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1);
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  const partes = [];
  const central = [];
  let desplazamiento = 0;
  for (const f of ficheros) {
    const nombre = cod.encode(f.nombre);
    const crc = crc32(f.datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.datos.length, true);
    local.setUint32(22, f.datos.length, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nombre, f.datos);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.datos.length, true);
    c.setUint32(24, f.datos.length, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(c.buffer), nombre);
    desplazamiento += 30 + nombre.length + f.datos.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, ficheros.length, true);
  fin.setUint16(10, ficheros.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of todo) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}
