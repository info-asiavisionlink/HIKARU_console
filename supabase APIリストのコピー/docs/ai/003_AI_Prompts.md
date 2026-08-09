---
タイトル: AI Prompts
URL: https://supabase.com/docs/guides/ai-tools/ai-prompts
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, ai-prompts, ai-tools, prompts
---

# AI Prompts

**URL:** https://supabase.com/docs/guides/ai-tools/ai-prompts
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, ai-prompts, ai-tools, prompts

## 目次

- [How to use#](#how-to-use)
- [Prompts#](#prompts)
- [Use in different environments#](#use-in-different-environments)

## 概要

Prompts for working with Supabase using AI-powered IDE tools

---

We've curated a selection of prompts to help you work with Supabase using your favorite AI-powered IDE tools, such as Cursor or GitHub Copilot.

## How to use#

Copy the prompt to a file in your repo.

Use the "include file" feature from your AI tool to include the prompt when chatting with your AI assistant. For example, in Cursor, add them as [project rules](<https://docs.cursor.com/context/rules-for-ai#project-rules-recommended>), with GitHub Copilot, use `#<filename>`, and in Zed, use `/file`.

## Prompts#

[Supabase Realtime AI Assistant Guide](</docs/guides/ai-tools/ai-prompts/use-realtime>)[Bootstrap Next.js v16 app with Supabase Auth](</docs/guides/ai-tools/ai-prompts/nextjs-supabase-auth>)[Writing Supabase Edge Functions](</docs/guides/ai-tools/ai-prompts/edge-functions>)[Database: Declarative Database Schema](</docs/guides/ai-tools/ai-prompts/declarative-database-schema>)[Database: Create RLS policies](</docs/guides/ai-tools/ai-prompts/database-rls-policies>)[Database: Create functions](</docs/guides/ai-tools/ai-prompts/database-functions>)[Database: Create migration](</docs/guides/ai-tools/ai-prompts/database-create-migration>)[Postgres SQL Style Guide](</docs/guides/ai-tools/ai-prompts/code-format-sql>)

## Use in different environments#

You can load these prompts into various tools. Here are common options and where to place the prompt:

Environment| Where to put prompt| Installation instructions  
---|---|---  
Cursor| Project rules (`.cursor/rules/*.md` or `.mdx`)| [Configure project rules](<https://docs.cursor.com/en/context/rules>)  
GitHub Copilot| `.github/copilot-instructions.md`| [Custom instructions in Copilot](<https://code.visualstudio.com/docs/copilot/copilot-customization#_custom-instructions>)  
JetBrains IDEs| `guidelines.md`| [Customize guidelines](<https://www.jetbrains.com/help/junie/customize-guidelines.html>)  
Gemini CLI| `GEMINI.md`| [Gemini CLI codelab](<https://codelabs.developers.google.com/gemini-cli-hands-on>)  
VS Code| `.instructions.md`| Configure `.instructions.md`  
Windsurf| `guidelines.md`| Configure `guidelines.md`