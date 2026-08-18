"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { getChats, createChat, deleteChat, updateChatTitle, type StoredChat } from "@/lib/indexeddb";

interface ChatContextType {
  chats: StoredChat[];
  activeChatId: string;
  setActiveChatId: (id: string) => void;
  createNewChat: () => Promise<string>;
  deleteChatById: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => Promise<void>;
  isLoading: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("default");
  const [isLoading, setIsLoading] = useState(true);

  const loadChats = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedChats = await getChats();
      if (loadedChats.length === 0) {
        // Ensure default chat exists if empty (this handles first load)
        await createChat("default", "Default Chat");
        setChats(await getChats());
        setActiveChatId("default");
      } else {
        setChats(loadedChats);
        // If active chat isn't in the list, fallback to the first one
        if (!loadedChats.find(c => c.id === activeChatId)) {
          setActiveChatId(loadedChats[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeChatId]);

  useEffect(() => {
    loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNewChat = useCallback(async () => {
    const newId = generateUUID();
    await createChat(newId, "New Chat");
    await loadChats();
    setActiveChatId(newId);
    return newId;
  }, [loadChats]);

  const deleteChatById = useCallback(async (id: string) => {
    await deleteChat(id);
    await loadChats();
  }, [loadChats]);

  const renameChat = useCallback(async (id: string, title: string) => {
    await updateChatTitle(id, title);
    await loadChats();
  }, [loadChats]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        setActiveChatId,
        createNewChat,
        deleteChatById,
        renameChat,
        isLoading
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChats() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChats must be used within a ChatProvider");
  }
  return context;
}
