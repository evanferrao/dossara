"use client";

import { useState } from "react";
import { DocumentPanel } from "@/components/DocumentPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { LandingOverlay } from "@/components/LandingOverlay";
import { ApiKeyModal } from "@/components/ApiKeyModal";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"documents" | "chat">("documents");
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  return (
    <LandingOverlay>
    <main className="h-dvh flex flex-col overflow-hidden">
      {/* Gradient mesh background */}
      <div className="gradient-mesh" />

      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg border border-[#333]">
            <svg
              className="w-5 h-5 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <div>
            <h1
              className="text-base font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Dossara
            </h1>
            <p
              className="text-[11px] leading-none"
              style={{ color: "var(--text-muted)" }}
            >
              Intelligent Document Chat
            </p>
          </div>
        </div>

        {/* Mobile tab switcher */}
        <div className="flex gap-1 md:hidden">
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "documents"
                ? "bg-white text-black"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "chat"
                ? "bg-white text-black"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Chat
          </button>
        </div>

        {/* Set API Key button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsApiKeyModalOpen(true)}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            title="Set Custom API Key"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Custom API Key
          </button>
          
          {/* GitHub link */}
          <a
            href={process.env.NEXT_PUBLIC_GITHUB_SOURCE ?? "https://github.com/evanferrao/dossara"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost p-2 rounded-lg"
            title="View source on GitHub"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </header>

      {/* Main content — two-pane layout */}
      <div className="flex-1 flex min-h-0 p-3 gap-3">
        {/* Document panel — left */}
        <div
          className={`${
            activeTab === "documents" ? "flex" : "hidden"
          } md:flex flex-col w-full md:w-1/2 lg:w-[45%] min-h-0`}
        >
          <DocumentPanel />
        </div>

        {/* Chat panel — right */}
        <div
          className={`${
            activeTab === "chat" ? "flex" : "hidden"
          } md:flex flex-col w-full md:w-1/2 lg:w-[55%] min-h-0`}
        >
          <ChatPanel onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)} />
        </div>
      </div>
    </main>
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
    </LandingOverlay>
  );
}
