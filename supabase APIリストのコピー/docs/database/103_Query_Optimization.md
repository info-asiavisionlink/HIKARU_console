---
タイトル: Query Optimization
URL: https://supabase.com/docs/guides/database/query-optimization
カテゴリ: database
更新日: 2026-08-02
タグ: database, optimization, query, query-optimization
---

# Query Optimization

**URL:** https://supabase.com/docs/guides/database/query-optimization
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, optimization, query, query-optimization

## 目次

- [Example query#](#example-query)
  - [whereclause:#](#where-clause)
  - [joincolumns#](#join-columns)
  - [order byclause#](#order-by-clause)
- [Key concepts#](#key-concepts)
  - [Analyze the query plan#](#analyze-the-query-plan)
  - [Use appropriate index types#](#use-appropriate-index-types)
  - [Partial indexes#](#partial-indexes)
  - [Composite indexes#](#composite-indexes)
  - [Over-Indexing#](#over-indexing)
  - [Statistics#](#statistics)

## 概要

Choosing indexes to improve your query performance.

---

When working with Postgres, or any relational database, indexing is key to improving query performance. Aligning indexes with common query patterns can speed up data retrieval by an order of magnitude.

This guide is intended to:

  * help identify parts of a query that have the potential to be improved by indexes
  * introduce tooling to help identify useful indexes


This is not a comprehensive resource, but rather a helpful starting point for your optimization journey.

If you're new to query optimization, you may be interested in [`index_advisor`](</docs/guides/database/extensions/index_advisor>), our tool for automatically detecting indexes that improve performance on a given query.

## Example query#

Consider the following example query that retrieves customer names and purchase dates from two tables:
[code] 
    1
    
    select
    
    2
    
      a.name,
    
    3
    
      b.date_of_purchase
    
    4
    
    from
    
    5
    
      customers as a
    
    6
    
      join orders as b on a.id = b.customer_id
    
    7
    
    where a.sign_up_date > '2023-01-01' and b.status = 'shipped'
    
    8
    
    order by b.date_of_purchase
    
    9
    
    limit 10;
[/code]

In this query, there are several parts that indexes could likely help in optimizing the performance:

### `where` clause:#

The `where` clause filters rows based on certain conditions, and indexing the columns involved can improve this process:

  * `a.sign_up_date`: If filtering by `sign_up_date` is common, indexing this column can speed up the query.
  * `b.status`: Indexing the status may be beneficial if the column has diverse values.


[code] 
    1
    
    create index idx_customers_sign_up_date on customers (sign_up_date);
    
    2
    
    3
    
    create index idx_orders_status on orders (status);
[/code]

### `join` columns#

Indexes on the columns used for joining tables can help Postgres avoid scanning tables in their entirety when connecting tables.

  * Indexing `a.id` and `b.customer_id` would likely improve the performance of the join in this query.
  * Note that if `a.id` is the primary key of the `customers` table it is already indexed


[code] 
    1
    
    create index idx_orders_customer_id on orders (customer_id);
[/code]

### `order by` clause#

Sorting can also be optimized by indexing:

  * An index on `b.date_of_purchase` can improve the sorting process, and is particularly beneficial when a subset of rows is being returned with a `limit` clause.


[code] 
    1
    
    create index idx_orders_date_of_purchase on orders (date_of_purchase);
[/code]

## Key concepts#

Here are some concepts and tools to keep in mind to help you identify the best index for the job, and measure the impact that your index had:

### Analyze the query plan#

Use the `explain` command to understand the query's execution. Look for slow parts, such as Sequential Scans or high cost numbers. If creating an index does not reduce the cost of the query plan, remove it.

For example:
[code] 
    1
    
    explain select * from customers where sign_up_date > 25;
[/code]

### Use appropriate index types#

Postgres offers various index types like [B-tree, Hash, GIN, etc](<https://www.postgresql.org/docs/current/indexes-types.html>). Select the type that best suits your data and query pattern. Using the right index type can make a significant difference. For example, using a BRIN index on a field that always increases and lives within a table that updates infrequently - like `created_at` on an `orders` table - routinely results in indexes that are +10x smaller than the equivalent default B-tree index. That translates into better scalability.
[code] 
    1
    
    create index idx_orders_created_at ON customers using brin(created_at);
[/code]

### Partial indexes#

For queries that frequently target a subset of data, a partial index could be faster and smaller than indexing the entire column. A partial index contains a `where` clause to filter the values included in the index. Note that a query's `where` clause must match the index for it to be used.
[code] 
    1
    
    create index idx_orders_status on orders (status)
    
    2
    
    where status = 'shipped';
[/code]

### Composite indexes#

If filtering or joining on multiple columns, a composite index prevents Postgres from referring to multiple indexes when identifying the relevant rows.
[code] 
    1
    
    create index idx_customers_sign_up_date_priority on customers (sign_up_date, priority);
[/code]

### Over-Indexing#

Avoid the urge to index columns you operate on infrequently. While indexes can speed up reads, they also slow down writes, so it's important to balance those factors when making indexing decisions.

### Statistics#

Postgres maintains a set of statistics about the contents of your tables. Those statistics are used by the query planner to decide when it's is more efficient to use an index vs scanning the entire table. If the collected statistics drift too far from reality, the query planner may make poor decisions. To avoid this risk, you can periodically `analyze` tables.
[code] 
    1
    
    analyze customers;
[/code]

* * *

By following this guide, you'll be able to discern where indexes can optimize queries and enhance your Postgres performance. Remember that each database is unique, so always consider the specific context and use case of your queries.