export const WORK_TYPES = {
  polygon: [
    { id: 'concrete', label: 'Бетонное покрытие', unit: 'м²', defaultPrice: 2800, category: 'Покрытия' },
    { id: 'asphalt', label: 'Асфальт', unit: 'м²', defaultPrice: 2400, category: 'Покрытия' },
    { id: 'paving', label: 'Тротуарная плитка', unit: 'м²', defaultPrice: 3200, category: 'Покрытия' },
    { id: 'rubber', label: 'Резиновое покрытие', unit: 'м²', defaultPrice: 3500, category: 'Покрытия' },
    { id: 'lawn', label: 'Газон', unit: 'м²', defaultPrice: 900, category: 'Озеленение' },
    { id: 'gravel', label: 'Щебень', unit: 'м²', defaultPrice: 1100, category: 'Покрытия' },
  ],
  polyline: [
    { id: 'curb', label: 'Бордюр', unit: 'м.п.', defaultPrice: 1200, category: 'Ограждение' },
    { id: 'fence', label: 'Забор', unit: 'м.п.', defaultPrice: 3000, category: 'Ограждение' },
    { id: 'drain', label: 'Ливнесток', unit: 'м.п.', defaultPrice: 1800, category: 'Инженерия' },
    { id: 'cable', label: 'Кабель', unit: 'м.п.', defaultPrice: 1500, category: 'Инженерия' },
    { id: 'path', label: 'Дорожка', unit: 'м.п.', defaultPrice: 2100, category: 'Покрытия' },
  ],
  point: [
    { id: 'light', label: 'Светильник', unit: 'шт.', defaultPrice: 15000, category: 'МАФ' },
    { id: 'bench', label: 'Скамейка', unit: 'шт.', defaultPrice: 22000, category: 'МАФ' },
    { id: 'bin', label: 'Урна', unit: 'шт.', defaultPrice: 12000, category: 'МАФ' },
    { id: 'tree', label: 'Дерево', unit: 'шт.', defaultPrice: 4500, category: 'Озеленение' },
    { id: 'small-form', label: 'МАФ', unit: 'шт.', defaultPrice: 30000, category: 'МАФ' },
  ],
};

export function getDefaultWorkType(kind) {
  return WORK_TYPES[kind]?.[0] ?? null;
}

export function getWorkTypeById(kind, id) {
  return WORK_TYPES[kind]?.find((item) => item.id === id) ?? null;
}
