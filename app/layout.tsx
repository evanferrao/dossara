import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { DocumentProvider } from "@/context/DocumentContext";
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

export const metadata: Metadata = {
  title: "Dossara — Privacy-First Document Chat",
  description:
    "Upload PDFs and chat with your documents using AI. All processing happens locally in your browser — your data never leaves your device.",
  keywords: ["PDF", "AI", "chat", "documents", "RAG", "privacy", "local", "browser"],
};

import { ChatProvider } from "@/context/ChatContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body
        className="min-h-full flex flex-col antialiased"
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}
      >
        <ChatProvider>
          <DocumentProvider>{children}</DocumentProvider>
        </ChatProvider>
      </body>
    </html>
  );
}
