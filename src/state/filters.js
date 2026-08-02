const MODULE_VERSION = new URL(import.meta.url).search;

const { LAMP_OPTIONS } = await import(`../constants.js${MODULE_VERSION}`);
const { todayIso } = await import(`../utils/date.js${MODULE_VERSION}`);
const { getSearchTextMatchRank, matchesSearchText } = await import(`../utils/search.js${MODULE_VERSION}`);
const {
  compareTitlesWithSuffixOrder,
  getLampRank,
  getRecordPlayDate,
  normalizeRecordTimestamp,
  parseOptionalNumber,
  splitTitleAndSuffix,
} = await import(`./data.js${MODULE_VERSION}`);

export const RECOMMEND_OPTIONS = ["", "△", "○", "◎", "☆"];
export const RECOMMEND_SORT_OPTIONS = ["☆", "◎", "○", "△", ""];
export const CHART_DIFFICULTY_OPTIONS = ["B", "N", "H", "A", "L"];
export const DISPLAY_MODES = ["clear", "score", "all"];
export const SUMMARY_DISPLAY_MODES = ["clear", "score"];
export const SCORE_RANK_OPTIONS = ["AAA", "AA", "A", "B", "C", "D", "E", "F", "※"];
export const SCORE_RANK_SUMMARY_OPTIONS = SCORE_RANK_OPTIONS.filter((rank) => rank !== "※");
export const PAGE_SIZE = 100;
export const SORT_OPTIONS = ["title", "version", "chartDifficulty", "splv", "level", "katate", "bpm", "recommend", "clear", "bestBp", "latestBp", "bestScore", "latestScore", "latest", "entryCount", "memo", "random"];
export const AXIS_MODES = ["level", "splv", "katate", "version", "bpm", "title", "memo", "date"];
export const AXIS_MEMORY_MODES = ["level", "splv", "katate", "version", "bpm"];
export const NUMERIC_AXIS_MODES = ["level", "splv", "katate", "version", "bpm"];
export const BPM_BUCKETS = [
  { value: "lt120", label: "min-119", min: -Infinity, max: 119.999 },
  ...Array.from({ length: 10 }, (_, index) => {
    const min = 120 + index * 10;
    return { value: String(min), label: `${min}-${min + 9}`, min, max: min + 9.999 };
  }),
  { value: "220", label: "220-249", min: 220, max: 249.999 },
  { value: "250", label: "250-max", min: 250, max: Infinity },
];
export const BPM_RANGE_POINTS = [
  "min",
  ...Array.from({ length: 11 }, (_, index) => String(120 + index * 10)),
  "250",
  "max",
];
export const VERSION_ORDER_VALUES = ["0", "1", "s", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34"];
export const VERSION_LABELS = new Map([
  ["0", "CS/INFINITAS"],
  ["1", "1st style"],
  ["s", "substream"],
  ["2", "2nd style"],
  ["3", "3rd style"],
  ["4", "4th style"],
  ["5", "5th style"],
  ["6", "6th style"],
  ["7", "7th style"],
  ["8", "8th style"],
  ["9", "9th style"],
  ["10", "10th style"],
  ["11", "RED"],
  ["12", "HAPPY SKY"],
  ["13", "DistorteD"],
  ["14", "GOLD"],
  ["15", "DJ TROOPERS"],
  ["16", "EMPRESS"],
  ["17", "SIRIUS"],
  ["18", "Resort Anthem"],
  ["19", "Lincle"],
  ["20", "tricoro"],
  ["21", "SPADA"],
  ["22", "PENDUAL"],
  ["23", "copula"],
  ["24", "SINOBUZ"],
  ["25", "CANNON BALLERS"],
  ["26", "Rootage"],
  ["27", "HEROIC VERSE"],
  ["28", "BISTROVER"],
  ["29", "CastHour"],
  ["30", "RESIDENT"],
  ["31", "EPOLIS"],
  ["32", "Pinky Crush"],
  ["33", "Sparkle Shower"],
  ["34", "ZINRAI"],
]);
export const VERSION_BAND_LABELS = new Map([
  ["0", "CS/INF"],
  ["1", "1st"],
  ["s", "sub"],
  ["2", "2nd"],
  ["3", "3rd"],
  ["4", "4th"],
  ["5", "5th"],
  ["6", "6th"],
  ["7", "7th"],
  ["8", "8th"],
  ["9", "9th"],
  ["10", "10th"],
  ["11", "RED"],
  ["12", "SKY"],
  ["13", "DD"],
  ["14", "GOLD"],
  ["15", "DJT"],
  ["16", "EMP"],
  ["17", "SIR"],
  ["18", "RA"],
  ["19", "LC"],
  ["20", "tri"],
  ["21", "SPA"],
  ["22", "PEN"],
  ["23", "cop"],
  ["24", "SINO"],
  ["25", "CAN"],
  ["26", "Root"],
  ["27", "HERO"],
  ["28", "BIS"],
  ["29", "Cast"],
  ["30", "RESI"],
  ["31", "EPO"],
  ["32", "Pink"],
  ["33", "SPS"],
  ["34", "ZIN"],
]);
export const AXIS_RANGE_MODE_DISABLED = {
  level: false,
  splv: false,
  katate: false,
  version: false,
  bpm: false,
};
export const DEFAULT_SORT_MODE_BY_AXIS = {
  level: "level",
  splv: "splv",
  katate: "katate",
  version: "version",
  bpm: "bpm",
  title: "title",
  memo: "memo",
  date: "latest",
};

const BPM_BUCKET_ORDER = new Map(BPM_BUCKETS.map((bucket, index) => [bucket.value, index]));
const BPM_RANGE_POINT_ORDER = new Map(BPM_RANGE_POINTS.map((value, index) => [value, index]));
const VERSION_ORDER = new Map(VERSION_ORDER_VALUES.map((value, index) => [value, index]));

export function parseBpmSortValue(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const values = normalized
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter(Number.isFinite) ?? [];

  return values.length ? Math.max(...values) : null;
}

export function getBpmBucketValue(bpmValue) {
  if (!Number.isFinite(bpmValue)) {
    return "";
  }

  const bucket = BPM_BUCKETS.find((candidate) => bpmValue >= candidate.min && bpmValue <= candidate.max);
  return bucket?.value ?? "";
}

export function getBpmBucketOrderValue(value) {
  return BPM_BUCKET_ORDER.has(value) ? BPM_BUCKET_ORDER.get(value) : null;
}

export function getBpmBucketLabel(value) {
  return BPM_BUCKETS.find((bucket) => bucket.value === value)?.label ?? "-";
}

export function getBpmRangePointOrderValue(value) {
  return BPM_RANGE_POINT_ORDER.has(value) ? BPM_RANGE_POINT_ORDER.get(value) : null;
}

export function normalizeVersionValue(value) {
  return String(value ?? "").trim();
}

export function getVersionOrderValue(value) {
  const normalized = normalizeVersionValue(value);
  return VERSION_ORDER.has(normalized) ? VERSION_ORDER.get(normalized) : null;
}

export function getVersionDisplayLabel(value) {
  const normalized = normalizeVersionValue(value);
  return VERSION_LABELS.get(normalized) ?? (normalized || "不明");
}

export function getVersionBandLabel(value) {
  const normalized = normalizeVersionValue(value);
  return VERSION_BAND_LABELS.get(normalized) ?? (normalized || "-");
}

export function normalizeRecommendSelection(values) {
  if (!Array.isArray(values)) {
    return [...RECOMMEND_OPTIONS];
  }

  return [...new Set(values.filter((value) => RECOMMEND_OPTIONS.includes(value)))];
}

export function normalizeRecommendSortHead(value) {
  return RECOMMEND_SORT_OPTIONS.includes(value) ? value : RECOMMEND_SORT_OPTIONS[0];
}

export function getRecommendSortChoicesFromSongs(songs) {
  const recommends = new Set(songs.map((song) => String(song.recommend ?? "")));
  return RECOMMEND_SORT_OPTIONS.filter((recommend) => recommends.has(recommend));
}

export function normalizeRecommendSortHeadForChoices(value, choices) {
  return choices.includes(value) ? value : (choices[0] ?? normalizeRecommendSortHead(value));
}

export function normalizeRecommendSortHeadMemory(memory) {
  const normalized = {};
  AXIS_MODES.forEach((axisMode) => {
    const value = normalizeRecommendSortHead(memory?.[axisMode]);
    if (value !== RECOMMEND_SORT_OPTIONS[0]) {
      normalized[axisMode] = value;
    }
  });
  return normalized;
}

export function normalizeChartDifficultySelection(values) {
  if (!Array.isArray(values)) {
    return [...CHART_DIFFICULTY_OPTIONS];
  }

  return [...new Set(values.filter((value) => CHART_DIFFICULTY_OPTIONS.includes(value)))];
}

export function normalizeChartDifficultySortHead(value) {
  return CHART_DIFFICULTY_OPTIONS.includes(value) ? value : CHART_DIFFICULTY_OPTIONS[0];
}

export function getChartDifficultySortChoicesFromSongs(songs) {
  const suffixes = new Set(
    songs.map((song) => splitTitleAndSuffix(song.title).suffix)
      .filter((suffix) => CHART_DIFFICULTY_OPTIONS.includes(suffix)),
  );

  return CHART_DIFFICULTY_OPTIONS.filter((suffix) => suffixes.has(suffix));
}

export function normalizeChartDifficultySortHeadForChoices(value, choices) {
  return choices.includes(value) ? value : (choices[0] ?? normalizeChartDifficultySortHead(value));
}

export function getChartDifficultyRotationState(songs, head) {
  const choices = getChartDifficultySortChoicesFromSongs(songs);
  const effectiveHead = choices.length > 0
    ? normalizeChartDifficultySortHeadForChoices(head, choices)
    : normalizeChartDifficultySortHead(head);
  const direction = choices.length > 0 && effectiveHead === choices[choices.length - 1] ? "desc" : "asc";

  return {
    choices,
    head: effectiveHead,
    direction,
  };
}

export function normalizeChartDifficultySortHeadMemory(memory) {
  const normalized = {};
  AXIS_MODES.forEach((axisMode) => {
    const value = normalizeChartDifficultySortHead(memory?.[axisMode]);
    if (value !== CHART_DIFFICULTY_OPTIONS[0]) {
      normalized[axisMode] = value;
    }
  });
  return normalized;
}

export function normalizeLampSelection(values) {
  if (!Array.isArray(values)) {
    return [...LAMP_OPTIONS];
  }

  return LAMP_OPTIONS.filter((lamp) => values.includes(lamp));
}

export function normalizeScoreRankSelection(values) {
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

export function normalizeBooleanFilter(value) {
  return value === "yes" || value === "no" ? value : "all";
}

export function normalizeDisplayMode(value) {
  return DISPLAY_MODES.includes(value) ? value : "all";
}

export function normalizeSummaryDisplayMode(value) {
  return SUMMARY_DISPLAY_MODES.includes(value) ? value : "clear";
}

export function isScoreDisplayMode(displayMode) {
  return displayMode === "score";
}

export function isClearSummaryMode(displayMode) {
  return displayMode === "clear" || displayMode === "all";
}

export function getEffectiveSummaryDisplayMode(filters) {
  const displayMode = normalizeDisplayMode(filters?.displayMode);
  if (displayMode === "clear" || displayMode === "score") {
    return displayMode;
  }

  return normalizeSummaryDisplayMode(filters?.summaryDisplayMode);
}

export function normalizeSongDataFilterPair(infValue, acdeleteValue) {
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

export function normalizeUnratedFilter(value) {
  return value === "all" || value === "rated" || value === "unrated" ? value : "all";
}

export function normalizeAxisMode(value) {
  return AXIS_MODES.includes(value) ? value : "splv";
}

export function isTextAxisMode(axisMode) {
  return axisMode === "title" || axisMode === "memo";
}

export function isDateAxisMode(axisMode) {
  return axisMode === "date";
}

export function isNumericAxisMode(axisMode) {
  return NUMERIC_AXIS_MODES.includes(axisMode);
}

export function isAxisRangeModeEnabled(filters) {
  return isNumericAxisMode(filters.axisMode) && Boolean(filters.axisRangeModeByAxis?.[filters.axisMode]);
}

export function normalizeAxisMemory(axisMemory) {
  return {
    level: typeof axisMemory?.level === "string" ? axisMemory.level : "",
    splv: typeof axisMemory?.splv === "string" ? axisMemory.splv : "",
    katate: typeof axisMemory?.katate === "string" ? axisMemory.katate : "",
    version: typeof axisMemory?.version === "string" ? axisMemory.version : "",
    bpm: typeof axisMemory?.bpm === "string" ? axisMemory.bpm : "",
  };
}

export function normalizeAxisRangeModeByAxis(rangeModeByAxis) {
  return {
    level: Boolean(rangeModeByAxis?.level),
    splv: Boolean(rangeModeByAxis?.splv),
    katate: Boolean(rangeModeByAxis?.katate),
    version: Boolean(rangeModeByAxis?.version),
    bpm: Boolean(rangeModeByAxis?.bpm),
  };
}

export function normalizeAxisRangePair(range) {
  const start = typeof range?.start === "string" ? range.start : "";
  const end = typeof range?.end === "string" ? range.end : "";
  const normalized = normalizeRangePair(start, end);
  return {
    start: typeof normalized.min === "string" ? normalized.min : "",
    end: typeof normalized.max === "string" ? normalized.max : "",
  };
}

export function normalizeVersionRangePair(range) {
  const start = typeof range?.start === "string" ? range.start : "";
  const end = typeof range?.end === "string" ? range.end : "";
  const startOrder = getVersionOrderValue(start);
  const endOrder = getVersionOrderValue(end);
  if (startOrder !== null && endOrder !== null && startOrder > endOrder) {
    return { start: end, end: start };
  }

  return { start, end };
}

export function normalizeBpmRangePair(range) {
  const start = typeof range?.start === "string" ? range.start : "";
  const end = typeof range?.end === "string" ? range.end : "";
  const startOrder = getBpmRangePointOrderValue(start);
  const endOrder = getBpmRangePointOrderValue(end);
  if (startOrder !== null && endOrder !== null && startOrder === endOrder) {
    return { start: BPM_RANGE_POINTS[0], end: BPM_RANGE_POINTS[BPM_RANGE_POINTS.length - 1] };
  }
  if (startOrder !== null && endOrder !== null && startOrder > endOrder) {
    return { start: end, end: start };
  }

  return { start, end };
}

export function normalizeAxisRanges(axisRanges) {
  return {
    level: normalizeAxisRangePair(axisRanges?.level),
    splv: normalizeAxisRangePair(axisRanges?.splv),
    katate: normalizeAxisRangePair(axisRanges?.katate),
    version: normalizeVersionRangePair(axisRanges?.version),
    bpm: normalizeBpmRangePair(axisRanges?.bpm),
  };
}

export function normalizeAxisSingleReturnValues(axisSingleReturnValues) {
  return {
    level: typeof axisSingleReturnValues?.level === "string" ? axisSingleReturnValues.level : "",
    splv: typeof axisSingleReturnValues?.splv === "string" ? axisSingleReturnValues.splv : "",
    katate: typeof axisSingleReturnValues?.katate === "string" ? axisSingleReturnValues.katate : "",
    version: typeof axisSingleReturnValues?.version === "string" ? axisSingleReturnValues.version : "",
    bpm: typeof axisSingleReturnValues?.bpm === "string" ? axisSingleReturnValues.bpm : "",
  };
}

export function normalizeSortModeMemory(sortModeMemory) {
  const normalized = {};
  AXIS_MODES.forEach((axisMode) => {
    if (SORT_OPTIONS.includes(sortModeMemory?.[axisMode])) {
      normalized[axisMode] = sortModeMemory[axisMode];
    }
  });
  return normalized;
}

export function normalizeDateRangeMemory(dateRangeMemory) {
  return normalizeDateRange(dateRangeMemory?.dateStart, dateRangeMemory?.dateEnd);
}

export function getDefaultSortModeForAxis(axisMode) {
  return DEFAULT_SORT_MODE_BY_AXIS[axisMode] ?? "splv";
}

export function normalizeDateValue(value) {
  const normalized = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

export function normalizeDateSelectionMode(value) {
  return value === "range" ? "range" : "single";
}

export function normalizeDateRange(startValue, endValue) {
  const start = normalizeDateValue(startValue);
  const end = normalizeDateValue(endValue);

  if (start && end && start > end) {
    return { dateStart: end, dateEnd: start };
  }

  return { dateStart: start, dateEnd: end };
}

export function normalizeRangePair(minValue, maxValue) {
  const minNumber = parseOptionalNumber(minValue);
  const maxNumber = parseOptionalNumber(maxValue);

  if (minNumber === null || maxNumber === null || minNumber <= maxNumber) {
    return { min: minValue, max: maxValue };
  }

  return { min: maxValue, max: minValue };
}

export function normalizeStoredFilters(filters) {
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
    summaryDisplayMode: normalizeSummaryDisplayMode(filters?.summaryDisplayMode),
    recommend: normalizeRecommendSelection(filters?.recommend),
    chartDifficulties: normalizeChartDifficultySelection(filters?.chartDifficulties),
    versionChartDifficulties: normalizeChartDifficultySelection(filters?.versionChartDifficulties),
    lamps: normalizeLampSelection(filters?.lamps),
    scoreRanks: normalizeScoreRankSelection(filters?.scoreRanks),
    inf: songDataFilter.inf,
    acdelete: songDataFilter.acdelete,
    includeUnrated: normalizeUnratedFilter(filters?.includeUnrated),
  };
}

export function normalizeSortMode(sortMode) {
  return SORT_OPTIONS.includes(sortMode) ? sortMode : "splv";
}

export function normalizeSortModeForDisplay(sortMode, displayMode) {
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

export function normalizeSortDirection(sortDirection) {
  return sortDirection === "desc" ? "desc" : "asc";
}

export function normalizeRandomSeed(seed) {
  return Number.isFinite(seed) ? seed : 1;
}

export function normalizeCatalogViewMode(catalogViewMode) {
  return catalogViewMode === "list" || catalogViewMode === "table" ? catalogViewMode : "card";
}

export function filterHistoryByDateRange(history, filters) {
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

export function shouldUseRecordScopedCatalog(filters) {
  return filters.axisMode === "date";
}

export function matchesRecordScopedResultFilter(entry, filters) {
  const activeSummaryFilterMode = getEffectiveSummaryDisplayMode(filters);

  if (activeSummaryFilterMode === "score") {
    const scoreRanks = filters.scoreRanks ?? SCORE_RANK_OPTIONS;
    const scoreFilterRank = entry.cardScoreFilterRank === "※" ? "F" : entry.cardScoreFilterRank;
    return scoreRanks.includes(scoreFilterRank);
  }

  return filters.lamps.includes(entry.bestLamp);
}

export function matchesTextAxisFixedFilters(entry, filters) {
  const chartDifficulties = filters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS;
  if (!chartDifficulties.includes(splitTitleAndSuffix(entry.title).suffix)) {
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

export function matchesFiltersFor(entry, filters) {
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

  if (!matchesAxisValue(entry, filters)) {
    return false;
  }

  const activeChartDifficulties = filters.axisMode === "version"
    ? (filters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS)
      .filter((option) => (filters.versionChartDifficulties ?? CHART_DIFFICULTY_OPTIONS).includes(option))
    : (filters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS);
  if (filters.axisMode !== "date" && !activeChartDifficulties.includes(splitTitleAndSuffix(entry.title).suffix)) {
    return false;
  }

  const activeSummaryFilterMode = getEffectiveSummaryDisplayMode(filters);
  const scoreRanks = filters.scoreRanks ?? SCORE_RANK_OPTIONS;
  const scoreFilterRank = entry.scoreFilterRank === "※" ? "F" : entry.scoreFilterRank;
  if (activeSummaryFilterMode === "score" && !scoreRanks.includes(scoreFilterRank)) {
    return false;
  }

  if (activeSummaryFilterMode !== "score" && !filters.lamps.includes(entry.bestLamp)) {
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

function matchesAxisValue(entry, filters) {
  if (isNumericAxisMode(filters.axisMode) && isAxisRangeModeEnabled(filters)) {
    const range = filters.axisRanges?.[filters.axisMode] ?? { start: "", end: "" };
    const start = parseOptionalNumber(range.start);
    const end = parseOptionalNumber(range.end);
    const entryValue = getEntryAxisValue(entry, filters.axisMode);

    if (filters.axisMode === "version") {
      const startOrder = getVersionOrderValue(range.start);
      const endOrder = getVersionOrderValue(range.end);
      return !(startOrder !== null && endOrder !== null && (entryValue === null || entryValue < startOrder || entryValue > endOrder));
    }

    if (filters.axisMode === "bpm") {
      const startOrder = getBpmRangePointOrderValue(range.start);
      const endOrder = getBpmRangePointOrderValue(range.end);
      return !(startOrder !== null && endOrder !== null && (entryValue === null || entryValue < startOrder || entryValue >= endOrder));
    }

    return !(start !== null && end !== null && (entryValue === null || entryValue < start || entryValue > end));
  }

  if (filters.axisMode === "level") {
    const selectedLevel = parseOptionalNumber(filters.axisValue);
    return selectedLevel === null || entry.levelValue === selectedLevel;
  }

  if (filters.axisMode === "splv") {
    const selectedSplv = parseOptionalNumber(filters.axisValue);
    return selectedSplv === null || entry.splvValue === selectedSplv;
  }

  if (filters.axisMode === "katate") {
    const selectedKatate = parseOptionalNumber(filters.axisValue);
    return selectedKatate === null || entry.katateValue === selectedKatate;
  }

  if (filters.axisMode === "bpm") {
    const selectedBpmBucket = String(filters.axisValue ?? "");
    return !selectedBpmBucket || getBpmBucketValue(entry.bpmValue) === selectedBpmBucket;
  }

  if (filters.axisMode === "version") {
    const selectedVersion = normalizeVersionValue(filters.axisValue);
    return !selectedVersion || entry.version === selectedVersion;
  }

  return true;
}

function getEntryAxisValue(entry, axisMode) {
  if (axisMode === "level") {
    return entry.levelValue;
  }

  if (axisMode === "splv") {
    return entry.splvValue;
  }

  if (axisMode === "katate") {
    return entry.katateValue;
  }

  if (axisMode === "bpm") {
    return getBpmBucketOrderValue(getBpmBucketValue(entry.bpmValue));
  }

  return entry.versionOrder;
}

export function compareVisibleSongPriority(a, b, filters) {
  if (filters.axisMode !== "title") {
    return 0;
  }

  const query = filters.titleQuery.trim();
  if (!query) {
    return 0;
  }

  const aRank = getSearchTextMatchRank(a.title, query);
  const bRank = getSearchTextMatchRank(b.title, query);
  return bRank - aRank;
}

export function getDefaultDateRangeFromRecords(records) {
  const dates = [...new Set(records.map((record) => getRecordPlayDate(record)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const today = todayIso();

  if (dates.length === 0) {
    return { dateStart: today, dateEnd: today };
  }

  const recentDates = dates.slice(-14);
  return {
    dateStart: recentDates[0],
    dateEnd: recentDates[recentDates.length - 1],
  };
}

export function deriveFilterBounds(songStates) {
  const levelValues = songStates.map((song) => song.levelValue).filter((value) => value !== null);
  const splvValues = songStates.map((song) => song.splvValue).filter((value) => value !== null);
  const katateValues = songStates.map((song) => song.katateValue).filter((value) => value !== null);
  const versionValues = new Set(songStates.map((song) => String(song.version ?? "")).filter((value) => VERSION_LABELS.has(value)));
  const uniqueLevelValues = [...new Set(levelValues)].sort((a, b) => a - b);
  const uniqueSplvValues = [...new Set(splvValues)].sort((a, b) => a - b);
  const uniqueKatateValues = [...new Set(katateValues)].sort((a, b) => a - b);
  const uniqueVersionValues = VERSION_ORDER_VALUES.filter((value) => versionValues.has(value));

  return {
    level: {
      min: levelValues.length ? Math.min(...levelValues) : 0,
      max: levelValues.length ? Math.max(...levelValues) : 15,
      step: 0.01,
      values: uniqueLevelValues,
    },
    splv: {
      min: splvValues.length ? Math.min(...splvValues) : 1,
      max: splvValues.length ? Math.max(...splvValues) : 12,
      step: 1,
      values: uniqueSplvValues,
    },
    katate: {
      min: katateValues.length ? Math.min(...katateValues) : 11,
      max: katateValues.length ? Math.max(...katateValues) : 13,
      step: 0.1,
      values: uniqueKatateValues,
    },
    version: {
      min: 0,
      max: uniqueVersionValues.length ? uniqueVersionValues.length - 1 : 0,
      step: 1,
      values: uniqueVersionValues,
    },
  };
}

export function deriveHistoryDates(songStates) {
  const dates = new Set();
  songStates.forEach((song) => {
    song.history?.forEach((record) => {
      const playDate = record?.playDate || record?.date;
      if (playDate) {
        dates.add(playDate);
      }
    });
  });

  return [...dates].sort((a, b) => a.localeCompare(b));
}

export function getDateFilterReturnBase(previousFilters, titleFilterBase) {
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

export function compareLevelValue(a, b) {
  return (a.levelValue ?? Number.POSITIVE_INFINITY) - (b.levelValue ?? Number.POSITIVE_INFINITY);
}

export function compareSplvValue(a, b) {
  return (a.splvValue ?? Number.POSITIVE_INFINITY) - (b.splvValue ?? Number.POSITIVE_INFINITY);
}

export function compareTitleValue(a, b) {
  return compareTitlesWithSuffixOrder(a.title, b.title);
}

export function createRandomSortValue(key, seed) {
  const source = `${key}:${seed}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function compareKatateValue(a, b) {
  return (a.katateValue ?? Number.POSITIVE_INFINITY) - (b.katateValue ?? Number.POSITIVE_INFINITY);
}

export function compareLatestTimestampValue(a, b) {
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

export function compareNullablePrimaryValues(aValue, bValue, compareValues, sortDirection) {
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

export function compareScoreRatePrimaryValues(a, b, valueKey, sortDirection) {
  const getScoreSortGroup = (entry) => {
    if (!entry.entryCount) {
      return 2;
    }

    return entry.scoreFilterRank === "※" ? 1 : 0;
  };
  const aGroup = getScoreSortGroup(a);
  const bGroup = getScoreSortGroup(b);

  if (aGroup !== bGroup) {
    return aGroup - bGroup;
  }

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

export function comparePrimarySortValue(
  a,
  b,
  sortMode,
  sortDirection,
  randomSeed = 1,
  chartDifficultySortHead = CHART_DIFFICULTY_OPTIONS[0],
  recommendSortHead = RECOMMEND_SORT_OPTIONS[0],
  chartDifficultySortDirection = null,
) {
  if (sortMode === "random") {
    return createRandomSortValue(getCatalogItemKey(a), randomSeed) - createRandomSortValue(getCatalogItemKey(b), randomSeed);
  }

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

  if (sortMode === "version") {
    return compareNullablePrimaryValues(a.versionOrder, b.versionOrder, (aValue, bValue) => aValue - bValue, sortDirection);
  }

  if (sortMode === "chartDifficulty") {
    const effectiveDirection = chartDifficultySortDirection ?? "asc";
    return compareChartDifficultyPrimaryValue(a.title, b.title, effectiveDirection, chartDifficultySortHead);
  }

  if (sortMode === "bpm") {
    return compareNullablePrimaryValues(a.bpmValue, b.bpmValue, (aValue, bValue) => aValue - bValue, sortDirection);
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
    return compareRecommendPrimaryValue(a.recommend, b.recommend, sortDirection, recommendSortHead);
  }

  if (sortMode === "memo") {
    return compareNullablePrimaryValues(a.note, b.note, (aValue, bValue) => String(aValue).localeCompare(String(bValue), "ja"), sortDirection);
  }

  return compareNullablePrimaryValues(a.levelValue, b.levelValue, (aValue, bValue) => aValue - bValue, sortDirection);
}

export function getRotatedChartDifficultyOrder(sortDirection, head) {
  const baseOrder = sortDirection === "desc"
    ? [...CHART_DIFFICULTY_OPTIONS].reverse()
    : [...CHART_DIFFICULTY_OPTIONS];
  const normalizedHead = normalizeChartDifficultySortHead(head);
  const headIndex = baseOrder.indexOf(normalizedHead);
  if (headIndex < 0) {
    return baseOrder;
  }

  return [...baseOrder.slice(headIndex), ...baseOrder.slice(0, headIndex)];
}

export function getChartDifficultySortRank(title, sortDirection, head) {
  const suffix = splitTitleAndSuffix(title).suffix;
  const order = getRotatedChartDifficultyOrder(sortDirection, head);
  const rank = order.indexOf(suffix);
  return rank >= 0 ? rank : Number.POSITIVE_INFINITY;
}

export function compareChartDifficultyPrimaryValue(aTitle, bTitle, sortDirection, head) {
  return getChartDifficultySortRank(aTitle, sortDirection, head) - getChartDifficultySortRank(bTitle, sortDirection, head);
}

export function getRotatedRecommendOrder(sortDirection, head) {
  const baseOrder = RECOMMEND_SORT_OPTIONS;
  const normalizedHead = normalizeRecommendSortHead(head);
  const headIndex = baseOrder.indexOf(normalizedHead);
  if (headIndex < 0) {
    return sortDirection === "desc" ? [...baseOrder].reverse() : baseOrder;
  }

  const rotatedOrder = [...baseOrder.slice(headIndex), ...baseOrder.slice(0, headIndex)];
  return sortDirection === "desc" ? [...rotatedOrder].reverse() : rotatedOrder;
}

export function compareRecommendPrimaryValue(aRecommend, bRecommend, sortDirection, head) {
  const order = getRotatedRecommendOrder(sortDirection, head);
  const aRank = order.indexOf(String(aRecommend ?? ""));
  const bRank = order.indexOf(String(bRecommend ?? ""));
  return (aRank >= 0 ? aRank : Number.POSITIVE_INFINITY)
    - (bRank >= 0 ? bRank : Number.POSITIVE_INFINITY);
}

export function compareTitlePrimaryValue(aTitle, bTitle, sortDirection) {
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

export function compareFilterAxisTieBreak(a, b, axisMode) {
  if (axisMode === "level") {
    return compareLevelValue(a, b);
  }

  if (axisMode === "splv") {
    return compareSplvValue(a, b);
  }

  if (axisMode === "katate") {
    return compareKatateValue(a, b);
  }

  if (axisMode === "version") {
    return compareNullablePrimaryValues(a.versionOrder, b.versionOrder, (aValue, bValue) => aValue - bValue, "asc");
  }

  if (axisMode === "title") {
    return compareTitleValue(a, b);
  }

  if (axisMode === "memo") {
    return compareNullablePrimaryValues(a.note, b.note, (aValue, bValue) => String(aValue).localeCompare(String(bValue), "ja"), "asc");
  }

  if (axisMode === "date") {
    return compareNullablePrimaryValues(a.latestDate, b.latestDate, (aValue, bValue) => String(aValue).localeCompare(String(bValue)), "asc");
  }

  return 0;
}

export function hasPrimarySortDifference(
  songs,
  sortMode,
  chartDifficultySortHead = CHART_DIFFICULTY_OPTIONS[0],
  recommendSortHead = RECOMMEND_SORT_OPTIONS[0],
) {
  if (songs.length <= 1) {
    return false;
  }

  const first = songs[0];

  return songs.some((song) => (
    comparePrimarySortValue(first, song, sortMode, "asc", 1, chartDifficultySortHead, recommendSortHead) !== 0
  ));
}

export function applySortDirectionFallbackIfNoPrimaryEffect(
  songs,
  sortMode,
  sortDirection,
  chartDifficultySortHead = CHART_DIFFICULTY_OPTIONS[0],
  recommendSortHead = RECOMMEND_SORT_OPTIONS[0],
) {
  if (sortMode === "chartDifficulty" || sortMode === "recommend") {
    return songs;
  }

  if (sortDirection !== "desc" || songs.length <= 1) {
    return songs;
  }

  if (hasPrimarySortDifference(songs, sortMode, chartDifficultySortHead, recommendSortHead)) {
    return songs;
  }

  return [...songs].reverse();
}

export function compareCatalogSongs(
  a,
  b,
  sortMode,
  sortDirection,
  axisMode,
  randomSeed = 1,
  chartDifficultySortHead = CHART_DIFFICULTY_OPTIONS[0],
  recommendSortHead = RECOMMEND_SORT_OPTIONS[0],
  chartDifficultySortDirection = null,
) {
  return comparePrimarySortValue(a, b, sortMode, sortDirection, randomSeed, chartDifficultySortHead, recommendSortHead, chartDifficultySortDirection)
    || compareFilterAxisTieBreak(a, b, axisMode)
    || compareSplvValue(a, b)
    || compareTitleValue(a, b);
}

export function getCatalogItemKey(entry) {
  return entry?.catalogItemKey || `title:${entry?.title ?? ""}`;
}

export function createRecordScopedCatalogItem(songState, record, getScoreRankInfo) {
  const recordLamp = LAMP_OPTIONS.includes(record?.lamp) ? record.lamp : "NO PLAY";
  const recordScoreRank = getScoreRankInfo(record.score, songState);
  const fullBestScore = songState.history.reduce((best, historyRecord) => (
    historyRecord.score === null || historyRecord.score === undefined ? best : Math.max(best, historyRecord.score)
  ), Number.NEGATIVE_INFINITY);
  const bestScore = Number.isFinite(fullBestScore) ? fullBestScore : null;
  const bestScoreRank = getScoreRankInfo(bestScore, songState);

  return {
    ...songState,
    catalogItemKey: `record:${record.id}`,
    isRecordScopedCard: true,
    latestDate: getRecordPlayDate(record),
    latestTimestamp: normalizeRecordTimestamp(record.timestamp, record.date),
    latestLamp: recordLamp,
    bestLamp: recordLamp,
    currentBp: Number.isFinite(record.bp) ? record.bp : null,
    bestScore,
    bestScoreRate: bestScoreRank.rate,
    bestScoreLabel: bestScoreRank.display,
    scoreRank: bestScoreRank.label,
    scoreFilterRank: bestScoreRank.label === "MAX" ? "AAA" : bestScoreRank.label,
    cardScoreFilterRank: recordScoreRank.label === "MAX" ? "AAA" : recordScoreRank.label,
    currentScore: Number.isFinite(record.score) ? record.score : null,
    currentScoreRate: recordScoreRank.rate,
    currentScoreLabel: recordScoreRank.display,
  };
}
