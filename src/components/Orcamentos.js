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
  InputGroup
} from 'react-bootstrap';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFileInvoiceDollar, FaEye, FaCopy, FaSort, FaSortUp, FaSortDown, FaCodeBranch, FaArchive, FaList, FaUndo, FaHistory } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { copiarEAPCompleta, formatRevisao, getObraId, getRevisao, MOTIVO_REVISAO_INICIAL, getMotivoRevisaoExibicao, listarRevisoesDaObra } from '../utils/eapCopy';
import { formatCurrency } from '../utils/formatters';
import { calcularValorComBdi } from '../utils/bdi';

function Orcamentos() {
  const { currentUser } = useAuth();
  const { empresaId, podeEditar } = useEmpresa();
  const navigate = useNavigate();
  const [orcamentos, setOrcamentos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [editingOrcamento, setEditingOrcamento] = useState(null);
  const [orcamentoParaCopiar, setOrcamentoParaCopiar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [mostrarObsoletos, setMostrarObsoletos] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [historicoRef, setHistoricoRef] = useState(null);
  const [historicoEditId, setHistoricoEditId] = useState(null);
  const [historicoEditTexto, setHistoricoEditTexto] = useState('');
  const [showNovaRevisaoModal, setShowNovaRevisaoModal] = useState(false);
  const [orcamentoNovaRevisao, setOrcamentoNovaRevisao] = useState(null);
  const [motivoNovaRevisao, setMotivoNovaRevisao] = useState('');
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cliente: '',
    endereco: '',
    data: ''
  });

  const [copyFormData, setCopyFormData] = useState({
    nome: '',
    descricao: '',
    cliente: '',
    endereco: '',
    data: ''
  });

  useEffect(() => {
    if (currentUser && empresaId) {
      fetchOrcamentos();
    }
    // Carrega apenas quando o usuário/empresa muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, empresaId]);

  const fetchOrcamentos = async () => {
    try {
      if (!currentUser || !empresaId) return;
      setError('');
      const q = query(
        collection(db, 'orcamentos'), 
        where('empresaId', '==', empresaId)
      );
      const querySnapshot = await getDocs(q);
      const orcamentosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      orcamentosData.sort((a, b) => {
        const aTime = (a.createdAt && a.createdAt.seconds) ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime()/1000 : 0);
        const bTime = (b.createdAt && b.createdAt.seconds) ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime()/1000 : 0);
        return bTime - aTime;
      });
      setOrcamentos(orcamentosData);
    } catch (error) {
      setError('Erro ao carregar orçamentos');
      console.error(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!podeEditar) {
      setError('Você não tem permissão para criar ou editar orçamentos.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (editingOrcamento) {
        // EDITAR: Preservar todos os dados existentes e atualizar apenas os campos editados
        console.log('Editando orçamento existente:', editingOrcamento.id);
        
        const dadosAtualizados = {
          nome: formData.nome,
          descricao: formData.descricao,
          cliente: formData.cliente,
          endereco: formData.endereco,
          data: formData.data,
          // Preservar todos os outros campos existentes
          updatedAt: new Date()
        };
        
        console.log('Dados a serem atualizados:', dadosAtualizados);
        await updateDoc(doc(db, 'orcamentos', editingOrcamento.id), dadosAtualizados);
        console.log('Orçamento atualizado com sucesso');
        
      } else {
        // NOVO: Criar orçamento com dados básicos (revisão 00)
        const obraId = `obra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const orcamentoData = {
          ...formData,
          composicoes: [],
          pacotes: [],
          userId: currentUser.uid,
          empresaId,
          createdAt: new Date(),
          valorTotal: 0,
          status: 'Em Execução',
          obraId,
          revisao: 0,
          revisaoTravada: false,
          motivoRevisao: MOTIVO_REVISAO_INICIAL
        };

        await addDoc(collection(db, 'orcamentos'), orcamentoData);
      }

      setShowModal(false);
      setEditingOrcamento(null);
      resetForm();
      fetchOrcamentos();
    } catch (error) {
      setError('Erro ao salvar orçamento: ' + error.message);
      console.error('Erro detalhado:', error);
    }

    setLoading(false);
  };

  const handleEdit = (orcamento) => {
    setEditingOrcamento(orcamento);
    setFormData({
      nome: orcamento.nome,
      descricao: orcamento.descricao,
      cliente: orcamento.cliente,
      endereco: orcamento.endereco,
      data: orcamento.data
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!podeEditar) return;
    if (window.confirm('Tem certeza que deseja excluir este orçamento?')) {
      try {
        await deleteDoc(doc(db, 'orcamentos', id));
        fetchOrcamentos();
      } catch (error) {
        setError('Erro ao excluir orçamento');
        console.error(error);
      }
    }
  };

  const handleViewEAP = (orcamento) => {
    navigate(`/orcamentos/${orcamento.id}/eap`);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      cliente: '',
      endereco: '',
      data: new Date().toISOString().split('T')[0]
    });
  };

  const resetCopyForm = () => {
    setCopyFormData({
      nome: '',
      descricao: '',
      cliente: '',
      endereco: '',
      data: ''
    });
  };

  const handleCopyOrcamento = (orcamento) => {
    setOrcamentoParaCopiar(orcamento);
    setCopyFormData({
      nome: `${orcamento.nome} - Cópia`,
      descricao: orcamento.descricao || '',
      cliente: orcamento.cliente || '',
      endereco: orcamento.endereco || '',
      data: new Date().toISOString().split('T')[0]
    });
    setShowCopyModal(true);
  };

  const abrirNovaRevisaoModal = (orcamento) => {
    if (!podeEditar || orcamento.revisaoTravada) return;
    setOrcamentoNovaRevisao(orcamento);
    setMotivoNovaRevisao('');
    setShowNovaRevisaoModal(true);
  };

  const confirmarNovaRevisao = async () => {
    const orcamento = orcamentoNovaRevisao;
    if (!orcamento || !podeEditar) return;
    const motivo = motivoNovaRevisao.trim();
    if (!motivo) {
      setError('Informe o motivo da nova revisão.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const obraId = getObraId(orcamento);
      const revisaoAtual = getRevisao(orcamento);

      const mesmaObra = orcamentos.filter((o) => getObraId(o) === obraId);
      const maxRev = mesmaObra.reduce((max, o) => Math.max(max, getRevisao(o)), revisaoAtual);
      const novaRevisao = maxRev + 1;

      const eapCopiada = copiarEAPCompleta(orcamento.pacotes || [], orcamento.composicoes || []);

      await updateDoc(doc(db, 'orcamentos', orcamento.id), {
        revisaoTravada: true,
        obraId,
        revisao: revisaoAtual,
        status: 'Obsoleto',
        statusAntesObsoleto: orcamento.status !== 'Obsoleto' ? orcamento.status : (orcamento.statusAntesObsoleto || 'Em Execução'),
        updatedAt: new Date()
      });

      const novoOrcamento = {
        nome: orcamento.nome,
        descricao: orcamento.descricao || '',
        cliente: orcamento.cliente || '',
        endereco: orcamento.endereco || '',
        data: orcamento.data || new Date().toISOString().split('T')[0],
        userId: currentUser.uid,
        empresaId,
        createdAt: new Date(),
        valorTotal: orcamento.valorTotal || 0,
        totaisPorCategoria: orcamento.totaisPorCategoria || null,
        status: 'Em Execução',
        obraId,
        revisao: novaRevisao,
        revisaoTravada: false,
        revisaoOrigemId: orcamento.id,
        motivoRevisao: motivo,
        pacotes: eapCopiada.pacotes,
        composicoes: eapCopiada.composicoes,
        bdiConfig: orcamento.bdiConfig ? { ...orcamento.bdiConfig } : null,
        ultimaAtualizacaoEAP: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'orcamentos'), novoOrcamento);
      setShowNovaRevisaoModal(false);
      setOrcamentoNovaRevisao(null);
      setMotivoNovaRevisao('');
      await fetchOrcamentos();
      navigate(`/orcamentos/${docRef.id}/eap`);
    } catch (error) {
      setError('Erro ao criar nova revisão: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const abrirHistoricoRevisoes = (orcamento) => {
    setHistoricoRef(orcamento);
    setHistoricoEditId(null);
    setHistoricoEditTexto('');
    setShowHistoricoModal(true);
  };

  const iniciarEdicaoMotivo = (rev) => {
    if (getRevisao(rev) === 0) return;
    setHistoricoEditId(rev.id);
    setHistoricoEditTexto((rev.motivoRevisao || '').trim());
  };

  const salvarMotivoRevisao = async () => {
    if (!historicoEditId || !podeEditar) return;
    const texto = historicoEditTexto.trim();
    if (!texto) {
      setError('O motivo da revisão não pode ficar vazio.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateDoc(doc(db, 'orcamentos', historicoEditId), {
        motivoRevisao: texto,
        updatedAt: new Date()
      });
      await fetchOrcamentos();
      setHistoricoEditId(null);
      setHistoricoEditTexto('');
    } catch (err) {
      setError('Erro ao salvar motivo da revisão');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNovaRevisao = (orcamento) => {
    abrirNovaRevisaoModal(orcamento);
  };

  const handleSubmitCopy = async (e) => {
    e.preventDefault();
    if (!podeEditar) return;
    setLoading(true);
    setError('');

    try {
      const orcamentoOriginal = orcamentos.find(o => o.id === orcamentoParaCopiar.id);
      
      if (!orcamentoOriginal) {
        throw new Error('Orçamento original não encontrado');
      }

      const eapCopiada = copiarEAPCompleta(orcamentoOriginal.pacotes, orcamentoOriginal.composicoes);
      const obraId = `obra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const novoOrcamento = {
        ...copyFormData,
        userId: currentUser.uid,
        empresaId,
        createdAt: new Date(),
        valorTotal: orcamentoOriginal.valorTotal || 0,
        totaisPorCategoria: orcamentoOriginal.totaisPorCategoria || null,
        status: 'Em Execução',
        obraId,
        revisao: 0,
        revisaoTravada: false,
        motivoRevisao: MOTIVO_REVISAO_INICIAL,
        pacotes: eapCopiada.pacotes,
        composicoes: eapCopiada.composicoes,
        bdiConfig: orcamentoOriginal.bdiConfig ? { ...orcamentoOriginal.bdiConfig } : null
      };

      const docRef = await addDoc(collection(db, 'orcamentos'), novoOrcamento);

      if (eapCopiada.pacotes.length > 0) {
        await updateDoc(doc(db, 'orcamentos', docRef.id), {
          ultimaAtualizacaoEAP: new Date().toISOString()
        });
      }

      setShowCopyModal(false);
      setOrcamentoParaCopiar(null);
      resetCopyForm();
      fetchOrcamentos();
      navigate(`/orcamentos/${docRef.id}/eap`);
      
    } catch (error) {
      setError('Erro ao copiar orçamento: ' + error.message);
      console.error('Erro detalhado:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArquivarObsoleto = async (orcamento) => {
    if (!podeEditar || orcamento.revisaoTravada) return;
    const ok = window.confirm(
      `Arquivar Rev. ${formatRevisao(getRevisao(orcamento))} de "${orcamento.nome}"?\n\n` +
        'O orçamento irá para obsoletos (somente leitura) com status Obsoleto.'
    );
    if (!ok) return;
    setLoading(true);
    setError('');
    try {
      await updateDoc(doc(db, 'orcamentos', orcamento.id), {
        revisaoTravada: true,
        status: 'Obsoleto',
        statusAntesObsoleto: orcamento.status !== 'Obsoleto' ? orcamento.status : (orcamento.statusAntesObsoleto || 'Em Execução'),
        updatedAt: new Date()
      });
      await fetchOrcamentos();
    } catch (err) {
      setError('Erro ao arquivar orçamento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarObsoleto = async (orcamento) => {
    if (!podeEditar || !orcamento.revisaoTravada) return;
    const ok = window.confirm(
      `Restaurar Rev. ${formatRevisao(getRevisao(orcamento))} de "${orcamento.nome}"?\n\n` +
        'Ela voltará para a lista de orçamentos atuais e poderá ser editada novamente.'
    );
    if (!ok) return;
    setLoading(true);
    setError('');
    try {
      const statusRestaurado = orcamento.statusAntesObsoleto || 'Em Execução';
      await updateDoc(doc(db, 'orcamentos', orcamento.id), {
        revisaoTravada: false,
        status: statusRestaurado,
        statusAntesObsoleto: null,
        updatedAt: new Date()
      });
      await fetchOrcamentos();
      setMostrarObsoletos(false);
    } catch (err) {
      setError('Erro ao restaurar orçamento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const orcamentosAtuais = orcamentos.filter((o) => !o.revisaoTravada);
  const orcamentosObsoletos = orcamentos.filter((o) => !!o.revisaoTravada);
  const listaBase = mostrarObsoletos ? orcamentosObsoletos : orcamentosAtuais;

  const filteredOrcamentos = listaBase.filter((orcamento) =>
    (orcamento.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (orcamento.cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (orcamento.descricao || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    const colors = {
      'Em Análise': 'warning',
      'Aprovado': 'success',
      'Rejeitado': 'danger',
      'Em Execução': 'info',
      'Concluído': 'primary',
      'Obsoleto': 'secondary'
    };
    return colors[status] || 'secondary';
  };

  const formatarData = (data) => {
    if (!data) return '';
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR');
  };

  const formatarUltimaAtualizacao = (ultimaAtualizacaoEAP) => {
    if (!ultimaAtualizacaoEAP) return 'Nunca atualizado';
    
    const data = new Date(ultimaAtualizacaoEAP);
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

  const calcularValorTotalComBDI = (orcamento) => {
    if (!orcamento.valorTotal || orcamento.valorTotal === 0) return 0;
    return calcularValorComBdi(orcamento.valorTotal, orcamento.bdiConfig);
  };

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
  };

  const epochFromValue = (value) => {
    if (!value) return 0;
    if (typeof value === 'object' && value.seconds) return value.seconds * 1000;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const getSortValue = (orcamento, key) => {
    switch (key) {
      case 'nome':
        return (orcamento.nome || '').toLowerCase();
      case 'cliente':
        return (orcamento.cliente || '').toLowerCase();
      case 'data':
        return epochFromValue(orcamento.data);
      case 'ultimaAtualizacao':
        return epochFromValue(orcamento.ultimaAtualizacaoEAP);
      case 'valorBase':
        return orcamento.valorTotal || 0;
      case 'valorTotal':
        return calcularValorTotalComBDI(orcamento);
      case 'status':
        return (orcamento.status || '').toLowerCase();
      case 'revisao':
        return getRevisao(orcamento);
      default:
        return '';
    }
  };

  const sortedOrcamentos = (() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredOrcamentos;
    const list = [...filteredOrcamentos];
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

  return (
    <div className="page-lista">
      <div className="page-lista-toolbar d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1><FaFileInvoiceDollar className="me-2" />Orçamentos</h1>
          <p className="text-muted mb-0">Crie e gerencie orçamentos para seus projetos</p>
        </div>
        <div className="d-flex gap-2">
          {!mostrarObsoletos && podeEditar && (
            <Button onClick={() => setShowModal(true)} variant="primary">
              <FaPlus className="me-2" />
              Novo Orçamento
            </Button>
          )}
          <Button
            variant={mostrarObsoletos ? 'primary' : 'outline-secondary'}
            onClick={() => {
              setMostrarObsoletos((v) => !v);
              setSearchTerm('');
              setSortConfig({ key: null, direction: null });
            }}
            title={mostrarObsoletos ? 'Voltar às revisões atuais' : 'Ver revisões anteriores (travadas)'}
          >
            {mostrarObsoletos ? (
              <><FaList className="me-2" />Atuais</>
            ) : (
              <>
                <FaArchive className="me-2" />
                Obsoletos
                {orcamentosObsoletos.length > 0 && (
                  <Badge bg="secondary" className="ms-2">{orcamentosObsoletos.length}</Badge>
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {!podeEditar && (
        <Alert variant="secondary">
          Você está em modo somente leitura. Peça ao administrador a permissão de colaborador para criar, editar ou excluir.
        </Alert>
      )}

      {mostrarObsoletos && (
        <Alert variant="info" className="mb-3">
          Revisões anteriores (travadas). Somente leitura — a revisão atual de cada projeto aparece na lista principal.
        </Alert>
      )}

      <Card className="lista-card">
        <Card.Header>
          <Row className="align-items-center">
            <Col>
              <h5 className="mb-0">
                {mostrarObsoletos ? 'Revisões obsoletas' : 'Lista de Orçamentos'}
              </h5>
            </Col>
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder={mostrarObsoletos ? 'Buscar obsoletos...' : 'Buscar orçamentos...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body>
          {filteredOrcamentos.length === 0 ? (
            <div className="text-center py-4">
              {mostrarObsoletos ? (
                <>
                  <FaArchive size={48} className="text-muted mb-3" />
                  <p className="text-muted mb-0">Nenhuma revisão obsoleta encontrada</p>
                  <p className="text-muted small">
                    Ao criar uma nova revisão ou arquivar manualmente, a revisão anterior aparece aqui.
                    Use o botão de restaurar para editá-la novamente.
                  </p>
                </>
              ) : (
                <>
                  <FaFileInvoiceDollar size={48} className="text-muted mb-3" />
                  <p className="text-muted">Nenhum orçamento encontrado</p>
                  <Button onClick={() => setShowModal(true)} variant="outline-primary">
                    Criar Primeiro Orçamento
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <SortableTh columnKey="nome">Nome</SortableTh>
                  <SortableTh columnKey="revisao">Rev.</SortableTh>
                  <SortableTh columnKey="cliente">Cliente</SortableTh>
                  <SortableTh columnKey="data">Data</SortableTh>
                  <SortableTh columnKey="ultimaAtualizacao">Última atualização</SortableTh>
                  <SortableTh columnKey="valorBase">Valor s/ BDI</SortableTh>
                  <SortableTh columnKey="valorTotal">Valor c/ BDI</SortableTh>
                  <SortableTh columnKey="status">Status</SortableTh>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrcamentos.map((orcamento) => (
                  <tr key={orcamento.id}>
                    <td>
                      <strong>{orcamento.nome}</strong>
                      {orcamento.revisaoTravada && (
                        <div><small className="text-muted">Obsoleto (somente leitura)</small></div>
                      )}
                    </td>
                    <td>
                      <Badge bg={orcamento.revisaoTravada ? 'secondary' : 'primary'}>
                        {formatRevisao(getRevisao(orcamento))}
                      </Badge>
                    </td>
                    <td>{orcamento.cliente}</td>
                    <td>{formatarData(orcamento.data)}</td>
                    <td>{formatarUltimaAtualizacao(orcamento.ultimaAtualizacaoEAP)}</td>
                    <td className="fw-semibold" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatCurrency(orcamento.valorTotal || 0)}
                    </td>
                    <td className="fw-bold" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatCurrency(calcularValorTotalComBDI(orcamento))}
                    </td>
                    <td>
                      <Badge bg={getStatusColor(orcamento.status)}>
                        {orcamento.status}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-info"
                        className="me-2"
                        onClick={() => handleViewEAP(orcamento)}
                        title="Ver EAP"
                      >
                        <FaEye />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-dark"
                        className="me-2"
                        onClick={() => abrirHistoricoRevisoes(orcamento)}
                        title="Histórico de revisões"
                      >
                        <FaHistory />
                      </Button>
                      {podeEditar && orcamento.revisaoTravada && (
                        <Button
                          size="sm"
                          variant="outline-success"
                          className="me-2"
                          onClick={() => handleRestaurarObsoleto(orcamento)}
                          disabled={loading}
                          title="Restaurar para orçamentos atuais"
                        >
                          <FaUndo />
                        </Button>
                      )}
                      {podeEditar && !orcamento.revisaoTravada && (
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className="me-2"
                          onClick={() => handleArquivarObsoleto(orcamento)}
                          disabled={loading}
                          title="Arquivar (mover para obsoletos)"
                        >
                          <FaArchive />
                        </Button>
                      )}
                      {podeEditar && !orcamento.revisaoTravada && (
                        <Button
                          size="sm"
                          variant="outline-success"
                          className="me-2"
                          onClick={() => handleNovaRevisao(orcamento)}
                          disabled={loading}
                          title="Nova revisão"
                        >
                          <FaCodeBranch />
                        </Button>
                      )}
                      {podeEditar && (
                        <Button
                          size="sm"
                          variant="outline-warning"
                          className="me-2"
                          onClick={() => handleCopyOrcamento(orcamento)}
                          title="Copiar Orçamento"
                        >
                          <FaCopy />
                        </Button>
                      )}
                      {podeEditar && !orcamento.revisaoTravada && (
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="me-2"
                          onClick={() => handleEdit(orcamento)}
                          title="Editar"
                        >
                          <FaEdit />
                        </Button>
                      )}
                      {podeEditar && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleDelete(orcamento.id)}
                          title="Excluir"
                        >
                          <FaTrash />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Modal para Adicionar/Editar Orçamento */}
      <Modal show={showModal} onHide={() => {
        setShowModal(false);
        setEditingOrcamento(null);
        resetForm();
      }}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingOrcamento ? 'Editar Orçamento' : 'Novo Orçamento'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome do Projeto *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Cliente *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.cliente}
                    onChange={(e) => setFormData({...formData, cliente: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Endereço</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.endereco}
                    onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Data *</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({...formData, data: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrição do Projeto</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowModal(false);
              setEditingOrcamento(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Salvando...' : (editingOrcamento ? 'Atualizar' : 'Salvar')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal para Copiar Orçamento */}
      <Modal show={showCopyModal} onHide={() => {
        setShowCopyModal(false);
        setOrcamentoParaCopiar(null);
        resetCopyForm();
      }}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCopy className="me-2" />
            Copiar Orçamento
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitCopy}>
          <Modal.Body>
            {orcamentoParaCopiar && (
              <Alert variant="info" className="mb-3">
                <strong>Copiando:</strong> {orcamentoParaCopiar.nome}
                {orcamentoParaCopiar.pacotes && orcamentoParaCopiar.pacotes.length > 0 && (
                  <div className="mt-1">
                    <small>
                      Este orçamento possui EAP com {orcamentoParaCopiar.pacotes.length} pacote(s) que serão copiados.
                      {(() => {
                        const totalComposicoes = (orcamentoParaCopiar.composicoes || []).length;
                        return totalComposicoes > 0 ? ` Total de ${totalComposicoes} composição(ões) incluídas.` : '';
                      })()}
                    </small>
                  </div>
                )}
              </Alert>
            )}
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome do Projeto *</Form.Label>
                  <Form.Control
                    type="text"
                    value={copyFormData.nome}
                    onChange={(e) => setCopyFormData({...copyFormData, nome: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Cliente *</Form.Label>
                  <Form.Control
                    type="text"
                    value={copyFormData.cliente}
                    onChange={(e) => setCopyFormData({...copyFormData, cliente: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Endereço</Form.Label>
                  <Form.Control
                    type="text"
                    value={copyFormData.endereco}
                    onChange={(e) => setCopyFormData({...copyFormData, endereco: e.target.value})}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Data *</Form.Label>
                  <Form.Control
                    type="date"
                    value={copyFormData.data}
                    onChange={(e) => setCopyFormData({...copyFormData, data: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrição do Projeto</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={copyFormData.descricao}
                onChange={(e) => setCopyFormData({...copyFormData, descricao: e.target.value})}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowCopyModal(false);
              setOrcamentoParaCopiar(null);
              resetCopyForm();
            }}>
              Cancelar
            </Button>
            <Button type="submit" variant="warning" disabled={loading}>
              {loading ? 'Copiando...' : 'Copiar Orçamento'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showNovaRevisaoModal}
        onHide={() => {
          if (loading) return;
          setShowNovaRevisaoModal(false);
          setOrcamentoNovaRevisao(null);
          setMotivoNovaRevisao('');
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Nova revisão</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {orcamentoNovaRevisao && (
            <>
              <p className="text-muted small mb-3">
                A revisão atual (Rev. {formatRevisao(getRevisao(orcamentoNovaRevisao))}) será arquivada
                como obsoleta e uma nova revisão editável será criada com a mesma EAP.
              </p>
              <Form.Group>
                <Form.Label>Motivo da nova revisão *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  autoFocus
                  value={motivoNovaRevisao}
                  onChange={(e) => setMotivoNovaRevisao(e.target.value)}
                  placeholder="Ex.: Ajuste de quantitativos após visita técnica"
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => {
              setShowNovaRevisaoModal(false);
              setOrcamentoNovaRevisao(null);
              setMotivoNovaRevisao('');
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={loading || !motivoNovaRevisao.trim()}
            onClick={confirmarNovaRevisao}
          >
            {loading ? 'Criando...' : 'Criar revisão'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showHistoricoModal}
        onHide={() => {
          setShowHistoricoModal(false);
          setHistoricoRef(null);
          setHistoricoEditId(null);
          setHistoricoEditTexto('');
        }}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaHistory className="me-2" />
            Histórico de revisões
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {historicoRef && (
            <>
              <p className="mb-3">
                <strong>{historicoRef.nome}</strong>
                <span className="text-muted small ms-2">{historicoRef.cliente}</span>
              </p>
              <Table responsive hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Rev.</th>
                    <th>Motivo</th>
                    <th>Situação</th>
                    <th>Data</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listarRevisoesDaObra(orcamentos, historicoRef).map((rev) => {
                    const isInicial = getRevisao(rev) === 0;
                    const editando = historicoEditId === rev.id;
                    return (
                      <tr key={rev.id}>
                        <td>
                          <Badge bg={rev.revisaoTravada ? 'secondary' : 'primary'}>
                            {formatRevisao(getRevisao(rev))}
                          </Badge>
                        </td>
                        <td style={{ minWidth: 220 }}>
                          {editando ? (
                            <Form.Control
                              as="textarea"
                              rows={2}
                              size="sm"
                              value={historicoEditTexto}
                              onChange={(e) => setHistoricoEditTexto(e.target.value)}
                            />
                          ) : (
                            getMotivoRevisaoExibicao(rev)
                          )}
                        </td>
                        <td>
                          <Badge bg={rev.revisaoTravada ? 'secondary' : 'success'}>
                            {rev.revisaoTravada ? 'Obsoleto' : 'Atual'}
                          </Badge>
                        </td>
                        <td className="text-nowrap">{formatarData(rev.data)}</td>
                        <td className="text-nowrap">
                          <Button
                            size="sm"
                            variant="outline-info"
                            className="me-1"
                            onClick={() => {
                              setShowHistoricoModal(false);
                              handleViewEAP(rev);
                            }}
                            title="Abrir EAP"
                          >
                            <FaEye />
                          </Button>
                          {podeEditar && !isInicial && !editando && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => iniciarEdicaoMotivo(rev)}
                              title="Editar motivo"
                            >
                              <FaEdit />
                            </Button>
                          )}
                          {podeEditar && editando && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                className="me-1"
                                disabled={loading || !historicoEditTexto.trim()}
                                onClick={salvarMotivoRevisao}
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                disabled={loading}
                                onClick={() => {
                                  setHistoricoEditId(null);
                                  setHistoricoEditTexto('');
                                }}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowHistoricoModal(false);
              setHistoricoRef(null);
              setHistoricoEditId(null);
              setHistoricoEditTexto('');
            }}
          >
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Orcamentos;
