---
タイトル: Replicate to another Postgres database using Logical Replication
URL: https://supabase.com/docs/guides/database/postgres/setup-replication-external
カテゴリ: database
更新日: 2026-08-02
タグ: another, database, logical, postgres, replicate, replication, setup-replication-external, using
---

# Replicate to another Postgres database using Logical Replication

**URL:** https://supabase.com/docs/guides/database/postgres/setup-replication-external
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** another, database, logical, postgres, replicate, replication, setup-replication-external, using

## 目次

（目次なし）

## 概要

Example to setup logical replication using publish-subscribe to a Postgres database outside of Supabase

---

For this example, you will need:

  * A Supabase project
  * A Postgres database (running v10 or newer)


You will be running commands on both of these databases to publish changes from the Supabase database to the external database.

  1. Create a `publication` on the **Supabase database** :


[code] 
    1
    
    CREATE PUBLICATION example_pub;
[/code]

  2. Also on the **Supabase database** , create a `replication slot`:


[code] 
    1
    
    select pg_create_logical_replication_slot('example_slot', 'pgoutput');
[/code]

  3. Now connect to your **external database** and subscribe to the `publication`


This needs a **direct** connection (not a Connection Pooler) to your database and you can find the connection info in the [**Connect** panel](</dashboard/project/_?showConnect=true>) in the `Direct connection` section.

You will also need to ensure that IPv6 is supported by your replication destination (or you can enable the [IPv4 add-on](</docs/guides/platform/ipv4-address>))

If you would prefer not to use the `postgres` user, then you can run `CREATE ROLE <user> WITH REPLICATION;` using the `postgres` user.
[code] 
    1
    
    CREATE SUBSCRIPTION example_sub
    
    2
    
    CONNECTION 'host=db.oaguxblfdassqxvvwtfe.supabase.co user=postgres password=YOUR_PASS dbname=postgres'
    
    3
    
    PUBLICATION example_pub
    
    4
    
    WITH (copy_data = true, create_slot=false, slot_name=example_slot);
[/code]

For projects running Postgres 17+, it is possible to subscribe to a [Read Replica](</docs/guides/platform/read-replicas>) by using your Read Replica's connection string.

`create_slot` is set to `false` because `slot_name` is provided and the slot was already created in Step 2. To copy data from before the slot was created, set `copy_data` to `true`.

  4. Now we'll go back to the Supabase DB and add all the tables that you want replicated to the publication.


[code] 
    1
    
    ALTER PUBLICATION example_pub ADD TABLE example_table;
[/code]

  5. Check the replication status using `pg_stat_replication`


[code] 
    1
    
    select * from pg_stat_replication;
[/code]

You can add more tables to the initial publication, but you're going to need to do a REFRESH on the subscribing database. See <https://www.postgresql.org/docs/current/sql-alterpublication.html>[](<https://www.postgresql.org/docs/current/sql-alterpublication.html>)