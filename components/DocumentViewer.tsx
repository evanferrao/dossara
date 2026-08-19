"use client";

import { useDocuments } from "@/context/DocumentContext";
import { PdfViewer } from "./PdfViewer";
import { DocxViewer } from "./DocxViewer";
import { TextViewer } from "./TextViewer";

export function DocumentViewer() {
  const { activeDocumentId, documents } = useDocuments();

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

  const activeDoc = documents.find((d) => d.id === activeDocumentId);
  const ext = activeDoc?.filename.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    return <PdfViewer />;
  }
  
  if (ext === "docx") {
    return <DocxViewer />;
  }
  
  if (['txt', 'md', 'csv', 'odt'].includes(ext || '')) {
    return <TextViewer />;
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-red-400">Unsupported file format for viewing.</p>
    </div>
  );
}
