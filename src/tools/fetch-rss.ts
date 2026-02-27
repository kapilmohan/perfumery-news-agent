import Parser from "rss-parser";
import { Article } from "../types";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

export async function fetchRSS(input: { url: string; label: string }): Promise<string> {
  const { url, label } = input;

  if (!url) {
    return JSON.stringify({ error: "No feed URL specified" });
  }

  try {
    const result = await parser.parseURL(url);
    const articles: Article[] = (result.items || []).slice(0, 15).map((item) => ({
      title: item.title?.trim() || "Untitled",
      url: item.link || "",
      source: label,
      date: item.pubDate || item.isoDate || new Date().toISOString(),
      snippet: (item.contentSnippet || item.content || "").slice(0, 250).trim(),
    }));
    return JSON.stringify({ count: articles.length, articles });
  } catch (err) {
    return JSON.stringify({ error: `Failed to fetch ${label}: ${(err as Error).message}` });
  }
}
