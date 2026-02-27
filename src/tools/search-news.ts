import { Article } from "../types";

export async function searchNews(input: Record<string, string>): Promise<string> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    return JSON.stringify({ error: "NEWSAPI_KEY not set in environment" });
  }

  const query = input.query || "perfume OR fragrance OR perfumery OR cologne";
  const days = parseInt(input.days || "7", 10);
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

    return JSON.stringify({ count: articles.length, articles });
  } catch (err) {
    return JSON.stringify({ error: `NewsAPI request failed: ${(err as Error).message}` });
  }
}
