---
タイトル: PGroonga: Multilingual Full Text Search
URL: https://supabase.com/docs/guides/database/extensions/pgroonga
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, full, multilingual, pgroonga, search, text
---

# PGroonga: Multilingual Full Text Search

**URL:** https://supabase.com/docs/guides/database/extensions/pgroonga
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, full, multilingual, pgroonga, search, text

## 目次

- [Enable the extension#](#enable-the-extension)
- [Creating a full text search index#](#creating-a-full-text-search-index)
- [Full text search#](#full-text-search)
  - [Match all search words#](#match-all-search-words)
  - [Match any search words#](#match-any-search-words)
  - [Search that matches words with negation#](#search-that-matches-words-with-negation)
- [Resources#](#resources)

## 概要

Full Text Search for multiple languages in Postgres

---

`PGroonga` is a Postgres extension adding a full text search indexing method based on [Groonga](<https://groonga.org>). While native Postgres supports full text indexing, it is limited to alphabet and digit based languages. `PGroonga` offers a wider range of character support making it viable for a superset of languages supported by Postgres including Japanese, Chinese, etc.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `pgroonga` and enable the extension.


## Creating a full text search index#

Given a table with a `text` column:
[code] 
    1
    
    create table memos (
    
    2
    
      id serial primary key,
    
    3
    
      content text
    
    4
    
    );
[/code]

We can index the column for full text search with a `pgroonga` index:
[code] 
    1
    
    create index ix_memos_content ON memos USING pgroonga(content);
[/code]

To test the full text index, we'll add some data.
[code] 
    1
    
    insert into memos(content)
    
    2
    
    values
    
    3
    
      ('Postgres is a relational database management system.'),
    
    4
    
      ('Groonga is a fast full text search engine that supports all languages.'),
    
    5
    
      ('PGroonga is a Postgres extension that uses Groonga as index.'),
    
    6
    
      ('There is groonga command.');
[/code]

The Postgres query planner is smart enough to know that, for extremely small tables, it's faster to scan the whole table rather than loading an index. To force the index to be used, we can disable sequential scans:
[code] 
    1
    
    -- For testing only. Don't do this in production
    
    2
    
    set enable_seqscan = off;
[/code]

Now if we run an explain plan on a query filtering on `memos.content`:
[code] 
    1
    
    explain select * from memos where content like '%engine%';
    
    2
    
    3
    
                                   QUERY PLAN
    
    4
    
    -----------------------------------------------------------------------------
    
    5
    
    Index Scan using ix_memos_content on memos  (cost=0.00..1.11 rows=1 width=36)
    
    6
    
      Index Cond: (content ~~ '%engine%'::text)
    
    7
    
    (2 rows)
[/code]

The `pgroonga` index is used to retrieve the result set:
[code] 
    1
    
    | id  | content                                                                  |
    
    2
    
    | --- | ------------------------------------------------------------------------ |
    
    3
    
    | 2   | 'Groonga is a fast full text search engine that supports all languages.' |
[/code]

## Full text search#

The `&@~` operator performs full text search. It returns any matching results. Unlike `LIKE` operator, `pgroonga` can search any text that contains the keyword case insensitive.

Take the following example:
[code] 
    1
    
    select * from memos where content &@~ 'groonga';
[/code]

And the result:
[code] 
    1
    
    id | content  
    
    2
    
    ----+------------------------------------------------------------------------
    
    3
    
    2 | Groonga is a fast full text search engine that supports all languages.
    
    4
    
    3 | PGroonga is a Postgres extension that uses Groonga as index.
    
    5
    
    4 | There is groonga command.
    
    6
    
    (3 rows)
[/code]

### Match all search words#

To find all memos where content contains BOTH of the words `postgres` and `pgroonga`, we can use space to separate each words:
[code] 
    1
    
    select * from memos where content &@~ 'postgres pgroonga';
[/code]

And the result:
[code] 
    1
    
    id | content  
    
    2
    
    ----+----------------------------------------------------------------
    
    3
    
    3 | PGroonga is a Postgres extension that uses Groonga as index.
    
    4
    
    (1 row)
[/code]

### Match any search words#

To find all memos where content contain ANY of the words `postgres` or `pgroonga`, use the upper case `OR`:
[code] 
    1
    
    select * from memos where content &@~ 'postgres OR pgroonga';
[/code]

And the result:
[code] 
    1
    
    id | content  
    
    2
    
    ----+----------------------------------------------------------------
    
    3
    
    1 | Postgres is a relational database management system.
    
    4
    
    3 | PGroonga is a Postgres extension that uses Groonga as index.
    
    5
    
    (2 rows)
[/code]

### Search that matches words with negation#

To find all memos where content contain the word `postgres` but not `pgroonga`, use `-` symbol:
[code] 
    1
    
    select * from memos where content &@~ 'postgres -pgroonga';
[/code]

And the result:
[code] 
    1
    
    id | content  
    
    2
    
    ----+--------------------------------------------------------
    
    3
    
    1 | Postgres is a relational database management system.
    
    4
    
    (1 row)
[/code]

## Resources#

  * Official [PGroonga documentation](<https://pgroonga.github.io/tutorial/>)