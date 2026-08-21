"use client";

import { useState, useRef, useEffect } from "react";
import { useChats } from "@/context/ChatContext";

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { chats, activeChatId, setActiveChatId, createNewChat, deleteChatById, renameChat, isLoading } = useChats();
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleNewChat = async () => {
    await createNewChat();
  };

  const startEditing = (e: React.MouseEvent, chatId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const handleRenameSubmit = async (chatId: string) => {
    if (editingTitle.trim()) {
      await renameChat(chatId, editingTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, chatId: string) => {
    if (e.key === "Enter") {
      handleRenameSubmit(chatId);
    } else if (e.key === "Escape") {
      setEditingChatId(null);
    }
  };

  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingChatId]);

  return (
    <div className="w-64 h-full glass-panel-solid border-r flex flex-col" style={{ borderColor: "var(--border-subtle)" }}>
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
        <button
          onClick={handleNewChat}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>New Chat</span>
        </button>
      </div>

      {/* Chat List (Empty space acts as close trigger) */}
      <div 
        className="flex-1 overflow-y-auto p-2 cursor-w-resize hidden md:block" 
        onClick={() => onClose?.()}
        title="Close sidebar"
      >
        <div className="space-y-1 cursor-default" onClick={e => e.stopPropagation()} title="">
          {isLoading ? (
            <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
              <div className="w-5 h-5 mx-auto rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin-slow" />
            </div>
          ) : chats.length === 0 ? (
            <p className="text-xs text-center mt-10" style={{ color: "var(--text-muted)" }}>
              No chats yet.
            </p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
                  activeChatId === chat.id
                    ? "bg-[var(--secondary)] border-[var(--border-subtle)] shadow-xs"
                    : "hover:bg-[var(--secondary)]/60 border-transparent"
                }`}
                onClick={() => setActiveChatId(chat.id)}
              >
                <div className="flex-1 min-w-0 pr-2">
                  {editingChatId === chat.id ? (
                    <input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleRenameSubmit(chat.id)}
                      onKeyDown={(e) => handleKeyDown(e, chat.id)}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--primary)] rounded px-1.5 py-0.5 text-sm text-[var(--text-primary)] outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <p className="text-sm truncate font-medium" style={{ color: "var(--text-primary)" }}>
                        {chat.title}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {new Date(chat.created_at).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>
                
                <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity ${editingChatId === chat.id ? 'hidden' : ''}`}>
                  <button
                    onClick={(e) => startEditing(e, chat.id, chat.title)}
                    className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)]"
                    style={{ color: "var(--text-muted)" }}
                    title="Rename Chat"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.89l12.685-12.685z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatToDelete(chat.id);
                    }}
                    className={`p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] ${
                      chats.length <= 1 ? "hidden" : ""
                    }`}
                    style={{ color: "var(--text-muted)" }}
                    title="Delete Chat"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile view of chat list (no hide cursor) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 md:hidden">
        {isLoading ? (
          <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
            <div className="w-5 h-5 mx-auto rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin-slow" />
          </div>
        ) : chats.length === 0 ? (
          <p className="text-xs text-center mt-10" style={{ color: "var(--text-muted)" }}>
            No chats yet.
          </p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
                activeChatId === chat.id
                  ? "bg-[var(--secondary)] border-[var(--border-subtle)] shadow-xs"
                  : "hover:bg-[var(--secondary)]/60 border-transparent"
              }`}
              onClick={() => {
                setActiveChatId(chat.id);
                onClose?.(); // close mobile sidebar when selecting
              }}
            >
              <div className="flex-1 min-w-0 pr-2">
                {editingChatId === chat.id ? (
                  <input
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleRenameSubmit(chat.id)}
                    onKeyDown={(e) => handleKeyDown(e, chat.id)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--primary)] rounded px-1.5 py-0.5 text-sm text-[var(--text-primary)] outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <p className="text-sm truncate font-medium" style={{ color: "var(--text-primary)" }}>
                      {chat.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {new Date(chat.created_at).toLocaleDateString()}
                    </p>
                  </>
                )}
              </div>
              
              <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity ${editingChatId === chat.id ? 'hidden' : ''}`}>
                <button
                  onClick={(e) => startEditing(e, chat.id, chat.title)}
                  className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)]"
                  style={{ color: "var(--text-muted)" }}
                  title="Rename Chat"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.89l12.685-12.685z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatToDelete(chat.id);
                  }}
                  className={`p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] ${
                    chats.length <= 1 ? "hidden" : ""
                  }`}
                  style={{ color: "var(--text-muted)" }}
                  title="Delete Chat"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "var(--backdrop-overlay)" }} onClick={() => setChatToDelete(null)}>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-5 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold tracking-tight mb-2" style={{ color: "var(--text-primary)" }}>Delete chat?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              This will also remove all its documents and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setChatToDelete(null); }}
                className="px-3 py-1.5 text-sm font-medium transition-colors rounded-lg hover:bg-[var(--secondary)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  deleteChatById(chatToDelete); 
                  setChatToDelete(null); 
                }}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
                style={{
                  color: "var(--error)",
                  background: "var(--error-bg)",
                  border: "1px solid var(--error-border)"
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
