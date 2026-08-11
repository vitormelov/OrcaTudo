import React, { useState, useEffect } from 'react';
import { Modal, Form, Alert, InputGroup, Button } from 'react-bootstrap';
import { formatCurrency } from '../utils/formatters';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { collection, getDocs, updateDoc, doc, query, where, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import {
  migrarEapAntigo, stripUidsForSave, getCompsDoNo, calcularValorTotal, newId
} from '../utils/eapTree';
import { copiarEAPCompleta, formatRevisao, getObraId, getRevisao } from '../utils/eapCopy';
import EapWorkspace from './eap/EapWorkspace';

const formatarDataAmigavel = (dataISO) => {
  if (!dataISO) return '';
  const data = new Date(dataISO);
  const agora = new Date();
  const diffMs = agora - data;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  if (diffDias > 0) return `${diffDias} dia${diffDias > 1 ? 's' : ''} atrás`;
  if (diffHoras > 0) return `${diffHoras} hora${diffHoras > 1 ? 's' : ''} atrás`;
  if (diffMinutos > 0) return `${diffMinutos} minuto${diffMinutos > 1 ? 's' : ''} atrás`;
  return 'Agora mesmo';
};

const getStatusColor = (status) => ({
  'Em Análise': 'warning', Aprovado: 'success', Rejeitado: 'danger',
  'Em Execução': 'info', Concluído: 'primary'
}[status] || 'secondary');

function OrcamentoEAP() {
  const { currentUser } = useAuth();
  const { id: orcamentoId } = useParams();
  const navigate = useNavigate();

  const [orcamento, setOrcamento] = useState(null);
  const [catalogoComposicoes, setCatalogoComposicoes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [abertos, setAbertos] = useState({});
  const [activeDragId, setActiveDragId] = useState(null);

  const [showModalNo, setShowModalNo] = useState(false);
  const [modalNoTipo, setModalNoTipo] = useState('pacote');
  const [modalNoNome, setModalNoNome] = useState('');
  const [modalNoParent, setModalNoParent] = useState(null);
  const [editingNo, setEditingNo] = useState(null);

  const [showModalComp, setShowModalComp] = useState(false);
  const [compParent, setCompParent] = useState(null);
  const [compSearch, setCompSearch] = useState('');
  const [editingComp, setEditingComp] = useState(null);
  const [compForm, setCompForm] = useState({ composicaoId: '', quantidade: 1 });

  const [showBdi, setShowBdi] = useState(false);
  const [bdiConfig, setBdiConfig] = useState({ lucro: 10, tributos: 8, financeiro: 2, garantias: 1 });

  useEffect(() => {
    if (currentUser && orcamentoId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, orcamentoId]);

  const carregar = async () => {
    try {
      setError('');
      const snap = await getDoc(doc(db, 'orcamentos', orcamentoId));
      if (!snap.exists()) { setError('Orçamento não encontrado'); return; }
      const data = { id: snap.id, ...snap.data() };
      if (data.userId !== currentUser.uid) { setError('Sem permissão para este orçamento'); return; }
      // Normalizar orçamentos antigos sem revisão
      if (!data.obraId) data.obraId = data.id;
      if (!Number.isFinite(Number(data.revisao))) data.revisao = 0;
      if (data.revisaoTravada == null) data.revisaoTravada = false;
      const migrado = migrarEapAntigo(data);
      setOrcamento(migrado);
      if (data.bdiConfig) setBdiConfig(data.bdiConfig);
      const abertosInit = {};
      (migrado.pacotes || []).forEach((p) => {
        abertosInit[p.id] = true;
        (p.grupos || []).forEach((g) => { abertosInit[g.id] = true; });
      });
      setAbertos(abertosInit);
      const [compsSnap, insumosSnap] = await Promise.all([
        getDocs(query(collection(db, 'composicoes'), where('userId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'insumos'), where('userId', '==', currentUser.uid)))
      ]);
      setCatalogoComposicoes(
        compsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
      );
      setInsumos(insumosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      setError('Erro ao carregar orçamento');
    }
  };

  const toggleAberto = (id) => setAbertos((prev) => ({ ...prev, [id]: !prev[id] }));

  const somenteLeitura = Boolean(orcamento?.revisaoTravada);

  const valorTotal = calcularValorTotal(orcamento?.composicoes);
  const calcularBDI = () => {
    const bdi = (1 + bdiConfig.lucro / 100) * (1 + bdiConfig.tributos / 100)
      * (1 + bdiConfig.financeiro / 100) * (1 + bdiConfig.garantias / 100) - 1;
    return bdi * 100;
  };
  const valorComBDI = valorTotal + valorTotal * (calcularBDI() / 100);

  const calcularSubvalores = (composicao) => {
    const subvalores = { Material: 0, 'Mão de Obra': 0, Equipamento: 0, Serviço: 0 };
    const original = catalogoComposicoes.find((c) => c.id === composicao.composicaoId);
    if (original?.insumos?.length) {
      original.insumos.forEach((item) => {
        const insumo = insumos.find((i) => i.id === item.insumoId);
        if (!insumo) return;
        const valor = (parseFloat(item.quantidade) || 0) * (insumo.precoUnitario || 0);
        const cat = insumo.categoria || 'Material';
        if (subvalores[cat] !== undefined) subvalores[cat] += valor;
        else subvalores.Material += valor;
      });
    }
    const soma = Object.values(subvalores).reduce((s, v) => s + v, 0);
    if (soma === 0) {
      const t = composicao.custoTotal || 0;
      subvalores.Material = t * 0.7;
      subvalores['Mão de Obra'] = t * 0.2;
      subvalores.Equipamento = t * 0.05;
      subvalores.Serviço = t * 0.05;
    } else {
      const q = parseFloat(composicao.quantidade) || 1;
      Object.keys(subvalores).forEach((k) => { subvalores[k] *= q; });
    }
    return subvalores;
  };

  const totaisPorCategoria = (() => {
    const tot = { Material: 0, 'Mão de Obra': 0, Equipamento: 0, Serviço: 0 };
    (orcamento?.composicoes || []).forEach((c) => {
      const sub = calcularSubvalores(c);
      tot.Material += sub.Material;
      tot['Mão de Obra'] += sub['Mão de Obra'];
      tot.Equipamento += sub.Equipamento;
      tot.Serviço += sub.Serviço;
    });
    return tot;
  })();

  const abrirCriarNo = (tipo, parent = null) => {
    if (somenteLeitura) return;
    setModalNoTipo(tipo);
    setModalNoNome('');
    setModalNoParent(parent);
    setEditingNo(null);
    setShowModalNo(true);
  };

  const abrirEditarNo = (tipo, entity, parent = null) => {
    setModalNoTipo(tipo);
    setModalNoNome(entity.nome || '');
    setModalNoParent(parent);
    setEditingNo({ tipo, id: entity.id, ...parent });
    setShowModalNo(true);
  };

  const salvarNo = (e) => {
    e.preventDefault();
    const nome = modalNoNome.trim();
    if (!nome) return;

    setOrcamento((prev) => {
      const pacotes = [...(prev.pacotes || [])];
      if (editingNo) {
        if (editingNo.tipo === 'pacote') {
          return { ...prev, pacotes: pacotes.map((p) => (p.id === editingNo.id ? { ...p, nome } : p)) };
        }
        if (editingNo.tipo === 'grupo') {
          return {
            ...prev,
            pacotes: pacotes.map((p) =>
              p.id === editingNo.pacoteId
                ? { ...p, grupos: (p.grupos || []).map((g) => (g.id === editingNo.id ? { ...g, nome } : g)) }
                : p
            )
          };
        }
        if (editingNo.tipo === 'subgrupo') {
          return {
            ...prev,
            pacotes: pacotes.map((p) =>
              p.id === editingNo.pacoteId
                ? {
                    ...p,
                    grupos: (p.grupos || []).map((g) =>
                      g.id === editingNo.grupoId
                        ? { ...g, subgrupos: (g.subgrupos || []).map((s) => (s.id === editingNo.id ? { ...s, nome } : s)) }
                        : g
                    )
                  }
                : p
            )
          };
        }
      }

      if (modalNoTipo === 'pacote') {
        const id = newId('pacote');
        pacotes.push({ id, uid: newId('pacote'), nome, ordem: pacotes.length, grupos: [] });
        setAbertos((a) => ({ ...a, [id]: true }));
        return { ...prev, pacotes };
      }
      if (modalNoTipo === 'grupo' && modalNoParent?.pacoteId) {
        const id = newId('grupo');
        return {
          ...prev,
          pacotes: pacotes.map((p) => {
            if (p.id !== modalNoParent.pacoteId) return p;
            const grupos = [...(p.grupos || []), { id, uid: newId('grupo'), nome, ordem: (p.grupos || []).length, subgrupos: [] }];
            setAbertos((a) => ({ ...a, [id]: true, [p.id]: true }));
            return { ...p, grupos };
          })
        };
      }
      if (modalNoTipo === 'subgrupo' && modalNoParent?.pacoteId && modalNoParent?.grupoId) {
        const id = newId('subgrupo');
        return {
          ...prev,
          pacotes: pacotes.map((p) => {
            if (p.id !== modalNoParent.pacoteId) return p;
            return {
              ...p,
              grupos: (p.grupos || []).map((g) => {
                if (g.id !== modalNoParent.grupoId) return g;
                const subgrupos = [...(g.subgrupos || []), { id, uid: newId('subgrupo'), nome, ordem: (g.subgrupos || []).length }];
                setAbertos((a) => ({ ...a, [id]: true, [g.id]: true, [p.id]: true }));
                return { ...g, subgrupos };
              })
            };
          })
        };
      }
      return prev;
    });
    setShowModalNo(false);
  };

  const removerPacote = (pacoteId) => {
    if (!window.confirm('Remover este pacote e tudo dentro dele?')) return;
    setOrcamento((prev) => ({
      ...prev,
      pacotes: (prev.pacotes || []).filter((p) => p.id !== pacoteId),
      composicoes: (prev.composicoes || []).filter((c) => c.pacoteId !== pacoteId)
    }));
  };

  const removerGrupo = (pacoteId, grupoId) => {
    if (!window.confirm('Remover este grupo e seus subgrupos/composições?')) return;
    setOrcamento((prev) => ({
      ...prev,
      pacotes: (prev.pacotes || []).map((p) =>
        p.id === pacoteId ? { ...p, grupos: (p.grupos || []).filter((g) => g.id !== grupoId) } : p
      ),
      composicoes: (prev.composicoes || []).filter((c) => !(c.pacoteId === pacoteId && c.grupoId === grupoId))
    }));
  };

  const removerSubgrupo = (pacoteId, grupoId, subgrupoId) => {
    if (!window.confirm('Remover este subgrupo e suas composições?')) return;
    setOrcamento((prev) => ({
      ...prev,
      pacotes: (prev.pacotes || []).map((p) =>
        p.id === pacoteId
          ? {
              ...p,
              grupos: (p.grupos || []).map((g) =>
                g.id === grupoId
                  ? { ...g, subgrupos: (g.subgrupos || []).filter((s) => s.id !== subgrupoId) }
                  : g
              )
            }
          : p
      ),
      composicoes: (prev.composicoes || []).filter(
        (c) => !(c.pacoteId === pacoteId && c.grupoId === grupoId && c.subgrupoId === subgrupoId)
      )
    }));
  };

  const removerComposicao = (uid) => {
    if (!window.confirm('Remover esta composição do orçamento?')) return;
    setOrcamento((prev) => ({
      ...prev,
      composicoes: (prev.composicoes || []).filter((c) => c.uid !== uid)
    }));
  };

  const abrirAddComp = (parent) => {
    setCompParent(parent);
    setEditingComp(null);
    setCompForm({ composicaoId: '', quantidade: 1 });
    setCompSearch('');
    setShowModalComp(true);
  };

  const abrirEditComp = (comp) => {
    setCompParent({ pacoteId: comp.pacoteId, grupoId: comp.grupoId, subgrupoId: comp.subgrupoId });
    setEditingComp(comp);
    setCompForm({ composicaoId: comp.composicaoId, quantidade: comp.quantidade });
    setCompSearch('');
    setShowModalComp(true);
  };

  const salvarComposicao = (e) => {
    e.preventDefault();
    const catalogo = catalogoComposicoes.find((c) => c.id === compForm.composicaoId);
    if (!catalogo || !compParent) {
      setError('Selecione uma composição do catálogo');
      return;
    }
    const quantidade = parseFloat(compForm.quantidade) || 1;
    const custoUnitario = catalogo.valorTotal || 0;
    const custoTotal = quantidade * custoUnitario;

    setOrcamento((prev) => {
      if (editingComp) {
        return {
          ...prev,
          composicoes: (prev.composicoes || []).map((c) =>
            c.uid === editingComp.uid
              ? {
                  ...c,
                  composicaoId: catalogo.id,
                  nome: catalogo.nome,
                  unidade: catalogo.unidade,
                  quantidade,
                  custoUnitario,
                  custoTotal,
                  insumos: catalogo.insumos || []
                }
              : c
          )
        };
      }
      const siblings = getCompsDoNo(prev.composicoes, compParent);
      const nova = {
        uid: newId('comp'),
        composicaoId: catalogo.id,
        nome: catalogo.nome,
        unidade: catalogo.unidade,
        quantidade,
        custoUnitario,
        custoTotal,
        insumos: catalogo.insumos || [],
        pacoteId: compParent.pacoteId,
        grupoId: compParent.grupoId ?? null,
        subgrupoId: compParent.subgrupoId ?? null,
        ordem: siblings.length
      };
      return { ...prev, composicoes: [...(prev.composicoes || []), nova] };
    });
    setShowModalComp(false);
  };

  const atualizarQtdInline = (uid, quantidade) => {
    const q = parseFloat(quantidade);
    if (Number.isNaN(q) || q < 0) return;
    setOrcamento((prev) => ({
      ...prev,
      composicoes: (prev.composicoes || []).map((c) =>
        c.uid === uid ? { ...c, quantidade: q, custoTotal: q * (c.custoUnitario || 0) } : c
      )
    }));
  };

  const salvarEAP = async () => {
    if (!orcamento) return;
    if (somenteLeitura) {
      setError('Esta revisão está travada. Crie uma nova revisão para editar.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { pacotes, composicoes } = stripUidsForSave(orcamento);
      const payload = {
        pacotes,
        composicoes,
        valorTotal: calcularValorTotal(composicoes),
        totaisPorCategoria,
        ultimaAtualizacaoEAP: new Date().toISOString(),
        bdiConfig: orcamento.bdiConfig ? bdiConfig : null,
        obraId: getObraId(orcamento),
        revisao: getRevisao(orcamento),
        revisaoTravada: false
      };
      await updateDoc(doc(db, 'orcamentos', orcamentoId), payload);
      setOrcamento((prev) => migrarEapAntigo({ ...prev, ...payload }));
      setSuccess('EAP salva com sucesso!');
    } catch (e) {
      console.error(e);
      setError('Erro ao salvar EAP');
    }
    setLoading(false);
  };

  const handleNovaRevisao = async () => {
    if (!orcamento || somenteLeitura) return;
    const ok = window.confirm(
      `Criar nova revisão a partir da Rev. ${formatRevisao(getRevisao(orcamento))}?\n\n` +
        'A revisão atual será travada e uma nova revisão editável será criada.'
    );
    if (!ok) return;

    setLoading(true);
    setError('');
    try {
      // Salva estado atual antes de travar
      const { pacotes, composicoes } = stripUidsForSave(orcamento);
      const obraId = getObraId(orcamento);
      const revisaoAtual = getRevisao(orcamento);

      await updateDoc(doc(db, 'orcamentos', orcamentoId), {
        pacotes,
        composicoes,
        valorTotal: calcularValorTotal(composicoes),
        totaisPorCategoria,
        ultimaAtualizacaoEAP: new Date().toISOString(),
        bdiConfig: orcamento.bdiConfig ? bdiConfig : null,
        obraId,
        revisao: revisaoAtual,
        revisaoTravada: true,
        updatedAt: new Date()
      });

      const siblingsSnap = await getDocs(
        query(collection(db, 'orcamentos'), where('userId', '==', currentUser.uid))
      );
      let maxRev = revisaoAtual;
      siblingsSnap.docs.forEach((d) => {
        const data = d.data();
        if (getObraId({ ...data, id: d.id }) === obraId) {
          maxRev = Math.max(maxRev, getRevisao(data));
        }
      });

      const eapCopiada = copiarEAPCompleta(pacotes, composicoes);
      const docRef = await addDoc(collection(db, 'orcamentos'), {
        nome: orcamento.nome,
        descricao: orcamento.descricao || '',
        cliente: orcamento.cliente || '',
        endereco: orcamento.endereco || '',
        data: orcamento.data || new Date().toISOString().split('T')[0],
        userId: currentUser.uid,
        createdAt: new Date(),
        valorTotal: calcularValorTotal(composicoes),
        totaisPorCategoria,
        status: 'Em Análise',
        obraId,
        revisao: maxRev + 1,
        revisaoTravada: false,
        revisaoOrigemId: orcamentoId,
        pacotes: eapCopiada.pacotes,
        composicoes: eapCopiada.composicoes,
        bdiConfig: orcamento.bdiConfig ? { ...bdiConfig } : null,
        ultimaAtualizacaoEAP: new Date().toISOString()
      });

      navigate(`/orcamentos/${docRef.id}/eap`);
    } catch (e) {
      console.error(e);
      setError('Erro ao criar nova revisão: ' + e.message);
    }
    setLoading(false);
  };

  const atualizarStatus = async (novoStatus) => {
    if (somenteLeitura) {
      setError('Esta revisão está travada.');
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'orcamentos', orcamentoId), { status: novoStatus });
      setOrcamento((prev) => ({ ...prev, status: novoStatus }));
      setSuccess(`Status alterado para "${novoStatus}"`);
    } catch (e) {
      setError('Erro ao atualizar status');
    }
    setLoading(false);
  };

  const iterarComposicoesExport = (cb) => {
    const pacotes = [...(orcamento.pacotes || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    pacotes.forEach((p) => {
      getCompsDoNo(orcamento.composicoes, { pacoteId: p.id }).forEach((c) => cb(p, null, null, c));
      [...(p.grupos || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach((g) => {
        getCompsDoNo(orcamento.composicoes, { pacoteId: p.id, grupoId: g.id }).forEach((c) => cb(p, g, null, c));
        [...(g.subgrupos || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach((s) => {
          getCompsDoNo(orcamento.composicoes, {
            pacoteId: p.id, grupoId: g.id, subgrupoId: s.id
          }).forEach((c) => cb(p, g, s, c));
        });
      });
    });
  };

  const exportarEAPPdf = () => {
    if (!orcamento) return;
    try {
      const docPdf = new jsPDF();
      const pageWidth = docPdf.internal.pageSize.width;
      const margin = 20;
      docPdf.setFillColor(41, 128, 185);
      docPdf.rect(0, 0, pageWidth, 45, 'F');
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFontSize(16);
      docPdf.setFont('helvetica', 'bold');
      docPdf.text('ESTRUTURA ANALÍTICA DO PROJETO (EAP)', pageWidth / 2, 28, { align: 'center' });
      docPdf.setTextColor(0, 0, 0);
      docPdf.setFontSize(10);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(`Projeto: ${orcamento.nome || ''}`, margin, 60);
      docPdf.text(`Cliente: ${orcamento.cliente || ''}`, margin, 70);
      docPdf.text(`Total: ${formatCurrency(valorTotal)}`, margin, 80);
      if (orcamento.bdiConfig) docPdf.text(`Total c/ BDI: ${formatCurrency(valorComBDI)}`, margin, 90);
      docPdf.text(
        `Material: ${formatCurrency(totaisPorCategoria.Material)}  |  ` +
        `Mão de Obra: ${formatCurrency(totaisPorCategoria['Mão de Obra'])}  |  ` +
        `Equipamento: ${formatCurrency(totaisPorCategoria.Equipamento)}  |  ` +
        `Serviço: ${formatCurrency(totaisPorCategoria.Serviço)}`,
        margin,
        orcamento.bdiConfig ? 100 : 90
      );

      const rows = [];
      iterarComposicoesExport((p, g, s, c) => {
        const caminho = [p.nome, g?.nome, s?.nome].filter(Boolean).join(' > ');
        const sub = calcularSubvalores(c);
        const pct = valorTotal > 0 ? ((c.custoTotal / valorTotal) * 100).toFixed(1) : '0.0';
        rows.push([
          caminho, c.nome, `${c.quantidade} ${c.unidade}`,
          formatCurrency(sub.Material), formatCurrency(sub['Mão de Obra']),
          formatCurrency(sub.Equipamento), formatCurrency(sub.Serviço),
          formatCurrency(c.custoTotal), `${pct}%`
        ]);
      });

      autoTable(docPdf, {
        head: [['Caminho', 'Composição', 'Qtd', 'Material', 'Mão de Obra', 'Equipamento', 'Serviço', 'Total', '%']],
        body: rows,
        startY: orcamento.bdiConfig ? 110 : 100,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [41, 128, 185] }
      });
      docPdf.save(`EAP_${(orcamento.nome || 'orcamento').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar PDF');
    }
  };

  const exportarEAPExcel = () => {
    if (!orcamento) return;
    try {
      const data = [];
      data.push(['ESTRUTURA ANALÍTICA DO PROJETO (EAP)']);
      data.push(['Cliente:', orcamento.cliente || '']);
      data.push(['Obra:', orcamento.nome || '']);
      data.push(['Valor Total:', valorTotal]);
      if (orcamento.bdiConfig) data.push(['Valor c/ BDI:', valorComBDI]);
      data.push(['Material:', totaisPorCategoria.Material]);
      data.push(['Mão de Obra:', totaisPorCategoria['Mão de Obra']]);
      data.push(['Equipamento:', totaisPorCategoria.Equipamento]);
      data.push(['Serviço:', totaisPorCategoria.Serviço]);
      data.push([]);
      data.push(['Caminho', 'Composição', 'Quantidade', 'Unidade', 'Material', 'Mão de Obra', 'Equipamento', 'Serviço', 'Total', '%']);
      iterarComposicoesExport((p, g, s, c) => {
        const caminho = [p.nome, g?.nome, s?.nome].filter(Boolean).join(' > ');
        const sub = calcularSubvalores(c);
        const pct = valorTotal > 0 ? ((c.custoTotal / valorTotal) * 100).toFixed(1) : '0.0';
        data.push([
          caminho, c.nome, c.quantidade, c.unidade,
          sub.Material, sub['Mão de Obra'], sub.Equipamento, sub.Serviço,
          c.custoTotal, `${pct}%`
        ]);
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'EAP');
      XLSX.writeFile(wb, `EAP_${(orcamento.nome || 'orcamento').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar Excel');
    }
  };

  const catalogoFiltrado = catalogoComposicoes.filter((c) => {
    const t = compSearch.toLowerCase();
    return (c.codigo || '').toLowerCase().includes(t) || (c.nome || '').toLowerCase().includes(t);
  });

  if (!orcamento && !error) return <div className="p-4">Carregando EAP...</div>;
  if (!orcamento) return <Alert variant="danger" className="m-3">{error}</Alert>;

  return (
    <div>
      {somenteLeitura && (
        <Alert variant="warning">
          Revisão <strong>{formatRevisao(getRevisao(orcamento))}</strong> travada (somente leitura).
          Crie uma nova revisão na lista de orçamentos ou pelo botão abaixo para editar.
        </Alert>
      )}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <EapWorkspace
        orcamento={orcamento}
        setOrcamento={setOrcamento}
        abertos={abertos}
        toggleAberto={toggleAberto}
        valorTotal={valorTotal}
        valorComBDI={valorComBDI}
        totaisPorCategoria={totaisPorCategoria}
        calcularBDI={calcularBDI}
        calcularSubvalores={calcularSubvalores}
        abrirCriarNo={abrirCriarNo}
        abrirEditarNo={abrirEditarNo}
        removerPacote={removerPacote}
        removerGrupo={removerGrupo}
        removerSubgrupo={removerSubgrupo}
        abrirAddComp={abrirAddComp}
        abrirEditComp={abrirEditComp}
        removerComposicao={removerComposicao}
        atualizarQtdInline={atualizarQtdInline}
        salvarEAP={salvarEAP}
        loading={loading}
        navigate={navigate}
        orcamentoId={orcamentoId}
        exportarEAPPdf={exportarEAPPdf}
        exportarEAPExcel={exportarEAPExcel}
        setShowBdi={setShowBdi}
        atualizarStatus={atualizarStatus}
        getStatusColor={getStatusColor}
        formatarDataAmigavel={formatarDataAmigavel}
        activeDragId={activeDragId}
        setActiveDragId={setActiveDragId}
        somenteLeitura={somenteLeitura}
        formatRevisao={formatRevisao}
        getRevisao={getRevisao}
        onNovaRevisao={handleNovaRevisao}
      />

      <Modal show={showModalNo} onHide={() => setShowModalNo(false)}>
        <Form onSubmit={salvarNo}>
          <Modal.Header closeButton>
            <Modal.Title>
              {editingNo ? 'Editar' : 'Novo'}{' '}
              {modalNoTipo === 'pacote' ? 'Pacote' : modalNoTipo === 'grupo' ? 'Grupo' : 'Subgrupo'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>Nome</Form.Label>
              <Form.Control value={modalNoNome} onChange={(e) => setModalNoNome(e.target.value)} required autoFocus />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModalNo(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Salvar</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showModalComp} onHide={() => setShowModalComp(false)} size="lg">
        <Form onSubmit={salvarComposicao}>
          <Modal.Header closeButton>
            <Modal.Title>{editingComp ? 'Editar composição' : 'Adicionar composição'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <InputGroup className="mb-3">
              <Form.Control placeholder="Buscar no catálogo..." value={compSearch} onChange={(e) => setCompSearch(e.target.value)} />
            </InputGroup>
            <div style={{ maxHeight: 280, overflowY: 'auto' }} className="mb-3 border rounded">
              {catalogoFiltrado.slice(0, 80).map((c) => (
                <div
                  key={c.id}
                  className={`p-2 border-bottom ${compForm.composicaoId === c.id ? 'bg-primary text-white' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setCompForm((f) => ({ ...f, composicaoId: c.id }))}
                >
                  <div className="fw-bold">{c.codigo ? `${c.codigo} — ` : ''}{c.nome}</div>
                  <small>{c.unidade} · {formatCurrency(c.valorTotal || 0)}</small>
                </div>
              ))}
            </div>
            <Form.Group>
              <Form.Label>Quantidade</Form.Label>
              <Form.Control
                type="number" min="0" step="0.01" required
                value={compForm.quantidade}
                onChange={(e) => setCompForm((f) => ({ ...f, quantidade: e.target.value }))}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModalComp(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!compForm.composicaoId}>Salvar</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showBdi} onHide={() => setShowBdi(false)}>
        <Modal.Header closeButton><Modal.Title>Configurar BDI</Modal.Title></Modal.Header>
        <Modal.Body>
          {['lucro', 'tributos', 'financeiro', 'garantias'].map((campo) => (
            <Form.Group className="mb-3" key={campo}>
              <Form.Label className="text-capitalize">{campo} (%)</Form.Label>
              <Form.Control
                type="number" step="0.01" value={bdiConfig[campo]}
                onChange={(e) => setBdiConfig({ ...bdiConfig, [campo]: parseFloat(e.target.value) || 0 })}
              />
            </Form.Group>
          ))}
          <Alert variant="info" className="mb-0">
            BDI = {calcularBDI().toFixed(2)}% · Total c/ BDI: {formatCurrency(valorComBDI)}
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          {orcamento?.bdiConfig && (
            <Button variant="outline-danger" className="me-auto" onClick={() => {
              setOrcamento((prev) => ({ ...prev, bdiConfig: null }));
              setShowBdi(false);
            }}>Remover BDI</Button>
          )}
          <Button variant="secondary" onClick={() => setShowBdi(false)}>Fechar</Button>
          <Button variant="primary" onClick={() => {
            setOrcamento((prev) => ({ ...prev, bdiConfig }));
            setShowBdi(false);
          }}>Aplicar</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default OrcamentoEAP;
