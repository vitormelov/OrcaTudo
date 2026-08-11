/**
 * Converte a planilha SEINFRA em public/insumos/*.xls(x) para seinfra.json
 * Uso: node scripts/convert-seinfra.js [caminho-opcional-do-xls]
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const unitMap = {
  HXMÊS: 'HxMÊS',
  HxMÊS: 'HxMÊS',
  M2XMÊS: 'M2xMÊS',
  'M³': 'M3',
  'M²': 'M2',
  UND: 'UN'
};

const insumosDir = path.join(__dirname, '..', 'public', 'insumos');
const argPath = process.argv[2];
let xlsPath = argPath;

if (!xlsPath) {
  const files = fs.readdirSync(insumosDir).filter((f) => /\.xlsx?$/i.test(f));
  if (files.length === 0) {
    console.error('Nenhuma planilha .xls/.xlsx encontrada em public/insumos/');
    process.exit(1);
  }
  xlsPath = path.join(insumosDir, files[0]);
}

const wb = XLSX.readFile(xlsPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

const data = rows
  .map((r) => ({
    codigo: String(r.Insumo || '').trim(),
    nome: String(r['Descrição'] || '').trim(),
    unidade: unitMap[String(r.Unidade || '').trim()] || String(r.Unidade || '').trim(),
    precoUnitario: Number(r['Valor (R$)']) || 0
  }))
  .filter((i) => i.codigo && i.nome);

const out = path.join(insumosDir, 'seinfra.json');
fs.writeFileSync(out, JSON.stringify(data));
console.log(`Gerados ${data.length} insumos em ${out}`);
