const MODULE_VERSION = new URL(import.meta.url).search;

const { LAMP_OPTIONS } = await import(`../constants.js${MODULE_VERSION}`);
const { renderBpChart, renderScoreChart } = await import(`./chart.js${MODULE_VERSION}`);
const { formatIsoDate, todayIso } = await import(`../utils/date.js${MODULE_VERSION}`);
const { renderProposalButton } = await import(`./proposal.js${MODULE_VERSION}`);
const { escapeHtml } = await import(`../utils/html.js${MODULE_VERSION}`);

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
const getLampColor = (lamp) => LAMP_COLORS[lamp] ?? "transparent";
const getSummaryBandLampColor = (lamp) => getLampColor(lamp);
const getCardLampColor = (lamp) => lamp === "NO PLAY" ? "transparent" : getLampColor(lamp);
const RECOMMEND_OPTIONS = [
  { value: "", label: "－" },
  { value: "△", label: "△" },
  { value: "○", label: "○" },
  { value: "◎", label: "◎" },
  { value: "☆", label: "☆" },
];
const CHART_DIFFICULTY_OPTIONS = ["B", "N", "H", "A", "L"];
const SONG_DATA_FILTER_OPTIONS = [
  { value: "all", label: "すべて", inf: "all", acdelete: "all" },
  { value: "ac", label: "AC", inf: "all", acdelete: "no" },
  { value: "infinitas", label: "INFINITAS", inf: "yes", acdelete: "all" },
  { value: "acOnly", label: "ACのみ", inf: "no", acdelete: "no" },
  { value: "infinitasOnly", label: "INFINITASのみ", inf: "yes", acdelete: "yes" },
  { value: "csDeleted", label: "CS/削除曲", inf: "no", acdelete: "yes" },
];
const SUMMARY_LAMP_DOUBLE_CLICK_MS = 220;
const SUMMARY_LAMP_SWIPE_SOLO_THRESHOLD = 40;
const DIFFICULTY_TABLE_STALE_MS = 12 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = "dbr-theme";
const ENTRY_BP_INPUT_MODE_STORAGE_KEY = "dbr-entry-bp-input-mode";
const ENTRY_BP_INPUT_MODES = new Set(["bp", "split"]);
const AXIS_OPTIONS = [
  { value: "level", label: "Lv." },
  { value: "splv", label: "SPLv." },
  { value: "katate", label: "片手Lv." },
  { value: "date", label: "プレー日" },
  { value: "title", label: "曲名" },
  { value: "memo", label: "メモ" },
];
const AXIS_SHORTCUT_KEYS = {
  f: "level",
  w: "splv",
  e: "katate",
  r: "date",
  s: "title",
  t: "memo",
};
const HIDDEN_FLOATING_CLEAR_AXES = new Set(["level", "splv", "katate", "date"]);

// DBR IR送信
const DBR_IR_IMPORT_TEST_URL = "https://dbr-difficulty.github.io/dbr_ir_from_logger.html";
const DBR_IR_IMPORT_TEST_ORIGIN = "https://dbr-difficulty.github.io";

function openDbrIrImportPage() {
  const targetUrl = new URL(DBR_IR_IMPORT_TEST_URL, window.location.href);
  const targetWindow = window.open(targetUrl.href, "_blank");

  if (!targetWindow) {
    window.alert("DBR IR受け取りページを開けませんでした。ポップアップブロックを確認してください。");
    return null;
  }

  return targetWindow;
}

function sendJsonToDbrIrPage(targetWindow, jsonText) {
  if (!targetWindow) {
    return;
  }

  let sent = false;

  function sendJson() {
    if (sent) {
      return;
    }

    sent = true;

    targetWindow.postMessage({
      type: "dbr-ir-import-json",
      payload: jsonText,
      filename: "dbr-logger.json",
    }, DBR_IR_IMPORT_TEST_ORIGIN);
  }

  function handleReady(event) {
    if (event.origin !== DBR_IR_IMPORT_TEST_ORIGIN) {
      return;
    }

    if (event.source !== targetWindow) {
      return;
    }

    if (!event.data || event.data.type !== "dbr-ir-import-ready") {
      return;
    }

    window.removeEventListener("message", handleReady);
    sendJson();
  }

  window.addEventListener("message", handleReady);

  window.setTimeout(() => {
    window.removeEventListener("message", handleReady);
    sendJson();
  }, 1000);
}

function isTextAxisMode(axisMode) {
  return axisMode === "title" || axisMode === "memo";
}

function isDateAxisMode(axisMode) {
  return axisMode === "date";
}

function isNumericAxisMode(axisMode) {
  return axisMode === "level" || axisMode === "splv" || axisMode === "katate";
}

function getSongDataFilterOption(value) {
  return SONG_DATA_FILTER_OPTIONS.find((option) => option.value === value)
    ?? SONG_DATA_FILTER_OPTIONS[0];
}

function getSongDataFilterValue(filters) {
  const inf = filters?.inf ?? "all";
  const acdelete = filters?.acdelete ?? "all";
  const option = SONG_DATA_FILTER_OPTIONS.find((candidate) => (
    candidate.inf === inf && candidate.acdelete === acdelete
  ));

  return option?.value ?? "all";
}

function isDifficultyTableStale(updatedAt) {
  return Number.isFinite(updatedAt) && Date.now() - updatedAt >= DIFFICULTY_TABLE_STALE_MS;
}

function syncDifficultyImportButton(button, shouldHighlight) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.classList.toggle("button-primary", shouldHighlight);
  button.classList.toggle("button-secondary", !shouldHighlight);
  button.classList.toggle("is-difficulty-stale", shouldHighlight);
}

function getCurrentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function persistTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function loadEntryBpInputMode() {
  try {
    const mode = window.localStorage.getItem(ENTRY_BP_INPUT_MODE_STORAGE_KEY);
    return ENTRY_BP_INPUT_MODES.has(mode) ? mode : "bp";
  } catch {
    return "bp";
  }
}

function persistEntryBpInputMode(mode) {
  try {
    window.localStorage.setItem(ENTRY_BP_INPUT_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function syncThemeToggleButton(button, theme) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const isDark = theme === "dark";
  button.innerHTML = isDark
    ? `
      <span class="theme-toggle-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
          <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8">
            <path d="M12 1.75v2.2"></path>
            <path d="M12 20.05v2.2"></path>
            <path d="M4.95 4.95l1.56 1.56"></path>
            <path d="M17.49 17.49l1.56 1.56"></path>
            <path d="M1.75 12h2.2"></path>
            <path d="M20.05 12h2.2"></path>
            <path d="M4.95 19.05l1.56-1.56"></path>
            <path d="M17.49 6.51l1.56-1.56"></path>
          </g>
        </svg>
      </span>
    `
    : `
      <span class="theme-toggle-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path
            d="M21 12.8A8.9 8.9 0 1 1 11.2 3a7.2 7.2 0 0 0 9.8 9.8Z"
            fill="none"
            stroke="currentColor"
            stroke-linejoin="round"
            stroke-width="1.8"
          ></path>
        </svg>
      </span>
    `;
  button.setAttribute("aria-label", isDark ? "ライトテーマに切り替え" : "ダークテーマに切り替え");
  button.setAttribute("aria-pressed", String(isDark));
  button.title = isDark ? "ライトテーマに切り替え" : "ダークテーマに切り替え";
}

function badge(label, className) {
  return `<span class="pill ${className}">${escapeHtml(label)}</span>`;
}

function formatDifficultyLabel(song) {
  if (song.level) {
    return `☆${song.level}`;
  }

  return "未査定";
}

function formatSplvLabel(song) {
  return song.splv ? `SP☆${song.splv}` : null;
}

function formatKatateTitleSuffix(song) {
  if (song.katateValue === null || song.katateValue === undefined || song.katateValue === "") {
    return "";
  }

  const label = formatKatateFilterValue(song.katateValue);
  return label ? `片手☆${label}` : "";
}

function formatRecommendDisplay(recommend) {
  const normalized = String(recommend ?? "").trim();
  return normalized || "－";
}

function formatSongMemoDisplay(song) {
  const recommend = formatRecommendDisplay(song?.recommend);
  const memo = String(song?.note ?? "").replace(/\s+/g, " ").trim();

  if (!memo) {
    return recommend;
  }

  return `${recommend}：${memo}`;
}

function formatBp(value) {
  return value === null || value === undefined ? "-" : String(value);
}

function formatBpPlaceholder(selectedSong) {
  const best = formatBp(selectedSong.bestBp);
  const latest = formatBp(selectedSong.currentBp);
  return `最小値 ${best} / 現在値 ${latest}`;
}

function formatScore(value) {
  return value === null || value === undefined ? "-" : String(value);
}

function formatScorePlaceholder(selectedSong) {
  const best = formatScore(selectedSong.bestScore);
  const latest = formatScore(selectedSong.currentScore);
  return `自己ベスト ${best} / 現在値 ${latest}`;
}

function formatPercent(value, total) {
  if (total === 0) {
    return "0.0%";
  }
  return `${((value / total) * 100).toFixed(1)}%`;
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

function extractBalancedJsonObject(text) {
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) {
        continue;
      }

      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function findFirstSectionIndex(text) {
  const sectionPattern = /"?((bp|lamp|score|textageKey))"?\s*:\s*\{/g;
  let firstIndex = -1;

  for (const match of text.matchAll(sectionPattern)) {
    if (match.index === undefined) {
      continue;
    }

    if (firstIndex === -1 || match.index < firstIndex) {
      firstIndex = match.index;
    }
  }

  return firstIndex;
}

function parseImportedJsonText(text) {
  const normalized = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    throw new Error("JSONテキストが空です。");
  }

  try {
    return JSON.parse(normalized);
  } catch {}

  const fenceMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {}
  }

  const objectText = extractBalancedJsonObject(normalized);
  if (objectText) {
    try {
      return JSON.parse(objectText);
    } catch {}
  }

  const firstBraceIndex = normalized.indexOf("{");
  const lastBraceIndex = normalized.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    try {
      return JSON.parse(normalized.slice(firstBraceIndex, lastBraceIndex + 1));
    } catch {}
  }

  const firstSectionIndex = findFirstSectionIndex(normalized);
  if (firstSectionIndex >= 0) {
    const tail = normalized.slice(firstSectionIndex);
    const tailObject = extractBalancedJsonObject(`{${tail}}`);
    if (tailObject) {
      try {
        return JSON.parse(tailObject);
      } catch {}
    }

    const tailLastBraceIndex = tail.lastIndexOf("}");
    if (tailLastBraceIndex >= 0) {
      try {
        return JSON.parse(`{${tail.slice(0, tailLastBraceIndex + 1)}}`);
      } catch {}
    }
  }

  throw new Error("テキスト内から有効なJSON本体を見つけられませんでした。");
}

function askJsonImportDate() {
  const defaultDate = todayIso();
  let promptValue = defaultDate;

  while (true) {
    const response = window.prompt(
      "JSONの記録日を入力してください。空欄なら今日として読み込みます。",
      promptValue,
    );

    if (response === null) {
      return null;
    }

    const normalized = response.trim();

    if (!normalized) {
      return defaultDate;
    }

    promptValue = normalized;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      window.alert("記録日は YYYY-MM-DD 形式で入力してください。");
      continue;
    }

    const parsed = new Date(`${normalized}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      window.alert("記録日の形式が不正です。");
      continue;
    }

    const [year, month, day] = normalized.split("-").map(Number);

    if (
      parsed.getFullYear() !== year
      || parsed.getMonth() + 1 !== month
      || parsed.getDate() !== day
    ) {
      window.alert("存在しない日付です。");
      continue;
    }

    if (normalized > defaultDate) {
      window.alert("未来の日付は指定できません。");
      continue;
    }

    return normalized;
  }
}

function deriveFilterBounds(songStates) {
  const levelValues = songStates.map((song) => song.levelValue).filter((value) => value !== null);
  const splvValues = songStates.map((song) => song.splvValue).filter((value) => value !== null);
  const katateValues = songStates.map((song) => song.katateValue).filter((value) => value !== null);
  const uniqueLevelValues = [...new Set(levelValues)].sort((a, b) => a - b);
  const uniqueSplvValues = [...new Set(splvValues)].sort((a, b) => a - b);
  const uniqueKatateValues = [...new Set(katateValues)].sort((a, b) => a - b);

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
  };
}

function deriveHistoryDates(songStates) {
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
  return AXIS_OPTIONS.find((option) => option.value === axisMode)?.label ?? "Lv.";
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

  return [];
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

  return String(value);
}

function formatExportDateStamp() {
  return todayIso().replaceAll("-", "");
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
    && Boolean(filters.axisRangeModeByAxis?.[filters.axisMode]);
}

function hasAxisCandidate(axisValues, value) {
  if (value === "" || value === null || value === undefined) {
    return false;
  }

  return axisValues.some((candidate) => String(candidate) === String(value));
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
  if (startIndex >= 0 && endIndex >= 0 && startIndex <= endIndex) {
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

function summarizeAxisFilter(filters, bounds) {
  if (isTextAxisMode(filters.axisMode)) {
    return filters.titleQuery.trim()
      ? `${getAxisLabel(filters.axisMode)} ${filters.titleQuery.trim()}`
      : `${getAxisLabel(filters.axisMode)} ALL`;
  }

  if (isDateAxisMode(filters.axisMode)) {
    return `${getAxisLabel(filters.axisMode)} ${formatDateRangeValue(filters)}`;
  }

  if (isAxisRangeMode(filters)) {
    return `${getAxisLabel(filters.axisMode)} ${formatAxisRangeValue(filters.axisMode, getNormalizedAxisRange(filters, getAxisValues(bounds, filters.axisMode)))}`;
  }

  return `${getAxisLabel(filters.axisMode)} ${formatAxisValue(filters.axisMode, filters.axisValue)}`;
}

function renderFloatingToggleLabel(filters, bounds) {
  if (isDateAxisMode(filters.axisMode)) {
    return `絞り込み: ${escapeHtml(getAxisLabel(filters.axisMode))} ${escapeHtml(formatDateRangeValue(filters))}`;
  }

  return `絞り込み: ${escapeHtml(summarizeAxisFilter(filters, bounds))}`;
}

function isDefaultDateRange(filters, dateDefaultRange) {
  if (filters.dateSelectionMode === "single") {
    return (filters.dateSingle || todayIso()) === (dateDefaultRange?.dateEnd || todayIso());
  }

  return filters.dateStart === dateDefaultRange?.dateStart && filters.dateEnd === dateDefaultRange?.dateEnd;
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

function renderSummaryBands(summary) {
  if (!summary.bands.length) {
    return `<div class="summary-chart-empty empty-state">${escapeHtml(summary.emptyMessage ?? "難易度表が未読み込みです。")}</div>`;
  }

  const rows = summary.bands.map((band) => {
    const segmentOrder = [...LAMP_OPTIONS].reverse();
    const segments = (band.total === 0 ? ["NO PLAY"] : segmentOrder).map((lamp) => {
      const count = band.lampCounts[lamp] ?? 0;
      if (count <= 0 && band.total !== 0) {
        return "";
      }

      const flexGrow = band.total === 0 ? 1 : count;
      const segment = `
        <span
          class="summary-band-segment"
          style="flex:${flexGrow} 1 0px;background:${getSummaryBandLampColor(lamp)}"
          aria-hidden="true"
        ></span>
      `;
      return segment;
    }).join("");

    return `
      <div class="summary-band-row">
        <div class="summary-band-label">${escapeHtml(band.label)}</div>
        <div class="summary-band-track" role="img" aria-label="${escapeHtml(band.label)} のクリアランプ内訳">
          ${segments}
        </div>
        <div class="summary-band-total">${band.total}</div>
      </div>
    `;
  }).join("");
  const scrollableClass = summary.bands.length >= 1000 ? " is-scrollable" : "";

  return `
    <div class="summary-chart-wrap">
      <div class="summary-chart-heading">
        <span>${escapeHtml(summary.totalLabel ?? "総曲数")}</span>
        <strong>${summary.bandTotalSongs ?? summary.totalSongs} ${escapeHtml(summary.totalUnit ?? "曲")}</strong>
      </div>
      <div class="summary-band-chart${scrollableClass}">
        ${rows}
      </div>
    </div>
  `;
}

function renderSummary(summaryContainer, summary, filters) {
  const lampFilterDisabled = isTextAxisMode(filters.axisMode);

  const legend = LAMP_OPTIONS.map((lamp) => `
    <button
      class="summary-lamp-item ${filters.lamps.includes(lamp) ? "is-active" : "is-inactive"}"
      type="button"
      data-summary-lamp="${escapeHtml(lamp)}"
      aria-pressed="${filters.lamps.includes(lamp) ? "true" : "false"}"
      ${lampFilterDisabled ? "disabled aria-disabled=\"true\"" : ""}
    >
      <div class="summary-lamp-main">
        <span class="summary-lamp-dot" style="background:${getLampColor(lamp)}"></span>
        <span class="summary-lamp-label">${escapeHtml(lamp)}</span>
      </div>
      <div class="summary-lamp-values">
        <strong>${summary.lampCounts[lamp] ?? 0}</strong>
        <span>${formatPercent(summary.lampCounts[lamp] ?? 0, summary.totalSongs)}</span>
      </div>
    </button>
  `).join("");

  summaryContainer.innerHTML = `
    <div class="summary-panel">
      ${renderSummaryBands(summary)}
      <div class="summary-legend">
        ${legend}
      </div>
    </div>
  `;
}

function renderDifficultyFilters(container, filters) {
  const fixedFilterDisabled = {
    songData: filters.axisMode === "date",
    includeUnrated: filters.axisMode === "date" || isTextAxisMode(filters.axisMode),
    recommend: filters.axisMode === "date" || isTextAxisMode(filters.axisMode),
    chartDifficulty: filters.axisMode === "date" || isTextAxisMode(filters.axisMode),
  };
  const selectedSongDataFilter = getSongDataFilterValue(filters);
  const songDataOptions = SONG_DATA_FILTER_OPTIONS.map((option) => `
    <option value="${escapeHtml(option.value)}" ${selectedSongDataFilter === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>
  `).join("");
  const recommendMarkup = RECOMMEND_OPTIONS.map((option) => {
    const checked = filters.recommend.includes(option.value) ? "checked" : "";
    return `
      <label class="recommend-chip ${fixedFilterDisabled.recommend ? "is-disabled" : ""}">
        <input type="checkbox" data-filter="recommend" value="${escapeHtml(option.value)}" ${checked} ${fixedFilterDisabled.recommend ? "disabled" : ""} />
        <span>${escapeHtml(option.label)}</span>
      </label>
    `;
  }).join("");
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
      <div class="recommend-group ${fixedFilterDisabled.recommend ? "is-disabled" : ""}">
        <span class="recommend-label">おすすめ</span>
        <div class="recommend-options">
          ${recommendMarkup}
        </div>
      </div>
      <div class="recommend-group chart-difficulty-group ${fixedFilterDisabled.chartDifficulty ? "is-disabled" : ""}">
        <span class="recommend-label">譜面難易度</span>
        <div class="recommend-options">
          ${chartDifficultyMarkup}
        </div>
      </div>
      <div class="filters-meta">
        <button class="button button-tertiary" type="button" data-filter-action="reset">リセット</button>
      </div>
    </div>
  `;
}

function renderFloatingAxisFilter(container, filters, bounds, isOpen, previewState = null, dateDefaultRange = null) {
  const axisValues = getAxisValues(bounds, filters.axisMode);
  const sliderStops = ["", ...axisValues];
  const previewValue = previewState?.mode === filters.axisMode ? previewState.value : null;
  const previewRange = previewState?.rangeMode === filters.axisMode ? previewState.range : null;
  const rangeMode = isAxisRangeMode(filters);
  const effectiveAxisValue = previewValue !== null ? previewValue : filters.axisValue;
  const sliderValueIndex = Math.max(0, sliderStops.findIndex((value) => String(value) === String(effectiveAxisValue)));
  const effectiveRange = previewRange ?? getNormalizedAxisRange(filters, axisValues);
  const currentAxisValue = isTextAxisMode(filters.axisMode)
    ? filters.titleQuery
    : formatAxisValue(filters.axisMode, effectiveAxisValue);
  const rangeToggleMarkup = isNumericAxisMode(filters.axisMode)
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
          <span>${escapeHtml(formatDateRangeValue(filters))}</span>
          ${dateRangeResetMarkup}
          ${dateModeToggleMarkup}
        </div>
        ${filters.dateSelectionMode === "single" ? `
          <div class="field floating-filter-date-field">
            <span class="input-field">
              <input class="form-date" type="date" data-date-single value="${escapeHtml(filters.dateSingle || todayIso())}" />
            </span>
          </div>
        ` : `
          <div class="floating-filter-date-grid">
          <div class="field floating-filter-date-field">
            <span>開始日</span>
            <span class="input-field">
              <input class="form-date" type="date" data-date-start value="${escapeHtml(filters.dateStart ?? "")}" />
            </span>
          </div>
          <div class="field floating-filter-date-field">
            <span>終了日</span>
            <span class="input-field">
              <input class="form-date" type="date" data-date-end value="${escapeHtml(filters.dateEnd ?? "")}" />
            </span>
          </div>
          </div>
        `}
      </div>
    `
    : isTextAxisMode(filters.axisMode)
    ? `
      <div class="field floating-filter-search">
        <span>${escapeHtml(searchLabel)}</span>
        <input type="search" data-axis-query value="${escapeHtml(filters.titleQuery)}" placeholder="${escapeHtml(searchPlaceholder)}" />
      </div>
    `
    : rangeMode
    ? `
      <div class="floating-filter-slider-block">
        <div class="floating-filter-value">
          <span>${escapeHtml(formatAxisRangeValue(filters.axisMode, effectiveRange))}</span>
          ${rangeToggleMarkup}
        </div>
        <div
          class="floating-filter-range-wrap is-start-active"
          data-range-max="${Math.max(axisValues.length - 1, 1)}"
          style="--range-start:${axisValues.length ? (effectiveRange.startIndex / Math.max(axisValues.length - 1, 1)) * 100 : 0}%;--range-end:${axisValues.length ? (effectiveRange.endIndex / Math.max(axisValues.length - 1, 1)) * 100 : 0}%"
        >
          <input
            class="filter-slider floating-filter-slider floating-filter-range-slider"
            type="range"
            step="1"
            min="0"
            max="${Math.max(axisValues.length - 1, 0)}"
            value="${Math.max(effectiveRange.startIndex, 0)}"
            data-axis-range-start
            ${axisValues.length ? "" : "disabled"}
          />
          <input
            class="filter-slider floating-filter-slider floating-filter-range-slider"
            type="range"
            step="1"
            min="0"
            max="${Math.max(axisValues.length - 1, 0)}"
            value="${Math.max(effectiveRange.endIndex, 0)}"
            data-axis-range-end
            ${axisValues.length ? "" : "disabled"}
          />
        </div>
      </div>
    `

    : `
      <div class="floating-filter-slider-block">
        <div class="floating-filter-value">
          <span>${escapeHtml(currentAxisValue)}</span>
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

  const clearButtonMarkup = shouldShowFloatingClear(filters)
    ? '<button class="floating-filter-clear button button-tertiary" type="button" data-floating-clear>解除</button>'
    : "";

  container.innerHTML = `
    <div class="floating-filter-actions">
      <button class="floating-filter-toggle button button-primary" type="button" data-floating-toggle>
        ${renderFloatingToggleLabel(filters, bounds)}
      </button>
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

  container.querySelectorAll('input[type="range"]').forEach(updateSliderFill);
}

function renderSelectedSong(selectedSongContainer, selectedSong, songs, options = {}) {
  selectedSongContainer.classList.remove("is-proposed");
  selectedSongContainer.style.removeProperty("--card-lamp-color");

  if (!selectedSong || songs.length === 0) {
    selectedSongContainer.innerHTML = '<div class="empty-state">表示できる曲がありません。</div>';
    return;
  }

  selectedSongContainer.classList.toggle("is-proposed", Boolean(selectedSong.isProposed));
  selectedSongContainer.style.setProperty("--card-lamp-color", getCardLampColor(selectedSong.bestLamp));

  const historyCountBadge = selectedSong.entryCount > 0
    ? badge(`履歴 ${selectedSong.entryCount} 件`, "pill-neutral")
    : "";
  const katateTitleSuffix = options.showKatateTitleSuffix
    ? formatKatateTitleSuffix(selectedSong)
    : "";
  const katateTitleSuffixHtml = katateTitleSuffix
    ? `<span class="song-card-title-katate">(${escapeHtml(katateTitleSuffix)})</span>`
    : "";  

  selectedSongContainer.innerHTML = `
    <p class="eyebrow selected-song-eyebrow">Selected Song</p>
    <div class="selected-song-meta">
      <div class="selected-song-meta-row">
        ${selectedSong.isProposed ? badge("新規提案中", "pill-proposed") : ""}
        ${badge(formatDifficultyLabel(selectedSong), "pill-level")}
        ${formatSplvLabel(selectedSong) ? badge(formatSplvLabel(selectedSong), "pill-splv") : ""}
        ${badge(selectedSong.bestLamp, "pill-lamp")}
      </div>
    </div>
    <h3 class="selected-song-title">${escapeHtml(selectedSong.title)}${katateTitleSuffixHtml}</h3>
    <p class="selected-song-note">${escapeHtml(formatSongMemoDisplay(selectedSong))}</p>
    <div class="selected-song-meta">
      <div class="selected-song-meta-row">
        ${badge(`BP ${formatBp(selectedSong.bestBp)}/${formatBp(selectedSong.currentBp)}`, "pill-neutral")}
        <!-- ${badge(`Latest ${formatBp(selectedSong.currentBp)}`, "pill-neutral")} -->
        ${badge(selectedSong.latestDate ? formatIsoDate(selectedSong.latestDate).slice(5) : "履歴なし", "pill-neutral")}
        ${historyCountBadge}
      </div>
    </div>
  `;
}

function renderCatalog(catalogContainer, songs, selectedTitle, options = {}) {
  catalogContainer.classList.toggle("is-list-view", options.viewMode === "list");

  if (songs.length === 0) {
    catalogContainer.innerHTML = '<div class="empty-state">該当する曲がありません。</div>';
    return;
  }

  catalogContainer.innerHTML = songs.map((song) => {
    const catalogItemKey = song.catalogItemKey || `title:${song.title}`;
    const selectedClass = options.selectedCatalogKey
      ? (catalogItemKey === options.selectedCatalogKey ? "is-selected" : "")
      : (song.title === selectedTitle ? "is-selected" : "");
    const proposedClass = song.isProposed ? "is-proposed" : "";
    const encodedTitle = encodeURIComponent(song.title);
    const encodedCatalogItemKey = encodeURIComponent(catalogItemKey);
    const lampColor = getCardLampColor(song.bestLamp);
    const historyCountBadge = song.entryCount > 0
      ? badge(`履歴 ${song.entryCount} 件`, "pill-neutral")
      : "";
    const katateTitleSuffix = options.showKatateTitleSuffix
      ? formatKatateTitleSuffix(song)
      : "";
    const katateTitleSuffixHtml = katateTitleSuffix
      ? `<span class="song-card-title-katate">(${escapeHtml(katateTitleSuffix)})</span>`
      : "";

    if (options.viewMode === "list") {
      const listMetaText = [
        // song.isProposed ? "新規提案中" : "",
        formatSplvLabel(song),
        `BP ${formatBp(song.bestBp)}/${formatBp(song.currentBp)}`,
        song.latestDate ? formatIsoDate(song.latestDate).slice(5) : "履歴なし",
        song.entryCount > 0 ? `履歴 ${song.entryCount} 件` : "",
      ].filter(Boolean).join(", ");

      return `
        <button class="song-card ${selectedClass} ${proposedClass}" type="button" data-title="${encodedTitle}" data-catalog-key="${encodedCatalogItemKey}" style="--card-lamp-color:${escapeHtml(lampColor)}">
          <p class="song-card-title">
            <span class="song-card-list-title-tags">
              ${badge(formatDifficultyLabel(song), "pill-level")}
            </span>
            <span class="song-card-list-title-text">${escapeHtml(song.title)}${katateTitleSuffixHtml}</span>
          </p>
          <p class="song-card-note">
            <span>${escapeHtml(formatSongMemoDisplay(song))}</span>
            <span class="song-card-list-meta-text">${escapeHtml(listMetaText)}</span>
          </p>
        </button>
      `;
    }

    return `
      <button class="song-card ${selectedClass} ${proposedClass}" type="button" data-title="${encodedTitle}" data-catalog-key="${encodedCatalogItemKey}" style="--card-lamp-color:${escapeHtml(lampColor)}">
        <div class="song-card-meta">
          <div class="song-card-meta-row">
            ${song.isProposed ? badge("新規提案中", "pill-proposed") : ""}
            ${badge(formatDifficultyLabel(song), "pill-level")}
            ${formatSplvLabel(song) ? badge(formatSplvLabel(song), "pill-splv") : ""}
            ${badge(song.bestLamp, "pill-lamp")}
          </div>
        </div>
        <p class="song-card-title">${escapeHtml(song.title)}${katateTitleSuffixHtml}</p>
        <p class="song-card-note">${escapeHtml(formatSongMemoDisplay(song))}</p>
        <div class="song-card-meta">
          <div class="song-card-meta-row">
            ${badge(`BP ${formatBp(song.bestBp)}/${formatBp(song.currentBp)}`, "pill-neutral")}
            <!-- ${badge(`Latest ${formatBp(song.currentBp)}`, "pill-neutral")} -->
            ${badge(song.latestDate ? formatIsoDate(song.latestDate).slice(5) : "履歴なし", "pill-neutral")}
            ${historyCountBadge}
          </div>
        </div>
      </button>
    `;
  }).join("");
}

function renderHistory(historyContainer, records, storeRef) {
  if (records.length === 0) {
    historyContainer.innerHTML = '<tr><td colspan="5">履歴がありません。</td></tr>';
    return;
  }

  historyContainer.innerHTML = records.map((record) => `
    <tr>
      <td>${escapeHtml(formatIsoDate(record.date))}</td>
      <td>${escapeHtml(record.lamp)}</td>
      <td>${escapeHtml(formatBp(record.bp))}</td>
      <td>${escapeHtml(formatScore(record.score))}</td>
      <td><a href="#" class="delete-link" data-record-id="${escapeHtml(record.id)}">削除</a></td>
    </tr>
  `).join("");

  // 削除リンクのイベントリスナーを追加
  document.querySelectorAll(".delete-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const recordId = link.dataset.recordId;
      const confirmed = window.confirm("この記録を削除しますか？");
      if (confirmed) {
        const result = storeRef.deleteRecord(recordId);
        if (result.ok) {
          renderHistory(historyContainer, storeRef.getSnapshot().selectedHistory, storeRef);
        } else {
          window.alert(result.message || "削除に失敗しました。");
        }
      }
    });
  });
}

function renderPagination(container, pagination, options = {}) {
  if (pagination.totalItems === 0) {
    container.innerHTML = "";
    return;
  }

  const prevDisabled = pagination.currentPage <= 1 ? "disabled" : "";
  const nextDisabled = pagination.currentPage >= pagination.totalPages ? "disabled" : "";
  const sortDirectionButton = options.showSortDirectionToggle
    ? `<button class="button button-tertiary" type="button" data-sort-direction-toggle aria-label="並び順の昇順降順を切り替え">${options.sortDirection === "desc" ? "▼" : "▲"}</button>`
    : "";

  container.innerHTML = `
    <div class="pagination-controls">
      ${sortDirectionButton}
      <button class="button button-tertiary" type="button" data-page="prev" ${prevDisabled}>前へ</button>
      <span class="pagination-label">${pagination.startIndex}-${pagination.endIndex} / ${pagination.totalItems}</span>
      <button class="button button-tertiary" type="button" data-page="next" ${nextDisabled}>次へ</button>
    </div>
  `;
}

export function createRenderer(store) {
  let activeScrollFrame = null;
  let activeChartResizeFrame = null;
  let latestChartHistory = [];
  let latestScoreChartHistory = [];
  let latestFilterBounds = {
    level: { min: 0, max: 15, step: 0.01, values: [] },
    splv: { min: 1, max: 12, step: 1, values: [] },
    katate: { min: 11, max: 13, step: 0.1, values: [] },
  };
  let latestHistoryDates = [];
  let latestVisibleCount = 0;
  let filterDraft = null;
  let appliedFilterSignature = "";
  let deferredFilterTimer = null;
  let deferredFilterRevision = 0;
  let pendingCatalogBottomLock = null;
  let floatingAxisModeCommitTimer = null;
  let dateFilterCommitTimer = null;
  let dateFilterKeyboardEditUntil = 0;
  let entryBpInputMode = loadEntryBpInputMode();
  let summaryFiltersOpen = true;
  let floatingFilterOpen = false;
  let floatingAxisPreviewMode = null;
  let floatingAxisPreviewValue = null;
  let floatingAxisRangePreviewMode = null;
  let floatingAxisRangePreviewValue = null;
  let floatingAxisShortcutPending = false;
  let floatingAxisRangeShortcutPending = false;
  let floatingDateShortcutPending = false;
  let floatingDatePreviewValue = null;
  let floatingAxisLastValues = {
    level: "",
    splv: "",
    katate: "",
  };
  let floatingAxisRangeActiveHandleByAxis = {
    level: "end",
    splv: "end",
    katate: "end",
  };
  let floatingQuerySelection = null;
  let floatingQueryComposing = false;
  let floatingQueryFocused = false;
  let floatingQueryRestoreFocus = false;
  let pendingQueryBlurIntent = null;
  let floatingAxisSingleDragState = null;
  let floatingAxisRangeDragState = null;
  let lastSummaryLampClick = { lamp: "", timestamp: 0 };
  let summaryLampPointerState = null;
  let floatingOutsidePointerState = null;
  let lastScrollY = window.scrollY;
  let lastUserScrollAt = 0;
  let floatingDockSide = "bottom";
  let pendingCatalogBottomNextScroll = false;
  let scrollDirectionStreak = null;
  let scrollDirectionDistance = 0;
  let scrollDirectionTimestamp = 0;
  let isProgrammaticScroll = false;
  let suppressBottomDockState = false;

  function easeInOutCubic(progress) {
    return progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - ((-2 * progress + 2) ** 3) / 2;
  }

  function getScrollOffset() {
    return 78;
  }

  function scrollElementIntoView(element, offset = getScrollOffset()) {
    if (!element) {
      return;
    }

    cancelActiveScrollAnimation();

    const startY = window.scrollY;
    const targetY = Math.max(0, window.scrollY + element.getBoundingClientRect().top - offset);
    const distance = targetY - startY;
    const duration = 760;
    const startTime = performance.now();
    suppressBottomDockState = true;
    isProgrammaticScroll = true;

    if (Math.abs(distance) < 1) {
      window.scrollTo(0, targetY);
      isProgrammaticScroll = false;
      window.requestAnimationFrame(() => {
        suppressBottomDockState = false;
        syncFloatingDockClass();
      });
      return;
    }

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);
      window.scrollTo(0, startY + distance * eased);

      if (progress < 1) {
        activeScrollFrame = window.requestAnimationFrame(step);
        return;
      }

      activeScrollFrame = null;
      isProgrammaticScroll = false;
      window.requestAnimationFrame(() => {
        suppressBottomDockState = false;
        syncFloatingDockClass();
      });
    }

    activeScrollFrame = window.requestAnimationFrame(step);
  }

  function cancelActiveScrollAnimation() {
    if (activeScrollFrame === null) {
      return;
    }

    window.cancelAnimationFrame(activeScrollFrame);
    activeScrollFrame = null;
    isProgrammaticScroll = false;
  }

  function scrollEntryPanelIntoView() {
    scrollElementIntoView(document.querySelector("#entry-panel"));
  }

  function scrollSelectedCardIntoView() {
    const encodedCatalogKey = nodes.selectedSong?.dataset.catalogKey;
    if (encodedCatalogKey) {
      const card = nodes.catalog?.querySelector(`[data-catalog-key="${encodedCatalogKey}"]`);
      if (card) {
        scrollElementIntoView(card);
        return;
      }
    }

    const encodedTitle = nodes.selectedSong?.dataset.title;
    if (!encodedTitle) {
      return;
    }

    const card = nodes.catalog?.querySelector(`[data-title="${encodedTitle}"]`);
    if (!card) {
      return;
    }

    scrollElementIntoView(card);
  }

  function scrollCatalogPanelIntoView() {
    scrollElementIntoView(nodes.catalogPanel ?? nodes.catalog);
  }

  function resetFloatingFilterFocusState() {
    floatingQueryFocused = false;
    floatingQueryRestoreFocus = false;
    syncQueryScrollLockState();
  }

  function closeFloatingFilter({ preserveScroll = false } = {}) {
    resetFloatingFilterFocusState();
    floatingFilterOpen = false;
    renderFloatingFilterShell();
    syncQueryScrollLockState();
    if (!preserveScroll) {
      scrollCatalogPanelIntoView();
    }
  }

  function canAutoScrollElementUpward(element, offset = getScrollOffset()) {
    if (!element) {
      return false;
    }

    const startY = window.scrollY;
    const targetY = Math.max(0, window.scrollY + element.getBoundingClientRect().top - offset);
    return targetY < startY - 1;
  }

  function canAutoScrollElement(element, offset = getScrollOffset()) {
    if (!element) {
      return false;
    }

    const startY = window.scrollY;
    const targetY = Math.max(0, window.scrollY + element.getBoundingClientRect().top - offset);
    return Math.abs(targetY - startY) >= 1;
  }

  function applyFiltersPreservingOverviewPosition(nextFilters, options = {}) {
    const overviewPanel = nodes.summaryPanel;
    const catalogTarget = nodes.catalogPanel ?? nodes.catalog;
    const shouldScroll = options.scrollToCatalog ?? canAutoScrollElementUpward(catalogTarget);

    if (!overviewPanel) {
      applyDifficultyFilters(nextFilters, { scrollToCatalog: shouldScroll });
      return;
    }

    const beforeRect = overviewPanel.getBoundingClientRect();
    const isOverviewAboveViewport = beforeRect.top < 0;
    const shouldPreserve = beforeRect.top < 78;

    store.setDifficultyFilters(nextFilters);

    if (shouldPreserve) {
      const afterRect = overviewPanel.getBoundingClientRect();
      const delta = isOverviewAboveViewport
        ? afterRect.bottom - beforeRect.bottom
        : afterRect.top - beforeRect.top;

      if (Math.abs(delta) >= 1) {
        window.scrollBy(0, delta);
      }

      const clampedRect = overviewPanel.getBoundingClientRect();
      if (clampedRect.top > 78 && Math.abs(clampedRect.top - 78) >= 1) {
        window.scrollBy(0, clampedRect.top - 78);
      }
    }

    if (shouldScroll) {
      window.requestAnimationFrame(scrollCatalogPanelIntoView);
    }
  }

  function renderFloatingFilterShell() {
    const snapshot = store.getSnapshot();
    renderFloatingAxisFilter(
      nodes.floatingAxisFilter,
      filterDraft ?? snapshot.filters,
      latestFilterBounds,
      floatingFilterOpen,
      {
        mode: floatingAxisPreviewMode,
        value: floatingAxisPreviewValue,
        rangeMode: floatingAxisRangePreviewMode,
        range: floatingAxisRangePreviewValue,
      },
      snapshot.dateDefaultRange,
    );
    syncFloatingDockClass();
    if (floatingFilterOpen) {
      if (floatingQueryFocused) {
        pinFloatingFilterToDocument();
        return;
      }

      releaseFloatingFilterPosition();
      return;
    }

    releaseFloatingFilterPosition();
  }

  function toggleFloatingFilter() {
    floatingFilterOpen = !floatingFilterOpen;
    renderFloatingFilterShell();
    syncQueryScrollLockState();
  }

  function focusFloatingTitleQuery() {
    const queryInput = nodes.floatingAxisFilter.querySelector('input[data-axis-query]');
    if (!(queryInput instanceof HTMLInputElement)) {
      return;
    }

    queryInput.focus();
    queryInput.select?.();
  }

  function focusFloatingAxisControl(axisMode) {
    if (isTextAxisMode(axisMode)) {
      focusFloatingTitleQuery();
      syncQueryScrollLockState();
      return;
    }
  }  

  function isMobileViewport() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function isHoverNoneEnvironment() {
    return window.matchMedia("(hover: none)").matches;
  }

  function setQueryScrollLock(locked) {
    document.documentElement.classList.toggle("search-focus-scroll-lock", locked);
    document.body.classList.toggle("search-focus-scroll-lock", locked);
  }

  function isTitleQueryElement(element) {
    return element instanceof HTMLInputElement && element.hasAttribute("data-axis-query");
  }

  function isNumericAxisMode(axisMode) {
    return axisMode === "level" || axisMode === "splv" || axisMode === "katate";
  }

  function hasAxisValue(axisMode, value) {
    if (value === "" || value === null || value === undefined) {
      return false;
    }

    return getAxisValues(latestFilterBounds, axisMode)
      .some((candidate) => String(candidate) === String(value));
  }

  function rememberFloatingAxisValue(axisMode, value) {
    if (!isNumericAxisMode(axisMode) || value === "" || value === null || value === undefined) {
      return;
    }

    floatingAxisLastValues[axisMode] = String(value);
  }

  function getActiveAxisRange(filters = filterDraft ?? store.getSnapshot().filters) {
    const axisValues = getAxisValues(latestFilterBounds, filters.axisMode);
    return getNormalizedAxisRange(filters, axisValues);
  }

  function updateFloatingSingleSliderDisplay(axisMode, index, previewValue) {
    const slider = nodes.floatingAxisFilter.querySelector("input[data-axis-slider]");
    const wrap = nodes.floatingAxisFilter.querySelector(".floating-filter-single-wrap");

    if (slider instanceof HTMLInputElement) {
      slider.value = String(index);
      updateSliderFill(slider);
    }

    if (wrap instanceof HTMLElement) {
      const max = Math.max(1, Number(wrap.dataset.singleMax ?? 0));
      wrap.style.setProperty("--range-start", "0%");
      wrap.style.setProperty("--range-end", `${(index / max) * 100}%`);
    }

    const valueNode = nodes.floatingAxisFilter.querySelector(".floating-filter-value span");
    if (valueNode) {
      valueNode.textContent = formatAxisValue(axisMode, previewValue);
    }
  }

  function previewFloatingAxisSliderToIndex(axisMode, targetIndex) {
    const activeFilters = filterDraft ?? store.getSnapshot().filters;

    if (!floatingFilterOpen || isTextAxisMode(axisMode) || isDateAxisMode(axisMode) || isAxisRangeMode({ ...activeFilters, axisMode })) {
      return false;
    }

    const axisValues = getAxisValues(latestFilterBounds, axisMode);
    const sliderStops = ["", ...axisValues];

    if (sliderStops.length <= 1) {
      return false;
    }

    const nextIndex = Math.max(0, Math.min(targetIndex, sliderStops.length - 1));
    const nextValue = sliderStops[nextIndex] ?? "";
    const previewValue = nextValue === "" ? "" : String(nextValue);

    floatingAxisPreviewMode = axisMode;
    floatingAxisPreviewValue = previewValue;
    floatingAxisShortcutPending = true;

    updateFloatingSingleSliderDisplay(axisMode, nextIndex, previewValue);
    return true;
  }

  function getFloatingAxisSinglePointerIndex(event, sliderWrap) {
    const rect = sliderWrap.getBoundingClientRect();
    const ratio = rect.width > 0
      ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      : 0;
    const max = Math.max(1, Number(sliderWrap.dataset.singleMax ?? 0));
    return Math.round(ratio * max);
  }

  function updateFloatingRangeDisplay(axisMode, range) {
    const wrap = nodes.floatingAxisFilter.querySelector(".floating-filter-range-wrap");
    if (wrap instanceof HTMLElement) {
      const max = Math.max(1, Number(wrap.dataset.rangeMax ?? 0));
      wrap.style.setProperty("--range-start", `${(range.startIndex / max) * 100}%`);
      wrap.style.setProperty("--range-end", `${(range.endIndex / max) * 100}%`);
      wrap.classList.toggle("is-start-active", (floatingAxisRangeActiveHandleByAxis[axisMode] ?? "end") === "start");
      wrap.classList.toggle("is-end-active", (floatingAxisRangeActiveHandleByAxis[axisMode] ?? "end") === "end");
    }

    const valueNode = nodes.floatingAxisFilter.querySelector(".floating-filter-value span");
    if (valueNode) {
      valueNode.textContent = formatAxisRangeValue(axisMode, range);
    }

    const startInput = nodes.floatingAxisFilter.querySelector("input[data-axis-range-start]");
    if (startInput instanceof HTMLInputElement) {
      startInput.value = String(range.startIndex);
      updateSliderFill(startInput);
    }

    const endInput = nodes.floatingAxisFilter.querySelector("input[data-axis-range-end]");
    if (endInput instanceof HTMLInputElement) {
      endInput.value = String(range.endIndex);
      updateSliderFill(endInput);
    }
  }

  function buildFiltersWithAxisRange(axisMode, range, extraFilters = {}) {
    const currentFilters = store.getSnapshot().filters;
    return {
      ...extraFilters,
      axisRanges: {
        ...currentFilters.axisRanges,
        [axisMode]: { start: range.start, end: range.end },
      },
    };
  }

  function commitFloatingAxisRange(range = floatingAxisRangePreviewValue) {
    if (!floatingAxisRangeShortcutPending || !floatingAxisRangePreviewMode || !range) {
      return false;
    }

    const axisMode = floatingAxisRangePreviewMode;
    floatingAxisRangeShortcutPending = false;
    floatingAxisRangePreviewMode = null;
    floatingAxisRangePreviewValue = null;
    applyDifficultyFilters(buildFiltersWithAxisRange(axisMode, range), { scrollToCatalog: false });
    return true;
  }

  function previewFloatingAxisRangeBy(delta, handle) {
    const activeFilters = filterDraft ?? store.getSnapshot().filters;
    if (!floatingFilterOpen || !isAxisRangeMode(activeFilters)) {
      return false;
    }

    const axisValues = getAxisValues(latestFilterBounds, activeFilters.axisMode);
    if (!axisValues.length) {
      return false;
    }

    const baseRange = floatingAxisRangePreviewMode === activeFilters.axisMode && floatingAxisRangePreviewValue
      ? floatingAxisRangePreviewValue
      : getActiveAxisRange(activeFilters);
    const range = { ...baseRange };
    const activeHandle = handle === "end" ? "end" : "start";

    const nextRange = { ...range };
    if (activeHandle === "start") {
      nextRange.startIndex = Math.max(0, Math.min(range.startIndex + delta, range.endIndex));
      nextRange.start = String(axisValues[nextRange.startIndex]);
    } else {
      nextRange.endIndex = Math.max(range.startIndex, Math.min(range.endIndex + delta, axisValues.length - 1));
      nextRange.end = String(axisValues[nextRange.endIndex]);
    }

    floatingAxisRangeActiveHandleByAxis[activeFilters.axisMode] = activeHandle;
    floatingAxisRangePreviewMode = activeFilters.axisMode;
    floatingAxisRangePreviewValue = nextRange;
    floatingAxisRangeShortcutPending = true;
    updateFloatingRangeDisplay(activeFilters.axisMode, nextRange);
    return true;
  }

  function previewFloatingAxisRangeToIndex(axisMode, targetIndex, handle) {
    const activeFilters = filterDraft ?? store.getSnapshot().filters;
    const axisValues = getAxisValues(latestFilterBounds, axisMode);
    if (!axisValues.length) {
      return false;
    }

    const baseRange = floatingAxisRangePreviewMode === axisMode && floatingAxisRangePreviewValue
      ? floatingAxisRangePreviewValue
      : getActiveAxisRange({ ...activeFilters, axisMode });
    const nextRange = { ...baseRange };
    const nextIndex = Math.max(0, Math.min(targetIndex, axisValues.length - 1));
    const activeHandle = handle === "auto" && nextRange.startIndex === nextRange.endIndex && nextIndex !== nextRange.startIndex
      ? (nextIndex > nextRange.startIndex ? "end" : "start")
      : (handle === "end" ? "end" : "start");

    if (activeHandle === "start") {
      nextRange.startIndex = Math.min(nextIndex, nextRange.endIndex);
      nextRange.start = String(axisValues[nextRange.startIndex] ?? "");
    } else {
      nextRange.endIndex = Math.max(nextIndex, nextRange.startIndex);
      nextRange.end = String(axisValues[nextRange.endIndex] ?? "");
    }

    floatingAxisRangeActiveHandleByAxis[axisMode] = activeHandle;
    floatingAxisRangePreviewMode = axisMode;
    floatingAxisRangePreviewValue = nextRange;
    floatingAxisRangeShortcutPending = true;
    updateFloatingRangeDisplay(axisMode, nextRange);
    return activeHandle;
  }

  function getFloatingAxisRangePointerIndex(event, rangeWrap) {
    const rect = rangeWrap.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
    const max = Math.max(1, Number(rangeWrap.dataset.rangeMax ?? 0));
    return Math.round(ratio * max);
  }

  function releaseFloatingAxisSinglePointerCapture() {
    if (!floatingAxisSingleDragState) {
      return;
    }

    try {
      floatingAxisSingleDragState.sliderWrap.releasePointerCapture?.(floatingAxisSingleDragState.pointerId);
    } catch {
      // The capture can already be released by the browser.
    }
  }

  function releaseFloatingAxisRangePointerCapture() {
    if (!floatingAxisRangeDragState) {
      return;
    }

    try {
      floatingAxisRangeDragState.rangeWrap.releasePointerCapture?.(floatingAxisRangeDragState.pointerId);
    } catch {
      // The capture can already be released by the browser.
    }
  }

  function isShortcutEditableTarget(element) {
    return element instanceof HTMLInputElement
      || element instanceof HTMLTextAreaElement
      // || element instanceof HTMLSelectElement
      // || element instanceof HTMLButtonElement
      || Boolean(element instanceof HTMLElement && element.isContentEditable);
  }

  function isEscapeBlurTarget(element) {
    return element instanceof HTMLInputElement
      || element instanceof HTMLTextAreaElement
      || element instanceof HTMLSelectElement;
  }

  function syncQueryScrollLockState() {
    setQueryScrollLock(false);
  }

  function shouldCloseFloatingFilterAfterSliderCommit() {
    if (isMobileViewport()) {
      return true;
    }

    return canAutoScrollElement(nodes.catalogPanel ?? nodes.catalog);
  }

  function shouldScrollCatalogPanelUpward() {
    return canAutoScrollElementUpward(nodes.catalogPanel ?? nodes.catalog);
  }

  function syncFloatingDockClass() {
    if (!nodes.floatingAxisFilter) {
      return;
    }

    nodes.floatingAxisFilter.classList.toggle("is-docked-top", floatingDockSide === "top");
    nodes.floatingAxisFilter.classList.toggle("is-docked-bottom", floatingDockSide === "bottom");
    nodes.floatingAxisFilter.classList.toggle(
      "is-at-bottom",
      !floatingFilterOpen && !suppressBottomDockState && isAtPageBottom(),
    );
  }

  function isDifficultyImportButtonTopVisible() {
    if (!nodes.csvImportButton) {
      return false;
    }

    const rect = nodes.csvImportButton.getBoundingClientRect();
    return rect.top >= 0 && rect.top <= window.innerHeight;
  }

  function isAtPageBottom() {
    const doc = document.documentElement;
    const scrollBottom = window.scrollY + window.innerHeight;
    return scrollBottom >= doc.scrollHeight - 2;
  }

  function syncFloatingDockSideFromViewport() {
    floatingDockSide = !isDifficultyImportButtonTopVisible() ? "top" : "bottom";
    lastScrollY = window.scrollY;
    syncFloatingDockClass();
  }

  function freezeFloatingFilterPosition() {
    if (!isMobileViewport() || !nodes.floatingAxisFilter) {
      return;
    }

    const rect = nodes.floatingAxisFilter.getBoundingClientRect();
    nodes.floatingAxisFilter.style.position = "";
    nodes.floatingAxisFilter.style.top = `${Math.max(16, rect.top)}px`;
    nodes.floatingAxisFilter.style.bottom = "auto";
  }

  function pinFloatingFilterToDocument() {
    if (!isMobileViewport() || !nodes.floatingAxisFilter) {
      return;
    }

    const rect = nodes.floatingAxisFilter.getBoundingClientRect();
    nodes.floatingAxisFilter.style.position = "absolute";
    nodes.floatingAxisFilter.style.top = `${window.scrollY + rect.top}px`;
    nodes.floatingAxisFilter.style.bottom = "auto";
    nodes.floatingAxisFilter.style.left = "16px";
    nodes.floatingAxisFilter.style.right = "16px";
    nodes.floatingAxisFilter.style.width = "auto";
  }

  function releaseFloatingFilterPosition() {
    if (!nodes.floatingAxisFilter) {
      return;
    }

    nodes.floatingAxisFilter.style.position = "";
    nodes.floatingAxisFilter.style.top = "";
    nodes.floatingAxisFilter.style.bottom = "";
    nodes.floatingAxisFilter.style.left = "";
    nodes.floatingAxisFilter.style.right = "";
    nodes.floatingAxisFilter.style.width = "";
  }

  function setButtonLoading(button, isLoading, loadingText = "読み込み中...") {
    if (!button) {
      return;
    }

    if (isLoading) {
      if (!("originalText" in button.dataset)) {
        button.dataset.originalText = button.textContent ?? "";
      }

      button.disabled = true;
      button.textContent = loadingText;
      button.classList.add("is-busy");
      return;
    }

    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    button.classList.remove("is-busy");
    delete button.dataset.originalText;
  }

  function lockHeroButtonsExcept(activeButton) {
    document.querySelectorAll(".hero-actions .button").forEach((button) => {
      if (button.id === "theme-toggle-button") {
        return;
      }

      if (button === activeButton) {
        return;
      }

      if ("disabled" in button) {
        button.disabled = true;
      }

      button.classList.add("is-locked");
      button.setAttribute("aria-disabled", "true");
    });
  }

  function clearHeroButtonStates() {
    document.querySelectorAll(".hero-actions .button").forEach((button) => {
      if ("disabled" in button) {
        button.disabled = false;
      }

      button.classList.remove("is-busy", "is-locked");
      button.removeAttribute("aria-disabled");

      if ("originalText" in button.dataset) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    });
  }

  function getCatalogNumberShortcutIndex(event) {
    if (event.key >= "1" && event.key <= "9") {
      return Number(event.key) - 1;
    }

    if (event.key === "0") {
      return 9;
    }

    return -1;
  }

  function selectCatalogSongByShortcut(index) {
    const snapshot = store.getSnapshot();
    const song = snapshot.pagedSongs[index];

    if (!song) {
      return false;
    }

    store.selectSong(song.title, song.catalogItemKey || `title:${song.title}`);

    window.requestAnimationFrame(() => {
      nodes.lampInput?.focus({ preventScroll: true });
    });

    // ショートカット操作時はスクロールしない
    // window.requestAnimationFrame(scrollEntryPanelIntoView);
    return true;
  }  

  const nodes = {
    summaryPanel: document.querySelector("#summary-cards")?.closest(".panel"),
    summary: document.querySelector("#summary-cards"),
    summaryFiltersToggle: document.querySelector("#summary-filters-toggle"),
    summaryFiltersPanel: document.querySelector("#summary-filters-panel"),
    floatingAxisFilter: document.querySelector("#floating-axis-filter"),
    catalogPanel: document.querySelector("#song-catalog")?.closest(".panel"),
    catalogSortSelect: document.querySelector("#catalog-sort-select"),
    catalogViewToggle: document.querySelector("#catalog-view-toggle"),
    catalogMeta: document.querySelector("#catalog-meta"),
    catalogPaginationTop: document.querySelector("#catalog-pagination-top"),
    catalogPaginationBottom: document.querySelector("#catalog-pagination-bottom"),
    catalog: document.querySelector("#song-catalog"),
    themeToggleButton: document.querySelector("#theme-toggle-button"),
    selectedSong: document.querySelector("#selected-song"),
    recordForm: document.querySelector("#record-form"),
    recordDate: document.querySelector("#record-date"),
    lampInput: document.querySelector("#lamp-input"),
    bpInput: document.querySelector("#bp-input"),
    badInput: document.querySelector("#bad-input"),
    poorInput: document.querySelector("#poor-input"),
    bpInputPanels: document.querySelectorAll("[data-bp-input-panel]"),
    bpInputModeButtons: document.querySelectorAll("[data-bp-input-mode]"),
    scoreInput: document.querySelector("#score-input"),
    memoInput: document.querySelector("#memo-input"),
    backToCardButton: document.querySelector("#back-to-card-button"),
    difficultyImportButton: document.querySelector("#difficulty-import-button"),
    csvImportButton: document.querySelector("#csv-import-button"),
    importButton: document.querySelector("#import-button"),
    exportButton: document.querySelector("#export-button"),
    csvExportButton: document.querySelector("#csv-export-button"),
    clearAllButton: document.querySelector("#clear-all-button"),
    csvImportFileInput: document.querySelector("#csv-import-file-input"),
    importFileInput: document.querySelector("#import-file-input"),
    chart: document.querySelector("#chart-container"),
    scoreChart: document.querySelector("#score-chart-container"),
    history: document.querySelector("#history-body"),
    sendJsonToIrTestButton: document.querySelector("#send-json-to-ir-test"),
  };

  nodes.summaryPanel?.classList.add("summary-overview-panel");

  function syncEntryBpInputMode() {
    nodes.bpInputPanels.forEach((panel) => {
      const active = panel.dataset.bpInputPanel === entryBpInputMode;
      panel.hidden = !active;
    });

    nodes.bpInputModeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.bpInputMode === entryBpInputMode));
    });
  }

  function setEntryBpInputMode(mode) {
    if (!ENTRY_BP_INPUT_MODES.has(mode) || mode === entryBpInputMode) {
      return;
    }

    entryBpInputMode = mode;
    persistEntryBpInputMode(entryBpInputMode);
    syncEntryBpInputMode();
  }

  function clearEntryBpInputs() {
    if (nodes.bpInput.value !== "") {
      nodes.bpInput.value = "";
    }
    if (nodes.badInput?.value !== "") {
      nodes.badInput.value = "";
    }
    if (nodes.poorInput?.value !== "") {
      nodes.poorInput.value = "";
    }
  }

  function parseSplitBpInputValue(input, label) {
    const rawValue = String(input?.value ?? "").trim();
    if (rawValue === "") {
      return { ok: true, value: null };
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0) {
      return { ok: false, message: `${label}は0以上の整数で入力してください。` };
    }

    return { ok: true, value };
  }

  function getEntryBpValue() {
    if (entryBpInputMode !== "split") {
      return { ok: true, value: nodes.bpInput.value };
    }

    const badResult = parseSplitBpInputValue(nodes.badInput, "BAD");
    if (!badResult.ok) {
      return badResult;
    }

    const poorResult = parseSplitBpInputValue(nodes.poorInput, "POOR");
    if (!poorResult.ok) {
      return poorResult;
    }

    const hasBad = badResult.value !== null;
    const hasPoor = poorResult.value !== null;

    if (hasBad !== hasPoor) {
      return { ok: false, message: "BADとPOORは両方入力するか、両方空にしてください。" };
    }

    return {
      ok: true,
      value: hasBad && hasPoor ? badResult.value + poorResult.value : "",
    };
  }

  nodes.lampInput.innerHTML = LAMP_OPTIONS.map((lamp) => `<option value="${escapeHtml(lamp)}">${escapeHtml(lamp)}</option>`).join("");
  syncEntryBpInputMode();
  syncThemeToggleButton(nodes.themeToggleButton, getCurrentTheme());
  nodes.recordDate.value = formatIsoDate(todayIso());
  requestAnimationFrame(() => {
    syncFloatingDockSideFromViewport();
    requestAnimationFrame(syncFloatingDockSideFromViewport);
  });

  nodes.themeToggleButton?.addEventListener("click", () => {
    const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    persistTheme(nextTheme);
    syncThemeToggleButton(nodes.themeToggleButton, nextTheme);
  });

  window.addEventListener("resize", () => {
    if (activeChartResizeFrame !== null) {
      window.cancelAnimationFrame(activeChartResizeFrame);
    }

    activeChartResizeFrame = window.requestAnimationFrame(() => {
      renderBpChart(nodes.chart, latestChartHistory);
      renderScoreChart(nodes.scoreChart, latestChartHistory);
      syncFloatingDockClass();
      activeChartResizeFrame = null;
    });
  });

  document.addEventListener("wheel", (event) => {
    const input = event.target.closest('input[type="number"]');
    if (!input || document.activeElement !== input) {
      return;
    }

    event.preventDefault();
  }, { passive: false });

  window.addEventListener("scroll", () => {
    if (!isProgrammaticScroll) {
      lastUserScrollAt = performance.now();
    }
    
    if (isProgrammaticScroll) {
      return;
    }

    if (window.scrollY <= 0) {
      floatingDockSide = "bottom";
      lastScrollY = window.scrollY;
      syncFloatingDockClass();
      return;
    }

    if (!isDifficultyImportButtonTopVisible()) {
      floatingDockSide = "top";
      lastScrollY = window.scrollY;
      syncFloatingDockClass();
      return;
    }

    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    if (Math.abs(delta) < 4) {
      return;
    }

    const direction = delta > 0 ? "down" : "up";
    const now = performance.now();
    if (scrollDirectionStreak !== direction) {
      scrollDirectionStreak = direction;
      scrollDirectionDistance = 0;
    }

    scrollDirectionDistance += Math.abs(delta);
    scrollDirectionTimestamp = now;

    if (scrollDirectionDistance >= 72) {
      floatingDockSide = direction === "down" ? "top" : "bottom";
      scrollDirectionDistance = 0;
    }

    lastScrollY = currentScrollY;
    syncFloatingDockClass();
  }, { passive: true });

  function readFiltersFromPanel() {
    const panel = nodes.summaryFiltersPanel;
    const currentFilters = filterDraft ?? store.getSnapshot().filters;
    const recommendInputs = Array.from(panel.querySelectorAll('input[data-filter="recommend"]'));
    const selectedRecommend = recommendInputs.some((input) => input.disabled)
      ? [...(currentFilters.recommend ?? RECOMMEND_OPTIONS.map((option) => option.value))]
      : recommendInputs.filter((input) => input.checked).map((input) => input.value);
    const chartDifficultyInputs = Array.from(panel.querySelectorAll('input[data-filter="chartDifficulty"]'));
    const selectedChartDifficulties = chartDifficultyInputs.some((input) => input.disabled)
      ? [...(currentFilters.chartDifficulties ?? CHART_DIFFICULTY_OPTIONS)]
      : chartDifficultyInputs.filter((input) => input.checked).map((input) => input.value);
    const readSelectFilter = (name, fallback = "all") => {
      const select = panel.querySelector(`select[data-filter="${name}"]`);
      if (!(select instanceof HTMLSelectElement) || select.disabled) {
        return currentFilters[name] ?? fallback;
      }

      return select.value;
    };
    const songDataSelect = panel.querySelector('select[data-filter="songData"]');
    const songDataFilter = (songDataSelect instanceof HTMLSelectElement && !songDataSelect.disabled)
      ? getSongDataFilterOption(songDataSelect.value)
      : {
          inf: currentFilters.inf ?? "all",
          acdelete: currentFilters.acdelete ?? "all",
        };

    return {
      axisMode: currentFilters.axisMode ?? "level",
      axisValue: currentFilters.axisValue ?? "",
      titleQuery: currentFilters.titleQuery ?? "",
      dateSelectionMode: currentFilters.dateSelectionMode ?? "single",
      dateSingle: currentFilters.dateSingle ?? todayIso(),
      dateStart: currentFilters.dateStart ?? "",
      dateEnd: currentFilters.dateEnd ?? "",
      axisRangeModeByAxis: currentFilters.axisRangeModeByAxis,
      axisRanges: currentFilters.axisRanges,
      axisLastRanges: currentFilters.axisLastRanges,
      axisSingleReturnValues: currentFilters.axisSingleReturnValues,
      inf: songDataFilter.inf,
      acdelete: songDataFilter.acdelete,
      recommend: selectedRecommend,
      chartDifficulties: selectedChartDifficulties,
      lamps: currentFilters.lamps ? [...currentFilters.lamps] : [...LAMP_OPTIONS],
      includeUnrated: readSelectFilter("includeUnrated"),
    };
  }

  function applyDifficultyFilters(nextFilters, options = {}) {
    store.setDifficultyFilters(nextFilters);
    const activeAxisMode = nextFilters.axisMode ?? store.getSnapshot().filters.axisMode;
    const shouldScroll = options.scrollToCatalog ?? (
      isTextAxisMode(activeAxisMode)
        ? canAutoScrollElement(nodes.catalogPanel ?? nodes.catalog)
        : canAutoScrollElementUpward(nodes.catalogPanel ?? nodes.catalog)
    );
    if (shouldScroll) {
      window.requestAnimationFrame(scrollCatalogPanelIntoView);
    }
  }

  function previewFloatingAxisSliderBy(delta) {
    const activeFilters = filterDraft ?? store.getSnapshot().filters;

    if (!floatingFilterOpen || isTextAxisMode(activeFilters.axisMode) || isDateAxisMode(activeFilters.axisMode)) {
      return false;
    }

    const slider = nodes.floatingAxisFilter.querySelector("input[data-axis-slider]");
    if (!(slider instanceof HTMLInputElement) || slider.disabled) {
      return false;
    }

    const axisValues = getAxisValues(latestFilterBounds, activeFilters.axisMode);
    const sliderStops = ["", ...axisValues];

    if (sliderStops.length <= 1) {
      return false;
    }

    const currentIndex = Number(slider.value);
    if (!Number.isFinite(currentIndex)) {
      return false;
    }

    const nextIndex = Math.max(0, Math.min(currentIndex + delta, sliderStops.length - 1));
    if (nextIndex === currentIndex) {
      return true;
    }

    return previewFloatingAxisSliderToIndex(activeFilters.axisMode, nextIndex);
  }
  
  function commitFloatingAxisSliderShortcut() {
    if (!floatingAxisShortcutPending) {
      return false;
    }

    const activeFilters = filterDraft ?? store.getSnapshot().filters;

    if (floatingAxisPreviewMode !== activeFilters.axisMode) {
      floatingAxisShortcutPending = false;
      floatingAxisPreviewMode = null;
      floatingAxisPreviewValue = null;
      return false;
    }

    const committedValue = floatingAxisPreviewValue === "" ? "" : String(floatingAxisPreviewValue);
    rememberFloatingAxisValue(activeFilters.axisMode, committedValue);

    floatingAxisShortcutPending = false;
    floatingAxisPreviewMode = null;
    floatingAxisPreviewValue = null;

    applyDifficultyFilters({ axisValue: committedValue }, { scrollToCatalog: false });
    return true;
  }  
  
  function switchFloatingAxisByShortcut(axisMode) {
    if (!AXIS_OPTIONS.some((option) => option.value === axisMode)) {
      return false;
    }

    const wasOpen = floatingFilterOpen;
    const { filters } = store.getSnapshot();
    const isSameAxis = wasOpen && filters.axisMode === axisMode;

    if (!floatingFilterOpen) {
      floatingFilterOpen = true;
      renderFloatingFilterShell();
      syncQueryScrollLockState();
    }

    if (isSameAxis && isNumericAxisMode(axisMode)) {
      toggleAxisRangeMode(axisMode);
      return true;
    }

    if (isSameAxis && isDateAxisMode(axisMode)) {
      toggleDateSelectionMode();
      return true;
    }

    if (filters.axisMode === axisMode) {
      focusFloatingAxisControl(axisMode);
      return true;
    }

    floatingFilterOpen = true;
    floatingQueryRestoreFocus = isTextAxisMode(axisMode);
    floatingQuerySelection = null;
    pendingQueryBlurIntent = null;
    floatingAxisPreviewMode = null;
    floatingAxisPreviewValue = null;

    const nextFilters = { axisMode };
    if (isNumericAxisMode(axisMode) && isAxisRangeMode({ ...filters, axisMode })) {
      const axisValues = getAxisValues(latestFilterBounds, axisMode);
      const rawRange = filters.axisRanges?.[axisMode] ?? { start: "", end: "" };
      const startIndex = axisValues.findIndex((value) => String(value) === String(rawRange.start));
      const endIndex = axisValues.findIndex((value) => String(value) === String(rawRange.end));
      if (axisValues.length && (startIndex < 0 || endIndex < 0 || startIndex > endIndex)) {
        nextFilters.axisRanges = {
          ...filters.axisRanges,
          [axisMode]: {
            start: String(axisValues[0]),
            end: String(axisValues[axisValues.length - 1]),
          },
        };
      }
    }

    applyFiltersPreservingOverviewPosition(nextFilters, { scrollToCatalog: false });

    return true;
  }  

  function toggleAxisRangeMode(axisMode) {
    if (!isNumericAxisMode(axisMode)) {
      return false;
    }

    const { filters } = store.getSnapshot();
    const axisValues = getAxisValues(latestFilterBounds, axisMode);
    if (!axisValues.length) {
      return false;
    }

    const enabled = isAxisRangeMode({ ...filters, axisMode });
    floatingAxisPreviewMode = null;
    floatingAxisPreviewValue = null;
    floatingAxisRangePreviewMode = null;
    floatingAxisRangePreviewValue = null;
    floatingAxisRangeShortcutPending = false;

    if (!enabled) {
      const currentRange = getNormalizedAxisRange(filters, axisValues);
      const range = currentRange.valid ? currentRange : {
        start: String(axisValues[0]),
        end: String(axisValues[axisValues.length - 1]),
      };
      applyFiltersPreservingOverviewPosition({
        axisValue: "",
        axisRangeModeByAxis: {
          ...filters.axisRangeModeByAxis,
          [axisMode]: true,
        },
        axisRanges: {
          ...filters.axisRanges,
          [axisMode]: { start: range.start, end: range.end },
        },
        axisSingleReturnValues: {
          ...filters.axisSingleReturnValues,
          [axisMode]: filters.axisValue ?? "",
        },
      }, { scrollToCatalog: false });
      return true;
    }

    const returnValue = filters.axisSingleReturnValues?.[axisMode] ?? "";
    applyFiltersPreservingOverviewPosition({
      axisValue: returnValue === "" || hasAxisValue(axisMode, returnValue) ? returnValue : "",
      axisRangeModeByAxis: {
        ...filters.axisRangeModeByAxis,
        [axisMode]: false,
      },
    }, { scrollToCatalog: false });
    return true;
  }

  function applyTitleQueryFilter(input, options = {}) {
    floatingQuerySelection = {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
    };
    floatingQueryRestoreFocus = options.keepFocus ?? true;
    applyDifficultyFilters(
      { titleQuery: input.value, axisValue: "" },
      { scrollToCatalog: options.scrollToCatalog ?? false },
    );
  }

  function isDateFilterInput(element) {
    return element instanceof HTMLInputElement
      && (
        element.hasAttribute("data-date-single")
        || element.hasAttribute("data-date-start")
        || element.hasAttribute("data-date-end")
      );
  }

  function applyDateFilter() {
    const activeFilters = filterDraft ?? store.getSnapshot().filters;
    const dateSelectionMode = activeFilters.dateSelectionMode === "range" ? "range" : "single";
    applyFiltersPreservingOverviewPosition({
      axisMode: "date",
      axisValue: "",
      dateSelectionMode,
      dateSingle: nodes.floatingAxisFilter.querySelector("[data-date-single]")?.value ?? activeFilters.dateSingle ?? todayIso(),
      dateStart: nodes.floatingAxisFilter.querySelector("[data-date-start]")?.value ?? activeFilters.dateStart ?? "",
      dateEnd: nodes.floatingAxisFilter.querySelector("[data-date-end]")?.value ?? activeFilters.dateEnd ?? "",
    });
  }

  function shiftIsoDate(isoDate, delta) {
    const base = String(isoDate || todayIso());
    const date = new Date(`${base}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return todayIso();
    }

    date.setDate(date.getDate() + delta);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function shiftHistoryDate(isoDate, delta) {
    if (!latestHistoryDates.length) {
      return shiftIsoDate(isoDate, delta);
    }

    const base = String(isoDate || todayIso());
    const direction = delta < 0 ? -1 : 1;
    let index = latestHistoryDates.indexOf(base);

    if (index < 0) {
      index = direction < 0
        ? latestHistoryDates.findLastIndex((date) => date <= base)
        : latestHistoryDates.findIndex((date) => date >= base);

      if (index < 0) {
        index = direction < 0 ? 0 : latestHistoryDates.length - 1;
      }
    } else {
      index += direction;
    }

    index = Math.max(0, Math.min(index, latestHistoryDates.length - 1));
    return latestHistoryDates[index] ?? base;
  }

  function updateFloatingDateDisplay(filters) {
    const valueNode = nodes.floatingAxisFilter.querySelector(".floating-filter-date-summary span");
    if (valueNode) {
      valueNode.textContent = formatDateRangeValue(filters);
    }

    const singleInput = nodes.floatingAxisFilter.querySelector("input[data-date-single]");
    if (singleInput instanceof HTMLInputElement) {
      singleInput.value = filters.dateSingle || todayIso();
    }

    const startInput = nodes.floatingAxisFilter.querySelector("input[data-date-start]");
    if (startInput instanceof HTMLInputElement) {
      startInput.value = filters.dateStart || "";
    }

    const endInput = nodes.floatingAxisFilter.querySelector("input[data-date-end]");
    if (endInput instanceof HTMLInputElement) {
      endInput.value = filters.dateEnd || "";
    }
  }

  function previewFloatingDateBy(delta, handle) {
    const activeFilters = filterDraft ?? store.getSnapshot().filters;
    if (!floatingFilterOpen || !isDateAxisMode(activeFilters.axisMode)) {
      return false;
    }

    const baseFilters = floatingDatePreviewValue ?? activeFilters;
    let nextFilters;

    if (baseFilters.dateSelectionMode === "range") {
      const activeHandle = handle === "end" ? "end" : "start";
      const currentStart = baseFilters.dateStart || todayIso();
      const currentEnd = baseFilters.dateEnd || todayIso();
      let nextStart = currentStart;
      let nextEnd = currentEnd;

      if (activeHandle === "end") {
        nextEnd = shiftHistoryDate(currentEnd, delta);
        if (nextEnd < nextStart) {
          nextEnd = nextStart;
        }
      } else {
        nextStart = shiftHistoryDate(currentStart, delta);
        if (nextStart > nextEnd) {
          nextStart = nextEnd;
        }
      }

      nextFilters = {
        ...baseFilters,
        dateSelectionMode: "range",
        dateStart: nextStart,
        dateEnd: nextEnd,
      };
    } else {
      nextFilters = {
        ...baseFilters,
        dateSelectionMode: "single",
        dateSingle: shiftHistoryDate(baseFilters.dateSingle || todayIso(), delta),
      };
    }

    floatingDatePreviewValue = nextFilters;
    floatingDateShortcutPending = true;
    updateFloatingDateDisplay(nextFilters);
    return true;
  }

  function commitFloatingDateShortcut() {
    if (!floatingDateShortcutPending || !floatingDatePreviewValue) {
      return false;
    }

    const nextFilters = floatingDatePreviewValue;
    floatingDateShortcutPending = false;
    floatingDatePreviewValue = null;
    applyFiltersPreservingOverviewPosition({
      axisMode: "date",
      axisValue: "",
      dateSelectionMode: nextFilters.dateSelectionMode,
      dateSingle: nextFilters.dateSingle || todayIso(),
      dateStart: nextFilters.dateStart || "",
      dateEnd: nextFilters.dateEnd || "",
    }, { scrollToCatalog: false });
    return true;
  }

  function toggleDateSelectionMode() {
    const { filters } = store.getSnapshot();
    const nextMode = filters.dateSelectionMode === "single" ? "range" : "single";
    applyFiltersPreservingOverviewPosition({
      axisMode: "date",
      axisValue: "",
      dateSelectionMode: nextMode,
      dateSingle: filters.dateSingle || todayIso(),
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
    }, { scrollToCatalog: false });
  }

  function scheduleDateFilterCommitIfBlurred() {
    if (dateFilterCommitTimer !== null) {
      window.clearTimeout(dateFilterCommitTimer);
      dateFilterCommitTimer = null;
    }

    dateFilterCommitTimer = window.setTimeout(() => {
      dateFilterCommitTimer = null;

      if (isDateFilterInput(document.activeElement) && performance.now() < dateFilterKeyboardEditUntil) {
        return;
      }

      applyDateFilter();
    }, 150);
  }

  function renderFilterDraftPanel() {
    renderDifficultyFilters(nodes.summaryFiltersPanel, filterDraft);
    nodes.summaryFiltersPanel.classList.toggle("is-collapsed", !summaryFiltersOpen);
    if (nodes.summaryFiltersToggle) {
      nodes.summaryFiltersToggle.setAttribute("aria-expanded", summaryFiltersOpen ? "true" : "false");
      const label = nodes.summaryFiltersToggle.querySelector(".summary-filters-toggle-label");
      if (label) {
        label.textContent = summaryFiltersOpen ? "フィルタを閉じる" : "フィルタを表示";
      }
    }
  }

  nodes.summaryFiltersToggle?.addEventListener("click", () => {
    summaryFiltersOpen = !summaryFiltersOpen;
    renderFilterDraftPanel();
  });

  nodes.summaryFiltersPanel.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (!target.closest("[data-filter]")) {
      return;
    }

    filterDraft = readFiltersFromPanel();
    applyDifficultyFilters(filterDraft, { scrollToCatalog: false });
  });

  nodes.summaryFiltersPanel.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest("[data-filter]")) {
      filterDraft = readFiltersFromPanel();
      applyDifficultyFilters(filterDraft, { scrollToCatalog: false });
    }
  });

  nodes.summaryFiltersPanel.addEventListener("click", (event) => {
    const resetButton = event.target.closest('[data-filter-action="reset"]');

    if (!resetButton) {
      return;
    }

    filterDraft = {
      axisMode: filterDraft?.axisMode ?? "level",
      axisValue: filterDraft?.axisValue ?? "",
      titleQuery: filterDraft?.titleQuery ?? "",
      dateSelectionMode: filterDraft?.dateSelectionMode ?? "single",
      dateSingle: filterDraft?.dateSingle ?? todayIso(),
      dateStart: filterDraft?.dateStart ?? "",
      dateEnd: filterDraft?.dateEnd ?? "",
      inf: "all",
      acdelete: "all",
      recommend: ["", "△", "○", "◎", "☆"],
      chartDifficulties: ["B", "N", "H", "A", "L"],
      lamps: filterDraft?.lamps ? [...filterDraft.lamps] : [...LAMP_OPTIONS],
      includeUnrated: "all",
    };
    floatingAxisPreviewMode = null;
    floatingAxisPreviewValue = null;
    applyDifficultyFilters(filterDraft, { scrollToCatalog: false });
  });

  nodes.floatingAxisFilter.addEventListener("click", (event) => {
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest("[data-floating-toggle]")) {
      event.stopPropagation();
      toggleFloatingFilter();
      return;
    }

    if (target.closest("[data-floating-clear]")) {
      event.preventDefault();
      event.stopPropagation();
      const activeFilters = filterDraft ?? store.getSnapshot().filters;
      clearFloatingAxisFilter();
      if (!isTextAxisMode(activeFilters.axisMode) && !isDateAxisMode(activeFilters.axisMode)) {
        closeFloatingFilter({ preserveScroll: !shouldScrollCatalogPanelUpward() });
      }
      return;
    }

    if (target.closest("[data-date-reset]")) {
      event.preventDefault();
      event.stopPropagation();
      pendingQueryBlurIntent = "clear";
      const { filters, dateDefaultRange } = store.getSnapshot();
      const nextDateFilters = filters.dateSelectionMode === "single"
        ? { dateSelectionMode: "single", dateSingle: dateDefaultRange?.dateEnd || todayIso() }
        : { dateSelectionMode: "range", ...dateDefaultRange };
      applyFiltersPreservingOverviewPosition({ axisMode: "date", axisValue: "", ...nextDateFilters }, { scrollToCatalog: false });
      return;
    }

    if (target.closest("[data-date-mode-toggle]")) {
      event.preventDefault();
      event.stopPropagation();
      toggleDateSelectionMode();
      return;
    }

    if (target.closest("[data-axis-range-toggle]")) {
      event.preventDefault();
      event.stopPropagation();
      const activeFilters = filterDraft ?? store.getSnapshot().filters;
      toggleAxisRangeMode(activeFilters.axisMode);
      return;
    }
  });

  nodes.floatingAxisFilter.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const singleWrap = target.closest(".floating-filter-single-wrap");
    if (singleWrap instanceof HTMLElement) {
      event.preventDefault();

      const activeFilters = filterDraft ?? store.getSnapshot().filters;
      const slider = singleWrap.querySelector("input[data-axis-slider]");

      if (!(slider instanceof HTMLInputElement) || slider.disabled) {
        return;
      }

      const pointerIndex = getFloatingAxisSinglePointerIndex(event, singleWrap);

      floatingAxisSingleDragState = {
        axisMode: activeFilters.axisMode,
        sliderWrap: singleWrap,
        pointerId: event.pointerId,
      };

      singleWrap.setPointerCapture?.(event.pointerId);
      previewFloatingAxisSliderToIndex(activeFilters.axisMode, pointerIndex);
      return;
    }    

    const rangeWrap = target.closest(".floating-filter-range-wrap");
    if (rangeWrap instanceof HTMLElement) {
      event.preventDefault();
      const activeFilters = filterDraft ?? store.getSnapshot().filters;
      const range = floatingAxisRangePreviewMode === activeFilters.axisMode && floatingAxisRangePreviewValue
        ? floatingAxisRangePreviewValue
        : getActiveAxisRange(activeFilters);
      const pointerIndex = getFloatingAxisRangePointerIndex(event, rangeWrap);
      const handle = range.startIndex === range.endIndex
        ? "auto"
        : Math.abs(pointerIndex - range.startIndex) <= Math.abs(pointerIndex - range.endIndex) ? "start" : "end";
      floatingAxisRangeDragState = {
        axisMode: activeFilters.axisMode,
        handle,
        rangeWrap,
        pointerId: event.pointerId,
      };
      rangeWrap.setPointerCapture?.(event.pointerId);
      const activeHandle = previewFloatingAxisRangeToIndex(activeFilters.axisMode, pointerIndex, handle);
      if (activeHandle && !(handle === "auto" && pointerIndex === range.startIndex)) {
        floatingAxisRangeDragState.handle = activeHandle;
      }
      return;
    }  

    if (target.closest("[data-axis-mode]")) {
      pendingQueryBlurIntent = "axis-mode";
    
      if (!isHoverNoneEnvironment() && performance.now() - lastUserScrollAt < 450) {
        event.preventDefault();
        return;
      }
    
      return;
    }

    pendingQueryBlurIntent = null;
  });

  nodes.floatingAxisFilter.addEventListener("pointermove", (event) => {
    if (floatingAxisSingleDragState) {
      event.preventDefault();

      const { axisMode, sliderWrap } = floatingAxisSingleDragState;
      const pointerIndex = getFloatingAxisSinglePointerIndex(event, sliderWrap);
      previewFloatingAxisSliderToIndex(axisMode, pointerIndex);
      return;
    }

    if (!floatingAxisRangeDragState) {
      return;
    }

    event.preventDefault();
    const { axisMode, handle, rangeWrap } = floatingAxisRangeDragState;
    const pointerIndex = getFloatingAxisRangePointerIndex(event, rangeWrap);
    const range = floatingAxisRangePreviewMode === axisMode && floatingAxisRangePreviewValue
      ? floatingAxisRangePreviewValue
      : getActiveAxisRange({ ...(filterDraft ?? store.getSnapshot().filters), axisMode });
    const activeHandle = previewFloatingAxisRangeToIndex(axisMode, pointerIndex, handle);
    if (handle === "auto" && activeHandle && pointerIndex !== range.startIndex) {
      floatingAxisRangeDragState.handle = activeHandle;
    }
  });

  nodes.floatingAxisFilter.addEventListener("pointerup", (event) => {
    if (floatingAxisSingleDragState) {
      event.preventDefault();

      releaseFloatingAxisSinglePointerCapture();
      floatingAxisSingleDragState = null;

      const shouldScroll = shouldScrollCatalogPanelUpward();
      if (commitFloatingAxisSliderShortcut() && shouldScroll) {
        window.requestAnimationFrame(scrollCatalogPanelIntoView);
      }

      return;
    }

    if (floatingAxisRangeDragState) {
      event.preventDefault();

      releaseFloatingAxisRangePointerCapture();
      floatingAxisRangeDragState = null;

      const shouldScroll = shouldScrollCatalogPanelUpward();
      if (commitFloatingAxisRange() && shouldScroll) {
        window.requestAnimationFrame(scrollCatalogPanelIntoView);
      }

      return;
    }
  });

  nodes.floatingAxisFilter.addEventListener("pointercancel", (event) => {
    if (floatingAxisSingleDragState) {
      event.preventDefault();

      releaseFloatingAxisSinglePointerCapture();
      floatingAxisSingleDragState = null;
      floatingAxisPreviewMode = null;
      floatingAxisPreviewValue = null;
      renderFloatingFilterShell();
      return;
    }

    if (!floatingAxisRangeDragState) {
      return;
    }

    event.preventDefault();
    releaseFloatingAxisRangePointerCapture();
    floatingAxisRangeDragState = null;
    floatingAxisRangePreviewMode = null;
    floatingAxisRangePreviewValue = null;
    floatingAxisRangeShortcutPending = false;
    renderFloatingFilterShell();
  });

  nodes.floatingAxisFilter.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target instanceof HTMLInputElement
      && (target.hasAttribute("data-axis-range-start") || target.hasAttribute("data-axis-range-end"))
    ) {
      const activeFilters = filterDraft ?? store.getSnapshot().filters;
      const axisValues = getAxisValues(latestFilterBounds, activeFilters.axisMode);
      const currentRange = floatingAxisRangePreviewMode === activeFilters.axisMode && floatingAxisRangePreviewValue
        ? floatingAxisRangePreviewValue
        : getActiveAxisRange(activeFilters);
      let startIndex = currentRange.startIndex;
      let endIndex = currentRange.endIndex;

      if (target.hasAttribute("data-axis-range-start")) {
        startIndex = Math.min(Number(target.value), endIndex);
        floatingAxisRangeActiveHandleByAxis[activeFilters.axisMode] = "start";
      } else {
        endIndex = Math.max(Number(target.value), startIndex);
        floatingAxisRangeActiveHandleByAxis[activeFilters.axisMode] = "end";
      }

      const nextRange = {
        start: String(axisValues[startIndex] ?? ""),
        end: String(axisValues[endIndex] ?? ""),
        startIndex,
        endIndex,
        valid: axisValues.length > 0,
      };
      floatingAxisRangePreviewMode = activeFilters.axisMode;
      floatingAxisRangePreviewValue = nextRange;
      floatingAxisRangeShortcutPending = true;
      updateFloatingRangeDisplay(activeFilters.axisMode, nextRange);
      return;
    }

    if (target instanceof HTMLInputElement && target.hasAttribute("data-axis-slider")) {
      const activeFilters = filterDraft ?? store.getSnapshot().filters;
      const axisValues = getAxisValues(latestFilterBounds, activeFilters.axisMode);
      const sliderStops = ["", ...axisValues];
      const index = Number(target.value);
      const nextValue = sliderStops[index] ?? "";
      const previewValue = nextValue === "" ? "" : String(nextValue);

      floatingAxisPreviewMode = activeFilters.axisMode;
      floatingAxisPreviewValue = previewValue;

      updateFloatingSingleSliderDisplay(activeFilters.axisMode, Number.isFinite(index) ? index : 0, previewValue);
      return;
    }

    if (target instanceof HTMLInputElement && target.hasAttribute("data-axis-query")) {
      floatingQuerySelection = {
        start: target.selectionStart ?? target.value.length,
        end: target.selectionEnd ?? target.value.length,
      };
    }
  });

  nodes.floatingAxisFilter.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target instanceof HTMLInputElement
      && (target.hasAttribute("data-axis-range-start") || target.hasAttribute("data-axis-range-end"))
    ) {
      commitFloatingAxisRange();
      return;
    }

    if (target instanceof HTMLInputElement && target.hasAttribute("data-axis-slider")) {
      const activeFilters = filterDraft ?? store.getSnapshot().filters;
      const committedValue = floatingAxisPreviewMode === activeFilters.axisMode
        ? floatingAxisPreviewValue
        : ["", ...getAxisValues(latestFilterBounds, activeFilters.axisMode)][Number(target.value)] ?? "";
      const nextAxisValue = committedValue === "" ? "" : String(committedValue);
      rememberFloatingAxisValue(activeFilters.axisMode, nextAxisValue);
      floatingAxisPreviewMode = null;
      floatingAxisPreviewValue = null;
      if (shouldCloseFloatingFilterAfterSliderCommit()) {
        floatingQueryFocused = false;
        floatingFilterOpen = false;
        syncQueryScrollLockState();
      }
      applyDifficultyFilters({ axisValue: nextAxisValue });
      return;
    }

    if (target instanceof HTMLInputElement && target.hasAttribute("data-axis-query")) {
      floatingQuerySelection = {
        start: target.selectionStart ?? target.value.length,
        end: target.selectionEnd ?? target.value.length,
      };
      return;
    }

    if (isDateFilterInput(target)) {
      scheduleDateFilterCommitIfBlurred();
      return;
    }

    if (target instanceof HTMLSelectElement && target.hasAttribute("data-axis-mode")) {
      const nextAxisMode = target.value;
      if (floatingAxisModeCommitTimer !== null) {
        window.clearTimeout(floatingAxisModeCommitTimer);
        floatingAxisModeCommitTimer = null;
      }

      floatingAxisModeCommitTimer = window.setTimeout(() => {
        floatingAxisModeCommitTimer = null;
        pendingQueryBlurIntent = null;
        floatingAxisPreviewMode = null;
        floatingAxisPreviewValue = null;
        floatingQueryFocused = false;
        syncQueryScrollLockState();
        const currentFilters = store.getSnapshot().filters;
        const nextAxisFilters = { axisMode: nextAxisMode };
        if (isNumericAxisMode(nextAxisMode) && isAxisRangeMode({ ...currentFilters, axisMode: nextAxisMode })) {
          const axisValues = getAxisValues(latestFilterBounds, nextAxisMode);
          const rawRange = currentFilters.axisRanges?.[nextAxisMode] ?? { start: "", end: "" };
          const startIndex = axisValues.findIndex((value) => String(value) === String(rawRange.start));
          const endIndex = axisValues.findIndex((value) => String(value) === String(rawRange.end));
          if (axisValues.length && (startIndex < 0 || endIndex < 0 || startIndex > endIndex)) {
            nextAxisFilters.axisRanges = {
              ...currentFilters.axisRanges,
              [nextAxisMode]: {
                start: String(axisValues[0]),
                end: String(axisValues[axisValues.length - 1]),
              },
            };
          }
        }
        applyFiltersPreservingOverviewPosition(nextAxisFilters);
      }, 0);
    }
  });

  nodes.floatingAxisFilter.addEventListener("pointerup", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.hasAttribute("data-axis-slider")) {
      return;
    }

    const activeFilters = filterDraft ?? store.getSnapshot().filters;
    if (floatingAxisPreviewMode !== activeFilters.axisMode) {
      return;
    }

    const committedValue = floatingAxisPreviewMode === activeFilters.axisMode
      ? floatingAxisPreviewValue
      : ["", ...getAxisValues(latestFilterBounds, activeFilters.axisMode)][Number(target.value)] ?? "";
    const nextAxisValue = committedValue === "" ? "" : String(committedValue);

    if (String(nextAxisValue ?? "") !== String(activeFilters.axisValue ?? "")) {
      return;
    }

    rememberFloatingAxisValue(activeFilters.axisMode, nextAxisValue);
    floatingAxisPreviewMode = null;
    floatingAxisPreviewValue = null;

    if (shouldCloseFloatingFilterAfterSliderCommit()) {
      floatingQueryFocused = false;
      floatingFilterOpen = false;
      syncQueryScrollLockState();
    }

    applyDifficultyFilters({ axisValue: nextAxisValue });
  });

  nodes.floatingAxisFilter.addEventListener("search", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.hasAttribute("data-axis-query")) {
      return;
    }

    if (floatingQueryComposing) {
      return;
    }

    floatingQuerySelection = {
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    };

    if (target.value === "") {
      applyTitleQueryFilter(target, { keepFocus: true, scrollToCatalog: false });
    }
  });

  nodes.floatingAxisFilter.addEventListener("keydown", (event) => {
    const target = event.target;
    if (isDateFilterInput(target)) {
      dateFilterKeyboardEditUntil = performance.now() + 900;
      if (event.key === "Enter" && !event.isComposing) {
        target.blur();
      }
      return;
    }

    if (!(target instanceof HTMLInputElement) || !target.hasAttribute("data-axis-query")) {
      return;
    }

    if (event.key !== "Enter" || event.isComposing || floatingQueryComposing) {
      return;
    }

    target.blur();
  });

  nodes.floatingAxisFilter.addEventListener("compositionstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.hasAttribute("data-axis-query")) {
      return;
    }

    floatingQueryComposing = true;
  });

  nodes.floatingAxisFilter.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!isTitleQueryElement(target)) {
      return;
    }

    floatingQueryFocused = true;
    floatingQueryRestoreFocus = false;
    syncQueryScrollLockState();
  });

  nodes.floatingAxisFilter.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!isTitleQueryElement(target)) {
      return;
    }

    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      syncQueryScrollLockState();
      if (isTitleQueryElement(activeElement)) {
        return;
      }

      if (activeElement instanceof HTMLSelectElement && activeElement.hasAttribute("data-axis-mode")) {
        return;
      }

      if (floatingQueryRestoreFocus) {
        return;
      }

      if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest("[data-floating-clear]")) {
        return;
      }

      if (pendingQueryBlurIntent === "clear") {
        pendingQueryBlurIntent = null;
        return;
      }

      if (pendingQueryBlurIntent === "escape") {
        pendingQueryBlurIntent = null;
        return;
      }

      applyTitleQueryFilter(target, { keepFocus: false, scrollToCatalog: false });
      closeFloatingFilter({ preserveScroll: false });
    });
  });

  nodes.floatingAxisFilter.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!isDateFilterInput(target)) {
      return;
    }

    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (isDateFilterInput(activeElement)) {
        return;
      }

      if (dateFilterCommitTimer !== null) {
        window.clearTimeout(dateFilterCommitTimer);
        dateFilterCommitTimer = null;
      }

      if (pendingQueryBlurIntent === "escape") {
        pendingQueryBlurIntent = null;
        return;
      }

      applyDateFilter();
    });
  });

  nodes.floatingAxisFilter.addEventListener("compositionend", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.hasAttribute("data-axis-query")) {
      return;
    }

    floatingQueryComposing = false;
  });

  function applySummaryLampVisualState(activeLamps) {
    const activeSet = new Set(activeLamps);
  
    nodes.summary.querySelectorAll("[data-summary-lamp]").forEach((button) => {
      const lamp = button.dataset.summaryLamp;
      const isActive = activeSet.has(lamp);
  
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("is-inactive", !isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }
  
  function deferDifficultyFilters(nextFilters, options = {}) {
    deferredFilterRevision += 1;
    const revision = deferredFilterRevision;
  
    if (deferredFilterTimer !== null) {
      window.clearTimeout(deferredFilterTimer);
      deferredFilterTimer = null;
    }
  
    deferredFilterTimer = window.setTimeout(() => {
      deferredFilterTimer = null;
  
      if (revision !== deferredFilterRevision) {
        return;
      }
  
      applyDifficultyFilters(nextFilters, options);
    }, 300);
  }  

  function clearFloatingAxisFilter() {
    const activeFilters = filterDraft ?? store.getSnapshot().filters;
    pendingQueryBlurIntent = "clear";

    if (isTextAxisMode(activeFilters.axisMode)) {
      store.clearTitleFilter();
      closeFloatingFilter({
        preserveScroll: !shouldScrollCatalogPanelUpward(),
      });
      return;
    }

    if (isDateAxisMode(activeFilters.axisMode)) {
      store.clearDateFilter();
      closeFloatingFilter({
        preserveScroll: !shouldScrollCatalogPanelUpward(),
      });
      return;
    }

    floatingAxisPreviewMode = null;
    floatingAxisPreviewValue = null;
    applyFiltersPreservingOverviewPosition({ axisValue: "" }, { scrollToCatalog: false });
  }

  function toggleSummaryLampFilter(lamp) {
    const currentLamps = filterDraft?.lamps ? [...filterDraft.lamps] : [...LAMP_OPTIONS];
    let nextLamps = currentLamps.includes(lamp)
      ? currentLamps.filter((value) => value !== lamp)
      : [...currentLamps, lamp];

    if (nextLamps.length === 0) {
      nextLamps = [...LAMP_OPTIONS];
    }

    filterDraft = {
      ...(filterDraft ?? store.getSnapshot().filters),
      lamps: nextLamps,
    };
    applySummaryLampVisualState(nextLamps);
    deferDifficultyFilters({ lamps: nextLamps }, { scrollToCatalog: false });
  }

  function soloSummaryLampFilter(lamp) {
    filterDraft = {
      ...(filterDraft ?? store.getSnapshot().filters),
      lamps: [lamp],
    };
    applySummaryLampVisualState([lamp]);
    deferDifficultyFilters({ lamps: [lamp] }, { scrollToCatalog: false });
  }

  function handleSummaryLampActivation(lamp, timestamp = performance.now()) {
    if (lastSummaryLampClick.lamp === lamp && timestamp - lastSummaryLampClick.timestamp <= SUMMARY_LAMP_DOUBLE_CLICK_MS) {
      filterDraft = {
        ...(filterDraft ?? store.getSnapshot().filters),
        lamps: [lamp],
      };
      applySummaryLampVisualState([lamp]);
      deferDifficultyFilters({ lamps: [lamp] }, { scrollToCatalog: false });
      lastSummaryLampClick = { lamp: "", timestamp: 0 };
      return;
    }

    lastSummaryLampClick = { lamp, timestamp };
    toggleSummaryLampFilter(lamp);
  }

  function getSummaryLampButton(target) {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const button = target.closest("[data-summary-lamp]");
    return button instanceof HTMLElement ? button : null;
  }

  function clearSummaryLampSwipeStyle(button) {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    button.style.transition = "";
    button.style.transform = "";
  }

  function animateSummaryLampSwipeReturn(button) {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const currentTransform = button.style.transform || "translateX(0)";
    button.style.transition = "none";
    button.style.transform = currentTransform;
    button.getBoundingClientRect();
    button.style.transition = "transform 180ms ease";
    button.style.transform = "translateX(0)";
    window.setTimeout(() => {
      clearSummaryLampSwipeStyle(button);
    }, 190);
  }

  function animateSummaryLampSwipeSolo(button, onComplete) {
    clearSummaryLampSwipeStyle(button);
    onComplete();
  }

  nodes.summary.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const button = getSummaryLampButton(event.target);
    if (!button) {
      summaryLampPointerState = null;
      return;
    }

    const lamp = button.dataset.summaryLamp;
    if (!lamp || !LAMP_OPTIONS.includes(lamp)) {
      summaryLampPointerState = null;
      return;
    }

    summaryLampPointerState = {
      lamp,
      button,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastDeltaX: 0,
      lastDeltaY: 0,
      moved: false,
    };
  });

  nodes.summary.addEventListener("pointermove", (event) => {
    if (!summaryLampPointerState || event.pointerId !== summaryLampPointerState.pointerId) {
      return;
    }

    const deltaX = event.clientX - summaryLampPointerState.startX;
    const deltaY = event.clientY - summaryLampPointerState.startY;
    summaryLampPointerState.lastDeltaX = deltaX;
    summaryLampPointerState.lastDeltaY = deltaY;
    if (Math.abs(deltaX) > 12 || Math.abs(deltaY) > 12) {
      summaryLampPointerState.moved = true;
    }

    if (!isHoverNoneEnvironment() || !(summaryLampPointerState.button instanceof HTMLElement)) {
      return;
    }

    if (deltaX >= 0) {
      summaryLampPointerState.button.style.transition = "none";
      summaryLampPointerState.button.style.transform = "translateX(0)";
      return;
    }

    const clampedOffset = Math.max(-SUMMARY_LAMP_SWIPE_SOLO_THRESHOLD, deltaX);
    summaryLampPointerState.button.style.transition = "none";
    summaryLampPointerState.button.style.transform = `translateX(${clampedOffset}px)`;
  });

  nodes.summary.addEventListener("pointerup", (event) => {
    if (!summaryLampPointerState || event.pointerId !== summaryLampPointerState.pointerId) {
      return;
    }

    const lamp = summaryLampPointerState.lamp;
    const moved = summaryLampPointerState.moved;
    const activeButton = summaryLampPointerState.button;
    const deltaX = event.clientX - summaryLampPointerState.startX;
    const deltaY = event.clientY - summaryLampPointerState.startY;
    summaryLampPointerState = null;

    const button = getSummaryLampButton(event.target);
    if (!lamp || !LAMP_OPTIONS.includes(lamp)) {
      return;
    }

    if (isHoverNoneEnvironment()) {
      const absDeltaX = Math.abs(deltaX);
      const isLeftSwipe = deltaX <= -SUMMARY_LAMP_SWIPE_SOLO_THRESHOLD;
      if (isLeftSwipe) {
        lastSummaryLampClick = { lamp: "", timestamp: 0 };
        animateSummaryLampSwipeSolo(activeButton, () => {
          soloSummaryLampFilter(lamp);
        });
        return;
      }

      const targetLamp = button?.dataset.summaryLamp;
      const isTap = absDeltaX <= 12 && Math.abs(deltaY) <= 12 && button && lamp === targetLamp;
      if (isTap) {
        clearSummaryLampSwipeStyle(activeButton);
        toggleSummaryLampFilter(lamp);
        return;
      }

      animateSummaryLampSwipeReturn(activeButton);
      return;
    }

    if (!button || moved) {
      return;
    }

    const targetLamp = button.dataset.summaryLamp;
    if (lamp !== targetLamp) {
      return;
    }

    handleSummaryLampActivation(lamp, Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now());
  });

  nodes.summary.addEventListener("pointercancel", () => {
    const pointerState = summaryLampPointerState;
    if (!pointerState) {
      return;
    }

    if (isHoverNoneEnvironment() && pointerState.lastDeltaX <= -SUMMARY_LAMP_SWIPE_SOLO_THRESHOLD) {
      lastSummaryLampClick = { lamp: "", timestamp: 0 };
      animateSummaryLampSwipeSolo(pointerState.button, () => {
        soloSummaryLampFilter(pointerState.lamp);
      });
      summaryLampPointerState = null;
      return;
    }

    animateSummaryLampSwipeReturn(pointerState.button);
    summaryLampPointerState = null;
  });

  nodes.summary.addEventListener("click", (event) => {
    if (event.detail !== 0) {
      return;
    }

    const button = getSummaryLampButton(event.target);
    if (!button) {
      return;
    }

    const lamp = button.dataset.summaryLamp;
    if (!lamp || !LAMP_OPTIONS.includes(lamp)) {
      return;
    }

    if (isHoverNoneEnvironment()) {
      toggleSummaryLampFilter(lamp);
      return;
    }

    handleSummaryLampActivation(lamp, performance.now());
  });

  nodes.catalog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-title]");
    if (!button) {
      return;
    }
    store.selectSong(
      decodeURIComponent(button.dataset.title),
      button.dataset.catalogKey ? decodeURIComponent(button.dataset.catalogKey) : null,
    );
    window.requestAnimationFrame(scrollEntryPanelIntoView);
  });

  function handlePaginationClick(event, anchorToBottom = false) {
    const sortDirectionButton = event.target.closest("[data-sort-direction-toggle]");
    if (sortDirectionButton) {
      store.toggleSortDirection();
      return;
    }

    const button = event.target.closest("[data-page]");
    if (!button) {
      return;
    }

    if (anchorToBottom && button.dataset.page === "next") {
      pendingCatalogBottomNextScroll = true;
    } else if (anchorToBottom && nodes.catalogPanel) {
      pendingCatalogBottomLock = nodes.catalogPanel.getBoundingClientRect().bottom;
    }

    const snapshot = store.getSnapshot();
    if (button.dataset.page === "prev") {
      store.setPage(snapshot.pagination.currentPage - 1);
      return;
    }

    if (button.dataset.page === "next") {
      store.setPage(snapshot.pagination.currentPage + 1);
    }
  }

  nodes.catalogPaginationTop.addEventListener("click", (event) => handlePaginationClick(event, false));
  nodes.catalogPaginationBottom.addEventListener("click", (event) => handlePaginationClick(event, true));
  nodes.catalogSortSelect?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    store.setSortMode(target.value);
  });
  nodes.catalogViewToggle?.addEventListener("click", () => {
    store.toggleCatalogViewMode();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.isComposing) {
      const target = event.target;
      if (isEscapeBlurTarget(target)) {
        event.preventDefault();
        event.stopPropagation();
        pendingQueryBlurIntent = "escape";
        target.blur();
      }
      return;
    }

    if (event.key === "Delete"
      && !event.repeat
      && !event.isComposing
      && !event.ctrlKey
      && !event.altKey
      && !event.metaKey
    ) {
      const target = event.target;
      if (target instanceof HTMLElement && isShortcutEditableTarget(target)) {
        return;
      }

      const { filters } = store.getSnapshot();
      if (!floatingFilterOpen || !isTextAxisMode(filters.axisMode)) {
        return;
      }

      const queryInput = nodes.floatingAxisFilter.querySelector('input[data-axis-query]');
      if (!(queryInput instanceof HTMLInputElement)) {
        return;
      }

      event.preventDefault();
      queryInput.value = "";
      applyTitleQueryFilter(queryInput, { keepFocus: true, scrollToCatalog: false });
      return;
    }

    const shortcutKey = event.key.toLowerCase();

    const catalogShortcutIndex = getCatalogNumberShortcutIndex(event);

    if (catalogShortcutIndex >= 0
      && !event.repeat
      && !event.isComposing
      && !event.ctrlKey
      && !event.altKey
      && !event.metaKey
    ) {
      const target = event.target;
      if (target instanceof HTMLElement && isShortcutEditableTarget(target)) {
        return;
      }

      if (selectCatalogSongByShortcut(catalogShortcutIndex)) {
        event.preventDefault();
      }

      return;
    }    

    if ((shortcutKey === "a" || shortcutKey === "d")
      && !event.isComposing
      && !event.ctrlKey
      && !event.altKey
      && !event.metaKey
    ) {
      const target = event.target;
      if (target instanceof HTMLElement && isShortcutEditableTarget(target)) {
        return;
      }

      const dateMoved = previewFloatingDateBy(shortcutKey === "a" ? -1 : 1, event.shiftKey ? "end" : "start");
      if (dateMoved) {
        event.preventDefault();
        return;
      }

      const rangeMoved = previewFloatingAxisRangeBy(shortcutKey === "a" ? -1 : 1, event.shiftKey ? "end" : "start");
      if (rangeMoved) {
        event.preventDefault();
        return;
      }

      const moved = previewFloatingAxisSliderBy(shortcutKey === "a" ? -1 : 1);
      if (!moved) {
        return;
      }

      event.preventDefault();
      return;
    }

    const axisShortcutMode = AXIS_SHORTCUT_KEYS[shortcutKey];

    if (event.repeat
      || event.isComposing
      || event.ctrlKey
      || event.altKey
      || event.metaKey
      || (shortcutKey !== "q" && !axisShortcutMode)
    ) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && isShortcutEditableTarget(target)) {
      return;
    }

    event.preventDefault();

    if (shortcutKey === "q") {
      toggleFloatingFilter();
      return;
    }

    if (axisShortcutMode) {
      switchFloatingAxisByShortcut(axisShortcutMode);
    }
  });

  document.addEventListener("keyup", (event) => {
    const shortcutKey = event.key.toLowerCase();
    if (shortcutKey !== "a" && shortcutKey !== "d") {
      return;
    }

    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (floatingDateShortcutPending) {
      commitFloatingDateShortcut();
      event.preventDefault();
      return;
    }

    if (floatingAxisRangeShortcutPending) {
      commitFloatingAxisRange();
      event.preventDefault();
      return;
    }

    if (commitFloatingAxisSliderShortcut()) {
      event.preventDefault();
    }
  });  

  [nodes.bpInput, nodes.badInput, nodes.poorInput, nodes.scoreInput].forEach((input) => input?.addEventListener("wheel", (event) => {
    if (document.activeElement === input) {
      event.preventDefault();
      input.blur();
    }
  }, { passive: false }));

  nodes.recordForm.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    event.preventDefault();

    if (target === nodes.memoInput) {
      target.blur();
      return;
    }

    const fields = [
      nodes.lampInput,
      nodes.bpInput,
      nodes.badInput,
      nodes.poorInput,
      nodes.scoreInput,
      nodes.memoInput,
    ].filter((field) => field && !field.disabled && !field.closest("[hidden]"));

    const currentIndex = fields.indexOf(target);
    if (currentIndex < 0) {
      return;
    }

    const nextField = fields[currentIndex + 1];
    if (nextField instanceof HTMLElement) {
      nextField.focus();
      if (nextField instanceof HTMLInputElement) {
        nextField.select?.();
      }
    }
  });

  nodes.recordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const bpResult = getEntryBpValue();
    if (!bpResult.ok) {
      window.alert(bpResult.message);
      return;
    }

    const result = store.saveRecord({
      lamp: nodes.lampInput.value,
      bp: bpResult.value,
      score: nodes.scoreInput.value,
      memo: nodes.memoInput.value,
    });

    if (result.ok) {
      clearEntryBpInputs();
      nodes.scoreInput.value = "";
    } else {
      window.alert(result.message);
    }
  });

  nodes.bpInputModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setEntryBpInputMode(button.dataset.bpInputMode);
    });
  });

  nodes.backToCardButton?.addEventListener("click", () => {
    scrollSelectedCardIntoView();
  });

  // 難易度表読み込み失敗時のスキップ機能へ接続
  async function tryRefreshDifficultyTableForIo(actionLabel) {
    try {
      await store.importDifficultyTable();
      return true;
    } catch (error) {
      console.error(`${actionLabel}前の難易度表読み込みに失敗:`, error);
      return false;
    }
  }

  nodes.difficultyImportButton.addEventListener("click", async () => {
    setButtonLoading(nodes.difficultyImportButton, true, "読み込み中...");
    lockHeroButtonsExcept(nodes.difficultyImportButton);

    try {
      const result = await store.importDifficultyTable();
      window.alert(`難易度表を読み込みました。\n曲数: ${result.titleCount}\n譜面数: ${result.entries.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "難易度表の読み込みに失敗しました。";
      window.alert(message);
    } finally {
      clearHeroButtonStates();
    }
  });

  nodes.importButton.addEventListener("click", () => {
    nodes.importFileInput.click();
  });

  nodes.csvImportButton.addEventListener("click", () => {
    nodes.csvImportFileInput.click();
  });

  nodes.csvImportFileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setButtonLoading(nodes.csvImportButton, true, "読み込み中...");
    lockHeroButtonsExcept(nodes.csvImportButton);

    try {
      await tryRefreshDifficultyTableForIo("CSV読み込み");

      const text = await file.text();
      const result = store.importCsvData(text);
      window.alert(`CSVを読み込みました。\n取込件数: ${result.count}\n合計件数: ${result.totalCount}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSVの読み込みに失敗しました。";
      window.alert(message);
    } finally {
      nodes.csvImportFileInput.value = "";
      clearHeroButtonStates();
    }
  });

  nodes.importFileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const referenceDate = askJsonImportDate();
      if (referenceDate === null) {
        return;
      }

      setButtonLoading(nodes.importButton, true, "読み込み中...");
      lockHeroButtonsExcept(nodes.importButton);

      await tryRefreshDifficultyTableForIo("JSON読み込み");

      const text = await file.text();
      const payload = parseImportedJsonText(text);
      const result = store.importJsonData(payload, referenceDate);
      window.alert(`JSONを読み込みました。\n取込件数: ${result.count}\n合計件数: ${result.totalCount}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSONの読み込みに失敗しました。";
      window.alert(message);
    } finally {
      nodes.importFileInput.value = "";
      clearHeroButtonStates();
    }
  });

  nodes.exportButton.addEventListener("click", async () => {
    setButtonLoading(nodes.exportButton, true, "書き出し中...");
    lockHeroButtonsExcept(nodes.exportButton);

    try {
      await tryRefreshDifficultyTableForIo("JSON書き出し");

      const payload = store.getExportJson();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `dbr_data_${formatExportDateStamp()}.json`;
      anchor.click();

      URL.revokeObjectURL(url);
    } finally {
      clearHeroButtonStates();
    }
  });

  nodes.csvExportButton.addEventListener("click", async () => {
    setButtonLoading(nodes.csvExportButton, true, "書き出し中...");
    lockHeroButtonsExcept(nodes.csvExportButton);

    try {
      await tryRefreshDifficultyTableForIo("CSV書き出し");

      const csv = store.getExportCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `dbr_records_${formatExportDateStamp()}.csv`;
      anchor.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSVの書き出しに失敗しました。";
      window.alert(message);
    } finally {
      clearHeroButtonStates();
    }
  });

  nodes.clearAllButton.addEventListener("click", () => {
    const confirmed = window.confirm("保存済みのプレー記録をすべて削除します。よろしいですか？");
    if (!confirmed) {
      return;
    }

    const reconfirmed = window.confirm("この操作は取り消せません。本当にすべて削除しますか？");
    if (!reconfirmed) {
      return;
    }

    store.clearAllRecords();
  });

  // DBR IR送信
  nodes.sendJsonToIrTestButton?.addEventListener("click", async () => {
    const targetWindow = openDbrIrImportPage();
    if (!targetWindow) {
      return;
    }

    setButtonLoading(nodes.sendJsonToIrTestButton, true, "送信準備中...");
    lockHeroButtonsExcept(nodes.sendJsonToIrTestButton);

    try {
      await tryRefreshDifficultyTableForIo("DBR IR送信");

      const jsonText = JSON.stringify(store.getExportJson(), null, 2);
      sendJsonToDbrIrPage(targetWindow, jsonText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "DBR IR送信に失敗しました。";
      window.alert(message);
    } finally {
      clearHeroButtonStates();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!floatingFilterOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (target.closest(".floating-filter-panel")) {
      floatingOutsidePointerState = null;
      return;
    }

    floatingOutsidePointerState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  });

  document.addEventListener("pointermove", (event) => {
    if (!floatingOutsidePointerState || event.pointerId !== floatingOutsidePointerState.pointerId) {
      return;
    }

    const deltaX = Math.abs(event.clientX - floatingOutsidePointerState.startX);
    const deltaY = Math.abs(event.clientY - floatingOutsidePointerState.startY);
    if (deltaX > 8 || deltaY > 8) {
      floatingOutsidePointerState.moved = true;
    }
    if (deltaY > 16) {
      floatingOutsidePointerState = null;
      closeFloatingFilter({ preserveScroll: true });
    }    
  });

  document.addEventListener("pointerup", (event) => {
    if (!floatingOutsidePointerState || event.pointerId !== floatingOutsidePointerState.pointerId) {
      return;
    }

    const moved = floatingOutsidePointerState.moved;
    floatingOutsidePointerState = null;
    if (moved) {
      return;
    }

    closeFloatingFilter({ preserveScroll: true });
  });

  document.addEventListener("pointercancel", (event) => {
    if (!floatingOutsidePointerState || event.pointerId !== floatingOutsidePointerState.pointerId) {
      return;
    }

    floatingOutsidePointerState = null;
    closeFloatingFilter({ preserveScroll: true });
  });

  return {
    render(snapshot) {
      const snapshotFilterSignature = JSON.stringify(snapshot.filters);
      if (filterDraft === null || snapshotFilterSignature !== appliedFilterSignature) {
        filterDraft = structuredClone(snapshot.filters);
        appliedFilterSignature = snapshotFilterSignature;
      }

      const summaryBandScrollTop = nodes.summary?.querySelector(".summary-band-chart")?.scrollTop ?? 0;
      renderSummary(nodes.summary, snapshot.summary, snapshot.filters);
      const summaryBandChart = nodes.summary?.querySelector(".summary-band-chart");
      if (summaryBandChart) {
        summaryBandChart.scrollTop = summaryBandScrollTop;
      }
      latestFilterBounds = deriveFilterBounds(snapshot.songStates);
      latestHistoryDates = deriveHistoryDates(snapshot.songStates);
      latestVisibleCount = snapshot.visibleSongs.length;
      renderFilterDraftPanel();
      renderFloatingFilterShell();
      syncFloatingDockClass();
      if (floatingQueryRestoreFocus && isTextAxisMode(snapshot.filters.axisMode) && floatingFilterOpen) {
        const queryInput = nodes.floatingAxisFilter.querySelector('input[data-axis-query]');
        if (queryInput instanceof HTMLInputElement) {
          queryInput.focus();
          const start = floatingQuerySelection?.start ?? queryInput.value.length;
          const end = floatingQuerySelection?.end ?? queryInput.value.length;
          queryInput.setSelectionRange(start, end);
        }
        floatingQueryRestoreFocus = false;
      }
      floatingQuerySelection = null;
      renderCatalog(nodes.catalog, snapshot.pagedSongs, snapshot.selectedSong?.title ?? null, {
        showKatateTitleSuffix: snapshot.sortMode === "katate" || snapshot.filters.axisMode === "katate",
        viewMode: snapshot.catalogViewMode,
        selectedCatalogKey: snapshot.selectedCatalogKey,
      });
      renderPagination(nodes.catalogPaginationTop, snapshot.pagination, {
        showSortDirectionToggle: true,
        sortDirection: snapshot.sortDirection,
      });
      renderPagination(nodes.catalogPaginationBottom, snapshot.pagination);
      renderSelectedSong(nodes.selectedSong, snapshot.selectedSong, snapshot.pagedSongs, {
        showKatateTitleSuffix: snapshot.sortMode === "katate" || snapshot.filters.axisMode === "katate",
      });
      renderProposalButton(
        nodes.selectedSong,
        snapshot.selectedSong,
        snapshot.difficultyTable
      );
      syncDifficultyImportButton(
        nodes.difficultyImportButton,
        !snapshot.difficultyTable || isDifficultyTableStale(snapshot.difficultyTableUpdatedAt)
      );
      renderHistory(nodes.history, snapshot.selectedHistory, store);
      latestChartHistory = snapshot.selectedHistory.slice().reverse();
      latestScoreChartHistory = latestChartHistory;
      nodes.scoreChart.dataset.maxScore = snapshot.selectedSong?.notes ? String(snapshot.selectedSong.notes * 4) : "";
      renderBpChart(nodes.chart, latestChartHistory);
      renderScoreChart(nodes.scoreChart, latestChartHistory);

      if (pendingCatalogBottomNextScroll) {
        pendingCatalogBottomNextScroll = false;
        window.requestAnimationFrame(scrollCatalogPanelIntoView);
      }

      if (pendingCatalogBottomLock !== null && nodes.catalogPanel) {
        const newBottom = nodes.catalogPanel.getBoundingClientRect().bottom;
        window.scrollBy(0, newBottom - pendingCatalogBottomLock);
        pendingCatalogBottomLock = null;
      }

      nodes.recordDate.value = formatIsoDate(todayIso());
      nodes.catalogMeta.textContent = "";
      const selectedCardExists = snapshot.selectedSong
        ? Boolean(nodes.catalog?.querySelector(snapshot.selectedCatalogKey
          ? `[data-catalog-key="${encodeURIComponent(snapshot.selectedCatalogKey)}"]`
          : `[data-title="${encodeURIComponent(snapshot.selectedSong.title)}"]`))
        : false;

      if (snapshot.selectedSong) {
        const selectedTitle = encodeURIComponent(snapshot.selectedSong.title);
        const selectedCatalogKey = snapshot.selectedCatalogKey ? encodeURIComponent(snapshot.selectedCatalogKey) : "";
        const nextBpPlaceholder = formatBpPlaceholder(snapshot.selectedSong);
        const nextScorePlaceholder = formatScorePlaceholder(snapshot.selectedSong);
        const nextMemoValue = snapshot.selectedSong.note ?? "";
        const selectedSongChanged = nodes.selectedSong.dataset.title !== selectedTitle;

        if (selectedSongChanged) {
          nodes.selectedSong.dataset.title = selectedTitle;
        }
        if (selectedCatalogKey) {
          nodes.selectedSong.dataset.catalogKey = selectedCatalogKey;
        } else {
          delete nodes.selectedSong.dataset.catalogKey;
        }

        if (nodes.lampInput.value !== LAMP_OPTIONS[0]) {
          nodes.lampInput.value = LAMP_OPTIONS[0];
        }

        if (selectedSongChanged) {
          clearEntryBpInputs();
          if (nodes.scoreInput.value !== "") {
            nodes.scoreInput.value = "";
          }
        }

        if (nodes.bpInput.placeholder !== nextBpPlaceholder) {
          nodes.bpInput.placeholder = nextBpPlaceholder;
        }
        if (nodes.scoreInput.placeholder !== nextScorePlaceholder) {
          nodes.scoreInput.placeholder = nextScorePlaceholder;
        }
        if (nodes.memoInput.value !== nextMemoValue) {
          nodes.memoInput.value = nextMemoValue;
        }
      } else {
        delete nodes.selectedSong.dataset.title;
        delete nodes.selectedSong.dataset.catalogKey;
        if (nodes.lampInput.value !== LAMP_OPTIONS[0]) {
          nodes.lampInput.value = LAMP_OPTIONS[0];
        }
        clearEntryBpInputs();
        if (nodes.scoreInput.value !== "") {
          nodes.scoreInput.value = "";
        }
        if (nodes.bpInput.placeholder !== "BPを入力") {
          nodes.bpInput.placeholder = "BPを入力";
        }
        if (nodes.scoreInput.placeholder !== "スコアを入力") {
          nodes.scoreInput.placeholder = "スコアを入力";
        }
        if (nodes.memoInput.value !== "") {
          nodes.memoInput.value = "";
        }
      }

      if (nodes.backToCardButton) {
        nodes.backToCardButton.disabled = !selectedCardExists;
      }
      if (nodes.catalogSortSelect) {
        nodes.catalogSortSelect.value = snapshot.sortMode;
      }
      if (nodes.catalogViewToggle) {
        const isListView = snapshot.catalogViewMode === "list";
        nodes.catalogViewToggle.innerHTML = isListView
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"></rect><rect x="13" y="4" width="7" height="7" rx="1.5"></rect><rect x="4" y="13" width="7" height="7" rx="1.5"></rect><rect x="13" y="13" width="7" height="7" rx="1.5"></rect></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="3" rx="1.5"></rect><rect x="4" y="10.5" width="16" height="3" rx="1.5"></rect><rect x="4" y="16" width="16" height="3" rx="1.5"></rect></svg>';
        nodes.catalogViewToggle.setAttribute("aria-pressed", isListView ? "true" : "false");
        nodes.catalogViewToggle.title = isListView ? "箱型表示に切り替え" : "一覧表示に切り替え";
      }
    },
  };
}
