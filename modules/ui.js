import { WORK_TYPES } from '../data/workTypes.js';
import { formatNumber } from './measurements.js';

const TOOL_DEFS = [
  { id: 'select', label: 'Выбор' },
  { id: 'polygon', label: 'Полигон' },
  { id: 'polyline', label: 'Линия' },
  { id: 'point', label: 'Точка' },
  { id: 'finish', label: 'Завершить' },
  { id: 'undo', label: 'Отменить' },
  { id: 'delete-selected', label: 'Удалить' },
  { id: 'clear', label: 'Очистить' },
];

function renderWorkTypeOptions(kind, selectedId) {
  return WORK_TYPES[kind]
    .map((type) => `<option value="${type.id}" ${type.id === selectedId ? 'selected' : ''}>${type.label}</option>`)
    .join('');
}

export function setupToolButtons(container, onToolClick) {
  container.innerHTML = TOOL_DEFS
    .map((tool) => {
      const extraClass = tool.id.includes('delete') || tool.id === 'clear' ? 'danger' : '';
      return `<button data-tool="${tool.id}" class="${extraClass}">${tool.label}</button>`;
    })
    .join('');

  container.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-tool]');
    if (!target) return;
    onToolClick(target.dataset.tool);
  });
}

export function setActiveTool(container, toolId) {
  container.querySelectorAll('button[data-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === toolId);
  });
}

export function renderObjectList(container, items, selectedId, handlers) {
  if (!items.length) {
    container.innerHTML = '<div class="object-empty">Пока нет объектов. Выберите инструмент и начните рисовать на карте.</div>';
    return;
  }

  container.innerHTML = items
    .map(
      (item, index) => `
      <article class="object-card ${selectedId === item.id ? 'selected' : ''}" data-id="${item.id}">
        <div class="card-head">
          <strong>#${index + 1}</strong>
          <span class="badge">${item.kind}</span>
        </div>
        <div class="object-row full">
          <label>Название
            <input type="text" data-field="name" value="${item.name}" />
          </label>
        </div>
        <div class="object-row">
          <label>Тип работы
            <select data-field="workTypeId">${renderWorkTypeOptions(item.kind, item.workTypeId)}</select>
          </label>
          <label>Ед. изм.
            <input type="text" value="${item.unit}" disabled />
          </label>
        </div>
        <div class="object-row">
          <label>Количество
            <input type="number" step="0.01" min="0" data-field="quantity" value="${item.quantity}" />
          </label>
          <label>Цена
            <input type="number" step="0.01" min="0" data-field="price" value="${item.price}" />
          </label>
        </div>
        <div class="object-row">
          <label>Сумма
            <input type="text" value="${formatNumber(item.total)} ₽" disabled />
          </label>
          <button class="delete-small" data-action="remove">Удалить</button>
        </div>
      </article>
    `,
    )
    .join('');

  container.querySelectorAll('.object-card').forEach((card) => {
    const id = card.dataset.id;
    card.addEventListener('click', () => handlers.onSelect(id));

    card.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('change', (event) => {
        handlers.onUpdate(id, event.target.dataset.field, event.target.value);
      });
    });

    const deleteButton = card.querySelector('[data-action="remove"]');
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      handlers.onRemove(id);
    });
  });
}

export function updateHint(container, text) {
  container.textContent = text;
}
