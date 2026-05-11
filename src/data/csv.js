function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeTimestamp(value, date) {
  const normalized = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  const normalizedDate = String(date ?? "").trim();
  return normalizedDate ? `${normalizedDate}T00:00:00` : "";
}

function normalizeCsvText(value) {
  return String(value ?? "").trim();
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function createSongId(title) {
  return title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "");
}

function buildDifficultyLookup(difficultyTable) {
  const lookup = new Map();

  difficultyTable?.entries?.forEach((entry) => {
    if (!entry?.title || lookup.has(entry.title)) {
      return;
    }

    lookup.set(entry.title, {
      level: entry.level ?? "",
      splv: entry.splv ?? "",
    });
  });

  return lookup;
}

function createTextageKeyFromTitle(title, difficultyTable) {
  const entry = difficultyTable?.entries?.find((item) => item.title === title);
  if (!entry?.textageid || !entry?.title) {
    return "";
  }

  const suffix = entry.title.slice(-3);
  return /^\([A-Z]\)$/.test(suffix) ? `${entry.textageid}${suffix}` : "";
}

function resolveRecordTextageKey(record, difficultyTable) {
  return String(record?.textageKey ?? "").trim()
    || createTextageKeyFromTitle(record?.title, difficultyTable);
}

export function parseCsv(text) {
  const normalizedText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const lines = normalizedText.split("\n").filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

export function importVerticalCsv(text) {
  const rows = parseCsv(text);
  const songNotes = {};

  const records = rows.map((row) => {
    const date = String(row.date ?? "").trim();
    const timestamp = normalizeTimestamp(row.timestamp, date);
    const title = String(row.title ?? "").trim();
    const textageKey = normalizeCsvText(row.textageKey ?? row.textagekey ?? row.textage_key);
    const level = parseNumber(row.level);
    const splv = parseNumber(row.splv);
    const rawLamp = String(row.lamp ?? "").trim();
    const lamp = rawLamp || "NO PLAY";
    const bp = parseNumber(row.bp);
    const score = parseNumber(row.score);
    const memo = String(row.memo ?? "").trim();

    if (memo) {
      songNotes[title] = memo;
    }

    if (!date || !title) {
      return null;
    }

    if (rawLamp === "" && bp === null && score === null) {
      return null;
    }

    return {
      id: `${createSongId(title) || "song"}--${date}`,
      timestamp,
      date,
      textageKey,
      title,
      level,
      splv,
      lamp,
      bp,
      score,
      source: "csv-import",
    };
  }).filter(Boolean);

  records.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ja"));
  return { records, songNotes };
}

export function exportVerticalCsv(records, songNotes = {}, difficultyTable = null) {
  const difficultyLookup = buildDifficultyLookup(difficultyTable);
  const header = ["timestamp", "date", "textageKey", "title", "level", "splv", "lamp", "bp", "score", "memo"];
  const rows = records.map((record) => [
    normalizeTimestamp(record.timestamp, record.date),
    record.date,
    resolveRecordTextageKey(record, difficultyTable),
    record.title,
    difficultyLookup.get(record.title)?.level ?? record.level ?? "",
    difficultyLookup.get(record.title)?.splv ?? record.splv ?? "",
    record.lamp ?? "NO PLAY",
    record.bp ?? "",
    record.score ?? "",
    songNotes[record.title] ?? "",
  ]);

  const titlesWithRecords = new Set(records.map((record) => record.title));
  Object.entries(songNotes).forEach(([title, memo]) => {
    if (!memo || titlesWithRecords.has(title)) {
      return;
    }

    rows.push([
      "",
      "",
      resolveRecordTextageKey(record, difficultyTable),
      title,
      "",
      "",
      "",
      "",
      "",
      memo,
    ]);
  });

  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}
