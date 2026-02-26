import { describe, it, expect, beforeEach } from "vitest";
import { StatusDetector } from "./status-detector.js";

describe("StatusDetector", () => {
  let detector: StatusDetector;

  beforeEach(() => {
    detector = new StatusDetector();
  });

  describe("detectPhase", () => {
    it("returns idle when bash prompt is present", () => {
      expect(detector.detectPhase("user@host:~$ ")).toBe("idle");
      expect(detector.detectPhase("$ ")).toBe("idle");
    });

    it("returns planning for planning output", () => {
      expect(detector.detectPhase("Planning... analyzing your request")).toBe("planning");
      expect(detector.detectPhase("Analyzing the codebase structure")).toBe("planning");
      expect(detector.detectPhase("⠋ Thinking")).toBe("planning");
    });

    it("returns coding for file modification output", () => {
      expect(detector.detectPhase("Writing to src/auth.ts...")).toBe("coding");
      expect(detector.detectPhase("Creating new file: index.ts")).toBe("coding");
      expect(detector.detectPhase("Updating package.json")).toBe("coding");
    });

    it("returns testing for test output", () => {
      expect(detector.detectPhase("Running tests with vitest...")).toBe("testing");
      expect(detector.detectPhase("✓ should pass the test")).toBe("testing");
      expect(detector.detectPhase("PASS src/auth.test.ts")).toBe("testing");
      expect(detector.detectPhase("Test Suites: 3 passed")).toBe("testing");
    });

    it("returns pr for PR creation output", () => {
      expect(detector.detectPhase("PR created: https://github.com/org/repo/pull/42")).toBe("pr");
      expect(detector.detectPhase("Running: gh pr create --title 'feat: oauth'")).toBe("pr");
    });

    it("returns error for error output", () => {
      expect(detector.detectPhase("Error: Cannot find module './auth'")).toBe("error");
      expect(detector.detectPhase("npm ERR! code ENOENT")).toBe("error");
    });

    it("returns running for generic output", () => {
      expect(detector.detectPhase("claude is working on your task...")).toBe("running");
    });
  });

  describe("parseCost", () => {
    it("parses Tokens: Xk in / Yk out format", () => {
      const result = detector.parseCost("Tokens: 12k in / 3k out");
      expect(result).not.toBeNull();
      expect(result!.tokensIn).toBe(12000);
      expect(result!.tokensOut).toBe(3000);
      expect(result!.cost).toBeGreaterThan(0);
    });

    it("parses Input tokens / Output tokens format", () => {
      const result = detector.parseCost(
        "Input tokens: 50000, Output tokens: 10000"
      );
      expect(result).not.toBeNull();
      expect(result!.tokensIn).toBe(50000);
      expect(result!.tokensOut).toBe(10000);
    });

    it("parses Total cost format", () => {
      const result = detector.parseCost("Total cost: $1.23");
      expect(result).not.toBeNull();
      expect(result!.cost).toBeCloseTo(1.23, 2);
    });

    it("returns null when no cost info found", () => {
      expect(detector.parseCost("No cost info here")).toBeNull();
    });

    it("handles decimal token counts", () => {
      const result = detector.parseCost("Tokens: 12.5k in / 2.5k out");
      expect(result).not.toBeNull();
      expect(result!.tokensIn).toBe(12500);
      expect(result!.tokensOut).toBe(2500);
    });
  });

  describe("detectCompletion", () => {
    it("detects completion when bash prompt appears", () => {
      const result = detector.detectCompletion("Task done!\nuser@host:~$ ");
      expect(result.completed).toBe(true);
    });

    it("extracts PR URL when present", () => {
      const result = detector.detectCompletion(
        "Pull request created: https://github.com/org/repo/pull/42\nuser@host:~$ "
      );
      expect(result.completed).toBe(true);
      expect(result.prUrl).toBe("https://github.com/org/repo/pull/42");
    });

    it("returns not completed for running output", () => {
      const result = detector.detectCompletion("Writing src/auth.ts...");
      expect(result.completed).toBe(false);
    });

    it("returns not completed for mid-session output", () => {
      const result = detector.detectCompletion("Planning... Running tests...");
      expect(result.completed).toBe(false);
    });
  });

  describe("detectError", () => {
    it("detects TypeScript errors", () => {
      expect(detector.detectError("error TS2345: Argument of type")).toBe(true);
    });

    it("detects npm errors", () => {
      expect(detector.detectError("npm ERR! code ENOENT")).toBe(true);
    });

    it("detects runtime errors", () => {
      expect(detector.detectError("TypeError: Cannot read property of undefined")).toBe(true);
    });

    it("returns false for normal output", () => {
      expect(detector.detectError("Writing file src/auth.ts")).toBe(false);
      expect(detector.detectError("Tests: 5 passed")).toBe(false);
    });
  });
});
