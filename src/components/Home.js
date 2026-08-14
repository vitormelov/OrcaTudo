import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { FaCheckCircle } from 'react-icons/fa';
import Logo from './Logo';
import {
  PLANOS,
  OFERTA,
  PLANO_PADRAO_ID,
  formatarPrecoPlano,
  percentualDesconto,
  precoMensalAnual,
  precoAnualTotal,
  economiaAnual,
  getPlano
} from '../constants/plano';

function Home() {
  const [ciclo, setCiclo] = useState('anual'); // padrão: anual
  const isAnual = ciclo === 'anual';
  const planoDestaque = getPlano(PLANO_PADRAO_ID);
  const precoCta = isAnual
    ? precoMensalAnual(planoDestaque)
    : planoDestaque.precoMensal;

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Container>
          <div className="d-flex align-items-center justify-content-between py-3">
            <Logo height={48} />
            <div className="d-flex gap-2">
              <Button as={Link} to="/login" variant="outline-light" size="sm">
                Entrar
              </Button>
              <Button
                as={Link}
                to={`/assinar?plano=${PLANO_PADRAO_ID}&ciclo=${ciclo}`}
                variant="warning"
                size="sm"
                className="fw-semibold text-dark"
              >
                Assinar
              </Button>
            </div>
          </div>
        </Container>
      </header>

      <section className="landing-hero pb-2">
        <Container>
          <Row className="justify-content-center text-center">
            <Col lg={9}>
              <p className="landing-eyebrow mb-2">Sistema de orçamentos de obra</p>
              <h1 className="landing-title mb-3">
                Orce obras com clareza, controle e profissionalismo
              </h1>
              <p className="landing-subtitle mx-auto mb-3" style={{ maxWidth: '36rem' }}>
                Insumos, composições, orçamentos, EAP e análises em um só lugar —
                pensado para pequenas empresas de construção civil.
              </p>
              <div className="landing-offer-banner mb-2">
                <Badge bg="warning" text="dark" className="me-2">
                  {OFERTA.selo}
                </Badge>
                <span>{OFERTA.urgencia}</span>
              </div>
              <div className="d-flex flex-wrap gap-2 justify-content-center mb-4">
                <Button
                  as={Link}
                  to={`/assinar?plano=${PLANO_PADRAO_ID}&ciclo=${ciclo}`}
                  variant="warning"
                  size="lg"
                  className="fw-semibold text-dark px-4"
                >
                  Começar por {formatarPrecoPlano(precoCta)}/mês
                </Button>
                <Button as={Link} to="/login" variant="outline-light" size="lg">
                  Já tenho conta
                </Button>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="landing-pricing-section pb-5">
        <Container>
          <div className="text-center mb-3">
            <h2 className="h3 text-white mb-2">Escolha o plano ideal</h2>
            <p className="text-white-50 mb-3">
              Preço cheio riscado · valor promocional se fechar agora
              {isAnual ? ' · anual com desconto extra' : ''}
            </p>

            <div className="landing-billing-toggle" role="group" aria-label="Ciclo de cobrança">
              <button
                type="button"
                className={`landing-billing-option ${!isAnual ? 'is-active' : ''}`}
                onClick={() => setCiclo('mensal')}
                aria-pressed={!isAnual}
              >
                Mensal
              </button>
              <button
                type="button"
                className={`landing-billing-option ${isAnual ? 'is-active' : ''}`}
                onClick={() => setCiclo('anual')}
                aria-pressed={isAnual}
              >
                Anual
                <span className="landing-billing-save">-{OFERTA.descontoAnualPct}%</span>
              </button>
              <span
                className={`landing-billing-slider ${isAnual ? 'is-anual' : 'is-mensal'}`}
                aria-hidden="true"
              />
            </div>
          </div>

          <Row className="g-3 g-lg-4 align-items-stretch justify-content-center">
            {PLANOS.map((plano) => {
              const pctOferta = percentualDesconto(plano);
              const mensalAnual = precoMensalAnual(plano);
              const economia = economiaAnual(plano);
              const precoExibido = isAnual ? mensalAnual : plano.precoMensal;
              const precoCheioExibido = isAnual
                ? plano.precoMensal
                : plano.precoCheio;
              const pctCard = isAnual
                ? OFERTA.descontoAnualPct
                : pctOferta;
              const economiaMensal = precoCheioExibido - precoExibido;

              return (
                <Col key={plano.id} md={6} lg={4}>
                  <Card
                    className={`landing-pricing-card h-100 border-0 shadow-lg ${
                      plano.destaque ? 'landing-pricing-card--featured' : ''
                    }`}
                  >
                    <Card.Body className="p-4 d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          {plano.destaque && (
                            <span className="landing-plan-badge landing-plan-badge--hot mb-2 d-inline-block">
                              {plano.seloDestaque}
                            </span>
                          )}
                          {!plano.destaque && (
                            <span className="landing-plan-badge mb-2 d-inline-block">
                              {isAnual ? 'Plano anual' : 'Plano mensal'}
                            </span>
                          )}
                          <h3 className="h4 text-dark mb-1">{plano.nome}</h3>
                          <p className="text-muted small mb-0">{plano.descricao}</p>
                        </div>
                        {pctCard > 0 && (
                          <span className="landing-discount-pill">-{pctCard}%</span>
                        )}
                      </div>

                      <p className="text-dark fw-semibold small mb-3">{plano.usuarios}</p>

                      <div className="mb-1">
                        <span className="landing-price-old">
                          De {formatarPrecoPlano(precoCheioExibido)}
                        </span>
                      </div>
                      <div className="d-flex align-items-baseline gap-1 mb-1">
                        <span className="landing-price">
                          {formatarPrecoPlano(precoExibido)}
                        </span>
                        <span className="text-muted">/mês</span>
                      </div>
                      <p className="landing-price-note mb-3">
                        {isAnual ? (
                          <>
                            Cobrado anualmente · {formatarPrecoPlano(precoAnualTotal(plano))}/ano
                            <br />
                            Você economiza {formatarPrecoPlano(economia)} por ano
                          </>
                        ) : (
                          <>
                            Oferta do mês · você economiza{' '}
                            {formatarPrecoPlano(economiaMensal)}/mês
                          </>
                        )}
                      </p>

                      {!isAnual && (
                        <div className="landing-annual-box mb-4">
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <span className="small fw-semibold text-dark">
                              No anual: {formatarPrecoPlano(mensalAnual)}/mês
                            </span>
                            <Badge bg="success" className="landing-annual-badge">
                              Economize {OFERTA.descontoAnualPct}%
                            </Badge>
                          </div>
                          <p className="small text-muted mb-0 mt-1">
                            Equivale a {formatarPrecoPlano(economia)} a menos por ano
                          </p>
                        </div>
                      )}

                      {isAnual && (
                        <div className="landing-annual-box mb-4">
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <span className="small fw-semibold text-dark">
                              Melhor custo · pagamento anual
                            </span>
                            <Badge bg="success" className="landing-annual-badge">
                              -{OFERTA.descontoAnualPct}%
                            </Badge>
                          </div>
                          <p className="small text-muted mb-0 mt-1">
                            Em vez de {formatarPrecoPlano(plano.precoMensal)}/mês no mensal
                          </p>
                        </div>
                      )}

                      <ul className="landing-feature-list flex-grow-1 mb-4">
                        {plano.recursos.map((item) => (
                          <li key={item}>
                            <FaCheckCircle className="text-success flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        as={Link}
                        to={`/assinar?plano=${plano.id}&ciclo=${ciclo}`}
                        variant={plano.destaque ? 'primary' : 'outline-primary'}
                        size="lg"
                        className="w-100 fw-semibold"
                      >
                        Assinar {plano.nome}
                      </Button>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>

          <p className="text-center text-white-50 small mt-4 mb-0">
            Pagamento seguro via Mercado Pago. Não armazenamos dados do seu cartão.
          </p>
        </Container>
      </section>

      <footer className="landing-footer">
        <Container className="py-4 text-center text-muted small">
          © {new Date().getFullYear()} Orça Obra. Todos os direitos reservados.
        </Container>
      </footer>
    </div>
  );
}

export default Home;
