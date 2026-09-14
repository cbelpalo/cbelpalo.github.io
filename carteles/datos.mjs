// CARTELES DE LA SEMANA (21-10, Luismi): lo que va en las dos imágenes para redes, una por campo del
// club (Pabellón La Mosca y Colegio Valle Inclán), sacado del mismo modelo que la web.
//
// Puro y sin dependencias: lo usan el build (site/paginas.mjs, solo en la web LOCAL) para dejar las
// filas en la página, los tests, y el navegador, que lo importa tal cual (dist-local/carteles/)
// para cortar el periodo (jueves–miércoles) y maquetar. La fecha de hoy entra como parámetro.

/** Los dos campos del club, en el orden de las plantillas (páginas 5 y 6 del PDF de Canva). */
export const CAMPOS = [
  { id: 'la-mosca', slug: 'la-mosca', nombre: 'Pabellón La Mosca' },
  { id: 'ceip-ramon-del-valle-inclan', slug: 'valle-inclan', nombre: 'Colegio Valle Inclán' },
];

// La FAB pone las 00:00 a los partidos aún sin hora (como en site/paginas.mjs, que pinta «--:--»).
export const SIN_HORA = '00:00';
// Un aplazado o suspendido no se juega en la fecha que trae: no se anuncia.
const FUERA = new Set(['aplazado', 'suspendido']);

const DIA_MS = 86_400_000;
const aMs = (fecha) => Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)));
const aFecha = (ms) => new Date(ms).toISOString().slice(0, 10);
export const sumarDias = (fecha, n) => aFecha(aMs(fecha) + n * DIA_MS);
/** 0 = lunes … 6 = domingo */
const diaSemana = (fecha) => (new Date(aMs(fecha)).getUTCDay() + 6) % 7;
const DIAS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];

const mayus = (s) => String(s ?? '').toLocaleUpperCase('es-ES').replace(/\s+/g, ' ').trim();

/**
 * El equipo y, aparte, su entrenador (21-10, Luismi: el entrenador en una SEGUNDA línea, sin
 * paréntesis): { nombre: «INFANTIL FEMENINO 13», entrenador: «LUISMI MONTIEL» | null }.
 */
function textoEquipo(id, equipos) {
  const e = equipos.get(id);
  if (!e) return null;
  return { nombre: mayus(e.etiqueta), entrenador: e.entrenador?.alias ? mayus(e.entrenador.alias) : null };
}

// El escudo HD del club (site/marca, que el build copia a img/), el de la cabecera de la web.
export const ESCUDO_CLUB = 'img/escudo-320.png';

/**
 * Una fila del cartel. EQUIPO: el nuestro por su alias, con su entrenador aparte (en un derbi, los
 * dos, local arriba, como en el renglón de la web). PARTIDO (21-10, Luismi): local y visitante con
 * los nombres de la web, en mayúsculas («CB EL PALO», «EBG MÁLAGA»), cada uno con su escudo (ruta
 * en la web; null si no hay), y «SÁBADO 24/10/2026 - 09:30 H.».
 * `escudos`: los ficheros de escudo que el build ha copiado (sin él, se dan todos por buenos).
 */
export function filaDeCartel(p, { equipos, club, escudos = null }) {
  const lados = [p.local, p.visitante];
  const nuestros = lados.filter((l) => l.equipo).map((l) => textoEquipo(l.equipo, equipos) ?? { nombre: mayus(l.visible), entrenador: null });
  const escudo = (l) => (l.equipo ? ESCUDO_CLUB : l.escudo && (!escudos || escudos.has(l.escudo)) ? `img/escudos/${l.escudo}` : null);
  // Los nombres de la web (21-10, Luismi: «vuelve a usar los alias»): El Palo por el nombre del club
  // y el rival por su nombre corto si lo tiene, como en el renglón; no el completo de la FAB.
  // Con sus SIGLAS (21-10, «CBRV»), si las tiene: el cartel las usa cuando el nombre no cabe a su letra.
  const [local, visitante] = lados.map((l) => ({ nombre: mayus(l.equipo ? club : (l.corto || l.visible || l.nombre)), siglas: l.siglas ? mayus(l.siglas) : null, escudo: escudo(l) }));
  // Con el día de la semana delante (21-10, Luismi): «SÁBADO 24/10/2026 - 09:30 H.».
  const fecha = `${DIAS[diaSemana(p.fecha)]} ${p.fecha.slice(8, 10)}/${p.fecha.slice(5, 7)}/${p.fecha.slice(0, 4)}`;
  return {
    id: p.id,
    fecha: p.fecha,
    hora: p.hora ?? SIN_HORA,
    equipo: nuestros.length ? nuestros : [{ nombre: mayus(club), entrenador: null }],
    local,
    visitante,
    partido: `${local.nombre} VS ${visitante.nombre}`,
    cuando: `${fecha} - ${!p.hora || p.hora === SIN_HORA ? 'HORA POR CONFIRMAR' : `${p.hora} H.`}`,
  };
}

// Sin hora, al final del día: no es una medianoche que nadie vaya a jugar.
const claveOrden = (f) => `${f.fecha} ${f.hora === SIN_HORA ? '99:99' : f.hora}`;

/**
 * Todas las filas de la temporada en los campos del club, por campo (slug → filas), ordenadas por
 * fecha y hora. Cuentan también los partidos en esos campos en los que El Palo es visitante. Es lo
 * que el build deja en la página; el periodo de cada cartel lo corta el navegador.
 */
export function filasDeCarteles(modelo, { escudos = null } = {}) {
  const equipos = new Map(modelo.equipos.map((e) => [e.id, e]));
  const club = modelo.club.nombre;
  const campos = Object.fromEntries(CAMPOS.map((c) => [c.slug, []]));
  for (const p of modelo.partidos) {
    const campo = CAMPOS.find((c) => c.id === p.pabellon);
    if (!campo || FUERA.has(p.estado)) continue;
    campos[campo.slug].push(filaDeCartel(p, { equipos, club, escudos }));
  }
  for (const filas of Object.values(campos)) filas.sort((a, b) => claveOrden(a).localeCompare(claveOrden(b)) || a.id.localeCompare(b.id));
  return campos;
}

// PERIODO DEL CARTEL (21-10, Luismi): los carteles se suben a redes el JUEVES, así que cada uno va
// del jueves al miércoles siguiente, los dos incluidos. Un periodo se nombra por su jueves.
const JUEVES = 3; // 0 = lunes … 6 = domingo
/** El jueves que abre el periodo (jueves–miércoles) en el que cae una fecha. */
export const juevesDe = (fecha) => sumarDias(fecha, -((diaSemana(fecha) - JUEVES + 7) % 7));
/** El periodo que se enseña al abrir: el que empieza el próximo jueves (hoy mismo si hoy es jueves). */
export const juevesPorDefecto = (hoy) => sumarDias(hoy, (JUEVES - diaSemana(hoy) + 7) % 7);

/** Las filas de cada campo del jueves `jueves` al miércoles siguiente, ambos incluidos. */
export function cartelesDelPeriodo(filasPorCampo, jueves) {
  const miercoles = sumarDias(jueves, 6);
  return Object.fromEntries(Object.entries(filasPorCampo).map(([slug, filas]) => [slug, filas.filter((f) => f.fecha >= jueves && f.fecha <= miercoles)]));
}

/** Los jueves del primer y del último periodo con partidos: hasta ahí llegan las flechas. */
export function periodosConPartidos(filasPorCampo) {
  const fechas = Object.values(filasPorCampo).flat().map((f) => f.fecha).sort();
  return fechas.length ? { primero: juevesDe(fechas[0]), ultimo: juevesDe(fechas.at(-1)) } : null;
}

/** «Jueves 22/10 – Miércoles 28/10». */
export function textoPeriodo(jueves) {
  const dm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  return `Jueves ${dm(jueves)} – Miércoles ${dm(sumarDias(jueves, 6))}`;
}

/**
 * Cuántas imágenes y qué filas en cada una. `alto`: el hueco libre para las filas (sin la cabecera
 * de la tabla); `fila`: el alto de fila de la plantilla; `minimo`: el alto más bajo que se sigue
 * leyendo. Primero se aprietan las filas; si ni así caben, se parten en varias imágenes con el mismo
 * número de filas (±1). Devuelve [{ desde, hasta, alto }] (hasta excluido; alto = alto de fila).
 */
export function repartirFilas(n, { alto, fila, minimo }) {
  if (n <= 0) return [];
  const caben = Math.max(1, Math.floor(alto / minimo));
  const partes = Math.ceil(n / caben);
  const resultado = [];
  let desde = 0;
  for (let k = 0; k < partes; k += 1) {
    const cuantas = Math.ceil((n - desde) / (partes - k));
    resultado.push({ desde, hasta: desde + cuantas, alto: Math.min(fila, alto / cuantas) });
    desde += cuantas;
  }
  return resultado;
}

/** Nombre del fichero: cartel-la-mosca-2026-10-22.png (el jueves del periodo), con «-1de2» si se parte. */
export const nombreFichero = (slug, jueves, parte = 1, partes = 1) => `cartel-${slug}-${jueves}${partes > 1 ? `-${parte}de${partes}` : ''}.png`;

/**
 * La plataforma del móvil para elegir cómo se guarda el cartel (21-10): 'android', 'ios' u 'otra'.
 * El iPad con iPadOS se presenta como un Mac: Mac con pantalla táctil = iOS.
 */
export function plataformaDe({ uaPlataforma = '', ua = '', puntosTactiles = 0 } = {}) {
  if (/android/i.test(uaPlataforma) || /android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || /^ios$/i.test(uaPlataforma)) return 'ios';
  if (/macintosh/i.test(ua) && puntosTactiles > 1) return 'ios';
  return 'otra';
}

/**
 * Qué botones lleva cada cartel (21-10, Luismi: «no se me descarga a fotos en el móvil»):
 * { lista: [{ accion: 'descargar' | 'compartir', texto, principal }], nota }. En ANDROID la galería
 * (Google Fotos, álbum «Download») se llena DESCARGANDO: «Guardar en la galería» y, aparte,
 * «Compartir» para Instagram o WhatsApp. En iOS, la hoja de compartir lleva «Guardar imagen» → Fotos:
 * solo «Compartir / Guardar en fotos». En el PC, «Descargar» y, si se puede, «Compartir». Sin hoja
 * de compartir (http por la IP de la LAN) solo la descarga y, en el móvil, la nota de cómo guardarlo.
 */
export function botonesCartel({ plataforma = 'otra', tactil = false, puedeCompartir = false } = {}) {
  const descargar = (texto, principal = true) => ({ accion: 'descargar', texto, principal });
  const compartir = (texto, principal = false) => ({ accion: 'compartir', texto, principal });
  if (!tactil) return { lista: [descargar('Descargar'), ...(puedeCompartir ? [compartir('Compartir')] : [])], nota: false };
  if (plataforma === 'android') return { lista: [descargar('Guardar en la galería'), ...(puedeCompartir ? [compartir('Compartir')] : [])], nota: !puedeCompartir };
  if (puedeCompartir) return { lista: [compartir('Compartir / Guardar en fotos', true)], nota: false };
  return { lista: [descargar('Descargar')], nota: true };
}
