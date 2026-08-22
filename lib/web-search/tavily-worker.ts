import type {
  WebSearchProviderInterface,
  WebSearchProviderType,
  WebSearchResult,
  WebSearchOptions,
} from "./types";

export class TavilyWorkerProvider implements WebSearchProviderInterface {
  readonly providerType: WebSearchProviderType = "tavily-worker";
  private workerUrl: string;

  constructor(workerUrl?: string) {
    const defaultUrl = process.env.NEXT_PUBLIC_WORKER_URL || "";
    // If NEXT_PUBLIC_WORKER_URL is a full chat URL (like https://worker.dev/api/chat), extract origin
    if (workerUrl) {
      this.workerUrl = workerUrl.replace(/\/api\/chat\/?$/, "").replace(/\/$/, "");
    } else if (defaultUrl) {
      this.workerUrl = defaultUrl.replace(/\/api\/chat\/?$/, "").replace(/\/$/, "");
    } else {
      this.workerUrl = "";
    }
  }

  async search(
    query: string,
    options?: WebSearchOptions
  ): Promise<WebSearchResult[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const endpoint = this.workerUrl
      ? `${this.workerUrl}/api/web-search`
      : "/api/web-search";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: trimmedQuery,
        maxResults: options?.maxResults ?? 5,
        timeRange: options?.timeRange,
        includeDomains: options?.includeDomains,
        excludeDomains: options?.excludeDomains,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Web search request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Fallback to generic status text
      }

      if (response.status === 429) {
        throw new Error(
          errorMessage || "Daily web search rate limit reached. Set your own API key to bypass limits."
        );
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return Array.isArray(data.results) ? data.results : [];
  }
}
