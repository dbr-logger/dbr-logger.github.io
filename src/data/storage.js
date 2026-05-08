const MODULE_VERSION = new URL(import.meta.url).search;

const { STORAGE_KEY } = await import(`../constants.js${MODULE_VERSION}`);

export function loadStoredState(storageKey = STORAGE_KEY) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.songs) || !Array.isArray(parsed.records)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("Failed to load local state.", error);
    return null;
  }
}

export function saveStoredState(payload, storageKey = STORAGE_KEY) {
  const serialized = JSON.stringify(payload);
  window.localStorage.setItem(storageKey, serialized);
}
