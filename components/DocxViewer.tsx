"use client";

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { useDocuments } from "@/context/DocumentContext";
import { getDocumentFromCache } from "@/lib/indexeddb";

export function DocxViewer() {
  const { activeDocumentId } = useDocuments();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeDocumentId || !containerRef.current) {
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

        const arrayBuffer = await cachedBlob.arrayBuffer();
        if (!cancelled && containerRef.current) {
          await renderAsync(arrayBuffer, containerRef.current, containerRef.current, {
            className: "docx-preview",
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
          });
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
  }, [activeDocumentId]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)] overflow-hidden">
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin-slow" />
        </div>
      )}
      
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "var(--error)" }}>{error}</p>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className={`flex-1 overflow-auto p-4 ${isLoading || error ? 'hidden' : 'block'}`}
        style={{ backgroundColor: "var(--bg-primary)" }}
      />
    </div>
  );
}
