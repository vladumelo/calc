function cloneCoords(coords) {
  return JSON.parse(JSON.stringify(coords));
}

export function createDrawingManager({ ymaps, map, onCreate, onSelect, onStatusChange }) {
  let activeTool = 'select';
  let drawingCoords = [];
  let tempGeoObject = null;
  let selectedObjectId = null;
  const geoObjects = new Map();

  function updateStatus(message) {
    onStatusChange?.(message);
  }

  function styleByKind(kind, selected = false) {
    const common = {
      strokeWidth: selected ? 4 : 3,
      strokeColor: selected ? '#2f66f6' : '#2085f5',
      fillColor: selected ? 'rgba(47, 102, 246, 0.25)' : 'rgba(32, 133, 245, 0.2)',
    };

    if (kind === 'point') {
      return {
        preset: selected ? 'islands#blueCircleDotIcon' : 'islands#darkBlueCircleDotIcon',
      };
    }

    return common;
  }

  function removeTemp() {
    if (tempGeoObject) {
      map.geoObjects.remove(tempGeoObject);
      tempGeoObject = null;
    }
  }

  function refreshTemp() {
    removeTemp();

    if (activeTool === 'polygon' && drawingCoords.length >= 2) {
      tempGeoObject = new ymaps.Polygon([drawingCoords], {}, styleByKind('polygon'));
    }

    if (activeTool === 'polyline' && drawingCoords.length >= 1) {
      tempGeoObject = new ymaps.Polyline(drawingCoords, {}, styleByKind('polyline'));
    }

    if (tempGeoObject) {
      tempGeoObject.options.set('strokeStyle', 'dot');
      map.geoObjects.add(tempGeoObject);
    }
  }

  function finishDrawing() {
    if (activeTool === 'polygon' && drawingCoords.length < 3) {
      updateStatus('Для полигона нужно минимум 3 точки.');
      return;
    }

    if (activeTool === 'polyline' && drawingCoords.length < 2) {
      updateStatus('Для линии нужно минимум 2 точки.');
      return;
    }

    if (activeTool === 'point') return;

    onCreate(activeTool, cloneCoords(drawingCoords));
    drawingCoords = [];
    removeTemp();
    updateStatus('Объект создан.');
  }

  function addGeoObject(item) {
    let geoObject;
    if (item.kind === 'polygon') {
      geoObject = new ymaps.Polygon([item.coords], {}, styleByKind('polygon'));
    } else if (item.kind === 'polyline') {
      geoObject = new ymaps.Polyline(item.coords, {}, styleByKind('polyline'));
    } else {
      geoObject = new ymaps.Placemark(item.coords, {}, styleByKind('point'));
    }

    geoObject.events.add('click', (event) => {
      event.preventDefault();
      selectObject(item.id);
      onSelect?.(item.id);
    });

    geoObject.properties.set('hintContent', item.name);
    geoObjects.set(item.id, geoObject);
    map.geoObjects.add(geoObject);
  }

  function updateGeoObject(item) {
    const geoObject = geoObjects.get(item.id);
    if (!geoObject) return;

    if (item.kind === 'polygon') geoObject.geometry.setCoordinates([item.coords]);
    if (item.kind === 'polyline') geoObject.geometry.setCoordinates(item.coords);
    if (item.kind === 'point') geoObject.geometry.setCoordinates(item.coords);
    geoObject.properties.set('hintContent', item.name);
  }

  function removeGeoObject(id) {
    const geoObject = geoObjects.get(id);
    if (!geoObject) return;
    map.geoObjects.remove(geoObject);
    geoObjects.delete(id);
    if (selectedObjectId === id) {
      selectedObjectId = null;
    }
  }

  function clearAllGeoObjects() {
    geoObjects.forEach((geoObject) => map.geoObjects.remove(geoObject));
    geoObjects.clear();
    selectedObjectId = null;
    drawingCoords = [];
    removeTemp();
  }

  function selectObject(id) {
    selectedObjectId = id;
    geoObjects.forEach((geoObject, geoId) => {
      const isSelected = geoId === id;
      const kind = geoObject.geometry.getType().toLowerCase().includes('polygon')
        ? 'polygon'
        : geoObject.geometry.getType().toLowerCase().includes('line')
          ? 'polyline'
          : 'point';
      geoObject.options.set(styleByKind(kind, isSelected));
    });
  }

  function setTool(tool) {
    activeTool = tool;
    drawingCoords = [];
    removeTemp();

    if (tool === 'select') {
      updateStatus('Режим выбора. Кликните по объекту на карте или в списке.');
    }
    if (tool === 'polygon') updateStatus('Полигон: кликайте точки, двойной клик — завершить.');
    if (tool === 'polyline') updateStatus('Линия: кликайте точки, двойной клик — завершить.');
    if (tool === 'point') updateStatus('Точка: клик по карте создаёт объект.');
  }

  function undoDrawingStep() {
    if (!drawingCoords.length) return;
    drawingCoords.pop();
    refreshTemp();
  }

  map.events.add('click', (event) => {
    if (activeTool === 'select') return;
    const coords = event.get('coords');

    if (activeTool === 'point') {
      onCreate('point', coords);
      updateStatus('Точка добавлена.');
      return;
    }

    drawingCoords.push(coords);
    refreshTemp();
  });

  map.events.add('dblclick', (event) => {
    if (activeTool !== 'polygon' && activeTool !== 'polyline') return;
    event.preventDefault();
    finishDrawing();
  });

  return {
    setTool,
    addGeoObject,
    updateGeoObject,
    removeGeoObject,
    clearAllGeoObjects,
    selectObject,
    undoDrawingStep,
    getSelectedObjectId: () => selectedObjectId,
    stopDrawing: () => {
      drawingCoords = [];
      removeTemp();
    },
  };
}
