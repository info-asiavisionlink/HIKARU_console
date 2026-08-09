---
タイトル: Social Login
URL: https://supabase.com/docs/guides/auth/social-login
カテゴリ: auth
更新日: 2026-08-02
タグ: auth, login, social, social-login
---

# Social Login

**URL:** https://supabase.com/docs/guides/auth/social-login
**カテゴリ:** auth
**更新日:** 2026-08-02
**タグ:** auth, login, social, social-login

## 目次

- [Benefits#](#benefits)
- [Set up a social provider with Supabase Auth#](#set-up-a-social-provider-with-supabase-auth)
- [Provider tokens#](#provider-tokens)

## 概要

Logging in with social accounts

---

Social Login (OAuth) is an open standard for authentication that allows users to log in to one website or application using their credentials from another website or application. OAuth allows users to grant third-party applications access to their online accounts without sharing their passwords. OAuth is commonly used for things like logging in to a social media account from a third-party app. It is a secure and convenient way to authenticate users and share information between applications.

## Benefits#

There are several reasons why you might want to add social login to your applications:

  * **Improved user experience** : Users can register and log in to your application using their existing social media accounts, which can be faster and more convenient than creating a new account from scratch. This makes it easier for users to access your application, improving their overall experience.

  * **Better user engagement** : You can access additional data and insights about your users, such as their interests, demographics, and social connections. This can help you tailor your content and marketing efforts to better engage with your users and provide a more personalized experience.

  * **Increased security** : Social login can improve the security of your application by leveraging the security measures and authentication protocols of the social media platforms that your users are logging in with. This can help protect against unauthorized access and account takeovers.


## Set up a social provider with Supabase Auth#

Supabase supports a suite of social providers. Follow these guides to configure a social provider for your platform.

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


Need to integrate with a provider not listed here? You can add any OAuth2 or OIDC-compatible provider using [Custom OAuth/OIDC Providers](</docs/guides/auth/custom-oauth-providers>).

## Provider tokens#

You can use the provider token and provider refresh token returned to make API calls to the OAuth provider. For example, you can use the Google provider token to access Google APIs on behalf of your user.

Supabase Auth does not manage refreshing the provider token for the user. Your application will need to use the provider refresh token to obtain a new provider token. If no provider refresh token is returned, then it could mean one of the following:

  * The OAuth provider does not return a refresh token
  * Additional scopes need to be specified in order for the OAuth provider to return a refresh token.


Provider tokens are intentionally not stored in your project's database. This is because provider tokens give access to potentially sensitive user data in third-party systems. Different applications have different needs, and one application's OAuth scopes may be significantly more permissive than another. If you want to use the provider token outside of the browser that completed the OAuth flow, it is recommended to send it to a trusted and secure server you control.