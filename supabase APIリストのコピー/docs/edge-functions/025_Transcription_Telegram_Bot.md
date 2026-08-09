---
タイトル: Transcription Telegram Bot
URL: https://supabase.com/docs/guides/functions/examples/elevenlabs-transcribe-speech
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, elevenlabs-transcribe-speech, examples, functions, telegram, transcription
---

# Transcription Telegram Bot

**URL:** https://supabase.com/docs/guides/functions/examples/elevenlabs-transcribe-speech
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, elevenlabs-transcribe-speech, examples, functions, telegram, transcription

## 目次

- [Introduction#](#introduction)
- [Requirements#](#requirements)
- [Setup#](#setup)
  - [Register a Telegram bot#](#register-a-telegram-bot)
  - [Create a Supabase project locally#](#create-a-supabase-project-locally)
  - [Create a database table to log the transcription results#](#create-a-database-table-to-log-the-transcription-results)
  - [Create a Supabase Edge Function to handle Telegram webhook requests#](#create-a-supabase-edge-function-to-handle-telegram-webhook-requests)
  - [Set up the environment variables#](#set-up-the-environment-variables)
  - [Dependencies#](#dependencies)
- [Code the Telegram bot#](#code-the-telegram-bot)
- [Deploy to Supabase#](#deploy-to-supabase)
  - [Apply the database migrations#](#apply-the-database-migrations)
  - [Set up the webhook#](#set-up-the-webhook)
  - [Set the function secrets#](#set-the-function-secrets)
- [Test the bot#](#test-the-bot)

## 概要

Build a Telegram bot that transcribes audio and video messages in 99 languages using TypeScript with Deno in Supabase Edge Functions.

---

## Introduction#

In this tutorial you will learn how to build a Telegram bot that transcribes audio and video messages in 99 languages using TypeScript and the ElevenLabs Scribe model via the [speech to text API](<https://elevenlabs.io/speech-to-text>).

To check out what the end result will look like, you can test out the [t.me/ElevenLabsScribeBot](<https://t.me/ElevenLabsScribeBot>)

Find the [example project on GitHub](<https://github.com/elevenlabs/elevenlabs-examples/tree/main/examples/speech-to-text/telegram-transcription-bot>).

## Requirements#

  * An ElevenLabs account with an [API key](</app/settings/api-keys>).
  * A [Supabase](<https://supabase.com>) account (you can sign up for a free account via [database.new](<https://database.new>)).
  * The [Supabase CLI](</docs/guides/local-development>) installed on your machine.
  * The [Deno runtime](<https://docs.deno.com/runtime/getting_started/installation/>) installed on your machine and optionally [setup in your favourite IDE](<https://docs.deno.com/runtime/getting_started/setup_your_environment>).
  * A [Telegram](<https://telegram.org>) account.


## Setup#

### Register a Telegram bot#

Use the [BotFather](<https://t.me/BotFather>) to create a new Telegram bot. Run the `/newbot` command and follow the instructions to create a new bot. At the end, you will receive your secret bot token. Note it down securely for the next step.

![BotFather](/docs/img/guides/functions/elevenlabs/bot-father.png)

### Create a Supabase project locally#

After installing the [Supabase CLI](</docs/guides/local-development>), run the following command to create a new Supabase project locally:
[code] 
    1
    
    supabase init
[/code]

### Create a database table to log the transcription results#

Next, create a new database table to log the transcription results:
[code] 
    1
    
    supabase migrations new init
[/code]

This will create a new migration file in the `supabase/migrations` directory. Open the file and add the following SQL:
[code] 
    1
    
    CREATE TABLE IF NOT EXISTS transcription_logs (
    
    2
    
      id BIGSERIAL PRIMARY KEY,
    
    3
    
      file_type VARCHAR NOT NULL,
    
    4
    
      duration INTEGER NOT NULL,
    
    5
    
      chat_id BIGINT NOT NULL,
    
    6
    
      message_id BIGINT NOT NULL,
    
    7
    
      username VARCHAR,
    
    8
    
      transcript TEXT,
    
    9
    
      language_code VARCHAR,
    
    10
    
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    11
    
      error TEXT
    
    12
    
    );
    
    13
    
    14
    
    ALTER TABLE transcription_logs ENABLE ROW LEVEL SECURITY;
[/code]

### Create a Supabase Edge Function to handle Telegram webhook requests#

Next, create a new Edge Function to handle Telegram webhook requests:
[code] 
    1
    
    supabase functions new scribe-bot
[/code]

If you're using VS Code or Cursor, select `y` when the CLI prompts "Generate VS Code settings for Deno? [y/N]"!

### Set up the environment variables#

Within the `supabase/functions` directory, create a new `.env` file and add the following variables:
[code] 
    1
    
    # Find / create an API key at https://elevenlabs.io/app/settings/api-keys
    
    2
    
    ELEVENLABS_API_KEY=your_api_key
    
    3
    
    4
    
    # The bot token you received from the BotFather.
    
    5
    
    TELEGRAM_BOT_TOKEN=your_bot_token
    
    6
    
    7
    
    # A random secret chosen by you to secure the function.
    
    8
    
    FUNCTION_SECRET=random_secret
[/code]

### Dependencies#

The project uses a couple of dependencies:

  * The open-source [grammY Framework](<https://grammy.dev/>) to handle the Telegram webhook requests.
  * The [@supabase/supabase-js](</docs/reference/javascript/introduction>) library to interact with the Supabase database.
  * The ElevenLabs [JavaScript SDK](<https://github.com/elevenlabs/elevenlabs-js>) to interact with the speech-to-text API.


Since Supabase Edge Function uses the [Deno runtime](<https://deno.land/>), you don't need to install the dependencies, rather you can [import](<https://docs.deno.com/examples/npm/>) them via the `npm:` prefix.

## Code the Telegram bot#

In your newly created `scribe-bot/index.ts` file, add the following code:
[code] 
    1
    
    import { Bot, webhookCallback } from 'npm:grammy@^1'
    
    2
    
    3
    
    import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
    
    4
    
    5
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    6
    
    import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'
    
    7
    
    import { ElevenLabsClient } from 'npm:elevenlabs@^1'
    
    8
    
    9
    
    console.log(`Function "elevenlabs-scribe-bot" up and running!`)
    
    10
    
    11
    
    const elevenLabsClient = new ElevenLabsClient({
    
    12
    
      apiKey: Deno.env.get('ELEVENLABS_API_KEY') || '',
    
    13
    
    })
    
    14
    
    15
    
    async function scribe({
    
    16
    
      supabaseAdmin,
    
    17
    
      fileURL,
    
    18
    
      fileType,
    
    19
    
      duration,
    
    20
    
      chatId,
    
    21
    
      messageId,
    
    22
    
      username,
    
    23
    
    }: {
    
    24
    
      supabaseAdmin: SupabaseClient
    
    25
    
      fileURL: string
    
    26
    
      fileType: string
    
    27
    
      duration: number
    
    28
    
      chatId: number
    
    29
    
      messageId: number
    
    30
    
      username: string
    
    31
    
    }) {
    
    32
    
      let transcript: string | null = null
    
    33
    
      let languageCode: string | null = null
    
    34
    
      let errorMsg: string | null = null
    
    35
    
      try {
    
    36
    
        const sourceFileArrayBuffer = await fetch(fileURL).then((res) => res.arrayBuffer())
    
    37
    
        const sourceBlob = new Blob([sourceFileArrayBuffer], {
    
    38
    
          type: fileType,
    
    39
    
        })
    
    40
    
    41
    
        const scribeResult = await elevenLabsClient.speechToText.convert({
    
    42
    
          file: sourceBlob,
    
    43
    
          model_id: 'scribe_v1',
    
    44
    
          tag_audio_events: false,
    
    45
    
        })
    
    46
    
    47
    
        transcript = scribeResult.text
    
    48
    
        languageCode = scribeResult.language_code
    
    49
    
    50
    
        // Reply to the user with the transcript
    
    51
    
        await bot.api.sendMessage(chatId, transcript, {
    
    52
    
          reply_parameters: { message_id: messageId },
    
    53
    
        })
    
    54
    
      } catch (error) {
    
    55
    
        errorMsg = error.message
    
    56
    
        console.log(errorMsg)
    
    57
    
        await bot.api.sendMessage(chatId, 'Sorry, there was an error. Please try again.', {
    
    58
    
          reply_parameters: { message_id: messageId },
    
    59
    
        })
    
    60
    
      }
    
    61
    
      // Write log to Supabase.
    
    62
    
      const logLine = {
    
    63
    
        file_type: fileType,
    
    64
    
        duration,
    
    65
    
        chat_id: chatId,
    
    66
    
        message_id: messageId,
    
    67
    
        username,
    
    68
    
        language_code: languageCode,
    
    69
    
        error: errorMsg,
    
    70
    
      }
    
    71
    
      console.log({ logLine })
    
    72
    
      await supabaseAdmin.from('transcription_logs').insert({ ...logLine, transcript })
    
    73
    
    }
    
    74
    
    75
    
    // Set by the request handler before delegating to grammY, so bot handlers
    
    76
    
    // can write transcription logs with the admin client.
    
    77
    
    let supabaseAdmin: SupabaseClient
    
    78
    
    79
    
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    
    80
    
    const bot = new Bot(telegramBotToken || '')
    
    81
    
    const startMessage = `Welcome to the ElevenLabs Scribe Bot\\! I can transcribe speech in 99 languages with super high accuracy\\!
    
    82
    
        \nTry it out by sending or forwarding me a voice message, video, or audio file\\!
    
    83
    
        \n[Learn more about Scribe](https://elevenlabs.io/speech-to-text) or [build your own bot](https://elevenlabs.io/docs/cookbooks/speech-to-text/telegram-bot)\\!
    
    84
    
      `
    
    85
    
    bot.command('start', (ctx) => ctx.reply(startMessage.trim(), { parse_mode: 'MarkdownV2' }))
    
    86
    
    87
    
    bot.on([':voice', ':audio', ':video'], async (ctx) => {
    
    88
    
      try {
    
    89
    
        const file = await ctx.getFile()
    
    90
    
        const fileURL = `https://api.telegram.org/file/bot${telegramBotToken}/${file.file_path}`
    
    91
    
        const fileMeta = ctx.message?.video ?? ctx.message?.voice ?? ctx.message?.audio
    
    92
    
    93
    
        if (!fileMeta) {
    
    94
    
          return ctx.reply('No video|audio|voice metadata found. Please try again.')
    
    95
    
        }
    
    96
    
    97
    
        // Run the transcription in the background.
    
    98
    
        EdgeRuntime.waitUntil(
    
    99
    
          scribe({
    
    100
    
            supabaseAdmin,
    
    101
    
            fileURL,
    
    102
    
            fileType: fileMeta.mime_type!,
    
    103
    
            duration: fileMeta.duration,
    
    104
    
            chatId: ctx.chat.id,
    
    105
    
            messageId: ctx.message?.message_id!,
    
    106
    
            username: ctx.from?.username || '',
    
    107
    
          })
    
    108
    
        )
    
    109
    
    110
    
        // Reply to the user immediately to let them know we received their file.
    
    111
    
        return ctx.reply('Received. Scribing...')
    
    112
    
      } catch (error) {
    
    113
    
        console.error(error)
    
    114
    
        return ctx.reply(
    
    115
    
          'Sorry, there was an error getting the file. Please try again with a smaller file!'
    
    116
    
        )
    
    117
    
      }
    
    118
    
    })
    
    119
    
    120
    
    const handleUpdate = webhookCallback(bot, 'std/http')
    
    121
    
    122
    
    // Deploy with verify_jwt = false
    
    123
    
    // The bot is called by Telegram, so we verify the request with FUNCTION_SECRET in code.
    
    124
    
    export default {
    
    125
    
      fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    
    126
    
        try {
    
    127
    
          const url = new URL(req.url)
    
    128
    
          if (url.searchParams.get('secret') !== Deno.env.get('FUNCTION_SECRET')) {
    
    129
    
            return Response.json({ error: 'not allowed' }, { status: 405 })
    
    130
    
          }
    
    131
    
    132
    
          supabaseAdmin = ctx.supabaseAdmin
    
    133
    
    134
    
          return await handleUpdate(req)
    
    135
    
        } catch (err) {
    
    136
    
          console.error(err)
    
    137
    
        }
    
    138
    
      }),
    
    139
    
    }
[/code]

## Deploy to Supabase#

If you haven't already, create a new Supabase account at [database.new](<https://database.new>) and link the local project to your Supabase account:
[code] 
    1
    
    supabase link
[/code]

### Apply the database migrations#

Run the following command to apply the database migrations from the `supabase/migrations` directory:
[code] 
    1
    
    supabase db push
[/code]

Navigate to the [table editor](</dashboard/project/_/editor>) in your Supabase dashboard and you should see and empty `transcription_logs` table.

![Empty table](/docs/img/guides/functions/elevenlabs/supa-empty-table.png)

Lastly, run the following command to deploy the Edge Function:
[code] 
    1
    
    supabase functions deploy --no-verify-jwt scribe-bot
[/code]

Navigate to the [Edge Functions view](</dashboard/project/_/functions>) in your Supabase dashboard and you should see the `scribe-bot` function deployed. Make a note of the function URL as you'll need it later, it should look something like `https://<project-ref>.functions.supabase.co/scribe-bot`.

![Edge Function deployed](/docs/img/guides/functions/elevenlabs/supa-edge-function-deployed.png)

### Set up the webhook#

Set your bot's webhook URL to `https://<PROJECT_REFERENCE>.functions.supabase.co/telegram-bot` (Replacing `<...>` with respective values). In order to do that, run a GET request to the following URL (in your browser, for example):
[code] 
    1
    
    https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<PROJECT_REFERENCE>.supabase.co/functions/v1/scribe-bot?secret=<FUNCTION_SECRET>
[/code]

Note that the `FUNCTION_SECRET` is the secret you set in your `.env` file.

![Set webhook](/docs/img/guides/functions/elevenlabs/set-webhook.png)

### Set the function secrets#

Now that you have all your secrets set locally, you can run the following command to set the secrets in your Supabase project:
[code] 
    1
    
    supabase secrets set --env-file supabase/functions/.env
[/code]

## Test the bot#

Finally you can test the bot by sending it a voice message, audio or video file.

![Test the bot](/docs/img/guides/functions/elevenlabs/test-bot.png)

After you see the transcript as a reply, navigate back to your table editor in the Supabase dashboard and you should see a new row in your `transcription_logs` table.

![New row in table](/docs/img/guides/functions/elevenlabs/supa-new-row.png)