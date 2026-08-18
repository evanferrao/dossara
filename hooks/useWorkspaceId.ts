"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "dossara-workspace-id";

function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getStoredWorkspaceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

// Simple external store for SSR compatibility
function subscribe(_onStoreChange: () => void) {
  // Workspace ID doesn't change during the session
  return () => {};
}

function getSnapshot(): string {
  return getStoredWorkspaceId();
}

function getServerSnapshot(): string {
  return "";
}

/**
 * Returns a stable workspace ID unique to this browser.
 * Generated on first visit, persisted in localStorage.
 */
export function useWorkspaceId(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
