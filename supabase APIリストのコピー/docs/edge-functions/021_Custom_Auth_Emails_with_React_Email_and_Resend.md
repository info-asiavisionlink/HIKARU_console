---
タイトル: Custom Auth Emails with React Email and Resend
URL: https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: ai, auth, auth-send-email-hook-react-email-resend, custom, edge-functions, email, emails, examples, functions, react, resend, with
---

# Custom Auth Emails with React Email and Resend

**URL:** https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** ai, auth, auth-send-email-hook-react-email-resend, custom, edge-functions, email, emails, examples, functions, react, resend, with

## 目次

- [Prerequisites#](#prerequisites)
- [1. Create Supabase function#](#1-create-supabase-function)
- [2. Edit the handler function#](#2-edit-the-handler-function)
- [3. Create React Email templates#](#3-create-react-email-templates)
- [4. Deploy the Function#](#4-deploy-the-function)
- [5. Configure the Send Email Hook#](#5-configure-the-send-email-hook)
- [More resources#](#more-resources)

## 概要

Use the send email hook to send custom auth emails with React Email and Resend in Supabase Edge Functions.

---

Use the [send email hook](</docs/guides/auth/auth-hooks/send-email-hook?queryGroups=language&language=http>) to send custom auth emails with [React Email](<https://react.email/>) and [Resend](<https://resend.com/>) in Supabase Edge Functions.

Prefer to jump straight to the code? [Check out the example on GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/auth-hook-react-email-resend>).

## Prerequisites#

To get the most out of this guide, you’ll need to:

  * [Create a Resend API key](<https://resend.com/api-keys>)
  * [Verify your domain](<https://resend.com/domains>)


Make sure you have the latest version of the [Supabase CLI](</docs/guides/local-development/cli/getting-started#installing-the-supabase-cli>) installed.

## 1\. Create Supabase function#

Create a new function locally:
[code] 
    1
    
    supabase functions new send-email
[/code]

## 2\. Edit the handler function#

Paste the following code into the `index.ts` file:
[code] 
    1
    
    import { renderAsync } from 'npm:@react-email/components@^1'
    
    2
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    3
    
    import React from 'npm:react@^19'
    
    4
    
    import { Resend } from 'npm:resend@^6'
    
    5
    
    import { Webhook } from 'npm:standardwebhooks@^1'
    
    6
    
    7
    
    import { MagicLinkEmail } from './_templates/magic-link.tsx'
    
    8
    
    9
    
    const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
    
    10
    
    const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string).replace('v1,whsec_', '')
    
    11
    
    12
    
    export default {
    
    13
    
      fetch: withSupabase({ auth: 'none' }, async (req) => {
    
    14
    
        if (req.method !== 'POST') {
    
    15
    
          return Response.json({ error: 'not allowed' }, { status: 400 })
    
    16
    
        }
    
    17
    
    18
    
        const payload = await req.text()
    
    19
    
        const headers = Object.fromEntries(req.headers)
    
    20
    
        const wh = new Webhook(hookSecret)
    
    21
    
        try {
    
    22
    
          const {
    
    23
    
            user,
    
    24
    
            email_data: { token, token_hash, redirect_to, email_action_type },
    
    25
    
          } = wh.verify(payload, headers) as {
    
    26
    
            user: {
    
    27
    
              email: string
    
    28
    
            }
    
    29
    
            email_data: {
    
    30
    
              token: string
    
    31
    
              token_hash: string
    
    32
    
              redirect_to: string
    
    33
    
              email_action_type: string
    
    34
    
              site_url: string
    
    35
    
              token_new: string
    
    36
    
              token_hash_new: string
    
    37
    
            }
    
    38
    
          }
    
    39
    
    40
    
          const html = await renderAsync(
    
    41
    
            React.createElement(MagicLinkEmail, {
    
    42
    
              supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
    
    43
    
              token,
    
    44
    
              token_hash,
    
    45
    
              redirect_to,
    
    46
    
              email_action_type,
    
    47
    
            })
    
    48
    
          )
    
    49
    
    50
    
          const { error } = await resend.emails.send({
    
    51
    
            from: 'welcome <onboarding@resend.dev>',
    
    52
    
            to: [user.email],
    
    53
    
            subject: 'Supa Custom MagicLink!',
    
    54
    
            html,
    
    55
    
          })
    
    56
    
          if (error) {
    
    57
    
            throw error
    
    58
    
          }
    
    59
    
        } catch (error) {
    
    60
    
          console.log(error)
    
    61
    
          return Response.json(
    
    62
    
            {
    
    63
    
              error: {
    
    64
    
                http_code: error.code,
    
    65
    
                message: error.message,
    
    66
    
              },
    
    67
    
            },
    
    68
    
            { status: 401 }
    
    69
    
          )
    
    70
    
        }
    
    71
    
    72
    
        return Response.json({})
    
    73
    
      }),
    
    74
    
    }
[/code]

## 3\. Create React Email templates#

Create a new `_templates` folder following the [recommended project structure](</docs/guides/functions/development-environment#recommended-project-structure>) and add a new `magic-link.tsx` file with the following code:
[code] 
    1
    
    import {
    
    2
    
      Body,
    
    3
    
      Container,
    
    4
    
      Head,
    
    5
    
      Heading,
    
    6
    
      Html,
    
    7
    
      Link,
    
    8
    
      Preview,
    
    9
    
      Text,
    
    10
    
    } from 'npm:@react-email/components@^1'
    
    11
    
    import * as React from 'npm:react@^19'
    
    12
    
    13
    
    interface MagicLinkEmailProps {
    
    14
    
      supabase_url: string
    
    15
    
      email_action_type: string
    
    16
    
      redirect_to: string
    
    17
    
      token_hash: string
    
    18
    
      token: string
    
    19
    
    }
    
    20
    
    21
    
    export const MagicLinkEmail = ({
    
    22
    
      token,
    
    23
    
      supabase_url,
    
    24
    
      email_action_type,
    
    25
    
      redirect_to,
    
    26
    
      token_hash,
    
    27
    
    }: MagicLinkEmailProps) => (
    
    28
    
      <Html>
    
    29
    
        <Head />
    
    30
    
        <Preview>Log in with this magic link</Preview>
    
    31
    
        <Body style={main}>
    
    32
    
          <Container style={container}>
    
    33
    
            <Heading style={h1}>Login</Heading>
    
    34
    
            <Link
    
    35
    
              href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
    
    36
    
              target="_blank"
    
    37
    
              style={{
    
    38
    
                ...link,
    
    39
    
                display: 'block',
    
    40
    
                marginBottom: '16px',
    
    41
    
              }}
    
    42
    
            >
    
    43
    
              Click here to log in with this magic link
    
    44
    
            </Link>
    
    45
    
            <Text style={{ ...text, marginBottom: '14px' }}>
    
    46
    
              Or, copy and paste this temporary login code:
    
    47
    
            </Text>
    
    48
    
            <code style={code}>{token}</code>
    
    49
    
            <Text
    
    50
    
              style={{
    
    51
    
                ...text,
    
    52
    
                color: '#ababab',
    
    53
    
                marginTop: '14px',
    
    54
    
                marginBottom: '16px',
    
    55
    
              }}
    
    56
    
            >
    
    57
    
              If you didn&apos;t try to login, you can safely ignore this email.
    
    58
    
            </Text>
    
    59
    
            <Text style={footer}>
    
    60
    
              <Link
    
    61
    
                href="https://demo.vercel.store/"
    
    62
    
                target="_blank"
    
    63
    
                style={{ ...link, color: '#898989' }}
    
    64
    
              >
    
    65
    
                ACME Corp
    
    66
    
              </Link>
    
    67
    
              , the famouse demo corp.
    
    68
    
            </Text>
    
    69
    
          </Container>
    
    70
    
        </Body>
    
    71
    
      </Html>
    
    72
    
    )
    
    73
    
    74
    
    export default MagicLinkEmail
    
    75
    
    76
    
    const main = {
    
    77
    
      backgroundColor: '#ffffff',
    
    78
    
    }
    
    79
    
    80
    
    const container = {
    
    81
    
      paddingLeft: '12px',
    
    82
    
      paddingRight: '12px',
    
    83
    
      margin: '0 auto',
    
    84
    
    }
    
    85
    
    86
    
    const h1 = {
    
    87
    
      color: '#333',
    
    88
    
      fontFamily:
    
    89
    
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    
    90
    
      fontSize: '24px',
    
    91
    
      fontWeight: 'bold',
    
    92
    
      margin: '40px 0',
    
    93
    
      padding: '0',
    
    94
    
    }
    
    95
    
    96
    
    const link = {
    
    97
    
      color: '#2754C5',
    
    98
    
      fontFamily:
    
    99
    
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    
    100
    
      fontSize: '14px',
    
    101
    
      textDecoration: 'underline',
    
    102
    
    }
    
    103
    
    104
    
    const text = {
    
    105
    
      color: '#333',
    
    106
    
      fontFamily:
    
    107
    
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    
    108
    
      fontSize: '14px',
    
    109
    
      margin: '24px 0',
    
    110
    
    }
    
    111
    
    112
    
    const footer = {
    
    113
    
      color: '#898989',
    
    114
    
      fontFamily:
    
    115
    
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    
    116
    
      fontSize: '12px',
    
    117
    
      lineHeight: '22px',
    
    118
    
      marginTop: '12px',
    
    119
    
      marginBottom: '24px',
    
    120
    
    }
    
    121
    
    122
    
    const code = {
    
    123
    
      display: 'inline-block',
    
    124
    
      padding: '16px 4.5%',
    
    125
    
      width: '90.5%',
    
    126
    
      backgroundColor: '#f4f4f4',
    
    127
    
      borderRadius: '5px',
    
    128
    
      border: '1px solid #eee',
    
    129
    
      color: '#333',
    
    130
    
    }
[/code]

You can find a selection of React Email templates in the [React Email Examples](<https://react.email/examples>).

## 4\. Deploy the Function#

Deploy function to Supabase:
[code] 
    1
    
    supabase functions deploy send-email --no-verify-jwt
[/code]

Note down the function URL, you will need it in the next step!

## 5\. Configure the Send Email Hook#

  * Go to the [Auth Hooks](</dashboard/project/_/auth/hooks>) section of the Supabase dashboard and create a new "Send Email hook".
  * Select HTTPS as the hook type.
  * Paste the function URL in the "URL" field.
  * Click "Generate Secret" to generate your webhook secret and note it down.
  * Click "Create" to save the hook configuration.


Store these secrets in your `.env` file.
[code] 
    1
    
    RESEND_API_KEY=your_resend_api_key
    
    2
    
    SEND_EMAIL_HOOK_SECRET="v1,whsec_<base64_secret>"
[/code]

You can generate the secret in the [Auth Hooks](</dashboard/project/_/auth/hooks>) section of the Supabase dashboard.

Set the secrets from the `.env` file:
[code] 
    1
    
    supabase secrets set --env-file supabase/functions/.env
[/code]

Now your Supabase Edge Function will be triggered anytime an Auth Email needs to be sent to the user!

## More resources#

  * [Send Email Hooks](</docs/guides/auth/auth-hooks/send-email-hook>)
  * [Auth Hooks](</docs/guides/auth/auth-hooks>)