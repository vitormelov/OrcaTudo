import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Row, 
  Col, 
  Table, 
  Badge,
  Alert,
  Spinner
} from 'react-bootstrap';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaBalanceScale, 
  FaChartLine,
  FaPercentage,
  FaDollarSign
} from 'react-icons/fa';
import { formatCurrency, formatCurrencyValue } from '../utils/formatters';

function Comparativo() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [orcamentos, setOrcamentos] = useState([]);
  const [orcamento1, setOrcamento1] = useState(null);
  const [orcamento2, setOrcamento2] = useState(null);
  const [orcamento1Data, setOrcamento1Data] = useState(null);
  const [orcamento2Data, setOrcamento2Data] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrcamentos();
  }, [currentUser]);

  const fetchOrcamentos = async () => {
    try {
      const orcamentosQuery = query(collection(db, 'orcamentos'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(orcamentosQuery);
      const orcamentosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrcamentos(orcamentosData);
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
      setError('Erro ao carregar orçamentos');
    }
  };

  const carregarOrcamento = async (orcamentoId) => {
    try {
      const orcamentoDoc = await getDoc(doc(db, 'orcamentos', orcamentoId));
      if (orcamentoDoc.exists()) {
        return { id: orcamentoDoc.id, ...orcamentoDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('Erro ao carregar orçamento:', error);
      return null;
    }
  };

  const handleComparar = async () => {
    if (!orcamento1 || !orcamento2) {
      setError('Selecione dois orçamentos para comparar');
      return;
    }

    if (orcamento1 === orcamento2) {
      setError('Selecione orçamentos diferentes para comparar');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [data1, data2] = await Promise.all([
        carregarOrcamento(orcamento1),
        carregarOrcamento(orcamento2)
      ]);

      if (data1 && data2) {
        setOrcamento1Data(data1);
        setOrcamento2Data(data2);
      } else {
        setError('Erro ao carregar dados dos orçamentos');
      }
    } catch (error) {
      setError('Erro ao carregar dados dos orçamentos');
    }

    setLoading(false);
  };

  const calcularValorTotal = (orcamento) => {
    if (!orcamento?.composicoes) return 0;
    return orcamento.composicoes.reduce((total, comp) => total + (comp.custoTotal || 0), 0);
  };

  const calcularValorComBDI = (orcamento) => {
    const valorBase = calcularValorTotal(orcamento);
    if (!orcamento?.bdiConfig) return valorBase;

    const { lucro, tributos, financeiro, garantias } = orcamento.bdiConfig;
    const bdi = (1 + lucro/100) * (1 + tributos/100) * (1 + financeiro/100) * (1 + garantias/100) - 1;
    return valorBase * (1 + bdi);
  };

  const calcularValorPacote = (orcamento, pacoteId) => {
    if (!orcamento?.composicoes) return 0;
    return orcamento.composicoes
      .filter(comp => comp.pacoteId === pacoteId)
      .reduce((total, comp) => total + (comp.custoTotal || 0), 0);
  };

  const calcularValorPacoteComBDI = (orcamento, pacoteId) => {
    const valorBase = calcularValorPacote(orcamento, pacoteId);
    if (!orcamento?.bdiConfig) return valorBase;

    const { lucro, tributos, financeiro, garantias } = orcamento.bdiConfig;
    const bdi = (1 + lucro/100) * (1 + tributos/100) * (1 + financeiro/100) * (1 + garantias/100) - 1;
    return valorBase * (1 + bdi);
  };

  const formatarBDI = (orcamento) => {
    if (!orcamento?.bdiConfig) return 'Não aplicado';
    
    const { lucro, tributos, financeiro, garantias } = orcamento.bdiConfig;
    const bdi = (1 + lucro/100) * (1 + tributos/100) * (1 + financeiro/100) * (1 + garantias/100) - 1;
    return `${(bdi * 100).toFixed(2)}%`;
  };

  const obterTodosPacotes = () => {
    const pacotes1 = orcamento1Data?.pacotes || [];
    const pacotes2 = orcamento2Data?.pacotes || [];
    
    const todosPacotes = new Set([
      ...pacotes1.map(p => p.nome),
      ...pacotes2.map(p => p.nome)
    ]);
    
    return Array.from(todosPacotes);
  };

  const obterPacotePorNome = (orcamento, nomePacote) => {
    if (!orcamento?.pacotes) return null;
    return orcamento.pacotes.find(p => p.nome === nomePacote);
  };

  const calcularDiferenca = (valor1, valor2) => {
    if (valor1 === 0 && valor2 === 0) return 0;
    if (valor1 === 0) return valor2;
    if (valor2 === 0) return valor1;
    
    return valor2 - valor1;
  };

  const obterCorDiferenca = (diferenca) => {
    if (diferenca === 0) return 'secondary';
    if (diferenca > 0) return 'success';
    return 'danger';
  };

  const formatarDiferenca = (diferenca) => {
    if (diferenca === 0) return '0,00';
    const prefixo = diferenca > 0 ? '+' : '';
    return `${prefixo}${formatCurrencyValue(diferenca)}`;
  };

  return (
    <div className="comparativo-page">
      {/* Cabeçalho */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/orcamentos')}
            className="mb-3"
          >
            <FaArrowLeft className="me-2" />
            Voltar aos Orçamentos
          </Button>
          <h1 className="mb-2">
            <FaBalanceScale className="me-2" />
            Comparativo de Orçamentos
          </h1>
          <p className="text-muted">
            Compare valores entre dois orçamentos para análise de custos
          </p>
        </div>
      </div>

      {/* Seleção de Orçamentos */}
      <Card className="mb-4">
        <Card.Header>
          <FaChartLine className="me-2" />
          Selecionar Orçamentos para Comparação
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Primeiro Orçamento</Form.Label>
                <Form.Select
                  value={orcamento1 || ''}
                  onChange={(e) => setOrcamento1(e.target.value)}
                >
                  <option value="">Selecione um orçamento...</option>
                  {orcamentos.map(orc => (
                    <option key={orc.id} value={orc.id}>
                      {orc.nome} - {orc.cliente}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Segundo Orçamento</Form.Label>
                <Form.Select
                  value={orcamento2 || ''}
                  onChange={(e) => setOrcamento2(e.target.value)}
                >
                  <option value="">Selecione um orçamento...</option>
                  {orcamentos.map(orc => (
                    <option key={orc.id} value={orc.id}>
                      {orc.nome} - {orc.cliente}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          
          <div className="text-center">
            <Button 
              onClick={handleComparar} 
              variant="primary" 
              disabled={!orcamento1 || !orcamento2 || loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Comparando...
                </>
              ) : (
                <>
                  <FaBalanceScale className="me-2" />
                  Comparar Orçamentos
                </>
              )}
            </Button>
          </div>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Resultado da Comparação */}
      {orcamento1Data && orcamento2Data && (
        <>
                     {/* Resumo Geral */}
           <Card className="mb-4">
             <Card.Header>
               <FaDollarSign className="me-2" />
               Resumo Geral
             </Card.Header>
             <Card.Body>
               <Table responsive hover>
                 <thead>
                   <tr>
                     <th>Item</th>
                     <th className="text-center">{orcamento1Data.nome}</th>
                     <th className="text-center">{orcamento2Data.nome}</th>
                     <th className="text-center">Diferença</th>
                     <th className="text-center">% Diferença</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr>
                     <td>
                       <strong>Valor Base</strong>
                     </td>
                     <td className="text-center">
                       <div className="h5 text-primary">
                         {formatCurrency(calcularValorTotal(orcamento1Data))}
                       </div>
                     </td>
                     <td className="text-center">
                       <div className="h5 text-primary">
                         {formatCurrency(calcularValorTotal(orcamento2Data))}
                       </div>
                     </td>
                     <td className="text-center">
                       <Badge bg={obterCorDiferenca(calcularDiferenca(calcularValorTotal(orcamento1Data), calcularValorTotal(orcamento2Data)))}>
                         {formatarDiferenca(calcularDiferenca(calcularValorTotal(orcamento1Data), calcularValorTotal(orcamento2Data)))}
                       </Badge>
                     </td>
                     <td className="text-center">
                       {calcularValorTotal(orcamento1Data) !== 0 ? (
                         <Badge bg={obterCorDiferenca(calcularDiferenca(calcularValorTotal(orcamento1Data), calcularValorTotal(orcamento2Data)) / calcularValorTotal(orcamento1Data) * 100)}>
                           {calcularDiferenca(calcularValorTotal(orcamento1Data), calcularValorTotal(orcamento2Data)) / calcularValorTotal(orcamento1Data) * 100 > 0 ? '+' : ''}{(calcularDiferenca(calcularValorTotal(orcamento1Data), calcularValorTotal(orcamento2Data)) / calcularValorTotal(orcamento1Data) * 100).toFixed(1)}%
                         </Badge>
                       ) : '-'}
                     </td>
                   </tr>
                   <tr>
                     <td>
                       <strong>Valor com BDI</strong>
                     </td>
                     <td className="text-center">
                       <div className="h5 text-success">
                         {formatCurrency(calcularValorComBDI(orcamento1Data))}
                       </div>
                     </td>
                     <td className="text-center">
                       <div className="h5 text-success">
                         {formatCurrency(calcularValorComBDI(orcamento2Data))}
                       </div>
                     </td>
                     <td className="text-center">
                       <Badge bg={obterCorDiferenca(calcularDiferenca(calcularValorComBDI(orcamento1Data), calcularValorComBDI(orcamento2Data)))}>
                         {formatarDiferenca(calcularDiferenca(calcularValorComBDI(orcamento1Data), calcularValorComBDI(orcamento2Data)))}
                       </Badge>
                     </td>
                     <td className="text-center">
                       {calcularValorComBDI(orcamento1Data) !== 0 ? (
                         <Badge bg={obterCorDiferenca(calcularDiferenca(calcularValorComBDI(orcamento1Data), calcularValorComBDI(orcamento2Data)) / calcularValorComBDI(orcamento1Data) * 100)}>
                           {calcularDiferenca(calcularValorComBDI(orcamento1Data), calcularValorComBDI(orcamento2Data)) / calcularValorComBDI(orcamento1Data) * 100 > 0 ? '+' : ''}{(calcularDiferenca(calcularValorComBDI(orcamento1Data), calcularValorComBDI(orcamento2Data)) / calcularValorComBDI(orcamento1Data) * 100).toFixed(1)}%
                         </Badge>
                       ) : '-'}
                     </td>
                   </tr>
                 </tbody>
               </Table>
             </Card.Body>
           </Card>

          {/* Comparação por Pacotes */}
          <Card className="mb-4">
            <Card.Header>
              <FaChartLine className="me-2" />
              Comparação por Pacotes
            </Card.Header>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Pacote</th>
                    <th className="text-center">{orcamento1Data.nome}</th>
                    <th className="text-center">{orcamento2Data.nome}</th>
                    <th className="text-center">Diferença</th>
                    <th className="text-center">% Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {obterTodosPacotes().map(nomePacote => {
                    const pacote1 = obterPacotePorNome(orcamento1Data, nomePacote);
                    const pacote2 = obterPacotePorNome(orcamento2Data, nomePacote);
                    
                    const valor1 = pacote1 ? calcularValorPacoteComBDI(orcamento1Data, pacote1.id) : 0;
                    const valor2 = pacote2 ? calcularValorPacoteComBDI(orcamento2Data, pacote2.id) : 0;
                    const diferenca = calcularDiferenca(valor1, valor2);
                    const percentual = valor1 !== 0 ? (diferenca / valor1) * 100 : 0;
                    
                    return (
                      <tr key={nomePacote}>
                        <td>
                          <strong>{nomePacote}</strong>
                          {!pacote1 && <Badge bg="warning" className="ms-2">Só no 2º</Badge>}
                          {!pacote2 && <Badge bg="warning" className="ms-2">Só no 1º</Badge>}
                        </td>
                        <td className="text-center">
                          {pacote1 ? formatCurrency(valor1) : '-'}
                        </td>
                        <td className="text-center">
                          {pacote2 ? formatCurrency(valor2) : '-'}
                        </td>
                        <td className="text-center">
                          <Badge bg={obterCorDiferenca(diferenca)}>
                            {formatarDiferenca(diferenca)}
                          </Badge>
                        </td>
                        <td className="text-center">
                          {valor1 !== 0 ? (
                            <Badge bg={obterCorDiferenca(percentual)}>
                              {percentual > 0 ? '+' : ''}{percentual.toFixed(1)}%
                            </Badge>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Comparação de BDI */}
          <Card className="mb-4">
            <Card.Header>
              <FaPercentage className="me-2" />
              Comparação de BDI
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={4}>
                  <div className="text-center">
                    <h6>BDI {orcamento1Data.nome}</h6>
                    <div className="h4 text-info">
                      {formatarBDI(orcamento1Data)}
                    </div>
                    {orcamento1Data.bdiConfig && (
                      <div className="small text-muted">
                        <div>Lucro: {orcamento1Data.bdiConfig.lucro}%</div>
                        <div>Tributos: {orcamento1Data.bdiConfig.tributos}%</div>
                        <div>Financeiro: {orcamento1Data.bdiConfig.financeiro}%</div>
                        <div>Garantias: {orcamento1Data.bdiConfig.garantias}%</div>
                      </div>
                    )}
                  </div>
                </Col>
                <Col md={4} className="text-center">
                  <div className="h2 text-muted">
                    <FaBalanceScale />
                  </div>
                  <p className="text-muted">Comparação</p>
                </Col>
                <Col md={4}>
                  <div className="text-center">
                    <h6>BDI {orcamento2Data.nome}</h6>
                    <div className="h4 text-info">
                      {formatarBDI(orcamento2Data)}
                    </div>
                    {orcamento2Data.bdiConfig && (
                      <div className="small text-muted">
                        <div>Lucro: {orcamento2Data.bdiConfig.lucro}%</div>
                        <div>Tributos: {orcamento2Data.bdiConfig.tributos}%</div>
                        <div>Financeiro: {orcamento2Data.bdiConfig.financeiro}%</div>
                        <div>Garantias: {orcamento2Data.bdiConfig.garantias}%</div>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}

export default Comparativo;
