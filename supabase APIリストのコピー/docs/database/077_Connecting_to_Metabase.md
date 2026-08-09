---
タイトル: Connecting to Metabase
URL: https://supabase.com/docs/guides/database/metabase
カテゴリ: database
更新日: 2026-08-02
タグ: connecting, database, metabase
---

# Connecting to Metabase

**URL:** https://supabase.com/docs/guides/database/metabase
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** connecting, database, metabase

## 目次

（目次なし）

## 概要

Searchdocs...

---

[`Metabase`](<https://www.metabase.com/>) is an Open Source data visualization tool. You can use it to explore your data stored in Supabase.

1

Register

Create a [Metabase account](<https://store.metabase.com/checkout>) or deploy locally with [Docker](<https://www.docker.com/products/docker-desktop/>)

Deploying with Docker:
[code]
    1
    
    docker pull metabase/metabase:latest
[/code]

Then run:
[code]
    1
    
    docker run -d -p 3000:3000 --name metabase metabase/metabase
[/code]

The server should be available at [`http://localhost:3000/setup`](<http://localhost:3000/setup>)

2

Connect to Postgres

Connect your Postgres server to Metabase.

  * On your project dashboard, click [Connect](</dashboard/project/_?showConnect=true>)
  * View parameters under "Session pooler"


connection notice

If you're in an [IPv6 environment](</docs/guides/platform/ipv4-address#checking-your-network-ipv6-support>) or have the [IPv4 Add-On](</docs/guides/platform/ipv4-address#understanding-ip-addresses>), you can use the direct connection string instead of Supavisor in Session mode.

  * Enter your database credentials into Metabase


Example credentials: ![Name Postgres Server.](/docs/img/guides/database/connecting-to-postgres/metabase/add-pg-server.png)

3

Explore

Explore your data in Metabase

![explore data](/docs/img/guides/database/connecting-to-postgres/metabase/explore.png)