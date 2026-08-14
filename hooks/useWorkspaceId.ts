"use client";

import { useRef, useSyncExternalStore } from "react";

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

/**
 * Creates a fetch wrapper that automatically includes the workspace ID header.
 */
export function useWorkspaceFetch() {
  const workspaceId = useWorkspaceId();
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;

  const fetchWithWorkspace = useRef(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      if (workspaceIdRef.current) {
        headers.set("x-workspace-id", workspaceIdRef.current);
      }
      return fetch(input, { ...init, headers });
    }
  );

  return { workspaceId, fetchWithWorkspace: fetchWithWorkspace.current };
}
