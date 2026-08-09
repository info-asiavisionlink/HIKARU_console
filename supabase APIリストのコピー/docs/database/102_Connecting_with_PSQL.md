---
タイトル: Connecting with PSQL
URL: https://supabase.com/docs/guides/database/psql
カテゴリ: database
更新日: 2026-08-02
タグ: connecting, database, psql, sql, with
---

# Connecting with PSQL

**URL:** https://supabase.com/docs/guides/database/psql
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** connecting, database, psql, sql, with

## 目次

- [Connecting with SSL#](#connecting-with-ssl)

## 概要

Searchdocs...

---

[`psql`](<https://www.postgresql.org/docs/current/app-psql.html>) is a command-line tool that comes with Postgres.

## Connecting with SSL#

You should connect to your database using SSL wherever possible, to prevent snooping and man-in-the-middle attacks.

You can obtain your connection info and Server root certificate from your application's dashboard:

![Connection Info and Certificate.](/docs/img/database/database-settings-ssl.png)

Download your SSL certificate to `/path/to/prod-supabase.cer`.

Find your connection settings. Go to the project [**Connect** panel](</dashboard/project/_?showConnect=true&method=session>) and copy the URL from the `Session pooler` section, and copy the parameters into the connection string:
[code] 
    1
    
    psql "sslmode=verify-full sslrootcert=/path/to/prod-supabase.cer host=[CLOUD_PROVIDER]-0-[REGION].pooler.supabase.com dbname=postgres user=postgres.[PROJECT_REF]"
[/code]