import { GoogleGenerativeAI, SchemaType, Part } from "@google/generative-ai";
import { TOOL_DEFINITIONS, executeTool } from "./tools/registry";

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

// Map our JSON Schema types to Gemini's SchemaType
function mapSchemaType(type: string): SchemaType {
  const typeMap: Record<string, SchemaType> = {
    string: SchemaType.STRING,
    number: SchemaType.NUMBER,
    boolean: SchemaType.BOOLEAN,
    object: SchemaType.OBJECT,
    array: SchemaType.ARRAY,
  };
  return typeMap[type] || SchemaType.STRING;
}

function convertToolsForGemini() {
  return TOOL_DEFINITIONS.map((t) => {
    const params = t.parameters as any;
    const properties: Record<string, any> = {};

    if (params.properties) {
      for (const [key, val] of Object.entries(params.properties)) {
        const prop = val as any;
        properties[key] = {
          type: mapSchemaType(prop.type),
          description: prop.description,
        };
      }
    }

    return {
      name: t.name,
      description: t.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties,
        required: params.required || [],
      },
    };
  });
}

export async function runAgent(): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const tools = convertToolsForGemini();

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: tools }],
  });

  const chat = model.startChat();

  const MAX_TURNS = 20;
  let reportPath = "";

  // Initial user message
  const userMessage =
    "Please gather the latest perfumery news from all available sources and produce a comprehensive markdown report. Today's date is " +
    new Date().toISOString().split("T")[0] +
    ". Start by fetching from the RSS feeds and searching NewsAPI, then analyze and write the report.";

  console.log("[User]", userMessage.slice(0, 100) + "...");

  let response = await chat.sendMessage(userMessage);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`\n--- Agent Turn ${turn + 1} ---`);

    const candidate = response.response.candidates?.[0];
    if (!candidate) {
      console.log("[Agent] No candidate in response, stopping.");
      break;
    }

    const parts = candidate.content.parts;

    // Log text parts
    for (const part of parts) {
      if (part.text) {
        console.log(`[Thought] ${part.text.slice(0, 200)}${part.text.length > 200 ? "..." : ""}`);
      }
    }

    // Collect function calls
    const functionCalls = parts.filter((p) => p.functionCall);

    if (functionCalls.length === 0) {
      console.log("\n[Agent] Finished reasoning — no more tool calls.");
      break;
    }

    // Execute each function call and build response parts
    const functionResponses: Part[] = [];

    for (const part of functionCalls) {
      const fc = part.functionCall!;
      const toolName = fc.name;
      const toolArgs = (fc.args || {}) as Record<string, string>;

      console.log(`[Action] ${toolName}(${JSON.stringify(toolArgs).slice(0, 100)})`);

      const observation = await executeTool(toolName, toolArgs);

      // Check if this was a write_report call and capture the path
      if (toolName === "write_report") {
        try {
          const parsed = JSON.parse(observation);
          if (parsed.path) reportPath = parsed.path;
        } catch {}
      }

      console.log(`[Observation] ${observation.slice(0, 150)}${observation.length > 150 ? "..." : ""}`);

      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: JSON.parse(observation),
        },
      });
    }

    // Send tool results back to the model
    response = await chat.sendMessage(functionResponses);
  }

  console.log(`\n[Agent] Completed`);
  return reportPath;
}
