---
タイトル: Redis
URL: https://supabase.com/docs/guides/database/extensions/wrappers/redis
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, redis, wrappers
---

# Redis

**URL:** https://supabase.com/docs/guides/database/extensions/wrappers/redis
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, redis, wrappers

## 目次

- [Preparation#](#preparation)
  - [Enable Wrappers#](#enable-wrappers)
  - [Enable the Redis Wrapper#](#enable-the-redis-wrapper)
  - [Store your credentials (optional)#](#store-your-credentials-optional)
  - [Connecting to Redis#](#connecting-to-redis)
  - [Create a schema#](#create-a-schema)
- [Options#](#options)
- [Entities#](#entities)
  - [List#](#list)
  - [Set#](#set)
  - [Hash#](#hash)
  - [Sorted Set#](#sorted-set)
  - [Stream#](#stream)
  - [Multiple Objects#](#multiple-objects)
- [Query Pushdown Support#](#query-pushdown-support)
- [Supported Redis Data Types#](#supported-redis-data-types)
- [Limitations#](#limitations)
- [Examples#](#examples)
  - [Basic example#](#basic-example)
  - [Query multiple objects example#](#query-multiple-objects-example)

## 概要

Searchdocs...

---

You can enable the Redis wrapper right from the Supabase dashboard.

[Open wrapper in dashboard](<https://supabase.com/dashboard/project/_/integrations/redis_wrapper/overview>)

[Redis](<https://redis.io/>) is an open-source in-memory storage, used as a distributed, in-memory key–value database, cache and message broker, with optional durability.

The Redis Wrapper allows you to read data from Redis within your Postgres database.

## Preparation#

Before you can query Redis, you need to enable the Wrappers extension and store your credentials in Postgres.

### Enable Wrappers#

Make sure the `wrappers` extension is installed on your database:
[code] 
    1
    
    create extension if not exists wrappers with schema extensions;
[/code]

### Enable the Redis Wrapper#

Enable the `redis_wrapper` FDW:
[code] 
    1
    
    create foreign data wrapper redis_wrapper
    
    2
    
      handler redis_fdw_handler
    
    3
    
      validator redis_fdw_validator;
[/code]

### Store your credentials (optional)#

By default, Postgres stores FDW credentials inside `pg_catalog.pg_foreign_server` in plain text. Anyone with access to this table will be able to view these credentials. Wrappers is designed to work with [Vault](<https://supabase.com/docs/guides/database/vault>), which provides an additional level of security for storing credentials. We recommend using Vault to store your credentials.
[code] 
    1
    
    -- Save your Redis connection URL in Vault and retrieve the created `key_id`
    
    2
    
    select vault.create_secret(
    
    3
    
      'redis://username:password@127.0.0.1:6379/db',
    
    4
    
      'redis',
    
    5
    
      'Redis connection URL for Wrappers'
    
    6
    
    );
[/code]

To connect to Redis over SSL/TLS, you can use `rediss://` protocol. For example,
[code]
    1
    
    rediss://username:password@my-redis-12345.upstash.io:6379/#insecure
[/code]

### Connecting to Redis#

We need to provide Postgres with the credentials to connect to Redis. We can do this using the `create server` command:

With VaultWithout Vault
[code]
    1
    
    create server redis_server
    
    2
    
      foreign data wrapper redis_wrapper
    
    3
    
      options (
    
    4
    
        conn_url_id '<key_ID>' -- The Key ID from above.
    
    5
    
      );
[/code]

### Create a schema#

We recommend creating a schema to hold all the foreign tables:
[code] 
    1
    
    create schema if not exists redis;
[/code]

## Options#

The following options are available when creating Redis foreign tables:

  * `src_type` \- Foreign table source type in Redis, required.


This can be one of below types,

Source type| Description  
---|---  
list| [Single list](<https://redis.io/docs/data-types/lists/>)  
set| [Single set](<https://redis.io/docs/data-types/sets/>)  
hash| [Single hash](<https://redis.io/docs/data-types/hashes/>)  
zset| [Single sorted set](<https://redis.io/docs/data-types/sorted-sets/>)  
stream| [Stream](<https://redis.io/docs/data-types/streams/>)  
multi_list| Multiple lists, specified by `src_key` pattern  
multi_set| Multiple sets, specified by `src_key` pattern  
multi_hash| Multiple hashes, specified by `src_key` pattern  
multi_zset| Multiple sorted sets, specified by `src_key` pattern  
  
  * `src_key` \- Source object key in Redis, required.


This key can be a pattern for `multi_*` type of foreign table. For other types, this key must return exact one value. For example,

Source Type| `src_key` examples  
---|---  
list, set, hash, zset, stream| `my_list`, `list:001`, `hash_foo`, `zset:1000` and etc.  
multi_list, multi_set, multi_hash, multi_zset| `my_list:*`, `set:*`, `zset:*` and etc.  
  
## Entities#

### List#

This is an object representing a Redis List.

Ref: [Redis docs](<https://redis.io/docs/data-types/lists/>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
List| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table redis.list (
    
    2
    
      element text
    
    3
    
    )
    
    4
    
      server redis_server
    
    5
    
      options (
    
    6
    
        src_type 'list',
    
    7
    
        src_key 'my_list'
    
    8
    
      );
[/code]

#### Notes#

  * Elements are stored in insertion order
  * Query returns all elements in the list
  * No query pushdown support


### Set#

This is an object representing a Redis Set.

Ref: [Redis docs](<https://redis.io/docs/data-types/sets/>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Set| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table redis.set (
    
    2
    
      element text
    
    3
    
    )
    
    4
    
      server redis_server
    
    5
    
      options (
    
    6
    
        src_type 'set',
    
    7
    
        src_key 'set'
    
    8
    
      );
[/code]

#### Notes#

  * Elements are unique within the set
  * No guaranteed order of elements
  * No query pushdown support


### Hash#

This is an object representing a Redis Hash.

Ref: [Redis docs](<https://redis.io/docs/data-types/hashes/>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Hash| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table redis.hash (
    
    2
    
      key text,
    
    3
    
      value text
    
    4
    
    )
    
    5
    
      server redis_server
    
    6
    
      options (
    
    7
    
        src_type 'hash',
    
    8
    
        src_key 'hash'
    
    9
    
      );
[/code]

#### Notes#

  * Key-value pairs within the hash
  * No query pushdown support
  * Both key and value are returned as text


### Sorted Set#

This is an object representing a Redis Sorted Set.

Ref: [Redis docs](<https://redis.io/docs/data-types/sorted-sets/>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Sorted Set| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table redis.zset (
    
    2
    
      element text
    
    3
    
    )
    
    4
    
      server redis_server
    
    5
    
      options (
    
    6
    
        src_type 'zset',
    
    7
    
        src_key 'zset'
    
    8
    
      );
[/code]

#### Notes#

  * Elements are ordered by their score
  * Elements are unique within the set
  * Score information is not exposed in the foreign table


### Stream#

This is an object representing a Redis Stream.

Ref: [Redis docs](<https://redis.io/docs/data-types/streams/>)

#### Operations#

Object| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Stream| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table redis.stream (
    
    2
    
      id text,
    
    3
    
      items jsonb
    
    4
    
    )
    
    5
    
      server redis_server
    
    6
    
      options (
    
    7
    
        src_type 'stream',
    
    8
    
        src_key 'stream'
    
    9
    
      );
[/code]

#### Notes#

  * Stream entries have unique IDs
  * Items are stored in JSONB format
  * Entries are ordered by their IDs


### Multiple Objects#

Redis wrapper supports querying multiple objects of the same type using pattern matching.

#### Operations#

Object Type| Select| Insert| Update| Delete| Truncate  
---|---|---|---|---|---  
Multiple List| ✅| ❌| ❌| ❌| ❌  
Multiple Set| ✅| ❌| ❌| ❌| ❌  
Multiple Hash| ✅| ❌| ❌| ❌| ❌  
Multiple ZSet| ✅| ❌| ❌| ❌| ❌  
  
#### Usage#
[code] 
    1
    
    create foreign table redis.multi_lists (
    
    2
    
      key text,
    
    3
    
      items jsonb
    
    4
    
    )
    
    5
    
      server redis_server
    
    6
    
      options (
    
    7
    
        src_type 'multi_list',
    
    8
    
        src_key 'list:*'
    
    9
    
      );
[/code]

#### Notes#

  * Use pattern matching in `src_key` option
  * Results include object key and items in JSONB format
  * Items format varies by object type


## Query Pushdown Support#

This FDW doesn't support pushdown.

## Supported Redis Data Types#

All Redis values will be stored as `text` or `jsonb` columns in Postgres, below are the supported Redis data types:

Redis Type| Foreign Table Type (src_type)  
---|---  
List| list  
Set| set  
Hash| hash  
Sorted Set| zset  
Stream| stream  
Multiple List| multi_list  
Multiple Set| multi_set  
Multiple Hash| multi_hash  
Multiple Sorted Set| multi_zset  
  
## Limitations#

This section describes important limitations and considerations when using this FDW:

  * Full result sets are loaded into memory before processing
  * Read-only access to Redis data structures (no Insert, Update, Delete, or Truncate operations)
  * Pattern matching in `multi_*` types only supports basic Redis glob patterns
  * Materialized views using these foreign tables may fail during logical backups


## Examples#

Some examples on how to use Redis foreign tables.

Let's prepare some source data in Redis CLI first:
[code] 
    1
    
    127.0.0.1:6379> RPUSH list foo bar 42
    
    2
    
    127.0.0.1:6379> SADD set foo bar 42
    
    3
    
    127.0.0.1:6379> HSET hash foo bar baz qux
    
    4
    
    127.0.0.1:6379> ZADD zset 30 foo 20 bar 10 baz
    
    5
    
    127.0.0.1:6379> XADD stream * foo bar
    
    6
    
    127.0.0.1:6379> XADD stream * aa 42 bb 43
    
    7
    
    8
    
    127.0.0.1:6379> RPUSH list:100 foo bar
    
    9
    
    127.0.0.1:6379> RPUSH list:200 baz
    
    10
    
    11
    
    127.0.0.1:6379> SADD set:100 foo
    
    12
    
    127.0.0.1:6379> SADD set:200 bar
    
    13
    
    14
    
    127.0.0.1:6379> HSET hash:100 foo bar
    
    15
    
    127.0.0.1:6379> HSET hash:200 baz qux
    
    16
    
    17
    
    127.0.0.1:6379> ZADD zset:100 10 foo 20 bar
    
    18
    
    127.0.0.1:6379> ZADD zset:200 40 baz 30 qux
[/code]

### Basic example#

This example will create foreign tables inside your Postgres database and query their data:

  * List
[code] 1
        
        create foreign table redis.list (
        
        2
        
          element text
        
        3
        
        )
        
        4
        
        server redis_server
        
        5
        
        options (
        
        6
        
          src_type 'list',
        
        7
        
          src_key 'list'
        
        8
        
        );
        
        9
        
        10
        
        select * from redis.list;
[/code]

Query result:
[code] 1
        
        element
        
        2
        
        ---------
        
        3
        
         foo
        
        4
        
         bar
        
        5
        
         42
        
        6
        
        (3 rows)
[/code]

  * Set
[code] 1
        
        create foreign table redis.set (
        
        2
        
          element text
        
        3
        
        )
        
        4
        
        server redis_server
        
        5
        
        options (
        
        6
        
          src_type 'set',
        
        7
        
          src_key 'set'
        
        8
        
        );
        
        9
        
        10
        
        select * from redis.set;
[/code]

Query result:
[code] 1
        
        element
        
        2
        
        ---------
        
        3
        
         42
        
        4
        
         foo
        
        5
        
         bar
        
        6
        
        (3 rows)
[/code]

  * Hash
[code] 1
        
        create foreign table redis.hash (
        
        2
        
          key text,
        
        3
        
          value text
        
        4
        
        )
        
        5
        
        server redis_server
        
        6
        
        options (
        
        7
        
          src_type 'hash',
        
        8
        
          src_key 'hash'
        
        9
        
        );
        
        10
        
        11
        
        select * from redis.hash;
[/code]

Query result:
[code] 1
        
        key | value
        
        2
        
        -----+-------
        
        3
        
         foo | bar
        
        4
        
         baz | qux
        
        5
        
        (2 rows)
[/code]

  * Sorted set
[code] 1
        
        create foreign table redis.zset (
        
        2
        
          element text
        
        3
        
        )
        
        4
        
        server redis_server
        
        5
        
        options (
        
        6
        
          src_type 'zset',
        
        7
        
          src_key 'zset'
        
        8
        
        );
        
        9
        
        10
        
        select * from redis.zset;
[/code]

Query result:
[code] 1
        
        element
        
        2
        
        ---------
        
        3
        
         baz
        
        4
        
         bar
        
        5
        
         foo
        
        6
        
        (3 rows)
[/code]

  * Stream
[code] 1
        
        create foreign table redis.stream (
        
        2
        
          id text,
        
        3
        
          items jsonb
        
        4
        
        )
        
        5
        
        server redis_server
        
        6
        
        options (
        
        7
        
          src_type 'stream',
        
        8
        
          src_key 'stream'
        
        9
        
        );
        
        10
        
        11
        
        select * from redis.stream;
[/code]

Query result:
[code] 1
        
        id        |          items
        
        2
        
        -----------------+--------------------------
        
        3
        
         1704343825989-0 | {"foo": "bar"}
        
        4
        
         1704343829799-0 | {"aa": "42", "bb": "43"}
        
        5
        
        (2 rows)
[/code]


### Query multiple objects example#

This example will create several foreign tables using pattern in key and query multiple objects from Redis:

  * List
[code] 1
        
        create foreign table redis.multi_lists (
        
        2
        
          key text,
        
        3
        
          items jsonb
        
        4
        
        )
        
        5
        
          server redis_server
        
        6
        
          options (
        
        7
        
            src_type 'multi_list',
        
        8
        
            src_key 'list:*'
        
        9
        
          );
        
        10
        
        11
        
        select * from redis.multi_lists;
[/code]

Query result:
[code] 1
        
        key    |     items
        
        2
        
        ----------+----------------
        
        3
        
         list:100 | ["foo", "bar"]
        
        4
        
         list:200 | ["baz"]
        
        5
        
        (2 rows)
[/code]

  * Set
[code] 1
        
        create foreign table redis.multi_sets (
        
        2
        
          key text,
        
        3
        
          items jsonb
        
        4
        
        )
        
        5
        
          server redis_server
        
        6
        
          options (
        
        7
        
            src_type 'multi_set',
        
        8
        
            src_key 'set:*'
        
        9
        
          );
        
        10
        
        11
        
        select * from redis.multi_sets;
[/code]

Query result:
[code] 1
        
        key   |  items
        
        2
        
        ---------+---------
        
        3
        
         set:100 | ["foo"]
        
        4
        
         set:200 | ["bar"]
        
        5
        
        (2 rows)
[/code]

  * Hash
[code] 1
        
        create foreign table redis.multi_hashes (
        
        2
        
          key text,
        
        3
        
          items jsonb
        
        4
        
        )
        
        5
        
          server redis_server
        
        6
        
          options (
        
        7
        
            src_type 'multi_hash',
        
        8
        
            src_key 'hash:*'
        
        9
        
          );
        
        10
        
        11
        
        select * from redis.multi_hashes;
[/code]

Query result:
[code] 1
        
        key    |     items
        
        2
        
        ----------+----------------
        
        3
        
         hash:200 | {"baz": "qux"}
        
        4
        
         hash:100 | {"foo": "bar"}
        
        5
        
        (2 rows)
[/code]

  * Sorted set
[code] 1
        
        create foreign table redis.multi_zsets (
        
        2
        
          key text,
        
        3
        
          items jsonb
        
        4
        
        )
        
        5
        
          server redis_server
        
        6
        
          options (
        
        7
        
            src_type 'multi_zset',
        
        8
        
            src_key 'zset:*'
        
        9
        
          );
        
        10
        
        11
        
        select * from redis.multi_zsets;
[/code]

Query result:
[code] 1
        
        key    |     items
        
        2
        
        ----------+----------------
        
        3
        
         zset:200 | ["qux", "baz"]
        
        4
        
         zset:100 | ["foo", "bar"]
        
        5
        
        (2 rows)
[/code]