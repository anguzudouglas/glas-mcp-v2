// ---------------------------------------------------------------------------
// Junk URL patterns — skip these in search results
// ---------------------------------------------------------------------------
const JUNK_PATTERNS: RegExp[] = [
  /^https?:\/\/(www\.)?google\./,
  /^https?:\/\/(www\.)?duckduckgo\./,
  /^https?:\/\/(www\.)?bing\./,
  /^https?:\/\/(www\.)?yahoo\./,
  /\/search\?/,
  /\/url\?/,
  /^javascript:/,
  /^#/,
];

// ---------------------------------------------------------------------------
// Normalise a raw URL string → proper https:// URL or null
// ---------------------------------------------------------------------------
export function normaliseUrl(raw: string, baseOrigin?: string): string | null {
  if (!raw) return null;

  let cleaned = raw.trim();

  // DuckDuckGo redirect unwrapping: //duckduckgo.com/l/?uddg=<encoded>
  const uddg = cleaned.match(/[?&]uddg=([^&]+)/);
  if (uddg) {
    try { cleaned = decodeURIComponent(uddg[1]); } catch { /* ignore */ }
  }

  // Bing redirect unwrapping: /search?q=...&u=a1<b64>
  const bingU = cleaned.match(/[?&]u=a1([A-Za-z0-9+/=]+)/);
  if (bingU) {
    try { cleaned = Buffer.from(bingU[1], "base64").toString("utf8"); } catch { /* ignore */ }
  }

  // Ensure scheme
  if (cleaned.startsWith("//")) cleaned = "https:" + cleaned;
  if (!cleaned.startsWith("http")) {
    if (baseOrigin) cleaned = baseOrigin + (cleaned.startsWith("/") ? "" : "/") + cleaned;
    else return null;
  }

  try {
    const u = new URL(cleaned);
    // Remove tracking params
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","ref","fbclid","gclid"].forEach(
      (p) => u.searchParams.delete(p)
    );
    const normalised = u.toString();
    if (JUNK_PATTERNS.some((p) => p.test(normalised))) return null;
    return normalised;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deduplicate by normalised URL
// ---------------------------------------------------------------------------
export function deduplicateResults<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
