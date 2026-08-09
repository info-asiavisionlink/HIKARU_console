---
タイトル: Functions
URL: https://supabase.com/docs/guides/graphql/functions
カテゴリ: api
更新日: 2026-08-02
タグ: api, functions, graphql
---

# Functions

**URL:** https://supabase.com/docs/guides/graphql/functions
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, functions, graphql

## 目次

- [Query vs Mutation#](#query-vs-mutation)
- [Supported Return Types#](#supported-return-types)
- [Default Arguments#](#default-arguments)
- [Limitations#](#limitations)

## 概要

Using Postgres Functions with GraphQL.

---

Functions can be exposed by pg_graphql to allow running custom queries or mutations.

## Query vs Mutation#

For example, a function to add two numbers will be available on the query type as a field:

FunctionQueryTypeQueryResponse
[code]
    1
    
    create function "addNums"(a int, b int)
    
    2
    
      returns int
    
    3
    
      immutable
    
    4
    
      language sql
    
    5
    
    as $$ select a + b; $$;
[/code]

Functions marked `immutable` or `stable` are available on the query type. Functions marked with the default `volatile` category are available on the mutation type:

FunctionMutationTypeQueryResponse
[code]
    1
    
    create table account(
    
    2
    
      id serial primary key,
    
    3
    
      email varchar(255) not null
    
    4
    
    );
    
    5
    
    6
    
    create function "addAccount"(email text)
    
    7
    
      returns int
    
    8
    
      volatile
    
    9
    
      language sql
    
    10
    
    as $$ insert into account (email) values (email) returning id; $$;
[/code]

## Supported Return Types#

Built-in GraphQL scalar types `Int`, `Float`, `String`, `Boolean` and [custom scalar types](</docs/guides/graphql/api#custom-scalars>) are supported as function arguments and return types. Function types returning a table or view are supported as well. Such functions implement the [Node interface](</docs/guides/graphql/api#node>):

FunctionQueryTypeQueryResponse
[code]
    1
    
    create table account(
    
    2
    
      id serial primary key,
    
    3
    
      email varchar(255) not null
    
    4
    
    );
    
    5
    
    6
    
    insert into account(email)
    
    7
    
    values
    
    8
    
      ('a@example.com'),
    
    9
    
      ('b@example.com');
    
    10
    
    11
    
    create function "accountById"("accountId" int)
    
    12
    
      returns account
    
    13
    
      stable
    
    14
    
      language sql
    
    15
    
    as $$ select id, email from account where id = "accountId"; $$;
[/code]

Since Postgres considers a row/composite type containing only null values to be null, the result can be a little surprising in this case. Instead of an object with all columns null, the top-level field is null:

FunctionQueryResponse
[code]
    1
    
    create table account(
    
    2
    
        id int,
    
    3
    
        email varchar(255),
    
    4
    
        name text null
    
    5
    
    );
    
    6
    
    7
    
    insert into account(id, email, name)
    
    8
    
    values
    
    9
    
        (1, 'aardvark@x.com', 'aardvark'),
    
    10
    
        (2, 'bat@x.com', null),
    
    11
    
        (null, null, null);
    
    12
    
    13
    
    create function "returnsAccountWithAllNullColumns"()
    
    14
    
        returns account language sql stable
    
    15
    
    as $$ select id, email, name from account where id is null; $$;
[/code]

Functions returning multiple rows of a table or view are exposed as [collections](</docs/guides/graphql/api#collections>).

FunctionQueryTypeQueryResponse
[code]
    1
    
    create table "Account"(
    
    2
    
      id serial primary key,
    
    3
    
      email varchar(255) not null
    
    4
    
    );
    
    5
    
    6
    
    insert into "Account"(email)
    
    7
    
    values
    
    8
    
      ('a@example.com'),
    
    9
    
      ('a@example.com'),
    
    10
    
      ('b@example.com');
    
    11
    
    12
    
    create function "accountsByEmail"("emailToSearch" text)
    
    13
    
      returns setof "Account"
    
    14
    
      stable
    
    15
    
      language sql
    
    16
    
    as $$ select id, email from "Account" where email = "emailToSearch"; $$;
[/code]

A set returning function with any of its argument names clashing with argument names of a collection (`first`, `last`, `before`, `after`, `filter`, or `orderBy`) will not be exposed.

Functions accepting or returning arrays of non-composite types are also supported. In the following example, the `ids` array is used to filter rows from the `Account` table:

FunctionQueryTypeQueryResponse
[code]
    1
    
    create table "Account"(
    
    2
    
      id serial primary key,
    
    3
    
      email varchar(255) not null
    
    4
    
    );
    
    5
    
    6
    
    insert into "Account"(email)
    
    7
    
    values
    
    8
    
      ('a@example.com'),
    
    9
    
      ('b@example.com'),
    
    10
    
      ('c@example.com');
    
    11
    
    12
    
    create function "accountsByIds"("ids" int[])
    
    13
    
      returns setof "Account"
    
    14
    
      stable
    
    15
    
      language sql
    
    16
    
    as $$ select id, email from "Account" where id = any(ids); $$;
[/code]

## Default Arguments#

Arguments without a default value are required in the GraphQL schema, to make them optional they should have a default value.

FunctionQueryTypeQueryResponse
[code]
    1
    
    create function "addNums"(a int default 1, b int default 2)
    
    2
    
      returns int
    
    3
    
      immutable
    
    4
    
      language sql
    
    5
    
    as $$ select a + b; $$;
[/code]

If there is no sensible default, and you still want to make the argument optional, consider using the default value null.

FunctionQueryTypeQueryResponse
[code]
    1
    
    create function "addNums"(a int default null, b int default null)
    
    2
    
        returns int
    
    3
    
        immutable
    
    4
    
        language plpgsql
    
    5
    
    as $$
    
    6
    
    begin
    
    7
    
    8
    
        if a is null and b is null then
    
    9
    
            raise exception 'a and b both can''t be null';
    
    10
    
        end if;
    
    11
    
    12
    
        if a is null then
    
    13
    
            return b;
    
    14
    
        end if;
    
    15
    
    16
    
        if b is null then
    
    17
    
            return a;
    
    18
    
        end if;
    
    19
    
    20
    
        return a + b;
    
    21
    
    end;
    
    22
    
    $$;
[/code]

Currently, null defaults are only supported as simple expressions, as shown in the previous example.

## Limitations#

The following features are not yet supported. Any function using these features is not exposed in the API:

  * Functions that accept a table's tuple type
  * Overloaded functions
  * Functions with a nameless argument
  * Functions returning void
  * Variadic functions
  * Functions that accept or return an array of composite type
  * Functions that accept or return an enum type or an array of enum type