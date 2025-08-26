import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { 
  FaBoxes, 
  FaLayerGroup, 
  FaFileInvoiceDollar, 
  FaPlus,
  FaChartLine,
  FaDollarSign,
  FaClipboardList
} from 'react-icons/fa';

function Dashboard() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    insumos: 0,
    composicoes: 0,
    orcamentos: 0,
    valorTotal: 0,
    valorTotalComBDI: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Contar insumos
        const insumosQuery = query(collection(db, 'insumos'), where('userId', '==', currentUser.uid));
        const insumosSnapshot = await getDocs(insumosQuery);
        
        // Contar composições
        const composicoesQuery = query(collection(db, 'composicoes'), where('userId', '==', currentUser.uid));
        const composicoesSnapshot = await getDocs(composicoesQuery);
        
        // Contar orçamentos
        const orcamentosQuery = query(collection(db, 'orcamentos'), where('userId', '==', currentUser.uid));
        const orcamentosSnapshot = await getDocs(orcamentosQuery);
        
        // Calcular valor total dos orçamentos (com BDI se aplicável)
        let valorTotal = 0;
        let valorTotalComBDI = 0;
        orcamentosSnapshot.forEach(doc => {
          const orcamento = doc.data();
          const valorBase = orcamento.valorTotal || 0;
          valorTotal += valorBase;
          
          // Calcular valor com BDI se configurado
          if (orcamento.bdiConfig) {
            const { lucro, tributos, financeiro, garantias } = orcamento.bdiConfig;
            const bdi = (1 + lucro/100) * (1 + tributos/100) * (1 + financeiro/100) * (1 + garantias/100) - 1;
            valorTotalComBDI += valorBase * (1 + bdi);
          } else {
            valorTotalComBDI += valorBase;
          }
        });

        setStats({
          insumos: insumosSnapshot.size,
          composicoes: composicoesSnapshot.size,
          orcamentos: orcamentosSnapshot.size,
          valorTotal: valorTotal,
          valorTotalComBDI: valorTotalComBDI
        });
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
      }
    };

    if (currentUser) {
      fetchStats();
    }
  }, [currentUser]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted">Bem-vindo ao sistema de orçamento de obra</p>
        </div>
        <div>
          <Button as={Link} to="/orcamentos" variant="primary" className="me-2">
            <FaPlus className="me-2" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="stats-card dashboard-card">
            <Card.Body className="text-center">
              <FaBoxes size={32} className="mb-2" />
              <div className="stats-number">{stats.insumos}</div>
              <div className="stats-label">Insumos</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stats-card dashboard-card">
            <Card.Body className="text-center">
              <FaLayerGroup size={32} className="mb-2" />
              <div className="stats-number">{stats.composicoes}</div>
              <div className="stats-label">Composições</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stats-card dashboard-card">
            <Card.Body className="text-center">
              <FaFileInvoiceDollar size={32} className="mb-2" />
              <div className="stats-number">{stats.orcamentos}</div>
              <div className="stats-label">Orçamentos</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stats-card dashboard-card">
            <Card.Body className="text-center">
              <FaDollarSign size={32} className="mb-2" />
              <div className="stats-number">
                R$ {stats.valorTotalComBDI.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="stats-label">Valor Total (c/ BDI)</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Ações Rápidas */}
      <Row className="mb-4">
        <Col md={6}>
          <Card className="dashboard-card">
            <Card.Header>
              <FaBoxes className="me-2" />
              Gerenciar Insumos
            </Card.Header>
            <Card.Body>
              <p>Adicione e gerencie os insumos básicos para suas composições.</p>
              <Button as={Link} to="/insumos" variant="outline-primary">
                Gerenciar Insumos
              </Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="dashboard-card">
            <Card.Header>
              <FaLayerGroup className="me-2" />
              Gerenciar Composições
            </Card.Header>
            <Card.Body>
              <p>Crie composições combinando insumos para serviços específicos.</p>
              <Button as={Link} to="/composicoes" variant="outline-primary">
                Gerenciar Composições
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Resumo Recente */}
      <Row>
        <Col md={12}>
          <Card className="dashboard-card">
            <Card.Header>
              <FaClipboardList className="me-2" />
              Resumo do Sistema
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={4}>
                  <h6>Insumos</h6>
                  <p className="text-muted">
                    {stats.insumos === 0 
                      ? 'Nenhum insumo cadastrado. Comece adicionando os materiais básicos.'
                      : `${stats.insumos} insumos cadastrados no sistema.`
                    }
                  </p>
                </Col>
                <Col md={4}>
                  <h6>Composições</h6>
                  <p className="text-muted">
                    {stats.composicoes === 0
                      ? 'Nenhuma composição criada. Crie composições para serviços específicos.'
                      : `${stats.composicoes} composições criadas.`
                    }
                  </p>
                </Col>
                <Col md={4}>
                  <h6>Orçamentos</h6>
                  <p className="text-muted">
                    {stats.orcamentos === 0
                      ? 'Nenhum orçamento criado. Comece criando seu primeiro orçamento.'
                      : `${stats.orcamentos} orçamentos criados com valor total de R$ ${stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
                    }
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
