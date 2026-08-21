"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useDocuments } from "@/context/DocumentContext";
import { getDocumentFromCache } from "@/lib/indexeddb";

// Configure the PDF.js worker from local public folder
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

export function PdfViewer() {
  const { activeDocumentId, activePdfPage, setActivePdfPage } = useDocuments();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInputValue, setPageInputValue] = useState("");

  // Memoize options to prevent unnecessary re-renders that destroy the worker
  const documentOptions = useMemo(() => ({
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  }), []);

  // Load PDF from IndexedDB when active document changes
  useEffect(() => {
    if (!activeDocumentId) {
      setPdfUrl(null);
      setNumPages(null);
      return;
    }

    let cancelled = false;
    let currentObjectUrl: string | null = null;
    
    setIsLoading(true);
    setError(null);

    const loadDocument = async () => {
      try {
        const cachedBlob = await getDocumentFromCache(activeDocumentId);
        if (!cachedBlob) {
          throw new Error("Document not found in local storage");
        }

        if (!cancelled) {
          currentObjectUrl = URL.createObjectURL(cachedBlob);
          setPdfUrl(currentObjectUrl);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load document"
          );
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      cancelled = true;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [activeDocumentId]);

  // Sync page input with active page
  useEffect(() => {
    setPageInputValue(String(activePdfPage));
  }, [activePdfPage]);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);
    },
    []
  );

  const goToPage = useCallback(
    (page: number) => {
      if (numPages && page >= 1 && page <= numPages) {
        setActivePdfPage(page);
      }
    },
    [numPages, setActivePdfPage]
  );

  const handlePageInput = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const page = parseInt(pageInputValue, 10);
        if (!isNaN(page)) goToPage(page);
      }
    },
    [pageInputValue, goToPage]
  );

  if (!activeDocumentId) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-sm">Select a document to view</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin-slow" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--error)" }}>{error}</p>
      </div>
    );
  }


  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)]">
      {/* Navigation bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-primary)" }}
      >
        <button
          onClick={() => goToPage(activePdfPage - 1)}
          disabled={activePdfPage <= 1}
          className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
        >
          ← Prev
        </button>

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span>Page</span>
          <input
            type="text"
            value={pageInputValue}
            onChange={(e) => setPageInputValue(e.target.value)}
            onKeyDown={handlePageInput}
            onBlur={() => {
              const page = parseInt(pageInputValue, 10);
              if (!isNaN(page)) goToPage(page);
              else setPageInputValue(String(activePdfPage));
            }}
            className="input-base text-center text-xs w-12 py-1 px-2"
          />
          <span>of {numPages ?? "…"}</span>
        </div>

        <button
          onClick={() => goToPage(activePdfPage + 1)}
          disabled={!numPages || activePdfPage >= numPages}
          className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {/* PDF canvas */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {pdfUrl && (
          <Document
            file={pdfUrl}
            options={documentOptions}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin-slow" />
              </div>
            }
            error={
              <p className="text-sm py-20 text-center" style={{ color: "var(--error)" }}>
                Failed to load PDF
              </p>
            }
          >
            <Page
              pageNumber={activePdfPage}
              width={600}
              loading={
                <div className="shimmer-bg w-[600px] h-[800px] rounded-lg" />
              }
            />
          </Document>
        )}
      </div>
    </div>
  );
}
