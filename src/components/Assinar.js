import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  ListGroup
} from 'react-bootstrap';
import { FaCheckCircle, FaLock, FaArrowLeft } from 'react-icons/fa';
import Logo from './Logo';
import { PLANO, formatarPrecoPlano } from '../constants/plano';

const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const FORM_INICIAL = {
  nome: '',
  email: '',
  senha: '',
  confirmarSenha: '',
  nomeEmpresa: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  aceitouTermos: false
};

function Assinar() {
  const navigate = useNavigate();
  const [form, setForm] = useState(FORM_INICIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function atualizar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function buscarCep(cepRaw) {
    const cep = String(cepRaw || '').replace(/\D/g, '');
    atualizar('cep', cepRaw);
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) return;
      setForm((prev) => ({
        ...prev,
        cep: cepRaw,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        estado: data.uf || prev.estado
      }));
    } catch {
      // CEP opcional no preenchimento automático
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (form.senha !== form.confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!form.aceitouTermos) {
      setError('Aceite os termos para continuar.');
      return;
    }

    setLoading(true);

    // Fluxo visual: dados da conta/endereço ficam prontos para a integração
    // real com Mercado Pago (Checkout Pro / Assinaturas). Cartão NUNCA é
    // coletado aqui — o pagamento ocorrerá na página segura do Mercado Pago.
    const pendente = {
      ...form,
      senha: undefined,
      confirmarSenha: undefined,
      plano: PLANO.nome,
      valor: PLANO.precoMensal,
      criadoEm: new Date().toISOString()
    };
    try {
      sessionStorage.setItem('orcaobra_assinatura_pendente', JSON.stringify(pendente));
    } catch {
      // sessionStorage pode falhar em modo privado; seguimos mesmo assim
    }

    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    navigate('/assinar/sucesso', {
      state: {
        email: form.email,
        nome: form.nome,
        nomeEmpresa: form.nomeEmpresa
      }
    });
  }

  return (
    <div className="landing-page landing-checkout">
      <header className="landing-header">
        <Container>
          <div className="d-flex align-items-center justify-content-between py-3">
            <Link to="/" className="text-decoration-none">
              <Logo height={44} />
            </Link>
            <Button as={Link} to="/login" variant="outline-light" size="sm">
              Já tenho conta
            </Button>
          </div>
        </Container>
      </header>

      <Container className="py-4 py-md-5">
        <Button
          as={Link}
          to="/"
          variant="link"
          className="text-light text-decoration-none mb-3 ps-0"
        >
          <FaArrowLeft className="me-2" />
          Voltar para a home
        </Button>

        <Row className="gy-4">
          <Col lg={4}>
            <Card className="landing-pricing-card border-0 shadow sticky-lg-top" style={{ top: 24 }}>
              <Card.Body className="p-4">
                <span className="landing-plan-badge">Assinatura</span>
                <h1 className="h4 text-dark mt-2 mb-1">{PLANO.nome}</h1>
                <div className="landing-price mb-1">{formatarPrecoPlano()}</div>
                <p className="text-muted small mb-4">Cobrança mensal · cancele quando quiser</p>

                <h2 className="h6 text-uppercase text-muted mb-2">O que você leva</h2>
                <ListGroup variant="flush" className="mb-3">
                  {[...PLANO.modulos.slice(0, 4), ...PLANO.beneficios.slice(0, 2)].map((item) => (
                    <ListGroup.Item
                      key={item}
                      className="px-0 d-flex align-items-start gap-2 border-0 bg-transparent"
                    >
                      <FaCheckCircle className="text-success mt-1 flex-shrink-0" />
                      <span className="text-dark small">{item}</span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>

                <Alert variant="info" className="mb-0 small">
                  <FaLock className="me-2" />
                  Pagamento processado pelo <strong>Mercado Pago</strong>.
                  Não pedimos nem guardamos número de cartão neste site.
                </Alert>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={8}>
            <Card className="border-0 shadow">
              <Card.Body className="p-4 p-md-5">
                <h2 className="h4 mb-1">Criar sua assinatura</h2>
                <p className="text-muted mb-4">
                  Preencha seus dados e o endereço de cobrança. Em seguida você será
                  direcionado ao Mercado Pago para concluir o pagamento com segurança.
                </p>

                {error && <Alert variant="danger">{error}</Alert>}

                <Form onSubmit={handleSubmit}>
                  <h3 className="h6 text-uppercase text-muted mb-3">Dados da conta</h3>
                  <Row className="g-3 mb-4">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nome completo</Form.Label>
                        <Form.Control
                          value={form.nome}
                          onChange={(e) => atualizar('nome', e.target.value)}
                          required
                          placeholder="Seu nome"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>E-mail de acesso</Form.Label>
                        <Form.Control
                          type="email"
                          value={form.email}
                          onChange={(e) => atualizar('email', e.target.value)}
                          required
                          placeholder="voce@empresa.com"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Senha</Form.Label>
                        <Form.Control
                          type="password"
                          value={form.senha}
                          onChange={(e) => atualizar('senha', e.target.value)}
                          required
                          minLength={6}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Confirmar senha</Form.Label>
                        <Form.Control
                          type="password"
                          value={form.confirmarSenha}
                          onChange={(e) => atualizar('confirmarSenha', e.target.value)}
                          required
                          minLength={6}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Nome da empresa</Form.Label>
                        <Form.Control
                          value={form.nomeEmpresa}
                          onChange={(e) => atualizar('nomeEmpresa', e.target.value)}
                          required
                          placeholder="Razão social ou nome fantasia"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Telefone</Form.Label>
                        <Form.Control
                          value={form.telefone}
                          onChange={(e) => atualizar('telefone', e.target.value)}
                          required
                          placeholder="(00) 00000-0000"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <h3 className="h6 text-uppercase text-muted mb-3">Endereço de cobrança</h3>
                  <Row className="g-3 mb-4">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>CEP</Form.Label>
                        <Form.Control
                          value={form.cep}
                          onChange={(e) => buscarCep(e.target.value)}
                          required
                          placeholder="00000-000"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={8}>
                      <Form.Group>
                        <Form.Label>Logradouro</Form.Label>
                        <Form.Control
                          value={form.logradouro}
                          onChange={(e) => atualizar('logradouro', e.target.value)}
                          required
                          placeholder="Rua, avenida..."
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Número</Form.Label>
                        <Form.Control
                          value={form.numero}
                          onChange={(e) => atualizar('numero', e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group>
                        <Form.Label>Complemento</Form.Label>
                        <Form.Control
                          value={form.complemento}
                          onChange={(e) => atualizar('complemento', e.target.value)}
                          placeholder="Opcional"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Bairro</Form.Label>
                        <Form.Control
                          value={form.bairro}
                          onChange={(e) => atualizar('bairro', e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={8}>
                      <Form.Group>
                        <Form.Label>Cidade</Form.Label>
                        <Form.Control
                          value={form.cidade}
                          onChange={(e) => atualizar('cidade', e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Estado</Form.Label>
                        <Form.Select
                          value={form.estado}
                          onChange={(e) => atualizar('estado', e.target.value)}
                          required
                        >
                          <option value="">UF</option>
                          {ESTADOS.map((uf) => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Alert variant="secondary" className="small">
                    <strong>Próximo passo (Mercado Pago):</strong> após confirmar,
                    você será redirecionado ao checkout do Mercado Pago para informar
                    cartão, Pix ou outro meio. Quando o pagamento for aprovado, sua
                    conta será liberada automaticamente.
                  </Alert>

                  <Form.Check
                    className="mb-4"
                    type="checkbox"
                    id="termos"
                    checked={form.aceitouTermos}
                    onChange={(e) => atualizar('aceitouTermos', e.target.checked)}
                    label={`Concordo em assinar o plano ${PLANO.nome} por ${formatarPrecoPlano()}/${PLANO.ciclo}.`}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-100 fw-semibold"
                    disabled={loading}
                  >
                    {loading
                      ? 'Preparando checkout seguro...'
                      : `Continuar para o pagamento · ${formatarPrecoPlano()}/${PLANO.ciclo}`}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Assinar;
