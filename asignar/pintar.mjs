// El cartel del cuadrante (27-11): la imagen «Partidos del finde» con las pistas de un día, como la de
// Coordinación Deportiva. 1080 px de ancho y el alto que pidan las filas. Letra: League Spartan (la de
// los carteles) para títulos y nombres, Asap (la de la web) para lo demás.
import { horaCorta } from './datos.mjs';

export const ANCHO = 1080;
const C = {
  azul: '#082654', naranja: '#e65d1e', gris: '#eceef1', regla: '#c9ced8', suave: '#6b7486',
  debajo: '#c3cde0', blanco: '#ffffff',
};
const M = 52; // margen lateral
const HORA = 112; // columna de la hora
const HUECO = 10;
const ALTO_FILA = 104;
const ALTO_CABEZA_PISTA = 52;
const RADIO = 12;
const TITULOS = "'League Spartan', 'Arial Black', sans-serif";
const TEXTO = "'Asap', system-ui, sans-serif";

/** Letras y escudo, cargados una vez. `raiz`: la URL de la web (donde están img/, fuentes/ y carteles/). */
export async function cargarRecursos(raiz) {
  const url = (f) => new URL(f, raiz).href;
  const letras = [
    new FontFace('League Spartan', `url(${url('carteles/league-spartan-700-latin.woff2')}) format('woff2')`, { weight: '700' }),
    new FontFace('Asap', `url(${url('fuentes/asap-latin.woff2')}) format('woff2')`, { weight: '100 900' }),
  ];
  for (const l of letras) document.fonts.add(await l.load());
  const escudo = new Image();
  escudo.src = url('img/escudo-320.png');
  await escudo.decode().catch(() => {});
  return { escudo: escudo.naturalWidth ? escudo : null };
}

const caja = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

/** Escribe `texto` en una línea dentro de `ancho`, bajando la letra hasta `minima` y, si no, con «…». */
function linea(ctx, texto, x, y, ancho, { letra, peso, familia, minima = Math.round(letra * 0.6), alinear = 'left' }) {
  let t = letra;
  const fuente = (n) => `${peso} ${n}px ${familia}`;
  ctx.font = fuente(t);
  while (t > minima && ctx.measureText(texto).width > ancho) { t -= 1; ctx.font = fuente(t); }
  let s = texto;
  if (ctx.measureText(s).width > ancho) {
    while (s.length > 1 && ctx.measureText(`${s}…`).width > ancho) s = s.slice(0, -1);
    s = `${s.trimEnd()}…`;
  }
  ctx.textAlign = alinear;
  ctx.fillText(s, x, y);
}

function espaciado(ctx, valor) { if ('letterSpacing' in ctx) ctx.letterSpacing = valor; }

/** El alto del cartel para unas zonas y una nota. */
const ALTO_NOTA_PIE = 30;
const ALTO_TITULO_COMPLETA = ALTO_CABEZA_PISTA + HUECO;
const ANCHO_HUECO = 46; // la Pista 2 de La Mosca (banquillos)
export function altoCartel(zonas, nota, notas = []) {
  let y = 250;
  for (const z of zonas) {
    y += 70 + ALTO_CABEZA_PISTA + HUECO + z.filas.length * (ALTO_FILA + HUECO) + 24;
    if (!z.filas.length) y -= ALTO_CABEZA_PISTA + HUECO;
    if (z.completas?.length) y += ALTO_TITULO_COMPLETA + z.completas.length * (ALTO_FILA + HUECO);
  }
  if (notas.length) y += notas.length * ALTO_NOTA_PIE + 12;
  if (nota) y += 112;
  return y + 90;
}

/**
 * Pinta el cartel. `datos`: { titulo, subtitulo, pie, zonas y notas (tablaDelCartel), nota: {titulo, texto}|null }.
 */
export function pintarCartel(canvas, datos, recursos, escala = 1) {
  // Sin asteriscos ni notas en la imagen (27-11, Luismi: «si genero la imagen es que está todo OK»): solo en la web.
  const notas = [];
  const alto = altoCartel(datos.zonas, datos.nota, notas);
  canvas.width = Math.round(ANCHO * escala);
  canvas.height = Math.round(alto * escala);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.fillStyle = C.blanco;
  ctx.fillRect(0, 0, ANCHO, alto);
  ctx.textBaseline = 'alphabetic';

  // Cabeza: escudo, título, día y campo, y quién lo firma.
  // El escudo con su proporción (27-11, Luismi: «se ve aplastado»), dentro de 132×132.
  if (recursos?.escudo) {
    const { naturalWidth: w, naturalHeight: h } = recursos.escudo;
    const k = 132 / Math.max(w, h);
    ctx.drawImage(recursos.escudo, M - 6 + (132 - w * k) / 2, 44 + (132 - h * k) / 2, w * k, h * k);
  }
  const xt = M + 150;
  const anchoT = ANCHO - M - xt;
  ctx.fillStyle = C.azul;
  linea(ctx, datos.titulo, xt, 108, anchoT, { letra: 66, peso: 700, familia: TITULOS });
  ctx.fillStyle = C.naranja;
  linea(ctx, datos.subtitulo, xt, 152, anchoT, { letra: 30, peso: 700, familia: TEXTO });
  ctx.fillStyle = C.suave;
  linea(ctx, datos.pie, xt, 190, anchoT, { letra: 22, peso: 400, familia: TEXTO });
  ctx.fillStyle = C.naranja;
  ctx.fillRect(M, 214, ANCHO - 2 * M, 4);

  let y = 250;
  for (const z of datos.zonas) {
    // Nombre de la zona en una pastilla.
    ctx.font = `700 26px ${TITULOS}`;
    espaciado(ctx, '2px');
    const w = ctx.measureText(z.nombre.toUpperCase()).width + 36;
    ctx.fillStyle = C.azul;
    caja(ctx, M, y, w, 46, 8);
    ctx.fill();
    ctx.fillStyle = C.blanco;
    ctx.textAlign = 'left';
    ctx.fillText(z.nombre.toUpperCase(), M + 18, y + 32);
    y += 70;

    // Columnas: las pistas y, en La Mosca, el hueco estrecho de la Pista 2 (no se juega: rayado).
    const columnas = z.columnas ?? z.pistas.map((nombre) => ({ tipo: 'pista', nombre }));
    const nPistas = columnas.filter((c) => c.tipo === 'pista').length;
    const nHuecos = columnas.length - nPistas;
    const xCol = M + HORA + HUECO;
    const anchoCol = (ANCHO - M - xCol - HUECO * (columnas.length - 1) - nHuecos * ANCHO_HUECO) / nPistas;
    const xs = [];
    let xx = xCol;
    for (const c of columnas) { xs.push({ x: xx, w: c.tipo === 'hueco' ? ANCHO_HUECO : anchoCol }); xx += xs.at(-1).w + HUECO; }
    const xFin = xs.at(-1).x + xs.at(-1).w;
    if (z.filas.length) {
      columnas.forEach((p, i) => {
        const { x, w } = xs[i];
        ctx.fillStyle = p.tipo === 'hueco' ? C.debajo : C.naranja;
        caja(ctx, x, y, w, ALTO_CABEZA_PISTA, 10);
        ctx.fill();
        ctx.fillStyle = p.tipo === 'hueco' ? C.azul : C.blanco;
        espaciado(ctx, '1px');
        linea(ctx, p.tipo === 'hueco' ? 'P2' : p.nombre.toUpperCase(), x + w / 2, y + 34, w - 12, { letra: 21, peso: 700, familia: TEXTO, alinear: 'center', minima: 12 });
      });
      espaciado(ctx, '0px');
      y += ALTO_CABEZA_PISTA + HUECO;
    }

    const hora = (h) => {
      ctx.fillStyle = C.gris;
      caja(ctx, M, y, HORA, ALTO_FILA, RADIO);
      ctx.fill();
      ctx.fillStyle = C.azul;
      linea(ctx, horaCorta(h), M + HORA / 2, y + ALTO_FILA / 2 + 12, HORA - 16, { letra: 34, peso: 700, familia: TITULOS, alinear: 'center' });
    };
    for (const f of z.filas) {
      hora(f.hora);
      columnas.forEach((c, i) => (c.tipo === 'hueco' ? pintarHueco(ctx, xs[i].x, y, xs[i].w) : pintarFicha(ctx, f.fichas[i], xs[i].x, y, xs[i].w, f.horas ? f.hora : null)));
      y += ALTO_FILA + HUECO;
    }
    // A pista completa: aparte, debajo (27-11, Luismi), con la ficha a todo lo ancho.
    if (z.completas?.length) {
      // Cabecera naranja como la de las pistas, a todo el ancho (27-11, Luismi: sin «a lo largo»).
      ctx.fillStyle = C.naranja;
      caja(ctx, xCol, y, xFin - xCol, ALTO_CABEZA_PISTA, 10);
      ctx.fill();
      ctx.fillStyle = C.blanco;
      espaciado(ctx, '1px');
      linea(ctx, (z.nombreCompleta ?? 'Pista completa').toUpperCase(), (xCol + xFin) / 2, y + 34, xFin - xCol - 20, { letra: 21, peso: 700, familia: TEXTO, alinear: 'center' });
      espaciado(ctx, '0px');
      y += ALTO_TITULO_COMPLETA;
      for (const c of z.completas) {
        hora(c.hora);
        pintarFicha(ctx, c.ficha, xCol, y, xFin - xCol);
        y += ALTO_FILA + HUECO;
      }
    }
    y += 24;
  }

  // Las notas del asterisco: lo que la FAB dice y por qué va en otra pista.
  if (notas.length) {
    ctx.fillStyle = C.suave;
    notas.forEach((t, i) => linea(ctx, t, M, y + 20 + i * ALTO_NOTA_PIE, ANCHO - 2 * M, { letra: 20, peso: 400, familia: TEXTO, minima: 15 }));
    y += notas.length * ALTO_NOTA_PIE + 12;
  }

  if (datos.nota) {
    ctx.fillStyle = C.gris;
    caja(ctx, M, y, ANCHO - 2 * M, 92, RADIO);
    ctx.fill();
    ctx.fillStyle = C.naranja;
    caja(ctx, M, y, 6, 92, [RADIO, 0, 0, RADIO]);
    ctx.fill();
    espaciado(ctx, '1px');
    linea(ctx, datos.nota.titulo.toUpperCase(), M + 28, y + 36, ANCHO - 2 * M - 56, { letra: 20, peso: 700, familia: TEXTO });
    espaciado(ctx, '0px');
    ctx.fillStyle = C.azul;
    linea(ctx, datos.nota.texto, M + 28, y + 70, ANCHO - 2 * M - 56, { letra: 24, peso: 500, familia: TEXTO });
    y += 112;
  }

  // Leyenda y despedida.
  y += 36;
  let xl = M;
  const muestra = (tipo, texto) => {
    if (tipo === 'partido') { ctx.fillStyle = C.azul; caja(ctx, xl, y - 18, 22, 22, 4); ctx.fill(); }
    if (tipo === 'entreno') { ctx.strokeStyle = C.naranja; ctx.lineWidth = 3; caja(ctx, xl + 1.5, y - 16.5, 19, 19, 4); ctx.stroke(); }
    if (tipo === 'libre') { ctx.strokeStyle = C.regla; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); caja(ctx, xl + 1, y - 17, 20, 20, 4); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = C.suave;
    ctx.font = `400 21px ${TEXTO}`;
    ctx.textAlign = 'left';
    ctx.fillText(texto, xl + 32, y);
    xl += 32 + ctx.measureText(texto).width + 30;
  };
  muestra('partido', 'Partido');
  muestra('entreno', 'Entreno');
  muestra('libre', 'Pista libre');
  ctx.fillStyle = C.naranja;
  ctx.font = `700 21px ${TEXTO}`;
  ctx.textAlign = 'right';
  ctx.fillText('¡Vamos Palo!', ANCHO - M, y);
  return canvas;
}

function pintarHueco(ctx, x, y, w) {
  ctx.save();
  caja(ctx, x, y, w, ALTO_FILA, RADIO);
  ctx.clip();
  ctx.strokeStyle = C.gris;
  ctx.lineWidth = 6;
  for (let d = -ALTO_FILA; d < w + ALTO_FILA; d += 14) { ctx.beginPath(); ctx.moveTo(x + d, y + ALTO_FILA); ctx.lineTo(x + d + ALTO_FILA, y); ctx.stroke(); }
  ctx.restore();
}

function pintarFicha(ctx, ficha, x0, y, w0, conHora = false) {
  let x = x0;
  let w = w0;
  const h = ALTO_FILA;
  if (!ficha) {
    ctx.strokeStyle = C.regla;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    caja(ctx, x + 1, y + 1, w - 2, h - 2, RADIO);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  const entreno = Boolean(ficha.entreno);
  if (entreno) {
    ctx.fillStyle = C.blanco;
    caja(ctx, x + 1.5, y + 1.5, w - 3, h - 3, RADIO);
    ctx.fill();
    ctx.strokeStyle = C.naranja;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.fillStyle = C.azul;
    caja(ctx, x, y, w, h, RADIO);
    ctx.fill();
  }
  // Franja con horas distintas: el cuadrado de la hora de este partido, dentro de la ficha, a la izquierda.
  // `conHora`: la hora de la franja; solo la lleva la ficha que empieza a otra.
  if (conHora && ficha.inicio && ficha.inicio !== conHora) {
    const lado = 70;
    ctx.fillStyle = C.gris;
    caja(ctx, x + 14, y + (h - lado) / 2, lado, lado, 8);
    ctx.fill();
    ctx.fillStyle = C.azul;
    linea(ctx, horaCorta(ficha.inicio), x + 14 + lado / 2, y + h / 2 + 9, lado - 8, { letra: 26, peso: 700, familia: TITULOS, alinear: 'center' });
    x += lado + 10;
    w -= lado + 10;
  }
  const dentro = w - 36;
  const yNombre = entreno ? y + 38 : y + 46;
  ctx.fillStyle = entreno ? C.azul : C.blanco;
  linea(ctx, String(ficha.nombre ?? '').toUpperCase(), x + 18, yNombre, dentro, { letra: 31, peso: 700, familia: TITULOS, minima: 18 });
  ctx.fillStyle = entreno ? C.suave : C.debajo;
  // En una franja, el que empieza más tarde lleva su hora.
  linea(ctx, String(ficha.debajo ?? ''), x + 18, yNombre + 30, dentro, { letra: 20, peso: 400, familia: TEXTO, minima: 14 });
  if (entreno) {
    ctx.font = `700 14px ${TEXTO}`;
    espaciado(ctx, '1.5px');
    const t = 'ENTRENO';
    const wt = ctx.measureText(t).width + 18;
    ctx.fillStyle = C.naranja;
    caja(ctx, x + 18, y + h - 30, wt, 22, 4);
    ctx.fill();
    ctx.fillStyle = C.blanco;
    ctx.textAlign = 'left';
    ctx.fillText(t, x + 27, y + h - 14);
    espaciado(ctx, '0px');
  }
}
