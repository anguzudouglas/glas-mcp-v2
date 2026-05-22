import * as cheerio from "cheerio";
import { robustGet } from "./httpClient.js";
import { normaliseUrl, deduplicateResults } from "./urlUtils.js";

export interface RawResult {
  url: string;
  title: string;
  snippet: string;
  source: string;
  position: number;
}

// ---------------------------------------------------------------------------
// DuckDuckGo HTML scraper (paginated via s= offset)
// ---------------------------------------------------------------------------
export async function scrapeDuckDuckGo(query: string, maxResults = 100): Promise<RawResult[]> {
  const results: RawResult[] = [];
  let offset = 0;
  const pageSize = 30;

  while (results.length < maxResults) {
    const url = offset === 0
      ? `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${offset}&dc=${offset + 1}&v=l&o=json&api=/d.js`;

    try {
      const { data } = await robustGet(url);
      const $ = cheerio.load(data);
      const before = results.length;

      $(".result:not(.result--ad)").each((_, el) => {
        const rawUrl =
          $(el).find("a.result__a").attr("href") ||
          $(el).find(".result__url").text().trim();

        const url = normaliseUrl(rawUrl ?? "");
        if (!url) return;

        const title = $(el).find("a.result__a").text().trim();
        const snippet = $(el).find(".result__snippet").text().trim();

        if (url && title) {
          results.push({
            url,
            title,
            snippet,
            source: "duckduckgo",
            position: results.length + 1,
          });
        }
      });

      // No new results on this page — stop paginating
      if (results.length === before) break;

      offset += pageSize;
    } catch {
      break;
    }
  }

  return results.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Google scraper — no browser, plain HTTP with header spoofing
// Uses multiple Google domains + lang params to rotate identity
// ---------------------------------------------------------------------------
const GOOGLE_DOMAINS = [
  "https://www.google.com",
  "https://www.google.co.uk",
  "https://www.google.ca",
  "https://www.google.com.au",
];

export async function scrapeGoogle(query: string, maxResults = 100): Promise<RawResult[]> {
  const results: RawResult[] = [];
  let start = 0;
  const pageSize = 10;
  const domain = GOOGLE_DOMAINS[Math.floor(Math.random() * GOOGLE_DOMAINS.length)];

  while (results.length < maxResults) {
    const url =
      `${domain}/search?q=${encodeURIComponent(query)}&num=${pageSize}&start=${start}&hl=en&gl=us&ie=UTF-8`;

    try {
      const { data } = await robustGet(url, {
        headers: {
          // Google checks Referer for pagination
          Referer: start === 0 ? "https://www.google.com/" : url,
        },
      });

      const $ = cheerio.load(data);
      const before = results.length;

      // Primary result blocks
      $("div.g, div[data-sokoban-container], div.tF2Cxc").each((_, el) => {
        const anchor = $(el).find("a[href]").first();
        const rawHref = anchor.attr("href") ?? "";
        const resolvedUrl = normaliseUrl(rawHref, domain);
        if (!resolvedUrl) return;

        const title =
          $(el).find("h3").first().text().trim() ||
          anchor.attr("title") ||
          "";

        const snippet =
          $(el).find("div.VwiC3b, div.IsZvec, span.aCOpRe, div[data-content-feature='1']")
            .first()
            .text()
            .trim();

        if (resolvedUrl && title) {
          results.push({
            url: resolvedUrl,
            title,
            snippet,
            source: "google",
            position: results.length + 1,
          });
        }
      });

      if (results.length === before) break; // no new results

      start += pageSize;
    } catch {
      break;
    }
  }

  return results.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Bing scraper
// ---------------------------------------------------------------------------
export async function scrapeBing(query: string, maxResults = 100): Promise<RawResult[]> {
  const results: RawResult[] = [];
  let first = 1;
  const pageSize = 10;

  while (results.length < maxResults) {
    const url =
      `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=${pageSize}`;

    try {
      const { data } = await robustGet(url);
      const $ = cheerio.load(data);
      const before = results.length;

      $("#b_results li.b_algo").each((_, el) => {
        const anchor = $(el).find("h2 a");
        const rawHref = anchor.attr("href") ?? "";
        const resolvedUrl = normaliseUrl(rawHref);
        if (!resolvedUrl) return;

        const title = anchor.text().trim();
        const snippet = $(el).find(".b_caption p, .b_algoSlug").text().trim();

        if (resolvedUrl && title) {
          results.push({
            url: resolvedUrl,
            title,
            snippet,
            source: "bing",
            position: results.length + 1,
          });
        }
      });

      if (results.length === before) break;

      first += pageSize;
    } catch {
      break;
    }
  }

  return results.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Aggregate: run all engines in parallel, merge + deduplicate
// ---------------------------------------------------------------------------
export async function aggregateSearch(
  query: string,
  maxResults = 100
): Promise<RawResult[]> {
  const perEngine = Math.ceil(maxResults / 2);

  const [ddg, google, bing] = await Promise.allSettled([
    scrapeDuckDuckGo(query, perEngine),
    scrapeGoogle(query, perEngine),
    scrapeBing(query, Math.ceil(maxResults / 3)),
  ]);

  const merged: RawResult[] = [
    ...(ddg.status === "fulfilled" ? ddg.value : []),
    ...(google.status === "fulfilled" ? google.value : []),
    ...(bing.status === "fulfilled" ? bing.value : []),
  ];

  // Re-number after dedup
  return deduplicateResults(merged)
    .slice(0, maxResults)
    .map((r, i) => ({ ...r, position: i + 1 }));
}
