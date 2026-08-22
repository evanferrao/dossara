import type {
  WebSearchConfig,
  WebSearchProviderInterface,
} from "./types";
import { TavilyWorkerProvider } from "./tavily-worker";
import { TavilyClientProvider } from "./tavily-client";

export function getWebSearchProvider(
  config: WebSearchConfig,
  workerUrl?: string
): WebSearchProviderInterface {
  switch (config.provider) {
    case "tavily-client":
      if (config.tavilyApiKey?.trim()) {
        return new TavilyClientProvider(config.tavilyApiKey);
      }
      return new TavilyClientProvider("");

    case "tavily-worker":
    default:
      return new TavilyWorkerProvider(workerUrl);
  }
}

export * from "./types";
export * from "./normalize";
export * from "./tavily-worker";
export * from "./tavily-client";
