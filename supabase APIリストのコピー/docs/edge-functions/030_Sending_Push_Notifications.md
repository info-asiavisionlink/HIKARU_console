---
タイトル: Sending Push Notifications
URL: https://supabase.com/docs/guides/functions/examples/push-notifications
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, examples, functions, notifications, push, push-notifications, sending
---

# Sending Push Notifications

**URL:** https://supabase.com/docs/guides/functions/examples/push-notifications
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, examples, functions, notifications, push, push-notifications, sending

## 目次

- [Supabase setup#](#supabase-setup)
- [Expo setup#](#expo-setup)
- [Enhanced security for push notifications#](#enhanced-security-for-push-notifications)
- [Deploy the Supabase Edge Function#](#deploy-the-supabase-edge-function)
- [Create the database webhook#](#create-the-database-webhook)
- [Send push notification#](#send-push-notification)

## 概要

Send Push Notifications to your React Native iOS and Android apps using Expo.

---

Push notifications are an important part of any mobile app. They allow you to send notifications to your users even when they are not using your app. This guide will show you how to send push notifications to different mobile app frameworks from your Supabase edge functions.

Expo Push NotificationsFirebase Cloud Messaging

[Expo](<https://docs.expo.dev/push-notifications/overview/>) makes implementing push notifications easy. All the hassle with device information and communicating with Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNs) is done behind the scenes. This allows you to treat Android and iOS notifications in the same way and save time both on the frontend and backend.

Find the example code on [GitHub](<https://github.com/supabase/supabase/blob/master/examples/user-management/expo-push-notifications/>).

## Supabase setup#

  * [Create a new Supabase project](<https://database.new>).
  * Link your project: `supabase link --project-ref your-supabase-project-ref`
  * Start Supabase locally: `supabase start`
  * Push up the schema: `supabase db push` (schema is defined in [supabase/migrations](<https://github.com/supabase/supabase/blob/master/examples/user-management/expo-push-notifications/supabase/migrations/>))


## Expo setup#

To use Expo's push notification service, you must configure your app by installing a set of libraries, implementing functions to handle notifications, and setting up credentials for Android and iOS. Follow the official [Expo Push Notifications Setup Guide](<https://docs.expo.dev/push-notifications/push-notifications-setup/>) to get the credentials for Android and iOS. This project uses [Expo's EAS build](<https://docs.expo.dev/build/introduction/>) service to simplify this part.

  1. Install the dependencies: `npm i`
  2. Create a [new Expo project](<https://expo.dev/accounts/_/projects>)
  3. Link this app to your project: `npm install --global eas-cli && eas init --id your-expo-project-id`
  4. [Create a build for your physical device](<https://docs.expo.dev/develop/development-builds/create-a-build/#create-a-build-for-the-device>)
  5. Start the development server for your project: `npx expo start --dev-client`
  6. Scan the QR code shown in the terminal with your physical device.
  7. Sign up/in to create a user in Supabase Auth.


## Enhanced security for push notifications#

  1. Navigate to your [Expo Access Token Settings](<https://expo.dev/accounts/_/settings/access-tokens>).
  2. Create a new token for usage in Supabase Edge Functions.
  3. Toggle on "Enhanced Security for Push Notifications".
  4. Create the local `.env` file: `cp .env.local.example .env.local`
  5. In the newly created `.env.local` file, set your `EXPO_ACCESS_TOKEN` value.


## Deploy the Supabase Edge Function#

The database webhook handler to send push notifications is located in [supabase/functions/push/index.ts](<https://github.com/supabase/supabase/blob/master/examples/user-management/expo-push-notifications/supabase/functions/push/index.ts>). Deploy the function to your linked project and set the `EXPO_ACCESS_TOKEN` secret.

  1. `supabase functions deploy push`
  2. `supabase secrets set --env-file .env.local`


[code]
    1
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    2
    
    3
    
    console.log('Hello from Functions!')
    
    4
    
    5
    
    interface Notification {
    
    6
    
      id: string
    
    7
    
      user_id: string
    
    8
    
      body: string
    
    9
    
    }
    
    10
    
    11
    
    interface WebhookPayload {
    
    12
    
      type: 'INSERT' | 'UPDATE' | 'DELETE'
    
    13
    
      table: string
    
    14
    
      record: Notification
    
    15
    
      schema: 'public'
    
    16
    
      old_record: null | Notification
    
    17
    
    }
    
    18
    
    19
    
    // Triggered by a Database Webhook, which authenticates with a secret key.
    
    20
    
    // Deploy with `verify_jwt = false`.
    
    21
    
    export default {
    
    22
    
      fetch: withSupabase({ auth: 'secret' }, async (req, ctx) => {
    
    23
    
        const payload: WebhookPayload = await req.json()
    
    24
    
        const { data } = await ctx.supabaseAdmin
    
    25
    
          .from('profiles')
    
    26
    
          .select('expo_push_token')
    
    27
    
          .eq('id', payload.record.user_id)
    
    28
    
          .single()
    
    29
    
    30
    
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
    
    31
    
          method: 'POST',
    
    32
    
          headers: {
    
    33
    
            'Content-Type': 'application/json',
    
    34
    
            Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`,
    
    35
    
          },
    
    36
    
          body: JSON.stringify({
    
    37
    
            to: data?.expo_push_token,
    
    38
    
            sound: 'default',
    
    39
    
            body: payload.record.body,
    
    40
    
          }),
    
    41
    
        }).then((res) => res.json())
    
    42
    
    43
    
        return Response.json(res)
    
    44
    
      }),
    
    45
    
    }
[/code]

## Create the database webhook#

Navigate to the [Database Webhooks settings](</dashboard/project/_/integrations/webhooks/overview>) in your Supabase Dashboard.

  1. Enable and create a new hook.
  2. Conditions to fire webhook: Select the `notifications` table and tick the `Insert` event.
  3. Webhook configuration: Supabase Edge Functions.
  4. Edge Function: Select the `push` edge function and leave the method as `POST` and timeout as `1000`.
  5. HTTP Headers: Click "Add new header" > "Add auth header with service key" and leave Content-type: `application/json`.
  6. Click "Create webhook".


## Send push notification#

  1. Navigate to the [table editor](</dashboard/project/_/editor>) in your Supabase Dashboard.
  2. In your `notifications` table, insert a new row.
  3. Watch the magic happen 🪄