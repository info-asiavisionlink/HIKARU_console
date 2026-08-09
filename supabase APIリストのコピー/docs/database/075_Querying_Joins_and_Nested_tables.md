---
タイトル: Querying Joins and Nested tables
URL: https://supabase.com/docs/guides/database/joins-and-nesting
カテゴリ: database
更新日: 2026-08-02
タグ: database, joins, joins-and-nesting, nested, querying, tables
---

# Querying Joins and Nested tables

**URL:** https://supabase.com/docs/guides/database/joins-and-nesting
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, joins, joins-and-nesting, nested, querying, tables

## 目次

- [One-to-many joins#](#one-to-many-joins)
  - [TypeScript types for joins#](#typescript-types-for-joins)
- [Join types and join modifiers#](#join-types-and-join-modifiers)
  - [What:and!mean in join syntax#](#what--and--mean-in-join-syntax)
  - [Example data for join types#](#example-data-for-join-types)
  - [Left join (default)#](#left-join-default)
  - [Inner join (!inner)#](#inner-join--inner-)
  - [Filtering using joined fields#](#filtering-using-joined-fields)
- [Many-to-many joins#](#many-to-many-joins)
- [Specifying theONclause for joins with multiple foreign keys#](#specifying-the-on-clause-for-joins-with-multiple-foreign-keys)

## 概要

The Data APIs automatically detect relationships between Postgres tables.

---

The data APIs automatically detect relationships between Postgres tables. Since Postgres is a relational database, this is a very common scenario.

## One-to-many joins#

Use an example database that stores `orchestral_sections` and `instruments`:

TablesSQL

**Orchestral sections**

`id`| `name`  
---|---  
1| strings  
2| woodwinds  
  
**Instruments**

`id`| `name`| `section_id`  
---|---|---  
1| violin| 1  
2| viola| 1  
3| flute| 2  
4| oboe| 2  
  
The APIs will automatically detect relationships based on the foreign keys:

JavaScriptDartSwiftKotlinPythonGraphQLURL
[code]
    1
    
    const { data, error } = await supabase.from('orchestral_sections').select(`
    
    2
    
      id,
    
    3
    
      name,
    
    4
    
      instruments ( id, name )
    
    5
    
    `)
[/code]

### TypeScript types for joins#

`supabase-js` always returns a `data` object (for success), and an `error` object (for unsuccessful requests).

These helper types provide the result types from any query, including nested types for database joins.

Given the following schema with a relation between orchestral sections and instruments:
[code]
    1
    
    create table orchestral_sections (
    
    2
    
      "id" serial primary key,
    
    3
    
      "name" text
    
    4
    
    );
    
    5
    
    6
    
    create table instruments (
    
    7
    
      "id" serial primary key,
    
    8
    
      "name" text,
    
    9
    
      "section_id" int references "orchestral_sections"
    
    10
    
    );
[/code]

We can get the nested `SectionsWithInstruments` type like this:
[code]
    1
    
    import { QueryData, QueryError, QueryResult } from '@supabase/supabase-js'
    
    2
    
    3
    
    const sectionsWithInstrumentsQuery = supabase.from('orchestral_sections').select(`
    
    4
    
      id,
    
    5
    
      name,
    
    6
    
      instruments (
    
    7
    
        id,
    
    8
    
        name
    
    9
    
      )
    
    10
    
    `)
    
    11
    
    type SectionsWithInstruments = QueryData<typeof sectionsWithInstrumentsQuery>
    
    12
    
    13
    
    const { data, error } = await sectionsWithInstrumentsQuery
    
    14
    
    if (error) throw error
    
    15
    
    const sectionsWithInstruments: SectionsWithInstruments = data
[/code]

## Join types and join modifiers#

By default, embedded relations use **left join** semantics from the parent table:

  * Parent rows are returned even if no related rows match.
  * The embedded relation is `[]` for one-to-many joins and `null` for many-to-one joins when nothing matches.


To filter out parent rows that do not match the related table, use `!inner` on the embedded relation.

### What `:` and `!` mean in join syntax#

Syntax| Meaning| Example  
---|---|---  
`alias:relation(columns)`| Rename the embedded relation in the response.| `start_scan:scans(id, badge_scan_time)`  
`relation!inner(columns)`| Use `inner join` behavior for that embedded relation.| `instruments!inner(id, name)`  
`relation!foreign_key(columns)`| Choose which foreign key relationship to use when multiple foreign keys match the join.| `scans!scan_id_start(id)`  
  
### Example data for join types#

TablesSQL

#### Orchestral sections#

`id`| `name`  
---|---  
1| strings  
2| woodwinds  
3| percussion  
  
#### Instruments#

`id`| `name`| `section_id`  
---|---|---  
1| violin| 1  
2| viola| 1  
3| flute| 2  
4| oboe| 2  
  
### Left join (default)#

This query filters on a joined field (`instruments.name`) but still returns all parent rows:

JavaScriptDartSwiftKotlinPythonURL
[code]
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('orchestral_sections')
    
    3
    
      .select(
    
    4
    
        `
    
    5
    
        id,
    
    6
    
        name,
    
    7
    
        instruments ( id, name )
    
    8
    
      `
    
    9
    
      )
    
    10
    
      .eq('instruments.name', 'flute')
[/code]

#### Result#
[code] 
    1
    
    [
    
    2
    
      {
    
    3
    
        "id": 1,
    
    4
    
        "name": "strings",
    
    5
    
        "instruments": []
    
    6
    
      },
    
    7
    
      {
    
    8
    
        "id": 2,
    
    9
    
        "name": "woodwinds",
    
    10
    
        "instruments": [{ "id": 3, "name": "flute" }]
    
    11
    
      },
    
    12
    
      {
    
    13
    
        "id": 3,
    
    14
    
        "name": "percussion",
    
    15
    
        "instruments": []
    
    16
    
      }
    
    17
    
    ]
[/code]

### Inner join (`!inner`)#

Adding `!inner` filters out parent rows that don't match the joined filter:

JavaScriptDartSwiftKotlinPythonURL
[code]
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('orchestral_sections')
    
    3
    
      .select(
    
    4
    
        `
    
    5
    
        id,
    
    6
    
        name,
    
    7
    
        instruments!inner ( id, name )
    
    8
    
      `
    
    9
    
      )
    
    10
    
      .eq('instruments.name', 'flute')
[/code]

#### Result#
[code] 
    1
    
    [
    
    2
    
      {
    
    3
    
        "id": 2,
    
    4
    
        "name": "woodwinds",
    
    5
    
        "instruments": [{ "id": 3, "name": "flute" }]
    
    6
    
      }
    
    7
    
    ]
[/code]

### Filtering using joined fields#

Use `joined_table.column` in filters (for example `eq`, `neq`, and `in`):

JavaScriptDartSwiftKotlinPythonURL
[code]
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('instruments')
    
    3
    
      .select(
    
    4
    
        `
    
    5
    
        id,
    
    6
    
        name,
    
    7
    
        orchestral_sections!inner ( id, name )
    
    8
    
      `
    
    9
    
      )
    
    10
    
      .eq('orchestral_sections.name', 'woodwinds')
[/code]

#### Result#
[code] 
    1
    
    [
    
    2
    
      {
    
    3
    
        "id": 3,
    
    4
    
        "name": "flute",
    
    5
    
        "orchestral_sections": {
    
    6
    
          "id": 2,
    
    7
    
          "name": "woodwinds"
    
    8
    
        }
    
    9
    
      },
    
    10
    
      {
    
    11
    
        "id": 4,
    
    12
    
        "name": "oboe",
    
    13
    
        "orchestral_sections": {
    
    14
    
          "id": 2,
    
    15
    
          "name": "woodwinds"
    
    16
    
        }
    
    17
    
      }
    
    18
    
    ]
[/code]

## Many-to-many joins#

The data APIs will detect many-to-many joins. For example, if you have a database which stored teams of users (where each user could belong to many teams):
[code] 
    1
    
    create table users (
    
    2
    
      "id" serial primary key,
    
    3
    
      "name" text
    
    4
    
    );
    
    5
    
    6
    
    create table teams (
    
    7
    
      "id" serial primary key,
    
    8
    
      "team_name" text
    
    9
    
    );
    
    10
    
    11
    
    create table members (
    
    12
    
      "user_id" int references users,
    
    13
    
      "team_id" int references teams,
    
    14
    
      primary key (user_id, team_id)
    
    15
    
    );
[/code]

In these cases you don't need to explicitly define the joining table (members). If we wanted to fetch all the teams and the members in each team:

JavaScriptDartSwiftKotlinPythonGraphQLURL
[code]
    1
    
    const { data, error } = await supabase.from('teams').select(`
    
    2
    
      id,
    
    3
    
      team_name,
    
    4
    
      users ( id, name )
    
    5
    
    `)
[/code]

## Specifying the `ON` clause for joins with multiple foreign keys#

For example, if you have a project that tracks when employees check in and out of work shifts:
[code] 
    1
    
    -- Employees
    
    2
    
    create table users (
    
    3
    
      "id" serial primary key,
    
    4
    
      "name" text
    
    5
    
    );
    
    6
    
    7
    
    -- Badge scans
    
    8
    
    create table scans (
    
    9
    
      "id" serial primary key,
    
    10
    
      "user_id" int references users,
    
    11
    
      "badge_scan_time" timestamp
    
    12
    
    );
    
    13
    
    14
    
    -- Work shifts
    
    15
    
    create table shifts (
    
    16
    
      "id" serial primary key,
    
    17
    
      "user_id" int references users,
    
    18
    
      "scan_id_start" int references scans, -- clocking in
    
    19
    
      "scan_id_end" int references scans, -- clocking out
    
    20
    
      "attendance_status" text
    
    21
    
    );
[/code]

In this case, you need to explicitly define the join because the joining column on `shifts` is ambiguous as they are both referencing the `scans` table.

To fetch all the `shifts` with `scan_id_start` and `scan_id_end` related to a specific `scan`, use the following syntax:

JavaScriptDartSwiftKotlinPythonGraphQL
[code]
    1
    
    const { data, error } = await supabase.from('shifts').select(
    
    2
    
      `
    
    3
    
        *,
    
    4
    
        start_scan:scans!scan_id_start (
    
    5
    
          id,
    
    6
    
          user_id,
    
    7
    
          badge_scan_time
    
    8
    
        ),
    
    9
    
       end_scan:scans!scan_id_end (
    
    10
    
         id,
    
    11
    
         user_id,
    
    12
    
         badge_scan_time
    
    13
    
        )
    
    14
    
      `
    
    15
    
    )
[/code]