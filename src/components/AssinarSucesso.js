import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container, Card, Button, Alert } from 'react-bootstrap';
import { FaCheckCircle, FaLock } from 'react-icons/fa';
import Logo from './Logo';
import { formatarPrecoPlano, PLANO } from '../constants/plano';

function AssinarSucesso() {
  const location = useLocation();
  const email = location.state?.email;
  const nome = location.state?.nome;
  const nomeEmpresa = location.state?.nomeEmpresa;

  return (
    <div className="landing-page landing-checkout">
      <header className="landing-header">
        <Container>
          <div className="d-flex align-items-center justify-content-between py-3">
            <Link to="/" className="text-decoration-none">
              <Logo height={44} />
            </Link>
            <Button as={Link} to="/login" variant="outline-light" size="sm">
              Entrar
            </Button>
          </div>
        </Container>
      </header>

      <Container className="py-5" style={{ maxWidth: 640 }}>
        <Card className="border-0 shadow text-center">
          <Card.Body className="p-4 p-md-5">
            <FaCheckCircle className="text-success mb-3" size={56} />
            <h1 className="h3 mb-2">Dados recebidos</h1>
            <p className="text-muted mb-4">
              {nome ? `Obrigado, ${nome}. ` : ''}
              Registramos seu interesse no plano{' '}
              <strong>{PLANO.nome}</strong> ({formatarPrecoPlano()}/{PLANO.ciclo})
              {nomeEmpresa ? ` para ${nomeEmpresa}` : ''}.
            </p>

            <Alert variant="warning" className="text-start small">
              <FaLock className="me-2" />
              <strong>Integração em andamento:</strong> o redirecionamento real ao
              Mercado Pago e a criação automática da conta após o pagamento serão
              ligados em seguida (Cloud Function + webhook). Por enquanto este passo
              é o fluxo visual da compra.
            </Alert>

            {email && (
              <p className="small text-muted mb-4">
                Quando a cobrança estiver ativa, a conta será criada para{' '}
                <strong>{email}</strong> após a confirmação do pagamento.
              </p>
            )}

            <div className="d-grid gap-2">
              <Button as={Link} to="/login" variant="primary" size="lg">
                Ir para o login
              </Button>
              <Button as={Link} to="/" variant="outline-secondary">
                Voltar à home
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}

export default AssinarSucesso;
