import { GoogleGenerativeAI } from "@google/generative-ai";
import { Article } from "./types";
import { Source, DEFAULT_SOURCES } from "./sources";
import { fetchRSS } from "./tools/fetch-rss";
import { scrapePage } from "./tools/scrape-page";
import { searchNews } from "./tools/search-news";
import { writeReport } from "./tools/write-report";

function formatSourceList(sources: Source[]): string {
  return sources
    .map((s) => {
      if (s.type === "rss") return `- RSS: ${s.label} (${s.value})`;
      if (s.type === "scrape") return `- Scrape: ${s.label} (${s.value})`;
      return `- Search: "${s.value}"`;
    })
    .join("\n");
}

/**
 * Phase 0: Ask Gemini if our current sources are sufficient, get up to 5 more.
 */
async function discoverSources(): Promise<Source[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const prompt = `You are a perfumery industry expert. Here are the news sources we currently monitor:

${formatSourceList(DEFAULT_SOURCES)}

Are these sufficient for comprehensive perfumery news coverage? If not, suggest up to 5 additional sources we should add. Only suggest sources that:
1. Have working RSS feeds, scrapeable news pages, or are good search queries
2. Cover perfumery/fragrance news that our current sources would miss
3. Are in English

Respond ONLY with a JSON array (no markdown, no explanation). Each item:
{"type": "rss"|"search"|"scrape", "value": "URL or search query", "label": "short name"}

If current sources are sufficient, respond with an empty array: []`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  try {
    console.log("[Discover] Asking Gemini to evaluate current sources...");
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log("[Discover] No suggestions — current sources deemed sufficient");
      return [];
    }

    const suggestions: Source[] = JSON.parse(jsonMatch[0]);
    const capped = suggestions.slice(0, 5);
    if (capped.length > 0) {
      console.log(`[Discover] Gemini suggested ${capped.length} additional sources:`);
      for (const s of capped) {
        console.log(`  ${s.type}: ${s.label} → ${s.value}`);
      }
    } else {
      console.log("[Discover] Current sources deemed sufficient");
    }
    return capped;
  } catch (err) {
    console.log(`[Discover] Failed (non-fatal): ${(err as Error).message}`);
    return [];
  }
}

const REPORT_SYSTEM_PROMPT = `You are an expert perfumery journalist writing a weekly news briefing for industry professionals and fragrance enthusiasts.

You will receive a list of articles gathered from multiple sources. Some have direct links, some don't. Your job is to synthesize them into an insightful, well-written report — NOT a simple list of links.

WRITING RULES:
- Write in a narrative style with analysis and context, not just bullet summaries
- Group related stories together and draw connections between them
- Each section should read like a short editorial paragraph, not a link dump
- For each story, explain WHY it matters to the perfumery world
- Include direct links ONLY when the article has a real URL (not a Google News redirect). Format links inline: [Source Name](url)
- If an article has no direct link, just mention the source name in parentheses
- Omit sections that have no relevant articles
- The executive summary should highlight 2-3 genuinely interesting trends or stories, not just list what's below

REPORT FORMAT:

# Perfumery News Briefing — [DATE]

## Executive Summary
[2-3 sentences highlighting the week's most significant developments and what they signal for the industry]

## New Launches
[Narrative paragraphs covering new releases, grouped by theme — e.g. niche houses, designer flankers, celebrity launches. Include notes, key ingredients, or positioning when available]

## Industry News
[Business moves, acquisitions, market trends, retail developments. Explain the significance]

## Trends & Culture
[Cultural moments, emerging trends, celebrity connections. Connect the dots between stories]

## Reviews & Recommendations
[Notable reviews or editorial picks, with context on why they stand out]

## Sources
[Bulleted list of sources consulted, with links where available]`;

interface GatherResult {
  articles: Article[];
  errors: string[];
}

/**
 * Phase 1: Fetch all sources in parallel, return deduplicated articles.
 */
async function gatherArticles(sources: Source[]): Promise<GatherResult> {
  const articles: Article[] = [];
  const errors: string[] = [];

  // Build all fetch promises from the unified source list
  const promises: Array<{ label: string; promise: Promise<string> }> = sources.map((src) => {
    switch (src.type) {
      case "rss":
        return { label: `rss:${src.label}`, promise: fetchRSS({ url: src.value, label: src.label }) };
      case "search":
        return { label: `search:${src.label}`, promise: searchNews({ query: src.value }) };
      case "scrape":
        return { label: `scrape:${src.label}`, promise: scrapePage({ url: src.value }) };
    }
  });

  // Run all in parallel
  const results = await Promise.allSettled(promises.map((p) => p.promise));

  for (let i = 0; i < results.length; i++) {
    const label = promises[i].label;
    const result = results[i];

    if (result.status === "rejected") {
      const msg = `${label}: ${result.reason}`;
      console.log(`[Gather] FAILED ${msg}`);
      errors.push(msg);
      continue;
    }

    const raw = result.value;

    try {
      const parsed = JSON.parse(raw);

      if (parsed.error) {
        console.log(`[Gather] ${label}: ${parsed.error}`);
        errors.push(`${label}: ${parsed.error}`);
        continue;
      }

      // RSS and search results return { articles: [...] }
      if (parsed.articles && Array.isArray(parsed.articles)) {
        console.log(`[Gather] ${label}: ${parsed.articles.length} articles`);
        articles.push(...parsed.articles);
        continue;
      }

      // Scrape results return { content, title, url } — treat as single article
      if (parsed.content && parsed.url) {
        console.log(`[Gather] ${label}: scraped page (${parsed.content.length} chars)`);
        articles.push({
          title: parsed.title || label,
          url: parsed.url,
          source: label,
          date: new Date().toISOString(),
          snippet: parsed.content.slice(0, 250),
        });
        continue;
      }
    } catch {
      console.log(`[Gather] ${label}: unparseable response`);
      errors.push(`${label}: unparseable response`);
    }
  }

  // Deduplicate by normalized title
  const seen = new Set<string>();
  const deduped = articles.filter((a) => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(
    `\n[Gather] Total: ${articles.length} raw → ${deduped.length} deduplicated articles, ${errors.length} errors`
  );

  return { articles: deduped, errors };
}

/**
 * Format articles into a compact string for the LLM prompt.
 */
function formatArticlesForPrompt(articles: Article[]): string {
  return articles
    .map((a) => {
      const date = a.date ? ` (${a.date.split("T")[0]})` : "";
      const snippet = a.snippet ? `\n  ${a.snippet.slice(0, 120)}` : "";
      const hasRealUrl = a.url && !a.url.includes("news.google.com/rss/articles/");
      const link = hasRealUrl ? ` — link: ${a.url}` : "";
      return `- ${a.title} — ${a.source}${date}${link}${snippet}`;
    })
    .join("\n");
}

/**
 * Phase 2: Single Gemini call to generate the report.
 */
async function generateReport(articles: Article[], date: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: REPORT_SYSTEM_PROMPT,
  });

  const compactArticles = formatArticlesForPrompt(articles);
  const prompt = `Today's date is ${date}.\n\nHere are ${articles.length} articles gathered from perfumery news sources:\n\n${compactArticles}\n\nWrite the perfumery news briefing report in markdown.`;

  console.log(`\n[Generate] Sending ${articles.length} articles to Gemini (prompt: ${prompt.length} chars)`);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  if (!text || text.length < 100) {
    throw new Error("Gemini returned empty or insufficient response");
  }

  console.log(`[Generate] Received report (${text.length} chars)`);
  return text;
}

/**
 * Main entry point: discover → gather → generate → write.
 */
export async function runAgent(): Promise<string> {
  const date = new Date().toISOString().split("T")[0];

  // Phase 0: Ask LLM if we need more sources
  console.log("=== Phase 0: Source discovery ===\n");
  const extraSources = await discoverSources();
  const allSources = [...DEFAULT_SOURCES, ...extraSources];
  console.log(`\n[Sources] ${DEFAULT_SOURCES.length} default + ${extraSources.length} discovered = ${allSources.length} total`);

  // Phase 1: Gather articles from all sources
  console.log("\n=== Phase 1: Gathering articles ===\n");
  const { articles, errors } = await gatherArticles(allSources);

  if (articles.length === 0) {
    throw new Error(`No articles gathered. Errors: ${errors.join("; ")}`);
  }

  // Phase 2: Generate report with single Gemini call
  console.log("\n=== Phase 2: Generating report ===");
  const markdown = await generateReport(articles, date);

  // Phase 3: Write report to file
  console.log("\n=== Phase 3: Writing report ===");
  const result = JSON.parse(await writeReport({ content: markdown }));

  if (result.error) {
    throw new Error(`Failed to write report: ${result.error}`);
  }

  console.log(`[Write] Report saved to ${result.path}`);
  return result.path;
}
