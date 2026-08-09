---
タイトル: Database
URL: https://supabase.com/docs/guides/database/overview
カテゴリ: database
更新日: 2026-08-02
タグ: database, overview
---

# Database

**URL:** https://supabase.com/docs/guides/database/overview
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, overview

## 目次

- [Get started#](#get-started)
- [Next steps#](#next-steps)

## 概要

Use Supabase to connect, manage, and secure your Postgres database.

---

Every Supabase project gets a full [Postgres](<https://www.postgresql.org/>) database, not a Postgres abstraction. This database is the foundation that Auth, Storage, Realtime, and Edge Functions are built on, and Supabase manages daily database backups and offers point-in-time recovery on paid plans.

Work with your project's database in the following ways:

  * Visually using the [**Table Editor**](</dashboard/project/_/editor>) section of the Dashboard.
  * With query syntax using the [**SQL Editor**](</dashboard/project/_/sql>) section of the Dashboard.
  * Programmatically using a variety of different methods.


## Get started#

If you're new to the database section, these are the pages to read first:

  * [Connect to your databaseConnection strings, the Supavisor connection pooler, and when to use direct, transaction, or session mode.](</docs/guides/database/connecting-to-postgres>)
  * [Tables and dataCreate tables and relationships, and edit rows from the Dashboard.](</docs/guides/database/tables>)
  * [Import dataLoad existing data from CSV files, `pg_dump`, or another Postgres database.](</docs/guides/database/import-data>)
  * [Secure your dataRow Level Security (RLS) is how Supabase makes the database safe to query directly from the client. Read this before exposing any table to your app.](</docs/guides/database/secure-data>)
  * [ExtensionsAdd Postgres extensions from the Dashboard, including `pgvector` for embeddings, `PostGIS` for geospatial data, and `pg_cron` for scheduled jobs.](</docs/guides/database/extensions>)
  * [Run SQL commandsUse the Dashboard's SQL Editor for ad-hoc queries and saved snippets.](<https://supabase.com/dashboard/project/_/sql>)


## Next steps#

Once you've covered the basics, these guides help with other use cases and features:

  * [Database functionsRun logic inside the database in response to inserts, updates, or deletes.](</docs/guides/database/functions>)
  * [TriggersRun logic inside the database in response to inserts, updates, or deletes.](</docs/guides/database/postgres/triggers>)
  * [Database webhooksSend row changes to an external HTTP endpoint.](</docs/guides/database/webhooks>)
  * [Replication and read replicasStream changes to other systems or read from a geographically closer replica.](</docs/guides/database/replication>)
  * [BackupsDaily backups on every project, with point-in-time recovery on paid plans. Backups cover the database itself; objects stored through the Storage API are not included.](</docs/guides/platform/backups>)
  * [Query performance and optimizationIndexes, the query planner, and tools for finding slow queries.](</docs/guides/database/query-optimization>)
  * [Roles and permissionsThe Postgres roles Supabase ships with and how to add your own.](</docs/guides/database/postgres/roles>)