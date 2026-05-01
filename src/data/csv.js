import { parseImportedDateLabel } from "../utils/date.js?v=20260430-4";

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

export async function fetchInitialCsv(path) {
  if (!path) {
    throw new Error("初期CSVパスが指定されていません。");
  }

  if (window.location.protocol === "file:") {
    throw new Error("初期CSVの自動読込は file:// では動作しません。HTTPサーバで起動してください。");
  }

  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`初期CSVの読込に失敗しました: ${response.status} ${response.statusText}`);
  }

  return response.text();
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

export function importWideCsv(text, referenceDate = new Date()) {
  const rows = parseCsv(text);
  const songs = [];
  const records = [];
  const seenTitles = new Set();
  const dateColumns = rows.length > 0
    ? Object.keys(rows[0]).filter((header) => /^BP\(\d{1,2}\/\d{1,2}\)$/.test(header))
    : [];

  rows.forEach((row, index) => {
    const title = (row.TITLE ?? "").trim();
    if (!title) {
      return;
    }

    if (!seenTitles.has(title)) {
      songs.push({
        id: createSongId(title) || `song-${index + 1}`,
        title,
        level: parseNumber(row.LEVEL) ?? 0,
        sortOrder: parseNumber(row["並べ替え用"]) ?? index + 1,
        reserveOrder: parseNumber(row["予備"]) ?? index + 1,
        initialLamp: row["クリア"] || "NO PLAY",
        initialBestBp: parseNumber(row["BP(best)"]),
      });
      seenTitles.add(title);
    }

    dateColumns.forEach((column) => {
      const bp = parseNumber(row[column]);
      const date = parseImportedDateLabel(column, referenceDate);
      if (bp === null || date === null) {
        return;
      }

      records.push({
        id: `${createSongId(title) || `song-${index + 1}`}--${date}`,
        date,
        title,
        level: parseNumber(row.LEVEL) ?? 0,
        lamp: row["クリア"] || "NO PLAY",
        bp,
        source: "import",
      });
    });
  });

  songs.sort((a, b) => a.sortOrder - b.sortOrder || a.reserveOrder - b.reserveOrder);
  records.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ja"));

  return { songs, records };
}

export function importVerticalCsv(text) {
  const rows = parseCsv(text);
  const songNotes = {};

  const records = rows.map((row) => {
    const date = String(row.date ?? "").trim();
    const title = String(row.title ?? "").trim();
    const level = parseNumber(row.level) ?? 0;
    const lamp = String(row.lamp ?? "").trim() || "NO PLAY";
    const bp = parseNumber(row.bp);
    const score = parseNumber(row.score);
    const memo = String(row.memo ?? "").trim();

    if (memo) {
      songNotes[title] = memo;
    }

    if (!date || !title || bp === null) {
      return null;
    }

    return {
      id: `${createSongId(title) || "song"}--${date}`,
      date,
      title,
      level,
      lamp,
      bp,
      score,
      source: "csv-import",
    };
  }).filter(Boolean);

  records.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ja"));
  return { records, songNotes };
}

export function exportVerticalCsv(records, songNotes = {}) {
  const header = ["date", "title", "level", "lamp", "bp", "score", "memo"];
  const rows = records.map((record) => [
    record.date,
    record.title,
    record.level,
    record.lamp,
    record.bp,
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
      title,
      "",
      "",
      "",
      "",
      memo,
    ]);
  });

  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}
