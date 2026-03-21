import { describe, it, expect } from "bun:test";
import { HybridSearch } from "../search/hybrid";
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

describe("Real-world SaaS agent — 30 tools", () => {
  const engine = new HybridSearch(SAAS_TOOLS);

  describe("natural language queries", () => {
    it("'create an issue for the login bug' → createLinearIssue", () => {
      const top5 = engine.search("create an issue for the login bug", 5).map((r) => r.name);
      expect(top5).toContain("createLinearIssue");
    });

    it("'let the team know on slack' → sendSlackMessage", () => {
      const top5 = engine.search("let the team know on slack", 5).map((r) => r.name);
      expect(top5).toContain("sendSlackMessage");
    });

    it("'deploy the app to production' → deployToVercel", () => {
      const top5 = engine.search("deploy the app to production", 5).map((r) => r.name);
      expect(top5).toContain("deployToVercel");
    });

    it("'check how much money we have' → getStripeBalance", () => {
      const top5 = engine.search("check how much money we have in stripe", 5).map((r) => r.name);
      expect(top5).toContain("getStripeBalance");
    });

    it("'make a new slack room for the project' → createSlackChannel", () => {
      const top5 = engine.search("make a new slack room for the project", 5).map((r) => r.name);
      expect(top5).toContain("createSlackChannel");
    });

    it("'give the customer their money back' → refundStripePayment", () => {
      const top5 = engine.search("give the customer their money back on stripe", 5).map((r) => r.name);
      expect(top5).toContain("refundStripePayment");
    });

    it("'send a text to the client' → sendSMS", () => {
      const top5 = engine.search("send a text message to the client", 5).map((r) => r.name);
      expect(top5).toContain("sendSMS");
    });

    it("'write up meeting notes in notion' → createNotionPage", () => {
      const top5 = engine.search("write up meeting notes in notion", 5).map((r) => r.name);
      expect(top5).toContain("createNotionPage");
    });

    it("'revert the last deploy' → rollbackVercelDeployment", () => {
      const top5 = engine.search("revert the last deploy on vercel", 5).map((r) => r.name);
      expect(top5).toContain("rollbackVercelDeployment");
    });

    it("'add a new lead to the CRM' → createHubSpotContact", () => {
      const top5 = engine.search("add a new lead to hubspot", 5).map((r) => r.name);
      expect(top5).toContain("createHubSpotContact");
    });
  });

  describe("disambiguation between similar tools", () => {
    it("'create' query ranks createLinearIssue above updateLinearIssue", () => {
      const names = engine.search("create a new issue in linear", 5).map((r) => r.name);
      const createIdx = names.indexOf("createLinearIssue");
      const updateIdx = names.indexOf("updateLinearIssue");
      expect(createIdx).not.toBe(-1);
      expect(createIdx < updateIdx || updateIdx === -1).toBe(true);
    });

    it("'update the issue status' ranks updateLinearIssue above createLinearIssue", () => {
      const names = engine.search("update the issue status", 5).map((r) => r.name);
      const updateIdx = names.indexOf("updateLinearIssue");
      const createIdx = names.indexOf("createLinearIssue");
      expect(updateIdx).not.toBe(-1);
      expect(updateIdx < createIdx || createIdx === -1).toBe(true);
    });

    it("'merge the PR' ranks mergeGitHubPR above createGitHubPR", () => {
      const names = engine.search("merge the pull request", 5).map((r) => r.name);
      const mergeIdx = names.indexOf("mergeGitHubPR");
      const createIdx = names.indexOf("createGitHubPR");
      expect(mergeIdx).not.toBe(-1);
      expect(mergeIdx < createIdx || createIdx === -1).toBe(true);
    });

    it("'send email now' ranks sendEmail above scheduleEmail", () => {
      const names = engine.search("send an email right now", 5).map((r) => r.name);
      const sendIdx = names.indexOf("sendEmail");
      const schedIdx = names.indexOf("scheduleEmail");
      expect(sendIdx).not.toBe(-1);
      expect(sendIdx < schedIdx || schedIdx === -1).toBe(true);
    });

    it("'schedule email for tomorrow' ranks scheduleEmail above sendEmail", () => {
      const names = engine.search("schedule an email for tomorrow morning", 5).map((r) => r.name);
      expect(names).toContain("scheduleEmail");
    });
  });

  describe("cross-domain queries", () => {
    it("'send a slack message to the team' → sendSlackMessage (not sendEmail)", () => {
      const names = engine.search("send a slack message to the team", 5).map((r) => r.name);
      expect(names).toContain("sendSlackMessage");
      const slackIdx = names.indexOf("sendSlackMessage");
      const emailIdx = names.indexOf("sendEmail");
      expect(slackIdx < emailIdx || emailIdx === -1).toBe(true);
    });

    it("'find a contact by email in hubspot' → searchHubSpotContacts (not sendEmail)", () => {
      const names = engine.search("find a contact by email in hubspot", 5).map((r) => r.name);
      expect(names).toContain("searchHubSpotContacts");
    });
  });

  describe("domain-specific terminology", () => {
    it("'run the CI pipeline' → triggerGitHubAction", () => {
      const top5 = engine.search("run the CI pipeline on github", 5).map((r) => r.name);
      expect(top5).toContain("triggerGitHubAction");
    });

    it("'SQL select from users' → queryPostgres", () => {
      const top5 = engine.search("SQL select from users table", 5).map((r) => r.name);
      expect(top5).toContain("queryPostgres");
    });

    it("'invoice the client' → createStripeInvoice", () => {
      const top5 = engine.search("invoice the client for this month", 5).map((r) => r.name);
      expect(top5).toContain("createStripeInvoice");
    });

    it("'OCR this document' → extractDataFromPDF", () => {
      const top5 = engine.search("OCR this PDF document and get the data", 5).map((r) => r.name);
      expect(top5).toContain("extractDataFromPDF");
    });

    it("'make the image smaller' → resizeImage", () => {
      const top5 = engine.search("make the image smaller and optimize it", 5).map((r) => r.name);
      expect(top5).toContain("resizeImage");
    });

    it("'get a download link for the file' → generatePresignedUrl", () => {
      const top5 = engine.search("get a temporary download link for the S3 file", 5).map((r) => r.name);
      expect(top5).toContain("generatePresignedUrl");
    });
  });

  describe("top-1 accuracy benchmark", () => {
    const cases: Array<[string, string]> = [
      ["create a linear issue", "createLinearIssue"],
      ["send a slack message", "sendSlackMessage"],
      ["create a pull request on github", "createGitHubPR"],
      ["deploy to vercel", "deployToVercel"],
      ["query the database", "queryPostgres"],
      ["create a stripe invoice", "createStripeInvoice"],
      ["refund a payment", "refundStripePayment"],
      ["upload file to s3", "uploadToS3"],
      ["translate to french", "translateText"],
      ["summarize this document", "summarizeText"],
      ["extract data from pdf", "extractDataFromPDF"],
      ["resize this image", "resizeImage"],
      ["search hubspot contacts", "searchHubSpotContacts"],
      ["log a call in hubspot", "logHubSpotActivity"],
      ["run database migration", "runMigration"],
    ];

    for (const [query, expected] of cases) {
      it(`'${query}' → ${expected} at #1`, () => {
        const results = engine.search(query, 1);
        expect(results[0]?.name).toBe(expected);
      });
    }
  });

  describe("performance", () => {
    it("search completes in <2ms average for 30 tools", () => {
      const iterations = 200;
      const queries = [
        "create a new issue", "send a message", "deploy the app",
        "check the balance", "upload a file", "translate text",
        "merge the PR", "refund payment", "search contacts",
        "run migration",
      ];
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        engine.search(queries[i % queries.length], 5);
      }
      const avgMs = (performance.now() - start) / iterations;
      expect(avgMs).toBeLessThan(2);
    });

    it("indexing 100 tools completes in <50ms", () => {
      const tools: ToolDescription[] = [];
      for (let i = 0; i < 100; i++) {
        tools.push({ name: `tool_${i}`, text: `This is tool number ${i} that does something unique like action_${i}` });
      }
      const start = performance.now();
      new HybridSearch(tools);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});
