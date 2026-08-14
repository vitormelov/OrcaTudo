import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Card, Button, Alert, Badge, Table, Spinner, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { formatCurrency } from '../utils/formatters';
import { formatRevisao, getRevisao } from '../utils/eapCopy';
import { totalDoNo, calcularValorTotal } from '../utils/eapTree';
import {
  FaFileInvoiceDollar,
  FaPlus,
  FaEye,
  FaUserTie,
  FaLayerGroup,
  FaBoxes,
  FaCheckCircle
} from 'react-icons/fa';

const STATUS_ORCAMENTO = ['Em Análise', 'Aprovado', 'Rejeitado', 'Em Execução', 'Concluído'];

function valorComBDI(orcamento) {
  const base = orcamento.valorTotal || 0;
  if (!orcamento.bdiConfig) return base;
  const { lucro = 0, tributos = 0, financeiro = 0, garantias = 0 } = orcamento.bdiConfig;
  const bdi = (1 + lucro / 100) * (1 + tributos / 100) * (1 + financeiro / 100) * (1 + garantias / 100) - 1;
  return base * (1 + bdi);
}

function getStatusColor(status) {
  return ({
    'Em Análise': 'warning',
    Aprovado: 'success',
    Rejeitado: 'danger',
    'Em Execução': 'info',
    Concluído: 'primary'
  }[status] || 'secondary');
}

function tempoCriacao(orcamento) {
  if (orcamento.createdAt?.seconds) return orcamento.createdAt.seconds;
  if (orcamento.createdAt) return new Date(orcamento.createdAt).getTime() / 1000;
  return 0;
}

function Dashboard() {
  const { currentUser } = useAuth();
  const { empresaId, empresaNome, podeEditar } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [orcamentosAtivos, setOrcamentosAtivos] = useState([]);
  const [orcamentoResumoId, setOrcamentoResumoId] = useState('');
  const [stats, setStats] = useState({
    insumos: 0,
    composicoes: 0,
    orcamentos: 0,
    clientes: 0,
    valorAprovado: 0,
    orcamentosObsoletos: 0,
    porStatus: Object.fromEntries(STATUS_ORCAMENTO.map((s) => [s, 0]))
  });
  const [recentes, setRecentes] = useState([]);

  useEffect(() => {
    const carregar = async () => {
      if (!currentUser || !empresaId) return;
      setLoading(true);
      try {
        const [insumosSnap, composicoesSnap, orcSnap] = await Promise.all([
          getDocs(query(collection(db, 'insumos'), where('empresaId', '==', empresaId))),
          getDocs(query(collection(db, 'composicoes'), where('empresaId', '==', empresaId))),
          getDocs(query(collection(db, 'orcamentos'), where('empresaId', '==', empresaId)))
        ]);

        const orcamentos = orcSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const ativos = orcamentos
          .filter((o) => !o.revisaoTravada)
          .sort((a, b) => tempoCriacao(b) - tempoCriacao(a));
        const obsoletos = orcamentos.filter((o) => o.revisaoTravada);

        const clientesSet = new Set(
          orcamentos
            .map((o) => String(o.cliente || '').trim())
            .filter((c) => c.length > 0)
            .map((c) => c.toLowerCase())
        );
        const porStatus = Object.fromEntries(STATUS_ORCAMENTO.map((s) => [s, 0]));
        let valorAprovado = 0;
        ativos.forEach((o) => {
          const status = o.status || 'Em Análise';
          if (porStatus[status] != null) porStatus[status] += 1;
          else porStatus[status] = 1;
          if (status === 'Aprovado') {
            valorAprovado += valorComBDI(o);
          }
        });

        setOrcamentosAtivos(ativos);
        setOrcamentoResumoId((prev) => {
          if (prev && ativos.some((o) => o.id === prev)) return prev;
          return ativos[0]?.id || '';
        });
        setStats({
          insumos: insumosSnap.size,
          composicoes: composicoesSnap.size,
          orcamentos: orcamentos.length,
          clientes: clientesSet.size,
          valorAprovado,
          orcamentosObsoletos: obsoletos.length,
          porStatus
        });
        setRecentes(ativos.slice(0, 5));
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [currentUser, empresaId]);

  const orcamentoResumo = useMemo(
    () => orcamentosAtivos.find((o) => o.id === orcamentoResumoId) || null,
    [orcamentosAtivos, orcamentoResumoId]
  );

  const pacotesResumo = useMemo(() => {
    if (!orcamentoResumo) return [];
    const pacotes = [...(orcamentoResumo.pacotes || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return pacotes.map((p, idx) => ({
      id: p.id,
      nome: p.nome || `Pacote ${idx + 1}`,
      valor: totalDoNo(orcamentoResumo.composicoes, { pacoteId: p.id })
    }));
  }, [orcamentoResumo]);

  const totalResumo = useMemo(() => {
    if (!orcamentoResumo) return 0;
    if (pacotesResumo.length > 0) {
      return pacotesResumo.reduce((sum, p) => sum + (p.valor || 0), 0);
    }
    return calcularValorTotal(orcamentoResumo.composicoes) || orcamentoResumo.valorTotal || 0;
  }, [orcamentoResumo, pacotesResumo]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <p className="text-muted mt-3 mb-0">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted mb-0">Visão geral de {empresaNome || 'sua empresa'}</p>
        </div>
        {podeEditar && (
          <Button as={Link} to="/orcamentos" variant="primary">
            <FaPlus className="me-2" />
            Novo Orçamento
          </Button>
        )}
      </div>

      {!podeEditar && (
        <Alert variant="secondary" className="mb-4">
          Você está em modo somente leitura. Peça ao administrador a permissão de colaborador para criar, editar ou excluir.
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} lg>
          <Card className="stats-card dashboard-card h-100">
            <Card.Body className="text-center">
              <FaBoxes size={28} className="mb-2" />
              <div className="stats-number">{stats.insumos}</div>
              <div className="stats-label">Insumos criados</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg>
          <Card className="stats-card dashboard-card h-100">
            <Card.Body className="text-center">
              <FaLayerGroup size={28} className="mb-2" />
              <div className="stats-number">{stats.composicoes}</div>
              <div className="stats-label">Composições criadas</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg>
          <Card className="stats-card dashboard-card h-100">
            <Card.Body className="text-center">
              <FaFileInvoiceDollar size={28} className="mb-2" />
              <div className="stats-number">{stats.orcamentos}</div>
              <div className="stats-label">Orçamentos criados</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg>
          <Card className="stats-card dashboard-card h-100">
            <Card.Body className="text-center">
              <FaUserTie size={28} className="mb-2" />
              <div className="stats-number">{stats.clientes}</div>
              <div className="stats-label">Clientes</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg>
          <Card className="stats-card dashboard-card h-100">
            <Card.Body className="text-center">
              <FaCheckCircle size={28} className="mb-2" />
              <div className="stats-number" style={{ fontSize: '1.2rem' }}>
                {formatCurrency(stats.valorAprovado)}
              </div>
              <div className="stats-label">Valor total aprovado</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col xs={12} className="dashboard-col-span-3">
          <Card className="dashboard-card h-100">
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span>
                <FaLayerGroup className="me-2" />
                Resumo do orçamento
              </span>
              {orcamentosAtivos.length > 0 && (
                <Form.Select
                  size="sm"
                  style={{ maxWidth: 280 }}
                  value={orcamentoResumoId}
                  onChange={(e) => setOrcamentoResumoId(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {orcamentosAtivos.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome || 'Orçamento'} — Rev. {formatRevisao(getRevisao(o))}
                    </option>
                  ))}
                </Form.Select>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {!orcamentoResumo ? (
                <p className="text-muted p-3 mb-0">Nenhum orçamento ativo para resumir.</p>
              ) : pacotesResumo.length === 0 ? (
                <p className="text-muted p-3 mb-0">
                  Este orçamento ainda não possui pacotes na EAP.
                </p>
              ) : (
                <Table responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>Pacote</th>
                      <th className="text-end">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacotesResumo.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nome}</td>
                        <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(p.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <th className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(totalResumo)}
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              )}
            </Card.Body>
            {orcamentoResumo && (
              <Card.Footer className="bg-white d-flex justify-content-end">
                <Button
                  as={Link}
                  to={`/orcamentos/${orcamentoResumo.id}/eap`}
                  size="sm"
                  variant="outline-primary"
                >
                  <FaEye className="me-1" />
                  Ver EAP
                </Button>
              </Card.Footer>
            )}
          </Card>
        </Col>

        <Col xs={12} className="dashboard-col-span-2">
          <Card className="dashboard-card h-100">
            <Card.Header>
              <FaFileInvoiceDollar className="me-2" />
              Orçamentos por status
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                {STATUS_ORCAMENTO.map((status) => {
                  const qtd = stats.porStatus[status] || 0;
                  return (
                    <Col sm={6} key={status}>
                      <div className="dashboard-status-item">
                        <Badge bg={getStatusColor(status)} className="me-2">{status}</Badge>
                        <strong>{qtd}</strong>
                      </div>
                    </Col>
                  );
                })}
              </Row>
              {stats.orcamentosObsoletos > 0 && (
                <p className="text-muted small mt-3 mb-0">
                  {stats.orcamentosObsoletos} revisão(ões) obsoleta(s) arquivada(s).
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-card">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Orçamentos recentes</span>
          <Button as={Link} to="/orcamentos" size="sm" variant="outline-light">
            Ver todos
          </Button>
        </Card.Header>
        <Card.Body className="p-0">
          {recentes.length === 0 ? (
            <p className="text-muted p-3 mb-0">Nenhum orçamento criado ainda.</p>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cliente</th>
                  <th>Revisão</th>
                  <th>Status</th>
                  <th>Valor (c/ BDI)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.nome || '—'}</strong></td>
                    <td>{o.cliente || '—'}</td>
                    <td>Rev. {formatRevisao(getRevisao(o))}</td>
                    <td>
                      <Badge bg={getStatusColor(o.status)}>{o.status || 'Em Análise'}</Badge>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(valorComBDI(o))}
                    </td>
                    <td>
                      <Button
                        as={Link}
                        to={`/orcamentos/${o.id}/eap`}
                        size="sm"
                        variant="outline-info"
                        title="Ver EAP"
                      >
                        <FaEye />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default Dashboard;
