import React, { useState, useMemo } from 'react';
import {
  Card, Button, Badge, Dropdown, Collapse, Form, Modal, Table
} from 'react-bootstrap';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCorners,
  pointerWithin, rectIntersection, DragOverlay, useDroppable
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, snapCenterToCursor } from '@dnd-kit/modifiers';
import {
  FaPlus, FaTrash, FaSave, FaEdit,
  FaChartBar, FaChartPie, FaFilePdf, FaCalculator, FaFileExcel, FaArrowLeft, FaGripVertical,
  FaChevronDown, FaChevronRight, FaCodeBranch
} from 'react-icons/fa';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
  getCompsDoNo, totalDoNo, totaisCategoriaDoNo, makeDragId, ROOT_CONTAINER,
  pacoteContainer, grupoContainer, subgrupoContainer, findByDragKey
} from '../../utils/eapTree';
import { getContainerItems, handleEapDragEnd } from '../../utils/eapDnD';
import { formatRevisao as formatRevisaoUtil, getRevisao as getRevisaoUtil } from '../../utils/eapCopy';

ChartJS.register(ArcElement, Tooltip, Legend);

const CORES_PIZZA = [
  '#17324D', '#2F6B8A', '#F2B84B', '#3FA66B', '#D9534F',
  '#5B9BD5', '#E89B3D', '#687481', '#8B6B4A', '#4A7C59'
];

const GRID_COLS =
  'minmax(72px, 88px) minmax(180px, 1.6fr) 44px 78px 92px 92px 100px 100px 100px 52px 70px';

function custosAgrupados(cats, quantidade = 1) {
  const totME = (cats?.Material || 0) + (cats?.Equipamento || 0);
  const totMOS = (cats?.['Mão de Obra'] || 0) + (cats?.Serviço || 0);
  const q = parseFloat(quantidade);
  const divisor = !Number.isNaN(q) && q > 0 ? q : 1;
  return {
    totME,
    totMOS,
    unitME: totME / divisor,
    unitMOS: totMOS / divisor,
    total: totME + totMOS
  };
}

function pctDoTotal(valor, valorTotal) {
  if (!valorTotal || Math.abs(valorTotal) < 0.0001) return '0,0%';
  return `${((valor / valorTotal) * 100).toFixed(1).replace('.', ',')}%`;
}

function collisionDetection(args) {
  const pointerHits = pointerWithin(args);
  const rectHits = rectIntersection(args);
  const collisions = pointerHits.length
    ? pointerHits
    : rectHits.length
      ? rectHits
      : closestCorners(args);

  // Prioriza itens (pacote/grupo/comp) em vez das zonas :children / root
  const itemHits = collisions.filter((c) => {
    const id = String(c.id);
    return id !== ROOT_CONTAINER && !id.endsWith(':children');
  });
  return itemHits.length ? itemHits : collisions;
}

function DroppableZone({ id, disabled, children, className = '' }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`eap-drop-zone ${isOver ? 'eap-drop-over' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

function SortableRow({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    animateLayoutChanges: () => false
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        // Preview segue o mouse no DragOverlay; não desloca o bloco original inteiro
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.3 : 1,
        position: 'relative',
        zIndex: isDragging ? 2 : 'auto'
      }}
      className={`eap-sortable-row ${isDragging ? 'eap-dragging' : ''}`}
    >
      {!disabled ? (
        <button
          type="button"
          className="btn btn-link p-0 text-muted eap-drag-handle"
          title="Arrastar"
          {...attributes}
          {...listeners}
        >
          <FaGripVertical />
        </button>
      ) : (
        <span className="eap-drag-handle-spacer" />
      )}
      <div className="eap-sortable-body">{children}</div>
    </div>
  );
}

function EapGridHeader() {
  return (
    <div className="eap-sortable-row eap-header-row">
      <span className="eap-drag-handle-spacer" aria-hidden="true" />
      <div className="eap-sortable-body">
        <div className="eap-grid eap-grid-header border-bottom px-2 py-2">
          <div>Código</div>
          <div>Descrição</div>
          <div className="eap-col-un">Un.</div>
          <div className="eap-col-num">Qtd</div>
          <div className="eap-col-num" title="Custo unitário Material + Equipamento">CU Mat+Eq</div>
          <div className="eap-col-num" title="Custo unitário Mão de Obra + Serviço">CU MO+Serv</div>
          <div className="eap-col-num" title="Custo total Material + Equipamento">Tot Mat+Eq</div>
          <div className="eap-col-num" title="Custo total Mão de Obra + Serviço">Tot MO+Serv</div>
          <div className="eap-col-num">Total</div>
          <div className="eap-col-num">%</div>
          <div className="eap-col-num">Ações</div>
        </div>
      </div>
    </div>
  );
}

function MoneyCell({ value, strong = false, className = '' }) {
  const Tag = strong ? 'strong' : 'span';
  return (
    <Tag className={`eap-num ${className}`} title={formatCurrency(value || 0)}>
      {formatCurrency(value || 0)}
    </Tag>
  );
}

export default function EapWorkspace(props) {
  const { currentUser } = useAuth();
  const {
    orcamento, setOrcamento, abertos, toggleAberto,
    valorTotal, valorComBDI, totaisPorCategoria, calcularBDI, calcularSubvalores,
    abrirCriarNo, abrirEditarNo, removerPacote, removerGrupo, removerSubgrupo,
    abrirAddComp, abrirEditComp, removerComposicao, atualizarQtdInline,
    salvarEAP, loading, navigate, sairDaEap, orcamentoId,
    exportarEAPPdf, exportarEAPExcel, exportarPlanilhaVenda, setShowBdi, atualizarStatus,
    getStatusColor, formatarDataAmigavel, activeDragId, setActiveDragId,
    somenteLeitura = false,
    formatRevisao = formatRevisaoUtil,
    getRevisao = getRevisaoUtil,
    onNovaRevisao,
    catalogoComposicoes = [],
    insumos = []
  } = props;

  const [composicaoVisualizacao, setComposicaoVisualizacao] = useState(null);
  const [showGraficoPacotes, setShowGraficoPacotes] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const rootItems = getContainerItems(orcamento, ROOT_CONTAINER);

  const activeDragLabel = (() => {
    if (!activeDragId) return '';
    const found = findByDragKey(orcamento, activeDragId);
    return found?.entity?.nome || 'Item';
  })();

  const resolverCodigo = (comp) => {
    if (comp?.codigo) return comp.codigo;
    const cat = catalogoComposicoes.find((c) => c.id === comp?.composicaoId);
    return cat?.codigo || '—';
  };

  const abrirVisualizacao = (comp) => {
    const catalogo = catalogoComposicoes.find((c) => c.id === comp.composicaoId);
    const listaInsumos =
      (comp.insumos && comp.insumos.length > 0)
        ? comp.insumos
        : (catalogo?.insumos || []);

    setComposicaoVisualizacao({
      codigo: resolverCodigo(comp),
      nome: comp.nome || catalogo?.nome || 'Composição',
      unidade: comp.unidade || catalogo?.unidade || '',
      custoUnitario: comp.custoUnitario ?? catalogo?.valorTotal ?? 0,
      insumos: listaInsumos
    });
  };

  const fecharVisualizacao = () => setComposicaoVisualizacao(null);

  const detalhesInsumos = (() => {
    if (!composicaoVisualizacao) return { porCategoria: {}, total: 0 };
    const categorias = ['Material', 'Mão de Obra', 'Equipamento', 'Serviço'];
    const porCategoria = {};
    categorias.forEach((cat) => { porCategoria[cat] = []; });
    let total = 0;

    (composicaoVisualizacao.insumos || []).forEach((item, index) => {
      const insumo = insumos.find((i) => i.id === item.insumoId);
      const categoria = insumo?.categoria || item.categoria || 'Material';
      const preco = insumo?.precoUnitario ?? item.precoUnitario ?? 0;
      const qtd = parseFloat(item.quantidade) || 0;
      const linhaTotal = qtd * preco;
      total += linhaTotal;
      const bucket = porCategoria[categoria] ? categoria : 'Material';
      porCategoria[bucket].push({
        index,
        nome: insumo?.nome || item.nome || item.insumoId,
        codigo: insumo?.codigo || '',
        unidade: insumo?.unidade || item.unidade || '',
        quantidade: qtd,
        preco,
        total: linhaTotal
      });
    });

    return { porCategoria, total };
  })();

  const renderCompRow = (comp, depth) => {
    const sub = calcularSubvalores(comp);
    const custos = custosAgrupados(sub, comp.quantidade);
    const dragId = makeDragId('comp', comp.uid);
    const totalLinha = comp.custoTotal || custos.total;

    return (
      <SortableRow key={dragId} id={dragId} disabled={somenteLeitura}>
        <div className="eap-grid eap-grid-comp border-bottom px-2 py-2">
          <div className="eap-codigo" style={{ paddingLeft: depth * 12 }}>
            <button
              type="button"
              className="eap-codigo-btn"
              onClick={() => abrirVisualizacao(comp)}
              title="Ver composição"
            >
              {resolverCodigo(comp)}
            </button>
          </div>
          <div className="eap-desc">
            <strong>{comp.nome}</strong>
          </div>
          <div className="eap-col-un text-muted">{comp.unidade || '—'}</div>
          <div className="eap-col-num">
            <Form.Control
              type="number"
              min="0"
              step="0.01"
              size="sm"
              className="eap-qtd-input"
              value={comp.quantidade}
              disabled={somenteLeitura}
              onChange={(e) => atualizarQtdInline(comp.uid, e.target.value)}
            />
          </div>
          <div className="eap-col-num"><MoneyCell value={custos.unitME} /></div>
          <div className="eap-col-num"><MoneyCell value={custos.unitMOS} /></div>
          <div className="eap-col-num"><MoneyCell value={custos.totME} /></div>
          <div className="eap-col-num"><MoneyCell value={custos.totMOS} /></div>
          <div className="eap-col-num"><MoneyCell value={totalLinha} strong /></div>
          <div className="eap-col-num eap-num text-muted">{pctDoTotal(totalLinha, valorTotal)}</div>
          <div className="eap-actions">
            {!somenteLeitura && (
              <>
                <Button size="sm" variant="outline-primary" onClick={() => abrirEditComp(comp)} title="Editar">
                  <FaEdit />
                </Button>
                <Button size="sm" variant="outline-danger" onClick={() => removerComposicao(comp.uid)} title="Excluir">
                  <FaTrash />
                </Button>
              </>
            )}
          </div>
        </div>
      </SortableRow>
    );
  };

  const renderNoHeader = ({
    aberto,
    toggleId,
    nome,
    bg,
    indent = 0,
    escopo,
    actions,
    highlightTotal = false
  }) => {
    const total = totalDoNo(orcamento.composicoes, escopo);
    const cats = totaisCategoriaDoNo(orcamento.composicoes, escopo, calcularSubvalores);
    const custos = custosAgrupados(cats);

    return (
      <div className="eap-grid eap-grid-no border-bottom px-2 py-2" style={{ background: bg }}>
        <div className="eap-no-toggle d-flex align-items-center gap-1" style={{ paddingLeft: indent }}>
          <Button size="sm" variant="link" className="p-0" onClick={() => toggleAberto(toggleId)}>
            {aberto ? <FaChevronDown /> : <FaChevronRight />}
          </Button>
        </div>
        <div className="eap-desc d-flex align-items-center gap-2 flex-wrap">
          <strong>{nome}</strong>
        </div>
        <div className="eap-col-un" />
        <div className="eap-col-num" />
        <div className="eap-col-num" />
        <div className="eap-col-num" />
        <div className="eap-col-num"><MoneyCell value={custos.totME} /></div>
        <div className="eap-col-num"><MoneyCell value={custos.totMOS} /></div>
        <div className="eap-col-num"><MoneyCell value={total} strong className={highlightTotal ? 'text-primary' : ''} /></div>
        <div className="eap-col-num eap-num text-muted">{pctDoTotal(total, valorTotal)}</div>
        <div className="eap-actions">{!somenteLeitura && actions}</div>
      </div>
    );
  };

  const renderSubgrupo = (pacote, grupo, subgrupo) => {
    const dragId = makeDragId('subgrupo', subgrupo.uid);
    const containerId = subgrupoContainer(subgrupo.id);
    const items = getContainerItems(orcamento, containerId);
    const aberto = abertos[subgrupo.id] !== false;
    const escopo = { pacoteId: pacote.id, grupoId: grupo.id, subgrupoId: subgrupo.id };

    return (
      <SortableRow key={dragId} id={dragId} disabled={somenteLeitura}>
        {renderNoHeader({
          aberto,
          toggleId: subgrupo.id,
          nome: subgrupo.nome,
          bg: 'var(--color-background, #f5f7f9)',
          indent: 24,
          escopo,
          actions: (
            <>
              <Button size="sm" variant="outline-success" title="Adicionar composição" onClick={() => abrirAddComp({ pacoteId: pacote.id, grupoId: grupo.id, subgrupoId: subgrupo.id })}><FaPlus /></Button>
              <Button size="sm" variant="outline-primary" title="Editar" onClick={() => abrirEditarNo('subgrupo', subgrupo, { pacoteId: pacote.id, grupoId: grupo.id })}><FaEdit /></Button>
              <Button size="sm" variant="outline-danger" title="Excluir" onClick={() => removerSubgrupo(pacote.id, grupo.id, subgrupo.id)}><FaTrash /></Button>
            </>
          )
        })}
        <Collapse in={aberto}>
          <div>
            <DroppableZone id={containerId} disabled={somenteLeitura} className="eap-drop-children">
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {getCompsDoNo(orcamento.composicoes, escopo).map((c) => renderCompRow(c, 3))}
                {items.length === 0 && (
                  <div className="eap-drop-empty text-muted small px-3 py-2">Solte composições aqui</div>
                )}
              </SortableContext>
            </DroppableZone>
          </div>
        </Collapse>
      </SortableRow>
    );
  };

  const renderGrupo = (pacote, grupo) => {
    const dragId = makeDragId('grupo', grupo.uid);
    const containerId = grupoContainer(grupo.id);
    const items = getContainerItems(orcamento, containerId);
    const aberto = abertos[grupo.id] !== false;
    const escopo = { pacoteId: pacote.id, grupoId: grupo.id };

    const filhos = items.map((itemId) => {
      if (itemId.startsWith('subgrupo:')) {
        const uid = itemId.slice(9);
        const s = (grupo.subgrupos || []).find((x) => x.uid === uid || x.id === uid);
        return s ? renderSubgrupo(pacote, grupo, s) : null;
      }
      if (itemId.startsWith('comp:')) {
        const uid = itemId.slice(5);
        const c = (orcamento.composicoes || []).find((x) => x.uid === uid);
        return c ? renderCompRow(c, 2) : null;
      }
      return null;
    });

    return (
      <SortableRow key={dragId} id={dragId} disabled={somenteLeitura}>
        {renderNoHeader({
          aberto,
          toggleId: grupo.id,
          nome: grupo.nome,
          bg: 'var(--color-background, #f5f7f9)',
          indent: 12,
          escopo,
          actions: (
            <>
              <Button size="sm" variant="outline-secondary" title="Novo subgrupo" onClick={() => abrirCriarNo('subgrupo', { pacoteId: pacote.id, grupoId: grupo.id })}><FaPlus /></Button>
              <Button size="sm" variant="outline-success" title="Adicionar composição" onClick={() => abrirAddComp({ pacoteId: pacote.id, grupoId: grupo.id, subgrupoId: null })}><FaPlus /></Button>
              <Button size="sm" variant="outline-primary" title="Editar" onClick={() => abrirEditarNo('grupo', grupo, { pacoteId: pacote.id })}><FaEdit /></Button>
              <Button size="sm" variant="outline-danger" title="Excluir" onClick={() => removerGrupo(pacote.id, grupo.id)}><FaTrash /></Button>
            </>
          )
        })}
        <Collapse in={aberto}>
          <div>
            <DroppableZone id={containerId} disabled={somenteLeitura} className="eap-drop-children">
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {filhos}
                {items.length === 0 && (
                  <div className="eap-drop-empty text-muted small px-3 py-2">Solte subgrupos ou composições aqui</div>
                )}
              </SortableContext>
            </DroppableZone>
          </div>
        </Collapse>
      </SortableRow>
    );
  };

  const renderPacote = (pacote) => {
    const dragId = makeDragId('pacote', pacote.uid);
    const containerId = pacoteContainer(pacote.id);
    const items = getContainerItems(orcamento, containerId);
    const aberto = abertos[pacote.id] !== false;
    const escopo = { pacoteId: pacote.id };

    const filhos = items.map((itemId) => {
      if (itemId.startsWith('grupo:')) {
        const uid = itemId.slice(6);
        const g = (pacote.grupos || []).find((x) => x.uid === uid || x.id === uid);
        return g ? renderGrupo(pacote, g) : null;
      }
      if (itemId.startsWith('comp:')) {
        const uid = itemId.slice(5);
        const c = (orcamento.composicoes || []).find((x) => x.uid === uid);
        return c ? renderCompRow(c, 1) : null;
      }
      return null;
    });

    return (
      <SortableRow key={dragId} id={dragId} disabled={somenteLeitura}>
        {renderNoHeader({
          aberto,
          toggleId: pacote.id,
          nome: pacote.nome,
          bg: '#e8eef3',
          indent: 0,
          escopo,
          highlightTotal: true,
          actions: (
            <>
              <Button size="sm" variant="outline-secondary" title="Novo grupo" onClick={() => abrirCriarNo('grupo', { pacoteId: pacote.id })}><FaPlus /></Button>
              <Button size="sm" variant="outline-success" title="Adicionar composição" onClick={() => abrirAddComp({ pacoteId: pacote.id, grupoId: null, subgrupoId: null })}><FaPlus /></Button>
              <Button size="sm" variant="outline-primary" title="Editar" onClick={() => abrirEditarNo('pacote', pacote)}><FaEdit /></Button>
              <Button size="sm" variant="outline-danger" title="Excluir" onClick={() => removerPacote(pacote.id)}><FaTrash /></Button>
            </>
          )
        })}
        <Collapse in={aberto}>
          <div>
            <DroppableZone id={containerId} disabled={somenteLeitura} className="eap-drop-children">
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {filhos}
                {items.length === 0 && (
                  <div className="eap-drop-empty text-muted small px-3 py-2">Solte grupos ou composições aqui</div>
                )}
              </SortableContext>
            </DroppableZone>
          </div>
        </Collapse>
      </SortableRow>
    );
  };

  const totGeral = custosAgrupados(totaisPorCategoria);

  const dadosPacotesPizza = useMemo(() => {
    const pacotes = [...(orcamento?.pacotes || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return pacotes
      .map((p, idx) => {
        const total = totalDoNo(orcamento?.composicoes, { pacoteId: p.id });
        return {
          id: p.id,
          nome: p.nome || `Pacote ${idx + 1}`,
          total,
          cor: CORES_PIZZA[idx % CORES_PIZZA.length]
        };
      })
      .filter((p) => p.total > 0);
  }, [orcamento]);

  const chartPacotesData = useMemo(() => ({
    labels: dadosPacotesPizza.map((p) => p.nome),
    datasets: [{
      data: dadosPacotesPizza.map((p) => p.total),
      backgroundColor: dadosPacotesPizza.map((p) => p.cor),
      borderColor: '#ffffff',
      borderWidth: 2
    }]
  }), [dadosPacotesPizza]);

  const chartPacotesOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          font: { family: 'Inter, sans-serif', size: 12 }
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const valor = ctx.parsed || 0;
            const soma = (ctx.dataset.data || []).reduce((s, v) => s + v, 0);
            const pct = soma > 0 ? ((valor / soma) * 100).toFixed(1).replace('.', ',') : '0,0';
            return ` ${formatCurrency(valor)} (${pct}%)`;
          }
        }
      }
    }
  }), []);

  return (
    <div className="eap-page">
      <style>{`
        .eap-sortable-row{display:flex;align-items:flex-start;gap:6px}
        .eap-sortable-body{flex:1;min-width:0}
        .eap-drag-handle{
          margin-top:12px;min-width:18px;flex-shrink:0;
          cursor:grab;touch-action:none;user-select:none;
        }
        .eap-drag-handle:active{cursor:grabbing}
        .eap-drag-handle-spacer{min-width:18px;flex-shrink:0}
        .eap-dragging{pointer-events:none}
        .eap-drop-zone{min-height:4px;transition:background-color .15s ease, box-shadow .15s ease}
        .eap-drop-over{
          background:rgba(47,107,138,.08);
          box-shadow:inset 0 0 0 2px rgba(47,107,138,.35);
        }
        .eap-drop-empty{border:1px dashed var(--color-border,#dde3e8);margin:4px 8px;border-radius:4px}
        .eap-grid{
          display:grid;
          grid-template-columns:${GRID_COLS};
          gap:6px;
          align-items:center;
          font-size:12px;
          font-variant-numeric:tabular-nums;
        }
        .eap-grid-header{
          background:var(--color-primary, #17324D);
          color:#fff;
          font-weight:500;
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:0.02em;
          position:sticky;
          top:0;
          z-index:2;
        }
        .eap-header-row{position:sticky;top:0;z-index:3;background:var(--color-primary,#17324D)}
        .eap-col-un{text-align:center}
        .eap-col-num{text-align:right}
        .eap-num{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .eap-qtd-input{max-width:74px;margin-left:auto;font-size:12px;padding:2px 6px;text-align:right}
        .eap-actions{display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap}
        .eap-codigo{font-size:11px;word-break:break-all}
        .eap-codigo-btn{
          background:none;border:none;padding:0;margin:0;
          color:var(--color-primary-hover, #2F6B8A);
          font-weight:600;font-size:11px;text-align:left;
          text-decoration:underline;cursor:pointer;font-variant-numeric:tabular-nums;
        }
        .eap-codigo-btn:hover{color:var(--color-primary, #17324D)}
        .eap-desc{min-width:0}
        .eap-desc strong{font-size:13px}
        .eap-table-scroll{overflow-x:auto;overflow-y:visible}
        .eap-table-scroll.is-dragging{overflow:visible}
        .eap-drag-overlay{
          background:#fff;border:1px solid var(--color-border,#dde3e8);
          box-shadow:0 8px 24px rgba(23,50,77,.18);border-radius:6px;
          padding:10px 14px;font-size:13px;font-weight:600;
          max-width:320px;pointer-events:none;
        }
        .eap-totais{width:100%}
        .eap-totais-linha{
          display:flex;justify-content:space-between;align-items:baseline;
          gap:24px;padding:6px 0;font-size:14px;width:100%;
        }
        .eap-totais-linha > span:first-child{text-align:left;flex:1;min-width:0}
        .eap-totais-linha > strong{text-align:right;flex-shrink:0;white-space:nowrap}
        .eap-totais-destaque{
          border-top:1px solid var(--color-border,#dde3e8);
          margin-top:6px;padding-top:10px;font-weight:600;
        }
        .eap-totais-sep{
          border-top:1px dashed var(--color-border,#dde3e8);
          margin-top:10px;padding-top:10px;
        }
        .eap-totais-final{
          border-top:2px solid var(--color-primary,#17324D);
          margin-top:8px;padding-top:12px;
          font-size:16px;font-weight:700;
        }
        .eap-totais-final strong{font-size:22px;letter-spacing:-0.02em}
        .eap-cabecalho{
          background:var(--color-surface,#fff);
          border:1px solid var(--color-border,#dde3e8);
          border-radius:8px;
          padding:16px 18px;
          margin-bottom:12px;
        }
        .eap-cabecalho-topo{margin-bottom:14px}
        .eap-cabecalho-meta{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:12px 20px;
        }
        .eap-meta-item .eap-meta-label{
          display:block;font-size:11px;font-weight:500;
          color:var(--color-text-secondary,#687481);
          text-transform:uppercase;letter-spacing:0.03em;margin-bottom:2px;
        }
        .eap-meta-item .eap-meta-value{
          font-size:14px;font-weight:600;color:var(--color-text,#17212B);
          word-break:break-word;
        }
        .eap-toolbar{
          display:flex;justify-content:space-between;align-items:center;
          gap:12px;flex-wrap:wrap;margin-bottom:16px;
        }
        .eap-toolbar-group{
          display:flex;align-items:center;gap:8px;flex-wrap:wrap;
        }
        .eap-toolbar-divider{
          width:1px;height:24px;background:var(--color-border,#dde3e8);
          margin:0 4px;
        }
      `}</style>

      <div className="eap-cabecalho">
        <div className="eap-cabecalho-topo">
          <Button variant="link" className="p-0 mb-2" onClick={() => (sairDaEap || navigate)('/orcamentos')}>
            <FaArrowLeft className="me-1" /> Voltar
          </Button>
          <h2 className="mb-0" style={{ fontSize: 22, fontWeight: 700 }}>
            {orcamento?.nome || 'Sem nome'}
          </h2>
        </div>

        <div className="eap-cabecalho-meta">
          <div className="eap-meta-item">
            <span className="eap-meta-label">Endereço</span>
            <span className="eap-meta-value">{orcamento?.endereco || '—'}</span>
          </div>
          <div className="eap-meta-item">
            <span className="eap-meta-label">Cliente</span>
            <span className="eap-meta-value">{orcamento?.cliente || '—'}</span>
          </div>
          <div className="eap-meta-item">
            <span className="eap-meta-label">Última atualização</span>
            <span className="eap-meta-value">
              {orcamento?.ultimaAtualizacaoEAP
                ? formatarDataAmigavel(orcamento.ultimaAtualizacaoEAP)
                : 'Nunca atualizado'}
            </span>
          </div>
          <div className="eap-meta-item">
            <span className="eap-meta-label">Revisão</span>
            <span className="eap-meta-value">
              <Badge bg={somenteLeitura ? 'secondary' : 'primary'} className="me-1">
                Rev. {formatRevisao(getRevisao(orcamento))}
              </Badge>
              {somenteLeitura && <span className="text-muted small">travada</span>}
            </span>
          </div>
          <div className="eap-meta-item">
            <span className="eap-meta-label">Elaborado por</span>
            <span className="eap-meta-value">
              {currentUser?.displayName || currentUser?.email || '—'}
            </span>
          </div>
          <div className="eap-meta-item">
            <span className="eap-meta-label">Status</span>
            <span className="eap-meta-value">
              <Badge bg={getStatusColor(orcamento?.status)}>
                {orcamento?.status || '—'}
              </Badge>
            </span>
          </div>
        </div>
      </div>

      <div className="eap-toolbar">
        <div className="eap-toolbar-group">
          {!somenteLeitura && (
            <>
              <Button variant="outline-secondary" size="sm" onClick={() => abrirCriarNo('pacote')}>
                <FaPlus className="me-1" /> Pacote
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={() => setShowBdi(true)}>
                <FaCalculator className="me-1" /> BDI
                {orcamento?.bdiConfig ? ' · ok' : ''}
              </Button>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="outline-secondary">Status</Dropdown.Toggle>
                <Dropdown.Menu>
                  {['Em Análise', 'Aprovado', 'Rejeitado', 'Em Execução', 'Concluído'].map((s) => (
                    <Dropdown.Item key={s} onClick={() => atualizarStatus(s)}>{s}</Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
              <span className="eap-toolbar-divider d-none d-md-inline-block" />
              <Button variant="outline-secondary" size="sm" disabled={loading} onClick={onNovaRevisao}>
                <FaCodeBranch className="me-1" /> Nova revisão
              </Button>
            </>
          )}
        </div>
        <div className="eap-toolbar-group">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => (sairDaEap || navigate)(`/orcamentos/${orcamentoId}/curva-abc`)}
          >
            <FaChartBar className="me-1" /> Curva ABC
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowGraficoPacotes(true)}
            disabled={!dadosPacotesPizza.length}
            title="Gráfico de participação dos pacotes"
          >
            <FaChartPie className="me-1" /> Gráfico
          </Button>
          <Dropdown>
            <Dropdown.Toggle size="sm" variant="outline-secondary">Exportar</Dropdown.Toggle>
            <Dropdown.Menu align="end">
              <Dropdown.Header>Planilha de custo</Dropdown.Header>
              <Dropdown.Item onClick={exportarEAPExcel}>
                <FaFileExcel className="me-2" /> Excel
              </Dropdown.Item>
              <Dropdown.Item onClick={exportarEAPPdf}>
                <FaFilePdf className="me-2" /> PDF
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Header>Planilha de venda</Dropdown.Header>
              <Dropdown.Item
                onClick={() => exportarPlanilhaVenda?.('excel')}
                title="Valores com BDI embutido (para o cliente)"
              >
                <FaFileExcel className="me-2" /> Excel
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => exportarPlanilhaVenda?.('pdf')}
                title="Valores com BDI embutido (para o cliente)"
              >
                <FaFilePdf className="me-2" /> PDF
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          {!somenteLeitura && (
            <Button variant="primary" size="sm" disabled={loading} onClick={salvarEAP}>
              <FaSave className="me-1" /> {loading ? 'Salvando...' : 'Salvar EAP'}
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-3">
        <Card.Body className="p-0">
          {!orcamento?.pacotes?.length ? (
            <div className="text-center py-5">
              <p className="text-muted">Nenhum pacote ainda.</p>
              {!somenteLeitura && (
                <Button onClick={() => abrirCriarNo('pacote')}><FaPlus className="me-1" /> Criar primeiro pacote</Button>
              )}
            </div>
          ) : (
            <div className={`eap-table-scroll ${activeDragId ? 'is-dragging' : ''}`}>
              <div style={{ minWidth: 1100 }}>
                <EapGridHeader />
                <DndContext
                  sensors={sensors}
                  collisionDetection={collisionDetection}
                  modifiers={[restrictToVerticalAxis]}
                  onDragStart={(e) => { if (!somenteLeitura) setActiveDragId(String(e.active.id)); }}
                  onDragEnd={(e) => {
                    setActiveDragId(null);
                    if (!somenteLeitura) setOrcamento((prev) => handleEapDragEnd(prev, e));
                  }}
                  onDragCancel={() => setActiveDragId(null)}
                >
                  <DroppableZone id={ROOT_CONTAINER} disabled={somenteLeitura}>
                    <SortableContext items={rootItems} strategy={verticalListSortingStrategy}>
                      {[...(orcamento.pacotes || [])]
                        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                        .map((p) => renderPacote(p))}
                    </SortableContext>
                  </DroppableZone>
                  <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
                    {activeDragId ? (
                      <div className="eap-drag-overlay">
                        <FaGripVertical className="me-2 text-muted" />
                        {activeDragLabel}
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      <Card className="eap-totais-card">
        <Card.Body className="py-3">
          <div className="eap-totais" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <div className="eap-totais-linha">
              <span className="text-muted">Total Mat+Equipamento</span>
              <strong>{formatCurrency(totGeral.totME)}</strong>
            </div>
            <div className="eap-totais-linha">
              <span className="text-muted">Total MO+Serviço</span>
              <strong>{formatCurrency(totGeral.totMOS)}</strong>
            </div>
            <div className="eap-totais-linha eap-totais-destaque">
              <span>Total geral</span>
              <strong>{formatCurrency(valorTotal)}</strong>
            </div>

            <div className="eap-totais-linha eap-totais-sep">
              <span className="text-muted">
                BDI
                {orcamento?.bdiConfig
                  ? ` (${calcularBDI().toFixed(2).replace('.', ',')}%)`
                  : ' (não configurado)'}
              </span>
              <strong>
                {orcamento?.bdiConfig
                  ? formatCurrency(Math.max(0, (valorComBDI || 0) - (valorTotal || 0)))
                  : formatCurrency(0)}
              </strong>
            </div>

            <div className="eap-totais-linha eap-totais-final">
              <span>Total com BDI</span>
              <strong className="text-success">
                {formatCurrency(orcamento?.bdiConfig ? valorComBDI : valorTotal)}
              </strong>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Modal
        show={showGraficoPacotes}
        onHide={() => setShowGraficoPacotes(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaChartPie className="me-2" />
            Participação por pacote
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {dadosPacotesPizza.length === 0 ? (
            <p className="text-muted mb-0 text-center py-4">
              Nenhum pacote com valor para exibir no gráfico.
            </p>
          ) : (
            <>
              <div style={{ maxWidth: 520, margin: '0 auto' }}>
                <Pie data={chartPacotesData} options={chartPacotesOptions} />
              </div>
              <Table size="sm" responsive className="mt-4 mb-0">
                <thead>
                  <tr>
                    <th>Pacote</th>
                    <th className="text-end">Valor</th>
                    <th className="text-end">%</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosPacotesPizza.map((p) => {
                    const pct = valorTotal > 0
                      ? ((p.total / valorTotal) * 100).toFixed(1).replace('.', ',')
                      : '0,0';
                    return (
                      <tr key={p.id}>
                        <td>
                          <span
                            className="d-inline-block me-2"
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: p.cor
                            }}
                          />
                          {p.nome}
                        </td>
                        <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(p.total)}
                        </td>
                        <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowGraficoPacotes(false)}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(composicaoVisualizacao)} onHide={fecharVisualizacao} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Composição
            {composicaoVisualizacao?.codigo ? ` — ${composicaoVisualizacao.codigo}` : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {composicaoVisualizacao && (
            <>
              <div className="mb-3">
                <div className="text-muted small">Descrição</div>
                <strong>{composicaoVisualizacao.nome}</strong>
              </div>
              <div className="d-flex flex-wrap gap-4 mb-3">
                <div>
                  <div className="text-muted small">Unidade</div>
                  <strong>{composicaoVisualizacao.unidade || '—'}</strong>
                </div>
                <div>
                  <div className="text-muted small">Custo unitário</div>
                  <strong>{formatCurrency(composicaoVisualizacao.custoUnitario || detalhesInsumos.total)}</strong>
                </div>
              </div>

              <h6 className="mb-3">Insumos da composição</h6>
              {detalhesInsumos.total === 0 && Object.values(detalhesInsumos.porCategoria).every((l) => l.length === 0) ? (
                <p className="text-muted mb-0">Nenhum insumo cadastrado nesta composição.</p>
              ) : (
                ['Material', 'Mão de Obra', 'Equipamento', 'Serviço'].map((categoria) => {
                  const linhas = detalhesInsumos.porCategoria[categoria] || [];
                  if (!linhas.length) return null;
                  const subtotal = linhas.reduce((s, l) => s + l.total, 0);
                  return (
                    <div key={categoria} className="mb-3">
                      <div className="d-flex justify-content-between border-bottom pb-1 mb-2">
                        <strong>{categoria}</strong>
                        <span className="text-muted">{formatCurrency(subtotal)}</span>
                      </div>
                      <Table size="sm" responsive className="mb-0">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Insumo</th>
                            <th>Un.</th>
                            <th className="text-end">Qtd</th>
                            <th className="text-end">Preço</th>
                            <th className="text-end">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.map((linha) => (
                            <tr key={`${categoria}-${linha.index}`}>
                              <td>{linha.codigo || '—'}</td>
                              <td>{linha.nome}</td>
                              <td>{linha.unidade || '—'}</td>
                              <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {linha.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                              </td>
                              <td className="text-end">{formatCurrency(linha.preco)}</td>
                              <td className="text-end"><strong>{formatCurrency(linha.total)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  );
                })
              )}

              <div className="text-end border-top pt-3">
                <span className="text-muted me-2">Total da composição:</span>
                <strong className="fs-5">
                  {formatCurrency(composicaoVisualizacao.custoUnitario || detalhesInsumos.total)}
                </strong>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={fecharVisualizacao}>Fechar</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
