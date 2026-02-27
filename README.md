# Perfumery News Agent

An AI-powered agent that gathers perfumery news from multiple sources in parallel, uses Gemini to discover additional sources and write an editorial-quality briefing — all in two lean LLM calls.

## How It Works

```
Phase 0: Source Discovery
  Gemini evaluates current sources, suggests up to 5 more
                    │
                    ▼
Phase 1: Parallel Gather
  ├── RSS feeds (allgoodscents, nstperfume, etc.)
  ├── Google News searches (fragrantica, general perfume news)
  ├── Scrapes (LLM-discovered sources)          All via Promise.allSettled
  └── Deduplicate by title similarity
                    │
                    ▼
Phase 2: Report Generation
  Single Gemini call: article summaries → narrative markdown report
                    │
                    ▼
Phase 3: Write
  reports/perfumery-news-YYYY-MM-DD.md
```

- **Phase 0** is the only "intelligent" part of gathering — Gemini reviews your configured sources and suggests additional RSS feeds, search queries, or pages to scrape
- **Phase 1** is deterministic code — fetches everything in parallel, no LLM involved
- **Phase 2** is a single Gemini call with a strong editorial prompt — produces narrative analysis, not link dumps
- Total: ~2 Gemini calls, ~5-8K tokens (vs 50K+ with the old ReAct loop)

## Architecture

```
src/
├── index.ts              Entry point — loads env, runs the agent
├── agent.ts              Gather-then-generate pipeline (discover → gather → report → write)
├── sources.ts            Single source of truth for all default news sources
├── types.ts              Shared types (Article)
└── tools/
    ├── fetch-rss.ts      Fetch articles from any RSS feed URL
    ├── search-news.ts    Search via Google News RSS (or NewsAPI if key provided)
    ├── scrape-page.ts    Scrape page content (fetch → Playwright → Firecrawl fallback)
    └── write-report.ts   Write the final markdown report to reports/
```

### Output

The agent produces a dated markdown report in `reports/perfumery-news-YYYY-MM-DD.md` with:

- **Executive Summary** — Week's biggest stories and what they signal
- **New Launches** — Latest perfume releases, grouped by theme
- **Industry News** — Business moves, acquisitions, market trends
- **Trends & Culture** — Fragrance trends, cultural moments
- **Reviews & Recommendations** — Notable reviews
- **Sources** — Links back to original articles (where available)

## Usage

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/apikey)
- (Optional) A [NewsAPI key](https://newsapi.org/) for broader news search
- (Optional) A [Firecrawl API key](https://firecrawl.dev/) for scraping Cloudflare-protected sites

### Setup

```bash
git clone https://github.com/kapilmohan/perfumery-news-agent.git
cd perfumery-news-agent
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Add your API keys:

```
GEMINI_API_KEY=your-gemini-api-key
NEWSAPI_KEY=your-newsapi-key          # optional
FIRECRAWL_API_KEY=your-firecrawl-key  # optional
```

### Run

```bash
npm start
```

```
=== Perfumery News Agent ===

=== Phase 0: Source discovery ===

[Discover] Asking Gemini to evaluate current sources...
[Discover] Gemini suggested 3 additional sources:
  rss: Now Smell This → https://nstperfume.com/feed/
  search: Perfume Industry News → perfume industry news
  rss: The Perfume Society → https://perfumesociety.org/feed/

[Sources] 3 default + 3 discovered = 6 total

=== Phase 1: Gathering articles ===

[Gather] rss:allgoodscents: 15 articles
[Gather] search:fragrantica: 20 articles
[Gather] search:news: 20 articles
[Gather] rss:Now Smell This: 10 articles

[Gather] Total: 65 raw → 58 deduplicated articles, 1 errors

=== Phase 2: Generating report ===

[Generate] Sending 58 articles to Gemini (prompt: 12403 chars)
[Generate] Received report (8521 chars)

=== Phase 3: Writing report ===

[Write] Report saved to reports/perfumery-news-2026-02-27.md
```

### Build Only

```bash
npm run build
```

## Tech Stack

- **TypeScript** — Type-safe implementation
- **Google Generative AI SDK** (`@google/generative-ai`) — Gemini for source discovery and report writing
- **rss-parser** — RSS feed parsing
- **Cheerio + Playwright + Firecrawl** — Tiered web scraping (fast → headless → cloud)
- **dotenv** — Environment variable management

## License

ISC
