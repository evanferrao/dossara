"use client";

import { useState, useCallback, useRef } from "react";
import { useDocuments } from "@/context/DocumentContext";

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "processing"; cursor: number; pageCount: number }
  | { phase: "ready" }
  | { phase: "failed"; error: string };

export function UploadDropzone() {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refreshDocuments, setActiveDocumentId, fetchWithWorkspace } = useDocuments();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setState({ phase: "failed", error: "Only PDF files are supported" });
        return;
      }

      try {
        // Step 1: Get signed upload URL
        setState({ phase: "uploading", progress: 0 });

        const urlRes = await fetchWithWorkspace("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });

        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { signedUrl, token, documentId } = await urlRes.json();

        // Step 2: PUT file directly to Supabase Storage
        setState({ phase: "uploading", progress: 50 });

        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/pdf",
            "x-upsert": "true",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          // Try with token as query param if PUT fails
          const urlWithToken = `${signedUrl}&token=${token}`;
          const retryRes = await fetch(urlWithToken, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/pdf" },
            body: file,
          });
          if (!retryRes.ok) throw new Error("Failed to upload file");
        }

        setState({ phase: "uploading", progress: 100 });

        // Step 3: Trigger processing
        const processRes = await fetchWithWorkspace("/api/process-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        });

        if (!processRes.ok) throw new Error("Failed to start processing");

        setState({ phase: "processing", cursor: 0, pageCount: 0 });

        // Step 4: Poll status
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetchWithWorkspace(
              `/api/document-status?id=${documentId}`
            );
            if (!statusRes.ok) return;
            const status = await statusRes.json();

            if (status.status === "processing") {
              setState({
                phase: "processing",
                cursor: status.cursor ?? 0,
                pageCount: status.pageCount ?? 0,
              });
            } else if (status.status === "ready") {
              clearInterval(pollInterval);
              setState({ phase: "ready" });
              setActiveDocumentId(documentId);
              refreshDocuments();
              // Reset to idle after a moment
              setTimeout(() => setState({ phase: "idle" }), 3000);
            } else if (status.status === "failed") {
              clearInterval(pollInterval);
              setState({
                phase: "failed",
                error: status.errorMessage || "Processing failed",
              });
            }
          } catch {
            // Keep polling on transient errors
          }
        }, 2500);
      } catch (err) {
        setState({
          phase: "failed",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [refreshDocuments, setActiveDocumentId, fetchWithWorkspace]
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
              Supports PDF files up to 50MB
            </p>
          </div>
        )}

        {state.phase === "uploading" && (
          <div className="animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin-slow" />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Uploading…
            </p>
            <div className="w-48 mx-auto mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {state.phase === "processing" && (
          <div className="animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin-slow" />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Processing…
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
