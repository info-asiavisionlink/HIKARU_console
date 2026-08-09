---
タイトル: Running AI Models
URL: https://supabase.com/docs/guides/functions/ai-models
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: ai, ai-models, edge-functions, functions, models, running
---

# Running AI Models

**URL:** https://supabase.com/docs/guides/functions/ai-models
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** ai, ai-models, edge-functions, functions, models, running

## 目次

- [Setup#](#setup)
  - [Running a model inference#](#running-a-model-inference)
- [Generate text embeddings#](#generate-text-embeddings)
- [Using Large Language Models (LLM)#](#using-large-language-models-llm)
- [Running locally#](#running-locally)
- [Deploying to production#](#deploying-to-production)

## 概要

How to run AI models in Edge Functions.

---

Edge Functions have a built-in API for running AI models. You can use this API to generate embeddings, build conversational workflows, and do other AI related tasks in your Edge Functions.

This allows you to:

  * Generate text embeddings without external dependencies
  * Run Large Language Models via Ollama or Llamafile
  * Build conversational AI workflows


* * *

## Setup#

There are no external dependencies or packages to install to enable the API.

Create a new inference session:
[code] 
    1
    
    const model = new Supabase.ai.Session('model-name')
[/code]

To get type hints and checks for the API, import types from `functions-js`:
[code]
    1
    
    import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
[/code]

### Running a model inference#

Once the session is instantiated, you can call it with inputs to perform inferences:
[code] 
    1
    
    // For embeddings (gte-small model)
    
    2
    
    const embeddings = await model.run('Hello world', {
    
    3
    
      mean_pool: true,
    
    4
    
      normalize: true,
    
    5
    
    })
    
    6
    
    7
    
    // For text generation (non-streaming)
    
    8
    
    const response = await model.run('Write a haiku about coding', {
    
    9
    
      stream: false,
    
    10
    
      timeout: 30,
    
    11
    
    })
    
    12
    
    13
    
    // For streaming responses
    
    14
    
    const stream = await model.run('Tell me a story', {
    
    15
    
      stream: true,
    
    16
    
      mode: 'ollama',
    
    17
    
    })
[/code]

* * *

## Generate text embeddings#

Generate text embeddings using the built-in [`gte-small`](<https://huggingface.co/Supabase/gte-small>) model:

`gte-small` model exclusively caters to English texts, and any lengthy texts will be truncated to a maximum of 512 tokens. While you can provide inputs longer than 512 tokens, truncation may affect the accuracy.
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
    
      fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    
    7
    
        const params = new URL(req.url).searchParams
    
    8
    
        const input = params.get('input')
    
    9
    
        const output = await model.run(input, { mean_pool: true, normalize: true })
    
    10
    
        return Response.json(output)
    
    11
    
      }),
    
    12
    
    }
[/code]

* * *

## Using Large Language Models (LLM)#

Inference via larger models is supported via [Ollama](<https://ollama.com/>) and [Mozilla Llamafile](<https://github.com/Mozilla-Ocho/llamafile>). In the first iteration, you can use it with a self-managed Ollama or [Llamafile server](<https://www.docker.com/blog/a-quick-guide-to-containerizing-llamafile-with-docker-for-ai-applications/>).

We are progressively rolling out support for the hosted solution. To sign up for early access, fill out [this form](<https://forms.supabase.com/supabase.ai-llm-early-access>).

* * *

## Running locally#

OllamaMozilla Llamafile

1

Install Ollama

[Install Ollama](<https://github.com/ollama/ollama?tab=readme-ov-file#ollama>) and pull the Mistral model
[code]
    1
    
    ollama pull mistral
[/code]

2

Run the Ollama server
[code]
    1
    
    ollama serve
[/code]

3

Set the function secret

Set a function secret called `AI_INFERENCE_API_HOST` to point to the Ollama server
[code]
    1
    
    echo "AI_INFERENCE_API_HOST=http://host.docker.internal:11434" >> supabase/functions/.env
[/code]

4

Create a new function
[code]
    1
    
    supabase functions new ollama-test
[/code]
[code]
    1
    
    import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
    
    2
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    3
    
    4
    
    const session = new Supabase.ai.Session('mistral')
    
    5
    
    6
    
    export default {
    
    7
    
      fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    
    8
    
        const params = new URL(req.url).searchParams
    
    9
    
        const prompt = params.get('prompt') ?? ''
    
    10
    
    11
    
        // Get the output as a stream
    
    12
    
        const output = await session.run(prompt, { stream: true })
    
    13
    
    14
    
        const headers = new Headers({
    
    15
    
          'Content-Type': 'text/event-stream',
    
    16
    
          Connection: 'keep-alive',
    
    17
    
        })
    
    18
    
    19
    
        // Create a stream
    
    20
    
        const stream = new ReadableStream({
    
    21
    
          async start(controller) {
    
    22
    
            const encoder = new TextEncoder()
    
    23
    
    24
    
            try {
    
    25
    
              for await (const chunk of output) {
    
    26
    
                controller.enqueue(encoder.encode(chunk.response ?? ''))
    
    27
    
              }
    
    28
    
            } catch (err) {
    
    29
    
              console.error('Stream error:', err)
    
    30
    
            } finally {
    
    31
    
              controller.close()
    
    32
    
            }
    
    33
    
          },
    
    34
    
        })
    
    35
    
    36
    
        // Return the stream to the user
    
    37
    
        return new Response(stream, {
    
    38
    
          headers,
    
    39
    
        })
    
    40
    
      }),
    
    41
    
    }
[/code]

5

Serve the function
[code]
    1
    
    supabase functions serve --no-verify-jwt --env-file supabase/functions/.env
[/code]

6

Execute the function
[code]
    1
    
    curl --get "http://localhost:54321/functions/v1/ollama-test" \
    
    2
    
    --data-urlencode "prompt=write a short rap song about Supabase, the Postgres Developer platform, as sung by Nicki Minaj" \
    
    3
    
    -H "apikey: $PUBLISHABLE_KEY"
[/code]

* * *

## Deploying to production#

Once the function is working locally, it's time to deploy to production.

1

Deploy an Ollama or Llamafile server

Deploy an Ollama or Llamafile server and set a function secret called `AI_INFERENCE_API_HOST` to point to the deployed server:
[code]
    1
    
    supabase secrets set AI_INFERENCE_API_HOST=https://path-to-your-llm-server/
[/code]

2

Deploy the function
[code]
    1
    
    supabase functions deploy --no-verify-jwt
[/code]

3

Execute the function
[code]
    1
    
    curl --get "https://project-ref.supabase.co/functions/v1/ollama-test" \
    
    2
    
    --data-urlencode "prompt=write a short rap song about Supabase, the Postgres Developer platform, as sung by Nicki Minaj" \
    
    3
    
    -H "apikey: $PUBLISHABLE_KEY"
[/code]

As demonstrated in the video above, running Ollama locally is typically slower than running it in on a server with dedicated GPUs. We are collaborating with the Ollama team to improve local performance.

In the future, a hosted LLM API, will be provided as part of the Supabase platform. Supabase will scale and manage the API and GPUs for you. To sign up for early access, fill up [this form](<https://forms.supabase.com/supabase.ai-llm-early-access>).