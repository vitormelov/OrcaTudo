/**
 * Converte a planilha SEINFRA de composições em public/composicoes/*.xls(x) para seinfra.json
 * Uso: node scripts/convert-composicoes-seinfra.js [caminho-opcional-do-xls]
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const CATEGORIA = {
  'MAO DE OBRA': 'Mão de Obra',
  MATERIAIS: 'Material',
  EQUIPAMENTOS: 'Equipamento',
  'EQUIPAMENTOS (CHORARIO)': 'Equipamento',
  'EQUIPAMENTOS (CHP)': 'Equipamento',
  SERVICOS: 'Serviço',
  SERVIÇOS: 'Serviço'
};

const unitMap = {
  HXMÊS: 'HxMÊS',
  HxMÊS: 'HxMÊS',
  M2XMÊS: 'M2xMÊS',
  'M³': 'M3',
  'M²': 'M2',
  UND: 'UN'
};

function normalizeUnit(u) {
  const s = String(u || '').trim();
  return unitMap[s] || s;
}

function parseHeader(cell) {
  if (!cell || typeof cell !== 'string') return null;
  const text = cell.replace(/\s+/g, ' ').trim();
  // C1802 - DESCRIÇÃO - UN
  const m = text.match(/^([A-Za-z]?\d+)\s*-\s*(.+)\s*-\s*([A-Za-z0-9/³²xXÊêÇç]+)\s*$/);
  if (m) {
    return {
      codigo: m[1].trim(),
      nome: m[2].trim(),
      unidade: normalizeUnit(m[3])
    };
  }
  // Fallback: last " - XXX" is unit
  const m2 = text.match(/^([A-Za-z]?\d+)\s*-\s*(.+)$/);
  if (m2) {
    const rest = m2[2];
    const idx = rest.lastIndexOf(' - ');
    if (idx > 0) {
      return {
        codigo: m2[1].trim(),
        nome: rest.slice(0, idx).trim(),
        unidade: normalizeUnit(rest.slice(idx + 3))
      };
    }
    return { codigo: m2[1].trim(), nome: rest.trim(), unidade: 'UN' };
  }
  return null;
}

function isSectionHeader(value) {
  return typeof value === 'string' && Boolean(CATEGORIA[value.trim()]);
}

function isInsumoCode(value) {
  return typeof value === 'string' && /^[A-Za-z]?\d+/.test(value.trim());
}

function parseSheets(wb) {
  const composicoes = [];
  let current = null;
  let categoria = 'Material';
  const headerFails = [];

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });

    for (const row of rows) {
      const a = row[0];
      const d = row[3];
      const e = row[4];
      const f = row[5];

      // Composition title row: only first cell filled with "Cxxxx - ..."
      const looksLikeHeader =
        typeof a === 'string' &&
        /^[A-Za-z]?\d+\s*-/.test(a.replace(/\s+/g, ' ').trim()) &&
        row[1] == null &&
        row[2] == null;

      if (looksLikeHeader) {
        if (current) composicoes.push(current);
        const h = parseHeader(a);
        if (!h) {
          headerFails.push(a);
          current = null;
          continue;
        }
        current = { ...h, valorTotal: 0, insumos: [] };
        categoria = 'Material';
        continue;
      }

      if (!current) continue;

      if (isSectionHeader(a)) {
        categoria = CATEGORIA[String(a).trim()];
        continue;
      }

      if (d === 'Valor Geral:') {
        current.valorTotal = Number(f) || 0;
        continue;
      }

      if (
        e === 'Total:' ||
        d === 'Total Simples:' ||
        d === 'Encargos Sociais:' ||
        d === 'Valor BDI:' ||
        (typeof a === 'string' && a.includes('Unidade'))
      ) {
        continue;
      }

      // Insumo: codigo | nome | unidade | coeficiente | preco | total
      if (isInsumoCode(a) && row[1] != null && row[2] != null) {
        current.insumos.push({
          codigo: String(a).trim(),
          nome: String(row[1]).trim(),
          unidade: normalizeUnit(row[2]),
          quantidade: Number(row[3]) || 0,
          precoUnitario: Number(row[4]) || 0,
          categoria
        });
      }
    }
  }

  if (current) composicoes.push(current);
  return { composicoes, headerFails };
}

const composicoesDir = path.join(__dirname, '..', 'public', 'composicoes');
const argPath = process.argv[2];
let xlsPath = argPath;

if (!xlsPath) {
  const files = fs.readdirSync(composicoesDir).filter((f) => /\.xlsx?$/i.test(f));
  if (files.length === 0) {
    console.error('Nenhuma planilha .xls/.xlsx encontrada em public/composicoes/');
    process.exit(1);
  }
  xlsPath = path.join(composicoesDir, files[0]);
}

const wb = XLSX.readFile(xlsPath);
const { composicoes, headerFails } = parseSheets(wb);

const out = path.join(composicoesDir, 'seinfra.json');
fs.writeFileSync(out, JSON.stringify(composicoes));

const empty = composicoes.filter((c) => !c.insumos.length).length;
console.log(`Arquivo: ${xlsPath}`);
console.log(`Geradas ${composicoes.length} composições em ${out}`);
console.log(`Sem insumos: ${empty} | Headers não parseados: ${headerFails.length}`);
console.log(`Tamanho: ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB`);
if (composicoes[0]) {
  console.log('Exemplo:', composicoes[0].codigo, '-', composicoes[0].nome.slice(0, 50), '|', composicoes[0].insumos.length, 'insumos');
}
if (headerFails.length) {
  console.log('Falhas (até 5):', headerFails.slice(0, 5));
}
