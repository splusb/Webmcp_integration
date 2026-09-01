/**
 * Pure language-normalization transform for the project stats language chart.
 *
 * Converts a map of language -> byte count (as returned by the GitHub
 * `/repos/{owner}/{repo}/languages` endpoint) into a sorted list of
 * `{ name, percent }` slices suitable for a pie/donut chart.
 *
 * Requirements: 2.2 (language/topic breakdown), 2.6 (empty state for a chart
 * with no data). See design "Property 6: Language normalization is a valid
 * distribution".
 *
 * This module is intentionally dependency-free and side-effect-free.
 */

/** A single normalized language slice for the breakdown chart. */
export interface LanguageSlice {
  name: string;
  percent: number;
}

/** Clamp a number into the inclusive [0, 100] range. */
function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Normalize a map of language -> byte count into percentage slices.
 *
 * - Sums only positive, finite byte counts.
 * - Ignores non-positive or non-finite per-language values.
 * - Returns `[]` for an empty map or when the total is <= 0 (drives the
 *   chart's empty state).
 * - Each `percent` is bounded to [0, 100].
 * - Result is sorted descending by `percent` for stable chart rendering.
 */
export function normalizeLanguages(
  bytesByLang: Record<string, number>
): LanguageSlice[] {
  if (!bytesByLang) return [];

  const entries = Object.entries(bytesByLang);
  if (entries.length === 0) return [];

  // Keep only positive, finite byte counts; ignore everything else.
  const positive = entries.filter(
    ([, bytes]) => typeof bytes === "number" && Number.isFinite(bytes) && bytes > 0
  );

  const total = positive.reduce((sum, [, bytes]) => sum + bytes, 0);

  // Guard against zero/negative totals (empty or all non-positive input).
  if (total <= 0) return [];

  const slices: LanguageSlice[] = positive.map(([name, bytes]) => ({
    name,
    percent: clampPercent((bytes / total) * 100),
  }));

  // Sort descending by percent for stable, predictable chart rendering.
  slices.sort((a, b) => b.percent - a.percent);

  return slices;
}
