/**
 * Prefer the same loopback hostname as the current page.
 * Avoids localhost ↔ 127.0.0.1 mismatches that break browser CORS/PNA.
 */
export function normalizeLoopbackUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const host = parsed.hostname;
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLoopback || typeof window === "undefined") {
    return trimmed.replace(/\/$/, "");
  }

  const pageHost = window.location.hostname;
  if (pageHost === "localhost" || pageHost === "127.0.0.1") {
    parsed.hostname = pageHost;
  }

  // Keep path; strip trailing slash except root
  const href = parsed.href.replace(/\/$/, "");
  return href;
}

export function pickPreferredOllamaModel(
  installed: string[],
  preferred: string,
): string {
  if (!installed.length) return preferred;
  const pref = preferred.trim();
  if (
    pref &&
    installed.some((name) => name === pref || name.startsWith(`${pref}:`))
  ) {
    return pref;
  }
  // Prefer gemma / qwen if present, else first installed
  const ranked =
    installed.find((name) => name.startsWith("gemma")) ||
    installed.find((name) => name.startsWith("qwen")) ||
    installed.find((name) => name.startsWith("llama")) ||
    installed[0];
  return ranked;
}
