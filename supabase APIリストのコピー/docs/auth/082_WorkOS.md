---
タイトル: WorkOS
URL: https://supabase.com/docs/guides/auth/third-party/workos
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, third-party, workos
---

# WorkOS

**URL:** https://supabase.com/docs/guides/auth/third-party/workos
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, third-party, workos

## 目次

- [Getting started#](#getting-started)
- [Setup the Supabase client library#](#setup-the-supabase-client-library)
- [Add a new Third-Party Auth integration to your project#](#add-a-new-third-party-auth-integration-to-your-project)
- [Set up a JWT template to add the authenticated role.#](#set-up-a-jwt-template-to-add-the-authenticated-role)

## 概要

Use WorkOS with your Supabase project

---

WorkOS can be used as a third-party authentication provider alongside Supabase Auth, or standalone, with your Supabase project.

## Getting started#

  1. First you need to add an integration to connect your Supabase project with your WorkOS tenant. You will need your WorkOS issuer. The issuer is `https://api.workos.com/user_management/<your-client-id>`. Substitute your [custom auth domain](<https://workos.com/docs/custom-domains/auth-api>) for "api.workos.com" if configured.
  2. Add a new Third-party Auth integration in your project's [Authentication settings](</dashboard/project/_/auth/third-party>).
  3. Set up a JWT template to assign the `role: 'authenticated'` claim to your access token.


## Setup the Supabase client library#

TypeScript
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    import { createClient as createAuthKitClient } from '@workos-inc/authkit-js'
    
    3
    
    4
    
    const authkit = await createAuthKitClient('WORKOS_CLIENT_ID', {
    
    5
    
      apiHostname: '<WORKOS_AUTH_DOMAIN>',
    
    6
    
    })
    
    7
    
    8
    
    const supabase = createClient(
    
    9
    
      'https://<supabase-project>.supabase.co',
    
    10
    
      'SUPABASE_PUBLISHABLE_KEY',
    
    11
    
      {
    
    12
    
        accessToken: async () => {
    
    13
    
          return authkit.getAccessToken()
    
    14
    
        },
    
    15
    
      }
    
    16
    
    )
[/code]

## Add a new Third-Party Auth integration to your project#

In the dashboard navigate to your project's [Authentication settings](</dashboard/project/_/auth/third-party>) and find the Third-Party Auth section to add a new integration.

## Set up a JWT template to add the authenticated role.#

Your Supabase project inspects the `role` claim present in all JWTs sent to it, to assign the correct Postgres role when using the Data API, Storage or Realtime authorization.

WorkOS JWTs already contain a `role` claim that corresponds to the user's role in their organization. It is necessary to adjust the `role` claim to be `"authenticated"` like Supabase expects. This can be done using JWT templates (navigate to Authentication -> Sessions -> JWT Template in the WorkOS Dashboard).

This template overrides the `role` claim to meet Supabase's expectations, and adds the WorkOS role in a new `user_role` claim:
[code] 
    1
    
    {
    
    2
    
      "role": "authenticated",
    
    3
    
      "user_role": {{organization_membership.role}}
    
    4
    
    }
[/code]