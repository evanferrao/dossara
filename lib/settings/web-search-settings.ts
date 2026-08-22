import type { WebSearchConfig, WebSearchProviderType, TimeRange } from "../web-search/types";

const STORAGE_KEYS = {
  ENABLED: "dossara_web_search_enabled",
  PROVIDER: "dossara_web_search_provider",
  TAVILY_KEY: "dossara_tavily_api_key",
  TIME_RANGE: "dossara_web_search_time_range",
  MAX_RESULTS: "dossara_web_search_max_results",
} as const;

export const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  enabled: false,
  provider: "tavily-worker",
  tavilyApiKey: "",
  timeRange: undefined,
  maxResults: 5,
};

export function loadWebSearchConfig(): WebSearchConfig {
  if (typeof window === "undefined") {
    return { ...DEFAULT_WEB_SEARCH_CONFIG };
  }

  try {
    const enabled = localStorage.getItem(STORAGE_KEYS.ENABLED) === "true";
    const rawProvider = localStorage.getItem(STORAGE_KEYS.PROVIDER) as WebSearchProviderType | null;
    const tavilyApiKey = localStorage.getItem(STORAGE_KEYS.TAVILY_KEY) || "";
    const timeRange = (localStorage.getItem(STORAGE_KEYS.TIME_RANGE) as TimeRange) || undefined;
    const maxResults = Number(localStorage.getItem(STORAGE_KEYS.MAX_RESULTS) || "5");

    let provider: WebSearchProviderType = "tavily-worker";
    if (rawProvider === "tavily-client" && tavilyApiKey) {
      provider = "tavily-client";
    } else if (rawProvider === "tavily-worker") {
      provider = "tavily-worker";
    } else if (tavilyApiKey) {
      provider = "tavily-client";
    }

    return {
      enabled,
      provider,
      tavilyApiKey,
      timeRange,
      maxResults: isNaN(maxResults) ? 5 : maxResults,
    };
  } catch (err) {
    console.warn("Failed to load web search settings from localStorage:", err);
    return { ...DEFAULT_WEB_SEARCH_CONFIG };
  }
}

export function saveWebSearchConfig(config: Partial<WebSearchConfig>): WebSearchConfig {
  if (typeof window === "undefined") {
    return { ...DEFAULT_WEB_SEARCH_CONFIG, ...config };
  }

  try {
    const current = loadWebSearchConfig();
    const updated: WebSearchConfig = { ...current, ...config };

    if (config.enabled !== undefined) {
      localStorage.setItem(STORAGE_KEYS.ENABLED, String(updated.enabled));
    }
    if (config.provider !== undefined) {
      localStorage.setItem(STORAGE_KEYS.PROVIDER, updated.provider);
    }
    if (config.tavilyApiKey !== undefined) {
      if (config.tavilyApiKey.trim()) {
        localStorage.setItem(STORAGE_KEYS.TAVILY_KEY, config.tavilyApiKey.trim());
      } else {
        localStorage.removeItem(STORAGE_KEYS.TAVILY_KEY);
      }
    }
    if (config.timeRange !== undefined) {
      if (config.timeRange) {
        localStorage.setItem(STORAGE_KEYS.TIME_RANGE, config.timeRange);
      } else {
        localStorage.removeItem(STORAGE_KEYS.TIME_RANGE);
      }
    }
    if (config.maxResults !== undefined) {
      localStorage.setItem(STORAGE_KEYS.MAX_RESULTS, String(updated.maxResults));
    }

    return updated;
  } catch (err) {
    console.warn("Failed to save web search settings to localStorage:", err);
    return { ...DEFAULT_WEB_SEARCH_CONFIG, ...config };
  }
}

export function clearTavilyApiKey(): WebSearchConfig {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEYS.TAVILY_KEY);
  }
  return saveWebSearchConfig({ tavilyApiKey: "", provider: "tavily-worker" });
}
