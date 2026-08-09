---
タイトル: Cascade Deletes
URL: https://supabase.com/docs/guides/database/postgres/cascade-deletes
カテゴリ: database
更新日: 2026-08-02
タグ: cascade, cascade-deletes, database, deletes, postgres
---

# Cascade Deletes

**URL:** https://supabase.com/docs/guides/database/postgres/cascade-deletes
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** cascade, cascade-deletes, database, deletes, postgres

## 目次

- [RESTRICTvsNO ACTION#](#restrict-vs-no-action)
- [Example#](#example)
  - [RESTRICT#](#restrict)
  - [NO ACTION#](#no-action)
  - [NO ACTION INITIALLY DEFERRED#](#no-action-initially-deferred)

## 概要

Understand the types of foreign key constraint deletes

---

There are 5 options for foreign key constraint deletes:

  1. **CASCADE:** When a row is deleted from the parent table, all related rows in the child tables are deleted as well.
  2. **RESTRICT:** When a row is deleted from the parent table, the delete operation is aborted if there are any related rows in the child tables.
  3. **SET NULL:** When a row is deleted from the parent table, the values of the foreign key columns in the child tables are set to NULL.
  4. **SET DEFAULT:** When a row is deleted from the parent table, the values of the foreign key columns in the child tables are set to their default values.
  5. **NO ACTION:** This option is similar to RESTRICT, but it also has the option to be “deferred” to the end of a transaction. This means that other cascading deletes can run first, and then this delete constraint will only throw an error if there is referenced data remaining _at the end of the transaction_.


These options can be specified when defining a foreign key constraint using the "ON DELETE" clause. For example, the following SQL statement creates a foreign key constraint with the `CASCADE` option:
[code] 
    1
    
    alter table child_table
    
    2
    
    add constraint fk_parent foreign key (parent_id) references parent_table (id)
    
    3
    
      on delete cascade;
[/code]

This means that when a row is deleted from the `parent_table`, all related rows in the `child_table` will be deleted as well.

## `RESTRICT` vs `NO ACTION`#

The difference between `NO ACTION` and `RESTRICT` is subtle and can be a bit confusing.

Both `NO ACTION` and `RESTRICT` are used to prevent deletion of a row in a parent table if there are related rows in a child table. However, there is a subtle difference in how they behave.

When a foreign key constraint is defined with the option `RESTRICT`, it means that if a row in the parent table is deleted, the database will immediately raise an error and prevent the deletion of the row in the parent table. The database will not delete, update or set to NULL any rows in the referenced tables.

When a foreign key constraint is defined with the option `NO ACTION`, it means that if a row in the parent table is deleted, the database will also raise an error and prevent the deletion of the row in the parent table. However unlike `RESTRICT`, `NO ACTION` has the option to defer the check using `INITIALLY DEFERRED`. This will only raise the above error _if_ the referenced rows still exist at the end of the transaction.

The difference from `RESTRICT` is that a constraint marked as `NO ACTION INITIALLY DEFERRED` is deferred until the end of the transaction, rather than running immediately. If, for example there is another foreign key constraint between the same tables marked as `CASCADE`, the cascade will occur first and delete the referenced rows, and no error will be thrown by the deferred constraint. Otherwise if there are still rows referencing the parent row by the end of the transaction, an error will be raised as before. Like `RESTRICT`, the database will not delete, update or set to NULL any rows in the referenced tables.

In practice, you can use either `NO ACTION` or `RESTRICT` depending on your needs. `NO ACTION` is the default behavior if you do not specify anything. If you prefer to defer the check until the end of the transaction, use `NO ACTION INITIALLY DEFERRED`.

## Example#

To illustrate the difference, use the following example. We'll use the following data:

`grandparent`

id| name  
---|---  
1| Elizabeth  
  
`parent`

id| name| `parent_id`  
---|---|---  
1| Charles| 1  
2| Diana| 1  
  
`child`

id| name| father| mother  
---|---|---|---  
1| William| 1| 2  
  
To create these tables and their data, we run:
[code] 
    1
    
    create table grandparent (
    
    2
    
      id serial primary key,
    
    3
    
      name text
    
    4
    
    );
    
    5
    
    6
    
    create table parent (
    
    7
    
      id serial primary key,
    
    8
    
      name text,
    
    9
    
      parent_id integer references grandparent (id)
    
    10
    
        on delete cascade
    
    11
    
    );
    
    12
    
    13
    
    create table child (
    
    14
    
      id serial primary key,
    
    15
    
      name text,
    
    16
    
      father integer references parent (id)
    
    17
    
        on delete restrict
    
    18
    
    );
    
    19
    
    20
    
    insert into grandparent
    
    21
    
      (id, name)
    
    22
    
    values
    
    23
    
      (1, 'Elizabeth');
    
    24
    
    25
    
    insert into parent
    
    26
    
      (id, name, parent_id)
    
    27
    
    values
    
    28
    
      (1, 'Charles', 1);
    
    29
    
    30
    
    insert into parent
    
    31
    
      (id, name, parent_id)
    
    32
    
    values
    
    33
    
      (2, 'Diana', 1);
    
    34
    
    35
    
    -- We'll just link the father for now
    
    36
    
    insert into child
    
    37
    
      (id, name, father)
    
    38
    
    values
    
    39
    
      (1, 'William', 1);
[/code]

### `RESTRICT`#

`RESTRICT` will prevent a delete and raise an error:
[code] 
    1
    
    postgres=# delete from grandparent;
    
    2
    
    ERROR: update or delete on table "parent" violates foreign key constraint "child_father_fkey" on table "child"
    
    3
    
    DETAIL: Key (id)=(1) is still referenced from table "child".
[/code]

Even though the foreign key constraint between parent and grandparent is `CASCADE`, the constraint between child and father is `RESTRICT`. Therefore an error is raised and no records are deleted.

### `NO ACTION`#

Change the child-father relationship to `NO ACTION`:
[code] 
    1
    
    alter table child
    
    2
    
    drop constraint child_father_fkey;
    
    3
    
    4
    
    alter table child
    
    5
    
    add constraint child_father_fkey foreign key (father) references parent (id)
    
    6
    
      on delete no action;
[/code]

We see that `NO ACTION` will also prevent a delete and raise an error:
[code] 
    1
    
    postgres=# delete from grandparent;
    
    2
    
    ERROR: update or delete on table "parent" violates foreign key constraint "child_father_fkey" on table "child"
    
    3
    
    DETAIL: Key (id)=(1) is still referenced from table "child".
[/code]

### `NO ACTION INITIALLY DEFERRED`#

We'll change the foreign key constraint between child and father to be `NO ACTION INITIALLY DEFERRED`:
[code] 
    1
    
    alter table child
    
    2
    
    drop constraint child_father_fkey;
    
    3
    
    4
    
    alter table child
    
    5
    
    add constraint child_father_fkey foreign key (father) references parent (id)
    
    6
    
      on delete no action initially deferred;
[/code]

Here you will see that `INITIALLY DEFFERED` seems to operate like `NO ACTION` or `RESTRICT`. When we run a delete, it seems to make no difference:
[code] 
    1
    
    postgres=# delete from grandparent;
    
    2
    
    ERROR: update or delete on table "parent" violates foreign key constraint "child_father_fkey" on table "child"
    
    3
    
    DETAIL: Key (id)=(1) is still referenced from table "child".
[/code]

But, when we combine it with _other_ constraints, then any other constraints take precedence. For example, run the same scenario but add a `mother` column that has a `CASCADE` delete:
[code] 
    1
    
    alter table child
    
    2
    
    add column mother integer references parent (id)
    
    3
    
      on delete cascade;
    
    4
    
    5
    
    update child
    
    6
    
    set mother = 2
    
    7
    
    where id = 1;
[/code]

Then run a delete on the `grandparent` table:
[code] 
    1
    
    postgres=# delete from grandparent;
    
    2
    
    DELETE 1
    
    3
    
    4
    
    postgres=# select * from parent;
    
    5
    
     id | name | parent_id
    
    6
    
    ----+------+-----------
    
    7
    
    (0 rows)
    
    8
    
    9
    
    postgres=# select * from child;
    
    10
    
     id | name | father | mother
    
    11
    
    ----+------+--------+--------
    
    12
    
    (0 rows)
[/code]

The `mother` deletion took precedence over the `father`, and so William was deleted. After William was deleted, there was no reference to “Charles” and so he was free to be deleted, even though previously he wasn't (without `INITIALLY DEFERRED`).