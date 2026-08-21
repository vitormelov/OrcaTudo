/**
 * BDI — Benefícios e Despesas Indiretas
 *
 * Modelo simplificado alinhado ao Acórdão TCU 2622/2013 (obras públicas):
 *
 *   BDI = [(1 + G) × (1 + DF) × (1 + L) / (1 − T)] − 1
 *
 *   G  = despesas indiretas (administração, seguros, riscos, garantias)
 *   DF = despesas financeiras (capital de giro)
 *   L  = lucro
 *   T  = tributos sobre o faturamento (PIS, COFINS, ISS) — entram no denominador
 *
 * Preço de venda: PV = Custo direto × (1 + BDI)
 *
 * A fórmula oficial TCU separa AC, S, R e G; aqui "garantias" agrupa essas despesas.
 */

export const BDI_CAMPOS = [
  {
    key: 'garantias',
    label: 'Despesas indiretas (G)',
    hint: 'Administração central, seguros, riscos e garantias'
  },
  {
    key: 'financeiro',
    label: 'Despesas financeiras (DF)',
    hint: 'Custo do capital de giro até a medição'
  },
  {
    key: 'lucro',
    label: 'Lucro (L)',
    hint: 'Remuneração da empresa'
  },
  {
    key: 'tributos',
    label: 'Tributos (T)',
    hint: 'PIS, COFINS e ISS — incidem sobre o preço de venda'
  }
];

export function calcularBdiDecimal(config) {
  const g = (Number(config?.garantias) || 0) / 100;
  const df = (Number(config?.financeiro) || 0) / 100;
  const l = (Number(config?.lucro) || 0) / 100;
  const t = (Number(config?.tributos) || 0) / 100;
  if (t >= 1) return 0;
  const numerador = (1 + g) * (1 + df) * (1 + l);
  return numerador / (1 - t) - 1;
}

export function calcularBdiPercent(config) {
  return calcularBdiDecimal(config) * 100;
}

export function calcularValorComBdi(valorBase, config) {
  const base = Number(valorBase) || 0;
  if (!config) return base;
  return base * (1 + calcularBdiDecimal(config));
}

export function memoriaCalculoBdi(config, valorBase = 0) {
  const g = Number(config?.garantias) || 0;
  const df = Number(config?.financeiro) || 0;
  const l = Number(config?.lucro) || 0;
  const t = Number(config?.tributos) || 0;
  const fatorG = 1 + g / 100;
  const fatorDf = 1 + df / 100;
  const fatorL = 1 + l / 100;
  const fatorT = 1 - t / 100;
  const numerador = fatorG * fatorDf * fatorL;
  const fatorVenda = fatorT > 0 ? numerador / fatorT : numerador;
  const bdiDecimal = fatorVenda - 1;
  const base = Number(valorBase) || 0;

  return {
    g,
    df,
    l,
    t,
    fatorG,
    fatorDf,
    fatorL,
    fatorT,
    numerador,
    fatorVenda,
    bdiPercent: bdiDecimal * 100,
    base,
    valorBdi: base * bdiDecimal,
    valorComBdi: base * fatorVenda
  };
}
