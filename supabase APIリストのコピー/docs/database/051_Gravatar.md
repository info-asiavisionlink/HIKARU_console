---
タイトル: Gravatar
URL: https://supabase.com/docs/guides/database/extensions/wrappers/gravatar
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, gravatar, wrappers
---

# Gravatar

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/gravatar
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, gravatar, wrappers

## 目次

- [Available Versions#](#available-versions)
- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Gravatar Wrapper#](#enable-the-gravatar-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Gravatar#](#connecting-to-gravatar)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Profiles#](#profiles)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Data Types#](#supported-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic example#](#basic-example)
  - [Query JSON attributes#](#query-json-attributes)

## 概要

Searchdocs...

---

[Gravatar](<https://gravatar.com/>) is a service for providing globally unique avatars.

The Gravatar Wrapper is a WebAssembly(Wasm) foreign data wrapper which allows you to read profile data from Gravatar for use within your Postgres database.

This wrapper is [contributed and supported by Automattic](<https://github.com/Automattic/gravatar-wasm-fdw>).

## Available Versions#

Version| Wasm Package URL| Checksum| Required Wrappers Version  
---|---|---|---  
0.2.0| `https://github.com/Automattic/gravatar-wasm-fdw/releases/download/v0.2.0/gravatar_fdw.wasm`| `5273ae07e66bc2f1bb5a23d7b9e0342463971691e587bbd6f9466814a8bac11c`| >=0.5.0  
  
## Preparation#

Before you can query Gravatar, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Gravatar Wrapper#

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
    
    -- Save your Gravatar API key in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '<Gravatar API key>', -- Gravatar API key
    
    4
    
      'Gravatar',
    
    5
    
      'Gravatar API key for Wrappers'
    
    6
    
    );
[/code]

### Connecting to Gravatar#

We need to provide Postgres with the credentials to access Gravatar and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server gravatar_server
    
    2
    
      foreign data wrapper wasm_wrapper
    
    3
    
      options (
    
    4
    
        fdw_package_url 'https://github.com/Automattic/gravatar-wasm-fdw/releases/download/v0.2.0/gravatar_fdw.wasm',
    
    5
    
        fdw_package_name 'automattic:gravatar-fdw',
    
    6
    
        fdw_package_version '0.2.0',
    
    7
    
        fdw_package_checksum '5273ae07e66bc2f1bb5a23d7b9e0342463971691e587bbd6f9466814a8bac11c',
    
    8
    
        api_url 'https://api.gravatar.com/v3',  -- optional
    
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
    
    create schema if not exists gravatar;
[/code]

## Options#

The full list of foreign table options are below:

  * `table` \- Component name in Gravatar, required.


Supported components are listed below:

Component name  
---  
profiles  
  
## Entities#

We can use SQL [import foreign schema](<https://www.postgresql.org/docs/current/sql-importforeignschema.html>) to import foreign table definitions from Gravatar.

For example, using below SQL can automatically create foreign tables in the `gravatar` schema.
[code] 
    1
    
    -- create all the foreign tables
    
    2
    
    import foreign schema gravatar from server gravatar_server into gravatar;
[/code]

### Profiles#

This is the user profile provided by Gravatar.

Ref: [Gravatar API docs](<https://docs.gravatar.com/sdk/profiles/>)

#### Operations#

Component| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
profiles| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table gravatar.profiles (
    
    2
    
      hash text,
    
    3
    
      email text,
    
    4
    
      display_name text,
    
    5
    
      profile_url text,
    
    6
    
      avatar_url text,
    
    7
    
      avatar_alt_text text,
    
    8
    
      location text,
    
    9
    
      description text,
    
    10
    
      job_title text,
    
    11
    
      company text,
    
    12
    
      verified_accounts jsonb,
    
    13
    
      pronunciation text,
    
    14
    
      pronouns text,
    
    15
    
      timezone text,
    
    16
    
      languages jsonb,
    
    17
    
      first_name text,
    
    18
    
      last_name text,
    
    19
    
      is_organization boolean,
    
    20
    
      links jsonb,
    
    21
    
      interests jsonb,
    
    22
    
      payments jsonb,
    
    23
    
      contact_info jsonb,
    
    24
    
      number_verified_accounts integer,
    
    25
    
      last_profile_edit timestamp without time zone,
    
    26
    
      registration_date timestamp without time zone,
    
    27
    
      json jsonb
    
    28
    
    )
    
    29
    
      server gravatar_server
    
    30
    
      options (
    
    31
    
        table 'profiles'
    
    32
    
      );
[/code]

You can use `import foreign schema` statement to automatically create the `profiles` foreign table see above

#### Notes#

  * The `json` column contains additional attributes in JSON format


## Query Pushdown Support#

This FDW only supports `email equal condition (email = )` query pushdown and it is mandatory. For example,
[code] 
    1
    
    select * from gravatar.profiles where email = 'email@example.com';
    
    2
    
    3
    
    -- no result if the email equal condition is not specified
    
    4
    
    select * from gravatar.profiles
[/code]

## Supported Data Types#

Postgres Data Type| Gravatar Data Type  
---|---  
boolean| Boolean  
bigint| Number  
text| String  
timestamp| Time  
jsonb| Json  
  
The Gravatar API uses JSON formatted data, please refer to [Gravatar API docs](<https://docs.gravatar.com/sdk/profiles/>) for more details.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Only supports `profiles` component
  * Only `email equal condition (email = )` query pushdown is supported
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Below are some examples on how to use gravatar foreign tables.

### Basic example#

This example will create a "foreign table" inside your Postgres database and query its data.
[code] 
    1
    
    import foreign schema gravatar from server gravatar_server into gravatar;
    
    2
    
    3
    
    -- query an user profile 
    
    4
    
    select * from gravatar.profiles where email = 'email@example.com';
[/code]

`json` is a special column which stores all the object attributes in JSON format, you can extract any attributes needed from it. See more examples below.

### Query JSON attributes#
[code] 
    1
    
    select p.json->'section_visibility' as section_visibility
    
    2
    
    from gravatar.profiles p
    
    3
    
    where email = 'email@example.com';
[/code]