/**
 * Módulo de Gestão — verbas, compras e ajustes de orçamentos aprovados.
 *
 * Coleções (Firestore):
 *   gestaoObras/{orcamentoId}  → linha de base congelada do orçamento aprovado
 *                                (itens com verba orçada) + mapa de vínculos do Informakon
 *   gestaoCompras/{id}         → compras; cada linha da compra aponta para um item (itemId)
 *   gestaoAjustes/{id}         → aditivos/supressões e remanejamentos de verba entre itens
 *
 * A verba de cada item é o custo direto (sem BDI) da composição no orçamento aprovado.
 */
import { migrarEapAntigo, getCompsDoNo, pacoteContainer, grupoContainer } from './eapTree';
import { getContainerItems } from './eapDnD';

export const STATUS_APROVADO = 'Aprovado';

export const STATUS_ITEM = {
  estouro: { label: 'Estouro', bg: 'danger' },
  atencao: { label: 'Atenção', bg: 'warning' },
  economia: { label: 'Economia', bg: 'success' },
  encerrado: { label: 'Encerrado', bg: 'dark' },
  andamento: { label: 'Em andamento', bg: 'info' },
  semCompras: { label: 'Sem compras', bg: 'secondary' }
};

/** Percentual de consumo da verba a partir do qual o item entra em "Atenção". */
export const LIMITE_ATENCAO = 0.9;

export function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** Aceita "1.234,56", "1234.56", "R$ 1.234,56", números. */
export function parseNumeroBR(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  let s = String(valor).replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) {
    // o último separador é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (temVirgula) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function dateLocalISO(d) {
  if (Number.isNaN(d.getTime())) return '';
  // arredonda para o dia mais próximo (datas do Excel podem vir com fração de fuso)
  const r = new Date(d.getTime() + 12 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${r.getFullYear()}-${p(r.getMonth() + 1)}-${p(r.getDate())}`;
}

export function dataParaISO(valor) {
  if (!valor) return '';
  if (typeof valor?.toDate === 'function') return dateLocalISO(valor.toDate());
  if (valor instanceof Date) return dateLocalISO(valor);
  if (typeof valor === 'number' && valor > 20000 && valor < 80000) {
    // número de série de data do Excel
    return dateLocalISO(new Date(Math.round((valor - 25569) * 86400 * 1000) + new Date().getTimezoneOffset() * 60000));
  }
  const s = String(valor).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Data curta dd/mm/aa (para colunas estreitas). */
export function formatDataCurta(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a.slice(-2)}` : String(iso);
}

export function formatDataISO(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : String(iso);
}

/**
 * Gera a lista de itens (linha de base) a partir da EAP do orçamento,
 * na mesma numeração da planilha orçamentária (1, 1.1, 1.1.1 ...).
 * `chave` identifica o item de forma estável para re-sincronizar com o orçamento.
 */
export function gerarItensBaseline(orcamentoBruto) {
  const orcamento = migrarEapAntigo(orcamentoBruto);
  const itens = [];
  const ocorrencias = {};

  const addComp = (numero, comp, caminho, pacote) => {
    const base = [comp.pacoteId, comp.grupoId ?? '', comp.subgrupoId ?? '', comp.composicaoId || comp.nome].join('|');
    ocorrencias[base] = (ocorrencias[base] || 0) + 1;
    const quantidade = parseFloat(comp.quantidade) || 0;
    const custoTotal = Number(comp.custoTotal) || 0;
    itens.push({
      chave: `${base}|${ocorrencias[base]}`,
      numero,
      codigo: comp.codigo || '',
      descricao: comp.nome || 'Composição',
      unidade: comp.unidade || '',
      quantidade,
      custoUnitario: Number(comp.custoUnitario) || (quantidade ? custoTotal / quantidade : 0),
      verbaOrcada: round2(custoTotal),
      pacoteId: comp.pacoteId,
      pacoteNome: pacote?.nome || '',
      caminho: caminho.join(' > '),
      niveis: [...caminho]
    });
  };

  const pacotes = [...(orcamento.pacotes || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  pacotes.forEach((pacote, pIdx) => {
    const pNo = String(pIdx + 1);
    const pNome = pacote.nome || `Pacote ${pIdx + 1}`;
    let pChild = 0;
    getContainerItems(orcamento, pacoteContainer(pacote.id)).forEach((itemId) => {
      if (itemId.startsWith('grupo:')) {
        pChild += 1;
        const uid = itemId.slice(6);
        const grupo = (pacote.grupos || []).find((x) => x.uid === uid || x.id === uid);
        if (!grupo) return;
        const gNo = `${pNo}.${pChild}`;
        const gNome = grupo.nome || `Grupo ${pChild}`;
        let gChild = 0;
        getContainerItems(orcamento, grupoContainer(grupo.id)).forEach((gItemId) => {
          if (gItemId.startsWith('subgrupo:')) {
            gChild += 1;
            const sUid = gItemId.slice(9);
            const sub = (grupo.subgrupos || []).find((x) => x.uid === sUid || x.id === sUid);
            if (!sub) return;
            const sNo = `${gNo}.${gChild}`;
            const sNome = sub.nome || `Subgrupo ${gChild}`;
            getCompsDoNo(orcamento.composicoes, {
              pacoteId: pacote.id, grupoId: grupo.id, subgrupoId: sub.id
            }).forEach((c, cIdx) => addComp(`${sNo}.${cIdx + 1}`, c, [pNome, gNome, sNome], pacote));
            return;
          }
          if (gItemId.startsWith('comp:')) {
            gChild += 1;
            const c = (orcamento.composicoes || []).find((x) => x.uid === gItemId.slice(5));
            if (c) addComp(`${gNo}.${gChild}`, c, [pNome, gNome], pacote);
          }
        });
        return;
      }
      if (itemId.startsWith('comp:')) {
        pChild += 1;
        const c = (orcamento.composicoes || []).find((x) => x.uid === itemId.slice(5));
        if (c) addComp(`${pNo}.${pChild}`, c, [pNome], pacote);
      }
    });
  });

  return itens.map((it, i) => ({ ...it, id: `it_${i + 1}_${Math.random().toString(36).slice(2, 7)}` }));
}

/**
 * Re-sincroniza a linha de base com o orçamento atual mantendo os IDs
 * (e portanto os vínculos das compras) dos itens que continuam existindo.
 * Itens que saíram do orçamento mas têm compras são mantidos como "removido".
 */
export function ressincronizarItens(itensAtuais, novosItens, itemIdsComCompras) {
  const porChave = new Map((itensAtuais || []).map((it) => [it.chave, it]));
  const usados = new Set();
  const resultado = novosItens.map((novo) => {
    const antigo = porChave.get(novo.chave);
    if (!antigo) return novo;
    usados.add(antigo.id);
    return { ...novo, id: antigo.id, encerrado: !!antigo.encerrado, removido: false };
  });
  (itensAtuais || []).forEach((it) => {
    if (!usados.has(it.id) && itemIdsComCompras.has(it.id)) {
      // item saiu do orçamento: não tem mais verba, as compras dele viram estouro
      resultado.push({
        ...it,
        removido: true,
        verbaOrcadaOriginal: it.verbaOrcadaOriginal ?? it.verbaOrcada,
        verbaOrcada: 0
      });
    }
  });
  return resultado;
}

/**
 * Monta a hierarquia da EAP (pacote > grupo > subgrupo > item) a partir dos itens,
 * na ordem da planilha. Nós: { tipo: 'no', nivel (0 pacote, 1 grupo, 2 subgrupo),
 * numero, nome, filhos, itens (todos os itens abaixo) }; folhas: { tipo: 'item', item }.
 */
export function montarArvore(itens) {
  const raiz = [];
  const nos = new Map();
  (itens || []).forEach((it) => {
    const partes = String(it.numero || '').split('.');
    const nomes = Array.isArray(it.niveis) && it.niveis.length
      ? it.niveis
      : String(it.caminho || '').split(' > ').filter(Boolean);
    let filhos = raiz;
    nomes.forEach((nome, nivel) => {
      const numero = partes.slice(0, nivel + 1).join('.');
      let no = nos.get(numero);
      if (!no) {
        no = { tipo: 'no', nivel, numero, nome, filhos: [], itens: [] };
        nos.set(numero, no);
        filhos.push(no);
      }
      no.itens.push(it);
      filhos = no.filhos;
    });
    filhos.push({ tipo: 'item', item: it });
  });
  return raiz;
}

/** Chave da seção do orçamento base dentro da gestão. */
export const SECAO_BASE = 'base';

/**
 * Todos os itens da gestão (base + aditivos incluídos), marcados com a seção:
 *   secao: 'base' ou o obraId do aditivo; secaoNome; prefixo ('AD1', 'AD2'...) nos aditivos.
 */
export function itensDaGestao(gestao) {
  if (!gestao) return [];
  const base = (gestao.itens || []).map((it) => ({ ...it, secao: SECAO_BASE, secaoNome: 'Orçamento base', prefixo: '' }));
  const adit = (gestao.aditivos || []).flatMap((ad, i) =>
    (ad.itens || []).map((it) => ({
      ...it,
      secao: ad.obraId,
      secaoNome: `Aditivo ${i + 1} — ${ad.nome || ''}`.trim(),
      prefixo: `AD${i + 1}`
    }))
  );
  return [...base, ...adit];
}

/** Rótulo do item fora da árvore (ex.: "1.2.1" na base, "AD1 · 1.2.1" num aditivo). */
export function rotuloItem(it) {
  if (!it) return '';
  return it.prefixo ? `${it.prefixo} · ${it.numero}` : it.numero;
}

const CAMPOS_RUNTIME = ['secao', 'secaoNome', 'prefixo'];
const limparItem = (it) => {
  const r = { ...it };
  CAMPOS_RUNTIME.forEach((k) => delete r[k]);
  return r;
};

/** Aplica `patch` ao item (na base ou em um aditivo). Devolve { itens, aditivos } para salvar. */
export function atualizarItemGestao(gestao, itemId, patch) {
  const aplica = (lista) => (lista || []).map((it) => (it.id === itemId ? limparItem({ ...it, ...patch }) : it));
  return {
    itens: aplica(gestao.itens),
    aditivos: (gestao.aditivos || []).map((ad) => ({ ...ad, itens: aplica(ad.itens) }))
  };
}

export function totalCompra(compra) {
  return (compra?.linhas || []).reduce((s, l) => s + (Number(l.valorTotal) || 0), 0);
}

/** Consolida verba, ajustes e compras por item. */
export function consolidarItens(itens, compras, ajustes) {
  const mapa = new Map();
  (itens || []).forEach((it) => {
    mapa.set(it.id, {
      ...it,
      ajustes: 0,
      comprado: 0,
      qtdLinhas: 0
    });
  });

  (ajustes || []).forEach((a) => {
    const valor = Number(a.valor) || 0;
    if (a.tipo === 'remanejamento') {
      if (mapa.has(a.itemOrigemId)) mapa.get(a.itemOrigemId).ajustes -= valor;
      if (mapa.has(a.itemDestinoId)) mapa.get(a.itemDestinoId).ajustes += valor;
    } else if (mapa.has(a.itemDestinoId)) {
      mapa.get(a.itemDestinoId).ajustes += valor;
    }
  });

  (compras || []).forEach((c) => {
    (c.linhas || []).forEach((l) => {
      const it = mapa.get(l.itemId);
      if (!it) return;
      it.comprado += Number(l.valorTotal) || 0;
      it.qtdLinhas += 1;
    });
  });

  return [...mapa.values()].map((it) => {
    const verbaAtual = round2(it.verbaOrcada + it.ajustes);
    const comprado = round2(it.comprado);
    const saldo = round2(verbaAtual - comprado);
    const consumo = verbaAtual > 0 ? comprado / verbaAtual : (comprado > 0 ? Infinity : 0);
    let status = 'andamento';
    if (saldo < 0) status = 'estouro';
    else if (it.encerrado) status = saldo > 0 ? 'economia' : 'encerrado';
    else if (comprado === 0) status = 'semCompras';
    else if (consumo >= LIMITE_ATENCAO) status = 'atencao';
    return {
      ...it,
      ajustes: round2(it.ajustes),
      verbaAtual,
      comprado,
      saldo,
      consumo,
      status,
      estouro: saldo < 0 ? -saldo : 0,
      economia: it.encerrado && saldo > 0 ? saldo : 0
    };
  });
}

export function resumoGestao(itensConsolidados) {
  return (itensConsolidados || []).reduce(
    (r, it) => {
      r.verbaOrcada += it.verbaOrcada;
      r.verbaAtual += it.verbaAtual;
      r.comprado += it.comprado;
      r.estouro += it.estouro;
      r.economia += it.economia;
      if (it.status === 'estouro') r.itensEstouro += 1;
      if (it.status === 'atencao') r.itensAtencao += 1;
      return r;
    },
    { verbaOrcada: 0, verbaAtual: 0, comprado: 0, estouro: 0, economia: 0, itensEstouro: 0, itensAtencao: 0 }
  );
}

/** Normaliza texto para comparação (sem acento, minúsculo, só letras/números). */
export function normalizarTexto(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'a', 'o', 'x', 'un', 'm', 'mm', 'cm']);

function tokens(s) {
  return normalizarTexto(s).split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Similaridade simples por sobreposição de palavras (0..1). */
export function similaridade(a, b) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let comum = 0;
  ta.forEach((t) => { if (tb.has(t)) comum += 1; });
  return comum / Math.min(ta.size, tb.size);
}
