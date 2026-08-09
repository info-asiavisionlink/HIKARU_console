---
タイトル: Computed Fields
URL: https://supabase.com/docs/guides/graphql/computed-fields
カテゴリ: api
更新日: 2026-08-02
タグ: api, computed, computed-fields, fields, graphql
---

# Computed Fields

**URL:** https://supabase.com/docs/guides/graphql/computed-fields
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, computed, computed-fields, fields, graphql

## 目次

- [Computed Values#](#computed-values)
  - [PostgreSQL Builtin (Preferred)#](#postgresql-builtin-preferred)
  - [Extending Types with Functions#](#extending-types-with-functions)
- [Computed Relationships#](#computed-relationships)
  - [To-One#](#to-one)
  - [To-Many#](#to-many)

## 概要

Using Postgres Computed Fields with GraphQL.

---

## Computed Values#

### PostgreSQL Builtin (Preferred)#

PostgreSQL has a builtin method for adding [generated columns](<https://www.postgresql.org/docs/14/ddl-generated-columns.html>) to tables. Generated columns are reflected identically to non-generated columns. This is the recommended approach to adding computed fields when your computation meets the restrictions. Namely:

  * expression must be immutable
  * expression may only reference the current row


For example:
[code] 
    1
    
    --8<-- "test/expected/extend_type_with_generated_column.out"
[/code]

### Extending Types with Functions#

For arbitrary computations that do not meet the requirements for [generated columns](<https://www.postgresql.org/docs/14/ddl-generated-columns.html>), a table's reflected GraphQL type can be extended by creating a function that:

  * accepts a single argument of the table's tuple type


[code] 
    1
    
    --8<-- "test/expected/extend_type_with_function.out"
[/code]

If the function is written in SQL, its volatility can impact freshness of data returned in mutations:
[code] 
    1
    
    --8<-- "test/expected/issue_337.out"
[/code]

## Computed Relationships#

Computed relations can be helpful to express relationships:

  * between entities that don't support foreign keys
  * too complex to be expressed via a foreign key


If the relationship is simple, but involves an entity that does not support foreign keys e.g. Foreign Data Wrappers / Views, defining a comment directive is the easiest solution. See the [view doc](</docs/guides/graphql/views>) for a complete example. Note that for entities that do not support a primary key, like views, you must define one using a [comment directive](</docs/guides/graphql/configuration#comment-directives>) to use them in a computed relationship.

Alternatively, if the relationship is complex, or you need compatibility with PostgREST, you can define a relationship using set returning functions.

### To-One#

To One relationships can be defined using a function that returns `setof <entity> rows 1`

For example
[code] 
    1
    
    create table "Person" (
    
    2
    
        id int primary key,
    
    3
    
        name text
    
    4
    
    );
    
    5
    
    6
    
    create table "Address"(
    
    7
    
        id int primary key,
    
    8
    
        "isPrimary" bool not null default false,
    
    9
    
        "personId" int references "Person"(id),
    
    10
    
        address text
    
    11
    
    );
    
    12
    
    13
    
    -- Example computed relation
    
    14
    
    create function "primaryAddress"("Person")
    
    15
    
        returns setof "Address" rows 1
    
    16
    
        language sql
    
    17
    
        as
    
    18
    
    $$
    
    19
    
        select addr
    
    20
    
        from "Address" addr
    
    21
    
        where $1.id = addr."personId"
    
    22
    
              and addr."isPrimary"
    
    23
    
        limit 1
    
    24
    
    $$;
    
    25
    
    26
    
    insert into "Person"(id, name)
    
    27
    
    values (1, 'Foo Barington');
    
    28
    
    29
    
    insert into "Address"(id, "isPrimary", "personId", address)
    
    30
    
    values (4, true, 1, '1 Main St.');
[/code]

results in the GraphQL type

Person
[code]
    1
    
    type Person implements Node {
    
    2
    
      """Globally Unique Record Identifier"""
    
    3
    
      nodeId: ID!
    
    4
    
      ...
    
    5
    
      primaryAddress: Address
    
    6
    
    }
[/code]

and can be queried like a natively enforced relationship

QueryResponse
[code]
    1
    
    {
    
    2
    
      personCollection {
    
    3
    
        edges {
    
    4
    
          node {
    
    5
    
            id
    
    6
    
            name
    
    7
    
            primaryAddress {
    
    8
    
              address
    
    9
    
            }
    
    10
    
          }
    
    11
    
        }
    
    12
    
    13
    
      }
    
    14
    
    }
[/code]

### To-Many#

To-many relationships can be defined using a function that returns a `setof <entity>`

For example:
[code] 
    1
    
    create table "Person" (
    
    2
    
        id int primary key,
    
    3
    
        name text
    
    4
    
    );
    
    5
    
    6
    
    create table "Address"(
    
    7
    
        id int primary key,
    
    8
    
        address text
    
    9
    
    );
    
    10
    
    11
    
    create table "PersonAtAddress"(
    
    12
    
        id int primary key,
    
    13
    
        "personId" int not null,
    
    14
    
        "addressId" int not null
    
    15
    
    );
    
    16
    
    17
    
    18
    
    -- Computed relation to bypass "PersonAtAddress" table for cleaner API
    
    19
    
    create function "addresses"("Person")
    
    20
    
        returns setof "Address"
    
    21
    
        language sql
    
    22
    
        as
    
    23
    
    $$
    
    24
    
        select
    
    25
    
            addr
    
    26
    
        from
    
    27
    
            "PersonAtAddress" pa
    
    28
    
            join "Address" addr
    
    29
    
                on pa."addressId" = "addr".id
    
    30
    
        where
    
    31
    
            pa."personId" = $1.id
    
    32
    
    $$;
    
    33
    
    34
    
    insert into "Person"(id, name)
    
    35
    
    values (1, 'Foo Barington');
    
    36
    
    37
    
    insert into "Address"(id, address)
    
    38
    
    values (4, '1 Main St.');
    
    39
    
    40
    
    insert into "PersonAtAddress"(id, "personId", "addressId")
    
    41
    
    values (2, 1, 4);
[/code]

results in the GraphQL type

Person
[code]
    1
    
    type Person implements Node {
    
    2
    
      """Globally Unique Record Identifier"""
    
    3
    
      nodeId: ID!
    
    4
    
      ...
    
    5
    
      addresses(
    
    6
    
        first: Int
    
    7
    
        last: Int
    
    8
    
        before: Cursor
    
    9
    
        after: Cursor
    
    10
    
        filter: AddressFilter
    
    11
    
        orderBy: [AddressOrderBy!]
    
    12
    
      ): AddressConnection
    
    13
    
    }
[/code]

and can be queried like a natively enforced relationship

QueryResponse
[code]
    1
    
    {
    
    2
    
      personCollection {
    
    3
    
        edges {
    
    4
    
          node {
    
    5
    
            id
    
    6
    
            name
    
    7
    
            addresses {
    
    8
    
              edges {
    
    9
    
                node {
    
    10
    
                  id
    
    11
    
                  address
    
    12
    
                }
    
    13
    
              }
    
    14
    
            }
    
    15
    
          }
    
    16
    
        }
    
    17
    
      }
    
    18
    
    }
[/code]