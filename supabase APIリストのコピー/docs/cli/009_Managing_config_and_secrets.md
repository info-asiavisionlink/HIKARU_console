---
タイトル: Managing config and secrets
URL: https://supabase.com/docs/guides/local-development/managing-config
カテゴリ: cli
更新日: 2026-08-02
タグ: cli, config, local-development, managing, managing-config, secrets
---

# Managing config and secrets

**URL:** https://supabase.com/docs/guides/local-development/managing-config
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** cli, config, local-development, managing, managing-config, secrets

## 目次

- [Config reference#](#config-reference)
- [Using secrets inside config.toml#](#using-secrets-inside-configtoml)
  - [Going further#](#going-further)

## 概要

Managing local configuration using config.toml.

---

The Supabase CLI uses a `config.toml` file to manage local configuration. This file is located in the `supabase` directory of your project.

## Config reference#

The `config.toml` file is automatically created when you run `supabase init`.

There are a wide variety of options available, which can be found in the [CLI Config Reference](</docs/guides/local-development/cli/config>).

For example, to enable the "Apple" OAuth provider for local development, you can append the following information to `config.toml`:
[code] 
    1
    
    [auth.external.apple]
    
    2
    
    enabled = false
    
    3
    
    client_id = ""
    
    4
    
    secret = ""
    
    5
    
    redirect_uri = "" # Overrides the default auth redirectUrl.
[/code]

## Using secrets inside config.toml#

You can reference environment variables within the `config.toml` file using the `env()` function. This will detect any values stored in an `.env` file at the root of your project directory. This is particularly useful for storing sensitive information like API keys, and any other values that you don't want to check into version control.
[code] 
    1
    
    .
    
    2
    
    ├── .env
    
    3
    
    ├── .env.example
    
    4
    
    └── supabase
    
    5
    
        └── config.toml
[/code]

Do NOT commit your `.env` into git. Be sure to configure your `.gitignore` to exclude this file.

For example, if your `.env` contained the following values:
[code] 
    1
    
    GITHUB_CLIENT_ID=""
    
    2
    
    GITHUB_SECRET=""
[/code]

Then you would reference them inside of our `config.toml` like this:
[code] 
    1
    
    [auth.external.github]
    
    2
    
    enabled = true
    
    3
    
    client_id = "env(GITHUB_CLIENT_ID)"
    
    4
    
    secret = "env(GITHUB_SECRET)"
    
    5
    
    redirect_uri = "" # Overrides the default auth redirectUrl.
[/code]

### Going further#

For more advanced secrets management workflows, including:

  * **Using dotenvx for encrypted secrets** : Learn how to securely manage environment variables across different branches and environments
  * **Branch-specific secrets** : Understand how to manage secrets for different deployment environments
  * **Encrypted configuration values** : Use encrypted values directly in your `config.toml`


See the [Managing secrets for branches](</docs/guides/deployment/branching#managing-secrets-for-branches>) section in our branching documentation, or check out the [dotenvx example repository](<https://github.com/supabase/supabase/blob/master/examples/slack-clone/nextjs-slack-clone-dotenvx/README.md>) for a complete implementation.