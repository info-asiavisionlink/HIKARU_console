---
タイトル: Anonymous Sign-Ins
URL: https://supabase.com/docs/guides/auth/auth-anonymous
カテゴリ: auth
更新日: 2026-08-02
タグ: anonymous, auth, auth-anonymous, sign
---

# Anonymous Sign-Ins

**URL:** https://supabase.com/docs/guides/auth/auth-anonymous
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** anonymous, auth, auth-anonymous, sign

## 目次

- [Sign in anonymously#](#sign-in-anonymously)
- [Convert an anonymous user to a permanent user#](#convert-an-anonymous-user-to-a-permanent-user)
  - [Link an email / phone identity#](#link-an-email--phone-identity)
  - [Link an OAuth identity#](#link-an-oauth-identity)
- [Access control#](#access-control)
- [Resolving identity conflicts#](#resolving-identity-conflicts)
  - [Linking an anonymous user to an existing account#](#linking-an-anonymous-user-to-an-existing-account)
- [Abuse prevention and rate limits#](#abuse-prevention-and-rate-limits)
- [Automatic cleanup#](#automatic-cleanup)
- [Resources#](#resources)

## 概要

Create and use anonymous users to authenticate with Supabase

---

[Enable Anonymous Sign-Ins](</dashboard/project/_/auth/providers>) to build apps which provide users an authenticated experience without requiring users to enter an email address, password, use an OAuth provider or provide any other PII (Personally Identifiable Information). Later, when ready, the user can link an authentication method to their account.

Anonymous user vs the anon key

Calling `signInAnonymously()` creates an anonymous user. It behaves like a permanent user, except the user can't access their account if they sign out, clear browsing data, or use another device.

Like permanent users, the `authenticated` Postgres role will be used when using the Data APIs to access your project. JWTs for these users will have an `is_anonymous` claim which you can use to distinguish in RLS policies.

This is different from the `anon` API key which does not create a user and can be used to implement public access to your database as it uses the `anonymous` Postgres role.

Anonymous sign-ins can be used to build:

  * E-commerce applications, such as shopping carts before check-out
  * Full-feature demos without collecting personal information
  * Temporary or throw-away accounts


Review your existing RLS policies before enabling anonymous sign-ins. Anonymous users use the `authenticated` role. To distinguish between anonymous users and permanent users, your policies need to check the `is_anonymous` field of the user's JWT.

See the Access control section for more details.

Use Dynamic Rendering with Next.js

The Supabase team has received reports of user metadata being cached across unique anonymous users as a result of Next.js static page rendering. For the best user experience, use dynamic page rendering.

Self hosting and local development

For self-hosting, you can update your project configuration using the files and environment variables provided. See the [local development docs](</docs/guides/local-development/cli/config>) for more details.

## Sign in anonymously#

JavaScriptFlutterSwiftKotlinPython

Call the [`signInAnonymously()`](</docs/reference/javascript/auth-signinanonymously>) method:
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    const { data, error } = await supabase.auth.signInAnonymously()
[/code]

## Convert an anonymous user to a permanent user#

Converting an anonymous user to a permanent user requires [linking an identity](</docs/guides/auth/auth-identity-linking#manual-linking-beta>) to the user. This requires you to [enable manual linking](</dashboard/project/_/auth/providers>) in your Supabase project.

### Link an email / phone identity#

JavaScriptFlutterSwiftKotlinPython

You can use the [`updateUser()`](</docs/reference/javascript/auth-updateuser>) method to link an email or phone identity to the anonymous user. To add a password for the anonymous user, the user's email or phone number needs to be verified first.
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    const { data: updateEmailData, error: updateEmailError } = await supabase.auth.updateUser({
    
    7
    
      email: 'valid.email@supabase.io',
    
    8
    
    })
    
    9
    
    10
    
    // verify the user's email by clicking on the email change link
    
    11
    
    // or entering the 6-digit OTP sent to the email address
    
    12
    
    13
    
    // once the user has been verified, update the password
    
    14
    
    const { data: updatePasswordData, error: updatePasswordError } = await supabase.auth.updateUser({
    
    15
    
      password: 'password',
    
    16
    
    })
[/code]

### Link an OAuth identity#

JavaScriptFlutterSwiftKotlinPython

You can use the [`linkIdentity()`](</docs/reference/javascript/auth-linkidentity>) method to link an OAuth identity to the anonymous user.
[code]
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    3
    
    const supabase = createClient('https://your-project-id.supabase.co', 'sb_publishable_...')
    
    4
    
    5
    
    // ---cut---
    
    6
    
    const { data, error } = await supabase.auth.linkIdentity({ provider: 'google' })
[/code]

## Access control#

An anonymous user assumes the `authenticated` role like a permanent user. You can use row-level security (RLS) policies to differentiate between an anonymous user and a permanent user by checking for the `is_anonymous` claim in the JWT returned by `auth.jwt()`:
[code] 
    1
    
    create policy "Only permanent users can post to the news feed"
    
    2
    
    on news_feed as restrictive for insert
    
    3
    
    to authenticated
    
    4
    
    with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false );
    
    5
    
    6
    
    create policy "Anonymous and permanent users can view the news feed"
    
    7
    
    on news_feed for select
    
    8
    
    to authenticated
    
    9
    
    using ( true );
[/code]

Use restrictive policies

RLS policies are permissive by default, which means that they are combined using an "OR" operator when multiple policies are applied. It is important to construct restrictive policies to ensure that the checks for an anonymous user are always enforced when combined with other policies. Be aware that a single 'restrictive' RLS policy alone will fail unless combined with another policy that returns true, ensuring the combined condition is met.

## Resolving identity conflicts#

Depending on your application requirements, data conflicts can arise when an anonymous user is converted to a permanent user. For example, in the context of an e-commerce application, an anonymous user would be allowed to add items to the shopping cart without signing up / signing in. When they decide to sign-in to an existing account, you will need to decide how you want to resolve data conflicts in the shopping cart:

  1. Overwrite the items in the cart with those in the existing account
  2. Overwrite the items in the cart with those from the anonymous user
  3. Merge the items in the cart together


### Linking an anonymous user to an existing account#

In some cases, you may need to link an anonymous user to an existing account rather than creating a new permanent account. This process requires manual handling of potential conflicts. Here's a general approach:
[code] 
    1
    
    // 1. Get the current session and verify the user is anonymous
    
    2
    
    const { data: anonData, error: anonError } = await supabase.auth.getSession()
    
    3
    
    4
    
    if (!anonData.session?.user?.is_anonymous) {
    
    5
    
      console.log('User is not anonymous. This flow only applies to anonymous users.')
    
    6
    
      return
    
    7
    
    }
    
    8
    
    9
    
    // 2. Attempt to update the user with the existing email
    
    10
    
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    
    11
    
      email: 'valid.email@supabase.io',
    
    12
    
    })
    
    13
    
    14
    
    // 3. Handle the error (since the email belongs to an existing user)
    
    15
    
    if (updateError) {
    
    16
    
      console.log('This email belongs to an existing user. Please sign in to that account.')
    
    17
    
    18
    
      // 4. Sign in to the existing account
    
    19
    
      const {
    
    20
    
        data: { user: existingUser },
    
    21
    
        error: signInError,
    
    22
    
      } = await supabase.auth.signInWithPassword({
    
    23
    
        email: 'valid.email@supabase.io',
    
    24
    
        password: 'user_password',
    
    25
    
      })
    
    26
    
    27
    
      if (existingUser) {
    
    28
    
        // 5. Reassign entities tied to the anonymous user
    
    29
    
        // This step will vary based on your specific use case and data model
    
    30
    
        const { data: reassignData, error: reassignError } = await supabase
    
    31
    
          .from('your_table')
    
    32
    
          .update({ user_id: existingUser.id })
    
    33
    
          .eq('user_id', anonData.session.user.id)
    
    34
    
    35
    
        // 6. Implement your chosen conflict resolution strategy
    
    36
    
        // This could involve merging data, overwriting, or other custom logic
    
    37
    
        await resolveDataConflicts(anonData.session.user.id, existingUser.id)
    
    38
    
      }
    
    39
    
    }
    
    40
    
    41
    
    // Helper function to resolve data conflicts (implement based on your strategy)
    
    42
    
    async function resolveDataConflicts(anonymousUserId, existingUserId) {
    
    43
    
      // Implement your conflict resolution logic here
    
    44
    
      // This could involve ignoring the anonymous user's metadata, overwriting the existing user's metadata, or merging the data of both the anonymous and existing user.
    
    45
    
    }
[/code]

## Abuse prevention and rate limits#

Since anonymous users are stored in your database, bad actors can abuse the endpoint to increase your database size drastically. It is strongly recommended to [enable invisible CAPTCHA or Cloudflare Turnstile](</docs/guides/auth/auth-captcha>) to prevent abuse for anonymous sign-ins. An IP-based rate limit is enforced at 30 requests per hour which can be modified in your [dashboard](</dashboard/project/_/auth/rate-limits>). You can refer to the full list of rate limits [here](</docs/guides/deployment/going-into-prod#rate-limiting-resource-allocation--abuse-prevention>).

## Automatic cleanup#

Automatic cleanup of anonymous users is currently not available. Instead, you can delete anonymous users from your project by running the following SQL:
[code] 
    1
    
    -- deletes anonymous users created more than 30 days ago
    
    2
    
    delete from auth.users
    
    3
    
    where is_anonymous is true and created_at < now() - interval '30 days';
[/code]

## Resources#

  * [Supabase - Get started for free](<https://supabase.com>)
  * [Supabase JS Client](<https://github.com/supabase/supabase-js>)
  * [Supabase Flutter Client](<https://github.com/supabase/supabase-flutter>)
  * [Supabase Kotlin Client](<https://github.com/supabase-community/supabase-kt>)