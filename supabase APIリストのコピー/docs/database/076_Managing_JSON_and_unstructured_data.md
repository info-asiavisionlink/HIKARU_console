---
タイトル: Managing JSON and unstructured data
URL: https://supabase.com/docs/guides/database/json
カテゴリ: database
更新日: 2026-08-02
タグ: data, database, json, managing, unstructured
---

# Managing JSON and unstructured data

**URL:** https://supabase.com/docs/guides/database/json
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** data, database, json, managing, unstructured

## 目次

- [JSON vs JSONB#](#json-vs-jsonb)
- [When to use JSON/JSONB#](#when-to-use-jsonjsonb)
- [Create JSONB columns#](#create-jsonb-columns)
- [Inserting JSON data#](#inserting-json-data)
- [Query JSON data#](#query-json-data)
- [Validating JSON data#](#validating-json-data)
- [Resources#](#resources)

## 概要

Using the JSON data type in Postgres.

---

Postgres supports storing and querying unstructured data.

## JSON vs JSONB#

Postgres supports two types of JSON columns: `json` (stored as a string) and `jsonb` (stored as a binary). The recommended type is `jsonb` for almost all cases.

  * `json` stores an exact copy of the input text. Database functions must reparse the content on each execution.
  * `jsonb` stores database in a decomposed binary format. While this makes it slightly slower to input due to added conversion overhead, it is significantly faster to process, since no reparsing is needed.


## When to use JSON/JSONB#

Generally you should use a `jsonb` column when you have data that is unstructured or has a variable schema. For example, if you wanted to store responses for various webhooks, you might not know the format of the response when creating the table. Instead, you could store the `payload` as a `jsonb` object in a single column.

Don't go overboard with `json/jsonb` columns. They are a useful tool, but most of the benefits of a relational database come from the ability to query and join structured data, and the referential integrity that brings.

## Create JSONB columns#

`json/jsonb` is another "data type" for Postgres columns. You can create a `jsonb` column in the same way you would create a `text` or `int` column:

SQLDashboard
[code]
    1
    
    create table books (
    
    2
    
      id serial primary key,
    
    3
    
      title text,
    
    4
    
      author text,
    
    5
    
      metadata jsonb
    
    6
    
    );
[/code]

## Inserting JSON data#

You can insert JSON data in the same way that you insert any other data. The data must be valid JSON.

SQLDashboardJavaScriptDartSwiftKotlinPython
[code]
    1
    
    insert into books
    
    2
    
      (title, author, metadata)
    
    3
    
    values
    
    4
    
      (
    
    5
    
        'The Poky Little Puppy',
    
    6
    
        'Janette Sebring Lowrey',
    
    7
    
        '{"description":"Puppy is slower than other, bigger animals.","price":5.95,"ages":[3,6]}'
    
    8
    
      ),
    
    9
    
      (
    
    10
    
        'The Tale of Peter Rabbit',
    
    11
    
        'Beatrix Potter',
    
    12
    
        '{"description":"Rabbit eats some vegetables.","price":4.49,"ages":[2,5]}'
    
    13
    
      ),
    
    14
    
      (
    
    15
    
        'Tootle',
    
    16
    
        'Gertrude Crampton',
    
    17
    
        '{"description":"Little toy train has big dreams.","price":3.99,"ages":[2,5]}'
    
    18
    
      ),
    
    19
    
      (
    
    20
    
        'Green Eggs and Ham',
    
    21
    
        'Dr. Seuss',
    
    22
    
        '{"description":"Sam has changing food preferences and eats unusually colored food.","price":7.49,"ages":[4,8]}'
    
    23
    
      ),
    
    24
    
      (
    
    25
    
        'Harry Potter and the Goblet of Fire',
    
    26
    
        'J.K. Rowling',
    
    27
    
        '{"description":"Fourth year of school starts, big drama ensues.","price":24.95,"ages":[10,99]}'
    
    28
    
      );
[/code]

## Query JSON data#

Querying JSON data is similar to querying other data, with a few other features to access nested values.

Postgres support a range of [JSON functions and operators](<https://www.postgresql.org/docs/current/functions-json.html>). For example, the `->` operator returns values as `jsonb` data. If you want the data returned as `text`, use the `->>` operator.

SQLJavaScriptSwiftKotlinPythonResult
[code]
    1
    
    select
    
    2
    
      title,
    
    3
    
      metadata ->> 'description' as description, -- returned as text
    
    4
    
      metadata -> 'price' as price,
    
    5
    
      metadata -> 'ages' -> 0 as low_age,
    
    6
    
      metadata -> 'ages' -> 1 as high_age
    
    7
    
    from books;
[/code]

## Validating JSON data#

Supabase provides the [`pg_jsonschema` extension](</docs/guides/database/extensions/pg_jsonschema>) that adds the ability to validate `json` and `jsonb` data types against [JSON Schema](<https://json-schema.org/>) documents.

Once you have enabled the extension, you can add a "check constraint" to your table to validate the JSON data:
[code] 
    1
    
    create table customers (
    
    2
    
      id serial primary key,
    
    3
    
      metadata json
    
    4
    
    );
    
    5
    
    6
    
    alter table customers
    
    7
    
    add constraint check_metadata check (
    
    8
    
      json_matches_schema(
    
    9
    
        '{
    
    10
    
            "type": "object",
    
    11
    
            "properties": {
    
    12
    
                "tags": {
    
    13
    
                    "type": "array",
    
    14
    
                    "items": {
    
    15
    
                        "type": "string",
    
    16
    
                        "maxLength": 16
    
    17
    
                    }
    
    18
    
                }
    
    19
    
            }
    
    20
    
        }',
    
    21
    
        metadata
    
    22
    
      )
    
    23
    
    );
[/code]

## Resources#

  * [Postgres: JSON Functions and Operators](<https://www.postgresql.org/docs/current/functions-json.html>)
  * [Postgres JSON types](<https://www.postgresql.org/docs/current/datatype-json.html>)