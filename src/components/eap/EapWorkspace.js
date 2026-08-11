import React from 'react';
import {
  Card, Button, Badge, Dropdown, Collapse, Form
} from 'react-bootstrap';
import { formatCurrency } from '../../utils/formatters';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCorners, DragOverlay
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FaPlus, FaTrash, FaFolder, FaFolderOpen, FaLayerGroup, FaSave, FaEdit,
  FaChartBar, FaFilePdf, FaCalculator, FaFileExcel, FaArrowLeft, FaGripVertical,
  FaChevronDown, FaChevronRight, FaCodeBranch
} from 'react-icons/fa';
import {
  getCompsDoNo, totalDoNo, totaisCategoriaDoNo, makeDragId, ROOT_CONTAINER,
  pacoteContainer, grupoContainer, subgrupoContainer
} from '../../utils/eapTree';
import { getContainerItems, handleEapDragEnd } from '../../utils/eapDnD';

function SortableRow({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="eap-sortable-row"
    >
      {!disabled && (
        <button
          type="button"
          className="btn btn-link p-0 text-muted eap-drag-handle"
          style={{ cursor: 'grab', touchAction: 'none' }}
          title="Arrastar"
          {...attributes}
          {...listeners}
        >
          <FaGripVertical />
        </button>
      )}
      <div className="flex-grow-1">{children}</div>
    </div>
  );
}

function TotaisCategoriaLinha({ cats }) {
  if (!cats) return null;
  return (
    <div className="small text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatCurrency(cats.Material || 0)} Mat · {formatCurrency(cats['Mão de Obra'] || 0)} MO ·{' '}
      {formatCurrency(cats.Equipamento || 0)} Eq · {formatCurrency(cats.Serviço || 0)} Serv
    </div>
  );
}

export default function EapWorkspace(props) {
  const {
    orcamento, setOrcamento, abertos, toggleAberto,
    valorTotal, valorComBDI, totaisPorCategoria, calcularBDI, calcularSubvalores,
    abrirCriarNo, abrirEditarNo, removerPacote, removerGrupo, removerSubgrupo,
    abrirAddComp, abrirEditComp, removerComposicao, atualizarQtdInline,
    salvarEAP, loading, navigate, orcamentoId,
    exportarEAPPdf, exportarEAPExcel, setShowBdi, atualizarStatus,
    getStatusColor, formatarDataAmigavel,     activeDragId, setActiveDragId,
    somenteLeitura = false,
    formatRevisao,
    getRevisao,
    onNovaRevisao
  } = props;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const rootItems = getContainerItems(orcamento, ROOT_CONTAINER);

  const renderCompRow = (comp, depth) => {
    const sub = calcularSubvalores(comp);
    const dragId = makeDragId('comp', comp.uid);
    return (
      <SortableRow key={dragId} id={dragId} disabled={somenteLeitura}>
        <div className="d-flex align-items-center gap-2 py-2 border-bottom" style={{ paddingLeft: 12 + depth * 20 }}>
          <Badge bg="secondary" style={{ fontSize: 10 }}>Comp</Badge>
          <div className="flex-grow-1">
            <strong>{comp.nome}</strong>
            <div className="small text-muted">
              {formatCurrency(sub.Material)} Mat · {formatCurrency(sub['Mão de Obra'])} MO ·{' '}
              {formatCurrency(sub.Equipamento)} Eq · {formatCurrency(sub.Serviço)} Serv
            </div>
          </div>
          <Form.Control
            type="number" min="0" step="0.01" size="sm" style={{ width: 90 }}
            value={comp.quantidade}
            disabled={somenteLeitura}
            onChange={(e) => atualizarQtdInline(comp.uid, e.target.value)}
          />
          <span className="text-muted small" style={{ width: 40 }}>{comp.unidade}</span>
          <span className="fw-bold" style={{ width: 110, textAlign: 'right' }}>{formatCurrency(comp.custoTotal)}</span>
          {!somenteLeitura && (
            <>
              <Button size="sm" variant="outline-primary" onClick={() => abrirEditComp(comp)}><FaEdit /></Button>
              <Button size="sm" variant="outline-danger" onClick={() => removerComposicao(comp.uid)}><FaTrash /></Button>
            </>
          )}
        </div>
      </SortableRow>
    );
  };

  const renderSubgrupo = (pacote, grupo, subgrupo) => {
    const dragId = makeDragId('subgrupo', subgrupo.uid);
    const containerId = subgrupoContainer(subgrupo.id);
    const items = getContainerItems(orcamento, containerId);
    const aberto = abertos[subgrupo.id] !== false;
    const escopo = { pacoteId: pacote.id, grupoId: grupo.id, subgrupoId: subgrupo.id };
    const total = totalDoNo(orcamento.composicoes, escopo);
    const cats = totaisCategoriaDoNo(orcamento.composicoes, escopo, calcularSubvalores);
    return (
      <SortableRow key={dragId} id={dragId} disabled={somenteLeitura}>
        <div className="d-flex align-items-center gap-2 py-2 border-bottom bg-light" style={{ paddingLeft: 52 }}>
          <Button size="sm" variant="link" className="p-0" onClick={() => toggleAberto(subgrupo.id)}>
            {aberto ? <FaChevronDown /> : <FaChevronRight />}
          </Button>
          <FaLayerGroup className="text-info" />
          <div className="flex-grow-1">
            <strong>{subgrupo.nome}</strong>
            <TotaisCategoriaLinha cats={cats} />
          </div>
          <Badge bg="info">Subgrupo</Badge>
          <span className="fw-bold" style={{ width: 110, textAlign: 'right' }}>{formatCurrency(total)}</span>
          {!somenteLeitura && (
            <>
              <Button size="sm" variant="outline-success" onClick={() => abrirAddComp({ pacoteId: pacote.id, grupoId: grupo.id, subgrupoId: subgrupo.id })}><FaPlus /></Button>
              <Button size="sm" variant="outline-primary" onClick={() => abrirEditarNo('subgrupo', subgrupo, { pacoteId: pacote.id, grupoId: grupo.id })}><FaEdit /></Button>
              <Button size="sm" variant="outline-danger" onClick={() => removerSubgrupo(pacote.id, grupo.id, subgrupo.id)}><FaTrash /></Button>
            </>
          )}
        </div>
        <Collapse in={aberto}>
          <div>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              {getCompsDoNo(orcamento.composicoes, {
                pacoteId: pacote.id, grupoId: grupo.id, subgrupoId: subgrupo.id
              }).map((c) => renderCompRow(c, 3))}
            </SortableContext>
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
    const total = totalDoNo(orcamento.composicoes, escopo);
    const cats = totaisCategoriaDoNo(orcamento.composicoes, escopo, calcularSubvalores);

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
        <div className="d-flex align-items-center gap-2 py-2 border-bottom" style={{ paddingLeft: 32, background: '#f8f9fa' }}>
          <Button size="sm" variant="link" className="p-0" onClick={() => toggleAberto(grupo.id)}>
            {aberto ? <FaChevronDown /> : <FaChevronRight />}
          </Button>
          <FaFolderOpen className="text-warning" />
          <div className="flex-grow-1">
            <strong>{grupo.nome}</strong>
            <TotaisCategoriaLinha cats={cats} />
          </div>
          <Badge bg="warning" text="dark">Grupo</Badge>
          <span className="fw-bold" style={{ width: 110, textAlign: 'right' }}>{formatCurrency(total)}</span>
          {!somenteLeitura && (
            <>
              <Button size="sm" variant="outline-secondary" onClick={() => abrirCriarNo('subgrupo', { pacoteId: pacote.id, grupoId: grupo.id })}><FaPlus /> Sub</Button>
              <Button size="sm" variant="outline-success" onClick={() => abrirAddComp({ pacoteId: pacote.id, grupoId: grupo.id, subgrupoId: null })}><FaPlus /></Button>
              <Button size="sm" variant="outline-primary" onClick={() => abrirEditarNo('grupo', grupo, { pacoteId: pacote.id })}><FaEdit /></Button>
              <Button size="sm" variant="outline-danger" onClick={() => removerGrupo(pacote.id, grupo.id)}><FaTrash /></Button>
            </>
          )}
        </div>
        <Collapse in={aberto}>
          <div>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              {filhos}
            </SortableContext>
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
    const total = totalDoNo(orcamento.composicoes, escopo);
    const cats = totaisCategoriaDoNo(orcamento.composicoes, escopo, calcularSubvalores);

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
        <div className="d-flex align-items-center gap-2 py-2 border-bottom" style={{ background: '#e9ecef' }}>
          <Button size="sm" variant="link" className="p-0" onClick={() => toggleAberto(pacote.id)}>
            {aberto ? <FaChevronDown /> : <FaChevronRight />}
          </Button>
          <FaFolder className="text-primary" />
          <div className="flex-grow-1">
            <strong className="fs-5">{pacote.nome}</strong>
            <TotaisCategoriaLinha cats={cats} />
          </div>
          <Badge bg="primary">Pacote</Badge>
          <span className="fw-bold text-primary" style={{ width: 110, textAlign: 'right' }}>{formatCurrency(total)}</span>
          {!somenteLeitura && (
            <>
              <Button size="sm" variant="outline-secondary" onClick={() => abrirCriarNo('grupo', { pacoteId: pacote.id })}><FaPlus /> Grupo</Button>
              <Button size="sm" variant="outline-success" onClick={() => abrirAddComp({ pacoteId: pacote.id, grupoId: null, subgrupoId: null })}><FaPlus /> Comp</Button>
              <Button size="sm" variant="outline-primary" onClick={() => abrirEditarNo('pacote', pacote)}><FaEdit /></Button>
              <Button size="sm" variant="outline-danger" onClick={() => removerPacote(pacote.id)}><FaTrash /></Button>
            </>
          )}
        </div>
        <Collapse in={aberto}>
          <div>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              {filhos}
            </SortableContext>
          </div>
        </Collapse>
      </SortableRow>
    );
  };

  return (
    <div>
      <style>{`.eap-sortable-row{display:flex;align-items:flex-start;gap:8px}.eap-drag-handle{margin-top:10px;min-width:20px}`}</style>

      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <Button variant="link" className="p-0 mb-2" onClick={() => navigate('/orcamentos')}>
            <FaArrowLeft className="me-1" /> Voltar
          </Button>
          <h2 className="mb-1">
            {orcamento?.nome || 'EAP'}{' '}
            <Badge bg={somenteLeitura ? 'secondary' : 'primary'} className="align-middle">
              Rev. {formatRevisao ? formatRevisao(getRevisao?.(orcamento)) : '00'}
            </Badge>
          </h2>
          <div className="text-muted">
            {orcamento?.cliente} · <Badge bg={getStatusColor(orcamento?.status)}>{orcamento?.status}</Badge>
            {orcamento?.ultimaAtualizacaoEAP && (
              <span className="ms-2">Atualizado {formatarDataAmigavel(orcamento.ultimaAtualizacaoEAP)}</span>
            )}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {!somenteLeitura && (
            <Button variant="outline-secondary" size="sm" onClick={() => abrirCriarNo('pacote')}><FaPlus className="me-1" /> Pacote</Button>
          )}
          {!somenteLeitura && (
            <Button variant={orcamento?.bdiConfig ? 'success' : 'outline-info'} size="sm" onClick={() => setShowBdi(true)}>
              <FaCalculator className="me-1" /> BDI
            </Button>
          )}
          <Button variant="outline-danger" size="sm" onClick={exportarEAPPdf}><FaFilePdf className="me-1" /> PDF</Button>
          <Button variant="outline-success" size="sm" onClick={exportarEAPExcel}><FaFileExcel className="me-1" /> Excel</Button>
          <Button variant="outline-primary" size="sm" onClick={() => navigate(`/orcamentos/${orcamentoId}/curva-abc`)}>
            <FaChartBar className="me-1" /> Curva ABC
          </Button>
          {!somenteLeitura && (
            <Dropdown>
              <Dropdown.Toggle size="sm" variant="outline-secondary">Status</Dropdown.Toggle>
              <Dropdown.Menu>
                {['Em Análise', 'Aprovado', 'Rejeitado', 'Em Execução', 'Concluído'].map((s) => (
                  <Dropdown.Item key={s} onClick={() => atualizarStatus(s)}>{s}</Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          )}
          {!somenteLeitura && (
            <Button variant="outline-success" size="sm" disabled={loading} onClick={onNovaRevisao}>
              <FaCodeBranch className="me-1" /> Nova revisão
            </Button>
          )}
          {!somenteLeitura && (
            <Button variant="warning" size="sm" disabled={loading} onClick={salvarEAP}>
              <FaSave className="me-1" /> {loading ? 'Salvando...' : 'Salvar EAP'}
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-3">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <div className="mb-1">
                <span className="text-muted">Total:</span> <strong>{formatCurrency(valorTotal)}</strong>
                {orcamento?.bdiConfig && (
                  <>
                    <span className="mx-2">·</span>
                    <span className="text-muted">c/ BDI ({calcularBDI().toFixed(1)}%):</span>{' '}
                    <strong className="text-success">{formatCurrency(valorComBDI)}</strong>
                  </>
                )}
              </div>
              <div className="small text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="me-3">
                  Material: <strong className="text-body">{formatCurrency(totaisPorCategoria?.Material || 0)}</strong>
                </span>
                <span className="me-3">
                  Mão de Obra: <strong className="text-body">{formatCurrency(totaisPorCategoria?.['Mão de Obra'] || 0)}</strong>
                </span>
                <span className="me-3">
                  Equipamento: <strong className="text-body">{formatCurrency(totaisPorCategoria?.Equipamento || 0)}</strong>
                </span>
                <span>
                  Serviço: <strong className="text-body">{formatCurrency(totaisPorCategoria?.Serviço || 0)}</strong>
                </span>
              </div>
            </div>
            <small className="text-muted">
              {somenteLeitura ? 'Revisão travada — somente visualização' : <>Arraste pelo ícone <FaGripVertical /> para mover itens</>}
            </small>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="p-0">
          {!orcamento?.pacotes?.length ? (
            <div className="text-center py-5">
              <p className="text-muted">Nenhum pacote ainda.</p>
              {!somenteLeitura && (
                <Button onClick={() => abrirCriarNo('pacote')}><FaPlus className="me-1" /> Criar primeiro pacote</Button>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={(e) => { if (!somenteLeitura) setActiveDragId(String(e.active.id)); }}
              onDragEnd={(e) => {
                setActiveDragId(null);
                if (!somenteLeitura) setOrcamento((prev) => handleEapDragEnd(prev, e));
              }}
              onDragCancel={() => setActiveDragId(null)}
            >
              <SortableContext items={rootItems} strategy={verticalListSortingStrategy}>
                {[...(orcamento.pacotes || [])]
                  .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                  .map((p) => renderPacote(p))}
              </SortableContext>
              <DragOverlay>
                {activeDragId ? <div className="bg-white border shadow-sm p-2 rounded">Movendo...</div> : null}
              </DragOverlay>
            </DndContext>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
