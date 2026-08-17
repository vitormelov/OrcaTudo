import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Button, Alert, Row, Col, Badge, Form } from 'react-bootstrap';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { FaBuilding, FaArrowRight, FaPlus, FaSearch } from 'react-icons/fa';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { formatarCnpj } from '../utils/documentoFiscal';

const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const FORM_EMPRESA_INICIAL = {
  nome: '',
  cnpj: '',
  email: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: ''
};

function montarEndereco(form) {
  return [
    form.logradouro,
    form.numero,
    form.complemento,
    form.bairro,
    form.cidade,
    form.estado,
    form.cep
  ].filter(Boolean).join(', ');
}

function SelecaoEmpresa() {
  const { isAdmin, perfil } = useAuth();
  const {
    memberships,
    selecionarEmpresa,
    criarMinhaEmpresa,
    buscarEmpresaPorCnpj,
    entrarPorCnpj
  } = useEmpresa();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listaEmpresas, setListaEmpresas] = useState([]);
  const [modo, setModo] = useState(''); // '' | 'criar' | 'entrar'
  const [formEmpresa, setFormEmpresa] = useState({
    ...FORM_EMPRESA_INICIAL,
    nome: perfil?.nomeEmpresaSugerida || ''
  });
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [empresaEncontrada, setEmpresaEncontrada] = useState(null);

  const jaCriouEmpresa = Boolean(perfil?.criouEmpresa);

  useEffect(() => {
    setFormEmpresa((prev) => (
      prev.nome || !perfil?.nomeEmpresaSugerida
        ? prev
        : { ...prev, nome: perfil.nomeEmpresaSugerida }
    ));
  }, [perfil?.nomeEmpresaSugerida]);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      if (isAdmin) {
        const snap = await getDocs(collection(db, 'empresas'));
        const lista = snap.docs
          .map((d) => ({
            id: d.id,
            nome: d.data().nome,
            bloqueada: Boolean(d.data().bloqueada),
            colaborador: memberships.find((m) => m.id === d.id)?.colaborador ?? true
          }));
        if (!cancelado) setListaEmpresas(lista);
        return;
      }

      const lista = [];
      for (const m of memberships) {
        const snap = await getDoc(doc(db, 'empresas', m.id));
        if (snap.exists() && !snap.data().bloqueada) {
          lista.push({
            ...m,
            nome: snap.data().nome || m.nome
          });
        }
      }
      if (!cancelado) setListaEmpresas(lista);
    };

    carregar().catch((e) => {
      console.error(e);
      if (!cancelado) setError('Não foi possível carregar as empresas.');
    });

    return () => { cancelado = true; };
  }, [isAdmin, memberships]);

  const atualizarForm = (campo, valor) => {
    setFormEmpresa((prev) => ({ ...prev, [campo]: valor }));
  };

  async function buscarCep(cepRaw) {
    const cep = String(cepRaw || '').replace(/\D/g, '');
    atualizarForm('cep', cepRaw);
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) return;
      setFormEmpresa((prev) => ({
        ...prev,
        cep: cepRaw,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        estado: data.uf || prev.estado
      }));
    } catch {
      // ignore
    }
  }

  const entrar = async (empresaId, nome) => {
    setLoading(true);
    setError('');
    try {
      await selecionarEmpresa(empresaId, nome);
      navigate('/app');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Não foi possível entrar na empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleCriar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const criada = await criarMinhaEmpresa({
        nome: formEmpresa.nome,
        cnpj: formEmpresa.cnpj,
        email: formEmpresa.email,
        telefone: formEmpresa.telefone,
        endereco: montarEndereco(formEmpresa)
      });
      await selecionarEmpresa(criada.id, criada.nome);
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Não foi possível criar a empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarCnpj = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEmpresaEncontrada(null);
    try {
      const encontrada = await buscarEmpresaPorCnpj(cnpjBusca);
      setEmpresaEncontrada(encontrada);
    } catch (err) {
      setError(err.message || 'Não foi possível buscar a empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarEntrada = async () => {
    if (!empresaEncontrada) return;
    setLoading(true);
    setError('');
    try {
      const entrou = await entrarPorCnpj(empresaEncontrada.cnpj);
      await selecionarEmpresa(entrou.id, entrou.nome);
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Não foi possível entrar na empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1><FaBuilding className="me-2" />Selecionar empresa</h1>
        <p className="text-muted mb-0">
          Entre em uma empresa da lista, crie a sua (apenas uma) ou acesse outra pelo CNPJ.
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {listaEmpresas.length === 0 && !isAdmin && (
        <Alert variant="info">
          É preciso criar uma empresa ou acessar uma existente pelo CNPJ para começar.
        </Alert>
      )}

      {listaEmpresas.length > 0 && (
        <Row className="g-3 mb-4">
          {listaEmpresas.map((emp) => (
            <Col md={6} lg={4} key={emp.id}>
              <Card className="h-100">
                <Card.Body className="d-flex flex-column">
                  <h5 className="mb-1">
                    {emp.nome}
                    {emp.bloqueada && (
                      <Badge bg="danger" className="ms-2">Bloqueada</Badge>
                    )}
                  </h5>
                  <p className="text-muted small mb-3">
                    {emp.bloqueada
                      ? 'Bloqueada para usuários cadastrados. Você pode entrar como administrador.'
                      : (isAdmin || emp.colaborador ? 'Colaborador — pode editar' : 'Somente visualização')}
                  </p>
                  <Button
                    variant="primary"
                    className="mt-auto"
                    disabled={loading}
                    onClick={() => entrar(emp.id, emp.nome)}
                  >
                    Entrar <FaArrowRight className="ms-2" />
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {!isAdmin && (
        <Row className="g-3 mb-4">
          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <h5 className="mb-2"><FaPlus className="me-2" />Criar empresa</h5>
                <p className="text-muted small">
                  {jaCriouEmpresa
                    ? 'Você já criou sua empresa. Para outras, use o CNPJ.'
                    : 'Nome, e-mail e CNPJ são obrigatórios. Só é possível criar uma empresa.'}
                </p>
                <Button
                  variant="outline-primary"
                  disabled={jaCriouEmpresa || loading}
                  onClick={() => { setModo('criar'); setError(''); }}
                >
                  {jaCriouEmpresa ? 'Limite de criação atingido' : 'Nova empresa'}
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <h5 className="mb-2"><FaSearch className="me-2" />Acessar empresa</h5>
                <p className="text-muted small">
                  Informe o CNPJ exato da empresa para se juntar a ela.
                </p>
                <Button
                  variant="outline-primary"
                  disabled={loading}
                  onClick={() => { setModo('entrar'); setError(''); setEmpresaEncontrada(null); }}
                >
                  Entrar com CNPJ
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {isAdmin && listaEmpresas.length === 0 && (
        <Alert variant="info">
          Nenhuma empresa disponível. Crie uma em <Alert.Link as={Link} to="/admin">Administração</Alert.Link>.
        </Alert>
      )}

      {modo === 'criar' && !jaCriouEmpresa && (
        <Card className="mb-4">
          <Card.Header>Nova empresa</Card.Header>
          <Card.Body>
            <Form onSubmit={handleCriar}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nome da empresa</Form.Label>
                    <Form.Control
                      value={formEmpresa.nome}
                      onChange={(e) => atualizarForm('nome', e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>CNPJ</Form.Label>
                    <Form.Control
                      value={formEmpresa.cnpj}
                      onChange={(e) => atualizarForm('cnpj', formatarCnpj(e.target.value))}
                      required
                      placeholder="00.000.000/0000-00"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>E-mail da empresa</Form.Label>
                    <Form.Control
                      type="email"
                      value={formEmpresa.email}
                      onChange={(e) => atualizarForm('email', e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Telefone</Form.Label>
                    <Form.Control
                      value={formEmpresa.telefone}
                      onChange={(e) => atualizarForm('telefone', e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>CEP</Form.Label>
                    <Form.Control
                      value={formEmpresa.cep}
                      onChange={(e) => buscarCep(e.target.value)}
                      placeholder="00000-000"
                    />
                  </Form.Group>
                </Col>
                <Col md={8}>
                  <Form.Group>
                    <Form.Label>Logradouro</Form.Label>
                    <Form.Control
                      value={formEmpresa.logradouro}
                      onChange={(e) => atualizarForm('logradouro', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Número</Form.Label>
                    <Form.Control
                      value={formEmpresa.numero}
                      onChange={(e) => atualizarForm('numero', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={5}>
                  <Form.Group>
                    <Form.Label>Complemento</Form.Label>
                    <Form.Control
                      value={formEmpresa.complemento}
                      onChange={(e) => atualizarForm('complemento', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Bairro</Form.Label>
                    <Form.Control
                      value={formEmpresa.bairro}
                      onChange={(e) => atualizarForm('bairro', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={8}>
                  <Form.Group>
                    <Form.Label>Cidade</Form.Label>
                    <Form.Control
                      value={formEmpresa.cidade}
                      onChange={(e) => atualizarForm('cidade', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Estado</Form.Label>
                    <Form.Select
                      value={formEmpresa.estado}
                      onChange={(e) => atualizarForm('estado', e.target.value)}
                    >
                      <option value="">UF</option>
                      {ESTADOS.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <div className="d-flex gap-2 mt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Criar e entrar'}
                </Button>
                <Button variant="outline-secondary" type="button" onClick={() => setModo('')}>
                  Cancelar
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}

      {modo === 'entrar' && (
        <Card className="mb-4">
          <Card.Header>Acessar empresa pelo CNPJ</Card.Header>
          <Card.Body>
            <Form onSubmit={handleBuscarCnpj} className="mb-3">
              <Form.Group className="mb-3" style={{ maxWidth: 320 }}>
                <Form.Label>CNPJ</Form.Label>
                <Form.Control
                  value={cnpjBusca}
                  onChange={(e) => setCnpjBusca(formatarCnpj(e.target.value))}
                  required
                  placeholder="00.000.000/0000-00"
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Buscando...' : 'Buscar'}
                </Button>
                <Button variant="outline-secondary" type="button" onClick={() => { setModo(''); setEmpresaEncontrada(null); }}>
                  Cancelar
                </Button>
              </div>
            </Form>

            {empresaEncontrada && (
              <Alert variant="secondary" className="mb-0">
                <div className="fw-semibold">{empresaEncontrada.nome}</div>
                <div className="small text-muted">
                  CNPJ {formatarCnpj(empresaEncontrada.cnpj)}
                </div>
                {empresaEncontrada.email && (
                  <div className="small text-muted">{empresaEncontrada.email}</div>
                )}
                <Button className="mt-3" disabled={loading} onClick={handleConfirmarEntrada}>
                  Confirmar e entrar
                </Button>
              </Alert>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

export default SelecaoEmpresa;
