---
タイトル: Roles, superuser access and unsupported operations
URL: https://supabase.com/docs/guides/database/postgres/roles-superuser
カテゴリ: database
更新日: 2026-08-02
タグ: access, database, operations, postgres, roles, roles-superuser, superuser, unsupported
---

# Roles, superuser access and unsupported operations

**URL:** https://supabase.com/docs/guides/database/postgres/roles-superuser
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** access, database, operations, postgres, roles, roles-superuser, superuser, unsupported

## 目次

- [Unsupported operations#](#unsupported-operations)

## 概要

Searchdocs...

---

Supabase provides the default `postgres` role to all instances deployed. Superuser access is not given as it allows destructive operations to be performed on the database.

To ensure you are not impacted by this, additional privileges are granted to the `postgres` user to allow it to run some operations that are normally restricted to superusers.

However, this does mean that some operations, that typically require `superuser` privileges, are not available on Supabase. These are documented below:

## Unsupported operations#

  * `COPY ... FROM PROGRAM`
  * `ALTER USER ... WITH SUPERUSER`