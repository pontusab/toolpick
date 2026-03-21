import { describe, it, expect } from "bun:test";
import { openai } from "@ai-sdk/openai";
import { createToolIndex } from "../tool-index";
import { tool, jsonSchema } from "ai";

function makeTool(description: string) {
  return tool({
    description,
    inputSchema: jsonSchema<{ input: string }>({
      type: "object",
      properties: { input: { type: "string" } },
      required: ["input"],
    }),
    execute: async () => ({ ok: true }),
  });
}

const allTools = {
  createLinearIssue: makeTool("Create a new issue in Linear with title, description, team, priority, and labels"),
  updateLinearIssue: makeTool("Update an existing Linear issue status, assignee, priority, or due date"),
  listLinearIssues: makeTool("List and filter Linear issues by team, status, assignee, or label"),
  createNotionPage: makeTool("Create a new page in Notion with title, content blocks, and parent database"),
  updateNotionPage: makeTool("Update properties or content of an existing Notion page or database entry"),
  sendSlackMessage: makeTool("Send a message to a Slack channel or direct message to a user"),
  createSlackChannel: makeTool("Create a new Slack channel with name, description, and initial members"),
  sendEmail: makeTool("Send an email with recipient, subject, body, and optional attachments via SMTP"),
  scheduleEmail: makeTool("Schedule an email to be sent at a specific future date and time"),
  sendSMS: makeTool("Send an SMS text message to a phone number via Twilio"),
  createGitHubPR: makeTool("Create a pull request on GitHub with base branch, head branch, title, and body"),
  mergeGitHubPR: makeTool("Merge an open pull request on GitHub with merge strategy squash or rebase"),
  triggerGitHubAction: makeTool("Trigger a GitHub Actions workflow run with optional input parameters"),
  deployToVercel: makeTool("Deploy a project to Vercel production or preview environment"),
  rollbackVercelDeployment: makeTool("Rollback a Vercel deployment to a previous version"),
  queryPostgres: makeTool("Execute a read-only SQL query against the PostgreSQL database"),
  runMigration: makeTool("Run a database migration script against PostgreSQL"),
  createHubSpotContact: makeTool("Create a new contact in HubSpot CRM with name, email, company, and phone"),
  updateHubSpotDeal: makeTool("Update a HubSpot deal stage, amount, close date, or owner"),
  logHubSpotActivity: makeTool("Log a call, meeting, or note activity on a HubSpot contact or deal"),
  searchHubSpotContacts: makeTool("Search HubSpot contacts by name, email, company, or custom property"),
  createStripeInvoice: makeTool("Create a new invoice in Stripe for a customer with line items and due date"),
  refundStripePayment: makeTool("Issue a full or partial refund for a Stripe payment or charge"),
  getStripeBalance: makeTool("Get the current Stripe account balance and pending payouts"),
  uploadToS3: makeTool("Upload a file to an Amazon S3 bucket with key and content type"),
  generatePresignedUrl: makeTool("Generate a temporary presigned URL for accessing a private S3 object"),
  translateText: makeTool("Translate text from one language to another using machine translation"),
  summarizeText: makeTool("Summarize a long text document into key points using AI"),
  extractDataFromPDF: makeTool("Extract structured data, tables, and text from a PDF document"),
  resizeImage: makeTool("Resize and optimize an image to specified dimensions and format"),
};

const ALL_BLIND: Array<[string, string]> = [
  ["ship it", "deployToVercel"],
  ["ping the team", "sendSlackMessage"],
  ["file a bug", "createLinearIssue"],
  ["nuke the last release", "rollbackVercelDeployment"],
  ["shoot them a text", "sendSMS"],
  ["how much are we making", "getStripeBalance"],
  ["write something up about the meeting", "createNotionPage"],
  ["get this into the other language", "translateText"],
  ["bill them for the work", "createStripeInvoice"],
  ["can you give them their money back", "refundStripePayment"],
  ["make this shorter", "summarizeText"],
  ["open a ticket for the broken login", "createLinearIssue"],
  ["put this on S3", "uploadToS3"],
  ["hit the database for user records", "queryPostgres"],
  ["get the CI running", "triggerGitHubAction"],
  ["compress this photo", "resizeImage"],
  ["send the PR for review", "createGitHubPR"],
  ["log that I called the client", "logHubSpotActivity"],
  ["give me a shareable link for that file", "generatePresignedUrl"],
];

const TIMEOUT = 120_000;

describe("Combined + re-ranking — blind user queries", () => {
  const index = createToolIndex(allTools, {
    embeddingModel: openai.embeddingModel("text-embedding-3-small"),
    rerankerModel: openai("gpt-4o-mini"),
  });

  it("accuracy: ≥90% of 19 blind queries in top 5", async () => {
    let hits = 0;
    const misses: string[] = [];

    for (const [query, expected] of ALL_BLIND) {
      const selected = await index.select(query, { maxTools: 5, adaptive: false });
      if (selected.includes(expected)) {
        hits++;
      } else {
        misses.push(`"${query}" → expected ${expected}, got [${selected.join(", ")}]`);
      }
    }

    const accuracy = hits / ALL_BLIND.length;
    console.log(`  Re-rank accuracy: ${hits}/${ALL_BLIND.length} = ${(accuracy * 100).toFixed(0)}%`);
    if (misses.length > 0) {
      console.log(`  Misses:`);
      for (const m of misses) console.log(`    ${m}`);
    }
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  }, TIMEOUT);
});

describe("Combined + enrichment + re-ranking — blind user queries", () => {
  const index = createToolIndex(allTools, {
    embeddingModel: openai.embeddingModel("text-embedding-3-small"),
    rerankerModel: openai("gpt-4o-mini"),
    enrichDescriptions: true,
  });

  it("warmUp enriches descriptions", async () => {
    await index.warmUp();
  }, TIMEOUT);

  it("accuracy: ≥90% of 19 blind queries in top 5", async () => {
    let hits = 0;
    const misses: string[] = [];

    for (const [query, expected] of ALL_BLIND) {
      const selected = await index.select(query, { maxTools: 5, adaptive: false });
      if (selected.includes(expected)) {
        hits++;
      } else {
        misses.push(`"${query}" → expected ${expected}, got [${selected.join(", ")}]`);
      }
    }

    const accuracy = hits / ALL_BLIND.length;
    console.log(`  Enriched + re-rank accuracy: ${hits}/${ALL_BLIND.length} = ${(accuracy * 100).toFixed(0)}%`);
    if (misses.length > 0) {
      console.log(`  Misses:`);
      for (const m of misses) console.log(`    ${m}`);
    }
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  }, TIMEOUT);
});
