import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Alert, 
  ListGroup,
  Badge,
  Dropdown
} from 'react-bootstrap';
import { formatCurrency, formatCurrencyValue } from '../utils/formatters';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  where,
  getDoc
} from 'firebase/firestore';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaPlus, 
  FaTrash, 
  FaLayerGroup, 
  FaFolder, 
  FaArrowUp, 
  FaArrowDown, 
  FaArrowLeft,
  FaSave,
  FaEdit,
  FaChartBar,
  FaFilePdf,
  FaCalculator,
  FaFileExcel
} from 'react-icons/fa';

// Função para formatar data de forma amigável
const formatarDataAmigavel = (dataISO) => {
  if (!dataISO) return '';
  
  const data = new Date(dataISO);
  const agora = new Date();
  const diffMs = agora - data;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  
  if (diffDias > 0) {
    return `${diffDias} dia${diffDias > 1 ? 's' : ''} atrás`;
  } else if (diffHoras > 0) {
    return `${diffHoras} hora${diffHoras > 1 ? 's' : ''} atrás`;
  } else if (diffMinutos > 0) {
    return `${diffMinutos} minuto${diffMinutos > 1 ? 's' : ''} atrás`;
  } else {
    return 'Agora mesmo';
  }
};

// Função para obter a cor do status
const getStatusColor = (status) => {
  const colors = {
    'Em Análise': 'warning',
    'Aprovado': 'success',
    'Rejeitado': 'danger',
    'Em Execução': 'info',
    'Concluído': 'primary'
  };
  return colors[status] || 'secondary';
};

function SortableComp({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function OrcamentoEAP() {
  const { currentUser } = useAuth();
  const { id: orcamentoId } = useParams();
  const navigate = useNavigate();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  
  const [orcamento, setOrcamento] = useState(null);
  const [composicoes, setComposicoes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados para criação de pacotes
  const [showModalPacote, setShowModalPacote] = useState(false);
  const [novoPacoteNome, setNovoPacoteNome] = useState('');
  const [editingPacote, setEditingPacote] = useState(null);
  
  // Estados para subgrupos
  const [showModalSubgrupo, setShowModalSubgrupo] = useState(false);
  const [novoSubgrupoNome, setNovoSubgrupoNome] = useState('');
  const [editingSubgrupo, setEditingSubgrupo] = useState(null);
  const [pacoteParaSubgrupo, setPacoteParaSubgrupo] = useState(null);
  
  // Estados para adição de composições
  const [showModalComposicao, setShowModalComposicao] = useState(false);
  const [showModalBDI, setShowModalBDI] = useState(false);
  const [novaComposicao, setNovaComposicao] = useState({
    composicaoId: '',
    quantidade: '',
    custoUnitario: '',
    pacoteId: '',
    subgrupoId: ''
  });
  const [bdiConfig, setBdiConfig] = useState({
    lucro: 20,
    tributos: 35,
    financeiro: 5,
    garantias: 2
  });

  // Estado para controlar quais pacotes estão abertos
  const [pacotesAbertos, setPacotesAbertos] = useState(new Set());

  useEffect(() => {
    if (currentUser && orcamentoId) {
      fetchOrcamento();
      fetchComposicoes();
      fetchInsumos();
    }
  }, [currentUser, orcamentoId]);

  const fetchOrcamento = async () => {
    try {
      const docRef = doc(db, 'orcamentos', orcamentoId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.userId !== currentUser.uid) {
          navigate('/orcamentos');
          return;
        }
        setOrcamento({ id: docSnap.id, ...data });
        
        // Carregar configurações do BDI se existirem
        if (data.bdiConfig) {
          setBdiConfig(data.bdiConfig);
        }
      } else {
        navigate('/orcamentos');
      }
    } catch (error) {
      setError('Erro ao carregar orçamento');
      console.error(error);
    }
  };

  const fetchComposicoes = async () => {
    try {
      const q = query(
        collection(db, 'composicoes'), 
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const composicoesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      composicoesData.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
      setComposicoes(composicoesData);
    } catch (error) {
      console.error('Erro ao carregar composições:', error);
    }
  };

  const fetchInsumos = async () => {
    try {
      const q = query(
        collection(db, 'insumos'), 
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const insumosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInsumos(insumosData);
    } catch (error) {
      console.error('Erro ao carregar insumos:', error);
    }
  };

  // Funções para gerenciar pacotes
  const criarPacote = () => {
    if (!novoPacoteNome.trim()) return;
    
    const pacoteId = `pacote_${Date.now()}`;
    const novoPacote = {
      id: pacoteId,
      nome: novoPacoteNome.trim(),
      ordem: (orcamento?.pacotes || []).length,
      subgrupos: []
    };

    setOrcamento(prev => ({
      ...prev,
      pacotes: [...(prev.pacotes || []), novoPacote]
    }));

    setNovoPacoteNome('');
    setShowModalPacote(false);
  };

  const editarPacote = () => {
    if (!editingPacote || !novoPacoteNome.trim()) return;
    
    setOrcamento(prev => ({
      ...prev,
      pacotes: (prev.pacotes || []).map(p => 
        p.id === editingPacote.id 
          ? { ...p, nome: novoPacoteNome.trim() }
          : p
      )
    }));

    setNovoPacoteNome('');
    setEditingPacote(null);
    setShowModalPacote(false);
  };

  const removerPacote = (pacoteId) => {
    if (!window.confirm('Tem certeza que deseja remover este pacote? Todos os subgrupos e composições serão removidos junto com o pacote.')) return;
    
    // Remover o pacote e todas as suas composições
    setOrcamento(prev => ({
      ...prev,
      composicoes: (prev.composicoes || []).filter(c => c.pacoteId !== pacoteId),
      pacotes: (prev.pacotes || []).filter(p => p.id !== pacoteId)
    }));
  };

  const moverPacote = (pacoteId, direction) => {
    setOrcamento(prev => {
      const pacotes = [...(prev.pacotes || [])];
      const idx = pacotes.findIndex(p => p.id === pacoteId);
      if (idx === -1) return prev;
      
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= pacotes.length) return prev;
      
      [pacotes[idx], pacotes[swapIdx]] = [pacotes[swapIdx], pacotes[idx]];
      
      // Atualizar ordem
      pacotes.forEach((p, i) => { p.ordem = i; });
      
      return { ...prev, pacotes };
    });
  };

  // Funções para gerenciar subgrupos
  const criarSubgrupo = () => {
    if (!novoSubgrupoNome.trim() || !pacoteParaSubgrupo) return;
    
    const subgrupoId = `subgrupo_${Date.now()}`;
    const novoSubgrupo = {
      id: subgrupoId,
      nome: novoSubgrupoNome.trim(),
      ordem: (pacoteParaSubgrupo.subgrupos || []).length
    };

    setOrcamento(prev => ({
      ...prev,
      pacotes: (prev.pacotes || []).map(p => 
        p.id === pacoteParaSubgrupo.id 
          ? { ...p, subgrupos: [...(p.subgrupos || []), novoSubgrupo] }
          : p
      )
    }));

    setNovoSubgrupoNome('');
    setPacoteParaSubgrupo(null);
    setShowModalSubgrupo(false);
  };

  const editarSubgrupo = () => {
    if (!editingSubgrupo || !novoSubgrupoNome.trim()) return;
    
    setOrcamento(prev => ({
      ...prev,
      pacotes: (prev.pacotes || []).map(p => 
        p.id === editingSubgrupo.pacoteId 
          ? { 
              ...p, 
              subgrupos: (p.subgrupos || []).map(s => 
                s.id === editingSubgrupo.id 
                  ? { ...s, nome: novoSubgrupoNome.trim() }
                  : s
              )
            }
          : p
      )
    }));

    setNovoSubgrupoNome('');
    setEditingSubgrupo(null);
    setShowModalSubgrupo(false);
  };

  const removerSubgrupo = (pacoteId, subgrupoId) => {
    if (!window.confirm('Tem certeza que deseja remover este subgrupo? Todas as composições dentro dele também serão removidas.')) return;
    
    // Remover composições do subgrupo
    setOrcamento(prev => ({
      ...prev,
      composicoes: (prev.composicoes || []).filter(c => 
        !(c.pacoteId === pacoteId && c.subgrupoId === subgrupoId)
      ),
      pacotes: (prev.pacotes || []).map(p => 
        p.id === pacoteId 
          ? { ...p, subgrupos: (p.subgrupos || []).filter(s => s.id !== subgrupoId) }
          : p
      )
    }));
  };

  const moverSubgrupo = (pacoteId, subgrupoId, direction) => {
    setOrcamento(prev => {
      const pacotes = [...(prev.pacotes || [])];
      const pacote = pacotes.find(p => p.id === pacoteId);
      if (!pacote) return prev;
      
      const subgrupos = [...(pacote.subgrupos || [])];
      const idx = subgrupos.findIndex(s => s.id === subgrupoId);
      if (idx === -1) return prev;
      
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= subgrupos.length) return prev;
      
      [subgrupos[idx], subgrupos[swapIdx]] = [subgrupos[swapIdx], subgrupos[idx]];
      
      // Atualizar ordem
      subgrupos.forEach((s, i) => { s.ordem = i; });
      
      pacote.subgrupos = subgrupos;
      return { ...prev, pacotes };
    });
  };

  // Funções para gerenciar composições
  const adicionarComposicao = () => {
    if (!novaComposicao.composicaoId || !novaComposicao.quantidade || !novaComposicao.custoUnitario || !novaComposicao.pacoteId || !novaComposicao.subgrupoId) {
      setError('Preencha todos os campos da composição');
      return;
    }

    const composicao = composicoes.find(c => c.id === novaComposicao.composicaoId);
    if (!composicao) return;

    const composicaoOrcamento = {
      composicaoId: novaComposicao.composicaoId,
      nome: composicao.nome,
      unidade: composicao.unidade,
      quantidade: parseFloat(novaComposicao.quantidade),
      custoUnitario: parseFloat(novaComposicao.custoUnitario),
      custoTotal: parseFloat(novaComposicao.quantidade) * parseFloat(novaComposicao.custoUnitario),
      insumos: composicao.insumos || [],
      pacoteId: novaComposicao.pacoteId,
      subgrupoId: novaComposicao.subgrupoId,
      ordem: 0,
      tempId: `${Date.now()}-${Math.random()}`
    };

    setOrcamento(prev => ({
      ...prev,
      composicoes: [...(prev.composicoes || []), composicaoOrcamento]
    }));

    setNovaComposicao({
      composicaoId: '',
      quantidade: '',
      custoUnitario: '',
      pacoteId: '',
      subgrupoId: ''
    });
    setShowModalComposicao(false);
  };

  const removerComposicao = (tempId) => {
    setOrcamento(prev => ({
      ...prev,
      composicoes: (prev.composicoes || []).filter(c => c.tempId !== tempId)
    }));
  };

  const onDragEndComps = (pacoteId, itens) => (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = itens.findIndex(i => (i.tempId || '') === active.id);
    const newIndex = itens.findIndex(i => (i.tempId || '') === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reordered = arrayMove(itens, oldIndex, newIndex);
    setOrcamento(prev => {
      const arr = [...(prev.composicoes || [])];
      const idsInOrder = reordered.map(i => i.tempId);
      
      // Atualizar ordem das composições do pacote
      idsInOrder.forEach((tempId, i) => {
        const idx = arr.findIndex(c => c.tempId === tempId);
        if (idx !== -1) {
          arr[idx] = { ...arr[idx], ordem: i };
        }
      });
      
      return { ...prev, composicoes: arr };
    });
  };

  // Função para formatar valores com separadores de milhares e decimais
  const formatarValor = (valor) => {
    if (valor === null || valor === undefined || isNaN(valor)) {
      return '0,00';
    }
    
    return Number(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const calcularValorTotal = () => {
    return (orcamento?.composicoes || []).reduce((total, composicao) => total + composicao.custoTotal, 0);
  };

  const calcularBDI = () => {
    const lucro = bdiConfig.lucro / 100;
    const tributos = bdiConfig.tributos / 100;
    const financeiro = bdiConfig.financeiro / 100;
    const garantias = bdiConfig.garantias / 100;
    
    const bdi = (1 + lucro) * (1 + tributos) * (1 + financeiro) * (1 + garantias) - 1;
    return bdi * 100; // Retorna em porcentagem
  };

  const calcularValorBDI = () => {
    const valorTotal = calcularValorTotal();
    const bdi = calcularBDI() / 100;
    return valorTotal * bdi;
  };

  const calcularValorTotalComBDI = () => {
    const valorTotal = calcularValorTotal();
    const valorBDI = calcularValorBDI();
    return valorTotal + valorBDI;
  };

  const totalDoPacote = (pacoteId) => {
    return (orcamento?.composicoes || [])
      .filter(c => c.pacoteId === pacoteId)
      .reduce((sum, c) => sum + (c.custoTotal || 0), 0);
  };

  const totalDoSubgrupo = (pacoteId, subgrupoId) => {
    return (orcamento?.composicoes || [])
      .filter(c => c.pacoteId === pacoteId && c.subgrupoId === subgrupoId)
      .reduce((sum, c) => sum + (c.custoTotal || 0), 0);
  };

  const calcularSubvaloresComposicao = (composicao) => {
    const subvalores = {
      'Material': 0,
      'Mão de Obra': 0,
      'Equipamento': 0,
      'Serviço': 0
    };
    
    // Buscar a composição original no array de composições
    const composicaoOriginal = composicoes.find(c => c.id === composicao.composicaoId);
    
    if (composicaoOriginal && composicaoOriginal.insumos && Array.isArray(composicaoOriginal.insumos)) {
      // Calcular baseado nos insumos reais da composição
      composicaoOriginal.insumos.forEach(item => {
        // Buscar o insumo pelo ID para obter a categoria e preço
        const insumo = insumos.find(ins => ins.id === item.insumoId);
        if (insumo) {
          // Calcular o valor do insumo na composição
          const valorInsumoNaComposicao = (parseFloat(item.quantidade) || 0) * (insumo.precoUnitario || 0);
          
          // Aplicar a categoria do insumo
          const categoria = insumo.categoria || 'Material';
          if (subvalores[categoria] !== undefined) {
            subvalores[categoria] += valorInsumoNaComposicao;
          } else {
            subvalores['Material'] += valorInsumoNaComposicao;
          }
        }
      });
    }
    
    // Se não conseguiu calcular pelos insumos, distribuir o valor total
    const totalCalculado = Object.values(subvalores).reduce((sum, val) => sum + val, 0);
    if (totalCalculado === 0) {
      // Usar distribuição padrão se não conseguir calcular pelos insumos
      const valorTotal = composicao.custoTotal || 0;
      subvalores['Material'] = valorTotal * 0.7;
      subvalores['Mão de Obra'] = valorTotal * 0.2;
      subvalores['Equipamento'] = valorTotal * 0.05;
      subvalores['Serviço'] = valorTotal * 0.05;
    }
    
    // Multiplicar todos os subvalores pela quantidade da composição no orçamento
    const quantidade = parseFloat(composicao.quantidade) || 1;
    Object.keys(subvalores).forEach(categoria => {
      subvalores[categoria] = subvalores[categoria] * quantidade;
    });
    
    return { subvalores, total: composicao.custoTotal || 0 };
  };

  const obterComposicoesDoPacote = (pacoteId) => {
    return (orcamento?.composicoes || [])
      .filter(c => c.pacoteId === pacoteId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  };

  const obterComposicoesDoSubgrupo = (pacoteId, subgrupoId) => {
    return (orcamento?.composicoes || [])
      .filter(c => c.pacoteId === pacoteId && c.subgrupoId === subgrupoId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  };

  const temSubgrupos = () => {
    return (orcamento?.pacotes || []).some(p => p.subgrupos && p.subgrupos.length > 0);
  };

  const togglePacote = (pacoteId) => {
    setPacotesAbertos(prev => {
      const novo = new Set(prev);
      if (novo.has(pacoteId)) {
        novo.delete(pacoteId);
      } else {
        novo.add(pacoteId);
      }
      return novo;
    });
  };

  const abrirTodosPacotes = () => {
    const todosIds = (orcamento?.pacotes || []).map(p => p.id);
    setPacotesAbertos(new Set(todosIds));
  };

  const fecharTodosPacotes = () => {
    setPacotesAbertos(new Set());
  };

  const salvarEAP = async () => {
    setLoading(true);
    setError('');

    try {
      const composicoesSanitizadas = (orcamento.composicoes || []).map(({ tempId, ...rest }) => rest);
      const orcamentoData = {
        ...orcamento,
        composicoes: composicoesSanitizadas,
        valorTotal: calcularValorTotal(),
        ultimaAtualizacaoEAP: new Date().toISOString(),
        bdiConfig: bdiConfig // Salvar as configurações do BDI
      };

      await updateDoc(doc(db, 'orcamentos', orcamentoId), orcamentoData);
      
      // Atualizar o estado local com a nova data e BDI
      setOrcamento(prev => ({
        ...prev,
        ultimaAtualizacaoEAP: orcamentoData.ultimaAtualizacaoEAP,
        bdiConfig: bdiConfig
      }));
      
      setError('');
      alert('EAP salva com sucesso!');
    } catch (error) {
      setError('Erro ao salvar EAP');
      console.error(error);
    }

    setLoading(false);
  };

  const atualizarStatus = async (novoStatus) => {
    setLoading(true);
    setError('');

    try {
      const orcamentoData = {
        status: novoStatus
      };

      await updateDoc(doc(db, 'orcamentos', orcamentoId), orcamentoData);
      
      // Atualizar o estado local
      setOrcamento(prev => ({
        ...prev,
        status: novoStatus
      }));
      
      setError('');
      alert(`Status alterado para "${novoStatus}" com sucesso!`);
    } catch (error) {
      setError('Erro ao atualizar status');
      console.error(error);
    }

    setLoading(false);
  };

  const exportarEAPPdf = () => {
    if (!orcamento) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      let yPosition = 20;

      // Cabeçalho profissional com fundo azul
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      // Logo placeholder (círculo branco com azul interno)
      doc.setFillColor(255, 255, 255);
      doc.circle(25, 22, 8, 'F');
      doc.setFillColor(41, 128, 185);
      doc.circle(25, 22, 6, 'F');
      
      // Título principal
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTRUTURA ANALÍTICA DO PROJETO (EAP)', pageWidth / 2, 28, { align: 'center' });
      
      // Informações do projeto em duas colunas
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Coluna esquerda
      doc.text('PROJETO:', margin, 60);
      doc.text('CLIENTE:', margin, 70);
      doc.text('ENDEREÇO:', margin, 80);
      doc.text('DATA:', margin, 90);
      doc.text('STATUS:', margin, 100);
      
      // Coluna direita
      doc.text('ELABORADOR:', pageWidth - 80, 60);
      doc.text('ORÇAMENTO:', pageWidth - 80, 70);
      doc.text('ÚLTIMA ATUALIZAÇÃO:', pageWidth - 80, 80);
      doc.text('BDI APLICADO:', pageWidth - 80, 90);
      
      // Valores das informações
      doc.setFont('helvetica', 'bold');
      doc.text(orcamento.nome || 'N/A', margin + 35, 60);
      doc.text(orcamento.cliente || 'N/A', margin + 35, 70);
      doc.text(orcamento.endereco || 'N/A', margin + 35, 80);
      doc.text(new Date(orcamento.data).toLocaleDateString('pt-BR') || 'N/A', margin + 35, 90);
      doc.text(orcamento.status || 'Em Análise', margin + 35, 100);
      
      doc.text(currentUser?.displayName || currentUser?.email || 'N/A', pageWidth - 35, 60);
      doc.text(new Date(orcamento.data).toLocaleDateString('pt-BR') || 'N/A', pageWidth - 35, 70);
      doc.text(orcamento.ultimaAtualizacaoEAP ? formatarDataAmigavel(orcamento.ultimaAtualizacaoEAP) : 'N/A', pageWidth - 35, 80);
      
      const valorTotal = calcularValorTotal();
      const valorTotalComBDI = calcularValorTotalComBDI();
      const bdiPercentual = valorTotal > 0 ? ((valorTotalComBDI - valorTotal) / valorTotal) * 100 : 0;
      doc.text(`${bdiPercentual.toFixed(2)}%`, pageWidth - 35, 90);
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 110, pageWidth - margin, 110);
      
      // Resumo financeiro
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO FINANCEIRO', pageWidth / 2, 125, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Valor Total (sem BDI):', margin, 140);
      doc.text('BDI Aplicado:', margin, 150);
      doc.text('Valor Total (com BDI):', margin, 160);
      
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(valorTotal), pageWidth - margin - 40, 140);
      doc.text(`${bdiPercentual.toFixed(2)}%`, pageWidth - margin - 40, 150);
      doc.text(formatCurrency(valorTotalComBDI), pageWidth - margin - 40, 160);
      
      // Linha separadora
      doc.line(margin, 170, pageWidth - margin, 170);
      
      // EAP - Início em nova página se necessário
      let eapYPosition = 180;
      let pageNumber = 1;
      
      // Função para adicionar nova página
      const addNewPage = () => {
        doc.addPage();
        pageNumber++;
        eapYPosition = 20;
        
        // Cabeçalho da página
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(`EAP - Página ${pageNumber}`, pageWidth / 2, 8, { align: 'center' });
        doc.text(orcamento.nome || 'N/A', pageWidth / 2, 12, { align: 'center' });
        
        doc.setTextColor(0, 0, 0);
        eapYPosition = 20;
      };
      
      // Verificar se precisa de nova página para a tabela EAP
      if (eapYPosition > doc.internal.pageSize.height - 100) {
        addNewPage();
      }
      
      // Título da seção EAP
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('ESTRUTURA ANALÍTICA DO PROJETO', pageWidth / 2, eapYPosition, { align: 'center' });
      eapYPosition += 20;
      
      // Tabela de composições com layout melhorado
      const composicoesData = [];
      const todosPacotes = (orcamento.pacotes || []).sort((a, b) => a.ordem - b.ordem);

      todosPacotes.forEach((pacote) => {
        const subgrupos = (pacote.subgrupos || []).sort((a, b) => a.ordem - b.ordem);
        
        subgrupos.forEach((subgrupo) => {
          const itens = obterComposicoesDoSubgrupo(pacote.id, subgrupo.id);
          
          itens.forEach((comp) => {
            const { subvalores, total } = calcularSubvaloresComposicao(comp);
            const porcentagem = valorTotal > 0 ? ((total / valorTotal) * 100).toFixed(1) : '0.0';
            
            // Quebrar texto longo se necessário
            let nomeComposicao = comp.nome;
            if (nomeComposicao.length > 40) {
              nomeComposicao = nomeComposicao.substring(0, 37) + '...';
            }
            
            let nomePacoteSubgrupo = `${pacote.nome} > ${subgrupo.nome}`;
            if (nomePacoteSubgrupo.length > 35) {
              nomePacoteSubgrupo = nomePacoteSubgrupo.substring(0, 32) + '...';
            }
            
            composicoesData.push([
              nomePacoteSubgrupo,
              nomeComposicao,
              `${comp.quantidade} ${comp.unidade}`,
              formatCurrency(subvalores.Material),
              formatCurrency(subvalores['Mão de Obra']),
              formatCurrency(subvalores.Equipamento),
              formatCurrency(subvalores.Serviço),
              formatCurrency(total),
              `${porcentagem}%`
            ]);
          });
        });
      });

      // Cabeçalhos da tabela
      const headers = [
        'Pacote/Subgrupo',
        'Composição',
        'Quantidade',
        'Material',
        'Mão de Obra',
        'Equipamento',
        'Serviço',
        'Total',
        '%'
      ];

      // Configurações da tabela melhorada
      const tableConfig = {
        head: [headers],
        body: composicoesData,
        startY: eapYPosition,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7,
          cellPadding: 3,
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        columnStyles: {
          0: { cellWidth: 32, cellMinWidth: 32 }, // Pacote/Subgrupo
          1: { cellWidth: 35, cellMinWidth: 35 }, // Composição
          2: { cellWidth: 18, cellMinWidth: 18 }, // Quantidade
          3: { cellWidth: 18, cellMinWidth: 18 }, // Material
          4: { cellWidth: 18, cellMinWidth: 18 }, // Mão de Obra
          5: { cellWidth: 18, cellMinWidth: 18 }, // Equipamento
          6: { cellWidth: 18, cellMinWidth: 18 }, // Serviço
          7: { cellWidth: 18, cellMinWidth: 18 }, // Total
          8: { cellWidth: 12, cellMinWidth: 12 }  // %
        },
        didDrawPage: function (data) {
          // Adicionar número da página
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }
      };

      // Gerar tabela
      autoTable(doc, tableConfig);

      // Resumo por pacote em nova página se necessário
      let resumoY = doc.lastAutoTable.finalY + 20;
      
      if (resumoY > doc.internal.pageSize.height - 60) {
        addNewPage();
        resumoY = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text('RESUMO POR PACOTE', pageWidth / 2, resumoY, { align: 'center' });
      resumoY += 15;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      todosPacotes.forEach((pacote) => {
        const totalPacote = totalDoPacote(pacote.id);
        const porcentagemPacote = valorTotal > 0 ? ((totalPacote / valorTotal) * 100).toFixed(1) : '0.0';
        
        doc.text(`${pacote.nome}: ${formatCurrency(totalPacote)} (${porcentagemPacote}%)`, margin, resumoY);
        resumoY += 8;
      });

      // Valor total
      resumoY += 15;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, resumoY, pageWidth - margin, resumoY);
      resumoY += 15;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text(`VALOR TOTAL DO PROJETO: ${formatCurrency(valorTotal)}`, margin, resumoY);
      resumoY += 10;
      doc.text(`VALOR TOTAL COM BDI: ${formatCurrency(valorTotalComBDI)}`, margin, resumoY);

      // Rodapé
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, doc.internal.pageSize.height - 20, { align: 'center' });

      // Salvar o PDF
      const fileName = `EAP_${orcamento.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
    }
  };

  const exportarEAPExcel = () => {
    if (!orcamento) return;

    try {
      const todosPacotes = (orcamento.pacotes || []).sort((a, b) => a.ordem - b.ordem);
      const valorTotal = calcularValorTotal();
      const valorTotalComBDI = calcularValorTotalComBDI();

      // Criar workbook com uma aba
      const workbook = XLSX.utils.book_new();

      // === ABA EAP ===
      const eapData = [];
      
      // === CABEÇALHO PROFISSIONAL ===
      // Logo e nome da empresa (linhas 1-3)
      eapData.push(['LOGO DA EMPRESA']); // Linha 1 - Logo será inserido manualmente
      eapData.push([]); // Linha 2 - Espaço para logo
      eapData.push(['NOME DA EMPRESA']); // Linha 3 - Nome da empresa
      eapData.push([]); // Linha 4 - Espaço
      
      // Informações do projeto (linhas 5-10)
      eapData.push(['ESTRUTURA ANALÍTICA DO PROJETO (EAP)']);
      eapData.push([]); // Linha 6 - Espaço
      eapData.push(['Cliente:', orcamento.cliente || '']);
      eapData.push(['Obra:', orcamento.nome || '']);
      eapData.push(['Data da Exportação:', new Date().toLocaleDateString('pt-BR')]);
      eapData.push(['Elaborador:', currentUser?.email || 'Usuário']);
      eapData.push([]); // Linha 11 - Espaço
      
      // Informações adicionais do orçamento (linhas 12-15)
      eapData.push(['Endereço:', orcamento.endereco || '']);
      eapData.push(['Data do Orçamento:', new Date(orcamento.data).toLocaleDateString('pt-BR')]);
      eapData.push(['Status:', orcamento.status || 'Em Análise']);
      if (orcamento.ultimaAtualizacaoEAP) {
        eapData.push(['Última Atualização:', formatarDataAmigavel(orcamento.ultimaAtualizacaoEAP)]);
      }
      eapData.push([]); // Linha 16 - Espaço
      
      // Resumo financeiro (linhas 17-19)
      eapData.push(['RESUMO FINANCEIRO']);
      eapData.push(['Valor Total (sem BDI):', valorTotal]);
      if (orcamento.bdiConfig) {
        const { lucro, tributos, financeiro, garantias } = orcamento.bdiConfig;
        const bdi = (1 + lucro/100) * (1 + tributos/100) * (1 + financeiro/100) * (1 + garantias/100) - 1;
        eapData.push(['BDI Aplicado:', `${(bdi * 100).toFixed(2)}%`]);
        eapData.push(['Valor Total (com BDI):', valorTotalComBDI]);
      }
      eapData.push([]); // Linha 20 - Espaço
      
      // === TABELA PRINCIPAL DA EAP ===
      // Cabeçalhos da tabela (linha 21)
      eapData.push([
        'Pacote/Subgrupo',
        'Composição',
        'Quantidade',
        'Unidade',
        'Material',
        'Mão de Obra',
        'Equipamento',
        'Serviço',
        'Total',
        '%'
      ]);

      // Dados da EAP (linhas 22+)
      todosPacotes.forEach((pacote) => {
        const subgrupos = (pacote.subgrupos || []).sort((a, b) => a.ordem - b.ordem);
        
        subgrupos.forEach((subgrupo) => {
          const itens = obterComposicoesDoSubgrupo(pacote.id, subgrupo.id);
          
          itens.forEach((comp) => {
            const { subvalores, total } = calcularSubvaloresComposicao(comp);
            const porcentagem = valorTotal > 0 ? ((total / valorTotal) * 100).toFixed(1) : '0.0';
            
            eapData.push([
              `${pacote.nome} > ${subgrupo.nome}`,
              comp.nome,
              comp.quantidade,
              comp.unidade,
              subvalores.Material,
              subvalores['Mão de Obra'],
              subvalores.Equipamento,
              subvalores.Serviço,
              total,
              `${porcentagem}%`
            ]);
          });
        });
      });

      // Resumo por pacote
      eapData.push([]); // Linha em branco
      eapData.push(['RESUMO POR PACOTE']);
      eapData.push(['Pacote', 'Valor Total', '%']);
      
      todosPacotes.forEach((pacote) => {
        const totalPacote = totalDoPacote(pacote.id);
        const porcentagemPacote = valorTotal > 0 ? ((totalPacote / valorTotal) * 100).toFixed(1) : '0.0';
        
        eapData.push([
          pacote.nome,
          totalPacote,
          `${porcentagemPacote}%`
        ]);
      });

      // Valor total final
      eapData.push([]);
      eapData.push(['VALOR TOTAL (sem BDI)', valorTotal]);
      if (orcamento.bdiConfig) {
        eapData.push(['VALOR TOTAL (com BDI)', valorTotalComBDI]);
      }

      // Criar worksheet da EAP
      const eapWorksheet = XLSX.utils.aoa_to_sheet(eapData);
      
      // Configurar larguras das colunas
      const columnWidths = [
        { wch: 40 }, // Pacote/Subgrupo
        { wch: 50 }, // Composição
        { wch: 12 }, // Quantidade
        { wch: 12 }, // Unidade
        { wch: 15 }, // Material
        { wch: 15 }, // Mão de Obra
        { wch: 15 }, // Equipamento
        { wch: 15 }, // Serviço
        { wch: 15 }, // Total
        { wch: 10 }  // %
      ];
      eapWorksheet['!cols'] = columnWidths;
      
      XLSX.utils.book_append_sheet(workbook, eapWorksheet, 'EAP');

      // Salvar o arquivo Excel
      const fileName = `EAP_${orcamento.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      alert('Erro ao gerar Excel. Verifique o console para mais detalhes.');
    }
  };

  if (!orcamento) {
    return <div>Carregando...</div>;
  }

  const todosPacotes = (orcamento.pacotes || []).sort((a, b) => a.ordem - b.ordem);

  return (
    <div>
      {/* Cabeçalho Principal */}
      <div className="eap-header">
        {/* Botão Voltar e Título */}
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <Button 
              variant="outline-secondary" 
              onClick={() => navigate('/orcamentos')}
              className="mb-3"
            >
              <FaArrowLeft className="me-2" />
              Voltar aos Orçamentos
            </Button>
            <h1 className="mb-2"><FaFolder className="me-2" />EAP - {orcamento.nome}</h1>
            <p className="text-muted mb-1">
              Cliente: {orcamento.cliente} | Data: {new Date(orcamento.data).toLocaleDateString('pt-BR')}
            </p>
            {orcamento.ultimaAtualizacaoEAP && (
              <p className="text-muted mb-2">
                Última atualização: {formatarDataAmigavel(orcamento.ultimaAtualizacaoEAP)}
              </p>
            )}
          </div>
          
          {/* Status */}
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted">Status:</span>
            <Dropdown>
              <Dropdown.Toggle 
                variant={getStatusColor(orcamento.status)} 
                size="sm"
                disabled={loading}
              >
                {orcamento.status || 'Em Análise'}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item 
                  onClick={() => atualizarStatus('Em Análise')}
                  active={orcamento.status === 'Em Análise'}
                >
                  Em Análise
                </Dropdown.Item>
                <Dropdown.Item 
                  onClick={() => atualizarStatus('Concluído')}
                  active={orcamento.status === 'Concluído'}
                >
                  Concluído
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>

        {/* Botões de Ação - Organizados em Grupos */}
        <div className="row g-3">
          {/* Grupo 1: Criação de Estrutura */}
          <div className="col-md-6">
            <div className="d-flex gap-2 flex-wrap">
              <Button onClick={() => setShowModalPacote(true)} variant="primary" size="sm">
                <FaPlus className="me-2" />
                Criar Pacote
              </Button>
              <Button 
                onClick={() => setShowModalSubgrupo(true)} 
                variant="info"
                size="sm"
                disabled={todosPacotes.length === 0}
                title={todosPacotes.length === 0 ? "Crie um pacote primeiro" : ""}
              >
                <FaPlus className="me-2" />
                Criar Subgrupo
              </Button>
              <Button 
                onClick={() => setShowModalComposicao(true)} 
                variant="success"
                size="sm"
                disabled={!temSubgrupos()}
                title={!temSubgrupos() ? "Crie um subgrupo primeiro para adicionar composições" : ""}
              >
                <FaLayerGroup className="me-2" />
                Adicionar Composição
              </Button>
            </div>
          </div>
          
          {/* Grupo 2: Configurações e Exportação */}
          <div className="col-md-6">
            <div className="d-flex gap-2 flex-wrap justify-content-md-end">
              <Button 
                onClick={() => setShowModalBDI(true)} 
                variant={orcamento.bdiConfig ? "success" : "info"}
                size="sm"
                title={orcamento.bdiConfig ? "BDI aplicado - Clique para editar" : "Configurar BDI"}
              >
                <FaCalculator className="me-2" />
                BDI {orcamento.bdiConfig && <span className="badge bg-light text-dark ms-1">✓</span>}
              </Button>
              <Button onClick={exportarEAPPdf} variant="secondary" size="sm">
                <FaFilePdf className="me-2" />
                Exportar PDF
              </Button>
              <Button onClick={exportarEAPExcel} variant="success" size="sm">
                <FaFileExcel className="me-2" />
                Exportar Excel
              </Button>
              <Button onClick={salvarEAP} variant="warning" size="sm" disabled={loading}>
                <FaSave className="me-2" />
                {loading ? 'Salvando...' : 'Salvar EAP'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* EAP: Pacotes, Subgrupos e Composições */}
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <FaFolder className="me-2" /> Estrutura Analítica do Projeto (EAP)
            </div>
            <div className="d-flex gap-2">
              <Button 
                size="sm" 
                variant="outline-secondary"
                onClick={abrirTodosPacotes}
              >
                Abrir Todos
              </Button>
              <Button 
                size="sm" 
                variant="outline-secondary"
                onClick={fecharTodosPacotes}
              >
                Fechar Todos
              </Button>
              <Button 
                size="sm" 
                variant="outline-info"
                onClick={() => navigate(`/orcamentos/${orcamentoId}/curva-abc`)}
              >
                <FaChartBar className="me-2" />
                Curva ABC
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {todosPacotes.length === 0 ? (
            <div className="text-center py-4">
              <FaFolder size={48} className="text-muted mb-3" />
              <p className="text-muted">Nenhum pacote criado. Crie um pacote para começar a organizar sua EAP.</p>
              <Button onClick={() => setShowModalPacote(true)} variant="outline-primary">
                Criar Primeiro Pacote
              </Button>
            </div>
          ) : (
            <div>
              {todosPacotes.map((pacote, pIdx) => {
                const subgrupos = (pacote.subgrupos || []).sort((a, b) => a.ordem - b.ordem);
                const isAberto = pacotesAbertos.has(pacote.id);
                
                return (
                  <Card key={pacote.id} className="mb-3">
                    <Card.Header 
                      style={{cursor: 'pointer'}}
                      onClick={() => togglePacote(pacote.id)}
                      className="d-flex justify-content-between align-items-center"
                    >
                      <div className="d-flex align-items-center">
                        <FaFolder className="me-2" />
                        <span>
                          <strong>{pacote.nome}</strong>
                          <Badge bg="secondary" className="ms-2">
                            {obterComposicoesDoPacote(pacote.id).length} comp.
                          </Badge>
                        </span>
                      </div>
                      <div className="d-flex align-items-center" style={{gap: '8px'}}>
                        <Button 
                          size="sm" 
                          variant="outline-secondary" 
                          onClick={(e) => { e.stopPropagation(); moverPacote(pacote.id, 'up'); }}
                        >
                          <FaArrowUp />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline-secondary" 
                          onClick={(e) => { e.stopPropagation(); moverPacote(pacote.id, 'down'); }}
                        >
                          <FaArrowDown />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline-primary" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setEditingPacote(pacote);
                            setNovoPacoteNome(pacote.nome);
                            setShowModalPacote(true);
                          }}
                        >
                          <FaEdit />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline-danger" 
                          onClick={(e) => { e.stopPropagation(); removerPacote(pacote.id); }}
                        >
                          <FaTrash />
                        </Button>
                                        <div className="text-end">
                  <div className="fw-bold">{formatarValor(totalDoPacote(pacote.id))}</div>
                  <small className="text-secondary">
                    {(() => {
                      const valorTotal = calcularValorTotal();
                      const totalPacote = totalDoPacote(pacote.id);
                      if (valorTotal > 0) {
                        const porcentagem = (totalPacote / valorTotal) * 100;
                        return porcentagem < 0.1 ? '<0.1' : porcentagem.toFixed(1);
                      }
                      return '0.0';
                    })()}%
                  </small>
                </div>
                      </div>
                    </Card.Header>
                    
                    {isAberto && (
                      <Card.Body>
                        {/* Subgrupos */}
                        {subgrupos.map((subgrupo, sIdx) => {
                          const itens = obterComposicoesDoSubgrupo(pacote.id, subgrupo.id);
                          return (
                            <div key={subgrupo.id} className="mb-3">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="mb-0">
                                  <strong>{subgrupo.nome}</strong>
                                  <Badge bg="info" className="ms-2">{itens.length} comp.</Badge>
                                </h6>
                                <div className="d-flex align-items-center" style={{gap: '6px'}}>
                                  <Button 
                                    size="sm" 
                                    variant="outline-secondary" 
                                    onClick={() => moverSubgrupo(pacote.id, subgrupo.id, 'up')}
                                  >
                                    <FaArrowUp />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline-secondary" 
                                    onClick={() => moverSubgrupo(pacote.id, subgrupo.id, 'down')}
                                  >
                                    <FaArrowDown />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline-primary" 
                                    onClick={() => {
                                      setEditingSubgrupo({...subgrupo, pacoteId: pacote.id});
                                      setNovoSubgrupoNome(subgrupo.nome);
                                      setShowModalSubgrupo(true);
                                    }}
                                  >
                                    <FaEdit />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline-danger" 
                                    onClick={() => removerSubgrupo(pacote.id, subgrupo.id)}
                                  >
                                    <FaTrash />
                                  </Button>
                                  <div className="text-end">
                                    <div className="fw-bold text-info">
                                      {formatarValor(totalDoSubgrupo(pacote.id, subgrupo.id))}
                                    </div>
                                    <small className="text-secondary">
                                      {(() => {
                                        const valorTotal = calcularValorTotal();
                                        const totalSubgrupo = totalDoSubgrupo(pacote.id, subgrupo.id);
                                        if (valorTotal > 0) {
                                          const porcentagem = (totalSubgrupo / valorTotal) * 100;
                                          return porcentagem < 0.1 ? '<0.1' : porcentagem.toFixed(1);
                                        }
                                        return '0.0';
                                      })()}%
                                    </small>
                                  </div>
                                </div>
                              </div>
                              
                              {itens.length === 0 ? (
                                <div className="text-muted ms-3">Sem composições neste subgrupo.</div>
                              ) : (
                                <div>
                                  {/* Cabeçalho das colunas */}
                                  <div className="d-flex bg-light py-2 mb-2 rounded" style={{width: '100%'}}>
                                    <div style={{width: '40%', paddingLeft: '15px'}}>
                                      <small className="text-muted fw-bold">COMPOSIÇÃO</small>
                                    </div>
                                    <div style={{width: '10%'}} className="text-center">
                                      <small className="text-muted fw-bold">MATERIAL</small>
                                    </div>
                                    <div style={{width: '10%'}} className="text-center">
                                      <small className="text-muted fw-bold">M.O.</small>
                                    </div>
                                    <div style={{width: '10%'}} className="text-center">
                                      <small className="text-muted fw-bold">EQUIP.</small>
                                    </div>
                                    <div style={{width: '10%'}} className="text-center">
                                      <small className="text-muted fw-bold">SERVIÇO</small>
                                    </div>
                                    <div style={{width: '10%'}} className="text-center">
                                      <small className="text-muted fw-bold">TOTAL</small>
                                    </div>
                                    <div style={{width: '5%'}} className="text-center">
                                      <small className="text-muted fw-bold">%</small>
                                    </div>
                                    <div style={{width: '5%'}} className="text-center">
                                      <small className="text-muted fw-bold">AÇÕES</small>
                                    </div>
                                  </div>
                                  
                                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndComps(pacote.id, itens)}>
                                    <SortableContext items={itens.map(i => i.tempId)} strategy={verticalListSortingStrategy}>
                                      <ListGroup>
                                      {itens.map((comp) => {
                                        const { subvalores, total } = calcularSubvaloresComposicao(comp);
                                        return (
                                          <SortableComp key={comp.tempId} id={comp.tempId}>
                                            <ListGroup.Item style={{ borderLeft: 'none', borderRight: 'none', padding: '0' }}>
                                              <div className="d-flex align-items-center py-1" style={{width: '100%'}}>
                                                {/* Nome da Composição - 40% */}
                                                <div style={{width: '40%', paddingLeft: '15px'}}>
                                                  <strong className="d-block">{comp.nome}</strong>
                                                  <div className="text-muted" style={{fontSize: '0.85rem'}}>
                                                    {comp.quantidade} {comp.unidade} × {formatCurrency(comp.custoUnitario)} = {formatCurrency(comp.custoTotal)}
                                                  </div>
                                                </div>
                                                
                                                {/* Material - 10% */}
                                                <div style={{width: '10%'}} className="text-center border-start">
                                                  <strong className="text-primary d-block" style={{fontSize: '0.8rem'}}>{formatarValor(subvalores.Material)}</strong>
                                                </div>
                                                
                                                {/* Mão de Obra - 10% */}
                                                <div style={{width: '10%'}} className="text-center border-start">
                                                  <strong className="text-success d-block" style={{fontSize: '0.8rem'}}>{formatarValor(subvalores['Mão de Obra'])}</strong>
                                                </div>
                                                
                                                {/* Equipamento - 10% */}
                                                <div style={{width: '10%'}} className="text-center border-start">
                                                  <strong className="text-warning d-block" style={{fontSize: '0.8rem'}}>{formatarValor(subvalores.Equipamento)}</strong>
                                                </div>
                                                
                                                {/* Serviço - 10% */}
                                                <div style={{width: '10%'}} className="text-center border-start">
                                                  <strong className="text-info d-block" style={{fontSize: '0.8rem'}}>{formatarValor(subvalores.Serviço)}</strong>
                                                </div>
                                                
                                                {/* Total - 10% */}
                                                <div style={{width: '10%'}} className="text-center border-start">
                                                  <strong className="text-dark d-block" style={{fontSize: '0.8rem'}}>{formatarValor(total)}</strong>
                                                </div>
                                                
                                                {/* Porcentagem - 5% */}
                                                <div style={{width: '5%'}} className="text-center border-start">
                                                  <strong className="text-secondary d-block" style={{fontSize: '0.8rem'}}>
                                                    {(() => {
                                                      const valorTotal = calcularValorTotal();
                                                      if (valorTotal > 0) {
                                                        const porcentagem = (total / valorTotal) * 100;
                                                        return porcentagem < 0.1 ? '<0.1' : porcentagem.toFixed(1);
                                                        return '0.0';
                                                      }
                                                      return '0.0';
                                                    })()}%
                                                  </strong>
                                                </div>
                                                
                                                {/* Botão Deletar - 5% */}
                                                <div style={{width: '5%'}} className="text-center border-start">
                                                  <Button size="sm" variant="outline-danger" onClick={() => removerComposicao(comp.tempId)}>
                                                    <FaTrash />
                                                  </Button>
                                                </div>
                                              </div>
                                            </ListGroup.Item>
                                          </SortableComp>
                                        );
                                      })}
                                      </ListGroup>
                                    </SortableContext>
                                  </DndContext>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </Card.Body>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
          <div className="text-end mt-3">
            <div className="row justify-content-end">
              <div className="col-auto">
                <h5 className="mb-2">Valor Total: {formatarValor(calcularValorTotal())}</h5>
                {orcamento.bdiConfig ? (
                  <>
                    <h6 className="text-info mb-2">
                      BDI ({calcularBDI().toFixed(1)}%): {formatarValor(calcularValorBDI())}
                      <span className="badge bg-success ms-2">Aplicado</span>
                    </h6>
                    <h4 className="text-success">Total com BDI: {formatarValor(calcularValorTotalComBDI())}</h4>
                  </>
                ) : (
                  <h6 className="text-muted mb-2">
                    BDI não configurado - Clique no botão BDI para configurar
                  </h6>
                )}
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Modal para Criar/Editar Pacote */}
      <Modal show={showModalPacote} onHide={() => {
        setShowModalPacote(false);
        setEditingPacote(null);
        setNovoPacoteNome('');
      }}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingPacote ? 'Editar Pacote' : 'Novo Pacote'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Nome do Pacote *</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: Fundação, Estrutura, Alvenaria..."
              value={novoPacoteNome}
              onChange={(e) => setNovoPacoteNome(e.target.value)}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowModalPacote(false);
            setEditingPacote(null);
            setNovoPacoteNome('');
          }}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={editingPacote ? editarPacote : criarPacote}
            disabled={!novoPacoteNome.trim()}
          >
            {editingPacote ? 'Atualizar' : 'Criar'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para Criar/Editar Subgrupo */}
      <Modal show={showModalSubgrupo} onHide={() => {
        setShowModalSubgrupo(false);
        setEditingSubgrupo(null);
        setNovoSubgrupoNome('');
        setPacoteParaSubgrupo(null);
      }}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingSubgrupo ? 'Editar Subgrupo' : 'Novo Subgrupo'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!editingSubgrupo && (
            <Form.Group className="mb-3">
              <Form.Label>Pacote de Destino *</Form.Label>
              <Form.Select
                value={pacoteParaSubgrupo?.id || ''}
                onChange={(e) => {
                  const pacote = todosPacotes.find(p => p.id === e.target.value);
                  setPacoteParaSubgrupo(pacote);
                }}
              >
                <option value="">Selecione um pacote...</option>
                {todosPacotes.map(pacote => (
                  <option key={pacote.id} value={pacote.id}>{pacote.nome}</option>
                ))}
              </Form.Select>
            </Form.Group>
          )}
          <Form.Group>
            <Form.Label>Nome do Subgrupo *</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: Escavação, Concreto, Alvenaria..."
              value={novoSubgrupoNome}
              onChange={(e) => setNovoSubgrupoNome(e.target.value)}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowModalSubgrupo(false);
            setEditingSubgrupo(null);
            setNovoSubgrupoNome('');
            setPacoteParaSubgrupo(null);
          }}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={editingSubgrupo ? editarSubgrupo : criarSubgrupo}
            disabled={!novoSubgrupoNome.trim() || (!editingSubgrupo && !pacoteParaSubgrupo)}
          >
            {editingSubgrupo ? 'Atualizar' : 'Criar'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para Adicionar Composição */}
      <Modal show={showModalComposicao} onHide={() => {
        setShowModalComposicao(false);
        setNovaComposicao({
          composicaoId: '',
          quantidade: '',
          custoUnitario: '',
          pacoteId: '',
          subgrupoId: ''
        });
      }}>
        <Modal.Header closeButton>
          <Modal.Title>Adicionar Composição</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Composição *</Form.Label>
            <Form.Select
              value={novaComposicao.composicaoId}
              onChange={(e) => {
                const selectedId = e.target.value;
                const selected = composicoes.find(c => c.id === selectedId);
                setNovaComposicao({
                  ...novaComposicao,
                  composicaoId: selectedId,
                  custoUnitario: selected && selected.valorTotal != null ? selected.valorTotal : ''
                });
              }}
            >
              <option value="">Selecione...</option>
              {composicoes.map(composicao => (
                <option key={composicao.id} value={composicao.id}>
                  {composicao.nome} ({composicao.unidade})
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Quantidade *</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={novaComposicao.quantidade}
              onChange={(e) => setNovaComposicao({...novaComposicao, quantidade: e.target.value})}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Custo Unitário (R$) *</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={novaComposicao.custoUnitario}
              onChange={(e) => setNovaComposicao({...novaComposicao, custoUnitario: e.target.value})}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Pacote de Destino *</Form.Label>
            <Form.Select
              value={novaComposicao.pacoteId}
              onChange={(e) => setNovaComposicao({...novaComposicao, pacoteId: e.target.value, subgrupoId: ''})}
            >
              <option value="">Selecione...</option>
              {todosPacotes.map(pacote => (
                <option key={pacote.id} value={pacote.id}>{pacote.nome}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Subgrupo *</Form.Label>
            <Form.Select
              value={novaComposicao.subgrupoId}
              onChange={(e) => setNovaComposicao({...novaComposicao, subgrupoId: e.target.value})}
              disabled={!novaComposicao.pacoteId}
            >
              <option value="">Selecione um subgrupo...</option>
              {novaComposicao.pacoteId && todosPacotes.find(p => p.id === novaComposicao.pacoteId)?.subgrupos?.map(subgrupo => (
                <option key={subgrupo.id} value={subgrupo.id}>{subgrupo.nome}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowModalComposicao(false);
            setNovaComposicao({
              composicaoId: '',
              quantidade: '',
              custoUnitario: '',
              pacoteId: '',
              subgrupoId: ''
            });
          }}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={adicionarComposicao}
            disabled={!novaComposicao.composicaoId || !novaComposicao.quantidade || !novaComposicao.custoUnitario || !novaComposicao.pacoteId || !novaComposicao.subgrupoId}
          >
            Adicionar Composição
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal para Configurar BDI */}
      <Modal show={showModalBDI} onHide={() => setShowModalBDI(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCalculator className="me-2" />
            Configurar BDI (Benefícios e Despesas Indiretas)
            {orcamento.bdiConfig && (
              <span className="badge bg-success ms-2">Aplicado</span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row">
            <div className="col-md-6">
              <h6 className="mb-3">Parâmetros do BDI</h6>
              
              <Form.Group className="mb-3">
                <Form.Label>Lucro (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={bdiConfig.lucro}
                  onChange={(e) => setBdiConfig({...bdiConfig, lucro: parseFloat(e.target.value) || 0})}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Tributos (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={bdiConfig.tributos}
                  onChange={(e) => setBdiConfig({...bdiConfig, tributos: parseFloat(e.target.value) || 0})}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Financeiro (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={bdiConfig.financeiro}
                  onChange={(e) => setBdiConfig({...bdiConfig, financeiro: parseFloat(e.target.value) || 0})}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Garantias (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={bdiConfig.garantias}
                  onChange={(e) => setBdiConfig({...bdiConfig, garantias: parseFloat(e.target.value) || 0})}
                />
              </Form.Group>
              
              <div className="text-center mt-3">
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => {
                    setBdiConfig({
                      lucro: 20,
                      tributos: 35,
                      financeiro: 5,
                      garantias: 2
                    });
                  }}
                >
                  Resetar para Valores Padrão
                </Button>
              </div>
            </div>

            <div className="col-md-6">
              <h6 className="mb-3">Resultados</h6>
              
              <div className="card bg-light p-3">
                <div className="row mb-2">
                  <div className="col-6">
                    <strong>Valor Total da EAP:</strong>
                  </div>
                  <div className="col-6 text-end">
                    {formatarValor(calcularValorTotal())}
                  </div>
                </div>
                
                <div className="row mb-2">
                  <div className="col-6">
                    <strong>BDI Calculado:</strong>
                  </div>
                  <div className="col-6 text-end text-info">
                    {calcularBDI().toFixed(1)}%
                  </div>
                </div>
                
                <div className="row mb-2">
                  <div className="col-6">
                    <strong>Valor do BDI:</strong>
                  </div>
                  <div className="col-6 text-end text-info">
                    {formatarValor(calcularValorBDI())}
                  </div>
                </div>
                
                <div className="row">
                  <div className="col-6">
                    <strong>Total com BDI:</strong>
                  </div>
                  <div className="col-6 text-end text-success">
                    <strong>{formatarValor(calcularValorTotalComBDI())}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <h6>Fórmula Aplicada:</h6>
                <small className="text-muted">
                  BDI = (1 + {bdiConfig.lucro/100}) × (1 + {bdiConfig.tributos/100}) × (1 + {bdiConfig.financeiro/100}) × (1 + {bdiConfig.garantias/100}) - 1
                </small>
                <br />
                <small className="text-muted">
                  BDI = {((1 + bdiConfig.lucro/100) * (1 + bdiConfig.tributos/100) * (1 + bdiConfig.financeiro/100) * (1 + bdiConfig.garantias/100) - 1).toFixed(4)} = {calcularBDI().toFixed(1)}%
                </small>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModalBDI(false)}>
            Fechar
          </Button>
          {orcamento.bdiConfig && (
            <Button 
              variant="danger" 
              onClick={() => {
                if (window.confirm('Tem certeza que deseja remover o BDI aplicado?')) {
                  setBdiConfig({ lucro: 0, tributos: 0, financeiro: 0, garantias: 0 });
                  setOrcamento(prev => ({
                    ...prev,
                    bdiConfig: null
                  }));
                  setShowModalBDI(false);
                  alert('BDI removido com sucesso! Clique em "Salvar EAP" para persistir as alterações.');
                }
              }}
            >
              Remover BDI
            </Button>
          )}
          <Button 
            variant="primary" 
            onClick={() => {
              // Salvar as configurações do BDI no estado local
              setOrcamento(prev => ({
                ...prev,
                bdiConfig: bdiConfig
              }));
              setShowModalBDI(false);
              alert('BDI aplicado com sucesso! Clique em "Salvar EAP" para persistir as alterações.');
            }}
          >
            Aplicar BDI
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default OrcamentoEAP;
