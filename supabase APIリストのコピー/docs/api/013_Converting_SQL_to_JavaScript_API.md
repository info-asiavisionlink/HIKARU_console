---
タイトル: Converting SQL to JavaScript API
URL: https://supabase.com/docs/guides/api/sql-to-api
カテゴリ: api
更新日: 2026-08-02
タグ: api, converting, javascript, sql, sql-to-api
---

# Converting SQL to JavaScript API

**URL:** https://supabase.com/docs/guides/api/sql-to-api
**カテゴリ:** api
**更新日:** 2026-08-02
**タグ:** api, converting, javascript, sql, sql-to-api

## 目次

- [Select statement with basic clauses#](#select-statement-with-basic-clauses)
- [Select statement with complex Boolean logic clause#](#select-statement-with-complex-boolean-logic-clause)
- [Resources#](#resources)

## 概要

Implementing common SQL patterns in the JavaScript API

---

Many common SQL queries can be written using the JavaScript API, provided by the SDK to wrap Data API calls. Below are a few examples of conversions between SQL and JavaScript patterns.

## Select statement with basic clauses#

Select a set of columns from a single table with where, order by, and limit clauses.
[code] 
    1
    
    select first_name, last_name, team_id, age
    
    2
    
    from players
    
    3
    
    where age between 20 and 24 and team_id != 'STL'
    
    4
    
    order by last_name, first_name desc
    
    5
    
    limit 20;
[/code]
[code] 
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('players')
    
    3
    
      .select('first_name,last_name,team_id,age')
    
    4
    
      .gte('age', 20)
    
    5
    
      .lte('age', 24)
    
    6
    
      .not('team_id', 'eq', 'STL')
    
    7
    
      .order('last_name', { ascending: true }) // or just .order('last_name')
    
    8
    
      .order('first_name', { ascending: false })
    
    9
    
      .limit(20)
[/code]

## Select statement with complex Boolean logic clause#

Select all columns from a single table with a complex where clause: OR AND OR
[code] 
    1
    
    select *
    
    2
    
    from players
    
    3
    
    where ((team_id = 'CHN' or team_id is null) and (age > 35 or age is null));
[/code]
[code] 
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('players')
    
    3
    
      .select() // or .select('*')
    
    4
    
      .or('team_id.eq.CHN,team_id.is.null')
    
    5
    
      .or('age.gt.35,age.is.null') // additional filters imply "AND"
[/code]

Select all columns from a single table with a complex where clause: AND OR AND
[code] 
    1
    
    select *
    
    2
    
    from players
    
    3
    
    where ((team_id = 'CHN' and age > 35) or (team_id != 'CHN' and age is not null));
[/code]
[code] 
    1
    
    const { data, error } = await supabase
    
    2
    
      .from('players')
    
    3
    
      .select() // or .select('*')
    
    4
    
      .or('and(team_id.eq.CHN,age.gt.35),and(team_id.neq.CHN,.not.age.is.null)')
[/code]

## Resources#

  * [Supabase - Get started for free](<https://supabase.com>)
  * [PostgREST Operators](<https://postgrest.org/en/stable/api.html#operators>)
  * [Supabase API: JavaScript select](</docs/reference/javascript/select>)
  * [Supabase API: JavaScript modifiers](</docs/reference/javascript/using-modifiers>)
  * [Supabase API: JavaScript filters](</docs/reference/javascript/using-filters>)