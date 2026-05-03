import { DIFFICULTY_HEADER_URL, KATATE_CSV_PATH } from "../constants.js?v=20260430-4";
import { parseCsv } from "./csv.js?v=20260430-4";

function normalizeString(value) {
  return String(value ?? "").trim();
}

function buildTitleMatchKey(title) {
  return normalizeString(title)
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll(/[‐‑‒–—―ー−]/g, "-")
    .replaceAll(/[’‘`´]/g, "'")
    .replaceAll(/[“”]/g, '"')
    .replaceAll(/[ \t\u3000]/g, "")
    .replaceAll(/[♡♥]/g, "♥");
}

const KATATE_TITLE_ALIASES = new Map([
  ["Amor De Verao(A)", "Amor De Verão(A)"],
  ["ATHER(A)", "ÆTHER(A)"],
  ["New Castle Legions(AC Resort Anthem)(A)", "New Castle Legions(譜面変更前)(A)"],
  ["Raison d'etre～交差する宿命～(A)", "Raison d'être～交差する宿命～(A)"],
  ["Raspberry Potion(feat.あれたん? & ぎゃるのしん☆)(A)", "Raspberry Potion(feat.あれたん♡ & ぎゃるのしん☆)(A)"],
  ["switch(DAISUKE ASAKURA ex.TЁЯRA)(A)", "switch(A)"],
  ["This Is Club Musik feat. 大久保紅葉(A)", "This Is Club Muzik feat. 大久保紅葉(A)"],
  ["Χ-DEN(H)", "X-DEN(H)"],
  ["POLꓘAMAИIA(A)", "POLꞰAMAИIA(A)"],
  ["Punch Love ? 仮面(L)", "Punch Love♡仮面(L)"],
  ["Ubertreffen(A)", "Übertreffen(A)"],
  ["表裏一体!?怪盗いいんちょの悩み?(A)", "表裏一体！？怪盗いいんちょの悩み♥(A)"],
  ["fffff(A)", "ƒƒƒƒƒ(A)"],
  ["キャトられ?恋はモ～モク(A)", "キャトられ♥恋はモ～モク(A)"],
  ["旋律のドグマ～Miserables～(A)", "旋律のドグマ～Misérables～(A)"],
  ["表裏一体!?怪盗いいんちょの悩み?(L)", "表裏一体！？怪盗いいんちょの悩み♥(L)"],
  ["Ubertreffen(L)", "Übertreffen(L)"],
  ["Dans la nuit de l'eternite(A)", "Dans la nuit de l'éternité(A)"],
  ["Χ-DEN(A)", "X-DEN(A)"],
]);

function resolveKatateTitleAlias(title) {
  return KATATE_TITLE_ALIASES.get(title) ?? title;
}

function buildChartKey(entry) {
  return [
    normalizeString(entry.title),
    normalizeString(entry.textageid),
    normalizeString(entry.level),
    normalizeString(entry.splv),
  ].join("|");
}

function normalizeDifficultyEntry(entry) {
  return {
    title: normalizeString(entry.title),
    level: normalizeString(entry.level),
    splv: normalizeString(entry.splv),
    recommend: normalizeString(entry.recommend),
    ver: normalizeString(entry.ver),
    bpm: normalizeString(entry.bpm),
    notes: Number(entry.notes) || 0,
    scratch: Number(entry.scratch) || 0,
    comment: normalizeString(entry.comment),
    inf: normalizeString(entry.inf),
    infpack: normalizeString(entry.infpack),
    acdelete: Boolean(entry.acdelete),
    katate: normalizeString(entry.katate),
    textageid: normalizeString(entry.textageid),
    video: normalizeString(entry.video),
    video2: normalizeString(entry.video2),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`難易度表データの取得に失敗しました: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchDifficultyTableSource() {
  const header = await fetchJson(DIFFICULTY_HEADER_URL);
  if (!header?.data_url) {
    throw new Error("難易度表データURLが見つかりません。");
  }

  return {
    dataUrl: header.data_url,
    symbol: header.symbol ?? "",
  };
}

async function fetchKatateMap() {
  const response = await fetch(KATATE_CSV_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`片手難易度CSVの取得に失敗しました: ${response.status} ${response.statusText}`);
  }

  const rows = parseCsv(await response.text());
  const katateMap = new Map();

  rows.forEach((row) => {
    const title = normalizeString(row.TITLE);
    const katate = normalizeString(row.LEVEL);
    if (!title || !katate) {
      return;
    }

    const resolvedTitle = resolveKatateTitleAlias(title);
    katateMap.set(title, katate);
    katateMap.set(buildTitleMatchKey(title), katate);
    katateMap.set(resolvedTitle, katate);
    katateMap.set(buildTitleMatchKey(resolvedTitle), katate);
  });

  return katateMap;
}

export async function attachKatateToDifficultyTable(difficultyTable) {
  if (!difficultyTable?.entries?.length) {
    return { table: difficultyTable, changedCount: 0 };
  }

  const katateMap = await fetchKatateMap();
  let changedCount = 0;

  const entries = difficultyTable.entries.map((entry) => {
    const matchedKatate = katateMap.get(normalizeString(entry.title)) ?? katateMap.get(buildTitleMatchKey(entry.title)) ?? "";
    const currentKatate = normalizeString(entry.katate);

    if (currentKatate === matchedKatate) {
      return normalizeDifficultyEntry(entry);
    }

    if (!matchedKatate) {
      return normalizeDifficultyEntry(entry);
    }

    changedCount += 1;
    return normalizeDifficultyEntry({ ...entry, katate: matchedKatate });
  });

  return {
    table: { ...difficultyTable, entries },
    changedCount,
  };
}

export async function fetchDifficultyTable() {
  const source = await fetchDifficultyTableSource();
  const [rawEntries, katateMap] = await Promise.all([
    fetchJson(source.dataUrl),
    fetchKatateMap(),
  ]);

  if (!Array.isArray(rawEntries)) {
    throw new Error("難易度表データの形式が不正です。");
  }

  const entries = [];
  const seenKeys = new Set();

  rawEntries.forEach((entry) => {
    if (!normalizeString(entry.title)) {
      return;
    }

    const chartKey = buildChartKey(entry);
    if (seenKeys.has(chartKey)) {
      return;
    }

    seenKeys.add(chartKey);
    const normalizedEntry = normalizeDifficultyEntry({
      ...entry,
      katate: katateMap.get(normalizeString(entry.title)) ?? katateMap.get(buildTitleMatchKey(entry.title)) ?? "",
    });
    entries.push(normalizedEntry);
  });

  entries.sort((a, b) => a.title.localeCompare(b.title, "ja") || a.level.localeCompare(b.level, "ja"));

  return {
    source,
    importedAt: new Date().toISOString(),
    totalEntries: rawEntries.length,
    entries,
    titleCount: new Set(entries.map((entry) => entry.title)).size,
  };
}
