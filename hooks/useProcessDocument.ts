/**
 * Client-side document processing hook.
 * Handles the full pipeline: PDF text extraction → chunking → embedding → IndexedDB storage.
 * Replaces the server-side /api/process-document route.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { chunkPages } from "@/lib/chunker";
import { embed } from "@/lib/embeddings";
import {
  saveDocumentToCache,
  saveDocument,
  updateDocument,
  saveChunks,
  type StoredDocument,
  type StoredChunk,
} from "@/lib/indexeddb";
import { PAGES_PER_BATCH } from "@/lib/constants";


export interface ProcessingState {
  phase: "idle" | "extracting" | "embedding" | "ready" | "failed";
  cursor: number;
  pageCount: number;
  error?: string;
}

interface UseProcessDocumentReturn {
  processingState: ProcessingState;
  processDocument: (
    documentId: string,
    file: File
  ) => Promise<void>;
}

export function useProcessDocument(): UseProcessDocumentReturn {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    phase: "idle",
    cursor: 0,
    pageCount: 0,
  });

  // Prevent concurrent processing
  const isProcessingRef = useRef(false);

  const processDocument = useCallback(
    async (documentId: string, file: File) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        // 1. Save PDF blob to IndexedDB
        await saveDocumentToCache(documentId, file);

        // 2. Create document metadata
        const doc: StoredDocument = {
          id: documentId,
          filename: file.name,
          status: "processing",
          page_count: null,
          cursor: 0,
          error_message: null,
          created_at: new Date().toISOString(),
        };
        await saveDocument(doc);

        setProcessingState({
          phase: "extracting",
          cursor: 0,
          pageCount: 0,
        });

        // 3. Extract text from PDF using pdfjs-dist
        const { pdfjs } = await import("react-pdf");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;

        await updateDocument(documentId, { page_count: totalPages });

        setProcessingState({
          phase: "extracting",
          cursor: 0,
          pageCount: totalPages,
        });

        // Extract text from all pages
        const allPageTexts: string[] = [];
        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const text = textContent.items
            .map((item: any) => ("str" in item ? item.str : ""))
            .join(" ");
          allPageTexts.push(text);
        }

        // 4. Process pages in batches: chunk + embed
        setProcessingState({
          phase: "embedding",
          cursor: 0,
          pageCount: totalPages,
        });

        for (
          let batchStart = 0;
          batchStart < totalPages;
          batchStart += PAGES_PER_BATCH
        ) {
          const batchEnd = Math.min(batchStart + PAGES_PER_BATCH, totalPages);
          const batchPages = allPageTexts.slice(batchStart, batchEnd);

          // Chunk the batch
          const chunks = chunkPages(batchPages, batchStart + 1); // pages are 1-indexed

          if (chunks.length > 0) {
            // Generate embeddings one at a time to keep memory bounded
            const storedChunks: StoredChunk[] = [];
            for (const chunk of chunks) {
              const embedding = await embed(chunk.content);
              storedChunks.push({
                document_id: documentId,
                page_number: chunk.pageNumber,
                content: chunk.content,
                embedding,
              });
            }

            // Store chunks + embeddings in IndexedDB
            await saveChunks(storedChunks);
          }

          // Update progress
          await updateDocument(documentId, { cursor: batchEnd });
          setProcessingState({
            phase: "embedding",
            cursor: batchEnd,
            pageCount: totalPages,
          });
        }

        // 5. Mark as ready
        await updateDocument(documentId, {
          status: "ready",
          cursor: totalPages,
        });

        setProcessingState({
          phase: "ready",
          cursor: totalPages,
          pageCount: totalPages,
        });
      } catch (err) {
        console.error("Error during document processing:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Processing failed";

        try {
          await updateDocument(documentId, {
            status: "failed",
            error_message: errorMessage,
          });
        } catch {
          // Ignore update errors during error handling
        }

        setProcessingState({
          phase: "failed",
          cursor: 0,
          pageCount: 0,
          error: errorMessage,
        });
      } finally {
        isProcessingRef.current = false;
      }
    },
    []
  );

  return { processingState, processDocument };
}
