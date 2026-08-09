---
タイトル: pg_jsonschema: JSON Schema Validation
URL: https://supabase.com/docs/guides/database/extensions/pg_jsonschema
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, json, pg_jsonschema, schema, validation
---

# pg_jsonschema: JSON Schema Validation

**URL:** https://supabase.com/docs/guides/database/extensions/pg_jsonschema
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, json, pg_jsonschema, schema, validation

## 目次

- [Enable the extension#](#enable-the-extension)
- [Functions#](#functions)
- [Usage#](#usage)
- [Resources#](#resources)

## 概要

Validate json/jsonb with JSON Schema in Postgres.

---

[JSON Schema](<https://json-schema.org>) is a language for annotating and validating JSON documents. [`pg_jsonschema`](<https://github.com/supabase/pg_jsonschema>) is a Postgres extension that adds the ability to validate Postgres's built-in `json` and `jsonb` data types against JSON Schema documents.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `pg_jsonschema` and enable the extension.


## Functions#

  * [`json_matches_schema(schema json, instance json)`](<https://github.com/supabase/pg_jsonschema#api>): Checks if a `json` _instance_ conforms to a JSON Schema _schema_.
  * [`jsonb_matches_schema(schema json, instance jsonb)`](<https://github.com/supabase/pg_jsonschema#api>): Checks if a `jsonb` _instance_ conforms to a JSON Schema _schema_.


## Usage#

Since `pg_jsonschema` exposes its utilities as functions, we can execute them with a select statement:
[code] 
    1
    
    select
    
    2
    
      extensions.json_matches_schema(
    
    3
    
        schema := '{"type": "object"}',
    
    4
    
        instance := '{}'
    
    5
    
      );
[/code]

`pg_jsonschema` is generally used in tandem with a [check constraint](<https://www.postgresql.org/docs/current/ddl-constraints.html>) as a way to constrain the contents of a json/b column to match a JSON Schema.
[code] 
    1
    
    create table customer(
    
    2
    
        id serial primary key,
    
    3
    
        ...
    
    4
    
        metadata json,
    
    5
    
    6
    
        check (
    
    7
    
            json_matches_schema(
    
    8
    
                '{
    
    9
    
                    "type": "object",
    
    10
    
                    "properties": {
    
    11
    
                        "tags": {
    
    12
    
                            "type": "array",
    
    13
    
                            "items": {
    
    14
    
                                "type": "string",
    
    15
    
                                "maxLength": 16
    
    16
    
                            }
    
    17
    
                        }
    
    18
    
                    }
    
    19
    
                }',
    
    20
    
                metadata
    
    21
    
            )
    
    22
    
        )
    
    23
    
    );
    
    24
    
    25
    
    -- Example: Valid Payload
    
    26
    
    insert into customer(metadata)
    
    27
    
    values ('{"tags": ["vip", "darkmode-ui"]}');
    
    28
    
    -- Result:
    
    29
    
    --   INSERT 0 1
    
    30
    
    31
    
    -- Example: Invalid Payload
    
    32
    
    insert into customer(metadata)
    
    33
    
    values ('{"tags": [1, 3]}');
    
    34
    
    -- Result:
    
    35
    
    --   ERROR:  new row for relation "customer" violates check constraint "customer_metadata_check"
    
    36
    
    --   DETAIL:  Failing row contains (2, {"tags": [1, 3]}).
[/code]

## Resources#

  * Official [`pg_jsonschema` documentation](<https://github.com/supabase/pg_jsonschema>)