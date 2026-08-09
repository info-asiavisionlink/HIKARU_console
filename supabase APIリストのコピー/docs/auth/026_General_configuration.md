---
タイトル: General configuration
URL: https://supabase.com/docs/guides/auth/general-configuration
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, configuration, general, general-configuration
---

# General configuration

**URL:** https://supabase.com/docs/guides/auth/general-configuration
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, configuration, general, general-configuration

## 目次

（目次なし）

## 概要

General configuration options for Supabase Auth

---

This section covers the [general configuration options](</dashboard/project/_/auth>) for Supabase Auth. If you are looking for another type of configuration, you may be interested in one of the following sections:

  * [Policies](</dashboard/project/_/database/policies>) to manage Row Level Security policies for your tables.
  * [Sign In / Providers](</dashboard/project/_/auth/providers>) to configure authentication providers and login methods for your users.
  * [Third Party Auth](</dashboard/project/_/auth/third-party>) to use third-party authentication (TPA) systems based on JWTs to access your project.
  * [Sessions](</dashboard/project/_/auth/sessions>) to configure settings for user sessions and refresh tokens.
  * [Rate limits](</dashboard/project/_/auth/rate-limits>) to safeguard against bursts of incoming traffic to prevent abuse and maximize stability.
  * [Email Templates](</dashboard/project/_/auth/templates>) to configure what emails your users receive.
  * [Custom SMTP](</dashboard/project/_/auth/smtp>) to configure how emails are sent.
  * [Multi-Factor](</dashboard/project/_/auth/mfa>) to require users to provide additional verification factors to authenticate.
  * [URL Configuration](</dashboard/project/_/auth/url-configuration>) to configure site URL and redirect URLs for authentication. Read more [in the redirect URLs documentation](</docs/guides/auth/redirect-urls>).
  * [Attack Protection](</dashboard/project/_/auth/protection>) to configure security settings to protect your project from attacks.
  * [Auth Hooks (BETA)](</dashboard/project/_/auth/auth-hooks>) to use Postgres functions or HTTP endpoints to customize the behavior of Supabase Auth to meet your needs.
  * [Audit Logs (BETA)](</dashboard/project/_/auth/audit-logs>) to track and monitor auth events in your project.
  * [Performance](</dashboard/project/_/auth/performance>) to configure and optimize authentication server settings.


Supabase Auth provides these [general configuration options](</dashboard/project/_/auth/providers>) to control user access to your application:

  * **Allow new users to sign up** : Users will be able to sign up. If this config is disabled, only existing users can sign in.

  * **Confirm Email** : Users will need to confirm their email address before signing in for the first time.

    * Having **Confirm Email** disabled assumes that the user's email does not need to be verified in order to login and implicitly confirms the user's email in the database.
    * This option can be found in the email provider under the provider-specific configuration.
  * **Allow anonymous sign-ins** : Allow anonymous users to be created.

  * **Allow manual linking** : Allow users to link their accounts manually.