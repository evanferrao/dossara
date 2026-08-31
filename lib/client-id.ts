const CLIENT_ID_KEY = "dossara_client_id";

/**
 * Returns a persistent unique identifier for this client browser session.
 * Stored in localStorage so requests can be reliably tracked across IP changes.
 */
export function getClientId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        id = crypto.randomUUID();
      } else {
        id = `cid_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      }
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
