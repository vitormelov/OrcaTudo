import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { gerarItensBaseline, ressincronizarItens, round2 } from '../../utils/gestao';
import { getObraId, getRevisao } from '../../utils/eapCopy';

const COL_OBRAS = 'gestaoObras';
const COL_COMPRAS = 'gestaoCompras';
const COL_AJUSTES = 'gestaoAjustes';

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export async function listarOrcamentosAprovados(empresaId) {
  const snap = await getDocs(
    query(collection(db, 'orcamentos'), where('empresaId', '==', empresaId), where('status', '==', 'Aprovado'))
  );
  return lista(snap).filter((o) => !o.revisaoTravada);
}

export async function listarGestoes(empresaId) {
  return lista(await getDocs(query(collection(db, COL_OBRAS), where('empresaId', '==', empresaId))));
}

export async function listarComprasEmpresa(empresaId) {
  return lista(await getDocs(query(collection(db, COL_COMPRAS), where('empresaId', '==', empresaId))));
}

export async function listarAjustesEmpresa(empresaId) {
  return lista(await getDocs(query(collection(db, COL_AJUSTES), where('empresaId', '==', empresaId))));
}

export async function carregarGestao(empresaId, gestaoId) {
  const filtro = (col) =>
    getDocs(query(collection(db, col), where('empresaId', '==', empresaId), where('gestaoId', '==', gestaoId)));
  const [obrasSnap, comprasSnap, ajustesSnap] = await Promise.all([
    getDocs(query(collection(db, COL_OBRAS), where('empresaId', '==', empresaId), where(documentId(), '==', gestaoId))),
    filtro(COL_COMPRAS),
    filtro(COL_AJUSTES)
  ]);
  const gestao = lista(obrasSnap)[0] || null;
  return { gestao, compras: lista(comprasSnap), ajustes: lista(ajustesSnap) };
}

function dadosCabecalho(orcamento) {
  return {
    nome: orcamento.nome || '',
    cliente: orcamento.cliente || '',
    endereco: orcamento.endereco || '',
    obraId: getObraId(orcamento),
    revisao: getRevisao(orcamento),
    bdiConfig: orcamento.bdiConfig || null
  };
}

/** Cria a gestão congelando a linha de base do orçamento aprovado. O id é o do orçamento. */
export async function iniciarGestao(orcamento, { empresaId, userId }) {
  const itens = gerarItensBaseline(orcamento);
  const dados = {
    ...dadosCabecalho(orcamento),
    empresaId,
    userId,
    orcamentoId: orcamento.id,
    itens,
    verbaTotal: round2(itens.reduce((s, it) => s + it.verbaOrcada, 0)),
    mapaInformakon: {},
    informakon: { codigoObra: '' },
    createdAt: new Date(),
    updatedAt: new Date(),
    baselineEm: new Date()
  };
  await setDoc(doc(db, COL_OBRAS, orcamento.id), dados);
  return { id: orcamento.id, ...dados };
}

/** Atualiza a linha de base com o orçamento atual, preservando vínculos das compras. */
export async function carregarOrcamento(orcamentoId) {
  const snap = await getDoc(doc(db, 'orcamentos', orcamentoId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Atualiza a linha de base com o orçamento (a mesma revisão ou uma revisão
 * aprovada mais nova da obra), preservando os vínculos das compras.
 */
export async function ressincronizarGestao(gestao, orcamento, compras) {
  const comCompras = new Set();
  compras.forEach((c) => (c.linhas || []).forEach((l) => comCompras.add(l.itemId)));
  const itens = ressincronizarItens(gestao.itens, gerarItensBaseline(orcamento), comCompras);
  const patch = {
    ...dadosCabecalho(orcamento),
    orcamentoId: orcamento.id,
    itens,
    verbaTotal: round2(itens.filter((it) => !it.removido).reduce((s, it) => s + it.verbaOrcada, 0)),
    updatedAt: new Date(),
    baselineEm: new Date()
  };
  await updateDoc(doc(db, COL_OBRAS, gestao.id), patch);
  return { ...gestao, ...patch };
}

export async function atualizarGestao(gestaoId, patch) {
  await updateDoc(doc(db, COL_OBRAS, gestaoId), { ...patch, updatedAt: new Date() });
}

export async function salvarCompra(compra, { empresaId, userId, gestaoId }) {
  const linhas = (compra.linhas || []).map((l) => ({
    itemId: l.itemId,
    descricao: l.descricao || '',
    codigoInsumo: l.codigoInsumo || '',
    unidade: l.unidade || '',
    quantidade: Number(l.quantidade) || 0,
    valorUnitario: Number(l.valorUnitario) || 0,
    valorTotal: round2(l.valorTotal),
    informakonRef: l.informakonRef || null
  }));
  const dados = {
    documento: compra.documento || '',
    fornecedor: compra.fornecedor || '',
    data: compra.data || '',
    observacao: compra.observacao || '',
    origem: compra.origem || 'manual',
    linhas,
    valorTotal: round2(linhas.reduce((s, l) => s + l.valorTotal, 0)),
    updatedAt: new Date()
  };
  if (compra.id) {
    await updateDoc(doc(db, COL_COMPRAS, compra.id), dados);
    return compra.id;
  }
  const ref = await addDoc(collection(db, COL_COMPRAS), {
    ...dados,
    empresaId,
    userId,
    gestaoId,
    createdAt: new Date()
  });
  return ref.id;
}

export async function importarCompras(compras, ctx) {
  const CHUNK = 400;
  for (let i = 0; i < compras.length; i += CHUNK) {
    const batch = writeBatch(db);
    compras.slice(i, i + CHUNK).forEach((c) => {
      const ref = doc(collection(db, COL_COMPRAS));
      const linhas = c.linhas.map((l) => ({
        itemId: l.itemId,
        descricao: l.descricao || '',
        codigoInsumo: l.codigoInsumo || '',
        unidade: l.unidade || '',
        quantidade: Number(l.quantidade) || 0,
        valorUnitario: Number(l.valorUnitario) || 0,
        valorTotal: round2(l.valorTotal),
        informakonRef: l.informakonRef || null,
        apropriacao: l.apropriacao || ''
      }));
      batch.set(ref, {
        documento: c.documento || '',
        fornecedor: c.fornecedor || '',
        data: c.data || '',
        observacao: 'Importado do Informakon',
        origem: 'informakon',
        linhas,
        valorTotal: round2(linhas.reduce((s, l) => s + l.valorTotal, 0)),
        empresaId: ctx.empresaId,
        userId: ctx.userId,
        gestaoId: ctx.gestaoId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
    await batch.commit();
  }
}

export async function excluirCompra(id) {
  await deleteDoc(doc(db, COL_COMPRAS, id));
}

export async function salvarAjuste(ajuste, { empresaId, userId, gestaoId }) {
  await addDoc(collection(db, COL_AJUSTES), {
    tipo: ajuste.tipo,
    itemOrigemId: ajuste.tipo === 'remanejamento' ? ajuste.itemOrigemId : null,
    itemDestinoId: ajuste.itemDestinoId,
    valor: round2(ajuste.valor),
    motivo: ajuste.motivo || '',
    data: ajuste.data || new Date().toISOString().slice(0, 10),
    empresaId,
    userId,
    gestaoId,
    createdAt: new Date()
  });
}

export async function excluirAjuste(id) {
  await deleteDoc(doc(db, COL_AJUSTES, id));
}
