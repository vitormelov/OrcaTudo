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
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFileInvoiceDollar, FaEye, FaCopy, FaSort, FaSortUp, FaSortDown, FaCodeBranch, FaArchive, FaList } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { copiarEAPCompleta, formatRevisao, getObraId, getRevisao } from '../utils/eapCopy';

function Orcamentos() {
  const { currentUser } = useAuth();
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
    if (currentUser) {
      fetchOrcamentos();
    }
  }, [currentUser]);

  const fetchOrcamentos = async () => {
    try {
      if (!currentUser) return;
      setError('');
      const q = query(
        collection(db, 'orcamentos'), 
        where('userId', '==', currentUser.uid)
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
          createdAt: new Date(),
          valorTotal: 0,
          status: 'Em Análise',
          obraId,
          revisao: 0,
          revisaoTravada: false
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

  const handleNovaRevisao = async (orcamento) => {
    if (orcamento.revisaoTravada) {
      setError('Esta revisão já está travada. Abra a revisão mais recente do projeto.');
      return;
    }

    const ok = window.confirm(
      `Criar nova revisão a partir da Rev. ${formatRevisao(getRevisao(orcamento))}?\n\n` +
        'A revisão atual será travada (somente leitura) e uma nova revisão editável será criada com a mesma EAP.'
    );
    if (!ok) return;

    setLoading(true);
    setError('');
    try {
      const obraId = getObraId(orcamento);
      const revisaoAtual = getRevisao(orcamento);

      // Descobrir próxima revisão na família
      const mesmaObra = orcamentos.filter((o) => getObraId(o) === obraId);
      const maxRev = mesmaObra.reduce((max, o) => Math.max(max, getRevisao(o)), revisaoAtual);
      const novaRevisao = maxRev + 1;

      const eapCopiada = copiarEAPCompleta(orcamento.pacotes || [], orcamento.composicoes || []);

      // Travar revisão atual
      await updateDoc(doc(db, 'orcamentos', orcamento.id), {
        revisaoTravada: true,
        obraId,
        revisao: revisaoAtual,
        updatedAt: new Date()
      });

      const novoOrcamento = {
        nome: orcamento.nome,
        descricao: orcamento.descricao || '',
        cliente: orcamento.cliente || '',
        endereco: orcamento.endereco || '',
        data: orcamento.data || new Date().toISOString().split('T')[0],
        userId: currentUser.uid,
        createdAt: new Date(),
        valorTotal: orcamento.valorTotal || 0,
        totaisPorCategoria: orcamento.totaisPorCategoria || null,
        status: 'Em Análise',
        obraId,
        revisao: novaRevisao,
        revisaoTravada: false,
        revisaoOrigemId: orcamento.id,
        pacotes: eapCopiada.pacotes,
        composicoes: eapCopiada.composicoes,
        bdiConfig: orcamento.bdiConfig ? { ...orcamento.bdiConfig } : null,
        ultimaAtualizacaoEAP: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'orcamentos'), novoOrcamento);
      await fetchOrcamentos();
      navigate(`/orcamentos/${docRef.id}/eap`);
    } catch (error) {
      setError('Erro ao criar nova revisão: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCopy = async (e) => {
    e.preventDefault();
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
        createdAt: new Date(),
        valorTotal: orcamentoOriginal.valorTotal || 0,
        totaisPorCategoria: orcamentoOriginal.totaisPorCategoria || null,
        status: 'Em Análise',
        obraId,
        revisao: 0,
        revisaoTravada: false,
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
      'Concluído': 'primary'
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

  // Função para calcular o valor total com BDI aplicado
  const calcularValorTotalComBDI = (orcamento) => {
    if (!orcamento.valorTotal || orcamento.valorTotal === 0) return 0;
    
    // Se não há configuração de BDI, retorna o valor original
    if (!orcamento.bdiConfig) return orcamento.valorTotal;
    
    const { lucro, tributos, financeiro, garantias } = orcamento.bdiConfig;
    
    // Fórmula do BDI: (1 + lucro) × (1 + tributos) × (1 + financeiro) × (1 + garantias) - 1
    const bdi = (1 + lucro/100) * (1 + tributos/100) * (1 + financeiro/100) * (1 + garantias/100) - 1;
    
    // Valor total com BDI aplicado
    return orcamento.valorTotal * (1 + bdi);
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

  // Função para formatar o valor com informações do BDI
  const formatarValorComBDI = (orcamento) => {
    if (!orcamento.valorTotal || orcamento.valorTotal === 0) return 'R$ 0,00';
    
    const valorComBDI = calcularValorTotalComBDI(orcamento);
    
    if (!orcamento.bdiConfig) {
      return `R$ ${orcamento.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    
    const bdiPercentual = ((1 + orcamento.bdiConfig.lucro/100) * (1 + orcamento.bdiConfig.tributos/100) * (1 + orcamento.bdiConfig.financeiro/100) * (1 + orcamento.bdiConfig.garantias/100) - 1) * 100;
    
    return {
      valorComBDI: valorComBDI,
      valorBase: orcamento.valorTotal,
      bdiPercentual: bdiPercentual
    };
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1><FaFileInvoiceDollar className="me-2" />Orçamentos</h1>
          <p className="text-muted">Crie e gerencie orçamentos para seus projetos</p>
        </div>
        <div className="d-flex gap-2">
          {!mostrarObsoletos && (
            <>
              <Button onClick={() => setShowModal(true)} variant="primary">
                <FaPlus className="me-2" />
                Novo Orçamento
              </Button>
              <Button
                onClick={() => setShowCopyModal(true)}
                variant="warning"
                disabled={orcamentosAtuais.length === 0}
                title={orcamentosAtuais.length === 0 ? 'Não há orçamentos para copiar' : 'Copiar um orçamento existente'}
              >
                <FaCopy className="me-2" />
                Copiar Orçamento
              </Button>
            </>
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

      {mostrarObsoletos && (
        <Alert variant="info" className="mb-3">
          Revisões anteriores (travadas). Somente leitura — a revisão atual de cada projeto aparece na lista principal.
        </Alert>
      )}

      <Card>
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
                    Ao criar uma nova revisão, a anterior fica travada e aparece aqui.
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
                  <SortableTh columnKey="valorTotal">Valor Total (c/ BDI)</SortableTh>
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
                        <div><small className="text-muted">Revisão travada (somente leitura)</small></div>
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
                    <td>
                      {(() => {
                        const valorFormatado = formatarValorComBDI(orcamento);
                        const cats = orcamento.totaisPorCategoria;
                        return (
                          <div>
                            {typeof valorFormatado === 'string' ? (
                              <div className="fw-bold">{valorFormatado}</div>
                            ) : (
                              <>
                                <div className="fw-bold text-success">
                                  R$ {valorFormatado.valorComBDI.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                                <small className="text-muted">
                                  Base: R$ {valorFormatado.valorBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </small>
                                <br />
                                <small className="text-success">
                                  <span className="badge bg-success me-1">BDI</span>
                                  +{valorFormatado.bdiPercentual.toFixed(1)}%
                                </small>
                              </>
                            )}
                            {cats && (
                              <div className="small text-muted mt-1" style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>
                                <div>Mat: R$ {(cats.Material || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                <div>MO: R$ {(cats['Mão de Obra'] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                <div>Eq: R$ {(cats.Equipamento || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                <div>Serv: R$ {(cats.Serviço || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                      {!orcamento.revisaoTravada && (
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
                      <Button
                        size="sm"
                        variant="outline-warning"
                        className="me-2"
                        onClick={() => handleCopyOrcamento(orcamento)}
                        title="Copiar Orçamento"
                      >
                        <FaCopy />
                      </Button>
                      {!orcamento.revisaoTravada && (
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
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDelete(orcamento.id)}
                        title="Excluir"
                      >
                        <FaTrash />
                      </Button>
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
            {/* Seleção do orçamento para copiar */}
            {!orcamentoParaCopiar && (
              <Form.Group className="mb-3">
                <Form.Label>Selecione o orçamento para copiar *</Form.Label>
                <Form.Select
                  onChange={(e) => {
                    const orcamentoSelecionado = orcamentos.find(o => o.id === e.target.value);
                    if (orcamentoSelecionado) {
                      handleCopyOrcamento(orcamentoSelecionado);
                    }
                  }}
                  required
                >
                  <option value="">Escolha um orçamento...</option>
                  {orcamentosAtuais.map((orcamento) => (
                    <option key={orcamento.id} value={orcamento.id}>
                      {orcamento.nome} — Rev. {formatRevisao(getRevisao(orcamento))} — {orcamento.cliente}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            {/* Formulário de cópia */}
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
    </div>
  );
}

export default Orcamentos;
