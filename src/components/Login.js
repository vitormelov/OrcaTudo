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
    <div className="login-page">
      <Container fluid className="h-100">
        <Row className="h-100 justify-content-center align-items-center">
          <Col xs={12} sm={10} md={8} lg={6} xl={4}>
            <div className="text-center mb-4">
              <FaCalculator size={64} className="text-primary mb-3" />
              <h1 className="text-white fw-bold mb-2">Orçamento de Obra</h1>
              <p className="text-light fs-5">Sistema de gestão de orçamentos</p>
            </div>

            <Card className="login-card shadow-lg">
              <Card.Header className="text-center border-0 pb-0">
                <Tabs
                  activeKey={activeTab}
                  onSelect={(k) => setActiveTab(k)}
                  className="mb-0 border-0"
                  variant="pills"
                >
                  <Tab 
                    eventKey="login" 
                    title={
                      <div className="d-flex align-items-center justify-content-center">
                        <FaSignInAlt className="me-2" />
                        Entrar
                      </div>
                    }
                  />
                  <Tab 
                    eventKey="signup" 
                    title={
                      <div className="d-flex align-items-center justify-content-center">
                        <FaUserPlus className="me-2" />
                        Cadastrar
                      </div>
                    }
                  />
                </Tabs>
              </Card.Header>
              
              <Card.Body className="pt-4">
                {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
                
                <Form onSubmit={handleSubmit}>
                  {activeTab === 'signup' && (
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold text-dark">Nome Completo</Form.Label>
                      <Form.Control
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        className="form-control-lg"
                        placeholder="Digite seu nome completo"
                      />
                    </Form.Group>
                  )}

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

                  <Form.Group className="mb-3">
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

                  {activeTab === 'signup' && (
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold text-dark">Confirmar Senha</Form.Label>
                      <Form.Control
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="form-control-lg"
                        placeholder="Confirme sua senha"
                      />
                    </Form.Group>
                  )}

                  <Button
                    disabled={loading}
                    className="w-100 btn-lg fw-bold"
                    type="submit"
                    variant="primary"
                  >
                    {loading ? 'Carregando...' : (activeTab === 'signup' ? 'Criar Conta' : 'Entrar')}
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

export default Login;
