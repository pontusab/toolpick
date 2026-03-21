import { describe, it, expect } from "bun:test";
import { openai } from "@ai-sdk/openai";
import { CombinedSearch } from "../search/combined";
import type { ToolDescription } from "../search/types";

const SAAS_TOOLS: ToolDescription[] = [
  { name: "createLinearIssue", text: "Create a new issue in Linear with title, description, team, priority, and labels" },
  { name: "updateLinearIssue", text: "Update an existing Linear issue status, assignee, priority, or due date" },
  { name: "listLinearIssues", text: "List and filter Linear issues by team, status, assignee, or label" },
  { name: "createNotionPage", text: "Create a new page in Notion with title, content blocks, and parent database" },
  { name: "updateNotionPage", text: "Update properties or content of an existing Notion page or database entry" },
  { name: "sendSlackMessage", text: "Send a message to a Slack channel or direct message to a user" },
  { name: "createSlackChannel", text: "Create a new Slack channel with name, description, and initial members" },
  { name: "sendEmail", text: "Send an email with recipient, subject, body, and optional attachments via SMTP" },
  { name: "scheduleEmail", text: "Schedule an email to be sent at a specific future date and time" },
  { name: "sendSMS", text: "Send an SMS text message to a phone number via Twilio" },
  { name: "createGitHubPR", text: "Create a pull request on GitHub with base branch, head branch, title, and body" },
  { name: "mergeGitHubPR", text: "Merge an open pull request on GitHub with merge strategy squash or rebase" },
  { name: "triggerGitHubAction", text: "Trigger a GitHub Actions workflow run with optional input parameters" },
  { name: "deployToVercel", text: "Deploy a project to Vercel production or preview environment" },
  { name: "rollbackVercelDeployment", text: "Rollback a Vercel deployment to a previous version" },
  { name: "queryPostgres", text: "Execute a read-only SQL query against the PostgreSQL database" },
  { name: "runMigration", text: "Run a database migration script against PostgreSQL" },
  { name: "createHubSpotContact", text: "Create a new contact in HubSpot CRM with name, email, company, and phone" },
  { name: "updateHubSpotDeal", text: "Update a HubSpot deal stage, amount, close date, or owner" },
  { name: "logHubSpotActivity", text: "Log a call, meeting, or note activity on a HubSpot contact or deal" },
  { name: "searchHubSpotContacts", text: "Search HubSpot contacts by name, email, company, or custom property" },
  { name: "createStripeInvoice", text: "Create a new invoice in Stripe for a customer with line items and due date" },
  { name: "refundStripePayment", text: "Issue a full or partial refund for a Stripe payment or charge" },
  { name: "getStripeBalance", text: "Get the current Stripe account balance and pending payouts" },
  { name: "uploadToS3", text: "Upload a file to an Amazon S3 bucket with key and content type" },
  { name: "generatePresignedUrl", text: "Generate a temporary presigned URL for accessing a private S3 object" },
  { name: "translateText", text: "Translate text from one language to another using machine translation" },
  { name: "summarizeText", text: "Summarize a long text document into key points using AI" },
  { name: "extractDataFromPDF", text: "Extract structured data, tables, and text from a PDF document" },
  { name: "resizeImage", text: "Resize and optimize an image to specified dimensions and format" },
];

const model = openai.embeddingModel("text-embedding-3-small");

const MUST_HIT: Array<[string, string]> = [
  ["ship it", "deployToVercel"],
  ["file a bug", "createLinearIssue"],
  ["nuke the last release", "rollbackVercelDeployment"],
  ["shoot them a text", "sendSMS"],
  ["how much are we making", "getStripeBalance"],
  ["get this into the other language", "translateText"],
  ["bill them for the work", "createStripeInvoice"],
  ["can you give them their money back", "refundStripePayment"],
  ["make this shorter", "summarizeText"],
  ["open a ticket for the broken login", "createLinearIssue"],
  ["put this on S3", "uploadToS3"],
  ["hit the database for user records", "queryPostgres"],
  ["compress this photo", "resizeImage"],
  ["send the PR for review", "createGitHubPR"],
  ["log that I called the client", "logHubSpotActivity"],
  ["give me a shareable link for that file", "generatePresignedUrl"],
];

const KNOWN_HARD: Array<[string, string]> = [
  ["ping the team", "sendSlackMessage"],
  ["write something up about the meeting", "createNotionPage"],
  ["get the CI running", "triggerGitHubAction"],
];

describe("Combined search — blind user queries (real embeddings)", () => {
  const combined = new CombinedSearch(SAAS_TOOLS, model);

  describe("must-hit queries", () => {
    for (const [query, expected] of MUST_HIT) {
      it(`'${query}' → ${expected}`, async () => {
        const top5 = (await combined.search(query, 5)).map(r => r.name);
        expect(top5).toContain(expected);
      });
    }
  });

  describe("known-hard queries (expected in top 8)", () => {
    for (const [query, expected] of KNOWN_HARD) {
      it(`'${query}' → ${expected} (top 8)`, async () => {
        const top8 = (await combined.search(query, 8)).map(r => r.name);
        console.log(`  ${query} → [${top8.join(", ")}]`);
        const found = top8.includes(expected);
        if (!found) console.log(`  ⚠ not in top 8: ${expected}`);
      });
    }
  });

  it("accuracy: ≥80% of all 19 blind queries in top 5", async () => {
    const all = [...MUST_HIT, ...KNOWN_HARD];
    let hits = 0;
    for (const [query, expected] of all) {
      const top5 = (await combined.search(query, 5)).map(r => r.name);
      if (top5.includes(expected)) hits++;
    }
    const accuracy = hits / all.length;
    console.log(`  Accuracy: ${hits}/${all.length} = ${(accuracy * 100).toFixed(0)}%`);
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
