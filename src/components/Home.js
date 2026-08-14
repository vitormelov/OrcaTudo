import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, ListGroup } from 'react-bootstrap';
import {
  FaCheckCircle,
  FaBoxes,
  FaLayerGroup,
  FaFileInvoiceDollar,
  FaChartBar,
  FaShieldAlt,
  FaUsers
} from 'react-icons/fa';
import Logo from './Logo';
import { PLANO, formatarPrecoPlano } from '../constants/plano';

const MODULO_ICONS = [
  FaBoxes,
  FaLayerGroup,
  FaFileInvoiceDollar,
  FaChartBar,
  FaUsers,
  FaShieldAlt
];

function Home() {
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
              <Button as={Link} to="/assinar" variant="warning" size="sm" className="fw-semibold text-dark">
                Assinar
              </Button>
            </div>
          </div>
        </Container>
      </header>

      <section className="landing-hero">
        <Container>
          <Row className="align-items-center gy-4">
            <Col lg={6}>
              <p className="landing-eyebrow mb-2">Sistema de orçamentos de obra</p>
              <h1 className="landing-title mb-3">
                Orce obras com clareza, controle e profissionalismo
              </h1>
              <p className="landing-subtitle mb-4">
                O Orça Obra reúne insumos, composições, orçamentos, EAP e análises
                em um só lugar — pensado para empresas de construção civil.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Button as={Link} to="/assinar" variant="warning" size="lg" className="fw-semibold text-dark px-4">
                  Começar por {formatarPrecoPlano()}/{PLANO.ciclo}
                </Button>
                <Button as={Link} to="/login" variant="outline-light" size="lg">
                  Já tenho conta
                </Button>
              </div>
            </Col>
            <Col lg={6}>
              <Card className="landing-pricing-card shadow-lg border-0">
                <Card.Body className="p-4 p-md-5">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <span className="landing-plan-badge">Plano mensal</span>
                      <h2 className="h4 mb-0 mt-2 text-dark">{PLANO.nome}</h2>
                    </div>
                    <div className="text-end">
                      <div className="landing-price">{formatarPrecoPlano()}</div>
                      <div className="text-muted small">por {PLANO.ciclo}</div>
                    </div>
                  </div>

                  <h3 className="h6 text-uppercase text-muted mb-2">Módulos inclusos</h3>
                  <ListGroup variant="flush" className="mb-4">
                    {PLANO.modulos.map((item, index) => {
                      const Icon = MODULO_ICONS[index] || FaCheckCircle;
                      return (
                        <ListGroup.Item
                          key={item}
                          className="px-0 d-flex align-items-start gap-2 border-0 bg-transparent"
                        >
                          <Icon className="text-success mt-1 flex-shrink-0" />
                          <span className="text-dark">{item}</span>
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>

                  <h3 className="h6 text-uppercase text-muted mb-2">Benefícios</h3>
                  <ListGroup variant="flush" className="mb-4">
                    {PLANO.beneficios.map((item) => (
                      <ListGroup.Item
                        key={item}
                        className="px-0 d-flex align-items-start gap-2 border-0 bg-transparent"
                      >
                        <FaCheckCircle className="text-primary mt-1 flex-shrink-0" />
                        <span className="text-dark">{item}</span>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>

                  <Button
                    as={Link}
                    to="/assinar"
                    variant="primary"
                    size="lg"
                    className="w-100 fw-semibold"
                  >
                    Comprar acesso
                  </Button>
                  <p className="text-muted small text-center mt-3 mb-0">
                    Pagamento seguro via Mercado Pago. Não armazenamos dados do seu cartão.
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
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
