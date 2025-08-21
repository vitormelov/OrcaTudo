import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Alert, 
  Row, 
  Col,
  ListGroup,
  Badge,
  InputGroup,
  Accordion
} from 'react-bootstrap';
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
  FaEdit
} from 'react-icons/fa';

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
  const [novaComposicao, setNovaComposicao] = useState({
    composicaoId: '',
    quantidade: '',
    custoUnitario: '',
    pacoteId: '',
    subgrupoId: ''
  });

  useEffect(() => {
    if (currentUser && orcamentoId) {
      fetchOrcamento();
      fetchComposicoes();
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
    if (!window.confirm('Tem certeza que deseja remover este subgrupo? Todas as composições serão movidas para "Sem Subgrupo".')) return;
    
    // Mover composições para "Sem Subgrupo"
    setOrcamento(prev => ({
      ...prev,
      composicoes: (prev.composicoes || []).map(c => 
        c.pacoteId === pacoteId && c.subgrupoId === subgrupoId 
          ? { ...c, subgrupoId: 'sem_subgrupo' }
          : c
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
    if (!novaComposicao.composicaoId || !novaComposicao.quantidade || !novaComposicao.custoUnitario || !novaComposicao.pacoteId) {
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
      subgrupoId: novaComposicao.subgrupoId || 'sem_subgrupo',
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

  const alterarPacoteDaComposicao = (tempId, novoPacoteId) => {
    if (!novoPacoteId) return; // Não permitir pacote vazio
    
    setOrcamento(prev => {
      const arr = [...(prev.composicoes || [])];
      const idx = arr.findIndex(c => c.tempId === tempId);
      if (idx === -1) return prev;
      
      arr[idx] = { ...arr[idx], pacoteId: novoPacoteId, subgrupoId: 'sem_subgrupo' };
      return { ...prev, composicoes: arr };
    });
  };

  const alterarSubgrupoDaComposicao = (tempId, novoSubgrupoId) => {
    setOrcamento(prev => {
      const arr = [...(prev.composicoes || [])];
      const idx = arr.findIndex(c => c.tempId === tempId);
      if (idx === -1) return prev;
      
      arr[idx] = { ...arr[idx], subgrupoId: novoSubgrupoId };
      return { ...prev, composicoes: arr };
    });
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

  const calcularValorTotal = () => {
    return (orcamento?.composicoes || []).reduce((total, composicao) => total + composicao.custoTotal, 0);
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

  const obterComposicoesDoPacote = (pacoteId) => {
    return (orcamento?.composicoes || [])
      .filter(c => c.pacoteId === pacoteId && !c.subgrupoId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  };

  const obterComposicoesDoSubgrupo = (pacoteId, subgrupoId) => {
    return (orcamento?.composicoes || [])
      .filter(c => c.pacoteId === pacoteId && c.subgrupoId === subgrupoId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  };

  const salvarEAP = async () => {
    setLoading(true);
    setError('');

    try {
      const composicoesSanitizadas = (orcamento.composicoes || []).map(({ tempId, ...rest }) => rest);
      const orcamentoData = {
        ...orcamento,
        composicoes: composicoesSanitizadas,
        valorTotal: calcularValorTotal()
      };

      await updateDoc(doc(db, 'orcamentos', orcamentoId), orcamentoData);
      setError('');
      alert('EAP salva com sucesso!');
    } catch (error) {
      setError('Erro ao salvar EAP');
      console.error(error);
    }

    setLoading(false);
  };

  if (!orcamento) {
    return <div>Carregando...</div>;
  }

  const todosPacotes = (orcamento.pacotes || []).sort((a, b) => a.ordem - b.ordem);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/orcamentos')}
            className="mb-2"
          >
            <FaArrowLeft className="me-2" />
            Voltar aos Orçamentos
          </Button>
          <h1><FaFolder className="me-2" />EAP - {orcamento.nome}</h1>
          <p className="text-muted">
            Cliente: {orcamento.cliente} | Data: {new Date(orcamento.data).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button onClick={() => setShowModalPacote(true)} variant="primary">
            <FaPlus className="me-2" />
            Criar Pacote
          </Button>
          <Button 
            onClick={() => setShowModalComposicao(true)} 
            variant="success"
            disabled={todosPacotes.length === 0}
            title={todosPacotes.length === 0 ? "Crie um pacote primeiro" : ""}
          >
            <FaLayerGroup className="me-2" />
            Adicionar Composição
          </Button>
          <Button onClick={salvarEAP} variant="warning" disabled={loading}>
            <FaSave className="me-2" />
            {loading ? 'Salvando...' : 'Salvar EAP'}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* EAP: Pacotes, Subgrupos e Composições */}
      <Card>
        <Card.Header>
          <FaFolder className="me-2" /> Estrutura Analítica do Projeto (EAP)
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
            <Accordion>
              {todosPacotes.map((pacote, pIdx) => {
                const itensSemSubgrupo = obterComposicoesDoPacote(pacote.id);
                const subgrupos = (pacote.subgrupos || []).sort((a, b) => a.ordem - b.ordem);
                
                return (
                  <Accordion.Item key={pacote.id} eventKey={pIdx.toString()}>
                    <Accordion.Header>
                      <div className="d-flex justify-content-between align-items-center w-100 me-3">
                        <span>
                          <strong>{pacote.nome}</strong>
                          <Badge bg="secondary" className="ms-2">
                            {subgrupos.length + (itensSemSubgrupo.length > 0 ? 1 : 0)} grupos
                          </Badge>
                        </span>
                        <span className="d-flex align-items-center" style={{gap: '8px'}}>
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
                          <strong>R$ {totalDoPacote(pacote.id).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                        </span>
                      </div>
                    </Accordion.Header>
                    <Accordion.Body>
                      {/* Botão para criar subgrupo */}
                      <div className="mb-3">
                        <Button 
                          size="sm" 
                          variant="outline-info"
                          onClick={() => {
                            setPacoteParaSubgrupo(pacote);
                            setShowModalSubgrupo(true);
                          }}
                        >
                          <FaPlus className="me-1" /> Criar Subgrupo
                        </Button>
                      </div>

                      {/* Composições sem subgrupo */}
                      {itensSemSubgrupo.length > 0 && (
                        <div className="mb-3">
                          <h6 className="text-muted mb-2">Sem Subgrupo</h6>
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndComps(pacote.id, itensSemSubgrupo)}>
                            <SortableContext items={itensSemSubgrupo.map(i => i.tempId)} strategy={verticalListSortingStrategy}>
                              <ListGroup>
                                {itensSemSubgrupo.map((comp) => (
                                  <SortableComp key={comp.tempId} id={comp.tempId}>
                                    <ListGroup.Item className="d-flex justify-content-between align-items-center">
                                      <div style={{width: '40%'}}>
                                        <strong>{comp.nome}</strong>
                                        <div className="text-muted" style={{fontSize: '0.85rem'}}>
                                          {comp.quantidade} {comp.unidade} × R$ {comp.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} = R$ {comp.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                      </div>
                                      <div className="d-flex align-items-center" style={{gap: '6px'}}>
                                        <Form.Select
                                          size="sm"
                                          value={comp.pacoteId}
                                          onChange={(e) => alterarPacoteDaComposicao(comp.tempId, e.target.value)}
                                          style={{width: '120px'}}
                                        >
                                          {todosPacotes.map(p => (
                                            <option key={p.id} value={p.id}>{p.nome}</option>
                                          ))}
                                        </Form.Select>
                                        <Form.Select
                                          size="sm"
                                          value={comp.subgrupoId || 'sem_subgrupo'}
                                          onChange={(e) => alterarSubgrupoDaComposicao(comp.tempId, e.target.value)}
                                          style={{width: '120px'}}
                                        >
                                          <option value="sem_subgrupo">Sem Subgrupo</option>
                                          {subgrupos.map(s => (
                                            <option key={s.id} value={s.id}>{s.nome}</option>
                                          ))}
                                        </Form.Select>
                                        <Button size="sm" variant="outline-danger" onClick={() => removerComposicao(comp.tempId)}>
                                          <FaTrash />
                                        </Button>
                                      </div>
                                    </ListGroup.Item>
                                  </SortableComp>
                                ))}
                              </ListGroup>
                            </SortableContext>
                          </DndContext>
                        </div>
                      )}

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
                                <strong className="text-info">
                                  R$ {totalDoSubgrupo(pacote.id, subgrupo.id).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </strong>
                              </div>
                            </div>
                            
                            {itens.length === 0 ? (
                              <div className="text-muted ms-3">Sem composições neste subgrupo.</div>
                            ) : (
                              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndComps(pacote.id, itens)}>
                                <SortableContext items={itens.map(i => i.tempId)} strategy={verticalListSortingStrategy}>
                                  <ListGroup>
                                    {itens.map((comp) => (
                                      <SortableComp key={comp.tempId} id={comp.tempId}>
                                        <ListGroup.Item className="d-flex justify-content-between align-items-center">
                                          <div style={{width: '40%'}}>
                                            <strong>{comp.nome}</strong>
                                            <div className="text-muted" style={{fontSize: '0.85rem'}}>
                                              {comp.quantidade} {comp.unidade} × R$ {comp.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} = R$ {comp.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                          </div>
                                          <div className="d-flex align-items-center" style={{gap: '6px'}}>
                                            <Form.Select
                                              size="sm"
                                              value={comp.pacoteId}
                                              onChange={(e) => alterarPacoteDaComposicao(comp.tempId, e.target.value)}
                                              style={{width: '120px'}}
                                            >
                                              {todosPacotes.map(p => (
                                                <option key={p.id} value={p.id}>{p.nome}</option>
                                              ))}
                                            </Form.Select>
                                            <Form.Select
                                              size="sm"
                                              value={comp.subgrupoId || 'sem_subgrupo'}
                                              onChange={(e) => alterarSubgrupoDaComposicao(comp.tempId, e.target.value)}
                                              style={{width: '120px'}}
                                            >
                                              <option value="sem_subgrupo">Sem Subgrupo</option>
                                              {subgrupos.map(s => (
                                                <option key={s.id} value={s.id}>{s.nome}</option>
                                              ))}
                                            </Form.Select>
                                            <Button size="sm" variant="outline-danger" onClick={() => removerComposicao(comp.tempId)}>
                                              <FaTrash />
                                            </Button>
                                          </div>
                                        </ListGroup.Item>
                                      </SortableComp>
                                    ))}
                                  </ListGroup>
                                </SortableContext>
                              </DndContext>
                            )}
                          </div>
                        );
                      })}
                    </Accordion.Body>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
          <div className="text-end mt-3">
            <h5>Valor Total: R$ {calcularValorTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h5>
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
            disabled={!novoSubgrupoNome.trim()}
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
            <Form.Label>Subgrupo (Opcional)</Form.Label>
            <Form.Select
              value={novaComposicao.subgrupoId}
              onChange={(e) => setNovaComposicao({...novaComposicao, subgrupoId: e.target.value})}
              disabled={!novaComposicao.pacoteId}
            >
              <option value="">Sem Subgrupo</option>
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
            disabled={!novaComposicao.composicaoId || !novaComposicao.quantidade || !novaComposicao.custoUnitario || !novaComposicao.pacoteId}
          >
            Adicionar Composição
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default OrcamentoEAP;
