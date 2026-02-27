import "dotenv/config";
import { runAgent } from "./agent";
import { closeBrowser } from "./tools/scrape-page";

async function main() {
  console.log("=== Perfumery News Agent ===\n");

  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY is not set. Create a .env file from .env.example");
    process.exit(1);
  }

  try {
    const reportPath = await runAgent();

    if (reportPath) {
      console.log(`\nReport generated: ${reportPath}`);
    } else {
      console.log("\nAgent completed but no report file was written.");
    }
  } catch (err) {
    console.error("Agent failed:", (err as Error).message);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

main();
