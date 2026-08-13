import React, { useState, useEffect, useMemo } from 'react';
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
import { useEmpresa } from '../contexts/EmpresaContext';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaBalanceScale,
  FaBoxes,
  FaLayerGroup,
  FaPlus,
  FaMinus,
  FaExchangeAlt,
  FaDollarSign
} from 'react-icons/fa';
import { formatCurrency, formatCurrencyValue } from '../utils/formatters';
import {
  agruparPorObra,
  labelRevisao,
  diffComposicoes,
  diffInsumos,
  getRevisao,
  caminhoComp
} from '../utils/revisaoDiff';

function Comparativo() {
  const { currentUser } = useAuth();
  const { empresaId } = useEmpresa();
  const navigate = useNavigate();
  const [orcamentos, setOrcamentos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [obraId, setObraId] = useState('');
  const [revAId, setRevAId] = useState('');
  const [revBId, setRevBId] = useState('');
  const [revA, setRevA] = useState(null);
  const [revB, setRevB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filtroComp, setFiltroComp] = useState('mudancas');

  useEffect(() => {
    if (currentUser && empresaId) carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, empresaId]);

  const carregarBase = async () => {
    try {
      const [orcSnap, insSnap] = await Promise.all([
        getDocs(query(collection(db, 'orcamentos'), where('empresaId', '==', empresaId))),
        getDocs(query(collection(db, 'insumos'), where('empresaId', '==', empresaId)))
      ]);
      setOrcamentos(orcSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setInsumos(insSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      setError('Erro ao carregar orçamentos');
    }
  };

  const obras = useMemo(() => agruparPorObra(orcamentos), [orcamentos]);
  const obraSelecionada = obras.find((o) => o.obraId === obraId);
  const revisoesDaObra = obraSelecionada?.revisoes || [];

  useEffect(() => {
    setRevAId('');
    setRevBId('');
    setRevA(null);
    setRevB(null);
  }, [obraId]);

  const carregarOrcamento = async (id) => {
    const snap = await getDoc(doc(db, 'orcamentos', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  };

  const handleComparar = async () => {
    if (!revAId || !revBId) {
      setError('Selecione duas revisões para comparar');
      return;
    }
    if (revAId === revBId) {
      setError('Selecione revisões diferentes');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [a, b] = await Promise.all([carregarOrcamento(revAId), carregarOrcamento(revBId)]);
      if (!a || !b) {
        setError('Erro ao carregar revisões');
      } else if (getRevisao(a) <= getRevisao(b)) {
        setRevA(a);
        setRevB(b);
      } else {
        setRevA(b);
        setRevB(a);
      }
    } catch (e) {
      console.error(e);
      setError('Erro ao comparar revisões');
    }
    setLoading(false);
  };

  const valorTotal = (o) =>
    (o?.composicoes || []).reduce((s, c) => s + (c.custoTotal || 0), 0);

  const valorComBDI = (o) => {
    const base = valorTotal(o);
    if (!o?.bdiConfig) return base;
    const { lucro, tributos, financeiro, garantias } = o.bdiConfig;
    const bdi =
      (1 + lucro / 100) * (1 + tributos / 100) * (1 + financeiro / 100) * (1 + garantias / 100) - 1;
    return base * (1 + bdi);
  };

  const corDelta = (d) => {
    if (!d || Math.abs(d) < 0.0001) return 'secondary';
    return d > 0 ? 'danger' : 'success';
  };

  const fmtDelta = (d) => {
    if (!d || Math.abs(d) < 0.0001) return '0,00';
    const p = d > 0 ? '+' : '';
    return `${p}${formatCurrencyValue(d)}`;
  };

  const fmtDeltaPct = (de, para) => {
    if (!de) return '—';
    const pct = ((para - de) / de) * 100;
    if (Math.abs(pct) < 0.05) return '0%';
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const diffComp = revA && revB ? diffComposicoes(revA, revB) : null;
  const diffIns = revA && revB ? diffInsumos(revA, revB, insumos) : null;

  const linhasComp = useMemo(() => {
    if (!diffComp) return [];
    const mudancas = [
      ...diffComp.adicionadas.map((x) => ({ tipo: 'adicionada', ...x })),
      ...diffComp.removidas.map((x) => ({ tipo: 'removida', ...x })),
      ...diffComp.modificadas.map((x) => ({ tipo: 'modificada', ...x }))
    ];
    if (filtroComp === 'mudancas') return mudancas;
    return [
      ...mudancas,
      ...diffComp.iguais.map((x) => ({
        tipo: 'igual',
        a: x.a,
        b: x.b,
        caminho: caminhoFromPair(revA, revB, x.a, x.b),
        nome: x.b?.nome || x.a?.nome
      }))
    ];
  }, [diffComp, filtroComp, revA, revB]);

  const linhasInsumo = useMemo(() => {
    if (!diffIns) return [];
    return [
      ...diffIns.adicionados.map((x) => ({ tipo: 'adicionado', ...x })),
      ...diffIns.removidos.map((x) => ({ tipo: 'removido', ...x })),
      ...diffIns.modificados.map((x) => ({ tipo: 'modificado', ...x }))
    ];
  }, [diffIns]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <Button variant="outline-secondary" onClick={() => navigate('/orcamentos')} className="mb-3">
            <FaArrowLeft className="me-2" />
            Voltar
          </Button>
          <h1 className="mb-2">
            <FaBalanceScale className="me-2" />
            Comparativo de Revisões
          </h1>
          <p className="text-muted mb-0">
            Compare duas revisões do mesmo orçamento e veja o que mudou em composições, quantidades, preços e insumos.
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <Card.Header>Selecionar projeto e revisões</Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Projeto / Orçamento</Form.Label>
                <Form.Select value={obraId} onChange={(e) => setObraId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {obras.map((o) => (
                    <option key={o.obraId} value={o.obraId}>
                      {o.nome} — {o.cliente} ({o.revisoes.length} rev.)
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Revisão base (antes)</Form.Label>
                <Form.Select
                  value={revAId}
                  onChange={(e) => setRevAId(e.target.value)}
                  disabled={!obraId}
                >
                  <option value="">Selecione...</option>
                  {revisoesDaObra.map((r) => (
                    <option key={r.id} value={r.id}>{labelRevisao(r)}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Revisão comparada (depois)</Form.Label>
                <Form.Select
                  value={revBId}
                  onChange={(e) => setRevBId(e.target.value)}
                  disabled={!obraId}
                >
                  <option value="">Selecione...</option>
                  {revisoesDaObra.map((r) => (
                    <option key={r.id} value={r.id}>{labelRevisao(r)}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          {obraId && revisoesDaObra.length < 2 && (
            <Alert variant="info" className="mb-3">
              Este projeto tem apenas uma revisão. Crie uma nova revisão no módulo de Orçamentos para comparar.
            </Alert>
          )}
          <Button
            variant="primary"
            onClick={handleComparar}
            disabled={!revAId || !revBId || loading || revAId === revBId}
          >
            {loading ? (
              <><Spinner animation="border" size="sm" className="me-2" />Comparando...</>
            ) : (
              <><FaBalanceScale className="me-2" />Comparar revisões</>
            )}
          </Button>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {revA && revB && diffComp && diffIns && (
        <>
          <Card className="mb-4">
            <Card.Header>
              <FaDollarSign className="me-2" />
              Resumo — {revA.nome} · {labelRevisao(revA)} → {labelRevisao(revB)}
            </Card.Header>
            <Card.Body>
              <Row className="mb-3 text-center">
                <Col md={3}>
                  <div className="text-muted small">Composições</div>
                  <div>
                    <Badge bg="success" className="me-1"><FaPlus /> {diffComp.adicionadas.length}</Badge>
                    <Badge bg="danger" className="me-1"><FaMinus /> {diffComp.removidas.length}</Badge>
                    <Badge bg="warning" text="dark"><FaExchangeAlt /> {diffComp.modificadas.length}</Badge>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-muted small">Insumos</div>
                  <div>
                    <Badge bg="success" className="me-1"><FaPlus /> {diffIns.adicionados.length}</Badge>
                    <Badge bg="danger" className="me-1"><FaMinus /> {diffIns.removidos.length}</Badge>
                    <Badge bg="warning" text="dark"><FaExchangeAlt /> {diffIns.modificados.length}</Badge>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-muted small">Valor base</div>
                  <strong>{formatCurrency(valorTotal(revA))}</strong>
                  <span className="mx-1">→</span>
                  <strong>{formatCurrency(valorTotal(revB))}</strong>
                  <div>
                    <Badge bg={corDelta(valorTotal(revB) - valorTotal(revA))}>
                      {fmtDelta(valorTotal(revB) - valorTotal(revA))}
                    </Badge>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-muted small">Valor c/ BDI</div>
                  <strong>{formatCurrency(valorComBDI(revA))}</strong>
                  <span className="mx-1">→</span>
                  <strong>{formatCurrency(valorComBDI(revB))}</strong>
                  <div>
                    <Badge bg={corDelta(valorComBDI(revB) - valorComBDI(revA))}>
                      {fmtDelta(valorComBDI(revB) - valorComBDI(revA))} ({fmtDeltaPct(valorComBDI(revA), valorComBDI(revB))})
                    </Badge>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span><FaLayerGroup className="me-2" />Composições</span>
              <Form.Select
                size="sm"
                style={{ width: 220 }}
                value={filtroComp}
                onChange={(e) => setFiltroComp(e.target.value)}
              >
                <option value="mudancas">Só alterações</option>
                <option value="todas">Todas (inclui iguais)</option>
              </Form.Select>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Caminho</th>
                    <th>Composição</th>
                    <th>Qtd {labelRevisao(revA)}</th>
                    <th>Qtd {labelRevisao(revB)}</th>
                    <th>Preço un. A</th>
                    <th>Preço un. B</th>
                    <th>Total A</th>
                    <th>Total B</th>
                    <th>Δ Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasComp.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center text-muted py-4">
                        Nenhuma alteração em composições entre essas revisões.
                      </td>
                    </tr>
                  ) : (
                    linhasComp.map((row, idx) => {
                      const a = row.a;
                      const b = row.b;
                      const caminho = row.caminho || '—';
                      const nome = row.nome || b?.nome || a?.nome || '—';
                      let badge = <Badge bg="secondary">Igual</Badge>;
                      if (row.tipo === 'adicionada') badge = <Badge bg="success">Adicionada</Badge>;
                      if (row.tipo === 'removida') badge = <Badge bg="danger">Removida</Badge>;
                      if (row.tipo === 'modificada') badge = <Badge bg="warning" text="dark">Modificada</Badge>;
                      const delta = (b?.custoTotal || 0) - (a?.custoTotal || 0);
                      return (
                        <tr key={`${row.tipo}-${row.key || idx}`}>
                          <td>{badge}</td>
                          <td><small>{caminho}</small></td>
                          <td>
                            <strong>{nome}</strong>
                            {row.tipo === 'modificada' && row.mudancas && (
                              <div className="small text-muted">
                                {row.mudancas.map((m) => m.campo).join(', ')}
                              </div>
                            )}
                          </td>
                          <td>{a ? `${a.quantidade} ${a.unidade || ''}` : '—'}</td>
                          <td>{b ? `${b.quantidade} ${b.unidade || ''}` : '—'}</td>
                          <td>{a ? formatCurrency(a.custoUnitario || 0) : '—'}</td>
                          <td>{b ? formatCurrency(b.custoUnitario || 0) : '—'}</td>
                          <td>{a ? formatCurrency(a.custoTotal || 0) : '—'}</td>
                          <td>{b ? formatCurrency(b.custoTotal || 0) : '—'}</td>
                          <td>
                            {row.tipo === 'igual' ? (
                              <Badge bg="secondary">0</Badge>
                            ) : (
                              <Badge bg={corDelta(delta)}>{fmtDelta(delta)}</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>
              <FaBoxes className="me-2" />
              Insumos (agregados)
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Código</th>
                    <th>Insumo</th>
                    <th>Un.</th>
                    <th>Qtd A</th>
                    <th>Qtd B</th>
                    <th>Preço A</th>
                    <th>Preço B</th>
                    <th>Valor A</th>
                    <th>Valor B</th>
                    <th>Δ Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasInsumo.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center text-muted py-4">
                        Nenhuma alteração de insumos entre essas revisões.
                      </td>
                    </tr>
                  ) : (
                    linhasInsumo.map((row, idx) => {
                      let badge = null;
                      let qA = 0;
                      let qB = 0;
                      let pA = 0;
                      let pB = 0;
                      let vA = 0;
                      let vB = 0;
                      if (row.tipo === 'adicionado') {
                        badge = <Badge bg="success">Adicionado</Badge>;
                        qB = row.quantidade;
                        pB = row.precoUnitario;
                        vB = row.valorTotal;
                      } else if (row.tipo === 'removido') {
                        badge = <Badge bg="danger">Removido</Badge>;
                        qA = row.quantidade;
                        pA = row.precoUnitario;
                        vA = row.valorTotal;
                      } else {
                        badge = <Badge bg="warning" text="dark">Modificado</Badge>;
                        const mQ = row.mudancas?.find((m) => m.campo === 'quantidade');
                        const mP = row.mudancas?.find((m) => m.campo === 'preço unitário');
                        const mV = row.mudancas?.find((m) => m.campo === 'valor total');
                        qA = mQ ? mQ.de : row.quantidade - (row.deltaQtd || 0);
                        qB = mQ ? mQ.para : row.quantidade;
                        pA = mP ? mP.de : row.precoUnitario;
                        pB = mP ? mP.para : row.precoUnitario;
                        vA = mV ? mV.de : row.valorTotal - (row.deltaValor || 0);
                        vB = mV ? mV.para : row.valorTotal;
                      }
                      const delta = vB - vA;
                      return (
                        <tr key={`${row.tipo}-${row.insumoId}-${idx}`}>
                          <td>{badge}</td>
                          <td>{row.codigo || '—'}</td>
                          <td>
                            <strong>{row.nome}</strong>
                            {row.categoria && <div className="small text-muted">{row.categoria}</div>}
                          </td>
                          <td>{row.unidade || '—'}</td>
                          <td>{row.tipo === 'adicionado' ? '—' : qA.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
                          <td>{row.tipo === 'removido' ? '—' : qB.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
                          <td>{row.tipo === 'adicionado' ? '—' : formatCurrency(pA)}</td>
                          <td>{row.tipo === 'removido' ? '—' : formatCurrency(pB)}</td>
                          <td>{row.tipo === 'adicionado' ? '—' : formatCurrency(vA)}</td>
                          <td>{row.tipo === 'removido' ? '—' : formatCurrency(vB)}</td>
                          <td><Badge bg={corDelta(delta)}>{fmtDelta(delta)}</Badge></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}

function caminhoFromPair(revA, revB, a, b) {
  if (b) return caminhoComp(revB, b);
  if (a) return caminhoComp(revA, a);
  return '—';
}

export default Comparativo;
