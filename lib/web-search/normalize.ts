import type { WebSearchResult } from "./types";

export const DEFAULT_WEB_MIN_SCORE = 0.5;

/** Shape of a single result from the Tavily Search API response. */
interface TavilyRawResult {
  url?: string;
  title?: string;
  content?: string;
  raw_content?: string;
  score?: number;
  published_date?: string;
  publishedDate?: string;
}

/**
 * Extract a favicon URL from a target website URL using Google's favicon service.
 */
export function getFaviconUrl(urlStr: string): string | undefined {
  try {
    const url = new URL(urlStr);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
  } catch {
    return undefined;
  }
}

/**
 * Normalize and filter Tavily search API results.
 */
export function normalizeTavilyResults(
  rawResults: TavilyRawResult[],
  minScore: number = DEFAULT_WEB_MIN_SCORE
): WebSearchResult[] {
  if (!Array.isArray(rawResults) || rawResults.length === 0) {
    return [];
  }

  const normalized: WebSearchResult[] = rawResults
    .filter((r) => r && typeof r === "object" && typeof r.url === "string" && r.url.startsWith("http"))
    .map((r) => {
      const title = (r.title || "").trim() || "Untitled Web Result";
      const url = r.url!.trim();
      const content = (r.raw_content || r.content || "").trim();
      const score = typeof r.score === "number" ? r.score : undefined;
      const publishedDate = r.published_date || r.publishedDate || undefined;

      return {
        title,
        url,
        content,
        score,
        publishedDate,
        source: "tavily",
        favicon: getFaviconUrl(url),
      };
    });

  // Filter by minScore if score is present
  const filtered = normalized.filter(
    (r) => r.score === undefined || r.score >= minScore
  );

  // If filtering removed all results but raw results existed, fallback to top scored results
  if (filtered.length === 0 && normalized.length > 0) {
    normalized.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return normalized;
  }

  return filtered;
}
