"use client";

import { useState, useEffect } from "react";
import type { WebSearchConfig, WebSearchProviderType, TimeRange } from "@/lib/web-search/types";
import {
  saveWebSearchConfig,
  clearTavilyApiKey,
} from "@/lib/settings/web-search-settings";

interface WebSearchPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  config: WebSearchConfig;
  onConfigChange: (newConfig: WebSearchConfig) => void;
}

export function WebSearchPopover({
  isOpen,
  onClose,
  config,
  onConfigChange,
}: WebSearchPopoverProps) {
  const [selectedProvider, setSelectedProvider] = useState<WebSearchProviderType>(
    config.provider
  );
  const [tavilyKeyInput, setTavilyKeyInput] = useState(config.tavilyApiKey || "");
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange | undefined>(
    config.timeRange
  );
  const [showSavedNotification, setShowSavedNotification] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedProvider(config.provider);
      setTavilyKeyInput(config.tavilyApiKey || "");
      setSelectedTimeRange(config.timeRange);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleProviderSelect = (provider: WebSearchProviderType) => {
    setSelectedProvider(provider);
    const updated = saveWebSearchConfig({ provider });
    onConfigChange(updated);
  };

  const handleSaveTavilyKey = () => {
    const trimmed = tavilyKeyInput.trim();
    if (trimmed) {
      const updated = saveWebSearchConfig({
        tavilyApiKey: trimmed,
        provider: "tavily-client",
      });
      setSelectedProvider("tavily-client");
      onConfigChange(updated);
      showSavedToast();
    }
  };

  const handleClearTavilyKey = () => {
    setTavilyKeyInput("");
    const updated = clearTavilyApiKey();
    setSelectedProvider("tavily-worker");
    onConfigChange(updated);
  };

  const handleTimeRangeChange = (range: TimeRange | undefined) => {
    setSelectedTimeRange(range);
    const updated = saveWebSearchConfig({ timeRange: range });
    onConfigChange(updated);
  };

  const showSavedToast = () => {
    setShowSavedNotification(true);
    setTimeout(() => setShowSavedNotification(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
      style={{ background: "var(--backdrop-overlay)" }}
    >
      {/* Backdrop click dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-md bg-[var(--bg-primary)] border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ borderColor: "var(--border-subtle)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--secondary)] flex items-center justify-center border border-[var(--border-subtle)]">
              <svg
                className="w-4 h-4"
                style={{ color: "var(--primary)" }}
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
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Web Search Configuration
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Choose demo proxy or enter your own Tavily key
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-ghost p-1.5 rounded-lg text-xs"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Provider Selection */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2.5"
              style={{ color: "var(--text-muted)" }}
            >
              Search Provider
            </label>

            <div className="space-y-2.5">
              {/* Option 1: Tavily Worker */}
              <div
                onClick={() => handleProviderSelect("tavily-worker")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedProvider === "tavily-worker"
                    ? "bg-[var(--secondary)] border-[var(--primary)] shadow-xs"
                    : "hover:bg-[var(--secondary)] border-[var(--border-subtle)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="provider"
                    checked={selectedProvider === "tavily-worker"}
                    onChange={() => handleProviderSelect("tavily-worker")}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        Dossara Web Search (Default)
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] font-mono border border-[var(--border-subtle)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Cloudflare Worker
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      Proxied through Dossara with shared rate limiting. No API key required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Tavily Client */}
              <div
                onClick={() => handleProviderSelect("tavily-client")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedProvider === "tavily-client"
                    ? "bg-[var(--secondary)] border-[var(--primary)] shadow-xs"
                    : "hover:bg-[var(--secondary)] border-[var(--border-subtle)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="provider"
                    checked={selectedProvider === "tavily-client"}
                    onChange={() => handleProviderSelect("tavily-client")}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        My Tavily API Key
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] font-mono border border-[var(--border-subtle)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Static / Client-side
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      Direct unmetered browser calls with full page content. Your key stays 100% local.
                    </p>
                  </div>
                </div>

                {/* Expanded Input for Tavily Key */}
                {selectedProvider === "tavily-client" && (
                  <div
                    className="mt-3 pt-3 border-t pl-6"
                    style={{ borderColor: "var(--border-subtle)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label
                      className="block text-[11px] font-medium mb-1.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Tavily API Key (tvly-...)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={tavilyKeyInput}
                        onChange={(e) => setTavilyKeyInput(e.target.value)}
                        placeholder="tvly-xxxxxxxxxxxx"
                        className="input-base flex-1 text-xs px-3 py-1.5 font-mono"
                        style={{ background: "var(--bg-primary)" }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveTavilyKey}
                        disabled={!tavilyKeyInput.trim()}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        Save
                      </button>
                      {config.tavilyApiKey && (
                        <button
                          type="button"
                          onClick={handleClearTavilyKey}
                          className="btn-ghost text-xs px-2.5 py-1.5 text-[var(--error)]"
                          title="Clear API Key"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                      Get an API key from{" "}
                      <a
                        href="https://tavily.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                        style={{ color: "var(--primary)" }}
                      >
                        tavily.com
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Time Range Filter */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Recency Filter
            </label>
            <div className="grid grid-cols-5 gap-1 bg-[var(--secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
              {(
                [
                  { label: "Any", value: undefined },
                  { label: "Day", value: "day" as TimeRange },
                  { label: "Week", value: "week" as TimeRange },
                  { label: "Month", value: "month" as TimeRange },
                  { label: "Year", value: "year" as TimeRange },
                ] as const
              ).map((option) => {
                const isSelected = selectedTimeRange === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => handleTimeRangeChange(option.value)}
                    className={`py-1 text-xs rounded-lg font-medium transition-all ${
                      isSelected
                        ? "bg-[var(--bg-primary)] shadow-xs font-semibold"
                        : "hover:text-[var(--text-primary)] opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between text-xs"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)" }}
        >
          {showSavedNotification ? (
            <span className="font-medium animate-fade-in" style={{ color: "var(--success)" }}>
              ✓ Settings saved!
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>
              Provider: <strong style={{ color: "var(--text-primary)" }}>{selectedProvider}</strong>
            </span>
          )}

          <button onClick={onClose} className="btn-primary px-4 py-1.5 text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
