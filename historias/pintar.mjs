// HISTORIAS DE INSTAGRAM (25-11) — pintado con Canvas 2D, sin librerías: la plantilla de Canva de
// fondo, la foto encuadrada en su franja y la crónica en el bocadillo. Todo en px de la historia
// (1080×1920); `escala` < 1 pinta la vista previa más pequeña (decenas de historias a 1080×1920 en
// memoria serían cientos de MB) y la exportación va siempre a escala 1.
//
// La crónica lleva formato (negrita, cursiva, color): `h.trozos` = [{ texto, negrita, cursiva, color }]
// (pagina.mjs lo saca del editor). Questrial solo tiene peso 400: la negrita y la cursiva las sintetiza
// el navegador, igual que en el editor.
import { GEOMETRIA as G, PLANTILLAS, ajustarRico, encuadre } from './datos.mjs';

const letra = (tam, t = {}) => `${t.cursiva ? 'italic ' : ''}${t.negrita ? 700 : 400} ${tam}px "${G.fuente}", sans-serif`;

/** Letra y plantillas, una sola vez. → { fondos: slug → imagen }. */
export async function cargarRecursos(base) {
  // La letra se registra aquí y no en el CSS: el lienzo no espera a nadie y pintaría con la de reserva.
  const fuente = new FontFace(G.fuente, `url(${new URL('questrial-latin.woff2', base).href}) format('woff2')`, { weight: '400' });
  document.fonts.add(await fuente.load());
  const fondos = {};
  await Promise.all(PLANTILLAS.map(async (p) => {
    const img = new Image();
    img.src = new URL(p.fondo, base).href;
    await img.decode();
    fondos[p.slug] = img;
  }));
  return { fondos };
}

/**
 * Una foto del móvil, ya girada según su EXIF y reducida a 2160 px de lado mayor como mucho (la
 * historia mide 1080 de ancho: el doble deja margen para el zoom sin guardar 12 megapíxeles por foto).
 */
export async function cargarFoto(fichero) {
  const original = await createImageBitmap(fichero, { imageOrientation: 'from-image' });
  const lado = Math.max(original.width, original.height);
  if (lado <= 2160) return original;
  const f = 2160 / lado;
  const reducida = await createImageBitmap(original, {
    resizeWidth: Math.round(original.width * f), resizeHeight: Math.round(original.height * f), resizeQuality: 'high',
  });
  original.close();
  return reducida;
}

/** Medidor para ajustarRico sobre el contexto dado: tam → (texto, trozo) → ancho. */
const medidor = (ctx) => (tam) => (s, t) => {
  ctx.font = letra(tam, t);
  return ctx.measureText(s).width;
};

const trozosDe = (h) => (h.trozos?.length ? h.trozos : [{ texto: h.texto ?? '' }]);

/**
 * Pinta una historia en `canvas` (le pone el tamaño). `h`: { plantilla, trozos (o texto), foto
 * (ImageBitmap o null), encuadre: { zoom, cx, cy } }. Devuelve el ajuste del texto ({ tam, lineas,
 * cabe }) y el encuadre acotado, para que la fila avise si no cabe y guarde el centro de verdad.
 */
export function pintarHistoria(canvas, h, recursos, escala = 1) {
  canvas.width = Math.round(G.ancho * escala);
  canvas.height = Math.round(G.alto * escala);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(recursos.fondos[h.plantilla], 0, 0, G.ancho, G.alto);

  const f = G.foto;
  let encaje = null;
  if (h.foto) {
    encaje = encuadre({ w: h.foto.width, h: h.foto.height }, f, h.encuadre);
    ctx.drawImage(h.foto, encaje.sx, encaje.sy, encaje.sw, encaje.sh, f.x, f.y, f.w, f.h);
  }

  // La crónica, línea a línea y trozo a trozo, centrada en el bocadillo.
  const medir = medidor(ctx);
  const ajuste = ajustarRico(trozosDe(h), medir);
  const m = medir(ajuste.tam);
  const espacio = m(' ', {});
  const paso = ajuste.tam * G.interlinea;
  const primera = G.texto.cy - (paso * (ajuste.lineas.length - 1)) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ajuste.lineas.forEach((linea, i) => {
    const anchos = linea.map((p) => p.map((x) => m(x.texto, x)));
    const total = anchos.reduce((s, a) => s + a.reduce((u, v) => u + v, 0), 0) + espacio * (linea.length - 1);
    let x = G.texto.cx - total / 2;
    const y = primera + i * paso;
    linea.forEach((palabra, j) => {
      palabra.forEach((t, k) => {
        ctx.font = letra(ajuste.tam, t);
        ctx.fillStyle = t.color || G.color;
        ctx.fillText(t.texto, x, y);
        x += anchos[j][k];
      });
      x += espacio;
    });
  });
  return { ajuste, encaje };
}

/**
 * La miniatura de la fila: la foto tal como queda en la historia (su franja, con zoom y encuadre), para
 * que la lista refleje lo que se ha ajustado en la vista previa.
 */
export function pintarMiniatura(canvas, h) {
  const f = G.foto;
  const ancho = 320;
  canvas.width = ancho;
  canvas.height = Math.round((ancho * f.h) / f.w);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (!h.foto) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const e = encuadre({ w: h.foto.width, h: h.foto.height }, f, h.encuadre);
  ctx.drawImage(h.foto, e.sx, e.sy, e.sw, e.sh, 0, 0, canvas.width, canvas.height);
}

/** El ajuste del texto sin pintar nada (para avisar en la fila si no cabe). */
let contextoMedidas = null;
export function ajusteDe(h) {
  contextoMedidas ??= document.createElement('canvas').getContext('2d');
  return ajustarRico(trozosDe(h), medidor(contextoMedidas));
}
