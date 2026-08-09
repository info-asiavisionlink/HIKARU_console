---
タイトル: Install
URL: https://supabase.com/docs/guides/cron/install
カテゴリ: cron
更新日: 2026-08-02
タグ: cron, install
---

# Install

**URL:** https://supabase.com/docs/guides/cron/install
**カテゴリ:** cron
**更新日:** 2026-08-02
**タグ:** cron, install

## 目次

- [Uninstall#](#uninstall)

## 概要

Searchdocs...

---

Install the Supabase Cron Postgres Module to begin scheduling recurring Jobs.

DashboardSQL

  1. Go to the [Cron Postgres Module](</dashboard/project/_/integrations/cron/overview>) under Integrations in the Dashboard.
  2. Enable the `pg_cron` extension.


## Uninstall#

Uninstall Supabase Cron by disabling the `pg_cron` extension:
[code] 
    1
    
    drop extension if exists pg_cron;
[/code]

Disabling the `pg_cron` extension will permanently delete all Jobs.