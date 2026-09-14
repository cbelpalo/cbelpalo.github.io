// ASIGNAR PISTAS (27-11, Luismi: «situar los partidos en cada pista, como hemos hecho para el CM las
// crónicas y carteles: ?asignar y un asignar.html»). El cuadrante de un día en un campo del club:
// filas = horas, columnas = pistas, agrupadas en zonas (Pabellón / Pistas exteriores), con los
// partidos de la web y los entrenos que se añadan a mano. Sale como imagen («Partidos del finde»).
//
// Puro y sin dependencias: lo usan el build (site/paginas.mjs deja los partidos en la página), los
// tests y el navegador (site/asignar/pagina.mjs y pintar.mjs), que lo importa tal cual.

/**
 * Los campos del club y sus pistas, agrupadas en zonas. `fab`: el id de pista que trae la FAB (La
 * Mosca la trae; Valle-Inclán no, y ahí se colocan a mano). Los nombres de Valle-Inclán son los del
 * cuadrante de Coordinación Deportiva (27-11).
 */
export const CAMPOS_ASIGNAR = [
  {
    id: 'ceip-ramon-del-valle-inclan',
    corto: 'Valle-Inclán',
    zonas: [
      { nombre: 'Pabellón', pistas: [{ id: 'p1', nombre: 'Pista 1 · Puerta' }, { id: 'p2', nombre: 'Pista 2 · Centro' }, { id: 'p3', nombre: 'Pista 3 · Fondo' }] },
      { nombre: 'Pistas exteriores', pistas: [{ id: 'cuartillo', nombre: 'Cuartillo' }, { id: 'roja', nombre: 'Roja' }, { id: 'muro', nombre: 'Muro' }] },
    ],
  },
  {
    id: 'la-mosca',
    corto: 'La Mosca',
    zonas: [
      // 27-11, Luismi: «en La Mosca solo se juega en pista 1 y 3 (tercios transversales; el 2 se deja libre para los
      // banquillos). Pista central = a lo largo, con los 3 tercios: ese partido ocupa las 3 columnas». Femeninos a la 1 y
      // masculinos a la 3 en caso de duda (`genero`).
      {
        nombre: 'Pabellón',
        pistas: [{ id: 'p1', nombre: 'Pista 1', fab: '1', genero: 'F' }, { id: 'p3', nombre: 'Pista 3', fab: '3', genero: 'M' }],
        central: { id: 'central', nombre: 'Pista central', fab: 'central' },
        // 27-11, Luismi: «para que quede más visual, una columna más estrecha «Pista 2» donde no se puedan arrastrar
        // partidos»: el tercio de los banquillos, solo de referencia.
        hueco: { despues: 'p1', nombre: 'Pista 2', nota: 'Banquillos' },
      },
    ],
  },
];

export const campoAsignar = (id) => CAMPOS_ASIGNAR.find((c) => c.id === id) ?? CAMPOS_ASIGNAR[0];
/** Las pistas (columnas) de un campo, sin las «centrales» (que ocupan una zona entera). */
export const pistasDe = (campo) => campo.zonas.flatMap((z) => z.pistas);
/** Cualquier sitio con su id: las columnas y las centrales. */
const sitiosDe = (campo) => campo.zonas.flatMap((z) => [...z.pistas, ...(z.central ? [z.central] : [])]);
export const nombrePista = (campo, id) => sitiosDe(campo).find((p) => p.id === id)?.nombre ?? id;
/** La pista del campo que corresponde a la que trae la FAB («3» → «p3»), o null. */
export const pistaDeFab = (campo, fab) => (fab == null ? null : sitiosDe(campo).find((p) => p.fab === String(fab))?.id ?? null);
/** Las columnas de una zona en orden, con el hueco (Pista 2 de La Mosca) en su sitio: [{ tipo: 'pista'|'hueco', … }]. */
export function columnasDeZona(z) {
  const salida = [];
  for (const p of z.pistas) {
    salida.push({ tipo: 'pista', ...p });
    if (z.hueco?.despues === p.id) salida.push({ tipo: 'hueco', ...z.hueco });
  }
  return salida;
}
/** La zona (con pista central) de una pista, o null. */
const zonaConCentral = (campo, id) => campo.zonas.find((z) => z.central && (z.central.id === id || z.pistas.some((p) => p.id === id))) ?? null;
/** Las columnas que ocupa un sitio: la central, todas las de su zona. */
const columnasDe = (campo, id) => {
  const z = campo.zonas.find((x) => x.central?.id === id);
  return z ? z.pistas.map((p) => p.id) : [id];
};

/**
 * FRANJAS (27-11, Luismi: «las franjas suelen ser intervalos de 2 h - 2 h 30; si Bazalo empieza a las 11:10, la pista 1
 * no está libre a las 11:10 ni la 3 a las 11:30: es la misma franja, pero empiezan con 20-30 min de desfase»). Las filas
 * del cuadrante son franjas: las horas que empiezan a menos de DESFASE_FRANJA_MIN del inicio de una van en ella, y una
 * pista solo tiene un partido por franja.
 */
export const DESFASE_FRANJA_MIN = 60;
export const SEPARACION_FRANJAS_MIN = 120;
const minutos = (h) => Number(String(h).slice(0, 2)) * 60 + Number(String(h).slice(3, 5));
/** hora → inicio de su franja (Map), para unas horas del día. */
export function franjasDe(horas) {
  // Grupos: las horas a menos de DESFASE_FRANJA_MIN del inicio del grupo.
  const grupos = [];
  for (const h of horas.filter(Boolean).sort()) {
    const g = grupos.at(-1);
    if (g && minutos(h) - minutos(g[0]) < DESFASE_FRANJA_MIN) g.push(h); else grupos.push([h]);
  }
  // La hora de la franja NO es la del primero que empieza (27-11, Luismi: «entre dos franjas suele haber mínimo 2 h»):
  // la más repetida y, a igualdad, la primera que queda a SEPARACION_FRANJAS_MIN o más de la franja anterior (11:10 y
  // 11:30 tras las 9:30 → 11:30); si ninguna llega, la más tardía.
  const salida = new Map();
  let anterior = null;
  for (const g of grupos) {
    const cuenta = new Map();
    for (const h of g) cuenta.set(h, (cuenta.get(h) ?? 0) + 1);
    const max = Math.max(...cuenta.values());
    const candidatas = [...cuenta.keys()].filter((h) => cuenta.get(h) === max);
    const franja = anterior == null ? candidatas[0] : candidatas.find((h) => minutos(h) - minutos(anterior) >= SEPARACION_FRANJAS_MIN) ?? candidatas.at(-1);
    for (const h of g) salida.set(h, franja);
    anterior = franja;
  }
  return salida;
}

const FUERA = new Set(['aplazado', 'suspendido']);
const SIN_HORA = '00:00';
const DIA_MS = 86_400_000;
const aMs = (f) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
export const sumarDias = (f, n) => new Date(aMs(f) + n * DIA_MS).toISOString().slice(0, 10);
/** 0 = lunes … 6 = domingo */
export const diaSemana = (f) => (new Date(aMs(f)).getUTCDay() + 6) % 7;
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mayus = (s) => String(s ?? '').toLocaleUpperCase('es-ES');

/** «Infantil Masculino 13» → «Infantil Masc 13»: lo de debajo del nombre en la ficha. */
export const textoEquipo = (etiqueta) => String(etiqueta ?? '').replace(/\bMasculino\b/g, 'Masc').replace(/\bFemenino\b/g, 'Fem').replace(/\s+/g, ' ').trim();
/** El nombre grande de la ficha: el entrenador en mayúsculas («LUISMI MONTIEL»); se cambia a mano. */
export const textoEntrenador = (alias) => mayus(alias).replace(/\s+/g, ' ').trim();

/**
 * Los partidos de los campos del club desde `desde` (incluido): { [campo]: { [fecha]: [partido] } },
 * cada partido { id, hora, fab (pista de la FAB o null), equipo (id), nombre, debajo, rival }. Sin los
 * aplazados ni suspendidos. En un derbi va el local (es una sola pista).
 */
export function partidosDeAsignar(modelo, { desde }) {
  const equipos = new Map((modelo.equipos ?? []).map((e) => [e.id, e]));
  const salida = Object.fromEntries(CAMPOS_ASIGNAR.map((c) => [c.id, {}]));
  for (const p of modelo.partidos ?? []) {
    if (!salida[p.pabellon] || FUERA.has(p.estado) || p.fecha < desde) continue;
    const nuestro = [p.local, p.visitante].find((l) => l?.equipo);
    if (!nuestro) continue;
    const rival = nuestro === p.local ? p.visitante : p.local;
    const e = equipos.get(nuestro.equipo);
    (salida[p.pabellon][p.fecha] ??= []).push({
      id: String(p.id),
      hora: p.hora && p.hora !== SIN_HORA ? p.hora : '',
      fab: p.pista ?? null,
      equipo: nuestro.equipo,
      genero: e?.genero ?? (/femenino/i.test(e?.etiqueta ?? nuestro.visible ?? '') ? 'F' : /masculino/i.test(e?.etiqueta ?? nuestro.visible ?? '') ? 'M' : null),
      nombre: textoEntrenador(e?.entrenador?.alias ?? e?.etiqueta ?? nuestro.visible),
      debajo: textoEquipo(e?.etiqueta ?? nuestro.visible),
      rival: rival?.equipo ? rival.visible : (rival?.corto || rival?.visible || ''),
    });
  }
  for (const dias of Object.values(salida)) {
    for (const lista of Object.values(dias)) lista.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99') || a.debajo.localeCompare(b.debajo, 'es') || a.id.localeCompare(b.id));
  }
  return salida;
}

/** «09:30» → «9:30», como en el cuadrante. */
export const horaCorta = (h) => String(h).replace(/^0(\d)/, '$1');

/** Las filas del cuadrante: las horas de los partidos y las añadidas a mano, sin repetir y en orden. */
export function horasDe(partidos, extra = []) {
  return [...new Set(franjasDe([...partidos.map((p) => p.hora), ...extra]).values())].sort();
}
/** La franja (fila) de la hora de un partido entre los de su día. */
export const franjaDe = (hora, partidos, extra = []) => franjasDe([...partidos.map((p) => p.hora), ...extra]).get(hora) ?? hora;

/** La celda de una ficha: «09:30|p1». */
export const celda = (hora, pista) => `${hora}|${pista}`;
export const partesCelda = (c) => { const [hora, pista] = String(c).split('|'); return { hora, pista }; };

/**
 * ¿Se pisa la celda `c` con alguna de `otras`? Misma franja (fila) y comparten columna (la central, todas las de su zona).
 */
export function sePisa(campo, c, otras) {
  const { hora, pista } = partesCelda(c);
  const mias = new Set(columnasDe(campo, pista));
  return otras.some((o) => {
    if (o === c) return true;
    const x = partesCelda(o);
    return Boolean(hora) && x.hora === hora && columnasDe(campo, x.pista).some((p) => mias.has(p)); // misma franja
  });
}

/** Las columnas en el orden en que se prueban para un equipo: primero las de su género (femeninos a la 1…). */
const preferidas = (campo, genero) => {
  const todas = pistasDe(campo);
  return [...todas.filter((p) => genero && p.genero === genero), ...todas.filter((p) => !genero || p.genero !== genero)];
};

/**
 * Dónde va cada partido al abrir un día nuevo: en la pista que trae la FAB (La Mosca; Valle-Inclán no la trae) y, si
 * se pisa con otro ya colocado, en otra libre, la de su género primero (27-11, Luismi: «no se pueden jugar dos
 * partidos en la misma Pista 3 a las 11:10 y a las 11:30: uno a la Pista 1»). Lo que no cabe, sin pista.
 * { [idFicha]: celda }.
 */
export function colocacionInicial(partidos, campo) {
  const franjas = franjasDe(partidos.map((p) => p.hora));
  const salida = {};
  const usadas = [];
  // Por franja y, dentro, primero los que quieren la pista de su género (si dos quieren la 3, se la queda el masculino).
  const suya = (p) => (sitiosDe(campo).find((x) => x.id === pistaDeFab(campo, p.fab))?.genero === p.genero ? 0 : 1);
  const orden = [...partidos].sort((a, b) => (franjas.get(a.hora) ?? '99').localeCompare(franjas.get(b.hora) ?? '99') || suya(a) - suya(b) || (a.hora || '').localeCompare(b.hora || ''));
  for (const p of orden) {
    const quiere = pistaDeFab(campo, p.fab);
    if (!quiere || !p.hora) continue;
    const fila = franjas.get(p.hora) ?? p.hora;
    let c = celda(fila, quiere);
    if (sePisa(campo, c, usadas)) {
      const central = columnasDe(campo, quiere).length > 1;
      c = central ? null : preferidas(campo, p.genero).filter((x) => x.id !== quiere).map((x) => celda(fila, x.id)).find((x) => !sePisa(campo, x, usadas)) ?? null;
    }
    if (!c) continue;
    salida[p.id] = c;
    usadas.push(c);
  }
  return salida;
}

/**
 * «Repartir los que faltan»: cada partido sin pista a la primera libre de SU hora que no se pise con otro, la de su
 * género primero (y las del pabellón antes que las de fuera). Los que no caben se quedan sin pista. Copia.
 */
export function repartir(partidos, campo, colocacion, extra = []) {
  const franjas = franjasDe([...partidos.map((p) => p.hora), ...extra]);
  const salida = { ...colocacion };
  for (const p of partidos) {
    if (salida[p.id] || !p.hora) continue;
    const usadas = Object.values(salida);
    const fila = franjas.get(p.hora) ?? p.hora;
    const libre = preferidas(campo, p.genero).map((x) => celda(fila, x.id)).find((c) => !sePisa(campo, c, usadas));
    if (libre) salida[p.id] = libre;
  }
  return salida;
}

/**
 * Mover una ficha a una celda (o a ninguna, `destino` null). Lo que estaba en ese sitio a esa hora (la central se
 * lleva toda la fila de su zona) pasa al sitio de la que llega si era una sola ficha; si eran varias, se quedan sin
 * pista.
 */
export function mover(colocacion, id, destino, campo = null) {
  const salida = { ...colocacion };
  const origen = salida[id] ?? null;
  const fuera = (c) => {
    if (!destino) return false;
    const a = partesCelda(c);
    const b = partesCelda(destino);
    if (a.hora !== b.hora) return false;
    if (!campo) return c === destino;
    const mias = new Set(columnasDe(campo, b.pista));
    return columnasDe(campo, a.pista).some((p) => mias.has(p));
  };
  const ocupantes = Object.keys(salida).filter((k) => k !== id && fuera(salida[k]));
  if (destino) salida[id] = destino; else delete salida[id];
  // Al sitio de la que llega, salvo que ese sitio también lo tape (ampliar a pista completa: la de al lado se queda sin pista).
  const vuelve = ocupantes.length === 1 && origen && !fuera(origen);
  for (const k of ocupantes) { if (vuelve) salida[k] = origen; else delete salida[k]; }
  return salida;
}

/**
 * Ampliar a pista completa o devolver (27-11, Luismi: «que al arrastrar un partido lo podamos expandir a pista
 * completa»). Una ficha en una columna de una zona con central pasa a la central a su hora (lo que hubiera en la otra
 * columna a esa hora se queda sin pista); en la central, vuelve a `hacia` (una columna) o, sin ella, a la de la FAB
 * (`esperada`) o a la de su género. Copia.
 */
export function alternarCompleta(colocacion, id, campo, { hacia = null, esperada = null, genero = null } = {}) {
  const c = colocacion[id];
  if (!c) return colocacion;
  const { hora, pista } = partesCelda(c);
  const z = zonaConCentral(campo, pista);
  if (!z) return colocacion;
  if (pista !== z.central.id) return mover(colocacion, id, celda(hora, z.central.id), campo);
  const ids = z.pistas.map((p) => p.id);
  const destino = [hacia, esperada, z.pistas.find((p) => genero && p.genero === genero)?.id, ids[0]].find((x) => ids.includes(x));
  return mover(colocacion, id, celda(hora, destino), campo);
}

/** ¿La celda es de pista completa (la central de su zona)? */
export const esCompleta = (campo, c) => campo.zonas.some((z) => z.central?.id === partesCelda(c).pista);

/** «sábado 28 de noviembre» */
export const fechaLarga = (f) => `${DIAS[diaSemana(f)]} ${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
/** «Sábado 28 nov» para el selector de días. */
export const fechaCorta = (f) => { const t = `${DIAS[diaSemana(f)]} ${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1].slice(0, 3)}`; return t[0].toUpperCase() + t.slice(1); };

/** Título del cartel: «PARTIDOS DEL FINDE» en sábado o domingo; si no, «PARTIDOS DEL MIÉRCOLES». */
export const tituloCartel = (f) => (diaSemana(f) >= 5 ? 'PARTIDOS DEL FINDE' : `PARTIDOS DEL ${mayus(DIAS[diaSemana(f)])}`);
/** «SÁBADO 28 DE NOVIEMBRE · VALLE-INCLÁN» */
export const subtituloCartel = (f, campo) => `${mayus(fechaLarga(f))} · ${mayus(campo.corto)}`;

/**
 * La nota de abajo, por defecto (27-11, como en el cuadrante: «DOMINGO 29 · Sin partidos en
 * Valle-Inclán»): solo en sábado, sobre el domingo. { titulo, texto } o null.
 */
export function notaPorDefecto(fecha, campo, diasDelCampo) {
  if (diaSemana(fecha) !== 5) return null;
  const domingo = sumarDias(fecha, 1);
  const n = (diasDelCampo?.[domingo] ?? []).length;
  return {
    titulo: `DOMINGO ${Number(domingo.slice(8, 10))}`,
    texto: n ? `${n} ${n === 1 ? 'partido' : 'partidos'} en ${campo.corto}: van en su cuadrante` : `Sin partidos en ${campo.corto}`,
  };
}

/**
 * El día que se abre: el primer sábado o domingo con partidos desde hoy (el cuadrante es del finde);
 * si no hay, el primer día con partidos desde hoy; sin ninguno, el último que hubo.
 */
export function diaPorDefecto(diasDelCampo, hoy) {
  const dias = Object.keys(diasDelCampo ?? {}).sort();
  const futuros = dias.filter((d) => d >= hoy);
  return futuros.find((d) => diaSemana(d) >= 5) ?? futuros[0] ?? dias.at(-1) ?? hoy;
}

/** «cuadrante-2026-11-28-valle-inclan.png» */
export const nombreFichero = (fecha, campo) => `cuadrante-${fecha}-${campo.corto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;

/**
 * Lo que sale en el cartel: por zona, sus columnas (con el hueco: Pista 2 de La Mosca) y, por hora, la ficha de cada
 * una (o null); aparte, `completas`: los partidos a pista completa de la zona, [{ hora, ficha }] (27-11, Luismi: «si
 * algún partido es a Pista Central, ponlo en un listado justo debajo, aparte»). `fichas`: { [id]: { nombre, debajo,
 * entreno, esperada? } }; `esperada` es la pista que dice la FAB: si la ficha está en otra, lleva asterisco y una nota.
 * Las horas sin nada en las columnas no salen; una zona sin nada tampoco. → { zonas, notas: [texto] }.
 */
export function tablaDelCartel(campo, horas, colocacion, fichas) {
  const enCelda = new Map();
  const notas = [];
  for (const [id, c] of Object.entries(colocacion)) {
    const f = fichas[id];
    if (!f) continue;
    const { pista } = partesCelda(c);
    const movida = Boolean(f.esperada && f.esperada !== pista);
    const { hora } = partesCelda(c);
    enCelda.set(c, { ...f, ...(movida ? { asterisco: true } : {}), inicio: f.hora || hora });
    // El porqué solo cuando pasa de una pista a la otra (lo que se pisa); a pista completa o desde ella lo decidís vosotros.
    const porque = !esCompleta(campo, c) && !esCompleta(campo, celda('', f.esperada)) ? ' porque coincide con otro partido' : '';
    if (movida) notas.push(`* ${f.nombre}${f.debajo ? ` (${f.debajo})` : ''}: en la FAB figura en ${nombrePista(campo, f.esperada)}; va a ${nombrePista(campo, pista)}${porque}.`);
  }
  const usadas = horas.filter((h) => pistasDe(campo).some((p) => enCelda.has(celda(h, p.id))));
  const zonas = campo.zonas
    .map((z) => {
      // En el cartel solo las pistas con algo ese día (27-11, Luismi: «no hace falta la Pista 2 de La Mosca, ni cualquier
      // pista donde no haya partidos ese día»). Si no queda ninguna (solo pista completa), las pistas, para su ancho.
      const conAlgo = z.pistas.filter((p) => usadas.some((h) => enCelda.has(celda(h, p.id))));
      const columnas = (conAlgo.length ? conAlgo : z.pistas).map((p) => ({ tipo: 'pista', ...p }));
      return {
        nombre: z.nombre,
        columnas: columnas.map((x) => ({ tipo: x.tipo, nombre: x.nombre, nota: x.nota ?? null })),
        pistas: z.pistas.map((p) => p.nombre),
        // `horas`: si en la franja los partidos empiezan a horas distintas, cada ficha lleva la suya (27-11, Luismi).
        filas: usadas.map((h) => {
          const fichasFila = columnas.map((x) => (x.tipo === 'pista' ? enCelda.get(celda(h, x.id)) ?? null : null));
          return { hora: h, fichas: fichasFila, horas: new Set(fichasFila.filter(Boolean).map((f) => f.inicio)).size > 1 };
        }),
        completas: z.central ? horas.filter((h) => enCelda.has(celda(h, z.central.id))).map((h) => ({ hora: h, ficha: enCelda.get(celda(h, z.central.id)) })) : [],
        nombreCompleta: z.central?.nombre ?? null,
      };
    })
    .filter((z) => z.completas.length || z.filas.some((f) => f.fichas.some(Boolean)));
  return { zonas, notas };
}
