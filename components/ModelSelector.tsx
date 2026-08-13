"use client";

import { MODELS, type ModelKey } from "@/lib/constants";

interface ModelSelectorProps {
  value: ModelKey;
  onChange: (key: ModelKey) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ModelKey)}
        className="appearance-none input-base text-xs py-1.5 px-3 pr-8 cursor-pointer"
        style={{
          background: "var(--bg-tertiary)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <option value="fast">⚡ {MODELS.fast}</option>
        <option value="versatile">🧠 {MODELS.versatile}</option>
      </select>
      {/* Dropdown arrow */}
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        style={{ color: "var(--text-muted)" }}
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  );
}
