export const CATEGORIAS_COMPOSICAO = [
  { key: 'Material', label: 'MATERIAIS' },
  { key: 'Mão de Obra', label: 'MAO DE OBRA' },
  { key: 'Equipamento', label: 'EQUIPAMENTOS' },
  { key: 'Serviço', label: 'SERVICOS' }
];

/** Lista composições distintas usadas no orçamento, com insumos resolvidos do catálogo. */
export function listarComposicoesAbertas(composicoesOrcamento, catalogoComposicoes, insumos) {
  const mapa = {};

  (composicoesOrcamento || []).forEach((comp) => {
    const key = comp.composicaoId || comp.nome || comp.uid || comp.id;
    if (!key) return;
    const catalogo = (catalogoComposicoes || []).find((c) => c.id === comp.composicaoId);
    const listaInsumos = catalogo?.insumos?.length
      ? catalogo.insumos
      : (comp.insumos || []);

    if (!mapa[key]) {
      const insumosLinha = listaInsumos.map((item) => {
        const insumo = (insumos || []).find((i) => i.id === item.insumoId);
        const coeficiente = parseFloat(item.quantidade) || 0;
        const preco = insumo?.precoUnitario ?? item.precoUnitario ?? 0;
        return {
          codigo: insumo?.codigo || item.codigo || '',
          nome: insumo?.nome || item.nome || item.insumoId || 'Insumo',
          unidade: insumo?.unidade || item.unidade || '',
          categoria: insumo?.categoria || item.categoria || 'Material',
          coeficiente,
          preco,
          total: coeficiente * preco
        };
      });

      const totalSimples = insumosLinha.reduce((s, i) => s + (i.total || 0), 0);
      const precoAdotado = totalSimples > 0
        ? totalSimples
        : (parseFloat(comp.custoUnitario) || catalogo?.valorTotal || 0);

      mapa[key] = {
        codigo: comp.codigo || catalogo?.codigo || '',
        nome: comp.nome || catalogo?.nome || 'Composição',
        unidade: comp.unidade || catalogo?.unidade || '',
        precoAdotado,
        totalSimples,
        insumos: insumosLinha
      };
    }

    if (!mapa[key].codigo && (comp.codigo || catalogo?.codigo)) {
      mapa[key].codigo = comp.codigo || catalogo?.codigo || '';
    }
  });

  return Object.values(mapa).sort((a, b) =>
    String(a.codigo || a.nome).localeCompare(String(b.codigo || b.nome), 'pt-BR')
  );
}

export const SECOES_PDF_PADRAO = {
  eap: true,
  composicoes: true,
  abcComposicao: true,
  abcInsumos: true
};
