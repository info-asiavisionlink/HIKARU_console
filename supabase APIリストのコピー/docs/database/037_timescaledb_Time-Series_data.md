---
タイトル: timescaledb: Time-Series data
URL: https://supabase.com/docs/guides/database/extensions/timescaledb
カテゴリ: database
更新日: 2026-08-02
タグ: data, database, extensions, series, time, timescaledb
---

# timescaledb: Time-Series data

**URL:** https://supabase.com/docs/guides/database/extensions/timescaledb
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** data, database, extensions, series, time, timescaledb

## 目次

- [Enable the extension#](#enable-the-extension)
- [Usage#](#usage)
- [Resources#](#resources)

## 概要

Scalable time-series data storage and analysis

---

The `timescaledb` extension is deprecated in projects using Postgres 17. It continues to be supported in projects using Postgres 15, but will need to dropped before those projects are upgraded to Postgres 17. See the [Upgrading to Postgres 17 notes](</docs/guides/platform/upgrading#upgrading-to-postgres-17>) for more information.

If you are using hypertables, follow the [migration guide](</docs/guides/database/migrating-to-pg-partman>) to convert to native partitioning managed by `pg_partman`.

For additional support, contact our Success team by creating a support ticket in the Supabase Dashboard.

[`timescaledb`](<https://docs.timescale.com/timescaledb/latest/>) is a Postgres extension designed for improved handling of time-series data. It provides a scalable, high-performance solution for storing and querying time-series data on top of a standard Postgres database.

`timescaledb` uses a time-series-aware storage model and indexing techniques to improve performance of Postgres in working with time-series data. The extension divides data into chunks based on time intervals, allowing it to scale efficiently, especially for large data sets. The data is then compressed, optimized for write-heavy workloads, and partitioned for parallel processing. `timescaledb` also includes a set of functions, operators, and indexes that work with time-series data to reduce query times, and make data easier to work with.

Supabase projects come with [TimescaleDB Apache 2 Edition](<https://docs.timescale.com/about/latest/timescaledb-editions/#timescaledb-apache-2-edition>). Functionality only available under the Community Edition is not available.

## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `timescaledb` and enable the extension.


Even though the SQL code is `create extension`, this is the equivalent of "enabling the extension". To disable an extension you can call `drop extension`.

It's good practice to create the extension within a separate schema (like `extensions`) to keep your `public` schema clean.

## Usage#

To demonstrate how `timescaledb` works, consider an example where we have a table that stores temperature data from different sensors. Create a table named "temperatures" and store data for two sensors.

First we create a hypertable, which is a virtual table that is partitioned into chunks based on time intervals. The hypertable acts as a proxy for the actual table and makes it easy to query and manage time-series data.
[code] 
    1
    
    create table temperatures (
    
    2
    
      time timestamptz not null,
    
    3
    
      sensor_id int not null,
    
    4
    
      temperature double precision not null
    
    5
    
    );
    
    6
    
    7
    
    select create_hypertable('temperatures', 'time');
[/code]

Next, we can populate some values
[code] 
    1
    
    insert into temperatures (time, sensor_id, temperature)
    
    2
    
    values
    
    3
    
        ('2023-02-14 09:00:00', 1, 23.5),
    
    4
    
        ('2023-02-14 09:00:00', 2, 21.2),
    
    5
    
        ('2023-02-14 09:05:00', 1, 24.5),
    
    6
    
        ('2023-02-14 09:05:00', 2, 22.3),
    
    7
    
        ('2023-02-14 09:10:00', 1, 25.1),
    
    8
    
        ('2023-02-14 09:10:00', 2, 23.9),
    
    9
    
        ('2023-02-14 09:15:00', 1, 24.9),
    
    10
    
        ('2023-02-14 09:15:00', 2, 22.7),
    
    11
    
        ('2023-02-14 09:20:00', 1, 24.7),
    
    12
    
        ('2023-02-14 09:20:00', 2, 23.5);
[/code]

And finally we can query the table using `timescaledb`'s `time_bucket` function to divide the time-series into intervals of the specified size (in this case, 1 hour) averaging the `temperature` reading within each group.
[code] 
    1
    
    select
    
    2
    
        time_bucket('1 hour', time) AS hour,
    
    3
    
        avg(temperature) AS average_temperature
    
    4
    
    from
    
    5
    
        temperatures
    
    6
    
    where
    
    7
    
        sensor_id = 1
    
    8
    
        and time > NOW() - interval '1 hour'
    
    9
    
    group by
    
    10
    
        hour;
[/code]

## Resources#

  * Official [`timescaledb` documentation](<https://docs.timescale.com/timescaledb/latest/>)