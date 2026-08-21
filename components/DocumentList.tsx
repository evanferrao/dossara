"use client";

import { useState } from "react";
import { useDocuments, type DocumentInfo } from "@/context/DocumentContext";

function StatusBadge({ status }: { status: DocumentInfo["status"] }) {
  const config = {
    uploaded: { label: "Uploaded", className: "badge-warning" },
    processing: { label: "Processing", className: "badge-processing" },
    ready: { label: "Ready", className: "badge-success" },
    failed: { label: "Failed", className: "badge-error" },
  };

  const { label, className } = config[status] ?? config.uploaded;

  return (
    <span className={`badge ${className}`}>
      {status === "processing" && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {label}
    </span>
  );
}

export function DocumentList() {
  const { documents, activeDocumentId, setActiveDocumentId, setActivePdfPage, deleteDocument, isLoading } =
    useDocuments();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    setDocumentToDelete(docId);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;
    const docId = documentToDelete;
    setDocumentToDelete(null);
    setDeletingId(docId);
    try {
      await deleteDocument(docId);
    } catch {
      // Error already logged in context
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="shimmer-bg h-16 rounded-xl"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm">No documents yet</p>
        <p className="text-xs mt-1">Upload a PDF to get started</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`group relative w-full text-left px-3 py-3 rounded-xl transition-all border ${
            activeDocumentId === doc.id
              ? "bg-[var(--secondary)] border-[var(--border-subtle)] shadow-xs"
              : "hover:bg-[var(--secondary)]/60 border-transparent"
          } ${doc.status !== "ready" ? "opacity-60" : ""}`}
        >
          <button
            onClick={() => {
              if (doc.status === "ready") {
                setActiveDocumentId(doc.id);
                setActivePdfPage(1);
              }
            }}
            className={`w-full text-left ${doc.status !== "ready" ? "" : "cursor-pointer"}`}
          >
            <div className="flex items-start gap-3">
              {/* File icon */}
              <div
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: "var(--primary)" }}
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {doc.filename}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={doc.status} />
                  {doc.page_count && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {doc.page_count} pages
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* Delete button */}
          <button
            onClick={(e) => handleDeleteClick(e, doc.id)}
            disabled={deletingId === doc.id}
            className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--error-bg)]"
            title="Delete document"
          >
            {deletingId === doc.id ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--error)]/30 border-t-[var(--error)] animate-spin" />
            ) : (
              <svg
                className="w-3.5 h-3.5"
                style={{ color: "var(--error)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            )}
          </button>
        </div>
      ))}

      {/* Delete Confirmation Modal */}
      {documentToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "var(--backdrop-overlay)" }} onClick={() => setDocumentToDelete(null)}>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-5 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold tracking-tight mb-2" style={{ color: "var(--text-primary)" }}>Delete document?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              This will also remove its chunks and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setDocumentToDelete(null); }}
                className="px-3 py-1.5 text-sm font-medium transition-colors rounded-lg hover:bg-[var(--secondary)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); confirmDelete(); }}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
                style={{
                  color: "var(--error)",
                  background: "var(--error-bg)",
                  border: "1px solid var(--error-border)"
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
