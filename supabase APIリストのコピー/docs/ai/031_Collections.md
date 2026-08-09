---
タイトル: Collections
URL: https://supabase.com/docs/guides/ai/python/collections
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, collections, python
---

# Collections

**URL:** https://supabase.com/docs/guides/ai/python/collections
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, collections, python

## 目次

（目次なし）

## 概要

Searchdocs...

---

A collection is an group of vector records. Records can be [added to or updated in](<https://supabase.github.io/vecs/api.md/#upserting-vectors>) a collection. Collections can be [queried](<https://supabase.github.io/vecs/api.md/#query>) at any time, but should be [indexed](<https://supabase.github.io/vecs/api.md/#create-an-index>) for scalable query performance.

Each vector record has the form:
[code] 
    1
    
    Record (
    
    2
    
        id: String
    
    3
    
        vec: Numeric[]
    
    4
    
        metadata: JSON
    
    5
    
    )
[/code]

For example:
[code] 
    1
    
    ("vec1", [0.1, 0.2, 0.3], {"year": 1990})
[/code]

Underneath every `vecs` collection is a Postgres table
[code] 
    1
    
    create table <collection_name> (
    
    2
    
        id string primary key,
    
    3
    
        vec vector(<dimension>),
    
    4
    
        metadata jsonb
    
    5
    
    )
[/code]

where rows in the table map 1:1 with vecs vector records.

It is safe to select collection tables from outside the vecs client but issuing DDL is not recommended.