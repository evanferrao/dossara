"use client";

import { useDocuments } from "@/context/DocumentContext";
import { CitationBadge } from "./CitationBadge";
import { WebCitationBadge, type WebCitation } from "./WebCitationBadge";
import ReactMarkdown from "react-markdown";

export interface Citation {
  documentId: string;
  filename: string;
  page: number;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  webCitations?: WebCitation[];
}

export function ChatMessage({
  role,
  content,
  citations,
  webCitations,
}: ChatMessageProps) {
  const { documents, setActiveDocumentId, setActivePdfPage } = useDocuments();

  // Strip both local and web citation HTML comment blocks from display content
  const displayContent = content
    .replace(/<!--\s*CITATIONS:[\s\S]*?(?:-->|$)/g, "")
    .replace(/<!--\s*WEB_CITATIONS:[\s\S]*?(?:-->|$)/g, "")
    .trim();

  const hasLocalCitations = citations && citations.length > 0;
  const hasWebCitations = webCitations && webCitations.length > 0;

  return (
    <div
      className={`flex gap-3 animate-fade-in ${
        role === "user" ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
          role === "user"
            ? "bg-[var(--primary)] text-[var(--text-inverse)] shadow-xs"
            : "bg-[var(--secondary)] border border-[var(--border-subtle)] shadow-xs"
        }`}
        style={{ color: role === "assistant" ? "var(--primary)" : undefined }}
      >
        {role === "user" ? "U" : "D"}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[85%] sm:max-w-[80%] ${
          role === "user" ? "ml-auto" : "mr-auto"
        }`}
      >
        <div
          className={`px-4 py-3 rounded-2xl ${
            role === "user"
              ? "bg-[var(--secondary)] border border-[var(--border-subtle)] shadow-xs"
              : "bg-transparent"
          }`}
          style={{ color: "var(--text-primary)" }}
        >
          {/* Render content with ReactMarkdown */}
          <div className="text-sm">
            <ReactMarkdown
              components={{
                p: ({ node, ...props }) => (
                  <p className="mt-2 first:mt-0 leading-relaxed" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong
                    className="font-semibold"
                    style={{ color: "var(--text-primary)" }}
                    {...props}
                  />
                ),
                em: ({ node, ...props }) => <em className="italic" {...props} />,
                ul: ({ node, ...props }) => (
                  <ul className="list-disc list-inside mt-2 space-y-1" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal list-inside mt-2 space-y-1" {...props} />
                ),
                li: ({ node, ...props }) => <li className="mt-1" {...props} />,
                h1: ({ node, ...props }) => (
                  <h1
                    className="text-xl font-bold mt-4 mb-2 first:mt-0"
                    style={{ color: "var(--text-primary)" }}
                    {...props}
                  />
                ),
                h2: ({ node, ...props }) => (
                  <h2
                    className="text-lg font-bold mt-4 mb-2 first:mt-0"
                    style={{ color: "var(--text-primary)" }}
                    {...props}
                  />
                ),
                h3: ({ node, ...props }) => (
                  <h3
                    className="text-base font-bold mt-3 mb-1 first:mt-0"
                    style={{ color: "var(--text-primary)" }}
                    {...props}
                  />
                ),
                code: ({ node, ...props }) => (
                  <code
                    className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded font-mono text-xs text-[var(--text-primary)]"
                    {...props}
                  />
                ),
                pre: ({ node, ...props }) => (
                  <pre
                    className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-3 rounded-lg mt-2 mb-2 overflow-x-auto text-xs text-[var(--text-primary)]"
                    {...props}
                  />
                ),
                a: ({ node, ...props }) => (
                  <a
                    className="underline hover:opacity-80 font-medium"
                    style={{ color: "var(--primary)" }}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  />
                ),
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* Citations Container */}
        {(hasLocalCitations || hasWebCitations) && (
          <div className="mt-3 ml-1 space-y-2">
            {/* Local Document Citations */}
            {hasLocalCitations && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase mb-1.5 opacity-70" style={{ color: "var(--text-muted)" }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span>Your Documents</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {citations.map((citation, i) => {
                    const matchedDoc =
                      documents.find(
                        (d) =>
                          (citation.filename && d.filename === citation.filename) ||
                          (citation.documentId && d.id === citation.documentId)
                      ) || (documents.length === 1 ? documents[0] : null);

                    const resolvedId = matchedDoc?.id ?? citation.documentId;
                    const resolvedFilename = matchedDoc?.filename ?? citation.filename;

                    return (
                      <CitationBadge
                        key={i}
                        documentId={resolvedId}
                        filename={resolvedFilename}
                        page={citation.page}
                        onClick={() => {
                          if (resolvedId) setActiveDocumentId(resolvedId);
                          if (citation.page) setActivePdfPage(Number(citation.page));
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Web Search Citations */}
            {hasWebCitations && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase mb-1.5 opacity-70" style={{ color: "var(--text-muted)" }}>
                  <svg className="w-3 h-3" style={{ color: "var(--primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <span>Web Sources</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {webCitations.map((webCitation, i) => (
                    <WebCitationBadge
                      key={i}
                      citation={webCitation}
                      index={i + 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
