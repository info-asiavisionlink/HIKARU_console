---
タイトル: Recursive / Nested Function Calls
URL: https://supabase.com/docs/guides/functions/recursive-functions
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: calls, edge-functions, function, functions, nested, recursive, recursive-functions
---

# Recursive / Nested Function Calls

**URL:** https://supabase.com/docs/guides/functions/recursive-functions
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** calls, edge-functions, function, functions, nested, recursive, recursive-functions

## 目次

- [What gets rate limited#](#what-gets-rate-limited)
- [Rate limit budget#](#rate-limit-budget)
- [Handling rate limit errors#](#handling-rate-limit-errors)
- [Tips for avoiding rate limits#](#tips-for-avoiding-rate-limits)
  - [1. Batch operations instead of individual calls#](#1-batch-operations-instead-of-individual-calls)
  - [2. Limit recursion depth#](#2-limit-recursion-depth)
  - [3. Use queues for large workloads#](#3-use-queues-for-large-workloads)
  - [4. Use shared libraries instead of separate functions#](#4-use-shared-libraries-instead-of-separate-functions)
  - [5. Add delays for non-urgent processing#](#5-add-delays-for-non-urgent-processing)
- [Common patterns and their impact#](#common-patterns-and-their-impact)
- [Increasing rate limits#](#increasing-rate-limits)

## 概要

Learn about rate limiting for Edge Functions that call other Edge Functions

---

Edge Functions can call other Edge Functions using `fetch()`. This enables powerful patterns like function chaining, fan-out/fan-in workflows, and recursive processing. To protect platform stability and prevent runaway amplification, Supabase rate limits these internal function-to-function calls.

## What gets rate limited#

Rate limiting applies to **outbound`fetch()` calls** made by your Edge Functions to other Edge Functions within your project. This includes:

  * **Direct recursion** : A function calling itself
  * **Function chaining** : Function A calling Function B
  * **Circular calls** : Function A calling Function B, which calls Function A
  * **Fan-out patterns** : A function calling multiple other functions concurrently


Inbound requests to your Edge Functions and requests to external APIs (e.g., Stripe, OpenAI) are **not** subject to this rate limit. Only outbound calls from one Edge Function to another Edge Function are counted.

## Rate limit budget#

Each request chain has a budget of at least **5,000 requests per minute**. In busier regions, this budget may be higher. All function-to-function calls within the same request chain share this budget.

For example, if Function A calls Function B, and Function B calls Function C, all three calls count toward the same budget pool.

## Handling rate limit errors#

When the rate limit is exceeded, calling another Edge Function throws a `RateLimitError`. This error includes a `retryAfterMs` property indicating how long to wait (in milliseconds) before retrying. You should catch this error and handle it gracefully:

supabase-jsfetch
[code]
    1
    
    import { createClient } from 'jsr:@supabase/supabase-js@2'
    
    2
    
    3
    
    const SUPABASE_PUBLISHABLE_KEYS = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)
    
    4
    
    5
    
    const supabase = createClient(
    
    6
    
      Deno.env.get('SUPABASE_URL')!,
    
    7
    
      // If you want to use a different api key, change 'default' to your preferred key name
    
    8
    
      SUPABASE_PUBLISHABLE_KEYS['default']
    
    9
    
    )
    
    10
    
    11
    
    Deno.serve(async (req) => {
    
    12
    
      try {
    
    13
    
        const { data, error } = await supabase.functions.invoke('other-function', {
    
    14
    
          body: { foo: 'bar' },
    
    15
    
        })
    
    16
    
    17
    
        if (error) throw error
    
    18
    
    19
    
        return new Response(JSON.stringify(data), {
    
    20
    
          headers: { 'Content-Type': 'application/json' },
    
    21
    
        })
    
    22
    
      } catch (err) {
    
    23
    
        if (err instanceof Deno.errors.RateLimitError) {
    
    24
    
          // Use retryAfterMs to tell the client when to retry
    
    25
    
          const retryAfterSeconds = Math.ceil(err.retryAfterMs / 1000)
    
    26
    
          return new Response(
    
    27
    
            JSON.stringify({ error: 'Service temporarily unavailable. Please retry later.' }),
    
    28
    
            {
    
    29
    
              status: 429,
    
    30
    
              headers: {
    
    31
    
                'Content-Type': 'application/json',
    
    32
    
                'Retry-After': retryAfterSeconds.toString(),
    
    33
    
              },
    
    34
    
            }
    
    35
    
          )
    
    36
    
        }
    
    37
    
        throw err
    
    38
    
      }
    
    39
    
    })
[/code]

You can also use `retryAfterMs` to implement automatic retries within your function:

supabase-jsfetch
[code]
    1
    
    import { createClient } from 'jsr:@supabase/supabase-js@2'
    
    2
    
    3
    
    const SUPABASE_PUBLISHABLE_KEYS = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')!)
    
    4
    
    5
    
    const supabase = createClient(
    
    6
    
      Deno.env.get('SUPABASE_URL')!,
    
    7
    
      // If you want to use a different api key, change 'default' to your preferred key name
    
    8
    
      SUPABASE_PUBLISHABLE_KEYS['default']
    
    9
    
    )
    
    10
    
    11
    
    async function invokeWithRetry(functionName: string, payload: object, maxRetries = 3) {
    
    12
    
      for (let attempt = 0; attempt < maxRetries; attempt++) {
    
    13
    
        try {
    
    14
    
          const { data, error } = await supabase.functions.invoke(functionName, {
    
    15
    
            body: payload,
    
    16
    
          })
    
    17
    
          if (error) throw error
    
    18
    
          return data
    
    19
    
        } catch (err) {
    
    20
    
          if (err instanceof Deno.errors.RateLimitError && attempt < maxRetries - 1) {
    
    21
    
            // Wait for the recommended duration before retrying
    
    22
    
            await new Promise((resolve) => setTimeout(resolve, err.retryAfterMs))
    
    23
    
            continue
    
    24
    
          }
    
    25
    
          throw err
    
    26
    
        }
    
    27
    
      }
    
    28
    
    }
[/code]

## Tips for avoiding rate limits#

### 1\. Batch operations instead of individual calls#

Instead of calling a function once per item, batch multiple items into a single call:
[code] 
    1
    
    // ❌ Avoid: One call per item
    
    2
    
    for (const item of items) {
    
    3
    
      await supabase.functions.invoke('process-item', { body: item })
    
    4
    
    }
    
    5
    
    6
    
    // ✅ Better: Batch items into one call
    
    7
    
    await supabase.functions.invoke('process-items', { body: { items } })
[/code]

### 2\. Limit recursion depth#

If your function is recursive, set a maximum depth to prevent unbounded call chains:
[code] 
    1
    
    Deno.serve(async (req) => {
    
    2
    
      const { depth = 0, data } = await req.json()
    
    3
    
    4
    
      if (depth >= 5) {
    
    5
    
        // Stop recursion at max depth
    
    6
    
        return new Response(JSON.stringify({ result: data }))
    
    7
    
      }
    
    8
    
    9
    
      // Process and recurse with incremented depth
    
    10
    
      const processed = processData(data)
    
    11
    
      const { data: result } = await supabase.functions.invoke('my-function', {
    
    12
    
        body: { depth: depth + 1, data: processed },
    
    13
    
      })
    
    14
    
    15
    
      return new Response(JSON.stringify(result))
    
    16
    
    })
[/code]

### 3\. Use queues for large workloads#

For processing large datasets, consider using [Supabase Queues](</docs/guides/queues>) instead of recursive function calls. Queues handle backpressure automatically and are better suited for high-volume workloads.

### 4\. Use shared libraries instead of separate functions#

Instead of creating separate Edge Functions that call each other, create a shared library of functions and import them directly. This avoids HTTP overhead and rate limits entirely:
[code] 
    1
    
    // supabase/functions/_shared/transform.ts
    
    2
    
    export function validate(data: any) {
    
    3
    
      // validation logic
    
    4
    
    }
    
    5
    
    6
    
    export function transform(data: any) {
    
    7
    
      // transformation logic
    
    8
    
    }
    
    9
    
    10
    
    export async function save(data: any) {
    
    11
    
      // save logic
    
    12
    
    }
[/code]
[code] 
    1
    
    // supabase/functions/process-data/index.ts
    
    2
    
    import { save, transform, validate } from '../_shared/transform.ts'
    
    3
    
    4
    
    Deno.serve(async (req) => {
    
    5
    
      const data = await req.json()
    
    6
    
      const validated = validate(data)
    
    7
    
      const transformed = transform(validated)
    
    8
    
      const result = await save(transformed)
    
    9
    
      return new Response(JSON.stringify(result))
    
    10
    
    })
[/code]

### 5\. Add delays for non-urgent processing#

If immediate processing isn't required, add delays between calls to spread the load:
[code] 
    1
    
    async function processWithDelay(items: any[]) {
    
    2
    
      for (const item of items) {
    
    3
    
        await supabase.functions.invoke('process-item', { body: item })
    
    4
    
        await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms delay
    
    5
    
      }
    
    6
    
    }
[/code]

## Common patterns and their impact#

Pattern| Budget consumption| Recommendation  
---|---|---  
Basic chain (A to B to C)| Low| Generally safe  
Fan-out (A to B, C, D, E)| Moderate| Limit concurrency  
Deep recursion (A to A to A...)| High| Set max depth  
Unbounded loops| Very high| Avoid, use queues  
  
## Increasing rate limits#

Currently, all plans have the same rate limit budget. We are working on introducing custom limits for different use cases.

If you need a higher rate limit for your project, [contact support](</dashboard/support/new>) with details about your use case.