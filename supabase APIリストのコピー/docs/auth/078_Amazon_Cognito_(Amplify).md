---
タイトル: Amazon Cognito (Amplify)
URL: https://supabase.com/docs/guides/auth/third-party/aws-cognito
カテゴリ: auth
更新日: 2026-08-02
タグ: amazon, amplify, auth, aws-cognito, cognito, third-party
---

# Amazon Cognito (Amplify)

**URL:** https://supabase.com/docs/guides/auth/third-party/aws-cognito
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** amazon, amplify, auth, aws-cognito, cognito, third-party

## 目次

- [Getting started#](#getting-started)
- [Setup the Supabase client library#](#setup-the-supabase-client-library)
- [Add a new Third-Party Auth integration to your project#](#add-a-new-third-party-auth-integration-to-your-project)
- [Use a pre-token generation trigger to assign the authenticated role#](#use-a-pre-token-generation-trigger-to-assign-the-authenticated-role)

## 概要

Use Amazon Cognito via Amplify or standalone with your Supabase project

---

Amazon Cognito User Pools (via AWS Amplify or on its own) can be used as a third-party authentication provider alongside Supabase Auth, or standalone, with your Supabase project.

## Getting started#

  1. First you need to add an integration to connect your Supabase project with your Amazon Cognito User Pool. You will need the pool's ID and region.
  2. Add a new Third-party Auth integration in your project's [Authentication settings](</dashboard/project/_/auth/third-party>) or configure it in the CLI.
  3. Assign the `role: 'authenticated'` custom claim to all JWTs by using a Pre-Token Generation Trigger.
  4. Finally setup the Supabase client in your application.


## Setup the Supabase client library#

TypeScript (Amplify)Swift (iOS)FlutterKotlin
[code]
    1
    
    import { fetchAuthSession, Hub } from 'aws-amplify/auth'
    
    2
    
    3
    
    const supabase = createClient(
    
    4
    
      'https://<supabase-project>.supabase.co',
    
    5
    
      'SUPABASE_PUBLISHABLE_KEY',
    
    6
    
      {
    
    7
    
        accessToken: async () => {
    
    8
    
          const tokens = await fetchAuthSession()
    
    9
    
    10
    
          // Alternatively you can use tokens?.idToken instead.
    
    11
    
          return tokens?.accessToken
    
    12
    
        },
    
    13
    
      }
    
    14
    
    )
    
    15
    
    16
    
    // if you're using Realtime you also need to set up a listener for Cognito auth changes
    
    17
    
    Hub.listen('auth', () => {
    
    18
    
      fetchAuthSession().then((tokens) => supabase.realtime.setAuth(tokens?.accessToken))
    
    19
    
    })
[/code]

## Add a new Third-Party Auth integration to your project#

In the dashboard navigate to your project's [Authentication settings](</dashboard/project/_/auth/third-party>) and find the Third-Party Auth section to add a new integration.

In the CLI add the following config to your `supabase/config.toml` file:
[code] 
    1
    
    [auth.third_party.aws_cognito]
    
    2
    
    enabled = true
    
    3
    
    user_pool_id = "<id>"
    
    4
    
    user_pool_region = "<region>"
[/code]

## Use a pre-token generation trigger to assign the authenticated role#

Your Supabase project inspects the `role` claim present in all JWTs sent to it, to assign the correct Postgres role when using the Data API, Storage or Realtime authorization.

By default, Amazon Cognito JWTs (both ID token and access tokens) do not contain a `role` claim in them. If you were to send such a JWT to your Supabase project, the `anon` role would be assigned when executing the Postgres query. Most of your app's logic will be accessible by the `authenticated` role.

A recommended approach to do this is to configure a [Pre-Token Generation Trigger](<https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html>) either `V1_0` (ID token only) or `V2_0` (both access and ID token). To do this you will need to create a new Lambda function (in any language and runtime) and assign it to the [Amazon Cognito User Pool's Lambda Triggers configuration](<https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html>). For example, the Lambda function should look similar to this:

Node.js
[code]
    1
    
    export const handler = async (event) => {
    
    2
    
      event.response = {
    
    3
    
        claimsOverrideDetails: {
    
    4
    
          claimsToAddOrOverride: {
    
    5
    
            role: 'authenticated',
    
    6
    
          },
    
    7
    
        },
    
    8
    
      }
    
    9
    
    10
    
      return event
    
    11
    
    }
[/code]