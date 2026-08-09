---
タイトル: Calendly
URL: https://supabase.com/docs/guides/database/extensions/wrappers/calendly
カテゴリ: database
更新日: 2026-08-02
タグ: calendly, database, extensions, wrappers
---

# Calendly

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/calendly
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** calendly, database, extensions, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Calendly Wrapper#](#enable-the-calendly-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Calendly#](#connecting-to-calendly)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Current User#](#current-user)
  - [Event Types#](#event-types)
  - [Groups#](#groups)
  - [Organization Memberships#](#organization-memberships)
  - [Scheduled Events#](#scheduled-events)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic example#](#basic-example)
  - [Query JSON attributes#](#query-json-attributes)

## 概要

Searchdocs...

---

You can enable the Calendly wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/calendly_wrapper/overview>)

[Calendly](<https://calendly.com/>) is a scheduling platform used for teams to schedule, prepare and follow up on external meetings.

The Calendly Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read data from your Calendly for use within your Postgres database.

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.0| `https://github.com/supabase/wrappers/releases/download/wasm_calendly_fdw_v0.2.0/calendly_fdw.wasm`| `1d18021cc3618440107b0d37f0a811607fdc863d9841a5da1ff9d56bc9f44df1`| >=0.5.0  
0.1.0| `https://github.com/supabase/wrappers/releases/download/wasm_calendly_fdw_v0.1.0/calendly_fdw.wasm`| `51a19fa4b8c40afb5dcf6dc2e009189aceeba65f30eec75d56a951d78fc8893f`| >=0.4.0  
  
## Preparation#

Before you can query Calendly, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Calendly Wrapper#

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
    
    -- Save your Calendly API key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<Calendly API key>', -- Calendly personal access token
    
    4
    
      'calendly',
    
    5
    
      'Calendly API key for Wrappers'
    
    6
    
    );
[/code]

### Connecting to Calendly#

We need to provide Postgres with the credentials to access Calendly and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server calendly_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_calendly_fdw_v0.1.0/calendly_fdw.wasm',
    
    5
    
        fdw_package_name 'supabase:calendly-fdw',
    
    6
    
        fdw_package_version '0.1.0',
    
    7
    
        fdw_package_checksum '51a19fa4b8c40afb5dcf6dc2e009189aceeba65f30eec75d56a951d78fc8893f',
    
    8
    
        -- find your organization uri using foreign table 'calendly.current_user', see below example for details
    
    9
    
        organization 'https://api.calendly.com/organizations/81da9c7f-3e19-434a-c3d2-0325e375cdef',
    
    10
    
        api_url 'https://api.calendly.com',  -- optional
    
    11
    
        api_key_id '<key_ID>' -- The Key ID from above.
    
    12
    
      );
[/code]

Note the `fdw_package_*` options are required, which specify the Wasm package metadata. You can get the available package version list from above.

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists calendly;
[/code]

## Options#

The full list of foreign table options are below:

  * `object` \- Object name in Calendly, required.


Supported objects are listed below:

Object name  
---  
current_user  
event_types  
groups  
organization_memberships  
scheduled_events  
  
## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Calendly.

For example, using below SQL can automatically create foreign tables in the `calendly` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema calendly from server calendly_server into calendly;
    
    3
    
    4
    
    -- or, create selected tables only
    
    5
    
    import foreign schema calendly
    
    6
    
       limit to ("event_types", "groups")
    
    7
    
       from server calendly_server into calendly;
    
    8
    
    9
    
    -- or, create all foreign tables except selected tables
    
    10
    
    import foreign schema calendly
    
    11
    
       except ("event_types")
    
    12
    
       from server calendly_server into calendly;
[/code]

### Current User#

This is an object representing your Calendly user profile.

Ref: [Calendly API docs](<https://developer.calendly.com/api-docs>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Current User| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table calendly.current_user (
    
    2
    
      uri text,
    
    3
    
      slug text,
    
    4
    
      created_at timestamp,
    
    5
    
      updated_at timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server calendly_server
    
    9
    
      options (
    
    10
    
        object 'current_user'
    
    11
    
      );
[/code]

#### Notes#

  * The `attrs` column contains additional user attributes in JSON format
  * Use this table to retrieve the organization URI for server configuration, for example:
[code] 1
        
        select attrs->>'current_organization' as org_uri
        
        2
        
        from calendly.current_user;
[/code]


### Event Types#

This is an object representing Calendly event types.

Ref: [Calendly API docs](<https://developer.calendly.com/api-docs>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Event Types| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table calendly.event_types (
    
    2
    
      uri text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server calendly_server
    
    8
    
      options (
    
    9
    
        object 'event_types'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all event type attributes in JSON format
  * Access profile and custom questions through JSON attributes:
[code] 1
        
        select attrs->'profile'->>'name' as profile_name,
        
        2
        
               attrs->'custom_questions'->0->>'name' as first_question_name
        
        3
        
        from calendly.event_types;
[/code]


### Groups#

This is an object representing Calendly groups.

Ref: [Calendly API docs](<https://developer.calendly.com/api-docs>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Groups| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table calendly.groups (
    
    2
    
      uri text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server calendly_server
    
    8
    
      options (
    
    9
    
        object 'groups'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all group attributes in JSON format


### Organization Memberships#

This is an object representing Calendly organization memberships.

Ref: [Calendly API docs](<https://developer.calendly.com/api-docs>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Organization Membership| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table calendly.organization_memberships (
    
    2
    
      uri text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server calendly_server
    
    8
    
      options (
    
    9
    
        object 'organization_memberships'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all membership attributes in JSON format


### Scheduled Events#

This is an object representing Calendly scheduled events.

Ref: [Calendly API docs](<https://developer.calendly.com/api-docs>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Scheduled Events| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table calendly.scheduled_events (
    
    2
    
      uri text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server calendly_server
    
    8
    
      options (
    
    9
    
        object 'scheduled_events'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all event attributes in JSON format


## Query Pushdown Support#

This FDW doesn't support query pushdown.

## Supported Data Types#

Postgres Data Type| Calendly Data Type  
---|---  
boolean| Boolean  
bigint| Number  
double precision| Number  
text| String  
timestamp| Time  
timestamptz| Time  
jsonb| Json  
  
The Calendly API uses JSON formatted data, please refer to [Calendly API docs](<https://developer.calendly.com/api-docs>) for more details.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Large result sets may experience slower performance due to full data transfer requirement
  * Organization URI must be manually configured after initial setup
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Below are some examples on how to use Calendly foreign tables.

### Basic example#

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    create foreign table calendly.current_user (
    
    2
    
      uri text,
    
    3
    
      slug text,
    
    4
    
      created_at timestamp,
    
    5
    
      updated_at timestamp,
    
    6
    
      attrs jsonb
    
    7
    
    )
    
    8
    
      server calendly_server
    
    9
    
      options (
    
    10
    
        object 'current_user'
    
    11
    
      );
    
    12
    
    13
    
    -- query current user used for the Calendly API request
    
    14
    
    select * from calendly.current_user;
[/code]

`attrs` is a special column which stores all the object attributes in JSON format, you can extract any attributes needed from it. See more examples below.

### Query JSON attributes#
[code] 
    1
    
    -- extract organization uri from current user
    
    2
    
    select attrs->>'current_organization' as org_uri
    
    3
    
    from calendly.current_user;
    
    4
    
    5
    
    -- then update foreign server option using the organization uri
    
    6
    
    alter server calendly_server options (set organization '<org_uri>');
[/code]

Some other examples,
[code] 
    1
    
    create foreign table calendly.event_types (
    
    2
    
      uri text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server calendly_server
    
    8
    
      options (
    
    9
    
        object 'event_types'
    
    10
    
      );
    
    11
    
    12
    
    select attrs->'profile'->>'name' as profile_name
    
    13
    
    from calendly.event_types;
    
    14
    
    15
    
    select attrs->'custom_questions'->0->>'name' as first_question_name
    
    16
    
    from calendly.event_types;
[/code]