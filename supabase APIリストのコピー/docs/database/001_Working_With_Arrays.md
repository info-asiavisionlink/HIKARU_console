---
タイトル: Working With Arrays
URL: https://supabase.com/docs/guides/database/arrays
カテゴリ: database
更新日: 2026-08-02
タグ: arrays, database, with, working
---

# Working With Arrays

**URL:** https://supabase.com/docs/guides/database/arrays
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** arrays, database, with, working

## 目次

- [Create a table with an array column#](#create-a-table-with-an-array-column)
- [Insert a record with an array value#](#insert-a-record-with-an-array-value)
- [View the results#](#view-the-results)
- [Query array data#](#query-array-data)
- [Resources#](#resources)

## 概要

How to use arrays in Postgres and the Supabase API.

---

Postgres supports flexible [array types](<https://www.postgresql.org/docs/12/arrays.html>). These arrays are also supported in the Supabase Dashboard and in the JavaScript API.

## Create a table with an array column#

Create a test table with a text array (an array of strings):

DashboardSQL

  1. Go to the [Table editor](</dashboard/project/_/editor>) page in the Dashboard.
  2. Click **New Table** and create a table with the name `arraytest`.
  3. Click **Save**.
  4. Click **New Column** and create a column with the name `textarray`, type `text`, and select **Define as array**.
  5. Click **Save**.


## Insert a record with an array value#

DashboardSQLJavaScriptSwiftPython

  1. Go to the [Table editor](</dashboard/project/_/editor>) page in the Dashboard.
  2. Select the `arraytest` table.
  3. Click **Insert row** and add `["Harry", "Larry", "Moe"]`.
  4. Click **Save.**


## View the results#

DashboardSQL

  1. Go to the [Table editor](</dashboard/project/_/editor>) page in the Dashboard.
  2. Select the `arraytest` table.


You should see:
[code]
    1
    
    | id  | textarray               |
    
    2
    
    | --- | ----------------------- |
    
    3
    
    | 1   | ["Harry","Larry","Moe"] |
[/code]

## Query array data#

Postgres uses 1-based indexing (e.g., `textarray[1]` is the first item in the array).

SQLJavaScriptSwift

To select the first item from the array and get the total length of the array:
[code]
    1
    
    SELECT textarray[1], array_length(textarray, 1) FROM arraytest;
[/code]

returns:
[code]
    1
    
    | textarray | array_length |
    
    2
    
    | --------- | ------------ |
    
    3
    
    | Harry     | 3            |
[/code]

## Resources#

  * [Supabase JS Client](<https://github.com/supabase/supabase-js>)
  * [Supabase - Get started for free](<https://supabase.com>)
  * [Postgres Arrays](<https://www.postgresql.org/docs/15/arrays.html>)