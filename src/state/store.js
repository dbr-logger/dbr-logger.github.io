import { LAMP_OPTIONS } from "../constants.js?v=20260430-4";
import { exportVerticalCsv, importVerticalCsv } from "../data/csv.js?v=20260430-4";
import { attachKatateToDifficultyTable, fetchDifficultyTable } from "../data/difficulty.js?v=20260430-4";
import { exportDbrJson, importDbrJson } from "../data/export-json.js?v=20260430-4";
import { loadStoredState, saveStoredState } from "../data/storage.js?v=20260430-4";
import { compareIsoDates, todayIso } from "../utils/date.js?v=20260430-4";

const RECOMMEND_OPTIONS = ["", "△", "○", "◎", "☆"];
const PAGE_SIZE = 100;
const SORT_OPTIONS = ["title", "level", "splv", "katate", "latest", "clear"];
const AXIS_MODES = ["level", "splv", "katate", "title", "memo"];
const AXIS_MEMORY_MODES = ["level", "splv", "katate"];
const CHART_SUFFIX_ORDER = new Map([
  ["B", 0],
  ["N", 1],
  ["H", 2],
  ["A", 3],
  ["L", 4],
]);
function createRecordId(title, date) {
  const seed = Math.random().toString(16).slice(2, 8);
  return `${title}--${date}--${seed}`;
}

function splitTitleAndSuffix(title) {
  const normalizedTitle = String(title ?? "");
  const match = normalizedTitle.match(/^(.*)\(([BNHAL])\)$/);
  if (!match) {
    return {
      baseTitle: normalizedTitle,
      suffix: "",
      suffixRank: Number.POSITIVE_INFINITY,
    };
  }

  return {
    baseTitle: match[1],
    suffix: match[2],
    suffixRank: CHART_SUFFIX_ORDER.get(match[2]) ?? Number.POSITIVE_INFINITY,
  };
}

function compareTitlesWithSuffixOrder(aTitle, bTitle) {
  const a = splitTitleAndSuffix(aTitle);
  const b = splitTitleAndSuffix(bTitle);
  const baseCompare = a.baseTitle.localeCompare(b.baseTitle, "ja");
  if (baseCompare !== 0) {
    return baseCompare;
  }

  if (a.suffixRank !== b.suffixRank) {
    return a.suffixRank - b.suffixRank;
  }

  return String(aTitle).localeCompare(String(bTitle), "ja");
}

function sortSongs(a, b) {
  return a.sortOrder - b.sortOrder || a.reserveOrder - b.reserveOrder || compareTitlesWithSuffixOrder(a.title, b.title);
}

function sortRecords(a, b) {
  return compareIsoDates(a.date, b.date) || compareTitlesWithSuffixOrder(a.title, b.title);
}

function getLampRank(lamp) {
  const rank = LAMP_OPTIONS.indexOf(lamp);
  return rank >= 0 ? rank : 0;
}

function pickBetterLamp(a, b) {
  return getLampRank(a) >= getLampRank(b) ? a : b;
}

function parseOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRecommendSelection(values) {
  if (!Array.isArray(values)) {
    return [...RECOMMEND_OPTIONS];
  }

  return [...new Set(values.filter((value) => RECOMMEND_OPTIONS.includes(value)))];
}

function normalizeLampSelection(values) {
  if (!Array.isArray(values)) {
    return [...LAMP_OPTIONS];
  }

  return LAMP_OPTIONS.filter((lamp) => values.includes(lamp));
}

function normalizeBooleanFilter(value) {
  return value === "yes" || value === "no" ? value : "all";
}

function normalizeUnratedFilter(value) {
  return value === "all" || value === "rated" || value === "unrated" ? value : "all";
}

function normalizeAxisMode(value) {
  return AXIS_MODES.includes(value) ? value : "level";
}

function isTextAxisMode(axisMode) {
  return axisMode === "title" || axisMode === "memo";
}

function normalizeAxisMemory(axisMemory) {
  return {
    level: typeof axisMemory?.level === "string" ? axisMemory.level : "",
    splv: typeof axisMemory?.splv === "string" ? axisMemory.splv : "",
    katate: typeof axisMemory?.katate === "string" ? axisMemory.katate : "",
  };
}

function normalizeRangePair(minValue, maxValue) {
  const minNumber = parseOptionalNumber(minValue);
  const maxNumber = parseOptionalNumber(maxValue);

  if (minNumber === null || maxNumber === null || minNumber <= maxNumber) {
    return { min: minValue, max: maxValue };
  }

  return { min: maxValue, max: minValue };
}

function normalizeStoredFilters(filters) {
  return {
    axisMode: normalizeAxisMode(filters?.axisMode),
    axisValue: typeof filters?.axisValue === "string" ? filters.axisValue : "",
    titleQuery: typeof filters?.titleQuery === "string" ? filters.titleQuery : "",
    recommend: normalizeRecommendSelection(filters?.recommend),
    lamps: normalizeLampSelection(filters?.lamps),
    inf: normalizeBooleanFilter(filters?.inf),
    acdelete: normalizeBooleanFilter(filters?.acdelete),
    includeUnrated: normalizeUnratedFilter(filters?.includeUnrated),
  };
}

function normalizeSortMode(sortMode) {
  return SORT_OPTIONS.includes(sortMode) ? sortMode : "level";
}

function buildRecordIndex(records) {
  const index = new Map();

  records.forEach((record) => {
    if (!index.has(record.title)) {
      index.set(record.title, []);
    }
    index.get(record.title).push(record);
  });

  index.forEach((history) => history.sort(sortRecords));
  return index;
}

function buildDifficultyTextageIndex(difficultyTable) {
  const index = new Map();

  difficultyTable?.entries?.forEach((entry) => {
    if (entry?.title && entry?.textageid && !index.has(entry.title)) {
      index.set(entry.title, entry.textageid);
    }
  });

  return index;
}

function normalizeStoredData(stored) {
  const normalizedFilters = normalizeStoredFilters(stored.filters);
  
  const normalizedTextQueryMemory = {
    title: typeof stored.textQueryMemory?.title === "string" ? stored.textQueryMemory.title : "",
    memo: typeof stored.textQueryMemory?.memo === "string" ? stored.textQueryMemory.memo : "",
  };
  
  if (isTextAxisMode(normalizedFilters.axisMode)) {
    normalizedTextQueryMemory[normalizedFilters.axisMode] = normalizedFilters.titleQuery;
  }
  
  const normalizedTitleFilterBase = stored.titleFilterBase ? normalizeStoredFilters(stored.titleFilterBase) : null;
  const restoredFilters = isTextAxisMode(normalizedFilters.axisMode)
    ? (normalizedTitleFilterBase ? { ...normalizedTitleFilterBase } : {
      ...normalizedFilters,
      axisMode: "level",
      axisValue: "",
      titleQuery: "",
    })
    : normalizedFilters;

  return {
    songs: [...stored.songs].sort(sortSongs),
    records: [...stored.records]
      .filter((record) => record?.date && record?.title)
      .map((record) => ({
        id: record.id || createRecordId(record.title, record.date),
        date: record.date,
        title: record.title,
        level: Number(record.level) || 0,
        lamp: LAMP_OPTIONS.includes(record.lamp) ? record.lamp : "NO PLAY",
        bp: Number(record.bp) || 0,
        score: parseOptionalNumber(record.score),
        textageKey: typeof record.textageKey === "string" ? record.textageKey : "",
        source: record.source || "manual",
      }))
      .sort(sortRecords),
    difficultyTable: stored.difficultyTable ?? null,
    songNotes: typeof stored.songNotes === "object" && stored.songNotes !== null ? { ...stored.songNotes } : {},
    filters: restoredFilters,
    titleFilterBase: null,
    textQueryMemory: normalizedTextQueryMemory,
    axisMemory: normalizeAxisMemory(stored.axisMemory),
    sortMode: normalizedFilters.axisMode === "title"
      ? normalizeSortMode(stored.titleSortBase ?? stored.sortMode)
      : normalizeSortMode(stored.sortMode),
    titleSortBase: normalizeSortMode(stored.titleSortBase),
  };
}

function deriveSongState(song, history = []) {
  const latest = history.at(-1) ?? null;
  const bestLamp = history.reduce((best, record) => pickBetterLamp(best, record.lamp), song.initialLamp);
  const historicalBest = history.reduce((best, record) => Math.min(best, record.bp), Number.POSITIVE_INFINITY);
  const historicalBestScore = history.reduce((best, record) => (
    record.score === null || record.score === undefined ? best : Math.max(best, record.score)
  ), Number.NEGATIVE_INFINITY);
  const bestCandidates = [song.initialBestBp, Number.isFinite(historicalBest) ? historicalBest : null].filter((value) => value != null);

  return {
    ...song,
    history,
    entryCount: history.length,
    latestDate: latest?.date ?? null,
    latestLamp: latest?.lamp ?? song.initialLamp,
    bestLamp,
    currentBp: latest?.bp ?? song.initialBestBp,
    bestBp: bestCandidates.length > 0 ? Math.min(...bestCandidates) : null,
    currentScore: latest?.score ?? null,
    bestScore: Number.isFinite(historicalBestScore) ? historicalBestScore : null,
  };
}

function createDifficultyCatalogEntries(difficultyTable) {
  const chartMap = new Map();

  difficultyTable.entries.forEach((entry) => {
    const chartKey = `${entry.title}|${entry.textageid || ""}`;
    const isProposal = entry.level && entry.splv === "新規提案";

    if (!chartMap.has(chartKey)) {
      chartMap.set(chartKey, { ...entry, isProposed: isProposal });
    } else {
      const existing = chartMap.get(chartKey);
      if (isProposal && !existing.isProposed) {
        chartMap.set(chartKey, {
          ...entry,
          splv: existing.splv && existing.splv !== "新規提案" ? existing.splv : entry.splv,
          isProposed: true,
        });
      } else if (!isProposal && existing.isProposed) {
        if (entry.splv && entry.splv !== "新規提案") {
          existing.splv = entry.splv;
        }
      }
    }
  });

  return [...chartMap.values()].map((entry, index) => ({
    id: `difficulty:${entry.title}:${entry.textageid || "none"}:${entry.splv || "none"}:${entry.level || "none"}:${index}`,
    title: entry.title,
    level: entry.level,
    levelValue: parseOptionalNumber(entry.level),
    splv: entry.splv,
    splvValue: parseOptionalNumber(entry.splv),
    katate: entry.katate,
    katateValue: parseOptionalNumber(entry.katate),
    recommend: entry.recommend,
    inf: entry.inf,
    infAvailable: entry.inf === "○",
    acdelete: Boolean(entry.acdelete),
    notes: Number(entry.notes) || 0,
    textageid: entry.textageid,
    isProposed: entry.isProposed ?? false,
    chartType: entry.splv || entry.level ? "difficulty" : "difficulty-raw",
    initialLamp: "NO PLAY",
    initialBestBp: null,
  }));
}

function buildSummary(allSongStates, bandSongStates, targetSongStates, axisMode) {
  const lampCounts = LAMP_OPTIONS.reduce((counts, lamp) => {
    counts[lamp] = 0;
    return counts;
  }, {});

  targetSongStates.forEach((song) => {
    lampCounts[song.bestLamp] += 1;
  });

  const bandMap = new Map();

  function getBandValue(song) {
    if (axisMode === "splv") {
      return song.splvValue;
    }

    if (axisMode === "katate") {
      return song.katateValue;
    }

    return song.levelValue;
  }

  function formatBandLabel(value) {
    if (value === null) {
      return "☆-";
    }

    if (axisMode === "level") {
      return `☆${Number(value).toFixed(2)}`;
    }

    if (axisMode === "katate" && Number(value) === 13) {
      return "☆12.10";
    }

    return `☆${String(value)}`;
  }

  allSongStates.forEach((song) => {
    const value = getBandValue(song);
    const key = value === null ? "null" : String(value);
    if (!bandMap.has(key)) {
      bandMap.set(key, {
        key,
        value,
        label: formatBandLabel(value),
        total: 0,
        lampCounts: LAMP_OPTIONS.reduce((counts, lamp) => {
          counts[lamp] = 0;
          return counts;
        }, {}),
      });
    }
  });

  bandSongStates.forEach((song) => {
    const value = getBandValue(song);
    const key = value === null ? "null" : String(value);
    const band = bandMap.get(key);
    band.total += 1;
    band.lampCounts[song.bestLamp] += 1;
  });

  const bands = [...bandMap.values()].sort((a, b) => {
    if (a.value === null && b.value === null) {
      return 0;
    }
    if (a.value === null) {
      return 1;
    }
    if (b.value === null) {
      return -1;
    }
    return a.value - b.value;
  });

  return {
    axisMode,
    bandTotalSongs: bandSongStates.length,
    totalSongs: targetSongStates.length,
    lampCounts,
    bands,
  };
}

function compareLevelValue(a, b) {
  return (a.levelValue ?? Number.POSITIVE_INFINITY) - (b.levelValue ?? Number.POSITIVE_INFINITY);
}

function compareSplvValue(a, b) {
  return (a.splvValue ?? Number.POSITIVE_INFINITY) - (b.splvValue ?? Number.POSITIVE_INFINITY);
}

function compareTitleValue(a, b) {
  return compareTitlesWithSuffixOrder(a.title, b.title);
}

function compareKatateValue(a, b) {
  return (a.katateValue ?? Number.POSITIVE_INFINITY) - (b.katateValue ?? Number.POSITIVE_INFINITY);
}

function compareLatestDateValue(a, b) {
  if (a.latestDate === null && b.latestDate === null) {
    return 0;
  }
  if (a.latestDate === null) {
    return -1;
  }
  if (b.latestDate === null) {
    return 1;
  }
  return compareIsoDates(a.latestDate, b.latestDate);
}

export function createStore() {
  const listeners = new Set();
  const state = {
    songs: [],
    records: [],
    difficultyTable: null,
    songNotes: {},
    catalogVisibleSignature: "",
    catalogVisibleTitleOrder: [],
    titleFilterBase: null,
    titleSortBase: "level",
    axisMemory: {
      level: "",
      splv: "",
      katate: "",
    },
    textQueryMemory: {
      title: "",
      memo: "",
    },
    filters: {
      axisMode: "level",
      axisValue: "",
      titleQuery: "",
      recommend: [...RECOMMEND_OPTIONS],
      lamps: [...LAMP_OPTIONS],
      inf: "all",
      acdelete: "all",
      includeUnrated: "all",
    },
    sortMode: "level",
    currentPage: 1,
    selectedTitle: null,
    statusMessage: "",
    sourceLabel: "",
    ready: false,
    error: "",
  };

  function emit(snapshot = getSnapshot()) {
    listeners.forEach((listener) => listener(snapshot));
  }

  function persist() {
    saveStoredState({
      songs: state.songs,
      records: state.records,
      difficultyTable: state.difficultyTable,
      songNotes: state.songNotes,
      titleFilterBase: state.titleFilterBase,
      titleSortBase: state.titleSortBase,
      textQueryMemory: state.textQueryMemory,
      axisMemory: state.axisMemory,
      filters: state.filters,
      sortMode: state.sortMode,
    });
  }
  
  function createCatalogVisibleSignature() {
    return JSON.stringify({
      filters: state.filters,
      sortMode: state.sortMode,
    });
  }
  
  function invalidateCatalogVisibleOrder() {
    state.catalogVisibleSignature = "";
    state.catalogVisibleTitleOrder = [];
  }
  
  function applyStableVisibleOrder(visibleSongs) {
    const signature = createCatalogVisibleSignature();
  
    if (
      state.catalogVisibleSignature === signature
      && state.catalogVisibleTitleOrder.length > 0
    ) {
      const songByTitle = new Map(visibleSongs.map((song) => [song.title, song]));
      const usedTitles = new Set();
  
      const stableSongs = state.catalogVisibleTitleOrder
        .map((title) => {
          const song = songByTitle.get(title);
          if (song) {
            usedTitles.add(title);
          }
          return song;
        })
        .filter(Boolean);
  
      const appendedSongs = visibleSongs.filter((song) => !usedTitles.has(song.title));
  
      return [...stableSongs, ...appendedSongs];
    }
  
    state.catalogVisibleSignature = signature;
    state.catalogVisibleTitleOrder = visibleSongs.map((song) => song.title);
    return visibleSongs;
  }

  function rememberTextQuery(axisMode, query) {
    if (!isTextAxisMode(axisMode)) {
      return;
    }
  
    state.textQueryMemory[axisMode] = typeof query === "string" ? query : "";
  }
  
  function getRememberedTextQuery(axisMode) {
    return isTextAxisMode(axisMode)
      ? state.textQueryMemory[axisMode] ?? ""
      : "";
  }

  function ensureSelectedSong(snapshot = getSnapshot()) {
    const visibleTitles = new Set(snapshot.pagedSongs.map((song) => song.title));
  
    if (!state.selectedTitle || !visibleTitles.has(state.selectedTitle)) {
      state.selectedTitle = snapshot.pagedSongs[0]?.title ?? snapshot.visibleSongs[0]?.title ?? null;
  
      return {
        ...snapshot,
        selectedTitle: state.selectedTitle,
      };
    }
  
    return snapshot;
  }

  function getCatalogEntries() {
    return state.difficultyTable?.entries?.length ? createDifficultyCatalogEntries(state.difficultyTable) : [];
  }

  function matchesFiltersFor(entry, filters) {
    if (filters.axisMode === "title") {
      const query = filters.titleQuery.trim().toLocaleLowerCase("ja");
      return !query || entry.title.toLocaleLowerCase("ja").includes(query);
    }
    
    if (filters.axisMode === "memo") {
      const query = filters.titleQuery.trim().toLocaleLowerCase("ja");
      const note = String(entry.note ?? "").toLocaleLowerCase("ja");
      return !query || note.includes(query);
    }

    if (filters.axisMode === "katate" && entry.katateValue === null) {
      return false;
    }

    if (entry.levelValue === null) {
      if (filters.includeUnrated === "rated") {
        return false;
      }
    } else if (filters.includeUnrated === "unrated") {
      return false;
    }

    if (filters.axisMode === "level") {
      const selectedLevel = parseOptionalNumber(filters.axisValue);
      if (selectedLevel !== null && entry.levelValue !== selectedLevel) {
        return false;
      }
    }

    if (filters.axisMode === "splv") {
      const selectedSplv = parseOptionalNumber(filters.axisValue);
      if (selectedSplv !== null && entry.splvValue !== selectedSplv) {
        return false;
      }
    }

    if (filters.axisMode === "katate") {
      const selectedKatate = parseOptionalNumber(filters.axisValue);
      if (selectedKatate !== null && entry.katateValue !== selectedKatate) {
        return false;
      }
    }

    if (!filters.recommend.includes(entry.recommend)) {
      return false;
    }

    if (!filters.lamps.includes(entry.bestLamp)) {
      return false;
    }

    if (filters.inf === "yes" && !entry.infAvailable) {
      return false;
    }

    if (filters.inf === "no" && entry.infAvailable) {
      return false;
    }

    if (filters.acdelete === "yes" && !entry.acdelete) {
      return false;
    }

    if (filters.acdelete === "no" && entry.acdelete) {
      return false;
    }

    return true;
  }

  async function initialize() {
    try {
      const stored = loadStoredState();

      if (stored) {
        const normalized = normalizeStoredData(stored);
        let didMutateStoredData = false;
        state.songs = normalized.songs;
        state.records = normalized.records;
        state.difficultyTable = normalized.difficultyTable;
        state.songNotes = normalized.songNotes;
        state.titleFilterBase = normalized.titleFilterBase;
        state.titleSortBase = normalized.titleSortBase;
        state.textQueryMemory = normalized.textQueryMemory;
        state.axisMemory = normalized.axisMemory;
        state.filters = normalized.filters;
        state.sortMode = normalized.sortMode;

        if (state.difficultyTable?.entries?.length) {
          try {
            const { table, changedCount } = await attachKatateToDifficultyTable(state.difficultyTable);
            state.difficultyTable = table;
            if (changedCount > 0) {
              didMutateStoredData = true;
            }
          } catch {
            // Keep existing data if local katate hydration fails.
          }
        }

        if (didMutateStoredData) {
          persist();
        }

        state.sourceLabel = "ローカルストレージから復元";
        if (!state.statusMessage) {
          state.statusMessage = `保存済みデータを読み込みました。記録数 ${state.records.length} 件`;
        }
      } else {
        state.songs = [];
        state.records = [];
        state.difficultyTable = null;
        state.sourceLabel = "";
        state.statusMessage = "難易度表を読み込むと曲一覧を表示できます。";
        persist();
      }

      state.ready = true;
      ensureSelectedSong();
      emit();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "初期化に失敗しました。";
      state.statusMessage = state.error;
      state.ready = true;
      emit();
    }
  }

  function setDifficultyFilters(nextFilters) {
    const previousFilters = state.filters;
    const nextAxisMode = normalizeAxisMode(nextFilters.axisMode ?? state.filters.axisMode);
    const axisModeChanged = nextAxisMode !== previousFilters.axisMode;
    const nextAxisMemory = { ...state.axisMemory };

    if (AXIS_MEMORY_MODES.includes(previousFilters.axisMode)) {
      nextAxisMemory[previousFilters.axisMode] = previousFilters.axisValue;
    }

    let nextAxisValue = typeof nextFilters.axisValue === "string"
      ? nextFilters.axisValue
      : state.filters.axisValue;
    let nextTitleQuery = typeof nextFilters.titleQuery === "string"
      ? nextFilters.titleQuery
      : state.filters.titleQuery;

    if (axisModeChanged) {
      const wasTextAxisMode = isTextAxisMode(previousFilters.axisMode);
      const nextIsTextAxisMode = isTextAxisMode(nextAxisMode);
    
      if (wasTextAxisMode) {
        rememberTextQuery(previousFilters.axisMode, previousFilters.titleQuery);
      }
    
      if (nextIsTextAxisMode) {
        if (!wasTextAxisMode) {
          state.titleFilterBase = { ...previousFilters };
          state.titleSortBase = state.sortMode;
        }
    
        state.sortMode = "title";
        nextAxisValue = "";
        nextTitleQuery = getRememberedTextQuery(nextAxisMode);
      } else {
        if (wasTextAxisMode) {
          state.sortMode = state.titleSortBase;
        }
    
        state.titleFilterBase = null;
        nextAxisValue = typeof nextFilters.axisValue === "string"
          ? nextFilters.axisValue
          : nextAxisMemory[nextAxisMode] ?? "";
        nextTitleQuery = "";
      }
    }

    const nextStateFilters = {
      ...state.filters,
      ...nextFilters,
      axisMode: nextAxisMode,
      axisValue: typeof nextAxisValue === "string" ? nextAxisValue : "",
      titleQuery: typeof nextTitleQuery === "string" ? nextTitleQuery : "",
      recommend: nextFilters.recommend ? normalizeRecommendSelection(nextFilters.recommend) : state.filters.recommend,
      lamps: nextFilters.lamps ? normalizeLampSelection(nextFilters.lamps) : state.filters.lamps,
      inf: nextFilters.inf ? normalizeBooleanFilter(nextFilters.inf) : state.filters.inf,
      acdelete: nextFilters.acdelete ? normalizeBooleanFilter(nextFilters.acdelete) : state.filters.acdelete,
      includeUnrated: normalizeUnratedFilter(nextFilters.includeUnrated ?? state.filters.includeUnrated),
    };

    if (nextStateFilters.includeUnrated === "unrated" && nextStateFilters.axisMode === "level") {
      nextStateFilters.axisValue = "";
    }

    if (isTextAxisMode(nextStateFilters.axisMode)) {
      rememberTextQuery(nextStateFilters.axisMode, nextStateFilters.titleQuery);
    } else if (AXIS_MEMORY_MODES.includes(nextStateFilters.axisMode)) {
      nextAxisMemory[nextStateFilters.axisMode] = nextStateFilters.axisValue;
    }

    state.axisMemory = nextAxisMemory;
    state.filters = nextStateFilters;
    invalidateCatalogVisibleOrder();
    state.currentPage = 1;
    persist();
    
    let snapshot = getSnapshot();
    snapshot = ensureSelectedSong(snapshot);
    emit(snapshot);
  }

  function clearTitleFilter() {
    if (!state.titleFilterBase) {
      return;
    }

    rememberTextQuery(state.filters.axisMode, state.filters.titleQuery);
    state.filters = { ...state.titleFilterBase };
    state.titleFilterBase = null;
    state.sortMode = state.titleSortBase;
    invalidateCatalogVisibleOrder();
    state.currentPage = 1;
    persist();
    ensureSelectedSong();
    emit();
  }

  function setPage(nextPage) {
    const snapshot = getSnapshot();
    const totalPages = snapshot.pagination.totalPages;
    const normalized = Math.max(1, Math.min(nextPage, totalPages));

    if (normalized === state.currentPage) {
      return;
    }

    state.currentPage = normalized;
    ensureSelectedSong();
    emit();
  }

  function setSortMode(nextSortMode) {
    const normalized = normalizeSortMode(nextSortMode);
    if (normalized === state.sortMode) {
      return;
    }

    state.sortMode = normalized;
    invalidateCatalogVisibleOrder();
    state.currentPage = 1;
    persist();
    ensureSelectedSong();
    emit();
  }

  function selectSong(title) {
    state.selectedTitle = title;
    emit();
  }

  function saveRecord({ lamp, bp, score, memo }) {
    if (!state.selectedTitle) {
      return { ok: false, message: "曲を選択してください。" };
    }

    if (!LAMP_OPTIONS.includes(lamp)) {
      return { ok: false, message: "ランプを選択してください。" };
    }

    const normalizedBp = Number(bp);
    if (!Number.isInteger(normalizedBp) || normalizedBp < 0) {
      return { ok: false, message: "BPは0以上の整数で入力してください。" };
    }

    const normalizedScore = Number(score);
    if (!Number.isInteger(normalizedScore) || normalizedScore < 0) {
      return { ok: false, message: "スコアは0以上の整数で入力してください。" };
    }

    const selectedEntry = getCatalogEntries().find((item) => item.title === state.selectedTitle);
    if (!selectedEntry) {
      return { ok: false, message: "選択中の曲情報が見つかりません。" };
    }

    const normalizedMemo = String(memo ?? "").trim();
    if (normalizedMemo) {
      state.songNotes[selectedEntry.title] = normalizedMemo;
    } else {
      delete state.songNotes[selectedEntry.title];
    }

    const date = todayIso();
    const existingIndex = state.records.findIndex((record) => record.title === selectedEntry.title && record.date === date);

    if (existingIndex >= 0) {
      state.records[existingIndex] = {
        ...state.records[existingIndex],
        lamp,
        bp: normalizedBp,
        score: normalizedScore,
        source: "manual",
      };
      state.statusMessage = `${selectedEntry.title} の ${date} の記録を更新しました。`;
    } else {
      const chartSuffix = selectedEntry.title.match(/\(([BNHAL])\)$/)?.[0] ?? "";
      state.records.push({
        id: createRecordId(selectedEntry.title, date),
        date,
        title: selectedEntry.title,
        level: selectedEntry.levelValue ?? 0,
        lamp,
        bp: normalizedBp,
        score: normalizedScore,
        textageKey: selectedEntry.textageid ? `${selectedEntry.textageid}${chartSuffix}` : "",
        source: "manual",
      });
      state.statusMessage = `${selectedEntry.title} の記録を保存しました。`;
    }

    state.records.sort(sortRecords);
    persist();
    emit();
    return { ok: true, message: state.statusMessage };
  }

  function deleteTodayRecord() {
    if (!state.selectedTitle) {
      return { ok: false, message: "曲を選択してください。" };
    }

    const selectedEntry = getCatalogEntries().find((item) => item.title === state.selectedTitle);
    if (!selectedEntry) {
      return { ok: false, message: "選択中の曲情報が見つかりません。" };
    }

    const date = todayIso();
    const beforeCount = state.records.length;
    state.records = state.records.filter((record) => !(record.title === selectedEntry.title && record.date === date));

    if (state.records.length === beforeCount) {
      return { ok: false, message: `${selectedEntry.title} の ${date} の記録はありません。` };
    }

    state.statusMessage = `${selectedEntry.title} の ${date} の記録を削除しました。`;
    persist();
    emit();
    return { ok: true, message: state.statusMessage };
  }

  function saveSongNote(note) {
    if (!state.selectedTitle) {
      return { ok: false, message: "曲を選択してください。" };
    }

    const selectedEntry = getCatalogEntries().find((item) => item.title === state.selectedTitle);
    if (!selectedEntry) {
      return { ok: false, message: "選択中の曲情報が見つかりません。" };
    }

    const normalizedMemo = String(note ?? "").trim();
    if (normalizedMemo) {
      state.songNotes[selectedEntry.title] = normalizedMemo;
      state.statusMessage = `${selectedEntry.title} のメモを保存しました。`;
    } else {
      delete state.songNotes[selectedEntry.title];
      state.statusMessage = `${selectedEntry.title} のメモを削除しました。`;
    }

    persist();
    emit();
    return { ok: true, message: state.statusMessage };
  }

  function getExportJson() {
    const difficultyTextageIndex = buildDifficultyTextageIndex(state.difficultyTable);
    const recordIndex = buildRecordIndex(state.records);
    const exportEntries = [...recordIndex.entries()].map(([title, history]) => {
      const bestLamp = history.reduce((best, record) => pickBetterLamp(best, record.lamp), "NO PLAY");
      const bestBp = history.reduce((best, record) => Math.min(best, record.bp), Number.POSITIVE_INFINITY);
      const bestScore = history.reduce((best, record) => (
        record.score === null || record.score === undefined ? best : Math.max(best, record.score)
      ), Number.NEGATIVE_INFINITY);
      const storedTextageKey = history.find((record) => record.textageKey)?.textageKey ?? "";
      const textageid = difficultyTextageIndex.get(title) ?? "";
      const suffix = title.slice(-3);
      const latestTextageKey = textageid && /^\([A-Z]\)$/.test(suffix) ? `${textageid}${suffix}` : storedTextageKey;

      return {
        title,
        entryCount: history.length,
        bestLamp,
        bestBp: Number.isFinite(bestBp) ? bestBp : null,
        bestScore: Number.isFinite(bestScore) ? bestScore : null,
        textageid,
        textageKey: latestTextageKey,
      };
    });

    return exportDbrJson(exportEntries);
  }

  function getExportCsv() {
    return exportVerticalCsv(state.records, state.songNotes);
  }

  function importJsonData(payload, referenceDate = todayIso()) {
    const importedRecords = importDbrJson(payload, referenceDate).map((record) => {
      const selectedEntry = getCatalogEntries().find((entry) => entry.title === record.title);

      return {
        id: createRecordId(record.title, record.date),
        date: record.date,
        title: record.title,
        level: selectedEntry?.levelValue ?? 0,
        lamp: record.lamp,
        bp: record.bp,
        score: record.score,
        textageKey: record.textageKey,
        source: record.source,
      };
    });

    const importedKeys = new Set(importedRecords.map((record) => `${record.title}::${record.date}`));
    const preservedRecords = state.records.filter((record) => !importedKeys.has(`${record.title}::${record.date}`));

    state.records = [...preservedRecords, ...importedRecords].sort(sortRecords);
    invalidateCatalogVisibleOrder();
    state.currentPage = 1;
    state.statusMessage = `JSONを読み込みました。${importedRecords.length} 件を取り込み、合計 ${state.records.length} 件になりました。`;
    persist();
    ensureSelectedSong();
    emit();
    return { count: importedRecords.length, totalCount: state.records.length };
  }

  function importCsvData(text) {
    const { records, songNotes } = importVerticalCsv(text);
    const importedRecords = records.map((record) => ({
      id: createRecordId(record.title, record.date),
      date: record.date,
      title: record.title,
      level: record.level,
      lamp: LAMP_OPTIONS.includes(record.lamp) ? record.lamp : "NO PLAY",
      bp: record.bp,
      score: record.score ?? null,
      textageKey: "",
      source: record.source,
    }));

    const importedKeys = new Set(importedRecords.map((record) => `${record.title}::${record.date}`));
    const preservedRecords = state.records.filter((record) => !importedKeys.has(`${record.title}::${record.date}`));

    state.records = [...preservedRecords, ...importedRecords].sort(sortRecords);
    state.songNotes = {
      ...state.songNotes,
      ...songNotes,
    };
    invalidateCatalogVisibleOrder();
    state.currentPage = 1;
    state.statusMessage = `CSVを読み込みました。${importedRecords.length} 件を取り込み、合計 ${state.records.length} 件になりました。`;
    persist();
    ensureSelectedSong();
    emit();
    return { count: importedRecords.length, totalCount: state.records.length };
  }

  function clearAllRecords() {
    state.records = [];
    invalidateCatalogVisibleOrder();
    state.currentPage = 1;
    state.statusMessage = "プレー記録をすべて削除しました。";
    persist();
    ensureSelectedSong();
    emit();
  }

  async function importDifficultyTable() {
    const result = await fetchDifficultyTable();
    state.difficultyTable = result;
    migrateRecordTitlesByTextageKey(result);
    updateTextageKeyFromDifficultyTable(result);
    invalidateCatalogVisibleOrder();
    state.statusMessage = `難易度表を読み込みました。${result.titleCount}曲 / ${result.entries.length}譜面`;
    persist();
    emit();
    return result;
  }

  function migrateRecordTitlesByTextageKey(difficultyTable) {
    const textageKeyToNewTitle = new Map();
    difficultyTable.entries.forEach((entry) => {
      if (!entry.textageid || !entry.title) return;
      const suffix = entry.title.slice(-3);
      if (!/^\([A-Z]\)$/.test(suffix)) return;
      const key = `${entry.textageid}${suffix}`;
      textageKeyToNewTitle.set(key, entry.title);
    });

    state.records = state.records.map((record) => {
      if (!record.textageKey) return record;
      const newTitle = textageKeyToNewTitle.get(record.textageKey);
      if (!newTitle || newTitle === record.title) return record;
      return { ...record, title: newTitle };
    });
  }

  function updateTextageKeyFromDifficultyTable(difficultyTable) {
    const titleToTextageKey = new Map();
    difficultyTable.entries.forEach((entry) => {
      if (!entry.textageid || !entry.title) return;
      const suffix = entry.title.slice(-3);
      if (!/^\([A-Z]\)$/.test(suffix)) return;
      titleToTextageKey.set(entry.title, `${entry.textageid}${suffix}`);
    });

    state.records = state.records.map((record) => {
      const newTextageKey = titleToTextageKey.get(record.title);
      if (!newTextageKey || newTextageKey === record.textageKey) return record;
      return { ...record, textageKey: newTextageKey };
    });
  }

  function getSnapshot() {
    const catalogEntries = getCatalogEntries();
    const recordIndex = buildRecordIndex(state.records);
    const songStates = catalogEntries.map((entry) => ({
      ...deriveSongState(entry, recordIndex.get(entry.title) ?? []),
      note: state.songNotes[entry.title] ?? "",
    })).sort((a, b) => {
      const allowUnrated = state.filters.includeUnrated !== "rated";
      const tieBreak = allowUnrated
        ? () => compareSplvValue(a, b) || compareTitleValue(a, b)
        : () => compareLevelValue(a, b) || compareSplvValue(a, b) || compareTitleValue(a, b);

      if (state.sortMode === "title") {
        return compareTitleValue(a, b)
          || (allowUnrated ? compareSplvValue(a, b) : compareLevelValue(a, b) || compareSplvValue(a, b));
      }

      if (state.sortMode === "splv") {
        return compareSplvValue(a, b) || (allowUnrated ? compareTitleValue(a, b) : compareLevelValue(a, b) || compareTitleValue(a, b));
      }

      if (state.sortMode === "katate") {
        return compareKatateValue(a, b) || (allowUnrated ? compareSplvValue(a, b) || compareTitleValue(a, b) : compareLevelValue(a, b) || compareSplvValue(a, b) || compareTitleValue(a, b));
      }

      if (state.sortMode === "latest") {
        return compareLatestDateValue(a, b) || tieBreak();
      }

      if (state.sortMode === "clear") {
        const lampA = getLampRank(a.bestLamp);
        const lampB = getLampRank(b.bestLamp);
        return lampA - lampB || tieBreak();
      }

      return compareLevelValue(a, b) || compareSplvValue(a, b) || compareTitleValue(a, b);
    });
    const filteredVisibleSongs = songStates.filter((entry) => matchesFiltersFor(entry, state.filters));
    const visibleSongs = applyStableVisibleOrder(filteredVisibleSongs);
    const summaryFilters = isTextAxisMode(state.filters.axisMode) && state.titleFilterBase
      ? state.titleFilterBase
      : state.filters;
    const summaryScopeFilters = isTextAxisMode(summaryFilters.axisMode)
      ? { ...summaryFilters }
      : { ...summaryFilters, axisValue: "" };
    const summaryBandBaseSongs = summaryFilters.axisMode === "katate"
      ? songStates.filter((entry) => entry.katateValue !== null)
      : songStates;
    const summarySongs = summaryBandBaseSongs.filter((entry) => matchesFiltersFor(entry, summaryScopeFilters));
    const summaryCountFilters = {
      ...state.filters,
      lamps: [...LAMP_OPTIONS],
    };
    const summaryCountSongs = songStates.filter((entry) => matchesFiltersFor(entry, summaryCountFilters));
    const totalPages = Math.max(1, Math.ceil(visibleSongs.length / PAGE_SIZE));
    const currentPage = Math.max(1, Math.min(state.currentPage, totalPages));
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pagedSongs = visibleSongs.slice(pageStart, pageStart + PAGE_SIZE);
    const selectedSong = pagedSongs.find((song) => song.title === state.selectedTitle)
      ?? pagedSongs[0]
      ?? visibleSongs[0]
      ?? null;
    const selectedHistory = selectedSong ? [...selectedSong.history].sort((a, b) => compareIsoDates(b.date, a.date)) : [];
    const hasTodayRecord = selectedHistory.some((record) => record.date === todayIso());

    return {
      ...state,
      currentPage,
      songStates,
      visibleSongs,
      pagedSongs,
      selectedSong,
      selectedHistory,
      hasTodayRecord,
      difficultyTable: state.difficultyTable,
      pagination: {
        currentPage,
        totalPages,
        pageSize: PAGE_SIZE,
        totalItems: visibleSongs.length,
        startIndex: visibleSongs.length === 0 ? 0 : pageStart + 1,
        endIndex: Math.min(pageStart + PAGE_SIZE, visibleSongs.length),
      },
      summary: buildSummary(summaryBandBaseSongs, summarySongs, summaryCountSongs, summaryFilters.axisMode),
      summaryFilters,
    };
  }

  return {
    initialize,
    setDifficultyFilters,
    clearTitleFilter,
    setSortMode,
    setPage,
    selectSong,
    saveRecord,
    deleteTodayRecord,
    saveSongNote,
    importDifficultyTable,
    getExportJson,
    getExportCsv,
    importCsvData,
    importJsonData,
    clearAllRecords,
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
