// ESCUDOS DEL CARTEL normalizados (21-10, Luismi: «hazlos lo más grande posible»; «hay escudos muy
// verticales y mal recortados, o muy apaisados»). Se hace en el NAVEGADOR al pintar (canvas y
// getImageData), no en el build: los escudos ya están en la web, son pocos por cartel y así no hay
// una segunda copia que mantener al día. Lo de aquí es puro (recibe los píxeles) y lo prueban los
// tests con imágenes de mentira; normalizarEscudo() es la parte del navegador.
//
// Dos pasos:
//   1. Recortar el margen vacío: filas y columnas del borde que son FONDO (transparente, o blanco o
//      casi blanco). Solo si el borde ENTERO de la imagen es fondo: un escudo que toca el borde con
//      su propio color (o uno blanco con su contorno en el borde) se deja como viene.
//   2. Encajarlo en la caja cuadrada por ÁREA y no por el lado mayor: todos ocupan más o menos la
//      misma superficie, así que uno apaisado (Basket Norte, El Palo) no se queda diminuto ni uno
//      muy vertical (San Estanislao) ocupa más que nadie. Sin salirse nunca de la caja.

const ALFA_VACIO = 16;   // por debajo, el píxel cuenta como transparente
const TOLERANCIA = 45;   // blanco «casi blanco»: los tres canales por encima de 255 - esto (los JPG de la FAB
                         // traen el blanco del borde sucio: el de MBK baja a 214)
const OCUPACION = 0.86;  // un escudo cuadrado llena este lado de la caja; los demás, la misma área

const esFondo = (d, i) => d[i + 3] < ALFA_VACIO || (d[i] >= 255 - TOLERANCIA && d[i + 1] >= 255 - TOLERANCIA && d[i + 2] >= 255 - TOLERANCIA);

/**
 * El rectángulo útil de una imagen { width, height, data } (data RGBA, como el de getImageData):
 * { x, y, w, h, recortado }. Si el borde no es fondo de punta a punta, la imagen entera.
 */
export function recorteUtil({ width, height, data }) {
  const fondoEn = (x, y) => esFondo(data, (y * width + x) * 4);
  const entera = { x: 0, y: 0, w: width, h: height, recortado: false };
  for (let x = 0; x < width; x += 1) if (!fondoEn(x, 0) || !fondoEn(x, height - 1)) return entera;
  for (let y = 0; y < height; y += 1) if (!fondoEn(0, y) || !fondoEn(width - 1, y)) return entera;
  const filaVacia = (y) => { for (let x = 0; x < width; x += 1) if (!fondoEn(x, y)) return false; return true; };
  const columnaVacia = (x, y0, y1) => { for (let y = y0; y <= y1; y += 1) if (!fondoEn(x, y)) return false; return true; };
  let arriba = 0;
  while (arriba < height && filaVacia(arriba)) arriba += 1;
  if (arriba === height) return entera; // todo fondo: un escudo blanco entero, se deja
  let abajo = height - 1;
  while (filaVacia(abajo)) abajo -= 1;
  let izquierda = 0;
  while (columnaVacia(izquierda, arriba, abajo)) izquierda += 1;
  let derecha = width - 1;
  while (columnaVacia(derecha, arriba, abajo)) derecha -= 1;
  return { x: izquierda, y: arriba, w: derecha - izquierda + 1, h: abajo - arriba + 1, recortado: true };
}

/**
 * El tamaño (en las mismas unidades que `caja`) de un contenido de w×h dentro de una caja cuadrada:
 * la misma ÁREA que un cuadrado de OCUPACION·caja de lado, limitada por la caja en ancho y en alto.
 */
export function encaje({ w, h }, caja) {
  const porArea = (OCUPACION * caja) / Math.sqrt(w * h);
  const s = Math.min(porArea, caja / w, caja / h);
  return { ancho: w * s, alto: h * s };
}

/** En el navegador: el escudo recortado a su parte útil, en un canvas (o la imagen, si no hay que recortar). */
export function normalizarEscudo(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const r = recorteUtil(ctx.getImageData(0, 0, c.width, c.height));
  if (!r.recortado) return img;
  const recorte = document.createElement('canvas');
  recorte.width = r.w;
  recorte.height = r.h;
  recorte.getContext('2d').drawImage(c, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return recorte;
}
