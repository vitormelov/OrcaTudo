import * as XLSX from 'xlsx-js-style';
import { buildEapTabelaRows, getEapCabecalhoMeta } from './eapPlanilhaShared';

/** Cores alinhadas à EAP do site */
const COR_PACOTE = 'E8EEF3';
const COR_GRUPO = 'F5F7F9';
const COR_SUBGRUPO = 'EEF2F5';

const MONEY_FMT = '"R$"#,##0.00';
const PCT_FMT = '0.00%';

function emptyRow(cols = 12) {
  return Array(cols).fill('');
}

function fillStyle(rgb) {
  return {
    patternType: 'solid',
    fgColor: { rgb }
  };
}

function applyRowStyle(ws, rowIndex, cols, style) {
  for (let c = 0; c < cols; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    const prev = ws[addr].s || {};
    const numFmt = style.numFmt || prev.numFmt || ws[addr].z;
    ws[addr].s = {
      ...prev,
      ...style,
      fill: style.fill || prev.fill,
      font: { ...(prev.font || {}), ...(style.font || {}) },
      alignment: { ...(prev.alignment || {}), ...(style.alignment || {}) },
      ...(numFmt ? { numFmt } : {})
    };
  }
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
  fatorBdi = 1
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

  const ws = XLSX.utils.aoa_to_sheet(rows);
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
    if (cellQtd && typeof cellQtd.v === 'number') {
      cellQtd.t = 'n';
      if (isInteiro(cellQtd.v)) {
        cellQtd.v = Math.round(cellQtd.v);
        cellQtd.z = '0';
      } else {
        cellQtd.z = '0.###';
      }
    }

    for (const c of [5, 6, 7, 8, 9, 10]) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c })];
      if (cell && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = MONEY_FMT;
      }
    }

    const cellInc = ws[XLSX.utils.encode_cell({ r: R, c: 11 })];
    if (cellInc && typeof cellInc.v === 'number') {
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
    fill: fillStyle('17324D'),
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  });
  applyRowStyle(ws, h1 + 1, 12, {
    fill: fillStyle('17324D'),
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  const wb = XLSX.utils.book_new();
  const sheetPrefix = modoVenda ? 'Venda' : 'Orçamento';
  const sheetName = `${sheetPrefix} R${revLabel}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const safeName = nomeObra.replace(/[^a-zA-Z0-9À-ÿ _-]/g, '_').slice(0, 60);
  const filePrefix = modoVenda ? 'PlanilhaVenda' : 'Orcamento';
  XLSX.writeFile(wb, `${filePrefix}_${safeName}_R${revLabel}.xlsx`);
}
