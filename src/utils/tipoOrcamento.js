/**
 * Tipo do orçamento: base ou aditivo.
 * Um aditivo é vinculado a um orçamento base pela obra (`baseObraId` = obraId da base),
 * de modo que o vínculo continua válido quando a base ganha novas revisões.
 * Orçamentos sem `tipo` (criados antes desse campo) são tratados como base.
 */
import { getObraId, getRevisao } from './eapCopy';

export const TIPO_BASE = 'base';
export const TIPO_ADITIVO = 'aditivo';

export function getTipo(orcamento) {
  return orcamento?.tipo === TIPO_ADITIVO ? TIPO_ADITIVO : TIPO_BASE;
}

export function isAditivo(orcamento) {
  return getTipo(orcamento) === TIPO_ADITIVO;
}

export function isBase(orcamento) {
  return getTipo(orcamento) === TIPO_BASE;
}

/**
 * Orçamentos base disponíveis para vincular aditivos: uma entrada por obra,
 * usando a revisão atual (não travada) ou, se não houver, a mais recente.
 */
export function listarBasesPorObra(orcamentos) {
  const porObra = new Map();
  (orcamentos || []).filter(isBase).forEach((o) => {
    const obraId = getObraId(o);
    const atual = porObra.get(obraId);
    const melhor =
      !atual ||
      (atual.revisaoTravada && !o.revisaoTravada) ||
      (!!atual.revisaoTravada === !!o.revisaoTravada && getRevisao(o) > getRevisao(atual));
    if (melhor) porObra.set(obraId, o);
  });
  return [...porObra.entries()]
    .map(([obraId, o]) => ({ obraId, orcamento: o }))
    .sort((a, b) => (a.orcamento.nome || '').localeCompare(b.orcamento.nome || '', 'pt-BR'));
}

/** Nome da base vinculada a um aditivo (ou '' se não encontrada). */
export function nomeDaBase(aditivo, orcamentos) {
  if (!isAditivo(aditivo) || !aditivo.baseObraId) return '';
  const base = listarBasesPorObra(orcamentos).find((b) => b.obraId === aditivo.baseObraId);
  return base?.orcamento?.nome || '';
}
