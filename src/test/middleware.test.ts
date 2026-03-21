import { describe, it, expect } from "bun:test";
import { createMiddleware } from "../integrations/middleware";
import { HybridSearch } from "../search/hybrid";
import type { ToolDescription } from "../search/types";

const TOOLS: ToolDescription[] = [
  { name: "deployApp", text: "Deploy the application to production" },
  { name: "sendSlack", text: "Send a message to Slack channel" },
  { name: "queryDB", text: "Query the PostgreSQL database" },
  { name: "sendEmail", text: "Send an email to a recipient" },
  { name: "createIssue", text: "Create a new issue in the tracker" },
  { name: "translateText", text: "Translate text to another language" },
  { name: "uploadFile", text: "Upload a file to cloud storage" },
  { name: "resizeImage", text: "Resize and optimize an image" },
];

const engine = new HybridSearch(TOOLS);
const toolNames = TOOLS.map((t) => t.name);

describe("createMiddleware", () => {
  it("filters tools based on query", async () => {
    const mw = createMiddleware(engine, toolNames, { maxTools: 3 });

    const params = {
      prompt: [{ role: "user", content: "deploy the app to production" }],
      tools: TOOLS.map((t) => ({ name: t.name, type: "function" })),
    };

    const result = await mw.transformParams!({ params } as any);
    expect(result.tools!.length).toBeLessThanOrEqual(3);
    const names = result.tools!.map((t: any) => t.name);
    expect(names).toContain("deployApp");
  });

  it("includes alwaysActive tools", async () => {
    const mw = createMiddleware(engine, toolNames, {
      maxTools: 2,
      alwaysActive: ["resizeImage"],
    });

    const params = {
      prompt: [{ role: "user", content: "deploy the app" }],
      tools: TOOLS.map((t) => ({ name: t.name, type: "function" })),
    };

    const result = await mw.transformParams!({ params } as any);
    const names = result.tools!.map((t: any) => t.name);
    expect(names).toContain("resizeImage");
  });

  it("returns params unchanged when no query found", async () => {
    const mw = createMiddleware(engine, toolNames, { maxTools: 2 });

    const params = {
      prompt: "not an array",
      tools: TOOLS.map((t) => ({ name: t.name, type: "function" })),
    };

    const result = await mw.transformParams!({ params } as any);
    expect(result.tools!.length).toBe(TOOLS.length);
  });

  it("returns params unchanged when no tools present", async () => {
    const mw = createMiddleware(engine, toolNames, { maxTools: 2 });

    const params = {
      prompt: [{ role: "user", content: "deploy it" }],
      tools: [],
    };

    const result = await mw.transformParams!({ params } as any);
    expect(result.tools!.length).toBe(0);
  });

  it("handles multipart user content", async () => {
    const mw = createMiddleware(engine, toolNames, { maxTools: 3 });

    const params = {
      prompt: [
        {
          role: "user",
          content: [
            { type: "text", text: "translate this to French" },
          ],
        },
      ],
      tools: TOOLS.map((t) => ({ name: t.name, type: "function" })),
    };

    const result = await mw.transformParams!({ params } as any);
    const names = result.tools!.map((t: any) => t.name);
    expect(names).toContain("translateText");
  });

  it("uses last user message in multi-turn prompt", async () => {
    const mw = createMiddleware(engine, toolNames, { maxTools: 3 });

    const params = {
      prompt: [
        { role: "user", content: "deploy the app" },
        { role: "assistant", content: "Done." },
        { role: "user", content: "now query the database" },
      ],
      tools: TOOLS.map((t) => ({ name: t.name, type: "function" })),
    };

    const result = await mw.transformParams!({ params } as any);
    const names = result.tools!.map((t: any) => t.name);
    expect(names).toContain("queryDB");
  });
});
