const EARTH_RADIUS_M = 6371000;

function toRad(value) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(a, b) {
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLat = lat2 - lat1;
  const dLon = toRad(b[1] - a[1]);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(hav));
}

export function getPolylineLength(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < coords.length; i += 1) {
    sum += getDistanceMeters(coords[i - 1], coords[i]);
  }
  return sum;
}

export function getPolygonArea(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return 0;

  const lat0 = toRad(coords[0][0]);
  const projected = coords.map(([lat, lon]) => {
    const x = toRad(lon) * EARTH_RADIUS_M * Math.cos(lat0);
    const y = toRad(lat) * EARTH_RADIUS_M;
    return [x, y];
  });

  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area) / 2;
}

export function getQuantityByKind(kind, coords) {
  if (kind === 'polygon') return getPolygonArea(coords);
  if (kind === 'polyline') return getPolylineLength(coords);
  if (kind === 'point') return 1;
  return 0;
}

export function getUnitByKind(kind) {
  if (kind === 'polygon') return 'м²';
  if (kind === 'polyline') return 'м.п.';
  return 'шт.';
}

export function formatNumber(value, fraction = 2) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fraction,
  }).format(Number.isFinite(value) ? value : 0);
}
