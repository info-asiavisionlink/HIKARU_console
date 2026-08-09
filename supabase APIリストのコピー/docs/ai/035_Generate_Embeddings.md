---
タイトル: Generate Embeddings
URL: https://supabase.com/docs/guides/ai/quickstarts/generate-text-embeddings
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, embedding, embeddings, generate, generate-text-embeddings, quickstarts
---

# Generate Embeddings

**URL:** https://supabase.com/docs/guides/ai/quickstarts/generate-text-embeddings
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, embedding, embeddings, generate, generate-text-embeddings, quickstarts

## 目次

- [Build the Edge Function#](#build-the-edge-function)
- [Next steps#](#next-steps)

## 概要

Generate text embeddings using Edge Functions.

---

This guide will walk you through how to generate high quality text embeddings in [Edge Functions](</docs/guides/functions>) using its built-in AI inference API, so no external API is required.

## Build the Edge Function#

Build an Edge Function that accepts an input string and generates an embedding for it. Edge Functions are server-side TypeScript HTTP endpoints that run on-demand closest to your users.

1

Set up Supabase locally

Make sure you have the latest version of the [Supabase CLI installed](</docs/guides/local-development/cli/getting-started>).

Initialize Supabase in the root directory of your app and start your local stack.
[code]
    1
    
    supabase init
    
    2
    
    supabase start
[/code]

2

Create Edge Function

Create an Edge Function that we will use to generate embeddings. We'll call this `embed` (you can name this anything you like).

This will create a new TypeScript file called `index.ts` under `./supabase/functions/embed`.
[code]
    1
    
    supabase functions new embed
[/code]

3

Setup Inference Session

Create a new inference session to use for the lifetime of this function. Multiple requests can use the same inference session.

Currently, only the `gte-small` (<https://huggingface.co/Supabase/gte-small>[](<https://huggingface.co/Supabase/gte-small>)) text embedding model is supported in Supabase's Edge Runtime.
[code]
    1
    
    const session = new Supabase.ai.Session('gte-small');
[/code]

4

Implement request handler

Modify our request handler to accept an `input` string from the POST request JSON body.

Then generate the embedding by calling `session.run(input)`.
[code]
    1
    
    Deno.serve(async (req) => {
    
    2
    
      // Extract input string from JSON body
    
    3
    
      const { input } = await req.json();
    
    4
    
    5
    
      // Generate the embedding from the user input
    
    6
    
      const embedding = await session.run(input, {
    
    7
    
        mean_pool: true,
    
    8
    
        normalize: true,
    
    9
    
      });
    
    10
    
    11
    
      // Return the embedding
    
    12
    
      return new Response(
    
    13
    
        JSON.stringify({ embedding }),
    
    14
    
        { headers: { 'Content-Type': 'application/json' } }
    
    15
    
      );
    
    16
    
    });
[/code]

Note the two options we pass to `session.run()`:

  * `mean_pool`: The first option sets `pooling` to `mean`. Pooling refers to how token-level embedding representations are compressed into a single sentence embedding that reflects the meaning of the entire sentence. Average pooling is the most common type of pooling for sentence embeddings.
  * `normalize`: The second option normalizes the embedding vector so that it can be used with distance measures like dot product. A normalized vector means its length (magnitude) is 1 - also referred to as a unit vector. A vector is normalized by dividing each element by the vector's length (magnitude), which maintains its direction but changes its length to 1.


5

Test it!

To test the Edge Function, first start a local functions server.
[code]
    1
    
    supabase functions serve
[/code]

Then in a new shell, create an HTTP request using cURL and pass in your input in the JSON body.
[code]
    1
    
    curl --request POST 'http://localhost:54321/functions/v1/embed' \
    
    2
    
      --header 'Content-Type: application/json' \
    
    3
    
      --header 'apikey: SUPABASE_PUBLISHABLE_KEY' \
    
    4
    
      --data '{ "input": "hello world" }'
[/code]

Be sure to replace `SUPABASE_PUBLISHABLE_KEY` with your project's publishable key. You can get this key by running `supabase status`.

## Next steps#

  * Learn more about [embedding concepts](</docs/guides/ai/concepts>)
  * [Store your embeddings](</docs/guides/ai/vector-columns>) in a database