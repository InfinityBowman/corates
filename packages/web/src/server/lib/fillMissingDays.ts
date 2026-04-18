/**
 * Fill missing days in a daily-count time series.
 *
 * Used by admin stats routes (signups, organizations, projects). Days run from
 * `days - 1` ago through today; missing entries get count 0.
 */
export interface DailyCount {
  date: string | null;
  count: number;
}

export function fillMissingDays(
  results: DailyCount[],
  days: number,
): Array<{ date: string; count: number }> {
  const dateMap = new Map(results.map(r => [r.date, r.count]));
  const filled: Array<{ date: string; count: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    filled.push({
      date: dateStr,
      count: dateMap.get(dateStr) || 0,
    });
  }

  return filled;
}
