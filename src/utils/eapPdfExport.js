import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './formatters';
import { buildEapTabelaRows, getEapCabecalhoMeta } from './eapPlanilhaShared';

const COR_PACOTE = [232, 238, 243];
const COR_GRUPO = [245, 247, 249];
const COR_SUBGRUPO = [238, 242, 245];
const COR_HEADER = [23, 50, 77];
const COR_TEXTO = [23, 33, 43];

function formatQtd(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatInc(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `${(n * 100).toFixed(2)}%`;
}

function formatMoneyCell(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return formatCurrency(n);
}

function cellsToPdfRow(cells) {
  return [
    cells[0] ?? '',
    cells[1] ?? '',
    cells[2] ?? '',
    cells[3] ?? '',
    formatQtd(cells[4]),
    formatMoneyCell(cells[5]),
    formatMoneyCell(cells[6]),
    formatMoneyCell(cells[7]),
    formatMoneyCell(cells[8]),
    formatMoneyCell(cells[9]),
    formatMoneyCell(cells[10]),
    formatInc(cells[11])
  ];
}

/**
 * Exporta a EAP em PDF no mesmo estilo da planilha Excel.
 */
export function exportarEapPlanilhaPdf({
  orcamento,
  calcularSubvalores,
  valorTotal,
  valorComBDI,
  bdiValor,
  revisao,
  elaboradoPor,
  status
}) {
  const meta = getEapCabecalhoMeta({ orcamento, revisao, elaboradoPor, status });
  const { rows: tabelaRows } = buildEapTabelaRows({
    orcamento,
    calcularSubvalores,
    valorTotal,
    valorComBDI,
    bdiValor
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;
  let y = 10;

  doc.setFillColor(...COR_HEADER);
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ORÇATUDO', marginX, 8);
  doc.setFontSize(11);
  doc.text('PLANILHA ORÇAMENTÁRIA', pageWidth - marginX, 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Rev. ${meta.revLabel}  ·  ${meta.statusLabel}`, pageWidth - marginX, 14, { align: 'right' });

  y = 24;
  doc.setTextColor(...COR_TEXTO);
  doc.setFontSize(9);

  const lineGap = 5;
  const col2 = pageWidth / 2 + 5;

  doc.setFont('helvetica', 'bold');
  doc.text('OBRA', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(meta.nomeObra, marginX + 18, y);

  doc.setFont('helvetica', 'bold');
  doc.text('REVISÃO', col2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rev. ${meta.revLabel}`, col2 + 22, y);
  y += lineGap;

  doc.setFont('helvetica', 'bold');
  doc.text('LOCAL', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(meta.local), marginX + 18, y, { maxWidth: pageWidth / 2 - 30 });

  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', col2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(meta.cliente, col2 + 22, y, { maxWidth: pageWidth / 2 - 35 });
  y += lineGap;

  doc.setFont('helvetica', 'bold');
  doc.text('ELABORADO POR', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(meta.elab, marginX + 35, y);

  doc.setFont('helvetica', 'bold');
  doc.text('STATUS', col2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(meta.statusLabel, col2 + 22, y);
  y += lineGap;

  doc.setFont('helvetica', 'bold');
  doc.text('ÚLTIMA ATUALIZAÇÃO', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(meta.ultimaAtualizacao, marginX + 45, y);

  doc.setFont('helvetica', 'bold');
  doc.text('DATA DA EXPORTAÇÃO', col2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(meta.dataExport, col2 + 42, y);
  y += 6;

  const body = [];
  const bodyKinds = [];

  tabelaRows.forEach((item) => {
    body.push(cellsToPdfRow(item.cells));
    bodyKinds.push(item.kind);
  });

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [
      [
        { content: 'No.', rowSpan: 2 },
        { content: 'COD.', rowSpan: 2 },
        { content: 'DESCRIÇÃO', rowSpan: 2 },
        { content: 'UND.', rowSpan: 2 },
        { content: 'QUANT.', rowSpan: 2 },
        { content: 'VALOR UNITÁRIO', colSpan: 3, styles: { halign: 'center' } },
        { content: 'VALOR TOTAL', colSpan: 3, styles: { halign: 'center' } },
        { content: 'INC.', rowSpan: 2 }
      ],
      ['MAT+EQP', 'MO+SERV', 'TOTAL', 'MAT+EQP', 'MO+SERV', 'TOTAL']
    ],
    body,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 1.2,
      textColor: COR_TEXTO,
      lineColor: [221, 227, 232],
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle'
    },
    headStyles: {
      fillColor: COR_HEADER,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 6.5
    },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 16 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 12,halign: 'center' },
      4: { cellWidth: 14,halign: 'right' },
      5: { cellWidth: 22,halign: 'right' },
      6: { cellWidth: 22,halign: 'right' },
      7: { cellWidth: 22,halign: 'right' },
      8: { cellWidth: 22,halign: 'right' },
      9: { cellWidth: 22,halign: 'right' },
      10: { cellWidth: 24,halign: 'right' },
      11: { cellWidth: 14,halign: 'right' }
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const kind = bodyKinds[data.row.index];
      if (kind === 'pacote') {
        data.cell.styles.fillColor = COR_PACOTE;
        data.cell.styles.fontStyle = 'bold';
      } else if (kind === 'grupo') {
        data.cell.styles.fillColor = COR_GRUPO;
        data.cell.styles.fontStyle = 'bold';
      } else if (kind === 'subgrupo') {
        data.cell.styles.fillColor = COR_SUBGRUPO;
        data.cell.styles.fontStyle = 'bold';
      } else if (kind === 'footer') {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(104, 116, 129);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth - marginX,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'right' }
      );
    }
  });

  const safeName = meta.nomeObra.replace(/[^a-zA-Z0-9À-ÿ _-]/g, '_').slice(0, 60);
  doc.save(`Orcamento_${safeName}_R${meta.revLabel}.pdf`);
}
