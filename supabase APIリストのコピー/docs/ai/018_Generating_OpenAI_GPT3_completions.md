---
タイトル: Generating OpenAI GPT3 completions
URL: https://supabase.com/docs/guides/ai/examples/openai
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, completions, examples, generating, openai
---

# Generating OpenAI GPT3 completions

**URL:** https://supabase.com/docs/guides/ai/examples/openai
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, completions, examples, generating, openai

## 目次

- [Setup Supabase project#](#setup-supabase-project)
- [Create edge function#](#create-edge-function)
- [Create OpenAI key#](#create-openai-key)
- [Run locally#](#run-locally)
- [Deploy#](#deploy)
- [Go deeper#](#go-deeper)

## 概要

Generate GPT text completions using OpenAI and Supabase Edge Functions.

---

OpenAI provides a [completions API](<https://platform.openai.com/docs/api-reference/completions>) that allows you to use their generative GPT models in your own applications.

OpenAI's API is intended to be used from the server-side. Supabase offers Edge Functions to make it easy to interact with third party APIs like OpenAI.

## Setup Supabase project#

If you haven't already, [install the Supabase CLI](</docs/guides/local-development>) and initialize your project:
[code] 
    1
    
    supabase init
[/code]

## Create edge function#

Scaffold a new edge function called `openai` by running:
[code] 
    1
    
    supabase functions new openai
[/code]

A new edge function will now exist under `./supabase/functions/openai/index.ts`.

We'll design the function to take your user's query (via POST request) and forward it to OpenAI's API.
[code] 
    1
    
    import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'
    
    2
    
    3
    
    Deno.serve(async (req) => {
    
    4
    
      const { query } = await req.json()
    
    5
    
      const apiKey = Deno.env.get('OPENAI_API_KEY')
    
    6
    
      const openai = new OpenAI({
    
    7
    
        apiKey: apiKey,
    
    8
    
      })
    
    9
    
    10
    
      // Documentation here: https://github.com/openai/openai-node
    
    11
    
      const chatCompletion = await openai.chat.completions.create({
    
    12
    
        messages: [{ role: 'user', content: query }],
    
    13
    
        // Choose model from here: https://platform.openai.com/docs/models
    
    14
    
        model: 'gpt-3.5-turbo',
    
    15
    
        stream: false,
    
    16
    
      })
    
    17
    
    18
    
      const reply = chatCompletion.choices[0].message.content
    
    19
    
    20
    
      return new Response(reply, {
    
    21
    
        headers: { 'Content-Type': 'text/plain' },
    
    22
    
      })
    
    23
    
    })
[/code]

Note that we are setting `stream` to `false` which will wait until the entire response is complete before returning. If you wish to stream GPT's response word-by-word back to your client, set `stream` to `true`.

## Create OpenAI key#

You may have noticed we were passing `OPENAI_API_KEY` in the Authorization header to OpenAI. To generate this key, go to <https://platform.openai.com/account/api-keys>[](<https://platform.openai.com/account/api-keys>) and create a new secret key.

After getting the key, copy it into a new file called `.env.local` in your `./supabase` folder:
[code] 
    1
    
    OPENAI_API_KEY=your-key-here
[/code]

## Run locally#

Serve the edge function locally by running:
[code] 
    1
    
    supabase functions serve --env-file ./supabase/.env.local --no-verify-jwt
[/code]

Notice how we are passing in the `.env.local` file.

Use cURL or Postman to make a POST request to <http://localhost:54321/functions/v1/openai>[](<http://localhost:54321/functions/v1/openai>).
[code] 
    1
    
    curl -i --location --request POST http://localhost:54321/functions/v1/openai \
    
    2
    
      --header 'Content-Type: application/json' \
    
    3
    
      --data '{"query":"What is Supabase?"}'
[/code]

You should see a GPT response come back from OpenAI!

## Deploy#

Deploy your function to the cloud by running:
[code] 
    1
    
    supabase functions deploy --no-verify-jwt openai
    
    2
    
    supabase secrets set --env-file ./supabase/.env.local
[/code]

## Go deeper#

If you're interesting in learning how to use this to build your own ChatGPT, read [the blog post](</blog/chatgpt-supabase-docs>) and check out the video: