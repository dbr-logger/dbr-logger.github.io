export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatIsoDate(isoDate) {
  if (!isoDate) {
    return "-";
  }

  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

export function compareIsoDates(a, b) {
  return a.localeCompare(b);
}

export function parseImportedDateLabel(label, referenceDate = new Date()) {
  const match = label.match(/^BP\((\d{1,2})\/(\d{1,2})\)$/);

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = referenceDate.getFullYear();

  const candidate = new Date(year, month - 1, day);
  if (candidate.getTime() > referenceDate.getTime()) {
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
