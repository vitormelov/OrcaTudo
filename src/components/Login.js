import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button, Alert, Container, Row, Col, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { FaSignInAlt, FaUserPlus, FaCalculator } from 'react-icons/fa';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('login');

  const { signup, login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (activeTab === 'signup' && password !== confirmPassword) {
      return setError('Senhas não coincidem');
    }

    try {
      setError('');
      setLoading(true);
      
      if (activeTab === 'signup') {
        await signup(email, password, displayName);
      } else {
        await login(email, password);
      }
      
      navigate('/');
    } catch (error) {
      setError(activeTab === 'signup' ? 'Falha ao criar conta' : 'Falha ao fazer login');
    }

    setLoading(false);
  }

  return (
    <Container>
      <Row className="justify-content-center">
        <Col md={6} lg={4}>
          <div className="text-center mb-4">
            <FaCalculator size={48} className="text-primary mb-3" />
            <h2>Orçamento de Obra</h2>
            <p className="text-muted">Sistema de gestão de orçamentos</p>
          </div>

          <Card>
            <Card.Header className="text-center">
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-0"
              >
                <Tab eventKey="login" title="Entrar">
                  <div className="d-flex align-items-center justify-content-center">
                    <FaSignInAlt className="me-2" />
                    Login
                  </div>
                </Tab>
                <Tab eventKey="signup" title="Cadastrar">
                  <div className="d-flex align-items-center justify-content-center">
                    <FaUserPlus className="me-2" />
                    Cadastro
                  </div>
                </Tab>
              </Tabs>
            </Card.Header>
            
            <Card.Body>
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                {activeTab === 'signup' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Nome Completo</Form.Label>
                    <Form.Control
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </Form.Group>
                )}

                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Senha</Form.Label>
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Form.Group>

                {activeTab === 'signup' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Confirmar Senha</Form.Label>
                    <Form.Control
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </Form.Group>
                )}

                <Button
                  disabled={loading}
                  className="w-100"
                  type="submit"
                >
                  {loading ? 'Carregando...' : (activeTab === 'signup' ? 'Cadastrar' : 'Entrar')}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Login;
