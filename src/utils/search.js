function decodeHtmlEntities(text) {
  return String(text ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&aelig;", "æ")
    .replaceAll("&AElig;", "Æ")
    .replaceAll("&oslash;", "ø")
    .replaceAll("&Oslash;", "Ø")
    .replaceAll("&eacute;", "é")
    .replaceAll("&Eacute;", "É")
    .replaceAll("&uuml;", "ü")
    .replaceAll("&Uuml;", "Ü");
}

function normalizeKanaForSearch(value) {
  return String(value || "").replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

function normalizeSearchSurface(value) {
  return normalizeKanaForSearch(
    decodeHtmlEntities(String(value ?? "").normalize("NFKC"))
  ).toLowerCase();
}

function stripDiacritics(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stripSymbolCharacters(value) {
  return String(value ?? "").replace(/\p{S}/gu, "");
}

function stripAsciiSymbols(value) {
  return String(value ?? "").replace(/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/g, "");
}

function canonicalizeSymbolGroups(value) {
  return String(value ?? "")
    .replace(/[♡♥❤]/g, "♥")
    .replace(/[☆★]/g, "☆");
}

function stripChartSuffix(value) {
  const normalized = String(value ?? "").trim();
  const match = normalized.match(/^(.*)\(([bnhal])\)$/i);
  return match ? match[1] : normalized;
}

function normalizeQueryText(value) {
  return canonicalizeSymbolGroups(
    normalizeSearchSurface(value)
      .replace(/\s+/g, "")
  );
}

function normalizeTitleBase(value) {
  return canonicalizeSymbolGroups(
    stripChartSuffix(
      normalizeSearchSurface(value)
        .replace(/\s+/g, "")
    )
  );
}

function applyTitleCommonMappings(value) {
  return String(value ?? "")
    .replaceAll("µ", "u")
    .replaceAll("μ", "u")
    .replaceAll("и", "n")
    .replaceAll("ι", "i")
    .replaceAll("β", "b")
    .replaceAll("@", "a")
    .replaceAll("#", "h")
    .replaceAll("$", "s")
    .replaceAll("∀", "a")
    .replaceAll("Χ", "x")
    .replaceAll("χ", "x")
    .replaceAll("Λ", "A")
    .replaceAll("λ", "a")
    .replaceAll("Ʞ", "K")
    .replaceAll("ʞ", "k")
    .replaceAll("ꓘ", "K")
    .replaceAll("ƒ", "f")
    .replaceAll("Ә", "ə")
    .replaceAll("ә", "ə")
    .replaceAll("Ə", "ə")
    .replaceAll("≡", "三")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("■", "黒")
    .replaceAll("□", "白")
    .replaceAll("叉", "又")
    .replaceAll("ё", "e")
    .replaceAll("е", "e")
    .replaceAll("ə", "e")
    .replaceAll("я", "r")
    .replaceAll("ς", "σ")
    .replace(/…|・・・|⋯/g, "...")
    .replace(/‥/g, "..");
}

function buildGenericTitleAlias(value) {
  return stripDiacritics(
    stripSymbolCharacters(
    stripAsciiSymbols(
    applyTitleCommonMappings(value)
    .replaceAll("ø", "0")
  ))).toLowerCase();
}

function buildSymbolPreservingTitleAlias(value) {
  return stripDiacritics(
    canonicalizeSymbolGroups(
    applyTitleCommonMappings(value)
    .replaceAll("ø", "0")
  )).toLowerCase();
}

function stripSeparatorCharacters(value) {
  return String(value ?? "").replace(/[\p{P}\p{Z}]/gu, "");
}

function buildSeparatorStrippedTitleAlias(value) {
  return stripDiacritics(
    stripSeparatorCharacters(
    applyTitleCommonMappings(value)
    .replaceAll("ø", "0")
  )).toLowerCase();
}

const TITLE_EXACT_ALIASES = new Map([
  ["r∞tage", ["rootage"]],
  ["≡+≡", ["三十三"]],
  ["[]dentity", ["identity"]],
  ["3y3s", ["eyes"]],
  ["blo§om", ["blossom"]],
  ["m1dydeluxe", ["midydeluxe"]],
  ["m1dydynamic", ["midydynamic"]],
  ["m1dyfestival", ["midyfestival"]],
  ["won(*3*)chukissme!", ["wonchukissme!"]],
  ["xhronoxapsulξ", ["xhronoxapsule"]],
  ["x↑x↓", ["天上天下"]],
  ["τέλος", ["telos"]],
  ["εaπισ", ["elpis"]],
  ["εaπις", ["elpis"]],
  ["ελπισ", ["elpis"]],
  ["æther", ["ather","aether","ether"]],
  ["m4k31tb0unc3", ["makeitbounce"]],
  ["#magicvlgirl_trvp_b3vtz", ["magicalgirltrapbeatz"]],
  ["miracle5ymphox", ["miraclesymphox"]],
  ["3!dolonforc3", ["eidolonforce"]],
  ["3v0", ["evo"]],
  ["xb10r", ["xblor"]],
  ["dauntl3ss", ["dauntless"]],
  ["cosmicv3locity", ["cosmicvelocity"]],
  ["ëvolutiφn", ["evolution"]],
  ["fizzλ_pøt!0и", ["fizzy_potion", "fizzypotion"]],
  ["fizzλ_pøt!oи", ["fizzy_potion", "fizzypotion"]],
  ["spacebattleships4tø", ["spacebattleshipsato","spacebattleships4to","spacebattleshipssat0","spacebattleships4t0"]],
  ["《pl|rayer》", ["plrayer","player","prayer"]],
]);

function buildTitleSearchVariants(value) {
  const base = normalizeTitleBase(value);
  const exactAliases = TITLE_EXACT_ALIASES.get(base);
  const preservedAlias = buildSymbolPreservingTitleAlias(base);
  const strippedSeparatorAlias = buildSeparatorStrippedTitleAlias(base);

  if (exactAliases) {
    return [base, preservedAlias, strippedSeparatorAlias, ...exactAliases].filter(Boolean);
  }

  const variants = new Set([base]);
  if (preservedAlias && preservedAlias !== base) {
    variants.add(preservedAlias);
  }
  if (strippedSeparatorAlias && strippedSeparatorAlias !== base) {
    variants.add(strippedSeparatorAlias);
  }
  const genericAlias = buildGenericTitleAlias(base);
  if (genericAlias && genericAlias !== base) {
    variants.add(genericAlias);
  }

  if (base.includes("ø")) {
    variants.add(base.replaceAll("ø", "0"));
    variants.add(stripSeparatorCharacters(base).replaceAll("ø", "0"));
  }

  return [...variants].filter(Boolean);
}

export function matchesSearchText(value, query) {
  const queryKey = normalizeQueryText(query);
  if (!queryKey) {
    return true;
  }

  return buildTitleSearchVariants(value).some((variant) => variant.includes(queryKey));
}

export function isExactSearchTextMatch(value, query) {
  const queryKey = normalizeQueryText(query);
  if (!queryKey) {
    return false;
  }

  return buildTitleSearchVariants(value).some((variant) => variant === queryKey);
}

export function getSearchTextMatchRank(value, query) {
  const queryKey = normalizeQueryText(query);
  if (!queryKey) {
    return -1;
  }

  let bestRank = -1;

  buildTitleSearchVariants(value).forEach((variant) => {
    if (variant === queryKey) {
      bestRank = Math.max(bestRank, 2);
      return;
    }

    if (variant.startsWith(queryKey)) {
      bestRank = Math.max(bestRank, 1);
      return;
    }

    if (variant.includes(queryKey)) {
      bestRank = Math.max(bestRank, 0);
    }
  });

  return bestRank;
}
