"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  getDocuments,
  deleteDocumentFull,
  type StoredDocument,
} from "@/lib/indexeddb";

export interface DocumentInfo {
  id: string;
  filename: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  page_count: number | null;
  cursor: number | null;
  error_message: string | null;
  created_at: string;
}

interface DocumentContextType {
  documents: DocumentInfo[];
  activeDocumentId: string | null;
  activePdfPage: number;
  setActiveDocumentId: (id: string | null) => void;
  setActivePdfPage: (page: number) => void;
  refreshDocuments: () => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  isLoading: boolean;
}

const DocumentContext = createContext<DocumentContextType | null>(null);

import { useChats } from "./ChatContext";

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { activeChatId } = useChats();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activePdfPage, setActivePdfPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDocuments = useCallback(async () => {
    if (!activeChatId) return;
    try {
      const docs = await getDocuments(activeChatId);
      setDocuments(
        docs.map((d: StoredDocument) => ({
          id: d.id,
          filename: d.filename,
          status: d.status,
          page_count: d.page_count,
          cursor: d.cursor,
          error_message: d.error_message,
          created_at: d.created_at,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeChatId]);

  const deleteDocumentAction = useCallback(
    async (id: string) => {
      try {
        await deleteDocumentFull(id);
        // If deleted doc was active, clear it
        if (activeDocumentId === id) {
          setActiveDocumentId(null);
        }
        // Refresh the list
        await refreshDocuments();
      } catch (err) {
        console.error("Failed to delete document:", err);
        throw err;
      }
    },
    [activeDocumentId, refreshDocuments]
  );

  useEffect(() => {
    setActiveDocumentId(null);
    setActivePdfPage(1);
  }, [activeChatId]);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  return (
    <DocumentContext.Provider
      value={{
        documents,
        activeDocumentId,
        activePdfPage,
        setActiveDocumentId,
        setActivePdfPage,
        refreshDocuments,
        deleteDocument: deleteDocumentAction,
        isLoading,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("useDocuments must be used within a DocumentProvider");
  }
  return context;
}
