/**
 * Curva ABC — classificação e agregação para composições e insumos do orçamento.
 */

export function classificarABC(itens) {
  const ordenados = (itens || [])
    .filter((item) => (item.valorTotal || 0) > 0)
    .sort((a, b) => b.valorTotal - a.valorTotal);

  const valorTotalGeral = ordenados.reduce((sum, item) => sum + item.valorTotal, 0);
  let valorAcumulado = 0;

  const curva = ordenados.map((item) => {
    valorAcumulado += item.valorTotal;
    const percentualAcumulado = valorTotalGeral > 0 ? (valorAcumulado / valorTotalGeral) * 100 : 0;
    let categoriaABC = 'C';
    if (percentualAcumulado <= 80) categoriaABC = 'A';
    else if (percentualAcumulado <= 95) categoriaABC = 'B';

    return {
      ...item,
      categoriaABC,
      percentualAcumulado: percentualAcumulado.toFixed(2),
      percentualValor: valorTotalGeral > 0
        ? ((item.valorTotal / valorTotalGeral) * 100).toFixed(2)
        : '0.00'
    };
  });

  const resumo = {
    totalItens: curva.length,
    valorTotal: valorTotalGeral,
    categoriaA: { quantidade: 0, valor: 0, percentual: '0.00' },
    categoriaB: { quantidade: 0, valor: 0, percentual: '0.00' },
    categoriaC: { quantidade: 0, valor: 0, percentual: '0.00' }
  };

  curva.forEach((item) => {
    const bucket =
      item.categoriaABC === 'A'
        ? resumo.categoriaA
        : item.categoriaABC === 'B'
          ? resumo.categoriaB
          : resumo.categoriaC;
    bucket.quantidade += 1;
    bucket.valor += item.valorTotal;
  });

  if (valorTotalGeral > 0) {
    resumo.categoriaA.percentual = ((resumo.categoriaA.valor / valorTotalGeral) * 100).toFixed(2);
    resumo.categoriaB.percentual = ((resumo.categoriaB.valor / valorTotalGeral) * 100).toFixed(2);
    resumo.categoriaC.percentual = ((resumo.categoriaC.valor / valorTotalGeral) * 100).toFixed(2);
  }

  return { curva, resumo };
}

export function calcularCurvaAbcInsumos(composicoesOrcamento, catalogoComposicoes, insumos) {
  const consumoInsumos = {};

  (composicoesOrcamento || []).forEach((compOrcamento) => {
    const qtdComp = parseFloat(compOrcamento.quantidade) || 0;
    const catalogo = (catalogoComposicoes || []).find((c) => c.id === compOrcamento.composicaoId);
    const listaInsumos =
      (compOrcamento.insumos && compOrcamento.insumos.length > 0)
        ? compOrcamento.insumos
        : (catalogo?.insumos || []);

    listaInsumos.forEach((item) => {
      const insumoId = item.insumoId;
      if (!insumoId) return;
      const quantidadeTotal = (parseFloat(item.quantidade) || 0) * qtdComp;
      if (!consumoInsumos[insumoId]) {
        consumoInsumos[insumoId] = {
          id: insumoId,
          quantidade: 0,
          valorTotal: 0
        };
      }
      consumoInsumos[insumoId].quantidade += quantidadeTotal;
    });
  });

  Object.keys(consumoInsumos).forEach((insumoId) => {
    const insumo = (insumos || []).find((i) => i.id === insumoId);
    if (!insumo) return;
    const preco = insumo.precoUnitario || 0;
    consumoInsumos[insumoId].valorTotal = consumoInsumos[insumoId].quantidade * preco;
    consumoInsumos[insumoId].nome = insumo.nome;
    consumoInsumos[insumoId].codigo = insumo.codigo || '';
    consumoInsumos[insumoId].unidade = insumo.unidade;
    consumoInsumos[insumoId].categoria = insumo.categoria;
    consumoInsumos[insumoId].precoUnitario = preco;
  });

  return classificarABC(Object.values(consumoInsumos));
}

export function calcularCurvaAbcComposicoes(composicoesOrcamento) {
  const consumoComps = {};

  (composicoesOrcamento || []).forEach((comp) => {
    const key = comp.composicaoId || comp.nome || comp.uid || comp.id;
    if (!key) return;
    const qtd = parseFloat(comp.quantidade) || 0;
    const total = parseFloat(comp.custoTotal) || 0;
    if (!consumoComps[key]) {
      consumoComps[key] = {
        id: key,
        codigo: comp.codigo || '',
        nome: comp.nome || 'Composição',
        unidade: comp.unidade || '',
        categoria: 'Composição',
        quantidade: 0,
        valorTotal: 0,
        precoUnitario: parseFloat(comp.custoUnitario) || 0
      };
    }
    consumoComps[key].quantidade += qtd;
    consumoComps[key].valorTotal += total;
    if (consumoComps[key].codigo === '' && comp.codigo) {
      consumoComps[key].codigo = comp.codigo;
    }
    if (consumoComps[key].quantidade > 0) {
      consumoComps[key].precoUnitario =
        consumoComps[key].valorTotal / consumoComps[key].quantidade;
    }
  });

  return classificarABC(Object.values(consumoComps));
}
