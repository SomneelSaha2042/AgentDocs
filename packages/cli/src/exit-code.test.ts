import { CrawlError } from "@agentdocs/crawler";
import { describe, expect, it } from "vitest";

import { exitCodeForError } from "./exit-code.js";

describe("exitCodeForError", () => {
  it("maps crawl failures by class and stable error name", () => {
    expect(exitCodeForError(new CrawlError("failed"))).toBe(3);
    expect(exitCodeForError(Object.assign(new Error("failed"), { name: "CrawlError" }))).toBe(3);
    expect(exitCodeForError({ exitCode: 3 })).toBe(3);
  });

  it("uses the generic exit code for unknown errors", () => {
    expect(exitCodeForError(new Error("failed"))).toBe(1);
  });
});
