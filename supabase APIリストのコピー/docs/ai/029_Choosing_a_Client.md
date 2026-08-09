---
タイトル: Choosing a Client
URL: https://supabase.com/docs/guides/ai/python-clients
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, choosing, cli, client, python, python-clients
---

# Choosing a Client

**URL:** https://supabase.com/docs/guides/ai/python-clients
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, choosing, cli, client, python, python-clients

## 目次

（目次なし）

## 概要

Learn how to manage vectors using Python

---

As described in [Structured & Unstructured Embeddings](</docs/guides/ai/structured-unstructured>), AI workloads come in many forms.

For data science or ephemeral workloads, the [Supabase Vecs](<https://supabase.github.io/vecs/>) client gets you started. You need a connection string and vecs handles setting up your database to store and query vectors with associated metadata.

Click [**Connect**](</dashboard/project/_/?showConnect=true>) at the top of any project page to get your connection string.

Copy the URI from the **Shared pooler** option.

For production python applications with version controlled migrations, we recommend adding first class vector support to your toolchain by [registering the vector type with your ORM](<https://github.com/pgvector/pgvector-python>). pgvector provides bindings for the most commonly used SQL drivers/libraries including Django, SQLAlchemy, SQLModel, psycopg, asyncpg and Peewee.