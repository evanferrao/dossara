"use client";

import { useDocuments } from "@/context/DocumentContext";
import { CitationBadge } from "./CitationBadge";

interface Citation {
  documentId: string;
  filename: string;
  page: number;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export function ChatMessage({ role, content, citations }: ChatMessageProps) {
  const { setActiveDocumentId, setActivePdfPage } = useDocuments();

  // Strip citation HTML comments from display content
  const displayContent = content
    .replace(new RegExp("<!-- CITATIONS:\\s*\\[.*?\\]\\s*-->", "s"), "")
    .trim();

  const handleCitationClick = (citation: Citation) => {
    setActiveDocumentId(citation.documentId);
    setActivePdfPage(citation.page);
  };

  return (
    <div
      className={`flex gap-3 animate-fade-in ${
        role === "user" ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            role === "user"
              ? "bg-white text-black"
              : "bg-[#111] border border-[#333] text-white"
          }`}
      >
        {role === "user" ? "U" : "D"}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[80%] ${
          role === "user" ? "ml-auto" : "mr-auto"
        }`}
      >
        <div
            className={`px-4 py-3 rounded-2xl ${
              role === "user"
                ? "bg-[#111] border border-[#333] text-white"
                : "bg-transparent text-white"
            }`}
          style={{ color: "var(--text-primary)" }}
        >
          {/* Render content with basic markdown-like formatting */}
          {displayContent.split("\n").map((line, i) => (
            <p key={i} className={i > 0 ? "mt-2" : ""}>
              {line || "\u00A0"}
            </p>
          ))}
        </div>

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 ml-1">
            {citations.map((citation, i) => (
              <CitationBadge
                key={i}
                documentId={citation.documentId}
                filename={citation.filename}
                page={citation.page}
                onClick={() => handleCitationClick(citation)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
