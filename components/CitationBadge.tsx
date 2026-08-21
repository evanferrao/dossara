"use client";

interface CitationBadgeProps {
  documentId: string;
  filename: string;
  page: number;
  onClick: () => void;
}

export function CitationBadge({
  filename,
  page,
  onClick,
}: CitationBadgeProps) {
  // Truncate long filenames
  const safeFilename = filename || "Unknown Document";
  const displayName =
    safeFilename.length > 20 ? safeFilename.slice(0, 17) + "…" : safeFilename;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                 transition-all cursor-pointer
                 bg-[var(--secondary)] border border-[var(--border-subtle)]
                 hover:bg-[var(--secondary-hover)] hover:border-[var(--primary)]
                 active:scale-95 shadow-xs"
      style={{ color: "var(--text-primary)" }}
      title={`${filename} — Page ${page}`}
    >
      <svg
        className="w-3 h-3"
        style={{ color: "var(--accent)" }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span>{displayName}</span>
      <span className="font-normal" style={{ color: "var(--text-muted)" }}>p.{page}</span>
    </button>
  );
}
