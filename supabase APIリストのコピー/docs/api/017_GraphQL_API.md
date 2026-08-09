---
タイトル: GraphQL API
URL: https://supabase.com/docs/guides/graphql/api
カテゴリ: api
更新日: 2026-08-02
タグ: api, graphql
---

# GraphQL API

**URL:** https://supabase.com/docs/guides/graphql/api
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, graphql

## 目次

- [Primary Keys (Required)#](#primary-keys-required)
- [QueryType#](#querytype)
  - [Node#](#node)
  - [Collections#](#collections)
  - [Primary Key Queries#](#primary-key-queries)
- [MutationType#](#mutationtype)
  - [Insert#](#insert)
  - [Update#](#update)
  - [Delete#](#delete)
- [Concepts#](#concepts)
  - [nodeId#](#nodeid)
  - [Relationships#](#relationships)
- [Custom Scalars#](#custom-scalars)
  - [JSON#](#json)
  - [BigInt#](#bigint)
  - [BigFloat#](#bigfloat)
  - [Opaque#](#opaque)

## 概要

Understanding the core concepts of the GraphQL API.

---

In our API, each SQL table is reflected as a set of GraphQL types. At a high level, tables become types and columns/foreign keys become fields on those types.

By default, PostgreSQL table and column names are not inflected when reflecting GraphQL names. For example, an `account_holder` table has GraphQL type name `account_holder`. In cases where SQL entities are named using `snake_case`, [enable inflection](</docs/guides/graphql/configuration#inflection>) to match GraphQL/Javascript conventions e.g. `account_holder` -> `AccountHolder`.

Individual table, column, and relationship names may also be [manually overridden](</docs/guides/graphql/configuration#tables-type>).

## Primary Keys (Required)#

Every table must have a primary key for it to be exposed in the GraphQL schema. For example, the following `Blog` table will be available in the GraphQL schema as `blogCollection` since it has a primary key named `id`:
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name varchar(255) not null,
    
    4
    
    );
[/code]

But the following table will not be exposed because it doesn't have a primary key:
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id int,
    
    3
    
      name varchar(255) not null,
    
    4
    
    );
[/code]

## QueryType#

The `Query` type is the entrypoint for all read access into the graph.

### Node#

The `node` interface allows for retrieving records that are uniquely identifiable by a globally unique `nodeId: ID!` field. For more information about nodeId, see nodeId.

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name varchar(255) not null,
    
    4
    
      description varchar(255),
    
    5
    
      "createdAt" timestamp not null,
    
    6
    
      "updatedAt" timestamp not null
    
    7
    
    );
[/code]

**GraphQL Types**

QueryType
[code]
    1
    
    """The root type for querying data"""
    
    2
    
    type Query {
    
    3
    
    4
    
      """Retrieve a record by its `ID`"""
    
    5
    
      node(nodeId: ID!): Node
    
    6
    
    7
    
    }
[/code]

To query the `node` interface effectively, use [inline fragments](<https://graphql.org/learn/queries/#inline-fragments>) to specify which fields to return for each type.

**Example**

QueryResponse
[code]
    1
    
    {
    
    2
    
      node(
    
    3
    
        nodeId: "WyJwdWJsaWMiLCAiYmxvZyIsIDFd"
    
    4
    
      ) {
    
    5
    
        nodeId
    
    6
    
        # Inline fragment for `Blog` type
    
    7
    
        ... on Blog {
    
    8
    
          name
    
    9
    
          description
    
    10
    
        }
    
    11
    
      }
    
    12
    
    }
[/code]

### Collections#

Each table has top level entry in the `Query` type for selecting records from that table. Collections return a connection type and can be paginated, filtered, and sorted using the available arguments.

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name varchar(255) not null,
    
    4
    
      description varchar(255),
    
    5
    
      "createdAt" timestamp not null,
    
    6
    
      "updatedAt" timestamp not null
    
    7
    
    );
[/code]

**GraphQL Types**

QueryType
[code]
    1
    
    """The root type for querying data"""
    
    2
    
    type Query {
    
    3
    
    4
    
      """A pagable collection of type `Blog`"""
    
    5
    
      blogCollection(
    
    6
    
    7
    
        """Query the first `n` records in the collection"""
    
    8
    
        first: Int
    
    9
    
    10
    
        """Query the last `n` records in the collection"""
    
    11
    
        last: Int
    
    12
    
    13
    
        """Query values in the collection before the provided cursor"""
    
    14
    
        before: Cursor
    
    15
    
    16
    
        """Query values in the collection after the provided cursor"""
    
    17
    
        after: Cursor
    
    18
    
    19
    
        """
    
    20
    
        Skip n values from the after cursor. Alternative to cursor pagination. Backward pagination not supported.
    
    21
    
        """
    
    22
    
        offset: Int
    
    23
    
    24
    
        """Filters to apply to the results set when querying from the collection"""
    
    25
    
        filter: BlogFilter
    
    26
    
    27
    
        """Sort order to apply to the collection"""
    
    28
    
        orderBy: [BlogOrderBy!]
    
    29
    
      ): BlogConnection!
    
    30
    
    }
[/code]

Connection types are the primary interface to returning records from a collection.

Connections wrap a result set with some additional metadata.

BlogConnectionBlogEdgePageInfoBlogBlogOrderByBlogFilter
[code]
    1
    
    type BlogConnection {
    
    2
    
    3
    
      # Count of all records matching the *filter* criteria
    
    4
    
      totalCount: Int!
    
    5
    
    6
    
      # Pagination metadata
    
    7
    
      pageInfo: PageInfo!
    
    8
    
    9
    
      # Result set
    
    10
    
      edges: [BlogEdge!]!
    
    11
    
    12
    
      # Aggregate functions
    
    13
    
      aggregate: BlogAggregate
    
    14
    
    15
    
    }
[/code]

The `totalCount` field is disabled by default because it can be expensive on large tables. To enable it use a [comment directive](</docs/guides/graphql/configuration#totalcount>)

#### Aggregates#

Aggregate functions are available on the collection's `aggregate` field when enabled via [comment directive](</docs/guides/graphql/configuration#aggregate>). These allow you to perform calculations on the collection of records that match your filter criteria.

The supported aggregate operations are:

  * **count** : Always available, returns the number of records matching the query
  * **sum** : Available for numeric fields, returns the sum of values
  * **avg** : Available for numeric fields, returns the average (mean) of values
  * **min** : Available for numeric, string, boolean, and date/time fields, returns the minimum value
  * **max** : Available for numeric, string, boolean, and date/time fields, returns the maximum value


**Example**

QueryResponseBlogAggregate
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: { rating: { gt: 3 } }
    
    4
    
      ) {
    
    5
    
        aggregate {
    
    6
    
          count
    
    7
    
          sum {
    
    8
    
            rating
    
    9
    
            visits
    
    10
    
          }
    
    11
    
          avg {
    
    12
    
            rating
    
    13
    
          }
    
    14
    
          min {
    
    15
    
            createdAt
    
    16
    
            title
    
    17
    
          }
    
    18
    
          max {
    
    19
    
            rating
    
    20
    
            updatedAt
    
    21
    
          }
    
    22
    
        }
    
    23
    
      }
    
    24
    
    }
[/code]

**GraphQL Types**

BlogSumAggregateResultBlogAvgAggregateResultBlogMinAggregateResultBlogMaxAggregateResult
[code]
    1
    
    """Result of summation aggregation for `Blog`"""
    
    2
    
    type BlogSumAggregateResult {
    
    3
    
      """Sum of rating values"""
    
    4
    
      rating: BigFloat
    
    5
    
    6
    
      """Sum of visits values"""
    
    7
    
      visits: BigInt
    
    8
    
    9
    
      # Other numeric fields...
    
    10
    
    }
[/code]

  * The return type for `sum` depends on the input type: integer fields return `BigInt`, while other numeric fields return `BigFloat`.
  * The return type for `avg` is always `BigFloat`.
  * The return types for `min` and `max` match the original field types.


The `aggregate` field is disabled by default because it can be expensive on large tables. To enable it use a [comment directive](</docs/guides/graphql/configuration#Aggregate>)

#### Pagination#

##### Keyset Pagination

Paginating forwards and backwards through collections is handled using the `first`, `last`, `before`, and `after` parameters, following the [relay spec](<https://relay.dev/graphql/connections.htm#>).

QueryType
[code]
    1
    
    type Query {
    
    2
    
    3
    
      blogCollection(
    
    4
    
    5
    
        """Query the first `n` records in the collection"""
    
    6
    
        first: Int
    
    7
    
    8
    
        """Query the last `n` records in the collection"""
    
    9
    
        last: Int
    
    10
    
    11
    
        """Query values in the collection before the provided cursor"""
    
    12
    
        before: Cursor
    
    13
    
    14
    
        """Query values in the collection after the provided cursor"""
    
    15
    
        after: Cursor
    
    16
    
    17
    
        ...truncated...
    
    18
    
    19
    
      ): BlogConnection!
    
    20
    
    }
[/code]

Metadata relating to the current page of a result set is available on the `pageInfo` field of the connection type returned from a collection.

PageInfoBlogConnection
[code]
    1
    
    type PageInfo {
    
    2
    
    3
    
      # unique identifier of the first record within the query
    
    4
    
      startCursor: String
    
    5
    
    6
    
      # unique identifier of the last record within the query
    
    7
    
      endCursor: String
    
    8
    
    9
    
      # is another page of content available
    
    10
    
      hasNextPage: Boolean!
    
    11
    
    12
    
      # is another page of content available
    
    13
    
      hasPreviousPage: Boolean!
    
    14
    
    }
[/code]

To paginate forward in the collection, use the `first` and `after` arguments. To retrieve the first page, the `after` argument should be null or absent.

**Example**

QueryPage 1
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        first: 2,
    
    4
    
        after: null
    
    5
    
      ) {
    
    6
    
        pageInfo {
    
    7
    
          startCursor
    
    8
    
          endCursor
    
    9
    
          hasPreviousPage
    
    10
    
          hasNextPage
    
    11
    
        }
    
    12
    
        edges {
    
    13
    
          cursor
    
    14
    
          node {
    
    15
    
            id
    
    16
    
          }
    
    17
    
        }
    
    18
    
      }
    
    19
    
    }
[/code]

To retrieve the next page, provide the cursor value from `data.blogCollection.pageInfo.endCursor` to the `after` argument of another query.

QueryPage 2
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        first: 2,
    
    4
    
        after: "WzJd"
    
    5
    
      ) {
    
    6
    
      ...truncated...
    
    7
    
    }
[/code]

once the collection has been fully enumerated, `data.blogConnection.pageInfo.hasNextPage` returns false.

To paginate backwards through a collection, repeat the process substituting `first` -> `last`, `after` -> `before`, `hasNextPage` -> `hasPreviousPage`

##### Offset Pagination

In addition to keyset pagination, collections may also be paged using `first` and `offset`, which operates like SQL's `limit` and `offset` to skip `offset` number of records in the results.

`offset` based pagination becomes inefficient the `offset` value increases. For this reason, prefer cursor based pagination where possible.

QueryPage 2
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        first: 2,
    
    4
    
        offset: 2
    
    5
    
      ) {
    
    6
    
      ...truncated...
    
    7
    
    }
[/code]

#### Filtering#

To filter the result set, use the `filter` argument.

QueryType
[code]
    1
    
    type Query {
    
    2
    
    3
    
      blogCollection(
    
    4
    
    5
    
        """Filters to apply to the results set when querying from the collection"""
    
    6
    
        filter: BlogFilter
    
    7
    
    8
    
        ...truncated...
    
    9
    
    10
    
      ): BlogConnection!
    
    11
    
    }
[/code]

Where the `<Table>Filter` type enumerates filterable fields and their associated `<Type>Filter`.

BlogFilterIntFilterStringFilterStringListFilterFilterIs
[code]
    1
    
    input BlogFilter {
    
    2
    
      nodeId: IDFilter
    
    3
    
      id: IntFilter
    
    4
    
      name: StringFilter
    
    5
    
      description: StringFilter
    
    6
    
      tags: StringListFilter
    
    7
    
      createdAt: DatetimeFilter
    
    8
    
      updatedAt: DatetimeFilter
    
    9
    
      and: [BlogFilter!]
    
    10
    
      or: [BlogFilter!]
    
    11
    
      not: BlogFilter
    
    12
    
    }
[/code]

The following list shows the operators that may be available on `<Type>Filter` types.

Operator| Description  
---|---  
eq| Equal To  
neq| Not Equal To  
gt| Greater Than  
gte| Greater Than Or Equal To  
in| Contained by Value List  
lt| Less Than  
lte| Less Than Or Equal To  
is| Null or Not Null  
startsWith| Starts with prefix  
like| Pattern Match. '%' as wildcard  
ilike| Pattern Match. '%' as wildcard. Case Insensitive  
regex| POSIX Regular Expression Match  
iregex| POSIX Regular Expression Match. Case Insensitive  
contains| Contains. Applies to array columns only.  
containedBy| Contained in. Applies to array columns only.  
overlaps| Overlap (have points in common). Applies to array columns only.  
  
Not all operators are available on every `<Type>Filter` type. For example, `UUIDFilter` only supports `eq` and `neq` because `UUID`s are not ordered.

**Example: simple**

QueryResult
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {id: {lt: 3}},
    
    4
    
      ) {
    
    5
    
        edges {
    
    6
    
          cursor
    
    7
    
          node {
    
    8
    
            id
    
    9
    
          }
    
    10
    
        }
    
    11
    
      }
    
    12
    
    }
[/code]

**Example: array column**

The `contains` filter is used to return results where all the elements in the input array appear in the array column.

""

`contains`

Filter Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {tags: {contains: ["tech", "innovation"]}},
    
    4
    
      ) {
    
    5
    
        edges {
    
    6
    
          cursor
    
    7
    
          node {
    
    8
    
            id
    
    9
    
            name
    
    10
    
            tags
    
    11
    
            createdAt
    
    12
    
          }
    
    13
    
        }
    
    14
    
      }
    
    15
    
    }
[/code]

`contains`

Filter Result"
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
    
                "name": "A: Blog 1",
    
    9
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    10
    
                "tags": ["tech", "innovation"]
    
    11
    
              },
    
    12
    
              "cursor": "WzFd"
    
    13
    
            },
    
    14
    
            {
    
    15
    
              "node": {
    
    16
    
                "id": 2,
    
    17
    
                "name": "A: Blog 2",
    
    18
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    19
    
                "tags": ["tech", "innovation", "entrepreneurship"]
    
    20
    
              },
    
    21
    
              "cursor": "WzJd"
    
    22
    
            }
    
    23
    
          ]
    
    24
    
        }
    
    25
    
      }
    
    26
    
    }
[/code]

The `contains` filter can also accept a single scalar.

""

`contains`

Filter with Scalar Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {tags: {contains: "tech"}},
    
    4
    
      ) {
    
    5
    
        edges {
    
    6
    
          cursor
    
    7
    
          node {
    
    8
    
            id
    
    9
    
            name
    
    10
    
            tags
    
    11
    
            createdAt
    
    12
    
          }
    
    13
    
        }
    
    14
    
      }
    
    15
    
    }
[/code]

`contains`

Filter with Scalar Result"
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
    
                "name": "A: Blog 1",
    
    9
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    10
    
                "tags": ["tech", "innovation"]
    
    11
    
              },
    
    12
    
              "cursor": "WzFd"
    
    13
    
            },
    
    14
    
            {
    
    15
    
              "node": {
    
    16
    
                "id": 2,
    
    17
    
                "name": "A: Blog 2",
    
    18
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    19
    
                "tags": ["tech", "innovation", "entrepreneurship"]
    
    20
    
              },
    
    21
    
              "cursor": "WzJd"
    
    22
    
            }
    
    23
    
          ]
    
    24
    
        }
    
    25
    
      }
    
    26
    
    }
[/code]

The `containedBy` filter is used to return results where every element of the array column appears in the input array.

""

`containedBy`

Filter Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {tags: {containedBy: ["entrepreneurship", "innovation", "tech"]}},
    
    4
    
      ) {
    
    5
    
        edges {
    
    6
    
          cursor
    
    7
    
          node {
    
    8
    
            id
    
    9
    
            name
    
    10
    
            tags
    
    11
    
            createdAt
    
    12
    
          }
    
    13
    
        }
    
    14
    
      }
    
    15
    
    }
[/code]

`containedBy`

Filter Result"
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
    
                "name": "A: Blog 1",
    
    9
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    10
    
                "tags": ["tech", "innovation"]
    
    11
    
              },
    
    12
    
              "cursor": "WzFd"
    
    13
    
            },
    
    14
    
            {
    
    15
    
              "node": {
    
    16
    
                "id": 3,
    
    17
    
                "name": "A: Blog 3",
    
    18
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    19
    
                "tags": ["innovation", "entrepreneurship"]
    
    20
    
              },
    
    21
    
              "cursor": "WzNd"
    
    22
    
            }
    
    23
    
          ]
    
    24
    
        }
    
    25
    
      }
    
    26
    
    }
[/code]

The `containedBy` filter can also accept a single scalar. In this case, only results where the only element in the array column is the input scalar are returned.

""

`containedBy`

Filter with Scalar Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {tags: {containedBy: "travel"}},
    
    4
    
      ) {
    
    5
    
        edges {
    
    6
    
          cursor
    
    7
    
          node {
    
    8
    
            id
    
    9
    
            name
    
    10
    
            tags
    
    11
    
            createdAt
    
    12
    
          }
    
    13
    
        }
    
    14
    
      }
    
    15
    
    }
[/code]

`containedBy`

Filter with Scalar Result"
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
    
                "id": 4,
    
    8
    
                "name": "A: Blog 4",
    
    9
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    10
    
                "tags": ["travel"]
    
    11
    
              },
    
    12
    
              "cursor": "WzPd"
    
    13
    
            }
    
    14
    
          ]
    
    15
    
        }
    
    16
    
      }
    
    17
    
    }
[/code]

The `overlaps` filter is used to return results where the array column and the input array have at least one element in common.

""

`overlaps`

Filter Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {tags: {overlaps: ["tech", "travel"]}},
    
    4
    
      ) {
    
    5
    
        edges {
    
    6
    
          cursor
    
    7
    
          node {
    
    8
    
            id
    
    9
    
            name
    
    10
    
            tags
    
    11
    
            createdAt
    
    12
    
          }
    
    13
    
        }
    
    14
    
      }
    
    15
    
    }
[/code]

`overlaps`

Filter Result"
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
    
                "name": "A: Blog 1",
    
    9
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    10
    
                "tags": ["tech", "innovation"]
    
    11
    
              },
    
    12
    
              "cursor": "WzFd"
    
    13
    
            },
    
    14
    
            {
    
    15
    
              "node": {
    
    16
    
                "id": 2,
    
    17
    
                "name": "A: Blog 2",
    
    18
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    19
    
                "tags": ["tech", "innovation", "entrepreneurship"]
    
    20
    
              },
    
    21
    
              "cursor": "WzJd"
    
    22
    
            },
    
    23
    
            {
    
    24
    
              "node": {
    
    25
    
                "id": 4,
    
    26
    
                "name": "A: Blog 4",
    
    27
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    28
    
                "tags": ["travel"]
    
    29
    
              },
    
    30
    
              "cursor": "WzPd"
    
    31
    
            }
    
    32
    
          ]
    
    33
    
        }
    
    34
    
      }
    
    35
    
    }
[/code]

**Example: and/or**

Multiple filters can be combined with `and`, `or` and `not` operators. The `and` and `or` operators accept a list of `<Type>Filter`.

""""

`and`

Filter Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {
    
    4
    
          and: [
    
    5
    
            {id: {eq: 1}}
    
    6
    
            {name: {eq: "A: Blog 1"}}
    
    7
    
          ]
    
    8
    
        }
    
    9
    
      ) {
    
    10
    
        edges {
    
    11
    
          cursor
    
    12
    
          node {
    
    13
    
            id
    
    14
    
            name
    
    15
    
            description
    
    16
    
            createdAt
    
    17
    
          }
    
    18
    
        }
    
    19
    
      }
    
    20
    
    }
[/code]

`and`

Filter Result"
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
    
                "name": "A: Blog 1",
    
    9
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    10
    
                "description": "a desc1"
    
    11
    
              },
    
    12
    
              "cursor": "WzFd"
    
    13
    
            }
    
    14
    
          ]
    
    15
    
        }
    
    16
    
      }
    
    17
    
    }
[/code]

`or`

Filter Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {
    
    4
    
          or: [
    
    5
    
            {id: {eq: 1}}
    
    6
    
            {name: {eq: "A: Blog 2"}}
    
    7
    
          ]
    
    8
    
        }
    
    9
    
      ) {
    
    10
    
        edges {
    
    11
    
          cursor
    
    12
    
          node {
    
    13
    
            id
    
    14
    
            name
    
    15
    
            description
    
    16
    
            createdAt
    
    17
    
          }
    
    18
    
        }
    
    19
    
      }
    
    20
    
    }
[/code]

`or`

Filter Result"
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
    
                "name": "A: Blog 1",
    
    9
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    10
    
                "description": "a desc1"
    
    11
    
              },
    
    12
    
              "cursor": "WzFd"
    
    13
    
            },
    
    14
    
            {
    
    15
    
              "node": {
    
    16
    
                "id": 2,
    
    17
    
                "name": "A: Blog 2",
    
    18
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    19
    
                "description": "a desc2"
    
    20
    
              },
    
    21
    
              "cursor": "WzJd"
    
    22
    
            }
    
    23
    
          ]
    
    24
    
        }
    
    25
    
      }
    
    26
    
    }
[/code]

**Example: not**

`not` accepts a single `<Type>Filter`.

""

`not`

Filter Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {
    
    4
    
          not: {id: {eq: 1}}
    
    5
    
        }
    
    6
    
      ) {
    
    7
    
        edges {
    
    8
    
          cursor
    
    9
    
          node {
    
    10
    
            id
    
    11
    
            name
    
    12
    
            description
    
    13
    
            createdAt
    
    14
    
          }
    
    15
    
        }
    
    16
    
      }
    
    17
    
    }
[/code]

`not`

Filter Result"
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
    
                "id": 2,
    
    8
    
                "name": "A: Blog 2",
    
    9
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    10
    
                "description": "a desc2"
    
    11
    
              },
    
    12
    
              "cursor": "WzJd"
    
    13
    
            },
    
    14
    
            {
    
    15
    
              "node": {
    
    16
    
                "id": 3,
    
    17
    
                "name": "A: Blog 3",
    
    18
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    19
    
                "description": "a desc3"
    
    20
    
              },
    
    21
    
              "cursor": "WzNd"
    
    22
    
            },
    
    23
    
            {
    
    24
    
              "node": {
    
    25
    
                "id": 4,
    
    26
    
                "name": "B: Blog 3",
    
    27
    
                "createdAt": "2023-07-24T04:01:09.882781",
    
    28
    
                "description": "b desc1"
    
    29
    
              },
    
    30
    
              "cursor": "WzRd"
    
    31
    
            }
    
    32
    
          ]
    
    33
    
        }
    
    34
    
      }
    
    35
    
    }
[/code]

**Example: nested composition**

The `and`, `or` and `not` operators can be arbitrarily nested inside each other.

QueryResult
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {
    
    4
    
          or: [
    
    5
    
            { id: { eq: 1 } }
    
    6
    
            { id: { eq: 2 } }
    
    7
    
            { and: [{ id: { eq: 3 }, not: { name: { eq: "A: Blog 2" } } }] }
    
    8
    
          ]
    
    9
    
        }
    
    10
    
      ) {
    
    11
    
        edges {
    
    12
    
          cursor
    
    13
    
          node {
    
    14
    
            id
    
    15
    
            name
    
    16
    
            description
    
    17
    
            createdAt
    
    18
    
          }
    
    19
    
        }
    
    20
    
      }
    
    21
    
    }
[/code]

**Example: empty**

Empty filters are ignored, i.e. they behave as if the operator was not specified at all.

QueryResult
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {
    
    4
    
          and: [], or: [], not: {}
    
    5
    
        }
    
    6
    
      ) {
    
    7
    
        edges {
    
    8
    
          cursor
    
    9
    
          node {
    
    10
    
            id
    
    11
    
            name
    
    12
    
            description
    
    13
    
            createdAt
    
    14
    
          }
    
    15
    
        }
    
    16
    
      }
    
    17
    
    }
[/code]

**Example: implicit and**

Multiple column filters at the same level will be implicitly combined with boolean `and`. In the following example the `id: {eq: 1}` and `name: {eq: "A: Blog 1"}` will be `and`ed.

QueryResult
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {
    
    4
    
          # Equivalent to not: { and: [{id: {eq: 1}}, {name: {eq: "A: Blog 1"}}]}
    
    5
    
          not: {
    
    6
    
            id: {eq: 1}
    
    7
    
            name: {eq: "A: Blog 1"}
    
    8
    
          }
    
    9
    
        }
    
    10
    
      ) {
    
    11
    
        edges {
    
    12
    
          cursor
    
    13
    
          node {
    
    14
    
            id
    
    15
    
            name
    
    16
    
            description
    
    17
    
            createdAt
    
    18
    
          }
    
    19
    
        }
    
    20
    
      }
    
    21
    
    }
[/code]

This means that an `and` filter can be often be simplified. In the following example all queries are equivalent and produce the same result.

"Original "Simplified Even More Simplified QueryResult

`and`

Query"
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {
    
    4
    
          and: [
    
    5
    
            {id: {gt: 0}}
    
    6
    
            {id: {lt: 2}}
    
    7
    
            {name: {eq: "A: Blog 1"}}
    
    8
    
          ]
    
    9
    
        }
    
    10
    
      ) {
    
    11
    
        edges {
    
    12
    
          cursor
    
    13
    
          node {
    
    14
    
            id
    
    15
    
            name
    
    16
    
            description
    
    17
    
            createdAt
    
    18
    
          }
    
    19
    
        }
    
    20
    
      }
    
    21
    
    }
[/code]

Be aware that the above simplification only works for the `and` operator. If you try it with an `or` operator it will behave like an `and`.

QueryResult
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        filter: {
    
    4
    
          # This is really an `and` in `or`'s clothing
    
    5
    
          or: {
    
    6
    
            id: {eq: 1}
    
    7
    
            name: {eq: "A: Blog 2"}
    
    8
    
          }
    
    9
    
        }
    
    10
    
      ) {
    
    11
    
        edges {
    
    12
    
          cursor
    
    13
    
          node {
    
    14
    
            id
    
    15
    
            name
    
    16
    
            description
    
    17
    
            createdAt
    
    18
    
          }
    
    19
    
        }
    
    20
    
      }
    
    21
    
    }
[/code]

This is because according to the rules of GraphQL list input coercion, if a value passed to an input of list type is not a list, then it is coerced to a list of a single item. So in the above example `or: {id: {eq: 1}, name: {eq: "A: Blog 2}}` will be coerced into `or: [{id: {eq: 1}, name: {eq: "A: Blog 2}}]` which is equivalent to `or: [and: [{id: {eq: 1}}, {name: {eq: "A: Blog 2}}}]` due to implicit `and`ing.

Avoid naming your columns `and`, `or` or `not`. If you do, the corresponding filter operator will not be available for use.

The `and`, `or` and `not` operators also work with update and delete mutations.

#### Ordering#

The default order of results is defined by the underlying table's primary key column in ascending order. That default can be overridden by passing an array of `<Table>OrderBy` to the collection's `orderBy` argument.

QueryTypeBlogOrderByOrderByDirection
[code]
    1
    
    type Query {
    
    2
    
    3
    
      blogCollection(
    
    4
    
    5
    
        """Sort order to apply to the collection"""
    
    6
    
        orderBy: [BlogOrderBy!]
    
    7
    
    8
    
        ...truncated...
    
    9
    
    10
    
      ): BlogConnection!
    
    11
    
    }
[/code]

**Example**

QueryResult
[code]
    1
    
    {
    
    2
    
      blogCollection(
    
    3
    
        orderBy: [{id: DescNullsLast}]
    
    4
    
      ) {
    
    5
    
        edges {
    
    6
    
          node {
    
    7
    
            id
    
    8
    
          }
    
    9
    
        }
    
    10
    
      }
    
    11
    
    }
[/code]

Note, only one key value pair may be provided to each element of the input array. For example, `[{name: AscNullsLast}, {id: AscNullFirst}]` is valid. Passing multiple key value pairs in a single element of the input array e.g. `[{name: AscNullsLast, id: AscNullFirst}]`, is invalid.

### Primary Key Queries#

Each table has a top level field in the `Query` type for selecting a single record by primary key from that table. The field is named `<table>ByPk`

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name varchar(255) not null,
    
    4
    
      description varchar(255),
    
    5
    
      "createdAt" timestamp not null,
    
    6
    
      "updatedAt" timestamp not null
    
    7
    
    );
[/code]

**GraphQL Types**

QueryType
[code]
    1
    
    """The root type for querying data"""
    
    2
    
    type Query {
    
    3
    
    4
    
      """Retrieve a blog by its id"""
    
    5
    
      blogByPk(id: Int!): Blog
    
    6
    
    7
    
    }
[/code]

To query the table by primary key, pass the value of the primary key field to the field:

**Example**

QueryResponse
[code]
    1
    
    {
    
    2
    
      blogByPk(
    
    3
    
        id: 1
    
    4
    
      ) {
    
    5
    
        id
    
    6
    
        name
    
    7
    
        description
    
    8
    
      }
    
    9
    
    }
[/code]

If a record with the give id doesn't exist, the field will return null:

**Example**

QueryResponse
[code]
    1
    
    {
    
    2
    
      blogByPk(
    
    3
    
        id: 999
    
    4
    
      ) {
    
    5
    
        id
    
    6
    
        name
    
    7
    
        description
    
    8
    
      }
    
    9
    
    }
[/code]

If the key is a composite primary key, all the columns of the primary key should be sent in the query:

**SQL Setup**
[code] 
    1
    
    create table item(
    
    2
    
        item_id int,
    
    3
    
        product_id int,
    
    4
    
        quantity int,
    
    5
    
        price numeric(10,2),
    
    6
    
        primary key(item_id, product_id)
    
    7
    
    );
[/code]

**GraphQL Types**

QueryTypeQuery
[code]
    1
    
    """The root type for querying data"""
    
    2
    
    type Query {
    
    3
    
    4
    
      """Retrieve an item by its item and product ids"""
    
    5
    
      itemByPk(itemId: Int!, productId: Int!): Item
    
    6
    
    7
    
    }
[/code]

**Example**

Response
[code]
    1
    
    {
    
    2
    
      "data": {
    
    3
    
        "itemByPk": {
    
    4
    
          "itemId": 1,
    
    5
    
          "productId": 2,
    
    6
    
          "quantity": 1,
    
    7
    
          "price": "24.99"
    
    8
    
        }
    
    9
    
      }
    
    10
    
    }
[/code]

Otherwise an error will be returned:

**Example**

QueryResponse
[code]
    1
    
    {
    
    2
    
      itemByPk(
    
    3
    
        itemId: 1
    
    4
    
      ) {
    
    5
    
        itemId
    
    6
    
        productId
    
    7
    
        quantity
    
    8
    
        price
    
    9
    
      }
    
    10
    
    }
[/code]

## MutationType#

The `Mutation` type is the entrypoint for mutations/edits.

Each table has top level entry in the `Mutation` type for inserting `insertInto<Table>Collection`, updating `update<Table>Collection` and deleting `deleteFrom<Table>Collection`.

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name varchar(255) not null,
    
    4
    
      description varchar(255),
    
    5
    
      "createdAt" timestamp not null default now(),
    
    6
    
      "updatedAt" timestamp
    
    7
    
    );
[/code]

MutationType
[code]
    1
    
    """The root type for creating and mutating data"""
    
    2
    
    type Mutation {
    
    3
    
    4
    
      """Adds one or more `BlogInsertResponse` records to the collection"""
    
    5
    
      insertIntoBlogCollection(
    
    6
    
    7
    
        """Records to add to the Blog collection"""
    
    8
    
        objects: [BlogInsertInput!]!
    
    9
    
    10
    
      ): BlogInsertResponse
    
    11
    
    12
    
      """Updates zero or more records in the collection"""
    
    13
    
      updateBlogCollection(
    
    14
    
        """
    
    15
    
        Fields that are set will be updated for all records matching the `filter`
    
    16
    
        """
    
    17
    
        set: BlogUpdateInput!
    
    18
    
    19
    
        """Restricts the mutation's impact to records matching the critera"""
    
    20
    
        filter: BlogFilter
    
    21
    
    22
    
        """
    
    23
    
        The maximum number of records in the collection permitted to be affected
    
    24
    
        """
    
    25
    
        atMost: Int! = 1
    
    26
    
    27
    
      ): BlogUpdateResponse!
    
    28
    
    29
    
      """Deletes zero or more records from the collection"""
    
    30
    
      deleteFromBlogCollection(
    
    31
    
        """Restricts the mutation's impact to records matching the critera"""
    
    32
    
        filter: BlogFilter
    
    33
    
    34
    
        """
    
    35
    
        The maximum number of records in the collection permitted to be affected
    
    36
    
        """
    
    37
    
        atMost: Int! = 1
    
    38
    
    39
    
      ): BlogDeleteResponse!
    
    40
    
    41
    
    }
[/code]

### Insert#

To add records to a collection, use the `insertInto<Table>Collection` field on the `Mutation` type.

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name varchar(255) not null,
    
    4
    
      description varchar(255),
    
    5
    
      "createdAt" timestamp not null default now(),
    
    6
    
      "updatedAt" timestamp
    
    7
    
    );
[/code]

**GraphQL Types**

MutationTypeBlogInsertInputBlogInsertResponse
[code]
    1
    
    """The root type for creating and mutating data"""
    
    2
    
    type Mutation {
    
    3
    
    4
    
      """Adds one or more `BlogInsertResponse` records to the collection"""
    
    5
    
      insertIntoBlogCollection(
    
    6
    
    7
    
        """Records to add to the Blog collection"""
    
    8
    
        objects: [BlogInsertInput!]!
    
    9
    
    10
    
      ): BlogInsertResponse
    
    11
    
    12
    
    }
[/code]

Where elements in the `objects` array are inserted into the underlying table.

**Example**

QueryResult
[code]
    1
    
    mutation {
    
    2
    
      insertIntoBlogCollection(
    
    3
    
        objects: [
    
    4
    
          {name: "foo"},
    
    5
    
          {name: "bar"},
    
    6
    
        ]
    
    7
    
      ) {
    
    8
    
        affectedCount
    
    9
    
        records {
    
    10
    
          id
    
    11
    
          name
    
    12
    
        }
    
    13
    
      }
    
    14
    
    }
[/code]

### Update#

To update records in a collection, use the `update<Table>Collection` field on the `Mutation` type.

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name varchar(255) not null,
    
    4
    
      description varchar(255),
    
    5
    
      "createdAt" timestamp not null default now(),
    
    6
    
      "updatedAt" timestamp
    
    7
    
    );
[/code]

**GraphQL Types**

MutationTypeBlogUpdateInputBlogUpdateResponse
[code]
    1
    
    """The root type for creating and mutating data"""
    
    2
    
    type Mutation {
    
    3
    
    4
    
      """Updates zero or more records in the collection"""
    
    5
    
      updateBlogCollection(
    
    6
    
        """
    
    7
    
        Fields that are set will be updated for all records matching the `filter`
    
    8
    
        """
    
    9
    
        set: BlogUpdateInput!
    
    10
    
    11
    
        """Restricts the mutation's impact to records matching the critera"""
    
    12
    
        filter: BlogFilter
    
    13
    
    14
    
        """
    
    15
    
        The maximum number of records in the collection permitted to be affected
    
    16
    
        """
    
    17
    
        atMost: Int! = 1
    
    18
    
    19
    
      ): BlogUpdateResponse!
    
    20
    
    21
    
    }
[/code]

Where the `set` argument is a key value pair describing the values to update, `filter` controls which records should be updated, and `atMost` restricts the maximum number of records that may be impacted. If the number of records impacted by the mutation exceeds the `atMost` parameter the operation will return an error.

**Example**

QueryResult
[code]
    1
    
    mutation {
    
    2
    
      updateBlogCollection(
    
    3
    
        set: {name: "baz"}
    
    4
    
        filter: {id: {eq: 1}}
    
    5
    
      ) {
    
    6
    
        affectedCount
    
    7
    
        records {
    
    8
    
          id
    
    9
    
          name
    
    10
    
        }
    
    11
    
      }
    
    12
    
    }
[/code]

### Delete#

To remove records from a collection, use the `deleteFrom<Table>Collection` field on the `Mutation` type.

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
      id serial primary key,
    
    3
    
      name varchar(255) not null,
    
    4
    
      description varchar(255),
    
    5
    
      "createdAt" timestamp not null default now(),
    
    6
    
      "updatedAt" timestamp
    
    7
    
    );
[/code]

**GraphQL Types**

MutationTypeBlogFilterBlogDeleteResponse
[code]
    1
    
    """The root type for creating and mutating data"""
    
    2
    
    type Mutation {
    
    3
    
    4
    
      """Deletes zero or more records from the collection"""
    
    5
    
      deleteFromBlogCollection(
    
    6
    
        """Restricts the mutation's impact to records matching the critera"""
    
    7
    
        filter: BlogFilter
    
    8
    
    9
    
        """
    
    10
    
        The maximum number of records in the collection permitted to be affected
    
    11
    
        """
    
    12
    
        atMost: Int! = 1
    
    13
    
    14
    
      ): BlogDeleteResponse!
    
    15
    
    16
    
    }
[/code]

Where `filter` controls which records should be deleted and `atMost` restricts the maximum number of records that may be deleted. If the number of records impacted by the mutation exceeds the `atMost` parameter the operation will return an error.

**Example**

QueryResult
[code]
    1
    
    mutation {
    
    2
    
      deleteFromBlogCollection(
    
    3
    
        filter: {id: {eq: 1}}
    
    4
    
      ) {
    
    5
    
        affectedCount
    
    6
    
        records {
    
    7
    
          id
    
    8
    
          name
    
    9
    
        }
    
    10
    
      }
    
    11
    
    }
[/code]

## Concepts#

### nodeId#

The base GraphQL type for every table with a primary key is automatically assigned a `nodeId: ID!` field. That value, can be passed to the node entrypoint of the `Query` type to retrieve its other fields. `nodeId` may also be used as a caching key.

relay support

By default relay expects the `ID` field for types to have the name `id`. pg_graphql uses `nodeId` by default to avoid conflicting with user defined `id` columns. You can configure relay to work with pg_graphql's `nodeId` field with relay's `nodeInterfaceIdField` option. More info available [here](<https://github.com/facebook/relay/tree/main/packages/relay-compiler#supported-compiler-configuration-options>).

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
        id serial primary key,
    
    3
    
        name varchar(255) not null
    
    4
    
    );
[/code]

**GraphQL Types**

Blog
[code]
    1
    
    type Blog {
    
    2
    
      nodeId: ID! # this field
    
    3
    
      id: Int!
    
    4
    
      name: String!
    
    5
    
    }
[/code]

### Relationships#

Relationships between collections in the Graph are derived from foreign keys.

#### One-to-Many#

A foreign key on table A referencing table B defines a one-to-many relationship from table A to table B.

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
        id serial primary key,
    
    3
    
        name varchar(255) not null
    
    4
    
    );
    
    5
    
    6
    
    create table "BlogPost"(
    
    7
    
        id serial primary key,
    
    8
    
        "blogId" integer not null references "Blog"(id),
    
    9
    
        title varchar(255) not null,
    
    10
    
        body varchar(10000)
    
    11
    
    );
[/code]

**GraphQL Types**

Blog
[code]
    1
    
    type Blog {
    
    2
    
    3
    
      # globally unique identifier
    
    4
    
      nodeId: ID!
    
    5
    
    6
    
      id: Int!
    
    7
    
      name: String!
    
    8
    
      description: String
    
    9
    
    10
    
      blogPostCollection(
    
    11
    
        """Query the first `n` records in the collection"""
    
    12
    
        first: Int
    
    13
    
    14
    
        """Query the last `n` records in the collection"""
    
    15
    
        last: Int
    
    16
    
    17
    
        """Query values in the collection before the provided cursor"""
    
    18
    
        before: Cursor
    
    19
    
    20
    
        """Query values in the collection after the provided cursor"""
    
    21
    
        after: Cursor
    
    22
    
    23
    
        """
    
    24
    
        Skip n values from the after cursor. Alternative to cursor pagination. Backward pagination not supported.
    
    25
    
        """
    
    26
    
        offset: Int
    
    27
    
    28
    
        """Filters to apply to the results set when querying from the collection"""
    
    29
    
        filter: BlogPostFilter
    
    30
    
    31
    
        """Sort order to apply to the collection"""
    
    32
    
        orderBy: [BlogPostOrderBy!]
    
    33
    
      ): BlogPostConnection!
    
    34
    
    35
    
    }
[/code]

Where `blogPostCollection` exposes the full `Query` interface to `BlogPost`s.

**Example**

QueryResult
[code]
    1
    
    {
    
    2
    
      blogCollection {
    
    3
    
        edges {
    
    4
    
          node {
    
    5
    
            name
    
    6
    
            blogPostCollection {
    
    7
    
              edges {
    
    8
    
                node {
    
    9
    
                  id
    
    10
    
                  title
    
    11
    
                }
    
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
[/code]

#### Many-to-One#

A foreign key on table A referencing table B defines a many-to-one relationship from table B to table A.

**SQL Setup**
[code] 
    1
    
    create table "Blog"(
    
    2
    
        id serial primary key,
    
    3
    
        name varchar(255) not null
    
    4
    
    );
    
    5
    
    6
    
    create table "BlogPost"(
    
    7
    
        id serial primary key,
    
    8
    
        "blogId" integer not null references "Blog"(id),
    
    9
    
        title varchar(255) not null,
    
    10
    
        body varchar(10000)
    
    11
    
    );
[/code]

**GraphQL Types**

BlogPost
[code]
    1
    
    type BlogPost {
    
    2
    
      nodeId: ID!
    
    3
    
      id: Int!
    
    4
    
      blogId: Int!
    
    5
    
      title: String!
    
    6
    
      body: String
    
    7
    
    8
    
      blog: Blog
    
    9
    
    }
[/code]

Where `blog` exposes the `Blog` record associated with the `BlogPost`.

QueryResult
[code]
    1
    
    {
    
    2
    
      blogPostCollection {
    
    3
    
        edges {
    
    4
    
          node {
    
    5
    
            title
    
    6
    
            blog {
    
    7
    
              name
    
    8
    
            }
    
    9
    
          }
    
    10
    
        }
    
    11
    
      }
    
    12
    
    }
[/code]

#### One-to-One#

A one-to-one relationship is defined by a foreign key on table A referencing table B where the columns making up the foreign key on table A are unique.

**SQL Setup**
[code] 
    1
    
    create table "EmailAddress"(
    
    2
    
        id serial primary key,
    
    3
    
        address text unique not null
    
    4
    
    );
    
    5
    
    6
    
    create table "Employee"(
    
    7
    
        id serial primary key,
    
    8
    
        name text not null,
    
    9
    
        email_address_id int unique references "EmailAddress"(id)
    
    10
    
    );
[/code]

**GraphQL Types**

EmployeeEmailAddressQuery
[code]
    1
    
    type Employee {
    
    2
    
      nodeId: ID!
    
    3
    
      id: Int!
    
    4
    
      name: String!
    
    5
    
      emailAddressId: Int
    
    6
    
      emailAddress: EmailAddress
    
    7
    
    }
[/code]

**Example**

Result
[code]
    1
    
    {
    
    2
    
      "data": {
    
    3
    
        "employeeCollection": {
    
    4
    
          "edges": [
    
    5
    
            {
    
    6
    
              "node": {
    
    7
    
                "name": "Foo Barington",
    
    8
    
                "emailAddress": {
    
    9
    
                  "address": "foo@bar.com",
    
    10
    
                  "employee": {
    
    11
    
                    "name": "Foo Barington"
    
    12
    
                  }
    
    13
    
                }
    
    14
    
              }
    
    15
    
            }
    
    16
    
          ]
    
    17
    
        }
    
    18
    
      }
    
    19
    
    }
[/code]

## Custom Scalars#

Due to differences among the types supported by PostgreSQL, JSON, and GraphQL, `pg_graphql` adds several new Scalar types to handle PostgreSQL builtins that require special handling.

### JSON#

`pg_graphql` serializes `json` and `jsonb` data types as `String` under the custom scalar name `JSON`.
[code] 
    1
    
    scalar JSON
[/code]

**Example**

Given the setup

SQLGraphQL
[code]
    1
    
    create table "User"(
    
    2
    
        id bigserial primary key,
    
    3
    
        config jsonb
    
    4
    
    );
    
    5
    
    6
    
    insert into "User"(config)
    
    7
    
    values (jsonb_build_object('palette', 'dark-mode'));
[/code]

The query
[code] 
    1
    
    {
    
    2
    
      userCollection {
    
    3
    
        edges {
    
    4
    
          node {
    
    5
    
            config
    
    6
    
          }
    
    7
    
        }
    
    8
    
      }
    
    9
    
    }
[/code]

The returns the following data. Note that `config` is serialized as a string
[code] 
    1
    
    {
    
    2
    
      "data": {
    
    3
    
        "userCollection": {
    
    4
    
          "edges": [
    
    5
    
            {
    
    6
    
              "node": {
    
    7
    
                "config": "{\"palette\": \"dark-mode\"}"
    
    8
    
              }
    
    9
    
            }
    
    10
    
          ]
    
    11
    
        }
    
    12
    
      }
    
    13
    
    }
[/code]

Use serialized JSON strings when updating or inserting `JSON` fields via the GraphQL API.

JSON does not currently support filtering.

### BigInt#

PostgreSQL `bigint` and `bigserial` types are 64 bit integers. In contrast, JSON supports 32 bit integers.

Since PostgreSQL `bigint` values may be outside the min/max range allowed by JSON, they are represented in the GraphQL schema as `BigInt`s and values are serialized as strings.
[code] 
    1
    
    scalar BigInt
    
    2
    
    3
    
    input BigIntFilter {
    
    4
    
      eq: BigInt
    
    5
    
      gt: BigInt
    
    6
    
      gte: BigInt
    
    7
    
      in: [BigInt!]
    
    8
    
      lt: BigInt
    
    9
    
      lte: BigInt
    
    10
    
      neq: BigInt
    
    11
    
      is: FilterIs
    
    12
    
    }
[/code]

**Example**

Given the setup

SQLGraphQL
[code]
    1
    
    create table "Person"(
    
    2
    
        id bigserial primary key,
    
    3
    
        name text
    
    4
    
    );
    
    5
    
    6
    
    insert into "Person"(name)
    
    7
    
    values ('J. Bazworth');
[/code]

The query
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
    
          }
    
    8
    
        }
    
    9
    
      }
    
    10
    
    }
[/code]

The returns the following data. Note that `id` is serialized as a string
[code] 
    1
    
    {
    
    2
    
      "data": {
    
    3
    
        "personCollection": {
    
    4
    
          "edges": [
    
    5
    
            {
    
    6
    
              "node": {
    
    7
    
                "id": "1",
    
    8
    
                "name": "Foo Barington",
    
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

### BigFloat#

PostgreSQL's `numeric` type supports arbitrary precision floating point values. JSON's `float` is limited to 64-bit precision.

Since a PostgreSQL `numeric` may require more precision than can be handled by JSON, `numeric` types are represented in the GraphQL schema as `BigFloat` and values are serialized as strings.
[code] 
    1
    
    scalar BigFloat
    
    2
    
    3
    
    input BigFloatFilter {
    
    4
    
      eq: BigFloat
    
    5
    
      gt: BigFloat
    
    6
    
      gte: BigFloat
    
    7
    
      in: [BigFloat!]
    
    8
    
      lt: BigFloat
    
    9
    
      lte: BigFloat
    
    10
    
      neq: BigFloat
    
    11
    
      is: FilterIs
    
    12
    
    }
[/code]

**Example**

Given the SQL setup
[code] 
    1
    
    create table "GeneralLedger"(
    
    2
    
        id serial primary key,
    
    3
    
        amount numeric(10,2)
    
    4
    
    );
    
    5
    
    6
    
    insert into "GeneralLedger"(amount)
    
    7
    
    values (22.15);
[/code]

The query
[code] 
    1
    
    {
    
    2
    
      generalLedgerCollection {
    
    3
    
        edges {
    
    4
    
          node {
    
    5
    
            id
    
    6
    
            amount
    
    7
    
          }
    
    8
    
        }
    
    9
    
      }
    
    10
    
    }
[/code]

The returns the following data. Note that `amount` is serialized as a string
[code] 
    1
    
    {
    
    2
    
      "data": {
    
    3
    
        "generalLedgerCollection": {
    
    4
    
          "edges": [
    
    5
    
            {
    
    6
    
              "node": {
    
    7
    
                "id": 1,
    
    8
    
                "amount": "22.15",
    
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

### Opaque#

PostgreSQL's type system is extensible and not all types handle all operations e.g. filtering with `like`. To account for these, `pg_graphql` introduces a scalar `Opaque` type. The `Opaque` type uses PostgreSQL's `to_json` method to serialize values. That allows complex or unknown types to be included in the schema by delegating handling to the client.
[code] 
    1
    
    scalar Opaque
    
    2
    
    3
    
    input OpaqueFilter {
    
    4
    
      eq: Opaque
    
    5
    
      is: FilterIs
    
    6
    
    }
[/code]