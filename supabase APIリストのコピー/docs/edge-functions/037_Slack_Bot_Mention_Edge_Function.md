---
タイトル: Slack Bot Mention Edge Function
URL: https://supabase.com/docs/guides/functions/examples/slack-bot-mention
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge, edge-functions, examples, function, functions, mention, slack, slack-bot-mention
---

# Slack Bot Mention Edge Function

**URL:** https://supabase.com/docs/guides/functions/examples/slack-bot-mention
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge, edge-functions, examples, function, functions, mention, slack, slack-bot-mention

## 目次

- [Configuring Slack apps#](#configuring-slack-apps)
- [Creating the Edge Function#](#creating-the-edge-function)

## 概要

Building a Slack Bot that Handles Mentions.

---

The Slack Bot Mention Edge Function allows you to process mentions in Slack and respond accordingly.

## Configuring Slack apps#

For your bot to seamlessly interact with Slack, you'll need to configure Slack Apps:

  1. Navigate to the Slack Apps page.
  2. Under "Event Subscriptions," add the URL of the `slack-bot-mention` function and click to verify the URL.
  3. The Edge function will respond, confirming that everything is set up correctly.
  4. Add `app-mention` in the events the bot will subscribe to.


## Creating the Edge Function#

Deploy the following code as an Edge function using the CLI:
[code] 
    1
    
    supabase secrets set \
    
    2
    
      SLACK_TOKEN=<xoxb-0000000000-0000000000-01010101010nacho101010> \
    
    3
    
      --project-ref nacho_slacker
[/code]

Here's the code of the Edge Function, you can change the response to handle the text received:
[code] 
    1
    
    import { WebClient } from 'npm:@slack/web-api@^7'
    
    2
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    3
    
    4
    
    const slackBotToken = Deno.env.get('SLACK_TOKEN') ?? ''
    
    5
    
    const botClient = new WebClient(slackBotToken)
    
    6
    
    7
    
    console.log(`Slack URL verification function up and running!`)
    
    8
    
    9
    
    // Slack calls this endpoint, so deploy with --no-verify-jwt.
    
    10
    
    export default {
    
    11
    
      fetch: withSupabase({ auth: 'none' }, async (req) => {
    
    12
    
        try {
    
    13
    
          // Implement your Slack request signature verification here before trusting the payload
    
    14
    
          // (validate `x-slack-signature` / `x-slack-request-timestamp` with your signing secret).
    
    15
    
          const reqBody = await req.json()
    
    16
    
          console.log(JSON.stringify(reqBody, null, 2))
    
    17
    
          const { token, challenge, type, event } = reqBody
    
    18
    
    19
    
          if (type == 'url_verification') {
    
    20
    
            return Response.json({ challenge })
    
    21
    
          } else if (event.type == 'app_mention') {
    
    22
    
            const { user, text, channel, ts } = event
    
    23
    
            // Here you should process the text received and return a response:
    
    24
    
            const response = await botClient.chat.postMessage({
    
    25
    
              channel: channel,
    
    26
    
              text: `Hello <@${user}>!`,
    
    27
    
              thread_ts: ts,
    
    28
    
            })
    
    29
    
            return Response.json({ ok: true })
    
    30
    
          }
    
    31
    
        } catch (error) {
    
    32
    
          return Response.json({ error: error.message }, { status: 500 })
    
    33
    
        }
    
    34
    
      }),
    
    35
    
    }
[/code]