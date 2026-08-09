---
タイトル: Firebase
URL: https://supabase.com/docs/guides/database/extensions/wrappers/firebase
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, firebase, wrappers
---

# Firebase

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/firebase
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, firebase, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Firebase Wrapper#](#enable-the-firebase-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Firebase#](#connecting-to-firebase)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [Authentication Users#](#authentication-users)
  - [Firestore Database Documents#](#firestore-database-documents)
- [Query Pushdown Support#](#query-pushdown-support)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [firestore#](#firestore)
  - [auth/users#](#authusers)

## 概要

Searchdocs...

---

You can enable the Firebase wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/firebase_wrapper/overview>)

[Firebase](<https://firebase.google.com/>) is an app development platform built around non-relational technologies. The Firebase Wrapper supports connecting to below objects.

  1. [Authentication Users](<https://firebase.google.com/docs/auth/users>) (_read only_)
  2. [Firestore Database Documents](<https://firebase.google.com/docs/firestore>) (_read only_)


## Preparation#

Before you can query Firebase, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Firebase Wrapper#

Enable the `firebase_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper firebase_wrapper
    
    2
    
      handler firebase_fdw_handler
    
    3
    
      validator firebase_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your Firebase credentials in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      '{
    
    4
    
          "type": "service_account",
    
    5
    
          "project_id": "your_gcp_project_id",
    
    6
    
          ...
    
    7
    
      }',
    
    8
    
      'firebase',
    
    9
    
      'Firebase API key for Wrappers'
    
    10
    
    );
[/code]

### Connecting to Firebase#

We need to provide Postgres with the credentials to connect to Firebase, and any additional options. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server firebase_server
    
    2
    
      foreign data wrapper firebase_wrapper
    
    3
    
      options (
    
    4
    
        sa_key_id '<key_ID>', -- The Key ID from above.
    
    5
    
        project_id '<firebase_project_id>'
    
    6
    
    );
[/code]

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists firebase;
[/code]

## Options#

The full list of foreign table options are below:

  * `object` \- Object name in Firebase, required.

For Authenciation users, the object name is fixed to `auth/users`. For Firestore documents, its format is `firestore/<collection_id>`, note that collection id must be a full path id. For example,

    * `firestore/my-collection`
    * `firestore/my-collection/my-document/another-collection`


## Entities#

### Authentication Users#

This is an object representing Firebase Authentication Users.

Ref: [Firebase Authentication Users](<https://firebase.google.com/docs/auth/users>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Authentication Users| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table firebase.users (
    
    2
    
      uid text,
    
    3
    
      email text,
    
    4
    
      created_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server firebase_server
    
    8
    
      options (
    
    9
    
        object 'auth/users'
    
    10
    
      );
[/code]

#### Notes#

  * The `attrs` column contains all user attributes in JSON format
  * This is a special collection with unique metadata fields


### Firestore Database Documents#

This is an object representing Firestore Database Documents.

Ref: [Firestore Database](<https://firebase.google.com/docs/firestore>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Firestore Database Documents| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table firebase.docs (
    
    2
    
      name text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server firebase_server
    
    8
    
      options (
    
    9
    
        object 'firestore/user-profiles'
    
    10
    
      );
[/code]

#### Notes#

  * The `name`, `created_at`, and `updated_at` are automatic metadata fields on all Firestore collections
  * Collection ID must be a full path ID in the format `firestore/<collection_id>`
  * Examples of valid collection paths:
    * `firestore/my-collection`
    * `firestore/my-collection/my-document/another-collection`
  * The `attrs` column contains all document attributes in JSON format


## Query Pushdown Support#

This FDW doesn't support query pushdown.

## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Only support read-only access to Authentication Users and Firestore Database Documents
  * Default maximum row count limit is 10,000 records
  * Full result sets are loaded into memory, which can impact PostgreSQL performance with large datasets
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Some examples on how to use Firebase foreign tables.

### firestore#

To map a Firestore collection provide its location using the format `firestore/<collection_id>` as the `object` option as shown below.
[code] 
    1
    
    create foreign table firebase.docs (
    
    2
    
      name text,
    
    3
    
      created_at timestamp,
    
    4
    
      updated_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server firebase_server
    
    8
    
      options (
    
    9
    
        object 'firestore/user-profiles'
    
    10
    
      );
[/code]

Note that `name`, `created_at`, and `updated_at`, are automatic metadata fields on all Firestore collections.

### auth/users#

The `auth/users` collection is a special case with unique metadata. The following shows how to map Firebase users to PostgreSQL table.
[code] 
    1
    
    create foreign table firebase.users (
    
    2
    
      uid text,
    
    3
    
      email text,
    
    4
    
      created_at timestamp,
    
    5
    
      attrs jsonb
    
    6
    
    )
    
    7
    
      server firebase_server
    
    8
    
      options (
    
    9
    
        object 'auth/users'
    
    10
    
      );
[/code]