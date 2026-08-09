---
タイトル: Select first row for each group in Postgres
URL: https://supabase.com/docs/guides/database/postgres/first-row-in-group
カテゴリ: database
更新日: 2026-08-02
タグ: database, each, first, first-row-in-group, group, postgres, select
---

# Select first row for each group in Postgres

**URL:** https://supabase.com/docs/guides/database/postgres/first-row-in-group
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** database, each, first, first-row-in-group, group, postgres, select

## 目次

（目次なし）

## 概要

Postgres snippet for grabbing the first row in each distinct group by group

---

Given a table `seasons`:

id| team| points  
---|---|---  
1| Liverpool| 82  
2| Liverpool| 84  
3| Brighton| 34  
4| Brighton| 28  
5| Liverpool| 79  
  
We want to find the rows containing the maximum number of points _per team_.

The expected output we want is:

id| team| points  
---|---|---  
3| Brighton| 34  
2| Liverpool| 84  
  
From the [SQL Editor](</dashboard/project/_/sql>), you can run a query like:
[code] 
    1
    
    select distinct
    
    2
    
      on (team) id,
    
    3
    
      team,
    
    4
    
      points
    
    5
    
    from
    
    6
    
      seasons
    
    7
    
    order by
    
    8
    
      team,
    
    9
    
      points desc;
[/code]

The important bits here are:

  * The `desc` keyword to order the `points` from highest to lowest.
  * The `distinct` keyword that tells Postgres to only return a single row per team.


This query can also be executed via `psql` or any other query editor if you prefer to [connect directly to the database](</docs/guides/database/connecting-to-postgres#direct-connections>).