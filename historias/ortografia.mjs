// REVISOR ORTOGRÁFICO de las crónicas (26-11, Luismi: «mayúsculas, acentos, signos de exclamación e
// interrogación y faltas básicas»). Dos partes:
//  · LanguageTool (api.languagetool.org, gratis, sin clave; límite ~20 peticiones/min y 20 KB): mayúsculas,
//    tildes, faltas y puntuación. TODAS las crónicas van en UNA petición, separadas por una línea en blanco.
//  · Código propio para lo que LanguageTool no hace: los signos de apertura ¡ ¿ y el espacio que falta
//    tras un punto («Seguimos!Victoria»).
// Prudencia con los nombres propios: una «falta» (TYPOS) solo se corrige si la diferencia es de tildes o
// de mayúsculas (grandisimo → grandísimo); «Vico» o «Puerta Oscura» no se tocan.
// Todo son funciones puras (testeadas en tests/historias.test.mjs); pagina.mjs las aplica al editor.

export const URL_LANGUAGETOOL = 'https://api.languagetool.org/v2/check';
const SEPARADOR = '\n\n';
const CATEGORIAS = new Set(['CASING', 'DIACRITICS', 'TYPOS', 'PUNCTUATION', 'GRAMMAR', 'CONFUSED_WORDS']);

const sinTildes = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Distancia de edición (Levenshtein) entre dos cadenas cortas. */
export function distancia(a, b) {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const nueva = [i];
    for (let j = 1; j <= b.length; j += 1) nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    fila = nueva;
  }
  return fila[b.length];
}

/**
 * Una «falta» (TYPOS) que se corrige sola: solo tildes o mayúsculas (grandisimo → grandísimo), o UNA
 * letra en una palabra larga en minúscula sin partirla (setenciamos → sentenciamos). Así no se tocan
 * nombres propios cortos ni en mayúscula (Vico, Berta) ni se parten palabras (torrebasket → torre basket).
 */
export function faltaSegura(antes, valor) {
  if (sinTildes(antes) === sinTildes(valor)) return true;
  return /^\p{Ll}+$/u.test(antes) && antes.length >= 6 && !/\s/.test(valor) && distancia(sinTildes(antes), sinTildes(valor)) <= 1;
}

/** Las correcciones de LanguageTool que se aplican solas: [{ offset, length, value, antes }]. */
export function correccionesDe(texto, matches) {
  const salida = [];
  for (const m of matches ?? []) {
    const valor = m.replacements?.[0]?.value;
    if (valor == null || !CATEGORIAS.has(m.rule?.category?.id)) continue;
    const antes = texto.slice(m.offset, m.offset + m.length);
    if (antes === valor) continue;
    if (m.rule.category.id === 'TYPOS' && !faltaSegura(antes, valor)) continue;
    salida.push({ offset: m.offset, length: m.length, value: valor, antes });
  }
  return quitarSolapes(salida);
}

const quitarSolapes = (cambios) => {
  const orden = [...cambios].sort((a, b) => a.offset - b.offset);
  const fuera = [];
  let fin = -1;
  for (const c of orden) {
    if (c.offset < fin) continue;
    fuera.push(c);
    fin = c.offset + c.length;
  }
  return fuera;
};

/**
 * ANTES de LanguageTool: el espacio que falta tras ! o ? pegado a una letra, o tras un punto pegado a una
 * mayúscula («Seguimos!grandisimo»: pegada, LanguageTool no ve la palabra). [{ offset, length, value, antes }].
 */
export function espaciosQueFaltan(texto) {
  return [...texto.matchAll(/[!?](?=\p{L})|\.(?=\p{Lu})/gu)].map((m) => ({ offset: m.index + 1, length: 0, value: ' ', antes: '' }));
}

/**
 * ANTES de LanguageTool (tras los espacios): mayúscula al empezar la crónica y tras . ! ? … (LanguageTool
 * no la pone tras «!», y sin ella tampoco ve «grandisimo»). Se salta comillas y signos de apertura.
 */
export function mayusculasDeFrase(texto) {
  const cambios = [];
  // Al empezar la crónica también tras un número («4 victoria de sub 22» → «4 Victoria…»).
  for (const m of texto.matchAll(/(?:^\s*(?:\d+[ªº]?\s+)?|[.!?…]\s+)[¡¿"«“'(]*(\p{Ll})/gu)) {
    const i = m.index + m[0].length - 1;
    cambios.push({ offset: i, length: 1, value: m[1].toUpperCase(), antes: m[1] });
  }
  return cambios;
}

/**
 * Errores frecuentes que LanguageTool no ve: «está vez» → «esta vez» (y semana, temporada, jornada…).
 */
// [expresión, (coincidencia) → texto bueno]. La expresión mira por delante; el cambio solo toca lo cogido.
const FRECUENTES = [[/\b([Ee])stá (?=(?:vez|semana|temporada|jornada|tarde|mañana|noche|victoria|derrota)\b)/gu, (m) => `${m[1]}sta `]];
export function erroresFrecuentes(texto) {
  const cambios = [];
  for (const [re, por] of FRECUENTES) {
    for (const m of texto.matchAll(re)) cambios.push({ offset: m.index, length: m[0].length, value: por(m), antes: m[0] });
  }
  return cambios;
}

/**
 * Los nombres de equipos y localidades con su mayúscula (torrebasket → Torrebasket, ebg → EBG). La lista
 * sale de los partidos de la web (paginas.mjs → nombresPropiosHistorias). Solo se tocan palabras
 * escritas enteras en minúscula.
 */
export function nombresPropios(texto, nombres = []) {
  const porClave = new Map(nombres.map((n) => [sinTildes(n), n]));
  const cambios = [];
  for (const m of texto.matchAll(/\p{L}+/gu)) {
    const bueno = porClave.get(sinTildes(m[0]));
    if (bueno && bueno !== m[0] && /^\p{Ll}+$/u.test(m[0])) cambios.push({ offset: m.index, length: m[0].length, value: bueno, antes: m[0] });
  }
  return cambios;
}

/** Punto final si la crónica acaba en letra o número (no tras ! ? … ni tras un emoji). */
export function puntoFinal(texto) {
  const m = texto.match(/[\p{L}\p{N}](?=\s*$)/u);
  return m ? [{ offset: m.index + 1, length: 0, value: '.', antes: '' }] : [];
}

/** Lo que va antes de LanguageTool, de una vez: espacios y luego mayúsculas. */
export function preparar(texto) {
  const conEspacios = aplicar(texto, espaciosQueFaltan(texto));
  return aplicar(conEspacios, mayusculasDeFrase(conEspacios));
}

/**
 * Al pegar: cada salto de línea es un fin de frase (así escriben en WhatsApp): si la línea no acababa en
 * . ! ? … : ; se le pone un punto.
 */
export function unirLineas(texto) {
  return String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l, i, todas) => (i < todas.length - 1 && /[\p{L}\p{N}]$/u.test(l) ? `${l}.` : l)).join(' ');
}

/**
 * DESPUÉS de LanguageTool: los signos de apertura. Una frase que acaba en ! (o ?) sin ¡ (o ¿) lo lleva al
 * principio. [{ offset, length, value, antes }].
 */
export function signosDeApertura(texto) {
  const cambios = [];
  // Frases: desde el principio o tras un fin de frase (. ! ? …) hasta su propio fin.
  const re = /[^.!?…]+[.!?…]*/g;
  for (const m of texto.matchAll(re)) {
    const frase = m[0];
    const fin = frase.match(/[!?]+$/)?.[0];
    if (!fin) continue;
    const inicio = m.index + (frase.length - frase.trimStart().length);
    const cuerpo = texto.slice(inicio, m.index + frase.length);
    for (const [cierra, abre] of [['!', '¡'], ['?', '¿']]) {
      if (fin.includes(cierra) && !cuerpo.includes(abre)) cambios.push({ offset: inicio, length: 0, value: abre, antes: '' });
    }
  }
  return cambios;
}

/** Aplica cambios a un texto (de atrás hacia delante, así los desplazamientos siguen valiendo). */
export function aplicar(texto, cambios) {
  let t = texto;
  for (const c of [...cambios].sort((a, b) => b.offset - a.offset)) t = t.slice(0, c.offset) + c.value + t.slice(c.offset + c.length);
  return t;
}

/** Varias crónicas en un solo texto para una petición: { texto, inicios }. */
export function juntar(textos) {
  const inicios = [];
  let texto = '';
  textos.forEach((t, i) => {
    if (i) texto += SEPARADOR;
    inicios.push(texto.length);
    texto += t;
  });
  return { texto, inicios };
}

/** Reparte los matches de la petición conjunta entre las crónicas, con su desplazamiento local. */
export function repartir(textos, inicios, matches) {
  return textos.map((t, i) => (matches ?? [])
    .filter((m) => m.offset >= inicios[i] && m.offset + m.length <= inicios[i] + t.length)
    .map((m) => ({ ...m, offset: m.offset - inicios[i] })));
}

/** Pide la revisión de varias crónicas a LanguageTool. → [matches por crónica]. */
export async function revisarEnLanguageTool(textos, pedir = fetch) {
  const { texto, inicios } = juntar(textos);
  const cuerpo = new URLSearchParams({ language: 'es', text: texto });
  const r = await pedir(URL_LANGUAGETOOL, { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) throw new Error(r.status === 429 ? 'demasiadas revisiones seguidas; espera un minuto' : `el revisor contestó ${r.status}`);
  const { matches } = await r.json();
  return repartir(textos, inicios, matches);
}
