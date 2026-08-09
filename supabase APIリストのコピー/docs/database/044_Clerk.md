---
タイトル: Clerk
URL: https://supabase.com/docs/guides/database/extensions/wrappers/clerk
カテゴリ: database
更新日: 2026-08-02
タグ: clerk, database, extensions, wrappers
---

# Clerk

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/clerk
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** clerk, database, extensions, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Clerk Wrapper#](#enable-the-clerk-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Clerk#](#connecting-to-clerk)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Allow-list#](#allow-list)
  - [Block-list#](#block-list)
  - [Domains#](#domains)
  - [Invitations#](#invitations)
  - [JWT Templates#](#jwt-templates)
  - [OAuth Applications#](#oauth-applications)
  - [Organizations#](#organizations)
  - [Organization Invitations#](#organization-invitations)
  - [Organization Memberships#](#organization-memberships)
  - [Redirect URLs#](#redirect-urls)
  - [SAML Connections#](#saml-connections)
  - [Users#](#users)
  - [User Billing Subscriptions#](#user-billing-subscriptions)
  - [Organization Billing Subscriptions#](#organization-billing-subscriptions)
  - [Billing Plans#](#billing-plans)
  - [Billing Subscription Items#](#billing-subscription-items)

## 概要

Searchdocs...

---

You can enable the Clerk wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/clerk_wrapper/overview>)

[Clerk](<https://clerk.com/>) is a complete suite of embeddable UIs, flexible APIs, and admin dashboards to authenticate and manage users.

The Clerk Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read data from Clerk for use within your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.2| `https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.2.2/clerk_fdw.wasm`| tbd| >=0.5.0  
0.2.1| `https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.2.1/clerk_fdw.wasm`| `100f3f105e7e6dab92c433b2da6bec98fafeccd0304e6efaf3780d0a8cae30ec`| >=0.5.0  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.2.0/clerk_fdw.wasm`| `89337bb11779d4d654cd3e54391aabd02509d213db6995f7dd58951774bf0e37`| >=0.5.0  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.1.0/clerk_fdw.wasm`| `613be26b59fa4c074e0b93f0db617fcd7b468d4d02edece0b1f85fdb683ebdc4`| >=0.4.0  
  
## Preparation#

Before you can query Clerk, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Clerk Wrapper#

Enable the Wasm foreign data wrapper:
[code] 
    1
    
    create foreign data wrapper wasm_wrapper
    
    2
    
      handler wasm_fdw_handler
    
    3
    
      validator wasm_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your Clerk API key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<Clerk API key>', -- Clerk API key
    
    4
    
      'clerk',
    
    5
    
      'Clerk API key for Wrappers'
    
    6
    
    );
[/code]

### Connecting to Clerk#

We need to provide Postgres with the credentials to access Clerk and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server clerk_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.2.2/clerk_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:clerk-fdw',
    
    6
    
        fdw_package_version '0.2.2',
    
    7
    
        fdw_package_checksum 'tbd',
    
    8
    
        api_url 'https://api.clerk.com/v1',  -- optional
    
    9
    
        api_key_id '<key_ID>' -- The Key ID from above.
    
    10
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists clerk;
[/code]

## Options#

The full list of foreign table options are below:

  * `object` \- Object name in Clerk, required.


Supported objects are listed below:

Object name  
---  
allowlist_identifiers  
billing_payment_attempts  
billing_plans  
billing_statement  
billing_statements  
billing_subscription_items  
blocklist_identifiers  
domains  
invitations  
jwt_templates  
oauth_applications  
organizations  
organization_billing_subscriptions  
organization_invitations  
organization_memberships  
redirect_urls  
saml_connections  
user_billing_subscriptions  
users  
  
## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Clerk.

For example, using below SQL can automatically create foreign tables in the `clerk` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema clerk from server clerk_server into clerk;
    
    3
    
    4
    
    -- or, create selected tables only
    
    5
    
    import foreign schema clerk
    
    6
    
       limit to ("users", "organizations")
    
    7
    
       from server clerk_server into clerk;
    
    8
    
    9
    
    -- or, create all foreign tables except selected tables
    
    10
    
    import foreign schema clerk
    
    11
    
       except ("users")
    
    12
    
       from server clerk_server into clerk;
[/code]

### Allow-list#

This is a list of all identifiers allowed to sign up to an instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Allow-list-Block-list#operation/ListAllowlistIdentifiers>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
allowlist_identifiers| ✅| ✅| ❌| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.allowlist_identifiers (
    
    2
    
      id text,
    
    3
    
      invitation_id text,
    
    4
    
      identifier text,
    
    5
    
      identifier_type text,
    
    6
    
      instance_id text,
    
    7
    
      created_at timestamp,
    
    8
    
      updated_at timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server clerk_server
    
    12
    
      options (
    
    13
    
        object 'allowlist_identifiers',
    
    14
    
        rowid_column 'id'
    
    15
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Block-list#

This is a list of all identifiers which are not allowed to access an instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Allow-list-Block-list#operation/ListBlocklistIdentifiers>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
blocklist_identifiers| ✅| ✅| ❌| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.blocklist_identifiers (
    
    2
    
      id text,
    
    3
    
      identifier text,
    
    4
    
      identifier_type text,
    
    5
    
      instance_id text,
    
    6
    
      created_at timestamp,
    
    7
    
      updated_at timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server clerk_server
    
    11
    
      options (
    
    12
    
        object 'blocklist_identifiers',
    
    13
    
        rowid_column 'id'
    
    14
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Domains#

This is a list of all domains for an instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Domains#operation/ListDomains>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
domains| ✅| ❌| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.domains (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      is_satellite boolean,
    
    5
    
      frontend_api_url text,
    
    6
    
      accounts_portal_url text,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server clerk_server
    
    10
    
      options (
    
    11
    
        object 'domains',
    
    12
    
        rowid_column 'id'
    
    13
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Invitations#

This is a list of all non-revoked invitations for your application.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Invitations#operation/ListInvitations>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
invitations| ✅| ✅| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.invitations (
    
    2
    
      id text,
    
    3
    
      email_address text,
    
    4
    
      url text,
    
    5
    
      revoked boolean,
    
    6
    
      status text,
    
    7
    
      expires_at timestamp,
    
    8
    
      created_at timestamp,
    
    9
    
      updated_at timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server clerk_server
    
    13
    
      options (
    
    14
    
        object 'invitations',
    
    15
    
        rowid_column 'id'
    
    16
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### JWT Templates#

This is a list of all JWT templates.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/JWT-Templates#operation/ListJWTTemplates>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
jwt_templates| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.jwt_templates (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      lifetime bigint,
    
    5
    
      allowed_clock_skew bigint,
    
    6
    
      custom_signing_key boolean,
    
    7
    
      signing_algorithm text,
    
    8
    
      created_at timestamp,
    
    9
    
      updated_at timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server clerk_server
    
    13
    
      options (
    
    14
    
        object 'jwt_templates',
    
    15
    
        rowid_column 'id'
    
    16
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Single-item retrieval is supported via `WHERE id = 'xxx'` clause, which fetches from `GET /jwt_templates/{template_id}` endpoint


### OAuth Applications#

This is a list of OAuth applications for an instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/OAuth-Applications#operation/ListOAuthApplications>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
oauth_applications| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.oauth_applications (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      instance_id text,
    
    5
    
      client_id text,
    
    6
    
      public boolean,
    
    7
    
      scopes text,
    
    8
    
      created_at timestamp,
    
    9
    
      updated_at timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server clerk_server
    
    13
    
      options (
    
    14
    
        object 'oauth_applications',
    
    15
    
        rowid_column 'id'
    
    16
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Single-item retrieval is supported via `WHERE id = 'xxx'` clause, which fetches from `GET /oauth_applications/{oauth_application_id}` endpoint


### Organizations#

This is a list of organizations for an instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Organizations#operation/ListOrganizations>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
organizations| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.organizations (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      slug text,
    
    5
    
      created_at timestamp,
    
    6
    
      updated_at timestamp,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server clerk_server
    
    10
    
      options (
    
    11
    
        object 'organizations',
    
    12
    
        rowid_column 'id'
    
    13
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Single-item retrieval is supported via `WHERE id = 'xxx'` clause, which fetches from `GET /organizations/{organization_id}` endpoint


### Organization Invitations#

This is a list of organization invitations for an instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Organization-Invitations#operation/ListInstanceOrganizationInvitations>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
organization_invitations| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.organization_invitations (
    
    2
    
      id text,
    
    3
    
      email_address text,
    
    4
    
      role text,
    
    5
    
      role_name text,
    
    6
    
      organization_id text,
    
    7
    
      status text,
    
    8
    
      created_at timestamp,
    
    9
    
      updated_at timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server clerk_server
    
    13
    
      options (
    
    14
    
        object 'organization_invitations'
    
    15
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Organization Memberships#

This is a list of organization user memberships for an instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Organization-Memberships#operation/InstanceGetOrganizationMemberships>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
organization_memberships| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.organization_memberships (
    
    2
    
      id text,
    
    3
    
      role text,
    
    4
    
      role_name text,
    
    5
    
      created_at timestamp,
    
    6
    
      updated_at timestamp,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server clerk_server
    
    10
    
      options (
    
    11
    
        object 'organization_memberships'
    
    12
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Single-item retrieval is supported via `WHERE id = 'xxx'` clause, which fetches from `GET /oauth_applications/{oauth_application_id}` endpoint


### Redirect URLs#

This is a list of all whitelisted redirect urls for the instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Redirect-URLs#operation/ListRedirectURLs>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
redirect_urls| ✅| ✅| ❌| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.redirect_urls (
    
    2
    
      id text,
    
    3
    
      url text,
    
    4
    
      created_at timestamp,
    
    5
    
      updated_at timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server clerk_server
    
    9
    
      options (
    
    10
    
        object 'redirect_urls',
    
    11
    
        rowid_column 'id'
    
    12
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Single-item retrieval is supported via `WHERE id = 'xxx'` clause, which fetches from `GET /redirect_urls/{id}` endpoint


### SAML Connections#

This is a list of SAML Connections for an instance.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/SAML-Connections#operation/ListSAMLConnections>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
saml_connections| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.saml_connections (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      domain text,
    
    5
    
      active boolean,
    
    6
    
      provider text,
    
    7
    
      user_count bigint,
    
    8
    
      created_at timestamp,
    
    9
    
      updated_at timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server clerk_server
    
    13
    
      options (
    
    14
    
        object 'saml_connections',
    
    15
    
        rowid_column 'id'
    
    16
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Single-item retrieval is supported via `WHERE id = 'xxx'` clause, which fetches from `GET /saml_connections/{saml_connection_id}` endpoint


### Users#

This is a list of all users.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/Users#operation/GetUserList>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
users| ✅| ✅| ✅| ✅| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.users (
    
    2
    
      id text,
    
    3
    
      external_id text,
    
    4
    
      username text,
    
    5
    
      first_name text,
    
    6
    
      last_name text,
    
    7
    
      created_at timestamp,
    
    8
    
      updated_at timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server clerk_server
    
    12
    
      options (
    
    13
    
        object 'users',
    
    14
    
        rowid_column 'id'
    
    15
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * Single-item retrieval is supported via `WHERE id = 'xxx'` clause, which fetches from `GET /users/{user_id}` endpoint


### User Billing Subscriptions#

This retrieves the billing subscription for a specific user.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/billing#operation/GetUserBillingSubscription>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
users/billing/subscription| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.user_billing_subscriptions (
    
    2
    
      user_id text,
    
    3
    
      id text,
    
    4
    
      status text,
    
    5
    
      payer_id text,
    
    6
    
      created_at timestamp,
    
    7
    
      updated_at timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server clerk_server
    
    11
    
      options (
    
    12
    
        object 'users/billing/subscription'
    
    13
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * The query must specify `user_id` in the WHERE clause


### Organization Billing Subscriptions#

This retrieves the billing subscription for a specific organization.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/billing#operation/GetOrganizationBillingSubscription>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
organizations/billing/subscription| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.organization_billing_subscriptions (
    
    2
    
      organization_id text,
    
    3
    
      id text,
    
    4
    
      status text,
    
    5
    
      payer_id text,
    
    6
    
      created_at timestamp,
    
    7
    
      updated_at timestamp,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server clerk_server
    
    11
    
      options (
    
    12
    
        object 'organizations/billing/subscription'
    
    13
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * The query must specify `organization_id` in the WHERE clause


### Billing Plans#

This is a list of all billing plans.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/billing#operation/ListBillingPlans>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
billing/plans| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.billing_plans (
    
    2
    
      id text,
    
    3
    
      name text,
    
    4
    
      description text,
    
    5
    
      slug text,
    
    6
    
      is_default boolean,
    
    7
    
      is_recurring boolean,
    
    8
    
      attrs jsonb
    
    9
    
    )
    
    10
    
      server clerk_server
    
    11
    
      options (
    
    12
    
        object 'billing/plans'
    
    13
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Billing Subscription Items#

This is a list of all billing subscription items.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/billing#operation/ListBillingSubscriptionItems>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
billing/subscription_items| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.billing_subscription_items (
    
    2
    
      id text,
    
    3
    
      status text,
    
    4
    
      plan_id text,
    
    5
    
      plan_period text,
    
    6
    
      payer_id text,
    
    7
    
      is_free_trial boolean,
    
    8
    
      created_at timestamp,
    
    9
    
      updated_at timestamp,
    
    10
    
      attrs jsonb
    
    11
    
    )
    
    12
    
      server clerk_server
    
    13
    
      options (
    
    14
    
        object 'billing/subscription_items'
    
    15
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Billing Statements#

This is a list of all billing statements.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/billing#operation/ListBillingStatements>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
billing/statements| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.billing_statements (
    
    2
    
      id text,
    
    3
    
      status text,
    
    4
    
      timestamp timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server clerk_server
    
    8
    
      options (
    
    9
    
        object 'billing/statements'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format


### Billing Statement#

This retrieves a specific billing statement by ID.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/billing#operation/GetBillingStatement>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
billing/statement| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.billing_statement (
    
    2
    
      statement_id text,
    
    3
    
      id text,
    
    4
    
      status text,
    
    5
    
      timestamp timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server clerk_server
    
    9
    
      options (
    
    10
    
        object 'billing/statement'
    
    11
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * The query must specify `statement_id` in the WHERE clause


### Billing Payment Attempts#

This retrieves payment attempts for a specific billing statement.

Ref: [Clerk API docs](<https://clerk.com/docs/reference/backend-api/tag/billing#operation/ListBillingStatementPaymentAttempts>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
billing/payment_attempts| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table clerk.billing_payment_attempts (
    
    2
    
      statement_id text,
    
    3
    
      id text,
    
    4
    
      status text,
    
    5
    
      created_at timestamp,
    
    6
    
      updated_at timestamp,
    
    7
    
      attrs jsonb
    
    8
    
    )
    
    9
    
      server clerk_server
    
    10
    
      options (
    
    11
    
        object 'billing/payment_attempts'
    
    12
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional attributes in JSON format
  * The query must specify `statement_id` in the WHERE clause


## Query Pushdown Support#

### `where` clause pushdown#

This FDW supports `where id = 'xxx'` clause pushdown for the following objects:

  * users
  * organizations
  * jwt_templates
  * oauth_applications
  * saml_connections
  * redirect_urls


For example:
[code] 
    1
    
    -- Fetches from GET /users/user_xxx (single API call)
    
    2
    
    select * from clerk.users where id = 'user_xxx';
[/code]

### Parameterized endpoints#

Some endpoints require specific qualifiers in the WHERE clause:

Object| Required qualifier  
---|---  
user_billing_subscriptions| `user_id`  
organization_billing_subscriptions| `organization_id`  
billing_statement| `statement_id`  
billing_payment_attempts| `statement_id`  
  
For example:
[code] 
    1
    
    -- Fetches from GET /users/{user_id}/billing/subscription
    
    2
    
    select * from clerk.user_billing_subscriptions where user_id = 'user_xxx';
[/code]

## Supported Data Types#

Postgres Data Type| Clerk Data Type  
---|---  
boolean| Boolean  
bigint| Number  
double precision| Number  
text| String  
timestamp| Time  
jsonb| Json  
  
The Clerk API uses JSON formatted data, please refer to [Clerk Backend API docs](<https://clerk.com/docs/reference/backend-api>) for more details.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to full data transfer requirement
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Below are some examples on how to use Clerk foreign tables.

### Basic example#

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table clerk.users (
    
    2
    
      id text,
    
    3
    
      external_id text,
    
    4
    
      username text,
    
    5
    
      first_name text,
    
    6
    
      last_name text,
    
    7
    
      created_at timestamp,
    
    8
    
      updated_at timestamp,
    
    9
    
      attrs jsonb
    
    10
    
    )
    
    11
    
      server clerk_server
    
    12
    
      options (
    
    13
    
        object 'users',
    
    14
    
        rowid_column 'id'
    
    15
    
      );
    
    16
    
    17
    
    -- query all users (fetches from GET /users)
    
    18
    
    select * from clerk.users;
    
    19
    
    20
    
    -- retrieve a specific user by ID (fetches from GET /users/{user_id})
    
    21
    
    select * from clerk.users where id = 'user_xxx';
[/code]

`attrs` is a special column which stores all the object attributes in JSON format, you can extract any attributes needed from it. See more examples below.

### Query JSON attributes#
[code] 
    1
    
    -- extract all email addresses from user
    
    2
    
    select
    
    3
    
      u.id,
    
    4
    
      e->>'email_address' as email
    
    5
    
    from clerk.users u
    
    6
    
      cross join json_array_elements((attrs->'email_addresses')::json) e;
[/code]

### Data Modify Examples#

Some tables support INSERT, UPDATE, and DELETE operations. Use the `attrs` JSONB column to provide the request body:
[code] 
    1
    
    -- Create a new user
    
    2
    
    INSERT INTO clerk.users (attrs) VALUES ('{"email_address": ["user@example.com"], "password": "secure123"}');
    
    3
    
    4
    
    -- Update a user (requires rowid_column 'id')
    
    5
    
    UPDATE clerk.users SET attrs = '{"first_name": "John", "last_name": "Doe"}' WHERE id = 'user_xxx';
    
    6
    
    7
    
    -- Delete a user (requires rowid_column 'id')
    
    8
    
    DELETE FROM clerk.users WHERE id = 'user_xxx';
    
    9
    
    10
    
    -- Create a new organization
    
    11
    
    INSERT INTO clerk.organizations (attrs) VALUES ('{"name": "My Organization", "slug": "my-org"}');
    
    12
    
    13
    
    -- Update an organization
    
    14
    
    UPDATE clerk.organizations SET attrs = '{"name": "Updated Name"}' WHERE id = 'org_xxx';
    
    15
    
    16
    
    -- Delete an organization
    
    17
    
    DELETE FROM clerk.organizations WHERE id = 'org_xxx';
[/code]

### Billing examples#
[code] 
    1
    
    -- Query all billing plans
    
    2
    
    SELECT * FROM clerk.billing_plans;
    
    3
    
    4
    
    -- Query all billing statements
    
    5
    
    SELECT * FROM clerk.billing_statements;
    
    6
    
    7
    
    -- Query all billing subscription items
    
    8
    
    SELECT * FROM clerk.billing_subscription_items;
    
    9
    
    10
    
    -- Query a specific statement (requires WHERE clause)
    
    11
    
    SELECT * FROM clerk.billing_statement WHERE statement_id = 'stmt_xxx';
    
    12
    
    13
    
    -- Query payment attempts for a statement (requires WHERE clause)
    
    14
    
    SELECT * FROM clerk.billing_payment_attempts WHERE statement_id = 'stmt_xxx';
    
    15
    
    16
    
    -- Query subscription for a specific user (requires WHERE clause)
    
    17
    
    SELECT * FROM clerk.user_billing_subscriptions WHERE user_id = 'user_xxx';
    
    18
    
    19
    
    -- Query subscription for a specific organization (requires WHERE clause)
    
    20
    
    SELECT * FROM clerk.organization_billing_subscriptions WHERE organization_id = 'org_xxx';
    
    21
    
    22
    
    -- Retrieve a single user by ID (fetches from GET /users/{user_id})
    
    23
    
    SELECT * FROM clerk.users WHERE id = 'user_xxx';
    
    24
    
    25
    
    -- Retrieve a single organization by ID (fetches from GET /organizations/{organization_id})
    
    26
    
    SELECT * FROM clerk.organizations WHERE id = 'org_xxx';
    
    27
    
    28
    
    -- Retrieve a single JWT template by ID (fetches from GET /jwt_templates/{template_id})
    
    29
    
    SELECT * FROM clerk.jwt_templates WHERE id = 'tmpl_xxx';
    
    30
    
    31
    
    -- Retrieve a single OAuth application by ID (fetches from GET /oauth_applications/{oauth_application_id})
    
    32
    
    SELECT * FROM clerk.oauth_applications WHERE id = 'oauth_xxx';
    
    33
    
    34
    
    -- Retrieve a single SAML connection by ID (fetches from GET /saml_connections/{saml_connection_id})
    
    35
    
    SELECT * FROM clerk.saml_connections WHERE id = 'samlconn_xxx';
    
    36
    
    37
    
    -- Retrieve a single redirect URL by ID (fetches from GET /redirect_urls/{id})
    
    38
    
    SELECT * FROM clerk.redirect_urls WHERE id = 'redir_xxx';
[/code]