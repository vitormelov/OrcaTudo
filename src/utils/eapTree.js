/**
 * Helpers da EAP: migração, vínculo de composições e totais.
 */

export const newId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const ensureUid = (item, prefix = 'uid') => {
  if (item?.uid) return item;
  return { ...item, uid: newId(prefix) };
};

/** Orçamento antigo: pacotes[].subgrupos[] → pacotes[].grupos[].subgrupos[] */
export function migrarEapAntigo(orcamento) {
  if (!orcamento) return orcamento;

  const pacotes = orcamento.pacotes || [];
  const precisaMigrar = pacotes.some(
    (p) => !Array.isArray(p.grupos) || (Array.isArray(p.subgrupos) && p.subgrupos.length > 0)
  );

  if (!precisaMigrar) {
    const pacotesNorm = pacotes.map((p, i) => ({
      ...ensureUid(p, 'pacote'),
      ordem: p.ordem ?? i,
      grupos: (p.grupos || []).map((g, gi) => ({
        ...ensureUid(g, 'grupo'),
        ordem: g.ordem ?? gi,
        subgrupos: (g.subgrupos || []).map((s, si) => ({
          ...ensureUid(s, 'subgrupo'),
          ordem: s.ordem ?? si
        }))
      }))
    }));

    const composicoes = (orcamento.composicoes || []).map((c, i) =>
      ensureUid(
        {
          ...c,
          grupoId: c.grupoId ?? null,
          subgrupoId: c.subgrupoId ?? null,
          ordem: c.ordem ?? i
        },
        'comp'
      )
    );

    return { ...orcamento, pacotes: pacotesNorm, composicoes };
  }

  const pacotesMigrados = pacotes.map((p, i) => {
    if (Array.isArray(p.grupos) && (!p.subgrupos || p.subgrupos.length === 0)) {
      return {
        ...ensureUid(p, 'pacote'),
        ordem: p.ordem ?? i,
        grupos: (p.grupos || []).map((g, gi) => ({
          ...ensureUid(g, 'grupo'),
          ordem: g.ordem ?? gi,
          subgrupos: (g.subgrupos || []).map((s, si) => ({
            ...ensureUid(s, 'subgrupo'),
            ordem: s.ordem ?? si
          }))
        }))
      };
    }

    const gruposFromSub = (p.subgrupos || []).map((s, si) => ({
      id: s.id,
      uid: s.uid || newId('grupo'),
      nome: s.nome,
      ordem: s.ordem ?? si,
      subgrupos: []
    }));

    const gruposExistentes = (p.grupos || []).map((g, gi) => ({
      ...ensureUid(g, 'grupo'),
      ordem: g.ordem ?? gi,
      subgrupos: (g.subgrupos || []).map((s, si) => ({
        ...ensureUid(s, 'subgrupo'),
        ordem: s.ordem ?? si
      }))
    }));

    const { subgrupos, ...rest } = p;
    return {
      ...ensureUid(rest, 'pacote'),
      ordem: p.ordem ?? i,
      grupos: [...gruposExistentes, ...gruposFromSub]
    };
  });

  const composicoesMigradas = (orcamento.composicoes || []).map((c, i) => {
    const next = { ...c, ordem: c.ordem ?? i };
    if (c.subgrupoId && c.grupoId == null) {
      next.grupoId = c.subgrupoId;
      next.subgrupoId = null;
    } else {
      next.grupoId = c.grupoId ?? null;
      next.subgrupoId = c.subgrupoId ?? null;
    }
    return ensureUid(next, 'comp');
  });

  return {
    ...orcamento,
    pacotes: pacotesMigrados,
    composicoes: composicoesMigradas
  };
}

export function stripUidsForSave(orcamento) {
  const pacotes = (orcamento.pacotes || []).map(({ uid, ...p }) => ({
    id: p.id,
    nome: p.nome,
    ordem: p.ordem ?? 0,
    grupos: (p.grupos || []).map(({ uid: _gu, ...g }) => ({
      id: g.id,
      nome: g.nome,
      ordem: g.ordem ?? 0,
      subgrupos: (g.subgrupos || []).map(({ uid: _su, ...s }) => ({
        id: s.id,
        nome: s.nome,
        ordem: s.ordem ?? 0
      }))
    }))
  }));

  const composicoes = (orcamento.composicoes || []).map(({ uid, tempId, ...c }) => ({
    ...c,
    grupoId: c.grupoId ?? null,
    subgrupoId: c.subgrupoId ?? null
  }));

  return { pacotes, composicoes };
}

export function getCompsDoNo(composicoes, { pacoteId, grupoId = null, subgrupoId = null }) {
  return (composicoes || [])
    .filter((c) => {
      if (c.pacoteId !== pacoteId) return false;
      const g = c.grupoId ?? null;
      const s = c.subgrupoId ?? null;
      return g === (grupoId ?? null) && s === (subgrupoId ?? null);
    })
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

export function totalDoNo(composicoes, { pacoteId, grupoId = null, subgrupoId = null }) {
  return composicoesDoEscopo(composicoes, { pacoteId, grupoId, subgrupoId }).reduce(
    (sum, c) => sum + (c.custoTotal || 0),
    0
  );
}

/** Composições no escopo do nó (mesma regra de totalDoNo). */
export function composicoesDoEscopo(composicoes, { pacoteId, grupoId = null, subgrupoId = null }) {
  if (grupoId == null && subgrupoId == null) {
    return (composicoes || []).filter((c) => c.pacoteId === pacoteId);
  }
  if (subgrupoId == null) {
    return (composicoes || []).filter(
      (c) => c.pacoteId === pacoteId && (c.grupoId ?? null) === grupoId
    );
  }
  return getCompsDoNo(composicoes, { pacoteId, grupoId, subgrupoId });
}

export function totaisCategoriaDoNo(composicoes, escopo, calcularSubvalores) {
  const tot = { Material: 0, 'Mão de Obra': 0, Equipamento: 0, Serviço: 0 };
  composicoesDoEscopo(composicoes, escopo).forEach((c) => {
    const sub = calcularSubvalores(c);
    tot.Material += sub.Material || 0;
    tot['Mão de Obra'] += sub['Mão de Obra'] || 0;
    tot.Equipamento += sub.Equipamento || 0;
    tot.Serviço += sub.Serviço || 0;
  });
  return tot;
}

export function calcularValorTotal(composicoes) {
  return (composicoes || []).reduce((sum, c) => sum + (c.custoTotal || 0), 0);
}

/** Soma o custo unitário a partir da lista de insumos da composição. */
function calcularCustoUnitarioDeInsumos(listaInsumos, insumos, fallback = 0) {
  if (listaInsumos?.length) {
    let total = 0;
    listaInsumos.forEach((item) => {
      const insumo = insumos.find((i) => i.id === item.insumoId);
      if (!insumo) return;
      total += (parseFloat(item.quantidade) || 0) * (insumo.precoUnitario || 0);
    });
    if (total > 0) return total;
  }
  return fallback ?? 0;
}

/** Custo unitário da composição com catálogo e preços atuais dos insumos. */
export function calcularCustoUnitarioComposicao(comp, catalogoComposicoes, insumos) {
  const catalogo = catalogoComposicoes.find((c) => c.id === comp.composicaoId);
  const listaInsumos = catalogo?.insumos?.length
    ? catalogo.insumos
    : (comp.insumos || []);
  return calcularCustoUnitarioDeInsumos(
    listaInsumos,
    insumos,
    catalogo?.valorTotal ?? comp.custoUnitario ?? 0
  );
}

/**
 * Sincroniza cada composição da EAP com o catálogo atual
 * (nome, código, unidade, insumos) e recalcula custos.
 */
export function sincronizarComposicoesComCatalogo(composicoes, catalogoComposicoes, insumos) {
  return (composicoes || []).map((c) => {
    const catalogo = catalogoComposicoes.find((cat) => cat.id === c.composicaoId);
    const quantidade = parseFloat(c.quantidade) || 0;

    if (!catalogo) {
      const custoUnitario = calcularCustoUnitarioComposicao(c, catalogoComposicoes, insumos);
      return { ...c, custoUnitario, custoTotal: quantidade * custoUnitario };
    }

    const insumosAtual = (catalogo.insumos || []).map((item) => ({ ...item }));
    const custoUnitario = calcularCustoUnitarioDeInsumos(
      insumosAtual,
      insumos,
      catalogo.valorTotal ?? c.custoUnitario ?? 0
    );

    return {
      ...c,
      codigo: catalogo.codigo || '',
      nome: catalogo.nome || c.nome,
      unidade: catalogo.unidade || c.unidade,
      insumos: insumosAtual,
      custoUnitario,
      custoTotal: quantidade * custoUnitario
    };
  });
}

export function caminhoComposicao(pacotes, comp) {
  const pacote = (pacotes || []).find((p) => p.id === comp.pacoteId);
  if (!pacote) return '—';
  const parts = [pacote.nome];
  if (comp.grupoId) {
    const grupo = (pacote.grupos || []).find((g) => g.id === comp.grupoId);
    if (grupo) {
      parts.push(grupo.nome);
      if (comp.subgrupoId) {
        const sub = (grupo.subgrupos || []).find((s) => s.id === comp.subgrupoId);
        if (sub) parts.push(sub.nome);
      }
    }
  }
  return parts.join(' > ');
}

export function parseDragId(id) {
  if (!id || typeof id !== 'string') return null;
  const idx = id.indexOf(':');
  if (idx < 0) return null;
  return { tipo: id.slice(0, idx), id: id.slice(idx + 1) };
}

export function makeDragId(tipo, id) {
  return `${tipo}:${id}`;
}

export const ROOT_CONTAINER = 'root';

export function pacoteContainer(pacoteId) {
  return `pacote:${pacoteId}:children`;
}

export function grupoContainer(grupoId) {
  return `grupo:${grupoId}:children`;
}

export function subgrupoContainer(subgrupoId) {
  return `subgrupo:${subgrupoId}:children`;
}

export function findPacoteByGrupoId(pacotes, grupoId) {
  for (const p of pacotes || []) {
    if ((p.grupos || []).some((g) => g.id === grupoId)) return p;
  }
  return null;
}

export function findGrupoLoc(pacotes, grupoId) {
  for (const p of pacotes || []) {
    const g = (p.grupos || []).find((x) => x.id === grupoId);
    if (g) return { pacote: p, grupo: g };
  }
  return null;
}

export function findSubgrupoLoc(pacotes, subgrupoId) {
  for (const p of pacotes || []) {
    for (const g of p.grupos || []) {
      const s = (g.subgrupos || []).find((x) => x.id === subgrupoId);
      if (s) return { pacote: p, grupo: g, subgrupo: s };
    }
  }
  return null;
}

export function findByDragKey(orcamento, dragId) {
  const parsed = parseDragId(dragId);
  if (!parsed) return null;
  const { tipo, id } = parsed;
  const pacotes = orcamento?.pacotes || [];
  const comps = orcamento?.composicoes || [];

  if (tipo === 'pacote') {
    const p = pacotes.find((x) => x.uid === id || x.id === id);
    return p ? { tipo, entity: p } : null;
  }
  if (tipo === 'grupo') {
    for (const p of pacotes) {
      const g = (p.grupos || []).find((x) => x.uid === id || x.id === id);
      if (g) return { tipo, entity: g, pacoteId: p.id };
    }
  }
  if (tipo === 'subgrupo') {
    for (const p of pacotes) {
      for (const g of p.grupos || []) {
        const s = (g.subgrupos || []).find((x) => x.uid === id || x.id === id);
        if (s) return { tipo, entity: s, pacoteId: p.id, grupoId: g.id };
      }
    }
  }
  if (tipo === 'comp') {
    const c = comps.find((x) => x.uid === id || x.id === id);
    return c ? { tipo, entity: c } : null;
  }
  return null;
}
