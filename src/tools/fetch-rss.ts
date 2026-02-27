import Parser from "rss-parser";
import { Article } from "../types";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "PerfumeryNewsAgent/1.0" },
});

const KNOWN_FEEDS: Record<string, string> = {
  fragrantica: "https://www.fragrantica.com/news/rss",
  basenotes: "https://basenotes.com/feed/",
  cafleurebon: "https://www.cafleurebon.com/feed/",
  perfumesociety: "https://perfumesociety.org/feed/",
};

export async function fetchRSS(input: Record<string, string>): Promise<string> {
  const feedKey = input.feed?.toLowerCase();
  const url = KNOWN_FEEDS[feedKey] || input.feed;

  if (!url) {
    return JSON.stringify({
      error: "No feed specified. Available feeds: " + Object.keys(KNOWN_FEEDS).join(", "),
    });
  }

  const sourceName = feedKey && KNOWN_FEEDS[feedKey] ? feedKey : url;

  try {
    const result = await parser.parseURL(url);
    const articles: Article[] = (result.items || []).slice(0, 15).map((item) => ({
      title: item.title?.trim() || "Untitled",
      url: item.link || "",
      source: sourceName,
      date: item.pubDate || item.isoDate || new Date().toISOString(),
      snippet: (item.contentSnippet || item.content || "").slice(0, 250).trim(),
    }));
    return JSON.stringify({ count: articles.length, articles });
  } catch (err) {
    return JSON.stringify({ error: `Failed to fetch ${sourceName}: ${(err as Error).message}` });
  }
}
