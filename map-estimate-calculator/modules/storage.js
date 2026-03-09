export function saveProjectToLocalStorage(storageKey, payload) {
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function loadProjectFromLocalStorage(storageKey) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function exportProjectToFile(payload, fileName = 'map-estimate-project.json') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function importProjectFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (error) {
        reject(new Error('Некорректный JSON-файл.'));
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsText(file, 'utf-8');
  });
}
