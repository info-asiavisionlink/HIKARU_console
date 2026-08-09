---
タイトル: uuid-ossp: Unique Identifiers
URL: https://supabase.com/docs/guides/database/extensions/uuid-ossp
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, identifiers, ossp, unique, uuid, uuid-ossp
---

# uuid-ossp: Unique Identifiers

**URL:** https://supabase.com/docs/guides/database/extensions/uuid-ossp
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, identifiers, ossp, unique, uuid, uuid-ossp

## 目次

- [Overview#](#overview)
- [Enable the extension#](#enable-the-extension)
- [Theuuidtype#](#the-uuid-type)
- [uuid_generate_v1()#](#uuidgeneratev1)
- [uuid_generate_v4()#](#uuidgeneratev4)
- [Examples#](#examples)
  - [Within a query#](#within-a-query)
  - [As a primary key#](#as-a-primary-key)
- [Resources#](#resources)

## 概要

A UUID generator for Postgres.

---

The `uuid-ossp` extension can be used to generate a `UUID`.

## Overview#

A `UUID` is a "Universally Unique Identifier" and it is, for practical purposes, unique. This makes them particularly well suited as Primary Keys. It is occasionally referred to as a `GUID`, which stands for "Globally Unique Identifier".

## Enable the extension#

**Note** : Currently `uuid-ossp` extension is enabled by default and cannot be disabled.

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `uuid-ossp` and enable the extension.


## The `uuid` type#

Once the extension is enabled, you now have access to a `uuid` type.

## `uuid_generate_v1()`#

Creates a UUID value based on the combination of computer’s MAC address, current timestamp, and a random value.

UUIDv1 leaks identifiable details, which might make it unsuitable for certain security-sensitive applications.

## `uuid_generate_v4()`#

Creates UUID values based solely on random numbers. You can also use Postgres's built-in [`gen_random_uuid()`](<https://www.postgresql.org/docs/current/functions-uuid.html>) function to generate a UUIDv4.

## Examples#

### Within a query#
[code] 
    1
    
    select uuid_generate_v4();
[/code]

### As a primary key#

Automatically create a unique, random ID in a table:
[code] 
    1
    
    create table contacts (
    
    2
    
      id uuid default uuid_generate_v4(),
    
    3
    
      first_name text,
    
    4
    
      last_name text,
    
    5
    
      primary key (id)
    
    6
    
    );
[/code]

## Resources#

  * [Choosing a Postgres Primary Key](</blog/choosing-a-postgres-primary-key>)
  * [The Basics Of Postgres `UUID` Data Type](<https://www.pgtutorial.com/postgresql-tutorial/postgresql-uuid/>)