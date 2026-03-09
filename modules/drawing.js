function cloneCoords(coords) {
  return JSON.parse(JSON.stringify(coords));
}

function detectKind(geoObject) {
  const type = geoObject.geometry.getType().toLowerCase();
  if (type.includes('polygon')) return 'polygon';
  if (type.includes('line')) return 'polyline';
  return 'point';
}

export function createDrawingManager({
  ymaps,
  map,
  mapContainer,
  onCreate,
  onSelect,
  onSelectionClear,
  onGeometryChange,
  onStatusChange,
}) {
  const drawing = {
    activeTool: 'select',
    points: [],
    draftObject: null,
    previewPoint: null,
    selectedObjectId: null,
  };

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

  function removeDraftObject() {
    if (!drawing.draftObject) return;
    map.geoObjects.remove(drawing.draftObject);
    drawing.draftObject = null;
  }

  function removePreviewPoint() {
    if (!drawing.previewPoint) return;
    map.geoObjects.remove(drawing.previewPoint);
    drawing.previewPoint = null;
  }

  function clearDrawingDraft() {
    drawing.points = [];
    removeDraftObject();
  }

  function isDrawTool(tool = drawing.activeTool) {
    return tool === 'polygon' || tool === 'polyline' || tool === 'point';
  }

  function updateInteractionMode() {
    const drawingMode = isDrawTool();

    if (drawingMode) {
      map.behaviors.disable('drag');
      mapContainer.classList.add('drawing-cursor');
    } else {
      map.behaviors.enable('drag');
      mapContainer.classList.remove('drawing-cursor');
    }
  }

  function rebuildDraftObject(cursorCoords = null) {
    removeDraftObject();

    if (drawing.activeTool !== 'polygon' && drawing.activeTool !== 'polyline') return;

    const coords = cursorCoords ? [...drawing.points, cursorCoords] : drawing.points;

    if (drawing.activeTool === 'polygon' && coords.length >= 2) {
      drawing.draftObject = new ymaps.Polygon([coords], {}, styleByKind('polygon'));
    }

    if (drawing.activeTool === 'polyline' && coords.length >= 1) {
      drawing.draftObject = new ymaps.Polyline(coords, {}, styleByKind('polyline'));
    }

    if (drawing.draftObject) {
      drawing.draftObject.options.set('strokeStyle', 'dot');
      map.geoObjects.add(drawing.draftObject);
    }
  }

  function updatePreviewPoint(coords) {
    if (!isDrawTool()) {
      removePreviewPoint();
      return;
    }

    if (!drawing.previewPoint) {
      drawing.previewPoint = new ymaps.Placemark(coords, {}, { preset: 'islands#grayCircleDotIcon' });
      map.geoObjects.add(drawing.previewPoint);
      return;
    }

    drawing.previewPoint.geometry.setCoordinates(coords);
  }

  function setEditable(geoObject, editable) {
    const kind = detectKind(geoObject);

    if (kind === 'point') {
      geoObject.options.set('draggable', editable);
      return;
    }

    if (!geoObject.editor) return;

    if (editable) {
      geoObject.editor.startEditing();
    } else if (geoObject.editor.state.get('editing')) {
      geoObject.editor.stopEditing();
    }
  }

  function finishDrawing() {
    if (drawing.activeTool === 'polygon' && drawing.points.length < 3) {
      updateStatus('Для полигона нужно минимум 3 точки.');
      return false;
    }

    if (drawing.activeTool === 'polyline' && drawing.points.length < 2) {
      updateStatus('Для линии нужно минимум 2 точки.');
      return false;
    }

    if (drawing.activeTool !== 'polygon' && drawing.activeTool !== 'polyline') return false;

    onCreate(drawing.activeTool, cloneCoords(drawing.points));
    clearDrawingDraft();
    updateStatus('Объект создан.');
    return true;
  }

  function selectObject(id) {
    drawing.selectedObjectId = id;

    geoObjects.forEach((geoObject, geoId) => {
      const isSelected = geoId === id;
      const kind = detectKind(geoObject);
      geoObject.options.set(styleByKind(kind, isSelected));
      setEditable(geoObject, drawing.activeTool === 'select' && isSelected);
    });
  }

  function setTool(tool) {
    drawing.activeTool = tool;
    clearDrawingDraft();
    removePreviewPoint();

    drawing.selectedObjectId = null;
    onSelectionClear?.();

    geoObjects.forEach((geoObject) => {
      const kind = detectKind(geoObject);
      geoObject.options.set(styleByKind(kind, false));
      setEditable(geoObject, false);
    });

    updateInteractionMode();

    if (tool === 'select') {
      updateStatus('Режим выбора: карта перемещается, клик по карте не рисует.');
    }
    if (tool === 'point') {
      updateStatus('Режим точки: один клик создаёт объект.');
    }
    if (tool === 'polygon') {
      updateStatus('Режим полигона: клик добавляет вершину, double click/Завершить — закончить.');
    }
    if (tool === 'polyline') {
      updateStatus('Режим линии: клик добавляет точку, double click/Завершить — закончить.');
    }
  }

  function undoDrawingStep() {
    if (!drawing.points.length) return;
    drawing.points.pop();
    rebuildDraftObject();
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

    if (drawing.selectedObjectId === id) {
      drawing.selectedObjectId = null;
      onSelectionClear?.();
    }
  }

  function clearAllGeoObjects() {
    geoObjects.forEach((geoObject) => map.geoObjects.remove(geoObject));
    geoObjects.clear();

    drawing.selectedObjectId = null;
    onSelectionClear?.();
    clearDrawingDraft();
    removePreviewPoint();
  }

  map.events.add('mousemove', (event) => {
    const coords = event.get('coords');
    updatePreviewPoint(coords);

    if (drawing.activeTool === 'polygon' || drawing.activeTool === 'polyline') {
      rebuildDraftObject(coords);
    }
  });

  map.events.add('click', (event) => {
    if (drawing.activeTool === 'select') return;

    const coords = event.get('coords');

    if (drawing.activeTool === 'point') {
      onCreate('point', coords);
      updateStatus('Точка добавлена.');
      return;
    }

    if (drawing.activeTool === 'polygon' || drawing.activeTool === 'polyline') {
      drawing.points.push(coords);
      rebuildDraftObject();
    }
  });

  map.events.add('dblclick', (event) => {
    if (drawing.activeTool !== 'polygon' && drawing.activeTool !== 'polyline') return;
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
      clearDrawingDraft();
      removePreviewPoint();
    },
  };
}
