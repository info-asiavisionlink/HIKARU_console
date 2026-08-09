---
タイトル: Drop all tables in a Postgres schema
URL: https://supabase.com/docs/guides/database/postgres/dropping-all-tables-in-schema
カテゴリ: database
更新日: 2026-08-02
タグ: database, drop, dropping-all-tables-in-schema, postgres, schema, tables
---

# Drop all tables in a Postgres schema

**URL:** https://supabase.com/docs/guides/database/postgres/dropping-all-tables-in-schema
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, drop, dropping-all-tables-in-schema, postgres, schema, tables

## 目次

（目次なし）

## 概要

Useful snippet for deleting all tables in a given schema

---

Execute the following query to drop all tables in a given schema. Replace `my-schema-name` with the name of your schema. In Supabase, the default schema is `public`.

This deletes all tables and their associated data. Ensure you have a recent [backup](</docs/guides/platform/backups>) before proceeding.
[code] 
    1
    
    do $$ declare
    
    2
    
        r record;
    
    3
    
    begin
    
    4
    
        for r in (select tablename from pg_tables where schemaname = 'my-schema-name') loop
    
    5
    
            execute 'drop table if exists ' || quote_ident(r.tablename) || ' cascade';
    
    6
    
        end loop;
    
    7
    
    end $$;
[/code]

This query works by listing out all the tables in the given schema and then executing a `drop table` for each (hence the `for... loop`).

You can run this query using the [SQL Editor](</dashboard/project/_/sql>) in the Supabase Dashboard, or via `psql` if you're [connecting directly to the database](</docs/guides/database/connecting-to-postgres#direct-connections>).