---
タイトル: Print Postgres version
URL: https://supabase.com/docs/guides/database/postgres/which-version-of-postgres
カテゴリ: database
更新日: 2026-08-02
タグ: database, postgres, print, version, which-version-of-postgres
---

# Print Postgres version

**URL:** https://supabase.com/docs/guides/database/postgres/which-version-of-postgres
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, postgres, print, version, which-version-of-postgres

## 目次

（目次なし）

## 概要

Useful snippet for finding out which version of postgres you are running

---

It's important to know which version of Postgres you are running as each major version has different features and may cause breaking changes. You may also need to update your schema when [upgrading](<https://www.postgresql.org/docs/current/pgupgrade.html>) or downgrading to a major Postgres version.

Run the following query using the [SQL Editor](</dashboard/project/_/sql>) in the Supabase Dashboard:
[code] 
    1
    
    select
    
    2
    
      version();
[/code]

Which should return something like:
[code] 
    1
    
    PostgreSQL 15.1 on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 10.3.0-1ubuntu1~20.04) 10.3.0, 64-bit
[/code]

This query can also be executed via `psql` or any other query editor if you prefer to [connect directly to the database](</docs/guides/database/connecting-to-postgres#direct-connections>).