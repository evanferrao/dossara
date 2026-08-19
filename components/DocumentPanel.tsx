"use client";

import dynamic from "next/dynamic";
import { UploadDropzone } from "./UploadDropzone";
import { DocumentList } from "./DocumentList";

// Dynamic import with SSR disabled — react-pdf and others use browser APIs
const DocumentViewer = dynamic(
  () => import("./DocumentViewer").then((mod) => mod.DocumentViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin-slow" />
      </div>
    ),
  }
);

export function DocumentPanel() {
  return (
    <div
      className="flex flex-col h-full glass-panel-solid overflow-hidden"
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b flex items-center gap-3"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-[#333]">
          <svg
            className="w-4 h-4 text-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Documents
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Upload & view documents
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <UploadDropzone />

      {/* Document list */}
      <div
        className="border-t flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <p
          className="px-5 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Your Documents
        </p>
      </div>
      <div className="flex-shrink-0 max-h-48 overflow-y-auto">
        <DocumentList />
      </div>

      {/* Document Viewer */}
      <div
        className="flex-1 border-t min-h-0 flex flex-col"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <DocumentViewer />
      </div>
    </div>
  );
}
