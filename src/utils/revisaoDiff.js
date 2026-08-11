import { formatRevisao, getObraId, getRevisao } from './eapCopy';

export function caminhoComp(orcamento, comp) {
  const pacotes = orcamento?.pacotes || [];
  const pacote = pacotes.find((p) => p.id === comp.pacoteId);
  if (!pacote) return comp.nome || '—';
  const parts = [pacote.nome];
  if (comp.grupoId) {
    const grupo = (pacote.grupos || []).find((g) => g.id === comp.grupoId)
      || (pacote.subgrupos || []).find((s) => s.id === comp.grupoId);
    if (grupo) {
      parts.push(grupo.nome);
      if (comp.subgrupoId) {
        const sub = (grupo.subgrupos || []).find((s) => s.id === comp.subgrupoId);
        if (sub) parts.push(sub.nome);
      }
    }
  } else if (comp.subgrupoId) {
    // modelo antigo
    const sub = (pacote.subgrupos || []).find((s) => s.id === comp.subgrupoId);
    if (sub) parts.push(sub.nome);
  }
  return parts.join(' > ');
}

/** Chave estável entre revisões (IDs de pacote mudam na cópia) */
export function chaveComposicao(orcamento, comp) {
  const caminho = caminhoComp(orcamento, comp);
  return `${comp.composicaoId || comp.nome || ''}||${caminho}`;
}

export function indexarComposicoes(orcamento) {
  const map = new Map();
  (orcamento?.composicoes || []).forEach((comp) => {
    map.set(chaveComposicao(orcamento, comp), comp);
  });
  return map;
}

export function agregarinSumos(orcamento, insumosCatalogo = []) {
  const map = new Map();
  (orcamento?.composicoes || []).forEach((comp) => {
    const qtdComp = parseFloat(comp.quantidade) || 0;
    (comp.insumos || []).forEach((item) => {
      const id = item.insumoId;
      if (!id) return;
      const qtdUnit = parseFloat(item.quantidade) || 0;
      const qtdTotal = qtdUnit * qtdComp;
      const cat = insumosCatalogo.find((i) => i.id === id);
      // Preferir preço da composição (snapshot da revisão); catálogo só como fallback
      const preco = item.precoUnitario ?? cat?.precoUnitario ?? 0;
      const prev = map.get(id) || {
        insumoId: id,
        codigo: cat?.codigo || '',
        nome: cat?.nome || item.nome || id,
        unidade: cat?.unidade || item.unidade || '',
        categoria: cat?.categoria || '',
        quantidade: 0,
        precoUnitario: preco,
        valorTotal: 0
      };
      prev.quantidade += qtdTotal;
      prev.precoUnitario = preco;
      prev.valorTotal = prev.quantidade * preco;
      map.set(id, prev);
    });
  });
  return map;
}

export function diffComposicoes(revA, revB) {
  const mapA = indexarComposicoes(revA);
  const mapB = indexarComposicoes(revB);
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  const adicionadas = [];
  const removidas = [];
  const modificadas = [];
  const iguais = [];

  keys.forEach((key) => {
    const a = mapA.get(key);
    const b = mapB.get(key);
    if (a && !b) {
      removidas.push({ key, a, caminho: caminhoComp(revA, a) });
      return;
    }
    if (!a && b) {
      adicionadas.push({ key, b, caminho: caminhoComp(revB, b) });
      return;
    }
    const mudancas = [];
    const qA = parseFloat(a.quantidade) || 0;
    const qB = parseFloat(b.quantidade) || 0;
    const pA = parseFloat(a.custoUnitario) || 0;
    const pB = parseFloat(b.custoUnitario) || 0;
    const tA = parseFloat(a.custoTotal) || 0;
    const tB = parseFloat(b.custoTotal) || 0;
    if (qA !== qB) mudancas.push({ campo: 'quantidade', de: qA, para: qB });
    if (Math.abs(pA - pB) > 0.0001) mudancas.push({ campo: 'preço unitário', de: pA, para: pB });
    if (Math.abs(tA - tB) > 0.0001) mudancas.push({ campo: 'total', de: tA, para: tB });
    if ((a.unidade || '') !== (b.unidade || '')) {
      mudancas.push({ campo: 'unidade', de: a.unidade || '', para: b.unidade || '' });
    }
    if (mudancas.length) {
      modificadas.push({
        key,
        a,
        b,
        caminho: caminhoComp(revB, b),
        nome: b.nome || a.nome,
        mudancas,
        deltaTotal: tB - tA
      });
    } else {
      iguais.push({ key, a, b });
    }
  });

  return { adicionadas, removidas, modificadas, iguais };
}

export function diffInsumos(revA, revB, insumosCatalogo = []) {
  const mapA = agregarinSumos(revA, insumosCatalogo);
  const mapB = agregarinSumos(revB, insumosCatalogo);
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  const adicionados = [];
  const removidos = [];
  const modificados = [];

  keys.forEach((id) => {
    const a = mapA.get(id);
    const b = mapB.get(id);
    if (a && !b) {
      removidos.push(a);
      return;
    }
    if (!a && b) {
      adicionados.push(b);
      return;
    }
    const mudancas = [];
    if (Math.abs(a.quantidade - b.quantidade) > 0.0001) {
      mudancas.push({ campo: 'quantidade', de: a.quantidade, para: b.quantidade });
    }
    if (Math.abs(a.precoUnitario - b.precoUnitario) > 0.0001) {
      mudancas.push({ campo: 'preço unitário', de: a.precoUnitario, para: b.precoUnitario });
    }
    if (Math.abs(a.valorTotal - b.valorTotal) > 0.0001) {
      mudancas.push({ campo: 'valor total', de: a.valorTotal, para: b.valorTotal });
    }
    if (mudancas.length) {
      modificados.push({
        ...b,
        mudancas,
        deltaQtd: b.quantidade - a.quantidade,
        deltaValor: b.valorTotal - a.valorTotal
      });
    }
  });

  return { adicionados, removidos, modificados };
}

export function agruparPorObra(orcamentos) {
  const map = new Map();
  (orcamentos || []).forEach((o) => {
    const obraId = getObraId(o);
    if (!map.has(obraId)) {
      map.set(obraId, {
        obraId,
        nome: o.nome,
        cliente: o.cliente,
        revisoes: []
      });
    }
    const g = map.get(obraId);
    g.revisoes.push(o);
    // manter nome/cliente da revisão mais recente
    if (getRevisao(o) >= getRevisao(g.revisoes[0])) {
      g.nome = o.nome;
      g.cliente = o.cliente;
    }
  });
  map.forEach((g) => {
    g.revisoes.sort((a, b) => getRevisao(a) - getRevisao(b));
  });
  return Array.from(map.values()).sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
  );
}

export function labelRevisao(orcamento) {
  return `Rev. ${formatRevisao(getRevisao(orcamento))}${orcamento.revisaoTravada ? ' (travada)' : ''}`;
}

export { formatRevisao, getObraId, getRevisao };
