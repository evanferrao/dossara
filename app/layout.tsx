import type { Metadata, Viewport } from "next";
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

import { ChatProvider } from "@/context/ChatContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PwaRegister } from "@/components/PwaRegister";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('dossara_theme');
                  var isDark = true;
                  if (saved === 'light') {
                    isDark = false;
                  } else if (saved === 'dark') {
                    isDark = true;
                  } else if (saved === 'system') {
                    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  }
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
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
