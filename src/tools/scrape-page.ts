import * as cheerio from "cheerio";

export async function scrapePage(input: Record<string, string>): Promise<string> {
  const url = input.url;
  if (!url) {
    return JSON.stringify({ error: "No URL provided" });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PerfumeryNewsAgent/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return JSON.stringify({ error: `HTTP ${res.status} fetching ${url}` });
    }

    const html = await res.text();
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

    // Clean up whitespace and truncate
    text = text.replace(/\s+/g, " ").trim().slice(0, 2000);

    return JSON.stringify({
      url,
      title: $("title").text().trim() || $("h1").first().text().trim(),
      content: text,
    });
  } catch (err) {
    return JSON.stringify({ error: `Scrape failed for ${url}: ${(err as Error).message}` });
  }
}
