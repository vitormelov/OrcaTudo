import { formatRevisao, getObraId, getRevisao } from './eapCopy';
import { migrarEapAntigo, getCompsDoNo, pacoteContainer, grupoContainer } from './eapTree';
import { getContainerItems } from './eapDnD';

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

/**
 * Organiza linhas do comparativo na hierarquia EAP do orçamento base (rev. anterior),
 * com pacotes, grupos e subgrupos na mesma ordem do orçamento.
 */
export function organizarLinhasCompPorEap(revBase, revComparada, linhasComp) {
  if (!revBase || !linhasComp?.length) return [];

  const base = migrarEapAntigo(revBase);
  const comparada = revComparada ? migrarEapAntigo(revComparada) : null;
  const linhasMap = new Map();
  linhasComp.forEach((row, idx) => {
    linhasMap.set(row.key || `__idx_${idx}`, row);
  });
  const usedKeys = new Set();
  const resultado = [];

  const emitComp = (orcamento, comp) => {
    const key = chaveComposicao(orcamento, comp);
    const row = linhasMap.get(key);
    if (!row || usedKeys.has(key)) return false;
    usedKeys.add(key);
    resultado.push({ tipo: 'comp', row });
    return true;
  };

  const emitHeader = (headerTipo, nome, nivel) => {
    resultado.push({ tipo: 'header', headerTipo, nome, nivel });
  };

  const compVisivelNoEscopo = (orcamento, escopo) =>
    getCompsDoNo(orcamento.composicoes, escopo).some((c) =>
      linhasMap.has(chaveComposicao(orcamento, c))
    );

  const walkGrupo = (pacote, grupo, nivel) => {
    const gEscopo = { pacoteId: pacote.id, grupoId: grupo.id };
    const gItems = getContainerItems(base, grupoContainer(grupo.id));
    const temFilho =
      compVisivelNoEscopo(base, gEscopo) ||
      gItems.some((gItemId) => {
        if (!gItemId.startsWith('subgrupo:')) {
          if (!gItemId.startsWith('comp:')) return false;
          const cUid = gItemId.slice(5);
          const c = (base.composicoes || []).find((x) => x.uid === cUid);
          return c && linhasMap.has(chaveComposicao(base, c));
        }
        const sUid = gItemId.slice(9);
        const subgrupo = (grupo.subgrupos || []).find((x) => x.uid === sUid || x.id === sUid);
        if (!subgrupo) return false;
        return compVisivelNoEscopo(base, {
          pacoteId: pacote.id,
          grupoId: grupo.id,
          subgrupoId: subgrupo.id
        });
      });
    if (!temFilho) return;

    emitHeader('grupo', grupo.nome || 'Grupo', nivel);

    gItems.forEach((gItemId) => {
      if (gItemId.startsWith('subgrupo:')) {
        const sUid = gItemId.slice(9);
        const subgrupo = (grupo.subgrupos || []).find((x) => x.uid === sUid || x.id === sUid);
        if (!subgrupo) return;
        const sEscopo = {
          pacoteId: pacote.id,
          grupoId: grupo.id,
          subgrupoId: subgrupo.id
        };
        if (!compVisivelNoEscopo(base, sEscopo)) return;
        emitHeader('subgrupo', subgrupo.nome || 'Subgrupo', nivel + 1);
        getCompsDoNo(base.composicoes, sEscopo).forEach((c) => emitComp(base, c));
        return;
      }
      if (gItemId.startsWith('comp:')) {
        const cUid = gItemId.slice(5);
        const c = (base.composicoes || []).find((x) => x.uid === cUid);
        if (c) emitComp(base, c);
      }
    });
  };

  const walkPacote = (pacote, nivel) => {
    const pItems = getContainerItems(base, pacoteContainer(pacote.id));
    const temFilho =
      compVisivelNoEscopo(base, { pacoteId: pacote.id }) ||
      pItems.some((itemId) => {
        if (itemId.startsWith('grupo:')) {
          const uid = itemId.slice(6);
          const grupo = (pacote.grupos || []).find((x) => x.uid === uid || x.id === uid);
          if (!grupo) return false;
          const gItems = getContainerItems(base, grupoContainer(grupo.id));
          return (
            compVisivelNoEscopo(base, { pacoteId: pacote.id, grupoId: grupo.id }) ||
            gItems.some((gItemId) => {
              if (gItemId.startsWith('subgrupo:')) {
                const sUid = gItemId.slice(9);
                const subgrupo = (grupo.subgrupos || []).find((x) => x.uid === sUid || x.id === sUid);
                return (
                  subgrupo &&
                  compVisivelNoEscopo(base, {
                    pacoteId: pacote.id,
                    grupoId: grupo.id,
                    subgrupoId: subgrupo.id
                  })
                );
              }
              if (gItemId.startsWith('comp:')) {
                const cUid = gItemId.slice(5);
                const c = (base.composicoes || []).find((x) => x.uid === cUid);
                return c && linhasMap.has(chaveComposicao(base, c));
              }
              return false;
            })
          );
        }
        if (itemId.startsWith('comp:')) {
          const cUid = itemId.slice(5);
          const c = (base.composicoes || []).find((x) => x.uid === cUid);
          return c && linhasMap.has(chaveComposicao(base, c));
        }
        return false;
      });
    if (!temFilho) return;

    emitHeader('pacote', pacote.nome || 'Pacote', nivel);

    pItems.forEach((itemId) => {
      if (itemId.startsWith('grupo:')) {
        const uid = itemId.slice(6);
        const grupo = (pacote.grupos || []).find((x) => x.uid === uid || x.id === uid);
        if (grupo) walkGrupo(pacote, grupo, nivel + 1);
        return;
      }
      if (itemId.startsWith('comp:')) {
        const cUid = itemId.slice(5);
        const c = (base.composicoes || []).find((x) => x.uid === cUid);
        if (c) emitComp(base, c);
      }
    });
  };

  const pacotes = [...(base.pacotes || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  pacotes.forEach((pacote) => walkPacote(pacote, 0));

  // Composições novas na revisão comparada (não existiam na base)
  const restantes = linhasComp.filter((r) => r.key && !usedKeys.has(r.key));
  if (restantes.length && comparada) {
    const keysRestantes = new Set(restantes.map((r) => r.key));
    emitHeader('secao', 'Composições adicionadas na revisão comparada', 0);

    const walkGrupoB = (pacote, grupo, nivel) => {
      const gEscopo = { pacoteId: pacote.id, grupoId: grupo.id };
      const gItems = getContainerItems(comparada, grupoContainer(grupo.id));
      const temFilho =
        getCompsDoNo(comparada.composicoes, gEscopo).some((c) =>
          keysRestantes.has(chaveComposicao(comparada, c))
        ) ||
        gItems.some((gItemId) => {
          if (!gItemId.startsWith('subgrupo:')) return false;
          const sUid = gItemId.slice(9);
          const subgrupo = (grupo.subgrupos || []).find((x) => x.uid === sUid || x.id === sUid);
          if (!subgrupo) return false;
          return getCompsDoNo(comparada.composicoes, {
            pacoteId: pacote.id,
            grupoId: grupo.id,
            subgrupoId: subgrupo.id
          }).some((c) => keysRestantes.has(chaveComposicao(comparada, c)));
        });
      if (!temFilho) return;

      emitHeader('grupo', grupo.nome || 'Grupo', nivel);
      gItems.forEach((gItemId) => {
        if (gItemId.startsWith('subgrupo:')) {
          const sUid = gItemId.slice(9);
          const subgrupo = (grupo.subgrupos || []).find((x) => x.uid === sUid || x.id === sUid);
          if (!subgrupo) return;
          const sEscopo = {
            pacoteId: pacote.id,
            grupoId: grupo.id,
            subgrupoId: subgrupo.id
          };
          const comps = getCompsDoNo(comparada.composicoes, sEscopo).filter((c) =>
            keysRestantes.has(chaveComposicao(comparada, c))
          );
          if (!comps.length) return;
          emitHeader('subgrupo', subgrupo.nome || 'Subgrupo', nivel + 1);
          comps.forEach((c) => emitComp(comparada, c));
          return;
        }
        if (gItemId.startsWith('comp:')) {
          const cUid = gItemId.slice(5);
          const c = (comparada.composicoes || []).find((x) => x.uid === cUid);
          if (c && keysRestantes.has(chaveComposicao(comparada, c))) emitComp(comparada, c);
        }
      });
    };

    const pacotesB = [...(comparada.pacotes || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    pacotesB.forEach((pacote) => {
      const pItems = getContainerItems(comparada, pacoteContainer(pacote.id));
      const temFilho = pItems.some((itemId) => {
        if (itemId.startsWith('grupo:')) {
          const uid = itemId.slice(6);
          const grupo = (pacote.grupos || []).find((x) => x.uid === uid || x.id === uid);
          if (!grupo) return false;
          return getCompsDoNo(comparada.composicoes, { pacoteId: pacote.id, grupoId: grupo.id }).some(
            (c) => keysRestantes.has(chaveComposicao(comparada, c))
          );
        }
        if (itemId.startsWith('comp:')) {
          const cUid = itemId.slice(5);
          const c = (comparada.composicoes || []).find((x) => x.uid === cUid);
          return c && keysRestantes.has(chaveComposicao(comparada, c));
        }
        return false;
      });
      if (!temFilho) return;

      emitHeader('pacote', pacote.nome || 'Pacote', 0);
      pItems.forEach((itemId) => {
        if (itemId.startsWith('grupo:')) {
          const uid = itemId.slice(6);
          const grupo = (pacote.grupos || []).find((x) => x.uid === uid || x.id === uid);
          if (grupo) walkGrupoB(pacote, grupo, 1);
          return;
        }
        if (itemId.startsWith('comp:')) {
          const cUid = itemId.slice(5);
          const c = (comparada.composicoes || []).find((x) => x.uid === cUid);
          if (c) emitComp(comparada, c);
        }
      });
    });

    // Fallback: linhas sem encaixe na árvore
    restantes.filter((r) => r.key && !usedKeys.has(r.key)).forEach((row) => {
      usedKeys.add(row.key);
      resultado.push({ tipo: 'comp', row });
    });
  } else if (restantes.length) {
    restantes.forEach((row) => {
      if (row.key) usedKeys.add(row.key);
      resultado.push({ tipo: 'comp', row });
    });
  }

  return resultado;
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
