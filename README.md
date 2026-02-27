# Perfumery News Agent

A ReAct-style AI agent that autonomously gathers the latest perfumery news from multiple sources, reasons about what it finds, and produces a curated markdown briefing — powered by Google Gemini.

## How It Works

This is not a linear script. It's an **autonomous agent loop** built on the [ReAct pattern](https://arxiv.org/abs/2210.03629) (Reason + Act):

```
┌─────────────────────────────────────────────┐
│                  Agent Loop                 │
│                                             │
│   ┌──────────┐                              │
│   │  THINK   │ ← Gemini reasons about        │
│   │          │   what info it has/needs      │
│   └────┬─────┘                              │
│        │                                    │
│        ▼                                    │
│   ┌──────────┐                              │
│   │   ACT    │ ← Picks a tool & calls it    │
│   │          │   (fetch RSS, search news,   │
│   └────┬─────┘    scrape page, write report)│
│        │                                    │
│        ▼                                    │
│   ┌──────────┐                              │
│   │ OBSERVE  │ ← Receives tool results,     │
│   │          │   decides next step           │
│   └────┬─────┘                              │
│        │                                    │
│        └──── loops until report is written ──┘
└─────────────────────────────────────────────┘
```

Gemini decides at each step:
- Which RSS feeds to pull
- Whether to search for additional news via NewsAPI
- Which articles deserve a full page scrape for more context
- How to categorize and summarize everything
- When it has enough information to write the final report

## Architecture

```
src/
├── index.ts              Entry point — loads env, runs the agent
├── agent.ts              ReAct loop — manages Gemini conversation + tool dispatch
├── types.ts              Shared types (Article, AgentStep, ToolDefinition)
└── tools/
    ├── registry.ts       Tool definitions (Gemini function-calling format) & dispatcher
    ├── fetch-rss.ts      Fetch articles from perfumery RSS feeds
    ├── search-news.ts    Search NewsAPI for perfumery keywords
    ├── scrape-page.ts    Scrape full article text from a URL via Cheerio
    └── write-report.ts   Write the final markdown report to reports/
```

### Tools Available to the Agent

| Tool | Description |
|------|-------------|
| `fetch_rss` | Pull articles from known perfumery RSS feeds (Fragrantica, Basenotes, CaFleureBon, The Perfume Society) or any custom RSS URL |
| `search_news` | Search NewsAPI for perfumery-related articles with configurable query and date range |
| `scrape_page` | Scrape and extract article text from any URL for deeper analysis |
| `write_report` | Write the final curated markdown report to `reports/` |

### Output

The agent produces a dated markdown report in `reports/perfumery-news-YYYY-MM-DD.md` with:

- **Executive Summary** — Week's biggest stories at a glance
- **New Launches** — Latest perfume releases
- **Industry News** — Business moves, acquisitions, market trends
- **Trends & Culture** — Fragrance trends, cultural moments
- **Reviews & Recommendations** — Notable reviews
- **Sources** — Links back to all original articles

## Usage

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/apikey)
- (Optional) A [NewsAPI key](https://newsapi.org/) for broader news search

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
NEWSAPI_KEY=your-newsapi-key    # optional
```

### Run

```bash
npm start
```

This compiles the TypeScript and runs the agent. You'll see the agent's reasoning in real time:

```
=== Perfumery News Agent (ReAct) ===

--- Agent Turn 1 ---
[Thought] I'll start by fetching articles from all four RSS feeds...
[Action] fetch_rss({"feed":"fragrantica"})
[Observation] {"count":15,"articles":[...]}

--- Agent Turn 2 ---
[Thought] Good, got 15 articles from Fragrantica. Let me also fetch Basenotes...
[Action] fetch_rss({"feed":"basenotes"})
[Observation] {"count":12,"articles":[...]}

...

--- Agent Turn 8 ---
[Action] write_report({"content":"# Perfumery News Briefing — 2026-02-27\n..."})
[Observation] {"success":true,"path":"reports/perfumery-news-2026-02-27.md"}

Report generated: reports/perfumery-news-2026-02-27.md
```

### Build Only

```bash
npm run build
```

## Tech Stack

- **TypeScript** — Type-safe agent implementation
- **Google Generative AI SDK** (`@google/generative-ai`) — Gemini API with function calling for the ReAct loop
- **rss-parser** — RSS feed parsing
- **Cheerio** — Lightweight HTML scraping
- **dotenv** — Environment variable management

## License

ISC
