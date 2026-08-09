---
タイトル: Connection management
URL: https://supabase.com/docs/guides/database/connection-management
カテゴリ: database
更新日: 2026-08-02
タグ: connection, connection-management, database, management
---

# Connection management

**URL:** https://supabase.com/docs/guides/database/connection-management
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** connection, connection-management, database, management

## 目次

- [Connections#](#connections)
  - [Configuring Supavisor's pool size#](#configuring-supavisors-pool-size)
- [Monitoring connections#](#monitoring-connections)
  - [Capturing historical usage#](#capturing-historical-usage)
  - [Observing live connections#](#observing-live-connections)

## 概要

Managing connections

---

## Connections#

Every [Compute Add-On](</docs/guides/platform/compute-and-disk>) has a pre-configured direct connection count and Supavisor pool size. This guide discusses ways to observe and manage them resourcefully.

### Configuring Supavisor's pool size#

You can change how many database connections Supavisor can manage by altering the pool size in the "Connection pooling" section of the [Database Settings](</dashboard/project/_/database/settings>):

![Connection Info and Certificate.](/docs/img/database/pool-size.png)

The general rule is that if you are heavily using the PostgREST database API, you should be conscientious about raising your pool size past 40% of the Database Max Connections. Otherwise, you can commit 80% to the pool. This leaves adequate room for the Authentication server and other utilities.

These numbers are generalizations and depends on other Supabase products that you use and the extent of their usage. The actual values depend on your concurrent peak connection usage. For instance, if you were only using 80 connections in a week period and your database max connections is set to 500, then realistically you could allocate the difference of 420 (minus a reasonable buffer) to service more demand.

## Monitoring connections#

### Capturing historical usage#

#### Dashboard monitoring charts#

![Database client connections chart](/docs/_next/image?url=%2Fdocs%2Fimg%2Fdatabase%2Freports%2Fdb-connections-chart-light.png&w=3840&q=75)

For Teams and Enterprise plans, Supabase provides Advanced Telemetry charts directly within the Dashboard. The `Database client connections` chart displays historical connection data broken down by connection type:

  * **Postgres** : Direct connections from your application
  * **PostgREST** : Connections from the PostgREST API layer
  * **Reserved** : Administrative connections for Supabase services
  * **Auth** : Connections from Supabase Auth service
  * **Storage** : Connections from Supabase Storage service
  * **Other roles** : Miscellaneous database connections


This chart helps you monitor connection pool usage, identify connection leaks, and plan capacity. It also shows a reference line for your compute size's maximum connection limit.

For more details on using these monitoring charts, see the [Reports guide](</docs/guides/monitoring-and-debugging/reports#advanced-telemetry>).

#### Grafana Dashboard#

Supabase offers a Grafana Dashboard that records and visualizes over 200 project metrics, including connections. For setup instructions, check the [metrics docs](</docs/guides/monitoring-and-debugging/metrics>).

Its "Client Connections" graph displays connections for both Supavisor and Postgres ![client connection graph](/docs/img/database/grafana-connections.png)

### Observing live connections#

`pg_stat_activity` is a special view that keeps track of processes being run by your database, including live connections. It's particularly useful for determining if idle clients are hogging connection slots.

Query to get all live connections:
[code] 
    1
    
    SELECT
    
    2
    
      pg_stat_activity.pid as connection_id,
    
    3
    
      ssl,
    
    4
    
      datname as database,
    
    5
    
      usename as connected_role,
    
    6
    
      application_name,
    
    7
    
      client_addr as IP,
    
    8
    
      query,
    
    9
    
      query_start,
    
    10
    
      state,
    
    11
    
      backend_start
    
    12
    
    FROM pg_stat_ssl
    
    13
    
    JOIN pg_stat_activity
    
    14
    
    ON pg_stat_ssl.pid = pg_stat_activity.pid;
[/code]

Interpreting the query:

Column| Description  
---|---  
`connection_id`| connection id  
`ssl`| Indicates if SSL is in use  
`database`| Name of the connected database (usually `postgres`)  
`usename`| Role of the connected user  
`application_name`| Name of the connecting application  
`client_addr`| IP address of the connecting server  
`query`| Last query executed by the connection  
`query_start`| Time when the last query was executed  
`state`| Querying state: active or idle  
`backend_start`| Timestamp of the connection's establishment  
  
The username can be used to identify the source:

Role| API/Tool  
---|---  
`supabase_admin`| Used by Supabase for monitoring and by Realtime  
`authenticator`| Data API (PostgREST)  
`supabase_auth_admin`| Auth  
`supabase_storage_admin`| Storage  
`supabase_replication_admin`| Synchronizes Read Replicas  
`postgres`| Supabase Dashboard and External Tools (e.g., Prisma, SQLAlchemy, PSQL...)  
Custom roles defined by user| External Tools (e.g., Prisma, SQLAlchemy, PSQL...)