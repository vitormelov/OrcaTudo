import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  Modal, 
  Form, 
  Alert, 
  Row, 
  Col,
  Badge,
  InputGroup,
  Tabs,
  Tab,
  Spinner
} from 'react-bootstrap';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  orderBy,
  getDoc,
  writeBatch 
} from 'firebase/firestore';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';

import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaBoxes, FaDatabase, FaSort, FaSortUp, FaSortDown, FaTimes, FaCheck } from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function Insumos() {
  const { currentUser } = useAuth();
  const [insumos, setInsumos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistorico, setShowHistorico] = useState(false);
  const [historicoData, setHistoricoData] = useState({ insumo: null, precos: [] });
  const [composicoes, setComposicoes] = useState([]);
  const [activeTab, setActiveTab] = useState('meus');
  const [seinfraCatalog, setSeinfraCatalog] = useState([]);
  const [seinfraLoading, setSeinfraLoading] = useState(false);
  const [seinfraSearch, setSeinfraSearch] = useState('');
  const [seinfraError, setSeinfraError] = useState('');
  const [addingCodigo, setAddingCodigo] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSeinfraModal, setShowSeinfraModal] = useState(false);
  const [seinfraItem, setSeinfraItem] = useState(null);
  const [seinfraCategoria, setSeinfraCategoria] = useState('Material');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const formatDateBR = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };

  const epochFromLocalDate = (dateStr) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3) return 0;
    const [y, m, d] = parts;
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.getTime();
  };
  
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    unidade: '',
    precoUnitario: '',
    categoria: '',
    empresa: ''
  });

  const unidades = [
    'CJ',
    'DIA', 
    'DM3',
    'H',
    'HA',
    'HxMÊS',
    'JG',
    'KG',
    'KM',
    'KWH',
    'L',
    'M',
    'M/L',
    'M2',
    'M2xMÊS',
    'M3',
    'M3xMÊS',
    'MÊS',
    'MIL',
    'ML',
    'PAR',
    'PÇ',
    'RL',
    'T',
    'UN',
    'UNxMÊS'
  ];
  const categorias = ['Material', 'Mão de Obra', 'Equipamento', 'Serviço'];

  useEffect(() => {
    if (currentUser) {
      fetchInsumos();
      fetchComposicoes();
    }
  }, [currentUser]);

  const fetchInsumos = async () => {
    try {
      if (!currentUser) return;
      setError('');
      const q = query(
        collection(db, 'insumos'), 
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const insumosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      insumosData.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
      setInsumos(insumosData);
    } catch (error) {
      setError('Erro ao carregar insumos');
      console.error(error);
    }
  };

  const fetchComposicoes = async () => {
    try {
      if (!currentUser) return;
      const q = query(
        collection(db, 'composicoes'), 
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const composicoesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComposicoes(composicoesData);
    } catch (error) {
      console.error('Erro ao carregar composições:', error);
    }
  };

  const loadSeinfraCatalog = async () => {
    if (seinfraCatalog.length > 0 || seinfraLoading) return;
    setSeinfraLoading(true);
    setSeinfraError('');
    try {
      const response = await fetch('/insumos/seinfra.json');
      if (!response.ok) throw new Error('Não foi possível carregar o catálogo SEINFRA');
      const data = await response.json();
      setSeinfraCatalog(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSeinfraError(err.message || 'Erro ao carregar catálogo SEINFRA');
    } finally {
      setSeinfraLoading(false);
    }
  };

  const handleTabSelect = (key) => {
    setActiveTab(key);
    setSuccessMessage('');
    setError('');
    setDeleteMode(false);
    setSelectedIds([]);
    if (key === 'seinfra') {
      loadSeinfraCatalog();
    }
  };

  const abrirAdicionarSeinfra = (item) => {
    const jaExiste = insumos.some(
      (insumo) =>
        (insumo.codigo || '').toString().toLowerCase() === item.codigo.toLowerCase() ||
        (insumo.nome || '').toLowerCase() === item.nome.toLowerCase()
    );
    if (jaExiste) {
      setError(`O insumo "${item.codigo} - ${item.nome}" já está nos seus insumos.`);
      setSuccessMessage('');
      return;
    }
    setSeinfraItem(item);
    setSeinfraCategoria('Material');
    setShowSeinfraModal(true);
    setError('');
  };

  const confirmarAdicionarSeinfra = async () => {
    if (!seinfraItem || !currentUser) return;
    setAddingCodigo(seinfraItem.codigo);
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const hojeStr = new Date().toISOString().split('T')[0];
      const agora = new Date();
      const insumoData = {
        codigo: seinfraItem.codigo,
        nome: seinfraItem.nome,
        categoria: seinfraCategoria,
        unidade: seinfraItem.unidade,
        precoUnitario: parseFloat(seinfraItem.precoUnitario) || 0,
        data: hojeStr,
        empresa: 'SEINFRA',
        fonte: 'SEINFRA',
        userId: currentUser.uid,
        createdAt: agora,
        updatedAt: agora
      };

      const docRef = await addDoc(collection(db, 'insumos'), insumoData);
      await addDoc(collection(db, 'insumos', docRef.id, 'precos'), {
        preco: insumoData.precoUnitario,
        data: hojeStr,
        empresa: 'SEINFRA',
        createdAt: agora
      });

      setShowSeinfraModal(false);
      setSeinfraItem(null);
      setSuccessMessage(`Insumo "${insumoData.codigo}" adicionado aos seus insumos.`);
      await fetchInsumos();
    } catch (err) {
      console.error(err);
      setError(`Erro ao adicionar insumo SEINFRA: ${err.message}`);
    } finally {
      setLoading(false);
      setAddingCodigo(null);
    }
  };

  const filteredSeinfra = (() => {
    const termo = seinfraSearch.trim().toLowerCase();
    if (!termo) return [];
    const matches = [];
    for (let i = 0; i < seinfraCatalog.length; i++) {
      const item = seinfraCatalog[i];
      if (
        item.codigo.toLowerCase().includes(termo) ||
        item.nome.toLowerCase().includes(termo)
      ) {
        matches.push(item);
        if (matches.length >= 80) break;
      }
    }
    return matches;
  })();

  const jaAdicionado = (codigo) =>
    insumos.some((insumo) => (insumo.codigo || '').toString().toLowerCase() === String(codigo).toLowerCase());

  // Função para atualizar composições que usam um insumo específico
  const atualizarComposicoesComInsumo = async (insumoId, novoPreco) => {
    try {
      const compsQ = query(
        collection(db, 'composicoes'), 
        where('userId', '==', currentUser.uid), 
        where('insumoIds', 'array-contains', insumoId)
      );
      const compsSnap = await getDocs(compsQ);
      
      if (compsSnap.empty) return;
      
      const batch = writeBatch(db);
      compsSnap.docs.forEach(docSnap => {
        const comp = docSnap.data();
        // Recalcular valor total da composição
        const totalCorrigido = (comp.insumos || []).reduce((sum, item) => {
          const insumoAtual = insumos.find(i => i.id === item.insumoId);
          const precoAtual = item.insumoId === insumoId ? novoPreco : (insumoAtual?.precoUnitario || 0);
          return sum + (parseFloat(item.quantidade) || 0) * precoAtual;
        }, 0);
        
        batch.update(doc(db, 'composicoes', docSnap.id), { valorTotal: totalCorrigido });
      });
      
      await batch.commit();
    } catch (error) {
      console.warn('Falha ao atualizar composições relacionadas:', error);
    }
  };

  const abrirHistorico = async (insumo) => {
    try {
      const precosRef = collection(doc(db, 'insumos', insumo.id), 'precos');
      const snap = await getDocs(precosRef);
      const precos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => epochFromLocalDate(a.data) - epochFromLocalDate(b.data));
      setHistoricoData({ insumo, precos });
      setShowHistorico(true);
    } catch (e) {
      console.error('Erro ao carregar histórico de preços', e);
    }
  };

  // Função para atualizar o histórico quando necessário
  const atualizarHistorico = async (insumoId) => {
    if (showHistorico && historicoData.insumo?.id === insumoId) {
      try {
        const precosRef = collection(doc(db, 'insumos', insumoId), 'precos');
        const snap = await getDocs(precosRef);
        const precos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => epochFromLocalDate(a.data) - epochFromLocalDate(b.data));
        setHistoricoData(prev => ({ ...prev, precos }));
      } catch (e) {
        console.error('Erro ao atualizar histórico:', e);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Verificar se já existe um insumo com o mesmo nome
      const nomeNormalizado = formData.nome.trim().toLowerCase();
      const insumoExistente = insumos.find(insumo => 
        insumo.nome.toLowerCase() === nomeNormalizado && 
        insumo.id !== editingInsumo?.id
      );

      if (insumoExistente) {
        setError('Já existe um insumo com este nome. Use um nome diferente.');
        setLoading(false);
        return;
      }

      const hojeStr = new Date().toISOString().split('T')[0];
      const agora = new Date();

      const insumoData = {
        codigo: (formData.codigo || '').trim(),
        nome: formData.nome.trim(),
        categoria: formData.categoria,
        unidade: formData.unidade,
        precoUnitario: parseFloat(formData.precoUnitario),
        data: hojeStr,
        empresa: formData.empresa,
        userId: currentUser.uid,
        createdAt: editingInsumo ? editingInsumo.createdAt : agora,
        updatedAt: agora
      };

      if (editingInsumo) {
        // Atualizar insumo existente
        await updateDoc(doc(db, 'insumos', editingInsumo.id), insumoData);
        
        // Atualizar preço no histórico se mudou
        if (formData.precoUnitario !== editingInsumo.precoUnitario) {
          const novoPreco = {
            preco: parseFloat(formData.precoUnitario),
            data: hojeStr,
            empresa: formData.empresa,
            createdAt: agora
          };
          
          await addDoc(collection(db, 'insumos', editingInsumo.id, 'precos'), novoPreco);
          
          // Atualizar composições que usam este insumo
          await atualizarComposicoesComInsumo(editingInsumo.id, parseFloat(formData.precoUnitario));
          
          // Atualizar o histórico se o modal estiver aberto
          await atualizarHistorico(editingInsumo.id);
        }
      } else {
        // Criar novo insumo
        const docRef = await addDoc(collection(db, 'insumos'), insumoData);
        
        // Salvar primeiro preço no histórico
        const primeiroPreco = {
          preco: parseFloat(formData.precoUnitario),
          data: hojeStr,
          empresa: formData.empresa,
          createdAt: agora
        };
        
        await addDoc(collection(db, 'insumos', docRef.id, 'precos'), primeiroPreco);
      }

      setShowModal(false);
      setEditingInsumo(null);
      resetForm();
      fetchInsumos();
      setError('');
    } catch (error) {
      setError(`Erro ao salvar insumo: ${error.message}`);
      console.error('Erro ao salvar insumo:', error);
    }

    setLoading(false);
  };

  const handleEdit = (insumo) => {
    setEditingInsumo(insumo);
    setFormData({
      codigo: insumo.codigo || '',
      nome: insumo.nome,
      unidade: insumo.unidade,
      precoUnitario: insumo.precoUnitario.toString(),
      categoria: insumo.categoria,
      empresa: insumo.empresa || ''
    });
    setShowModal(true);
  };

  // Função para atualizar composições removendo um ou mais insumos
  const atualizarComposicoesSemInsumos = async (insumoIds) => {
    try {
      const idsSet = new Set(insumoIds);
      const batch = writeBatch(db);
      let composicoesAtualizadas = 0;
      const insumosRestantes = insumos.filter((i) => !idsSet.has(i.id));

      composicoes.forEach((composicao) => {
        if (composicao.insumos && Array.isArray(composicao.insumos)) {
          const usavaAlgum = composicao.insumos.some((item) => idsSet.has(item.insumoId));
          if (!usavaAlgum) return;

          const novosInsumos = composicao.insumos.filter((item) => !idsSet.has(item.insumoId));
          let novoValorTotal = 0;
          novosInsumos.forEach((item) => {
            const insumo = insumosRestantes.find((i) => i.id === item.insumoId);
            if (insumo) {
              novoValorTotal += (parseFloat(item.quantidade) || 0) * (insumo.precoUnitario || 0);
            }
          });

          batch.update(doc(db, 'composicoes', composicao.id), {
            insumos: novosInsumos,
            insumoIds: novosInsumos.map((i) => i.insumoId),
            valorTotal: novoValorTotal
          });
          composicoesAtualizadas++;
        }
      });

      if (composicoesAtualizadas > 0) {
        await batch.commit();
        setComposicoes((prev) =>
          prev.map((comp) => {
            if (!comp.insumos || !Array.isArray(comp.insumos)) return comp;
            const usavaAlgum = comp.insumos.some((item) => idsSet.has(item.insumoId));
            if (!usavaAlgum) return comp;
            const novosInsumos = comp.insumos.filter((item) => !idsSet.has(item.insumoId));
            let novoValorTotal = 0;
            novosInsumos.forEach((item) => {
              const insumo = insumosRestantes.find((i) => i.id === item.insumoId);
              if (insumo) {
                novoValorTotal += (parseFloat(item.quantidade) || 0) * (insumo.precoUnitario || 0);
              }
            });
            return {
              ...comp,
              insumos: novosInsumos,
              insumoIds: novosInsumos.map((i) => i.insumoId),
              valorTotal: novoValorTotal
            };
          })
        );
      }
    } catch (error) {
      console.error('Erro ao atualizar composições após deleção do insumo:', error);
    }
  };

  // Função para atualizar orçamentos que usam composições modificadas
  const atualizarOrcamentosComComposicoes = async () => {
    try {
      const orcamentosRef = collection(db, 'orcamentos');
      const orcamentosSnapshot = await getDocs(orcamentosRef);

      const batch = writeBatch(db);
      let orcamentosAtualizados = 0;

      orcamentosSnapshot.docs.forEach((docSnap) => {
        const orcamento = docSnap.data();
        if (orcamento.userId !== currentUser.uid) return;

        if (orcamento.composicoes && Array.isArray(orcamento.composicoes)) {
          let valorTotalAtualizado = 0;
          let composicoesModificadas = false;

          orcamento.composicoes.forEach((composicao) => {
            if (composicao.composicaoId) {
              const composicaoAtualizada = composicoes.find((c) => c.id === composicao.composicaoId);
              if (composicaoAtualizada) {
                const valorComposicao =
                  (composicaoAtualizada.valorTotal || 0) * (parseFloat(composicao.quantidade) || 1);
                valorTotalAtualizado += valorComposicao;
                composicoesModificadas = true;
              }
            }
          });

          if (composicoesModificadas) {
            batch.update(doc(db, 'orcamentos', docSnap.id), {
              valorTotal: valorTotalAtualizado,
              ultimaAtualizacaoEAP: new Date().toISOString()
            });
            orcamentosAtualizados++;
          }
        }
      });

      if (orcamentosAtualizados > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error('Erro ao atualizar orçamentos após deleção do insumo:', error);
    }
  };

  const entrarModoExclusao = () => {
    setDeleteMode(true);
    setSelectedIds([]);
    setError('');
    setSuccessMessage('');
  };

  const cancelarModoExclusao = () => {
    setDeleteMode(false);
    setSelectedIds([]);
  };

  const toggleSelectId = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = sortedInsumos.map((i) => i.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      setError('Selecione ao menos um insumo para excluir.');
      return;
    }

    const ok = window.confirm(
      `Tem certeza que deseja excluir ${selectedIds.length} insumo(s)?\n\n` +
        'Esta ação irá:\n' +
        '• Remover os insumos de todas as composições que os utilizam\n' +
        '• Recalcular os valores das composições afetadas\n' +
        '• Atualizar os orçamentos que usam essas composições\n\n' +
        'Esta ação não pode ser desfeita.'
    );
    if (!ok) return;

    try {
      setLoading(true);
      setError('');

      await atualizarComposicoesSemInsumos(selectedIds);
      await atualizarOrcamentosComComposicoes();

      for (const id of selectedIds) {
        const precosRef = collection(db, 'insumos', id, 'precos');
        const precosSnapshot = await getDocs(precosRef);
        await Promise.all(precosSnapshot.docs.map((d) => deleteDoc(d.ref)));
        await deleteDoc(doc(db, 'insumos', id));
      }

      setInsumos((prev) => prev.filter((insumo) => !selectedIds.includes(insumo.id)));
      if (editingInsumo && selectedIds.includes(editingInsumo.id)) {
        setEditingInsumo(null);
      }

      await fetchComposicoes();
      setSuccessMessage(`${selectedIds.length} insumo(s) excluído(s) com sucesso.`);
      cancelarModoExclusao();
    } catch (error) {
      setError('Erro ao excluir insumos');
      console.error('Erro ao excluir insumos:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nome: '',
      unidade: '',
      precoUnitario: '',
      categoria: '',
      empresa: ''
    });
  };

  const getDataInsumoISO = (insumo) => {
    // Preferir updatedAt (última atualização), depois data (string) e por fim createdAt
    const fonte = insumo.updatedAt || insumo.createdAt;

    if (fonte) {
      if (typeof fonte.toDate === 'function') {
        // Timestamp do Firestore
        return fonte.toDate().toISOString().split('T')[0];
      }
      if (fonte instanceof Date) {
        return fonte.toISOString().split('T')[0];
      }
    }

    if (insumo.data) {
      return insumo.data;
    }

    return null;
  };

  const filteredInsumos = insumos.filter(insumo => {
    const termo = searchTerm.toLowerCase();
    return (
      (insumo.codigo || '').toString().toLowerCase().includes(termo) ||
      (insumo.nome || '').toLowerCase().includes(termo) ||
      (insumo.categoria || '').toLowerCase().includes(termo)
    );
  });

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
  };

  const getSortValue = (insumo, key) => {
    switch (key) {
      case 'codigo':
        return (insumo.codigo || '').toString().toLowerCase();
      case 'nome':
        return (insumo.nome || '').toLowerCase();
      case 'categoria':
        return (insumo.categoria || '').toLowerCase();
      case 'unidade':
        return (insumo.unidade || '').toLowerCase();
      case 'precoUnitario':
        return Number(insumo.precoUnitario) || 0;
      case 'empresa':
        return (insumo.empresa || '').toLowerCase();
      case 'data':
        return getDataInsumoISO(insumo) || '';
      default:
        return '';
    }
  };

  const sortedInsumos = (() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredInsumos;
    const list = [...filteredInsumos];
    list.sort((a, b) => {
      const va = getSortValue(a, sortConfig.key);
      const vb = getSortValue(b, sortConfig.key);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return list;
  })();

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="ms-1 text-muted" size={12} />;
    if (sortConfig.direction === 'asc') return <FaSortUp className="ms-1" size={12} />;
    return <FaSortDown className="ms-1" size={12} />;
  };

  const SortableTh = ({ columnKey, children }) => (
    <th
      onClick={() => toggleSort(columnKey)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      title="Clique para ordenar"
    >
      {children}
      {renderSortIcon(columnKey)}
    </th>
  );

  const getCategoriaColor = (categoria) => {
    const colors = {
      'Material': 'primary',
      'Mão de Obra': 'success',
      'Equipamento': 'warning',
      'Serviço': 'info'
    };
    return colors[categoria] || 'secondary';
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1><FaBoxes className="me-2" />Insumos</h1>
          <p className="text-muted">Gerencie os insumos básicos para suas composições</p>
        </div>
        {activeTab === 'meus' && (
          <div className="d-flex gap-2">
            {deleteMode ? (
              <>
                <Button variant="outline-secondary" onClick={cancelarModoExclusao} disabled={loading}>
                  <FaTimes className="me-2" />
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleBulkDelete}
                  disabled={loading || selectedIds.length === 0}
                >
                  <FaCheck className="me-2" />
                  {loading ? 'Excluindo...' : `Confirmar exclusão (${selectedIds.length})`}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline-danger" onClick={entrarModoExclusao}>
                  <FaTrash className="me-2" />
                  Excluir
                </Button>
                <Button onClick={() => setShowModal(true)} variant="primary">
                  <FaPlus className="me-2" />
                  Novo Insumo
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
      {successMessage && <Alert variant="success" onClose={() => setSuccessMessage('')} dismissible>{successMessage}</Alert>}

      <Tabs activeKey={activeTab} onSelect={handleTabSelect} className="mb-3">
        <Tab eventKey="meus" title="Meus Insumos">
          <Card>
            <Card.Header>
              <Row className="align-items-center">
                <Col>
                  <h5 className="mb-0">Lista de Insumos</h5>
                  {deleteMode && (
                    <small className="text-danger">Selecione os insumos que deseja excluir</small>
                  )}
                </Col>
                <Col md={4}>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Buscar insumos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </InputGroup>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body>
              {filteredInsumos.length === 0 ? (
                <div className="text-center py-4">
                  <FaBoxes size={48} className="text-muted mb-3" />
                  <p className="text-muted">Nenhum insumo encontrado</p>
                  <Button onClick={() => setShowModal(true)} variant="outline-primary">
                    Adicionar Primeiro Insumo
                  </Button>
                </div>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      {deleteMode && (
                        <th style={{ width: 40 }}>
                          <Form.Check
                            type="checkbox"
                            checked={
                              sortedInsumos.length > 0 &&
                              sortedInsumos.every((i) => selectedIds.includes(i.id))
                            }
                            onChange={toggleSelectAllVisible}
                            title="Selecionar todos visíveis"
                          />
                        </th>
                      )}
                      <SortableTh columnKey="codigo">Código</SortableTh>
                      <SortableTh columnKey="nome">Nome</SortableTh>
                      <SortableTh columnKey="categoria">Categoria</SortableTh>
                      <SortableTh columnKey="unidade">Unidade</SortableTh>
                      <SortableTh columnKey="precoUnitario">Preço Unitário</SortableTh>
                      <SortableTh columnKey="empresa">Empresa</SortableTh>
                      <SortableTh columnKey="data">Data</SortableTh>
                      {!deleteMode && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInsumos.map((insumo) => (
                      <tr
                        key={insumo.id}
                        onClick={() => {
                          if (deleteMode) toggleSelectId(insumo.id);
                          else abrirHistorico(insumo);
                        }}
                        style={{ cursor: 'pointer' }}
                        className={selectedIds.includes(insumo.id) ? 'table-danger' : ''}
                      >
                        {deleteMode && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <Form.Check
                              type="checkbox"
                              checked={selectedIds.includes(insumo.id)}
                              onChange={() => toggleSelectId(insumo.id)}
                            />
                          </td>
                        )}
                        <td>{insumo.codigo || '-'}</td>
                        <td><strong>{insumo.nome}</strong></td>
                        <td>
                          <Badge bg={getCategoriaColor(insumo.categoria)}>
                            {insumo.categoria}
                          </Badge>
                        </td>
                        <td>{insumo.unidade}</td>
                        <td>R$ {insumo.precoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td>{insumo.empresa || '-'}</td>
                        <td>{formatDateBR(getDataInsumoISO(insumo))}</td>
                        {!deleteMode && (
                          <td>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={(e) => { e.stopPropagation(); handleEdit(insumo); }}
                            >
                              <FaEdit />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="seinfra" title={<span><FaDatabase className="me-1" />Catálogo SEINFRA</span>}>
          <Card>
            <Card.Header>
              <Row className="align-items-center">
                <Col>
                  <h5 className="mb-0">Tabela SEINFRA</h5>
                  <small className="text-muted">
                    Busque e adicione insumos da tabela oficial aos seus insumos
                    {seinfraCatalog.length > 0 ? ` (${seinfraCatalog.length.toLocaleString('pt-BR')} itens)` : ''}
                  </small>
                </Col>
                <Col md={5}>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Buscar por código ou descrição..."
                      value={seinfraSearch}
                      onChange={(e) => setSeinfraSearch(e.target.value)}
                    />
                  </InputGroup>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body>
              {seinfraError && <Alert variant="danger">{seinfraError}</Alert>}
              {seinfraLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <p className="text-muted mt-3 mb-0">Carregando catálogo SEINFRA...</p>
                </div>
              ) : !seinfraSearch.trim() ? (
                <div className="text-center py-4">
                  <FaDatabase size={48} className="text-muted mb-3" />
                  <p className="text-muted mb-0">Digite um código ou parte da descrição para buscar no catálogo.</p>
                </div>
              ) : filteredSeinfra.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted mb-0">Nenhum item encontrado para &quot;{seinfraSearch}&quot;</p>
                </div>
              ) : (
                <>
                  <p className="text-muted small mb-2">
                    Mostrando até 80 resultados. Refine a busca se necessário.
                  </p>
                  <Table responsive hover>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Unidade</th>
                        <th>Valor (R$)</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSeinfra.map((item) => {
                        const adicionado = jaAdicionado(item.codigo);
                        return (
                          <tr key={item.codigo}>
                            <td>{item.codigo}</td>
                            <td><strong>{item.nome}</strong></td>
                            <td>{item.unidade}</td>
                            <td>
                              R$ {(item.precoUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td>
                              {adicionado ? (
                                <Badge bg="success">Já adicionado</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  disabled={addingCodigo === item.codigo || loading}
                                  onClick={() => abrirAdicionarSeinfra(item)}
                                >
                                  <FaPlus className="me-1" />
                                  Adicionar
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Modal para Adicionar/Editar Insumo */}
      <Modal show={showModal} size="lg" onHide={() => {
        setShowModal(false);
        setEditingInsumo(null);
        resetForm();
      }}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {/* Linha 1: Código + Nome (ordem do CRUD) */}
            <Row>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Código *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={9}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Linha 2: Categoria, Unidade, Preço Unitário */}
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Categoria *</Form.Label>
                  <Form.Select
                    value={formData.categoria}
                    onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                    required
                  >
                    <option value="">Selecione...</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Unidade *</Form.Label>
                  <Form.Select
                    value={formData.unidade}
                    onChange={(e) => setFormData({...formData, unidade: e.target.value})}
                    required
                  >
                    <option value="">Selecione...</option>
                    {unidades.map(un => (
                      <option key={un} value={un}>{un}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Preço Unitário (R$) *</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precoUnitario}
                    onChange={(e) => setFormData({...formData, precoUnitario: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* Linha 3: Empresa */}
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Empresa</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowModal(false);
              setEditingInsumo(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Salvando...' : (editingInsumo ? 'Atualizar' : 'Salvar')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal: categoria ao adicionar do SEINFRA */}
      <Modal show={showSeinfraModal} onHide={() => { setShowSeinfraModal(false); setSeinfraItem(null); }}>
        <Modal.Header closeButton>
          <Modal.Title>Adicionar insumo SEINFRA</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {seinfraItem && (
            <>
              <p className="mb-2"><strong>Código:</strong> {seinfraItem.codigo}</p>
              <p className="mb-2"><strong>Descrição:</strong> {seinfraItem.nome}</p>
              <p className="mb-2"><strong>Unidade:</strong> {seinfraItem.unidade}</p>
              <p className="mb-3">
                <strong>Preço:</strong>{' '}
                R$ {(seinfraItem.precoUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <Form.Group>
                <Form.Label>Categoria *</Form.Label>
                <Form.Select
                  value={seinfraCategoria}
                  onChange={(e) => setSeinfraCategoria(e.target.value)}
                >
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <p className="text-muted small mt-3 mb-0">A empresa será registrada como SEINFRA.</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowSeinfraModal(false); setSeinfraItem(null); }}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={loading || !seinfraCategoria} onClick={confirmarAdicionarSeinfra}>
            {loading ? 'Adicionando...' : 'Adicionar aos meus insumos'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Histórico de Preços */}
      <Modal show={showHistorico} onHide={() => setShowHistorico(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Histórico de Preços - {historicoData.insumo?.nome}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {historicoData.precos.length === 0 ? (
            <div className="text-muted">Sem históricos de preço para este insumo.</div>
          ) : (
            <>
              <div className="mb-3">
                <strong>Empresa mais recente:</strong> {historicoData.precos[historicoData.precos.length - 1].empresa || '-'}
                <br />
                <strong>Última data:</strong> {formatDateBR(historicoData.precos[historicoData.precos.length - 1].data)}
              </div>
              <Line
                data={{
                  labels: historicoData.precos.map(p => formatDateBR(p.data)),
                  datasets: [
                    {
                      label: 'Preço (R$)',
                      data: historicoData.precos.map(p => p.preco),
                      borderColor: 'rgba(0, 123, 255, 1)',
                      backgroundColor: 'rgba(0, 123, 255, 0.2)'
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: true } },
                  scales: { y: { ticks: { callback: (v) => `R$ ${v}` } } }
                }}
              />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHistorico(false)}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Insumos;
