---
タイトル: index_advisor: query optimization
URL: https://supabase.com/docs/guides/database/extensions/index_advisor
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, index_advisor, optimization, query
---

# index_advisor: query optimization

**URL:** https://supabase.com/docs/guides/database/extensions/index_advisor
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, index_advisor, optimization, query

## 目次

- [Installation#](#installation)
- [API#](#api)
- [Usage#](#usage)
- [Limitations#](#limitations)
- [Resources#](#resources)

## 概要

Automatically optimize SQL queries

---

[Index advisor](<https://github.com/supabase/index_advisor>) is a Postgres extension for recommending indexes to improve query performance.

Features:

  * Supports generic parameters e.g. `$1`, `$2`
  * Supports materialized views
  * Identifies tables/columns obfuscated by views
  * Skips duplicate indexes


`index_advisor` is accessible directly through Supabase Studio by navigating to the [Query Performance Report](</dashboard/project/_/advisors/query-performance>) and selecting a query and then the "indexes" tab.

![Supabase Studio index_advisor integration.](/docs/img/index_advisor_studio.png)

Alternatively, you can use index_advisor directly via SQL.

For example:
[code] 
    1
    
    select
    
    2
    
        *
    
    3
    
    from
    
    4
    
      index_advisor('select book.id from book where title = $1');
    
    5
    
    6
    
     startup_cost_before | startup_cost_after | total_cost_before | total_cost_after |                  index_statements                   | errors
    
    7
    
    ---------------------+--------------------+-------------------+------------------+-----------------------------------------------------+--------
    
    8
    
     0.00                | 1.17               | 25.88             | 6.40             | {"CREATE INDEX ON public.book USING btree (title)"},| {}
    
    9
    
    (1 row)
[/code]

## Installation#

To get started, enable index_advisor by running
[code] 
    1
    
    create extension index_advisor;
[/code]

## API#

Index advisor exposes a single function `index_advisor(query text)` that accepts a query and searches for a set of SQL DDL `create index` statements that improve the query's execution time.

The function's signature is:
[code] 
    1
    
    index_advisor(query text)
    
    2
    
    returns
    
    3
    
        table  (
    
    4
    
            startup_cost_before jsonb,
    
    5
    
            startup_cost_after jsonb,
    
    6
    
            total_cost_before jsonb,
    
    7
    
            total_cost_after jsonb,
    
    8
    
            index_statements text[],
    
    9
    
            errors text[]
    
    10
    
        )
[/code]

## Usage#

As a minimal example, the `index_advisor` function can be given a single table query with a filter on an unindexed column.
[code] 
    1
    
    create extension if not exists index_advisor cascade;
    
    2
    
    3
    
    create table book(
    
    4
    
      id int primary key,
    
    5
    
      title text not null
    
    6
    
    );
    
    7
    
    8
    
    select
    
    9
    
      *
    
    10
    
    from
    
    11
    
      index_advisor('select book.id from book where title = $1');
    
    12
    
    13
    
     startup_cost_before | startup_cost_after | total_cost_before | total_cost_after |                  index_statements                   | errors
    
    14
    
    ---------------------+--------------------+-------------------+------------------+-----------------------------------------------------+--------
    
    15
    
     0.00                | 1.17               | 25.88             | 6.40             | {"CREATE INDEX ON public.book USING btree (title)"},| {}
    
    16
    
    (1 row)
[/code]

and will return a row recommending an index on the unindexed column.

More complex queries may generate additional suggested indexes:
[code] 
    1
    
    create extension if not exists index_advisor cascade;
    
    2
    
    3
    
    create table author(
    
    4
    
        id serial primary key,
    
    5
    
        name text not null
    
    6
    
    );
    
    7
    
    8
    
    create table publisher(
    
    9
    
        id serial primary key,
    
    10
    
        name text not null,
    
    11
    
        corporate_address text
    
    12
    
    );
    
    13
    
    14
    
    create table book(
    
    15
    
        id serial primary key,
    
    16
    
        author_id int not null references author(id),
    
    17
    
        publisher_id int not null references publisher(id),
    
    18
    
        title text
    
    19
    
    );
    
    20
    
    21
    
    create table review(
    
    22
    
        id serial primary key,
    
    23
    
        book_id int references book(id),
    
    24
    
        body text not null
    
    25
    
    );
    
    26
    
    27
    
    select
    
    28
    
        *
    
    29
    
    from
    
    30
    
        index_advisor('
    
    31
    
            select
    
    32
    
                book.id,
    
    33
    
                book.title,
    
    34
    
                publisher.name as publisher_name,
    
    35
    
                author.name as author_name,
    
    36
    
                review.body review_body
    
    37
    
            from
    
    38
    
                book
    
    39
    
                join publisher
    
    40
    
                    on book.publisher_id = publisher.id
    
    41
    
                join author
    
    42
    
                    on book.author_id = author.id
    
    43
    
                join review
    
    44
    
                    on book.id = review.book_id
    
    45
    
            where
    
    46
    
                author.id = $1
    
    47
    
                and publisher.id = $2
    
    48
    
        ');
    
    49
    
    50
    
     startup_cost_before | startup_cost_after | total_cost_before | total_cost_after |                  index_statements                         | errors
    
    51
    
    ---------------------+--------------------+-------------------+------------------+-----------------------------------------------------------+--------
    
    52
    
     27.26               | 12.77              | 68.48             | 42.37            | {"CREATE INDEX ON public.book USING btree (author_id)",   | {}
    
    53
    
                                                                                        "CREATE INDEX ON public.book USING btree (publisher_id)",
    
    54
    
                                                                                        "CREATE INDEX ON public.review USING btree (book_id)"}
    
    55
    
    (3 rows)
[/code]

## Limitations#

  * index_advisor will only recommend single column, B-tree indexes. More complex indexes will be supported in future releases.
  * when a generic argument's type is not discernible from context, an error is returned in the `errors` field. To resolve those errors, add explicit type casting to the argument. e.g. `$1::int`.


## Resources#

  * [`index_advisor`](<https://github.com/supabase/index_advisor>) repo