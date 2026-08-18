/**
 * IndexedDB storage layer — replaces Supabase for all persistent data.
 *
 * Object stores:
 *   pdfs           – PDF blobs keyed by document ID
 *   documents      – document metadata (filename, status, page_count, etc.)
 *   chunks         – text chunks with vector embeddings, indexed by document_id
 *   chat_messages  – conversation history, ordered by created_at
 */

export const DB_NAME = "dossara_db";
export const DB_VERSION = 2;

// Store names
const PDFS_STORE = "pdfs";
const DOCS_STORE = "documents";
const CHUNKS_STORE = "chunks";
const CHAT_STORE = "chat_messages";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StoredDocument {
  id: string;
  filename: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  page_count: number | null;
  cursor: number | null;
  error_message: string | null;
  created_at: string;
}

export interface StoredChunk {
  id?: number; // auto-increment key
  document_id: string;
  page_number: number;
  content: string;
  embedding: number[];
}

export interface StoredChatMessage {
  id?: number; // auto-increment key
  role: "user" | "assistant";
  content: string;
  citations?: { documentId: string; filename: string; page: number }[] | null;
  created_at: string;
}

// ── Database connection ────────────────────────────────────────────────────────

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(
        new Error(
          "IndexedDB is not supported or not running in a browser environment."
        )
      );
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // PDF blobs (existing store from v1)
      if (!db.objectStoreNames.contains(PDFS_STORE)) {
        db.createObjectStore(PDFS_STORE);
      }

      // Document metadata
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: "id" });
      }

      // Text chunks with embeddings
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunkStore = db.createObjectStore(CHUNKS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        chunkStore.createIndex("document_id", "document_id", {
          unique: false,
        });
      }

      // Chat messages
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        db.createObjectStore(CHAT_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
}

// ── PDF blob operations ────────────────────────────────────────────────────────

export async function saveDocumentToCache(
  id: string,
  blob: Blob
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDFS_STORE, "readwrite");
    const store = tx.objectStore(PDFS_STORE);
    const request = store.put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getDocumentFromCache(id: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDFS_STORE, "readonly");
      const store = tx.objectStore(PDFS_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to retrieve document from cache:", error);
    return null;
  }
}

export async function deleteDocumentFromCache(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PDFS_STORE, "readwrite");
      const store = tx.objectStore(PDFS_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to delete document from cache:", error);
  }
}

// ── Document metadata operations ───────────────────────────────────────────────

export async function saveDocument(doc: StoredDocument): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, "readwrite");
    const store = tx.objectStore(DOCS_STORE);
    const request = store.put(doc);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getDocuments(): Promise<StoredDocument[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, "readonly");
    const store = tx.objectStore(DOCS_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const docs = (request.result as StoredDocument[]) ?? [];
      // Sort by created_at descending (newest first)
      docs.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      resolve(docs);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDocument(id: string): Promise<StoredDocument | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, "readonly");
    const store = tx.objectStore(DOCS_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function updateDocument(
  id: string,
  fields: Partial<Omit<StoredDocument, "id">>
): Promise<void> {
  const existing = await getDocument(id);
  if (!existing) throw new Error(`Document ${id} not found`);
  await saveDocument({ ...existing, ...fields });
}

/**
 * Delete a document and all associated data (PDF blob + chunks).
 */
export async function deleteDocumentFull(id: string): Promise<void> {
  const db = await getDB();

  // Delete chunks by document_id
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, "readwrite");
    const store = tx.objectStore(CHUNKS_STORE);
    const index = store.index("document_id");
    const request = index.openCursor(IDBKeyRange.only(id));

    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Delete document metadata and PDF blob in parallel
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOCS_STORE, "readwrite");
      const req = tx.objectStore(DOCS_STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    }),
    deleteDocumentFromCache(id),
  ]);
}

// ── Chunk operations ───────────────────────────────────────────────────────────

export async function saveChunks(chunks: StoredChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, "readwrite");
    const store = tx.objectStore(CHUNKS_STORE);
    for (const chunk of chunks) {
      store.add(chunk);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllChunks(): Promise<StoredChunk[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, "readonly");
    const store = tx.objectStore(CHUNKS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function getChunksByDocumentId(
  documentId: string
): Promise<StoredChunk[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, "readonly");
    const store = tx.objectStore(CHUNKS_STORE);
    const index = store.index("document_id");
    const request = index.getAll(documentId);
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

// ── Chat message operations ────────────────────────────────────────────────────

export async function saveChatMessage(
  msg: Omit<StoredChatMessage, "id">
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, "readwrite");
    const store = tx.objectStore(CHAT_STORE);
    const request = store.add(msg);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getChatMessages(): Promise<StoredChatMessage[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, "readonly");
    const store = tx.objectStore(CHAT_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const msgs = (request.result as StoredChatMessage[]) ?? [];
      // Already ordered by auto-increment id (ascending)
      resolve(msgs);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearChatMessages(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, "readwrite");
    const store = tx.objectStore(CHAT_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
