---
タイトル: Views
URL: https://supabase.com/docs/guides/graphql/views
カテゴリ: api
更新日: 2026-08-02
タグ: api, graphql, views
---

# Views

**URL:** https://supabase.com/docs/guides/graphql/views
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, graphql, views

## 目次

- [Primary Keys (Required)#](#primary-keys-required)
- [Relationships#](#relationships)

## 概要

Using Postgres Views with GraphQL.

---

Views, materialized views, and foreign tables can be exposed with pg_graphql.

## Primary Keys (Required)#

A primary key is required for an entity to be reflected in the GraphQL schema. Tables can define primary keys with SQL DDL, but primary keys are not available for views, materialized views, or foreign tables. For those entities, you can set a "fake" primary key with a [comment directive](</docs/guides/graphql/configuration#comment-directives>).
[code] 
    1
    
    {"primary_key_columns": [<column_name_1>, ..., <column_name_n>]}
[/code]

For example:
[code] 
    1
    
    create view "Person" as
    
    2
    
      select
    
    3
    
        id,
    
    4
    
        name
    
    5
    
      from
    
    6
    
        "Account";
    
    7
    
    8
    
    comment on view "Person" is e'@graphql({"primary_key_columns": ["id"]})';
[/code]

tells pg_graphql to treat `"Person".id` as the primary key for the `Person` entity resulting in the following GraphQL type:
[code] 
    1
    
    type Person {
    
    2
    
      nodeId: ID!
    
    3
    
      id: Int!
    
    4
    
      name: String!
    
    5
    
    }
[/code]

Values of the primary key column/s must be unique within the table. If they are not unique, you will experience inconsistent behavior with `ID!` types, sorting, and pagination.

[Updatable views](<https://www.postgresql.org/docs/current/sql-createview.html#SQL-CREATEVIEW-UPDATABLE-VIEWS>) are reflected in the `Query` and `Mutation` types identically to tables. Non-updatable views are read-only and accessible via the `Query` type only.

## Relationships#

pg_graphql identifies relationships among entities by inspecting foreign keys. Views, materialized views, and foreign tables do not support foreign keys. For this reason, relationships can also be defined in [comment directive](</docs/guides/graphql/configuration#comment-directives>) using the structure:
[code] 
    1
    
    {
    
    2
    
      "foreign_keys": [
    
    3
    
        {
    
    4
    
          "local_name": "foo", // optional
    
    5
    
          "local_columns": ["account_id"],
    
    6
    
          "foreign_name": "bar", // optional
    
    7
    
          "foreign_schema": "public",
    
    8
    
          "foreign_table": "account",
    
    9
    
          "foreign_columns": ["id"]
    
    10
    
        }
    
    11
    
      ]
    
    12
    
    }
[/code]

For example:
[code] 
    1
    
    create table "Account"(
    
    2
    
      id serial primary key,
    
    3
    
      name text not null
    
    4
    
    );
    
    5
    
    6
    
    create table "EmailAddress"(
    
    7
    
      id serial primary key,
    
    8
    
      "accountId" int not null, -- note: no foreign key
    
    9
    
      "isPrimary" bool not null,
    
    10
    
      address text not null
    
    11
    
    );
    
    12
    
    13
    
    comment on table "EmailAddress" is e'
    
    14
    
        @graphql({
    
    15
    
            "foreign_keys": [
    
    16
    
              {
    
    17
    
                "local_name": "addresses",
    
    18
    
                "local_columns": ["accountId"],
    
    19
    
                "foreign_name": "account",
    
    20
    
                "foreign_schema": "public",
    
    21
    
                "foreign_table": "Account",
    
    22
    
                "foreign_columns": ["id"]
    
    23
    
              }
    
    24
    
            ]
    
    25
    
        })';
[/code]

defines a relationship equivalent to the following foreign key
[code] 
    1
    
    alter table "EmailAddress"
    
    2
    
      add constraint fkey_email_address_to_account
    
    3
    
      foreign key ("accountId")
    
    4
    
      references "Account" ("id");
    
    5
    
    6
    
    comment on constraint fkey_email_address_to_account
    
    7
    
      on "EmailAddress"
    
    8
    
      is E'@graphql({"foreign_name": "account", "local_name": "addresses"})';
[/code]

yielding the GraphQL types:
[code] 
    1
    
    type Account {
    
    2
    
      nodeId: ID!
    
    3
    
      id: Int!
    
    4
    
      name: String!
    
    5
    
      addresses(
    
    6
    
        after: Cursor,
    
    7
    
        before: Cursor,
    
    8
    
        filter: EmailAddressFilter,
    
    9
    
        first: Int,
    
    10
    
        last: Int,
    
    11
    
        orderBy: [EmailAddressOrderBy!]
    
    12
    
      ): EmailAddressConnection
    
    13
    
    }
    
    14
    
    15
    
    type EmailAddress {
    
    16
    
      nodeId: ID!
    
    17
    
      id: Int!
    
    18
    
      isPrimary: Boolean!
    
    19
    
      address: String!
    
    20
    
      accountId: Int!
    
    21
    
      account: Account!
    
    22
    
    }
[/code]