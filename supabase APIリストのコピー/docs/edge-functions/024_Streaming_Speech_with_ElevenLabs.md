---
タイトル: Streaming Speech with ElevenLabs
URL: https://supabase.com/docs/guides/functions/examples/elevenlabs-generate-speech-stream
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, elevenlabs, elevenlabs-generate-speech-stream, examples, functions, speech, streaming, with
---

# Streaming Speech with ElevenLabs

**URL:** https://supabase.com/docs/guides/functions/examples/elevenlabs-generate-speech-stream
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, elevenlabs, elevenlabs-generate-speech-stream, examples, functions, speech, streaming, with

## 目次

- [Introduction#](#introduction)
- [Requirements#](#requirements)
- [Setup#](#setup)
  - [Create a Supabase project locally#](#create-a-supabase-project-locally)
  - [Configure the storage bucket#](#configure-the-storage-bucket)
  - [Configure background tasks for Supabase Edge Functions#](#configure-background-tasks-for-supabase-edge-functions)
  - [Create a Supabase Edge Function for speech generation#](#create-a-supabase-edge-function-for-speech-generation)
  - [Set up the environment variables#](#set-up-the-environment-variables)
  - [Dependencies#](#dependencies)
- [Code the Supabase Edge Function#](#code-the-supabase-edge-function)
- [Run locally#](#run-locally)
  - [Try it out#](#try-it-out)
- [Deploy to Supabase#](#deploy-to-supabase)
  - [Set the function secrets#](#set-the-function-secrets)
- [Test the function#](#test-the-function)

## 概要

Generate and stream speech through Supabase Edge Functions. Store speech in Supabase Storage and cache responses via built-in CDN.

---

## Introduction#

In this tutorial you will learn how to build an edge API to generate, stream, store, and cache speech using Supabase Edge Functions, Supabase Storage, and [ElevenLabs text to speech API](<https://elevenlabs.io/text-to-speech>).

Find the [example project on GitHub](<https://github.com/elevenlabs/elevenlabs-examples/tree/main/examples/text-to-speech/supabase/stream-and-cache-storage>).

## Requirements#

  * An ElevenLabs account with an [API key](</app/settings/api-keys>).
  * A [Supabase](<https://supabase.com>) account (you can sign up for a free account via [database.new](<https://database.new>)).
  * The [Supabase CLI](</docs/guides/local-development>) installed on your machine.
  * The [Deno runtime](<https://docs.deno.com/runtime/getting_started/installation/>) installed on your machine and optionally [setup in your favourite IDE](<https://docs.deno.com/runtime/getting_started/setup_your_environment>).


## Setup#

### Create a Supabase project locally#

After installing the [Supabase CLI](</docs/guides/local-development>), run the following command to create a new Supabase project locally:
[code] 
    1
    
    supabase init
[/code]

### Configure the storage bucket#

You can configure the Supabase CLI to automatically generate a storage bucket by adding this configuration in the `config.toml` file:
[code] 
    1
    
    [storage.buckets.audio]
    
    2
    
    public = false
    
    3
    
    file_size_limit = "50MiB"
    
    4
    
    allowed_mime_types = ["audio/mp3"]
    
    5
    
    objects_path = "./audio"
[/code]

Upon running `supabase start` this will create a new storage bucket in your local Supabase project. Should you want to push this to your hosted Supabase project, you can run `supabase seed buckets --linked`.

### Configure background tasks for Supabase Edge Functions#

To use background tasks in Supabase Edge Functions when developing locally, you need to add the following configuration in the `config.toml` file:
[code] 
    1
    
    [edge_runtime]
    
    2
    
    policy = "per_worker"
[/code]

When running with `per_worker` policy, Function won't auto-reload on edits. You will need to manually restart it by running `supabase functions serve`.

### Create a Supabase Edge Function for speech generation#

Create a new Edge Function by running the following command:
[code] 
    1
    
    supabase functions new text-to-speech
[/code]

If you're using VS Code or Cursor, select `y` when the CLI prompts "Generate VS Code settings for Deno? [y/N]"!

### Set up the environment variables#

Within the `supabase/functions` directory, create a new `.env` file and add the following variables:
[code] 
    1
    
    # Find / create an API key at https://elevenlabs.io/app/settings/api-keys
    
    2
    
    ELEVENLABS_API_KEY=your_api_key
[/code]

### Dependencies#

The project uses a couple of dependencies:

  * The [@supabase/supabase-js](</docs/reference/javascript/introduction>) library to interact with the Supabase database.
  * The ElevenLabs [JavaScript SDK](<https://github.com/elevenlabs/elevenlabs-js>) to interact with the text-to-speech API.
  * The open-source [object-hash](<https://www.npmjs.com/package/object-hash>) to generate a hash from the request parameters.


Since Supabase Edge Function uses the [Deno runtime](<https://deno.land/>), you don't need to install the dependencies, rather you can [import](<https://docs.deno.com/examples/npm/>) them via the `npm:` prefix.

## Code the Supabase Edge Function#

In your newly created `supabase/functions/text-to-speech/index.ts` file, add the following code:
[code] 
    1
    
    // Setup type definitions for built-in Supabase Runtime APIs
    
    2
    
    import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
    
    3
    
    4
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    5
    
    import { ElevenLabsClient } from 'npm:elevenlabs@^1'
    
    6
    
    import * as hash from 'npm:object-hash@^3'
    
    7
    
    8
    
    const client = new ElevenLabsClient({
    
    9
    
      apiKey: Deno.env.get('ELEVENLABS_API_KEY'),
    
    10
    
    })
    
    11
    
    12
    
    // Deploy with verify_jwt = false
    
    13
    
    // Open endpoint for testing. In production, implement an authorization layer in the handler or switch the auth mode.
    
    14
    
    export default {
    
    15
    
      fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    
    16
    
        // Upload audio to Supabase Storage in a background task
    
    17
    
        async function uploadAudioToStorage(stream: ReadableStream, requestHash: string) {
    
    18
    
          const { data, error } = await ctx.supabaseAdmin.storage
    
    19
    
            .from('audio')
    
    20
    
            .upload(`${requestHash}.mp3`, stream, {
    
    21
    
              contentType: 'audio/mp3',
    
    22
    
            })
    
    23
    
    24
    
          console.log('Storage upload result', { data, error })
    
    25
    
        }
    
    26
    
    27
    
        // To secure your function for production, you can for example validate the request origin,
    
    28
    
        // or append a user access token and validate it with Supabase Auth.
    
    29
    
        console.log('Request origin', req.headers.get('host'))
    
    30
    
        const url = new URL(req.url)
    
    31
    
        const params = new URLSearchParams(url.search)
    
    32
    
        const text = params.get('text')
    
    33
    
        const voiceId = params.get('voiceId') ?? 'JBFqnCBsd6RMkjVDRZzb'
    
    34
    
    35
    
        const requestHash = hash.MD5({ text, voiceId })
    
    36
    
        console.log('Request hash', requestHash)
    
    37
    
    38
    
        // Check storage for existing audio file
    
    39
    
        const { data } = await ctx.supabaseAdmin.storage
    
    40
    
          .from('audio')
    
    41
    
          .createSignedUrl(`${requestHash}.mp3`, 60)
    
    42
    
    43
    
        if (data) {
    
    44
    
          console.log('Audio file found in storage', data)
    
    45
    
          const storageRes = await fetch(data.signedUrl)
    
    46
    
          if (storageRes.ok) return storageRes
    
    47
    
        }
    
    48
    
    49
    
        if (!text) {
    
    50
    
          return Response.json({ error: 'Text parameter is required' }, { status: 400 })
    
    51
    
        }
    
    52
    
    53
    
        try {
    
    54
    
          console.log('ElevenLabs API call')
    
    55
    
          const response = await client.textToSpeech.convertAsStream(voiceId, {
    
    56
    
            output_format: 'mp3_44100_128',
    
    57
    
            model_id: 'eleven_multilingual_v2',
    
    58
    
            text,
    
    59
    
          })
    
    60
    
    61
    
          const stream = new ReadableStream({
    
    62
    
            async start(controller) {
    
    63
    
              for await (const chunk of response) {
    
    64
    
                controller.enqueue(chunk)
    
    65
    
              }
    
    66
    
              controller.close()
    
    67
    
            },
    
    68
    
          })
    
    69
    
    70
    
          // Branch stream to Supabase Storage
    
    71
    
          const [browserStream, storageStream] = stream.tee()
    
    72
    
    73
    
          // Upload to Supabase Storage in the background
    
    74
    
          EdgeRuntime.waitUntil(uploadAudioToStorage(storageStream, requestHash))
    
    75
    
    76
    
          // Return the streaming response immediately
    
    77
    
          return new Response(browserStream, {
    
    78
    
            headers: {
    
    79
    
              'Content-Type': 'audio/mpeg',
    
    80
    
            },
    
    81
    
          })
    
    82
    
        } catch (error) {
    
    83
    
          console.log('error', { error })
    
    84
    
          return Response.json({ error: error.message }, { status: 500 })
    
    85
    
        }
    
    86
    
      }),
    
    87
    
    }
[/code]

## Run locally#

To run the function locally, run the following commands:
[code] 
    1
    
    supabase start
[/code]

Once the local Supabase stack is up and running, run the following command to start the function and observe the logs:
[code] 
    1
    
    supabase functions serve
[/code]

### Try it out#

Navigate to `http://127.0.0.1:54321/functions/v1/text-to-speech?text=hello%20world` to hear the function in action.

Afterwards, navigate to `http://127.0.0.1:54323/project/default/storage/buckets/audio` to see the audio file in your local Supabase Storage bucket.

## Deploy to Supabase#

If you haven't already, create a new Supabase account at [database.new](<https://database.new>) and link the local project to your Supabase account:
[code] 
    1
    
    supabase link
[/code]

Once done, run the following command to deploy the function:
[code] 
    1
    
    supabase functions deploy
[/code]

### Set the function secrets#

Now that you have all your secrets set locally, you can run the following command to set the secrets in your Supabase project:
[code] 
    1
    
    supabase secrets set --env-file supabase/functions/.env
[/code]

## Test the function#

The function is designed in a way that it can be used directly as a source for an `<audio>` element.
[code] 
    1
    
    <audio
    
    2
    
      src="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/text-to-speech?text=Hello%2C%20world!&voiceId=JBFqnCBsd6RMkjVDRZzb"
    
    3
    
      controls
    
    4
    
    />
[/code]

You can find an example frontend implementation in the complete code example on [GitHub](<https://github.com/elevenlabs/elevenlabs-examples/tree/main/examples/text-to-speech/supabase/stream-and-cache-storage/src/pages/Index.tsx>).