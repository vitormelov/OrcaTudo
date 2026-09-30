import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaClipboardCheck, FaPlay, FaEye, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';
import { formatCurrency } from '../../utils/formatters';
import { formatRevisao, getObraId, getRevisao } from '../../utils/eapCopy';
import { consolidarItens, resumoGestao } from '../../utils/gestao';
import {
  iniciarGestao,
  listarAjustesEmpresa,
  listarComprasEmpresa,
  listarGestoes,
  listarOrcamentosAprovados
} from './gestaoService';

function Gestao() {
  const { currentUser } = useAuth();
  const { empresaId, podeEditar } = useEmpresa();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aprovados, setAprovados] = useState([]);
  const [gestoes, setGestoes] = useState([]);
  const [compras, setCompras] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [iniciando, setIniciando] = useState('');

  useEffect(() => {
    if (!empresaId) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const [orcs, gs, cs, as] = await Promise.all([
        listarOrcamentosAprovados(empresaId),
        listarGestoes(empresaId),
        listarComprasEmpresa(empresaId),
        listarAjustesEmpresa(empresaId)
      ]);
      setAprovados(orcs);
      setGestoes(gs);
      setCompras(cs);
      setAjustes(as);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar a gestão: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const linhasGestao = useMemo(() => {
    return gestoes
      .map((g) => {
        const itens = consolidarItens(
          g.itens || [],
          compras.filter((c) => c.gestaoId === g.id),
          ajustes.filter((a) => a.gestaoId === g.id)
        );
        const resumo = resumoGestao(itens);
        // revisão aprovada mais nova da mesma obra ainda não refletida na gestão
        const novaRevisao = aprovados.find(
          (o) => getObraId(o) === g.obraId && o.id !== g.orcamentoId && getRevisao(o) > (g.revisao ?? 0)
        );
        return { gestao: g, resumo, novaRevisao };
      })
      .sort((a, b) => (a.gestao.nome || '').localeCompare(b.gestao.nome || ''));
  }, [gestoes, compras, ajustes, aprovados]);

  const pendentes = useMemo(() => {
    const obrasComGestao = new Set(gestoes.map((g) => g.obraId));
    const idsComGestao = new Set(gestoes.map((g) => g.orcamentoId));
    return aprovados.filter((o) => !idsComGestao.has(o.id) && !obrasComGestao.has(getObraId(o)));
  }, [aprovados, gestoes]);

  const totalGeral = useMemo(
    () =>
      linhasGestao.reduce(
        (t, { resumo }) => ({
          verba: t.verba + resumo.verbaAtual,
          comprado: t.comprado + resumo.comprado,
          estouro: t.estouro + resumo.estouro,
          economia: t.economia + resumo.economia
        }),
        { verba: 0, comprado: 0, estouro: 0, economia: 0 }
      ),
    [linhasGestao]
  );

  async function handleIniciar(orcamento) {
    if (!(orcamento.composicoes || []).length) {
      setError('Este orçamento não possui composições na EAP.');
      return;
    }
    setIniciando(orcamento.id);
    try {
      const g = await iniciarGestao(orcamento, { empresaId, userId: currentUser.uid });
      navigate(`/gestao/${g.id}`);
    } catch (err) {
      console.error(err);
      setError('Erro ao iniciar a gestão: ' + err.message);
      setIniciando('');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-2">
          <FaClipboardCheck className="me-2" />
          Gestão de Obras
        </h1>
        <p className="text-muted mb-0">
          Orçamentos aprovados viram obras em gestão: controle as compras de cada item e acompanhe verbas, estouros e economias.
        </p>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {linhasGestao.length > 0 && (
        <Row className="mb-4 g-3">
          <Col md={3} sm={6}>
            <Card body>
              <div className="kpi-label">Verba total</div>
              <div className="kpi-value">{formatCurrency(totalGeral.verba)}</div>
            </Card>
          </Col>
          <Col md={3} sm={6}>
            <Card body>
              <div className="kpi-label">Comprado</div>
              <div className="kpi-value">{formatCurrency(totalGeral.comprado)}</div>
            </Card>
          </Col>
          <Col md={3} sm={6}>
            <Card body>
              <div className="kpi-label">Estouros</div>
              <div className="kpi-value text-danger">{formatCurrency(totalGeral.estouro)}</div>
            </Card>
          </Col>
          <Col md={3} sm={6}>
            <Card body>
              <div className="kpi-label">Economias (itens encerrados)</div>
              <div className="kpi-value text-success">{formatCurrency(totalGeral.economia)}</div>
            </Card>
          </Col>
        </Row>
      )}

      {pendentes.length > 0 && (
        <Card className="mb-4">
          <Card.Header>Orçamentos aprovados aguardando início da gestão</Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Orçamento</th>
                  <th>Cliente</th>
                  <th>Rev.</th>
                  <th className="text-end">Custo direto (verba)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendentes.map((o) => (
                  <tr key={o.id}>
                    <td>{o.nome}</td>
                    <td>{o.cliente || '—'}</td>
                    <td>{formatRevisao(getRevisao(o))}</td>
                    <td className="text-end">{formatCurrency(o.valorTotal || 0)}</td>
                    <td className="text-end">
                      {podeEditar ? (
                        <Button size="sm" onClick={() => handleIniciar(o)} disabled={iniciando === o.id}>
                          <FaPlay className="me-1" />
                          {iniciando === o.id ? 'Iniciando...' : 'Iniciar gestão'}
                        </Button>
                      ) : (
                        <span className="text-muted small">Aguardando colaborador</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Header>Obras em gestão</Card.Header>
        <Card.Body className={linhasGestao.length ? 'p-0' : ''}>
          {linhasGestao.length === 0 ? (
            <p className="text-muted mb-0">
              Nenhuma obra em gestão. Quando um orçamento tiver o status <Badge bg="success">Aprovado</Badge>,
              ele aparecerá aqui para iniciar o controle de compras.
            </p>
          ) : (
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Rev.</th>
                  <th className="text-end">Verba</th>
                  <th className="text-end">Comprado</th>
                  <th className="text-end">Saldo</th>
                  <th style={{ minWidth: 140 }}>Consumo</th>
                  <th>Alertas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {linhasGestao.map(({ gestao, resumo, novaRevisao }) => {
                  const pct = resumo.verbaAtual > 0 ? (resumo.comprado / resumo.verbaAtual) * 100 : 0;
                  return (
                    <tr key={gestao.id}>
                      <td>
                        <div className="fw-semibold">{gestao.nome}</div>
                        <div className="small text-muted">{gestao.cliente}</div>
                      </td>
                      <td>
                        {formatRevisao(gestao.revisao)}
                        {novaRevisao && (
                          <Badge bg="warning" text="dark" className="ms-1" title="Há uma revisão aprovada mais nova">
                            Rev. {formatRevisao(getRevisao(novaRevisao))} aprovada
                          </Badge>
                        )}
                      </td>
                      <td className="text-end">{formatCurrency(resumo.verbaAtual)}</td>
                      <td className="text-end">{formatCurrency(resumo.comprado)}</td>
                      <td className={`text-end ${resumo.verbaAtual - resumo.comprado < 0 ? 'text-danger' : ''}`}>
                        {formatCurrency(resumo.verbaAtual - resumo.comprado)}
                      </td>
                      <td>
                        <ProgressBar
                          now={Math.min(pct, 100)}
                          variant={pct > 100 ? 'danger' : pct >= 90 ? 'warning' : 'success'}
                          label={`${pct.toFixed(0)}%`}
                        />
                      </td>
                      <td>
                        {resumo.itensEstouro > 0 && (
                          <Badge bg="danger" className="me-1">
                            <FaExclamationTriangle className="me-1" />
                            {resumo.itensEstouro} estouro{resumo.itensEstouro > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {resumo.itensAtencao > 0 && (
                          <Badge bg="warning" text="dark">{resumo.itensAtencao} atenção</Badge>
                        )}
                        {resumo.itensEstouro === 0 && resumo.itensAtencao === 0 && <span className="text-muted small">—</span>}
                      </td>
                      <td className="text-end">
                        <Button size="sm" variant="outline-primary" onClick={() => navigate(`/gestao/${gestao.id}`)}>
                          <FaEye className="me-1" />
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default Gestao;
