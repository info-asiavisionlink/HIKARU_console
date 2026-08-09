---
タイトル: PGAudit: Postgres Auditing
URL: https://supabase.com/docs/guides/database/extensions/pgaudit
カテゴリ: database
更新日: 2026-08-02
タグ: auditing, database, extensions, pgaudit, postgres
---

# PGAudit: Postgres Auditing

**URL:** https://supabase.com/docs/guides/database/extensions/pgaudit
**カテゴリ:** database
**更新日:** 2026-08-02
**タグ:** auditing, database, extensions, pgaudit, postgres

## 目次

- [Enable the extension#](#enable-the-extension)
- [Configure the extension#](#configure-the-extension)
  - [Session mode categories#](#session-mode-categories)
  - [Session logging#](#session-logging)
  - [User logging#](#user-logging)
  - [Global logging#](#global-logging)
  - [Object logging#](#object-logging)
- [Interpreting Audit Logs#](#interpreting-audit-logs)
- [Finding and filtering audit logs#](#finding-and-filtering-audit-logs)
- [Practical examples#](#practical-examples)
  - [Monitoring API events#](#monitoring-api-events)
  - [Monitoring theauth.userstable#](#monitoring-the-authusers-table)
- [Best practices#](#best-practices)
  - [Disabling excess logging#](#disabling-excess-logging)
- [FAQ#](#faq)
  - [Using PGAudit to debug database functions#](#using-pgaudit-to-debug-database-functions)
  - [Downloading database logs#](#downloading-database-logs)
  - [Logging observed table rows#](#logging-observed-table-rows)
  - [Logging function parameters#](#logging-function-parameters)
  - [Does PGAudit support system wide configurations?#](#does-pgaudit-support-system-wide-configurations)
- [Resources#](#resources)

## 概要

Session and object auditing via Postgres standard logging

---

[PGAudit](<https://www.pgaudit.org>) extends Postgres's built-in logging abilities. It can be used to selectively track activities within your database.

This helps you with:

  * **Compliance** : Meeting audit requirements for regulations
  * **Security** : Detecting suspicious database activity
  * **Troubleshooting** : Identifying and fixing database issues


## Enable the extension#

DashboardSQL

  1. Go to the [Database](</dashboard/project/_/database/tables>) page in the Dashboard.
  2. Click on **Extensions** in the sidebar.
  3. Search for `pgaudit` and enable the extension.


## Configure the extension#

PGAudit can be configured with different levels of precision.

**PGAudit logging precision:**

  * **Session:** Logs activity within a connection, such as a [psql](</docs/guides/database/psql>) connection.
  * **User:** Logs activity by a particular database user (for example, `anon` or `postgres`).
  * **Global:** Logs activity across the entire database.
  * **Object:** Logs events related to specific database objects (for example, the auth.users table).


Although Session, User, and Global modes differ in their precision, they're all considered variants of **Session Mode** and are configured with the same input categories.

### Session mode categories#

These modes can monitor predefined categories of database operations:

Category| What it Logs| Description  
---|---|---  
`read`| Data retrieval (SELECT, COPY)| Tracks what data is being accessed.  
`write`| Data modification (INSERT, DELETE, UPDATE, TRUNCATE, COPY)| Tracks changes made to your database.  
`function`| FUNCTION, PROCEDURE, and DO/END block executions| Tracks routine/function executions  
`role`| User management actions (CREATE, DROP, ALTER on users and privileges)| Tracks changes to user permissions and access.  
`ddl`| Schema changes (CREATE, DROP, ALTER statements)| Monitors modifications to your database structure (tables, indexes, etc.).  
`misc`| Less common commands (FETCH, CHECKPOINT)| Captures obscure actions for deeper analysis if needed.  
`all`| Everything above| Comprehensive logging for complete audit trails.  
  
Below is a limited example of how to assign PGAudit to monitor specific categories.
[code] 
    1
    
    -- log all CREATE, ALTER, and DROP events
    
    2
    
    ... pgaudit.log = 'ddl';
    
    3
    
    4
    
    -- log all CREATE, ALTER, DROP, and SELECT events
    
    5
    
    ... pgaudit.log = 'read, ddl';
    
    6
    
    7
    
    -- log nothing
    
    8
    
    ... pgaudit.log = 'none';
[/code]

### Session logging#

When you are connecting in a session environment, such as a [psql](</docs/guides/database/psql>) connection, you can configure PGAudit to record events initiated within the session.

The [Dashboard](</dashboard/project/_>) is a transactional environment and won't sustain a session.

Inside a session, by default, PGAudit will log nothing:
[code] 
    1
    
    -- returns 'none'
    
    2
    
    show pgaudit.log;
[/code]

In the session, you can `set` the `pgaudit.log` variable to record events:
[code] 
    1
    
    -- log CREATE, ALTER, and DROP events
    
    2
    
    set pgaudit.log = 'ddl';
    
    3
    
    4
    
    -- log all CREATE, ALTER, DROP, and SELECT events
    
    5
    
    set pgaudit.log = 'read, ddl';
    
    6
    
    7
    
    -- log nothing
    
    8
    
    set pgaudit.log = 'none';
[/code]

### User logging#

There are some cases where you may want to monitor a database user's actions. For instance, say you connected your database to [Zapier](</partners/integrations/zapier>) and created a custom role for it to use:
[code] 
    1
    
    create user "zapier" with password '<new password>';
[/code]

You may want to log all actions initiated by `zapier`, which can be done with the following command:
[code] 
    1
    
    alter role "zapier" set pgaudit.log to 'all';
[/code]

To remove the settings, execute the following code:
[code] 
    1
    
    -- disables role's log
    
    2
    
    alter role "zapier" set pgaudit.log to 'none';
    
    3
    
    4
    
    -- check to make sure the changes are finalized:
    
    5
    
    select
    
    6
    
      rolname,
    
    7
    
      rolconfig
    
    8
    
    from pg_roles
    
    9
    
    where rolname = 'zapier';
    
    10
    
    -- should return a rolconfig path with "pgaudit.log=none" present
[/code]

### Global logging#

Use global logging cautiously. It can generate many logs and make it difficult to find important events. Consider limiting the scope of what is logged by using session, user, or object logging where possible.

The below SQL configures PGAudit to record all events associated with the `postgres` role. Since it has extensive privileges, this effectively monitors all database activity.
[code] 
    1
    
    alter role "postgres" set pgaudit.log to 'all';
[/code]

To check if the `postgres` role is auditing, execute the following command:
[code] 
    1
    
    select
    
    2
    
      rolname,
    
    3
    
      rolconfig
    
    4
    
    from pg_roles
    
    5
    
    where rolname = 'postgres';
    
    6
    
    -- should return a rolconfig path with "pgaudit.log=all" present
[/code]

To remove the settings, execute the following code:
[code] 
    1
    
    alter role "postgres" set pgaudit.log to 'none';
[/code]

### Object logging#

To fine-tune what object events PGAudit will record, you must create a custom database role with limited permissions:
[code] 
    1
    
    create role "some_audit_role" noinherit;
[/code]

No other Postgres user can assume or login via this role. It solely exists to securely define what PGAudit will record.

Once the role is created, you can direct PGAudit to log by assigning it to the `pgaudit.role` variable:
[code] 
    1
    
    alter role "postgres" set pgaudit.role to 'some_audit_role';
[/code]

You can then assign the role to monitor only approved object events, such as `select` statements that include a specific table:
[code] 
    1
    
    grant select on random_table to "some_audit_role";
[/code]

With this privilege granted, PGAudit will record all select statements that reference the `random_table`, regardless of _who_ or _what_ initiated the event. All assignable privileges can be viewed in the [Postgres documentation](<https://www.postgresql.org/docs/current/ddl-priv.html>).

If you would no longer like to use object logging, you will need to unassign the `pgaudit.role` variable:
[code] 
    1
    
    -- change pgaudit.role to no longer reference some_audit_role
    
    2
    
    alter role "postgres" set pgaudit.role to '';
    
    3
    
    4
    
    -- view if pgaudit.role changed with the following command:
    
    5
    
    select
    
    6
    
      rolname,
    
    7
    
      rolconfig
    
    8
    
    from pg_roles
    
    9
    
    where rolname = 'postgres';
    
    10
    
    -- should return a rolconfig path with "pgaudit.role="
[/code]

## Interpreting Audit Logs#

PGAudit was designed for storing logs as CSV files with the following headers:

Referenced from the [PGAudit official docs](<https://github.com/pgaudit/pgaudit/blob/master/README.md#format>)

header| Description  
---|---  
AUDIT_TYPE| SESSION or OBJECT  
STATEMENT_ID| Unique statement ID for this session. Sequential even if some statements are not logged.  
SUBSTATEMENT_ID| Sequential ID for each sub-statement within the main statement. Continuous even if some are not logged.  
CLASS| ..., READ, ROLE (see pgaudit.log).  
COMMAND| ..., ALTER TABLE, SELECT.  
OBJECT_TYPE| TABLE, INDEX, VIEW, etc. Available for SELECT, DML, and most DDL statements.  
OBJECT_NAME| The fully qualified object name (for example, public.account). Available for SELECT, DML, and most DDL.  
STATEMENT| Statement executed on the backend.  
PARAMETER| If pgaudit.log_parameter is set, this field contains the statement parameters as quoted CSV, or <none>. Otherwise, it's <not logged>.  
  
A log made from the following create statement:
[code] 
    1
    
    create table account (
    
    2
    
      id int primary key,
    
    3
    
      name text,
    
    4
    
      description text
    
    5
    
    );
[/code]

Generates the following log in the [Dashboard's Postgres Logs](</dashboard/project/_/logs/postgres-logs>):
[code] 
    1
    
    AUDIT: SESSION,1,1,DDL,CREATE TABLE,TABLE,public.account,create table account(
    
    2
    
      id int,
    
    3
    
      name text,
    
    4
    
      description text
    
    5
    
    ); <not logged>
[/code]

## Finding and filtering audit logs#

Logs generated by PGAudit can be found in [Postgres Logs](</dashboard/project/_/logs/postgres-logs?s=AUDIT>). To find a specific log, you can use the log explorer. Below is a basic example to extract logs referencing `CREATE TABLE` events
[code] 
    1
    
    select
    
    2
    
      cast(t.timestamp as datetime) as timestamp,
    
    3
    
      event_message
    
    4
    
    from
    
    5
    
      postgres_logs as t
    
    6
    
      cross join unnest(metadata) as m
    
    7
    
      cross join unnest(m.parsed) as p
    
    8
    
    where event_message like 'AUDIT%CREATE TABLE%'
    
    9
    
    order by timestamp desc
    
    10
    
    limit 100;
[/code]

## Practical examples#

### Monitoring API events#

API requests are already recorded in the [API Edge Network](</dashboard/project/_/logs/edge-logs>) logs.

To monitor all writes initiated by the PostgREST API roles:
[code] 
    1
    
    alter role "authenticator" set pgaudit.log to 'write';
    
    2
    
    3
    
    -- the above is the practical equivalent to:
    
    4
    
    -- alter role "anon" set pgaudit.log TO 'write';
    
    5
    
    -- alter role "authenticated" set pgaudit.log TO 'write';
    
    6
    
    -- alter role "service_role" set pgaudit.log TO 'write';
[/code]

### Monitoring the `auth.users` table#

In the worst case scenario, where a privileged roles' password is exposed, you can use PGAudit to monitor if the `auth.users` table was targeted. It should be stated that API requests are already monitored in the [API Edge Network](</dashboard/project/_/logs/edge-logs>) and this is more about providing greater clarity about what is happening at the database level.

Logging `auth.user` should be done in Object Mode and requires a custom role:
[code] 
    1
    
    -- create logging role
    
    2
    
    create role "auth_auditor" noinherit;
    
    3
    
    4
    
    -- give role permission to observe relevant table events
    
    5
    
    grant select on auth.users to "auth_auditor";
    
    6
    
    grant delete on auth.users to "auth_auditor";
    
    7
    
    8
    
    -- assign auth_auditor to pgaudit.role
    
    9
    
    alter role "postgres" set pgaudit.role to 'auth_auditor';
[/code]

With the above code, any query involving reading or deleting from the auth.users table will be logged.

## Best practices#

### Disabling excess logging#

PGAudit, if not configured mindfully, can log all database events, including background tasks. This can generate an undesirably large amount of logs in a few hours.

The first step to solve this problem is to identify which database users PGAudit is observing:
[code] 
    1
    
    -- find all users monitored by pgaudit
    
    2
    
    select
    
    3
    
      rolname,
    
    4
    
      rolconfig
    
    5
    
    from pg_roles
    
    6
    
    where
    
    7
    
      exists (
    
    8
    
        select
    
    9
    
          1
    
    10
    
        from UNNEST(rolconfig) as c
    
    11
    
        where c like '%pgaudit.role%' or c like '%pgaudit.log%'
    
    12
    
      );
[/code]

To prevent PGAudit from monitoring the problematic roles, you'll want to change their `pgaudit.log` values to `none` and `pgaudit.role` values to `empty quotes ''`
[code] 
    1
    
    -- Use to disable object level logging
    
    2
    
      alter role "<role name>" set pgaudit.role to '';
    
    3
    
    4
    
      -- Use to disable global and user level logging
    
    5
    
      alter role "<role name>" set pgaudit.log to 'none';
[/code]

## FAQ#

### Using PGAudit to debug database functions#

Technically yes, but it is not the best approach. It is better to check out our [function debugging guide](</docs/guides/database/functions#general-logging>) instead.

### Downloading database logs#

In the [Logs Dashboard](</dashboard/project/_/logs/postgres-logs>) you can download logs as CSVs.

### Logging observed table rows#

By default, PGAudit records queries, but not the returned rows. You can modify this behavior with the `pgaudit.log_rows` variable:
[code] 
    1
    
    --enable
    
    2
    
    alter role "postgres" set pgaudit.log_rows to 'on';
    
    3
    
    4
    
    -- disable
    
    5
    
    alter role "postgres" set pgaudit.log_rows to 'off';
[/code]

You should not do this unless you are _absolutely_ certain it is necessary for your use case. It can expose sensitive values to your logs that ideally should not be preserved. Furthermore, if done in excess, it can noticeably reduce database performance.

### Logging function parameters#

We don't currently support configuring `pgaudit.log_parameter` because it may log secrets in encrypted columns if you are using [pgsodium](</docs/guides/database/extensions/pgsodium>) or[Vault](</docs/guides/database/vault>).

You can upvote this [feature request](<https://github.com/orgs/supabase/discussions/20183>) with your use-case if you'd like this restriction lifted.

### Does PGAudit support system wide configurations?#

PGAudit allows settings to be applied to 3 different database scopes:

Scope| Description| Configuration File/Command  
---|---|---  
System| Entire server| ALTER SYSTEM commands  
Database| Specific database| ALTER DATABASE commands  
Role| Specific user/role| ALTER ROLE commands  
  
Supabase limits full privileges for file system and database variables, meaning PGAudit modifications can only occur at the role level. Assigning PGAudit to the `postgres` role grants it nearly complete visibility into the database, making role-level adjustments a practical alternative to configuring at the database or system level.

PGAudit's [official documentation](<https://www.pgaudit.org>) focuses on system and database level configs, but its docs officially supports role level configs, too.

## Resources#

  * [Official `PGAudit` documentation](<https://www.pgaudit.org>)
  * [Database Function Logging](</docs/guides/database/functions#general-logging>)
  * [Supabase Logging](</docs/guides/monitoring-and-debugging/logs>)
  * [Self-Hosting Logs](</docs/reference/self-hosting-analytics/introduction>)