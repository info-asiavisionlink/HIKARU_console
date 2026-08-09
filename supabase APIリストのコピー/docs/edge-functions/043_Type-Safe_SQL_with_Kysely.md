---
タイトル: Type-Safe SQL with Kysely
URL: https://supabase.com/docs/guides/functions/kysely-postgres
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, functions, kysely, kysely-postgres, postgres, rest, safe, sql, type, with
---

# Type-Safe SQL with Kysely

**URL:** https://supabase.com/docs/guides/functions/kysely-postgres
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, functions, kysely, kysely-postgres, postgres, rest, safe, sql, type, with

## 目次

- [Code#](#code)

## 概要

Combining Kysely with Deno Postgres gives you a convenient developer experience for interacting directly with your Postgres database.

---

Supabase Edge Functions can [connect directly to your Postgres database](</docs/guides/functions/connect-to-postgres>) to execute SQL queries. [Kysely](<https://github.com/kysely-org/kysely#kysely>) is a type-safe and autocompletion-friendly typescript SQL query builder.

Combining Kysely with Deno Postgres gives you a convenient developer experience for interacting directly with your Postgres database.

## Code#

Find the example on [GitHub](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/kysely-postgres>)

Get your database connection credentials from the project's [**Connect** panel](</dashboard/project/_/?showConnect=true>) and store them in an `.env` file:
[code] 
    1
    
    DB_HOSTNAME=
    
    2
    
    DB_PASSWORD=
    
    3
    
    DB_SSL_CERT="-----BEGIN CERTIFICATE-----
    
    4
    
    GET YOUR CERT FROM YOUR PROJECT DASHBOARD
    
    5
    
    -----END CERTIFICATE-----"
[/code]

Create a `DenoPostgresDriver.ts` file to manage the connection to Postgres via [deno-postgres](<https://deno-postgres.com/>):
[code] 
    1
    
    import { Pool, PoolClient } from 'jsr:@db/postgres@^0'
    
    2
    
    import {
    
    3
    
      CompiledQuery,
    
    4
    
      DatabaseConnection,
    
    5
    
      Driver,
    
    6
    
      PostgresCursorConstructor,
    
    7
    
      QueryResult,
    
    8
    
      TransactionSettings,
    
    9
    
    } from 'npm:kysely@^0'
    
    10
    
    import { freeze, isFunction } from 'npm:kysely@^0/dist/esm/util/object-utils.js'
    
    11
    
    import { extendStackTrace } from 'npm:kysely@^0/dist/esm/util/stack-trace-utils.js'
    
    12
    
    13
    
    export interface PostgresDialectConfig {
    
    14
    
      pool: Pool | (() => Promise<Pool>)
    
    15
    
      cursor?: PostgresCursorConstructor
    
    16
    
      onCreateConnection?: (connection: DatabaseConnection) => Promise<void>
    
    17
    
    }
    
    18
    
    19
    
    const PRIVATE_RELEASE_METHOD = Symbol()
    
    20
    
    21
    
    export class PostgresDriver implements Driver {
    
    22
    
      readonly #config: PostgresDialectConfig
    
    23
    
      readonly #connections = new WeakMap<PoolClient, DatabaseConnection>()
    
    24
    
      #pool?: Pool
    
    25
    
    26
    
      constructor(config: PostgresDialectConfig) {
    
    27
    
        this.#config = freeze({ ...config })
    
    28
    
      }
    
    29
    
    30
    
      async init(): Promise<void> {
    
    31
    
        this.#pool = isFunction(this.#config.pool) ? await this.#config.pool() : this.#config.pool
    
    32
    
      }
    
    33
    
    34
    
      async acquireConnection(): Promise<DatabaseConnection> {
    
    35
    
        const client = await this.#pool!.connect()
    
    36
    
        let connection = this.#connections.get(client)
    
    37
    
    38
    
        if (!connection) {
    
    39
    
          connection = new PostgresConnection(client, {
    
    40
    
            cursor: this.#config.cursor ?? null,
    
    41
    
          })
    
    42
    
          this.#connections.set(client, connection)
    
    43
    
    44
    
          // The driver must take care of calling `onCreateConnection` when a new
    
    45
    
          // connection is created. The `pg` module doesn't provide an async hook
    
    46
    
          // for the connection creation. We need to call the method explicitly.
    
    47
    
          if (this.#config?.onCreateConnection) {
    
    48
    
            await this.#config.onCreateConnection(connection)
    
    49
    
          }
    
    50
    
        }
    
    51
    
    52
    
        return connection
    
    53
    
      }
    
    54
    
    55
    
      async beginTransaction(
    
    56
    
        connection: DatabaseConnection,
    
    57
    
        settings: TransactionSettings
    
    58
    
      ): Promise<void> {
    
    59
    
        if (settings.isolationLevel) {
    
    60
    
          await connection.executeQuery(
    
    61
    
            CompiledQuery.raw(`start transaction isolation level ${settings.isolationLevel}`)
    
    62
    
          )
    
    63
    
        } else {
    
    64
    
          await connection.executeQuery(CompiledQuery.raw('begin'))
    
    65
    
        }
    
    66
    
      }
    
    67
    
    68
    
      async commitTransaction(connection: DatabaseConnection): Promise<void> {
    
    69
    
        await connection.executeQuery(CompiledQuery.raw('commit'))
    
    70
    
      }
    
    71
    
    72
    
      async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    
    73
    
        await connection.executeQuery(CompiledQuery.raw('rollback'))
    
    74
    
      }
    
    75
    
    76
    
      async releaseConnection(connection: PostgresConnection): Promise<void> {
    
    77
    
        connection[PRIVATE_RELEASE_METHOD]()
    
    78
    
      }
    
    79
    
    80
    
      async destroy(): Promise<void> {
    
    81
    
        if (this.#pool) {
    
    82
    
          const pool = this.#pool
    
    83
    
          this.#pool = undefined
    
    84
    
          await pool.end()
    
    85
    
        }
    
    86
    
      }
    
    87
    
    }
    
    88
    
    89
    
    interface PostgresConnectionOptions {
    
    90
    
      cursor: PostgresCursorConstructor | null
    
    91
    
    }
    
    92
    
    93
    
    class PostgresConnection implements DatabaseConnection {
    
    94
    
      #client: PoolClient
    
    95
    
      #options: PostgresConnectionOptions
    
    96
    
    97
    
      constructor(client: PoolClient, options: PostgresConnectionOptions) {
    
    98
    
        this.#client = client
    
    99
    
        this.#options = options
    
    100
    
      }
    
    101
    
    102
    
      async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    
    103
    
        try {
    
    104
    
          const result = await this.#client.queryObject<O>(compiledQuery.sql, [
    
    105
    
            ...compiledQuery.parameters,
    
    106
    
          ])
    
    107
    
    108
    
          if (
    
    109
    
            result.command === 'INSERT' ||
    
    110
    
            result.command === 'UPDATE' ||
    
    111
    
            result.command === 'DELETE'
    
    112
    
          ) {
    
    113
    
            const numAffectedRows = BigInt(result.rowCount || 0)
    
    114
    
    115
    
            return {
    
    116
    
              numUpdatedOrDeletedRows: numAffectedRows,
    
    117
    
              numAffectedRows,
    
    118
    
              rows: result.rows ?? [],
    
    119
    
            } as any
    
    120
    
          }
    
    121
    
    122
    
          return {
    
    123
    
            rows: result.rows ?? [],
    
    124
    
          }
    
    125
    
        } catch (err) {
    
    126
    
          throw extendStackTrace(err, new Error())
    
    127
    
        }
    
    128
    
      }
    
    129
    
    130
    
      async *streamQuery<O>(
    
    131
    
        _compiledQuery: CompiledQuery,
    
    132
    
        chunkSize: number
    
    133
    
      ): AsyncIterableIterator<QueryResult<O>> {
    
    134
    
        if (!this.#options.cursor) {
    
    135
    
          throw new Error(
    
    136
    
            "'cursor' is not present in your postgres dialect config. It's required to make streaming work in postgres."
    
    137
    
          )
    
    138
    
        }
    
    139
    
    140
    
        if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    
    141
    
          throw new Error('chunkSize must be a positive integer')
    
    142
    
        }
    
    143
    
    144
    
        // stream not available
    
    145
    
        return null
    
    146
    
      }
    
    147
    
    148
    
      [PRIVATE_RELEASE_METHOD](): void {
    
    149
    
        this.#client.release()
    
    150
    
      }
    
    151
    
    }
[/code]

Create an `index.ts` file to execute a query on incoming requests:
[code] 
    1
    
    import { Pool } from 'jsr:@db/postgres@^0'
    
    2
    
    import {
    
    3
    
      Generated,
    
    4
    
      Kysely,
    
    5
    
      PostgresAdapter,
    
    6
    
      PostgresIntrospector,
    
    7
    
      PostgresQueryCompiler,
    
    8
    
    } from 'npm:kysely@^0'
    
    9
    
    import { withSupabase } from 'npm:@supabase/server@^1'
    
    10
    
    11
    
    import { PostgresDriver } from './DenoPostgresDriver.ts'
    
    12
    
    13
    
    console.log(`Function "kysely-postgres" up and running!`)
    
    14
    
    15
    
    interface AnimalTable {
    
    16
    
      id: Generated<bigint>
    
    17
    
      animal: string
    
    18
    
      created_at: Date
    
    19
    
    }
    
    20
    
    21
    
    // Keys of this interface are table names.
    
    22
    
    interface Database {
    
    23
    
      animals: AnimalTable
    
    24
    
    }
    
    25
    
    26
    
    // Create a database pool with one connection.
    
    27
    
    const pool = new Pool(
    
    28
    
      {
    
    29
    
        tls: { caCertificates: [Deno.env.get('DB_SSL_CERT')!] },
    
    30
    
        database: 'postgres',
    
    31
    
        hostname: Deno.env.get('DB_HOSTNAME'),
    
    32
    
        user: 'postgres',
    
    33
    
        port: 5432,
    
    34
    
        password: Deno.env.get('DB_PASSWORD'),
    
    35
    
      },
    
    36
    
      1
    
    37
    
    )
    
    38
    
    39
    
    // You'd create one of these when you start your app.
    
    40
    
    const db = new Kysely<Database>({
    
    41
    
      dialect: {
    
    42
    
        createAdapter() {
    
    43
    
          return new PostgresAdapter()
    
    44
    
        },
    
    45
    
        createDriver() {
    
    46
    
          return new PostgresDriver({ pool })
    
    47
    
        },
    
    48
    
        createIntrospector(db: Kysely<unknown>) {
    
    49
    
          return new PostgresIntrospector(db)
    
    50
    
        },
    
    51
    
        createQueryCompiler() {
    
    52
    
          return new PostgresQueryCompiler()
    
    53
    
        },
    
    54
    
      },
    
    55
    
    })
    
    56
    
    57
    
    export default {
    
    58
    
      fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    
    59
    
        try {
    
    60
    
          // Run a query
    
    61
    
          const animals = await db
    
    62
    
            .selectFrom('animals')
    
    63
    
            .select(['id', 'animal', 'created_at'])
    
    64
    
            .execute()
    
    65
    
    66
    
          // Neat, it's properly typed \o/
    
    67
    
          console.log(animals[0].created_at.getFullYear())
    
    68
    
    69
    
          const data = animals.map((animal) =>
    
    70
    
            Object.fromEntries(
    
    71
    
              Object.entries(animal).map(([key, value]) => [
    
    72
    
                key,
    
    73
    
                typeof value === 'bigint' ? value.toString() : value,
    
    74
    
              ])
    
    75
    
            )
    
    76
    
          )
    
    77
    
    78
    
          return Response.json(data, {
    
    79
    
            headers: {
    
    80
    
              'Content-Type': 'application/json; charset=utf-8',
    
    81
    
            },
    
    82
    
          })
    
    83
    
        } catch (err) {
    
    84
    
          console.error(err)
    
    85
    
          return Response.json({ error: String(err?.message ?? err) }, { status: 500 })
    
    86
    
        }
    
    87
    
      }),
    
    88
    
    }
[/code]