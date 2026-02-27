export interface Source {
  type: "rss" | "search" | "scrape";
  value: string; // URL for rss/scrape, query string for search
  label: string;
}

export const DEFAULT_SOURCES: Source[] = [
  // RSS feeds
  { type: "rss", value: "https://allgoodscents.com/blogs/all-good-notes.atom", label: "allgoodscents" },
  // Fragrantica via Google News (direct scraping returns homepage, not news)
  { type: "search", value: "site:fragrantica.com perfume news", label: "fragrantica" },
  // Google News search
  { type: "search", value: "perfume OR fragrance OR perfumery new launch", label: "news" },
];
