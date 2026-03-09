import { formatNumber } from './measurements.js';

export function recalculateObject(item) {
  const quantity = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  return {
    ...item,
    quantity,
    price,
    total: quantity * price,
  };
}

export function calculateTotals(items) {
  return items.reduce(
    (acc, item) => {
      const quantity = Number(item.quantity) || 0;
      const total = Number(item.total) || 0;

      if (item.kind === 'polygon') acc.area += quantity;
      if (item.kind === 'polyline') acc.length += quantity;
      if (item.kind === 'point') acc.points += quantity;
      acc.sum += total;
      return acc;
    },
    { area: 0, length: 0, points: 0, sum: 0 },
  );
}

export function getTotalsMarkup(totals) {
  return `
    <h2>Итоги сметы</h2>
    <div class="total-grid">
      <div class="total-item"><span>Общая площадь</span><b>${formatNumber(totals.area)} м²</b></div>
      <div class="total-item"><span>Общая длина</span><b>${formatNumber(totals.length)} м.п.</b></div>
      <div class="total-item"><span>Количество точек</span><b>${formatNumber(totals.points, 0)} шт.</b></div>
      <div class="total-item"><span>Итоговая стоимость</span><strong>${formatNumber(totals.sum)} ₽</strong></div>
    </div>
  `;
}
