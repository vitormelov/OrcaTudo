import {
  getCompsDoNo,
  totaisCategoriaDoNo,
  pacoteContainer,
  grupoContainer
} from './eapTree';
import { getContainerItems } from './eapDnD';

/** MAT+EQP = Material + Equipamento; MO+SERV = Mão de Obra + Serviço */
export function matMoFromCats(cats) {
  const mat = (cats?.Material || 0) + (cats?.Equipamento || 0);
  const mo = (cats?.['Mão de Obra'] || 0) + (cats?.Serviço || 0);
  return { mat, mo, total: mat + mo };
}

export function formatDataBR(value) {
  if (!value) return '—';
  try {
    if (typeof value?.toDate === 'function') {
      return value.toDate().toLocaleDateString('pt-BR');
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return String(value);
  }
}

/**
 * Monta as linhas da tabela orçamentária (hierarquia EAP).
 * @returns {{ rows: Array<{ kind: string|null, cells: any[] }>, baseTotal: number, bdiAbs: number, venda: number }}
 */
export function buildEapTabelaRows({
  orcamento,
  calcularSubvalores,
  valorTotal,
  valorComBDI,
  bdiValor
}) {
  const rows = [];
  const push = (cells, kind = null) => {
    rows.push({ kind, cells });
  };

  const totGeralCats = { Material: 0, 'Mão de Obra': 0, Equipamento: 0, Serviço: 0 };
  (orcamento.composicoes || []).forEach((c) => {
    const sub = calcularSubvalores(c);
    totGeralCats.Material += sub.Material || 0;
    totGeralCats['Mão de Obra'] += sub['Mão de Obra'] || 0;
    totGeralCats.Equipamento += sub.Equipamento || 0;
    totGeralCats.Serviço += sub.Serviço || 0;
  });
  const totGeral = matMoFromCats(totGeralCats);
  const baseTotal = valorTotal || totGeral.total || 0;
  const inc = (valor) => (baseTotal > 0 ? valor / baseTotal : 0);

  const summaryRow = (no, descricao, cats) => {
    const t = matMoFromCats(cats);
    return [
      no, '', descricao, '', null,
      null, null, null,
      t.mat, t.mo, t.total,
      inc(t.total)
    ];
  };

  const compRow = (no, comp) => {
    const sub = calcularSubvalores(comp);
    const t = matMoFromCats(sub);
    const q = Number(parseFloat(comp.quantidade));
    const qtd = Number.isFinite(q) ? q : 0;
    const divisor = qtd || 1;
    return [
      no,
      comp.codigo || '',
      comp.nome || '',
      comp.unidade || '',
      qtd,
      t.mat / divisor,
      t.mo / divisor,
      t.total / divisor,
      t.mat,
      t.mo,
      t.total,
      inc(t.total)
    ];
  };

  const catsDoEscopo = (escopo) =>
    totaisCategoriaDoNo(orcamento.composicoes, escopo, calcularSubvalores);

  const pacotes = [...(orcamento.pacotes || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  pacotes.forEach((pacote, pIdx) => {
    const pNo = String(pIdx + 1);
    const pEscopo = { pacoteId: pacote.id };
    push(summaryRow(pNo, pacote.nome || `Pacote ${pIdx + 1}`, catsDoEscopo(pEscopo)), 'pacote');

    const pItems = getContainerItems(orcamento, pacoteContainer(pacote.id));
    let pChild = 0;

    pItems.forEach((itemId) => {
      if (itemId.startsWith('grupo:')) {
        pChild += 1;
        const uid = itemId.slice(6);
        const grupo = (pacote.grupos || []).find((x) => x.uid === uid || x.id === uid);
        if (!grupo) return;

        const gNo = `${pNo}.${pChild}`;
        const gEscopo = { pacoteId: pacote.id, grupoId: grupo.id };
        push(summaryRow(gNo, grupo.nome || `Grupo ${pChild}`, catsDoEscopo(gEscopo)), 'grupo');

        const gItems = getContainerItems(orcamento, grupoContainer(grupo.id));
        let gChild = 0;

        gItems.forEach((gItemId) => {
          if (gItemId.startsWith('subgrupo:')) {
            gChild += 1;
            const sUid = gItemId.slice(9);
            const subgrupo = (grupo.subgrupos || []).find((x) => x.uid === sUid || x.id === sUid);
            if (!subgrupo) return;

            const sNo = `${gNo}.${gChild}`;
            const sEscopo = {
              pacoteId: pacote.id,
              grupoId: grupo.id,
              subgrupoId: subgrupo.id
            };
            push(
              summaryRow(sNo, subgrupo.nome || `Subgrupo ${gChild}`, catsDoEscopo(sEscopo)),
              'subgrupo'
            );

            getCompsDoNo(orcamento.composicoes, sEscopo).forEach((c, cIdx) => {
              push(compRow(`${sNo}.${cIdx + 1}`, c), 'comp');
            });
            return;
          }

          if (gItemId.startsWith('comp:')) {
            gChild += 1;
            const cUid = gItemId.slice(5);
            const c = (orcamento.composicoes || []).find((x) => x.uid === cUid);
            if (c) push(compRow(`${gNo}.${gChild}`, c), 'comp');
          }
        });
        return;
      }

      if (itemId.startsWith('comp:')) {
        pChild += 1;
        const cUid = itemId.slice(5);
        const c = (orcamento.composicoes || []).find((x) => x.uid === cUid);
        if (c) push(compRow(`${pNo}.${pChild}`, c), 'comp');
      }
    });
  });

  const bdiAbs =
    typeof bdiValor === 'number' ? bdiValor : Math.max(0, (valorComBDI || 0) - (valorTotal || 0));
  const venda = typeof valorComBDI === 'number' ? valorComBDI : baseTotal + bdiAbs;

  push(['', '', 'CUSTO TOTAL', '', null, null, null, null, null, null, baseTotal, null], 'footer');
  push(['', '', 'BDI', '', null, null, null, null, null, null, bdiAbs, null], 'footer');
  push(['', '', 'VALOR DE VENDA', '', null, null, null, null, null, null, venda, null], 'footer');

  return { rows, baseTotal, bdiAbs, venda };
}

export function getEapCabecalhoMeta({
  orcamento,
  revisao,
  elaboradoPor,
  status
}) {
  return {
    nomeObra: orcamento.nome || 'Sem nome',
    local: orcamento.endereco || '—',
    cliente: orcamento.cliente || '—',
    revLabel: revisao != null && revisao !== '' ? String(revisao) : '01',
    elab: elaboradoPor || '—',
    statusLabel: status || orcamento.status || '—',
    dataExport: new Date().toLocaleDateString('pt-BR'),
    ultimaAtualizacao: formatDataBR(
      orcamento.ultimaAtualizacaoEAP || orcamento.updatedAt || orcamento.data
    )
  };
}
