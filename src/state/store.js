const MODULE_VERSION = new URL(import.meta.url).search;

const { LAMP_OPTIONS } = await import(`../constants.js${MODULE_VERSION}`);
const { exportVerticalCsv, importVerticalCsv } = await import(`../data/csv.js${MODULE_VERSION}`);
const { attachKatateToDifficultyTable, fetchDifficultyTable } = await import(`../data/difficulty.js${MODULE_VERSION}`);
const { exportDbrJson, importDbrJson } = await import(`../data/export-json.js${MODULE_VERSION}`);
const { loadStoredState, saveStoredState } = await import(`../data/storage.js${MODULE_VERSION}`);
const { compareIsoDates, formatLocalDateTime, todayIso } = await import(`../utils/date.js${MODULE_VERSION}`);
const { getSearchTextMatchRank, matchesSearchText } = await import(`../utils/search.js${MODULE_VERSION}`);

const RECOMMEND_OPTIONS = ["", "△", "○", "◎", "☆"];
const PAGE_SIZE = 100;
const SORT_OPTIONS = ["title", "level", "splv", "katate", "clear", "bestBp", "latestBp", "latest", "recommend", "memo"];
const AXIS_MODES = ["level", "splv", "katate", "title", "memo", "date"];
const AXIS_MEMORY_MODES = ["level", "splv", "katate"];
const NUMERIC_AXIS_MODES = ["level", "splv", "katate"];
const DEFAULT_SORT_MODE_BY_AXIS = {
  level: "level",
  splv: "splv",
  katate: "katate",
  title: "title",
  memo: "memo",
  date: "latest",
};
const CHART_SUFFIX_ORDER = new Map([
  ["B", 0],
  ["N", 1],
  ["H", 2],
  ["A", 3],
  ["L", 4],
]);
const RECOMMEND_SORT_RANK = new Map([
  ["☆", 0],
  ["◎", 1],
  ["○", 2],
  ["△", 3],
  ["", 4],
]);
const RECORD_ID_PREFIX = "record--";

function createRecordId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${RECORD_ID_PREFIX}${crypto.randomUUID()}`;
  }

  return `${RECORD_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isCanonicalRecordId(id) {
  return typeof id === "string" && id.startsWith(RECORD_ID_PREFIX);
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
  return compareRecordTimestamps(a, b) || compareIsoDates(a.date, b.date) || compareTitlesWithSuffixOrder(a.title, b.title);
}

function normalizeRecordTimestamp(timestamp, date) {
  const normalized = String(timestamp ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return date ? `${date}T00:00:00` : "";
}

function compareRecordTimestamps(a, b) {
  const aTimestamp = normalizeRecordTimestamp(a?.timestamp, a?.date);
  const bTimestamp = normalizeRecordTimestamp(b?.timestamp, b?.date);
  return aTimestamp.localeCompare(bTimestamp);
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

function isNumericAxisMode(axisMode) {
  return NUMERIC_AXIS_MODES.includes(axisMode);
}

function isAxisRangeModeEnabled(filters) {
  return NUMERIC_AXIS_MODES.some((axisMode) => Boolean(filters.axisRangeModeByAxis?.[axisMode]));
}

function normalizeAxisMemory(axisMemory) {
  return {
    level: typeof axisMemory?.level === "string" ? axisMemory.level : "",
    splv: typeof axisMemory?.splv === "string" ? axisMemory.splv : "",
    katate: typeof axisMemory?.katate === "string" ? axisMemory.katate : "",
  };
}

function normalizeAxisRangeModeByAxis(rangeModeByAxis) {
  const enabled = Boolean(rangeModeByAxis?.level) || Boolean(rangeModeByAxis?.splv) || Boolean(rangeModeByAxis?.katate);
  return {
    level: enabled,
    splv: enabled,
    katate: enabled,
  };
}

function normalizeAxisRangePair(range) {
  const start = typeof range?.start === "string" ? range.start : "";
  const end = typeof range?.end === "string" ? range.end : "";
  const normalized = normalizeRangePair(start, end);
  return {
    start: typeof normalized.min === "string" ? normalized.min : "",
    end: typeof normalized.max === "string" ? normalized.max : "",
  };
}

function normalizeAxisRanges(axisRanges) {
  return {
    level: normalizeAxisRangePair(axisRanges?.level),
    splv: normalizeAxisRangePair(axisRanges?.splv),
    katate: normalizeAxisRangePair(axisRanges?.katate),
  };
}

function normalizeAxisSingleReturnValues(axisSingleReturnValues) {
  return {
    level: typeof axisSingleReturnValues?.level === "string" ? axisSingleReturnValues.level : "",
    splv: typeof axisSingleReturnValues?.splv === "string" ? axisSingleReturnValues.splv : "",
    katate: typeof axisSingleReturnValues?.katate === "string" ? axisSingleReturnValues.katate : "",
  };
}

function normalizeSortModeMemory(sortModeMemory) {
  const normalized = {};
  AXIS_MODES.forEach((axisMode) => {
    if (SORT_OPTIONS.includes(sortModeMemory?.[axisMode])) {
      normalized[axisMode] = sortModeMemory[axisMode];
    }
  });
  return normalized;
}

function normalizeDateRangeMemory(dateRangeMemory) {
  return normalizeDateRange(dateRangeMemory?.dateStart, dateRangeMemory?.dateEnd);
}

function getDefaultSortModeForAxis(axisMode) {
  return DEFAULT_SORT_MODE_BY_AXIS[axisMode] ?? "level";
}

function normalizeDateValue(value) {
  const normalized = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function normalizeDateRange(startValue, endValue) {
  const start = normalizeDateValue(startValue);
  const end = normalizeDateValue(endValue);

  if (start && end && start > end) {
    return { dateStart: end, dateEnd: start };
  }

  return { dateStart: start, dateEnd: end };
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
  const dateRange = normalizeDateRange(filters?.dateStart, filters?.dateEnd);

  return {
    axisMode: normalizeAxisMode(filters?.axisMode),
    axisValue: typeof filters?.axisValue === "string" ? filters.axisValue : "",
    titleQuery: typeof filters?.titleQuery === "string" ? filters.titleQuery : "",
    dateStart: dateRange.dateStart,
    dateEnd: dateRange.dateEnd,
    axisRangeModeByAxis: normalizeAxisRangeModeByAxis(filters?.axisRangeModeByAxis),
    axisRanges: normalizeAxisRanges(filters?.axisRanges),
    axisLastRanges: normalizeAxisRanges(filters?.axisLastRanges),
    axisSingleReturnValues: normalizeAxisSingleReturnValues(filters?.axisSingleReturnValues),
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

function normalizeSortDirection(sortDirection) {
  return sortDirection === "desc" ? "desc" : "asc";
}

function normalizeDifficultyTableUpdatedAt(stored) {
  if (Number.isFinite(stored?.difficultyTableUpdatedAt)) {
    return stored.difficultyTableUpdatedAt;
  }

  const importedAt = stored?.difficultyTable?.importedAt;
  if (typeof importedAt === "string") {
    const parsed = Date.parse(importedAt);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
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

function nowTimestamp() {
  return Date.now();
}

function getLatestFiniteValue(history, key) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const value = history[index]?.[key];
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
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
  const normalizedDateFilterBase = stored.dateFilterBase ? normalizeStoredFilters(stored.dateFilterBase) : null;
  const normalizedDateRangeMemory = normalizeDateRangeMemory(stored.dateRangeMemory);
  const normalizedSortModeMemory = normalizeSortModeMemory(stored.sortModeMemory);
  const restoredFilters = isTextAxisMode(normalizedFilters.axisMode)
    ? (normalizedTitleFilterBase ? { ...normalizedTitleFilterBase } : {
      ...normalizedFilters,
      axisMode: "level",
      axisValue: "",
      titleQuery: "",
    })
    : normalizedFilters;
  const normalizedSortMode = normalizedFilters.axisMode === "title"
    ? normalizeSortMode(stored.titleSortBase ?? stored.sortMode)
    : normalizeSortMode(stored.sortMode);

  return {
    songs: [...stored.songs].sort(sortSongs),
    records: [...stored.records]
      .filter((record) => record?.date && record?.title)
      .map((record) => ({
        id: isCanonicalRecordId(record.id) ? record.id : createRecordId(),
        timestamp: normalizeRecordTimestamp(record.timestamp, record.date),
        date: record.date,
        title: record.title,
        level: parseOptionalNumber(record.level),
        splv: parseOptionalNumber(record.splv),
        lamp: LAMP_OPTIONS.includes(record.lamp) ? record.lamp : "NO PLAY",
        bp: parseOptionalNumber(record.bp),
        score: parseOptionalNumber(record.score),
        textageKey: typeof record.textageKey === "string" ? record.textageKey : "",
        source: record.source || "manual",
      }))
      .sort(sortRecords),
    difficultyTable: stored.difficultyTable ?? null,
    difficultyTableUpdatedAt: normalizeDifficultyTableUpdatedAt(stored),
    songNotes: typeof stored.songNotes === "object" && stored.songNotes !== null ? { ...stored.songNotes } : {},
    filters: restoredFilters,
    titleFilterBase: null,
    dateFilterBase: normalizedDateFilterBase,
    dateRangeMemory: normalizedDateRangeMemory,
    textQueryMemory: normalizedTextQueryMemory,
    axisMemory: normalizeAxisMemory(stored.axisMemory),
    sortMode: normalizedSortMode,
    sortModeMemory: {
      ...normalizedSortModeMemory,
      [normalizedFilters.axisMode]: normalizeSortMode(stored.sortMode),
      [restoredFilters.axisMode]: normalizedSortMode,
    },
    sortDirection: normalizeSortDirection(stored.sortDirection),
    titleSortBase: normalizeSortMode(stored.titleSortBase),
  };
}

function needsRecordTimestampMigration(records) {
  if (!Array.isArray(records)) {
    return false;
  }

  return records.some((record) => (
    record?.date
    && record?.title
    && normalizeRecordTimestamp(record.timestamp, record.date) !== String(record.timestamp ?? "").trim()
  ));
}

function needsRecordIdMigration(records) {
  if (!Array.isArray(records)) {
    return false;
  }

  return records.some((record) => (
    record?.date
    && record?.title
    && !isCanonicalRecordId(record.id)
  ));
}

function deriveSongState(song, history = []) {
  const latest = history.at(-1) ?? null;
  const latestBp = getLatestFiniteValue(history, "bp");
  const latestScore = getLatestFiniteValue(history, "score");
  const bestLamp = history.reduce((best, record) => pickBetterLamp(best, record.lamp), song.initialLamp);
  const historicalBpValues = history.map((record) => record.bp).filter((value) => Number.isFinite(value));
  const historicalBest = historicalBpValues.length > 0 ? Math.min(...historicalBpValues) : Number.POSITIVE_INFINITY;
  const historicalBestScore = history.reduce((best, record) => (
    record.score === null || record.score === undefined ? best : Math.max(best, record.score)
  ), Number.NEGATIVE_INFINITY);
  const bestCandidates = [song.initialBestBp, Number.isFinite(historicalBest) ? historicalBest : null].filter((value) => value != null);

  return {
    ...song,
    history,
    entryCount: history.length,
    latestDate: latest?.date ?? null,
    latestTimestamp: latest ? normalizeRecordTimestamp(latest.timestamp, latest.date) : null,
    latestLamp: latest?.lamp ?? song.initialLamp,
    bestLamp,
    currentBp: latestBp ?? song.initialBestBp,
    bestBp: bestCandidates.length > 0 ? Math.min(...bestCandidates) : null,
    currentScore: latestScore,
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
  const lampCounts = createLampCounts();

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

    if (axisMode === "level" || axisMode === "date") {
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
        lampCounts: createLampCounts(),
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

function createLampCounts() {
  return LAMP_OPTIONS.reduce((counts, lamp) => {
    counts[lamp] = 0;
    return counts;
  }, {});
}

function formatDateBandLabel(date) {
  const [, month, day] = String(date ?? "").split("-").map(Number);
  return `${month}/${day}`;
}

function getDateSummaryRange(filters) {
  const { dateStart, dateEnd } = normalizeDateRange(filters.dateStart, filters.dateEnd);

  if (dateStart && dateEnd) {
    return { start: dateStart, end: dateEnd, sliceMode: "all", limit: null };
  }

  if (dateStart) {
    return { start: dateStart, end: "", sliceMode: "first", limit: 31 };
  }

  if (dateEnd) {
    return { start: "", end: dateEnd, sliceMode: "last", limit: 31 };
  }

  return { start: "", end: "", sliceMode: "last", limit: 14 };
}

function buildDateSummary(records, baseSongs, filters) {
  const visibleTitles = new Set(baseSongs.map((song) => song.title));
  const { start, end, sliceMode, limit } = getDateSummaryRange(filters);
  const bandMap = new Map();

  // 同日最良値（最高ランプ・最小BP・最高スコア）のみ使用
  const bestByDateTitle = new Map();
  records.forEach((record) => {
    if (!visibleTitles.has(record.title)) return;
    if (start && record.date < start) return;
    if (end && record.date > end) return;
    const key = `${record.date}__${record.title}`;
    const existing = bestByDateTitle.get(key);
    if (!existing || getLampRank(record.lamp) > getLampRank(existing.lamp) ||
        (Number.isFinite(record.bp) && (!Number.isFinite(existing.bp) || record.bp < existing.bp)) ||
        (Number.isFinite(record.score) && (!Number.isFinite(existing.score) || record.score > existing.score))) {
      bestByDateTitle.set(key, record);
    }
  });

  bestByDateTitle.forEach((record) => {
    const lamp = LAMP_OPTIONS.includes(record.lamp) ? record.lamp : "NO PLAY";
    if (!bandMap.has(record.date)) {
      bandMap.set(record.date, {
        key: record.date,
        value: record.date,
        label: formatDateBandLabel(record.date),
        total: 0,
        lampCounts: createLampCounts(),
        baseTotal: 0,
        baseLampCounts: createLampCounts(),
      });
    }

    const band = bandMap.get(record.date);
    band.baseTotal += 1;
    band.baseLampCounts[lamp] += 1;

    if (filters.lamps.includes(lamp)) {
      band.total += 1;
      band.lampCounts[lamp] += 1;
    }
  });

  let bands = [...bandMap.values()].sort((a, b) => String(a.value).localeCompare(String(b.value)));
  if (limit !== null) {
    bands = sliceMode === "first" ? bands.slice(0, limit) : bands.slice(-limit);
  }

  const baseLampCounts = createLampCounts();
  bands.forEach((band) => {
    LAMP_OPTIONS.forEach((lamp) => {
      baseLampCounts[lamp] += band.baseLampCounts[lamp] ?? 0;
    });
  });

  return {
    axisMode: "date",
    bandTotalSongs: bands.reduce((total, band) => total + band.total, 0),
    totalSongs: bands.reduce((total, band) => total + band.baseTotal, 0),
    totalLabel: "総記録数",
    totalUnit: "件",
    emptyMessage: "該当する履歴がありません。",
    lampCounts: baseLampCounts,
    bands,
  };
}

function getDefaultDateRangeFromRecords(records) {
  const dates = [...new Set(records.map((record) => record.date).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const recentDates = dates.slice(-14);
  const today = todayIso();

  if (recentDates.length === 0) {
    return { dateStart: today, dateEnd: today };
  }

  return {
    dateStart: recentDates[0],
    dateEnd: today,
  };
}

function getDateFilterReturnBase(previousFilters, titleFilterBase) {
  const isValidReturnAxis = (axisMode) => !isTextAxisMode(axisMode) && axisMode !== "date";

  if (isTextAxisMode(previousFilters.axisMode) && titleFilterBase && isValidReturnAxis(titleFilterBase.axisMode)) {
    return { ...titleFilterBase };
  }

  if (!isValidReturnAxis(previousFilters.axisMode)) {
    return {
      ...previousFilters,
      axisMode: "level",
      axisValue: "",
      titleQuery: "",
      dateStart: "",
      dateEnd: "",
    };
  }

  return { ...previousFilters };
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

function compareLatestTimestampValue(a, b) {
  if (a.latestTimestamp === null && b.latestTimestamp === null) {
    return 0;
  }
  if (a.latestTimestamp === null) {
    return -1;
  }
  if (b.latestTimestamp === null) {
    return 1;
  }
  return String(a.latestTimestamp).localeCompare(String(b.latestTimestamp));
}

function compareNullablePrimaryValues(aValue, bValue, compareValues, sortDirection) {
  const aNull = aValue === null || aValue === undefined || aValue === "";
  const bNull = bValue === null || bValue === undefined || bValue === "";

  if (aNull && bNull) {
    return 0;
  }

  if (aNull) {
    return 1;
  }

  if (bNull) {
    return -1;
  }

  const compared = compareValues(aValue, bValue);
  return sortDirection === "desc" ? -compared : compared;
}

function comparePrimarySortValue(a, b, sortMode, sortDirection) {
  if (sortMode === "title") {
    return compareTitlePrimaryValue(a.title, b.title, sortDirection);
  }

  if (sortMode === "level") {
    return compareNullablePrimaryValues(a.levelValue, b.levelValue, (aValue, bValue) => aValue - bValue, sortDirection);
  }

  if (sortMode === "splv") {
    return compareNullablePrimaryValues(a.splvValue, b.splvValue, (aValue, bValue) => aValue - bValue, sortDirection);
  }

  if (sortMode === "katate") {
    return compareNullablePrimaryValues(a.katateValue, b.katateValue, (aValue, bValue) => aValue - bValue, sortDirection);
  }

  if (sortMode === "latest") {
    const compared = compareLatestTimestampValue(a, b);
    return sortDirection === "desc" ? -compared : compared;
  }

  if (sortMode === "clear") {
    const compared = getLampRank(a.bestLamp) - getLampRank(b.bestLamp);
    return sortDirection === "desc" ? -compared : compared;
  }

  if (sortMode === "bestBp") {
    return compareNullablePrimaryValues(a.bestBp, b.bestBp, (aValue, bValue) => aValue - bValue, sortDirection);
  }

  if (sortMode === "latestBp") {
    return compareNullablePrimaryValues(a.currentBp, b.currentBp, (aValue, bValue) => aValue - bValue, sortDirection);
  }

  if (sortMode === "recommend") {
    return compareRecommendPrimaryValue(a.recommend, b.recommend, sortDirection);
  }

  if (sortMode === "memo") {
    return compareNullablePrimaryValues(a.note, b.note, (aValue, bValue) => String(aValue).localeCompare(String(bValue), "ja"), sortDirection);
  }

  return compareNullablePrimaryValues(a.levelValue, b.levelValue, (aValue, bValue) => aValue - bValue, sortDirection);
}

function compareRecommendPrimaryValue(aRecommend, bRecommend, sortDirection) {
  const aRank = RECOMMEND_SORT_RANK.get(String(aRecommend ?? "")) ?? RECOMMEND_SORT_RANK.get("");
  const bRank = RECOMMEND_SORT_RANK.get(String(bRecommend ?? "")) ?? RECOMMEND_SORT_RANK.get("");
  const compared = aRank - bRank;
  return sortDirection === "desc" ? -compared : compared;
}

function compareTitlePrimaryValue(aTitle, bTitle, sortDirection) {
  const aNull = aTitle === null || aTitle === undefined || aTitle === "";
  const bNull = bTitle === null || bTitle === undefined || bTitle === "";

  if (aNull && bNull) {
    return 0;
  }

  if (aNull) {
    return 1;
  }

  if (bNull) {
    return -1;
  }

  const a = splitTitleAndSuffix(aTitle);
  const b = splitTitleAndSuffix(bTitle);
  const baseCompare = a.baseTitle.localeCompare(b.baseTitle, "ja");
  if (baseCompare !== 0) {
    return sortDirection === "desc" ? -baseCompare : baseCompare;
  }

  if (a.suffixRank !== b.suffixRank) {
    return a.suffixRank - b.suffixRank;
  }

  return String(aTitle).localeCompare(String(bTitle), "ja");
}

function compareFilterAxisTieBreak(a, b, axisMode) {
  if (axisMode === "level") {
    return compareLevelValue(a, b);
  }

  if (axisMode === "splv") {
    return compareSplvValue(a, b);
  }

  if (axisMode === "katate") {
    return compareKatateValue(a, b);
  }

  if (axisMode === "title") {
    return compareTitleValue(a, b);
  }

  if (axisMode === "memo") {
    return compareNullablePrimaryValues(a.note, b.note, (aValue, bValue) => String(aValue).localeCompare(String(bValue), "ja"), "asc");
  }

  if (axisMode === "date") {
    return compareNullablePrimaryValues(a.latestDate, b.latestDate, (aValue, bValue) => compareIsoDates(aValue, bValue), "asc");
  }

  return 0;
}

function compareCatalogSongs(a, b, sortMode, sortDirection, axisMode) {
  return comparePrimarySortValue(a, b, sortMode, sortDirection)
    || compareFilterAxisTieBreak(a, b, axisMode)
    || compareSplvValue(a, b)
    || compareTitleValue(a, b);
}

export function createStore() {
  const listeners = new Set();
  const state = {
    songs: [],
    records: [],
    difficultyTable: null,
    difficultyTableUpdatedAt: 0,
    songNotes: {},
    catalogVisibleSignature: "",
    catalogVisibleTitleOrder: [],
    titleFilterBase: null,
    dateFilterBase: null,
    dateRangeMemory: {
      dateStart: "",
      dateEnd: "",
    },
    titleSortBase: "level",
    axisMemory: {
      level: "",
      splv: "",
      katate: "",
    },
    sortModeMemory: {},
    textQueryMemory: {
      title: "",
      memo: "",
    },
    filters: {
      axisMode: "level",
      axisValue: "",
      titleQuery: "",
      dateStart: "",
      dateEnd: "",
      axisRangeModeByAxis: normalizeAxisRangeModeByAxis(),
      axisRanges: normalizeAxisRanges(),
      axisLastRanges: normalizeAxisRanges(),
      axisSingleReturnValues: normalizeAxisSingleReturnValues(),
      recommend: [...RECOMMEND_OPTIONS],
      lamps: [...LAMP_OPTIONS],
      inf: "all",
      acdelete: "all",
      includeUnrated: "all",
    },
    sortMode: "level",
    sortDirection: "asc",
    currentPage: 1,
    selectedTitle: null,
    statusMessage: "",
    sourceLabel: "",
    ready: false,
    error: "",
  };
  let deleteAnchor = null;
  let deleteAnchorTimer = null;

  function emit(snapshot = getSnapshot()) {
    listeners.forEach((listener) => listener(snapshot));
  }

  function persist() {
    saveStoredState({
      songs: state.songs,
      records: state.records,
      difficultyTable: state.difficultyTable,
      difficultyTableUpdatedAt: state.difficultyTableUpdatedAt,
      songNotes: state.songNotes,
      titleFilterBase: state.titleFilterBase,
      dateFilterBase: state.dateFilterBase,
      dateRangeMemory: state.dateRangeMemory,
      titleSortBase: state.titleSortBase,
      textQueryMemory: state.textQueryMemory,
      axisMemory: state.axisMemory,
      sortModeMemory: state.sortModeMemory,
      filters: state.filters,
      sortMode: state.sortMode,
      sortDirection: state.sortDirection,
    });
  }

  function clearDeleteAnchor() {
    deleteAnchor = null;
    if (deleteAnchorTimer !== null) {
      window.clearTimeout(deleteAnchorTimer);
      deleteAnchorTimer = null;
    }
  }

  function setDeleteAnchor(title, date) {
    clearDeleteAnchor();

    const expiresAt = nowTimestamp() + 60_000;
    deleteAnchor = { title, date, expiresAt };
    deleteAnchorTimer = window.setTimeout(() => {
      deleteAnchor = null;
      deleteAnchorTimer = null;
      emit();
    }, 60_000);
  }

  function getDeleteAnchorDate(title) {
    if (!deleteAnchor || deleteAnchor.title !== title) {
      return null;
    }

    if (nowTimestamp() >= deleteAnchor.expiresAt) {
      clearDeleteAnchor();
      return null;
    }

    return deleteAnchor.date;
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
  
  function applyStableVisibleOrder(visibleSongs, allSongStates = visibleSongs) {
    const signature = createCatalogVisibleSignature();

    if (
      state.catalogVisibleSignature === signature
      && state.catalogVisibleTitleOrder.length > 0
    ) {
      const visibleSongByTitle = new Map(visibleSongs.map((song) => [song.title, song]));
      const allSongByTitle = new Map(allSongStates.map((song) => [song.title, song]));
      const usedTitles = new Set();
      const shouldKeepPreviousPool = state.sortMode === "latest";

      const stableSongs = state.catalogVisibleTitleOrder
        .map((title) => {
          const song = visibleSongByTitle.get(title)
            ?? (shouldKeepPreviousPool ? allSongByTitle.get(title) : null);

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

  function mergeTextAxisBaseFixedFilters(baseFilters, sourceFilters) {
    if (!baseFilters) {
      return null;
    }

    return {
      ...baseFilters,
      inf: sourceFilters.inf,
      acdelete: sourceFilters.acdelete,
      includeUnrated: sourceFilters.includeUnrated,
      recommend: [...sourceFilters.recommend],
    };
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
      return matchesSearchText(entry.title, filters.titleQuery) && matchesTextAxisFixedFilters(entry, filters);
    }
    
    if (filters.axisMode === "memo") {
      const query = filters.titleQuery.trim().toLocaleLowerCase("ja");
      const note = String(entry.note ?? "").toLocaleLowerCase("ja");
      return (!query || note.includes(query)) && matchesTextAxisFixedFilters(entry, filters);
    }

    if (filters.axisMode === "date") {
      const { dateStart, dateEnd } = normalizeDateRange(filters.dateStart, filters.dateEnd);

      if ((dateStart || dateEnd) && !entry.history.some((record) => {
        if (dateStart && record.date < dateStart) {
          return false;
        }

        if (dateEnd && record.date > dateEnd) {
          return false;
        }

        return true;
      })) {
        return false;
      }
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

    if (isNumericAxisMode(filters.axisMode) && isAxisRangeModeEnabled(filters)) {
      const range = filters.axisRanges?.[filters.axisMode] ?? { start: "", end: "" };
      const start = parseOptionalNumber(range.start);
      const end = parseOptionalNumber(range.end);
      const entryValue = filters.axisMode === "level"
        ? entry.levelValue
        : filters.axisMode === "splv"
          ? entry.splvValue
          : entry.katateValue;

      if (start !== null && end !== null && (entryValue === null || entryValue < start || entryValue > end)) {
        return false;
      }
    } else if (filters.axisMode === "level") {
      const selectedLevel = parseOptionalNumber(filters.axisValue);
      if (selectedLevel !== null && entry.levelValue !== selectedLevel) {
        return false;
      }
    } else if (filters.axisMode === "splv") {
      const selectedSplv = parseOptionalNumber(filters.axisValue);
      if (selectedSplv !== null && entry.splvValue !== selectedSplv) {
        return false;
      }
    } else if (filters.axisMode === "katate") {
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

  function matchesTextAxisFixedFilters(entry, filters) {
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

  function compareVisibleSongPriority(a, b) {
    if (state.filters.axisMode !== "title") {
      return 0;
    }

    const query = state.filters.titleQuery.trim();
    if (!query) {
      return 0;
    }

    const aRank = getSearchTextMatchRank(a.title, query);
    const bRank = getSearchTextMatchRank(b.title, query);
    return bRank - aRank;
  }

  async function initialize() {
    try {
      const stored = loadStoredState();

      if (stored) {
        const needsTimestampMigration = needsRecordTimestampMigration(stored.records);
        const needsIdMigration = needsRecordIdMigration(stored.records);
        const normalized = normalizeStoredData(stored);
        let didMutateStoredData = needsTimestampMigration || needsIdMigration;
        state.songs = normalized.songs;
        state.records = normalized.records;
        state.difficultyTable = normalized.difficultyTable;
        state.difficultyTableUpdatedAt = normalized.difficultyTableUpdatedAt;
        state.songNotes = normalized.songNotes;
        state.titleFilterBase = normalized.titleFilterBase;
        state.dateFilterBase = normalized.dateFilterBase;
        state.dateRangeMemory = normalized.dateRangeMemory;
        state.titleSortBase = normalized.titleSortBase;
        state.textQueryMemory = normalized.textQueryMemory;
        state.axisMemory = normalized.axisMemory;
        state.sortModeMemory = normalized.sortModeMemory;
        state.filters = normalized.filters;
        state.sortMode = normalized.sortMode;
        state.sortDirection = normalized.sortDirection;

        if (state.filters.axisMode === "date" && (!state.filters.dateStart || !state.filters.dateEnd)) {
          const defaultDateRange = getDefaultDateRangeFromRecords(state.records);
          state.filters = {
            ...state.filters,
            ...defaultDateRange,
          };
          didMutateStoredData = true;
        }

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
        state.difficultyTableUpdatedAt = 0;
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
    const nextSortModeMemory = { ...state.sortModeMemory };

    if (AXIS_MEMORY_MODES.includes(previousFilters.axisMode)) {
      nextAxisMemory[previousFilters.axisMode] = previousFilters.axisValue;
    }

    if (previousFilters.axisMode === "date") {
      state.dateRangeMemory = normalizeDateRange(previousFilters.dateStart, previousFilters.dateEnd);
    }

    let nextAxisValue = typeof nextFilters.axisValue === "string"
      ? nextFilters.axisValue
      : state.filters.axisValue;
    let nextTitleQuery = typeof nextFilters.titleQuery === "string"
      ? nextFilters.titleQuery
      : state.filters.titleQuery;
    let nextDateStart = nextFilters.dateStart ?? state.filters.dateStart;
    let nextDateEnd = nextFilters.dateEnd ?? state.filters.dateEnd;

    if (axisModeChanged) {
      const wasTextAxisMode = isTextAxisMode(previousFilters.axisMode);
      const nextIsTextAxisMode = isTextAxisMode(nextAxisMode);
      nextSortModeMemory[previousFilters.axisMode] = state.sortMode;
    
      if (wasTextAxisMode) {
        rememberTextQuery(previousFilters.axisMode, previousFilters.titleQuery);
      }
    
      if (nextIsTextAxisMode) {
        if (!wasTextAxisMode) {
          state.titleFilterBase = { ...previousFilters };
          state.titleSortBase = state.sortMode;
        }
    
        nextAxisValue = "";
        nextTitleQuery = getRememberedTextQuery(nextAxisMode);
        state.dateFilterBase = null;
      } else if (nextAxisMode === "date") {
        const defaultDateRange = getDefaultDateRangeFromRecords(state.records);
        const rememberedDateRange = normalizeDateRangeMemory(state.dateRangeMemory);
        state.dateFilterBase = getDateFilterReturnBase(previousFilters, state.titleFilterBase);
        state.titleFilterBase = null;
        nextAxisValue = "";
        nextTitleQuery = "";
        nextDateStart = typeof nextFilters.dateStart === "string"
          ? nextFilters.dateStart
          : rememberedDateRange.dateStart || defaultDateRange.dateStart;
        nextDateEnd = typeof nextFilters.dateEnd === "string"
          ? nextFilters.dateEnd
          : rememberedDateRange.dateEnd || defaultDateRange.dateEnd;
      } else {
        state.titleFilterBase = null;
        state.dateFilterBase = null;
        nextAxisValue = nextAxisMode === "date"
          ? ""
          : (typeof nextFilters.axisValue === "string"
            ? nextFilters.axisValue
            : nextAxisMemory[nextAxisMode] ?? "");
        nextTitleQuery = "";
      }

      state.sortMode = normalizeSortMode(nextSortModeMemory[nextAxisMode] ?? getDefaultSortModeForAxis(nextAxisMode));
      state.sortDirection = "asc";
      nextSortModeMemory[nextAxisMode] = state.sortMode;
    }

    const nextDateRange = normalizeDateRange(
      nextDateStart,
      nextDateEnd,
    );

    const nextStateFilters = {
      ...state.filters,
      ...nextFilters,
      axisMode: nextAxisMode,
      axisValue: typeof nextAxisValue === "string" ? nextAxisValue : "",
      titleQuery: typeof nextTitleQuery === "string" ? nextTitleQuery : "",
      dateStart: nextDateRange.dateStart,
      dateEnd: nextDateRange.dateEnd,
      axisRangeModeByAxis: nextFilters.axisRangeModeByAxis
        ? normalizeAxisRangeModeByAxis(nextFilters.axisRangeModeByAxis)
        : state.filters.axisRangeModeByAxis,
      axisRanges: nextFilters.axisRanges
        ? normalizeAxisRanges(nextFilters.axisRanges)
        : state.filters.axisRanges,
      axisLastRanges: nextFilters.axisLastRanges
        ? normalizeAxisRanges(nextFilters.axisLastRanges)
        : state.filters.axisLastRanges,
      axisSingleReturnValues: nextFilters.axisSingleReturnValues
        ? normalizeAxisSingleReturnValues(nextFilters.axisSingleReturnValues)
        : state.filters.axisSingleReturnValues,
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

    if (nextStateFilters.axisMode === "date") {
      state.dateRangeMemory = {
        dateStart: nextStateFilters.dateStart,
        dateEnd: nextStateFilters.dateEnd,
      };
    }

    if (isTextAxisMode(nextStateFilters.axisMode) && state.titleFilterBase) {
      state.titleFilterBase = mergeTextAxisBaseFixedFilters(
        state.titleFilterBase,
        nextStateFilters,
      );
    }

    state.axisMemory = nextAxisMemory;
    state.sortModeMemory = nextSortModeMemory;
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
    state.sortModeMemory = {
      ...state.sortModeMemory,
      [state.filters.axisMode]: state.sortMode,
    };
    state.filters = { ...state.titleFilterBase };
    state.titleFilterBase = null;
    state.sortMode = state.titleSortBase;
    state.sortModeMemory = {
      ...state.sortModeMemory,
      [state.filters.axisMode]: state.sortMode,
    };
    invalidateCatalogVisibleOrder();
    state.currentPage = 1;
    persist();
    ensureSelectedSong();
    emit();
  }

  function clearDateFilter() {
    state.sortModeMemory = {
      ...state.sortModeMemory,
      [state.filters.axisMode]: state.sortMode,
    };
    state.dateRangeMemory = normalizeDateRange(state.filters.dateStart, state.filters.dateEnd);
    state.filters = state.dateFilterBase
      ? { ...state.dateFilterBase }
      : {
        ...state.filters,
        axisMode: "level",
        axisValue: "",
        titleQuery: "",
        dateStart: "",
        dateEnd: "",
      };
    state.dateFilterBase = null;
    state.sortMode = normalizeSortMode(state.sortModeMemory[state.filters.axisMode] ?? getDefaultSortModeForAxis(state.filters.axisMode));
    state.sortModeMemory = {
      ...state.sortModeMemory,
      [state.filters.axisMode]: state.sortMode,
    };
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
    state.sortModeMemory = {
      ...state.sortModeMemory,
      [state.filters.axisMode]: normalized,
    };
    invalidateCatalogVisibleOrder();
    state.currentPage = 1;
    persist();
    ensureSelectedSong();
    emit();
  }

  function toggleSortDirection() {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
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

    const selectedEntry = getCatalogEntries().find((item) => item.title === state.selectedTitle);
    if (!selectedEntry) {
      return { ok: false, message: "選択中の曲情報が見つかりません。" };
    }

    const normalizedMemo = String(memo ?? "").trim();
    const normalizedBp = parseOptionalNumber(bp);
    const normalizedScore = parseOptionalNumber(score);
    const isValidLamp = LAMP_OPTIONS.includes(lamp);
    const hasBp = normalizedBp !== null;
    const hasScore = normalizedScore !== null;
    const hasMemo = normalizedMemo !== "";
    const canSaveRecord = lamp !== "NO PLAY" || hasBp || hasScore;

    if (hasBp && (!Number.isInteger(normalizedBp) || normalizedBp < 0)) {
      return { ok: false, message: "BPは0以上の整数で入力してください。" };
    }

    if (hasScore && (!Number.isInteger(normalizedScore) || normalizedScore < 0)) {
      return { ok: false, message: "スコアは0以上の整数で入力してください。" };
    }

    if (!isValidLamp) {
      return { ok: false, message: "ランプを選択してください。" };
    }

    if (!canSaveRecord) {
      return saveSongNote(normalizedMemo);
    }

    if (hasMemo) {
      state.songNotes[selectedEntry.title] = normalizedMemo;
    } else {
      delete state.songNotes[selectedEntry.title];
    }

    const date = todayIso();
    const timestamp = formatLocalDateTime();
    const chartSuffix = selectedEntry.title.match(/\(([BNHAL])\)$/)?.[0] ?? "";
    state.records.push({
      id: createRecordId(),
      timestamp,
      date,
      title: selectedEntry.title,
      level: selectedEntry.levelValue ?? null,
      splv: selectedEntry.splvValue ?? null,
      lamp,
      bp: normalizedBp,
      score: normalizedScore,
      textageKey: selectedEntry.textageid ? `${selectedEntry.textageid}${chartSuffix}` : "",
      source: "manual",
    });
    state.statusMessage = `${selectedEntry.title} の記録を保存しました。`;

    state.records.sort(sortRecords);
    persist();
    emit();
    return { ok: true, message: state.statusMessage };
  }

  function deleteRecord(recordId) {
    const recordIndex = state.records.findIndex((record) => record.id === recordId);
    if (recordIndex === -1) {
      return { ok: false, message: "記録が見つかりません。" };
    }

    state.records.splice(recordIndex, 1);
    state.statusMessage = "記録を削除しました。";
    persist();
    emit();
    return { ok: true, message: state.statusMessage };
  }

  function deleteLatestRecord() {
    if (!state.selectedTitle) {
      return { ok: false, message: "曲を選択してください。" };
    }

    const selectedEntry = getCatalogEntries().find((item) => item.title === state.selectedTitle);
    if (!selectedEntry) {
      return { ok: false, message: "選択中の曲情報が見つかりません。" };
    }

    const now = Date.now();
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    const candidates = state.records
      .filter((record) => record.title === selectedEntry.title)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (candidates.length === 0) {
      return { ok: false, message: `${selectedEntry.title} の記録はありません。` };
    }

    const latest = candidates[0];
    if (now - new Date(latest.timestamp.replace(" ", "T")).getTime() > twelveHoursMs) {
      return { ok: false, message: "12時間以上経過した記録は削除できません。" };
    }

    state.records = state.records.filter((record) => record.id !== latest.id);
    state.statusMessage = `${selectedEntry.title} の前回の記録を削除しました。`;
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
      const bestBpValues = history.map((record) => record.bp).filter((value) => Number.isFinite(value));
      const bestBp = bestBpValues.length > 0 ? Math.min(...bestBpValues) : Number.POSITIVE_INFINITY;
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
    return exportVerticalCsv(state.records, state.songNotes, state.difficultyTable);
  }

  function importJsonData(payload, referenceDate = todayIso()) {
    const catalogEntryByTitle = new Map(getCatalogEntries().map((entry) => [entry.title, entry]));
    const importedRecords = importDbrJson(payload, referenceDate).map((record) => {
      const selectedEntry = catalogEntryByTitle.get(record.title);
      const level = selectedEntry?.levelValue ?? record.level ?? null;
      const splv = selectedEntry?.splvValue ?? record.splv ?? null;

      return {
        id: createRecordId(),
        timestamp: normalizeRecordTimestamp(record.timestamp, record.date),
        date: record.date,
        title: record.title,
        level,
        splv,
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

  function createTextageKeyFromCatalogEntry(entry) {
    if (!entry?.textageid || !entry?.title) {
      return "";
    }

    const suffix = entry.title.slice(-3);
    return /^\([A-Z]\)$/.test(suffix) ? `${entry.textageid}${suffix}` : "";
  }

  function importCsvData(text) {
    const { records, songNotes } = importVerticalCsv(text, state.difficultyTable);
    const catalogEntryByTitle = new Map(getCatalogEntries().map((entry) => [entry.title, entry]));
    const importedRecords = records.map((record) => {
      const selectedEntry = catalogEntryByTitle.get(record.title);
      const level = selectedEntry?.levelValue ?? record.level ?? null;
      const splv = selectedEntry?.splvValue ?? record.splv ?? null;
      const textageKey = typeof record.textageKey === "string" && record.textageKey
        ? record.textageKey
        : createTextageKeyFromCatalogEntry(selectedEntry);

      return {
        id: createRecordId(),
        timestamp: normalizeRecordTimestamp(record.timestamp, record.date),
        date: record.date,
        title: record.title,
        level,
        splv,
        lamp: LAMP_OPTIONS.includes(record.lamp) ? record.lamp : "NO PLAY",
        bp: record.bp,
        score: record.score ?? null,
        textageKey,
        source: record.source,
      };
    });

    const importedKeys = new Set(importedRecords.map((record) => `${record.title}::${record.date}`));
    const preservedRecords = state.records.filter((record) => !importedKeys.has(`${record.title}::${record.date}`));

    state.records = [...preservedRecords, ...importedRecords].sort(sortRecords);
    if (state.difficultyTable) {
      migrateRecordTitlesByTextageKey(state.difficultyTable);
      updateTextageKeyFromDifficultyTable(state.difficultyTable);
      state.records = state.records.sort(sortRecords);
    }    
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
    state.songNotes = {};
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
    state.difficultyTableUpdatedAt = nowTimestamp();
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
    const dateDefaultRange = getDefaultDateRangeFromRecords(state.records);
    const songStates = catalogEntries.map((entry) => ({
      ...deriveSongState(entry, recordIndex.get(entry.title) ?? []),
      note: state.songNotes[entry.title] ?? "",
    })).sort((a, b) => compareCatalogSongs(a, b, state.sortMode, state.sortDirection, state.filters.axisMode));
    const filteredVisibleSongs = songStates.filter((entry) => matchesFiltersFor(entry, state.filters));
    if (state.filters.axisMode === "title" && state.filters.titleQuery.trim()) {
      const songOrder = new Map(songStates.map((song, index) => [song.title, index]));
      filteredVisibleSongs.sort((a, b) => {
        const priority = compareVisibleSongPriority(a, b);
        if (priority !== 0) {
          return priority;
        }

        return (songOrder.get(a.title) ?? 0) - (songOrder.get(b.title) ?? 0);
      });
    }
    const visibleSongs = applyStableVisibleOrder(filteredVisibleSongs, songStates);
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
      ...summaryFilters,
      lamps: [...LAMP_OPTIONS],
    };
    const summaryCountSongs = songStates.filter((entry) => matchesFiltersFor(entry, summaryCountFilters));
    const summary = summaryFilters.axisMode === "date"
      ? buildDateSummary(state.records, summaryCountSongs, summaryFilters)
      : buildSummary(summaryBandBaseSongs, summarySongs, summaryCountSongs, summaryFilters.axisMode);
    const totalPages = Math.max(1, Math.ceil(visibleSongs.length / PAGE_SIZE));
    const currentPage = Math.max(1, Math.min(state.currentPage, totalPages));
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pagedSongs = visibleSongs.slice(pageStart, pageStart + PAGE_SIZE);
    const selectedSong = pagedSongs.find((song) => song.title === state.selectedTitle)
      ?? pagedSongs[0]
      ?? visibleSongs[0]
      ?? null;
    const selectedHistory = selectedSong ? [...selectedSong.history].sort((a, b) => sortRecords(b, a)) : [];
    const hasTodayRecord = (() => {
      if (!selectedSong) return false;
      const now = Date.now();
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      return selectedHistory.some((record) => {
        const recordTime = new Date(record.timestamp.replace(" ", "T")).getTime();
        return now - recordTime <= twelveHoursMs;
      });
    })();

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
      summary,
      summaryFilters,
      dateDefaultRange,
    };
  }

  return {
    initialize,
    setDifficultyFilters,
    clearTitleFilter,
    clearDateFilter,
    setSortMode,
    toggleSortDirection,
    setPage,
    selectSong,
    saveRecord,
    deleteRecord,
    deleteLatestRecord,
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
