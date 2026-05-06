export function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLocalDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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

export function parseImportedDateLabel(label, referenceDateIso = todayIso()) {
  const match = label.match(/^BP\((\d{1,2})\/(\d{1,2})\)$/);

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);

  const referenceIso = referenceDateIso instanceof Date
    ? `${referenceDateIso.getFullYear()}-${String(referenceDateIso.getMonth() + 1).padStart(2, "0")}-${String(referenceDateIso.getDate()).padStart(2, "0")}`
    : String(referenceDateIso ?? todayIso());
  let year = Number(referenceIso.slice(0, 4));
  const candidateIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  if (candidateIso > referenceIso) {
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
