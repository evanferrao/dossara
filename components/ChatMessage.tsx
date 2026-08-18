"use client";

import { useDocuments } from "@/context/DocumentContext";
import { CitationBadge } from "./CitationBadge";
import ReactMarkdown from "react-markdown";

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
  const { documents, setActiveDocumentId, setActivePdfPage } = useDocuments();

  // Strip citation HTML comments from display content
  const displayContent = content
    .replace(new RegExp("<!-- CITATIONS:\\s*\\[.*?\\](?:\\s*-->)?", "s"), "")
    .trim();

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
          {/* Render content with ReactMarkdown */}
          <div className="text-sm">
            <ReactMarkdown
              components={{
                p: ({node, ...props}) => <p className="mt-2 first:mt-0" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                em: ({node, ...props}) => <em className="italic" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc list-inside mt-2" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside mt-2" {...props} />,
                li: ({node, ...props}) => <li className="mt-1" {...props} />,
                h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-4 mb-2 first:mt-0" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-base font-bold mt-3 mb-1 first:mt-0" {...props} />,
                code: ({node, ...props}) => <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-xs" {...props} />,
                pre: ({node, ...props}) => <pre className="bg-black/30 p-3 rounded-lg mt-2 mb-2 overflow-x-auto text-xs" {...props} />,
                a: ({node, ...props}) => <a className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 ml-1">
            {citations.map((citation, i) => {
              const matchedDoc = documents.find(
                (d) => (citation.filename && d.filename === citation.filename) || 
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
        )}
      </div>
    </div>
  );
}
