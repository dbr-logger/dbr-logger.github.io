const LAMP_EXPORT_CODES = {
  "NO PLAY": null,
  FAILED: "F",
  ASSIST: "AE",
  EASY: "E",
  CLEAR: "C",
  HARD: "H",
  EXH: "EXH",
  FC: "FC",
};

const CHART_SUFFIX_PATTERN = /\(([BNHAL])\)$/;
const LAMP_IMPORT_CODES = {
  F: "FAILED",
  AE: "ASSIST",
  E: "EASY",
  C: "CLEAR",
  H: "HARD",
  EXH: "EXH",
  FC: "FC",
};

function compareByTitle(a, b) {
  return a.title.localeCompare(b.title, "ja");
}

function hasOwn(section, key) {
  return Object.prototype.hasOwnProperty.call(section ?? {}, key);
}

function parseOptionalInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function buildTextageKey(song) {
  const explicitKey = String(song.textageKey ?? "").trim();
  if (explicitKey) {
    return explicitKey;
  }

  const suffixMatch = String(song.title ?? "").match(CHART_SUFFIX_PATTERN);
  const textageId = String(song.textageid ?? "").trim();

  if (!suffixMatch || !textageId) {
    return null;
  }

  return `${textageId}(${suffixMatch[1]})`;
}

export function exportDbrJson(songStates) {
  const payload = {
    bp: {},
    lamp: {},
    score: {},
    textageKey: {},
  };

  songStates
    .filter((song) => song.entryCount > 0)
    .sort(compareByTitle)
    .forEach((song) => {
      const lampCode = LAMP_EXPORT_CODES[song.bestLamp] ?? null;
      const textageKey = buildTextageKey(song);

      if (Number.isFinite(song.bestBp)) {
        payload.bp[`bp_${song.title}`] = String(song.bestBp);
      }

      if (lampCode) {
        payload.lamp[`lamp_${song.title}`] = lampCode;
      }

      if (Number.isFinite(song.bestScore)) {
        payload.score[`score_${song.title}`] = String(song.bestScore);
      }

      if (textageKey) {
        payload.textageKey[song.title] = textageKey;
      }
    });

  return payload;
}

function parseSectionValue(section, prefix, title) {
  return section?.[`${prefix}${title}`];
}

export function importDbrJson(payload, referenceDate) {
  if (!payload || typeof payload !== "object") {
    throw new Error("JSONの形式が不正です。");
  }

  const bpSection = payload.bp ?? {};
  const lampSection = payload.lamp ?? {};
  const scoreSection = payload.score ?? {};
  const textageKeySection = payload.textageKey ?? {};
  const titles = new Set();

  Object.keys(bpSection).forEach((key) => {
    if (key.startsWith("bp_")) {
      titles.add(key.slice(3));
    }
  });

  Object.keys(lampSection).forEach((key) => {
    if (key.startsWith("lamp_")) {
      titles.add(key.slice(5));
    }
  });

  Object.keys(scoreSection).forEach((key) => {
    if (key.startsWith("score_")) {
      titles.add(key.slice(6));
    }
  });

  Object.keys(textageKeySection).forEach((title) => {
    titles.add(title);
  });

  const records = [...titles].sort((a, b) => a.localeCompare(b, "ja")).map((title) => {
    const bpKey = `bp_${title}`;
    const lampKey = `lamp_${title}`;
    const scoreKey = `score_${title}`;
    const textageKey = String(textageKeySection[title] ?? "").trim();

    const hasBp = hasOwn(bpSection, bpKey);
    const hasLamp = hasOwn(lampSection, lampKey);
    const hasScore = hasOwn(scoreSection, scoreKey);

    const bp = hasBp ? parseOptionalInteger(parseSectionValue(bpSection, "bp_", title)) : null;
    const score = hasScore ? parseOptionalInteger(parseSectionValue(scoreSection, "score_", title)) : null;
    const lampRaw = hasLamp ? String(parseSectionValue(lampSection, "lamp_", title) ?? "").trim() : "";

    if (hasBp && bp === null) {
      return null;
    }

    if (hasScore && score === null) {
      return null;
    }

    if (hasLamp && lampRaw && lampRaw !== "NO PLAY" && !LAMP_IMPORT_CODES[lampRaw]) {
      return null;
    }

    return {
      title,
      date: referenceDate,
      lamp: lampRaw === "NO PLAY"
        ? "NO PLAY"
        : (lampRaw ? LAMP_IMPORT_CODES[lampRaw] : "NO PLAY"),
      bp,
      score,
      textageKey,
      source: "json-import",
    };
  }).filter(Boolean);

  return records;
}
