---
タイトル: Set up manual replication
URL: https://supabase.com/docs/guides/database/replication/manual-replication-setup
カテゴリ: database
更新日: 2026-08-02
タグ: database, manual, manual-replication-setup, replication
---

# Set up manual replication

**URL:** https://supabase.com/docs/guides/database/replication/manual-replication-setup
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, manual, manual-replication-setup, replication

## 目次

- [Prerequisites#](#prerequisites)

## 概要

Configure your own replication using external tools and Postgres logical replication.

---

This guide covers setting up **manual logical replication** using your own tools. If you prefer a managed solution, read [Set up Pipelines](</docs/guides/database/replication/pipelines>) instead.

This guide is for replicating data to destination systems using your own tools. For deploying read-only databases across multiple regions, see [read replicas](</docs/guides/platform/read-replicas>) instead.

## Prerequisites#

To set up replication, the following is recommended:

  * Instance size of XL or greater
  * [IPv4 add-on](</docs/guides/platform/ipv4-address>) enabled


To create a replication slot, you will need to use the `postgres` user and follow the instructions in the [logical replication example](</docs/guides/database/postgres/setup-replication-external>).

If you are running Postgres 17 or higher, you can create a new user and grant them replication permissions with the `postgres` user. For versions below 17, you will need to use the `postgres` user.

If you are replicating to a destination system and using any of the tools below, check their documentation first. Additional information is provided where the setup with Supabase can vary.

AirbyteEstuaryFivetranMaterializeStitchAWS DMS

Estuary has the following [documentation](<https://docs.estuary.dev/reference/Connectors/capture-connectors/PostgreSQL/Supabase/>) for setting up Postgres as a source.