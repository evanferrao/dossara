"use client";

import { useState } from "react";

export interface WebCitation {
  title: string;
  url: string;
  source: string;
  favicon?: string;
}

interface WebCitationBadgeProps {
  citation: WebCitation;
  index: number;
}

export function WebCitationBadge({ citation, index }: WebCitationBadgeProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);

  let hostname = "";
  try {
    hostname = new URL(citation.url).hostname.replace(/^www\./, "");
  } catch {
    hostname = citation.source || "web";
  }

  const title = citation.title || hostname || "Web Source";
  const displayTitle = title.length > 28 ? title.slice(0, 25) + "…" : title;

  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                 transition-all cursor-pointer no-underline
                 bg-[var(--secondary)] border border-[var(--border-subtle)]
                 hover:bg-[var(--secondary-hover)] hover:border-[var(--primary)]
                 active:scale-95 shadow-xs group"
      style={{ color: "var(--text-primary)" }}
      title={`${citation.title}\n${citation.url}`}
    >
      {/* Favicon or Globe Icon */}
      {citation.favicon && !faviconFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={citation.favicon}
          alt=""
          className="w-3.5 h-3.5 rounded-xs object-contain"
          onError={() => setFaviconFailed(true)}
        />
      ) : (
        <svg
          className="w-3.5 h-3.5 flex-shrink-0 transition-colors group-hover:text-[var(--primary)]"
          style={{ color: "var(--primary)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
          />
        </svg>
      )}

      <span className="font-semibold text-[11px] opacity-75 mr-0.5">[{index}]</span>
      <span className="truncate max-w-[140px] sm:max-w-[200px]">{displayTitle}</span>
      <span
        className="text-[10px] font-mono hidden sm:inline-block"
        style={{ color: "var(--text-muted)" }}
      >
        ({hostname})
      </span>

      {/* External link indicator */}
      <svg
        className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
        />
      </svg>
    </a>
  );
}
