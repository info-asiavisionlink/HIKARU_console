---
タイトル: Handling Stripe Webhooks
URL: https://supabase.com/docs/guides/functions/examples/stripe-webhooks
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, examples, functions, handling, stripe, stripe-webhooks, webhooks
---

# Handling Stripe Webhooks

**URL:** https://supabase.com/docs/guides/functions/examples/stripe-webhooks
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, examples, functions, handling, stripe, stripe-webhooks, webhooks

## 目次

（目次なし）

## 概要

Handling signed Stripe Webhooks with Edge Functions.

---

Handling signed Stripe Webhooks with Edge Functions. [View on GitHub](<https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/stripe-webhooks/index.ts>).
[code] 
    1
    
    // Follow this setup guide to integrate the Deno language server with your editor:
    
    2
    
    // https://deno.land/manual/getting_started/setup_your_environment
    
    3
    
    // This enables autocomplete, go to definition, etc.
    
    4
    
    5
    
    import Stripe from 'npm:stripe@^22'
    
    6
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    7
    
    8
    
    const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string)
    
    9
    
    // This is needed in order to use the Web Crypto API in Deno.
    
    10
    
    const cryptoProvider = Stripe.createSubtleCryptoProvider()
    
    11
    
    12
    
    console.log('Hello from Stripe Webhook!')
    
    13
    
    14
    
    // Stripe verifies the request via its signature, so deploy with verify_jwt = false.
    
    15
    
    export default {
    
    16
    
      fetch: withSupabase({ auth: 'none' }, async (req) => {
    
    17
    
        const signature = req.headers.get('Stripe-Signature')
    
    18
    
    19
    
        // First step is to verify the event. The .text() method must be used as the
    
    20
    
        // verification relies on the raw request body rather than the parsed JSON.
    
    21
    
        const body = await req.text()
    
    22
    
        let receivedEvent
    
    23
    
        try {
    
    24
    
          receivedEvent = await stripe.webhooks.constructEventAsync(
    
    25
    
            body,
    
    26
    
            signature!,
    
    27
    
            Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!,
    
    28
    
            undefined,
    
    29
    
            cryptoProvider
    
    30
    
          )
    
    31
    
        } catch (err) {
    
    32
    
          return new Response(err.message, { status: 400 })
    
    33
    
        }
    
    34
    
        console.log(`🔔 Event received: ${receivedEvent.id}`)
    
    35
    
        return Response.json({ ok: true })
    
    36
    
      }),
    
    37
    
    }
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/edge-functions/supabase/functions/stripe-webhooks/index.ts>)