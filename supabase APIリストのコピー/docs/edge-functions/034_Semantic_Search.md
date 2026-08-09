---
タイトル: Semantic Search
URL: https://supabase.com/docs/guides/functions/examples/semantic-search
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, examples, functions, search, semantic, semantic-search
---

# Semantic Search

**URL:** https://supabase.com/docs/guides/functions/examples/semantic-search
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, examples, functions, search, semantic, semantic-search

## 目次

- [Create the database table and webhook#](#create-the-database-table-and-webhook)
- [Create a Database Function and RPC#](#create-a-database-function-and-rpc)
- [Query vectors in Supabase Edge Functions#](#query-vectors-in-supabase-edge-functions)

## 概要

Semantic Search with pgvector and Supabase Edge Functions

---

[Semantic search](</docs/guides/ai/semantic-search>) interprets the meaning behind user queries rather than exact [keywords](</docs/guides/ai/keyword-search>). It uses machine learning to capture the intent and context behind the query, handling language nuances like synonyms, phrasing variations, and word relationships.

Since Supabase Edge Runtime [v1.36.0](<https://github.com/supabase/edge-runtime/releases/tag/v1.36.0>) you can run the [`gte-small` model](<https://huggingface.co/Supabase/gte-small>) natively within Supabase Edge Functions without any external dependencies! This allows you to generate text embeddings without calling any external APIs!

In this tutorial you're implementing three parts:

  1. A [`generate-embedding`](<https://github.com/supabase/supabase/tree/master/examples/ai/edge-functions/supabase/functions/generate-embedding/index.ts>) database webhook edge function which generates embeddings when a content row is added (or updated) in the [`public.embeddings`](<https://github.com/supabase/supabase/tree/master/examples/ai/edge-functions/supabase/migrations/20240408072601_embeddings.sql>) table.
  2. A [`query_embeddings` Postgres function](<https://github.com/supabase/supabase/tree/master/examples/ai/edge-functions/supabase/migrations/20240410031515_vector-search.sql>) which allows us to perform similarity search from an Edge Function via [Remote Procedure Call (RPC)](</docs/guides/database/functions?language=js>).
  3. A [`search` edge function](<https://github.com/supabase/supabase/tree/master/examples/ai/edge-functions/supabase/functions/search/index.ts>) which generates the embedding for the search term, performs the similarity search via RPC function call, and returns the result.


You can find the complete example code on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/ai/edge-functions>)

## Create the database table and webhook#

Given the [following table definition](<https://github.com/supabase/supabase/blob/master/examples/ai/edge-functions/supabase/migrations/20240408072601_embeddings.sql>):
[code] 
    1
    
    create extension if not exists vector with schema extensions;
    
    2
    
    3
    
    create table embeddings (
    
    4
    
      id bigint primary key generated always as identity,
    
    5
    
      content text not null,
    
    6
    
      embedding extensions.vector (384)
    
    7
    
    );
    
    8
    
    alter table embeddings enable row level security;
    
    9
    
    10
    
    create index on embeddings using hnsw (embedding vector_ip_ops);
[/code]

You can deploy the [following edge function](<https://github.com/supabase/supabase/blob/master/examples/ai/edge-functions/supabase/functions/generate-embedding/index.ts>) as a [database webhook](</docs/guides/database/webhooks>) to generate the embeddings for any text content inserted into the table:
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    const model = new Supabase.ai.Session('gte-small')
    
    4
    
    5
    
    // Triggered by a Database Webhook, which authenticates with a secret key.
    
    6
    
    // Deploy with `verify_jwt = false`.
    
    7
    
    export default {
    
    8
    
      fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    
    9
    
        const payload: WebhookPayload = await req.json()
    
    10
    
        const { content, id } = payload.record
    
    11
    
    12
    
        // Generate embedding.
    
    13
    
        const embedding = await model.run(content, {
    
    14
    
          mean_pool: true,
    
    15
    
          normalize: true,
    
    16
    
        })
    
    17
    
    18
    
        // Store in database.
    
    19
    
        const { error } = await ctx.supabaseAdmin
    
    20
    
          .from('embeddings')
    
    21
    
          .update({ embedding: JSON.stringify(embedding) })
    
    22
    
          .eq('id', id)
    
    23
    
        if (error) console.warn(error.message)
    
    24
    
    25
    
        return Response.json({ ok: true })
    
    26
    
      }),
    
    27
    
    }
[/code]

## Create a Database Function and RPC#

With the embeddings now stored in your Postgres database table, you can query them from Supabase Edge Functions by using [Remote Procedure Calls (RPC)](</docs/guides/database/functions?language=js>).

Given the [following Postgres Function](<https://github.com/supabase/supabase/blob/master/examples/ai/edge-functions/supabase/migrations/20240410031515_vector-search.sql>):
[code] 
    1
    
    -- Matches document sections using vector similarity search on embeddings
    
    2
    
    --
    
    3
    
    -- Returns a setof embeddings so that we can use PostgREST resource embeddings (joins with other tables)
    
    4
    
    -- Additional filtering like limits can be chained to this function call
    
    5
    
    create or replace function query_embeddings(embedding extensions.vector(384), match_threshold float)
    
    6
    
    returns setof embeddings
    
    7
    
    language plpgsql
    
    8
    
    as $$
    
    9
    
    begin
    
    10
    
      return query
    
    11
    
      select *
    
    12
    
      from embeddings
    
    13
    
    14
    
      -- The inner product is negative, so we negate match_threshold
    
    15
    
      where embeddings.embedding <#> embedding < -match_threshold
    
    16
    
    17
    
      -- Our embeddings are normalized to length 1, so cosine similarity
    
    18
    
      -- and inner product will produce the same query results.
    
    19
    
      -- Using inner product which can be computed faster.
    
    20
    
      --
    
    21
    
      -- For the different distance functions, see https://github.com/pgvector/pgvector
    
    22
    
      order by embeddings.embedding <#> embedding;
    
    23
    
    end;
    
    24
    
    $$;
[/code]

## Query vectors in Supabase Edge Functions#

You can use `supabase-js` to first generate the embedding for the search term and then invoke the Postgres function to find the relevant results from your stored embeddings, right from your [Supabase Edge Function](<https://github.com/supabase/supabase/blob/master/examples/ai/edge-functions/supabase/functions/search/index.ts>):
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    const model = new Supabase.ai.Session('gte-small')
    
    4
    
    5
    
    export default {
    
    6
    
      fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    
    7
    
        const { search } = await req.json()
    
    8
    
        if (!search) return Response.json({ error: 'Please provide a search param!' }, { status: 400 })
    
    9
    
        // Generate embedding for search term.
    
    10
    
        const embedding = await model.run(search, {
    
    11
    
          mean_pool: true,
    
    12
    
          normalize: true,
    
    13
    
        })
    
    14
    
    15
    
        // Query embeddings.
    
    16
    
        const { data: result, error } = await ctx.supabase
    
    17
    
          .rpc('query_embeddings', {
    
    18
    
            embedding,
    
    19
    
            match_threshold: 0.8,
    
    20
    
          })
    
    21
    
          .select('content')
    
    22
    
          .limit(3)
    
    23
    
        if (error) {
    
    24
    
          return Response.json({ error: error.message }, { status: 500 })
    
    25
    
        }
    
    26
    
    27
    
        return Response.json({ search, result })
    
    28
    
      }),
    
    29
    
    }
[/code]

You now have AI powered semantic search set up without any external dependencies! All you need: you, pgvector, and Supabase Edge Functions!