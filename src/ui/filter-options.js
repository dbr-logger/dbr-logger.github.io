const MODULE_VERSION = new URL(import.meta.url).search;

const { formatIsoDate, todayIso } = await import(`../utils/date.js${MODULE_VERSION}`);
const { escapeHtml } = await import(`../utils/html.js${MODULE_VERSION}`);

const RECOMMEND_OPTIONS = [
  { value: "", label: "－" },
  { value: "△", label: "△" },
  { value: "○", label: "○" },
  { value: "◎", label: "◎" },
  { value: "☆", label: "☆" },
];
const RECOMMEND_SORT_VALUES = ["☆", "◎", "○", "△", ""];
const CHART_DIFFICULTY_OPTIONS = ["B", "N", "H", "A", "L"];
const CHART_SUFFIX_ORDER = new Map([
  ["B", 0],
  ["N", 1],
  ["H", 2],
  ["A", 3],
  ["L", 4],
]);
const DISPLAY_MODE_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "clear", label: "クリア" },
  { value: "score", label: "スコア" },
];
const SUMMARY_DISPLAY_MODE_OPTIONS = [
  { value: "clear", label: "クリア" },
  { value: "score", label: "スコア" },
];
const CATALOG_SORT_OPTIONS = [
  { value: "title", label: "曲名", modes: ["all", "clear", "score"] },
  { value: "version", label: "バージョン", modes: ["all", "clear", "score"] },
  { value: "chartDifficulty", label: "譜面難易度", modes: ["all", "clear", "score"] },
  { value: "splv", label: "SPLv.", modes: ["all", "clear", "score"] },
  { value: "level", label: "DBRLv.", modes: ["all", "clear", "score"] },
  { value: "katate", label: "片手Lv.", modes: ["all", "clear", "score"] },
  { value: "bpm", label: "BPM", modes: ["all", "clear", "score"] },
  { value: "recommend", label: "おすすめ度", modes: ["all", "clear", "score"] },
  { value: "clear", label: "クリアランプ", modes: ["all", "clear", "score"] },
  { value: "bestBp", label: "最小BP", modes: ["all", "clear"] },
  { value: "latestBp", label: "最新BP", modes: ["all", "clear"] },
  { value: "bestScore", label: "最高スコア", modes: ["all", "score"] },
  { value: "latestScore", label: "最新スコア", modes: ["all", "score"] },
  { value: "latest", label: "最終プレー", modes: ["all", "clear", "score"] },
  { value: "entryCount", label: "プレー回数", modes: ["all", "clear", "score"] },
  { value: "memo", label: "メモ", modes: ["all", "clear", "score"] },
  { value: "random", label: "ランダム", modes: ["all", "clear", "score"] },
];
const SCORE_RANK_OPTIONS = ["AAA", "AA", "A", "B", "C", "D", "E", "F", "※"];
const SCORE_RANK_SUMMARY_OPTIONS = ["AAA", "AA", "A", "B", "C", "D", "E", "F"];
const SCORE_RANK_FILTER_OPTIONS = ["F", "E", "D", "C", "B", "A", "AA", "AAA"];
const SONG_DATA_FILTER_OPTIONS = [
  { value: "all", label: "すべて", inf: "all", acdelete: "all" },
  { value: "ac", label: "AC", inf: "all", acdelete: "no" },
  { value: "infinitas", label: "INFINITAS", inf: "yes", acdelete: "all" },
  { value: "acOnly", label: "AC限定", inf: "no", acdelete: "no" },
  { value: "infinitasOnly", label: "INFINITAS限定", inf: "yes", acdelete: "yes" },
  { value: "csDeleted", label: "CS限定/削除曲のみ", inf: "no", acdelete: "yes" },
];
const SUMMARY_LAMP_DOUBLE_CLICK_MS = 220;
const SUMMARY_LAMP_SWIPE_SOLO_THRESHOLD = 40;
const AXIS_OPTIONS = [
  { value: "splv", label: "SPLv." },
  { value: "level", label: "DBRLv." },
  { value: "katate", label: "片手Lv." },
  { value: "version", label: "バージョン" },
  { value: "bpm", label: "BPM" },
  { value: "date", label: "プレー日" },
  { value: "title", label: "曲名" },
  { value: "memo", label: "メモ" },
];
const AXIS_SHORTCUT_KEYS = {
  f: "level",
  w: "splv",
  e: "katate",
  v: "version",
  b: "bpm",
  r: "date",
  s: "title",
  t: "memo",
};
const HIDDEN_FLOATING_CLEAR_AXES = new Set(["level", "splv", "katate", "version", "bpm", "date"]);
const RANGE_ONLY_AXIS_MODES = new Set();
const BPM_BUCKETS = [
  { value: "lt120", label: "min-119" },
  ...Array.from({ length: 10 }, (_, index) => {
    const bpm = 120 + index * 10;
    return { value: String(bpm), label: `${bpm}-${bpm + 9}` };
  }),
  { value: "220", label: "220-249" },
  { value: "250", label: "250-max" },
];
const BPM_RANGE_POINTS = [
  { value: "min", startLabel: "min", endLabel: "min" },
  ...Array.from({ length: 11 }, (_, index) => {
    const bpm = 120 + index * 10;
    return { value: String(bpm), startLabel: String(bpm), endLabel: String(bpm - 1) };
  }),
  { value: "250", startLabel: "250", endLabel: "249" },
  { value: "max", startLabel: "max", endLabel: "max" },
];
const VERSION_ORDER_VALUES = ["0", "1", "s", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34"];
const VERSION_LABELS = new Map([
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

function isTextAxisMode(axisMode) {
  return axisMode === "title" || axisMode === "memo";
}

function isDateAxisMode(axisMode) {
  return axisMode === "date";
}

function isNumericAxisMode(axisMode) {
  return axisMode === "level" || axisMode === "splv" || axisMode === "katate" || axisMode === "version" || axisMode === "bpm";
}

function isRangeOnlyAxisMode(axisMode) {
  return RANGE_ONLY_AXIS_MODES.has(axisMode);
}

function getSongDataFilterOption(value) {
  return SONG_DATA_FILTER_OPTIONS.find((option) => option.value === value)
    ?? SONG_DATA_FILTER_OPTIONS[0];
}

function parseKatateFilterValue(rawValue) {
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) {
    return Number.NaN;
  }

  if (normalized === "12.10") {
    return 13;
  }

  return Number(normalized);
}

function formatKatateFilterValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "";
  }

  if (numericValue === 13) {
    return "12-10";
  }

  return numericValue.toFixed(1).replace(".", "-");
}

function getAxisLabel(axisMode) {
  return AXIS_OPTIONS.find((option) => option.value === axisMode)?.label ?? "DBRLv.";
}

function getAxisValues(bounds, axisMode) {
  if (axisMode === "level") {
    return bounds.level.values ?? [];
  }

  if (axisMode === "splv") {
    return bounds.splv.values ?? [];
  }

  if (axisMode === "katate") {
    return bounds.katate.values ?? [];
  }

  if (axisMode === "version") {
    return bounds.version.values ?? [];
  }

  if (axisMode === "bpm") {
    return BPM_BUCKETS.map((bucket) => bucket.value);
  }

  return [];
}

function getAxisRangeValues(bounds, axisMode) {
  if (axisMode === "bpm") {
    return BPM_RANGE_POINTS.map((point) => point.value);
  }

  return getAxisValues(bounds, axisMode);
}

function getBpmBucket(value) {
  return BPM_BUCKETS.find((bucket) => bucket.value === String(value));
}

function getBpmRangePoint(value) {
  return BPM_RANGE_POINTS.find((point) => point.value === String(value));
}

function formatBpmRangeValue(range) {
  const startLabel = getBpmRangePoint(range.start)?.startLabel ?? String(range.start ?? "");
  const endLabel = getBpmRangePoint(range.end)?.endLabel ?? String(range.end ?? "");
  return `${startLabel} ～ ${endLabel}`;
}

function formatAxisValue(axisMode, value) {
  if (value === "" || value === null || value === undefined) {
    return "ALL";
  }

  if (axisMode === "level") {
    return `☆${Number(value).toFixed(2)}`;
  }

  if (axisMode === "splv") {
    return `☆${value}`;
  }

  if (axisMode === "katate") {
    return `☆${formatKatateFilterValue(value)}`;
  }

  if (axisMode === "version") {
    return VERSION_LABELS.get(String(value)) ?? String(value);
  }

  if (axisMode === "bpm") {
    return getBpmBucket(value)?.label ?? String(value);
  }

  return String(value);
}

function formatDateRangeValue(filters) {
  if (filters.dateSelectionMode === "single") {
    return formatIsoDate(filters.dateSingle || todayIso());
  }

  if (!filters.dateStart && !filters.dateEnd) {
    return "ALL";
  }

  if (filters.dateStart && filters.dateEnd) {
    return `${formatIsoDate(filters.dateStart)} ～ ${formatIsoDate(filters.dateEnd)}`;
  }

  if (filters.dateStart) {
    return `${formatIsoDate(filters.dateStart)} ～`;
  }

  return `～ ${formatIsoDate(filters.dateEnd)}`;
}

function isAxisRangeMode(filters) {
  return isNumericAxisMode(filters.axisMode)
    && (isRangeOnlyAxisMode(filters.axisMode) || Boolean(filters.axisRangeModeByAxis?.[filters.axisMode]));
}

function hasAxisCandidate(axisValues, value) {
  if (value === "" || value === null || value === undefined) {
    return false;
  }

  return axisValues.some((candidate) => String(candidate) === String(value));
}

function getAxisRangeMinGap(axisMode) {
  return axisMode === "bpm" ? 1 : 0;
}

function getNormalizedAxisRange(filters, axisValues) {
  const axisMode = filters.axisMode;
  const range = filters.axisRanges?.[axisMode] ?? { start: "", end: "" };
  const startValue = String(range.start ?? "");
  const endValue = String(range.end ?? "");

  if (!axisValues.length) {
    return { start: "", end: "", startIndex: 0, endIndex: 0, valid: false };
  }

  const startIndex = axisValues.findIndex((value) => String(value) === startValue);
  const endIndex = axisValues.findIndex((value) => String(value) === endValue);
  if (startIndex >= 0 && endIndex >= 0 && startIndex + getAxisRangeMinGap(axisMode) <= endIndex) {
    return { start: startValue, end: endValue, startIndex, endIndex, valid: true };
  }

  const fallbackStart = String(axisValues[0]);
  const fallbackEnd = String(axisValues[axisValues.length - 1]);
  return {
    start: fallbackStart,
    end: fallbackEnd,
    startIndex: 0,
    endIndex: axisValues.length - 1,
    valid: true,
  };
}

function formatAxisRangeValue(axisMode, range) {
  if (axisMode === "bpm") {
    return formatBpmRangeValue(range);
  }

  return `${formatAxisValue(axisMode, range.start)} ～ ${formatAxisValue(axisMode, range.end)}`;
}

function getHistoryDateNeighbor(historyDates, isoDate, delta) {
  if (!Array.isArray(historyDates) || !historyDates.length) {
    return "";
  }

  const base = String(isoDate || todayIso());
  return delta < 0
    ? [...historyDates].reverse().find((date) => date < base) ?? ""
    : historyDates.find((date) => date > base) ?? "";
}

function summarizeAxisFilter(filters, bounds) {
  if (isTextAxisMode(filters.axisMode)) {
    return filters.titleQuery.trim()
      ? `${getAxisLabel(filters.axisMode)} ${filters.titleQuery.trim()}`
      : `${getAxisLabel(filters.axisMode)} ALL`;
  }

  if (isDateAxisMode(filters.axisMode)) {
    return formatDateRangeValue(filters);
  }

  if (filters.axisMode === "version") {
    return isAxisRangeMode(filters)
      ? formatAxisRangeValue(filters.axisMode, getNormalizedAxisRange(filters, getAxisRangeValues(bounds, filters.axisMode)))
      : formatAxisValue(filters.axisMode, filters.axisValue);
  }

  if (isAxisRangeMode(filters)) {
    return `${getAxisLabel(filters.axisMode)} ${formatAxisRangeValue(filters.axisMode, getNormalizedAxisRange(filters, getAxisRangeValues(bounds, filters.axisMode)))}`;
  }

  return `${getAxisLabel(filters.axisMode)} ${formatAxisValue(filters.axisMode, filters.axisValue)}`;
}

function getEffectiveSummaryDisplayMode(filters) {
  if (filters.displayMode === "clear" || filters.displayMode === "score") {
    return filters.displayMode;
  }

  return filters.summaryDisplayMode === "score" ? "score" : "clear";
}

function findClosestValue(values, rawValue, fallbackValue) {
  if (!values.length) {
    return fallbackValue;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  return values.reduce((closest, candidate) => (
    Math.abs(candidate - numericValue) < Math.abs(closest - numericValue) ? candidate : closest
  ), values[0]);
}

function findValueIndex(values, rawValue, fallbackIndex = 0) {
  if (!values.length) {
    return 0;
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return fallbackIndex;
  }

  const exactIndex = values.findIndex((value) => value === numericValue);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const nearest = findClosestValue(values, numericValue, values[Math.max(0, Math.min(fallbackIndex, values.length - 1))]);
  return values.indexOf(nearest);
}

export {
  RECOMMEND_OPTIONS,
  RECOMMEND_SORT_VALUES,
  CHART_DIFFICULTY_OPTIONS,
  CHART_SUFFIX_ORDER,
  DISPLAY_MODE_OPTIONS,
  SUMMARY_DISPLAY_MODE_OPTIONS,
  CATALOG_SORT_OPTIONS,
  SCORE_RANK_OPTIONS,
  SCORE_RANK_SUMMARY_OPTIONS,
  SCORE_RANK_FILTER_OPTIONS,
  SONG_DATA_FILTER_OPTIONS,
  SUMMARY_LAMP_DOUBLE_CLICK_MS,
  SUMMARY_LAMP_SWIPE_SOLO_THRESHOLD,
  AXIS_OPTIONS,
  AXIS_SHORTCUT_KEYS,
  HIDDEN_FLOATING_CLEAR_AXES,
  BPM_BUCKETS,
  BPM_RANGE_POINTS,
  VERSION_ORDER_VALUES,
  VERSION_LABELS,
  isTextAxisMode,
  isDateAxisMode,
  isNumericAxisMode,
  isRangeOnlyAxisMode,
  getSongDataFilterOption,
  parseKatateFilterValue,
  formatKatateFilterValue,
  getAxisLabel,
  getAxisValues,
  getAxisRangeValues,
  getBpmBucket,
  getBpmRangePoint,
  formatBpmRangeValue,
  formatAxisValue,
  formatDateRangeValue,
  isAxisRangeMode,
  hasAxisCandidate,
  getAxisRangeMinGap,
  getNormalizedAxisRange,
  formatAxisRangeValue,
  getHistoryDateNeighbor,
  summarizeAxisFilter,
  getEffectiveSummaryDisplayMode,
  findClosestValue,
  findValueIndex
};
