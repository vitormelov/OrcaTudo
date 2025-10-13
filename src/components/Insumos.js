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
import { FaPlus, FaEdit, FaTrash, FaSearch, FaBoxes } from 'react-icons/fa';

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
    nome: '',
    unidade: '',
    precoUnitario: '',
    categoria: '',
    data: new Date().toISOString().split('T')[0],
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

      const insumoData = {
        nome: formData.nome.trim(),
        categoria: formData.categoria,
        unidade: formData.unidade,
        precoUnitario: parseFloat(formData.precoUnitario),
        data: formData.data,
        empresa: formData.empresa,
        userId: currentUser.uid,
        createdAt: editingInsumo ? editingInsumo.createdAt : new Date()
      };

      if (editingInsumo) {
        // Atualizar insumo existente
        await updateDoc(doc(db, 'insumos', editingInsumo.id), insumoData);
        
        // Atualizar preço no histórico se mudou
        if (formData.precoUnitario !== editingInsumo.precoUnitario) {
          const novoPreco = {
            preco: parseFloat(formData.precoUnitario),
            data: formData.data,
            empresa: formData.empresa,
            createdAt: new Date()
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
          data: formData.data,
          empresa: formData.empresa,
          createdAt: new Date()
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
      nome: insumo.nome,
      unidade: insumo.unidade,
      precoUnitario: insumo.precoUnitario.toString(),
      categoria: insumo.categoria,
      data: insumo.data || new Date().toISOString().split('T')[0],
      empresa: insumo.empresa || ''
    });
    setShowModal(true);
  };

  // Função para atualizar composições que usam um insumo deletado
  const atualizarComposicoesSemInsumo = async (insumoId) => {
    try {
      const batch = writeBatch(db);
      let composicoesAtualizadas = 0;
      
      // Usar o estado local de composições
      composicoes.forEach(composicao => {
        // Verificar se a composição usa o insumo deletado
        if (composicao.insumos && Array.isArray(composicao.insumos)) {
          const insumoUsado = composicao.insumos.find(item => item.insumoId === insumoId);
          
          if (insumoUsado) {
            // Remover o insumo deletado da composição
            const novosInsumos = composicao.insumos.filter(item => item.insumoId !== insumoId);
            
            // Recalcular o valor total da composição
            let novoValorTotal = 0;
            novosInsumos.forEach(item => {
              const insumo = insumos.find(i => i.id === item.insumoId);
              if (insumo) {
                novoValorTotal += (parseFloat(item.quantidade) || 0) * (insumo.precoUnitario || 0);
              }
            });
            
            // Atualizar a composição
            batch.update(doc(db, 'composicoes', composicao.id), {
              insumos: novosInsumos,
              valorTotal: novoValorTotal
            });
            
            composicoesAtualizadas++;
          }
        }
      });
      
      // Executar as atualizações em lote
      if (composicoesAtualizadas > 0) {
        await batch.commit();
        console.log(`${composicoesAtualizadas} composições foram atualizadas após a deleção do insumo`);
        
        // Atualizar o estado local das composições
        setComposicoes(prev => prev.map(comp => {
          if (comp.insumos && Array.isArray(comp.insumos)) {
            const insumoUsado = comp.insumos.find(item => item.insumoId === insumoId);
            if (insumoUsado) {
              const novosInsumos = comp.insumos.filter(item => item.insumoId !== insumoId);
              let novoValorTotal = 0;
              novosInsumos.forEach(item => {
                const insumo = insumos.find(i => i.id === item.insumoId);
                if (insumo) {
                  novoValorTotal += (parseFloat(item.quantidade) || 0) * (insumo.precoUnitario || 0);
                }
              });
              return {
                ...comp,
                insumos: novosInsumos,
                valorTotal: novoValorTotal
              };
            }
          }
          return comp;
        }));
      }
      
    } catch (error) {
      console.error('Erro ao atualizar composições após deleção do insumo:', error);
    }
  };

  // Função para atualizar orçamentos que usam composições modificadas
  const atualizarOrcamentosComComposicoes = async () => {
    try {
      // Buscar todos os orçamentos do usuário
      const orcamentosRef = collection(db, 'orcamentos');
      const orcamentosSnapshot = await getDocs(orcamentosRef);
      
      const batch = writeBatch(db);
      let orcamentosAtualizados = 0;
      
      orcamentosSnapshot.docs.forEach(docSnap => {
        const orcamento = docSnap.data();
        
        // Verificar se o orçamento tem composições
        if (orcamento.composicoes && Array.isArray(orcamento.composicoes)) {
          let valorTotalAtualizado = 0;
          let composicoesModificadas = false;
          
          // Recalcular o valor total do orçamento baseado nas composições atualizadas
          orcamento.composicoes.forEach(composicao => {
            if (composicao.composicaoId) {
              // Buscar a composição atualizada no estado local
              const composicaoAtualizada = composicoes.find(c => c.id === composicao.composicaoId);
              if (composicaoAtualizada) {
                const valorComposicao = (composicaoAtualizada.valorTotal || 0) * (parseFloat(composicao.quantidade) || 1);
                valorTotalAtualizado += valorComposicao;
                composicoesModificadas = true;
              }
            }
          });
          
          // Atualizar o orçamento se necessário
          if (composicoesModificadas) {
            batch.update(doc(db, 'orcamentos', docSnap.id), {
              valorTotal: valorTotalAtualizado,
              ultimaAtualizacaoEAP: new Date().toISOString()
            });
            orcamentosAtualizados++;
          }
        }
      });
      
      // Executar as atualizações em lote
      if (orcamentosAtualizados > 0) {
        await batch.commit();
        console.log(`${orcamentosAtualizados} orçamentos foram atualizados após a deleção do insumo`);
      }
      
    } catch (error) {
      console.error('Erro ao atualizar orçamentos após deleção do insumo:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este insumo? Esta ação irá:\n\n• Remover o insumo de todas as composições que o utilizam\n• Recalcular os valores das composições afetadas\n• Atualizar os orçamentos que usam essas composições\n\nEsta ação não pode ser desfeita.')) {
      try {
        setLoading(true);
        setError('');
        
        // Primeiro, atualizar todas as composições que usam este insumo
        await atualizarComposicoesSemInsumo(id);
        
        // Depois, atualizar os orçamentos que usam essas composições
        await atualizarOrcamentosComComposicoes();
        
        // Deletar a subcoleção de preços primeiro
        const precosRef = collection(db, 'insumos', id, 'precos');
        const precosSnapshot = await getDocs(precosRef);
        
        // Deletar todos os documentos de preços
        const deletePromises = precosSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        // Deletar o insumo principal
        await deleteDoc(doc(db, 'insumos', id));
        
        // Atualizar a lista local
        setInsumos(prev => prev.filter(insumo => insumo.id !== id));
        
        // Limpar o insumo selecionado se for o mesmo que foi deletado
        if (editingInsumo && editingInsumo.id === id) {
          setEditingInsumo(null);
        }
        
        // Recarregar as composições para refletir as mudanças
        await fetchComposicoes();
        
        setError('');
        alert('Insumo deletado com sucesso! Todas as composições e orçamentos foram atualizados automaticamente.');
      } catch (error) {
        setError('Erro ao excluir insumo');
        console.error('Erro ao excluir insumo:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      unidade: '',
      precoUnitario: '',
      categoria: '',
      data: new Date().toISOString().split('T')[0],
      empresa: ''
    });
  };

  const filteredInsumos = insumos.filter(insumo =>
    (insumo.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (insumo.categoria || '').toLowerCase().includes(searchTerm.toLowerCase())
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
        <Button onClick={() => setShowModal(true)} variant="primary">
          <FaPlus className="me-2" />
          Novo Insumo
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Header>
          <Row className="align-items-center">
            <Col>
              <h5 className="mb-0">Lista de Insumos</h5>
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
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Unidade</th>
                  <th>Preço Unitário</th>
                  <th>Empresa</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInsumos.map((insumo) => (
                  <tr key={insumo.id} onClick={() => abrirHistorico(insumo)} style={{cursor: 'pointer'}}>
                    <td><strong>{insumo.nome}</strong></td>
                    <td>
                      <Badge bg={getCategoriaColor(insumo.categoria)}>
                        {insumo.categoria}
                      </Badge>
                    </td>
                    <td>{insumo.unidade}</td>
                    <td>R$ {insumo.precoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>{insumo.empresa || '-'}</td>
                    <td>{formatDateBR(insumo.data)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        onClick={(e) => { e.stopPropagation(); handleEdit(insumo); }}
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={(e) => { e.stopPropagation(); handleDelete(insumo.id); }}
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

      {/* Modal para Adicionar/Editar Insumo */}
      <Modal show={showModal} onHide={() => {
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
            <Row>
              <Col md={6}>
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
              <Col md={6}>
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
            </Row>
            
            <Row>
              <Col md={6}>
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
              <Col md={6}>
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

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Empresa</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Data *</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
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
