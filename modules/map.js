import { APP_CONFIG } from '../config.js';

function loadYandexMapsScript() {
  if (window.ymaps) return Promise.resolve(window.ymaps);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const keyPart = APP_CONFIG.yandexMapsApiKey ? `&apikey=${APP_CONFIG.yandexMapsApiKey}` : '';
    script.src = `https://api-maps.yandex.ru/2.1/?lang=${APP_CONFIG.yandexMapsLang}${keyPart}`;
    script.onload = () => resolve(window.ymaps);
    script.onerror = () => reject(new Error('Не удалось загрузить API Яндекс Карт.'));
    document.head.appendChild(script);
  });
}

export async function initMap(containerId) {
  const ymaps = await loadYandexMapsScript();
  await ymaps.ready();

  const map = new ymaps.Map(containerId, {
    center: APP_CONFIG.mapInitialCenter,
    zoom: APP_CONFIG.mapInitialZoom,
    controls: ['zoomControl', 'typeSelector', 'fullscreenControl'],
  });

  const searchControl = new ymaps.control.SearchControl({
    options: {
      provider: 'yandex#search',
      size: 'large',
      float: 'right',
      noPlacemark: true,
    },
  });
  map.controls.add(searchControl);

  return { ymaps, map, searchControl };
}

export function setMapType(map, type) {
  map.setType(type);
}
