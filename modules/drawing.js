function cloneCoords(coords) {
  return JSON.parse(JSON.stringify(coords));
}

export function createDrawingManager({
  ymaps,
  map,
  mapContainer,
  onCreate,
  onSelect,
  onGeometryChange,
  onStatusChange,
}) {
  let activeTool = 'select';
  let drawingCoords = [];
  let tempGeoObject = null;
  let previewPoint = null;
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

  function removePreviewPoint() {
    if (previewPoint) {
      map.geoObjects.remove(previewPoint);
      previewPoint = null;
    }
  }

  function updateInteractionMode(isDrawing) {
    if (isDrawing) {
      map.behaviors.disable('drag');
      mapContainer.classList.add('drawing-cursor');
    } else {
      map.behaviors.enable('drag');
      mapContainer.classList.remove('drawing-cursor');
    }
  }

  function refreshTemp(cursorCoords = null) {
    removeTemp();

    if (activeTool !== 'polygon' && activeTool !== 'polyline') return;

    const previewCoords = cursorCoords ? [...drawingCoords, cursorCoords] : drawingCoords;

    if (activeTool === 'polygon' && previewCoords.length >= 2) {
      tempGeoObject = new ymaps.Polygon([previewCoords], {}, styleByKind('polygon'));
    }

    if (activeTool === 'polyline' && previewCoords.length >= 1) {
      tempGeoObject = new ymaps.Polyline(previewCoords, {}, styleByKind('polyline'));
    }

    if (tempGeoObject) {
      tempGeoObject.options.set('strokeStyle', 'dot');
      map.geoObjects.add(tempGeoObject);
    }
  }

  function refreshPreviewPoint(coords) {
    if (activeTool === 'select') {
      removePreviewPoint();
      return;
    }

    if (!previewPoint) {
      previewPoint = new ymaps.Placemark(coords, {}, { preset: 'islands#grayCircleDotIcon' });
      map.geoObjects.add(previewPoint);
      return;
    }

    previewPoint.geometry.setCoordinates(coords);
  }

  function isLineOrPolygonTool() {
    return activeTool === 'polygon' || activeTool === 'polyline';
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

    if (!isLineOrPolygonTool()) return;

    onCreate(activeTool, cloneCoords(drawingCoords));
    drawingCoords = [];
    removeTemp();
    updateStatus('Объект создан.');
  }

  function setEditable(geoObject, item, editable) {
    if (item.kind === 'point') {
      geoObject.options.set('draggable', editable);
      return;
    }

    if (editable) {
      geoObject.editor.startEditing();
    } else if (geoObject.editor && geoObject.editor.state.get('editing')) {
      geoObject.editor.stopEditing();
    }
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

    geoObject.events.add('geometrychange', () => {
      const type = geoObject.geometry.getType();
      const rawCoords = geoObject.geometry.getCoordinates();
      const coords = type.includes('Polygon') ? rawCoords[0] : rawCoords;
      onGeometryChange?.(item.id, coords);
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
    if (selectedObjectId === id) selectedObjectId = null;
  }

  function clearAllGeoObjects() {
    geoObjects.forEach((geoObject) => map.geoObjects.remove(geoObject));
    geoObjects.clear();
    selectedObjectId = null;
    drawingCoords = [];
    removeTemp();
    removePreviewPoint();
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
      setEditable(geoObject, { kind }, activeTool === 'select' && isSelected);
    });
  }

  function setTool(tool) {
    activeTool = tool;
    drawingCoords = [];
    selectedObjectId = null;
    removeTemp();

    const isDrawingMode = tool !== 'select';
    updateInteractionMode(isDrawingMode);

    geoObjects.forEach((geoObject, geoId) => {
      const isSelected = selectedObjectId === geoId;
      const kind = geoObject.geometry.getType().toLowerCase().includes('polygon')
        ? 'polygon'
        : geoObject.geometry.getType().toLowerCase().includes('line')
          ? 'polyline'
          : 'point';
      setEditable(geoObject, { kind }, tool === 'select' && isSelected);
    });

    if (tool === 'select') {
      removePreviewPoint();
      updateStatus('Режим навигации: карта двигается, объект можно выбрать и редактировать.');
    }
    if (tool === 'polygon') updateStatus('Рисование полигона: один клик — точка, двойной клик или "Завершить" — готово.');
    if (tool === 'polyline') updateStatus('Рисование линии: один клик — точка, двойной клик или "Завершить" — готово.');
    if (tool === 'point') updateStatus('Рисование точки: один клик по карте добавляет объект.');
  }

  function undoDrawingStep() {
    if (!drawingCoords.length) return;
    drawingCoords.pop();
    refreshTemp();
  }

  map.events.add('mousemove', (event) => {
    const coords = event.get('coords');
    refreshPreviewPoint(coords);
    if (activeTool === 'polygon' || activeTool === 'polyline') {
      refreshTemp(coords);
    }
  });

  map.events.add('click', (event) => {
    if (activeTool === 'select') return;
    const coords = event.get('coords');

    if (activeTool === 'point') {
      onCreate('point', coords);
      updateStatus('Точка добавлена.');
      return;
    }

    if (!isLineOrPolygonTool()) return;

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
    finishDrawing,
    stopDrawing: () => {
      drawingCoords = [];
      removeTemp();
      removePreviewPoint();
    },
  };
}
