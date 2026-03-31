import { describe, it, expect } from "bun:test";
import { generateText, tool, jsonSchema, stepCountIs, wrapLanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { createToolIndex } from "../tool-index";

const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const e2eModelId = process.env.TOOLPICK_E2E_MODEL ?? "gpt-4o-mini";
const TIMEOUT = 120_000;

function makeTool(description: string) {
  return tool({
    description,
    inputSchema: jsonSchema<{ reason: string }>({
      type: "object",
      properties: {
        reason: { type: "string", description: "Short justification for using this tool" },
      },
      required: ["reason"],
    }),
    execute: async ({ reason }) => ({ ok: true as const, reason }),
  });
}

const saasTools = {
  deployToVercel: makeTool(
    "Deploy a web application or service to Vercel production or preview environments.",
  ),
  sendSlackMessage: makeTool(
    "Send a chat message to a Slack channel or user for team updates and notifications.",
  ),
  queryCustomerDatabase: makeTool(
    "Run a read-only SQL query against the PostgreSQL customer database.",
  ),
  refundStripePayment: makeTool(
    "Issue a full or partial refund for a Stripe payment or charge.",
  ),
  scheduleCalendarEvent: makeTool(
    "Create a calendar meeting or event with attendees and time range.",
  ),
  translateDocument: makeTool(
    "Translate document or text content from one language to another.",
  ),
  resizeProductImage: makeTool(
    "Resize or optimize a product image for the storefront or marketing.",
  ),
} as const;

function toolNamesFromSteps(steps: { toolCalls: { toolName: string }[] }[]): string[] {
  return steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
}

describe.skipIf(!hasOpenAI)("generateText E2E (AI SDK)", () => {
  const chat = openai(e2eModelId);

  it(
    "prepareStep + hybrid: model calls the tool toolpick surfaces for a deploy request",
    async () => {
      const index = createToolIndex(saasTools, { strategy: "hybrid" });

      const result = await generateText({
        model: chat,
        tools: saasTools,
        toolChoice: "required",
        stopWhen: stepCountIs(4),
        prepareStep: index.prepareStep({ maxTools: 4 }),
        system:
          "You are an assistant with tools. For each user message, call exactly one tool that best matches what they want. Use concise tool arguments.",
        prompt:
          "We need to push the marketing site live on Vercel production from the main branch. Do the deployment.",
      });

      const names = toolNamesFromSteps(result.steps);
      expect(names).toContain("deployToVercel");
    },
    TIMEOUT,
  );

  it(
    "prepareStep + combined search (embeddings): model reaches the right tool after warmUp",
    async () => {
      const index = createToolIndex(saasTools, {
        embeddingModel: openai.embeddingModel("text-embedding-3-small"),
      });
      await index.warmUp();

      const result = await generateText({
        model: chat,
        tools: saasTools,
        toolChoice: "required",
        stopWhen: stepCountIs(4),
        prepareStep: index.prepareStep({ maxTools: 4 }),
        system:
          "You are an assistant with tools. For each user message, call exactly one tool that best matches what they want. Use concise tool arguments.",
        prompt:
          "Customer wants their money back for the last card charge — process a Stripe refund.",
      });

      const names = toolNamesFromSteps(result.steps);
      expect(names).toContain("refundStripePayment");
    },
    TIMEOUT,
  );

  it(
    "wrapLanguageModel + middleware: generateText runs with filtered tools",
    async () => {
      const index = createToolIndex(saasTools, { strategy: "hybrid" });
      const model = wrapLanguageModel({
        model: chat,
        middleware: index.middleware({ maxTools: 4 }),
      });

      const result = await generateText({
        model,
        tools: saasTools,
        toolChoice: "required",
        stopWhen: stepCountIs(4),
        system:
          "You are an assistant with tools. For each user message, call exactly one tool that best matches what they want. Use concise tool arguments.",
        prompt: "Post a short status update to the team's Slack channel about the release.",
      });

      const names = toolNamesFromSteps(result.steps);
      expect(names).toContain("sendSlackMessage");
    },
    TIMEOUT,
  );
});
