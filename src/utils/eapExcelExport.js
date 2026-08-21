import * as XLSX from 'xlsx-js-style';
import { buildEapTabelaRows, getEapCabecalhoMeta } from './eapPlanilhaShared';
import {
  calcularCurvaAbcInsumos,
  calcularCurvaAbcComposicoes
} from './curvaAbc';
import {
  CATEGORIAS_COMPOSICAO,
  listarComposicoesAbertas
} from './eapComposicoesDetalhe';
import { memoriaCalculoBdi, BDI_CAMPOS } from './bdi';

/** Cores alinhadas à EAP do site */
const COR_PACOTE = 'E8EEF3';
const COR_GRUPO = 'F5F7F9';
const COR_SUBGRUPO = 'EEF2F5';
const COR_HEADER = '17324D';
const COR_CAT_A = 'F8D7DA';
const COR_CAT_B = 'FFF3CD';
const COR_CAT_C = 'D1E7DD';
const COR_META = 'D9E2EC';

const MONEY_FMT = 'R$ #,##0.00';
const PCT_FMT = '0.00%';
const DEC4_FMT = '0.0000';

function emptyRow(cols = 12) {
  return Array(cols).fill('');
}

function fillStyle(rgb) {
  return {
    patternType: 'solid',
    fgColor: { rgb }
  };
}

function sanitizeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function sanitizeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function sanitizeCell(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return sanitizeNumber(value);
  if (typeof value === 'boolean') return value;
  return sanitizeText(value);
}

function sanitizeRows(rows) {
  return (rows || []).map((row) => (row || []).map(sanitizeCell));
}

function buildCellStyle(prev = {}, style = {}) {
  const next = { ...prev };
  if (style.fill) next.fill = style.fill;
  else if (next.fill == null) delete next.fill;
  if (style.font) next.font = { ...(prev.font || {}), ...style.font };
  if (style.alignment) next.alignment = { ...(prev.alignment || {}), ...style.alignment };
  const numFmt = style.numFmt || prev.numFmt;
  if (numFmt) next.numFmt = numFmt;
  return next;
}

function applyRowStyle(ws, rowIndex, cols, style) {
  for (let c = 0; c < cols; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    ws[addr].s = buildCellStyle(ws[addr].s || {}, style);
    if (style.numFmt) ws[addr].z = style.numFmt;
  }
}

function applyCellStyle(ws, rowIndex, colIndex, style) {
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  if (!ws[addr]) ws[addr] = { t: 's', v: '' };
  ws[addr].s = buildCellStyle(ws[addr].s || {}, style);
  if (style.numFmt) ws[addr].z = style.numFmt;
}

function pctParaNumero(str) {
  const n = parseFloat(String(str || '0').replace(',', '.'));
  return Number.isFinite(n) ? n / 100 : 0;
}

function buildAbcSheet({ titulo, curva, resumo, rotuloItem }) {
  const rows = [];
  const push = (row) => {
    rows.push(row);
    return rows.length - 1;
  };

  push([titulo]);
  push([]);
  push(['Resumo por categoria']);
  push([
    'Categoria',
    'Quantidade',
    'Valor',
    '% do total'
  ]);
  const resumoStart = rows.length;
  push([
    'A',
    resumo?.categoriaA?.quantidade || 0,
    resumo?.categoriaA?.valor || 0,
    pctParaNumero(resumo?.categoriaA?.percentual)
  ]);
  push([
    'B',
    resumo?.categoriaB?.quantidade || 0,
    resumo?.categoriaB?.valor || 0,
    pctParaNumero(resumo?.categoriaB?.percentual)
  ]);
  push([
    'C',
    resumo?.categoriaC?.quantidade || 0,
    resumo?.categoriaC?.valor || 0,
    pctParaNumero(resumo?.categoriaC?.percentual)
  ]);
  push([
    'Total',
    resumo?.totalItens || 0,
    resumo?.valorTotal || 0,
    1
  ]);
  push([]);

  const headerRow = push([
    '#',
    'Código',
    rotuloItem,
    'Unidade',
    'Categoria',
    'Quantidade',
    'Preço unitário',
    'Valor total',
    '% valor',
    '% acumulado',
    'ABC'
  ]);

  const dataStart = rows.length;
  (curva || []).forEach((item, idx) => {
    push([
      idx + 1,
      item.codigo || '',
      item.nome || '',
      item.unidade || '',
      item.categoria || '',
      item.quantidade || 0,
      item.precoUnitario || 0,
      item.valorTotal || 0,
      pctParaNumero(item.percentualValor),
      pctParaNumero(item.percentualAcumulado),
      item.categoriaABC || ''
    ]);
  });

  if (!(curva || []).length) {
    push(['', '', 'Nenhum item com valor para classificar.', '', '', '', '', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(sanitizeRows(rows));
  ws['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 42 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 6 }
  ];

  applyRowStyle(ws, 0, 1, {
    font: { bold: true, sz: 14, color: { rgb: '17324D' } }
  });
  applyRowStyle(ws, 2, 4, {
    font: { bold: true, color: { rgb: '17324D' } }
  });
  applyRowStyle(ws, 3, 4, {
    fill: fillStyle(COR_HEADER),
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center' }
  });
  applyRowStyle(ws, headerRow, 11, {
    fill: fillStyle(COR_HEADER),
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center' }
  });

  for (let i = 0; i < 4; i++) {
    const R = resumoStart + i;
    const cat = rows[R]?.[0];
    const fill =
      cat === 'A' ? COR_CAT_A : cat === 'B' ? COR_CAT_B : cat === 'C' ? COR_CAT_C : COR_PACOTE;
    applyRowStyle(ws, R, 4, {
      fill: fillStyle(fill),
      font: { bold: cat === 'Total' }
    });
    applyCellStyle(ws, R, 2, { numFmt: MONEY_FMT });
    applyCellStyle(ws, R, 3, { numFmt: PCT_FMT });
  }

  for (let R = dataStart; R < rows.length; R++) {
    const abc = rows[R]?.[10];
    if (abc === 'A' || abc === 'B' || abc === 'C') {
      const fill = abc === 'A' ? COR_CAT_A : abc === 'B' ? COR_CAT_B : COR_CAT_C;
      applyCellStyle(ws, R, 10, {
        fill: fillStyle(fill),
        font: { bold: true },
        alignment: { horizontal: 'center' }
      });
    }
    applyCellStyle(ws, R, 6, { numFmt: MONEY_FMT });
    applyCellStyle(ws, R, 7, { numFmt: MONEY_FMT });
    applyCellStyle(ws, R, 8, { numFmt: PCT_FMT });
    applyCellStyle(ws, R, 9, { numFmt: PCT_FMT });

    const cellQtd = ws[XLSX.utils.encode_cell({ r: R, c: 5 })];
    if (cellQtd && typeof cellQtd.v === 'number') {
      cellQtd.t = 'n';
      cellQtd.z = Number.isInteger(cellQtd.v) ? '0' : '0.###';
    }
  }

  return ws;
}

function buildComposicoesSheet({ titulo, composicoes, bdiPercent = 0 }) {
  const cols = 6;
  const rows = [];
  const merges = [];
  const rowKinds = {};

  const push = (row, kind) => {
    const padded = [...row];
    while (padded.length < cols) padded.push('');
    rows.push(padded.slice(0, cols));
    const idx = rows.length - 1;
    if (kind) rowKinds[idx] = kind;
    return idx;
  };

  push([titulo], 'capa');
  push([]);
  push([`Composições distintas: ${composicoes.length}`], 'meta');
  push([]);

  if (!composicoes.length) {
    push(['Nenhuma composição utilizada neste orçamento.']);
  }

  composicoes.forEach((comp) => {
    const tituloComp = [comp.codigo, comp.nome].filter(Boolean).join(' - ') || 'Composição';
    const tituloRow = push([tituloComp], 'tituloComp');
    merges.push({ s: { r: tituloRow, c: 0 }, e: { r: tituloRow, c: cols - 1 } });

    const metaRow = push([
      'Preço Adotado:',
      Number(comp.precoAdotado) || 0,
      '',
      '',
      'Unid:',
      comp.unidade || ''
    ], 'metaComp');
    merges.push({ s: { r: metaRow, c: 1 }, e: { r: metaRow, c: 3 } });

    const headRow = push([
      'Código',
      'Descrição',
      'Unidade',
      'Coeficiente',
      'Preço',
      'Total'
    ], 'colHeader');

    const porCategoria = {};
    CATEGORIAS_COMPOSICAO.forEach(({ key }) => { porCategoria[key] = []; });
    (comp.insumos || []).forEach((ins) => {
      const cat = porCategoria[ins.categoria] ? ins.categoria : 'Material';
      porCategoria[cat].push(ins);
    });

    let totalSimples = 0;

    CATEGORIAS_COMPOSICAO.forEach(({ key, label }) => {
      const itens = porCategoria[key] || [];
      if (!itens.length) return;

      const catRow = push([label], 'categoria');
      merges.push({ s: { r: catRow, c: 0 }, e: { r: catRow, c: cols - 1 } });

      let subtotal = 0;
      itens.forEach((ins) => {
        subtotal += ins.total || 0;
        push([
          ins.codigo || '',
          ins.nome || '',
          ins.unidade || '',
          ins.coeficiente || 0,
          ins.preco || 0,
          ins.total || 0
        ], 'insumo');
      });

      totalSimples += subtotal;
      const totRow = push([
        '',
        '',
        '',
        '',
        `TOTAL ${label}:`,
        subtotal
      ], 'subtotal');
      merges.push({ s: { r: totRow, c: 0 }, e: { r: totRow, c: 3 } });
    });

    if (!(comp.insumos || []).length) {
      push(['', 'Sem insumos vinculados', '', '', '', ''], 'insumo');
      totalSimples = Number(comp.precoAdotado) || 0;
    }

    const bdiValor = totalSimples * ((Number(bdiPercent) || 0) / 100);
    const totalGeral = totalSimples + bdiValor;

    push([]);
    push(['', '', '', '', 'Total Simples:', totalSimples], 'resumo');
    push(['', '', '', '', 'Encargos:', 'INCLUSOS'], 'resumo');
    push([
      '', '', '', '',
      'BDI:',
      Number(bdiPercent) > 0 ? `${Number(bdiPercent).toFixed(2).replace('.', ',')}%` : '0,00'
    ], 'resumo');
    push(['', '', '', '', 'TOTAL GERAL:', totalGeral], 'totalGeral');
    push([]);
    push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sanitizeRows(rows));
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 14 },
    { wch: 48 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 }
  ];

  Object.entries(rowKinds).forEach(([rowStr, kind]) => {
    const R = Number(rowStr);
    if (kind === 'capa') {
      applyRowStyle(ws, R, cols, {
        font: { bold: true, sz: 14, color: { rgb: '17324D' } }
      });
    } else if (kind === 'tituloComp') {
      applyRowStyle(ws, R, cols, {
        fill: fillStyle(COR_HEADER),
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: 'left', vertical: 'center' }
      });
    } else if (kind === 'metaComp') {
      applyRowStyle(ws, R, cols, {
        fill: fillStyle(COR_META),
        font: { bold: true, color: { rgb: '17212B' } }
      });
      applyCellStyle(ws, R, 1, { numFmt: DEC4_FMT });
    } else if (kind === 'colHeader') {
      applyRowStyle(ws, R, cols, {
        fill: fillStyle(COR_HEADER),
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center' }
      });
    } else if (kind === 'categoria') {
      applyRowStyle(ws, R, cols, {
        fill: fillStyle(COR_META),
        font: { bold: true, color: { rgb: '17212B' } }
      });
    } else if (kind === 'insumo') {
      applyCellStyle(ws, R, 3, { numFmt: DEC4_FMT });
      applyCellStyle(ws, R, 4, { numFmt: DEC4_FMT });
      applyCellStyle(ws, R, 5, { numFmt: DEC4_FMT });
    } else if (kind === 'subtotal') {
      applyRowStyle(ws, R, cols, {
        font: { bold: true },
        alignment: { horizontal: 'right' }
      });
      applyCellStyle(ws, R, 5, { numFmt: DEC4_FMT });
    } else if (kind === 'resumo') {
      applyCellStyle(ws, R, 4, { font: { bold: true }, alignment: { horizontal: 'right' } });
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: 5 })];
      if (cell && typeof cell.v === 'number') {
        applyCellStyle(ws, R, 5, { numFmt: DEC4_FMT });
      }
    } else if (kind === 'totalGeral') {
      applyRowStyle(ws, R, cols, {
        fill: fillStyle(COR_PACOTE),
        font: { bold: true }
      });
      applyCellStyle(ws, R, 4, { alignment: { horizontal: 'right' } });
      applyCellStyle(ws, R, 5, { numFmt: DEC4_FMT });
    }
  });

  return ws;
}

function pctBr(valor) {
  return `${Number(valor).toFixed(2).replace('.', ',')}%`;
}

function fatorBr(valor) {
  return Number(valor).toFixed(4).replace('.', ',');
}

function buildBdiSheet({ titulo, bdiConfig, valorBase }) {
  const rows = [];
  const merges = [];
  const rowKinds = {};

  const push = (row, kind) => {
    const padded = [...(row || [])];
    while (padded.length < 4) padded.push('');
    rows.push(padded.slice(0, 4));
    const idx = rows.length - 1;
    if (kind) rowKinds[idx] = kind;
    return idx;
  };

  const r0 = push([titulo], 'capa');
  merges.push({ s: { r: r0, c: 0 }, e: { r: r0, c: 3 } });
  push([]);

  if (!bdiConfig) {
    const r = push(['BDI não aplicado neste orçamento.'], 'aviso');
    merges.push({ s: { r, c: 0 }, e: { r, c: 3 } });
    push([]);
    const f = push([
      'Fórmula de referência (TCU 2622/2013, simplificada):',
      '',
      '',
      ''
    ], 'meta');
    merges.push({ s: { r: f, c: 0 }, e: { r: f, c: 3 } });
    const f2 = push(['BDI = [(1 + G) × (1 + DF) × (1 + L) / (1 − T)] − 1'], 'formula');
    merges.push({ s: { r: f2, c: 0 }, e: { r: f2, c: 3 } });
  } else {
    const m = memoriaCalculoBdi(bdiConfig, valorBase);

    push(['Parâmetros utilizados'], 'secao');
    push(['Parâmetro', 'Símbolo', 'Percentual', 'Fator'], 'header');
    BDI_CAMPOS.forEach(({ key, label }) => {
      const simbolo =
        key === 'garantias' ? 'G'
          : key === 'financeiro' ? 'DF'
            : key === 'lucro' ? 'L'
              : 'T';
      const pct = Number(bdiConfig[key]) || 0;
      const fator =
        key === 'tributos'
          ? m.fatorT
          : key === 'garantias'
            ? m.fatorG
            : key === 'financeiro'
              ? m.fatorDf
              : m.fatorL;
      const fatorLabel =
        key === 'tributos'
          ? `(1 − T) = ${fatorBr(fator)}`
          : `(1 + ${simbolo}) = ${fatorBr(fator)}`;
      push([label, simbolo, pct / 100, fatorLabel], 'param');
    });

    push([]);
    push(['Fórmula'], 'secao');
    const fRow = push(['BDI = [(1 + G) × (1 + DF) × (1 + L) / (1 − T)] − 1'], 'formula');
    merges.push({ s: { r: fRow, c: 0 }, e: { r: fRow, c: 3 } });
    push([]);

    push(['Memória de cálculo'], 'secao');
    push(['Etapa', 'Cálculo', 'Resultado', ''], 'header');
    push([
      '(1 + G)',
      `(1 + ${pctBr(m.g)})`,
      m.fatorG,
      ''
    ], 'passo');
    push([
      '(1 + DF)',
      `(1 + ${pctBr(m.df)})`,
      m.fatorDf,
      ''
    ], 'passo');
    push([
      '(1 + L)',
      `(1 + ${pctBr(m.l)})`,
      m.fatorL,
      ''
    ], 'passo');
    push([
      '(1 − T)',
      `(1 − ${pctBr(m.t)})`,
      m.fatorT,
      ''
    ], 'passo');
    push([
      'Numerador',
      `${fatorBr(m.fatorG)} × ${fatorBr(m.fatorDf)} × ${fatorBr(m.fatorL)}`,
      m.numerador,
      ''
    ], 'passo');
    push([
      'Fator de venda',
      `${fatorBr(m.numerador)} / ${fatorBr(m.fatorT)}`,
      m.fatorVenda,
      ''
    ], 'passo');
    push([
      'BDI',
      `${fatorBr(m.fatorVenda)} − 1`,
      m.bdiPercent / 100,
      ''
    ], 'destaque');

    push([]);
    push(['Aplicação sobre o custo direto'], 'secao');
    push(['Descrição', 'Valor', '', ''], 'header');
    push(['Custo direto', m.base, '', ''], 'valor');
    push(['Valor do BDI', m.valorBdi, '', ''], 'valor');
    push(['Total com BDI (preço de venda)', m.valorComBdi, '', ''], 'totalVenda');
    push([]);
    const n = push([
      'Preço de venda = Custo direto × (1 + BDI)',
      '',
      '',
      ''
    ], 'meta');
    merges.push({ s: { r: n, c: 0 }, e: { r: n, c: 3 } });
  }

  const ws = XLSX.utils.aoa_to_sheet(sanitizeRows(rows));
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 42 },
    { wch: 36 },
    { wch: 16 },
    { wch: 28 }
  ];

  Object.entries(rowKinds).forEach(([rowStr, kind]) => {
    const R = Number(rowStr);
    if (kind === 'capa') {
      applyRowStyle(ws, R, 4, {
        font: { bold: true, sz: 14, color: { rgb: '17324D' } }
      });
    } else if (kind === 'secao') {
      applyRowStyle(ws, R, 4, {
        fill: fillStyle(COR_HEADER),
        font: { bold: true, color: { rgb: 'FFFFFF' } }
      });
    } else if (kind === 'header') {
      applyRowStyle(ws, R, 4, {
        fill: fillStyle(COR_META),
        font: { bold: true, color: { rgb: '17212B' } }
      });
    } else if (kind === 'formula') {
      applyRowStyle(ws, R, 4, {
        font: { bold: true, sz: 11, color: { rgb: '17324D' } }
      });
    } else if (kind === 'destaque' || kind === 'totalVenda') {
      applyRowStyle(ws, R, 4, {
        fill: fillStyle(COR_PACOTE),
        font: { bold: true }
      });
    } else if (kind === 'aviso') {
      applyRowStyle(ws, R, 4, {
        font: { bold: true, color: { rgb: '842029' } }
      });
    }

    if (kind === 'param') {
      applyCellStyle(ws, R, 2, { numFmt: PCT_FMT });
    }
    if (kind === 'passo') {
      applyCellStyle(ws, R, 2, { numFmt: '0.0000' });
    }
    if (kind === 'destaque' && String(rows[R]?.[0] || '').toUpperCase() === 'BDI') {
      applyCellStyle(ws, R, 2, { numFmt: PCT_FMT });
    }
    if (kind === 'valor' || kind === 'totalVenda') {
      applyCellStyle(ws, R, 1, { numFmt: MONEY_FMT });
    }
  });

  return ws;
}

/**
 * Exporta a EAP no layout da planilha orçamentária ou de venda.
 * @param {object} opts
 * @param {boolean} [opts.modoVenda]
 * @param {number} [opts.fatorBdi]
 */
export function exportarEapPlanilhaOrcamento({
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
  insumos = []
}) {
  const rows = [];
  const merges = [];
  /** @type {Record<number, string>} */
  const rowKinds = {};

  const push = (row, kind) => {
    rows.push(row);
    const idx = rows.length - 1;
    if (kind) rowKinds[idx] = kind;
    return idx;
  };

  const {
    nomeObra, local, cliente, revLabel, elab, statusLabel, dataExport, ultimaAtualizacao
  } = getEapCabecalhoMeta({ orcamento, revisao, elaboradoPor, status });

  const tituloPlanilha = modoVenda ? 'PLANILHA DE VENDA' : 'PLANILHA ORÇAMENTÁRIA';

  const titleRow = push([
    'ORÇATUDO', '', '', '', tituloPlanilha, '', '', '', '', '', '', ''
  ]);
  merges.push(
    { s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 3 } },
    { s: { r: titleRow, c: 4 }, e: { r: titleRow, c: 11 } }
  );

  const obraRow = push([
    'OBRA', nomeObra, '', '', '', '', 'REVISÃO', `Rev. ${revLabel}`, '', 'STATUS', statusLabel, ''
  ]);
  merges.push(
    { s: { r: obraRow, c: 1 }, e: { r: obraRow, c: 5 } },
    { s: { r: obraRow, c: 7 }, e: { r: obraRow, c: 8 } },
    { s: { r: obraRow, c: 10 }, e: { r: obraRow, c: 11 } }
  );

  const localRow = push([
    'LOCAL', local, '', '', '', '', 'CLIENTE', cliente, '', '', '', ''
  ]);
  merges.push(
    { s: { r: localRow, c: 1 }, e: { r: localRow, c: 5 } },
    { s: { r: localRow, c: 7 }, e: { r: localRow, c: 11 } }
  );

  const metaRow = push([
    'ELABORADO POR', elab, '', '',
    'ÚLTIMA ATUALIZAÇÃO', ultimaAtualizacao, '',
    'DATA DA EXPORTAÇÃO', dataExport, '', '', ''
  ]);
  merges.push(
    { s: { r: metaRow, c: 1 }, e: { r: metaRow, c: 3 } },
    { s: { r: metaRow, c: 5 }, e: { r: metaRow, c: 6 } },
    { s: { r: metaRow, c: 8 }, e: { r: metaRow, c: 11 } }
  );

  push(emptyRow());

  const h1 = push([
    'No.', 'COD.', 'DESCRIÇÃO', 'UND.', 'QUANT.',
    'VALOR UNITÁRIO', '', '',
    'VALOR TOTAL', '', '',
    'INC.'
  ]);
  push([
    '', '', '', '', '',
    'MAT+EQP', 'MO+SERV', 'TOTAL',
    'MAT+EQP', 'MO+SERV', 'TOTAL',
    '%'
  ]);
  merges.push(
    { s: { r: h1, c: 0 }, e: { r: h1 + 1, c: 0 } },
    { s: { r: h1, c: 1 }, e: { r: h1 + 1, c: 1 } },
    { s: { r: h1, c: 2 }, e: { r: h1 + 1, c: 2 } },
    { s: { r: h1, c: 3 }, e: { r: h1 + 1, c: 3 } },
    { s: { r: h1, c: 4 }, e: { r: h1 + 1, c: 4 } },
    { s: { r: h1, c: 5 }, e: { r: h1, c: 7 } },
    { s: { r: h1, c: 8 }, e: { r: h1, c: 10 } },
    { s: { r: h1, c: 11 }, e: { r: h1 + 1, c: 11 } }
  );

  const { rows: tabelaRows } = buildEapTabelaRows({
    orcamento,
    calcularSubvalores,
    valorTotal,
    valorComBDI,
    bdiValor,
    modoVenda,
    fatorBdi
  });

  const tableStartRow = rows.length;
  let footerStart = null;

  tabelaRows.forEach((item) => {
    if (item.kind === 'footer' && footerStart == null) {
      push(emptyRow());
      footerStart = rows.length;
    }
    const idx = push(item.cells, item.kind);
    if (item.kind === 'footer') {
      merges.push({ s: { r: idx, c: 2 }, e: { r: idx, c: 9 } });
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(sanitizeRows(rows));
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 55 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 }
  ];
  ws['!rows'] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 18 }, { hpt: 18 }];

  const isInteiro = (n) => Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9;
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  for (let R = tableStartRow; R <= range.e.r; R++) {
    const cellQtd = ws[XLSX.utils.encode_cell({ r: R, c: 4 })];
    if (cellQtd && typeof cellQtd.v === 'number' && Number.isFinite(cellQtd.v)) {
      cellQtd.t = 'n';
      if (isInteiro(cellQtd.v)) {
        cellQtd.v = Math.round(cellQtd.v);
        cellQtd.z = '0';
      } else {
        cellQtd.z = '0.###';
      }
    } else if (cellQtd && typeof cellQtd.v === 'number') {
      cellQtd.t = 'n';
      cellQtd.v = 0;
      cellQtd.z = '0';
    }

    for (const c of [5, 6, 7, 8, 9, 10]) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c })];
      if (cell && typeof cell.v === 'number') {
        if (!Number.isFinite(cell.v)) cell.v = 0;
        cell.t = 'n';
        cell.z = MONEY_FMT;
      }
    }

    const cellInc = ws[XLSX.utils.encode_cell({ r: R, c: 11 })];
    if (cellInc && typeof cellInc.v === 'number') {
      if (!Number.isFinite(cellInc.v)) cellInc.v = 0;
      cellInc.t = 'n';
      cellInc.z = PCT_FMT;
    }
  }

  Object.entries(rowKinds).forEach(([rowStr, kind]) => {
    const R = Number(rowStr);
    if (kind === 'pacote') {
      applyRowStyle(ws, R, 12, {
        fill: fillStyle(COR_PACOTE),
        font: { bold: true, color: { rgb: '17212B' } }
      });
    } else if (kind === 'grupo') {
      applyRowStyle(ws, R, 12, {
        fill: fillStyle(COR_GRUPO),
        font: { bold: true, color: { rgb: '17212B' } }
      });
    } else if (kind === 'subgrupo') {
      applyRowStyle(ws, R, 12, {
        fill: fillStyle(COR_SUBGRUPO),
        font: { bold: true, color: { rgb: '17212B' } }
      });
    } else if (kind === 'footer') {
      applyRowStyle(ws, R, 12, {
        font: { bold: true, color: { rgb: '17212B' } }
      });
    }
  });

  applyRowStyle(ws, h1, 12, {
    fill: fillStyle(COR_HEADER),
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  });
  applyRowStyle(ws, h1 + 1, 12, {
    fill: fillStyle(COR_HEADER),
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  const abcComps = calcularCurvaAbcComposicoes(orcamento?.composicoes);
  const abcInsumos = calcularCurvaAbcInsumos(
    orcamento?.composicoes,
    catalogoComposicoes,
    insumos
  );

  const wsAbcComps = buildAbcSheet({
    titulo: `Curva ABC — Composições · ${nomeObra} · Rev. ${revLabel}`,
    curva: abcComps.curva,
    resumo: abcComps.resumo,
    rotuloItem: 'Composição'
  });

  const wsAbcInsumos = buildAbcSheet({
    titulo: `Curva ABC — Insumos · ${nomeObra} · Rev. ${revLabel}`,
    curva: abcInsumos.curva,
    resumo: abcInsumos.resumo,
    rotuloItem: 'Insumo'
  });

  const listaComposicoes = listarComposicoesAbertas(
    orcamento?.composicoes,
    catalogoComposicoes,
    insumos
  );
  const wsComposicoes = buildComposicoesSheet({
    titulo: `Composições · ${nomeObra} · Rev. ${revLabel}`,
    composicoes: listaComposicoes,
    bdiPercent: 0
  });

  const wsBdi = buildBdiSheet({
    titulo: `Cálculo do BDI · ${nomeObra} · Rev. ${revLabel}`,
    bdiConfig: orcamento?.bdiConfig || null,
    valorBase: valorTotal
  });

  const wb = XLSX.utils.book_new();
  const sheetPrefix = modoVenda ? 'Venda' : 'Orçamento';
  const sheetName = `${sheetPrefix} R${revLabel}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.utils.book_append_sheet(wb, wsBdi, 'BDI');
  XLSX.utils.book_append_sheet(wb, wsAbcComps, 'ABC Composição');
  XLSX.utils.book_append_sheet(wb, wsAbcInsumos, 'ABC Insumos');
  XLSX.utils.book_append_sheet(wb, wsComposicoes, 'composições');

  const safeName = nomeObra.replace(/[^a-zA-Z0-9À-ÿ _-]/g, '_').slice(0, 60);
  const filePrefix = modoVenda ? 'PlanilhaVenda' : 'Orcamento';
  XLSX.writeFile(wb, `${filePrefix}_${safeName}_R${revLabel}.xlsx`);
}
