import type { LocalRetrievalResult, HybridContextPayload } from "./types";
import type { WebSearchResult } from "../web-search/types";
import type { StoredDocument } from "../indexeddb";
import { MAX_WEB_CONTENT_CHARS_PER_RESULT } from "../constants";

export interface BuildContextParams {
  localResults?: LocalRetrievalResult[];
  webResults?: WebSearchResult[];
  readyDocs?: StoredDocument[];
  maxWebContentChars?: number;
}

export function buildHybridContext(params: BuildContextParams): HybridContextPayload {
  const {
    localResults = [],
    webResults = [],
    readyDocs = [],
    maxWebContentChars = MAX_WEB_CONTENT_CHARS_PER_RESULT,
  } = params;

  // 1. Build document inventory for user's uploaded files
  const docInventory = readyDocs
    .map(
      (d, i) => `${i + 1}. "${d.filename}" (${d.page_count ?? "?"} pages)`
    )
    .join("\n");

  // 2. Format local document passages
  const localSections: string[] = [];
  if (localResults.length > 0) {
    const formattedPassages = localResults
      .map((r, i) => {
        const pageInfo = r.pageNumber ? ` | Page: ${r.pageNumber}` : "";
        const simInfo = r.similarity !== undefined ? ` | Similarity: ${r.similarity}` : "";
        return `[LOCAL SOURCE ${i + 1}] Document: "${r.documentName}" (ID: ${r.documentId})${pageInfo}${simInfo}\nContent:\n${r.content}`;
      })
      .join("\n\n---\n\n");

    localSections.push(`### LOCAL DOCUMENT PASSAGES\n${formattedPassages}`);
  }

  // 3. Format external web results
  const webSections: string[] = [];
  if (webResults.length > 0) {
    const formattedWeb = webResults
      .map((r, i) => {
        let content = (r.content || "").trim();
        if (content.length > maxWebContentChars) {
          content = content.slice(0, maxWebContentChars) + "\n... [content truncated]";
        }
        const dateInfo = r.publishedDate ? `\nPublished: ${r.publishedDate}` : "";
        const scoreInfo = r.score !== undefined ? ` | Relevance: ${r.score.toFixed(2)}` : "";
        return `[WEB SOURCE ${i + 1}] Title: ${r.title}\nURL: ${r.url}${dateInfo}${scoreInfo}\nContent:\n${content || "No textual snippet available."}`;
      })
      .join("\n\n---\n\n");

    webSections.push(`### EXTERNAL WEB SOURCES\n${formattedWeb}`);
  }

  // 4. Combine sections
  const combinedContext = [...localSections, ...webSections].join("\n\n====================\n\n");

  const referencedDocIds = new Set(localResults.map((r) => r.documentId));

  return {
    context: combinedContext,
    docInventory,
    docCount: readyDocs.length,
    chunkCount: localResults.length,
    referencedDocCount: referencedDocIds.size,
    webSourceCount: webResults.length,
    localResults,
    webResults,
  };
}
