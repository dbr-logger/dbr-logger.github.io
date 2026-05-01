import { formatIsoDate } from "../utils/date.js?v=20260430-4";

function clampTickCount(length) {
  return Math.max(2, Math.min(length, 5));
}

function buildPath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function renderTrendChart(container, history, options) {
  if (!history || history.length === 0) {
    container.innerHTML = `<div class="empty-state">${options.emptyMessage}</div>`;
    return;
  }

  const width = Math.max(Math.floor(container.clientWidth), 280);
  const height = width < 420 ? 260 : 300;
  const padding = width < 420
    ? { top: 24, right: 16, bottom: 48, left: 46 }
    : { top: 24, right: 24, bottom: 48, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const values = history.map((item) => options.getValue(item));
  const minValue = options.getMinValue(values);
  const maxValue = options.getMaxValue(values);
  const valueRange = Math.max(maxValue - minValue, 1);

  const points = history.map((entry, index) => {
    const x = padding.left + (history.length === 1 ? innerWidth / 2 : (innerWidth * index) / (history.length - 1));
    const value = options.getValue(entry);
    const y = maxValue === minValue
      ? padding.top + innerHeight / 2
      : padding.top + ((maxValue - value) / valueRange) * innerHeight;

    return { x, y, ...entry };
  });

  const linePath = buildPath(points);
  const areaPath = `${linePath} L ${points.at(-1).x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;
  const tickCount = clampTickCount(history.length);
  const ticks = maxValue === minValue
    ? [{ value: minValue, y: padding.top + innerHeight / 2 }]
    : Array.from({ length: tickCount }, (_, index) => {
        const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
        const value = Math.round(maxValue - (maxValue - minValue) * ratio);
        const y = padding.top + ratio * innerHeight;
        return { value, y };
      });
  const guides = (options.getGuides?.({ minValue, maxValue }) ?? [])
    .filter((guide) => Number.isFinite(guide.value))
    .filter((guide) => guide.value >= minValue && guide.value <= maxValue)
    .map((guide) => {
      const y = maxValue === minValue
        ? padding.top + innerHeight / 2
        : padding.top + ((maxValue - guide.value) / valueRange) * innerHeight;
      return { ...guide, y };
    });

  const xLabels = points.map((point, index) => {
    const shouldShow = history.length <= 6 || index === 0 || index === history.length - 1 || index % 2 === 0;
    if (!shouldShow) {
      return "";
    }
    return `<text class="chart-axis-text" x="${point.x}" y="${height - 16}" text-anchor="middle">${formatIsoDate(point.date).slice(5)}</text>`;
  }).join("");

  const yLabels = ticks.map((tick) => `
    <g>
      <line class="chart-grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${tick.y}" y2="${tick.y}" />
      <text class="chart-axis-text" x="${padding.left - 12}" y="${tick.y + 4}" text-anchor="end">${tick.value}</text>
    </g>
  `).join("");
  const guideMarkup = guides.map((guide) => `
    <g>
      <line class="chart-grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${guide.y}" y2="${guide.y}" />
      <text class="chart-axis-text" x="${padding.left - 12}" y="${guide.y + 4}" text-anchor="end">${Math.round(guide.value)}</text>
    </g>
  `).join("");

  const pointMarkup = points.map((point) => `
    <g>
      <circle class="chart-point" cx="${point.x}" cy="${point.y}" r="6" />
      <text class="chart-point-label" x="${point.x}" y="${point.y - 12}" text-anchor="middle">${options.getValue(point)}</text>
    </g>
  `).join("");

  container.innerHTML = `
    <svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.ariaLabel}">
      ${yLabels}
      ${guideMarkup}
      <path class="chart-area" d="${areaPath}" />
      <path class="chart-line" d="${linePath}" />
      ${pointMarkup}
      ${xLabels}
    </svg>
  `;
}

export function renderBpChart(container, history) {
  renderTrendChart(container, history, {
    ariaLabel: "BP推移グラフ",
    emptyMessage: "この曲のBP履歴はまだありません。",
    getValue: (entry) => entry.bp,
    getMinValue: () => 0,
    getMaxValue: (values) => Math.max(...values),
  });
}

export function renderScoreChart(container, history) {
  const theoreticalMax = Number(container.dataset.maxScore || 0);
  renderTrendChart(container, history, {
    ariaLabel: "スコア推移グラフ",
    emptyMessage: "この曲のスコア履歴はまだありません。",
    getValue: (entry) => entry.score,
    getMinValue: () => 0,
    getMaxValue: (values) => Math.max(theoreticalMax, ...values),
    getGuides: () => theoreticalMax > 0
      ? [
          { value: theoreticalMax * (8 / 9) },
          { value: theoreticalMax * (7 / 9) },
          { value: theoreticalMax * (6 / 9) },
        ]
      : [],
  });
}
