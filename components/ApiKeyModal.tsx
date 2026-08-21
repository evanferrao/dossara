"use client";

import { useState, useEffect } from "react";

export function ApiKeyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem("dossara_groq_api_key") || "");
    }
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem("dossara_groq_api_key", apiKey.trim());
    } else {
      localStorage.removeItem("dossara_groq_api_key");
    }
    // reload the page to apply changes easily without complex state management
    window.location.reload();
  };

  const handleDelete = () => {
    localStorage.removeItem("dossara_groq_api_key");
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in" style={{ background: "var(--backdrop-overlay)" }}>
      <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-6 rounded-2xl w-[400px] max-w-[90vw] shadow-2xl">
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Set Groq API Key</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
          Enter your own Groq API key to bypass the backend and make Dossara a completely static app. Your key is stored locally in your browser.
          <br /><br />
          Don't have a key? Get one for free at{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: "var(--primary)" }}
          >
            https://console.groq.com/keys
          </a>.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="gsk_..."
          className="input-base w-full mb-4 px-3 py-2 text-sm"
          style={{ background: "var(--secondary)", borderColor: "var(--border-subtle)" }}
        />
        <div className="flex justify-between items-center">
          <button onClick={handleDelete} className="btn-danger px-3 py-2 text-sm">
            Delete Key
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary px-4 py-2 text-sm">
              Save & Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
