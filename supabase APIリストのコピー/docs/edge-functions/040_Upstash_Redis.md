---
タイトル: Upstash Redis
URL: https://supabase.com/docs/guides/functions/examples/upstash-redis
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, examples, functions, redis, upstash, upstash-redis
---

# Upstash Redis

**URL:** https://supabase.com/docs/guides/functions/examples/upstash-redis
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, examples, functions, redis, upstash, upstash-redis

## 目次

- [Redis database setup#](#redis-database-setup)
- [Code#](#code)
- [Run locally#](#run-locally)
- [Deploy#](#deploy)

## 概要

Build an Edge Functions Counter with Upstash Redis.

---

A Redis counter example that stores a [hash](<https://redis.io/commands/hincrby/>) of function invocation count per region. Find the code on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/upstash-redis-counter>).

## Redis database setup#

Create a Redis database using the [Upstash Console](<https://console.upstash.com/>) or [Upstash CLI](<https://github.com/upstash/cli>).

Select the `Global` type to minimize the latency from all edge locations. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your .env file.

You'll find them under **Details > REST API > .env**.
[code] 
    1
    
    cp supabase/functions/upstash-redis-counter/.env.example supabase/functions/upstash-redis-counter/.env
[/code]

## Code#

Make sure you have the latest version of the [Supabase CLI installed](</docs/guides/local-development/cli/getting-started#installing-the-supabase-cli>).

Create a new function in your project:
[code] 
    1
    
    supabase functions new upstash-redis-counter
[/code]

And add the code to the `index.ts` file:
[code] 
    1
    
    import { Redis } from 'npm:@upstash/redis@^1'
    
    2
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    3
    
    4
    
    console.log(`Function "upstash-redis-counter" up and running!`)
    
    5
    
    6
    
    // Open endpoint for testing. In production, implement an authorization layer in the handler or switch the auth mode.
    
    7
    
    export default {
    
    8
    
      fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    
    9
    
        try {
    
    10
    
          const redis = new Redis({
    
    11
    
            url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
    
    12
    
            token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
    
    13
    
          })
    
    14
    
    15
    
          const deno_region = Deno.env.get('DENO_REGION')
    
    16
    
          if (deno_region) {
    
    17
    
            // Increment region counter
    
    18
    
            await redis.hincrby('supa-edge-counter', deno_region, 1)
    
    19
    
          } else {
    
    20
    
            // Increment localhost counter
    
    21
    
            await redis.hincrby('supa-edge-counter', 'localhost', 1)
    
    22
    
          }
    
    23
    
    24
    
          // Get all values
    
    25
    
          const counterHash: Record<string, number> | null = await redis.hgetall('supa-edge-counter')
    
    26
    
          const counters = Object.entries(counterHash!)
    
    27
    
            .sort(([, a], [, b]) => b - a) // sort desc
    
    28
    
            .reduce((r, [k, v]) => ({ total: r.total + v, regions: { ...r.regions, [k]: v } }), {
    
    29
    
              total: 0,
    
    30
    
              regions: {},
    
    31
    
            })
    
    32
    
    33
    
          return Response.json({ counters })
    
    34
    
        } catch (error) {
    
    35
    
          return Response.json({ error: error.message }, { status: 500 })
    
    36
    
        }
    
    37
    
      }),
    
    38
    
    }
[/code]

## Run locally#
[code] 
    1
    
    supabase start
    
    2
    
    supabase functions serve --no-verify-jwt --env-file supabase/functions/upstash-redis-counter/.env
[/code]

Navigate to <http://localhost:54321/functions/v1/upstash-redis-counter>[](<http://localhost:54321/functions/v1/upstash-redis-counter>).

## Deploy#
[code] 
    1
    
    supabase functions deploy upstash-redis-counter --no-verify-jwt
    
    2
    
    supabase secrets set --env-file supabase/functions/upstash-redis-counter/.env
[/code]