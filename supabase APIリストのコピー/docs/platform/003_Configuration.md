---
タイトル: Configuration
URL: https://supabase.com/docs/guides/deployment/branching/configuration
カテゴリ: platform
更新日: 2026-08-02
タグ: branching, configuration, deployment, platform
---

# Configuration

**URL:** https://supabase.com/docs/guides/deployment/branching/configuration
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** branching, configuration, deployment, platform

## 目次

- [Branch configuration with remotes#](#branch-configuration-with-remotes)
  - [Basic configuration#](#basic-configuration)
  - [Remote-specific configuration#](#remote-specific-configuration)
  - [Configuration merging#](#configuration-merging)
  - [Available configuration options#](#available-configuration-options)
- [Managing secrets for branches#](#managing-secrets-for-branches)
  - [Using dotenvx for git-based workflow#](#using-dotenvx-for-git-based-workflow)
- [Configuration examples#](#configuration-examples)
  - [Multi-environment setup#](#multi-environment-setup)
  - [Feature branch configuration#](#feature-branch-configuration)
- [Next steps#](#next-steps)

## 概要

Configure your Supabase branches using configuration as code

---

This guide covers how to configure your Supabase branches, using the `config.toml` file. In one single file, you can configure all your branches, including branch settings and secrets.

## Branch configuration with remotes#

When Branching is enabled, your `config.toml` settings automatically sync to all ephemeral branches through a one-to-one mapping between your Git and Supabase branches.

### Basic configuration#

To update configuration for a Supabase branch, modify `config.toml` and push to git. The Supabase integration will detect the changes and apply them to the corresponding branch.

### Remote-specific configuration#

For persistent branches that need specific settings, you can use the `[remotes]` block in your `config.toml`. Each remote configuration must reference an existing project ID.

Here's an example of configuring a separate seed script for a staging environment:
[code] 
    1
    
    [remotes.staging]
    
    2
    
    project_id = "your-project-ref"
    
    3
    
    4
    
    [remotes.staging.db.seed]
    
    5
    
    enabled = true
    
    6
    
    sql_paths = ["./seeds/staging.sql"]
[/code]

Since the `project_id` field must reference an existing branch, you need to create the persistent branch before adding its configuration. Use the CLI to create a persistent branch first:
[code] 
    1
    
    supabase --experimental branches create --persistent
    
    2
    
    # Do you want to create a branch named develop? [Y/n]
[/code]

To retrieve the project ID for an existing branch, use the `branches list` command:
[code]
    1
    
    supabase --experimental branches list
[/code]

This will display a table showing all your branches with their corresponding project ID. Use the value from the `BRANCH PROJECT ID` column as your `project_id` in the remote configuration.

### Configuration merging#

When merging a PR into a persistent branch, the Supabase integration:

  1. Checks for configuration changes
  2. Logs the changes
  3. Applies them to the target remote


If no remote is declared or the project ID is incorrect, the configuration step is skipped.

### Available configuration options#

All standard configuration options are available in the `[remotes]` block. This includes:

  * Database settings
  * API configurations
  * Authentication settings
  * Edge Functions configuration
  * And more


You can use this to maintain different configurations for different environments while keeping them all in version control.

## Managing secrets for branches#

For sensitive configuration like SMTP credentials or API keys, you can use the Supabase CLI to manage secrets for your branches. This is especially useful for custom SMTP setup or other services that require secure credentials.

To set secrets for a persistent branch:
[code] 
    1
    
    # Set secrets from a .env file
    
    2
    
    supabase secrets set --env-file ./supabase/.env
    
    3
    
    4
    
    # Or set individual secrets
    
    5
    
    supabase secrets set SMTP_HOST=smtp.example.com
    
    6
    
    supabase secrets set SMTP_USER=your-username
    
    7
    
    supabase secrets set SMTP_PASSWORD=your-password
[/code]

These secrets will be available to your branch's services and can be used in your configuration. For example, in your `config.toml`:
[code] 
    1
    
    [auth.smtp]
    
    2
    
    host = "env(SMTP_HOST)"
    
    3
    
    user = "env(SMTP_USER)"
    
    4
    
    password = "env(SMTP_PASSWORD)"
[/code]

Secrets are branch-specific

Secrets set for one branch are not automatically available in other branches. You'll need to set them separately for each branch that needs them.

### Using dotenvx for git-based workflow#

For managing environment variables across different branches, you can use [dotenvx](<https://dotenvx.com/>) to securely manage your configurations. This approach is particularly useful for teams working with Git branches and preview deployments.

#### Environment file structure#

Following the conventions used in the [example repository](<https://github.com/supabase/supabase/blob/master/examples/slack-clone/nextjs-slack-clone-dotenvx/README.md>), environments are configured using dotenv files in the `supabase` directory:

File| Environment| `.gitignore` it?| Encrypted  
---|---|---|---  
.env.keys| All| Yes| No  
.env.local| Local| Yes| No  
.env.production| Production| No| Yes  
.env.preview| Branches| No| Yes  
.env| Any| Maybe| Yes  
  
#### Setting up encrypted secrets#

  1. Generate key pair and encrypt your secrets:


[code] 
    1
    
    npx @dotenvx/dotenvx set SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET "<your-secret>" -f supabase/.env.preview
[/code]

This creates a new encryption key in `supabase/.env.preview` and a new decryption key in `supabase/.env.keys`.

  2. Update project secrets:


[code] 
    1
    
    npx supabase secrets set --env-file supabase/.env.keys
[/code]

  3. Choose your configuration approach in `config.toml`:


Option A: Use encrypted values directly:
[code] 
    1
    
    [auth.external.github]
    
    2
    
    enabled = true
    
    3
    
    secret = "encrypted:<encrypted-value>"
[/code]

Option B: Use environment variables:
[code] 
    1
    
    [auth.external.github]
    
    2
    
    enabled = true
    
    3
    
    client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
    
    4
    
    secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
[/code]

Secret fields

The `encrypted:` syntax only works for designated "secret" fields in the configuration. Using encrypted values in other fields will not be automatically decrypted and may cause issues. For non-secret fields, use environment variables with the `env()` syntax instead.

The following fields support the `encrypted:` syntax:

**Studio**

  * `studio.openai_api_key`


**Database**

  * `db.root_key`
  * `db.vault.*` (any key in the vault map)


**Auth - Core Keys**

  * `auth.publishable_key`
  * `auth.secret_key`
  * `auth.jwt_secret`


**Auth - Email (SMTP)**

  * `auth.email.smtp.pass`


**Auth - Captcha**

  * `auth.captcha.secret`


**Auth - Hooks**

  * `auth.hook.mfa_verification_attempt.secrets`
  * `auth.hook.password_verification_attempt.secrets`
  * `auth.hook.custom_access_token.secrets`
  * `auth.hook.send_sms.secrets`
  * `auth.hook.send_email.secrets`
  * `auth.hook.before_user_created.secrets`


**Auth - SMS Providers**

  * `auth.sms.twilio.auth_token`
  * `auth.sms.twilio_verify.auth_token`
  * `auth.sms.messagebird.access_key`
  * `auth.sms.textlocal.api_key`
  * `auth.sms.vonage.api_secret`


**Auth - External OAuth Providers**

  * `auth.external.*.secret`


**Edge Runtime**

  * `edge_runtime.secrets.*` (any key in the secrets map)


#### Using with preview branches#

When you commit your `.env.preview` file with encrypted values, the branching executor will automatically retrieve and use these values when deploying your branch. This allows you to maintain different configurations for different branches while keeping sensitive information secure.

## Configuration examples#

### Multi-environment setup#

Here's an example of a complete multi-environment configuration:
[code] 
    1
    
    # Default configuration for all branches
    
    2
    
    [api]
    
    3
    
    enabled = true
    
    4
    
    port = 54321
    
    5
    
    schemas = ["public", "storage", "graphql_public"]
    
    6
    
    7
    
    [db]
    
    8
    
    port = 54322
    
    9
    
    pool_size = 10
    
    10
    
    11
    
    # Staging-specific configuration
    
    12
    
    [remotes.staging]
    
    13
    
    project_id = "staging-project-ref"
    
    14
    
    15
    
    [remotes.staging.api]
    
    16
    
    max_rows = 1000
    
    17
    
    18
    
    [remotes.staging.db.seed]
    
    19
    
    sql_paths = ["./seeds/staging.sql"]
    
    20
    
    21
    
    # Production-specific configuration
    
    22
    
    [remotes.production]
    
    23
    
    project_id = "prod-project-ref"
    
    24
    
    25
    
    [remotes.production.api]
    
    26
    
    max_rows = 500
    
    27
    
    28
    
    [remotes.production.db]
    
    29
    
    pool_size = 25
[/code]

To retrieve the project ID for an existing branch, use the `branches list` command:
[code]
    1
    
    supabase --experimental branches list
[/code]

This will display a table showing all your branches with their corresponding project ID. Use the value from the `BRANCH PROJECT ID` column as your `project_id` in the remote configuration.

### Feature branch configuration#

For feature branches that need specific settings:
[code] 
    1
    
    [remotes.feature-oauth]
    
    2
    
    project_id = "feature-branch-ref"
    
    3
    
    4
    
    [remotes.feature-oauth.auth.external.google]
    
    5
    
    enabled = true
    
    6
    
    client_id = "env(GOOGLE_CLIENT_ID)"
    
    7
    
    secret = "env(GOOGLE_CLIENT_SECRET)"
[/code]

To retrieve the project ID for an existing branch, use the `branches list` command:
[code]
    1
    
    supabase --experimental branches list
[/code]

This will display a table showing all your branches with their corresponding project ID. Use the value from the `BRANCH PROJECT ID` column as your `project_id` in the remote configuration.

## Next steps#

  * Explore [branching integrations](</docs/guides/deployment/branching/integrations>)
  * Learn about [troubleshooting branches](</docs/guides/deployment/branching/troubleshooting>)
  * Review [branching pricing](</docs/guides/platform/manage-your-usage/branching#pricing>)