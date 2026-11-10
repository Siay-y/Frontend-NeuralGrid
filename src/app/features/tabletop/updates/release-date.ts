const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatReleaseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const name = MONTHS[month - 1];
  if (!year || !name || !day) {
    return isoDate;
  }
  return `${day} ${name} ${year}`;
}
