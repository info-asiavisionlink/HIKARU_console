---
タイトル: Postgres Extensions Overview
URL: https://supabase.com/docs/guides/database/extensions/pg_partman
カテゴリ: database
更新日: 2026-08-02
タグ: database, extensions, overview, pg_partman, postgres
---

# Postgres Extensions Overview

**URL:** https://supabase.com/docs/guides/database/extensions/pg_partman
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, extensions, overview, pg_partman, postgres

## 目次

- [Enable and disable extensions#](#enable-and-disable-extensions)
- [Upgrade extensions#](#upgrade-extensions)
- [Full list of extensions#](#full-list-of-extensions)

## 概要

Using Postgres extensions.

---

Extensions are exactly as they sound - they "extend" the database with functionality which isn't part of the Postgres core. Supabase has pre-installed some of the most useful open source extensions.

## Enable and disable extensions#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click **Extensions** in the sidebar.
  3. Enable or disable an extension.


Most extensions are installed under the `extensions` schema, which is accessible to `public` by default. To avoid namespace pollution, we do not recommend creating other entities in the `extensions` schema.

If you need to restrict user access to tables managed by extensions, we recommend creating a separate schema for installing that specific extension.

Some extensions can only be created under a specific schema, for example, `postgis_tiger_geocoder` extension creates a schema named `tiger`. Before enabling such extensions, make sure you have not created a conflicting schema with the same name.

In addition to the pre-configured extensions, you can also install your own SQL extensions directly in the database using Supabase's SQL editor. The SQL code for the extensions, including plpgsql extensions, can be added through the SQL editor.

## Upgrade extensions#

If a new version of an extension becomes available on Supabase, you need to initiate a software upgrade in the [Infrastructure Settings](</dashboard/project/_/settings/infrastructure>) to access it. Software upgrades can also be initiated by restarting your server in the [General Settings](</dashboard/project/_/settings/general>).

## Full list of extensions#

Supabase is pre-configured with over 50 extensions and you can install additional extensions through the [database.dev](<https://database.dev/>) package manager.

You can install pure SQL extensions directly in the database using the SQL editor or any Postgres client.

If you would like to request an extension, add (or upvote) it in the [GitHub Discussion](<https://github.com/orgs/supabase/discussions/33754>).