import * as cheerio from "cheerio";
import { chromium, Browser } from "playwright";
import FirecrawlApp from "@mendable/firecrawl-js";

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser && _browser.isConnected()) {
    await _browser.close();
    _browser = null;
  }
}

function extractWithCheerio(html: string): { title: string; content: string } {
  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, nav, header, footer, aside, iframe, .ad, .sidebar").remove();

  // Try common article selectors
  const selectors = ["article", ".post-content", ".entry-content", ".article-body", "main"];
  let text = "";
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length) {
      text = el.first().text();
      break;
    }
  }

  if (!text) {
    text = $("body").text();
  }

  text = text.replace(/\s+/g, " ").trim().slice(0, 3000);
  const title = $("title").text().trim() || $("h1").first().text().trim();

  return { title, content: text };
}

async function scrapeWithFetch(url: string): Promise<{ title: string; content: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();
  const result = extractWithCheerio(html);

  if (result.content.length < 100) {
    throw new Error("Insufficient content from basic fetch — likely JS-rendered page");
  }

  return result;
}

async function scrapeWithPlaywright(url: string): Promise<{ title: string; content: string }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    const html = await page.content();
    return extractWithCheerio(html);
  } finally {
    await context.close();
  }
}

async function scrapeWithFirecrawl(url: string): Promise<{ title: string; content: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY not set");
  }

  const app = new FirecrawlApp({ apiKey });
  const result = await app.scrape(url, { formats: ["markdown"] });

  const content = (result.markdown || "").slice(0, 5000);
  const title = result.metadata?.title || "";

  if (content.length < 50) {
    throw new Error("Firecrawl returned insufficient content");
  }

  return { title, content };
}

// Domains known to be behind Cloudflare or heavy bot protection
const FIRECRAWL_DOMAINS = ["fragrantica.com", "basenotes.com"];

function needsFirecrawl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return FIRECRAWL_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

export async function scrapePage(input: Record<string, string>): Promise<string> {
  const url = input.url;
  if (!url) {
    return JSON.stringify({ error: "No URL provided" });
  }

  // For Cloudflare-protected sites, go straight to Firecrawl
  if (needsFirecrawl(url)) {
    console.log(`[Scraper] ${url} is Cloudflare-protected — using Firecrawl`);
    try {
      const result = await scrapeWithFirecrawl(url);
      console.log(`[Scraper] Fetched ${url} with Firecrawl (${result.content.length} chars)`);
      return JSON.stringify({ url, title: result.title, content: result.content });
    } catch (err) {
      console.log(`[Scraper] Firecrawl failed for ${url}: ${(err as Error).message}`);
      return JSON.stringify({ error: `Scrape failed for ${url}: ${(err as Error).message}` });
    }
  }

  // Tier 1: fast fetch + cheerio
  try {
    const result = await scrapeWithFetch(url);
    console.log(`[Scraper] Fetched ${url} with basic fetch (${result.content.length} chars)`);
    return JSON.stringify({ url, title: result.title, content: result.content });
  } catch (fetchErr) {
    console.log(
      `[Scraper] Basic fetch failed for ${url}: ${(fetchErr as Error).message}. Trying Playwright...`
    );
  }

  // Tier 2: Playwright headless browser
  try {
    const result = await scrapeWithPlaywright(url);
    console.log(`[Scraper] Fetched ${url} with Playwright (${result.content.length} chars)`);
    return JSON.stringify({ url, title: result.title, content: result.content });
  } catch (playwrightErr) {
    console.log(
      `[Scraper] Playwright failed for ${url}: ${(playwrightErr as Error).message}. Trying Firecrawl...`
    );
  }

  // Tier 3: Firecrawl as last resort for any site
  try {
    const result = await scrapeWithFirecrawl(url);
    console.log(`[Scraper] Fetched ${url} with Firecrawl (${result.content.length} chars)`);
    return JSON.stringify({ url, title: result.title, content: result.content });
  } catch (err) {
    return JSON.stringify({ error: `All scrape methods failed for ${url}: ${(err as Error).message}` });
  }
}
