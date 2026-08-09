---
タイトル: With Relay
URL: https://supabase.com/docs/guides/graphql/with-relay
カテゴリ: api
更新日: 2026-08-02
タグ: api, graphql, relay, with, with-relay
---

# With Relay

**URL:** https://supabase.com/docs/guides/graphql/with-relay
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, graphql, relay, with, with-relay

## 目次

- [Relay Setup#](#relay-setup)
  - [Pre-requisites#](#pre-requisites)
  - [Configuring the Relay Compiler#](#configuring-the-relay-compiler)
  - [Configuring your Relay Environment#](#configuring-your-relay-environment)
- [Pagination#](#pagination)

## 概要

Using pg_grapqhl with Relay.

---

pg_graphql implements the [GraphQL Global Object Identification Specification](<https://relay.dev/graphql/objectidentification.htm>) (`Node` interface) and the [GraphQL Cursor Connections Specification](<https://relay.dev/graphql/connections.htm#>) to be compatible with [Relay](<https://relay.dev/>).

## Relay Setup#

### Pre-requisites#

Follow the [Relay Installation Guide](<https://relay.dev/docs/getting-started/installation-and-setup/>).

### Configuring the Relay Compiler#

Modify your `relay.config.js` file to reflect the following:
[code] 
    1
    
    module.exports = {
    
    2
    
      // standard relay config options
    
    3
    
      src: './src',
    
    4
    
      language: 'typescript',
    
    5
    
      schema: './data/schema.graphql',
    
    6
    
      exclude: ['**/node_modules/**', '**/__mocks__/**', '**/__generated__/**'],
    
    7
    
      // pg_graphql specific options
    
    8
    
      schemaConfig: {
    
    9
    
        nodeInterfaceIdField: 'nodeId',
    
    10
    
        nodeInterfaceIdVariableName: 'nodeId',
    
    11
    
      },
    
    12
    
      customScalarTypes: {
    
    13
    
        UUID: 'string',
    
    14
    
        Datetime: 'string',
    
    15
    
        JSON: 'string',
    
    16
    
        BigInt: 'string',
    
    17
    
        BigFloat: 'string',
    
    18
    
        Opaque: 'any',
    
    19
    
      },
    
    20
    
    }
[/code]

  * `schemaConfig` tells the Relay compiler where to find the `nodeId` field on the `node` interface
  * `customScalarTypes` will improve Relay's type emission


For Relay versions older than v16.2.0, it should be named `customScalars` instead.

### Configuring your Relay Environment#

This example uses [Supabase](<https://supabase.com>) for the GraphQL server, but pg_graphql can be used independently.
[code] 
    1
    
    import {
    
    2
    
      Environment,
    
    3
    
      FetchFunction,
    
    4
    
      Network,
    
    5
    
      RecordSource,
    
    6
    
      Store,
    
    7
    
    } from 'relay-runtime'
    
    8
    
    9
    
    import supabase, { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase'
    
    10
    
    11
    
    const fetchQuery: FetchFunction = async (operation, variables) => {
    
    12
    
      const {
    
    13
    
        data: { session },
    
    14
    
      } = await supabase.auth.getSession()
    
    15
    
    16
    
      const response = await fetch(`${SUPABASE_URL}/graphql/v1`, {
    
    17
    
        method: 'POST',
    
    18
    
        headers: {
    
    19
    
          'Content-Type': 'application/json',
    
    20
    
          apikey: SUPABASE_ANON_KEY,
    
    21
    
          Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
    
    22
    
        },
    
    23
    
        body: JSON.stringify({
    
    24
    
          query: operation.text,
    
    25
    
          variables,
    
    26
    
        }),
    
    27
    
      })
    
    28
    
    29
    
      return await response.json()
    
    30
    
    }
    
    31
    
    32
    
    const network = Network.create(fetchQuery)
    
    33
    
    const store = new Store(new RecordSource())
    
    34
    
    35
    
    const environment = new Environment({
    
    36
    
      network,
    
    37
    
      store,
    
    38
    
      getDataID: (node) => node.nodeId,
    
    39
    
      missingFieldHandlers: [
    
    40
    
        {
    
    41
    
          handle(field, _record, argValues) {
    
    42
    
            if (field.name === 'node' && 'nodeId' in argValues) {
    
    43
    
              // If field is node(nodeId: $nodeId), look up the record by the value of $nodeId
    
    44
    
              return argValues.nodeId
    
    45
    
            }
    
    46
    
    47
    
            return undefined
    
    48
    
          },
    
    49
    
          kind: 'linked',
    
    50
    
        },
    
    51
    
      ],
    
    52
    
    })
    
    53
    
    54
    
    export default environment
[/code]

  * `getDataID` is the most important option to add, as it tells Relay how to store data correctly in the cache.
  * `missingFieldHandlers` is optional in this example but helps with [Rendering Partially Cached Data](<https://relay.dev/docs/guided-tour/reusing-cached-data/rendering-partially-cached-data/>).


## Pagination#

Say you are working on a Todo app and want to add pagination. You can use `@connection` and `@prependNode` to do this.

**Fragment passed to`usePaginationFragment()`**
[code] 
    1
    
    fragment TodoList_query on Query
    
    2
    
    @argumentDefinitions(
    
    3
    
      cursor: { type: "Cursor" }
    
    4
    
      count: { type: "Int", defaultValue: 20 }
    
    5
    
    )
    
    6
    
    @refetchable(queryName: "TodoListPaginationQuery") {
    
    7
    
      todosCollection(after: $cursor, first: $count)
    
    8
    
        @connection(key: "TodoList_query_todosCollection") {
    
    9
    
        pageInfo {
    
    10
    
          hasNextPage
    
    11
    
          endCursor
    
    12
    
        }
    
    13
    
        edges {
    
    14
    
          cursor
    
    15
    
          node {
    
    16
    
            nodeId
    
    17
    
            ...TodoItem_todos
    
    18
    
          }
    
    19
    
        }
    
    20
    
      }
    
    21
    
    }
[/code]

**Mutation to create a new Todo**
[code] 
    1
    
    mutation TodoCreateMutation($input: TodosInsertInput!, $connections: [ID!]!) {
    
    2
    
      insertIntoTodosCollection(objects: [$input]) {
    
    3
    
        affectedCount
    
    4
    
        records @prependNode(connections: $connections, edgeTypeName: "TodosEdge") {
    
    5
    
          ...TodoItem_todos
    
    6
    
        }
    
    7
    
      }
    
    8
    
    }
[/code]

**Code to call the mutation**
[code] 
    1
    
    import { ConnectionHandler, graphql, useMutation } from 'react-relay'
    
    2
    
    3
    
    // inside a React component
    
    4
    
    const [todoCreateMutate, isMutationInFlight] =
    
    5
    
      useMutation<TodoCreateMutation>(CreateTodoMutation)
    
    6
    
    7
    
    // inside your create todo function
    
    8
    
    const connectionID = ConnectionHandler.getConnectionID(
    
    9
    
      'root',
    
    10
    
      'TodoList_query_todosCollection'
    
    11
    
    )
    
    12
    
    13
    
    todoCreateMutate({
    
    14
    
      variables: {
    
    15
    
        input: {
    
    16
    
          // ...new todo data
    
    17
    
        },
    
    18
    
        connections: [connectionID],
    
    19
    
      },
    
    20
    
    })
[/code]