import { type WorkerPhase, estimateCost } from "./types.js";

export interface CostInfo {
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

export interface CompletionInfo {
  completed: boolean;
  prUrl?: string;
}

// ─── StatusDetector ───────────────────────────────────────────────────────────

export class StatusDetector {
  /**
   * Detect the current phase of a worker from terminal output.
   */
  detectPhase(output: string): WorkerPhase {
    // Check for idle (bash prompt at end of output)
    if (/\$\s*$/.test(output.trimEnd())) return "idle";

    // Check for errors first (high priority)
    if (this.detectError(output)) return "error";

    // Planning phase
    if (
      /Planning\.\.\.|Analyzing|Thinking|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/.test(output) ||
      /Understanding the (codebase|task|requirements)/i.test(output)
    ) {
      return "planning";
    }

    // PR phase
    if (
      /PR created|gh pr create|pull request created|https:\/\/github\.com\/.*\/pull\//i.test(
        output
      )
    ) {
      return "pr";
    }

    // Testing phase
    if (
      /Running tests|npm test|pnpm test|yarn test|vitest|jest|✓|✗|PASS|FAIL|Test (Suites|Files)/i.test(
        output
      )
    ) {
      return "testing";
    }

    // Coding phase
    if (
      /Writing|Creating|Updating|Editing|Modified|Created|Deleted|Reading|Searching/i.test(
        output
      ) ||
      /\+\+\+|---|\d+ (file|line)s? changed/i.test(output)
    ) {
      return "coding";
    }

    return "running";
  }

  /**
   * Parse token cost info from Claude Code output.
   * Claude outputs: "Tokens: 12k in / 3k out" or "Total cost: $0.12"
   */
  parseCost(output: string, model = "claude-sonnet-4-6"): CostInfo | null {
    // Pattern: "Tokens: 12k in / 3k out"
    const tokenMatch = output.match(/Tokens:\s*(\d+(?:\.\d+)?)(k?)\s*in\s*\/\s*(\d+(?:\.\d+)?)(k?)\s*out/i);
    if (tokenMatch) {
      const tokensIn = parseFloat(tokenMatch[1]!) * (tokenMatch[2] === "k" ? 1000 : 1);
      const tokensOut = parseFloat(tokenMatch[3]!) * (tokenMatch[4] === "k" ? 1000 : 1);
      const cost = estimateCost(tokensIn, tokensOut, model);
      return { tokensIn, tokensOut, cost };
    }

    // Pattern: "Input tokens: 12345, Output tokens: 3456"
    const inputMatch = output.match(/Input tokens:\s*(\d+)/i);
    const outputMatch = output.match(/Output tokens:\s*(\d+)/i);
    if (inputMatch && outputMatch) {
      const tokensIn = parseInt(inputMatch[1]!, 10);
      const tokensOut = parseInt(outputMatch[1]!, 10);
      const cost = estimateCost(tokensIn, tokensOut, model);
      return { tokensIn, tokensOut, cost };
    }

    // Pattern: "Total cost: $0.123"
    const costMatch = output.match(/Total cost:\s*\$(\d+(?:\.\d+)?)/i);
    if (costMatch) {
      return { tokensIn: 0, tokensOut: 0, cost: parseFloat(costMatch[1]!) };
    }

    return null;
  }

  /**
   * Detect if the Claude/Codex session has completed.
   */
  detectCompletion(output: string): CompletionInfo {
    // Task done — look for bash prompt after Claude output
    if (/\$\s*$/.test(output.trimEnd())) {
      // Extract PR URL if present
      const prMatch = output.match(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/);
      return { completed: true, prUrl: prMatch?.[0] };
    }

    // Explicit completion markers
    if (
      /Session completed|Task complete|Done\.|All done|Finished/i.test(output) &&
      !/Running|Executing|Processing/i.test(output.slice(-100))
    ) {
      const prMatch = output.match(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/);
      return { completed: true, prUrl: prMatch?.[0] };
    }

    return { completed: false };
  }

  /**
   * Detect if the terminal output indicates an error state.
   */
  detectError(output: string): boolean {
    return (
      /Error:|FAILED|error TS\d+|SyntaxError|TypeError|ReferenceError|Cannot find|ENOENT/i.test(
        output
      ) ||
      /npm ERR!|pnpm ERR!|yarn error/i.test(output)
    );
  }
}
