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
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFileInvoiceDollar, FaEye } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

function Orcamentos() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [orcamentos, setOrcamentos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingOrcamento, setEditingOrcamento] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
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
      const orcamentoData = {
        ...formData,
        composicoes: [],
        userId: currentUser.uid,
        createdAt: new Date(),
        valorTotal: 0,
        status: 'Em Análise'
      };

      if (editingOrcamento) {
        await updateDoc(doc(db, 'orcamentos', editingOrcamento.id), orcamentoData);
      } else {
        await addDoc(collection(db, 'orcamentos'), orcamentoData);
      }

      setShowModal(false);
      setEditingOrcamento(null);
      resetForm();
      fetchOrcamentos();
    } catch (error) {
      setError('Erro ao salvar orçamento');
      console.error(error);
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

  const filteredOrcamentos = orcamentos.filter(orcamento =>
    orcamento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    orcamento.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    orcamento.descricao.toLowerCase().includes(searchTerm.toLowerCase())
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
        <Button onClick={() => setShowModal(true)} variant="primary">
          <FaPlus className="me-2" />
          Novo Orçamento
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Header>
          <Row className="align-items-center">
            <Col>
              <h5 className="mb-0">Lista de Orçamentos</h5>
            </Col>
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Buscar orçamentos..."
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
              <FaFileInvoiceDollar size={48} className="text-muted mb-3" />
              <p className="text-muted">Nenhum orçamento encontrado</p>
              <Button onClick={() => setShowModal(true)} variant="outline-primary">
                Criar Primeiro Orçamento
              </Button>
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Última atualização</th>
                  <th>Valor Total (c/ BDI)</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrcamentos.map((orcamento) => (
                  <tr key={orcamento.id}>
                    <td><strong>{orcamento.nome}</strong></td>
                    <td>{orcamento.cliente}</td>
                    <td>{formatarData(orcamento.data)}</td>
                    <td>{formatarUltimaAtualizacao(orcamento.ultimaAtualizacaoEAP)}</td>
                    <td>
                      {(() => {
                        const valorFormatado = formatarValorComBDI(orcamento);
                        if (typeof valorFormatado === 'string') {
                          return <div className="fw-bold">{valorFormatado}</div>;
                        }
                        return (
                          <div>
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
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        onClick={() => handleEdit(orcamento)}
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDelete(orcamento.id)}
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
    </div>
  );
}

export default Orcamentos;
