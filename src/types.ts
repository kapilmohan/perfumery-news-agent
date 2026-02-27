export interface Article {
  title: string;
  url: string;
  source: string;
  date: string;
  snippet: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  result: string;
}

export interface AgentStep {
  thought: string;
  action?: { tool: string; input: Record<string, string> };
  observation?: string;
}
