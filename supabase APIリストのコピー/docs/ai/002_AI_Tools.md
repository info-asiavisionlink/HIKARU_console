---
タイトル: AI Tools
URL: https://supabase.com/docs/guides/ai-tools
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, ai-tools, tools
---

# AI Tools

**URL:** https://supabase.com/docs/guides/ai-tools
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, ai-tools, tools

## 目次

- [Pick your agent#](#pick-your-agent)
- [Key concepts#](#key-concepts)
- [Building AI into your app?#](#building-ai-into-your-app)

## 概要

Connect your AI coding agent to Supabase.

---

Supabase provides everything you need to connect an AI coding agent to your project: a live connection to your database and platform (MCP), portable instructions your agent can reuse (Agent Skills), a one-step bundle of both (Plugin), and copy-paste prompts for tools that don't support any of the above.

## Pick your agent#

  * [![](/docs/img/icons/agent-antigravity-icon.svg)AntigravityMCPExperience liftoff with the next-gen agent platform.](</docs/guides/ai-tools/mcp>)
  * [![](/docs/img/icons/agent-claude-icon.svg)Claude CodePlugin + MCPWork with Claude directly in your codebase, from your terminal, IDE, and more.](</docs/guides/ai-tools/plugins>)
  * [![](/docs/img/icons/agent-openai-icon-light.svg)CodexPlugin + MCPA lightweight coding agent that runs in your terminal.](</docs/guides/ai-tools/plugins>)
  * [![](/docs/img/icons/agent-cursor-icon-light.svg)CursorPlugin + MCPYour coding agent for building ambitious software.](</docs/guides/ai-tools/plugins>)
  * [![](/docs/img/icons/agent-factory-icon-light.svg)FactoryMCPA self-improving system for your SDLC.](</docs/guides/ai-tools/mcp>)
  * [![](/docs/img/icons/agent-gemini-cli-icon.svg)Gemini CLIPlugin + MCPBuild, debug & deploy with AI.](</docs/guides/ai-tools/plugins>)
  * [![](/docs/img/icons/agent-copilot-icon-light.svg)GitHub CopilotPlugin + MCPYour AI accelerator for every workflow, from the editor to the enterprise.](</docs/guides/ai-tools/plugins>)
  * [![](/docs/img/icons/agent-goose-icon-light.svg)GooseMCPYour native open source AI agent — desktop app, CLI, and API.](</docs/guides/ai-tools/mcp>)
  * [![](/docs/img/icons/agent-kimi-icon-light.svg)Kimi CodePlugin + MCPEngineered to drop into any dev workflow and get programming tasks done fast.](</docs/guides/ai-tools/plugins>)
  * [![](/docs/img/icons/agent-kiro-icon.svg)KiroMCPMove beyond AI coding to agentic engineering.](</docs/guides/ai-tools/mcp>)
  * [![](/docs/img/icons/agent-opencode-icon-light.svg)OpenCodeMCPThe open source AI coding agent.](</docs/guides/ai-tools/mcp>)
  * [![](/docs/img/icons/agent-vscode-icon.svg)VS CodePlugin + MCPThe open source AI code editor — your home for multi-agent development.](</docs/guides/ai-tools/plugins>)
  * [![](/docs/img/icons/agent-windsurf-icon-light.svg)WindsurfMCPThe first agentic IDE. Tomorrow's editor, today.](</docs/guides/ai-tools/mcp>)


## Key concepts#

  * **MCP (Model Context Protocol)** : a live connection between your agent and your actual Supabase project. Once connected, your agent can call tools to query data, run migrations, deploy Edge Functions, and more.
  * **Agent Skills** : portable, on-demand instructions your agent loads when it needs Supabase- or Postgres-specific procedural knowledge. Skills don't require a live connection, and work across different agents.
  * **Plugin** : a single install that bundles the MCP server and Agent Skills together for a specific agent.
  * **Prompts** : static prompt files you copy into your project for agents that don't support MCP, plugins, or skills natively.


## Building AI into your app?#

The tools above are for your development workflow. If you're building AI capabilities into your own product:

  * [![](/docs/img/icons/product-edge-functions-icon-light.svg)Deploy MCP serversHost your own MCP server on Supabase Edge Functions so your users can connect their AI agents to your product](</docs/guides/ai-tools/byo-mcp>)
  * [![](/docs/img/icons/product-vector-icon-light.svg)Vectors / EmbeddingsBuild semantic search, RAG pipelines, and other AI-powered features using pgvector](</docs/guides/ai>)