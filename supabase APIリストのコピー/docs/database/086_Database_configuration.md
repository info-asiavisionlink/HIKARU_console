---
タイトル: Database configuration
URL: https://supabase.com/docs/guides/database/postgres/configuration
カテゴリ: database
更新日: 2026-08-02
タグ: configuration, database, postgres
---

# Database configuration

**URL:** https://supabase.com/docs/guides/database/postgres/configuration
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** configuration, database, postgres

## 目次

- [Timeouts#](#timeouts)
- [Statement optimization#](#statement-optimization)
- [Managing timezones#](#managing-timezones)
  - [Change timezone#](#change-timezone)
  - [Full list of timezones#](#full-list-of-timezones)
  - [Search for a specific timezone#](#search-for-a-specific-timezone)

## 概要

Updating the default configuration for your Postgres database.

---

Postgres provides a set of sensible defaults for you database size. In some cases, these defaults can be updated. We do not recommend changing these defaults unless you know what you're doing.

## Timeouts#

See the [Timeouts](</docs/guides/database/postgres/timeouts>) section.

## Statement optimization#

All Supabase projects come with the [`pg_stat_statements`](<https://www.postgresql.org/docs/current/pgstatstatements.html>) extension installed, which tracks planning and execution statistics for all statements executed against it. These statistics can be used in order to diagnose the performance of your project.

This data can further be used in conjunction with the [`explain`](<https://www.postgresql.org/docs/current/using-explain.html>) functionality of Postgres to optimize your usage.

## Managing timezones#

Every Supabase database is set to UTC timezone by default. We strongly recommend keeping it this way, even if your users are in a different location. This is because it makes it much easier to calculate differences between timezones if you adopt the mental model that everything in your database is in UTC time.

### Change timezone#

SQL
[code]
    1
    
    alter database postgres
    
    2
    
    set timezone to 'America/New_York';
[/code]

### Full list of timezones#

Get a full list of timezones supported by your database. This will return the following columns:

  * `name`: Time zone name
  * `abbrev`: Time zone abbreviation
  * `utc_offset`: Offset from UTC (positive means east of Greenwich)
  * `is_dst`: True if currently observing daylight savings


SQL
[code]
    1
    
    select name, abbrev, utc_offset, is_dst
    
    2
    
    from pg_timezone_names()
    
    3
    
    order by name;
[/code]

### Search for a specific timezone#

Use `ilike` (case insensitive search) to find specific timezones.

SQL
[code]
    1
    
    select *
    
    2
    
    from pg_timezone_names()
    
    3
    
    where name ilike '%york%';
[/code]