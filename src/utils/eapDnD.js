import {
  getCompsDoNo,
  makeDragId,
  parseDragId,
  findByDragKey,
  findGrupoLoc,
  findSubgrupoLoc,
  ROOT_CONTAINER,
  pacoteContainer,
  grupoContainer,
  subgrupoContainer
} from '../utils/eapTree';
import { arrayMove } from '@dnd-kit/sortable';

export function getContainerItems(orcamento, containerId) {
  if (!orcamento) return [];
  if (containerId === ROOT_CONTAINER) {
    return [...(orcamento.pacotes || [])]
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map((p) => makeDragId('pacote', p.uid));
  }

  if (containerId.startsWith('pacote:') && containerId.endsWith(':children')) {
    const pacoteId = containerId.split(':')[1];
    const p = (orcamento.pacotes || []).find((x) => x.id === pacoteId);
    if (!p) return [];
    const grupos = [...(p.grupos || [])].map((g) => ({
      ordem: g.ordem || 0,
      id: makeDragId('grupo', g.uid)
    }));
    const comps = getCompsDoNo(orcamento.composicoes, {
      pacoteId,
      grupoId: null,
      subgrupoId: null
    }).map((c) => ({ ordem: c.ordem || 0, id: makeDragId('comp', c.uid) }));
    return [...grupos, ...comps].sort((a, b) => a.ordem - b.ordem).map((x) => x.id);
  }

  if (containerId.startsWith('grupo:') && containerId.endsWith(':children')) {
    const grupoId = containerId.split(':')[1];
    const loc = findGrupoLoc(orcamento.pacotes, grupoId);
    if (!loc) return [];
    const subs = [...(loc.grupo.subgrupos || [])].map((s) => ({
      ordem: s.ordem || 0,
      id: makeDragId('subgrupo', s.uid)
    }));
    const comps = getCompsDoNo(orcamento.composicoes, {
      pacoteId: loc.pacote.id,
      grupoId: loc.grupo.id,
      subgrupoId: null
    }).map((c) => ({ ordem: c.ordem || 0, id: makeDragId('comp', c.uid) }));
    return [...subs, ...comps].sort((a, b) => a.ordem - b.ordem).map((x) => x.id);
  }

  if (containerId.startsWith('subgrupo:') && containerId.endsWith(':children')) {
    const subgrupoId = containerId.split(':')[1];
    const loc = findSubgrupoLoc(orcamento.pacotes, subgrupoId);
    if (!loc) return [];
    return getCompsDoNo(orcamento.composicoes, {
      pacoteId: loc.pacote.id,
      grupoId: loc.grupo.id,
      subgrupoId: loc.subgrupo.id
    }).map((c) => makeDragId('comp', c.uid));
  }
  return [];
}

export function findContainerOfDragId(orcamento, dragId) {
  const parsed = parseDragId(dragId);
  if (!parsed || !orcamento) return null;
  if (parsed.tipo === 'pacote') return ROOT_CONTAINER;
  if (parsed.tipo === 'grupo') {
    const found = findByDragKey(orcamento, dragId);
    return found ? pacoteContainer(found.pacoteId) : null;
  }
  if (parsed.tipo === 'subgrupo') {
    const found = findByDragKey(orcamento, dragId);
    return found ? grupoContainer(found.grupoId) : null;
  }
  if (parsed.tipo === 'comp') {
    const found = findByDragKey(orcamento, dragId);
    if (!found) return null;
    const c = found.entity;
    if (c.subgrupoId) return subgrupoContainer(c.subgrupoId);
    if (c.grupoId) return grupoContainer(c.grupoId);
    return pacoteContainer(c.pacoteId);
  }
  return null;
}

export function containerAccepts(containerId, tipo) {
  if (containerId === ROOT_CONTAINER) return tipo === 'pacote';
  if (containerId.startsWith('pacote:') && containerId.endsWith(':children')) {
    return tipo === 'grupo' || tipo === 'comp';
  }
  if (containerId.startsWith('grupo:') && containerId.endsWith(':children')) {
    return tipo === 'subgrupo' || tipo === 'comp';
  }
  if (containerId.startsWith('subgrupo:') && containerId.endsWith(':children')) {
    return tipo === 'comp';
  }
  return false;
}

function applyOrderFromList(prev, orderedIds) {
  let pacotes = [...(prev.pacotes || [])];
  let composicoes = [...(prev.composicoes || [])];

  orderedIds.forEach((dragId, index) => {
    const parsed = parseDragId(dragId);
    if (!parsed) return;
    if (parsed.tipo === 'pacote') {
      pacotes = pacotes.map((p) =>
        p.uid === parsed.id || p.id === parsed.id ? { ...p, ordem: index } : p
      );
    } else if (parsed.tipo === 'grupo') {
      pacotes = pacotes.map((p) => ({
        ...p,
        grupos: (p.grupos || []).map((g) =>
          g.uid === parsed.id || g.id === parsed.id ? { ...g, ordem: index } : g
        )
      }));
    } else if (parsed.tipo === 'subgrupo') {
      pacotes = pacotes.map((p) => ({
        ...p,
        grupos: (p.grupos || []).map((g) => ({
          ...g,
          subgrupos: (g.subgrupos || []).map((s) =>
            s.uid === parsed.id || s.id === parsed.id ? { ...s, ordem: index } : s
          )
        }))
      }));
    } else if (parsed.tipo === 'comp') {
      composicoes = composicoes.map((c) =>
        c.uid === parsed.id ? { ...c, ordem: index } : c
      );
    }
  });

  return { ...prev, pacotes, composicoes };
}

export function moveItemToContainer(prev, dragId, toContainer, toIndex) {
  const parsed = parseDragId(dragId);
  if (!parsed) return prev;
  const fromContainer = findContainerOfDragId(prev, dragId);
  if (!fromContainer) return prev;
  if (!containerAccepts(toContainer, parsed.tipo)) return prev;

  let pacotes = JSON.parse(JSON.stringify(prev.pacotes || []));
  let composicoes = JSON.parse(JSON.stringify(prev.composicoes || []));

  if (parsed.tipo === 'comp') {
    let pacoteId = null;
    let grupoId = null;
    let subgrupoId = null;
    if (toContainer.startsWith('pacote:') && toContainer.endsWith(':children')) {
      pacoteId = toContainer.split(':')[1];
    } else if (toContainer.startsWith('grupo:') && toContainer.endsWith(':children')) {
      grupoId = toContainer.split(':')[1];
      const loc = findGrupoLoc(pacotes, grupoId);
      if (!loc) return prev;
      pacoteId = loc.pacote.id;
    } else if (toContainer.startsWith('subgrupo:') && toContainer.endsWith(':children')) {
      subgrupoId = toContainer.split(':')[1];
      const loc = findSubgrupoLoc(pacotes, subgrupoId);
      if (!loc) return prev;
      pacoteId = loc.pacote.id;
      grupoId = loc.grupo.id;
    } else return prev;

    composicoes = composicoes.map((c) =>
      c.uid === parsed.id
        ? { ...c, pacoteId, grupoId: grupoId ?? null, subgrupoId: subgrupoId ?? null }
        : c
    );
  }

  if (parsed.tipo === 'grupo' && toContainer.startsWith('pacote:')) {
    const toPacoteId = toContainer.split(':')[1];
    let grupoMovido = null;
    pacotes = pacotes.map((p) => {
      const g = (p.grupos || []).find((x) => x.uid === parsed.id || x.id === parsed.id);
      if (g) {
        grupoMovido = g;
        return { ...p, grupos: (p.grupos || []).filter((x) => x.id !== g.id) };
      }
      return p;
    });
    if (!grupoMovido) return prev;
    pacotes = pacotes.map((p) =>
      p.id === toPacoteId
        ? { ...p, grupos: [...(p.grupos || []), grupoMovido] }
        : p
    );
    composicoes = composicoes.map((c) =>
      c.grupoId === grupoMovido.id ? { ...c, pacoteId: toPacoteId } : c
    );
  }

  if (parsed.tipo === 'subgrupo' && toContainer.startsWith('grupo:')) {
    const toGrupoId = toContainer.split(':')[1];
    const toLoc = findGrupoLoc(pacotes, toGrupoId);
    if (!toLoc) return prev;
    let subMovido = null;
    pacotes = pacotes.map((p) => ({
      ...p,
      grupos: (p.grupos || []).map((g) => {
        const s = (g.subgrupos || []).find((x) => x.uid === parsed.id || x.id === parsed.id);
        if (s) {
          subMovido = s;
          return { ...g, subgrupos: (g.subgrupos || []).filter((x) => x.id !== s.id) };
        }
        return g;
      })
    }));
    if (!subMovido) return prev;
    pacotes = pacotes.map((p) => ({
      ...p,
      grupos: (p.grupos || []).map((g) =>
        g.id === toGrupoId
          ? { ...g, subgrupos: [...(g.subgrupos || []), subMovido] }
          : g
      )
    }));
    composicoes = composicoes.map((c) =>
      c.subgrupoId === subMovido.id
        ? { ...c, pacoteId: toLoc.pacote.id, grupoId: toGrupoId }
        : c
    );
  }

  let next = { ...prev, pacotes, composicoes };
  let destList = getContainerItems(next, toContainer).filter((id) => id !== dragId);
  const insertAt = Math.min(Math.max(toIndex, 0), destList.length);
  destList.splice(insertAt, 0, dragId);
  next = applyOrderFromList(next, destList);

  if (fromContainer !== toContainer) {
    const sourceList = getContainerItems(next, fromContainer).filter((id) => id !== dragId);
    next = applyOrderFromList(next, sourceList);
  }
  return next;
}

export function handleEapDragEnd(orcamento, event) {
  const { active, over } = event;
  if (!over || !active || !orcamento) return orcamento;

  const activeId = String(active.id);
  const overId = String(over.id);
  if (activeId === overId) return orcamento;

  const activeParsed = parseDragId(activeId);
  if (!activeParsed) return orcamento;

  const fromContainer = findContainerOfDragId(orcamento, activeId);
  if (!fromContainer) return orcamento;

  let toContainer =
    overId === ROOT_CONTAINER || overId.endsWith(':children')
      ? overId
      : findContainerOfDragId(orcamento, overId);

  // Se o alvo direto não aceita o tipo, sobe para um container compatível
  if (!toContainer || !containerAccepts(toContainer, activeParsed.tipo)) {
    toContainer = findCompatibleContainer(orcamento, overId, activeParsed.tipo);
  }
  if (!toContainer || !containerAccepts(toContainer, activeParsed.tipo)) return orcamento;

  if (fromContainer === toContainer) {
    const items = getContainerItems(orcamento, fromContainer);
    const oldIndex = items.indexOf(activeId);
    if (oldIndex < 0) return orcamento;

    let newIndex = items.indexOf(overId);
    if (newIndex < 0) {
      // over pode ser um descendente: usa o item irmão no mesmo container
      newIndex = items.findIndex((id) => id !== activeId && itemContainsDragId(orcamento, id, overId));
    }
    if (newIndex < 0) {
      // soltou na área droppable do próprio container → mantém / vai para o fim
      if (overId === toContainer) newIndex = items.length - 1;
      else return orcamento;
    }
    if (oldIndex === newIndex) return orcamento;
    return applyOrderFromList(orcamento, arrayMove(items, oldIndex, newIndex));
  }

  const destItems = getContainerItems(orcamento, toContainer).filter((id) => id !== activeId);
  let toIndex = destItems.indexOf(overId);
  if (toIndex < 0) {
    toIndex = destItems.findIndex((id) => itemContainsDragId(orcamento, id, overId));
  }
  if (toIndex < 0) toIndex = destItems.length;
  return moveItemToContainer(orcamento, activeId, toContainer, toIndex);
}

function parentContainerId(orcamento, containerId) {
  if (!containerId || containerId === ROOT_CONTAINER) return null;
  if (containerId.startsWith('subgrupo:') && containerId.endsWith(':children')) {
    const subId = containerId.split(':')[1];
    const loc = findSubgrupoLoc(orcamento.pacotes, subId);
    return loc ? grupoContainer(loc.grupo.id) : null;
  }
  if (containerId.startsWith('grupo:') && containerId.endsWith(':children')) {
    const grupoId = containerId.split(':')[1];
    const loc = findGrupoLoc(orcamento.pacotes, grupoId);
    return loc ? pacoteContainer(loc.pacote.id) : null;
  }
  if (containerId.startsWith('pacote:') && containerId.endsWith(':children')) {
    return ROOT_CONTAINER;
  }
  return null;
}

function findCompatibleContainer(orcamento, overId, tipo) {
  let container =
    overId === ROOT_CONTAINER || overId.endsWith(':children')
      ? overId
      : findContainerOfDragId(orcamento, overId);

  while (container) {
    if (containerAccepts(container, tipo)) return container;
    container = parentContainerId(orcamento, container);
  }
  return null;
}

/** Verifica se dragId (ex.: pacote) contém o overId em sua subárvore imediata/profunda */
function itemContainsDragId(orcamento, itemDragId, overId) {
  if (itemDragId === overId) return true;
  const parsed = parseDragId(itemDragId);
  if (!parsed) return false;

  if (parsed.tipo === 'pacote') {
    const p = (orcamento.pacotes || []).find((x) => x.uid === parsed.id || x.id === parsed.id);
    if (!p) return false;
    const childContainer = pacoteContainer(p.id);
    if (overId === childContainer) return true;
    return getContainerItems(orcamento, childContainer).some((id) =>
      itemContainsDragId(orcamento, id, overId)
    );
  }
  if (parsed.tipo === 'grupo') {
    const loc = findByDragKey(orcamento, itemDragId);
    if (!loc) return false;
    const childContainer = grupoContainer(loc.entity.id);
    if (overId === childContainer) return true;
    return getContainerItems(orcamento, childContainer).some((id) =>
      itemContainsDragId(orcamento, id, overId)
    );
  }
  if (parsed.tipo === 'subgrupo') {
    const loc = findByDragKey(orcamento, itemDragId);
    if (!loc) return false;
    const childContainer = subgrupoContainer(loc.entity.id);
    if (overId === childContainer) return true;
    return getContainerItems(orcamento, childContainer).some((id) => id === overId);
  }
  return false;
}
