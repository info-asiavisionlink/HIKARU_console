---
タイトル: Sending Emails
URL: https://supabase.com/docs/guides/functions/examples/send-emails
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: ai, edge-functions, emails, examples, functions, send-emails, sending
---

# Sending Emails

**URL:** https://supabase.com/docs/guides/functions/examples/send-emails
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** ai, edge-functions, emails, examples, functions, send-emails, sending

## 目次

- [Prerequisites#](#prerequisites)
- [1. Create Supabase function#](#1-create-supabase-function)
- [2. Edit the handler function#](#2-edit-the-handler-function)
- [3. Deploy and send email#](#3-deploy-and-send-email)
- [4. Try it yourself#](#4-try-it-yourself)

## 概要

Sending emails from Edge Functions using the Resend API.

---

Sending emails from Edge Functions using the [Resend API](<https://resend.com/>).

## Prerequisites#

To get the most out of this guide, you’ll need to:

  * [Create an API key](<https://resend.com/api-keys>)
  * [Verify your domain](<https://resend.com/domains>)


Make sure you have the latest version of the [Supabase CLI](</docs/guides/local-development/cli/getting-started#installing-the-supabase-cli>) installed.

## 1\. Create Supabase function#

Create a new function locally:
[code] 
    1
    
    supabase functions new resend
[/code]

Store the `RESEND_API_KEY` in your `.env` file.

## 2\. Edit the handler function#

Paste the following code into the `index.ts` file:
[code] 
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    4
    
    5
    
    const handler = async (_request: Request): Promise<Response> => {
    
    6
    
      const res = await fetch('https://api.resend.com/emails', {
    
    7
    
        method: 'POST',
    
    8
    
        headers: {
    
    9
    
          'Content-Type': 'application/json',
    
    10
    
          Authorization: `Bearer ${RESEND_API_KEY}`,
    
    11
    
        },
    
    12
    
        body: JSON.stringify({
    
    13
    
          from: 'onboarding@resend.dev',
    
    14
    
          to: 'delivered@resend.dev',
    
    15
    
          subject: 'hello world',
    
    16
    
          html: '<strong>it works!</strong>',
    
    17
    
        }),
    
    18
    
      })
    
    19
    
    20
    
      const data = await res.json()
    
    21
    
    22
    
      return Response.json(data)
    
    23
    
    }
    
    24
    
    25
    
    export default { fetch: withSupabase({ auth: ['user', 'secret'] }, handler) }
[/code]

## 3\. Deploy and send email#

Run function locally:
[code] 
    1
    
    supabase start
    
    2
    
    supabase functions serve --no-verify-jwt --env-file .env
[/code]

The function accepts a signed-in user's JWT or a secret key, so it can be triggered from your app (via `supabase.functions.invoke`) or from a database function. Test it locally with a secret key:
[code] 
    1
    
    curl -i --request POST 'http://localhost:54321/functions/v1/resend' \
    
    2
    
      --header 'apikey: <SUPABASE_SECRET_KEY>'
[/code]

Deploy function to Supabase:
[code] 
    1
    
    supabase functions deploy resend --no-verify-jwt
[/code]

When you deploy to Supabase, make sure that your `RESEND_API_KEY` is set in [Edge Function Secrets Management](</dashboard/project/_/functions/secrets>)

## 4\. Try it yourself#

Find the complete example on [GitHub](<https://github.com/resendlabs/resend-supabase-edge-functions-example>).