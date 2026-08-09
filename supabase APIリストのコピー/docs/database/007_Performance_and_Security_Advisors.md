---
タイトル: Performance and Security Advisors
URL: https://supabase.com/docs/guides/database/database-advisors
カテゴリ: database
更新日: 2026-08-02
タグ: advisors, database, database-advisors, performance, security
---

# Performance and Security Advisors

**URL:** https://supabase.com/docs/guides/database/database-advisors
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** advisors, database, database-advisors, performance, security

## 目次

- [Using the advisors#](#using-the-advisors)
- [Available checks#](#available-checks)
  - [Rationale#](#rationale)
  - [What is a Foreign Key?#](#what-is-a-foreign-key)
  - [Why Index Foreign Key Columns?#](#why-index-foreign-key-columns)
  - [How to Resolve#](#how-to-resolve)
  - [Example#](#example)

## 概要

Check your database for performance and security issues

---

You can use the Database Performance and Security Advisors to check your database for issues such as missing indexes and improperly set-up RLS policies.

## Using the advisors#

In the dashboard, navigate to [Security Advisor](</dashboard/project/_/database/security-advisor>) and [Performance Advisor](<dashboard/project/_/database/performance-advisor>) under Database. The advisors run automatically. You can also manually rerun them after you've resolved issues.

## Available checks#

0001 unindexed foreign keys0002 auth users exposed0003 auth rls initplan0004 no primary key0005 unused index0006 multiple permissive policies0007 policy exists rls disabled0008 rls enabled no policy0009 duplicate index0010 security definer view0011 function search path mutable0012 auth allow anonymous sign ins0013 rls disabled in public0014 extension in public0015 rls references user metadata0016 materialized view in api0017 foreign table in api0018 unsupported reg types0019 insecure queue exposed in api0020 table bloat0021 fkey to auth unique0022 extension versions outdated0023 sensitive columns exposed0024 permissive rls policy0025 public bucket allows listing0026 pg graphql anon table exposed0027 pg graphql authenticated table exposed0028 anon security definer function executable0029 authenticated security definer function executable

**Level:** INFO

**Summary:** Unindexed foreign keys

**Ramification:** Database queries that filter or join on these columns will be slower because there is no index to speed them up.

* * *

### Rationale#

In relational databases, indexing foreign key columns is a standard practice for improving query performance. Indexing these columns is recommended in most cases because it improves query join performance along a declared relationship.

### What is a Foreign Key?#

A foreign key is a constraint on a column (or set of columns) that enforces a relationship between two tables. For example, a foreign key from `book.author_id` to `author.id` enforces that every value in `book.author_id` exists in `author.id`. Once the foriegn key is declared, it is not possible to insert a value into `book.author_id` that does not exist in `author.id`. Similarly, Postgres will not allow us to delete a value from `author.id` that is referenced by `book.author_id`. This concept is known as referential integrity.

### Why Index Foreign Key Columns?#

Given that foreign keys define relationships among tables, it is common to use foreign key columns in join conditions when querying the database. Adding an index to the columns making up the foreign key improves the performance of those joins and reduces database resource consumption.
[code] 
    1
    
    select
    
    2
    
        book.id,
    
    3
    
        book.title,
    
    4
    
        author.name
    
    5
    
    from
    
    6
    
        book
    
    7
    
        join author
    
    8
    
            -- Both sides of the following condition should be indexed
    
    9
    
            -- for best performance
    
    10
    
            on book.author_id = author.id
[/code]

### How to Resolve#

Given a table:
[code] 
    1
    
    create table book (
    
    2
    
        id serial primary key,
    
    3
    
        title text not null,
    
    4
    
        author_id int references author(id) -- this defines the foreign key
    
    5
    
    );
[/code]

To apply the best practice of indexing foreign keys, an index is needed on the `book.author_id` column. We can create that index using:
[code] 
    1
    
    create index ix_book_author_id on book(author_id);
[/code]

In this case we used the default B-tree index type. Be sure to choose an index type that is appropriate for the data types and use case when working with your own tables.

### Example#

Let's look at a practical example involving two tables: `order_item` and `customer`, where `order_item` references `customer`.

Given the schema:
[code] 
    1
    
    create table customer (
    
    2
    
        id serial primary key,
    
    3
    
        name text not null
    
    4
    
    );
    
    5
    
    6
    
    create table order_item (
    
    7
    
        id serial primary key,
    
    8
    
        order_date date not null,
    
    9
    
        customer_id integer not null references customer (id)
    
    10
    
    );
[/code]

We expect the tables to be joined on the condition
[code] 
    1
    
    customer.id = order_item.customer_id
[/code]

As in:
[code] 
    1
    
    select
    
    2
    
        customer.name,
    
    3
    
        order_item.order_date
    
    4
    
    from
    
    5
    
        customer
    
    6
    
        join order_item
    
    7
    
            on customer.id = order_item.customer_id
[/code]

Using Postgres' "explain plan" functionality, we can see how its query planner expects to execute the query.
[code] 
    1
    
    Hash Join  (cost=38.58..74.35 rows=2040 width=36)
    
    2
    
      Hash Cond: (order_item.customer_id = customer.id)
    
    3
    
      ->  Seq Scan on order_item  (cost=0.00..30.40 rows=2040 width=8)
    
    4
    
      ->  Hash  (cost=22.70..22.70 rows=1270 width=36)
    
    5
    
            ->  Seq Scan on customer  (cost=0.00..22.70 rows=1270 width=36)
[/code]

Notice that the condition `order_item.customer_id = customer.id` is being serviced by a `Seq Scan`, a sequential scan across the `order_items` table. That means Postgres intends to sequentially iterate over each row in the table to identify the value of `customer_id`.

Next, if we index `order_item.customer_id` and recompute the query plan:
[code] 
    1
    
    create index ix_order_item_customer_id on order_item(customer_id);
    
    2
    
    3
    
    explain
    
    4
    
    select
    
    5
    
        customer.name,
    
    6
    
        order_item.order_date
    
    7
    
    from
    
    8
    
        customer
    
    9
    
        join order_item
    
    10
    
            on customer.id = order_item.customer_id
[/code]

We get the query plan:
[code] 
    1
    
    Hash Join  (cost=38.58..74.35 rows=2040 width=36)
    
    2
    
      Hash Cond: (order_item.customer_id = customer.id)
    
    3
    
      ->  Seq Scan on order_item  (cost=0.00..30.40 rows=2040 width=8)
    
    4
    
      ->  Hash  (cost=22.70..22.70 rows=1270 width=36)
    
    5
    
            ->  Seq Scan on customer  (cost=0.00..22.70 rows=1270 width=36)
[/code]

Note that nothing changed.

We get an identical result because Postgres' query planner is clever enough to know that a `Seq Scan` over an empty table is extremely fast, so theres no reason for it to reach out to an index. As more rows are inserted into the `order_item` table the tradeoff between sequentially scanning and retriving the index steadily tip in favor of the index. Rather than manually finding this inflection point, we can hint to the query planner that we'd like to use indexes by disabling sequentials scans except where they are the only available option. To provides that hint we can use:
[code] 
    1
    
    set local enable_seqscan = off;
[/code]

With that change:
[code] 
    1
    
    set local enable_seqscan = off;
    
    2
    
    3
    
    explain
    
    4
    
    select
    
    5
    
        customer.name,
    
    6
    
        order_item.order_date
    
    7
    
    from
    
    8
    
        customer
    
    9
    
        join order_item
    
    10
    
            on customer.id = order_item.customer_id
[/code]

We get the query plan:
[code] 
    1
    
    Hash Join  (cost=79.23..159.21 rows=2040 width=36)
    
    2
    
      Hash Cond: (order_item.customer_id = customer.id)
    
    3
    
      ->  Index Scan using ix_order_item_customer_id on order_item  (cost=0.15..74.75 rows=2040 width=8)
    
    4
    
      ->  Hash  (cost=63.20..63.20 rows=1270 width=36)
    
    5
    
            ->  Index Scan using customer_pkey on customer  (cost=0.15..63.20 rows=1270 width=36)
[/code]

The new plan services the `order_item.customer_id = customer.id` join condition using an `Index Scan` on `ix_order_item_customer_id` which is far more efficient at scale.