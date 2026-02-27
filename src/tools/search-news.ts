import Parser from "rss-parser";
import { Article } from "../types";

const rssParser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});

async function searchViaGoogleNews(query: string): Promise<string> {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const result = await rssParser.parseURL(url);
    const articles: Article[] = (result.items || []).slice(0, 20).map((item) => {
      const rawTitle = item.title?.trim() || "Untitled";
      // Google News titles are formatted as "Article Title - Source Name"
      const lastDash = rawTitle.lastIndexOf(" - ");
      const title = lastDash > 0 ? rawTitle.substring(0, lastDash).trim() : rawTitle;
      const source = lastDash > 0 ? rawTitle.substring(lastDash + 3).trim() : (item.creator || "Google News");

      return {
        title,
        url: item.link || "",
        source,
        date: item.pubDate || item.isoDate || "",
        snippet: (item.contentSnippet || item.content || "").slice(0, 250).trim(),
      };
    });
    return JSON.stringify({ count: articles.length, articles, via: "Google News RSS" });
  } catch (err) {
    return JSON.stringify({ error: `Google News search failed: ${(err as Error).message}` });
  }
}

async function searchViaNewsAPI(query: string, days: number, apiKey: string): Promise<string> {
  const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  const params = new URLSearchParams({
    q: query,
    from,
    sortBy: "publishedAt",
    language: "en",
    pageSize: "20",
    apiKey,
  });

  try {
    const res = await fetch(`https://newsapi.org/v2/everything?${params}`);
    const data = (await res.json()) as {
      status: string;
      message?: string;
      articles?: Array<{
        title?: string;
        url?: string;
        source?: { name?: string };
        publishedAt?: string;
        description?: string;
      }>;
    };

    if (data.status !== "ok") {
      return JSON.stringify({ error: data.message || "NewsAPI returned an error" });
    }

    const articles: Article[] = (data.articles || []).map((a) => ({
      title: a.title || "Untitled",
      url: a.url || "",
      source: a.source?.name || "NewsAPI",
      date: a.publishedAt || "",
      snippet: (a.description || "").slice(0, 250),
    }));

    return JSON.stringify({ count: articles.length, articles, via: "NewsAPI" });
  } catch (err) {
    return JSON.stringify({ error: `NewsAPI request failed: ${(err as Error).message}` });
  }
}

export async function searchNews(input: Record<string, string>): Promise<string> {
  const query = input.query || "perfume OR fragrance OR perfumery OR cologne";
  const days = parseInt(input.days || "7", 10);
  const apiKey = process.env.NEWSAPI_KEY;

  // Use NewsAPI if key is available, otherwise fall back to Google News RSS
  if (apiKey) {
    return searchViaNewsAPI(query, days, apiKey);
  }

  console.log("[search_news] No NEWSAPI_KEY set — using Google News RSS as fallback");
  return searchViaGoogleNews(query);
}
