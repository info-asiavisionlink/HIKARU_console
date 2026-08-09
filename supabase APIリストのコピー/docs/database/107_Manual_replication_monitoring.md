---
タイトル: Manual replication monitoring
URL: https://supabase.com/docs/guides/database/replication/manual-replication-monitoring
カテゴリ: database
更新日: 2026-08-02
タグ: database, manual, manual-replication-monitoring, monitoring, replication
---

# Manual replication monitoring

**URL:** https://supabase.com/docs/guides/database/replication/manual-replication-monitoring
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, manual, manual-replication-monitoring, monitoring, replication

## 目次

- [Primary#](#primary)
  - [Replication status and lag#](#replication-status-and-lag)
  - [Replication slot status#](#replication-slot-status)
  - [WAL size#](#wal-size)
  - [Check the LSN#](#check-the-lsn)
- [Subscriber#](#subscriber)
  - [Subscription status#](#subscription-status)
  - [Check the LSN#](#check-the-lsn)

## 概要

Monitor replication lag and status for manual replication setups.

---

Monitoring replication lag is important and there are 3 ways to do this:

  1. Dashboard - In [Reports](</docs/guides/monitoring-and-debugging/reports>), you can view the replication lag of your project
  2. Database -
     * pg_stat_subscription (subscriber) - if PID is null, then the subscription is not active
     * pg_stat_subscription_stats - look here for error_count to see if there were issues applying or syncing (if yes, check the logs for why)
     * pg_replication_slots - use this to check if the slot is active and you can also calculate the lag from here
  3. [Metrics](</docs/guides/monitoring-and-debugging/metrics>) \- Using the prometheus endpoint for your project
     * replication_slots_max_lag_bytes - this is the more important one
     * pg_stat_replication_replay_lag - lag to replay WAL files from the source DB on the target DB (throttled by disk or high activity)
     * pg_stat_replication_send_lag - lag in sending WAL files from the source DB (a high lag means that the publisher is not being asked to send new WAL files OR network issues)


## Primary#

### Replication status and lag#

The `pg_stat_replication` table shows the status of any replicas connected to the primary database.
[code] 
    1
    
    select pid, application_name, state, sent_lsn, write_lsn, flush_lsn, replay_lsn, sync_state
    
    2
    
    from pg_stat_replication;
[/code]

### Replication slot status#

A replication slot can be in one of three states:

  * `active` \- The slot is active and is receiving data
  * `inactive` \- The slot is not active and is not receiving data
  * `lost` \- The slot is lost and is not receiving data


The state can be checked using the `pg_replication_slots` table:
[code] 
    1
    
    select slot_name, active, state from pg_replication_slots;
[/code]

### WAL size#

The WAL size can be checked using the `pg_ls_waldir()` function:
[code] 
    1
    
    select * from pg_ls_waldir();
[/code]

### Check the LSN#
[code] 
    1
    
    select pg_current_wal_lsn();
[/code]

## Subscriber#

### Subscription status#

The `pg_subscription` table shows the status of any subscriptions on a replica and the `pg_subscription_rel` table shows the status of each table within a subscription.

The `srsubstate` column in `pg_subscription_rel` can be one of the following:

  * `i` \- Initializing - The subscription is being initialized
  * `d` \- Data Synchronizing - The subscription is synchronizing data for the first time (i.e. doing the initial copy)
  * `s` \- Synchronized - The subscription is synchronized
  * `r` \- Replicating - The subscription is replicating data


[code] 
    1
    
    SELECT
    
    2
    
        sub.subname AS subscription_name,
    
    3
    
        relid::regclass AS table_name,
    
    4
    
        srel.srsubstate AS replication_state,
    
    5
    
        CASE srel.srsubstate
    
    6
    
            WHEN 'i' THEN 'Initializing'
    
    7
    
            WHEN 'd' THEN 'Data Synchronizing'
    
    8
    
            WHEN 's' THEN 'Synchronized'
    
    9
    
            WHEN 'r' THEN 'Replicating'
    
    10
    
            ELSE 'Unknown'
    
    11
    
        END AS state_description,
    
    12
    
        srel.srsyncedlsn AS last_synced_lsn
    
    13
    
    FROM
    
    14
    
        pg_subscription sub
    
    15
    
    JOIN
    
    16
    
        pg_subscription_rel srel ON sub.oid = srel.srsubid
    
    17
    
    ORDER BY
    
    18
    
        table_name;
[/code]

### Check the LSN#
[code] 
    1
    
    select pg_last_wal_replay_lsn();
[/code]