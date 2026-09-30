import React, { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, ButtonGroup, Card, Col, Dropdown, Form, InputGroup,
  Modal, ProgressBar, Row, Spinner, Tab, Tabs
} from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaArrowLeft, FaPlus, FaFileImport, FaExchangeAlt, FaSyncAlt, FaFileExcel,
  FaSearch, FaEdit, FaTrash, FaLock, FaLockOpen, FaChevronDown, FaChevronRight, FaEllipsisV
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';
import { formatCurrency } from '../../utils/formatters';
import { formatRevisao, getObraId, getRevisao } from '../../utils/eapCopy';
import { calcularValorComBdi } from '../../utils/bdi';
import {
  STATUS_ITEM, consolidarItens, formatDataCurta, formatDataISO, montarArvore, resumoGestao, totalCompra
} from '../../utils/gestao';
import {
  atualizarGestao, carregarGestao, carregarOrcamento, excluirAjuste, excluirCompra,
  importarCompras, listarOrcamentosAprovados, ressincronizarGestao, salvarAjuste, salvarCompra
} from './gestaoService';
import CompraModal from './CompraModal';
import AjusteModal from './AjusteModal';
import ImportarInformakonModal from './ImportarInformakonModal';
import MenuAcoes from './MenuAcoes';
import './gestao.css';

function Kpi({ label, value, className = '', sub }) {
  return (
    <Card body className="h-100">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${className}`}>{value}</div>
      {sub && <div className="small text-muted">{sub}</div>}
    </Card>
  );
}

function corConsumo(pct) {
  return pct > 100 ? 'danger' : pct >= 90 ? 'warning' : 'success';
}

function Consumo({ comprado, verba }) {
  if (!(verba > 0)) {
    return <div className="gestao-consumo"><span style={{ width: 'auto' }}>{comprado > 0 ? 'sem verba' : '—'}</span></div>;
  }
  const pct = (comprado / verba) * 100;
  return (
    <div className="gestao-consumo" title={`${pct.toFixed(1)}%`}>
      <ProgressBar now={Math.min(pct, 100)} variant={corConsumo(pct)} />
      <span>{pct.toFixed(0)}%</span>
    </div>
  );
}

function GestaoObra() {
  const { id: gestaoId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { empresaId, podeEditar } = useEmpresa();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [gestao, setGestao] = useState(null);
  const [compras, setCompras] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [revisaoNova, setRevisaoNova] = useState(null);

  const [aba, setAba] = useState('itens');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [expandidos, setExpandidos] = useState(() => new Set());
  const [recolhidos, setRecolhidos] = useState(() => new Set());

  const [compraModal, setCompraModal] = useState({ show: false, compra: null, itemId: '' });
  const [ajusteModal, setAjusteModal] = useState({ show: false, itemId: '' });
  const [showImportar, setShowImportar] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  const ctx = { empresaId, userId: currentUser?.uid, gestaoId };

  useEffect(() => {
    if (!empresaId || !gestaoId) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, gestaoId]);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const r = await carregarGestao(empresaId, gestaoId);
      if (!r.gestao) {
        setError('Obra em gestão não encontrada.');
        return;
      }
      setGestao(r.gestao);
      setCompras(r.compras);
      setAjustes(r.ajustes);
      const aprovados = await listarOrcamentosAprovados(empresaId);
      setRevisaoNova(
        aprovados
          .filter((o) => getObraId(o) === r.gestao.obraId && o.id !== r.gestao.orcamentoId && getRevisao(o) > (r.gestao.revisao ?? 0))
          .sort((a, b) => getRevisao(b) - getRevisao(a))[0] || null
      );
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function recarregarMovimentos() {
    const r = await carregarGestao(empresaId, gestaoId);
    setCompras(r.compras);
    setAjustes(r.ajustes);
    if (r.gestao) setGestao(r.gestao);
  }

  const itens = useMemo(
    () => (gestao ? consolidarItens(gestao.itens, compras, ajustes) : []),
    [gestao, compras, ajustes]
  );
  const itensPorId = useMemo(() => new Map(itens.map((it) => [it.id, it])), [itens]);
  const resumo = useMemo(() => resumoGestao(itens), [itens]);

  const refsExistentes = useMemo(() => {
    const s = new Set();
    compras.forEach((c) => (c.linhas || []).forEach((l) => l.informakonRef && s.add(l.informakonRef)));
    return s;
  }, [compras]);

  const linhasPorItem = useMemo(() => {
    const m = new Map();
    compras.forEach((c) =>
      (c.linhas || []).forEach((l) => {
        if (!m.has(l.itemId)) m.set(l.itemId, []);
        m.get(l.itemId).push({ ...l, compra: c });
      })
    );
    m.forEach((arr) => arr.sort((a, b) => String(b.compra.data).localeCompare(String(a.compra.data))));
    return m;
  }, [compras]);

  const itensFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens.filter((it) => {
      if (filtroStatus && it.status !== filtroStatus) return false;
      if (it.removido && it.comprado === 0 && it.ajustes === 0) return false;
      if (!t) return true;
      return [it.numero, it.codigo, it.descricao, it.caminho].some((x) => String(x || '').toLowerCase().includes(t));
    });
  }, [itens, busca, filtroStatus]);

  const arvore = useMemo(() => montarArvore(itensFiltrados), [itensFiltrados]);
  const resumoFiltrado = useMemo(() => resumoGestao(itensFiltrados), [itensFiltrados]);
  const todosNos = useMemo(() => {
    const lista = [];
    const walk = (ns) => ns.forEach((n) => {
      if (n.tipo !== 'no') return;
      lista.push(n.numero);
      walk(n.filhos);
    });
    walk(montarArvore(itens));
    return lista;
  }, [itens]);

  const comprasOrdenadas = useMemo(
    () => [...compras].sort((a, b) => String(b.data).localeCompare(String(a.data))),
    [compras]
  );

  const toggle = (id) =>
    setExpandidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleNo = (numero) =>
    setRecolhidos((prev) => {
      const n = new Set(prev);
      if (n.has(numero)) n.delete(numero);
      else n.add(numero);
      return n;
    });

  const CLASSE_NIVEL = ['gt-pacote', 'gt-grupo', 'gt-subgrupo'];
  const INDENT = 12;

  function renderNo(n, profundidade = 0) {
    if (n.tipo === 'item') return renderItem(n.item, profundidade);
    const r = resumoGestao(n.itens);
    const aberto = !recolhidos.has(n.numero);
    const saldo = r.verbaAtual - r.comprado;
    const ajuste = r.verbaAtual - r.verbaOrcada;
    return (
      <Fragment key={`no-${n.numero}`}>
        <tr className={CLASSE_NIVEL[n.nivel] || 'gt-subgrupo'}>
          <td className="centro">
            <Button variant="link" size="sm" className="gestao-toggle" onClick={() => toggleNo(n.numero)} title={aberto ? 'Recolher' : 'Expandir'}>
              {aberto ? <FaChevronDown /> : <FaChevronRight />}
            </Button>
          </td>
          <td>{n.numero}</td>
          <td className="desc" style={{ paddingLeft: 4 + n.nivel * INDENT }}>{n.nome}</td>
          <td />
          <td />
          <td className="num">{formatCurrency(r.verbaOrcada)}</td>
          <td className={`num ${ajuste < 0 ? 'text-danger' : ''}`}>
            {Math.abs(ajuste) > 0.004 ? formatCurrency(ajuste) : '—'}
          </td>
          <td className="num">{formatCurrency(r.comprado)}</td>
          <td className={`num ${saldo < 0 ? 'text-danger' : n.nivel === 0 ? 'gt-total-pacote' : ''}`}>{formatCurrency(saldo)}</td>
          <td><Consumo comprado={r.comprado} verba={r.verbaAtual} /></td>
          <td />
        </tr>
        {aberto && n.filhos.map((f) => renderNo(f, profundidade + 1))}
      </Fragment>
    );
  }

  function renderItem(it, profundidade) {
    const aberto = expandidos.has(it.id);
    const linhasItem = linhasPorItem.get(it.id) || [];
    const recuo = 4 + profundidade * INDENT;
    return (
      <Fragment key={it.id}>
        <tr className="gt-item">
          <td className="centro">
            {linhasItem.length > 0 && (
              <Button variant="link" size="sm" className="gestao-toggle" onClick={() => toggle(it.id)} title="Ver compras do item">
                {aberto ? <FaChevronDown /> : <FaChevronRight />}
              </Button>
            )}
          </td>
          <td>{it.numero}</td>
          <td className="desc" style={{ paddingLeft: recuo }}>
            <div>
              {it.codigo && <span className="text-muted">{it.codigo} · </span>}
              {it.descricao}
            </div>
            {(it.removido || it.encerrado || linhasItem.length > 0) && (
              <div className="small text-muted">
                {it.removido && <Badge bg="secondary" className="me-1">removido do orçamento</Badge>}
                {it.encerrado && <Badge bg="dark" className="me-1"><FaLock className="me-1" />encerrado</Badge>}
                {linhasItem.length > 0 && <>{linhasItem.length} lançamento(s)</>}
              </div>
            )}
          </td>
          <td className="centro">{it.unidade}</td>
          <td className="num">{Number(it.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
          <td className="num">{formatCurrency(it.verbaOrcada)}</td>
          <td className={`num ${it.ajustes < 0 ? 'text-danger' : it.ajustes > 0 ? 'text-success' : 'text-muted'}`}>
            {it.ajustes ? formatCurrency(it.ajustes) : '—'}
          </td>
          <td className="num">{formatCurrency(it.comprado)}</td>
          <td className={`num ${it.saldo < 0 ? 'text-danger fw-semibold' : ''}`}>{formatCurrency(it.saldo)}</td>
          <td><Consumo comprado={it.comprado} verba={it.verbaAtual} /></td>
          <td className="centro">
            {podeEditar && (
              <MenuAcoes
                acoes={[
                  { label: 'Lançar compra', icon: <FaPlus />, onClick: () => setCompraModal({ show: true, compra: null, itemId: it.id }) },
                  { label: 'Ajustar verba', icon: <FaExchangeAlt />, onClick: () => setAjusteModal({ show: true, itemId: it.id }) },
                  it.encerrado
                    ? { label: 'Reabrir item', icon: <FaLockOpen />, onClick: () => toggleEncerrado(it) }
                    : { label: 'Encerrar item (apurar economia)', icon: <FaLock />, onClick: () => toggleEncerrado(it) }
                ]}
              />
            )}
          </td>
        </tr>
        {aberto && linhasItem.map((l, i) => (
          <tr key={`${it.id}-${i}`} className="gt-detalhe">
            <td />
            <td title={formatDataISO(l.compra.data)}>{formatDataCurta(l.compra.data)}</td>
            <td className="desc" style={{ paddingLeft: recuo + INDENT }}>
              <div>
                {l.descricao || '—'}
                {l.quantidade > 0 && <> · {formatCurrency(l.valorUnitario)}/{l.unidade || 'un'}</>}
              </div>
              <div>
                {l.compra.documento && <>Doc. {l.compra.documento} · </>}
                {l.compra.fornecedor}
                {l.compra.origem === 'informakon' && <Badge bg="light" text="dark" className="ms-1">Informakon</Badge>}
              </div>
            </td>
            <td className="centro">{l.unidade}</td>
            <td className="num">{l.quantidade ? Number(l.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : ''}</td>
            <td />
            <td />
            <td className="num">{formatCurrency(l.valorTotal)}</td>
            <td colSpan={3} />
          </tr>
        ))}
      </Fragment>
    );
  }

  async function handleSalvarCompra(compra) {
    await salvarCompra(compra, ctx);
    await recarregarMovimentos();
    setInfo('Compra salva.');
  }

  async function handleExcluirCompra(compra) {
    if (!window.confirm(`Excluir a compra ${compra.documento || ''} de ${formatCurrency(totalCompra(compra))}?`)) return;
    try {
      await excluirCompra(compra.id);
      await recarregarMovimentos();
    } catch (err) {
      setError('Erro ao excluir compra: ' + err.message);
    }
  }

  async function handleSalvarAjuste(ajuste) {
    await salvarAjuste(ajuste, ctx);
    await recarregarMovimentos();
    setInfo('Ajuste de verba registrado.');
  }

  async function handleExcluirAjuste(ajuste) {
    if (!window.confirm('Excluir este ajuste de verba?')) return;
    try {
      await excluirAjuste(ajuste.id);
      await recarregarMovimentos();
    } catch (err) {
      setError('Erro ao excluir ajuste: ' + err.message);
    }
  }

  async function handleImportar(comprasImportadas, novoMapa) {
    await importarCompras(comprasImportadas, ctx);
    await atualizarGestao(gestao.id, { mapaInformakon: novoMapa });
    await recarregarMovimentos();
    const n = comprasImportadas.reduce((s, c) => s + c.linhas.length, 0);
    setInfo(`${n} linha(s) importada(s) do Informakon em ${comprasImportadas.length} compra(s).`);
  }

  async function toggleEncerrado(item) {
    const novos = gestao.itens.map((it) => (it.id === item.id ? { ...it, encerrado: !it.encerrado } : it));
    try {
      await atualizarGestao(gestao.id, { itens: novos });
      setGestao({ ...gestao, itens: novos });
    } catch (err) {
      setError('Erro ao atualizar item: ' + err.message);
    }
  }

  async function handleSincronizar(orcamentoAlvoId) {
    setSincronizando(true);
    try {
      const orc = await carregarOrcamento(orcamentoAlvoId);
      if (!orc) throw new Error('Orçamento não encontrado');
      const atualizada = await ressincronizarGestao(gestao, orc, compras);
      setGestao(atualizada);
      setShowSync(false);
      setRevisaoNova(null);
      setInfo(`Linha de base atualizada com a Rev. ${formatRevisao(getRevisao(orc))} do orçamento.`);
    } catch (err) {
      setError('Erro ao atualizar a linha de base: ' + err.message);
    } finally {
      setSincronizando(false);
    }
  }

  async function exportarExcel() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const cab = ['Item', 'Código', 'Descrição', 'Un.', 'Qtd.', 'Verba orçada', 'Ajustes', 'Verba atual', 'Comprado', 'Saldo', '% consumo', 'Situação'];
    const linhas = itens
      .filter((it) => !(it.removido && it.comprado === 0))
      .map((it) => [
        it.numero, it.codigo, it.descricao + (it.removido ? ' (removido)' : ''), it.unidade, it.quantidade,
        it.verbaOrcada, it.ajustes, it.verbaAtual, it.comprado, it.saldo,
        Number.isFinite(it.consumo) ? Math.round(it.consumo * 10000) / 100 : '',
        STATUS_ITEM[it.status]?.label
      ]);
    linhas.push(['', '', 'TOTAL', '', '', resumo.verbaOrcada, resumo.verbaAtual - resumo.verbaOrcada, resumo.verbaAtual, resumo.comprado, resumo.verbaAtual - resumo.comprado, '', '']);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ...linhas]), 'Verbas por item');

    const cabC = ['Data', 'Documento', 'Fornecedor', 'Origem', 'Item', 'Descrição item', 'Descrição compra', 'Un.', 'Qtd.', 'Vl. unit.', 'Vl. total'];
    const linhasC = [];
    comprasOrdenadas.forEach((c) =>
      (c.linhas || []).forEach((l) => {
        const it = itensPorId.get(l.itemId);
        linhasC.push([
          formatDataISO(c.data), c.documento, c.fornecedor, c.origem === 'informakon' ? 'Informakon' : 'Manual',
          it?.numero || '', it?.descricao || '', l.descricao, l.unidade, l.quantidade, l.valorUnitario, l.valorTotal
        ]);
      })
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabC, ...linhasC]), 'Compras');

    const cabA = ['Data', 'Tipo', 'Origem', 'Destino', 'Valor', 'Motivo'];
    const linhasA = ajustes.map((a) => [
      formatDataISO(a.data), a.tipo === 'remanejamento' ? 'Remanejamento' : 'Aditivo/supressão',
      itensPorId.get(a.itemOrigemId)?.numero || '', itensPorId.get(a.itemDestinoId)?.numero || '', a.valor, a.motivo
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabA, ...linhasA]), 'Ajustes de verba');

    XLSX.writeFile(wb, `Gestao - ${gestao.nome || 'obra'}.xlsx`);
  }

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" /></div>;
  }

  if (!gestao) {
    return (
      <div>
        <Button variant="outline-secondary" onClick={() => navigate('/gestao')} className="mb-3">
          <FaArrowLeft className="me-2" />Voltar
        </Button>
        <Alert variant="danger">{error || 'Obra não encontrada.'}</Alert>
      </div>
    );
  }

  const pctGeral = resumo.verbaAtual > 0 ? (resumo.comprado / resumo.verbaAtual) * 100 : 0;
  const vendaComBdi = gestao.bdiConfig ? calcularValorComBdi(resumo.verbaOrcada, gestao.bdiConfig) : null;

  return (
    <div>
      <Button variant="outline-secondary" onClick={() => navigate('/gestao')} className="mb-3">
        <FaArrowLeft className="me-2" />Voltar
      </Button>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="mb-1">{gestao.nome}</h1>
          <div className="text-muted">
            {gestao.cliente && <>{gestao.cliente} · </>}
            Rev. {formatRevisao(gestao.revisao)} aprovada
            {gestao.endereco && <> · {gestao.endereco}</>}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {podeEditar && (
            <>
              <Button onClick={() => setCompraModal({ show: true, compra: null, itemId: '' })}>
                <FaPlus className="me-1" />Nova compra
              </Button>
              <Button variant="outline-primary" onClick={() => setShowImportar(true)}>
                <FaFileImport className="me-1" />Importar Informakon
              </Button>
              <Button variant="outline-primary" onClick={() => setAjusteModal({ show: true, itemId: '' })}>
                <FaExchangeAlt className="me-1" />Ajuste de verba
              </Button>
            </>
          )}
          <Dropdown as={ButtonGroup}>
            <Dropdown.Toggle variant="outline-secondary"><FaEllipsisV /></Dropdown.Toggle>
            <Dropdown.Menu align="end">
              <Dropdown.Item onClick={exportarExcel}><FaFileExcel className="me-2" />Exportar Excel</Dropdown.Item>
              {podeEditar && (
                <Dropdown.Item onClick={() => setShowSync(true)}><FaSyncAlt className="me-2" />Atualizar linha de base</Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {info && <Alert variant="success" dismissible onClose={() => setInfo('')}>{info}</Alert>}
      {revisaoNova && podeEditar && (
        <Alert variant="warning" className="d-flex flex-wrap align-items-center gap-2">
          <span>
            A <strong>Rev. {formatRevisao(getRevisao(revisaoNova))}</strong> deste orçamento foi aprovada.
            Atualize a linha de base para usar as novas verbas (as compras já lançadas são mantidas).
          </span>
          <Button size="sm" variant="warning" className="ms-auto" disabled={sincronizando} onClick={() => handleSincronizar(revisaoNova.id)}>
            {sincronizando ? 'Atualizando...' : `Usar Rev. ${formatRevisao(getRevisao(revisaoNova))}`}
          </Button>
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} xl>
          <Kpi
            label="Verba atual (custo direto)"
            value={formatCurrency(resumo.verbaAtual)}
            sub={resumo.verbaAtual !== resumo.verbaOrcada ? `Orçada: ${formatCurrency(resumo.verbaOrcada)}` : (vendaComBdi ? `Venda c/ BDI: ${formatCurrency(vendaComBdi)}` : null)}
          />
        </Col>
        <Col xs={12} sm={6} xl>
          <Card body className="h-100">
            <div className="kpi-label">Comprado</div>
            <div className="kpi-value">{formatCurrency(resumo.comprado)}</div>
            <div className="gestao-consumo mt-1">
              <ProgressBar now={Math.min(pctGeral, 100)} variant={corConsumo(pctGeral)} />
              <span>{pctGeral.toFixed(0)}%</span>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={4} xl>
          <Kpi label="Saldo" value={formatCurrency(resumo.verbaAtual - resumo.comprado)} className={resumo.verbaAtual - resumo.comprado < 0 ? 'text-danger' : ''} />
        </Col>
        <Col xs={12} sm={4} xl>
          <Kpi label="Estouros" value={formatCurrency(resumo.estouro)} className="text-danger" sub={`${resumo.itensEstouro} item(ns)`} />
        </Col>
        <Col xs={12} sm={4} xl>
          <Kpi label="Economias" value={formatCurrency(resumo.economia)} className="text-success" sub="em itens encerrados" />
        </Col>
      </Row>

      <Tabs activeKey={aba} onSelect={(k) => setAba(k)} className="mb-3">
        <Tab eventKey="itens" title={`Verbas por item (${itens.filter((i) => !i.removido).length})`}>
          <Card className="mb-2">
            <div className="gestao-toolbar">
              <InputGroup style={{ maxWidth: 380 }}>
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control placeholder="Buscar por nº, código ou descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </InputGroup>
              <Form.Select style={{ maxWidth: 220 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                <option value="">Todas as situações</option>
                {Object.entries(STATUS_ITEM).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </Form.Select>
              <div className="ms-auto d-flex gap-2">
                <Button size="sm" variant="outline-secondary" onClick={() => setRecolhidos(new Set())}>Expandir tudo</Button>
                <Button size="sm" variant="outline-secondary" onClick={() => setRecolhidos(new Set(todosNos))}>Recolher tudo</Button>
              </div>
            </div>
            <div className="gestao-tabela-wrap">
              <table className="gestao-tabela fixa largura-itens">
                <colgroup>
                  <col style={{ width: 30 }} />
                  <col style={{ width: 66 }} />
                  <col />
                  <col style={{ width: 46 }} />
                  <col style={{ width: 76 }} />
                  <col style={{ width: 118 }} />
                  <col style={{ width: 106 }} />
                  <col style={{ width: 118 }} />
                  <col style={{ width: 118 }} />
                  <col style={{ width: 106 }} />
                  <col style={{ width: 60 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th />
                    <th>Item</th>
                    <th>Descrição</th>
                    <th className="centro">Un.</th>
                    <th className="num">Qtd.</th>
                    <th className="num">Verba orçada</th>
                    <th className="num">Ajustes</th>
                    <th className="num">Comprado</th>
                    <th className="num">Saldo</th>
                    <th>Consumo</th>
                    <th className="centro">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {arvore.length === 0 && (
                    <tr><td colSpan={11} className="centro text-muted py-4">Nenhum item encontrado.</td></tr>
                  )}
                  {arvore.map((n) => renderNo(n))}
                </tbody>
                {arvore.length > 0 && (
                  <tfoot>
                    <tr>
                      <td />
                      <td />
                      <td>TOTAL{busca || filtroStatus ? ' (filtrado)' : ''}</td>
                      <td />
                      <td />
                      <td className="num">{formatCurrency(resumoFiltrado.verbaOrcada)}</td>
                      <td className="num">{formatCurrency(resumoFiltrado.verbaAtual - resumoFiltrado.verbaOrcada)}</td>
                      <td className="num">{formatCurrency(resumoFiltrado.comprado)}</td>
                      <td className={`num ${resumoFiltrado.verbaAtual - resumoFiltrado.comprado < 0 ? 'text-danger' : ''}`}>
                        {formatCurrency(resumoFiltrado.verbaAtual - resumoFiltrado.comprado)}
                      </td>
                      <td><Consumo comprado={resumoFiltrado.comprado} verba={resumoFiltrado.verbaAtual} /></td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
          <p className="small text-muted">
            A verba de cada item é o custo direto (sem BDI) da composição no orçamento aprovado.
            Ao <strong>encerrar</strong> um item, o saldo restante é apurado como economia.
          </p>
        </Tab>

        <Tab eventKey="compras" title={`Compras (${compras.length})`}>
          <Card>
            <div className="gestao-tabela-wrap">
              <table className="gestao-tabela fixa">
                <colgroup>
                  <col style={{ width: 92 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 200 }} />
                  <col />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 90 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Documento</th>
                    <th>Fornecedor</th>
                    <th>Itens vinculados</th>
                    <th className="centro">Origem</th>
                    <th className="num">Valor</th>
                    <th className="centro">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasOrdenadas.length === 0 && (
                    <tr><td colSpan={7} className="centro text-muted py-4">Nenhuma compra lançada.</td></tr>
                  )}
                  {comprasOrdenadas.map((c) => (
                    <tr key={c.id} className="gt-item">
                      <td>{formatDataISO(c.data)}</td>
                      <td title={c.documento}>{c.documento || '—'}</td>
                      <td title={c.fornecedor}>{c.fornecedor || '—'}</td>
                      <td className="desc">
                        {[...new Set((c.linhas || []).map((l) => l.itemId))].map((iid) => {
                          const it = itensPorId.get(iid);
                          return <div key={iid}>{it ? `${it.numero} — ${it.descricao}` : 'Item não encontrado'}</div>;
                        })}
                      </td>
                      <td className="centro">{c.origem === 'informakon' ? <Badge bg="info">Informakon</Badge> : <Badge bg="secondary">Manual</Badge>}</td>
                      <td className="num">{formatCurrency(totalCompra(c))}</td>
                      <td className="centro text-nowrap">
                        {podeEditar && (
                          <>
                            <Button size="sm" variant="outline-primary" className="me-1" onClick={() => setCompraModal({ show: true, compra: c, itemId: '' })} title="Editar">
                              <FaEdit />
                            </Button>
                            <Button size="sm" variant="outline-danger" onClick={() => handleExcluirCompra(c)} title="Excluir">
                              <FaTrash />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {comprasOrdenadas.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={5}>TOTAL</td>
                      <td className="num">{formatCurrency(comprasOrdenadas.reduce((s, c) => s + totalCompra(c), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </Tab>

        <Tab eventKey="ajustes" title={`Ajustes de verba (${ajustes.length})`}>
          <Card>
            <div className="gestao-tabela-wrap">
              <table className="gestao-tabela fixa">
                <colgroup>
                  <col style={{ width: 92 }} />
                  <col style={{ width: 130 }} />
                  <col />
                  <col />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 220 }} />
                  <col style={{ width: 70 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>De</th>
                    <th>Para</th>
                    <th className="num">Valor</th>
                    <th>Motivo</th>
                    <th className="centro">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ajustes.length === 0 && (
                    <tr><td colSpan={7} className="centro text-muted py-4">Nenhum ajuste de verba.</td></tr>
                  )}
                  {[...ajustes].sort((a, b) => String(b.data).localeCompare(String(a.data))).map((a) => {
                    const de = itensPorId.get(a.itemOrigemId);
                    const para = itensPorId.get(a.itemDestinoId);
                    return (
                      <tr key={a.id} className="gt-item">
                        <td>{formatDataISO(a.data)}</td>
                        <td>{a.tipo === 'remanejamento' ? 'Remanejamento' : a.valor < 0 ? 'Supressão' : 'Aditivo'}</td>
                        <td className="desc">{de ? `${de.numero} — ${de.descricao}` : '—'}</td>
                        <td className="desc">{para ? `${para.numero} — ${para.descricao}` : '—'}</td>
                        <td className={`num ${a.valor < 0 ? 'text-danger' : ''}`}>{formatCurrency(a.valor)}</td>
                        <td className="desc">{a.motivo}</td>
                        <td className="centro">
                          {podeEditar && (
                            <Button size="sm" variant="outline-danger" onClick={() => handleExcluirAjuste(a)} title="Excluir">
                              <FaTrash />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </Tab>
      </Tabs>

      <CompraModal
        show={compraModal.show}
        compra={compraModal.compra}
        itemInicialId={compraModal.itemId}
        itens={itens}
        onHide={() => setCompraModal({ show: false, compra: null, itemId: '' })}
        onSave={handleSalvarCompra}
      />
      <AjusteModal
        show={ajusteModal.show}
        itemInicialId={ajusteModal.itemId}
        itens={itens}
        onHide={() => setAjusteModal({ show: false, itemId: '' })}
        onSave={handleSalvarAjuste}
      />
      <ImportarInformakonModal
        show={showImportar}
        onHide={() => setShowImportar(false)}
        onImport={handleImportar}
        itens={itens}
        mapaVinculos={gestao.mapaInformakon || {}}
        refsExistentes={refsExistentes}
      />

      <Modal show={showSync} onHide={() => setShowSync(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Atualizar linha de base</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            As verbas foram congeladas quando a gestão foi iniciada. Atualizar recarrega os itens e valores do
            orçamento {revisaoNova ? <>(Rev. {formatRevisao(getRevisao(revisaoNova))})</> : <>(Rev. {formatRevisao(gestao.revisao)})</>}.
          </p>
          <ul className="small">
            <li>Compras e ajustes já lançados são mantidos nos mesmos itens.</li>
            <li>Itens retirados do orçamento que tenham compras ficam marcados como “removido” e sem verba.</li>
          </ul>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSync(false)}>Cancelar</Button>
          <Button disabled={sincronizando} onClick={() => handleSincronizar(revisaoNova?.id || gestao.orcamentoId)}>
            {sincronizando ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default GestaoObra;
