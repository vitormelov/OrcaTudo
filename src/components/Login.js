import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Form, Button, Alert, Container, Row, Col } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { FaSignInAlt } from 'react-icons/fa';
import Logo from './Logo';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, currentUser, perfil } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser && perfil && !perfil.bloqueado) {
      navigate('/empresas', { replace: true });
    }
  }, [currentUser, perfil, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/empresas');
    } catch (err) {
      setError(
        err.code === 'auth/user-blocked'
          ? err.message
          : 'Falha ao fazer login. Verifique o email e a senha.'
      );
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <Container fluid className="h-100">
        <Row className="h-100 justify-content-center align-items-center">
          <Col xs={12} sm={10} md={8} lg={6} xl={4}>
            <div className="text-center mb-4">
              <Logo height={160} className="mb-3 mx-auto" />
              <p className="text-light fs-5 mb-0">Sistema de gestão de orçamentos</p>
            </div>

            <Card className="login-card shadow-lg">
              <Card.Header className="text-center border-0 pb-0">
                <h4 className="mb-0">Entrar</h4>
              </Card.Header>
              <Card.Body className="pt-4">
                {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold text-dark">Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="form-control-lg"
                      placeholder="Digite seu email"
                    />
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-semibold text-dark">Senha</Form.Label>
                    <Form.Control
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="form-control-lg"
                      placeholder="Digite sua senha"
                    />
                  </Form.Group>
                  <Button
                    disabled={loading}
                    className="w-100 btn-lg fw-bold"
                    type="submit"
                    variant="primary"
                  >
                    {loading ? 'Carregando...' : (
                      <><FaSignInAlt className="me-2" />Entrar</>
                    )}
                  </Button>
                </Form>
                <p className="text-muted small text-center mt-3 mb-0">
                  Ainda não tem acesso?{' '}
                  <Link to="/assinar" className="fw-semibold">Assine o plano</Link>
                  {' · '}
                  <Link to="/" className="fw-semibold">Voltar à home</Link>
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Login;
