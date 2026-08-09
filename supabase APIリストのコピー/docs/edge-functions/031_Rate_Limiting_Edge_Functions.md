---
タイトル: Rate Limiting Edge Functions
URL: https://supabase.com/docs/guides/functions/examples/rate-limiting
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge, edge-functions, examples, functions, limiting, rate, rate-limiting
---

# Rate Limiting Edge Functions

**URL:** https://supabase.com/docs/guides/functions/examples/rate-limiting
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge, edge-functions, examples, functions, limiting, rate, rate-limiting

## 目次

（目次なし）

## 概要

Rate Limiting Edge Functions with Upstash Redis.

---

[Redis](<https://redis.io/about/>) is an open source (BSD licensed), in-memory data structure store used as a database, cache, message broker, and streaming engine. It is optimized for atomic operations like incrementing a value, for example for a view counter or rate limiting. We can even rate limit based on the user ID from Supabase Auth!

[Upstash](<https://upstash.com/>) provides an HTTP/REST based Redis client which is ideal for serverless use-cases and therefore works well with Supabase Edge Functions.

Find the code on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/upstash-redis-ratelimit>).