// Informe mensual de actividades en PDF (jsPDF + autoTable, cargados solo cuando se usan).
import { fmtTime, monthLabel, today, fmtDate, DIAS_CORTOS, weekday } from '../core/format.js';

const horas = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export async function generarInforme({ ym, nombre, cargo, dirigido, filas, totalHoras, totalTurnos, dias }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/jspdf@2/+esm'),
    import('https://cdn.jsdelivr.net/npm/jspdf-autotable@3/+esm'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const NOCHE = [19, 32, 61];
  const COBALTO = [47, 85, 212];

  doc.setFillColor(...NOCHE); doc.rect(0, 0, W, 86, 'F');
  doc.setFillColor(255, 122, 26); doc.rect(0, 86, W, 4, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Informe de actividades', M, 46);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(monthLabel(ym), M, 66);

  doc.setTextColor(...NOCHE); doc.setFontSize(10.5);
  let y = 118;
  const linea = (k, v) => { if (!v) return; doc.setFont('helvetica', 'bold'); doc.text(`${k}:`, M, y); doc.setFont('helvetica', 'normal'); doc.text(String(v), M + 110, y, { maxWidth: W - M * 2 - 110 }); y += 17; };
  linea('Nombre', nombre);
  linea('Cargo u objeto', cargo);
  linea('Dirigido a', dirigido);
  const [a, m] = ym.split('-').map(Number);
  linea('Periodo', `${fmtDate(`${ym}-01`, { anio: true })} al ${fmtDate(`${ym}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`, { anio: true })}`);

  autoTable(doc, {
    startY: y + 8,
    margin: { left: M, right: M },
    head: [['Fecha', 'Día', 'Horario', 'Horas', 'Tipo de turno', 'Actividades realizadas']],
    body: filas.map((f) => [`${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)}`, DIAS_CORTOS[weekday(f.fecha)], `${fmtTime(f.inicio)} – ${fmtTime(f.fin)}`, horas(f.horas), f.tipo, f.descripcion]),
    foot: [['', '', 'Total', horas(totalHoras), `${totalTurnos} turno${totalTurnos === 1 ? '' : 's'}`, `${dias} día${dias === 1 ? '' : 's'} trabajado${dias === 1 ? '' : 's'}`]],
    styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 5, textColor: NOCHE, lineColor: [217, 224, 234], lineWidth: 0.5, valign: 'top' },
    headStyles: { fillColor: COBALTO, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [230, 235, 243], textColor: NOCHE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 32 }, 2: { cellWidth: 118 }, 3: { cellWidth: 38, halign: 'right' }, 4: { cellWidth: 100 } },
  });

  let fy = doc.lastAutoTable.finalY + 64;
  if (fy > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); fy = 110; }
  doc.setDrawColor(...NOCHE); doc.line(M, fy, M + 220, fy);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(nombre || 'Firma', M, fy + 15);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(93, 107, 132); doc.text('Firma', M, fy + 29);

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(93, 107, 132);
    doc.text(`Generado con Rumbo el ${fmtDate(today(), { anio: true })} · Página ${i} de ${paginas}`, M, doc.internal.pageSize.getHeight() - 24);
  }
  const archivo = `informe-actividades-${ym}.pdf`;
  doc.save(archivo);
  return archivo;
}
