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
    .filter((song) => song.entryCount > 0 && song.bestBp !== null)
    .sort(compareByTitle)
    .forEach((song) => {
      const lampCode = LAMP_EXPORT_CODES[song.bestLamp] ?? null;
      const textageKey = buildTextageKey(song);

      if (!lampCode || !textageKey) {
        return;
      }

      payload.bp[`bp_${song.title}`] = String(song.bestBp);
      payload.lamp[`lamp_${song.title}`] = lampCode;
      if (song.bestScore !== null) {
        payload.score[`score_${song.title}`] = String(song.bestScore);
      }
      payload.textageKey[song.title] = textageKey;
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
    const bp = Number(parseSectionValue(bpSection, "bp_", title));
    const score = Number(parseSectionValue(scoreSection, "score_", title));
    const lampCode = String(parseSectionValue(lampSection, "lamp_", title) ?? "").trim();
    const lamp = LAMP_IMPORT_CODES[lampCode];

    if (!Number.isInteger(bp) || bp < 0) {
      return null;
    }

    if (!Number.isInteger(score) || score < 0) {
      return null;
    }

    if (!lamp) {
      return null;
    }

    return {
      title,
      date: referenceDate,
      lamp,
      bp,
      score,
      textageKey: String(textageKeySection[title] ?? "").trim(),
      source: "json-import",
    };
  }).filter(Boolean);

  return records;
}
