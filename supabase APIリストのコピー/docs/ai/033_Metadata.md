---
タイトル: Metadata
URL: https://supabase.com/docs/guides/ai/python/metadata
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, metadata, python
---

# Metadata

**URL:** https://supabase.com/docs/guides/ai/python/metadata
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, metadata, python

## 目次

- [Types#](#types)
- [Metadata Query Language#](#metadata-query-language)
  - [Comparison Operators#](#comparison-operators)
  - [Logical Operators#](#logical-operators)
  - [Performance#](#performance)
  - [Examples#](#examples)

## 概要

Searchdocs...

---

vecs allows you to associate key-value pairs of metadata with indexes and ids in your collections. You can then add filters to queries that reference the metadata metadata.

## Types#

Metadata is stored as binary JSON. As a result, allowed metadata types are drawn from JSON primitive types.

  * Boolean
  * String
  * Number


The technical limit of a metadata field associated with a vector is 1GB. In practice you should keep metadata fields as small as possible to maximize performance.

## Metadata Query Language#

The metadata query language is based loosely on [mongodb's selectors](<https://www.mongodb.com/docs/manual/reference/operator/query/>).

`vecs` currently supports a subset of those operators.

### Comparison Operators#

Comparison operators compare a provided value with a value stored in metadata field of the vector store.

Operator| Description  
---|---  
$eq| Matches values that are equal to a specified value  
$ne| Matches values that are not equal to a specified value  
$gt| Matches values that are greater than a specified value  
$gte| Matches values that are greater than or equal to a specified value  
$lt| Matches values that are less than a specified value  
$lte| Matches values that are less than or equal to a specified value  
$in| Matches values that are contained by scalar list of specified values  
$contains| Matches values where a scalar is contained within an array metadata field  
  
### Logical Operators#

Logical operators compose other operators, and can be nested.

Operator| Description  
---|---  
$and| Joins query clauses with a logical AND returns all documents that match the conditions of both clauses.  
$or| Joins query clauses with a logical OR returns all documents that match the conditions of either clause.  
  
### Performance#

For best performance, use scalar key-value pairs for metadata and prefer `$eq`, `$and` and `$or` filters where possible. Those variants are most consistently able to make use of indexes.

### Examples#

* * *

`year` equals 2020
[code] 
    1
    
    {"year": {"$eq": 2020}}
[/code]

* * *

`year` equals 2020 or `gross` greater than or equal to 5000.0
[code] 
    1
    
    {
    
    2
    
        "$or": [
    
    3
    
            {"year": {"$eq": 2020}},
    
    4
    
            {"gross": {"$gte": 5000.0}}
    
    5
    
        ]
    
    6
    
    }
[/code]

* * *

`last_name` is less than "Brown" and `is_priority_customer` is true
[code] 
    1
    
    {
    
    2
    
        "$and": [
    
    3
    
            {"last_name": {"$lt": "Brown"}},
    
    4
    
            {"is_priority_customer": {"$gte": 5000.00}}
    
    5
    
        ]
    
    6
    
    }
[/code]

* * *

`priority` contained by ["enterprise", "pro"]
[code] 
    1
    
    {
    
    2
    
        "priority": {"$in": ["enterprise", "pro"]}
    
    3
    
    }
[/code]

`tags`, an array, contains the string "important"
[code] 
    1
    
    {
    
    2
    
        "tags": {"$contains": "important"}
    
    3
    
    }
[/code]