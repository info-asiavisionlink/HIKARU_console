---
タイトル: Restoring a downloaded backup locally
URL: https://supabase.com/docs/guides/local-development/restoring-downloaded-backup
カテゴリ: cli
更新日: 2026-08-02
タグ: backup, cli, downloaded, local-development, locally, rest, restoring, restoring-downloaded-backup
---

# Restoring a downloaded backup locally

**URL:** https://supabase.com/docs/guides/local-development/restoring-downloaded-backup
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** backup, cli, downloaded, local-development, locally, rest, restoring, restoring-downloaded-backup

## 目次

- [Downloading your backup#](#downloading-your-backup)
- [Restoring your backup#](#restoring-your-backup)

## 概要

Restore a backup of a remote database on a local instance to inspect and extract data

---

If your paused project has exceeded its [restoring time limit](</docs/guides/platform/upgrading#time-limits>), you can download a backup from the dashboard and restore it to your local development environment. This might be useful for inspecting and extracting data from your paused project.

If you want to restore your backup to a hosted Supabase project, follow the [Migrating within Supabase guide](</docs/guides/platform/migrating-within-supabase>) instead.

## Downloading your backup#

First, download your project's backup file from dashboard and identify its backup image version (following the `PG:` prefix):

![Project Paused: 90 Days Remaining](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Fpaused-dl-image-version.png&w=1920&q=75)

## Restoring your backup#

Given Postgres version `15.6.1.115`, start Postgres locally with `db_cluster.backup` being the path to your backup file.
[code] 
    1
    
    supabase init
    
    2
    
    echo '15.6.1.115' > supabase/.temp/postgres-version
    
    3
    
    supabase db start --from-backup db_cluster.backup
[/code]

Note that the earliest Supabase Postgres version that supports a local restore is `15.1.0.55`. If your hosted project was running on earlier versions, you will likely run into errors during restore. Before submitting any support ticket, make sure you have attached the error logs from `supabase_db_*` docker container.

Once your local database starts up successfully, you can connect using psql to verify that all your data is restored.
[code] 
    1
    
    psql 'postgresql://postgres:postgres@localhost:54322/postgres'
[/code]

If you want to use other services like Auth, Storage, and Studio dashboard together with your restored database, restart the local development stack.
[code] 
    1
    
    supabase stop
    
    2
    
    supabase start
[/code]

A Postgres database started with Supabase CLI is not production ready and should not be used outside of local development.