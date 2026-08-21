import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './formatters';
import { buildEapTabelaRows, getEapCabecalhoMeta } from './eapPlanilhaShared';
import {
  calcularCurvaAbcInsumos,
  calcularCurvaAbcComposicoes
} from './curvaAbc';
import {
  CATEGORIAS_COMPOSICAO,
  listarComposicoesAbertas,
  SECOES_PDF_PADRAO
} from './eapComposicoesDetalhe';

const COR_PACOTE = [232, 238, 243];
const COR_GRUPO = [245, 247, 249];
const COR_SUBGRUPO = [238, 242, 245];
const COR_HEADER = [23, 50, 77];
const COR_TEXTO = [23, 33, 43];
const COR_CAT_A = [248, 215, 218];
const COR_CAT_B = [255, 243, 205];
const COR_CAT_C = [209, 231, 221];
const COR_META = [217, 226, 236];

function formatQtd(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatCoef(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
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

function drawHeaderBar(doc, pageWidth, marginX, titulo, meta) {
  doc.setFillColor(...COR_HEADER);
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ORÇATUDO', marginX, 8);
  doc.setFontSize(11);
  doc.text(titulo, pageWidth - marginX, 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `${meta.nomeObra}  ·  Rev. ${meta.revLabel}`,
    pageWidth - marginX,
    14,
    { align: 'right', maxWidth: pageWidth / 2 }
  );
}

function desenharPaginaAbc(doc, {
  pageWidth,
  marginX,
  meta,
  titulo,
  rotuloItem,
  curva,
  resumo,
  novaPagina = true
}) {
  if (novaPagina) doc.addPage('a4', 'landscape');
  drawHeaderBar(doc, pageWidth, marginX, titulo, meta);

  let y = 24;
  doc.setTextColor(...COR_TEXTO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(titulo, marginX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Obra: ${meta.nomeObra}  ·  Rev. ${meta.revLabel}  ·  ${meta.dataExport}`,
    marginX,
    y
  );
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Categoria', 'Quantidade', 'Valor', '% do total']],
    body: [
      [
        'A',
        String(resumo?.categoriaA?.quantidade || 0),
        formatCurrency(resumo?.categoriaA?.valor || 0),
        `${resumo?.categoriaA?.percentual || '0.00'}%`
      ],
      [
        'B',
        String(resumo?.categoriaB?.quantidade || 0),
        formatCurrency(resumo?.categoriaB?.valor || 0),
        `${resumo?.categoriaB?.percentual || '0.00'}%`
      ],
      [
        'C',
        String(resumo?.categoriaC?.quantidade || 0),
        formatCurrency(resumo?.categoriaC?.valor || 0),
        `${resumo?.categoriaC?.percentual || '0.00'}%`
      ],
      [
        'Total',
        String(resumo?.totalItens || 0),
        formatCurrency(resumo?.valorTotal || 0),
        '100%'
      ]
    ],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: COR_TEXTO,
      lineColor: [221, 227, 232],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: COR_HEADER,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' }
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const cat = data.row.raw?.[0];
      if (cat === 'A') data.cell.styles.fillColor = COR_CAT_A;
      if (cat === 'B') data.cell.styles.fillColor = COR_CAT_B;
      if (cat === 'C') data.cell.styles.fillColor = COR_CAT_C;
      if (cat === 'Total') data.cell.styles.fontStyle = 'bold';
    }
  });

  const body = (curva || []).map((item, idx) => [
    String(idx + 1),
    item.codigo || '',
    item.nome || '',
    item.unidade || '',
    item.categoria || '',
    formatQtd(item.quantidade),
    formatCurrency(item.precoUnitario || 0),
    formatCurrency(item.valorTotal || 0),
    `${item.percentualValor || '0.00'}%`,
    `${item.percentualAcumulado || '0.00'}%`,
    item.categoriaABC || ''
  ]);

  if (!body.length) {
    body.push(['', '', 'Nenhum item com valor para classificar.', '', '', '', '', '', '', '', '']);
  }

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || y) + 6,
    margin: { left: marginX, right: marginX },
    head: [[
      '#', 'Código', rotuloItem, 'Un.', 'Categoria',
      'Qtd', 'Preço unit.', 'Valor total', '% valor', '% acum.', 'ABC'
    ]],
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
      fontSize: 6.5
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 22 },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 26, halign: 'right' },
      8: { cellWidth: 16, halign: 'right' },
      9: { cellWidth: 16, halign: 'right' },
      10: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 10) return;
      const abc = data.cell.raw;
      if (abc === 'A') data.cell.styles.fillColor = COR_CAT_A;
      if (abc === 'B') data.cell.styles.fillColor = COR_CAT_B;
      if (abc === 'C') data.cell.styles.fillColor = COR_CAT_C;
    }
  });
}

function desenharPaginaEap(doc, {
  pageWidth,
  marginX,
  meta,
  tituloPlanilha,
  tabelaRows,
  novaPagina = false
}) {
  if (novaPagina) doc.addPage('a4', 'landscape');

  drawHeaderBar(doc, pageWidth, marginX, tituloPlanilha, meta);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Rev. ${meta.revLabel}  ·  ${meta.statusLabel}`, pageWidth - marginX, 14, { align: 'right' });

  let y = 24;
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
    }
  });
}

function desenharComposicoes(doc, {
  pageWidth,
  marginX,
  meta,
  composicoes,
  bdiPercent = 0,
  novaPagina = true
}) {
  if (novaPagina) doc.addPage('a4', 'landscape');
  drawHeaderBar(doc, pageWidth, marginX, 'Composições', meta);

  let y = 24;
  doc.setTextColor(...COR_TEXTO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Composições', marginX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Obra: ${meta.nomeObra}  ·  Rev. ${meta.revLabel}  ·  ${composicoes.length} composição(ões)`,
    marginX,
    y
  );
  y += 6;

  if (!composicoes.length) {
    doc.text('Nenhuma composição utilizada neste orçamento.', marginX, y);
    return;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const minEspaco = 40;

  composicoes.forEach((comp, idx) => {
    if (y > pageHeight - minEspaco) {
      doc.addPage('a4', 'landscape');
      drawHeaderBar(doc, pageWidth, marginX, 'Composições', meta);
      y = 24;
    } else if (idx > 0) {
      y += 4;
    }

    const tituloComp = [comp.codigo, comp.nome].filter(Boolean).join(' - ') || 'Composição';

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      body: [[tituloComp]],
      theme: 'plain',
      styles: {
        fontSize: 9,
        fontStyle: 'bold',
        textColor: [255, 255, 255],
        fillColor: COR_HEADER,
        cellPadding: 2.5
      }
    });
    y = doc.lastAutoTable.finalY + 1;

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      body: [[
        `Preço Adotado: ${formatCurrency(comp.precoAdotado || 0)}`,
        `Unidade: ${comp.unidade || '—'}`
      ]],
      theme: 'plain',
      styles: {
        fontSize: 8,
        fontStyle: 'bold',
        textColor: COR_TEXTO,
        fillColor: COR_META,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: pageWidth / 2 - marginX },
        1: { cellWidth: pageWidth / 2 - marginX }
      }
    });
    y = doc.lastAutoTable.finalY + 1;

    const porCategoria = {};
    CATEGORIAS_COMPOSICAO.forEach(({ key }) => { porCategoria[key] = []; });
    (comp.insumos || []).forEach((ins) => {
      const cat = porCategoria[ins.categoria] ? ins.categoria : 'Material';
      porCategoria[cat].push(ins);
    });

    let totalSimples = 0;
    const bodyRows = [];
    const rowKinds = [];

    CATEGORIAS_COMPOSICAO.forEach(({ key, label }) => {
      const itens = porCategoria[key] || [];
      if (!itens.length) return;

      bodyRows.push([label, '', '', '', '', '']);
      rowKinds.push('categoria');

      let subtotal = 0;
      itens.forEach((ins) => {
        subtotal += ins.total || 0;
        bodyRows.push([
          ins.codigo || '',
          ins.nome || '',
          ins.unidade || '',
          formatCoef(ins.coeficiente),
          formatCurrency(ins.preco || 0),
          formatCurrency(ins.total || 0)
        ]);
        rowKinds.push('insumo');
      });

      totalSimples += subtotal;
      bodyRows.push(['', '', '', '', `TOTAL ${label}:`, formatCurrency(subtotal)]);
      rowKinds.push('subtotal');
    });

    if (!(comp.insumos || []).length) {
      bodyRows.push(['', 'Sem insumos vinculados', '', '', '', '']);
      rowKinds.push('insumo');
      totalSimples = Number(comp.precoAdotado) || 0;
    }

    const bdiValor = totalSimples * ((Number(bdiPercent) || 0) / 100);
    const totalGeral = totalSimples + bdiValor;

    bodyRows.push(['', '', '', '', 'Total Simples:', formatCurrency(totalSimples)]);
    rowKinds.push('resumo');
    bodyRows.push(['', '', '', '', 'Encargos:', 'INCLUSOS']);
    rowKinds.push('resumo');
    bodyRows.push([
      '', '', '', '',
      'BDI:',
      Number(bdiPercent) > 0
        ? `${Number(bdiPercent).toFixed(2).replace('.', ',')}%`
        : '0,00'
    ]);
    rowKinds.push('resumo');
    bodyRows.push(['', '', '', '', 'TOTAL GERAL:', formatCurrency(totalGeral)]);
    rowKinds.push('totalGeral');

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [['Código', 'Descrição', 'Unidade', 'Coeficiente', 'Preço', 'Total']],
      body: bodyRows,
      theme: 'grid',
      styles: {
        fontSize: 7,
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
        fontSize: 7
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' }
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const kind = rowKinds[data.row.index];
        if (kind === 'categoria') {
          data.cell.styles.fillColor = COR_META;
          data.cell.styles.fontStyle = 'bold';
        } else if (kind === 'subtotal' || kind === 'resumo') {
          data.cell.styles.fontStyle = 'bold';
        } else if (kind === 'totalGeral') {
          data.cell.styles.fillColor = COR_PACOTE;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    y = doc.lastAutoTable.finalY + 4;
  });
}

function atualizarNumeracaoPaginas(doc, pageWidth, marginX) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(104, 116, 129);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - marginX,
      h - 5,
      { align: 'right' }
    );
  }
}

/**
 * Exporta a EAP em PDF no mesmo estilo da planilha Excel.
 * @param {boolean} [opts.modoVenda]
 * @param {number} [opts.fatorBdi]
 * @param {object} [opts.secoes] — quais partes incluir (eap, composicoes, abcComposicao, abcInsumos)
 */
export function exportarEapPlanilhaPdf({
  orcamento,
  calcularSubvalores,
  valorTotal,
  valorComBDI,
  bdiValor,
  revisao,
  elaboradoPor,
  status,
  modoVenda = false,
  fatorBdi = 1,
  catalogoComposicoes = [],
  insumos = [],
  secoes: secoesOpts = {}
}) {
  const secoes = { ...SECOES_PDF_PADRAO, ...secoesOpts };
  const algumaSecao = Object.values(secoes).some(Boolean);
  if (!algumaSecao) {
    throw new Error('Selecione ao menos uma seção para exportar.');
  }

  const meta = getEapCabecalhoMeta({ orcamento, revisao, elaboradoPor, status });
  const tituloPlanilha = modoVenda ? 'PLANILHA DE VENDA' : 'PLANILHA ORÇAMENTÁRIA';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;
  let primeiraSecao = true;

  const iniciarSecao = () => {
    const precisaNova = !primeiraSecao;
    primeiraSecao = false;
    return precisaNova;
  };

  if (secoes.eap) {
    const { rows: tabelaRows } = buildEapTabelaRows({
      orcamento,
      calcularSubvalores,
      valorTotal,
      valorComBDI,
      bdiValor,
      modoVenda,
      fatorBdi
    });
    desenharPaginaEap(doc, {
      pageWidth,
      marginX,
      meta,
      tituloPlanilha,
      tabelaRows,
      novaPagina: iniciarSecao()
    });
  }

  if (secoes.abcComposicao) {
    const abcComps = calcularCurvaAbcComposicoes(orcamento?.composicoes);
    desenharPaginaAbc(doc, {
      pageWidth,
      marginX,
      meta,
      titulo: 'ABC Composição',
      rotuloItem: 'Composição',
      curva: abcComps.curva,
      resumo: abcComps.resumo,
      novaPagina: iniciarSecao()
    });
  }

  if (secoes.abcInsumos) {
    const abcInsumos = calcularCurvaAbcInsumos(
      orcamento?.composicoes,
      catalogoComposicoes,
      insumos
    );
    desenharPaginaAbc(doc, {
      pageWidth,
      marginX,
      meta,
      titulo: 'ABC Insumos',
      rotuloItem: 'Insumo',
      curva: abcInsumos.curva,
      resumo: abcInsumos.resumo,
      novaPagina: iniciarSecao()
    });
  }

  if (secoes.composicoes) {
    const listaComposicoes = listarComposicoesAbertas(
      orcamento?.composicoes,
      catalogoComposicoes,
      insumos
    );
    desenharComposicoes(doc, {
      pageWidth,
      marginX,
      meta,
      composicoes: listaComposicoes,
      bdiPercent: 0,
      novaPagina: iniciarSecao()
    });
  }

  atualizarNumeracaoPaginas(doc, pageWidth, marginX);

  const safeName = meta.nomeObra.replace(/[^a-zA-Z0-9À-ÿ _-]/g, '_').slice(0, 60);
  const filePrefix = modoVenda ? 'PlanilhaVenda' : 'Orcamento';
  doc.save(`${filePrefix}_${safeName}_R${meta.revLabel}.pdf`);
}
