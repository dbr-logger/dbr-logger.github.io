const MODULE_VERSION = new URL(import.meta.url).search;

const { LAMP_OPTIONS } = await import(`../constants.js${MODULE_VERSION}`);
const { exportVerticalCsv, importVerticalCsv } = await import(`../data/csv.js${MODULE_VERSION}`);
const { attachKatateToDifficultyTable, fetchDifficultyTable } = await import(`../data/difficulty.js${MODULE_VERSION}`);
const { exportDbrJson, importDbrJson } = await import(`../data/export-json.js${MODULE_VERSION}`);
const { loadStoredState, saveStoredState } = await import(`../data/storage.js${MODULE_VERSION}`);
const { compareIsoDates, formatLocalDateTime, todayIso } = await import(`../utils/date.js${MODULE_VERSION}`);
const { getSearchTextMatchRank, matchesSearchText } = await import(`../utils/search.js${MODULE_VERSION}`);

const RECOMMEND_OPTIONS = ["", "△", "○", "◎", "☆"];
const CHART_DIFFICULTY_OPTIONS = ["B", "N", "H", "A", "L"];
const DISPLAY_MODES = ["clear", "score", "all"];
const SCORE_RANK_OPTIONS = ["AAA", "AA", "A", "B", "C", "D", "E", "F", "※"];
const SCORE_RANK_SUMMARY_OPTIONS = SCORE_RANK_OPTIONS.filter((rank) => rank !== "※");
const PAGE_SIZE = 100;
const SORT_OPTIONS = ["title", "level", "splv", "katate", "clear", "bestBp", "latestBp", "bestScore", "latestScore", "latest", "entryCount", "recommend", "memo"];
const AXIS_MODES = ["level", "splv", "katate", "title", "memo", "date"];
const AXIS_MEMORY_MODES = ["level", "splv", "katate"];
const NUMERIC_AXIS_MODES = ["level", "splv", "katate"];
const PLAY_DATE_RESET_HOUR = 5;
const PLAY_DATE_CHAIN_THRESHOLD_MS = 60 * 60 * 1000;
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
const SCORE_RANKS = [
  { label: "MAX", numerator: 9 },
  { label: "AAA", numerator: 8 },
  { label: "AA", numerator: 7 },
  { label: "A", numerator: 6 },
  { label: "B", numerator: 5 },
  { label: "C", numerator: 4 },
  { label: "D", numerator: 3 },
  { label: "E", numerator: 2 },
  { label: "F", numerator: 0 },
];
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

function normalizeRecordComparableValue(value) {
  return value === undefined ? null : value;
}

function areCsvRecordValuesEqual(a, b) {
  return normalizeRecordTimestamp(a?.timestamp, a?.date) === normalizeRecordTimestamp(b?.timestamp, b?.date)
    && String(a?.date ?? "") === String(b?.date ?? "")
    && String(a?.title ?? "") === String(b?.title ?? "")
    && String(a?.textageKey ?? "") === String(b?.textageKey ?? "")
    && String(a?.lamp ?? "NO PLAY") === String(b?.lamp ?? "NO PLAY")
    && normalizeRecordComparableValue(parseOptionalNumber(a?.bp)) === normalizeRecordComparableValue(parseOptionalNumber(b?.bp))
    && normalizeRecordComparableValue(parseOptionalNumber(a?.score)) === normalizeRecordComparableValue(parseOptionalNumber(b?.score))
    && normalizeRecordComparableValue(parseOptionalNumber(a?.level)) === normalizeRecordComparableValue(parseOptionalNumber(b?.level))
    && normalizeRecordComparableValue(parseOptionalNumber(a?.splv)) === normalizeRecordComparableValue(parseOptionalNumber(b?.splv))
    && String(a?.source ?? "") === String(b?.source ?? "");
}

function getCsvRecordMergeKey(record) {
  const timestamp = normalizeRecordTimestamp(record?.timestamp, record?.date);
  const textageKey = typeof record?.textageKey === "string" ? record.textageKey.trim() : "";
  const title = typeof record?.title === "string" ? record.title.trim() : "";

  if (textageKey) {
    return `textageKey:${textageKey}::timestamp:${timestamp}`;
  }

  return `title:${title}::timestamp:${timestamp}`;
}

function getJsonRecordMergeKey(record) {
  const date = typeof record?.date === "string" ? record.date.trim() : "";
  const textageKey = typeof record?.textageKey === "string" ? record.textageKey.trim() : "";
  const title = typeof record?.title === "string" ? record.title.trim() : "";

  if (textageKey) {
    return `textageKey:${textageKey}::date:${date}`;
  }

  return `title:${title}::date:${date}`;
}

function normalizeRecordTimestamp(timestamp, date) {
  const normalized = String(timestamp ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return date ? `${date}T00:00:00` : "";
}

function parseRecordTimestampMs(record) {
  const timestamp = normalizeRecordTimestamp(record?.timestamp, record?.date);
  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp).getTime();
  return Number.isFinite(parsed) ? parsed : null;
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

function getScoreMax(songOrRecord) {
  const rawScratch = songOrRecord?.scratch;
  if (rawScratch === null || rawScratch === undefined || rawScratch === "") {
    return null;
  }

  const notes = Number(songOrRecord?.notes);
  const scratch = Number(rawScratch);
  if (!Number.isFinite(notes) || notes <= 0 || !Number.isFinite(scratch)) {
    return null;
  }

  const keyNotes = notes - scratch;
  return keyNotes > 0 ? keyNotes * 4 : null;
}

function getScoreRate(score, songOrRecord) {
  const maxScore = getScoreMax(songOrRecord);
  return Number.isFinite(score) && maxScore ? score / maxScore : null;
}

function getScoreRankInfo(score, songOrRecord) {
  const maxScore = getScoreMax(songOrRecord);
  if (!maxScore) {
    return {
      label: "※",
      display: "※",
      rate: null,
      score: null,
    };
  }

  if (!Number.isFinite(score)) {
    return {
      label: "F",
      display: "-",
      rate: null,
      score: null,
    };
  }

  const normalizedScore = Math.max(0, Math.min(score, maxScore));
  let achievedRank = SCORE_RANKS[SCORE_RANKS.length - 1];
  for (const candidate of SCORE_RANKS) {
    if (normalizedScore >= Math.round(maxScore * (candidate.numerator / 9))) {
      achievedRank = candidate;
      break;
    }
  }

  return {
    label: achievedRank.label === "MAX" ? "MAX" : achievedRank.label,
    display: `${((normalizedScore / maxScore) * 100).toFixed(2)}%`,
    rate: normalizedScore / maxScore,
    score: normalizedScore,
  };
}

function normalizeRecommendSelection(values) {
  if (!Array.isArray(values)) {
    return [...RECOMMEND_OPTIONS];
  }

  return [...new Set(values.filter((value) => RECOMMEND_OPTIONS.includes(value)))];
}

function normalizeChartDifficultySelection(values) {
  if (!Array.isArray(values)) {
    return [...CHART_DIFFICULTY_OPTIONS];
  }

  return [...new Set(values.filter((value) => CHART_DIFFICULTY_OPTIONS.includes(value)))];
}

function normalizeLampSelection(values) {
  if (!Array.isArray(values)) {
    return [...LAMP_OPTIONS];
  }

  return LAMP_OPTIONS.filter((lamp) => values.includes(lamp));
}

function normalizeScoreRankSelection(values) {
  if (!Array.isArray(values)) {
    return [...SCORE_RANK_OPTIONS];
  }

  const oldAllSelected = SCORE_RANK_OPTIONS
    .filter((rank) => rank !== "※")
    .every((rank) => values.includes(rank));
  if (oldAllSelected && !values.includes("※")) {
    return [...SCORE_RANK_OPTIONS];
  }

  return SCORE_RANK_OPTIONS.filter((rank) => values.includes(rank));
}

function normalizeBooleanFilter(value) {
  return value === "yes" || value === "no" ? value : "all";
}

function normalizeDisplayMode(value) {
  return DISPLAY_MODES.includes(value) ? value : "all";
}

function isScoreDisplayMode(displayMode) {
  return displayMode === "score";
}

function isClearSummaryMode(displayMode) {
  return displayMode === "clear" || displayMode === "all";
}

function normalizeSongDataFilterPair(infValue, acdeleteValue) {
  const inf = normalizeBooleanFilter(infValue);
  const acdelete = normalizeBooleanFilter(acdeleteValue);
  const isSupportedPair = (
    (inf === "all" && acdelete === "all")
    || (inf === "all" && acdelete === "no")
    || (inf === "yes" && acdelete === "all")
    || (inf === "no" && acdelete === "no")
    || (inf === "yes" && acdelete === "yes")
    || (inf === "no" && acdelete === "yes")
  );

  return isSupportedPair
    ? { inf, acdelete }
    : { inf: "all", acdelete: "all" };
}

function normalizeUnratedFilter(value) {
  return value === "all" || value === "rated" || value === "unrated" ? value : "all";
}

function normalizeAxisMode(value) {
  return AXIS_MODES.includes(value) ? value : "splv";
}

function isTextAxisMode(axisMode) {
  return axisMode === "title" || axisMode === "memo";
}

function isNumericAxisMode(axisMode) {
  return NUMERIC_AXIS_MODES.includes(axisMode);
}

function isAxisRangeModeEnabled(filters) {
  return isNumericAxisMode(filters.axisMode) && Boolean(filters.axisRangeModeByAxis?.[filters.axisMode]);
}

function normalizeAxisMemory(axisMemory) {
  return {
    level: typeof axisMemory?.level === "string" ? axisMemory.level : "",
    splv: typeof axisMemory?.splv === "string" ? axisMemory.splv : "",
    katate: typeof axisMemory?.katate === "string" ? axisMemory.katate : "",
  };
}

function normalizeAxisRangeModeByAxis(rangeModeByAxis) {
  return {
    level: Boolean(rangeModeByAxis?.level),
    splv: Boolean(rangeModeByAxis?.splv),
    katate: Boolean(rangeModeByAxis?.katate),
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
  return DEFAULT_SORT_MODE_BY_AXIS[axisMode] ?? "splv";
}

function normalizeDateValue(value) {
  const normalized = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function normalizeDateSelectionMode(value) {
  return value === "range" ? "range" : "single";
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
  const songDataFilter = normalizeSongDataFilterPair(filters?.inf, filters?.acdelete);

  return {
    axisMode: normalizeAxisMode(filters?.axisMode),
    axisValue: typeof filters?.axisValue === "string" ? filters.axisValue : "",
    titleQuery: typeof filters?.titleQuery === "string" ? filters.titleQuery : "",
    dateSelectionMode: normalizeDateSelectionMode(filters?.dateSelectionMode),
    dateSingle: normalizeDateValue(filters?.dateSingle) || todayIso(),
    dateStart: dateRange.dateStart,
    dateEnd: dateRange.dateEnd,
    axisRangeModeByAxis: normalizeAxisRangeModeByAxis(filters?.axisRangeModeByAxis),
    axisRanges: normalizeAxisRanges(filters?.axisRanges),
    axisLastRanges: normalizeAxisRanges(filters?.axisLastRanges),
    axisSingleReturnValues: normalizeAxisSingleReturnValues(filters?.axisSingleReturnValues),
    displayMode: normalizeDisplayMode(filters?.displayMode),
    recommend: normalizeRecommendSelection(filters?.recommend),
    chartDifficulties: normalizeChartDifficultySelection(filters?.chartDifficulties),
    lamps: normalizeLampSelection(filters?.lamps),
    scoreRanks: normalizeScoreRankSelection(filters?.scoreRanks),
    inf: songDataFilter.inf,
    acdelete: songDataFilter.acdelete,
    includeUnrated: normalizeUnratedFilter(filters?.includeUnrated),
  };
}

function normalizeSortMode(sortMode) {
  return SORT_OPTIONS.includes(sortMode) ? sortMode : "splv";
}

function normalizeSortModeForDisplay(sortMode, displayMode) {
  if (displayMode === "score") {
    if (sortMode === "bestBp") {
      return "bestScore";
    }

    if (sortMode === "latestBp") {
      return "latestScore";
    }
  }

  if (displayMode === "clear") {
    if (sortMode === "bestScore") {
      return "bestBp";
    }

    if (sortMode === "latestScore") {
      return "latestBp";
    }
  }

  return normalizeSortMode(sortMode);
}

function normalizeSortDirection(sortDirection) {
  return sortDirection === "desc" ? "desc" : "asc";
}

function normalizeCatalogViewMode(catalogViewMode) {
  return catalogViewMode === "list" ? "list" : "card";
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

function getRecordPlayDate(record) {
  return record.playDate || record.date;
}

function getCatalogItemKey(entry) {
  return entry?.catalogItemKey || `title:${entry?.title ?? ""}`;
}

function applyPlayDateAdjustment(records) {
  const sortedRecords = [...records].sort(sortRecords);
  let previousRecord = null;
  let previousPlayDate = "";

  return sortedRecords.map((record) => {
    let playDate = record.date;
    const recordTime = parseRecordTimestampMs(record);
    const previousTime = parseRecordTimestampMs(previousRecord);
    const timestamp = normalizeRecordTimestamp(record.timestamp, record.date);
    const hour = Number(timestamp.slice(11, 13));
    const previousBaseDate = previousPlayDate || previousRecord?.date || "";
    const shouldInheritPlayDate = previousRecord
      && previousTime !== null
      && recordTime !== null
      && record.date !== previousBaseDate
      && recordTime - previousTime >= 0
      && recordTime - previousTime <= PLAY_DATE_CHAIN_THRESHOLD_MS
      && Number.isFinite(hour)
      && hour < PLAY_DATE_RESET_HOUR;

    if (shouldInheritPlayDate) {
      playDate = previousPlayDate || previousRecord.date;
    }

    previousRecord = record;
    previousPlayDate = playDate;

    const adjustedRecord = { ...record, playDate };
    return adjustedRecord;
  });
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
      axisMode: "splv",
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
    sortMode: normalizeSortModeForDisplay(normalizedSortMode, normalizedFilters.displayMode),
    sortModeMemory: {
      ...normalizedSortModeMemory,
      [normalizedFilters.axisMode]: normalizeSortMode(stored.sortMode),
      [restoredFilters.axisMode]: normalizedSortMode,
    },
    sortDirection: normalizeSortDirection(stored.sortDirection),
    catalogViewMode: normalizeCatalogViewMode(stored.catalogViewMode),
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
  const bestScore = Number.isFinite(historicalBestScore) ? historicalBestScore : null;
  const bestScoreRank = getScoreRankInfo(bestScore, song);
  const latestScoreRank = getScoreRankInfo(latestScore, song);
  const scoreMax = getScoreMax(song);

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
    bestScore,
    scoreMax,
    bestScoreRate: bestScoreRank.rate,
    currentScoreRate: latestScoreRank.rate,
    bestScoreLabel: bestScoreRank.display,
    currentScoreLabel: latestScoreRank.display,
    scoreRank: bestScoreRank.label,
    scoreFilterRank: bestScoreRank.label === "MAX" ? "AAA" : bestScoreRank.label,
  };
}

function filterHistoryByDateRange(history, filters) {
  if (filters.axisMode !== "date") {
    return history;
  }

  if (filters.dateSelectionMode === "single") {
    const dateSingle = normalizeDateValue(filters.dateSingle) || todayIso();
    return history.filter((record) => getRecordPlayDate(record) === dateSingle);
  }

  const { dateStart, dateEnd } = normalizeDateRange(filters.dateStart, filters.dateEnd);
  if (!dateStart && !dateEnd) {
    return history;
  }

  return history.filter((record) => {
    const playDate = getRecordPlayDate(record);
    if (dateStart && playDate < dateStart) {
      return false;
    }

    if (dateEnd && playDate > dateEnd) {
      return false;
    }

    return true;
  });
}

function applyDateScopedDisplayValues(songState, filters) {
  if (filters.axisMode !== "date") {
    return songState;
  }

  const dateScopedHistory = filterHistoryByDateRange(songState.history, filters);
  const dateScopedLatestBp = getLatestFiniteValue(dateScopedHistory, "bp");
  const dateScopedLatestScore = getLatestFiniteValue(dateScopedHistory, "score");
  const dateScopedBestScore = dateScopedHistory.reduce((best, record) => (
    record.score === null || record.score === undefined ? best : Math.max(best, record.score)
  ), Number.NEGATIVE_INFINITY);
  const bestScore = Number.isFinite(dateScopedBestScore) ? dateScopedBestScore : null;
  const bestScoreRank = getScoreRankInfo(bestScore, songState);
  const latestScoreRank = getScoreRankInfo(dateScopedLatestScore, songState);

  return {
    ...songState,
    bestLamp: dateScopedHistory.reduce((best, record) => pickBetterLamp(best, record.lamp), songState.initialLamp),
    currentBp: dateScopedLatestBp,
    currentScore: dateScopedLatestScore,
    bestScore,
    bestScoreRate: bestScoreRank.rate,
    currentScoreRate: latestScoreRank.rate,
    bestScoreLabel: bestScoreRank.display,
    currentScoreLabel: latestScoreRank.display,
    scoreRank: bestScoreRank.label,
    scoreFilterRank: bestScoreRank.label === "MAX" ? "AAA" : bestScoreRank.label,
  };
}

function shouldUseRecordScopedCatalog(filters, sortMode) {
  return filters.axisMode === "date" && sortMode === "latest";
}

function createRecordScopedCatalogItem(songState, record) {
  const recordLamp = LAMP_OPTIONS.includes(record?.lamp) ? record.lamp : "NO PLAY";
  const recordScoreRank = getScoreRankInfo(record.score, songState);

  return {
    ...songState,
    catalogItemKey: `record:${record.id}`,
    isRecordScopedCard: true,
    latestDate: getRecordPlayDate(record),
    latestTimestamp: normalizeRecordTimestamp(record.timestamp, record.date),
    latestLamp: recordLamp,
    bestLamp: recordLamp,
    currentBp: Number.isFinite(record.bp) ? record.bp : null,
    currentScore: Number.isFinite(record.score) ? record.score : null,
    currentScoreRate: recordScoreRank.rate,
    currentScoreLabel: recordScoreRank.display,
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

  return [...chartMap.values()].map((entry, index) => {
    const scratch = entry.scratch === null || entry.scratch === undefined || entry.scratch === ""
      ? null
      : Number(entry.scratch);

    return {
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
    scratch: Number.isFinite(scratch) ? scratch : null,
    textageid: entry.textageid,
    isProposed: entry.isProposed ?? false,
    chartType: entry.splv || entry.level ? "difficulty" : "difficulty-raw",
    initialLamp: "NO PLAY",
    initialBestBp: null,
    };
  });
}

function buildSummary(allSongStates, bandSongStates, targetSongStates, axisMode, displayMode = "clear") {
  const isScoreMode = displayMode === "score";
  const countsFactory = isScoreMode ? createScoreRankCounts : createLampCounts;
  const countKey = isScoreMode ? "scoreFilterRank" : "bestLamp";
  const lampCounts = countsFactory();

  targetSongStates.forEach((song) => {
    const summaryKey = isScoreMode ? normalizeScoreRankForSummary(song[countKey]) : song[countKey];
    if (isScoreMode && !SCORE_RANK_SUMMARY_OPTIONS.includes(summaryKey)) {
      return;
    }

    lampCounts[summaryKey] += 1;
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
      return "☆12-10";
    }

    if (axisMode === "katate") {
      return `☆${Number(value).toFixed(1).replace(".", "-")}`;
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
        lampCounts: countsFactory(),
      });
    }
  });

  bandSongStates.forEach((song) => {
    const summaryKey = isScoreMode ? normalizeScoreRankForSummary(song[countKey]) : song[countKey];
    if (isScoreMode && !SCORE_RANK_SUMMARY_OPTIONS.includes(summaryKey)) {
      return;
    }

    const value = getBandValue(song);
    const key = value === null ? "null" : String(value);
    const band = bandMap.get(key);
    band.total += 1;
    band.lampCounts[summaryKey] += 1;
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
    bandTotalSongs: isScoreMode
      ? bandSongStates.filter((song) => SCORE_RANK_SUMMARY_OPTIONS.includes(normalizeScoreRankForSummary(song[countKey]))).length
      : bandSongStates.length,
    totalSongs: isScoreMode
      ? targetSongStates.filter((song) => SCORE_RANK_SUMMARY_OPTIONS.includes(normalizeScoreRankForSummary(song[countKey]))).length
      : targetSongStates.length,
    lampCounts,
    displayMode: isScoreMode ? "score" : "clear",
    bands,
  };
}

function createLampCounts() {
  return LAMP_OPTIONS.reduce((counts, lamp) => {
    counts[lamp] = 0;
    return counts;
  }, {});
}

function createScoreRankCounts() {
  return SCORE_RANK_SUMMARY_OPTIONS.reduce((counts, rank) => {
    counts[rank] = 0;
    return counts;
  }, {});
}

function normalizeScoreRankForSummary(scoreRank) {
  return scoreRank === "※" ? "F" : scoreRank;
}

function formatDateBandLabel(date) {
  const [, month, day] = String(date ?? "").split("-").map(Number);
  return `${month}/${day}`;
}

function getDateSummaryRange(filters) {
  const { dateStart, dateEnd } = normalizeDateRange(filters.dateStart, filters.dateEnd);

  if (filters.dateSelectionMode === "single") {
    const dateSingle = normalizeDateValue(filters.dateSingle) || todayIso();
    return { start: dateSingle, end: dateSingle, sliceMode: "all", limit: null };
  }

  if (dateStart && dateEnd) {
    return { start: dateStart, end: dateEnd, sliceMode: "all", limit: null };
  }

  if (dateStart) {
    return { start: dateStart, end: "", sliceMode: "all", limit: null };
  }

  if (dateEnd) {
    return { start: "", end: dateEnd, sliceMode: "all", limit: null };
  }

  return { start: "", end: "", sliceMode: "all", limit: null };
}

function getDateSummarySingleTargetDates(records, visibleTitles, dateSingle) {
  const selectedDate = normalizeDateValue(dateSingle) || todayIso();
  const historyDates = [...new Set(records
    .filter((record) => visibleTitles.has(record.title))
    .map((record) => getRecordPlayDate(record))
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const beforeDates = historyDates.filter((date) => date < selectedDate).slice(-7);
  const afterDates = historyDates.filter((date) => date > selectedDate).slice(0, 7);
  return new Set([...beforeDates, selectedDate, ...afterDates]);
}

function buildDateSummary(records, baseSongs, countSongs, filters) {
  const visibleTitles = new Set(baseSongs.map((song) => song.title));
  const isScoreMode = filters.displayMode === "score";
  const countsFactory = isScoreMode ? createScoreRankCounts : createLampCounts;
  const { start, end, sliceMode, limit } = getDateSummaryRange(filters);
  const singleTargetDates = filters.dateSelectionMode === "single"
    ? getDateSummarySingleTargetDates(records, visibleTitles, filters.dateSingle)
    : null;
  const bandMap = new Map();

  const targetDates = new Set();
  records.forEach((record) => {
    if (!visibleTitles.has(record.title)) return;
    const playDate = getRecordPlayDate(record);
    if (singleTargetDates) {
      if (!singleTargetDates.has(playDate)) return;
    } else {
      if (start && playDate < start) return;
      if (end && playDate > end) return;
    }
    targetDates.add(playDate);
  });

  [...targetDates].sort((a, b) => a.localeCompare(b)).forEach((playDate) => {
    const band = {
      key: playDate,
      value: playDate,
      label: formatDateBandLabel(playDate),
      total: 0,
      lampCounts: countsFactory(),
      baseTotal: 0,
      baseLampCounts: countsFactory(),
    };

    baseSongs.forEach((song) => {
      if (!song.history.some((record) => getRecordPlayDate(record) === playDate)) {
        return;
      }

      const dateScopedSong = applyDateScopedDisplayValues(song, {
        ...filters,
        axisMode: "date",
        dateSelectionMode: "single",
        dateSingle: playDate,
      });
      const countKey = isScoreMode
        ? normalizeScoreRankForSummary(dateScopedSong.scoreFilterRank)
        : dateScopedSong.bestLamp;
      if (isScoreMode && !SCORE_RANK_SUMMARY_OPTIONS.includes(countKey)) {
        return;
      }

      band.baseTotal += 1;
      band.baseLampCounts[countKey] += 1;

      const selectedScoreRanks = filters.scoreRanks ?? SCORE_RANK_OPTIONS;
      const isSelected = isScoreMode
        ? selectedScoreRanks.includes(countKey) || (countKey === "F" && selectedScoreRanks.includes("※"))
        : filters.lamps.includes(countKey);

      if (isSelected) {
        band.total += 1;
        band.lampCounts[countKey] += 1;
      }
    });

    if (band.baseTotal > 0) {
      bandMap.set(playDate, band);
    }
  });

  let bands = [...bandMap.values()].sort((a, b) => String(a.value).localeCompare(String(b.value)));
  if (limit !== null) {
    bands = sliceMode === "first" ? bands.slice(0, limit) : bands.slice(-limit);
  }

  const lampCounts = countsFactory();
  countSongs.forEach((song) => {
    const summaryKey = isScoreMode ? normalizeScoreRankForSummary(song.scoreFilterRank) : song.bestLamp;
    if (isScoreMode && !SCORE_RANK_SUMMARY_OPTIONS.includes(summaryKey)) {
      return;
    }

    lampCounts[summaryKey] += 1;
  });

  return {
    axisMode: "date",
    bandTotalSongs: bands.reduce((total, band) => total + band.total, 0),
    totalSongs: countSongs.length,
    totalLabel: "総記録数",
    totalUnit: "件",
    emptyMessage: "該当する履歴がありません。",
    lampCounts,
    displayMode: isScoreMode ? "score" : "clear",
    bands,
  };
}

function getDefaultDateRangeFromRecords(records) {
  const dates = [...new Set(records.map((record) => getRecordPlayDate(record)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const recentDates = dates.slice(-14);
  const today = todayIso();

  if (recentDates.length === 0) {
    return { dateStart: today, dateEnd: today };
  }

  return {
    dateStart: recentDates[0],
    dateEnd: recentDates[recentDates.length - 1],
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
      axisMode: "splv",
      axisValue: "",
      titleQuery: "",
      dateSelectionMode: "single",
      dateSingle: todayIso(),
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

function compareScoreRatePrimaryValues(a, b, valueKey, sortDirection) {
  const aUnknownScore = a.scoreFilterRank === "※";
  const bUnknownScore = b.scoreFilterRank === "※";

  if (aUnknownScore && bUnknownScore) {
    return 0;
  }

  if (aUnknownScore) {
    return 1;
  }

  if (bUnknownScore) {
    return -1;
  }

  return compareNullablePrimaryValues(a[valueKey], b[valueKey], (aValue, bValue) => aValue - bValue, sortDirection);
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

  if (sortMode === "entryCount") {
    const compared = a.entryCount - b.entryCount;
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

  if (sortMode === "bestScore") {
    return compareScoreRatePrimaryValues(a, b, "bestScoreRate", sortDirection);
  }

  if (sortMode === "latestScore") {
    return compareScoreRatePrimaryValues(a, b, "currentScoreRate", sortDirection);
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

function hasPrimarySortDifference(songs, sortMode) {
  if (songs.length <= 1) {
    return false;
  }

  const first = songs[0];

  return songs.some((song) => (
    comparePrimarySortValue(first, song, sortMode, "asc") !== 0
  ));
}

function applySortDirectionFallbackIfNoPrimaryEffect(songs, sortMode, sortDirection) {
  if (sortDirection !== "desc" || songs.length <= 1) {
    return songs;
  }

  if (hasPrimarySortDifference(songs, sortMode)) {
    return songs;
  }

  return [...songs].reverse();
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
    catalogVisibleItemSnapshot: [],
    preserveVisibleCatalogItemsOnce: false,
    titleFilterBase: null,
    dateFilterBase: null,
    dateRangeMemory: {
      dateStart: "",
      dateEnd: "",
    },
    titleSortBase: "splv",
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
      axisMode: "splv",
      axisValue: "",
      titleQuery: "",
      dateSelectionMode: "single",
      dateSingle: todayIso(),
      dateStart: "",
      dateEnd: "",
      axisRangeModeByAxis: normalizeAxisRangeModeByAxis(),
      axisRanges: normalizeAxisRanges(),
      axisLastRanges: normalizeAxisRanges(),
      axisSingleReturnValues: normalizeAxisSingleReturnValues(),
      displayMode: "all",
      recommend: [...RECOMMEND_OPTIONS],
      chartDifficulties: [...CHART_DIFFICULTY_OPTIONS],
      lamps: [...LAMP_OPTIONS],
      scoreRanks: [...SCORE_RANK_OPTIONS],
      inf: "all",
      acdelete: "all",
      includeUnrated: "all",
    },
    sortMode: "splv",
    sortDirection: "asc",
    catalogViewMode: "card",
    currentPage: 1,
    selectedTitle: null,
    selectedCatalogKey: null,
    statusMessage: "",
    sourceLabel: "",
    ready: false,
    error: "",
  };

  let catalogSnapshotCache = null;

  function invalidateCatalogSnapshot() {
    catalogSnapshotCache = null;
  }

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
      catalogViewMode: state.catalogViewMode,
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
    state.catalogVisibleItemSnapshot = [];
    state.preserveVisibleCatalogItemsOnce = false;
    invalidateCatalogSnapshot();
  }

  function createDeletedRecordScopedCatalogItem(snapshotItem, currentSongState) {
    return {
      ...snapshotItem,
      history: currentSongState.history,
      entryCount: currentSongState.entryCount,
      note: currentSongState.note,
      catalogItemKey: getCatalogItemKey(snapshotItem),
      isRecordScopedCard: true,
      isDeletedRecordScopedCard: true,
    };
  }

  function createRecordScopedPreservePool(visibleSongs, songStates) {
    if (!shouldUseRecordScopedCatalog(state.filters, state.sortMode)) {
      return songStates;
    }

    const visibleKeys = new Set(visibleSongs.map((song) => getCatalogItemKey(song)));
    const songStateByTitle = new Map(songStates.map((song) => [song.title, song]));
    const deletedRecordItems = state.catalogVisibleItemSnapshot
      .filter((item) => item?.isRecordScopedCard && !visibleKeys.has(getCatalogItemKey(item)))
      .map((item) => {
        const currentSongState = songStateByTitle.get(item.title);
        return currentSongState ? createDeletedRecordScopedCatalogItem(item, currentSongState) : null;
      })
      .filter(Boolean);

    return [...visibleSongs, ...deletedRecordItems];
  }
  
  function applyStableVisibleOrder(visibleSongs, allSongStates = visibleSongs, options = {}) {
    const signature = createCatalogVisibleSignature();

    if (
      state.catalogVisibleSignature === signature
      && state.catalogVisibleTitleOrder.length > 0
    ) {
      const visibleSongByKey = new Map(visibleSongs.map((song) => [getCatalogItemKey(song), song]));
      const allSongByKey = new Map(allSongStates.map((song) => [getCatalogItemKey(song), song]));
      const usedKeys = new Set();
      const shouldKeepPreviousPool = state.sortMode === "latest" || options.preserveMissingItems;

      const stableSongs = state.catalogVisibleTitleOrder
        .map((key) => {
          const song = visibleSongByKey.get(key)
            ?? (shouldKeepPreviousPool ? allSongByKey.get(key) : null);

          if (song) {
            usedKeys.add(key);
          }

          return song;
        })
        .filter(Boolean);

      const appendedSongs = visibleSongs.filter((song) => !usedKeys.has(getCatalogItemKey(song)));

      const stableVisibleSongs = [...stableSongs, ...appendedSongs];
      state.catalogVisibleItemSnapshot = stableVisibleSongs;
      return stableVisibleSongs;
    }

    state.catalogVisibleSignature = signature;
    state.catalogVisibleTitleOrder = visibleSongs.map((song) => getCatalogItemKey(song));
    state.catalogVisibleItemSnapshot = visibleSongs;
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
      displayMode: sourceFilters.displayMode,
      recommend: [...sourceFilters.recommend],
      chartDifficulties: [...(sourceFilters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS)],
      scoreRanks: [...(sourceFilters.scoreRanks ?? SCORE_RANK_OPTIONS)],
    };
  }  

  function ensureSelectedSong(snapshot = getSnapshot()) {
    const visibleTitles = new Set(snapshot.pagedSongs.map((song) => song.title));
    const visibleKeys = new Set(snapshot.pagedSongs.map((song) => getCatalogItemKey(song)));

    if (!state.selectedTitle || !visibleTitles.has(state.selectedTitle) || (state.selectedCatalogKey && !visibleKeys.has(state.selectedCatalogKey))) {
      const nextSong = snapshot.pagedSongs[0] ?? snapshot.visibleSongs[0] ?? null;
      state.selectedTitle = nextSong?.title ?? null;
      state.selectedCatalogKey = nextSong ? getCatalogItemKey(nextSong) : null;
      return getSnapshot();
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
      const dateScopedHistory = filterHistoryByDateRange(entry.history, filters);

      if (dateScopedHistory.length === 0) {
        return false;
      }
    }

    if (filters.axisMode === "katate" && entry.katateValue === null) {
      return false;
    }

    if (filters.axisMode !== "date") {
      if (entry.levelValue === null) {
        if (filters.includeUnrated === "rated") {
          return false;
        }
      } else if (filters.includeUnrated === "unrated") {
        return false;
      }
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

    if (filters.axisMode !== "date" && !filters.recommend.includes(entry.recommend)) {
      return false;
    }

    if (filters.axisMode !== "date" && !(filters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS).includes(splitTitleAndSuffix(entry.title).suffix)) {
      return false;
    }

    const scoreRanks = filters.scoreRanks ?? SCORE_RANK_OPTIONS;
    const scoreFilterRank = entry.scoreFilterRank === "※" ? "F" : entry.scoreFilterRank;
    if (filters.displayMode === "score" && !scoreRanks.includes(scoreFilterRank)) {
      return false;
    }

    if (filters.displayMode !== "score" && !filters.lamps.includes(entry.bestLamp)) {
      return false;
    }

    if (filters.axisMode !== "date" && filters.inf === "yes" && !entry.infAvailable) {
      return false;
    }

    if (filters.axisMode !== "date" && filters.inf === "no" && entry.infAvailable) {
      return false;
    }

    if (filters.axisMode !== "date" && filters.acdelete === "yes" && !entry.acdelete) {
      return false;
    }

    if (filters.axisMode !== "date" && filters.acdelete === "no" && entry.acdelete) {
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
        state.catalogViewMode = normalized.catalogViewMode;

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
    const nextDisplayMode = normalizeDisplayMode(nextFilters.displayMode ?? state.filters.displayMode);
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
    let nextDateSelectionMode = normalizeDateSelectionMode(nextFilters.dateSelectionMode ?? state.filters.dateSelectionMode);
    let nextDateSingle = nextFilters.dateSingle ?? state.filters.dateSingle ?? todayIso();

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
        nextDateSelectionMode = normalizeDateSelectionMode(nextFilters.dateSelectionMode ?? state.filters.dateSelectionMode);
        nextDateSingle = typeof nextFilters.dateSingle === "string"
          ? nextFilters.dateSingle
          : state.filters.dateSingle || todayIso();
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

      state.sortMode = normalizeSortModeForDisplay(
        nextSortModeMemory[nextAxisMode] ?? getDefaultSortModeForAxis(nextAxisMode),
        nextDisplayMode,
      );
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
      dateSelectionMode: nextDateSelectionMode,
      dateSingle: normalizeDateValue(nextDateSingle) || todayIso(),
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
      displayMode: nextDisplayMode,
      recommend: nextFilters.recommend ? normalizeRecommendSelection(nextFilters.recommend) : state.filters.recommend,
      chartDifficulties: nextFilters.chartDifficulties
        ? normalizeChartDifficultySelection(nextFilters.chartDifficulties)
        : state.filters.chartDifficulties,
      lamps: nextFilters.lamps ? normalizeLampSelection(nextFilters.lamps) : state.filters.lamps,
      scoreRanks: nextFilters.scoreRanks ? normalizeScoreRankSelection(nextFilters.scoreRanks) : state.filters.scoreRanks,
      inf: nextFilters.inf ? normalizeBooleanFilter(nextFilters.inf) : state.filters.inf,
      acdelete: nextFilters.acdelete ? normalizeBooleanFilter(nextFilters.acdelete) : state.filters.acdelete,
      includeUnrated: normalizeUnratedFilter(nextFilters.includeUnrated ?? state.filters.includeUnrated),
    };
    const songDataFilter = normalizeSongDataFilterPair(nextStateFilters.inf, nextStateFilters.acdelete);
    nextStateFilters.inf = songDataFilter.inf;
    nextStateFilters.acdelete = songDataFilter.acdelete;

    if (!axisModeChanged) {
      const normalizedSortMode = normalizeSortModeForDisplay(state.sortMode, nextStateFilters.displayMode);
      if (normalizedSortMode !== state.sortMode) {
        state.sortMode = normalizedSortMode;
        nextSortModeMemory[nextStateFilters.axisMode] = normalizedSortMode;
      }
    }

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
    state.sortMode = normalizeSortModeForDisplay(state.titleSortBase, state.filters.displayMode);
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
        axisMode: "splv",
        axisValue: "",
        titleQuery: "",
        dateSelectionMode: "single",
        dateSingle: todayIso(),
        dateStart: "",
        dateEnd: "",
      };
    state.dateFilterBase = null;
    state.sortMode = normalizeSortModeForDisplay(
      state.sortModeMemory[state.filters.axisMode] ?? getDefaultSortModeForAxis(state.filters.axisMode),
      state.filters.displayMode,
    );
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
    invalidateCatalogSnapshot();
    ensureSelectedSong();
    emit();
  }

  function setSortMode(nextSortMode) {
    const normalized = normalizeSortMode(nextSortMode);
    if (normalized === state.sortMode) {
      return;
    }

    state.sortMode = normalized;
    state.sortDirection = "asc";
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

  function toggleCatalogViewMode() {
    state.catalogViewMode = state.catalogViewMode === "list" ? "card" : "list";
    persist();
    emit();
  }

  function selectSong(title, catalogItemKey = null) {
    const normalizedTitle = typeof title === "string" ? title : "";
    const normalizedCatalogKey = typeof catalogItemKey === "string" ? catalogItemKey : null;

    if (!normalizedTitle || (normalizedTitle === state.selectedTitle && normalizedCatalogKey === state.selectedCatalogKey)) {
      return;
    }

    state.selectedTitle = normalizedTitle;
    state.selectedCatalogKey = normalizedCatalogKey;
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
    state.preserveVisibleCatalogItemsOnce = true;
    invalidateCatalogSnapshot();
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
    state.preserveVisibleCatalogItemsOnce = true;
    invalidateCatalogSnapshot();
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

    invalidateCatalogSnapshot();
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

  function normalizeJsonImportLamp(value) {
    return LAMP_OPTIONS.includes(value) && value !== "NO PLAY" ? value : null;
  }

  function normalizeJsonImportNumber(value) {
    const parsed = parseOptionalNumber(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isJsonRecordImprovement(record, currentState) {
    const importedLamp = normalizeJsonImportLamp(record?.lamp);
    const importedBp = normalizeJsonImportNumber(record?.bp);
    const importedScore = normalizeJsonImportNumber(record?.score);

    const currentBestLamp = currentState?.bestLamp ?? "NO PLAY";
    const currentBestBp = currentState?.bestBp ?? null;
    const currentBestScore = currentState?.bestScore ?? null;

    const lampImproved = importedLamp !== null
      && getLampRank(importedLamp) > getLampRank(currentBestLamp);

    const bpImproved = importedBp !== null
      && (!Number.isFinite(currentBestBp) || importedBp < currentBestBp);

    const scoreImproved = importedScore !== null
      && (!Number.isFinite(currentBestScore) || importedScore > currentBestScore);

    return lampImproved || bpImproved || scoreImproved;
  }

  function removeJsonAggregateReflectedValues(record, currentFullState) {
    const importedLamp = normalizeJsonImportLamp(record?.lamp);
    const importedBp = normalizeJsonImportNumber(record?.bp);
    const importedScore = normalizeJsonImportNumber(record?.score);

    const nextRecord = { ...record };

    if (importedLamp !== null && importedLamp === currentFullState?.bestLamp) {
      nextRecord.lamp = "NO PLAY";
    }

    if (importedBp !== null && importedBp === currentFullState?.bestBp) {
      nextRecord.bp = null;
    }

    if (importedScore !== null && importedScore === currentFullState?.bestScore) {
      nextRecord.score = null;
    }

    return nextRecord;
  }

  function hasJsonImportValue(record) {
    return normalizeJsonImportLamp(record?.lamp) !== null
      || normalizeJsonImportNumber(record?.bp) !== null
      || normalizeJsonImportNumber(record?.score) !== null;
  }

  function importJsonData(payload, referenceDate = todayIso()) {
    const catalogEntryByTitle = new Map(getCatalogEntries().map((entry) => [entry.title, entry]));

    const comparableRecordIndex = buildRecordIndex(
      state.records.filter((record) => record.date && record.date <= referenceDate),
    );

    const fullRecordIndex = buildRecordIndex(state.records);

    const importedRecords = importDbrJson(payload, referenceDate)
      .map((record) => {
        const selectedEntry = catalogEntryByTitle.get(record.title);

        if (!selectedEntry) {
          return null;
        }

        const comparableState = deriveSongState(
          selectedEntry,
          comparableRecordIndex.get(selectedEntry.title) ?? [],
        );

        if (!isJsonRecordImprovement(record, comparableState)) {
          return null;
        }

        const currentFullState = deriveSongState(
          selectedEntry,
          fullRecordIndex.get(selectedEntry.title) ?? [],
        );

        const nextRecord = removeJsonAggregateReflectedValues(record, currentFullState);
        return hasJsonImportValue(nextRecord) ? nextRecord : null;
      })
      .filter(Boolean)
      .map((record) => {
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
          lamp: LAMP_OPTIONS.includes(record.lamp) ? record.lamp : "NO PLAY",
          bp: record.bp,
          score: record.score,
          textageKey: record.textageKey,
          source: record.source,
        };
      });

    const importedKeys = new Set(importedRecords.map(getJsonRecordMergeKey));
    const preservedRecords = state.records.filter((record) => !importedKeys.has(getJsonRecordMergeKey(record)));

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

    const existingRecordByKey = new Map(
      state.records.map((record) => [getCsvRecordMergeKey(record), record]),
    );

    const updatedRecordCount = importedRecords.reduce((count, record) => {
      const existing = existingRecordByKey.get(getCsvRecordMergeKey(record));

      if (!existing) {
        return count + 1;
      }

      return areCsvRecordValuesEqual(existing, record) ? count : count + 1;
    }, 0);

    const importedKeys = new Set(importedRecords.map(getCsvRecordMergeKey));
    const preservedRecords = state.records.filter((record) => !importedKeys.has(getCsvRecordMergeKey(record)));

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
    state.statusMessage = `CSVを読み込みました。${updatedRecordCount} 件を取り込み、合計 ${state.records.length} 件になりました。`;
    persist();
    ensureSelectedSong();
    emit();
    return { count: updatedRecordCount, totalCount: state.records.length };
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

  function getCatalogSnapshot() {
    if (catalogSnapshotCache) {
      return catalogSnapshotCache;
    }

    const catalogEntries = getCatalogEntries();
    const playDateAdjustedRecords = applyPlayDateAdjustment(state.records);
    const recordIndex = buildRecordIndex(playDateAdjustedRecords);
    const dateDefaultRange = getDefaultDateRangeFromRecords(playDateAdjustedRecords);

    const allSongStates = catalogEntries.map((entry) => ({
      ...deriveSongState(entry, recordIndex.get(entry.title) ?? []),
      note: state.songNotes[entry.title] ?? "",
      displayMode: state.filters.displayMode,
    }));

    const songStates = allSongStates.map((entry) => ({
      ...applyDateScopedDisplayValues(entry, state.filters),
      note: state.songNotes[entry.title] ?? "",
      displayMode: state.filters.displayMode,
    })).sort((a, b) => compareCatalogSongs(
      a,
      b,
      state.sortMode,
      state.sortDirection,
      state.filters.axisMode,
    ));

    let filteredVisibleSongs = songStates.filter((entry) => matchesFiltersFor(entry, state.filters));

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

    if (shouldUseRecordScopedCatalog(state.filters, state.sortMode)) {
      filteredVisibleSongs = filteredVisibleSongs
        .flatMap((entry) => filterHistoryByDateRange(entry.history, state.filters)
          .map((record) => createRecordScopedCatalogItem(entry, record)))
        .sort((a, b) => compareCatalogSongs(
          a,
          b,
          state.sortMode,
          state.sortDirection,
          state.filters.axisMode,
        ));
    }

    const directionAdjustedVisibleSongs = applySortDirectionFallbackIfNoPrimaryEffect(
      filteredVisibleSongs,
      state.sortMode,
      state.sortDirection,
    );

    const shouldPreserveVisibleCatalogItems = state.preserveVisibleCatalogItemsOnce;
    const stableOrderPool = createRecordScopedPreservePool(directionAdjustedVisibleSongs, songStates);
    const visibleSongs = applyStableVisibleOrder(
      directionAdjustedVisibleSongs,
      stableOrderPool,
      { preserveMissingItems: shouldPreserveVisibleCatalogItems },
    );
    state.preserveVisibleCatalogItemsOnce = false;

    const summaryFilters = isTextAxisMode(state.filters.axisMode) && state.titleFilterBase
      ? state.titleFilterBase
      : state.filters;

    const summaryScopeFilters = isTextAxisMode(summaryFilters.axisMode)
      ? { ...summaryFilters }
      : { ...summaryFilters, axisValue: "", axisRangeModeByAxis: normalizeAxisRangeModeByAxis() };

    const summaryBandBaseSongs = summaryFilters.axisMode === "katate"
      ? songStates.filter((entry) => entry.katateValue !== null)
      : songStates;

    const summarySongs = summaryBandBaseSongs.filter((entry) => matchesFiltersFor(entry, summaryScopeFilters));

    const summaryCountFilters = {
      ...summaryFilters,
      lamps: [...LAMP_OPTIONS],
      scoreRanks: [...SCORE_RANK_OPTIONS],
    };

    const summaryCountSongs = songStates.filter((entry) => matchesFiltersFor(entry, summaryCountFilters));

    const dateSummaryBaseFilters = summaryFilters.axisMode === "date"
      ? {
          ...summaryCountFilters,
          axisMode: "splv",
          axisValue: "",
          axisRangeModeByAxis: normalizeAxisRangeModeByAxis(),
        }
      : null;
    const dateSummaryBaseSongs = dateSummaryBaseFilters
      ? summaryBandBaseSongs.filter((entry) => matchesFiltersFor(entry, dateSummaryBaseFilters))
      : summaryCountSongs;

    const summary = summaryFilters.axisMode === "date"
      ? buildDateSummary(playDateAdjustedRecords, dateSummaryBaseSongs, summaryCountSongs, summaryFilters)
      : buildSummary(summaryBandBaseSongs, summarySongs, summaryCountSongs, summaryFilters.axisMode, summaryFilters.displayMode);

    const totalPages = Math.max(1, Math.ceil(visibleSongs.length / PAGE_SIZE));
    const currentPage = Math.max(1, Math.min(state.currentPage, totalPages));
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pagedSongs = visibleSongs.slice(pageStart, pageStart + PAGE_SIZE);

    catalogSnapshotCache = {
      currentPage,
      allSongStates,
      songStates,
      visibleSongs,
      pagedSongs,
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

    return catalogSnapshotCache;
  }

  function getSnapshot() {
    const catalogSnapshot = getCatalogSnapshot();

    const selectedCatalogItem = catalogSnapshot.pagedSongs.find((song) => getCatalogItemKey(song) === state.selectedCatalogKey)
      ?? catalogSnapshot.pagedSongs.find((song) => song.title === state.selectedTitle)
      ?? catalogSnapshot.pagedSongs[0]
      ?? catalogSnapshot.visibleSongs[0]
      ?? null;
    const selectedSong = catalogSnapshot.allSongStates.find((song) => song.title === selectedCatalogItem?.title)
      ?? selectedCatalogItem;

    const selectedHistory = selectedSong
      ? [...selectedSong.history].sort((a, b) => sortRecords(b, a))
      : [];

    return {
      ...state,
      ...catalogSnapshot,
      selectedSong,
      selectedCatalogKey: selectedCatalogItem ? getCatalogItemKey(selectedCatalogItem) : null,
      selectedHistory,
      difficultyTable: state.difficultyTable,
    };
  }

  return {
    initialize,
    setDifficultyFilters,
    clearTitleFilter,
    clearDateFilter,
    setSortMode,
    toggleSortDirection,
    toggleCatalogViewMode,
    setPage,
    selectSong,
    saveRecord,
    deleteRecord,
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
