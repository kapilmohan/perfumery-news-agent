import "dotenv/config";
import { runAgent } from "./agent";

async function main() {
  console.log("=== Perfumery News Agent (ReAct) ===\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is not set. Create a .env file from .env.example");
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
  }
}

main();
