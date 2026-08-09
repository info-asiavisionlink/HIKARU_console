---
タイトル: pg_graphql: GraphQL for Postgres
URL: https://supabase.com/docs/guides/database/extensions/pg_graphql
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, graphql, pg_graphql, postgres
---

# pg_graphql: GraphQL for Postgres

**URL:** https://supabase.com/docs/guides/database/extensions/pg_graphql
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, graphql, pg_graphql, postgres

## 目次

- [Enable the extension#](#enable-the-extension)
- [Usage#](#usage)
- [API#](#api)
- [Resources#](#resources)

## 概要

A GraphQL Interface for Postgres

---

[pg_graphql](<https://supabase.github.io/pg_graphql/>) is Postgres extension for interacting with the database using [GraphQL](<https://graphql.org>) instead of SQL.

The extension reflects a GraphQL schema from the existing SQL schema and exposes it through a SQL function, `graphql.resolve(...)`. This enables any programming language that can connect to Postgres to query the database via GraphQL with no additional servers, processes, or libraries.

The `pg_graphql` resolve method is designed to interop with [PostgREST](<https://postgrest.org/en/stable/index.html>), the tool that underpins the Supabase API, such that the `graphql.resolve` function can be called via RPC to safely and performantly expose the GraphQL API over HTTP/S.

For more information about how the SQL schema is reflected into a GraphQL schema, see the [pg_graphql API docs](<https://supabase.github.io/pg_graphql/api/>).

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for "pg_graphql" and enable the extension.


## Usage#

Given a table
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name text not null,
    
    4
    
      description text
    
    5
    
    );
    
    6
    
    7
    
    insert into "Blog"(name)
    
    8
    
    values ('My Blog');
[/code]

The reflected GraphQL schema can be queried immediately as
[code] 
    1
    
    select
    
    2
    
      graphql.resolve($$
    
    3
    
        {
    
    4
    
          blogCollection(first: 1) {
    
    5
    
            edges {
    
    6
    
              node {
    
    7
    
                id,
    
    8
    
                name
    
    9
    
              }
    
    10
    
            }
    
    11
    
          }
    
    12
    
        }
    
    13
    
      $$);
[/code]

returning the JSON
[code] 
    1
    
    {
    
    2
    
      "data": {
    
    3
    
        "blogCollection": {
    
    4
    
          "edges": [
    
    5
    
            {
    
    6
    
              "node": {
    
    7
    
                "id": 1,
    
    8
    
                "name": "My Blog"
    
    9
    
              }
    
    10
    
            }
    
    11
    
          ]
    
    12
    
        }
    
    13
    
      }
    
    14
    
    }
[/code]

Note that `pg_graphql` supports schema introspection, so you can connect any GraphQL IDE or schema inspection tool to see the full set of fields and arguments available in the API. Starting from `pg_graphql` 1.6.0, introspection is **disabled by default** and must be enabled per schema:
[code] 
    1
    
    comment on schema public is e'@graphql({"introspection": true})';
[/code]

See the [upgrade notes](</guides/platform/upgrading#upgrading-to-pg_graphql-160>) for details.

## API#

  * [`graphql.resolve`](<https://supabase.github.io/pg_graphql/sql_interface/>): A SQL function for executing GraphQL queries.


## Resources#

  * Official [`pg_graphql` documentation](<https://github.com/supabase/pg_graphql>)