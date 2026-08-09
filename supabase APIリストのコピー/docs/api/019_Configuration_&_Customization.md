---
タイトル: Configuration & Customization
URL: https://supabase.com/docs/guides/graphql/configuration
カテゴリ: api
更新日: 2026-08-02
タグ: api, configuration, customization, graphql
---

# Configuration & Customization

**URL:** https://supabase.com/docs/guides/graphql/configuration
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, configuration, customization, graphql

## 目次

- [Comment Directives#](#comment-directives)
  - [Inflection#](#inflection)
  - [Max Rows#](#max-rows)
  - [Introspection#](#introspection)
  - [totalCount#](#totalcount)
  - [Aggregate#](#aggregate)
  - [Renaming#](#renaming)
  - [Description#](#description)

## 概要

Extra configuration options can be set on SQL entities using comment directives.

---

Extra configuration options can be set on SQL entities using comment directives.

## Comment Directives#

Comment directives are snippets of configuration associated with SQL entities that alter how those entities behave.

The format of a comment directive is
[code] 
    1
    
    @graphql(<JSON>)
[/code]

### Inflection#

Inflection describes how SQL entities' names are transformed into GraphQL type and field names. By default, inflection is disabled and SQL names are literally interpolated such that
[code] 
    1
    
    create table "BlogPost"(
    
    2
    
        id int primary key,
    
    3
    
        ...
    
    4
    
    );
[/code]

results in GraphQL type names like
[code] 
    1
    
    BlogPost
    
    2
    
    BlogPostEdge
    
    3
    
    BlogPostConnection
    
    4
    
    ...
[/code]

Since snake case is a common casing structure for SQL types, `pg_graphql` support basic inflection from `snake_case` to `PascalCase` for type names, and `snake_case` to `camelCase` for field names to match Javascript conventions.

The inflection directive can be applied at the schema level with:
[code] 
    1
    
    comment on schema <schema_name> is e'@graphql({"inflect_names": true})';
[/code]

for example
[code] 
    1
    
    comment on schema public is e'@graphql({"inflect_names": true})';
    
    2
    
    3
    
    create table blog_post(
    
    4
    
        id int primary key,
    
    5
    
        ...
    
    6
    
    );
[/code]

similarly would generated the GraphQL type names
[code] 
    1
    
    BlogPost
    
    2
    
    BlogPostEdge
    
    3
    
    BlogPostConnection
    
    4
    
    ...
[/code]

For more fine grained adjustments to reflected names, see renaming.

### Max Rows#

The default page size for collections is 30 entries. To adjust the number of entries on each page, set a `max_rows` directive on the relevant schema entity, table or view.

For example, to increase the max rows per page for each table in the `public` schema:
[code] 
    1
    
    comment on schema public is e'@graphql({"max_rows": 100})';
[/code]

To limit the max rows per page for the `blog_post` table and `Person` view:
[code] 
    1
    
    comment on table blog_post is e'@graphql({"max_rows": 20})';
    
    2
    
    comment on view "Person" is e'@graphql({"primary_key_columns": ["id"], "max_rows": 10})';
[/code]

The `max_rows` value falls back to the parent object if it is missing on the current object. For example, if a table doesn't have `max_rows` set, the value set on the table's schema will be used. If the schema also doesn't have `max_rows` set, then it falls back to default value 30. The parent object of a view is the schema, not the table on which the view is created.

### Introspection#

GraphQL introspection is disabled by default to reduce the potential for API enumeration. Tools like GraphiQL, code generators, Apollo DevTools, and the Relay compiler rely on introspection. Opt in per schema when you need them.

To enable introspection on `public` schema:
[code] 
    1
    
    comment on schema public is e'@graphql({"introspection": true})';
[/code]

To explicitly disable it (same as the default):
[code] 
    1
    
    comment on schema public is e'@graphql({"introspection": false})';
[/code]

When no exposed schema has opted in, `__schema` and `__type` selections return an error:
[code] 
    1
    
    { "errors": [{ "message": "Unknown field \"__schema\" on type Query" }] }
[/code]

#### Partial introspection across multiple schemas#

disable introspection for all schemas

It is recommended to disable introspection for all schemas in production.

The introspection directive is per schema. If two exposed schemas have introspection enabled for one but disabled for another, instead of returning `Unknown field...` errors, disabled schema's types are hidden from introspection fields.

Consider a setup with two schemas, where `public` has introspection enabled and `private` has it disabled:
[code] 
    1
    
    -- public schema exists by default
    
    2
    
    create schema private;
    
    3
    
    4
    
    comment on schema public  is e'@graphql({"inflect_names": true, "introspection": true})';
    
    5
    
    comment on schema private is e'@graphql({"inflect_names": true, "introspection": false})';
    
    6
    
    7
    
    create table public.blog(id serial primary key, content text not null);
    
    8
    
    create table private.account(id serial primary key, email text not null);
    
    9
    
    10
    
    set search_path = public, private;
[/code]

`__schema` and `__type` will not return an error because at least one schema (`public`) has introspection enabled. If neither schema had it enabled, both fields would return `Unknown field "__schema" on type Query`.

**`__type` Field Queries**

The `__type` field successfully resolves types belonging to the `public` schema:

QueryResponse
[code]
    1
    
    { __type(name: "Blog") { kind name } }
[/code]

But it returns `null` for types in the `private` schema:

QueryResponse
[code]
    1
    
    { __type(name: "Account") { kind name } }
[/code]

Any non-existent types in the `private` schema also return null. In that case the introspecting user does not have visibility into if the requested type is in a schema without introspection, or if it doesn't exist. The two responses are indistinguishable:

QueryResponse
[code]
    1
    
    { __type(name: "User") { kind name } }
[/code]

**`__schema` Field Queries**

`__schema` field also filters out types from the private schema. `Blog` and its derived types (`BlogEdge`, `BlogConnection`, `BlogFilter`, `BlogOrderBy`, etc.) appear in the list, while `Account` and its derivatives are absent:

QueryResponse
[code]
    1
    
    { __schema { types { kind name } } }
[/code]

Note that built-in scalars and meta-types continue to appear:

QueryResponse
[code]
    1
    
    { __schema { types { kind name } } }
[/code]

The Query type's field listing is filtered the same way. `blogCollection` appears, `accountCollection` is hidden:

QueryResponse
[code]
    1
    
    { __schema { queryType { fields { name } } } }
[/code]

Same for the the Mutation type's field listing, `Blog`'s mutation fields appear, `Account`'s are hidden:

QueryResponse
[code]
    1
    
    { __schema { mutationType { fields { name } } } }
[/code]

**Mixed Field Queries**

If a query contains both an introspection field (`__schema`, `__type`) and a data field, and introspection is disabled, only the introspection fields return an error, the data field is resolved correctly:

QueryResponse
[code]
    1
    
    {
    
    2
    
      __schema { types { name } }
    
    3
    
      blogCollection { edges { node { id } } }
    
    4
    
    }
[/code]

If there are two schemas with introspection enabled only on one schema, there is no error on the introspection fields but entities from the introspection disabled schema are filtered out:

QueryResponse
[code]
    1
    
    {
    
    2
    
        __schema { types { name } }
    
    3
    
        accountCollection { edges { node { id email } } }
    
    4
    
        blogCollection { edges { node { id content } } }
    
    5
    
    }
[/code]

#### Non-introspection Queries#

Non-introspection queries are not affected by disabling introspection. `accountCollection`, `insertIntoAccountCollection`, etc. continue to resolve normally as long as the role has the underlying SQL privileges:

QueryResponse
[code]
    1
    
    {
    
    2
    
      accountCollection {
    
    3
    
        edges {
    
    4
    
          node {
    
    5
    
            id
    
    6
    
            email
    
    7
    
          }
    
    8
    
        }
    
    9
    
      }
    
    10
    
    }
[/code]

The four combinations across the two schemas behave as follows:

`public`| `private`| `__schema` / `__type` available| `Blog` visible| `Account` visible| Non-introspection queries  
---|---|---|---|---|---  
on| on| yes| yes| yes| unchanged  
on| off| yes| yes| no| unchanged  
off| on| yes| no| yes| unchanged  
off| off| no (`Unknown field` error)| n/a| n/a| unchanged  
  
### totalCount#

`totalCount` is an opt-in field that extends a table's Connection type. It provides a count of the rows that match the query's filters, and ignores pagination arguments.
[code] 
    1
    
    type BlogPostConnection {
    
    2
    
      edges: [BlogPostEdge!]!
    
    3
    
      pageInfo: PageInfo!
    
    4
    
    5
    
      """
    
    6
    
      The total number of records matching the `filter` criteria
    
    7
    
      """
    
    8
    
      totalCount: Int! # this field
    
    9
    
    }
[/code]

to enable `totalCount` for a table, use the directive
[code] 
    1
    
    comment on table "BlogPost" is e'@graphql({"totalCount": {"enabled": true}})';
[/code]

for example
[code] 
    1
    
    create table "BlogPost"(
    
    2
    
        id serial primary key,
    
    3
    
        email varchar(255) not null
    
    4
    
    );
    
    5
    
    comment on table "BlogPost" is e'@graphql({"totalCount": {"enabled": true}})';
[/code]

### Aggregate#

The `aggregate` field is an opt-in field that extends a table's Connection type. It provides various aggregate functions like count, sum, avg, min, and max that operate on the collection of records that match the query's filters.
[code] 
    1
    
    type BlogPostConnection {
    
    2
    
      edges: [BlogPostEdge!]!
    
    3
    
      pageInfo: PageInfo!
    
    4
    
    5
    
      """
    
    6
    
      Aggregate functions calculated on the collection of `BlogPost`
    
    7
    
      """
    
    8
    
      aggregate: BlogPostAggregate # this field
    
    9
    
    }
[/code]

To enable the `aggregate` field for a table, use the directive:
[code] 
    1
    
    comment on table "BlogPost" is e'@graphql({"aggregate": {"enabled": true}})';
[/code]

For example:
[code] 
    1
    
    create table "BlogPost"(
    
    2
    
        id serial primary key,
    
    3
    
        title varchar(255) not null,
    
    4
    
        rating int not null
    
    5
    
    );
    
    6
    
    comment on table "BlogPost" is e'@graphql({"aggregate": {"enabled": true}})';
[/code]

You can combine both totalCount and aggregate directives:
[code] 
    1
    
    comment on table "BlogPost" is e'@graphql({"totalCount": {"enabled": true}, "aggregate": {"enabled": true}})';
[/code]

### Renaming#

#### Table's Type#

Use the `"name"` JSON key to override a table's type name.
[code] 
    1
    
    create table account(
    
    2
    
        id serial primary key
    
    3
    
    );
    
    4
    
    5
    
    comment on table public.account is
    
    6
    
    e'@graphql({"name": "AccountHolder"})';
[/code]

results in:
[code] 
    1
    
    type AccountHolder { # previously: "Account"
    
    2
    
      id: Int!
    
    3
    
    }
[/code]

#### Column's Field Name#

Use the `"name"` JSON key to override a column's field name.
[code] 
    1
    
    create table public."Account"(
    
    2
    
        id serial primary key,
    
    3
    
        email text
    
    4
    
    );
    
    5
    
    6
    
    comment on column "Account".email is
    
    7
    
    e'@graphql({"name": "emailAddress"})';
[/code]

results in:
[code] 
    1
    
    type Account {
    
    2
    
      nodeId: ID!
    
    3
    
      id: Int!
    
    4
    
      emailAddress: String! # previously "email"
    
    5
    
    }
[/code]

#### Computed Field#

Use the `"name"` JSON key to override a [computed field's](</docs/guides/graphql/computed-fields>) name.
[code] 
    1
    
    create table "Account"(
    
    2
    
        id serial primary key,
    
    3
    
        "firstName" varchar(255) not null,
    
    4
    
        "lastName" varchar(255) not null
    
    5
    
    );
    
    6
    
    7
    
    -- Extend with function
    
    8
    
    create function public."_fullName"(rec public."Account")
    
    9
    
        returns text
    
    10
    
        immutable
    
    11
    
        strict
    
    12
    
        language sql
    
    13
    
    as $$
    
    14
    
        select format('%s %s', rec."firstName", rec."lastName")
    
    15
    
    $$;
    
    16
    
    17
    
    comment on function public._full_name is
    
    18
    
    e'@graphql({"name": "displayName"})';
[/code]

results in:
[code] 
    1
    
    type Account {
    
    2
    
      nodeId: ID!
    
    3
    
      id: Int!
    
    4
    
      firstName: String!
    
    5
    
      lastName: String!
    
    6
    
      displayName: String # previously "fullName"
    
    7
    
    }
[/code]

#### Relationship's Field#

Use the `"local_name"` and `"foreign_name"` JSON keys to override a relationship's inbound and outbound field names.
[code] 
    1
    
    create table "Account"(
    
    2
    
        id serial primary key
    
    3
    
    );
    
    4
    
    5
    
    create table "Post"(
    
    6
    
        id serial primary key,
    
    7
    
        "accountId" integer not null references "Account"(id),
    
    8
    
        title text not null,
    
    9
    
        body text
    
    10
    
    );
    
    11
    
    12
    
    comment on constraint post_account_id_fkey
    
    13
    
      on "Post"
    
    14
    
      is E'@graphql({"foreign_name": "author", "local_name": "posts"})';
[/code]

results in:
[code] 
    1
    
    type Post {
    
    2
    
      nodeId: ID!
    
    3
    
      id: Int!
    
    4
    
      accountId: Int!
    
    5
    
      title: String!
    
    6
    
      body: String!
    
    7
    
      author: Account # was "account"
    
    8
    
    }
    
    9
    
    10
    
    type Account {
    
    11
    
      id: Int!
    
    12
    
      posts( # was "postCollection"
    
    13
    
        after: Cursor
    
    14
    
        before: Cursor
    
    15
    
        filter: PostFilter
    
    16
    
        first: Int
    
    17
    
        last: Int
    
    18
    
        orderBy: [PostOrderBy!]
    
    19
    
      ): PostConnection
    
    20
    
    }
[/code]

### Description#

Tables, Columns, and Functions accept a `description` directive to populate user defined descriptions in the GraphQL schema.
[code] 
    1
    
    create table "Account"(
    
    2
    
        id serial primary key
    
    3
    
    );
    
    4
    
    5
    
    comment on table public.account
    
    6
    
    is e'@graphql({"description": "A User Account"})';
    
    7
    
    8
    
    comment on column public.account.id
    
    9
    
    is e'@graphql({"description": "The primary key identifier"})';
[/code]
[code] 
    1
    
    """
    
    2
    
    A User Account
    
    3
    
    """
    
    4
    
    type Account implements Node {
    
    5
    
      """
    
    6
    
      The primary key identifier
    
    7
    
      """
    
    8
    
      id: Int!
    
    9
    
    }
[/code]

#### Enum Variant#

If a variant of a Postgres enum does not conform to GraphQL naming conventions, introspection returns an error:

For example:
[code] 
    1
    
    create type "Algorithm" as enum ('aead-ietf');
[/code]

causes the error:
[code] 
    1
    
    {
    
    2
    
      "errors": [
    
    3
    
        {
    
    4
    
          "message": "Names must only contain [_a-zA-Z0-9] but \"aead-ietf\" does not."
    
    5
    
        }
    
    6
    
      ]
    
    7
    
    }
[/code]

To resolve this problem, rename the invalid SQL enum variant to a GraphQL compatible name:
[code] 
    1
    
    alter type "Algorithm" rename value 'aead-ietf' to 'AEAD_IETF';
[/code]

or, add a comment directive to remap the enum variant in the GraphQL API
[code] 
    1
    
    comment on type "Algorithm" is '@graphql({"mappings": {"aead-ietf": "AEAD_IETF"}})';
[/code]

Which both result in the GraphQL enum:
[code] 
    1
    
    enum Algorithm {
    
    2
    
      AEAD_IETF
    
    3
    
    }
[/code]