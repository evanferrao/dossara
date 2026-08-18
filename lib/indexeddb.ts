/**
 * IndexedDB storage layer — replaces Supabase for all persistent data.
 */

export const DB_NAME = "dossara_db";
export const DB_VERSION = 3;

// Store names
const PDFS_STORE = "pdfs";
const DOCS_STORE = "documents";
const CHUNKS_STORE = "chunks";
const CHAT_STORE = "chat_messages";
const CHATS_STORE = "chats";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StoredChat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StoredDocument {
  id: string;
  chat_id: string;
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
  chat_id: string;
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
      const oldVersion = e.oldVersion;
      const tx = (e.target as IDBOpenDBRequest).transaction!;

      // PDF blobs
      if (!db.objectStoreNames.contains(PDFS_STORE)) {
        db.createObjectStore(PDFS_STORE);
      }

      // Document metadata
      let docStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        docStore = db.createObjectStore(DOCS_STORE, { keyPath: "id" });
      } else {
        docStore = tx.objectStore(DOCS_STORE);
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
      let chatStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        chatStore = db.createObjectStore(CHAT_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      } else {
        chatStore = tx.objectStore(CHAT_STORE);
      }

      // Chats
      let chatsStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(CHATS_STORE)) {
        chatsStore = db.createObjectStore(CHATS_STORE, { keyPath: "id" });
      } else {
        chatsStore = tx.objectStore(CHATS_STORE);
      }

      // V3 Upgrades
      if (oldVersion < 3) {
        if (!docStore.indexNames.contains("chat_id")) {
          docStore.createIndex("chat_id", "chat_id", { unique: false });
        }
        if (!chatStore.indexNames.contains("chat_id")) {
          chatStore.createIndex("chat_id", "chat_id", { unique: false });
        }

        const defaultChatId = "default";
        chatsStore.put({
          id: defaultChatId,
          title: "Default Chat",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        docStore.openCursor().onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const data = cursor.value;
            if (!data.chat_id) {
              data.chat_id = defaultChatId;
              cursor.update(data);
            }
            cursor.continue();
          }
        };

        chatStore.openCursor().onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const data = cursor.value;
            if (!data.chat_id) {
              data.chat_id = defaultChatId;
              cursor.update(data);
            }
            cursor.continue();
          }
        };
      }
    };
  });
}

// ── Chat operations ────────────────────────────────────────────────────────────

export async function createChat(id: string, title: string = "New Chat"): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, "readwrite");
    const store = tx.objectStore(CHATS_STORE);
    const request = store.put({
      id,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getChats(): Promise<StoredChat[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, "readonly");
    const store = tx.objectStore(CHATS_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const chats = (request.result as StoredChat[]) ?? [];
      chats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      resolve(chats);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getChat(id: string): Promise<StoredChat | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, "readonly");
    const store = tx.objectStore(CHATS_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function updateChatTitle(id: string, title: string): Promise<void> {
  const chat = await getChat(id);
  if (!chat) throw new Error(`Chat ${id} not found`);
  
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, "readwrite");
    const store = tx.objectStore(CHATS_STORE);
    const request = store.put({
      ...chat,
      title,
      updated_at: new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  // First get all documents for this chat to delete their blobs and chunks
  const docs = await getDocuments(chatId);
  for (const doc of docs) {
    await deleteDocumentFull(doc.id);
  }

  // Delete chat messages
  await clearChatMessages(chatId);

  // Finally delete the chat
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, "readwrite");
    const store = tx.objectStore(CHATS_STORE);
    const request = store.delete(chatId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ── PDF blob operations ────────────────────────────────────────────────────────

export async function saveDocumentToCache(id: string, blob: Blob): Promise<void> {
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

export async function getDocuments(chatId: string): Promise<StoredDocument[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, "readonly");
    const store = tx.objectStore(DOCS_STORE);
    
    let request;
    if (store.indexNames.contains("chat_id")) {
      const index = store.index("chat_id");
      request = index.getAll(chatId);
    } else {
      // Fallback if index not ready
      request = store.getAll();
    }

    request.onsuccess = () => {
      let docs = (request.result as StoredDocument[]) ?? [];
      // If we used getAll fallback, filter manually
      if (!store.indexNames.contains("chat_id")) {
        docs = docs.filter(d => d.chat_id === chatId || (!d.chat_id && chatId === "default"));
      }
      
      docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

export async function getChunksByDocumentId(documentId: string): Promise<StoredChunk[]> {
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

export async function saveChatMessage(msg: Omit<StoredChatMessage, "id">): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, "readwrite");
    const store = tx.objectStore(CHAT_STORE);
    const request = store.add(msg);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getChatMessages(chatId: string): Promise<StoredChatMessage[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, "readonly");
    const store = tx.objectStore(CHAT_STORE);
    
    let request;
    if (store.indexNames.contains("chat_id")) {
      const index = store.index("chat_id");
      request = index.getAll(chatId);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      let msgs = (request.result as StoredChatMessage[]) ?? [];
      if (!store.indexNames.contains("chat_id")) {
        msgs = msgs.filter(m => m.chat_id === chatId || (!m.chat_id && chatId === "default"));
      }
      
      // Sort ascending if index didn't do it automatically
      msgs.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      resolve(msgs);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearChatMessages(chatId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, "readwrite");
    const store = tx.objectStore(CHAT_STORE);
    
    if (store.indexNames.contains("chat_id")) {
      const index = store.index("chat_id");
      const request = index.openCursor(IDBKeyRange.only(chatId));
      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } else {
      // Fallback
      store.clear().onsuccess = () => resolve();
    }
  });
}
