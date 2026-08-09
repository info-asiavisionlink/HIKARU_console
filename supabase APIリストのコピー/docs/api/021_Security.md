---
タイトル: Security
URL: https://supabase.com/docs/guides/graphql/security
カテゴリ: api
更新日: 2026-08-02
タグ: api, graphql, security
---

# Security

**URL:** https://supabase.com/docs/guides/graphql/security
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, graphql, security

## 目次

- [Table/Column Visibility#](#tablecolumn-visibility)
- [Row Visibility#](#row-visibility)
- [Introspection#](#introspection)

## 概要

Securing your GraphQL API.

---

`pg_graphql` fully respects builtin PostgreSQL role and row security.

## Table/Column Visibility#

Table and column visibility in the GraphQL schema are controlled by standard PostgreSQL role permissions. Revoking `SELECT` access from the user/role executing queries removes that entity from the visible schema.

For example:
[code] 
    1
    
    revoke all privileges on public."Account" from api_user;
[/code]

removes the `Account` GraphQL type.

Similarly, revoking `SELECT` access on a table's column will remove that field from the associated GraphQL type/s.

The permissions `SELECT`, `INSERT`, `UPDATE`, and `DELETE` all impact the relevant sections of the GraphQL schema.

## Row Visibility#

Visibility of rows in a given table can be configured using PostgreSQL's built-in [row level security](<https://www.postgresql.org/docs/current/ddl-rowsecurity.html>) policies.

## Introspection#

`__schema` and `__type` introspection queries are disabled by default. Listing the full API surface area makes it easier for attackers to enumerate poorly secured projects, so introspection must be opted into per schema:
[code] 
    1
    
    comment on schema public is e'@graphql({"introspection": true})';
[/code]

Enable it during development for tooling like GraphiQL and codegen, then disable it again before exposing the API publicly. Disabling introspection does not restrict actual queries or mutations. Those are governed by PostgreSQL roles and Row Level Security. Read the [Introspection](</docs/guides/graphql/configuration#introspection>) section for details.