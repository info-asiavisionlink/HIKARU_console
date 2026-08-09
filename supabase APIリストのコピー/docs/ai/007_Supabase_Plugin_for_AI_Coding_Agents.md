---
タイトル: Supabase Plugin for AI Coding Agents
URL: https://supabase.com/docs/guides/ai-tools/plugins
カテゴリ: ai
更新日: 2026-08-02
タグ: agents, ai, ai-tools, coding, plugin, plugins, supabase
---

# Supabase Plugin for AI Coding Agents

**URL:** https://supabase.com/docs/guides/ai-tools/plugins
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** agents, ai, ai-tools, coding, plugin, plugins, supabase

## 目次

- [Quick installation#](#quick-installation)
- [Why use the plugin?#](#why-use-the-plugin)
- [What's included#](#whats-included)
  - [Supabase MCP server#](#supabase-mcp-server)
  - [Supabase agent skills#](#supabase-agent-skills)
- [Manual installation#](#manual-installation)

## 概要

The Supabase plugin for AI coding agents bundles the MCP server and agent skills into a single install for your AI coding agent.

---

The Supabase Plugin for AI Coding Agents gives your AI coding agent everything it needs to work with Supabase. It bundles the [Supabase MCP server](</docs/guides/ai-tools/mcp>) and [Supabase agent skills](</docs/guides/ai-tools/ai-skills>) so your agent can query your database, manage migrations, deploy Edge Functions, and follow Supabase and Postgres best practices — without manual configuration.

## Quick installation#
[code] 
    1
    
    npx plugins add supabase-community/supabase-plugin
[/code]

The [`plugins`](<https://www.npmjs.com/package/plugins>) package auto-detects your installed AI coding agents and installs the Supabase plugin to all of them with one command. Use `--yes` to skip the confirmation prompt.

Or, follow the manual installation steps for your specific agent.

## Why use the plugin?#

Plugins for AI coding agents are packages of AI agent extensions. A single plugin can bundle any combination of:

  * **MCP servers** — external tool integrations that let your agent interact with services like Supabase
  * **Skills** — procedural knowledge and context your agent loads on demand to work more accurately
  * **Hooks** — event handlers that run at agent lifecycle points (e.g. before or after a tool call)
  * **Agents** — specialized sub-agents with specific personas and tool configurations
  * **Slash commands** — custom commands you can invoke directly in chat


Bundling the [MCP server](</docs/guides/ai-tools/mcp>) and [agent skills](</docs/guides/ai-tools/ai-skills>) into a single plugin means you can set up both in one step. You can also install them separately if you prefer. You can install the plugin globally to use it across all your projects, or per project to keep it isolated.

## What's included#

### Supabase MCP server#

The [Supabase MCP server](</docs/guides/ai-tools/mcp>) connects your AI coding agent directly to your Supabase projects. Once authenticated, your agent can query your database, manage migrations, deploy Edge Functions, and more — see the [full list of available tools](</docs/guides/ai-tools/mcp#available-tools>).

### Supabase agent skills#

Skills provide your agent with Supabase-specific procedural knowledge:

  * **`supabase`** — Core guidance for working with Supabase products (Database, Auth, Edge Functions, Storage, Realtime)
  * **`supabase-postgres-best-practices`** — Postgres query optimization, schema design, connection management, and RLS patterns


For a full list of available skills and supported agents, see [Agent Skills](</docs/guides/ai-tools/ai-skills>).

## Manual installation#

Alternatively, choose your AI coding agent and follow the installation steps:

Client

![claude logo](https://frontend-assets.supabase.com/docs/3a3661019f4f/_next/static/media/claude-icon.9c4af215.svg)Claude Code

Install the Supabase plugin from the [official Anthropic marketplace](<https://claude.com/plugins/supabase>)
[code]
    claude plugin marketplace add anthropics/claude-plugins-official
    claude plugin install supabase@claude-plugins-official
[/code]

After installing, run `/reload-plugins` inside Claude Code to activate the plugin.

Installs with `--scope user` by default, making it available across all your projects. Use `--scope project` to track it in source control — useful for teams where all contributors and cloud agents should follow the same Supabase guidance.

Need help?[View Claude Code extensions docs](<https://code.claude.com/docs/en/discover-plugins>)

[Give feedback](<https://github.com/supabase-community/supabase-plugin>)