const MODULE_VERSION = new URL(import.meta.url).search;

const { formatIsoDate } = await import(`../../utils/date.js${MODULE_VERSION}`);

const CHART_DIFFICULTY_OPTIONS = ["B", "N", "H", "A", "L"];
const RECOMMEND_SORT_VALUES = ["☆", "◎", "○", "△", ""];
const CHART_SUFFIX_ORDER = new Map([
  ["B", 0],
  ["N", 1],
  ["H", 2],
  ["A", 3],
  ["L", 4],
]);
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

function getChartSuffix(title) {
  const match = String(title ?? "").match(/^(.*)\(([BNHAL])\)$/);
  return match ? match[2] : "";
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

function formatBpmTitleSuffix(song) {
  const bpm = String(song?.bpm ?? "").trim();
  if (!bpm) {
    return "";
  }

  return `BPM${bpm}`;
}

function getBpmBucket(value) {
  const buckets = [
    { value: "lt120", label: "min-119" },
    ...Array.from({ length: 10 }, (_, index) => {
      const bpm = 120 + index * 10;
      return { value: String(bpm), label: `${bpm}-${bpm + 9}` };
    }),
    { value: "220", label: "220-249" },
    { value: "250", label: "250-max" },
  ];
  return buckets.find((bucket) => bucket.value === String(value));
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

function formatRecommendDisplay(recommend) {
  const normalized = String(recommend ?? "").trim();
  return normalized || "－";
}

function formatRecommendSortHead(recommend) {
  return RECOMMEND_SORT_VALUES.includes(recommend) ? formatRecommendDisplay(recommend) : formatRecommendDisplay(RECOMMEND_SORT_VALUES[0]);
}

function formatBp(value) {
  return value === null || value === undefined ? "-" : String(value);
}

function formatScoreRankDisplay(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function formatCatalogPagePrimaryValue(song, sortMode) {
  if (!song || sortMode === "title" || sortMode === "random") {
    return "";
  }

  if (sortMode === "chartDifficulty") {
    return getChartSuffix(song.title);
  }

  if (sortMode === "version") {
    return formatAxisValue("version", song.version);
  }

  if (sortMode === "splv") {
    return song.splvValue === null || song.splvValue === undefined ? "-" : formatAxisValue("splv", song.splvValue);
  }

  if (sortMode === "level") {
    return song.levelValue === null || song.levelValue === undefined ? "-" : formatAxisValue("level", song.levelValue);
  }

  if (sortMode === "katate") {
    return song.katateValue === null || song.katateValue === undefined ? "-" : formatAxisValue("katate", song.katateValue);
  }

  if (sortMode === "bpm") {
    return formatBpmTitleSuffix(song) || "-";
  }

  if (sortMode === "recommend") {
    return formatRecommendDisplay(song.recommend);
  }

  if (sortMode === "clear") {
    return song.bestLamp || "NO PLAY";
  }

  if (sortMode === "bestBp") {
    return `BP ${formatBp(song.bestBp)}`;
  }

  if (sortMode === "latestBp") {
    return `BP ${formatBp(song.currentBp)}`;
  }

  if (sortMode === "bestScore") {
    return formatScoreRankDisplay(song.bestScoreLabel);
  }

  if (sortMode === "latestScore") {
    return formatScoreRankDisplay(song.currentScoreLabel);
  }

  if (sortMode === "latest") {
    return song.latestDate ? formatIsoDate(song.latestDate) : "履歴なし";
  }

  if (sortMode === "entryCount") {
    return `${song.entryCount ?? 0}件`;
  }

  if (sortMode === "memo") {
    return String(song.note ?? "").replace(/\s+/g, " ").trim() || "-";
  }

  return "";
}

function createCatalogPageItemLabel(song, sortMode) {
  const fragment = document.createDocumentFragment();
  if (!song) {
    const title = document.createElement("span");
    title.className = "pagination-range-title";
    title.textContent = "-";
    fragment.appendChild(title);
    return fragment;
  }

  const titleText = sortMode === "chartDifficulty"
    ? splitTitleAndSuffix(song.title).baseTitle
    : song.title;

  const primaryValue = formatCatalogPagePrimaryValue(song, sortMode);
  const title = document.createElement("span");
  title.className = "pagination-range-title";
  title.textContent = titleText;
  fragment.appendChild(title);

  if (primaryValue) {
    const primary = document.createElement("span");
    primary.className = "pagination-range-primary";
    primary.textContent = `(${primaryValue})`;
    fragment.appendChild(primary);
  }

  return fragment;
}

export function renderPagination(container, pagination, options = {}) {
  container.replaceChildren();

  if (pagination.totalItems === 0) {
    return;
  }

  const chartDifficultyHead = CHART_DIFFICULTY_OPTIONS.includes(options.chartDifficultySortHead)
    ? options.chartDifficultySortHead
    : CHART_DIFFICULTY_OPTIONS[0];
  const currentPageRange = (pagination.pageRanges ?? []).find((range) => range.page === pagination.currentPage)
    ?? pagination.pageRanges?.[0]
    ?? null;

  const wrap = document.createElement("div");
  wrap.className = "pagination-wrap";

  const label = document.createElement("div");
  label.className = "pagination-label";
  const firstItem = document.createElement("div");
  firstItem.className = "pagination-range-item";
  firstItem.appendChild(createCatalogPageItemLabel(currentPageRange?.first, options.sortMode));
  const separator = document.createElement("div");
  separator.className = "pagination-range-separator";
  separator.textContent = "～";
  const lastItem = document.createElement("div");
  lastItem.className = "pagination-range-item";
  lastItem.appendChild(createCatalogPageItemLabel(currentPageRange?.last, options.sortMode));
  label.append(firstItem, separator, lastItem);

  const controls = document.createElement("div");
  controls.className = "pagination-controls";

  if (options.showRandomSortButton) {
    const button = document.createElement("button");
    button.className = "button button-tertiary catalog-sort-control-button";
    button.type = "button";
    button.dataset.randomSortToggle = "";
    button.setAttribute("aria-label", options.sortMode === "random" ? "ランダム順を変更" : "ランダム順に並び替え");
    button.textContent = "？";
    controls.appendChild(button);
  }

  if (options.showSortDirectionToggle && options.sortMode === "chartDifficulty") {
    const button = document.createElement("button");
    button.className = "button button-tertiary chart-difficulty-head-button";
    button.type = "button";
    button.dataset.chartDifficultyHeadToggle = "";
    button.setAttribute("aria-label", "先頭の譜面難易度を切り替え");
    button.textContent = chartDifficultyHead;
    controls.appendChild(button);
  } else if (options.showSortDirectionToggle && options.sortMode === "recommend") {
    const button = document.createElement("button");
    button.className = "button button-tertiary chart-difficulty-head-button";
    button.type = "button";
    button.dataset.recommendHeadToggle = "";
    button.setAttribute("aria-label", "先頭のおすすめ度を切り替え");
    button.textContent = formatRecommendSortHead(options.recommendSortHead);
    controls.appendChild(button);
  } else if (options.showSortDirectionToggle) {
    const button = document.createElement("button");
    button.className = "button button-tertiary catalog-sort-control-button";
    button.type = "button";
    button.dataset.sortDirectionToggle = "";
    button.setAttribute("aria-label", options.sortMode === "random" ? "ランダム順を変更" : "並び順の昇順降順を切り替え");
    button.textContent = options.sortMode === "random" ? "？" : (options.sortDirection === "desc" ? "▼" : "▲");
    controls.appendChild(button);
  }

  const prevButton = document.createElement("button");
  prevButton.className = "button button-tertiary";
  prevButton.type = "button";
  prevButton.dataset.page = "prev";
  prevButton.disabled = pagination.currentPage <= 1;
  prevButton.textContent = "前へ";

  const nextButton = document.createElement("button");
  nextButton.className = "button button-tertiary";
  nextButton.type = "button";
  nextButton.dataset.page = "next";
  nextButton.disabled = pagination.currentPage >= pagination.totalPages;
  nextButton.textContent = "次へ";

  controls.append(prevButton, nextButton);
  wrap.append(label, controls);
  container.appendChild(wrap);
}
