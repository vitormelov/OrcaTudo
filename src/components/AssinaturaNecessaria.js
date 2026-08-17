import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Card, Button, Alert } from 'react-bootstrap';
import { FaClock } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { TRIAL_DIAS } from '../constants/plano';

function AssinaturaNecessaria() {
  const { perfil } = useAuth();

  return (
    <Container className="py-5" style={{ maxWidth: 560 }}>
      <Card className="border-0 shadow text-center">
        <Card.Body className="p-4 p-md-5">
          <FaClock className="text-warning mb-3" size={48} />
          <h1 className="h3 mb-2">Seu período de teste acabou</h1>
          <p className="text-muted mb-4">
            O trial de {TRIAL_DIAS} dias
            {perfil?.displayName ? ` de ${perfil.displayName}` : ''} expirou.
            Para continuar usando o Orça Obra, escolha um plano.
          </p>
          <Alert variant="info" className="small text-start">
            Seus dados da empresa permanecem salvos. Ao assinar, o acesso é
            liberado de novo na mesma conta.
          </Alert>
          <div className="d-grid gap-2">
            <Button as={Link} to="/assinar?plano=empresa&ciclo=anual" variant="primary" size="lg">
              Ver planos e assinar
            </Button>
            <Button as={Link} to="/" variant="outline-secondary">
              Voltar à home
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default AssinaturaNecessaria;
