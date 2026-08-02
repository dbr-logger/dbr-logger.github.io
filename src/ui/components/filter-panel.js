const MODULE_VERSION = new URL(import.meta.url).search;

const { formatIsoDate, todayIso } = await import(`../../utils/date.js${MODULE_VERSION}`);
const { escapeHtml } = await import(`../../utils/html.js${MODULE_VERSION}`);

const RECOMMEND_OPTIONS = [
  { value: "", label: "－" },
  { value: "△", label: "△" },
  { value: "○", label: "○" },
  { value: "◎", label: "◎" },
  { value: "☆", label: "☆" },
];
const CHART_DIFFICULTY_OPTIONS = ["B", "N", "H", "A", "L"];
const DISPLAY_MODE_OPTIONS = [
  { value: "all", label: "すべて" },
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
const SONG_DATA_FILTER_OPTIONS = [
  { value: "all", label: "すべて", inf: "all", acdelete: "all" },
  { value: "ac", label: "AC", inf: "all", acdelete: "no" },
  { value: "infinitas", label: "INFINITAS", inf: "yes", acdelete: "all" },
  { value: "acOnly", label: "AC限定", inf: "no", acdelete: "no" },
  { value: "infinitasOnly", label: "INFINITAS限定", inf: "yes", acdelete: "yes" },
  { value: "csDeleted", label: "CS限定/削除曲のみ", inf: "no", acdelete: "yes" },
];
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

function getSongDataFilterValue(filters) {
  const match = SONG_DATA_FILTER_OPTIONS.find((option) => option.inf === filters.inf && option.acdelete === filters.acdelete);
  return match?.value ?? "all";
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

function updateSliderFill(slider) {
  if (!(slider instanceof HTMLInputElement) || slider.type !== "range") {
    return;
  }

  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const value = Number(slider.value || min);
  const ratio = max <= min ? 0 : (value - min) / (max - min);
  const percent = Math.max(0, Math.min(ratio, 1)) * 100;
  slider.style.setProperty("--slider-fill", `${percent}%`);
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

function shouldShowFloatingClear(filters) {
  if (HIDDEN_FLOATING_CLEAR_AXES.has(filters.axisMode)) {
    return false;
  }

  if (isTextAxisMode(filters.axisMode)) {
    return true;
  }

  if (isDateAxisMode(filters.axisMode)) {
    return Boolean(filters.dateStart || filters.dateEnd);
  }

  return filters.axisValue !== "";
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

function getFloatingToggleLabel(filters, bounds) {
  if (isDateAxisMode(filters.axisMode)) {
    return `絞り込み: ${formatDateRangeValue(filters)}`;
  }

  return `絞り込み: ${summarizeAxisFilter(filters, bounds)}`;
}

function isDefaultDateRange(filters, dateDefaultRange) {
  if (filters.dateSelectionMode === "single") {
    return (filters.dateSingle || todayIso()) === (dateDefaultRange?.dateEnd || todayIso());
  }

  return filters.dateStart === dateDefaultRange?.dateStart && filters.dateEnd === dateDefaultRange?.dateEnd;
}

export function renderDifficultyFilters(container, filters) {
  const fixedFilterDisabled = {
    songData: filters.axisMode === "date",
    includeUnrated: filters.axisMode === "date" || isTextAxisMode(filters.axisMode),
    recommend: filters.axisMode === "date" || isTextAxisMode(filters.axisMode),
    chartDifficulty: filters.axisMode === "date",
  };
  const selectedSongDataFilter = getSongDataFilterValue(filters);
  const displayModeOptions = DISPLAY_MODE_OPTIONS.map((option) => `
    <option value="${escapeHtml(option.value)}" ${filters.displayMode === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
  `).join("");
  const songDataOptions = SONG_DATA_FILTER_OPTIONS.map((option) => `
    <option value="${escapeHtml(option.value)}" ${selectedSongDataFilter === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
  `).join("");
  const chartDifficultyMarkup = CHART_DIFFICULTY_OPTIONS.map((option) => {
    const selectedChartDifficulties = filters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS;
    const checked = selectedChartDifficulties.includes(option) ? "checked" : "";
    return `
      <label class="recommend-chip ${fixedFilterDisabled.chartDifficulty ? "is-disabled" : ""}">
        <input type="checkbox" data-filter="chartDifficulty" value="${escapeHtml(option)}" ${checked} ${fixedFilterDisabled.chartDifficulty ? "disabled" : ""} />
        <span>${escapeHtml(option)}</span>
      </label>
    `;
  }).join("");

  container.innerHTML = `
    <div class="filters-grid">
      <div class="field-stack">
        <div class="field">
          <span>表示項目</span>
          <div class="field-select overview-select-wrap">
            <select data-filter="displayMode">
              ${displayModeOptions}
            </select>
          </div>
        </div>
        <div class="field">
          <span>曲データ</span>
          <div class="field-select overview-select-wrap">
            <select data-filter="songData" ${fixedFilterDisabled.songData ? "disabled" : ""}>
              ${songDataOptions}
            </select>
          </div>
        </div>
        <div class="field">
          <span>未査定曲</span>
          <div class="field-select overview-select-wrap">
            <select data-filter="includeUnrated" ${fixedFilterDisabled.includeUnrated ? "disabled" : ""}>
              <option value="all" ${filters.includeUnrated === "all" ? "selected" : ""}>すべて</option>
              <option value="rated" ${filters.includeUnrated === "rated" ? "selected" : ""}>査定済み</option>
              <option value="unrated" ${filters.includeUnrated === "unrated" ? "selected" : ""}>未査定のみ</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    <div class="filters-footer">
      <div class="recommend-group chart-difficulty-group ${fixedFilterDisabled.chartDifficulty ? "is-disabled" : ""}">
        <span class="recommend-label">譜面難易度</span>
        <div class="recommend-options">
          ${chartDifficultyMarkup}
        </div>
      </div>
      <!-- <div class="filters-meta">
        <button class="button button-tertiary" type="button" data-filter-action="reset">リセット</button>
      </div> -->
    </div>
  `;
}

export function renderCatalogSortOptions(select, displayMode, sortMode) {
  const mode = displayMode === "all" || displayMode === "score" ? displayMode : "clear";
  const options = CATALOG_SORT_OPTIONS.filter((option) => option.modes.includes(mode));

  select.replaceChildren();
  const fragment = document.createDocumentFragment();
  options.forEach((option) => {
    const optionNode = document.createElement("option");
    optionNode.value = option.value;
    optionNode.selected = option.value === sortMode;
    optionNode.textContent = option.label;
    fragment.appendChild(optionNode);
  });
  select.appendChild(fragment);
  select.value = options.some((option) => option.value === sortMode)
    ? sortMode
    : options[0]?.value ?? "splv";
}

export function renderFloatingAxisFilter(container, filters, bounds, isOpen, previewState = null, dateDefaultRange = null) {
  const axisValues = getAxisValues(bounds, filters.axisMode);
  const rangeAxisValues = getAxisRangeValues(bounds, filters.axisMode);
  const sliderStops = ["", ...axisValues];
  const previewValue = previewState?.mode === filters.axisMode ? previewState.value : null;
  const previewRange = previewState?.rangeMode === filters.axisMode ? previewState.range : null;
  const rangeMode = isAxisRangeMode(filters);
  const effectiveAxisValue = previewValue !== null ? previewValue : filters.axisValue;
  const sliderValueIndex = Math.max(0, sliderStops.findIndex((value) => String(value) === String(effectiveAxisValue)));
  const effectiveRange = previewRange ?? getNormalizedAxisRange(filters, rangeAxisValues);
  const currentAxisValue = isTextAxisMode(filters.axisMode)
    ? filters.titleQuery
    : formatAxisValue(filters.axisMode, effectiveAxisValue);
  const rangeToggleMarkup = isNumericAxisMode(filters.axisMode) && !isRangeOnlyAxisMode(filters.axisMode)
    ? `<button class="floating-filter-inline-action" type="button" data-axis-range-toggle>${rangeMode ? "単一選択" : "範囲選択"}</button>`
    : "";

  const searchLabel = filters.axisMode === "memo" ? "メモ検索" : "曲名検索";
  const searchPlaceholder = filters.axisMode === "memo" ? "メモの一部を入力" : "曲名の一部を入力";
  const dateRangeResetMarkup = !isDefaultDateRange(filters, dateDefaultRange)
    ? '<button class="floating-filter-inline-action" type="button" data-date-reset>戻す</button>'
    : "";
  const dateModeToggleMarkup = isDateAxisMode(filters.axisMode)
    ? `<button class="floating-filter-inline-action" type="button" data-date-mode-toggle>${filters.dateSelectionMode === "single" ? "範囲選択" : "単一選択"}</button>`
    : "";

  const controlMarkup = isDateAxisMode(filters.axisMode)
    ? `
      <div class="floating-filter-date-block">
        <div class="floating-filter-date-summary">
          <span data-floating-display-value></span>
          ${dateRangeResetMarkup}
          ${dateModeToggleMarkup}
        </div>
        ${filters.dateSelectionMode === "single" ? `
          <div class="field floating-filter-date-field">
            <span class="input-field">
              <input class="form-date" type="date" data-date-single />
            </span>
          </div>
        ` : `
          <div class="floating-filter-date-grid">
          <div class="field floating-filter-date-field">
            <span>開始日</span>
            <span class="input-field">
              <input class="form-date" type="date" data-date-start />
            </span>
          </div>
          <div class="field floating-filter-date-field">
            <span>終了日</span>
            <span class="input-field">
              <input class="form-date" type="date" data-date-end />
            </span>
          </div>
          </div>
        `}
      </div>
    `
    : isTextAxisMode(filters.axisMode)
    ? `
      <div class="field floating-filter-search">
        <span data-floating-search-label></span>
        <input type="search" data-axis-query />
      </div>
    `
    : rangeMode
    ? `
      <div class="floating-filter-slider-block">
        <div class="floating-filter-value">
          <span data-floating-display-value></span>
          ${rangeToggleMarkup}
        </div>
        <div
          class="floating-filter-range-wrap is-start-active"
          data-range-max="${Math.max(rangeAxisValues.length - 1, 1)}"
          style="--range-start:${rangeAxisValues.length ? (effectiveRange.startIndex / Math.max(rangeAxisValues.length - 1, 1)) * 100 : 0}%;--range-end:${rangeAxisValues.length ? (effectiveRange.endIndex / Math.max(rangeAxisValues.length - 1, 1)) * 100 : 0}%"
        >
          <input
            class="filter-slider floating-filter-slider floating-filter-range-slider"
            type="range"
            step="1"
            min="0"
            max="${Math.max(rangeAxisValues.length - 1, 0)}"
            value="${Math.max(effectiveRange.startIndex, 0)}"
            data-axis-range-start
            ${rangeAxisValues.length ? "" : "disabled"}
          />
          <input
            class="filter-slider floating-filter-slider floating-filter-range-slider"
            type="range"
            step="1"
            min="0"
            max="${Math.max(rangeAxisValues.length - 1, 0)}"
            value="${Math.max(effectiveRange.endIndex, 0)}"
            data-axis-range-end
            ${rangeAxisValues.length ? "" : "disabled"}
          />
        </div>
      </div>
    `

    : `
      <div class="floating-filter-slider-block">
        <div class="floating-filter-value">
          <span data-floating-display-value></span>
          ${rangeToggleMarkup}
        </div>
        <div
          class="floating-filter-range-wrap floating-filter-single-wrap is-end-active"
          data-single-max="${Math.max(sliderStops.length - 1, 1)}"
          style="--range-start:0%;--range-end:${sliderStops.length ? (Math.max(sliderValueIndex, 0) / Math.max(sliderStops.length - 1, 1)) * 100 : 0}%"
        >
          <input
            class="filter-slider floating-filter-slider floating-filter-range-slider"
            type="range"
            step="1"
            min="0"
            max="${Math.max(sliderStops.length - 1, 0)}"
            value="${Math.max(sliderValueIndex, 0)}"
            data-axis-slider
            ${sliderStops.length ? "" : "disabled"}
          />
        </div>
      </div>
    `;

  const currentDateSingle = filters.dateSingle || todayIso();
  const previousDate = isDateAxisMode(filters.axisMode) && filters.dateSelectionMode === "single"
    ? getHistoryDateNeighbor(bounds?.historyDates ?? [], currentDateSingle, -1)
    : "";
  const nextDate = isDateAxisMode(filters.axisMode) && filters.dateSelectionMode === "single"
    ? getHistoryDateNeighbor(bounds?.historyDates ?? [], currentDateSingle, 1)
    : "";
  const previousDateButtonMarkup = previousDate
    ? '<button class="floating-filter-date-nav button button-tertiary" type="button" data-date-single-shift="-1">前日</button>'
    : "";
  const nextDateButtonMarkup = nextDate
    ? '<button class="floating-filter-date-nav button button-tertiary" type="button" data-date-single-shift="1">翌日</button>'
    : "";
  const clearButtonMarkup = shouldShowFloatingClear(filters)
    ? '<button class="floating-filter-clear button button-tertiary" type="button" data-floating-clear>解除</button>'
    : "";
  const actionClasses = [
    "floating-filter-actions",
    previousDate ? "has-prev-date" : "",
    nextDate ? "has-next-date" : "",
    clearButtonMarkup ? "has-clear" : "",
  ].filter(Boolean).join(" ");

  container.innerHTML = `
    <div class="${actionClasses}">
      ${previousDateButtonMarkup}
      <button class="floating-filter-toggle button button-primary" type="button" data-floating-toggle>
      </button>
      ${nextDateButtonMarkup}
      ${clearButtonMarkup}
    </div>
    <section class="floating-filter-panel ${isOpen ? "is-open" : ""}" aria-hidden="${isOpen ? "false" : "true"}">
      <div class="floating-filter-panel-header">
        <div>
          <p class="eyebrow">Quick Filter</p>
          <h3>絞り込み軸</h3>
        </div>
      </div>
      <div class="field floating-filter-axis-select">
        <span>絞り込み軸</span>
        <div class="field-select quickfilter-select-wrap">
          <select data-axis-mode>
            ${AXIS_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === filters.axisMode ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </div>
      </div>
      ${controlMarkup}
    </section>
  `;

  const toggleButton = container.querySelector("[data-floating-toggle]");
  if (toggleButton) {
    toggleButton.textContent = getFloatingToggleLabel(filters, bounds);
  }

  const displayValue = container.querySelector("[data-floating-display-value]");
  if (displayValue) {
    displayValue.textContent = isDateAxisMode(filters.axisMode)
      ? formatDateRangeValue(filters)
      : rangeMode
        ? formatAxisRangeValue(filters.axisMode, effectiveRange)
        : currentAxisValue;
  }

  const singleInput = container.querySelector("[data-date-single]");
  if (singleInput instanceof HTMLInputElement) {
    singleInput.value = filters.dateSingle || todayIso();
  }

  const startInput = container.querySelector("[data-date-start]");
  if (startInput instanceof HTMLInputElement) {
    startInput.value = filters.dateStart ?? "";
  }

  const endInput = container.querySelector("[data-date-end]");
  if (endInput instanceof HTMLInputElement) {
    endInput.value = filters.dateEnd ?? "";
  }

  const searchLabelNode = container.querySelector("[data-floating-search-label]");
  if (searchLabelNode) {
    searchLabelNode.textContent = searchLabel;
  }

  const queryInput = container.querySelector("[data-axis-query]");
  if (queryInput instanceof HTMLInputElement) {
    queryInput.value = filters.titleQuery ?? "";
    queryInput.placeholder = searchPlaceholder;
  }

  container.querySelectorAll('input[type="range"]').forEach(updateSliderFill);
}
