---
タイトル: Integrating With Supabase Auth
URL: https://supabase.com/docs/guides/functions/auth-legacy-jwt
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: auth, auth-legacy-jwt, edge-functions, functions, integrating, supabase, with
---

# Integrating With Supabase Auth

**URL:** https://supabase.com/docs/guides/functions/auth-legacy-jwt
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** auth, auth-legacy-jwt, edge-functions, functions, integrating, supabase, with

## 目次

- [Setting up auth context#](#setting-up-auth-context)
- [Fetching the user#](#fetching-the-user)
- [Row Level Security#](#row-level-security)
- [Example#](#example)

## 概要

Supabase Edge Functions and Auth.

---

Edge Functions work with [Supabase Auth](</docs/guides/auth>).

This allows you to:

  * Automatically identify users through Legacy JWT tokens
  * Enforce Row Level Security policies
  * Integrate with your existing auth flow


## Setting up auth context#

When a user makes a request to an Edge Function, you can use the `Authorization` header to set the Auth context in the Supabase client and enforce Row Level Security policies.
[code] 
    1
    
    import { createClient } from 'npm:@supabase/supabase-js@2'
    
    2
    
    3
    
    Deno.serve(async (req: Request) => {
    
    4
    
      const supabaseClient = createClient(
    
    5
    
        Deno.env.get('SUPABASE_URL') ?? '',
    
    6
    
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    
    7
    
        // Create client with Auth context of the user that called the function.
    
    8
    
        // This way your row-level-security (RLS) policies are applied.
    
    9
    
        {
    
    10
    
          global: {
    
    11
    
            headers: { Authorization: req.headers.get('Authorization')! },
    
    12
    
          },
    
    13
    
        }
    
    14
    
      );
    
    15
    
    16
    
      //...
    
    17
    
    })
[/code]

This context setting happens in the `Deno.serve()` callback argument, so that the `Authorization` header is set for each individual request scope.

* * *

## Fetching the user#

By getting the JWT from the `Authorization` header, you can provide the token to `getUser()` to fetch the user object to obtain metadata for the logged in user.
[code] 
    1
    
    Deno.serve(async (req: Request) => {
    
    2
    
      // ...
    
    3
    
      const authHeader = req.headers.get('Authorization')!
    
    4
    
      const token = authHeader.replace('Bearer ', '')
    
    5
    
      const { data } = await supabaseClient.auth.getUser(token)
    
    6
    
      // ...
    
    7
    
    })
[/code]

* * *

## Row Level Security#

After initializing a Supabase client with the Auth context, all queries will be executed with the context of the user. For database queries, this means [Row Level Security](</docs/guides/database/postgres/row-level-security>) will be enforced.
[code] 
    1
    
    import { createClient } from 'npm:@supabase/supabase-js@2'
    
    2
    
    3
    
    Deno.serve(async (req: Request) => {
    
    4
    
      // ...
    
    5
    
      // This query respects RLS - users only see rows they have access to
    
    6
    
      const { data, error } = await supabaseClient.from('profiles').select('*');
    
    7
    
    8
    
      if (error) {
    
    9
    
        return new Response('Database error', { status: 500 })
    
    10
    
      }
    
    11
    
    12
    
      // ...
    
    13
    
    })
[/code]

* * *

## Example#

See the full [example on GitHub](<https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/select-from-table-with-auth-rls/index.ts>).
[code] 
    1
    
    // Follow this setup guide to integrate the Deno language server with your editor:
    
    2
    
    // https://deno.land/manual/getting_started/setup_your_environment
    
    3
    
    // This enables autocomplete, go to definition, etc.
    
    4
    
    5
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    6
    
    7
    
    console.log(`Function "select-from-table-with-auth-rls" up and running!`)
    
    8
    
    9
    
    export default {
    
    10
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    11
    
        try {
    
    12
    
          // ctx.supabase runs queries as the authenticated user, so RLS applies.
    
    13
    
          // ctx.userClaims holds the verified user identity.
    
    14
    
          const { data, error } = await ctx.supabase.from('users').select('*')
    
    15
    
          if (error) throw error
    
    16
    
    17
    
          return Response.json({ user: ctx.userClaims, data })
    
    18
    
        } catch (error) {
    
    19
    
          return Response.json({ error: error.message }, { status: 400 })
    
    20
    
        }
    
    21
    
      }),
    
    22
    
    }
    
    23
    
    24
    
    // To invoke (auth: 'user' requires a signed-in user's access token):
    
    25
    
    // curl -i --location --request POST 'http://localhost:54321/functions/v1/select-from-table-with-auth-rls' \
    
    26
    
    //   --header 'Authorization: Bearer <USER_ACCESS_TOKEN>' \
    
    27
    
    //   --header 'Content-Type: application/json' \
    
    28
    
    //   --data '{"name":"Functions"}'
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/select-from-table-with-auth-rls/index.ts>)