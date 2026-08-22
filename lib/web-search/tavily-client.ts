import type {
  WebSearchProviderInterface,
  WebSearchProviderType,
  WebSearchResult,
  WebSearchOptions,
} from "./types";
import { normalizeTavilyResults } from "./normalize";

export class TavilyClientProvider implements WebSearchProviderInterface {
  readonly providerType: WebSearchProviderType = "tavily-client";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  async search(
    query: string,
    options?: WebSearchOptions
  ): Promise<WebSearchResult[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    if (!this.apiKey) {
      throw new Error("Tavily API key is missing. Please configure your Tavily API key.");
    }

    const payload: Record<string, unknown> = {
      query: trimmedQuery,
      max_results: options?.maxResults ?? 5,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: true,
    };

    if (options?.timeRange) {
      payload.time_range = options.timeRange;
    }
    if (options?.includeDomains && options.includeDomains.length > 0) {
      payload.include_domains = options.includeDomains;
    }
    if (options?.excludeDomains && options.excludeDomains.length > 0) {
      payload.exclude_domains = options.excludeDomains;
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `Tavily API error (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fallback
      }

      if (response.status === 401) {
        throw new Error("Invalid Tavily API key. Please verify your API key in Web Search settings.");
      } else if (response.status === 429) {
        throw new Error("Tavily API rate limit reached on your account.");
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return normalizeTavilyResults(data.results || []);
  }
}
