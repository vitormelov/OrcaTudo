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
  InputGroup,
  ListGroup
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
import { FaPlus, FaEdit, FaTrash, FaSearch, FaLayerGroup, FaBoxes } from 'react-icons/fa';

function Composicoes() {
  const { currentUser } = useAuth();
  const [composicoes, setComposicoes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingComposicao, setEditingComposicao] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    nome: '',
    unidade: '',
    insumos: [] // {insumoId, quantidade}
  });

  const [novoInsumo, setNovoInsumo] = useState({
    insumoId: '',
    quantidade: ''
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

  useEffect(() => {
    if (currentUser) {
      fetchComposicoes();
      fetchInsumos();
    }
  }, [currentUser]);

  const fetchComposicoes = async () => {
    try {
      if (!currentUser) return;
      setError('');
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
      setError('Erro ao carregar composições');
      console.error(error);
    }
  };

  const fetchInsumos = async () => {
    try {
      if (!currentUser) return;
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
      console.error('Erro ao carregar insumos:', error);
    }
  };

  const getInsumoById = (id) => insumos.find(i => i.id === id);

  const calcularValorTotalAtual = (insumosArr) => {
    return (insumosArr || []).reduce((total, item) => {
      const i = getInsumoById(item.insumoId);
      const preco = i?.precoUnitario || 0;
      const qtd = parseFloat(item.quantidade) || 0;
      return total + preco * qtd;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Verificar se já existe uma composição com o mesmo nome
      const nomeNormalizado = formData.nome.trim().toLowerCase();
      const composicaoExistente = composicoes.find(composicao => 
        composicao.nome.toLowerCase() === nomeNormalizado && 
        composicao.id !== editingComposicao?.id
      );

      if (composicaoExistente) {
        setError('Já existe uma composição com este nome. Use um nome diferente.');
        setLoading(false);
        return;
      }

      const composicaoData = {
        nome: formData.nome.trim(),
        unidade: formData.unidade,
        insumos: formData.insumos || [],
        valorTotal: calcularValorTotal(),
        userId: currentUser.uid,
        createdAt: editingComposicao ? editingComposicao.createdAt : new Date()
      };

      if (editingComposicao) {
        await updateDoc(doc(db, 'composicoes', editingComposicao.id), composicaoData);
      } else {
        await addDoc(collection(db, 'composicoes'), composicaoData);
      }

      setShowModal(false);
      setEditingComposicao(null);
      resetForm();
      fetchComposicoes();
      setError('');
    } catch (error) {
      setError(`Erro ao salvar composição: ${error.message}`);
      console.error('Erro ao salvar composição:', error);
    }

    setLoading(false);
  };

  const handleEdit = (composicao) => {
    setEditingComposicao(composicao);
    const normalizedInsumos = (composicao.insumos || []).map(item => ({
      insumoId: item.insumoId || item.id || item.insumoIdRef || item?.insumoId, // fallback
      quantidade: item.quantidade ?? item.qtd ?? ''
    })).filter(i => i.insumoId);
    setFormData({
      nome: composicao.nome || '',
      unidade: composicao.unidade || '',
      insumos: normalizedInsumos
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta composição?')) {
      try {
        await deleteDoc(doc(db, 'composicoes', id));
        fetchComposicoes();
      } catch (error) {
        setError('Erro ao excluir composição');
        console.error(error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      unidade: '',
      insumos: []
    });
    setNovoInsumo({
      insumoId: '',
      quantidade: ''
    });
  };

  const adicionarInsumo = () => {
    if (!novoInsumo.insumoId || !novoInsumo.quantidade) {
      setError('Preencha todos os campos do insumo');
      return;
    }

    const insumo = insumos.find(i => i.id === novoInsumo.insumoId);
    if (!insumo) return;

    const insumoComposicao = {
      insumoId: novoInsumo.insumoId,
      quantidade: parseFloat(novoInsumo.quantidade)
    };

    setFormData({
      ...formData,
      insumos: [...formData.insumos, insumoComposicao]
    });

    setNovoInsumo({
      insumoId: '',
      quantidade: ''
    });
  };

  const removerInsumo = (index) => {
    const novosInsumos = formData.insumos.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      insumos: novosInsumos
    });
  };

  const calcularValorTotal = () => calcularValorTotalAtual(formData.insumos);

  const filteredComposicoes = composicoes.filter(composicao =>
    (composicao.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (composicao.unidade || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const valorTotalComposicao = (comp) => {
    // Se tiver estrutura nova
    if (Array.isArray(comp.insumos) && comp.insumos.length > 0 && comp.insumos[0].insumoId) {
      return calcularValorTotalAtual(comp.insumos);
    }
    // fallback para antigas
    if (typeof comp.valorTotal === 'number') return comp.valorTotal;
    if (Array.isArray(comp.insumos)) {
      const soma = comp.insumos.reduce((sum, i) => sum + (i.custoTotal || 0), 0);
      return soma;
    }
    return 0;
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1><FaLayerGroup className="me-2" />Composições</h1>
          <p className="text-muted">Crie composições combinando insumos para serviços específicos</p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          <FaPlus className="me-2" />
          Nova Composição
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Header>
          <Row className="align-items-center">
            <Col>
              <h5 className="mb-0">Lista de Composições</h5>
            </Col>
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Buscar composições..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body>
          {filteredComposicoes.length === 0 ? (
            <div className="text-center py-4">
              <FaLayerGroup size={48} className="text-muted mb-3" />
              <p className="text-muted">Nenhuma composição encontrada</p>
              <Button onClick={() => setShowModal(true)} variant="outline-primary">
                Criar Primeira Composição
              </Button>
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th style={{width: '40%'}}>Nome</th>
                  <th style={{width: '15%'}}>Unidade</th>
                  <th style={{width: '15%'}}>Insumos</th>
                  <th style={{width: '15%'}}>Valor Total</th>
                  <th style={{width: '15%'}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredComposicoes.map((composicao) => (
                  <tr key={composicao.id}>
                    <td style={{width: '40%'}}><strong>{composicao.nome}</strong></td>
                    <td style={{width: '15%'}}>{composicao.unidade}</td>
                    <td style={{width: '15%'}}>{composicao.insumos?.length || 0} insumos</td>
                    <td style={{width: '15%'}}>R$ {composicao.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</td>
                    <td style={{width: '15%'}}>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        onClick={() => handleEdit(composicao)}
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDelete(composicao.id)}
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

      {/* Modal para Adicionar/Editar Composição */}
      <Modal show={showModal} onHide={() => {
        setShowModal(false);
        setEditingComposicao(null);
        resetForm();
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingComposicao ? 'Editar Composição' : 'Nova Composição'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={8}>
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
            </Row>

            {/* Adicionar Insumo */}
            <Card className="mb-3">
              <Card.Header>
                <FaBoxes className="me-2" />
                Adicionar Insumo
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Insumo *</Form.Label>
                      <Form.Select
                        value={novoInsumo.insumoId}
                        onChange={(e) => setNovoInsumo({ ...novoInsumo, insumoId: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {insumos.map(insumo => (
                          <option key={insumo.id} value={insumo.id}>
                            {insumo.nome} ({insumo.unidade})
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Quantidade *</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        value={novoInsumo.quantidade}
                        onChange={(e) => setNovoInsumo({...novoInsumo, quantidade: e.target.value})}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Label>&nbsp;</Form.Label>
                    <Button 
                      onClick={adicionarInsumo} 
                      variant="outline-primary" 
                      className="w-100"
                      disabled={!novoInsumo.insumoId || !novoInsumo.quantidade}
                    >
                      <FaPlus />
                    </Button>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

                         {/* Lista de Insumos da Composição */}
             {formData.insumos.length > 0 && (
               <Card>
                 <Card.Header>
                   Insumos da Composição ({formData.insumos.length})
                 </Card.Header>
                 <Card.Body>
                   {(() => {
                     // Agrupar insumos por categoria
                     const categorias = ['Material', 'Mão de Obra', 'Equipamento', 'Serviço'];
                     const insumosPorCategoria = {};
                     let totalGeral = 0;
                     
                     categorias.forEach(cat => {
                       insumosPorCategoria[cat] = [];
                     });
                     
                     formData.insumos.forEach((item, index) => {
                       const i = getInsumoById(item.insumoId);
                       if (i) {
                         const categoria = i.categoria || 'Material';
                         if (insumosPorCategoria[categoria]) {
                           insumosPorCategoria[categoria].push({ ...item, index, insumo: i });
                         }
                       }
                     });
                     
                     return (
                       <>
                         {categorias.map(categoria => {
                           const insumosCategoria = insumosPorCategoria[categoria];
                           if (insumosCategoria.length === 0) return null;
                           
                           const subtotalCategoria = insumosCategoria.reduce((sum, item) => {
                             const preco = item.insumo?.precoUnitario || 0;
                             const total = (parseFloat(item.quantidade) || 0) * preco;
                             return sum + total;
                           }, 0);
                           
                           totalGeral += subtotalCategoria;
                           
                           return (
                             <div key={categoria} className="mb-3">
                               <h6 className="text-primary border-bottom pb-2">
                                 {categoria} - Subtotal: R$ {subtotalCategoria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                               </h6>
                               <ListGroup>
                                 {insumosCategoria.map((item) => {
                                   const preco = item.insumo?.precoUnitario || 0;
                                   const total = (parseFloat(item.quantidade) || 0) * preco;
                                   return (
                                     <ListGroup.Item key={item.index} className="d-flex justify-content-between align-items-center">
                                       <div>
                                         <strong>{item.insumo?.nome || item.insumoId}</strong>
                                         <br />
                                         <small className="text-muted">
                                           {item.quantidade} {item.insumo?.unidade || ''} × R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} = R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                         </small>
                                       </div>
                                       <Button
                                         size="sm"
                                         variant="outline-danger"
                                         onClick={() => removerInsumo(item.index)}
                                       >
                                         <FaTrash />
                                       </Button>
                                     </ListGroup.Item>
                                   );
                                 })}
                               </ListGroup>
                             </div>
                           );
                         })}
                         <div className="text-end mt-3 pt-3 border-top">
                           <h5 className="text-success">Valor Total: R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h5>
                         </div>
                       </>
                     );
                   })()}
                 </Card.Body>
               </Card>
             )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowModal(false);
              setEditingComposicao(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Salvando...' : (editingComposicao ? 'Atualizar' : 'Salvar')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

export default Composicoes;
