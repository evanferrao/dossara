"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDocuments } from "@/context/DocumentContext";
import {
  useProcessDocument,
  type ProcessingState,
} from "@/hooks/useProcessDocument";

type UploadState =
  | { phase: "idle" }
  | { phase: "extracting" }
  | { phase: "processing"; cursor: number; pageCount: number }
  | { phase: "ready" }
  | { phase: "failed"; error: string };

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapProcessingState(ps: ProcessingState): UploadState {
  switch (ps.phase) {
    case "idle":
      return { phase: "idle" };
    case "extracting":
      return { phase: "extracting" };
    case "embedding":
      return {
        phase: "processing",
        cursor: ps.cursor,
        pageCount: ps.pageCount,
      };
    case "ready":
      return { phase: "ready" };
    case "failed":
      return { phase: "failed", error: ps.error ?? "Processing failed" };
  }
}

export function UploadDropzone() {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refreshDocuments, setActiveDocumentId } = useDocuments();
  const { processingState, processDocument } = useProcessDocument();

  // Sync processing state to upload state
  useEffect(() => {
    const mapped = mapProcessingState(processingState);
    if (processingState.phase !== "idle") {
      setState(mapped);
    }
    if (processingState.phase === "ready") {
      // Reset to idle after showing success
      const timer = setTimeout(() => setState({ phase: "idle" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [processingState]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setState({ phase: "failed", error: "Only PDF files are supported" });
        return;
      }

      try {
        const documentId = generateUUID();

        setState({ phase: "extracting" });

        // Process entirely in-browser
        await processDocument(documentId, file);

        // Set as active and refresh list
        setActiveDocumentId(documentId);
        await refreshDocuments();
      } catch (err) {
        setState({
          phase: "failed",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [processDocument, refreshDocuments, setActiveDocumentId]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div className="p-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() =>
          state.phase === "idle" && fileInputRef.current?.click()
        }
        className={`dropzone ${isDragOver ? "active" : ""} ${
          state.phase !== "idle" ? "pointer-events-none" : ""
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={onFileSelect}
          className="hidden"
        />

        {state.phase === "idle" && (
          <div className="animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#111] border border-[#333] flex items-center justify-center">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ color: "var(--accent-primary)" }}
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                />
              </svg>
            </div>
            <p
              className="text-sm font-medium mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Drop a PDF here or click to upload
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Processed locally in your browser — your data never leaves this device
            </p>
          </div>
        )}

        {state.phase === "extracting" && (
          <div className="animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin-slow" />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Extracting text…
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Reading PDF pages
            </p>
          </div>
        )}

        {state.phase === "processing" && (
          <div className="animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin-slow" />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Generating embeddings…
            </p>
            {state.pageCount > 0 && (
              <>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Page {state.cursor} of {state.pageCount}
                </p>
                <div className="w-48 mx-auto mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{
                      width: `${(state.cursor / state.pageCount) * 100}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {state.phase === "ready" && (
          <div className="animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p
              className="text-sm font-medium text-emerald-400"
            >
              Ready! Document processed successfully.
            </p>
          </div>
        )}

        {state.phase === "failed" && (
          <div className="animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-400">
              {state.error}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setState({ phase: "idle" });
              }}
              className="btn-ghost text-xs mt-3"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
