import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { DocumentProvider } from "@/context/DocumentContext";
import { ChatProvider } from "@/context/ChatContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#181614",
};

export const metadata: Metadata = {
  title: "Dossara — Privacy-First Document Chat",
  description:
    "Upload PDFs and chat with your documents using AI. All processing happens locally in your browser — your data never leaves your device.",
  keywords: ["PDF", "AI", "chat", "documents", "RAG", "privacy", "local", "browser"],
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        {/* Content Security Policy — restrict resource loading to known origins */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://www.google.com; connect-src 'self' https://*.workers.dev https://api.tavily.com https://cdn.jsdelivr.net https://huggingface.co http://localhost:* http://127.0.0.1:*; worker-src 'self' blob:; frame-ancestors 'none';"
        />
        {/* External theme init script — prevents FOUC without requiring unsafe-inline */}
        <script src="/theme-init.js" />
      </head>
      <body
        className="min-h-full flex flex-col antialiased"
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}
      >
        <PwaRegister />
        <ThemeProvider>
          <ChatProvider>
            <DocumentProvider>{children}</DocumentProvider>
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
