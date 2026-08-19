"use client";

import { useEffect, useState } from "react";
import { useDocuments } from "@/context/DocumentContext";
import { getDocumentFromCache } from "@/lib/indexeddb";
import { extractOdt, extractText } from "@/lib/extractors";
import ReactMarkdown from "react-markdown";

export function TextViewer() {
  const { activeDocumentId, documents } = useDocuments();
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDoc = documents.find((d) => d.id === activeDocumentId);
  const ext = activeDoc?.filename.split(".").pop()?.toLowerCase();

  useEffect(() => {
    if (!activeDocumentId || !activeDoc) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const loadDocument = async () => {
      try {
        const cachedBlob = await getDocumentFromCache(activeDocumentId);
        if (!cachedBlob) {
          throw new Error("Document not found in local storage");
        }

        const file = new File([cachedBlob], activeDoc.filename);
        let extracted: string[] = [];

        if (ext === "odt") {
          extracted = await extractOdt(file);
        } else {
          extracted = await extractText(file);
        }

        if (!cancelled) {
          setContent(extracted.join("\n\n"));
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
    };
  }, [activeDocumentId, activeDoc, ext]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900 overflow-hidden">
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin-slow" />
        </div>
      )}
      
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      
      {!isLoading && !error && (
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-4xl mx-auto prose dark:prose-invert">
            {ext === "md" ? (
              <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 bg-transparent border-0">
                {content}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
