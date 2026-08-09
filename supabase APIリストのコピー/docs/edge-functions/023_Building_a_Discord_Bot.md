---
タイトル: Building a Discord Bot
URL: https://supabase.com/docs/guides/functions/examples/discord-bot
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: building, discord, discord-bot, edge-functions, examples, functions
---

# Building a Discord Bot

**URL:** https://supabase.com/docs/guides/functions/examples/discord-bot
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** building, discord, discord-bot, edge-functions, examples, functions

## 目次

- [Create an application on Discord Developer portal#](#create-an-application-on-discord-developer-portal)
- [Code#](#code)
- [Deploy the slash command handler#](#deploy-the-slash-command-handler)
  - [Configure Discord application to use our URL as interactions endpoint URL#](#configure-discord-application-to-use-our-url-as-interactions-endpoint-url)
- [Install the slash command on your Discord server#](#install-the-slash-command-on-your-discord-server)
- [Run locally#](#run-locally)

## 概要

Building a Slash Command Discord Bot with Edge Functions.

---

## Create an application on Discord Developer portal#

  1. Go to <https://discord.com/developers/applications>[](<https://discord.com/developers/applications>) (login using your discord account if required).
  2. Click on **New Application** button available at left side of your profile picture.
  3. Name your application and click on **Create**.
  4. Go to **Bot** section, click on **Add Bot** , and finally on **Yes, do it!** to confirm.


A new application is created which will hold our Slash Command. Don't close the tab as we need information from this application page throughout our development.

Before we can write some code, we need to curl a discord endpoint to register a Slash Command in our app.

Fill `DISCORD_BOT_TOKEN` with the token available in the **Bot** section and `CLIENT_ID` with the ID available on the **General Information** section of the page and run the command on your terminal.
[code] 
    1
    
    BOT_TOKEN='replace_me_with_bot_token'
    
    2
    
    CLIENT_ID='replace_me_with_client_id'
    
    3
    
    curl -X POST \
    
    4
    
    -H 'Content-Type: application/json' \
    
    5
    
    -H "Authorization: Bot $BOT_TOKEN" \
    
    6
    
    -d '{"name":"hello","description":"Greet a person","options":[{"name":"name","description":"The name of the person","type":3,"required":true}]}' \
    
    7
    
    "https://discord.com/api/v8/applications/$CLIENT_ID/commands"
[/code]

This will register a Slash Command named `hello` that accepts a parameter named `name` of type string.

## Code#
[code] 
    1
    
    // Sift is a small routing library that abstracts away details like starting a
    
    2
    
    // listener on a port, and provides a function (serve) that has an API
    
    3
    
    // to invoke a function for a specific path.
    
    4
    
    5
    
    // TweetNaCl is a cryptography library that we use to verify requests
    
    6
    
    // from Discord.
    
    7
    
    import nacl from 'https://cdn.skypack.dev/tweetnacl@v1.0.3?dts'
    
    8
    
    import { json, serve, validateRequest } from 'https://deno.land/x/sift@0.6.0/mod.ts'
    
    9
    
    10
    
    enum DiscordCommandType {
    
    11
    
      Ping = 1,
    
    12
    
      ApplicationCommand = 2,
    
    13
    
    }
    
    14
    
    15
    
    // For all requests to "/" endpoint, we want to invoke home() handler.
    
    16
    
    serve({
    
    17
    
      '/discord-bot': home,
    
    18
    
    })
    
    19
    
    20
    
    // The main logic of the Discord Slash Command is defined in this function.
    
    21
    
    async function home(request: Request) {
    
    22
    
      // validateRequest() ensures that a request is of POST method and
    
    23
    
      // has the following headers.
    
    24
    
      const { error } = await validateRequest(request, {
    
    25
    
        POST: {
    
    26
    
          headers: ['X-Signature-Ed25519', 'X-Signature-Timestamp'],
    
    27
    
        },
    
    28
    
      })
    
    29
    
      if (error) {
    
    30
    
        return json({ error: error.message }, { status: error.status })
    
    31
    
      }
    
    32
    
    33
    
      // verifySignature() verifies if the request is coming from Discord.
    
    34
    
      // When the request's signature is not valid, we return a 401 and this is
    
    35
    
      // important as Discord sends invalid requests to test our verification.
    
    36
    
      const { valid, body } = await verifySignature(request)
    
    37
    
      if (!valid) {
    
    38
    
        return json(
    
    39
    
          { error: 'Invalid request' },
    
    40
    
          {
    
    41
    
            status: 401,
    
    42
    
          }
    
    43
    
        )
    
    44
    
      }
    
    45
    
    46
    
      const { type = 0, data = { options: [] } } = JSON.parse(body)
    
    47
    
      // Discord performs Ping interactions to test our application.
    
    48
    
      // Type 1 in a request implies a Ping interaction.
    
    49
    
      if (type === DiscordCommandType.Ping) {
    
    50
    
        return json({
    
    51
    
          type: 1, // Type 1 in a response is a Pong interaction response type.
    
    52
    
        })
    
    53
    
      }
    
    54
    
    55
    
      // Type 2 in a request is an ApplicationCommand interaction.
    
    56
    
      // It implies that a user has issued a command.
    
    57
    
      if (type === DiscordCommandType.ApplicationCommand) {
    
    58
    
        const { value } = data.options.find(
    
    59
    
          (option: { name: string; value: string }) => option.name === 'name'
    
    60
    
        )
    
    61
    
        return json({
    
    62
    
          // Type 4 responds with the below message retaining the user's
    
    63
    
          // input at the top.
    
    64
    
          type: 4,
    
    65
    
          data: {
    
    66
    
            content: `Hello, ${value}!`,
    
    67
    
          },
    
    68
    
        })
    
    69
    
      }
    
    70
    
    71
    
      // We will return a bad request error as a valid Discord request
    
    72
    
      // shouldn't reach here.
    
    73
    
      return json({ error: 'bad request' }, { status: 400 })
    
    74
    
    }
    
    75
    
    76
    
    /** Verify whether the request is coming from Discord. */
    
    77
    
    async function verifySignature(request: Request): Promise<{ valid: boolean; body: string }> {
    
    78
    
      const PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY')!
    
    79
    
      // Discord sends these headers with every request.
    
    80
    
      const signature = request.headers.get('X-Signature-Ed25519')!
    
    81
    
      const timestamp = request.headers.get('X-Signature-Timestamp')!
    
    82
    
      const body = await request.text()
    
    83
    
      const valid = nacl.sign.detached.verify(
    
    84
    
        new TextEncoder().encode(timestamp + body),
    
    85
    
        hexToUint8Array(signature),
    
    86
    
        hexToUint8Array(PUBLIC_KEY)
    
    87
    
      )
    
    88
    
    89
    
      return { valid, body }
    
    90
    
    }
    
    91
    
    92
    
    /** Converts a hexadecimal string to Uint8Array. */
    
    93
    
    function hexToUint8Array(hex: string) {
    
    94
    
      return new Uint8Array(hex.match(/.{1,2}/g)!.map((val) => parseInt(val, 16)))
    
    95
    
    }
[/code]

## Deploy the slash command handler#
[code] 
    1
    
    supabase functions deploy discord-bot --no-verify-jwt
    
    2
    
    supabase secrets set DISCORD_PUBLIC_KEY=your_public_key
[/code]

Navigate to your Function details in the Supabase Dashboard to get your Endpoint URL.

### Configure Discord application to use our URL as interactions endpoint URL#

  1. Go back to your application (Greeter) page on Discord Developer Portal
  2. Fill **INTERACTIONS ENDPOINT URL** field with the URL and click on **Save Changes**.


The application is now ready. Proceed to the next section to install it.

## Install the slash command on your Discord server#

So to use the `hello` Slash Command, we need to install our Greeter application on our Discord server. Here are the steps:

  1. Go to **OAuth2** section of the Discord application page on Discord Developer Portal
  2. Select `applications.commands` scope and click on the **Copy** button below.
  3. Now paste and visit the URL on your browser. Select your server and click on **Authorize**.


Open Discord, type `/Promise` and press **Enter**.

## Run locally#
[code] 
    1
    
    supabase functions serve discord-bot --no-verify-jwt --env-file ./supabase/.env.local
    
    2
    
    ngrok http 54321
[/code]