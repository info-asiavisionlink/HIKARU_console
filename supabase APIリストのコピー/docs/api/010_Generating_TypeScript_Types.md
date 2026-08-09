---
タイトル: Generating TypeScript Types
URL: https://supabase.com/docs/guides/api/rest/generating-types
カテゴリ: api
更新日: 2026-08-02
タグ: api, generating, generating-types, rest, types, typescript
---

# Generating TypeScript Types

**URL:** https://supabase.com/docs/guides/api/rest/generating-types
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, generating, generating-types, rest, types, typescript

## 目次

- [Generating types from project dashboard#](#generating-types-from-project-dashboard)
- [Generating types using Supabase CLI#](#generating-types-using-supabase-cli)
- [Using TypeScript type definitions#](#using-typescript-type-definitions)
- [Helper types for tables and joins#](#helper-types-for-tables-and-joins)
- [Enhanced type inference for JSON fields#](#enhanced-type-inference-for-json-fields)
  - [Defining custom JSON types#](#defining-custom-json-types)
  - [Type-safe JSON querying#](#type-safe-json-querying)
  - [Type shorthands#](#type-shorthands)
  - [Response types for complex queries#](#response-types-for-complex-queries)
- [Update types automatically with GitHub Actions#](#update-types-automatically-with-github-actions)
- [Resources#](#resources)

## 概要

How to generate types for your API and Supabase libraries.

---

Supabase APIs are generated from your database, which means that we can use database introspection to generate type-safe API definitions.

## Generating types from project dashboard#

Supabase allows you to generate and download TypeScript types directly from the [project dashboard](</dashboard/project/_/api?page=tables-intro>).

## Generating types using Supabase CLI#

The Supabase CLI is a single binary Go application that provides everything you need to setup a local development environment.

You can [install the CLI](<https://www.npmjs.com/package/supabase>) via npm or other supported package managers. The minimum required version of the CLI is [v1.8.1](<https://github.com/supabase/cli/releases>).
[code] 
    1
    
    npm i supabase@">=1.8.1" --save-dev
[/code]

Login with your Personal Access Token:
[code] 
    1
    
    npx supabase login
[/code]

Before generating types, ensure you initialize your Supabase project:
[code] 
    1
    
    npx supabase init
[/code]

Generate types for your project to produce the `database.types.ts` file:
[code] 
    1
    
    npx supabase gen types typescript --project-id "$PROJECT_REF" --schema public > database.types.ts
[/code]

or in case of local development:
[code] 
    1
    
    npx supabase gen types typescript --local > database.types.ts
[/code]

or in case of a self-hosted instance (see [Accessing Postgres](</docs/guides/self-hosting/docker#accessing-postgres>) for more information):
[code] 
    1
    
    npx supabase gen types typescript --db-url postgres://postgres.[POOLER_TENANT_ID]:[POSTGRES_PASSWORD]@[your-domain-or-ip]:5432/postgres --schema public > database.types.ts
[/code]

These types are generated from your database schema. Given a table `public.movies`, the generated types will look like:
[code] 
    1
    
    create table public.movies (
    
    2
    
      id bigint generated always as identity primary key,
    
    3
    
      name text not null,
    
    4
    
      data jsonb null
    
    5
    
    );
[/code]
[code] 
    1
    
    export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
    
    2
    
    3
    
    export interface Database {
    
    4
    
      public: {
    
    5
    
        Tables: {
    
    6
    
          movies: {
    
    7
    
            Row: {
    
    8
    
              // the data expected from .select()
    
    9
    
              id: number
    
    10
    
              name: string
    
    11
    
              data: Json | null
    
    12
    
            }
    
    13
    
            Insert: {
    
    14
    
              // the data to be passed to .insert()
    
    15
    
              id?: never // generated columns must not be supplied
    
    16
    
              name: string // `not null` columns with no default must be supplied
    
    17
    
              data?: Json | null // nullable columns can be omitted
    
    18
    
            }
    
    19
    
            Update: {
    
    20
    
              // the data to be passed to .update()
    
    21
    
              id?: never
    
    22
    
              name?: string // `not null` columns are optional on .update()
    
    23
    
              data?: Json | null
    
    24
    
            }
    
    25
    
          }
    
    26
    
        }
    
    27
    
      }
    
    28
    
    }
[/code]

## Using TypeScript type definitions#

You can supply the type definitions to `supabase-js` like so:
[code] 
    1
    
    import { createClient } from '@supabase/supabase-js'
    
    2
    
    import { Database } from './database.types'
    
    3
    
    4
    
    const supabase = createClient<Database>(
    
    5
    
      process.env.SUPABASE_URL,
    
    6
    
      process.env.SUPABASE_PUBLISHABLE_KEY
    
    7
    
    )
[/code]

## Helper types for tables and joins#

You can use the following helper types to make the generated TypeScript types easier to use.

Sometimes the generated types are not what you expect. For example, a view's column may show up as nullable when you expect it to be `not null`. Using [type-fest](<https://github.com/sindresorhus/type-fest>), you can override the types like so:
[code] 
    1
    
    export type Json = // ...
    
    2
    
    3
    
    export interface Database {
    
    4
    
      // ...
    
    5
    
    }
[/code]
[code] 
    1
    
    import { MergeDeep } from 'type-fest'
    
    2
    
    import { Database as DatabaseGenerated } from './database-generated.types'
    
    3
    
    export { Json } from './database-generated.types'
    
    4
    
    5
    
    // Override the type for a specific column in a view:
    
    6
    
    export type Database = MergeDeep<
    
    7
    
      DatabaseGenerated,
    
    8
    
      {
    
    9
    
        public: {
    
    10
    
          Views: {
    
    11
    
            movies_view: {
    
    12
    
              Row: {
    
    13
    
                // id is a primary key in public.movies, so it must be `not null`
    
    14
    
                id: number
    
    15
    
              }
    
    16
    
            }
    
    17
    
          }
    
    18
    
        }
    
    19
    
      }
    
    20
    
    >
[/code]

To use `MergeDeep`, set `compilerOptions.strictNullChecks` to `true` in your `tsconfig.json`.

## Enhanced type inference for JSON fields#

Starting from [supabase-js v2.48.0](<https://github.com/supabase/supabase-js/releases/tag/v2.48.0>), you can define custom types for JSON fields and get enhanced type inference when using JSON selectors with the `->` and `->>` operators. This makes your code more type-safe and intuitive when working with JSON/JSONB columns.

### Defining custom JSON types#

You can extend your generated database types to include custom JSON schemas using `MergeDeep`:
[code] 
    1
    
    import { MergeDeep } from 'type-fest'
    
    2
    
    import { Database as DatabaseGenerated } from './database-generated.types'
    
    3
    
    4
    
    // Define your custom JSON type
    
    5
    
    type CustomJsonType = {
    
    6
    
      foo: string
    
    7
    
      bar: { baz: number }
    
    8
    
      en: 'ONE' | 'TWO' | 'THREE'
    
    9
    
    }
    
    10
    
    11
    
    export type Database = MergeDeep<
    
    12
    
      DatabaseGenerated,
    
    13
    
      {
    
    14
    
        public: {
    
    15
    
          Tables: {
    
    16
    
            your_table: {
    
    17
    
              Row: {
    
    18
    
                data: CustomJsonType | null
    
    19
    
              }
    
    20
    
              // Optional: Use if you want type-checking for inserts and updates
    
    21
    
              // Insert: {
    
    22
    
              //   data?: CustomJsonType | null;
    
    23
    
              // };
    
    24
    
              // Update: {
    
    25
    
              //   data?: CustomJsonType | null;
    
    26
    
              // };
    
    27
    
            }
    
    28
    
          }
    
    29
    
          Views: {
    
    30
    
            your_view: {
    
    31
    
              Row: {
    
    32
    
                data: CustomJsonType | null
    
    33
    
              }
    
    34
    
            }
    
    35
    
          }
    
    36
    
        }
    
    37
    
      }
    
    38
    
    >
[/code]

### Type-safe JSON querying#

Once you've defined your custom JSON types, TypeScript will automatically infer the correct types when using JSON selectors:
[code] 
    1
    
    const res = await client.from('your_table').select('data->bar->baz, data->en, data->bar')
    
    2
    
    3
    
    if (res.data) {
    
    4
    
      console.log(res.data)
    
    5
    
      // TypeScript infers the shape of your JSON data:
    
    6
    
      // [
    
    7
    
      //   {
    
    8
    
      //     baz: number;
    
    9
    
      //     en: 'ONE' | 'TWO' | 'THREE';
    
    10
    
      //     bar: { baz: number };
    
    11
    
      //   }
    
    12
    
      // ]
    
    13
    
    }
[/code]

This feature works with:

  * Single-level JSON access: `data->foo`
  * Nested JSON access: `data->bar->baz`
  * Text extraction: `data->>foo` (returns string)
  * Mixed selections combining multiple JSON paths


The type inference automatically handles the difference between `->` (returns JSON) and `->>` (returns text) operators, ensuring your TypeScript types match the actual runtime behavior.

You can also override the type of an individual successful response if needed:
[code] 
    1
    
    // Partial type override allows you to only override some of the properties in your results
    
    2
    
    const { data } = await supabase.from('countries').select().overrideTypes<Array<{ id: string }>>()
    
    3
    
    // For a full replacement of the original return type use the `{ merge: false }` property as second argument
    
    4
    
    const { data } = await supabase
    
    5
    
      .from('countries')
    
    6
    
      .select()
    
    7
    
      .overrideTypes<Array<{ id: string }>, { merge: false }>()
    
    8
    
    // Use it with `maybeSingle` or `single`
    
    9
    
    const { data } = await supabase.from('countries').select().single().overrideTypes<{ id: string }>()
[/code]

### Type shorthands#

The generated types provide shorthands for accessing tables and enums.
[code] 
    1
    
    import { Database, Tables, Enums } from "./database.types.ts";
    
    2
    
    3
    
    // Before 😕
    
    4
    
    let movie: Database['public']['Tables']['movies']['Row'] = // ...
    
    5
    
    6
    
    // After 😍
    
    7
    
    let movie: Tables<'movies'>
[/code]

### Response types for complex queries#

`supabase-js` always returns a `data` object (for success), and an `error` object (for unsuccessful requests).

These helper types provide the result types from any query, including nested types for database joins.

Given the following schema with a relation between cities and countries:
[code] 
    1
    
    create table countries (
    
    2
    
      "id" serial primary key,
    
    3
    
      "name" text
    
    4
    
    );
    
    5
    
    6
    
    create table cities (
    
    7
    
      "id" serial primary key,
    
    8
    
      "name" text,
    
    9
    
      "country_id" int references "countries"
    
    10
    
    );
[/code]

We can get the nested `CountriesWithCities` type like this:
[code] 
    1
    
    import { QueryResult, QueryData, QueryError } from '@supabase/supabase-js'
    
    2
    
    3
    
    const countriesWithCitiesQuery = supabase.from('countries').select(`
    
    4
    
      id,
    
    5
    
      name,
    
    6
    
      cities (
    
    7
    
        id,
    
    8
    
        name
    
    9
    
      )
    
    10
    
    `)
    
    11
    
    type CountriesWithCities = QueryData<typeof countriesWithCitiesQuery>
    
    12
    
    13
    
    const { data, error } = await countriesWithCitiesQuery
    
    14
    
    if (error) throw error
    
    15
    
    const countriesWithCities: CountriesWithCities = data
[/code]

## Update types automatically with GitHub Actions#

One way to keep your type definitions in sync with your database is to set up a GitHub action that runs on a schedule.

Add the following script to your `package.json` to run it using `npm run update-types`
[code] 
    1
    
    "update-types": "npx supabase gen types --lang=typescript --project-id \"$PROJECT_REF\" > database.types.ts"
[/code]

Create a file `.github/workflows/update-types.yml` with the following snippet to define the action along with the environment variables. This script will commit new type changes to your repo every night.
[code] 
    1
    
    name: Update database types
    
    2
    
    3
    
    on:
    
    4
    
      schedule:
    
    5
    
        # sets the action to run daily. You can modify this to run the action more or less frequently
    
    6
    
        - cron: '0 0 * * *'
    
    7
    
    8
    
    jobs:
    
    9
    
      update:
    
    10
    
        runs-on: ubuntu-latest
    
    11
    
        permissions:
    
    12
    
          contents: write
    
    13
    
        env:
    
    14
    
          SUPABASE_ACCESS_TOKEN: ${{ secrets.ACCESS_TOKEN }}
    
    15
    
          PROJECT_REF: <your-project-id>
    
    16
    
        steps:
    
    17
    
          - uses: actions/checkout@v4
    
    18
    
            with:
    
    19
    
              persist-credentials: false
    
    20
    
              fetch-depth: 0
    
    21
    
          - uses: actions/setup-node@v4
    
    22
    
            with:
    
    23
    
              node-version: 22
    
    24
    
          - run: npm run update-types
    
    25
    
          - name: check for file changes
    
    26
    
            id: git_status
    
    27
    
            run: |
    
    28
    
              echo "status=$(git status -s)" >> $GITHUB_OUTPUT
    
    29
    
          - name: Commit files
    
    30
    
            if: ${{contains(steps.git_status.outputs.status, ' ')}}
    
    31
    
            run: |
    
    32
    
              git add database.types.ts
    
    33
    
              git config --local user.email "41898282+github-actions[bot]@users.noreply.github.com"
    
    34
    
              git config --local user.name "github-actions[bot]"
    
    35
    
              git commit -m "Update database types" -a
    
    36
    
          - name: Push changes
    
    37
    
            if: ${{contains(steps.git_status.outputs.status, ' ')}}
    
    38
    
            uses: ad-m/github-push-action@master
    
    39
    
            with:
    
    40
    
              github_token: ${{ secrets.GITHUB_TOKEN }}
    
    41
    
              branch: ${{ github.ref }}
[/code]

Alternatively, you can use a community-supported GitHub action: [`generate-supabase-db-types-github-action`](<https://github.com/lyqht/generate-supabase-db-types-github-action>).

## Resources#

  * [Generating Supabase types with GitHub Actions](<https://blog.esteetey.dev/how-to-create-and-test-a-github-action-that-generates-types-from-supabase-database>)