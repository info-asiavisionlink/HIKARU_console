---
タイトル: Testing your Edge Functions
URL: https://supabase.com/docs/guides/functions/unit-test
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge, edge-functions, functions, testing, unit-test, your
---

# Testing your Edge Functions

**URL:** https://supabase.com/docs/guides/functions/unit-test
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge, edge-functions, functions, testing, unit-test, your

## 目次

- [The example scenario#](#the-example-scenario)
- [Recommended project structure#](#recommended-project-structure)
- [Unit tests: Testing pure business logic#](#unit-tests-testing-pure-business-logic)
  - [The pricing module#](#the-pricing-module)
  - [Unit tests#](#unit-tests)
- [Integration tests: Testing the full Edge Function#](#integration-tests-testing-the-full-edge-function)
  - [The Edge Function#](#the-edge-function)
  - [Integration test setup#](#integration-test-setup)
  - [Full integration tests#](#full-integration-tests)
- [Advantages of mocking approach#](#advantages-of-mocking-approach)
- [Running all tests#](#running-all-tests)
- [Best practices#](#best-practices)
- [Resources#](#resources)

## 概要

Writing Unit Tests for Edge Functions using Deno Test

---

Testing is an essential step in the development process to ensure the correctness, reliability, and performance of your Edge Functions. Because Edge Functions often combine HTTP handling, authentication, database access, and business logic, a good testing strategy gives you fast feedback and high confidence before deploying to production.

In this guide you will learn how to write:

  * **Unit tests** for pure business logic such as pricing rules, calculations, etc.
  * **Integration tests** for the full Edge Function by mocking at the network layer


The examples and patterns shown here follow the same approaches used internally by Supabase's Edge Functions team.

Deno ships with a fast, native test runner and excellent mocking utilities in `@std/testing`. See the [official Deno testing documentation](<https://docs.deno.com/runtime/manual/basics/testing/>) for more background.

* * *

## The example scenario#

You can use a realistic Edge Function called `process-ticket` that calculates the final price of a ticket based on the authenticated user's age (loaded from the `profiles` table).

**Business rules:**

  * Children aged 8 and under → free (`0`)
  * Young people aged 9–17 → 20% discount
  * Adults aged 18 and over → full price


The function receives a JSON payload with a `price` field and returns `{ result: finalPrice }`.

This example demonstrates common real-world requirements:

  * Request validation
  * Authenticated database access via `withSupabase`
  * Business rule application
  * Proper error handling


* * *

## Recommended project structure#
[code] 
    1
    
    supabase/
    
    2
    
    ├── functions/
    
    3
    
    │   ├── _shared/
    
    4
    
    │   │   └── types.ts                 # Database types
    
    5
    
    │   ├── process-ticket/
    
    6
    
    │   │   ├── index.ts                 # Edge Function (uses withSupabase)
    
    7
    
    │   │   └── pricing.ts               # Pure business logic (co-located)
    
    8
    
    │   └── tests/
    
    9
    
    │       ├── utils/
    
    10
    
    │       │   └── supabase_env.ts      # Test helpers (env + JWT)
    
    11
    
    │       └── process-ticket/
    
    12
    
    │           ├── pricing.test.ts      # Unit tests for pricing
    
    13
    
    │           └── index.test.ts        # Integration tests with fetch mocking
    
    14
    
    ├── config.toml
    
    15
    
    └── deno.json
[/code]

In this reference implementation the pricing logic lives inside the function folder `process-ticket/pricing.ts`. You can also move it to `_shared/` if you want to reuse it across multiple functions.

See the [Development Environment](</docs/guides/functions/development-environment>) and [Managing dependencies](</docs/guides/functions/dependencies>) guides for recommended `deno.json` and editor setup.

* * *

## Unit tests: Testing pure business logic#

The pricing rules are pure functions with no side effects, so they are perfect candidates for fast, isolated unit tests.

### The pricing module#
[code] 
    1
    
    // supabase/functions/process-ticket/pricing.ts
    
    2
    
    export const AGE_TIERS = {
    
    3
    
      CHILDREN: 1, // free access
    
    4
    
      YOUNG: 0.2, // 20% off (ages 9-17)
    
    5
    
      ADULT: 0, // no discount
    
    6
    
    }
    
    7
    
    8
    
    export function getAgeDiscount(age: number) {
    
    9
    
      if (age <= 8) {
    
    10
    
        return AGE_TIERS.CHILDREN
    
    11
    
      }
    
    12
    
    13
    
      if (age > 8 && age < 18) {
    
    14
    
        return AGE_TIERS.YOUNG
    
    15
    
      }
    
    16
    
    17
    
      return AGE_TIERS.ADULT
    
    18
    
    }
    
    19
    
    20
    
    export function applyTicketDiscount(price: number, age: number) {
    
    21
    
      const discount = getAgeDiscount(age)
    
    22
    
      return price - price * discount
    
    23
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/unit-testing/process-ticket/pricing.ts>)

### Unit tests#

The reference implementation uses the BDD-style API from `@std/testing/bdd`:
[code] 
    1
    
    // supabase/functions/tests/process-ticket/pricing.test.ts
    
    2
    
    import { assertEquals } from 'jsr:@std/assert'
    
    3
    
    import { describe, it } from 'jsr:@std/testing/bdd'
    
    4
    
    5
    
    import { AGE_TIERS, applyTicketDiscount, getAgeDiscount } from '../../process-ticket/pricing.ts'
    
    6
    
    7
    
    describe('getAgeDiscount', () => {
    
    8
    
      it('should return valid discount for children', () => {
    
    9
    
        const ages = [0, 5, 8]
    
    10
    
        ages.forEach((age) => {
    
    11
    
          const discount = getAgeDiscount(age)
    
    12
    
          assertEquals(discount, AGE_TIERS.CHILDREN)
    
    13
    
        })
    
    14
    
      })
    
    15
    
    16
    
      it('should return valid discount for young people (9-17)', () => {
    
    17
    
        const ages = [9, 12, 17]
    
    18
    
        ages.forEach((age) => {
    
    19
    
          const discount = getAgeDiscount(age)
    
    20
    
          assertEquals(discount, AGE_TIERS.YOUNG)
    
    21
    
        })
    
    22
    
      })
    
    23
    
    24
    
      it('should return valid discount for adults', () => {
    
    25
    
        const ages = [18, 35, 80]
    
    26
    
        ages.forEach((age) => {
    
    27
    
          const discount = getAgeDiscount(age)
    
    28
    
          assertEquals(discount, AGE_TIERS.ADULT)
    
    29
    
        })
    
    30
    
      })
    
    31
    
    })
    
    32
    
    33
    
    describe('applyTicketDiscount', () => {
    
    34
    
      it('kids have free access', () => {
    
    35
    
        const price = applyTicketDiscount(10, 8)
    
    36
    
        assertEquals(price, 0)
    
    37
    
      })
    
    38
    
    39
    
      it('young people get 20% off', () => {
    
    40
    
        const ages = [9, 12, 17]
    
    41
    
        ages.forEach((age) => {
    
    42
    
          const price = applyTicketDiscount(10, age)
    
    43
    
          assertEquals(price, 8) // 10 - 20% = 8
    
    44
    
        })
    
    45
    
      })
    
    46
    
    47
    
      it('adults pay full price', () => {
    
    48
    
        const ages = [18, 35, 80]
    
    49
    
        ages.forEach((age) => {
    
    50
    
          const price = applyTicketDiscount(10, age)
    
    51
    
          assertEquals(price, 10)
    
    52
    
        })
    
    53
    
      })
    
    54
    
    })
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/unit-testing/tests/process-ticket/pricing.test.ts>)

Run the unit tests:
[code] 
    1
    
    deno test supabase/functions/tests/process-ticket/pricing.test.ts
[/code]

These tests run in milliseconds and give you immediate safety when changing discount rules.

* * *

## Integration tests: Testing the full Edge Function#

The reference implementation uses a pattern: **mocking`globalThis.fetch`** to intercept the Supabase REST calls made by the Edge Function. This approach requires **zero changes** to your production code for testability.

### The Edge Function#
[code] 
    1
    
    // supabase/functions/process-ticket/index.ts
    
    2
    
    import '@supabase/functions-js/edge-runtime.d.ts'
    
    3
    
    4
    
    import { withSupabase } from '@supabase/server'
    
    5
    
    6
    
    import { Database } from '../_shared/types.ts'
    
    7
    
    import { applyTicketDiscount } from './pricing.ts'
    
    8
    
    9
    
    console.log('Hello from Functions!')
    
    10
    
    11
    
    export type Payload = {
    
    12
    
      price: number
    
    13
    
    }
    
    14
    
    15
    
    export default {
    
    16
    
      fetch: withSupabase<Database>({ auth: ['user'] }, async (req, ctx) => {
    
    17
    
        const { price } = (await req.json()) as Payload
    
    18
    
        if (!price) {
    
    19
    
          return Response.json({ error: 'missing price field' }, { status: 400 })
    
    20
    
        }
    
    21
    
    22
    
        const { data, error: getAgeError } = await ctx.supabase
    
    23
    
          .from('profiles')
    
    24
    
          .select('age')
    
    25
    
          .limit(1)
    
    26
    
          .single()
    
    27
    
    28
    
        if (getAgeError || !Number.isInteger(data.age)) {
    
    29
    
          return Response.json({ error: 'could not process' }, { status: 500 })
    
    30
    
        }
    
    31
    
    32
    
        const result = applyTicketDiscount(price, data.age)
    
    33
    
    34
    
        return Response.json({ result })
    
    35
    
      }),
    
    36
    
    } satisfies Deno.ServeDefaultExport
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/unit-testing/process-ticket/index.ts>)

Key points:

  * Uses the high-level `withSupabase` helper from [`@supabase/server`](<https://github.com/supabase/server>)
  * Automatically provides an authenticated `ctx.supabase` client
  * Business logic is delegated to the co-located `pricing.ts`


### Integration test setup#

This helper sets up a mock Supabase environment and generates valid RS256 JWTs for authenticated requests:
[code] 
    1
    
    // supabase/functions/tests/utils/supabase_env.ts
    
    2
    
    import { exportJWK, generateKeyPair, GenerateKeyPairResult, SignJWT } from 'jsr:@panva/jose@6'
    
    3
    
    4
    
    const jwk: GenerateKeyPairResult = await generateKeyPair('RS256')
    
    5
    
    const publicJwk = await exportJWK(jwk.publicKey)
    
    6
    
    publicJwk.alg = 'RS256'
    
    7
    
    publicJwk.use = 'sig'
    
    8
    
    9
    
    export const env = {
    
    10
    
      url: 'http://mocksupabase',
    
    11
    
      publishableKeys: { default: 'sb_publishable_xy' },
    
    12
    
      secretKeys: { default: 'sb_secret_xy' },
    
    13
    
      jwks: {
    
    14
    
        keys: [publicJwk],
    
    15
    
      },
    
    16
    
    }
    
    17
    
    18
    
    export function exportEnv() {
    
    19
    
      Deno.env.set('SUPABASE_URL', env.url)
    
    20
    
      Deno.env.set('SUPABASE_PUBLISHABLE_KEYS', JSON.stringify(env.publishableKeys))
    
    21
    
      Deno.env.set('SUPABASE_SECRET_KEYS', JSON.stringify(env.secretKeys))
    
    22
    
      Deno.env.set('SUPABASE_JWKS', JSON.stringify(env.jwks))
    
    23
    
    }
    
    24
    
    25
    
    export async function generateUserToken() {
    
    26
    
      const token = await new SignJWT({
    
    27
    
        sub: 'user-123',
    
    28
    
        role: 'authenticated',
    
    29
    
        email: 'test@example.com',
    
    30
    
      })
    
    31
    
        .setProtectedHeader({ alg: 'RS256' })
    
    32
    
        .setIssuedAt()
    
    33
    
        .setExpirationTime('1h')
    
    34
    
        .sign(jwk.privateKey)
    
    35
    
    36
    
      return token
    
    37
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/unit-testing/tests/utils/supabase_env.ts>)

### Full integration tests#
[code] 
    1
    
    // supabase/functions/tests/process-ticket/index.test.ts
    
    2
    
    import { assertEquals } from 'jsr:@std/assert'
    
    3
    
    import { afterEach, beforeEach, describe, it } from 'jsr:@std/testing/bdd'
    
    4
    
    import { assertSpyCalls, spy } from 'jsr:@std/testing/mock'
    
    5
    
    6
    
    import EdgeFunction from '../../process-ticket/index.ts'
    
    7
    
    import { env, exportEnv, generateUserToken } from '../utils/supabase_env.ts'
    
    8
    
    9
    
    const FUNCTION_URL = `${env.url}/functions/v1/process-ticket`
    
    10
    
    11
    
    function mockTableRequest(restQuery: string, result: object, status = 200) {
    
    12
    
      return spy(async (input: RequestInfo | URL): Promise<Response> => {
    
    13
    
        const url = input.toString()
    
    14
    
        if (url === `${env.url}/rest/v1/${restQuery}`) {
    
    15
    
          const res = Response.json(result, { status })
    
    16
    
          return await Promise.resolve(res)
    
    17
    
        }
    
    18
    
        return await Promise.resolve(new Response(null, { status: 404 }))
    
    19
    
      })
    
    20
    
    }
    
    21
    
    22
    
    describe('requests for /process-ticket endpoint', () => {
    
    23
    
      const originalFetch = globalThis.fetch
    
    24
    
      const originalEnv = Deno.env
    
    25
    
      const mockEnv = new Map<string, string>()
    
    26
    
    27
    
      beforeEach(() => {
    
    28
    
        // @ts-ignore
    
    29
    
        Deno.env = {
    
    30
    
          has: (key) => mockEnv.has(key),
    
    31
    
          get: (key) => mockEnv.get(key),
    
    32
    
          set: (key, value) => mockEnv.set(key, value),
    
    33
    
          delete: (key) => mockEnv.delete(key),
    
    34
    
          toObject: () => Object.fromEntries(mockEnv),
    
    35
    
        } satisfies Deno.Env
    
    36
    
    37
    
        mockEnv.clear()
    
    38
    
        exportEnv()
    
    39
    
      })
    
    40
    
    41
    
      afterEach(() => {
    
    42
    
        // @ts-ignore
    
    43
    
        Deno.env = originalEnv
    
    44
    
        globalThis.fetch = originalFetch
    
    45
    
      })
    
    46
    
    47
    
      it('should return the correct price based on user age', async () => {
    
    48
    
        const expects = [
    
    49
    
          { age: 8, result: 0 }, // Free
    
    50
    
          { age: 15, result: 8 }, // 20% off
    
    51
    
          { age: 18, result: 10 }, // No discount
    
    52
    
        ]
    
    53
    
    54
    
        for (const { age, result } of expects) {
    
    55
    
          const token = await generateUserToken()
    
    56
    
    57
    
          const req = new Request(FUNCTION_URL, {
    
    58
    
            method: 'POST',
    
    59
    
            headers: {
    
    60
    
              apikey: env.publishableKeys.default,
    
    61
    
              Authorization: `Bearer ${token}`,
    
    62
    
            },
    
    63
    
            body: JSON.stringify({ price: 10 }),
    
    64
    
          })
    
    65
    
    66
    
          const mockProfiles = mockTableRequest('profiles?select=age&limit=1', { age })
    
    67
    
          globalThis.fetch = mockProfiles
    
    68
    
    69
    
          const res = await EdgeFunction.fetch(req)
    
    70
    
    71
    
          assertEquals(res.status, 200)
    
    72
    
          assertEquals(await res.json(), { result })
    
    73
    
          assertSpyCalls(mockProfiles, 1)
    
    74
    
        }
    
    75
    
      })
    
    76
    
    77
    
      it('should return 400 when price is missing', async () => {
    
    78
    
        const token = await generateUserToken()
    
    79
    
        const req = new Request(FUNCTION_URL, {
    
    80
    
          method: 'POST',
    
    81
    
          headers: {
    
    82
    
            apikey: env.publishableKeys.default,
    
    83
    
            Authorization: `Bearer ${token}`,
    
    84
    
          },
    
    85
    
          body: JSON.stringify({}),
    
    86
    
        })
    
    87
    
    88
    
        const res = await EdgeFunction.fetch(req)
    
    89
    
        assertEquals(res.status, 400)
    
    90
    
        assertEquals(await res.json(), { error: 'missing price field' })
    
    91
    
      })
    
    92
    
    93
    
      it('should return 500 when age is missing or invalid', async () => {
    
    94
    
        const token = await generateUserToken()
    
    95
    
        const req = new Request(FUNCTION_URL, {
    
    96
    
          method: 'POST',
    
    97
    
          headers: {
    
    98
    
            apikey: env.publishableKeys.default,
    
    99
    
            Authorization: `Bearer ${token}`,
    
    100
    
          },
    
    101
    
          body: JSON.stringify({ price: 15 }),
    
    102
    
        })
    
    103
    
    104
    
        const mockProfiles = mockTableRequest('profiles?select=age&limit=1', {})
    
    105
    
        globalThis.fetch = mockProfiles
    
    106
    
    107
    
        const res = await EdgeFunction.fetch(req)
    
    108
    
        assertEquals(res.status, 500)
    
    109
    
        assertEquals(await res.json(), { error: 'could not process' })
    
    110
    
      })
    
    111
    
    112
    
      it('should handle database errors gracefully', async () => {
    
    113
    
        const token = await generateUserToken()
    
    114
    
        const req = new Request(FUNCTION_URL, {
    
    115
    
          method: 'POST',
    
    116
    
          headers: {
    
    117
    
            apikey: env.publishableKeys.default,
    
    118
    
            Authorization: `Bearer ${token}`,
    
    119
    
          },
    
    120
    
          body: JSON.stringify({ price: 15 }),
    
    121
    
        })
    
    122
    
    123
    
        const mockProfiles = mockTableRequest(
    
    124
    
          'profiles?select=age&limit=1',
    
    125
    
          { code: 'PGRST303', message: 'JWT expired' },
    
    126
    
          401
    
    127
    
        )
    
    128
    
        globalThis.fetch = mockProfiles
    
    129
    
    130
    
        const res = await EdgeFunction.fetch(req)
    
    131
    
        assertEquals(res.status, 500)
    
    132
    
        assertEquals(await res.json(), { error: 'could not process' })
    
    133
    
      })
    
    134
    
    })
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/unit-testing/tests/process-ticket/index.test.ts>)

Run the integration tests:
[code] 
    1
    
    deno test supabase/functions/tests/process-ticket/index.test.ts --allow-env
[/code]

* * *

## Advantages of mocking approach#

This guide uses `fetch()` mock to demonstrate the following benefits:

  * Test the **real** Edge Function code path — no dependency injection needed in production code
  * Simulate database responses, auth failures, network errors
  * Keep your production Edge Function clean and focused
  * Still get fast, deterministic tests that don't require a running Supabase instance


This pattern fits great in higher-level helpers that you can control inner code, like `withSupabase`.

* * *

## Running all tests#

Add to your `deno.json`:
[code] 
    1
    
    {
    
    2
    
    3
    
      // ...
    
    4
    
    5
    
      "tasks": {
    
    6
    
        "test": "deno test supabase/functions/tests/ --allow-env"
    
    7
    
      }
    
    8
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/unit-testing/deno.json>)

Then:
[code] 
    1
    
    deno task test
[/code]

* * *

## Best practices#

  * Keep pure business logic in separate modules (even if co-located with the function)
  * Use `withSupabase` \+ typed `Database` for clean, authenticated access
  * Prefer mocking at the `fetch` boundary for integration tests when you don't want to modify production code
  * Use `@std/testing/bdd` \+ `@std/testing/mock` for expressive, maintainable tests
  * Generate realistic JWTs in tests when your function relies on authenticated Supabase clients
  * Test both happy paths and error conditions (missing input, DB failures, invalid data)


* * *

## Resources#

  * Read the [Deno testing guide](<https://docs.deno.com/runtime/manual/basics/testing/>)
  * Learn more about [`withSupabase` and `@supabase/server`](</blog/introducing-supabase-server>)
  * See the other Edge Functions guides: [Development Environment](</docs/guides/functions/development-environment>), [Managing dependencies](</docs/guides/functions/dependencies>), [Deploy to Production](</docs/guides/functions/deploy>)