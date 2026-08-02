const MODULE_VERSION = new URL(import.meta.url).search;

const { LAMP_OPTIONS } = await import(`../../constants.js${MODULE_VERSION}`);
const { formatIsoDate, todayIso } = await import(`../../utils/date.js${MODULE_VERSION}`);

const LAMP_COLORS = {
  "NO PLAY": "var(--lamp-no-play)",
  FAILED: "var(--lamp-failed)",
  ASSIST: "var(--lamp-assist)",
  EASY: "var(--lamp-easy)",
  CLEAR: "var(--lamp-clear)",
  HARD: "var(--lamp-hard)",
  EXH: "var(--lamp-exh)",
  FC: "var(--lamp-fc)",
};
const SCORE_RANK_COLORS = {
  MAX: "var(--lamp-fc)",
  AAA: "var(--lamp-fc)",
  AA: "var(--lamp-exh)",
  A: "var(--lamp-hard)",
  B: "var(--lamp-clear)",
  C: "var(--lamp-easy)",
  D: "var(--lamp-assist)",
  E: "var(--lamp-failed)",
  F: "var(--lamp-no-play)",
  "※": "var(--lamp-no-play)",
};
const CHART_DIFFICULTY_OPTIONS = ["B", "N", "H", "A", "L"];
const SCORE_RANK_OPTIONS = ["AAA", "AA", "A", "B", "C", "D", "E", "F", "※"];
const SCORE_RANK_SUMMARY_OPTIONS = ["AAA", "AA", "A", "B", "C", "D", "E", "F"];
const SCORE_RANK_FILTER_OPTIONS = ["F", "E", "D", "C", "B", "A", "AA", "AAA"];
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

const getLampColor = (lamp) => LAMP_COLORS[lamp] ?? "transparent";
const getScoreRankColor = (rank) => SCORE_RANK_COLORS[rank] ?? "transparent";
const getSummaryBandLampColor = (lamp) => getLampColor(lamp);
const getScoreRankSummaryLabel = (rank) => rank === "F" ? "F/※" : rank;

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

function isAxisRangeMode(filters) {
  return isNumericAxisMode(filters.axisMode)
    && (isRangeOnlyAxisMode(filters.axisMode) || Boolean(filters.axisRangeModeByAxis?.[filters.axisMode]));
}

function formatKatateFilterValue(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "";
  }

  if (numberValue === 13) {
    return "12-10";
  }

  return numberValue.toFixed(1).replace(".", "-");
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

function getActiveChartDifficultiesForSummary(filters) {
  const chartDifficulties = filters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS;

  if (filters.axisMode !== "version") {
    return chartDifficulties;
  }

  const versionChartDifficulties = filters.versionChartDifficulties ?? CHART_DIFFICULTY_OPTIONS;
  return chartDifficulties.filter((option) => versionChartDifficulties.includes(option));
}

function getSummaryChartDifficultyOptions(filters) {
  return filters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS;
}

function formatChartDifficultySelection(values) {
  const selected = Array.isArray(values) ? values : CHART_DIFFICULTY_OPTIONS;
  const ordered = CHART_DIFFICULTY_OPTIONS.filter((option) => selected.includes(option));
  return ordered.length ? ordered.join("/") : "-";
}

function summarizeSummaryFilterCaption(filters, bounds) {
  if (filters.axisMode !== "version") {
    return summarizeAxisFilter(filters, bounds);
  }

  const versionLabel = isAxisRangeMode(filters)
    ? formatAxisRangeValue(filters.axisMode, getNormalizedAxisRange(filters, getAxisRangeValues(bounds, filters.axisMode)))
    : formatAxisValue(filters.axisMode, filters.axisValue);

  const selectedChartDifficulties = getActiveChartDifficultiesForSummary(filters);
  const visibleChartDifficulties = getSummaryChartDifficultyOptions(filters);
  if (visibleChartDifficulties.length > 0 && selectedChartDifficulties.length === visibleChartDifficulties.length) {
    return versionLabel;
  }

  return `${versionLabel} (${formatChartDifficultySelection(selectedChartDifficulties)})`;
}

function createSummaryChartDifficultyFilter(filters) {
  if (filters.axisMode !== "version") {
    return null;
  }

  const selectedChartDifficulties = getActiveChartDifficultiesForSummary(filters);
  const visibleChartDifficulties = getSummaryChartDifficultyOptions(filters);
  const filter = document.createElement("div");
  filter.className = "summary-chart-difficulty-filter";
  const label = document.createElement("span");
  label.className = "recommend-label";
  label.textContent = "譜面難易度";
  const options = document.createElement("div");
  options.className = "recommend-options";
  visibleChartDifficulties.forEach((option) => {
    const chip = document.createElement("label");
    chip.className = "recommend-chip summary-chart-difficulty-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.summaryChartDifficulty = option;
    input.value = option;
    input.checked = selectedChartDifficulties.includes(option);
    const text = document.createElement("span");
    text.textContent = option;
    chip.append(input, text);
    options.appendChild(chip);
  });
  filter.append(label, options);
  return filter;
}

function formatPercent(value, total) {
  if (total === 0) {
    return "0.0%";
  }
  return `${((value / total) * 100).toFixed(1)}%`;
}

function createSummaryBands(summary) {
  if (!summary.bands.length) {
    const empty = document.createElement("div");
    empty.className = "summary-chart-empty empty-state";
    empty.textContent = summary.emptyMessage ?? "難易度表が読み込まれていません。";
    return empty;
  }

  const wrap = document.createElement("div");
  wrap.className = "summary-chart-wrap";

  const heading = document.createElement("div");
  heading.className = "summary-chart-heading";
  const totalLabel = document.createElement("span");
  totalLabel.textContent = summary.totalLabel ?? "総曲数";
  const total = document.createElement("strong");
  total.textContent = `${summary.bandTotalSongs ?? summary.totalSongs} ${summary.totalUnit ?? "曲"}`;
  heading.append(totalLabel, total);

  const chart = document.createElement("div");
  chart.className = "summary-band-chart";
  if (summary.bands.length >= 1000) {
    chart.classList.add("is-scrollable");
  }

  summary.bands.forEach((band) => {
    const categoryOptions = summary.displayMode === "score" ? SCORE_RANK_SUMMARY_OPTIONS : LAMP_OPTIONS;
    const segmentOrder = summary.displayMode === "score" ? categoryOptions : [...categoryOptions].reverse();
    const emptyKey = summary.displayMode === "score" ? "F" : "NO PLAY";
    const getColor = summary.displayMode === "score" ? getScoreRankColor : getSummaryBandLampColor;

    const row = document.createElement("div");
    row.className = "summary-band-row";
    const label = document.createElement("div");
    label.className = "summary-band-label";
    label.textContent = band.label;
    const track = document.createElement("div");
    track.className = "summary-band-track";
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${band.label} のクリアランプ内訳`);

    (band.total === 0 ? [emptyKey] : segmentOrder).forEach((key) => {
      const count = band.lampCounts[key] ?? 0;
      if (count <= 0 && band.total !== 0) {
        return;
      }

      const flexGrow = band.total === 0 ? 1 : count;
      const segment = document.createElement("span");
      segment.className = "summary-band-segment";
      segment.style.flex = `${flexGrow} 1 0px`;
      segment.style.background = getColor(key);
      segment.setAttribute("aria-hidden", "true");
      track.appendChild(segment);
    });

    const bandTotal = document.createElement("div");
    bandTotal.className = "summary-band-total";
    bandTotal.textContent = String(band.total);
    row.append(label, track, bandTotal);
    chart.appendChild(row);
  });

  wrap.append(heading, chart);
  return wrap;
}

export function renderSummary(summaryContainer, summary, filters, bounds, activeFilters = filters) {
  const lampFilterDisabled = isTextAxisMode(activeFilters.axisMode);
  const isScoreMode = summary.displayMode === "score";
  const legendOptions = isScoreMode ? SCORE_RANK_FILTER_OPTIONS : LAMP_OPTIONS;
  const selectedValues = isScoreMode
    ? (filters.scoreRanks ?? SCORE_RANK_OPTIONS)
    : filters.lamps;
  const getLegendColor = isScoreMode ? getScoreRankColor : getLampColor;

  summaryContainer.replaceChildren();

  const panel = document.createElement("div");
  panel.className = "summary-panel";
  panel.appendChild(createSummaryBands(summary));

  const chartDifficultyFilter = createSummaryChartDifficultyFilter(filters);
  if (chartDifficultyFilter) {
    panel.appendChild(chartDifficultyFilter);
  }

  const summaryFilterCaption = summarizeSummaryFilterCaption(filters, bounds);
  const caption = document.createElement("div");
  caption.className = "summary-filter-caption";
  caption.textContent = summaryFilterCaption;
  panel.appendChild(caption);

  const legend = document.createElement("div");
  legend.className = "summary-legend";
  legendOptions.forEach((lamp) => {
    const isActive = isScoreMode && lamp === "F"
      ? selectedValues.includes("F") || selectedValues.includes("※")
      : selectedValues.includes(lamp);
    const label = isScoreMode ? getScoreRankSummaryLabel(lamp) : lamp;

    const button = document.createElement("button");
    button.className = `summary-lamp-item ${isActive ? "is-active" : "is-inactive"}`;
    button.type = "button";
    button.dataset.summaryLamp = lamp;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    if (lampFilterDisabled) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    }

    const main = document.createElement("div");
    main.className = "summary-lamp-main";
    const dot = document.createElement("span");
    dot.className = "summary-lamp-dot";
    dot.style.background = getLegendColor(lamp);
    const labelNode = document.createElement("span");
    labelNode.className = "summary-lamp-label";
    labelNode.textContent = label;
    main.append(dot, labelNode);

    const values = document.createElement("div");
    values.className = "summary-lamp-values";
    const count = summary.lampCounts[lamp] ?? 0;
    const strong = document.createElement("strong");
    strong.textContent = String(count);
    const percent = document.createElement("span");
    percent.textContent = formatPercent(count, summary.totalSongs);
    values.append(strong, percent);

    button.append(main, values);
    legend.appendChild(button);
  });
  panel.appendChild(legend);
  summaryContainer.appendChild(panel);
}
