"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".local");

    if (process.env.NODE_ENV !== "production" || isLocal) {
      // In development or localhost, unregister any existing service worker to prevent caching and 304 loops
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then(
        (registration) => {
          console.log("Service Worker registered with scope:", registration.scope);
        },
        (err) => {
          console.error("Service Worker registration failed:", err);
        }
      );
    });
  }, []);

  return null;
}
