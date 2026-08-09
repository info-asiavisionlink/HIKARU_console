---
タイトル: Agent Skills
URL: https://supabase.com/docs/guides/ai-tools/ai-skills
カテゴリ: ai
更新日: 2026-08-02
タグ: agent, ai, ai-skills, ai-tools, skills
---

# Agent Skills

**URL:** https://supabase.com/docs/guides/ai-tools/ai-skills
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** agent, ai, ai-skills, ai-tools, skills

## 目次

- [Installing skills#](#installing-skills)
- [Available skills#](#available-skills)
  - [supabase#](#supabase)
  - [supabase-postgres-best-practices#](#supabase-postgres-best-practices)
- [Finding more skills#](#finding-more-skills)
- [Learn more#](#learn-more)

## 概要

Searchdocs...

---

Agent Skills are folders of instructions, scripts, and resources that agents can discover and use to do things more accurately and efficiently. Agents are increasingly capable, but often don't have the context they need to do real work reliably. Skills solve this by giving agents access to procedural knowledge and company-, team-, and user-specific context they can load on demand. Agents with access to a set of skills can extend their capabilities based on the task they're working on.

## Installing skills#

Install all Supabase skills using the skills CLI:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

To install a specific skill from the repository:
[code] 
    1
    
    npx skills add supabase/agent-skills --skill SKILL_NAME
[/code]

Skills are installed at project scope by default, placing them in your repository so contributors and cloud agents all share the same setup. Pass `--global` to install across all your projects instead.

Add skills for all detected agents at the same time by passing `--all`. See the [skills package](<https://github.com/vercel-labs/skills>) for more options.

You can also install the agent skills together with the Supabase MCP server using the [Supabase Plugin for AI Coding Agents](</docs/guides/ai-tools/plugins>) for a combined one-step setup.

## Available skills#

### supabase#

Use when doing ANY task involving Supabase. Triggers: Supabase products (Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, Queues); client libraries and SSR integrations (supabase-js, @supabase/ssr) in Next.js, React, SvelteKit, Astro, Remix; auth issues (login, logout, sessions, JWT, cookies, getSession, getUser, getClaims, RLS); Supabase CLI or MCP server; schema changes, migrations, declarative schemas, security audits, Postgres extensions (pg_graphql, pg_cron, pg_vector).
[code]
    npx skills add supabase/agent-skills --skill supabase
[/code]

### supabase-postgres-best-practices#

Postgres best practices maintained by Supabase, for Postgres running anywhere. Load this skill BEFORE writing or changing anything that lives in a Postgres database: creating or altering tables and columns (including choosing column types), schema design, migrations and declarative schema files, RLS policies and the tests that verify them, indexes, triggers, database functions, queues and scheduled jobs (pg_cron, pgmq), vector/semantic search (pgvector), and restoring dumps (pg_restore) or importing data. Also load it when diagnosing slow queries, high CPU, timeouts, EXPLAIN plans, connection exhaustion, locking, bloat, or rows visible to the wrong user or tenant. This is not just a performance guide — schema, migration, security, and SQL authoring tasks need these rules too, even for a one-column change or a single query.
[code]
    npx skills add supabase/agent-skills --skill supabase-postgres-best-practices
[/code]

## Finding more skills#

Browse the [skills.sh directory](<https://skills.sh>) to discover skills from the community. You can also search for skills using the CLI:
[code] 
    1
    
    npx skills find QUERY
[/code]

## Learn more#

  * [Agent Skills Repository](<https://github.com/supabase/agent-skills>)
  * [Agent Skills Documentation](<https://agentskills.io/home>)
  * [Agent Skills Overview](<https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>)
  * [skills npm package](<https://github.com/vercel-labs/skills>)