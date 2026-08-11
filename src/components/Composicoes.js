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
  ListGroup,
  Tabs,
  Tab,
  Spinner,
  Badge
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
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaLayerGroup, FaBoxes, FaDatabase, FaTimes, FaCheck } from 'react-icons/fa';

function Composicoes() {
  const { currentUser } = useAuth();
  const [composicoes, setComposicoes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingComposicao, setEditingComposicao] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('minhas');
  const [seinfraCatalog, setSeinfraCatalog] = useState([]);
  const [seinfraLoading, setSeinfraLoading] = useState(false);
  const [seinfraSearch, setSeinfraSearch] = useState('');
  const [seinfraError, setSeinfraError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSeinfraModal, setShowSeinfraModal] = useState(false);
  const [seinfraItem, setSeinfraItem] = useState(null);
  const [addingCodigo, setAddingCodigo] = useState(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    unidade: '',
    insumos: [] // {insumoId, quantidade}
  });

  const [novoInsumo, setNovoInsumo] = useState({
    insumoId: '',
    quantidade: ''
  });

  const [insumoSearchTerm, setInsumoSearchTerm] = useState('');
  const [showInsumoDropdown, setShowInsumoDropdown] = useState(false);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.position-relative')) {
        setShowInsumoDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      return insumosData;
    } catch (error) {
      console.error('Erro ao carregar insumos:', error);
      return [];
    }
  };

  const loadSeinfraCatalog = async () => {
    if (seinfraCatalog.length > 0 || seinfraLoading) return;
    setSeinfraLoading(true);
    setSeinfraError('');
    try {
      const response = await fetch('/composicoes/seinfra.json');
      if (!response.ok) throw new Error('Não foi possível carregar o catálogo SEINFRA de composições');
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

  const jaAdicionada = (codigo) =>
    composicoes.some(
      (c) => (c.codigo || '').toString().toLowerCase() === String(codigo).toLowerCase()
    );

  const abrirAdicionarSeinfra = (item) => {
    if (jaAdicionada(item.codigo)) {
      setError(`A composição "${item.codigo}" já está nas suas composições.`);
      setSuccessMessage('');
      return;
    }
    setSeinfraItem(item);
    setShowSeinfraModal(true);
    setError('');
  };

  const garantirInsumosSeinfra = async (itensSeinfra, insumosAtuais) => {
    const byCodigo = new Map(
      insumosAtuais
        .filter((i) => i.codigo)
        .map((i) => [String(i.codigo).toLowerCase(), i])
    );

    const hojeStr = new Date().toISOString().split('T')[0];
    const agora = new Date();
    const criados = [];
    const faltantes = [];

    for (const item of itensSeinfra) {
      const key = String(item.codigo).toLowerCase();
      if (!byCodigo.has(key)) {
        faltantes.push(item);
      }
    }

    // Criar insumos primeiro e preços depois.
    // As regras do Firestore usam get(pai) na subcoleção precos;
    // no mesmo batch o pai ainda não existe e a criação falha com permissions.
    const CHUNK = 400;
    for (let i = 0; i < faltantes.length; i += CHUNK) {
      const slice = faltantes.slice(i, i + CHUNK);
      const batchInsumos = writeBatch(db);
      const refs = [];

      slice.forEach((item) => {
        const insumoRef = doc(collection(db, 'insumos'));
        const data = {
          codigo: item.codigo,
          nome: item.nome,
          categoria: item.categoria || 'Material',
          unidade: item.unidade,
          precoUnitario: parseFloat(item.precoUnitario) || 0,
          data: hojeStr,
          empresa: 'SEINFRA',
          fonte: 'SEINFRA',
          userId: currentUser.uid,
          createdAt: agora,
          updatedAt: agora
        };
        batchInsumos.set(insumoRef, data);
        refs.push({ id: insumoRef.id, ...data });
      });

      await batchInsumos.commit();

      const batchPrecos = writeBatch(db);
      refs.forEach((r) => {
        const precoRef = doc(collection(db, 'insumos', r.id, 'precos'));
        batchPrecos.set(precoRef, {
          preco: r.precoUnitario,
          data: hojeStr,
          empresa: 'SEINFRA',
          createdAt: agora
        });
      });
      await batchPrecos.commit();

      refs.forEach((r) => {
        byCodigo.set(String(r.codigo).toLowerCase(), r);
        criados.push(r);
      });
    }

    return { byCodigo, criados };
  };

  const confirmarAdicionarSeinfra = async () => {
    if (!seinfraItem || !currentUser) return;
    setAddingCodigo(seinfraItem.codigo);
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const insumosAtuais = insumos.length ? insumos : await fetchInsumos();
      const { byCodigo, criados } = await garantirInsumosSeinfra(
        seinfraItem.insumos || [],
        insumosAtuais
      );

      const insumosComposicao = [];
      const faltou = [];

      (seinfraItem.insumos || []).forEach((item) => {
        const found = byCodigo.get(String(item.codigo).toLowerCase());
        if (!found) {
          faltou.push(item.codigo);
          return;
        }
        insumosComposicao.push({
          insumoId: found.id,
          quantidade: parseFloat(item.quantidade) || 0
        });
      });

      if (faltou.length) {
        throw new Error(`Não foi possível vincular os insumos: ${faltou.join(', ')}`);
      }

      const valorRecalc = insumosComposicao.reduce((sum, item) => {
        const byId = [...byCodigo.values()].find((i) => i.id === item.insumoId);
        return sum + (parseFloat(item.quantidade) || 0) * (byId?.precoUnitario || 0);
      }, 0);

      await addDoc(collection(db, 'composicoes'), {
        codigo: seinfraItem.codigo,
        nome: seinfraItem.nome,
        unidade: seinfraItem.unidade,
        insumos: insumosComposicao,
        insumoIds: insumosComposicao.map((i) => i.insumoId),
        valorTotal:
          typeof seinfraItem.valorTotal === 'number' && seinfraItem.valorTotal > 0
            ? seinfraItem.valorTotal
            : valorRecalc,
        empresa: 'SEINFRA',
        fonte: 'SEINFRA',
        userId: currentUser.uid,
        createdAt: new Date()
      });

      if (criados.length) {
        setInsumos((prev) =>
          [...prev, ...criados].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
        );
      }

      setShowSeinfraModal(false);
      setSeinfraItem(null);
      const msgExtras =
        criados.length > 0
          ? ` ${criados.length} insumo(s) SEINFRA também foram cadastrados.`
          : '';
      setSuccessMessage(`Composição "${seinfraItem.codigo}" adicionada.${msgExtras}`);
      await fetchComposicoes();
      await fetchInsumos();
    } catch (err) {
      console.error(err);
      setError(`Erro ao adicionar composição SEINFRA: ${err.message}`);
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
      // Validar código obrigatório
      if (!formData.codigo || !formData.codigo.trim()) {
        setError('O código da composição é obrigatório.');
        setLoading(false);
        return;
      }

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

      // Verificar se a composição tem pelo menos um insumo
      if (!formData.insumos || formData.insumos.length === 0) {
        setError('A composição deve ter pelo menos um insumo.');
        setLoading(false);
        return;
      }

      const composicaoData = {
        codigo: formData.codigo.trim(),
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
      codigo: composicao.codigo || '',
      nome: composicao.nome || '',
      unidade: composicao.unidade || '',
      insumos: normalizedInsumos
    });
    setShowModal(true);
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
    const visibleIds = filteredComposicoes.map((c) => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      setError('Selecione ao menos uma composição para excluir.');
      return;
    }

    const ok = window.confirm(
      `Tem certeza que deseja excluir ${selectedIds.length} composição(ões)?\n\nEsta ação não pode ser desfeita.`
    );
    if (!ok) return;

    try {
      setLoading(true);
      setError('');

      const CHUNK = 400;
      for (let i = 0; i < selectedIds.length; i += CHUNK) {
        const slice = selectedIds.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        slice.forEach((id) => batch.delete(doc(db, 'composicoes', id)));
        await batch.commit();
      }

      setComposicoes((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
      if (editingComposicao && selectedIds.includes(editingComposicao.id)) {
        setEditingComposicao(null);
      }
      setSuccessMessage(`${selectedIds.length} composição(ões) excluída(s) com sucesso.`);
      cancelarModoExclusao();
    } catch (error) {
      setError('Erro ao excluir composições');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nome: '',
      unidade: '',
      insumos: []
    });
    setNovoInsumo({
      insumoId: '',
      quantidade: ''
    });
    setInsumoSearchTerm('');
    setShowInsumoDropdown(false);
  };

  const adicionarInsumo = () => {
    if (!novoInsumo.insumoId || !novoInsumo.quantidade) {
      setError('Preencha todos os campos do insumo');
      return;
    }

    const insumo = insumos.find(i => i.id === novoInsumo.insumoId);
    if (!insumo) {
      setError('Selecione um insumo válido da lista');
      return;
    }

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
    setInsumoSearchTerm('');
    setError(''); // Limpar erro anterior
  };

  const selecionarInsumo = (insumo) => {
    setNovoInsumo({
      ...novoInsumo,
      insumoId: insumo.id
    });
    setInsumoSearchTerm(insumo.nome);
    setShowInsumoDropdown(false);
  };

  const removerInsumo = (index) => {
    const novosInsumos = formData.insumos.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      insumos: novosInsumos
    });
  };

  const calcularValorTotal = () => calcularValorTotalAtual(formData.insumos);

  const filteredComposicoes = composicoes.filter(composicao => {
    const termo = searchTerm.toLowerCase();
    return (
      (composicao.codigo || '').toString().toLowerCase().includes(termo) ||
      (composicao.nome || '').toLowerCase().includes(termo) ||
      (composicao.unidade || '').toLowerCase().includes(termo)
    );
  });

  const insumosFiltrados = insumos.filter(insumo => {
    const termo = insumoSearchTerm.toLowerCase();
    return (
      (insumo.codigo || '').toString().toLowerCase().includes(termo) ||
      insumo.nome.toLowerCase().includes(termo)
    );
  });

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1><FaLayerGroup className="me-2" />Composições</h1>
          <p className="text-muted">Crie composições combinando insumos para serviços específicos</p>
        </div>
        {activeTab === 'minhas' && (
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
                  Nova Composição
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
      {successMessage && <Alert variant="success" onClose={() => setSuccessMessage('')} dismissible>{successMessage}</Alert>}

      <Tabs activeKey={activeTab} onSelect={handleTabSelect} className="mb-3">
        <Tab eventKey="minhas" title="Minhas Composições">
          <Card>
            <Card.Header>
              <Row className="align-items-center">
                <Col>
                  <h5 className="mb-0">Lista de Composições</h5>
                  {deleteMode && (
                    <small className="text-danger">Selecione as composições que deseja excluir</small>
                  )}
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
                      {deleteMode && (
                        <th style={{ width: 40 }}>
                          <Form.Check
                            type="checkbox"
                            checked={
                              filteredComposicoes.length > 0 &&
                              filteredComposicoes.every((c) => selectedIds.includes(c.id))
                            }
                            onChange={toggleSelectAllVisible}
                            title="Selecionar todos visíveis"
                          />
                        </th>
                      )}
                      <th style={{width: '10%'}}>Código</th>
                      <th style={{width: '35%'}}>Nome</th>
                      <th style={{width: '15%'}}>Unidade</th>
                      <th style={{width: '15%'}}>Insumos</th>
                      <th style={{width: '15%'}}>Valor Total</th>
                      {!deleteMode && <th style={{width: '10%'}}>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComposicoes.map((composicao) => (
                      <tr
                        key={composicao.id}
                        onClick={() => {
                          if (deleteMode) toggleSelectId(composicao.id);
                        }}
                        style={{ cursor: deleteMode ? 'pointer' : undefined }}
                        className={selectedIds.includes(composicao.id) ? 'table-danger' : ''}
                      >
                        {deleteMode && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <Form.Check
                              type="checkbox"
                              checked={selectedIds.includes(composicao.id)}
                              onChange={() => toggleSelectId(composicao.id)}
                            />
                          </td>
                        )}
                        <td style={{width: '10%'}}>{composicao.codigo || '-'}</td>
                        <td style={{width: '35%'}}><strong>{composicao.nome}</strong></td>
                        <td style={{width: '15%'}}>{composicao.unidade}</td>
                        <td style={{width: '15%'}}>{composicao.insumos?.length || 0} insumos</td>
                        <td style={{width: '15%'}}>R$ {composicao.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</td>
                        {!deleteMode && (
                          <td style={{width: '10%'}}>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => handleEdit(composicao)}
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
                  <h5 className="mb-0">Composições SEINFRA</h5>
                  <small className="text-muted">
                    Busque e adicione composições da tabela oficial
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
                        <th>Insumos</th>
                        <th>Valor Geral</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSeinfra.map((item) => {
                        const adicionada = jaAdicionada(item.codigo);
                        return (
                          <tr key={item.codigo}>
                            <td>{item.codigo}</td>
                            <td><strong>{item.nome}</strong></td>
                            <td>{item.unidade}</td>
                            <td>{item.insumos?.length || 0}</td>
                            <td>
                              R$ {(item.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td>
                              {adicionada ? (
                                <Badge bg="success">Já adicionada</Badge>
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
            {/* Linha 1: Código + Unidade (conforme pedido) */}
            <Row>
              <Col md={4}>
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

            {/* Linha 2: Nome com mais espaço */}
            <Row>
              <Col md={12}>
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
                      <Form.Label>Insumo</Form.Label>
                      <div className="position-relative">
                        <Form.Control
                          type="text"
                          placeholder="Digite para buscar insumo..."
                          value={insumoSearchTerm}
                          onChange={(e) => {
                            setInsumoSearchTerm(e.target.value);
                            setShowInsumoDropdown(true);
                          }}
                          onFocus={() => setShowInsumoDropdown(true)}
                        />
                        {showInsumoDropdown && insumoSearchTerm && (
                          <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{zIndex: 1000, maxHeight: '200px', overflowY: 'auto'}}>
                            {insumosFiltrados.length > 0 ? (
                              insumosFiltrados.map(insumo => (
                                <div
                                  key={insumo.id}
                                  className="p-2 border-bottom"
                                  style={{
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                  onMouseDown={() => selecionarInsumo(insumo)}
                                >
                                  <div className="fw-bold">{insumo.nome}</div>
                                  <small className="text-muted">
                                    {insumo.unidade} - R$ {insumo.precoUnitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                  </small>
                                </div>
                              ))
                            ) : (
                              <div className="p-2 text-muted">Nenhum insumo encontrado</div>
                            )}
                          </div>
                        )}
                      </div>
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

      {/* Modal: confirmar adição SEINFRA */}
      <Modal show={showSeinfraModal} onHide={() => { setShowSeinfraModal(false); setSeinfraItem(null); }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Adicionar composição SEINFRA</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {seinfraItem && (
            <>
              <p className="mb-1"><strong>Código:</strong> {seinfraItem.codigo}</p>
              <p className="mb-1"><strong>Descrição:</strong> {seinfraItem.nome}</p>
              <p className="mb-1"><strong>Unidade:</strong> {seinfraItem.unidade}</p>
              <p className="mb-3">
                <strong>Valor Geral:</strong>{' '}
                R$ {(seinfraItem.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-muted small">
                Ao adicionar, os insumos desta composição que ainda não estiverem cadastrados
                serão criados automaticamente (empresa SEINFRA).
              </p>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                <Table size="sm" responsive>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Insumo</th>
                      <th>Cat.</th>
                      <th>Qtd</th>
                      <th>Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(seinfraItem.insumos || []).map((ins) => {
                      const existe = insumos.some(
                        (i) => (i.codigo || '').toString().toLowerCase() === String(ins.codigo).toLowerCase()
                      );
                      return (
                        <tr key={`${ins.codigo}-${ins.nome}`}>
                          <td>
                            {ins.codigo}{' '}
                            {!existe && <Badge bg="warning" text="dark">novo</Badge>}
                          </td>
                          <td>{ins.nome}</td>
                          <td>{ins.categoria}</td>
                          <td>{ins.quantidade}</td>
                          <td>
                            R$ {(ins.precoUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowSeinfraModal(false); setSeinfraItem(null); }}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={loading} onClick={confirmarAdicionarSeinfra}>
            {loading ? 'Adicionando...' : 'Adicionar às minhas composições'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Composicoes;
