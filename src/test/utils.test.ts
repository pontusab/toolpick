import { describe, it, expect } from "bun:test";
import { tokenize, splitCompound } from "../utils";

describe("splitCompound", () => {
  it("splits camelCase", () => {
    expect(splitCompound("createjiraticket")).toEqual(["createjiraticket"]);
    expect(splitCompound("createJiraTicket")).toEqual(["create", "jira", "ticket"]);
  });

  it("splits PascalCase", () => {
    expect(splitCompound("CreateJiraTicket")).toEqual(["create", "jira", "ticket"]);
  });

  it("splits snake_case", () => {
    expect(splitCompound("create_jira_ticket")).toEqual(["create", "jira", "ticket"]);
  });

  it("handles acronyms in camelCase", () => {
    expect(splitCompound("parseHTMLDocument")).toEqual(["parse", "html", "document"]);
    expect(splitCompound("getAPIKey")).toEqual(["get", "api", "key"]);
  });

  it("returns single-word unchanged", () => {
    expect(splitCompound("deploy")).toEqual(["deploy"]);
  });
});

describe("tokenize", () => {
  it("lowercases and splits on whitespace", () => {
    const tokens = tokenize("Create A Ticket");
    expect(tokens).toContain("create");
    expect(tokens).toContain("ticket");
    expect(tokens).not.toContain("a");
  });

  it("removes punctuation but keeps unicode letters", () => {
    const tokens = tokenize("créer un billet!");
    expect(tokens).toContain("créer");
    expect(tokens).toContain("billet");
  });

  it("splits camelCase tool names", () => {
    const tokens = tokenize("createJiraTicket");
    expect(tokens).toContain("create");
    expect(tokens).toContain("jira");
    expect(tokens).toContain("ticket");
  });

  it("splits snake_case tool names", () => {
    const tokens = tokenize("create_jira_ticket");
    expect(tokens).toContain("create");
    expect(tokens).toContain("jira");
    expect(tokens).toContain("ticket");
  });

  it("filters english stopwords", () => {
    const tokens = tokenize("send a message to the user");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("to");
    expect(tokens).not.toContain("the");
    expect(tokens).toContain("send");
    expect(tokens).toContain("message");
    expect(tokens).toContain("user");
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("handles CJK characters", () => {
    const tokens = tokenize("翻訳する");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).toContain("翻訳する");
  });

  it("handles mixed scripts", () => {
    const tokens = tokenize("send a Slack メッセージ");
    expect(tokens).toContain("send");
    expect(tokens).toContain("slack");
    expect(tokens).toContain("メッセージ");
  });
});
