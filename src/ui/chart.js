const MODULE_VERSION = new URL(import.meta.url).search;

const { formatIsoDate } = await import(`../utils/date.js${MODULE_VERSION}`);

function clampTickCount(length) {
  return Math.max(2, Math.min(length, 5));
}

function buildPath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function parseIsoDateTimestamp(date) {
  const timestamp = Date.parse(`${date}T00:00:00`);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function scaleTimestamp(timestamp, minTimestamp, maxTimestamp, padding, innerWidth) {
  if (maxTimestamp === minTimestamp) {
    return padding.left + innerWidth / 2;
  }

  return padding.left + ((timestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * innerWidth;
}

function scaleIndex(index, length, padding, innerWidth) {
  if (length <= 1) {
    return padding.left + innerWidth / 2;
  }

  return padding.left + (index / (length - 1)) * innerWidth;
}

function findLastIndex(values, predicate) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index], index)) {
      return index;
    }
  }

  return -1;
}

function getFirstTrendDirection(points, index) {
  const current = points[index];
  if (!current) {
    return 0;
  }

  for (let offset = 1; index + offset < points.length; offset += 1) {
    const next = points[index + offset];
    if (!next) {
      break;
    }

    const delta = next.value - current.value;
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

function getLastTrendDirection(points, index) {
  const current = points[index];
  if (!current) {
    return 0;
  }

  for (let offset = 1; index - offset >= 0; offset += 1) {
    const prev = points[index - offset];
    if (!prev) {
      break;
    }

    const delta = current.value - prev.value;
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

function chooseLabelPlacement(points, index, role, padding, innerHeight) {
  const point = points[index];
  let y = point.y - 16;

  if (role === "maxValue") {
    y = point.y - 16;
  } else if (role === "minValue") {
    y = point.y + 16;
  } else if (role === "firstValue") {
    const trend = getFirstTrendDirection(points, index);
    if (trend > 0) {
      y = point.y + 16;
    } else if (trend < 0) {
      y = point.y - 16;
    } else {
      y = point.y - 16;
    }
  } else if (role === "lastValue") {
    const trend = getLastTrendDirection(points, index);
    if (trend > 0) {
      y = point.y - 16;
    } else if (trend < 0) {
      y = point.y + 16;
    } else {
      y = point.y - 16;
    }
  }

  return {
    x: point.x,
    y,
    dominantBaseline: "middle",
  };
}

// データポイントの位置に合わせて年の区切りを描画する
function isJanuaryFirst(date) {
  return typeof date === "string" && /^\d{4}-01-01$/.test(date);
}

function buildYearMarkersByPoints(history, points, padding, height) {
  const yearGroups = [];

  history.forEach((entry, index) => {
    const year = String(entry.date ?? "").slice(0, 4);
    if (!/^\d{4}$/.test(year) || !points[index]) {
      return;
    }

    const lastGroup = yearGroups.at(-1);
    if (lastGroup?.year === year) {
      lastGroup.endIndex = index;
      return;
    }

    yearGroups.push({
      year,
      startIndex: index,
      endIndex: index,
      boundaryX: null,
    });
  });

  yearGroups.forEach((group, groupIndex) => {
    const startPoint = points[group.startIndex];
    const previousGroup = yearGroups[groupIndex - 1];
    const previousEndPoint = previousGroup ? points[previousGroup.endIndex] : null;
    const firstEntryOfYear = history[group.startIndex];

    if (!startPoint || !previousEndPoint) {
      return;
    }

    group.boundaryX = isJanuaryFirst(firstEntryOfYear?.date)
      ? startPoint.x
      : previousEndPoint.x + ((startPoint.x - previousEndPoint.x) / 2);
  });

  return yearGroups.map((group, groupIndex) => {
    const startPoint = points[group.startIndex];
    const endPoint = points[group.endIndex];

    if (!startPoint || !endPoint) {
      return null;
    }

    const previousBoundaryX = group.boundaryX;
    const nextBoundaryX = yearGroups[groupIndex + 1]?.boundaryX ?? null;

    const labelStartX = previousBoundaryX ?? startPoint.x;
    const labelEndX = nextBoundaryX ?? endPoint.x;

    return {
      year: group.year,
      x: labelStartX + ((labelEndX - labelStartX) / 2),
      boundaryX: group.boundaryX,
      lineTop: padding.top,
      lineBottom: height - padding.bottom,
      labelY: height - 24,
    };
  }).filter(Boolean);
}

function hasChartValue(entry) {
  return Number.isFinite(entry?.bp) || Number.isFinite(entry?.score);
}

function buildChartDateDomain(history) {
  const dateEntryByDate = new Map();

  history.forEach((entry) => {
    if (!entry?.date || !hasChartValue(entry) || dateEntryByDate.has(entry.date)) {
      return;
    }

    dateEntryByDate.set(entry.date, entry);
  });

  return Array.from(dateEntryByDate.values())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function renderTrendChart(container, history, options) {
  if (!history || history.length === 0) {
    container.innerHTML = `<div class="empty-state">${options.emptyMessage}</div>`;
    return;
  }

  const width = Math.max(Math.floor(container.clientWidth), 280);
  const height = width < 420 ? 260 : 300;
  const padding = width < 420
    ? { top: 24, right: 16, bottom: 72, left: 40 }
    : { top: 24, right: 24, bottom: 72, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const domainHistory = options.domainHistory?.length
    ? options.domainHistory
    : history;

  const domainPoints = domainHistory.map((entry, index) => ({
    ...entry,
    x: scaleIndex(index, domainHistory.length, padding, innerWidth),
  }));

  const xByDate = new Map(domainPoints.map((point) => [point.date, point.x]));

  const chartHistory = history.filter((entry) => (
    xByDate.has(entry.date)
    && Number.isFinite(options.getValue(entry))
  ));

  if (chartHistory.length === 0) {
    container.innerHTML = `<div class="empty-state">${options.emptyMessage}</div>`;
    return;
  }

  const values = chartHistory.map((item) => options.getValue(item));
  const minValue = options.getMinValue(values);
  const maxValue = options.getMaxValue(values);
  const labelMinValue = Math.min(...values);
  const labelMaxValue = Math.max(...values);
  const valueRange = Math.max(maxValue - minValue, 1);
  const guideValues = (options.getGuides?.({ minValue, maxValue }) ?? [])
    .map((guide) => guide.value)
    .filter((value) => Number.isFinite(value));
  const widestLabelDigits = Math.max(...[minValue, maxValue, ...guideValues].map((value) => String(Math.abs(Math.round(value))).length));
  const yAxisLabelGap = widestLabelDigits >= 5 ? 20 : widestLabelDigits >= 4 ? 16 : 12;
  const timestamps = history.map((entry) => parseIsoDateTimestamp(entry.date));
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const points = chartHistory.map((entry) => {
    const x = xByDate.get(entry.date);
    const value = options.getValue(entry);
    const y = maxValue === minValue
      ? padding.top + innerHeight / 2
      : padding.top + ((maxValue - value) / valueRange) * innerHeight;

    return { x, y, value, ...entry };
  });

  const labelIndices = new Map();
  const minValueIndex = findLastIndex(values, (value) => value === labelMinValue);
  const maxValueIndex = findLastIndex(values, (value) => value === labelMaxValue);
  if (minValueIndex >= 0) {
    labelIndices.set(minValueIndex, "minValue");
  }
  if (maxValueIndex >= 0) {
    labelIndices.set(maxValueIndex, "maxValue");
  }
  labelIndices.set(chartHistory.length - 1, "lastValue");
  labelIndices.set(0, "firstValue");

  const linePath = buildPath(points);
  const areaPath = `${linePath} L ${points.at(-1).x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;
  const tickCount = clampTickCount(chartHistory.length);
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
  const yearMarkers = buildYearMarkersByPoints(domainHistory, domainPoints, padding, height);

  const xLabels = domainPoints.map((point, index) => {
    // if (index !== 0 && index !== domainHistory.length - 1) {
    //   return "";
    // }
    // if (!Boolean(labelIndices.get(index))) {
    //   return "";
    // }
    return `<text class="chart-axis-text" x="${point.x}" y="${height - 46}" dominant-baseline="hanging" text-anchor="middle">${formatIsoDate(point.date).slice(5)}</text>`;
  }).join("");

  const yLabels = ticks.map((tick) => `
    <g>
      <line class="chart-grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${tick.y}" y2="${tick.y}" />
      <text class="chart-axis-text" x="${padding.left - yAxisLabelGap}" y="${tick.y + 4}" text-anchor="end">${tick.value}</text>
    </g>
  `).join("");
  const guideMarkup = guides.map((guide) => `
    <g>
      <line class="chart-grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${guide.y}" y2="${guide.y}" />
      <text class="chart-axis-text" x="${padding.left - yAxisLabelGap}" y="${guide.y + 4}" text-anchor="end">${Math.round(guide.value)}</text>
    </g>
  `).join("");
  const yearMarkup = yearMarkers.map((marker) => `
    <g>
      ${marker.boundaryX !== null ? `<line class="chart-year-line" x1="${marker.boundaryX}" x2="${marker.boundaryX}" y1="${marker.lineTop}" y2="${marker.lineBottom}" />` : ""}
      <text class="chart-year-label" x="${marker.x}" y="${marker.labelY}" dominant-baseline="hanging" text-anchor="middle">${marker.year}</text>
    </g>
  `).join("");

  const pointMarkup = points.map((point, index) => {
    const labelRole = labelIndices.get(index);
    // const shouldShowLabel = Boolean(labelRole);
    const shouldShowLabel = true; // 全てのポイントにラベルを表示する場合はこちらを使用
    const placement = shouldShowLabel
      ? chooseLabelPlacement(points, index, labelRole, padding, innerHeight)
      : null;

    return `
    <g>
      <circle class="chart-point" cx="${point.x}" cy="${point.y}" r="6" />
      ${shouldShowLabel ? `<text class="chart-point-label" x="${placement.x}" y="${point.y - 16}" dominant-baseline="${placement.dominantBaseline}" text-anchor="middle">${options.getValue(point)}</text>` : ""}
    </g>
  `;
  }).join("");

  container.innerHTML = `
    <svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.ariaLabel}">
      ${yLabels}
      ${guideMarkup}
      <path class="chart-area" d="${areaPath}" />
      ${yearMarkup}
      <path class="chart-line" d="${linePath}" />
      ${xLabels}
      ${pointMarkup}
    </svg>
  `;
}

export function renderBpChart(container, history) {
  const domainHistory = buildChartDateDomain(history);
  const bestByDate = new Map();

  history.forEach((entry) => {
    if (!Number.isFinite(entry.bp)) {
      return;
    }

    const existing = bestByDate.get(entry.date);
    if (!existing || entry.bp < existing.bp) {
      bestByDate.set(entry.date, entry);
    }
  });

  const finiteHistory = Array.from(bestByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  renderTrendChart(container, finiteHistory, {
    domainHistory,
    ariaLabel: "BP推移グラフ",
    emptyMessage: "この曲のBP履歴はまだありません。",
    getValue: (entry) => entry.bp,
    getMinValue: () => 0,
    getMaxValue: (values) => Math.max(...values),
  });
}

export function renderScoreChart(container, history) {
  const domainHistory = buildChartDateDomain(history);
  const bestByDate = new Map();

  history.forEach((entry) => {
    if (!Number.isFinite(entry.score)) {
      return;
    }

    const existing = bestByDate.get(entry.date);
    if (!existing || entry.score > existing.score) {
      bestByDate.set(entry.date, entry);
    }
  });

  const theoreticalMax = Number(container.dataset.maxScore || 0);
  const finiteHistory = Array.from(bestByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  renderTrendChart(container, finiteHistory, {
    domainHistory,
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
