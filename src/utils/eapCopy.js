/**
 * Cópia profunda da EAP com novos IDs de pacote/grupo/subgrupo.
 */
export function copiarEAPCompleta(pacotes, composicoesOriginais) {
  if (!pacotes || pacotes.length === 0) {
    return { pacotes: [], composicoes: [] };
  }

  const mapeamentoIds = {
    pacotes: {},
    grupos: {},
    subgrupos: {}
  };

  const pacotesCopiados = pacotes.map((pacote) => {
    const novoIdPacote = `pacote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    mapeamentoIds.pacotes[pacote.id] = novoIdPacote;

    if (Array.isArray(pacote.grupos)) {
      const grupos = (pacote.grupos || []).map((grupo) => {
        const novoIdGrupo = `grupo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        mapeamentoIds.grupos[grupo.id] = novoIdGrupo;
        const subgrupos = (grupo.subgrupos || []).map((subgrupo) => {
          const novoIdSubgrupo = `subgrupo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          mapeamentoIds.subgrupos[subgrupo.id] = novoIdSubgrupo;
          return { ...subgrupo, id: novoIdSubgrupo };
        });
        return { ...grupo, id: novoIdGrupo, subgrupos };
      });
      const { subgrupos, ...rest } = pacote;
      return { ...rest, id: novoIdPacote, grupos };
    }

    const grupos = (pacote.subgrupos || []).map((subgrupo) => {
      const novoIdGrupo = `grupo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      mapeamentoIds.grupos[subgrupo.id] = novoIdGrupo;
      mapeamentoIds.subgrupos[subgrupo.id] = novoIdGrupo;
      return {
        id: novoIdGrupo,
        nome: subgrupo.nome,
        ordem: subgrupo.ordem || 0,
        subgrupos: []
      };
    });

    return {
      id: novoIdPacote,
      nome: pacote.nome,
      ordem: pacote.ordem || 0,
      grupos
    };
  });

  const composicoesCopiadas = (composicoesOriginais || []).map((composicao) => {
    let grupoId = composicao.grupoId ?? null;
    let subgrupoId = composicao.subgrupoId ?? null;
    if (subgrupoId && !grupoId && mapeamentoIds.grupos[subgrupoId]) {
      grupoId = mapeamentoIds.grupos[subgrupoId];
      subgrupoId = null;
    } else {
      if (grupoId) grupoId = mapeamentoIds.grupos[grupoId] || grupoId;
      if (subgrupoId) subgrupoId = mapeamentoIds.subgrupos[subgrupoId] || subgrupoId;
    }
    const { uid, tempId, ...rest } = composicao;
    return {
      ...rest,
      pacoteId: mapeamentoIds.pacotes[composicao.pacoteId] || composicao.pacoteId,
      grupoId,
      subgrupoId
    };
  });

  return { pacotes: pacotesCopiados, composicoes: composicoesCopiadas };
}

export function formatRevisao(revisao) {
  const n = Number.isFinite(Number(revisao)) ? Number(revisao) : 0;
  return String(n).padStart(2, '0');
}

export function getObraId(orcamento) {
  return orcamento?.obraId || orcamento?.id;
}

export function getRevisao(orcamento) {
  return Number.isFinite(Number(orcamento?.revisao)) ? Number(orcamento.revisao) : 0;
}
