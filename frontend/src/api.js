const FALLBACK_BASE_URL = "";

export function normalizeBaseUrl(rawBaseUrl) {
  const candidate = (rawBaseUrl || "").trim() || FALLBACK_BASE_URL;
  if (!candidate) {
    return "";
  }
  return candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
}

export function getApiBaseUrl() {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) {
    return normalizeBaseUrl(envBase);
  }

  if (typeof window !== "undefined") {
    const { port } = window.location;
    // Dev servers should use Vite proxy and avoid hardcoded backend hostnames.
    if (port === "3000" || port === "5173") {
      return "";
    }
    return window.location.origin;
  }

  return FALLBACK_BASE_URL;
}

function getRedirectBaseUrl() {
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3000" || port === "5173") {
      return `${protocol}//${hostname}:80`;
    }
    return window.location.origin;
  }

  return "http://localhost:80";
}

export async function createShortUrl(longUrl) {
  const response = await fetch(`${getApiBaseUrl()}/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ long_url: longUrl })
  });

  if (!response.ok) {
    const errorBody = await safeErrorBody(response);
    throw new Error(errorBody || "Failed to create short URL");
  }

  return response.json();
}

export async function resolveShortUrl(shortCode) {
  const response = await fetch(
    `${getApiBaseUrl()}/resolve/${encodeURIComponent(shortCode)}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const errorBody = await safeErrorBody(response);
    throw new Error(errorBody || "Failed to resolve short URL");
  }

  return response.json();
}

export function redirectUrl(shortCode) {
  return `${getRedirectBaseUrl()}/${encodeURIComponent(shortCode)}`;
}

async function safeErrorBody(response) {
  try {
    const body = await response.json();
    return body?.detail || null;
  } catch {
    return null;
  }
}
