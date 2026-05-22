import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

// ---------------------------------------------------------------------------
// User-Agent pool — desktop + mobile mix to avoid fingerprinting
// ---------------------------------------------------------------------------
const USER_AGENTS: string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

// ---------------------------------------------------------------------------
// Accept-Language pool
// ---------------------------------------------------------------------------
const ACCEPT_LANGUAGES: string[] = [
  "en-US,en;q=0.9",
  "en-GB,en;q=0.9",
  "en-US,en;q=0.8,es;q=0.5",
  "en-CA,en;q=0.9,fr;q=0.7",
  "en-AU,en;q=0.9",
];

// ---------------------------------------------------------------------------
// Free rotating proxy list (env-configurable)
// Format: "http://host:port" or "http://user:pass@host:port"
// Leave PROXY_LIST empty to disable (direct connection)
// ---------------------------------------------------------------------------
function getProxyList(): string[] {
  const raw = process.env.PROXY_LIST ?? "";
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

let _proxyIndex = 0;

function nextProxy(): string | undefined {
  const proxies = getProxyList();
  if (!proxies.length) return undefined;
  const proxy = proxies[_proxyIndex % proxies.length];
  _proxyIndex++;
  return proxy;
}

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------
export function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomAcceptLang(): string {
  return ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
}

function randomDelay(min = 300, max = 900): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Build a one-shot axios instance with rotated headers + optional proxy
// ---------------------------------------------------------------------------
export function buildClient(extraConfig: AxiosRequestConfig = {}): AxiosInstance {
  const proxy = nextProxy();

  const config: AxiosRequestConfig = {
    timeout: 18_000,
    maxRedirects: 5,
    headers: {
      "User-Agent": randomUA(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": randomAcceptLang(),
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      "DNT": "1",
    },
    ...extraConfig,
  };

  if (proxy) {
    try {
      const u = new URL(proxy);
      config.proxy = {
        protocol: u.protocol.replace(":", "") as "http" | "https",
        host: u.hostname,
        port: Number(u.port),
        ...(u.username ? { auth: { username: u.username, password: u.password } } : {}),
      };
    } catch {
      // malformed proxy entry — skip silently
    }
  }

  return axios.create(config);
}

// ---------------------------------------------------------------------------
// Robust GET with automatic retry + back-off
// ---------------------------------------------------------------------------
export async function robustGet(
  url: string,
  extraConfig: AxiosRequestConfig = {},
  maxRetries = 3
): Promise<{ data: string; finalUrl: string; status: number }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await randomDelay(600 * attempt, 1_400 * attempt);

    try {
      const client = buildClient(extraConfig);
      const res = await client.get<string>(url, { responseType: "text" });
      return {
        data: res.data as string,
        finalUrl: res.request?.res?.responseUrl ?? url,
        status: res.status,
      };
    } catch (err: any) {
      lastError = err;
      // 429 or 503 — back off harder
      if (err?.response?.status === 429 || err?.response?.status === 503) {
        await randomDelay(2_000 * (attempt + 1), 4_000 * (attempt + 1));
      }
    }
  }

  throw lastError;
}
