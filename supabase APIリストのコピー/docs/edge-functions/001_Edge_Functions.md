---
タイトル: Edge Functions
URL: https://supabase.com/docs/guides/functions
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge, edge-functions, functions
---

# Edge Functions

**URL:** https://supabase.com/docs/guides/functions
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge, edge-functions, functions

## 目次

- [How it works#](#how-it-works)
- [Quick technical notes#](#quick-technical-notes)
- [When to use Edge Functions#](#when-to-use-edge-functions)
- [Get started#](#get-started)
- [Examples#](#examples)
  - [Supabase integration#](#supabase-integration)
  - [Webhooks & payments#](#webhooks--payments)
  - [AI & media#](#ai--media)
  - [Bots & email#](#bots--email)
  - [Operations & security#](#operations--security)

## 概要

Run TypeScript functions globally at the edge.

---

Edge Functions are server-side TypeScript functions, distributed globally at the edge—close to your users. They can be used for listening to webhooks or integrating your Supabase project with third-parties [like Stripe](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/stripe-webhooks>). Edge Functions are developed using [Deno](<https://deno.com>), which offers a few benefits to you as a developer:

  * It is open source.
  * It is portable. Supabase Edge Functions run locally, and on any other Deno-compatible platform (including self-hosted infrastructure).
  * It is TypeScript first and supports WASM.
  * Edge Functions are globally distributed for low-latency.


## How it works#

  * **Request enters an edge gateway (relay)** — the gateway routes traffic, handles auth headers/JWT validation, and applies routing/traffic rules.
  * **Auth & policies are applied** — the gateway (or your function) can validate Supabase JWTs, apply rate-limits, and centralize security checks before executing code.
  * **[Edge runtime](<https://github.com/supabase/edge-runtime>) executes your function** — the function runs on a regionally-distributed Edge Runtime node closest to the user for minimal latency.
  * **Integrations & data access** — functions commonly call Supabase APIs (Auth, Postgres, Storage) or third-party APIs. For Postgres, prefer connection strategies suited for edge/serverless environments (see the `connect-to-postgres` guide).
  * **Observability and logs** — invocations emit logs and metrics you can explore in the dashboard or downstream monitoring (Sentry, etc.).
  * **Response returns via the gateway** — the gateway forwards the response back to the client and records request metadata.


## Quick technical notes#

  * **Runtime:** Supabase Edge Runtime (Deno compatible runtime with TypeScript first). Functions are `.ts` files that export a handler.
  * **Local dev parity:** Use Supabase CLI for a local runtime similar to production for faster iteration (`supabase functions serve` command).
  * **Global deployment:** Deploy your Edge Functions via Supabase Dashboard, CLI or MCP.
  * **Cold starts & concurrency:** cold starts are possible — design for short-lived, idempotent operations. Heavy long-running jobs should be moved to [background workers](</docs/guides/functions/background-tasks>).
  * **Database connections:** treat Postgres like a remote, pooled service — use connection pools or serverless-friendly drivers.
  * **Secrets:** store credentials in Supabase [project secrets](</docs/reference/cli/supabase-secrets>) and access them via environment variables.


## When to use Edge Functions#

  * Authenticated or public HTTP endpoints that need low latency.
  * Webhook receivers (Stripe, GitHub, etc.).
  * On-demand image or Open Graph generation.
  * Small AI inference tasks or orchestrating calls to external LLM APIs (like OpenAI)
  * Sending transactional emails.
  * Building messaging bots for Slack, Discord, etc.


## Get started#

  * [Edge Functions quickstartCreate, test, and deploy your first Edge Function with the Supabase CLI.](</docs/guides/functions/quickstart>)


## Examples#

Check out [Supabase Edge Function Examples](<https://github.com/supabase/supabase/tree/master/examples/edge-functions>) in GitHub or try these examples:

### Supabase integration#

  * [With supabase-jsUse the Supabase client inside your Edge Function.](</docs/guides/functions/auth>)
  * [Connect to PostgresConnect to Postgres from Edge Functions.](</docs/guides/functions/connect-to-postgres>)
  * [Type-Safe SQL with KyselyCombine Kysely with Deno Postgres for a convenient developer experience when interacting directly with your Postgres database.](</docs/guides/functions/kysely-postgres>)
  * [With CORS headersSend CORS headers for invoking from the browser.](</docs/guides/functions/cors>)
  * [![](/docs/img/icons/github-icon-light.svg)Building a RESTful Service APILearn how to use HTTP methods and paths to build a RESTful service for managing tasks.](<https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/restful-tasks/index.ts>)
  * [![](/docs/img/icons/github-icon-light.svg)Oak Server MiddlewareRoute requests with Oak server middleware.](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/oak-server>)
  * [![](/docs/img/icons/github-icon-light.svg)Web StreamStream Server-Sent Events from Edge Functions.](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/streams>)
  * [![](/docs/img/icons/github-icon-light.svg)Get User LocationGet user location data from user's IP address.](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/location>)
  * [![](/docs/img/icons/github-icon-light.svg)Working with Supabase StorageRead a file from Supabase Storage.](<https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/read-storage/index.ts>)
  * [![](/docs/img/icons/github-icon-light.svg)Upload FileProcess multipart/form-data.](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/file-upload-storage>)


### Webhooks & payments#

  * [Stripe WebhooksHandle signed Stripe webhooks with Edge Functions.](</docs/guides/functions/examples/stripe-webhooks>)
  * [![](/docs/img/icons/github-icon-light.svg)React Native with StripeUse Supabase and Stripe in a React Native app with Expo.](<https://github.com/supabase-community/expo-stripe-payments-with-supabase-functions>)
  * [![](/docs/img/icons/github-icon-light.svg)Flutter with StripeUse Supabase and Stripe in a Flutter app.](<https://github.com/supabase-community/flutter-stripe-payments-with-supabase-functions>)


### AI & media#

  * [Hugging FaceAccess 100,000+ Machine Learning models.](</docs/guides/ai/examples/huggingface-image-captioning>)
  * [OpenAIUse OpenAI in Edge Functions.](</docs/guides/ai/examples/openai>)
  * [Amazon BedrockGenerate images with Amazon Bedrock in Edge Functions.](</docs/guides/functions/examples/amazon-bedrock-image-generator>)
  * [Open Graph Image GenerationGenerate Open Graph images with Deno and Supabase Edge Functions.](</docs/guides/functions/examples/og-image>)
  * [![](/docs/img/icons/github-icon-light.svg)OG Image Generation & Storage CDN CachingCache generated images with Supabase Storage CDN.](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/og-image-with-storage-cdn>)
  * [PuppeteerGenerate screenshots with Puppeteer.](</docs/guides/functions/examples/screenshots>)


### Bots & email#

  * [Send emailsSend emails in Edge Functions with Resend.](</docs/guides/functions/examples/send-emails>)
  * [Discord BotBuild a slash command Discord bot with Edge Functions.](</docs/guides/functions/examples/discord-bot>)
  * [Telegram BotBuild a Telegram bot with Edge Functions.](</docs/guides/functions/examples/telegram-bot>)
  * [Slack Bot Mention Edge FunctionHandle Slack mentions in a Slack bot Edge Function.](</docs/guides/functions/examples/slack-bot-mention>)


### Operations & security#

  * [Monitoring with SentryMonitor Edge Functions with the Sentry Deno SDK.](</docs/guides/functions/examples/sentry-monitoring>)
  * [GitHub ActionsDeploy Edge Functions with GitHub Actions.](</docs/guides/functions/examples/github-actions>)
  * [Upstash RedisBuild an Edge Functions Counter with Upstash Redis.](</docs/guides/functions/examples/upstash-redis>)
  * [Rate LimitingRate-limit Edge Functions with Upstash Redis.](</docs/guides/functions/examples/rate-limiting>)
  * [Cloudflare TurnstileProtect forms with Cloudflare Turnstile.](</docs/guides/functions/examples/cloudflare-turnstile>)