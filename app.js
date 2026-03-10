import { APP_CONFIG } from './config.js';
import { getDefaultWorkType, getWorkTypeById } from './data/workTypes.js';
import { createDrawingManager } from './modules/drawing.js';
import { calculateTotals, getTotalsMarkup, recalculateObject } from './modules/estimate.js';
import { initMap } from './modules/map.js';
import { getQuantityByKind, getUnitByKind } from './modules/measurements.js';
import {
  exportProjectToFile,
  importProjectFromFile,
  loadProjectFromLocalStorage,
  saveProjectToLocalStorage,
} from './modules/storage.js';
import { renderObjectList, setActiveTool, setupToolButtons, updateHint } from './modules/ui.js';

const state = {
  items: [],
  selectedId: null,
  activeTool: 'select',
};

let drawing;

const TOOL_HINTS = {
  select: 'Режим выбора и навигации: можно двигать карту и редактировать выбранный объект.',
  polygon: 'Рисование полигона: клик — новая вершина, двойной клик/"Завершить" — завершение.',
  polyline: 'Рисование линии: клик — новая вершина, двойной клик/"Завершить" — завершение.',
  point: 'Рисование точки: один клик по карте добавляет точку.',
};

function uid() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createItem(kind, coords) {
  const workType = getDefaultWorkType(kind);
  const quantity = getQuantityByKind(kind, coords);

  return recalculateObject({
    id: uid(),
    kind,
    coords,
    name: `Объект ${state.items.length + 1}`,
    workTypeId: workType?.id ?? '',
    unit: workType?.unit ?? getUnitByKind(kind),
    quantity: Number(quantity.toFixed(2)),
    price: workType?.defaultPrice ?? 0,
  });
}

function serializeProject() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: state.items,
  };
}

function rehydrateProject(payload) {
  const incoming = Array.isArray(payload?.items) ? payload.items : [];
  state.items = incoming.map((item) => recalculateObject(item));
  state.selectedId = null;

  drawing.clearAllGeoObjects();
  state.items.forEach((item) => drawing.addGeoObject(item));
  render();
}

function removeItem(id) {
  state.items = state.items.filter((item) => item.id !== id);
  drawing.removeGeoObject(id);
  if (state.selectedId === id) state.selectedId = null;
  render();
}

function updateGeometry(id, coords) {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;

  const current = state.items[index];
  const quantity = getQuantityByKind(current.kind, coords);

  state.items[index] = recalculateObject({
    ...current,
    coords,
    quantity: Number(quantity.toFixed(2)),
  });

  render();
}

function updateItem(id, field, rawValue) {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;

  const current = state.items[index];
  let next = { ...current };

  if (field === 'workTypeId') {
    const workType = getWorkTypeById(current.kind, rawValue);
    next.workTypeId = rawValue;
    if (workType) {
      next.unit = workType.unit;
      next.price = workType.defaultPrice;
    }
  } else if (field === 'quantity' || field === 'price') {
    next[field] = Number(rawValue) || 0;
  } else {
    next[field] = rawValue;
  }

  state.items[index] = recalculateObject(next);
  drawing.updateGeoObject(state.items[index]);
  render();
}

function setSelected(id) {
  state.selectedId = id;
  drawing.selectObject(id);
  render();
}

function render() {
  const listNode = document.getElementById('object-list');
  const totalsNode = document.getElementById('totals-block');

  renderObjectList(listNode, state.items, state.selectedId, {
    onSelect: (id) => setSelected(id),
    onUpdate: updateItem,
    onRemove: removeItem,
  });

  totalsNode.innerHTML = getTotalsMarkup(calculateTotals(state.items));
}

async function setupApp() {
  const toolGrid = document.getElementById('tool-grid');
  const hint = document.getElementById('drawing-hint');
  const mapStatus = document.getElementById('map-status');
  const mapContainer = document.getElementById('map');

  try {
    const { ymaps, map } = await initMap('map');

    drawing = createDrawingManager({
      ymaps,
      map,
      mapContainer,
      onCreate: (kind, coords) => {
        const item = createItem(kind, coords);
        state.items.push(item);
        drawing.addGeoObject(item);
        state.selectedId = item.id;
        drawing.selectObject(item.id);
        render();
      },
      onSelect: (id) => {
        state.selectedId = id;
        render();
      },
      onGeometryChange: updateGeometry,
      onStatusChange: (text) => {
        mapStatus.textContent = text;
      },
    });

    setupToolButtons(toolGrid, (toolId) => {
      if (toolId === 'delete-selected') {
        if (state.selectedId) removeItem(state.selectedId);
        return;
      }

      if (toolId === 'undo') {
        drawing.undoDrawingStep();
        return;
      }

      if (toolId === 'finish') {
        drawing.finishDrawing();
        return;
      }

      if (toolId === 'clear') {
        state.items = [];
        state.selectedId = null;
        drawing.clearAllGeoObjects();
        render();
        return;
      }

      state.activeTool = toolId;
      state.selectedId = null;
      drawing.setTool(toolId);
      setActiveTool(toolGrid, toolId);
      updateHint(hint, TOOL_HINTS[toolId] ?? `Активный инструмент: ${toolId}`);
    });

    setActiveTool(toolGrid, state.activeTool);
    drawing.setTool(state.activeTool);
    updateHint(hint, TOOL_HINTS[state.activeTool]);

    document.getElementById('save-local').addEventListener('click', () => {
      saveProjectToLocalStorage(APP_CONFIG.storageKey, serializeProject());
      mapStatus.textContent = 'Проект сохранен в localStorage.';
    });

    document.getElementById('load-local').addEventListener('click', () => {
      const payload = loadProjectFromLocalStorage(APP_CONFIG.storageKey);
      if (!payload) {
        mapStatus.textContent = 'Сохраненный проект не найден.';
        return;
      }
      rehydrateProject(payload);
      mapStatus.textContent = 'Проект загружен из localStorage.';
    });

    document.getElementById('export-json').addEventListener('click', () => {
      exportProjectToFile(serializeProject());
      mapStatus.textContent = 'Проект экспортирован в JSON.';
    });

    document.getElementById('import-json').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const payload = await importProjectFromFile(file);
        rehydrateProject(payload);
        mapStatus.textContent = 'Проект успешно импортирован.';
      } catch (error) {
        mapStatus.textContent = error.message;
      } finally {
        event.target.value = '';
      }
    });

    render();
  } catch (error) {
    mapStatus.textContent = error.message;
  }
}

setupApp();
