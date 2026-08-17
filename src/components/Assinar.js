import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { useAuth } from '../contexts/AuthContext';
import {
  getPlano,
  formatarPrecoPlano,
  precoMensalAnual,
  precoAnualTotal,
  OFERTA,
  TRIAL_DIAS,
  PLANO_PADRAO_ID
} from '../constants/plano';
import { formatarCpf, validarCpf } from '../utils/documentoFiscal';
import { iniciarTrial } from '../utils/iniciarTrial';

const FORM_INICIAL = {
  nome: '',
  email: '',
  senha: '',
  confirmarSenha: '',
  telefone: '',
  cpf: '',
  aceitouTermos: false
};

function Assinar() {
  const navigate = useNavigate();
  const { recarregarPerfil } = useAuth();
  const [searchParams] = useSearchParams();
  const plano = useMemo(
    () => getPlano(searchParams.get('plano') || PLANO_PADRAO_ID),
    [searchParams]
  );
  const isTrial = searchParams.get('trial') === '1';
  const ciclo = searchParams.get('ciclo') === 'mensal' ? 'mensal' : 'anual';
  const isAnual = ciclo === 'anual';
  const [form, setForm] = useState(FORM_INICIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const valorCobrado = isAnual ? precoMensalAnual(plano) : plano.precoMensal;
  const valorCheioRef = isAnual ? plano.precoMensal : plano.precoCheio;

  function atualizar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!validarCpf(form.cpf)) {
      setError('Informe um CPF válido.');
      return;
    }
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

    try {
      if (isTrial) {
        await iniciarTrial({
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          telefone: form.telefone,
          cpf: form.cpf
        });
        if (typeof recarregarPerfil === 'function') {
          await recarregarPerfil();
        }
        navigate('/empresas', { replace: true });
        return;
      }

      const pendente = {
        ...form,
        senha: undefined,
        confirmarSenha: undefined,
        cpf: form.cpf,
        planoId: plano.id,
        plano: plano.nome,
        ciclo,
        valorCheio: valorCheioRef,
        valor: valorCobrado,
        valorAnualTotal: isAnual ? precoAnualTotal(plano) : null,
        criadoEm: new Date().toISOString()
      };
      try {
        sessionStorage.setItem('orcaobra_assinatura_pendente', JSON.stringify(pendente));
      } catch {
        // sessionStorage pode falhar em modo privado; seguimos mesmo assim
      }

      await new Promise((r) => setTimeout(r, 800));
      navigate('/assinar/sucesso', {
        state: {
          email: form.email,
          nome: form.nome,
          planoId: plano.id,
          planoNome: plano.nome,
          ciclo,
          valor: valorCobrado
        }
      });
    } catch (err) {
      const codigo = err?.code || '';
      if (codigo === 'trial/documento-ja-usado') {
        setError(err.message);
      } else if (codigo === 'auth/email-already-in-use') {
        setError('Este e-mail já possui uma conta. Faça login ou use outro e-mail.');
      } else if (codigo === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (codigo === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (codigo === 'permission-denied') {
        setError('Não foi possível gravar o trial. Publique as regras do Firestore e tente de novo.');
      } else {
        setError(err?.message || 'Não foi possível concluir. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
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
                {isTrial ? (
                  <>
                    <span className="landing-plan-badge landing-plan-badge--hot">Trial grátis</span>
                    <h1 className="h4 text-dark mt-2 mb-1">{TRIAL_DIAS} dias para testar</h1>
                    <p className="text-muted small mb-2">
                      {plano.usuarios}
                    </p>
                    <div className="landing-price mb-1">R$ 0,00</div>
                    <p className="text-muted small mb-3">
                      Sem cartão no trial.
                    </p>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="landing-plan-badge">{OFERTA.selo}</span>
                    </div>
                    <p className="text-muted small mt-2 mb-2">
                      {plano.usuarios} · cobrança {isAnual ? 'anual' : 'mensal'}
                    </p>
                    <div className="landing-price-old">De {formatarPrecoPlano(valorCheioRef)}</div>
                    <div className="landing-price mb-1">{formatarPrecoPlano(valorCobrado)}</div>
                    <p className="text-muted small mb-3">
                      {isAnual
                        ? `equivalente mensal · total ${formatarPrecoPlano(precoAnualTotal(plano))}/ano`
                        : 'por mês na oferta do mês'}
                    </p>
                  </>
                )}

                <h2 className="h6 text-uppercase text-muted mb-2">O que você leva</h2>
                <ListGroup variant="flush" className="mb-3">
                  {(plano.recursos || []).slice(0, 6).map((item) => (
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
                  {isTrial ? (
                    <>
                      Depois de {TRIAL_DIAS} dias,
                      escolha um plano para continuar.
                    </>
                  ) : (
                    <>
                      <FaLock className="me-2" />
                      Pagamento processado pelo <strong>Mercado Pago</strong>.
                      Não pedimos nem guardamos número de cartão neste site.
                    </>
                  )}
                </Alert>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={8}>
            <Card className="border-0 shadow">
              <Card.Body className="p-4 p-md-5">
                <h2 className="h4 mb-1">
                  {isTrial ? 'Começar o trial de 7 dias' : 'Criar sua assinatura'}
                </h2>
                <p className="text-muted mb-4">
                  {isTrial
                    ? 'Preencha seus dados. Depois do login você cria ou acessa uma empresa.'
                    : 'Preencha seus dados. Em seguida você será direcionado ao Mercado Pago para concluir o pagamento com segurança.'}
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
                        <Form.Label>CPF</Form.Label>
                        <Form.Control
                          value={form.cpf}
                          onChange={(e) => atualizar('cpf', formatarCpf(e.target.value))}
                          required
                          inputMode="numeric"
                          placeholder="000.000.000-00"
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

                  {!isTrial && (
                    <Alert variant="secondary" className="small">
                      <strong>Próximo passo (Mercado Pago):</strong> após confirmar,
                      você será redirecionado ao checkout do Mercado Pago para informar
                      cartão, Pix ou outro meio. Quando o pagamento for aprovado, sua
                      conta será liberada automaticamente.
                    </Alert>
                  )}

                  <Form.Check
                    className="mb-4"
                    type="checkbox"
                    id="termos"
                    checked={form.aceitouTermos}
                    onChange={(e) => atualizar('aceitouTermos', e.target.checked)}
                    label={
                      isTrial ? (
                        <>
                          Concordo em iniciar o trial de <strong>{TRIAL_DIAS} dias</strong>.
                        </>
                      ) : (
                        <>
                          Concordo em assinar por{' '}
                          <strong>{formatarPrecoPlano(valorCobrado)}/mês</strong>
                          {isAnual
                            ? ` (cobrança anual de ${formatarPrecoPlano(precoAnualTotal(plano))})`
                            : ` (de ${formatarPrecoPlano(plano.precoCheio)})`}
                          .
                        </>
                      )
                    }
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
                      ? (isTrial ? 'Criando sua conta...' : 'Preparando checkout seguro...')
                      : (isTrial
                        ? `Começar trial de ${TRIAL_DIAS} dias`
                        : `Continuar para o pagamento · ${formatarPrecoPlano(valorCobrado)}/mês`)}
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
