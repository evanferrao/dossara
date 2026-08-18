"use client";

import { useState } from "react";

const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_SOURCE ??
  "https://github.com/evanferrao/dossara";

export function LandingOverlay({ children, onOpenOllama }: { children: React.ReactNode; onOpenOllama?: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return <>{children}</>;
  }

  return (
    <>
      {/* App renders underneath but is non-interactive */}
      <div className="pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      {/* Full-screen overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex flex-col items-center gap-10 px-6 animate-fade-in">
          {/* Logo + Title */}
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center"
              style={{ boxShadow: "0 0 40px rgba(255, 255, 255, 0.15)" }}
            >
              <svg
                className="w-8 h-8 text-black"
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

            <div className="text-center">
              <h1
                className="text-4xl font-bold tracking-tight mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Dossara
              </h1>
              <p
                className="text-base max-w-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Intelligent Document Chat — Upload PDFs and chat with AI.
                All processing happens locally in your browser.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
            {/* Experience Demo — primary action */}
            <button
              onClick={() => setDismissed(true)}
              className="w-full flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm cursor-pointer transition-all"
              style={{
                background: "var(--accent-primary)",
                color: "#000",
                border: "1px solid var(--accent-primary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-primary-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--accent-primary)";
              }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                />
              </svg>
              Experience Demo
            </button>
            <button
              onClick={() => {
                setDismissed(true);
                if (onOpenOllama) onOpenOllama();
              }}
              className="w-full flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm cursor-pointer transition-all"
              style={{
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-tertiary)";
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.borderColor = "var(--border-medium)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Enable Local Ollama
            </button>
          </div>

          {/* Tech badges */}
          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {["Next.js 16", "React 19", "TypeScript", "Groq", "Privacy-First", "Docker"].map(
              (tech) => (
                <span
                  key={tech}
                  className="badge"
                  style={{ fontSize: "11px" }}
                >
                  {tech}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
