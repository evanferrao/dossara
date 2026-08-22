"use client";

import { useState } from "react";
import type { WebSearchConfig } from "@/lib/web-search/types";
import { WebSearchPopover } from "./WebSearchPopover";
import { saveWebSearchConfig } from "@/lib/settings/web-search-settings";

interface WebSearchToggleProps {
  config: WebSearchConfig;
  onConfigChange: (config: WebSearchConfig) => void;
}

export function WebSearchToggle({ config, onConfigChange }: WebSearchToggleProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleToggleClick = () => {
    const updated = saveWebSearchConfig({ enabled: !config.enabled });
    onConfigChange(updated);
  };

  const getProviderLabel = () => {
    if (config.provider === "tavily-client") return "My Tavily";
    return "Worker";
  };

  return (
    <>
      <div className="relative inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--secondary)] p-0.5 shadow-xs">
        {/* Toggle Button */}
        <button
          type="button"
          onClick={handleToggleClick}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            config.enabled
              ? "bg-[var(--primary)] text-[var(--text-inverse)] shadow-xs"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--secondary-hover)]"
          }`}
          title={
            config.enabled
              ? "Web Search is ON — searching both local documents and web"
              : "Web Search is OFF — searching local documents only"
          }
        >
          {/* Globe Icon */}
          <svg
            className={`w-3.5 h-3.5 transition-transform ${config.enabled ? "scale-110" : "opacity-75"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>

          <span>Web Search</span>

          {config.enabled && (
            <span
              className="text-[9px] uppercase tracking-wider px-1 py-0.2 rounded font-semibold bg-white/20 ml-0.5"
            >
              ON
            </span>
          )}
        </button>

        {/* Popover / Settings trigger */}
        <button
          type="button"
          onClick={() => setIsPopoverOpen(true)}
          className={`p-1 rounded-lg text-xs transition-colors ${
            config.enabled
              ? "text-[var(--text-inverse)] hover:bg-white/10"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--secondary-hover)]"
          }`}
          title={`Configure search provider (${getProviderLabel()})`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Popover Modal */}
      <WebSearchPopover
        isOpen={isPopoverOpen}
        onClose={() => setIsPopoverOpen(false)}
        config={config}
        onConfigChange={onConfigChange}
      />
    </>
  );
}
