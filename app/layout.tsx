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
  title: "Dossara — Intelligent Document Chat",
  description:
    "Upload PDFs and chat with your documents using AI. Get instant answers with source citations and page references.",
  keywords: ["PDF", "AI", "chat", "documents", "RAG", "citations"],
};

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
        <DocumentProvider>{children}</DocumentProvider>
      </body>
    </html>
  );
}
