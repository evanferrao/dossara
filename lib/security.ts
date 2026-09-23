/**
 * Security utilities for Dossara.
 * Enforces input sanitization, safe URL checking, and secure defaults.
 */

/**
 * Validates that a URL uses an approved, safe protocol (http, https, mailto).
 * Rejects javascript:, data:, vbscript:, and malformed strings to prevent XSS.
 */
export function isSafeUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed, "https://dossara.local");
    // Ensure protocol is explicitly allowed
    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

/**
 * Returns the URL if safe; otherwise returns the provided fallback.
 */
export function sanitizeUrl(url?: string | null, fallback: string = "#"): string {
  return isSafeUrl(url) ? url!.trim() : fallback;
}

/**
 * Validates that an Ollama backend instance URL is a valid HTTP/HTTPS endpoint.
 * Prevents SSRF / scheme injection attacks.
 */
export function isValidOllamaUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Sanitizes an uploaded document filename.
 * Strips path traversal sequences (../, ..\), path separators, and null/control characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") return "document";

  // Strip null and control characters
  let cleaned = filename.replace(/\0/g, "").replace(/[\x00-\x1f\x80-\x9f]/g, "");

  // Strip directory traversal sequences
  cleaned = cleaned.replace(/(?:\.\.[/\\])+/g, "");

  // Replace remaining path separators with underscores
  cleaned = cleaned.replace(/[/\\]/g, "_");

  // Strip any remaining leading/trailing dots or underscores
  cleaned = cleaned.replace(/^[._]+/, "").trim();

  return cleaned || "document";
}
