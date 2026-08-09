---
タイトル: Clerk
URL: https://supabase.com/docs/guides/auth/third-party/clerk
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, clerk, third-party
---

# Clerk

**URL:** https://supabase.com/docs/guides/auth/third-party/clerk
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, clerk, third-party

## 目次

- [Getting started#](#getting-started)
  - [Configure for local development or self-hosting#](#configure-for-local-development-or-self-hosting)
  - [Manually configuring your Clerk instance#](#manually-configuring-your-clerk-instance)
- [Setup the Supabase client library#](#setup-the-supabase-client-library)
- [Using RLS policies#](#using-rls-policies)
  - [Example: Check user organization role#](#example-check-user-organization-role)
  - [Example: Check user has passed second factor verification#](#example-check-user-has-passed-second-factor-verification)
- [Deprecated integration with JWT templates#](#deprecated-integration-with-jwt-templates)

## 概要

Use Clerk with your Supabase project

---

Clerk can be used as a third-party authentication provider alongside Supabase Auth, or standalone, with your Supabase project.

## Getting started#

Getting started is incredibly easy. Start off by visiting [Clerk's Connect with Supabase page](<https://dashboard.clerk.com/setup/supabase>) to configure your Clerk instance for Supabase compatibility.

Finally add a [new Third-Party Auth integration with Clerk](</dashboard/project/_/auth/third-party>) in the Supabase dashboard.

### Configure for local development or self-hosting#

When developing locally or self-hosting with the Supabase CLI, add the following config to your `supabase/config.toml` file:
[code] 
    1
    
    [auth.third_party.clerk]
    
    2
    
    enabled = true
    
    3
    
    domain = "example.clerk.accounts.dev"
[/code]

You will still need to configure your Clerk instance for Supabase compatibility.

### Manually configuring your Clerk instance#

If you are not able to use [Clerk's Connect with Supabase page](<https://dashboard.clerk.com/setup/supabase>) to configure your Clerk instance for working with Supabase, follow these steps.

  1. Add the `role` claim to [Clerk session tokens](<https://clerk.com/docs/backend-requests/resources/session-tokens>) by [customizing them](<https://clerk.com/docs/backend-requests/custom-session-token>). End-users who are authenticated should have the `authenticated` value for the claim. If you have an advanced Postgres setup where authenticated end-users use different Postgres roles to access the database, adjust the value to use the correct role name.
  2. Once all Clerk session tokens for your instance contain the `role` claim, add a [new Third-Party Auth integration with Clerk](</dashboard/project/_/auth/third-party>) in the Supabase dashboard or register it in the CLI as instructed above.


## Setup the Supabase client library#

TypeScriptFlutterSwift (iOS)
[code]
    1
    
    const supabaseClient = createClient(
    
    2
    
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
    
    3
    
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    
    4
    
        {
    
    5
    
          // Session accessed from Clerk SDK, either as Clerk.session (vanilla
    
    6
    
          // JavaScript) or useSession (React)
    
    7
    
          accessToken: async () => session?.getToken() ?? null,
    
    8
    
        }
    
    9
    
      )
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/clerk/hooks/useSupabaseClient.ts>)

## Using RLS policies#

Once you've configured the Supabase client library to use Clerk session tokens, you can use RLS policies to secure access to your project's database, Storage objects and Realtime channels.

The recommended way to design RLS policies with Clerk is to use claims present in your Clerk session token to allow or reject access to your project's data. Check [Clerk's docs](<https://clerk.com/docs/backend-requests/resources/session-tokens>) on the available JWT claims and their values.

### Example: Check user organization role#
[code] 
    1
    
    create policy "Only organization admins can insert in table"
    
    2
    
    on secured_table
    
    3
    
    for insert
    
    4
    
    to authenticated
    
    5
    
    with check (
    
    6
    
      (((select auth.jwt()->>'org_role') = 'org:admin') or ((select auth.jwt()->'o'->>'rol') = 'admin'))
    
    7
    
        and
    
    8
    
      (organization_id = (select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')))
    
    9
    
    );
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/clerk/supabase/migrations/20250501155648_setup_database.sql>)

This RLS policy checks that the newly inserted row in the table has the user's declared organization ID in the `organization_id` column. Additionally it ensures that they're an `org:admin`.

This way only organization admins can add rows to the table, for organizations they're a member of.

### Example: Check user has passed second factor verification#
[code] 
    1
    
    create policy "Only users that have passed second factor verification can read from table"
    
    2
    
    on secured_table
    
    3
    
    as restrictive
    
    4
    
    for select
    
    5
    
    to authenticated
    
    6
    
    using (
    
    7
    
      ((select auth.jwt()->'fva'->>1) != '-1')
    
    8
    
    );
[/code]

[View source](<https://github.com/supabase/supabase/blob/3a3661019f4f7dd79a5941bc379741bf45396047/examples/clerk/supabase/migrations/20250501155648_setup_database.sql>)

This example uses a restrictive RLS policy checks that the [second factor verification](<https://clerk.com/docs/guides/reverification>) age element in the `fva` claim is not `'-1'` indicating the user has passed through second factor verification.

## Deprecated integration with JWT templates#

As of 1st April 2025 the previously available [Clerk Integration with Supabase](</partners/integrations/clerk>) is considered deprecated and is no longer recommended for use. All projects using the deprecated integration will be excluded from Third-Party Monthly Active User (TP-MAU) charges until at least 1st January 2026.

This integration used low-level primitives that are still available in Supabase and Clerk, such as a [configurable JWT secret](</dashboard/project/_/settings/api>) and [JWT templates from Clerk](<https://clerk.com/docs/backend-requests/jwt-templates>). This enables you to keep using it in an unofficial manner, though only limited support will be provided from Supabase.

Deprecation is done for the following reasons:

  * Sharing your project's JWT secret with a third-party is a problematic security practice
  * Rotating the project's JWT secret in this case almost always results in significant downtime for your application
  * Additional latency to [generate a new JWT](<https://clerk.com/docs/backend-requests/jwt-templates#generate-a-jwt>) for use with Supabase, instead of using the Clerk [session tokens](<https://clerk.com/docs/backend-requests/resources/session-tokens>)