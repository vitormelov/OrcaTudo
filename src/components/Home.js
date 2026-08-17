import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, ListGroup, Badge } from 'react-bootstrap';
import { FaCheckCircle, FaBolt } from 'react-icons/fa';
import Logo from './Logo';
import {
  OFERTA,
  PLANO_PADRAO_ID,
  TRIAL_DIAS,
  formatarPrecoPlano,
  precoMensalAnual,
  precoAnualTotal,
  getPlano
} from '../constants/plano';

function Home() {
  const [ciclo, setCiclo] = useState('anual');
  const plano = getPlano(PLANO_PADRAO_ID);
  const precoAnualMes = precoMensalAnual(plano);
  const precoAnual = precoAnualTotal(plano);
  const isAnual = ciclo === 'anual';
  const precoSelecionado = isAnual ? precoAnualMes : plano.precoMensal;

  return (
    <div className="landing-page landing-page--fit">
      <header className="landing-header">
        <Container>
          <div className="d-flex align-items-center justify-content-between py-2">
            <Logo height={40} />
            <div className="d-flex gap-2">
              <Button as={Link} to="/login" variant="outline-light" size="sm">
                Entrar
              </Button>
              <Button
                as={Link}
                to="/assinar?trial=1"
                variant="warning"
                size="sm"
                className="fw-semibold text-dark"
              >
                Trial {TRIAL_DIAS} dias
              </Button>
            </div>
          </div>
        </Container>
      </header>

      <section className="landing-hero landing-hero--fit">
        <Container>
          <Row className="align-items-center gy-3">
            <Col lg={6}>
              <div className="landing-left">
              <p className="landing-eyebrow mb-2">Sistema de orçamentos de obra</p>
              <h1 className="landing-title mb-3">
                Orce obras com clareza, controle e profissionalismo
              </h1>
              <p className="landing-subtitle mb-4">
                Insumos, composições, orçamentos, EAP e análises em um só lugar —
                pensado para pequenas empresas de construção civil.
              </p>

              <div className="landing-trial-inline">
                <div className="landing-trial-kicker">
                  <FaBolt className="me-2" />
                  Novo por aqui?
                </div>
                <h2 className="landing-trial-heading">
                  Teste {TRIAL_DIAS} dias grátis
                </h2>
                <p className="landing-trial-lead mb-3">
                  Acesso completo ao sistema. Sem cartão. Comece agora.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    as={Link}
                    to="/assinar?trial=1"
                    variant="warning"
                    size="lg"
                    className="fw-bold text-dark px-4 landing-trial-cta"
                  >
                    Começar meu trial grátis
                  </Button>
                  <Button as={Link} to="/login" variant="outline-light" size="lg">
                    Já tenho conta
                  </Button>
                </div>
              </div>
              </div>
            </Col>

            <Col lg={6}>
              <Card className="landing-pricing-card shadow-lg border-0">
                <Card.Body className="p-4">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <span className="landing-plan-badge landing-plan-badge--hot">Plano único</span>
                    </div>
                  </div>
                  <p className="text-muted small mb-3">{plano.usuarios}</p>

                  <div className="landing-price-options mb-3" role="group" aria-label="Ciclo de cobrança">
                    <button
                      type="button"
                      className={`landing-price-option ${!isAnual ? 'is-selected' : ''}`}
                      onClick={() => setCiclo('mensal')}
                      aria-pressed={!isAnual}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Mensal</span>
                      </div>
                      <div className="landing-price-old">
                        De {formatarPrecoPlano(plano.precoCheio)}
                      </div>
                      <div className="d-flex align-items-baseline gap-1">
                        <span className="landing-price">{formatarPrecoPlano(plano.precoMensal)}</span>
                        <span className="text-muted">/mês</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`landing-price-option landing-price-option--best ${isAnual ? 'is-selected' : ''}`}
                      onClick={() => setCiclo('anual')}
                      aria-pressed={isAnual}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Anual</span>
                        <Badge bg="success">-{OFERTA.descontoAnualPct}%</Badge>
                      </div>
                      <div className="landing-price-old">
                        De {formatarPrecoPlano(plano.precoMensal)}
                      </div>
                      <div className="d-flex align-items-baseline gap-1">
                        <span className="landing-price">{formatarPrecoPlano(precoAnualMes)}</span>
                        <span className="text-muted">/mês</span>
                      </div>
                      <p className="landing-price-note mb-0">
                        {formatarPrecoPlano(precoAnual)} cobrados no ano
                      </p>
                    </button>
                  </div>

                  <h3 className="h6 text-uppercase text-muted mb-2">Incluso</h3>
                  <ListGroup variant="flush" className="mb-3 landing-feature-compact">
                    {plano.recursos.slice(0, 6).map((item) => (
                      <ListGroup.Item
                        key={item}
                        className="px-0 py-1 d-flex align-items-start gap-2 border-0 bg-transparent"
                      >
                        <FaCheckCircle className="text-success mt-1 flex-shrink-0" />
                        <span className="text-dark small">{item}</span>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>

                  <Button
                    as={Link}
                    to={`/assinar?plano=${plano.id}&ciclo=${ciclo}`}
                    variant="primary"
                    size="lg"
                    className="w-100 fw-semibold"
                  >
                    Assinar · {formatarPrecoPlano(precoSelecionado)}/mês
                  </Button>
                  <p className="text-muted small text-center mt-3 mb-0">
                    Pagamento seguro via Mercado Pago.
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
}

export default Home;
