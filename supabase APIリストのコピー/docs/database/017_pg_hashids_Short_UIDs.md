---
タイトル: pg_hashids: Short UIDs
URL: https://supabase.com/docs/guides/database/extensions/pg_hashids
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, pg_hashids, short, uids
---

# pg_hashids: Short UIDs

**URL:** https://supabase.com/docs/guides/database/extensions/pg_hashids
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, pg_hashids, short, uids

## 目次

- [Enable the extension#](#enable-the-extension)
- [Usage#](#usage)
- [Resources#](#resources)

## 概要

Generate Short UIDs from Numbers

---

[pg_hashids](<https://github.com/iCyberon/pg_hashids>) provides a secure way to generate short, unique, non-sequential ids from numbers. The hashes are intended to be small, easy-to-remember identifiers that can be used to obfuscate data (optionally) with a password, alphabet, and salt. For example, you may wish to hide data like user IDs, order numbers, or tracking codes in favor of `pg_hashid`'s unique identifiers.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for "pg_hashids" and enable the extension.


## Usage#

Suppose we have a table that stores order information, and we want to give customers a unique identifier without exposing the sequential `id` column. To do this, we can use `pg_hashid`'s `id_encode` function.
[code] 
    1
    
    create table orders (
    
    2
    
      id serial primary key,
    
    3
    
      description text,
    
    4
    
      price_cents bigint
    
    5
    
    );
    
    6
    
    7
    
    insert into orders (description, price_cents)
    
    8
    
    values ('a book', 9095);
    
    9
    
    10
    
    select
    
    11
    
      id,
    
    12
    
      id_encode(id) as short_id,
    
    13
    
      description,
    
    14
    
      price_cents
    
    15
    
    from
    
    16
    
      orders;
    
    17
    
    18
    
      id | short_id | description | price_cents
    
    19
    
    ----+----------+-------------+-------------
    
    20
    
      1 | jR       | a book      |        9095
    
    21
    
    (1 row)
[/code]

To reverse the `short_id` back into an `id`, there is an equivalent function named `id_decode`.

## Resources#

  * Official [pg_hashids documentation](<https://github.com/iCyberon/pg_hashids>)