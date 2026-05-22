# GLAS MCP v2.0 — Production Search & Fetch Server

A production-grade MCP (Model Context Protocol) server with multi-engine web search, web fetch, and structured scraping — no browser required.

---

## Tools

### `web_search`
Search the web across DuckDuckGo, Google, and Bing. Returns up to 200 clean, deduplicated, normalised results.

```json
POST /tools/web_search
{
  "query": "TypeScript MCP server tutorial",
  "maxResults": 50,
  "engine": "auto"
}
```

**Engines:** `auto` (aggregates all 3) | `duckduckgo` | `google` | `bing`

---

### `web_fetch`
Fetch any public URL and return clean text, markdown, HTML, or JSON.

```json
POST /tools/web_fetch
{
  "url": "https://example.com/article",
  "format": "markdown",
  "selector": "article",
  "maxLength": 20000
}
```

**Formats:** `text` | `markdown` | `html` | `json`

---

### `web_scrape`
Extract structured data from any page using CSS selectors.

```json
POST /tools/web_scrape
{
  "url": "https://news.ycombinator.com",
  "extract": [
    { "name": "titles", "selector": ".titleline a", "multiple": true },
    { "name": "scores", "selector": ".score", "multiple": true }
  ],
  "followLinks": false
}
```

---

## Setup

```bash
npm install
npm run build
npm start
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `PROXY_LIST` | Comma-separated proxies: `http://host:port,http://user:pass@host:port` | (none — direct) |

### Proxy Rotation
Set `PROXY_LIST` to rotate IPs automatically:

```env
PROXY_LIST=http://1.2.3.4:8080,http://user:pass@5.6.7.8:3128
```

Each request picks the next proxy in round-robin order.

---

## Architecture

```
src/
├── index.ts               # Fastify server entry
├── routes/
│   └── tools.ts           # POST /tools/:toolName with Zod validation & error handling
├── lib/
│   ├── httpClient.ts      # UA rotation, proxy rotation, retry with backoff
│   ├── scrapers.ts        # DuckDuckGo, Google, Bing scrapers + aggregator
│   └── urlUtils.ts        # URL normalisation, redirect unwrapping, deduplication
└── tools/
    ├── web_search/        # Multi-engine search tool
    ├── web_fetch/         # URL fetch tool
    └── web_scrape/        # Structured CSS extraction tool
```

## Adding a New Tool

1. Create `src/tools/your_tool/index.ts` exporting a default object with `name`, `description`, `inputSchema`, and `execute(input)`.
2. Run `npm run build` — it auto-loads from `dist/tools/`.

No registration needed.

---

## Response Format

All tools return:

```json
{
  "success": true,
  "...toolData": "...",
  "_meta": {
    "tool": "web_search",
    "executionMs": 842,
    "timestamp": "2026-05-22T10:00:00.000Z"
  }
}
```

Errors return structured JSON with HTTP 422 (bad input), 503 (network), or 500 (unexpected).
