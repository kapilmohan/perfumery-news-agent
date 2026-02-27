import * as fs from "fs";
import * as path from "path";

export async function writeReport(input: Record<string, string>): Promise<string> {
  const content = input.content;
  if (!content) {
    return JSON.stringify({ error: "No content provided for the report" });
  }

  const date = new Date().toISOString().split("T")[0];
  const filename = `perfumery-news-${date}.md`;
  const reportsDir = path.resolve(process.cwd(), "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, filename);
  fs.writeFileSync(filePath, content, "utf-8");

  return JSON.stringify({ success: true, path: filePath, filename });
}
