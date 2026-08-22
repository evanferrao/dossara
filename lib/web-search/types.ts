export type WebSearchProviderType =
  | "tavily-worker"
  | "tavily-client";

export type TimeRange = "day" | "week" | "month" | "year";

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
  source: string;
  favicon?: string;
}

export interface WebSearchOptions {
  maxResults?: number;
  timeRange?: TimeRange;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface WebSearchProviderInterface {
  readonly providerType: WebSearchProviderType;
  search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
}

export interface WebSearchConfig {
  enabled: boolean;
  provider: WebSearchProviderType;
  tavilyApiKey?: string;
  timeRange?: TimeRange;
  maxResults?: number;
}
