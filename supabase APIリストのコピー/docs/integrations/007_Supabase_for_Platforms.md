---
タイトル: Supabase for Platforms
URL: https://supabase.com/docs/guides/integrations/supabase-for-platforms
カテゴリ: integrations
更新日: 2026-08-02
タグ: integrations, platforms, supabase, supabase-for-platforms
---

# Supabase for Platforms

**URL:** https://supabase.com/docs/guides/integrations/supabase-for-platforms
**カテゴリ:** integrations
**更新日:** 2026-08-02
**タグ:** integrations, platforms, supabase, supabase-for-platforms

## 目次

- [Overview#](#overview)
- [Launching projects#](#launching-projects)
  - [Nano compute instance#](#nano-compute-instance)
  - [Recommended API keys#](#recommended-api-keys)
- [Changing compute sizes#](#changing-compute-sizes)
- [Configuration changes#](#configuration-changes)
- [Development workflow#](#development-workflow)
  - [Creating aDEVbranch#](#creating-a-dev-branch)
  - [Make database changes#](#make-database-changes)
  - [Create a restore point#](#create-a-restore-point)
  - [Reverting changes#](#reverting-changes)
  - [Add seed data#](#add-seed-data)
  - [Deploying Edge Functions#](#deploying-edge-functions)
  - [Merge all changes#](#merge-all-changes)
- [Security checks for production#](#security-checks-for-production)
- [Disaster recovery for production#](#disaster-recovery-for-production)
- [Claim flow#](#claim-flow)
- [Platform kit#](#platform-kit)
- [Debugging projects#](#debugging-projects)

## 概要

Use Supabase as a platform for your own business and tools.

---

Supabase is a [Platform as a Service](<https://en.wikipedia.org/wiki/Platform_as_a_service>) (PaaS) that can be managed programmatically. You can use it to offer the key primitives to your own users, such as [Database](</docs/guides/database/overview>), [Auth](</docs/guides/auth>), [Edge Functions](</docs/guides/functions>), [Storage](</docs/guides/storage>), and [Realtime](</docs/guides/realtime>). Supabase is commonly used as a platform by AI Builders and frameworks needing a backend.

This document will guide you on best practices when using Supabase for your own platform and assumes that Supabase projects are in a Supabase organization that you own. If you want to instead interact with projects that your users own, navigate to [OAuth integration](</docs/guides/integrations/build-a-supabase-oauth-integration>) for more details.

![Platform as a Service](/docs/img/integrations/paas-intro.png)

## Overview#

All features of Supabase can be managed through the [Management API](</docs/reference/api/introduction>) or the [remote MCP Server](</docs/guides/ai-tools/mcp>).

## Launching projects#

Management API endpoints:

  * Create project: [`POST /v1/projects`](<https://api.supabase.com/api/v1#tag/projects/post/v1/projects>)
  * Get smart region selection codes: [`GET /v1/projects/available-regions`](<https://api.supabase.com/api/v1#tag/projects/get/v1/projects/available-regions>)
  * Check service health: [`GET /v1/projects/{ref}/health`](<https://api.supabase.com/api/v1#tag/projects/get/v1/projects/%7Bref%7D/health>)


We recommend:

  * **a _very_ secure password for each database**. Do not reuse the same password across databases.
  * **storing the encrypted version of the password**. Once you set the password during project creation, there is no way to programmatically change the password but you can do so manually in the Supabase Dashboard.
  * **using smart region selection to ensure there's enough capacity**. The available smart region codes are `americas`, `emea`, and `apac` and you can make a request to [`GET /v1/projects/available-regions`](<https://api.supabase.com/api/v1#tag/projects/get/v1/projects/available-regions>) for region details.
  * **using an appropriate instance size**. Scale to zero pricing only applies to Nano instances, make sure to not pass in a `desired_instance_size` when creating a project. >= Micro instances are not able to scale to zero.
  * **make sure that the services are`ACTIVE_HEALTHY` after project creation**. After creating project, confirm the service that you want to make a request to has a status of `ACTIVE_HEALTHY` by polling [`GET /v1/projects/{ref}/health`](<https://api.supabase.com/api/v1#tag/projects/get/v1/projects/%7Bref%7D/health>). For example, before making a request to set an Auth configuration confirm that the Auth service has a status of `ACTIVE_HEALTHY`.


[code] 
    1
    
    curl https://api.supabase.com/v1/projects \
    
    2
    
      --request POST \
    
    3
    
      --header "Content-Type: application/json" \
    
    4
    
      --header "Authorization: Bearer YOUR_SECRET_TOKEN" \
    
    5
    
      --data '{
    
    6
    
        "name": "Todo App",
    
    7
    
        "organization_slug": "aaaabbbbccccddddeeee",
    
    8
    
        "db_pass": "SUPER_SECURE_PASSWORD",
    
    9
    
        "region_selection": {
    
    10
    
          "type": "smartGroup",
    
    11
    
          "code": "americas"
    
    12
    
        },
    
    13
    
        "desired_instance_size": "micro"
    
    14
    
      }'
[/code]

### Nano compute instance#

Contact us for scale to zero pricing on Nano instances

Only select customers have access to scale to zero pricing on Nano instances. Submit this [form](</solutions/ai-builders#talk-to-partnerships-team>) to get access.

### Recommended API keys#

Management API endpoints:

  * Get the API keys: [`GET /v1/projects/{ref}/api-keys`](<https://api.supabase.com/api/v1#tag/secrets/get/v1/projects/%7Bref%7D/api-keys>)
  * Enable the API keys: [`POST /v1/projects/{ref}/api-keys`](<https://api.supabase.com/api/v1#tag/secrets/post/v1/projects/%7Bref%7D/api-keys>)


We are in the process of migrating away from our legacy API keys `anon` and `service_role` and towards API keys `publishable` and `secret`.

You can learn more by navigating to [Upcoming changes to Supabase API Keys #29260](<https://github.com/orgs/supabase/discussions/29260>).

Get the API keys by making a [`GET /v1/projects/{ref}/api-keys`](<https://api.supabase.com/api/v1#tag/secrets/get/v1/projects/%7Bref%7D/api-keys>) request.
[code] 
    1
    
    curl 'https://api.supabase.com/v1/projects/{ref}/api-keys?reveal=true' \
    
    2
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN'
[/code]

If the response includes `"publishable"` and `"secret"` keys then you're all set and you should only use those from now on.

Otherwise, enable the API keys by making two [`POST /v1/projects/{ref}/api-keys`](<https://api.supabase.com/api/v1#tag/secrets/post/v1/projects/%7Bref%7D/api-keys>) requests, one for `publishable` and another for `secret`.
[code] 
    1
    
    curl 'https://api.supabase.com/v1/projects/{ref}/api-keys' \
    
    2
    
      --request POST \
    
    3
    
      --header 'Content-Type: application/json' \
    
    4
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    5
    
      --data '{
    
    6
    
      "type": "publishable",
    
    7
    
      "name": "default"
    
    8
    
    }'
[/code]
[code] 
    1
    
    curl 'https://api.supabase.com/v1/projects/{ref}/api-keys?reveal=true' \
    
    2
    
      --request POST \
    
    3
    
      --header 'Content-Type: application/json' \
    
    4
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    5
    
      --data '{
    
    6
    
      "type": "secret",
    
    7
    
      "name": "default",
    
    8
    
      "secret_jwt_template": {
    
    9
    
        "role": "service_role"
    
    10
    
      }
    
    11
    
    }'
[/code]

## Changing compute sizes#

Management API endpoint: [`PATCH /v1/projects/{ref}/billing/addons`](<https://api.supabase.com/api/v1#tag/billing/patch/v1/projects/%7Bref%7D/billing/addons>)

You can upgrade and downgrade compute sizes by making requests to [`PATCH /v1/projects/{ref}/billing/addons`](<https://api.supabase.com/api/v1#tag/billing/patch/v1/projects/%7Bref%7D/billing/addons>).
[code] 
    1
    
    curl 'https://api.supabase.com/v1/projects/{ref}/billing/addons' \
    
    2
    
      --request PATCH \
    
    3
    
      --header 'Content-Type: application/json' \
    
    4
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    5
    
      --data '{
    
    6
    
        "addon_type": "compute_instance",
    
    7
    
        "addon_variant": "ci_small"
    
    8
    
      }'
[/code]

## Configuration changes#

Management API endpoints:

  * Auth: [`PATCH /v1/projects/{ref}/config/auth`](<https://api.supabase.com/api/v1#tag/auth/patch/v1/projects/%7Bref%7D/config/auth>)
  * Data API (PostgREST): [`PATCH /v1/projects/{ref}/postgrest`](<https://api.supabase.com/api/v1#tag/rest/patch/v1/projects/%7Bref%7D/postgrest>)
  * Edge Functions:
    * [`PATCH /v1/projects/{ref}/functions/{function_slug}`](<https://api.supabase.com/api/v1#tag/edge-functions/patch/v1/projects/%7Bref%7D/functions/%7Bfunction_slug%7D>)
    * [`PUT /v1/projects/{ref}/functions`](<https://api.supabase.com/api/v1#tag/edge-functions/put/v1/projects/%7Bref%7D/functions>)
  * Storage: [`PATCH /v1/projects/{ref}/config/storage`](<https://api.supabase.com/api/v1#tag/storage/patch/v1/projects/%7Bref%7D/config/storage>)
  * Realtime: [`PATCH /v1/projects/{ref}/config/realtime`](<https://api.supabase.com/api/v1#tag/realtime-config/patch/v1/projects/%7Bref%7D/config/realtime>)


You can manage the configuration of all services using the Management API.

## Development workflow#

Supabase is a _stateful_ service: we store data. If anything breaks in production, you can't "roll back" to a point in time because doing so might cause your users to lose any data that their production environment received since the last checkpoint.

Because of this, it's important that you adopt a development workflow on behalf of your users:

![Change flow](/docs/img/integrations/change-flow.png)

### Creating a `DEV` branch#

Management API endpoint: [`POST /v1/projects/{ref}/branches`](<https://api.supabase.com/api/v1#tag/environments/post/v1/projects/%7Bref%7D/branches>)

After launching a project, it's important that all changes happen on a development branch. Branches can be treated like ephemeral servers: if anything goes wrong you can either revert the changes or destroy the branch and create a new one based off of production.
[code] 
    1
    
    curl 'https://api.supabase.com/v1/projects/{ref}/branches' \
    
    2
    
      --request POST \
    
    3
    
      --header 'Content-Type: application/json' \
    
    4
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    5
    
      --data '{
    
    6
    
        "branch_name": "DEV",
    
    7
    
        "secrets": {
    
    8
    
          "STRIPE_SECRET_KEY":"sk_test_123...",
    
    9
    
          "STRIPE_PUBLISHABLE_KEY":"pk_test_123..."
    
    10
    
        }
    
    11
    
      }'
[/code]

### Make database changes#

Management API endpoint: [`POST /v1/projects/{ref}/database/migrations`](<https://api.supabase.com/api/v1#tag/database/post/v1/projects/%7Bref%7D/database/migrations>)

Contact us for access to migrations endpoint

Only select customers have access to database migrations endpoint. Submit this [form](</solutions/ai-builders#talk-to-partnerships-team>) to get access.

For this example we will create a todos table using the [`POST /v1/projects/{ref}/database/migrations`](<https://api.supabase.com/api/v1#tag/database/post/v1/projects/%7Bref%7D/database/migrations>) endpoint.
[code] 
    1
    
    create table public.todos (
    
    2
    
      id serial primary key,
    
    3
    
      task text not null
    
    4
    
    );
    
    5
    
    6
    
    alter table public.todos
    
    7
    
    enable row level security;
[/code]

This endpoint will automatically create a migration inside the `supabase_migrations` schema and run the migration. If the schema migration fails, the changes will be rolled back.
[code] 
    1
    
    curl https://api.supabase.com/v1/projects/{ref}/database/migrations \
    
    2
    
      --request POST \
    
    3
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    4
    
      --header 'Content-Type: application/json' \
    
    5
    
      --data '{
    
    6
    
        "query": "create table public.todos (id serial primary key, task text not null); grant select on public.todos to anon; grant select, insert, update, delete on public.todos to authenticated; grant select, insert, update, delete on public.todos to service_role; alter table public.todos enable row level security;",
    
    7
    
        "name": "Create a todos table"
    
    8
    
      }'
[/code]

### Create a restore point#

Contact us for access to restore points

Only select customers have access to restore points. Submit this [form](</solutions/ai-builders#talk-to-partnerships-team>) to get access.

After every change you make to the database, it's a good idea to create a restore point. This will allow you to roll back the database if you decide to go in a different direction.

Beware that only database changes are captured when creating a restore point.
[code] 
    1
    
    curl https://api.supabase.com/v1/projects/{ref}/database/backups/restore-point \
    
    2
    
      --request POST \
    
    3
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    4
    
      --header 'Content-Type: application/json' \
    
    5
    
      --data '{
    
    6
    
        "name": "abcdefg"
    
    7
    
      }'
[/code]

### Reverting changes#

![Revert](/docs/img/integrations/revert.png)

Contact us for access to restore points

Only select customers have access to restore points. Submit this [form](</solutions/ai-builders#talk-to-partnerships-team>) to get access.

After creating restore points, you are able to revert back to any restore point that you want.
[code] 
    1
    
    curl https://api.supabase.com/v1/projects/{ref}/database/backups/undo \
    
    2
    
      --request POST \
    
    3
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    4
    
      --header 'Content-Type: application/json' \
    
    5
    
      --data '{
    
    6
    
      "name": "abcdefg"
    
    7
    
    }'
[/code]

When you revert changes, you are undo-ing all database changes since the specified restore point, including:

  * Schema changes
  * Any seed data that you inserted
  * Any test users who have signed up (and auth tokens for sign ins)
  * Pointers to files in Supabase Storage.


It will not affect:

  * Configuration changes
  * Any secrets that have been added
  * Storage objects themselves
  * Any deployed Edge Functions


### Add seed data#

Do not use production data in branches!

It's important that the data in development branches is NOT production data, especially for non-developers who don't understand the implications of working with data. Security and side-effects (e.g. emailing all production users) are two reasons why this is important.

In `DEV` branches, seed data is common test data for users. Insert the following seed into the new todos table:
[code] 
    1
    
    insert into todos (task)
    
    2
    
    values
    
    3
    
      ('Task 1'),
    
    4
    
      ('Task 2'),
    
    5
    
      ('Task 3');
[/code]

You can use the `POST /database/query` endpoint to add data:
[code] 
    1
    
    curl https://api.supabase.com/v1/projects/{branch_ref}/database/query \
    
    2
    
      --request POST \
    
    3
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    4
    
      --header 'Content-Type: application/json' \
    
    5
    
      --data-binary @- <<EOF
    
    6
    
    {
    
    7
    
      "query": "insert into todos (task) values ('Task 1'), ('Task 2'), ('Task 3');"
    
    8
    
    }
    
    9
    
    EOF
[/code]

### Deploying Edge Functions#

You can create and deploy Edge Functions on a branch and then merge them into Production.

![Deploy Edge Functions](/docs/img/integrations/change-functions.png)
[code] 
    1
    
    curl https://api.supabase.com/v1/projects/functions/deploy \
    
    2
    
      --request POST \
    
    3
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    4
    
      --header 'Content-Type: multipart/form-data' \
    
    5
    
      --form 'file=@path/to/function.zip' \
    
    6
    
      --form 'metadata={
    
    7
    
        "name": "my-function",
    
    8
    
        "entrypoint_path": "index.ts",
    
    9
    
        "import_map_path": "import_map.json",
    
    10
    
        "static_patterns": ["assets/*", "public/*"],
    
    11
    
        "verify_jwt": true
    
    12
    
      }'
[/code]

### Merge all changes#

Management API endpoint: [`POST /v1/branches/{branch_id_or_ref}/merge`](<https://api.supabase.com/api/v1#tag/environments/post/v1/branches/%7Bbranch_id_or_ref%7D/merge>)

Once the changes have been made, you can merge the changes into the production project:
[code] 
    1
    
    curl https://api.supabase.com/v1/branches/{ref}/merge \
    
    2
    
      --request POST \
    
    3
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    4
    
      --header 'Content-Type: application/json' \
    
    5
    
      --data '{}'
[/code]

Merging changes will automatically merge only the following:

  * Database changes
  * Deployed Edge Functions


## Security checks for production#

Management API endpoint: [`GET /v1/projects/{ref}/advisors/security`](<https://api.supabase.com/api/v1#tag/advisors/get/v1/projects/%7Bref%7D/advisors/security>)

Prior to deploying to production we strongly recommend running the security advisor on the project to make sure the latest changes are secure.
[code] 
    1
    
    curl https://api.supabase.com/v1/projects/{ref}/advisors/security \
    
    2
    
      --request GET \
    
    3
    
      --header  'Authorization: Bearer {PAT_OR_USER_TOKEN}' \
    
    4
    
      --header 'Content-Type: application/json'
[/code]

## Disaster recovery for production#

Management API endpoint: [`POST /v1/projects/{ref}/database/backups/restore-pitr`](<https://api.supabase.com/api/v1#tag/database/post/v1/projects/%7Bref%7D/database/backups/restore-pitr>)

![Rollback](/docs/img/integrations/rollback.png)

  * Rollbacks can cause data loss. Only use it in `PROD` when absolutely necessary.
  * Only available in prod when a project has already explicitly enabled PITR prior to rolling back.


[code] 
    1
    
    curl https://api.supabase.com/v1/projects/database/backups/restore-pitr \
    
    2
    
      --request POST \
    
    3
    
      --header 'Authorization: Bearer {PAT_OR_USER_TOKEN}' \
    
    4
    
      --header 'Content-Type: application/json' \
    
    5
    
      --data '{
    
    6
    
      "recovery_time_target_unix": 1
    
    7
    
    }'
[/code]

## Claim flow#

Management API endpoint: [`GET /v1/oauth/authorize/project-claim`](<https://api.supabase.com/api/v1#tag/oauth/get/v1/oauth/authorize/project-claim>)

Your users may want to claim the project that currently lives in your org so that they can have more control over it.

We've enabled transferring the project from your org to your user's org while you continue to retain access to interact with the project through an [OAuth integration](</docs/guides/integrations/build-a-supabase-oauth-integration>).
[code] 
    1
    
    curl -L "https://api.supabase.com/v1/oauth/authorize/project-claim?project_ref={ref}&client_id={oauth_client_id}&response_type=code&redirect_uri={redirect_uri}" \
    
    2
    
      --request GET \
    
    3
    
      --header 'Authorization: Bearer {PERSONAL_ACCESS_TOKEN}'
[/code]

The user is redirected to a Supabase UI:

  1. Create a new Supabase account or sign in to an existing one
  2. Create a new Supabase Organization or select an existing one
  3. Review your OAuth integration's permission scopes
  4. Review the Project transfer details
  5. Confirm the OAuth integration and the Project transfer for the selected Organization


Remove custom configuration before transferring project

Before transferring the project to your user's org, make sure to remove any custom configuration that you do not want your user's project to retain.

## Platform kit#

Docs: <https://supabase.com/ui/docs/platform/platform-kit>

We've created Platform Kit, a collection of UI components that interact with Management API, as a lightweight version of Supabase Dashboard that you can embed directly in your app so your users never have to leave in order to interact with the project.

## Debugging projects#

Management API endpoint: [`GET /v1/projects/{ref}/analytics/endpoints/logs.all`](<https://api.supabase.com/api/v1#tag/analytics/get/v1/projects/%7Bref%7D/analytics/endpoints/logs.all>)

When you need to debug a project, you can query the project's logs to see if there are any errors and address them accordingly.
[code] 
    1
    
    curl 'https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs.all' \
    
    2
    
      --get \
    
    3
    
      --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
    
    4
    
      --data-urlencode 'sql=SELECT datetime(timestamp), status_code, path, event_message
    
    5
    
        FROM edge_logs
    
    6
    
        CROSS JOIN UNNEST(metadata) AS metadata
    
    7
    
        CROSS JOIN UNNEST(response) AS response
    
    8
    
        WHERE status_code >= 400
    
    9
    
        ORDER BY timestamp DESC
    
    10
    
        LIMIT 100' \
    
    11
    
      --data-urlencode 'iso_timestamp_start=2025-03-23T00:00:00Z' \
    
    12
    
      --data-urlencode 'iso_timestamp_end=2025-03-23T01:00:00Z'
[/code]