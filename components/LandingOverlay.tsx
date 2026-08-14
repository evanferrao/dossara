"use client";

import { useState } from "react";

const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_SOURCE ??
  "https://github.com/evanferrao/dossara";

export function LandingOverlay({ children }: { children: React.ReactNode }) {
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
                Intelligent Document Chat — Upload PDFs and get AI-powered
                answers with source citations.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
            {/* Experience Demo — primary action */}
            <button
              onClick={() => setDismissed(true)}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm cursor-pointer transition-all"
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

            {/* View Source — secondary action */}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm cursor-pointer transition-all"
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
              {/* GitHub Icon */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              View Source
            </a>
          </div>

          {/* Tech badges */}
          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {["Next.js 16", "React 19", "TypeScript", "Groq", "pgvector", "Docker"].map(
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
