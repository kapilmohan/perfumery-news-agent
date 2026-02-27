import { ToolDefinition } from "../types";
import { fetchRSS } from "./fetch-rss";
import { searchNews } from "./search-news";
import { scrapePage } from "./scrape-page";
import { writeReport } from "./write-report";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "fetch_rss",
    description:
      "Fetch articles from a perfumery RSS feed. Available feeds: fragrantica, basenotes, cafleurebon, perfumesociety. You can also provide a custom RSS URL.",
    parameters: {
      type: "object",
      properties: {
        feed: {
          type: "string",
          description: "Feed name (fragrantica, basenotes, cafleurebon, perfumesociety) or a custom RSS URL",
        },
      },
      required: ["feed"],
    },
  },
  {
    name: "search_news",
    description:
      "Search for perfumery news articles via NewsAPI. Provide a search query and optional number of days to look back.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (default: perfume OR fragrance OR perfumery OR cologne)",
        },
        days: {
          type: "string",
          description: "Number of days to look back (default: 7)",
        },
      },
    },
  },
  {
    name: "scrape_page",
    description:
      "Scrape the text content of a webpage. Use this to get the full article text when a snippet is not enough.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the page to scrape",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "write_report",
    description:
      "Write the final markdown report to the reports/ directory. Provide the full markdown content.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The full markdown content of the report",
        },
      },
      required: ["content"],
    },
  },
];

const TOOL_HANDLERS: Record<string, (input: Record<string, string>) => Promise<string>> = {
  fetch_rss: fetchRSS,
  search_news: searchNews,
  scrape_page: scrapePage,
  write_report: writeReport,
};

export async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
  return handler(input);
}
