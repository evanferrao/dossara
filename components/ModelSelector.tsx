"use client";

import { useState, useEffect } from "react";
import { MODELS, type ModelKey } from "@/lib/constants";

interface ModelSelectorProps {
  value: ModelKey;
  onChange: (key: ModelKey) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempModel, setTempModel] = useState("");

  const isCustomModel = value && !MODELS.includes(value);

  const handleSave = () => {
    if (tempModel.trim()) {
      onChange(tempModel.trim());
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="relative flex items-center gap-2">
        <div className="relative">
          <select
            value={isCustomModel ? value : value}
            onChange={(e) => {
              if (e.target.value === "custom") {
                setTempModel("");
                setIsModalOpen(true);
              } else {
                onChange(e.target.value as ModelKey);
              }
            }}
            className="appearance-none input-base text-xs py-1.5 px-3 pr-8 cursor-pointer"
            style={{
              background: "var(--secondary)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {MODELS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
            {isCustomModel && (
              <option value={value}>
                {value}
              </option>
            )}
            <option value="custom">Custom model...</option>
          </select>
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: "var(--text-muted)" }}
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        {isCustomModel && (
          <button
            onClick={() => onChange(MODELS[0])}
            className="text-xs btn-ghost p-1.5 rounded-md flex-shrink-0"
            title="Reset to default model"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in" style={{ background: "var(--backdrop-overlay)" }}>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-6 rounded-2xl w-[400px] max-w-[90vw] shadow-2xl">
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Set Custom Model</h2>
            <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
              Enter the exact ID of the model you wish to use.
              <br /><br />
              See available models at{" "}
              <a
                href="https://console.groq.com/docs/models"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
                style={{ color: "var(--primary)" }}
              >
                https://console.groq.com/docs/models
              </a>.
            </p>
            <input
              type="text"
              value={tempModel}
              onChange={(e) => setTempModel(e.target.value)}
              placeholder="e.g. llama3-70b-8192"
              className="input-base w-full mb-4 px-3 py-2 text-sm"
              style={{ background: "var(--secondary)", borderColor: "var(--border-subtle)" }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setIsModalOpen(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="btn-ghost px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary px-4 py-2 text-sm">
                Save Model
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
