import { CHUNK_SIZE, CHUNK_OVERLAP } from "./constants";

export interface Chunk {
  pageNumber: number;
  content: string;
}

/**
 * Split text into overlapping chunks of roughly CHUNK_SIZE characters.
 * Attempts to end chunks at sentence boundaries while guaranteeing
 * forward progress.
 */
function splitText(text: string): string[] {
  const cleaned = text.trim();

  if (!cleaned) {
    return [];
  }

  if (cleaned.length <= CHUNK_SIZE) {
    return [cleaned];
  }

  // Prevent invalid configuration from causing an infinite loop.
  const overlap = Math.max(
    0,
    Math.min(CHUNK_OVERLAP, CHUNK_SIZE - 1)
  );

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    const initialEnd = Math.min(
      start + CHUNK_SIZE,
      cleaned.length
    );

    let end = initialEnd;

    // Try to find a sentence boundary in the last 20% of the chunk.
    if (initialEnd < cleaned.length) {
      const lookbackStart = Math.max(
        start,
        initialEnd - Math.floor(CHUNK_SIZE * 0.2)
      );

      const segment = cleaned.slice(lookbackStart, initialEnd);

      const lastSentenceEnd = Math.max(
        segment.lastIndexOf(". "),
        segment.lastIndexOf("! "),
        segment.lastIndexOf("? "),
        segment.lastIndexOf(".\n"),
        segment.lastIndexOf("!\n"),
        segment.lastIndexOf("?\n")
      );

      if (lastSentenceEnd >= 0) {
        const candidateEnd =
          lookbackStart + lastSentenceEnd + 1;

        // Only use the sentence boundary if it actually
        // produces a meaningful chunk.
        if (candidateEnd > start) {
          end = candidateEnd;
        }
      }
    }

    // Absolute safety: end must always advance.
    if (end <= start) {
      end = Math.min(start + CHUNK_SIZE, cleaned.length);
    }

    const chunk = cleaned.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    // We've reached the end.
    if (end >= cleaned.length) {
      break;
    }

    // Advance while retaining overlap.
    let nextStart = end - overlap;

    // Guarantee forward progress.
    if (nextStart <= start) {
      nextStart = end;
    }

    start = nextStart;
  }

  return chunks;
}

/**
 * Given an array of page texts (index = page number - 1),
 * produce an array of Chunks.
 * Each chunk retains the page number it came from.
 */
export function chunkPages(
  pages: string[],
  startPage: number = 1
): Chunk[] {
  const allChunks: Chunk[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageNumber = startPage + i;
    const text = pages[i]?.trim();

    if (!text) {
      continue;
    }

    const textChunks = splitText(text);

    for (const content of textChunks) {
      allChunks.push({
        pageNumber,
        content,
      });
    }
  }

  return allChunks;
}