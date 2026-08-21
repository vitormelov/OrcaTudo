/**
 * Avalia expressões aritméticas simples (estilo célula Excel).
 * Aceita apenas números e operadores + - * / ( ) e ^.
 */

function normalizarExpressao(raw) {
  return String(raw || '')
    .trim()
    .replace(/,/g, '.')
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/\^/g, '**')
    .replace(/\s+/g, '');
}

export function avaliarExpressaoMatematica(raw) {
  const original = String(raw || '').trim();
  if (!original) {
    throw new Error('Digite um cálculo.');
  }

  let expr = normalizarExpressao(original);
  if (!expr) {
    throw new Error('Digite um cálculo.');
  }

  // Apenas dígitos, operadores e parênteses (após normalizar ** e vírgula)
  if (!/^[0-9+\-*/().]+$/.test(expr)) {
    throw new Error('Use apenas números e + − × ÷ ( ).');
  }

  // Evita notação científica / identificadores escondidos
  if (/[eE]/.test(expr)) {
    throw new Error('Expressão inválida.');
  }

  // Parênteses balanceados
  let depth = 0;
  for (const ch of expr) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) throw new Error('Parênteses inválidos.');
  }
  if (depth !== 0) throw new Error('Parênteses inválidos.');

  let resultado;
  try {
    // Expressão já validada — sem acesso a escopo
    // eslint-disable-next-line no-new-func
    resultado = Function(`"use strict"; return (${expr});`)();
  } catch {
    throw new Error('Não foi possível calcular. Verifique a expressão.');
  }

  if (typeof resultado !== 'number' || !Number.isFinite(resultado)) {
    throw new Error('Resultado inválido.');
  }

  if (resultado < 0) {
    throw new Error('A quantidade não pode ser negativa.');
  }

  return resultado;
}

/** Arredonda para uso em quantidade (evita lixo de ponto flutuante). */
export function arredondarQuantidade(valor, casas = 6) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}
