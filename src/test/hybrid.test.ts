import { describe, it, expect } from "bun:test";
import { HybridSearch } from "../search/hybrid";
import type { ToolDescription } from "../search/types";

const MOCK_TOOLS: ToolDescription[] = [
  { name: "createJiraTicket", text: "Create a new Jira ticket with title, description, and priority" },
  { name: "updateJiraTicket", text: "Update an existing Jira ticket fields like status and assignee" },
  { name: "sendSlackMessage", text: "Send a message to a Slack channel or user" },
  { name: "sendEmail", text: "Send an email to one or more recipients with subject and body" },
  { name: "searchGitHub", text: "Search GitHub repositories, issues, and pull requests" },
  { name: "createPullRequest", text: "Create a pull request on GitHub with a branch and description" },
  { name: "deployToVercel", text: "Deploy an application to Vercel with environment variables" },
  { name: "runDatabaseQuery", text: "Execute a SQL query against the PostgreSQL database" },
  { name: "uploadToS3", text: "Upload a file to an Amazon S3 bucket" },
  { name: "getWeather", text: "Get the current weather forecast for a city or location" },
  { name: "translateText", text: "Translate text from one language to another using machine translation" },
  { name: "generateImage", text: "Generate an image from a text prompt using AI image generation" },
  { name: "searchDocumentation", text: "Search the documentation for relevant articles and guides" },
  { name: "createCalendarEvent", text: "Create a new calendar event with title date time and attendees" },
  { name: "analyzeCode", text: "Analyze source code for bugs vulnerabilities and code quality issues" },
];

describe("HybridSearch", () => {
  const engine = new HybridSearch(MOCK_TOOLS);

  it("finds Jira tools for ticket-related queries", () => {
    const names = engine.search("create a ticket", 5).map((r) => r.name);
    expect(names).toContain("createJiraTicket");
  });

  it("finds Slack tool for messaging queries", () => {
    const names = engine.search("send a message on slack", 5).map((r) => r.name);
    expect(names).toContain("sendSlackMessage");
  });

  it("finds email tool for email queries", () => {
    const names = engine.search("send an email to the team", 5).map((r) => r.name);
    expect(names).toContain("sendEmail");
  });

  it("finds GitHub tools for PR queries", () => {
    const names = engine.search("create a pull request", 5).map((r) => r.name);
    expect(names).toContain("createPullRequest");
  });

  it("finds database tool for SQL queries", () => {
    const names = engine.search("run a SQL query", 5).map((r) => r.name);
    expect(names).toContain("runDatabaseQuery");
  });

  it("finds deploy tool for deployment queries", () => {
    const names = engine.search("deploy the app", 5).map((r) => r.name);
    expect(names).toContain("deployToVercel");
  });

  it("finds weather tool for weather queries", () => {
    const names = engine.search("what's the weather in Stockholm", 5).map((r) => r.name);
    expect(names).toContain("getWeather");
  });

  it("finds image generation for image queries", () => {
    const names = engine.search("generate a picture of a cat", 5).map((r) => r.name);
    expect(names).toContain("generateImage");
  });

  it("finds translation tool for translate queries", () => {
    const names = engine.search("translate this to Spanish", 5).map((r) => r.name);
    expect(names).toContain("translateText");
  });

  it("finds calendar tool for scheduling queries", () => {
    const names = engine.search("create a calendar event for a meeting", 5).map((r) => r.name);
    expect(names).toContain("createCalendarEvent");
  });

  it("returns scores in descending order", () => {
    const results = engine.search("create a ticket", 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("respects maxResults", () => {
    const results = engine.search("create something", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("returns empty for irrelevant queries", () => {
    const results = engine.search("xyzzyplugh", 5);
    expect(results).toHaveLength(0);
  });

  it("runs in under 5ms for 15 tools", () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      engine.search("create a ticket and send an email", 5);
    }
    const avgMs = (performance.now() - start) / 100;
    expect(avgMs).toBeLessThan(5);
  });
});
