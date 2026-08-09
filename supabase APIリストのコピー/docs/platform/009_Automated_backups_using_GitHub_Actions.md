---
タイトル: Automated backups using GitHub Actions
URL: https://supabase.com/docs/guides/deployment/ci/backups
カテゴリ: platform
更新日: 2026-08-02
タグ: actions, automated, backups, ci, deployment, github, platform, using
---

# Automated backups using GitHub Actions

**URL:** https://supabase.com/docs/guides/deployment/ci/backups
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** actions, automated, backups, ci, deployment, github, platform, using

## 目次

- [Backup action#](#backup-action)
- [Periodic Backups Workflow#](#periodic-backups-workflow)
- [More resources#](#more-resources)

## 概要

Backup your database on a regular basis.

---

You can use the Supabase CLI to backup your Postgres database. The steps involve running a series of commands to dump roles, schema, and data separately. Inside your repository, create a new file inside the `.github/workflows` folder called `backup.yml`. Copy the following snippet inside the file, and the action will run whenever a new PR is created.

Never backup your data to a public repository.

## Backup action#
[code] 
    1
    
    name: 'backup-database'
    
    2
    
    on:
    
    3
    
      pull_request:
    
    4
    
    jobs:
    
    5
    
      build: 
    
    6
    
        runs-on: ubuntu-latest
    
    7
    
        env:
    
    8
    
          supabase_db_url: ${{ secrets.SUPABASE_DB_URL }}   # For example: postgresql://postgres:[YOUR-PASSWORD]@db.<ref>.supabase.co:5432/postgres
    
    9
    
        steps:
    
    10
    
          - uses: actions/checkout@v2
    
    11
    
          - uses: supabase/setup-cli@v1
    
    12
    
            with:
    
    13
    
              version: latest
    
    14
    
          - name: Backup roles
    
    15
    
            run: supabase db dump --db-url "$supabase_db_url" -f roles.sql --role-only
    
    16
    
          - name: Backup schema
    
    17
    
            run: supabase db dump --db-url "$supabase_db_url" -f schema.sql
    
    18
    
          - name: Backup data
    
    19
    
            run: supabase db dump --db-url "$supabase_db_url" -f data.sql --data-only --use-copy
[/code]

## Periodic Backups Workflow#

You can use the GitHub Action to run periodic backups of your database. In this example, the Action workflow is triggered by `push` and `pull_request` events on the `main` branch, manually via `workflow_dispatch`, and automatically at midnight every day due to the `schedule` event with a `cron` expression. The workflow runs on the latest Ubuntu runner and requires write permissions to the repository's contents. It uses the Supabase CLI to dump the roles, schema, and data from your Supabase database, utilizing the `SUPABASE_DB_URL` environment variable that is securely stored in the GitHub secrets. After the backup is complete, it auto-commits the changes to the repository using the `git-auto-commit-action`. This ensures that the latest backup is always available in your repository. The commit message for these automated commits is "Supabase backup". This workflow provides an automated solution for maintaining regular backups of your Supabase database. It helps keep your data safe and enables easy restoration in case of any accidental data loss or corruption.

Never backup your data to a public repository.
[code] 
    1
    
    name: Supa-backup
    
    2
    
    3
    
    on:
    
    4
    
      push:
    
    5
    
        branches: [ main ]
    
    6
    
      pull_request:
    
    7
    
        branches: [ main ]
    
    8
    
      workflow_dispatch:
    
    9
    
      schedule:
    
    10
    
        - cron: '0 0 * * *' # Runs every day at midnight
    
    11
    
    jobs:   
    
    12
    
      run_db_backup:
    
    13
    
        runs-on: ubuntu-latest
    
    14
    
        permissions:
    
    15
    
          contents: write
    
    16
    
        env:
    
    17
    
          supabase_db_url: ${{ secrets.SUPABASE_DB_URL }}   # For example: postgresql://postgres:[YOUR-PASSWORD]@db.<ref>.supabase.co:5432/postgres
    
    18
    
        steps:
    
    19
    
          - uses: actions/checkout@v3
    
    20
    
            with:
    
    21
    
              ref: ${{ github.head_ref }}
    
    22
    
          - uses: supabase/setup-cli@v1
    
    23
    
            with:
    
    24
    
              version: latest
    
    25
    
          - name: Backup roles
    
    26
    
            run: supabase db dump --db-url "$supabase_db_url" -f roles.sql --role-only
    
    27
    
          - name: Backup schema
    
    28
    
            run: supabase db dump --db-url "$supabase_db_url" -f schema.sql
    
    29
    
          - name: Backup data
    
    30
    
            run: supabase db dump --db-url "$supabase_db_url" -f data.sql --data-only --use-copy
    
    31
    
    32
    
          - uses: stefanzweifel/git-auto-commit-action@v4
    
    33
    
            with:
    
    34
    
              commit_message: Supabase backup
[/code]

## More resources#

  * Backing up and migrating your project: [Migrating and Upgrading](<https://supabase.com/docs/guides/platform/migrating-and-upgrading-projects>)