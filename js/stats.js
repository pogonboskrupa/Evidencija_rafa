import { DAY_TYPES, getVacationSettings } from './storage.js';

export function recordsForYear(user, year) {
  const prefix = `${year}-`;
  const out = {};
  for (const [key, rec] of Object.entries(user.records)) {
    if (key.startsWith(prefix)) out[key] = rec;
  }
  return out;
}

export function computeYearStats(user, year) {
  const records = recordsForYear(user, year);
  const counts = {};
  Object.keys(DAY_TYPES).forEach((t) => (counts[t] = 0));

  let trees = 0;
  let area = 0;
  let km = 0;
  let radniDani = 0;

  for (const rec of Object.values(records)) {
    if (!rec || !rec.type) continue;
    counts[rec.type] = (counts[rec.type] || 0) + 1;
    if (DAY_TYPES[rec.type]?.group === 'radni') {
      radniDani += 1;
      if (rec.type === 'doznaka') {
        trees += Number(rec.trees) || 0;
        area += Number(rec.area) || 0;
      }
      if (rec.type === 'vlake') {
        km += Number(rec.km) || 0;
      }
    }
  }

  const vacationSettings = getVacationSettings(user, year);
  const vacationUsed = counts.godisnji || 0;
  const vacationRemaining = Math.max(0, (Number(vacationSettings.days) || 0) - vacationUsed);

  return {
    records,
    counts,
    radniDani,
    trees,
    area,
    km,
    vacationSettings,
    vacationUsed,
    vacationRemaining,
  };
}
