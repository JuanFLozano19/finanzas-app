// Pantallas de las herramientas: escáner de recibos, buscador general, importar extractos,
// cierre de semestre, copias de seguridad, ahorro por redondeo, comparación de meses y copiar semana.
import { h, fill, dialogo, toast, confirmar, money } from './dom.js';
import { icono } from './iconos.js';
import { fmtDate, fmtMoney, today, addDays, startOfWeek, monthLabel } from '../core/format.js';
import { CATEGORIAS } from '../config.js';
import {
  extraerTotal, buscar, detectarColumnas, filasAMovimientos, lineasAMovimientos,
} from '../domain/herramientas.js';
import { nuevoMovimiento } from './views/movimientos.js';

const CDN = {
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js',
  pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs',
};

const cabecera = (titulo, d) => h('div', { class: 'sheet-head' }, h('h2', {}, titulo),
  h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: () => d().close() }, '✕'));

// ================= Escáner de recibos =================
/** Achica y pasa a gris la foto: el OCR es más rápido y acierta más. */
async function prepararImagen(file) {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
  const g = c.getContext('2d');
  g.filter = 'grayscale(1) contrast(1.35)';
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

export function abrirEscaner(ctx, recargar) {
  let d;
  const barra = h('div', { class: 'progress' }, h('div', { class: 'progress-fill', style: 'width:0%' }));
  const estado = h('p', { class: 'muted small center' }, 'Funciona mejor con buena luz y el recibo derecho.');
  const vista = h('label', { class: 'scan-drop' },
    h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr-only', onchange: (e) => leer(e.target.files[0]) }),
    h('span', { class: 'scan-drop-ico' }, icono('camara', { size: 30 })),
    h('strong', {}, 'Tomar foto o elegir imagen'),
    h('small', { class: 'muted' }, 'Rumbo lee el total y te deja el gasto listo para revisar'));

  async function leer(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    fill(vista, h('div', { class: 'scan-preview' }, h('img', { src: url, alt: 'Recibo' }), h('i', { class: 'scan-line' })));
    estado.textContent = 'Preparando el lector…';
    estado.before(barra);
    try {
      const [{ default: Tesseract }, imagen] = await Promise.all([import(CDN.tesseract), prepararImagen(file)]);
      const worker = await Tesseract.createWorker('spa', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') { estado.textContent = `Leyendo el recibo… ${Math.round(m.progress * 100)} %`; barra.firstChild.style.width = `${Math.round(m.progress * 100)}%`; }
          else if (/loading|initializ/.test(m.status)) estado.textContent = 'Descargando el lector (solo la primera vez)…';
        },
      });
      const { data } = await worker.recognize(imagen);
      await worker.terminate();
      const r = extraerTotal(data.text);
      d.close();
      if (!r.monto) toast('No encontré el total. Escríbelo tú y listo.', 'error');
      else toast(`Encontré ${fmtMoney(r.monto)} · revisa y guarda`);
      nuevoMovimiento(ctx, 'gasto', recargar, {
        ...(r.monto ? { monto: r.monto } : {}),
        ...(r.fecha && r.fecha <= today() ? { fecha: r.fecha } : {}),
        categoria: CATEGORIAS.gasto.includes(r.categoria) ? r.categoria : 'Otros',
        descripcion: r.comercio,
      });
    } catch (e) {
      estado.textContent = 'No pude leer la foto. Revisa tu conexión e inténtalo otra vez.';
      console.error(e);
    } finally { URL.revokeObjectURL(url); }
  }

  d = dialogo(h('div', { class: 'sheet-body' }, cabecera('Escanear recibo', () => d), vista, estado));
}

// ================= Buscador general =================
export function abrirBuscador(buscador, irA) {
  let d; let resultados = []; let activo = 0;
  const lista = h('ul', { class: 'search-results', role: 'listbox' });
  const input = h('input', {
    type: 'search', class: 'search-input', placeholder: 'Busca tareas, notas, gastos, materias…', autocomplete: 'off', 'aria-label': 'Buscar',
    oninput: () => pintar(), onkeydown: (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); activo = Math.min(resultados.length - 1, activo + 1); marcar(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); activo = Math.max(0, activo - 1); marcar(); }
      if (e.key === 'Enter' && resultados[activo]) ir(resultados[activo]);
    },
  });
  let indice = null;
  const cargando = buscador.indice().then((i) => { indice = i; pintar(); }).catch(() => { indice = []; pintar(); });

  const ir = (r) => { d.close(); irA(r.ruta); };
  const marcar = () => lista.querySelectorAll('.search-item').forEach((el, i) => {
    el.classList.toggle('activo', i === activo);
    if (i === activo) el.scrollIntoView({ block: 'nearest' });
  });

  function pintar() {
    const q = input.value.trim();
    if (!indice) { fill(lista, h('li', { class: 'search-hint' }, 'Preparando el buscador…')); return; }
    if (!q) {
      resultados = [];
      fill(lista, h('li', { class: 'search-hint' }, h('span', {}, 'Prueba con '),
        ['almuerzo', 'parcial', 'robots', 'EDO'].map((s) => h('button', { class: 'chip', onclick: () => { input.value = s; pintar(); input.focus(); } }, s))));
      return;
    }
    resultados = buscar(indice, q);
    activo = 0;
    fill(lista, resultados.length
      ? resultados.map((r, i) => h('li', {}, h('button', { class: `search-item ${i === 0 ? 'activo' : ''}`, role: 'option', onclick: () => ir(r) },
        h('span', { class: 'search-ico' }, icono(r.ico, { size: 18 })),
        h('span', { class: 'grow' }, h('strong', {}, r.titulo), r.detalle ? h('small', { class: 'muted' }, r.detalle.slice(0, 90)) : null),
        h('span', { class: 'search-tipo' }, r.tipo))))
      : h('li', { class: 'search-hint' }, `Nada con “${q}”. Prueba con otra palabra.`));
  }

  d = dialogo(h('div', { class: 'sheet-body search-sheet' },
    h('div', { class: 'search-bar' }, icono('buscar', { size: 20 }), input,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: () => d.close() }, '✕')),
    lista,
    h('p', { class: 'muted small search-foot' }, '↑ ↓ para moverte · Enter para abrir · Ctrl + K desde cualquier pantalla')));
  d.classList.add('top');
  pintar();
  cargando.finally(() => input.focus());
  setTimeout(() => input.focus(), 30);
}

// ================= Importar extracto =================
async function leerPdf(buffer, password) {
  const pdfjs = await import(CDN.pdf);
  pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
  const doc = await pdfjs.getDocument({ data: buffer, password }).promise;
  const lineas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    const filas = new Map();
    for (const it of items) {
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!filas.has(y)) filas.set(y, []);
      filas.get(y).push(it);
    }
    [...filas.entries()].sort((a, b) => b[0] - a[0])
      .forEach(([, its]) => lineas.push(its.sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join(' ')));
  }
  return lineas.join('\n');
}

export function abrirImportar(ctx, recargar) {
  const { importar, plata } = ctx;
  let d; let movs = []; let cuentas = [];
  plata.listaCuentas().then((c) => { cuentas = c.filter((x) => x.activa); }).catch(() => {});
  const cuerpo = h('div', { class: 'import-body' });
  const elegir = h('label', { class: 'scan-drop' },
    h('input', { type: 'file', accept: '.csv,.xlsx,.xls,.pdf,text/csv,application/pdf', class: 'sr-only', onchange: (e) => abrir(e.target.files[0]) }),
    h('span', { class: 'scan-drop-ico' }, icono('importar', { size: 30 })),
    h('strong', {}, 'Elegir el extracto'),
    h('small', { class: 'muted' }, 'Excel o CSV del banco, o el PDF de Nequi'));
  fill(cuerpo, elegir, h('p', { class: 'muted small' }, 'Antes de importar ves la lista y quitas lo que no quieras. Lo que ya tengas registrado se marca como repetido.'));

  async function abrir(file, password) {
    if (!file) return;
    fill(cuerpo, h('p', { class: 'muted center' }, `Leyendo ${file.name}…`));
    try {
      const buffer = await file.arrayBuffer();
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        const texto = await leerPdf(buffer, password);
        await revisar(lineasAMovimientos(texto), file.name);
      } else {
        const XLSX = await import(CDN.xlsx);
        // En CSV leemos todo como texto: así "05/11/2026" no se vuelve fecha gringa ni "-32.500" se vuelve -32,5.
        const esCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
        const wb = esCsv
          ? XLSX.read(new TextDecoder(/\uFFFD/.test(new TextDecoder().decode(buffer)) ? 'latin1' : 'utf-8').decode(buffer), { type: 'string', raw: true })
          : XLSX.read(buffer, { type: 'array', cellDates: true });
        const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
        mapear(filas, file.name);
      }
    } catch (e) {
      if (e?.name === 'PasswordException') {
        const pass = h('input', { type: 'password', class: 'input', placeholder: 'Contraseña del PDF', autocomplete: 'off' });
        fill(cuerpo, h('p', {}, 'Ese PDF tiene contraseña. En Nequi suele ser tu número de cédula.'), pass,
          h('div', { class: 'sheet-actions' }, h('span'), h('button', { class: 'btn primary', onclick: () => abrir(file, pass.value) }, 'Abrir')));
        pass.focus();
        return;
      }
      fill(cuerpo, elegir, h('p', { class: 'form-error' }, `No pude leer ese archivo (${e.message}).`));
    }
  }

  function mapear(filas, nombre) {
    // Busca la fila de encabezados: la primera que tenga fecha y algún valor.
    let fila = filas.slice(0, 25).findIndex((f) => { const c = detectarColumnas(f.map(String)); return c.fecha != null && (c.valor ?? c.debito ?? c.credito) != null; });
    if (fila < 0) fila = 0;
    const encabezados = filas[fila].map((x, i) => String(x || `Columna ${i + 1}`));
    const cols = detectarColumnas(encabezados);
    const datos = filas.slice(fila + 1);
    const opciones = (sel) => [h('option', { value: '' }, '—'), ...encabezados.map((e, i) => h('option', { value: i, selected: sel === i }, e))];
    const selects = {};
    const campo = (k, label) => h('label', { class: 'field' }, h('span', {}, label),
      selects[k] = h('select', { onchange: () => { cols[k] = selects[k].value === '' ? null : Number(selects[k].value); } }, opciones(cols[k])));
    fill(cuerpo,
      h('p', { class: 'muted small' }, `${nombre}: revisa que cada dato venga de la columna correcta.`),
      h('div', { class: 'grid-2' }, campo('fecha', 'Fecha'), campo('descripcion', 'Descripción'), campo('valor', 'Valor (con signo)'),
        campo('debito', 'Débito / salida'), campo('credito', 'Crédito / entrada')),
      h('div', { class: 'sheet-actions' }, h('button', { class: 'btn ghost', onclick: () => fill(cuerpo, elegir) }, 'Otro archivo'),
        h('button', { class: 'btn primary', onclick: () => revisar(filasAMovimientos(datos, cols), nombre) }, 'Ver movimientos')));
  }

  async function revisar(lista, nombre) {
    if (!lista.length) { fill(cuerpo, elegir, h('p', { class: 'form-error' }, `No encontré movimientos en ${nombre}. Si es un PDF escaneado (foto), mejor descarga el Excel del banco.`)); return; }
    movs = (await importar.revisar(lista)).map((m) => ({ ...m, incluir: !m.duplicado }));
    pintarLista();
  }

  function pintarLista() {
    const cuenta = h('select', {}, h('option', { value: '' }, '— Sin cuenta —'), cuentas.map((c) => h('option', { value: c.id }, `${c.icono} ${c.nombre}`)));
    const btn = h('button', { class: 'btn primary' });
    const contar = () => { const n = movs.filter((m) => m.incluir).length; btn.textContent = n ? `Importar ${n}` : 'Nada para importar'; btn.disabled = !n; };
    const rep = movs.filter((m) => m.duplicado).length;
    fill(cuerpo,
      h('p', { class: 'small' }, `${movs.length} movimientos encontrados${rep ? ` · ${rep} ya estaban y quedaron sin marcar` : ''}.`),
      h('ul', { class: 'import-list' }, movs.map((m) => h('li', { class: m.duplicado ? 'dup' : '' }, h('label', { class: 'import-row' },
        h('input', { type: 'checkbox', checked: m.incluir, onchange: (e) => { m.incluir = e.target.checked; contar(); } }),
        h('span', { class: 'grow' }, h('strong', {}, m.descripcion || m.categoria),
          h('small', { class: 'muted' }, `${fmtDate(m.fecha)} · ${m.categoria}${m.duplicado ? ' · repetido' : ''}`)),
        money(m.tipo === 'gasto' ? -m.monto : m.monto, m.tipo === 'gasto' ? 'neg' : 'pos'))))),
      cuentas.length ? h('label', { class: 'field' }, h('span', {}, '¿De qué cuenta es el extracto?'), cuenta) : null,
      h('div', { class: 'sheet-actions' }, h('button', { class: 'btn ghost', onclick: () => fill(cuerpo, elegir) }, 'Otro archivo'), btn));
    contar();
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Importando…';
      try {
        const n = await importar.importar(movs.filter((m) => m.incluir), cuenta.value);
        d.close(); toast(`${n} movimientos importados`); recargar();
      } catch (e) { toast(e.message, 'error'); contar(); }
    };
  }

  d = dialogo(h('div', { class: 'sheet-body' }, cabecera('Importar extracto', () => d), cuerpo));
}

// ================= Semestre nuevo =================
export async function abrirSemestreNuevo(semestre, irA) {
  const { cursando, ajustes, clasesActivas } = await semestre.datos();
  let d;
  const notas = {};
  const terminar = h('input', { type: 'checkbox', checked: clasesActivas.length > 0 });
  const inicio = h('input', { type: 'date', class: 'input', value: '' });
  const fin = h('input', { type: 'date', class: 'input', value: '' });
  const btn = h('button', { class: 'btn primary', type: 'button' }, 'Cerrar semestre');
  const cuerpo = h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, 'Pon la nota final de cada materia. Las que tengan 3.0 o más quedan aprobadas y suman a tu promedio de carrera.'),
    cursando.length ? h('ul', { class: 'list compact' }, cursando.map((m) => h('li', { class: 'nota-row' },
      h('i', { class: 'swatch', style: `--c:${m.color}` }), h('span', { class: 'grow' }, h('strong', {}, m.nombre), m.final != null ? h('small', { class: 'muted' }, `Según tus notas: ${m.final.toFixed(2)}`) : null),
      h('input', { type: 'number', class: 'input nota-input', min: 0, max: 5, step: 0.01, inputmode: 'decimal', placeholder: '0.0', value: m.final != null ? m.final.toFixed(2) : '',
        oninput: (e) => { notas[m.id] = e.target.value; } })))) : h('p', {}, 'No tienes materias en curso.'),
    clasesActivas.length ? h('label', { class: 'check-row' }, terminar, h('span', {}, `Terminar las ${clasesActivas.length} clases semanales de este semestre (se quitan de la agenda desde hoy)`)) : null,
    h('h4', {}, 'Fechas del próximo semestre (opcional)'),
    h('div', { class: 'grid-2' }, h('label', { class: 'field' }, h('span', {}, 'Empieza'), inicio), h('label', { class: 'field' }, h('span', {}, 'Termina'), fin)),
    ajustes.semestre_fin ? h('small', { class: 'muted' }, `El actual termina el ${fmtDate(ajustes.semestre_fin)}.`) : null,
  );
  cursando.forEach((m) => { if (m.final != null) notas[m.id] = m.final.toFixed(2); });
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const cambios = await semestre.cerrar({ materias: cursando, notas, terminarClases: terminar.checked, clases: clasesActivas, inicio: inicio.value, fin: fin.value });
      d.close();
      const aprobadas = cambios.filter((c) => c.estado === 'aprobada').length;
      toast(cambios.length ? `🎓 ¡Semestre cerrado! ${aprobadas} de ${cambios.length} materias aprobadas` : 'Fechas guardadas');
      irA('carrera');
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  };
  d = dialogo(h('div', { class: 'sheet-body' }, cabecera('Cerrar el semestre', () => d), cuerpo,
    h('div', { class: 'sheet-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => d.close() }, 'Ahora no'), btn)));
}

// ================= Copias de seguridad (sección de Ajustes) =================
export async function seccionRespaldos(ctx) {
  const { respaldos } = ctx;
  const cont = h('section', { class: 'card' });
  const pintar = async () => {
    let lista = [];
    try { lista = await respaldos.listar(); } catch { /* sin conexión */ }
    const hacer = h('button', { class: 'btn primary small', onclick: async () => {
      hacer.disabled = true; hacer.textContent = 'Haciendo copia…';
      try { const r = await respaldos.hacerAhora(); toast(`Copia lista: ${r.filas} registros guardados`); pintar(); } catch (e) { toast(e.message, 'error'); hacer.disabled = false; hacer.textContent = 'Hacer copia ahora'; }
    } }, 'Hacer copia ahora');
    fill(cont,
      h('div', { class: 'card-head' }, h('h3', {}, 'Copias de seguridad'), hacer),
      h('p', { class: 'muted small' }, 'Cada domingo a las 3 a. m. Rumbo guarda una copia de todos tus datos en tu nube privada. Se guardan las 8 más recientes.'),
      lista.length ? h('ul', { class: 'list compact' }, lista.map((f) => h('li', { class: 'backup-row' },
        h('span', { class: 'grow' }, h('strong', {}, fmtDate(f.fecha, { anio: true })), h('small', { class: 'muted' }, f.bytes ? `${Math.max(1, Math.round(f.bytes / 1024))} KB` : '')),
        h('button', { class: 'btn ghost small', onclick: async () => {
          const blob = await respaldos.descargar(f.ruta);
          const a = h('a', { href: URL.createObjectURL(blob), download: `rumbo-copia-${f.fecha}.json` }); a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        } }, 'Descargar'),
        h('button', { class: 'btn ghost small', onclick: async () => {
          if (!await confirmar(`¿Restaurar la copia del ${fmtDate(f.fecha, { anio: true })}? Lo que cambiaste después se reemplaza por lo que tenía la copia (no se borra lo nuevo).`, { aceptar: 'Restaurar', peligro: false })) return;
          toast('Restaurando…');
          try { const n = await respaldos.restaurar(f.ruta); toast(`Listo: ${n} registros restaurados`); setTimeout(() => location.reload(), 900); } catch (e) { toast(e.message, 'error'); }
        } }, 'Restaurar'))))
        : h('p', { class: 'small' }, 'Aún no hay copias. Haz la primera ahora.'));
  };
  await pintar();
  return cont;
}

// ================= Ahorro por redondeo (en Metas) =================
export async function tarjetaRedondeo(ctx, metas, recargar) {
  const aj = await ctx.vida.ajustes.obtener();
  const cfg = { activo: false, multiplo: 1000, meta_id: null, ...(aj.redondeo || {}) };
  const activas = metas.filter((m) => !m.completada);
  const guardar = async (cambio) => {
    Object.assign(cfg, cambio);
    if (cfg.activo && !cfg.meta_id) cfg.meta_id = activas[0]?.id || null;
    await ctx.vida.ajustes.guardar({ redondeo: cfg });
    toast(cfg.activo ? 'Ahorro por redondeo activado 🪙' : 'Ahorro por redondeo apagado');
    recargar();
  };
  if (!activas.length) return null;
  const ejemplo = 13500;
  const extra = Math.ceil(ejemplo / cfg.multiplo) * cfg.multiplo - ejemplo;
  return h('section', { class: `card redondeo ${cfg.activo ? 'on' : ''}` },
    h('div', { class: 'card-head' },
      h('div', {}, h('h3', {}, 'Ahorro por redondeo'),
        h('small', { class: 'muted' }, `Si gastas ${fmtMoney(ejemplo)}, ${fmtMoney(extra || cfg.multiplo)} van a tu meta`)),
      h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: cfg.activo, onchange: (e) => guardar({ activo: e.target.checked }) }), h('i'))),
    cfg.activo ? h('div', { class: 'grid-2' },
      h('label', { class: 'field' }, h('span', {}, 'Redondear de a'),
        h('select', { onchange: (e) => guardar({ multiplo: Number(e.target.value) }) },
          [1000, 2000, 5000, 10000].map((v) => h('option', { value: v, selected: cfg.multiplo === v }, fmtMoney(v))))),
      h('label', { class: 'field' }, h('span', {}, 'Para la meta'),
        h('select', { onchange: (e) => guardar({ meta_id: e.target.value }) },
          activas.map((m) => h('option', { value: m.id, selected: cfg.meta_id === m.id }, `${m.icono} ${m.nombre}`))))) : null);
}

// ================= Comparar con el mes pasado (en Plata) =================
export async function tarjetaComparacion(service, irA) {
  const c = await service.compararConMesPasado().catch(() => null);
  if (!c || !c.hayDatos) return null;
  const mes = monthLabel(c.ymAnterior).split(' ')[0].toLowerCase();
  const sube = c.total.diff > 0;
  const top = c.categorias.filter((x) => x.actual || x.anterior).slice(0, 4);
  const max = Math.max(1, ...top.flatMap((x) => [x.actual, x.anterior]));
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', {}, `Comparado con ${mes}`),
      h('span', { class: `badge ${sube ? 'late' : c.total.diff < 0 ? 'ok' : ''}` }, c.total.pct == null ? '—' : `${c.total.pct > 0 ? '+' : ''}${c.total.pct} %`)),
    h('p', { class: 'small' }, c.total.diff === 0
      ? `Vas gastando lo mismo que a esta altura de ${mes}.`
      : sube
        ? `Llevas ${fmtMoney(c.total.diff)} más en gastos que a esta misma altura de ${mes}.`
        : `Llevas ${fmtMoney(-c.total.diff)} menos en gastos que a esta altura de ${mes}. ¡Bien ahí!`),
    c.alertas.map((a) => h('button', { class: 'aviso-mini', onclick: () => irA('movimientos') },
      icono('alerta', { size: 16 }), h('span', {}, `${a.categoria}: ${a.pct} % más (${fmtMoney(a.diff)})`))),
    h('ul', { class: 'compare' }, top.map((x) => h('li', {},
      h('div', { class: 'row-between small' }, h('span', {}, x.categoria), h('b', {}, fmtMoney(x.actual))),
      h('div', { class: 'compare-bars' },
        h('i', { class: 'bar-now', style: `--w:${(x.actual / max) * 100}%` }),
        h('i', { class: 'bar-prev', style: `--w:${(x.anterior / max) * 100}%` }))))),
    h('div', { class: 'legend small muted' }, h('span', { class: 'lg now' }, 'Este mes'), h('span', { class: 'lg prev' }, mes.charAt(0).toUpperCase() + mes.slice(1))));
}

// ================= Copiar semana de turnos =================
export function abrirCopiarSemana(turnos, recargar) {
  const lunes = startOfWeek(today());
  const rango = (l) => `${fmtDate(l)} – ${fmtDate(addDays(l, 6))}`;
  let d;
  const op = (titulo, detalle, origen, destino) => h('button', { class: 'add-item tono-work', onclick: async () => {
    d.close();
    try {
      const n = await turnos.copiarSemana(origen, destino);
      toast(n ? `${n} turno${n === 1 ? '' : 's'} copiado${n === 1 ? '' : 's'}` : 'No había turnos nuevos para copiar');
      recargar();
    } catch (e) { toast(e.message, 'error'); }
  } }, h('span', { class: 'add-ico' }, icono('copiar', { size: 22 })), h('strong', {}, titulo), h('small', {}, detalle));
  d = dialogo(h('div', { class: 'sheet-body' }, cabecera('Copiar turnos', () => d),
    h('p', { class: 'muted small' }, 'Se copian los turnos sueltos (los fijos de cada semana ya se repiten solos). Si ya tienes un turno a la misma hora ese día, no se duplica.'),
    h('div', { class: 'add-grid two' },
      op('Semana pasada → esta', `${rango(addDays(lunes, -7))} a ${rango(lunes)}`, addDays(lunes, -7), lunes),
      op('Esta semana → la próxima', `${rango(lunes)} a ${rango(addDays(lunes, 7))}`, lunes, addDays(lunes, 7)))));
}

