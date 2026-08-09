---
タイトル: Server-Side Rendering
URL: https://supabase.com/docs/guides/auth/server-side
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, rendering, server, server-side, side
---

# Server-Side Rendering

**URL:** https://supabase.com/docs/guides/auth/server-side
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, rendering, server, server-side, side

## 目次

- [@supabase/ssr#](#supabasessr)
- [Framework quickstarts#](#framework-quickstarts)

## 概要

How SSR works with Supabase Auth.

---

SSR frameworks move rendering and data fetches to the server, to reduce client bundle size and execution time.

Supabase Auth is fully compatible with SSR. You need to make a few changes to the configuration of your Supabase client, to store the user session in cookies instead of local storage. After setting up your Supabase client, follow the instructions for any flow in the How-To guides.

Make sure to use the PKCE flow instructions where those differ from the implicit flow instructions. If no difference is mentioned, don't worry about this.

## `@supabase/ssr`#

We have developed an [`@supabase/ssr`](<https://www.npmjs.com/package/@supabase/ssr>) package for setting up the Supabase client. This package is currently in beta. Adoption is recommended but be aware that the API is still unstable and may have breaking changes in the future.

## Framework quickstarts#

[![](/docs/img/icons/nextjs-icon.svg)Next.jsAutomatically configure Supabase in Next.js to use cookies, making your user and their session available on the client and server.](</docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs>)[![](/docs/img/icons/svelte-icon.svg)SvelteKitAutomatically configure Supabase in SvelteKit to use cookies, making your user and their session available on the client and server.](</docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=sveltekit>)