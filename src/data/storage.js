const MODULE_VERSION = new URL(import.meta.url).search;

const { LEGACY_STORAGE_KEYS, STORAGE_KEY } = await import(`../constants.js${MODULE_VERSION}`);

function parseStoredState(raw) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.songs) || !Array.isArray(parsed.records)) {
    return null;
  }

  return parsed;
}

export function loadStoredState(storageKey = STORAGE_KEY) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      return parseStoredState(raw);
    }

    if (storageKey !== STORAGE_KEY) {
      return null;
    }

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacyRaw = window.localStorage.getItem(legacyKey);
      if (!legacyRaw) {
        continue;
      }

      const legacyState = parseStoredState(legacyRaw);
      if (!legacyState) {
        continue;
      }

      window.localStorage.setItem(STORAGE_KEY, legacyRaw);
      window.localStorage.removeItem(legacyKey);
      return legacyState;
    }

    return null;
  } catch (error) {
    console.warn("Failed to load local state.", error);
    return null;
  }
}

export function saveStoredState(payload, storageKey = STORAGE_KEY) {
  const serialized = JSON.stringify(payload);
  window.localStorage.setItem(storageKey, serialized);
  if (storageKey === STORAGE_KEY) {
    LEGACY_STORAGE_KEYS.forEach((legacyKey) => {
      window.localStorage.removeItem(legacyKey);
    });
  }
}
