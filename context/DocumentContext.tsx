"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useWorkspaceFetch } from "@/hooks/useWorkspaceId";

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
  fetchWithWorkspace: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const DocumentContext = createContext<DocumentContextType | null>(null);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activePdfPage, setActivePdfPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const { workspaceId, fetchWithWorkspace } = useWorkspaceFetch();

  const refreshDocuments = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetchWithWorkspace("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, fetchWithWorkspace]);

  const deleteDocument = useCallback(
    async (id: string) => {
      try {
        const res = await fetchWithWorkspace(`/api/documents?id=${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to delete document");
        }
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
    [fetchWithWorkspace, activeDocumentId, refreshDocuments]
  );

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
        deleteDocument,
        isLoading,
        fetchWithWorkspace,
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
