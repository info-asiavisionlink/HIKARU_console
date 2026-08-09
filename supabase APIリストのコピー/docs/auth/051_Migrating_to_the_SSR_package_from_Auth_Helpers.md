---
タイトル: Migrating to the SSR package from Auth Helpers
URL: https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, from, helpers, migrating, migrating-to-ssr-from-auth-helpers, package, server-side
---

# Migrating to the SSR package from Auth Helpers

**URL:** https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, from, helpers, migrating, migrating-to-ssr-from-auth-helpers, package, server-side

## 目次

- [Replacing Supabase packages#](#replacing-supabase-packages)
- [Creating a client#](#creating-a-client)
- [Next steps#](#next-steps)

## 概要

Step-by-step guide to migrating your app to the new SSR package

---

The new `ssr` package takes the core concepts of the Auth Helpers and makes them available to any server language or framework. This page will guide you through migrating from the Auth Helpers package to `ssr`.

## Replacing Supabase packages#

Next.jsSvelteKitRemix
[code]
    1
    
    npm uninstall @supabase/auth-helpers-nextjs
[/code]
[code] 
    1
    
    npm install @supabase/ssr
[/code]

## Creating a client#

The new `ssr` package exports two functions for creating a Supabase client. The `createBrowserClient` function is used in the client, and the `createServerClient` function is used in the server.

Read the [Creating a client](</docs/guides/auth/server-side/creating-a-client>) page for examples of creating a client in your framework [and our migration guide](</docs/guides/troubleshooting/how-to-migrate-from-supabase-auth-helpers-to-ssr-package-5NRunM>).

## Next steps#

  * Implement [Authentication using Email and Password](</docs/guides/auth/passwords>)
  * Implement [Authentication using OAuth](</docs/guides/auth/social-login>)
  * [Learn more about SSR](</docs/guides/auth/server-side/advanced-guide>)