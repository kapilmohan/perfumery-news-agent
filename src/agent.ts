import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, executeTool } from "./tools/registry";
import { AgentStep } from "./types";

const SYSTEM_PROMPT = `You are a perfumery news research agent. Your goal is to gather the latest perfumery news from multiple sources, analyze them, and produce a comprehensive markdown report.

You follow the ReAct pattern: Think step-by-step, decide which tool to use, observe the results, and iterate until you have enough information.

Your workflow should be:
1. Fetch articles from multiple RSS feeds (fragrantica, basenotes, cafleurebon, perfumesociety)
2. Search for additional news via NewsAPI
3. If any articles look particularly interesting but have insufficient snippets, scrape the full page
4. Once you have gathered enough articles, analyze and categorize them into themes:
   - New Launches (new perfume releases)
   - Industry News (business moves, acquisitions, market trends)
   - Trends & Culture (fragrance trends, cultural moments, celebrity fragrances)
   - Reviews & Recommendations
5. Write a polished markdown report using the write_report tool

The report should follow this format:
# Perfumery News Briefing — [DATE]

## Executive Summary
[2-3 sentence overview of the week's biggest stories]

## New Launches
[Summarized coverage with bullet points]

## Industry News
[Summarized coverage with bullet points]

## Trends & Culture
[Summarized coverage with bullet points]

## Reviews & Recommendations
[Summarized coverage with bullet points]

## Sources
[Bulleted list of all source articles with links]

Be thorough but concise. Include links to original articles. If a source fails, note it and move on — do not stop the entire process.`;

export async function runAgent(): Promise<string> {
  const client = new Anthropic();
  const steps: AgentStep[] = [];

  // Convert our tool definitions to Anthropic's tool format
  const tools: Anthropic.Messages.Tool[] = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Messages.Tool["input_schema"],
  }));

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content:
        "Please gather the latest perfumery news from all available sources and produce a comprehensive markdown report. Today's date is " +
        new Date().toISOString().split("T")[0] +
        ". Start by fetching from the RSS feeds and searching NewsAPI, then analyze and write the report.",
    },
  ];

  const MAX_TURNS = 20;
  let reportPath = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`\n--- Agent Turn ${turn + 1} ---`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Collect all text and tool_use blocks
    const assistantContent = response.content;
    const textBlocks = assistantContent.filter((b) => b.type === "text");
    const toolUseBlocks = assistantContent.filter((b) => b.type === "tool_use");

    // Log any thoughts
    for (const block of textBlocks) {
      if (block.type === "text") {
        console.log(`[Thought] ${block.text.slice(0, 200)}${block.text.length > 200 ? "..." : ""}`);
        steps.push({ thought: block.text });
      }
    }

    // If the model wants to stop, we're done
    if (response.stop_reason === "end_turn" && toolUseBlocks.length === 0) {
      console.log("\n[Agent] Finished reasoning — no more tool calls.");
      break;
    }

    // Execute each tool call
    if (toolUseBlocks.length > 0) {
      // Add the full assistant message to conversation
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type === "tool_use") {
          console.log(`[Action] ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`);

          const observation = await executeTool(
            block.name,
            block.input as Record<string, string>
          );

          // Check if this was a write_report call and capture the path
          if (block.name === "write_report") {
            try {
              const parsed = JSON.parse(observation);
              if (parsed.path) reportPath = parsed.path;
            } catch {}
          }

          console.log(`[Observation] ${observation.slice(0, 150)}${observation.length > 150 ? "..." : ""}`);

          steps.push({
            thought: "",
            action: { tool: block.name, input: block.input as Record<string, string> },
            observation,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: observation,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  console.log(`\n[Agent] Completed in ${steps.length} steps`);
  return reportPath;
}
