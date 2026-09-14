// ASIGNAR PISTAS (27-11) — la página asignar.html (site/paginas.mjs → paginaAsignar).
//
// Un CUADRANTE por campo y día: filas = horas, columnas = pistas (en zonas). Las fichas son los
// partidos de la web y los entrenos que se añaden a mano. Se colocan de dos formas, que valen igual en
// el móvil y en el PC: TOCAR una ficha (queda elegida) y luego su pista; o ARRASTRARLA. Tocar una pista
// ocupada cambia las dos de sitio. Lo colocado y los textos se guardan en ESTE navegador
// (localStorage): la web es estática y no tiene dónde guardarlo para todos.
import {
  alternarCompleta, campoAsignar, celda, colocacionInicial, franjaDe, columnasDeZona, pistasDe, nombrePista, partesCelda, pistaDeFab, diaPorDefecto, fechaCorta, horaCorta, horasDe, mover, nombreFichero,
  notaPorDefecto, repartir, subtituloCartel, tablaDelCartel, tituloCartel,
} from './datos.mjs';
import { cargarRecursos, pintarCartel } from './pintar.mjs';

const DATOS = JSON.parse(document.getElementById('asignar-datos').textContent);
const RAIZ = new URL('../', import.meta.url);
const $ = (id) => document.getElementById(id);
const avisar = (texto) => { const a = $('asignar-choques'); a.hidden = false; a.textContent = texto; };

// ── Lo guardado ─────────────────────────────────────────────────────────────────────────────────
// { tableros: { 'campo|fecha': { colocacion, horas, entrenos: { id: {nombre, debajo} }, nota } },
//   textos: { equipo: { nombre, debajo } } } — los textos de un equipo valen para todos sus partidos.
const CLAVE = 'cbelpalo.asignar';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { return {}; } };
const guardado = { tableros: {}, textos: {}, ...leer() };
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(guardado)); } catch { /* sin almacenamiento: sigue sin recordar */ } };

let campo = campoAsignar(document.querySelector('input[name="campo"]:checked')?.value);
let fecha = '';
let elegida = null; // id de la ficha elegida (tocar y luego su pista)

const diasDelCampo = () => DATOS.partidos[campo.id] ?? {};
const partidos = () => diasDelCampo()[fecha] ?? [];
const claveTablero = () => `${campo.id}|${fecha}`;
function tablero() {
  const k = claveTablero();
  // v5 (27-11): filas por franjas (la hora de la franja, a 2 h de la anterior) y, si dos quieren la misma pista, la del
  // género: lo guardado antes se rehace.
  if (guardado.tableros[k]?.v !== 5) guardado.tableros[k] = { v: 5, colocacion: colocacionInicial(partidos(), campo), horas: [], entrenos: {} };
  return guardado.tableros[k];
}

/** Todas las fichas del día: { id → { id, nombre, debajo, entreno, meta, equipo } }. */
function fichas() {
  const t = tablero();
  const salida = {};
  for (const p of partidos()) {
    const propio = guardado.textos[p.equipo] ?? {};
    salida[p.id] = {
      id: p.id, equipo: p.equipo, entreno: false, esperada: pistaDeFab(campo, p.fab), hora: p.hora,
      nombre: propio.nombre ?? p.nombre, debajo: propio.debajo ?? p.debajo,
      meta: [p.hora ? horaCorta(p.hora) : 'sin hora', p.rival && `vs ${p.rival}`].filter(Boolean).join(' · '),
    };
  }
  for (const [id, e] of Object.entries(t.entrenos)) salida[id] = { id, entreno: true, nombre: e.nombre, debajo: e.debajo, meta: 'Entreno' };
  return salida;
}

const nota = () => {
  const t = tablero();
  // Vacía por defecto (27-11, Luismi): la sugerencia («DOMINGO 29 · Sin partidos…») solo va de ejemplo en los campos.
  return t.nota ?? null;
};

// ── Pintar la página ────────────────────────────────────────────────────────────────────────────
function nodoFicha(f, donde = null, estirar = null, conHora = false) {
  const nodo = $('ficha-plantilla').content.firstElementChild.cloneNode(true);
  nodo.dataset.id = f.id;
  nodo.classList.toggle('ficha--entreno', f.entreno);
  nodo.querySelector('.ficha__nombre').textContent = f.nombre || '—';
  nodo.querySelector('.ficha__debajo').textContent = f.debajo;
  nodo.querySelector('.ficha__meta').textContent = f.meta;
  // Fuera de la pista que dice la FAB: asterisco y la nota (27-11, Luismi).
  const pista = donde ? partesCelda(donde).pista : null;
  // En una franja con horas distintas, cada ficha lleva su cuadrado de hora (27-11, Luismi).
  // Solo si no empieza a la hora de la franja (27-11, Luismi: «si corresponde con la oficial, no necesito la hora dentro»).
  if (conHora && f.hora && f.hora !== partesCelda(donde).hora) nodo.prepend(Object.assign(document.createElement('span'), { className: 'ficha__hora', textContent: horaCorta(f.hora || partesCelda(donde).hora) }));
  if (pista && f.esperada && f.esperada !== pista) {
    nodo.classList.add('ficha--movida');
    nodo.querySelector('.ficha__nombre').textContent += ' *';
    nodo.querySelector('.ficha__nota').textContent = `* FAB: ${nombrePista(campo, f.esperada)}`;
  }
  // Asa para ampliar a pista completa o devolverla (La Mosca): en el borde que da a la otra pista; en la completa, en los dos.
  for (const lado of estirar === 'ambos' ? ['izquierda', 'derecha'] : estirar ? [estirar] : []) {
    const asa = document.createElement('button');
    asa.type = 'button';
    asa.className = `ficha__estirar ficha__estirar--${lado}`;
    asa.dataset.lado = lado;
    asa.draggable = false;
    const texto = estirar === 'ambos' ? `Devolver a la ${lado === 'izquierda' ? 'primera' : 'última'} pista (arrastra hacia dentro o toca)` : 'Ampliar a pista completa (arrastra hacia la otra pista o toca)';
    asa.title = texto;
    asa.setAttribute('aria-label', `${texto}: ${f.nombre}`);
    nodo.append(asa);
  }
  const boton = nodo.querySelector('.ficha__elegir');
  boton.setAttribute('aria-pressed', String(elegida === f.id));
  boton.setAttribute('aria-label', `${f.nombre}, ${f.debajo}${f.meta ? `, ${f.meta}` : ''}`);
  nodo.querySelector('.ficha__editar').setAttribute('aria-label', `Editar ${f.nombre}`);
  return nodo;
}

function pintar() {
  const t = tablero();
  const todas = fichas();
  // Una colocación que apunte a una ficha que ya no existe (partido aplazado) se olvida.
  for (const id of Object.keys(t.colocacion)) if (!todas[id]) delete t.colocacion[id];
  if (elegida && !todas[elegida]) elegida = null;
  document.body.classList.toggle('asignar--eligiendo', Boolean(elegida));
  // Un campo sin partidos ese día no se puede elegir (27-11, Luismi).
  document.querySelectorAll('input[name="campo"]').forEach((r) => {
    const vacio = r.value !== campo.id && !(DATOS.partidos[r.value]?.[fecha]?.length);
    r.disabled = vacio;
    const etiqueta = document.querySelector(`label[for="${r.id}"]`);
    if (etiqueta) etiqueta.title = vacio ? 'Ese día no hay partidos en este campo' : '';
  });

  // Sin pista.
  const bandeja = $('asignar-bandeja');
  bandeja.querySelectorAll('.ficha').forEach((n) => n.remove());
  const sueltas = Object.values(todas).filter((f) => !t.colocacion[f.id]);
  for (const f of sueltas) bandeja.append(nodoFicha(f));
  $('asignar-vacia').hidden = sueltas.length > 0;
  $('asignar-cuenta').textContent = sueltas.length ? `(${sueltas.length})` : '';
  // Con todo repartido, fuera el botón (27-11, Luismi).
  $('asignar-repartir').hidden = !sueltas.some((f) => !f.entreno && partidos().find((p) => p.id === f.id)?.hora);

  // El cuadrante: una rejilla por zona.
  const horas = horasDe(partidos(), t.horas);
  const enCelda = new Map(Object.entries(t.colocacion).map(([id, c]) => [c, todas[id]]));
  const cuadrante = $('asignar-cuadrante');
  cuadrante.replaceChildren();
  if (!horas.length) {
    const p = document.createElement('p');
    p.className = 'asignar__nada';
    p.textContent = partidos().length ? 'Los partidos de este día aún no tienen hora: añade una fila con «Otra hora».' : `No hay partidos este día en ${campo.corto}. Puedes añadir una hora y entrenos.`;
    cuadrante.append(p);
  }
  // Filas del cuadrante: las horas con algo en las columnas (o por colocar, o añadidas). Una hora que solo tiene un
  // partido a pista completa no hace fila: ese va en su lista, debajo.
  const completasDe = (z) => (z.central ? horas.filter((h) => enCelda.has(celda(h, z.central.id))) : []);
  const soloCompleta = new Set(campo.zonas.flatMap(completasDe).filter((h) => {
    const enColumna = pistasDe(campo).some((p) => enCelda.has(celda(h, p.id)));
    const porColocar = sueltas.some((f) => !f.entreno && partidos().find((p) => p.id === f.id)?.hora === h);
    return !enColumna && !porColocar && !t.horas.includes(h);
  }));
  const filas = horas.filter((h) => !soloCompleta.has(h));
  // Franjas con partidos que empiezan a horas distintas: ahí cada ficha lleva su hora.
  const mixtas = new Set(filas.filter((h) => new Set(pistasDe(campo).map((p) => enCelda.get(celda(h, p.id))).filter(Boolean).map((f) => f.hora || h)).size > 1));
  for (const z of campo.zonas) {
    if (!horas.length) break;
    const columnas = columnasDeZona(z);
    const titulo = document.createElement('h2');
    titulo.className = 'asignar__zona';
    titulo.textContent = z.nombre;
    const rejilla = document.createElement('div');
    rejilla.className = 'cuadrante';
    rejilla.style.gridTemplateColumns = `var(--col-hora) ${columnas.map((x) => (x.tipo === 'hueco' ? 'var(--col-hueco)' : 'minmax(var(--col-min), 1fr)')).join(' ')}`;
    rejilla.setAttribute('role', 'group');
    rejilla.setAttribute('aria-label', z.nombre);
    rejilla.append(Object.assign(document.createElement('span'), { className: 'cuadrante__esquina' }));
    for (const x of columnas) {
      const cab = Object.assign(document.createElement('span'), { className: `cuadrante__pista${x.tipo === 'hueco' ? ' cuadrante__pista--hueco' : ''}`, textContent: x.tipo === 'hueco' ? 'P2' : x.nombre });
      if (x.tipo === 'hueco') { cab.title = `${x.nombre}: ${x.nota} (no se juega)`; cab.setAttribute('aria-label', `${x.nombre}, ${x.nota}: no se juega`); }
      rejilla.append(cab);
    }
    for (const h of filas) {
      rejilla.append(Object.assign(document.createElement('span'), { className: 'cuadrante__hora', textContent: horaCorta(h) }));
      for (const x of columnas) {
        if (x.tipo === 'hueco') { rejilla.append(Object.assign(document.createElement('span'), { className: 'cuadrante__hueco' })); continue; }
        const c = celda(h, x.id);
        const caja = document.createElement('div');
        caja.className = 'cuadrante__celda';
        caja.dataset.destino = c;
        const f = enCelda.get(c);
        if (f) caja.append(nodoFicha(f, c, z.central ? (x.id === z.pistas[0].id ? 'derecha' : 'izquierda') : null, mixtas.has(h)));
        else {
          const libre = document.createElement('button');
          libre.type = 'button';
          libre.className = 'cuadrante__libre';
          libre.dataset.poner = c;
          libre.setAttribute('aria-label', `Pista libre: ${x.nombre}, ${horaCorta(h)}`);
          caja.append(libre);
        }
        rejilla.append(caja);
      }
    }
    // Pista central (27-11, Luismi): en la misma rejilla, debajo, con su cabecera naranja como la 1 y la 3 y cada partido a
    // todo el ancho de las pistas; al final, un hueco libre para soltar otro.
    if (z.central) {
      const todo = '2 / -1';
      rejilla.append(Object.assign(document.createElement('span'), { className: 'cuadrante__esquina' }));
      const cab = Object.assign(document.createElement('span'), { className: 'cuadrante__pista cuadrante__pista--central', textContent: z.central.nombre });
      cab.style.gridColumn = todo;
      rejilla.append(cab);
      for (const h of completasDe(z)) {
        rejilla.append(Object.assign(document.createElement('span'), { className: 'cuadrante__hora', textContent: horaCorta(h) }));
        const caja = document.createElement('div');
        caja.className = 'cuadrante__celda';
        caja.style.gridColumn = todo;
        caja.dataset.destino = celda(h, z.central.id);
        caja.append(nodoFicha(enCelda.get(caja.dataset.destino), caja.dataset.destino, 'ambos'));
        rejilla.append(caja);
      }
      rejilla.append(Object.assign(document.createElement('span'), { className: 'cuadrante__esquina' }));
      const caja = document.createElement('div');
      caja.className = 'cuadrante__celda';
      caja.style.gridColumn = todo;
      caja.dataset.destino = `completa|${z.central.id}`;
      const libre = document.createElement('button');
      libre.type = 'button';
      libre.className = 'cuadrante__libre cuadrante__libre--central';
      libre.dataset.poner = caja.dataset.destino;
      libre.textContent = 'Suelta aquí un partido para jugarlo en la pista central (o estira su ficha)';
      caja.append(libre);
      rejilla.append(caja);
    }
    cuadrante.append(titulo, rejilla);
  }

  $('asignar-choques').hidden = true;
  const n = nota();
  $('asignar-nota-titulo').value = n?.titulo ?? '';
  $('asignar-nota-texto').value = n?.texto ?? '';
  const ejemplo = notaPorDefecto(fecha, campo, diasDelCampo());
  $('asignar-nota-titulo').placeholder = ejemplo?.titulo ?? 'Por ejemplo: DOMINGO 29';
  $('asignar-nota-texto').placeholder = ejemplo?.texto ?? 'Por ejemplo: Sin partidos en el campo';
  programarImagen();
}

function pintarDias() {
  const dias = Object.keys(diasDelCampo()).sort();
  if (!dias.includes(fecha)) fecha = diaPorDefecto(diasDelCampo(), DATOS.hoy);
  if (!dias.includes(fecha)) dias.push(fecha);
  $('asignar-dia').replaceChildren(...dias.sort().map((d) => {
    const n = (diasDelCampo()[d] ?? []).length;
    return new Option(`${fechaCorta(d)}${d === DATOS.hoy ? ' (hoy)' : ''} · ${n} ${n === 1 ? 'partido' : 'partidos'}`, d, false, d === fecha);
  }));
}

// ── Colocar ─────────────────────────────────────────────────────────────────────────────────────
function colocar(id, destino) {
  const t = tablero();
  // La lista de pista completa: a su hora (la de su fila si ya estaba colocado; si no, la del partido).
  if (destino?.startsWith('completa|')) {
    const suya = partidos().find((p) => p.id === id)?.hora;
    const hora = (t.colocacion[id] ? partesCelda(t.colocacion[id]).hora : '') || (suya && franjaDe(suya, partidos(), t.horas));
    if (!hora) { avisar('Este no tiene hora: ponlo primero en una fila'); return; }
    destino = celda(hora, destino.split('|')[1]);
  }
  t.colocacion = mover(t.colocacion, id, destino || null, campo);
  elegida = null;
  guardar();
  pintar();
}

document.addEventListener('click', (ev) => {
  const editar = ev.target.closest('.ficha__editar');
  if (editar) { abrirFicha(editar.closest('.ficha').dataset.id); return; }
  const ficha = ev.target.closest('.ficha__elegir');
  if (ficha) {
    const id = ficha.closest('.ficha').dataset.id;
    const destino = ficha.closest('[data-destino]')?.dataset.destino;
    // Con otra elegida, tocar una ficha colocada = poner la elegida en su sitio (se cambian).
    if (elegida && elegida !== id && destino) { colocar(elegida, destino); return; }
    elegida = elegida === id ? null : id;
    pintar();
    document.querySelector(`.ficha[data-id="${CSS.escape(id)}"] .ficha__elegir`)?.focus();
    return;
  }
  const libre = ev.target.closest('[data-poner]');
  if (libre && elegida) { colocar(elegida, libre.dataset.poner); return; }
  // Con una elegida, tocar la bandeja la deja sin pista.
  if (elegida && ev.target.closest('#asignar-bandeja')) colocar(elegida, null);
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && elegida && !$('ficha-dialogo').open) { elegida = null; pintar(); } });

// Arrastrar (ratón): la ficha a una celda o a la bandeja.
document.addEventListener('dragstart', (ev) => {
  const f = ev.target.closest?.('.ficha');
  if (estirando || ev.target.closest?.('.ficha__estirar')) { ev.preventDefault(); return; }
  if (!f) return;
  ev.dataTransfer.setData('text/plain', f.dataset.id);
  ev.dataTransfer.effectAllowed = 'move';
  f.classList.add('ficha--arrastrando');
});
document.addEventListener('dragend', (ev) => ev.target.closest?.('.ficha')?.classList.remove('ficha--arrastrando'));
const destinoDe = (ev) => ev.target.closest?.('[data-destino]');
document.addEventListener('dragover', (ev) => { const d = destinoDe(ev); if (d) { ev.preventDefault(); d.classList.add('sobre'); } });
document.addEventListener('dragleave', (ev) => destinoDe(ev)?.classList.remove('sobre'));
document.addEventListener('drop', (ev) => {
  const d = destinoDe(ev);
  if (!d) return;
  ev.preventDefault();
  d.classList.remove('sobre');
  const id = ev.dataTransfer.getData('text/plain');
  if (id && fichas()[id]) colocar(id, d.dataset.destino);
});


// ── Ampliar a pista completa (27-11, Luismi) ─────────────────────────────────────────────────────
// El asa del borde de la ficha: se arrastra hacia la otra pista (la ficha crece mientras) y, al soltar pasado el 40 % de
// la columna, el partido pasa a pista completa; en la completa, arrastrar hacia dentro la devuelve a ese lado. Un toque
// (o Intro) amplía o devuelve sin arrastrar.
const zonaCentralDe = (pista) => campo.zonas.find((z) => z.central && (z.central.id === pista || z.pistas.some((p) => p.id === pista)));
function estirar(id, lado, movimiento = null) {
  const t = tablero();
  const c = t.colocacion[id];
  if (!c) return;
  const { pista } = partesCelda(c);
  const z = zonaCentralDe(pista);
  if (!z) return;
  const completa = pista === z.central.id;
  if (movimiento) {
    const crece = lado === 'derecha' ? movimiento.dx : -movimiento.dx;
    if (completa ? crece > -movimiento.ancho * 0.25 : crece < movimiento.ancho * 0.4) return; // no llegó: se queda
  }
  const f = fichas()[id];
  const hacia = completa && movimiento ? (lado === 'derecha' ? z.pistas[0].id : z.pistas.at(-1).id) : null;
  t.colocacion = alternarCompleta(t.colocacion, id, campo, { hacia, esperada: f?.esperada, genero: partidos().find((p) => p.id === id)?.genero });
  elegida = null;
  guardar();
  pintar();
}
let estirando = null;
document.addEventListener('pointerdown', (ev) => {
  const asa = ev.target.closest?.('.ficha__estirar');
  if (!asa || ev.button !== 0) return;
  ev.preventDefault();
  const ficha = asa.closest('.ficha');
  estirando = { asa, ficha, id: ficha.dataset.id, lado: asa.dataset.lado, x0: ev.clientX, ancho: ficha.parentElement.getBoundingClientRect().width, dx: 0 };
  asa.setPointerCapture(ev.pointerId);
  ficha.classList.add('ficha--estirando');
});
document.addEventListener('pointermove', (ev) => {
  if (!estirando) return;
  const e = estirando;
  e.dx = ev.clientX - e.x0;
  const crece = e.lado === 'derecha' ? e.dx : -e.dx;
  e.ficha.style.width = `${Math.max(48, e.ancho + crece)}px`;
  if (e.lado === 'izquierda') e.ficha.style.marginLeft = `${-crece}px`;
});
const soltarAsa = (ev) => {
  if (!estirando) return;
  const e = estirando;
  estirando = null;
  e.ficha.style.width = '';
  e.ficha.style.marginLeft = '';
  e.ficha.classList.remove('ficha--estirando');
  if (ev.type === 'pointercancel') return;
  estirar(e.id, e.lado, Math.abs(e.dx) > 6 ? { dx: e.dx, ancho: e.ancho } : null);
};
document.addEventListener('pointerup', soltarAsa);
document.addEventListener('pointercancel', soltarAsa);
// Con el teclado (Intro o espacio en el asa): amplía o devuelve.
document.addEventListener('click', (ev) => {
  const asa = ev.target.closest?.('.ficha__estirar');
  if (asa && ev.detail === 0) estirar(asa.closest('.ficha').dataset.id, asa.dataset.lado);
});

$('asignar-repartir').addEventListener('click', () => {
  const t = tablero();
  t.colocacion = repartir(partidos(), campo, t.colocacion, t.horas);
  guardar();
  pintar();
});

$('asignar-entreno').addEventListener('click', () => {
  const id = `entreno-${Date.now().toString(36)}`;
  tablero().entrenos[id] = { nombre: '', debajo: '' };
  guardar();
  pintar();
  abrirFicha(id, true);
});

$('asignar-hora').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const h = $('asignar-hora-nueva').value;
  if (!/^\d\d:\d\d$/.test(h)) return;
  const t = tablero();
  if (!horasDe(partidos(), t.horas).includes(h)) t.horas.push(h);
  $('asignar-hora-nueva').value = '';
  guardar();
  pintar();
});

for (const id of ['asignar-nota-titulo', 'asignar-nota-texto']) {
  $(id).addEventListener('input', () => {
    const titulo = $('asignar-nota-titulo').value.trim();
    const texto = $('asignar-nota-texto').value.trim();
    tablero().nota = titulo || texto ? { titulo, texto } : null;
    guardar();
    programarImagen();
  });
}

$('asignar-cero').addEventListener('click', () => {
  const t = tablero();
  const hay = Object.keys(t.colocacion).length || Object.keys(t.entrenos).length || t.horas.length;
  if (hay && !window.confirm('¿Quitar todo lo colocado este día, los entrenos y las horas añadidas?')) return;
  delete guardado.tableros[claveTablero()];
  elegida = null;
  guardar();
  pintar();
});

document.querySelectorAll('input[name="campo"]').forEach((r) => r.addEventListener('change', () => {
  campo = campoAsignar(r.value);
  elegida = null;
  pintarDias();
  pintar();
}));
$('asignar-dia').addEventListener('change', (ev) => { fecha = ev.target.value; elegida = null; pintar(); });

// ── Editar una ficha ────────────────────────────────────────────────────────────────────────────
let editando = null;
function abrirFicha(id, nuevo = false) {
  const f = fichas()[id];
  if (!f) return;
  editando = id;
  $('ficha-titulo').textContent = f.entreno ? (nuevo ? 'Nuevo entreno' : 'Entreno') : 'Partido';
  $('ficha-partido').textContent = f.entreno ? 'Ponle quién entrena y qué equipo; luego colócalo en su pista.' : f.meta;
  $('ficha-nombre').value = f.nombre;
  $('ficha-debajo').value = f.debajo;
  $('ficha-nombre').placeholder = f.entreno ? 'ANA M.' : '';
  $('ficha-debajo').placeholder = f.entreno ? 'Minibasket Fem' : '';
  $('ficha-recuerda').hidden = f.entreno;
  $('ficha-borrar').hidden = !f.entreno;
  $('ficha-quitar').hidden = !tablero().colocacion[id];
  $('ficha-dialogo').showModal();
  $('ficha-nombre').focus();
}
$('ficha-dialogo').addEventListener('close', () => {
  const accion = $('ficha-dialogo').returnValue;
  const id = editando;
  editando = null;
  const t = tablero();
  const f = fichas()[id];
  if (!f) return;
  if (accion === 'borrar' && f.entreno) { delete t.entrenos[id]; delete t.colocacion[id]; }
  if (accion === 'quitar') t.colocacion = mover(t.colocacion, id, null);
  if (accion === 'guardar') {
    const textos = { nombre: $('ficha-nombre').value.trim(), debajo: $('ficha-debajo').value.trim() };
    if (f.entreno) t.entrenos[id] = textos;
    else guardado.textos[f.equipo] = textos;
  }
  // Un entreno nuevo que se cierra sin nombre no se queda vacío en la bandeja.
  if (f.entreno && t.entrenos[id] && !t.entrenos[id].nombre && !t.entrenos[id].debajo) { delete t.entrenos[id]; delete t.colocacion[id]; }
  guardar();
  pintar();
});

// ── La imagen ───────────────────────────────────────────────────────────────────────────────────
let recursos = null;
let archivo = null;
let temporizador = 0;
function datosCartel() {
  const t = tablero();
  return {
    titulo: tituloCartel(fecha),
    subtitulo: subtituloCartel(fecha, campo),
    pie: `Coordinación Deportiva · ${DATOS.club}`,
    ...tablaDelCartel(campo, horasDe(partidos(), t.horas), t.colocacion, fichas()),
    nota: nota(),
  };
}
function programarImagen() {
  clearTimeout(temporizador);
  archivo = null;
  temporizador = setTimeout(generar, 250);
}
async function generar() {
  recursos ??= await cargarRecursos(RAIZ);
  const datos = datosCartel();
  const sueltos = partidos().filter((p) => !tablero().colocacion[p.id]).length;
  const aviso = $('asignar-aviso');
  aviso.hidden = !sueltos && datos.zonas.length > 0;
  aviso.textContent = !datos.zonas.length ? 'Coloca al menos un partido o entreno para que el cartel tenga algo.' : `${sueltos} ${sueltos === 1 ? 'partido se queda' : 'partidos se quedan'} fuera del cartel: no ${sueltos === 1 ? 'tiene' : 'tienen'} pista.`;
  const canvas = pintarCartel(document.createElement('canvas'), datos, recursos);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  if (!blob) return;
  archivo = new File([blob], nombreFichero(fecha, campo), { type: 'image/png' });
  const img = $('asignar-previa');
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.width = canvas.width;
  img.height = canvas.height;
  img.src = URL.createObjectURL(blob);
  $('asignar-compartir').hidden = !navigator.canShare?.({ files: [archivo] });
}
$('asignar-descargar').addEventListener('click', async () => {
  if (!archivo) { clearTimeout(temporizador); await generar(); }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(archivo), download: archivo.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
});
// Compartir solo con la imagen ya hecha: el navegador solo deja compartir dentro del gesto.
$('asignar-compartir').addEventListener('click', () => { if (archivo) navigator.share({ files: [archivo] }).catch(() => {}); });

pintarDias();
pintar();
