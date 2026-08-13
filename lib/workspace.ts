import { NextRequest } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract and validate the workspace ID from the `x-workspace-id` header.
 * Returns null if the header is missing or not a valid UUID.
 */
export function getWorkspaceId(req: NextRequest): string | null {
  const raw = req.headers.get("x-workspace-id");
  if (!raw || !UUID_RE.test(raw)) {
    return null;
  }
  return raw;
}
