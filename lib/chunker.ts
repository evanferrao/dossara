import {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  CHUNK_MAX_TOKENS,
  CHUNK_TOKEN_OVERLAP,
} from "./constants";

export interface Chunk {
  pageNumber: number;
  content: string;
  tokenCount?: number;
}

export interface TokenizerLike {
  encode(
    text: string
  ):
    | number[]
    | { length: number }
    | Uint32Array
    | Int32Array
    | BigInt64Array
    | unknown;
}

export type TokenCounter = (text: string) => number;

export interface ChunkOptions {
  tokenizer?: TokenizerLike | null;
  tokenCounter?: TokenCounter | null;
  maxTokens?: number;
  overlapTokens?: number;
  maxChars?: number;
  overlapChars?: number;
}

/**
 * Fast BERT/WordPiece token count estimator when a tokenizer is not provided.
 * Accounts for words, subwords, numbers, and punctuation.
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  const segments = text.match(/\w+|[^\w\s]|\s+/g);
  if (!segments) return Math.ceil(text.length / 4);

  let tokens = 0;
  for (const seg of segments) {
    if (/^\s+$/.test(seg)) continue;
    if (/^[^\w\s]$/.test(seg)) {
      tokens += 1;
      continue;
    }
    const len = seg.length;
    if (len <= 6) {
      tokens += 1;
    } else {
      tokens += Math.ceil(len / 4.5);
    }
  }
  return Math.max(1, tokens);
}

/**
 * Factory to create a unified token counting function from a tokenizer instance,
 * a custom counter, or the built-in estimator.
 */
export function createTokenCounter(
  tokenizer?: TokenizerLike | null,
  customCounter?: TokenCounter | null
): TokenCounter {
  if (customCounter) {
    return customCounter;
  }
  if (tokenizer && typeof tokenizer.encode === "function") {
    return (text: string): number => {
      if (!text || !text.trim()) return 0;
      try {
        const encoded = tokenizer.encode(text);
        if (Array.isArray(encoded)) return encoded.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (encoded && typeof (encoded as any).length === "number") return (encoded as any).length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (encoded && (encoded as any).input_ids?.size) return (encoded as any).input_ids.size;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (encoded && (encoded as any).input_ids?.data?.length) return (encoded as any).input_ids.data.length;
      } catch {
        // Fall back to heuristic
      }
      return estimateTokenCount(text);
    };
  }
  return estimateTokenCount;
}

/**
 * Recursively split a block of text into atomic pieces that do not exceed maxTokens / maxChars.
 */
function splitBlock(
  text: string,
  countTokens: TokenCounter,
  maxTokens: number,
  maxChars: number
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (countTokens(trimmed) <= maxTokens && trimmed.length <= maxChars) {
    return [trimmed];
  }

  // 1. Split by paragraphs (double or more newlines)
  if (trimmed.includes("\n\n")) {
    const parts = trimmed.split(/\n{2,}/);
    if (parts.length > 1) {
      const results: string[] = [];
      for (const p of parts) {
        results.push(...splitBlock(p, countTokens, maxTokens, maxChars));
      }
      return results;
    }
  }

  // 2. Split by single newlines (e.g. lists, table rows)
  if (trimmed.includes("\n")) {
    const parts = trimmed.split(/\n+/);
    if (parts.length > 1) {
      const results: string[] = [];
      for (const p of parts) {
        results.push(...splitBlock(p, countTokens, maxTokens, maxChars));
      }
      return results;
    }
  }

  // 3. Split by sentence boundaries (. ! ?)
  const sentenceMatches = trimmed.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g);
  if (sentenceMatches && sentenceMatches.length > 1) {
    const results: string[] = [];
    for (const s of sentenceMatches) {
      results.push(...splitBlock(s, countTokens, maxTokens, maxChars));
    }
    return results;
  }

  // 4. Split by clauses (semicolons, commas, colons)
  const clauseMatches = trimmed.match(/[^,;:]+(?:[,;:]+(?:\s+|$)|$)/g);
  if (clauseMatches && clauseMatches.length > 1) {
    const results: string[] = [];
    for (const c of clauseMatches) {
      results.push(...splitBlock(c, countTokens, maxTokens, maxChars));
    }
    return results;
  }

  // 5. Split by whitespace (words)
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    const results: string[] = [];
    let currentWords: string[] = [];
    for (const w of words) {
      const candidate = [...currentWords, w].join(" ");
      if (
        currentWords.length > 0 &&
        (countTokens(candidate) > maxTokens || candidate.length > maxChars)
      ) {
        results.push(currentWords.join(" "));
        currentWords = [w];
      } else {
        currentWords.push(w);
      }
    }
    if (currentWords.length > 0) {
      results.push(currentWords.join(" "));
    }
    return results;
  }

  // 6. Hard character slice fallback if a single uninterrupted word/token exceeds limits
  const chunks: string[] = [];
  let idx = 0;
  const step = Math.max(1, Math.min(maxChars, Math.floor(maxTokens * 3.5)));
  while (idx < trimmed.length) {
    chunks.push(trimmed.slice(idx, idx + step));
    idx += step;
  }
  return chunks;
}

/**
 * Compute overlap pieces from current pieces, falling back to trailing words
 * if complete pieces are larger than the overlap budget.
 */
function computeOverlapPieces(
  pieces: string[],
  countTokens: TokenCounter,
  overlapTokens: number,
  overlapChars: number
): string[] {
  if (pieces.length === 0 || overlapTokens <= 0 || overlapChars <= 0) {
    return [];
  }

  const overlapPieceCandidates: string[] = [];
  for (let j = pieces.length - 1; j >= 0; j--) {
    const potential = [pieces[j], ...overlapPieceCandidates].join(" ");
    if (
      overlapPieceCandidates.length > 0 &&
      (countTokens(potential) > overlapTokens || potential.length > overlapChars)
    ) {
      break;
    }
    // If the single candidate piece itself exceeds overlap limits, break to word fallback
    if (countTokens(potential) > overlapTokens || potential.length > overlapChars) {
      break;
    }
    overlapPieceCandidates.unshift(pieces[j]);
  }

  // If no full piece fit (e.g. all sentences are longer than overlapTokens), extract trailing words
  if (overlapPieceCandidates.length === 0 && pieces.length > 0) {
    const lastPiece = pieces[pieces.length - 1];
    const words = lastPiece.split(/\s+/);
    const trailingWords: string[] = [];
    for (let w = words.length - 1; w >= 0; w--) {
      const potential = [words[w], ...trailingWords].join(" ");
      if (
        trailingWords.length > 0 &&
        (countTokens(potential) > overlapTokens || potential.length > overlapChars)
      ) {
        break;
      }
      trailingWords.unshift(words[w]);
    }
    if (trailingWords.length > 0 && trailingWords.length < words.length) {
      overlapPieceCandidates.push(trailingWords.join(" "));
    }
  }

  // Safety: overlap cannot equal or exceed pieces length
  if (overlapPieceCandidates.length >= pieces.length) {
    overlapPieceCandidates.shift();
  }

  return overlapPieceCandidates;
}

/**
 * Split text into overlapping chunks respecting maxTokens and maxChars.
 * Keeps chunks at sentence / paragraph boundaries whenever possible while
 * strictly guaranteeing that no chunk exceeds the max token capacity
 * (default 256 for Xenova/all-MiniLM-L6-v2) and forward progress is preserved.
 */
export function splitText(text: string, options?: ChunkOptions): string[] {
  const cleaned = text.trim();
  if (!cleaned) {
    return [];
  }

  const maxTokens = options?.maxTokens ?? CHUNK_MAX_TOKENS;
  const rawOverlapTokens = options?.overlapTokens ?? CHUNK_TOKEN_OVERLAP;
  const maxChars = options?.maxChars ?? CHUNK_SIZE;
  const rawOverlapChars = options?.overlapChars ?? CHUNK_OVERLAP;

  // Sanitize overlap to avoid infinite loops or overlap >= chunk size
  const overlapTokens = Math.max(0, Math.min(rawOverlapTokens, Math.floor(maxTokens * 0.5)));
  const overlapChars = Math.max(0, Math.min(rawOverlapChars, Math.floor(maxChars * 0.5)));

  const countTokens = createTokenCounter(options?.tokenizer, options?.tokenCounter);

  // If text is already within limits, return it directly
  if (countTokens(cleaned) <= maxTokens && cleaned.length <= maxChars) {
    return [cleaned];
  }

  // Step 1: Split into atomic pieces (sentences, clauses, or words)
  const pieces = splitBlock(cleaned, countTokens, maxTokens, maxChars);
  if (pieces.length === 0) return [];

  const chunks: string[] = [];
  let currentPieces: string[] = [];

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const candidatePieces = [...currentPieces, piece];
    const candidateText = candidatePieces.join(" ");

    const candidateTokens = countTokens(candidateText);
    const candidateChars = candidateText.length;

    if (currentPieces.length > 0 && (candidateTokens > maxTokens || candidateChars > maxChars)) {
      // Finalize current chunk
      const chunkText = currentPieces.join(" ").trim();
      if (chunkText) {
        chunks.push(chunkText);
      }

      // Calculate overlap: take trailing pieces or words from current chunk
      const overlapPieceCandidates = computeOverlapPieces(
        currentPieces,
        countTokens,
        overlapTokens,
        overlapChars
      );

      currentPieces = [...overlapPieceCandidates, piece];
    } else {
      currentPieces.push(piece);
    }
  }

  if (currentPieces.length > 0) {
    const lastChunk = currentPieces.join(" ").trim();
    if (lastChunk) {
      chunks.push(lastChunk);
    }
  }

  return chunks;
}

/**
 * Given an array of page texts (index = page number - 1),
 * produce an array of Chunks.
 * Each chunk retains the page number it came from and includes tokenCount.
 */
export function chunkPages(
  pages: string[],
  startPage: number = 1,
  options?: ChunkOptions
): Chunk[] {
  const allChunks: Chunk[] = [];
  const countTokens = createTokenCounter(options?.tokenizer, options?.tokenCounter);

  for (let i = 0; i < pages.length; i++) {
    const pageNumber = startPage + i;
    const text = pages[i]?.trim();

    if (!text) {
      continue;
    }

    const textChunks = splitText(text, options);

    for (const content of textChunks) {
      allChunks.push({
        pageNumber,
        content,
        tokenCount: countTokens(content),
      });
    }
  }

  return allChunks;
}