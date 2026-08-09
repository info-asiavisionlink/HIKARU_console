---
タイトル: Auth
URL: https://supabase.com/docs/guides/auth
カテゴリ: auth
更新日: 2026-08-02
タグ: auth
---

# Auth

**URL:** https://supabase.com/docs/guides/auth
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth

## 目次

- [About authentication and authorization#](#about-authentication-and-authorization)
- [The Supabase ecosystem#](#the-supabase-ecosystem)
- [Get started#](#get-started)
- [Providers#](#providers)
  - [Social Auth#](#social-auth)
  - [Phone Auth#](#phone-auth)
- [Pricing#](#pricing)
- [Next steps#](#next-steps)

## 概要

Use Supabase to authenticate and authorize your users.

---

Supabase Auth makes it easy to implement authentication and authorization in your app. We provide client SDKs and API endpoints to help you create and manage users.

Your users can use many popular Auth methods, including password, magic link, one-time password (OTP), social login, and single sign-on (SSO).

## About authentication and authorization#

Authentication and authorization are the core responsibilities of any Auth system.

  * **Authentication** means checking that a user is who they say they are.
  * **Authorization** means checking what resources a user is allowed to access.


Supabase Auth uses [JSON Web Tokens (JWTs)](</docs/guides/auth/jwts>) for authentication. For a complete reference of all JWT fields, see the [JWT Fields Reference](</docs/guides/auth/jwt-fields>). Auth integrates with Supabase's database features, making it easy to use [Row Level Security (RLS)](</docs/guides/database/postgres/row-level-security>) for authorization.

## The Supabase ecosystem#

You can use Supabase Auth as a standalone product, but it's also built to integrate with the Supabase ecosystem.

Auth uses your project's Postgres database under the hood, storing user data and other Auth information in a special schema. You can connect this data to your own tables using triggers and foreign key references.

Auth also enables access control to your database's automatically generated [REST API](</docs/guides/api>). When using Supabase SDKs, your data requests are automatically sent with the user's Auth Token. The Auth Token scopes database access on a row-by-row level when used along with [RLS policies](</docs/guides/database/postgres/row-level-security>).

## Get started#

Start here if you're new to Supabase Auth:

  * [Auth with email and passwordSign up and sign in users with email and password.](</docs/guides/auth/passwords>)
  * [Server-side renderingCreate a Supabase client for SSR frameworks like Next.js and SvelteKit.](</docs/guides/auth/server-side>)
  * [Which package to usesupabase-js vs @supabase/ssr vs @supabase/server — which to use on the server.](</docs/guides/auth/choosing-a-server-package>)
  * [Row Level SecurityUse RLS policies to authorize data access from the client.](</docs/guides/database/postgres/row-level-security>)


## Providers#

Supabase Auth works with many popular Auth methods, including Social and Phone Auth using third-party providers. See the following sections for a list of supported third-party providers.

### Social Auth#

  * [![](/docs/img/icons/apple-icon.svg)Apple](</docs/guides/auth/social-login/auth-apple>)
  * [![](/docs/img/icons/microsoft-icon.svg)Azure (Microsoft)](</docs/guides/auth/social-login/auth-azure>)
  * [![](/docs/img/icons/bitbucket-icon.svg)Bitbucket](</docs/guides/auth/social-login/auth-bitbucket>)
  * [![](/docs/img/icons/discord-icon.svg)Discord](</docs/guides/auth/social-login/auth-discord>)
  * [![](/docs/img/icons/facebook-icon.svg)Facebook](</docs/guides/auth/social-login/auth-facebook>)
  * [![](/docs/img/icons/figma-icon.svg)Figma](</docs/guides/auth/social-login/auth-figma>)
  * [![](/docs/img/icons/github-icon-light.svg)![](/docs/img/icons/github-icon.svg)GitHub](</docs/guides/auth/social-login/auth-github>)
  * [![](/docs/img/icons/gitlab-icon.svg)GitLab](</docs/guides/auth/social-login/auth-gitlab>)
  * [![](/docs/img/icons/google-icon.svg)Google](</docs/guides/auth/social-login/auth-google>)
  * [![](/docs/img/icons/kakao-icon.svg)Kakao](</docs/guides/auth/social-login/auth-kakao>)
  * [![](/docs/img/icons/keycloak-icon.svg)Keycloak](</docs/guides/auth/social-login/auth-keycloak>)
  * [![](/docs/img/icons/linkedin-icon.svg)LinkedIn](</docs/guides/auth/social-login/auth-linkedin>)
  * [![](/docs/img/icons/notion-icon.svg)Notion](</docs/guides/auth/social-login/auth-notion>)
  * [![](/docs/img/icons/slack-icon.svg)Slack](</docs/guides/auth/social-login/auth-slack>)
  * [![](/docs/img/icons/spotify-icon.svg)Spotify](</docs/guides/auth/social-login/auth-spotify>)
  * [![](/docs/img/icons/twitter-icon-light.svg)![](/docs/img/icons/twitter-icon.svg)Twitter](</docs/guides/auth/social-login/auth-twitter>)
  * [![](/docs/img/icons/twitch-icon.svg)Twitch](</docs/guides/auth/social-login/auth-twitch>)
  * [![](/docs/img/icons/workos-icon.svg)WorkOS](</docs/guides/auth/social-login/auth-workos>)
  * [![](/docs/img/icons/zoom-icon.svg)Zoom](</docs/guides/auth/social-login/auth-zoom>)


You can also add any OAuth2 or OIDC-compatible identity provider using [Custom OAuth/OIDC Providers](</docs/guides/auth/custom-oauth-providers>).

### Phone Auth#

  * [![](/docs/img/icons/messagebird-icon.svg)MessageBird](</docs/guides/auth/phone-login?showSmsProvider=MessageBird>)
  * [![](/docs/img/icons/twilio-icon.svg)Twilio](</docs/guides/auth/phone-login?showSmsProvider=Twilio>)
  * [![](/docs/img/icons/vonage-icon-light.svg)![](/docs/img/icons/vonage-icon.svg)Vonage](</docs/guides/auth/phone-login?showSmsProvider=Vonage>)


## Pricing#

Charges apply to Monthly Active Users (MAU), Monthly Active Third-Party Users (Third-Party MAU), and Monthly Active SSO Users (SSO MAU) and Advanced MFA Add-ons. For a detailed breakdown of how these charges are calculated, refer to the following pages.

  * [**Pricing MAU** : How MAU usage is measured and billed.](</docs/guides/platform/manage-your-usage/monthly-active-users>)
  * [**Pricing Third-Party MAU** : How third-party auth MAU is measured and billed.](</docs/guides/platform/manage-your-usage/monthly-active-users-third-party>)
  * [**Pricing SSO MAU** : How SSO MAU usage is measured and billed.](</docs/guides/platform/manage-your-usage/monthly-active-users-sso>)
  * [**Advanced MFA - Phone** : How Advanced MFA Phone add-on usage is measured and billed.](</docs/guides/platform/manage-your-usage/advanced-mfa-phone>)


## Next steps#

Once you've covered the basics, these guides help with other use cases and features:

  * [Email (Magic link or OTP)Sign up and sign in users with a Magic Link or email OTP instead of a password.](</docs/guides/auth/auth-email-passwordless>)
  * [Enterprise SSOAdd Single Sign-On for enterprise applications with SAML 2.0.](</docs/guides/auth/enterprise-sso>)
  * [User sessionsControl session lifetime, refresh tokens, and multi-device sign-in behavior.](</docs/guides/auth/sessions>)
  * [Third-party authUse Clerk, Auth0, Firebase Auth, Cognito, or WorkOS JWTs with Supabase APIs.](</docs/guides/auth/third-party/overview>)
  * [Multi-factor authenticationAdd a second factor to user sign-in with TOTP or phone.](</docs/guides/auth/auth-mfa>)
  * [JWTsUnderstand how Supabase Auth issues and validates JWTs.](</docs/guides/auth/jwts>)
  * [Auth HooksCustomize Auth behavior with Postgres functions at key lifecycle points.](</docs/guides/auth/auth-hooks>)