"use client";

import { useSyncExternalStore } from "react";
import { generateUUID } from "@/lib/uuid";

const STORAGE_KEY = "dossara-workspace-id";

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
