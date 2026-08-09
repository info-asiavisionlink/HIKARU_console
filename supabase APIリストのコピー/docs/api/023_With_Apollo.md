---
タイトル: With Apollo
URL: https://supabase.com/docs/guides/graphql/with-apollo
カテゴリ: api
更新日: 2026-08-02
タグ: api, apollo, graphql, with, with-apollo
---

# With Apollo

**URL:** https://supabase.com/docs/guides/graphql/with-apollo
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, apollo, graphql, with, with-apollo

## 目次

- [Apollo Setup#](#apollo-setup)
  - [Pre-requisites#](#pre-requisites)
  - [Configuring GraphQL Code Generator#](#configuring-graphql-code-generator)
  - [Configuring Apollo Client#](#configuring-apollo-client)
- [Example Query#](#example-query)

## 概要

Using pg_grapqhl with Apollo.

---

This guide will show you how to use pg_graphql with [Apollo](<https://www.apollographql.com/docs/react/>) and [GraphQL Code Generator](<https://the-guild.dev/graphql/codegen>) for type-safe GraphQL queries in your React application.

## Apollo Setup#

### Pre-requisites#

  1. Follow the [Apollo Getting Started Guide](<https://www.apollographql.com/docs/react/get-started>).
  2. Follow the [GraphQL Code Generator Installation Guide](<https://the-guild.dev/graphql/codegen/docs/getting-started/installation>).


### Configuring GraphQL Code Generator#

Modify your `codegen.ts` file to reflect the following:
[code] 
    1
    
    import type { CodegenConfig } from '@graphql-codegen/cli'
    
    2
    
    import { addTypenameSelectionDocumentTransform } from '@graphql-codegen/client-preset'
    
    3
    
    4
    
    const config: CodegenConfig = {
    
    5
    
      schema: 'http://localhost:54321/graphql/v1', // Using the local endpoint, update if needed
    
    6
    
      documents: 'src/**/*.tsx',
    
    7
    
      overwrite: true,
    
    8
    
      ignoreNoDocuments: true,
    
    9
    
      generates: {
    
    10
    
        'src/gql/': {
    
    11
    
          preset: 'client',
    
    12
    
          documentTransforms: [addTypenameSelectionDocumentTransform],
    
    13
    
          plugins: [],
    
    14
    
          config: {
    
    15
    
            scalars: {
    
    16
    
              UUID: 'string',
    
    17
    
              Date: 'string',
    
    18
    
              Time: 'string',
    
    19
    
              Datetime: 'string',
    
    20
    
              JSON: 'string',
    
    21
    
              BigInt: 'string',
    
    22
    
              BigFloat: 'string',
    
    23
    
              Opaque: 'any',
    
    24
    
            },
    
    25
    
          },
    
    26
    
        },
    
    27
    
      },
    
    28
    
      hooks: {
    
    29
    
        afterAllFileWrite: ['npm run prettier'], // optional
    
    30
    
      },
    
    31
    
    }
    
    32
    
    33
    
    export default config
[/code]

### Configuring Apollo Client#

This example uses [Supabase](<https://supabase.com>) for the GraphQL server, but pg_graphql can be used independently.
[code] 
    1
    
    import {
    
    2
    
      ApolloClient,
    
    3
    
      InMemoryCache,
    
    4
    
      createHttpLink,
    
    5
    
      defaultDataIdFromObject
    
    6
    
    } from '@apollo/client'
    
    7
    
    import { setContext } from '@apollo/client/link/context'
    
    8
    
    import { relayStylePagination } from '@apollo/client/utilities'
    
    9
    
    import supabase, { SUPABASE_ANON_KEY } from './supabase'
    
    10
    
    11
    
    const cache = new InMemoryCache({
    
    12
    
      dataIdFromObject(responseObject) {
    
    13
    
        if ('nodeId' in responseObject) {
    
    14
    
          return `${responseObject.nodeId}`
    
    15
    
        }
    
    16
    
    17
    
        return defaultDataIdFromObject(responseObject)
    
    18
    
      },
    
    19
    
      possibleTypes: { Node: ['Todos'] }, // optional, but useful to specify supertype-subtype relationships
    
    20
    
      typePolicies: {
    
    21
    
        Query: {
    
    22
    
          fields: {
    
    23
    
            todosCollection: relayStylePagination(), // example of paginating a collection
    
    24
    
            node: {
    
    25
    
              read(_, { args, toReference }) {
    
    26
    
                const ref = toReference({
    
    27
    
                  nodeId: args?.nodeId,
    
    28
    
                })
    
    29
    
    30
    
                return ref
    
    31
    
              },
    
    32
    
            },
    
    33
    
          },
    
    34
    
        },
    
    35
    
      },
    
    36
    
    })
    
    37
    
    38
    
    const httpLink = createHttpLink({
    
    39
    
      uri: 'http://localhost:54321/graphql/v1',
    
    40
    
    })
    
    41
    
    42
    
    const authLink = setContext(async (_, { headers }) => {
    
    43
    
      const token = (await supabase.auth.getSession()).data.session?.access_token
    
    44
    
    45
    
      return {
    
    46
    
        headers: {
    
    47
    
          ...headers,
    
    48
    
          Authorization: token ? `Bearer ${token}` : '',
    
    49
    
          apikey: SUPABASE_ANON_KEY,
    
    50
    
        },
    
    51
    
      }
    
    52
    
    })
    
    53
    
    54
    
    const apolloClient = new ApolloClient({
    
    55
    
      link: authLink.concat(httpLink),
    
    56
    
      cache,
    
    57
    
    })
    
    58
    
    59
    
    export default apolloClient
[/code]

  * `typePolicies.Query.fields.node` is also optional, but useful for reducing cache misses. Learn more about [Redirecting to cached data](<https://www.apollographql.com/docs/react/performance/performance#redirecting-to-cached-data>).


## Example Query#
[code] 
    1
    
    import { useQuery } from '@apollo/client'
    
    2
    
    import { graphql } from './gql'
    
    3
    
    4
    
    const allTodosQueryDocument = graphql(/* GraphQL */ `
    
    5
    
      query AllTodos($cursor: Cursor) {
    
    6
    
        todosCollection(first: 10, after: $cursor) {
    
    7
    
          edges {
    
    8
    
            node {
    
    9
    
              nodeId
    
    10
    
              title
    
    11
    
            }
    
    12
    
          }
    
    13
    
          pageInfo {
    
    14
    
            endCursor
    
    15
    
            hasNextPage
    
    16
    
          }
    
    17
    
        }
    
    18
    
      }
    
    19
    
    `)
    
    20
    
    21
    
    const TodoList = () => {
    
    22
    
      const { data, fetchMore } = useQuery(allTodosQueryDocument)
    
    23
    
    24
    
      return (
    
    25
    
        <>
    
    26
    
          {data?.thingsCollection?.edges.map(({ node }) => (
    
    27
    
            <Todo key={node.nodeId} title={node.title} />
    
    28
    
          ))}
    
    29
    
          {data?.thingsCollection?.pageInfo.hasNextPage && (
    
    30
    
            <Button
    
    31
    
              onClick={() => {
    
    32
    
                fetchMore({
    
    33
    
                  variables: {
    
    34
    
                    cursor: data?.thingsCollection?.pageInfo.endCursor,
    
    35
    
                  },
    
    36
    
                })
    
    37
    
              }}
    
    38
    
            >
    
    39
    
              Load More
    
    40
    
            </Button>
    
    41
    
          )}
    
    42
    
        </>
    
    43
    
      )
    
    44
    
    }
    
    45
    
    46
    
    export default TodoList
[/code]