---
タイトル: GitHub integration
URL: https://supabase.com/docs/guides/deployment/branching/github-integration
カテゴリ: platform
更新日: 2026-08-02
タグ: branching, deployment, github, github-integration, integration, platform
---

# GitHub integration

**URL:** https://supabase.com/docs/guides/deployment/branching/github-integration
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** branching, deployment, github, github-integration, integration, platform

## 目次

- [Installation#](#installation)
  - [Set the working directory#](#set-the-working-directory)
- [Preparing your Git repository#](#preparing-your-git-repository)
- [Syncing GitHub branches#](#syncing-github-branches)
  - [Configuration#](#configuration)
  - [Migrations#](#migrations)
  - [Seeding#](#seeding)
- [Deploying changes to production#](#deploying-changes-to-production)
- [Preventing migration failures#](#preventing-migration-failures)
  - [Email notifications#](#email-notifications)

## 概要

Connect with GitHub to sync branches with your repository

---

Supabase Branching uses the Supabase GitHub integration to read files from your GitHub repository. With this integration, Supabase watches all commits, branches, and pull requests of your GitHub repository.

## Installation#

In the Supabase Dashboard:

  1. Go to **Project Settings** > [**Integrations**](</dashboard/project/_/settings/integrations>).
  2. Under **GitHub Integration** , click **Authorize GitHub**.
  3. You are redirected to a GitHub authorization page. Click **Authorize Supabase**.
  4. You are redirected back to the Integrations page. Choose a GitHub repository to connect your project to.
  5. Set the **Working directory** field.
  6. Configure the other options as needed to automate your GitHub connection.
  7. Click **Enable integration**.


### Set the working directory#

The working directory is the path from your repository root to the directory that contains the `supabase/` folder. Enter `.` when `supabase/` is at the repository root.

If `supabase/` is nested deeper in your repository, enter its parent directory instead. For example, if your layout is `apps/web/supabase/`, enter `apps/web`.

## Preparing your Git repository#

You will be using the [Supabase CLI](</docs/guides/local-development>) to initialize your local `./supabase` directory:

1

Initialize Supabase locally

If you don't have a `./supabase` directory, you can create one:
[code]
    1
    
    supabase init
[/code]

2

Pull your database migration

Pull your database changes using `supabase db pull`. To get your database connection string, go to your project dashboard, click [Connect](</dashboard/project/_?showConnect=true&method=session>) and look for the Session pooler connection string.
[code]
    1
    
    supabase db pull --db-url <db_connection_string>
    
    2
    
    3
    
    # Your Database connection string will look like this:
    
    4
    
    # postgres://postgres.xxxx:password@xxxx.pooler.supabase.com:5432/postgres
[/code]

If you're in an [IPv6 environment](<https://github.com/orgs/supabase/discussions/27034>) or have the IPv4 Add-On, you can use the direct connection string instead of Supavisor in Session mode.

3

Commit the `supabase` directory to Git

Commit the `supabase` directory to Git, and push your changes to your remote repository.
[code]
    1
    
    git add supabase
    
    2
    
    git commit -m "Initial migration"
    
    3
    
    git push
[/code]

## Syncing GitHub branches#

Enable the **Automatic branching** option in your GitHub Integration configuration to automatically sync GitHub branches with Supabase branches.

When a new branch is created in GitHub, a corresponding branch is created in Supabase. (You can enable the **Supabase changes only** option to only create Supabase branches when Supabase files change.)

### Configuration#

You can test configuration changes on your Preview Branch by configuring the `config.toml` file in your Supabase directory. See the [Configuration docs](</docs/guides/deployment/branching/configuration>) for more information.

A comment is added to your PR with the deployment status of your preview branch.

### Migrations#

The migrations in the `migrations` subdirectory of your Supabase directory are automatically run.

### Seeding#

No production data is copied to your Preview branch. This is meant to protect your sensitive production data.

You can seed your Preview Branch with sample data using the `seed.sql` file in your Supabase directory. See the [Seeding docs](</docs/guides/local-development/seeding-your-database>) for more information.

Data changes in your seed files are not merged to production.

## Deploying changes to production#

Enable the **Deploy to production** option in your GitHub Integration configuration to automatically deploy changes when you push or merge to production branch.

The following changes are deployed:

  * New migrations are applied
  * Edge Functions declared in `config.toml` are deployed
  * Storage buckets declared in `config.toml` are deployed


All other configurations, including API, Auth, and seed files, are ignored by default.

## Preventing migration failures#

We highly recommend turning on a 'required check' for the Supabase integration. You can do this from your GitHub repository settings. This prevents PRs from being merged when migration checks fail, and stops invalid migrations from being merged into your production branch.

![Check the "Require status checks to pass before merging" option.](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Fbranching%2Fgithub-required-check.jpg%3Fv%3D1&w=3840&q=75)Check the "Require status checks to pass before merging" option.

### Email notifications#

To catch failures early, we also recommend subscribing to email notifications on your branch. Common errors include migration conflict, function deployment failure, or invalid configuration file.

You can setup a custom GitHub Action to monitor the status of any Supabase Branch.

.github/workflows/notify-failure.yaml
[code]
    1
    
    name: Branch Status
    
    2
    
    3
    
    on:
    
    4
    
      pull_request:
    
    5
    
        types:
    
    6
    
          - opened
    
    7
    
          - reopened
    
    8
    
          - synchronize
    
    9
    
        branches:
    
    10
    
          - main
    
    11
    
          - develop
    
    12
    
        paths:
    
    13
    
          - 'supabase/**'
    
    14
    
    15
    
    jobs:
    
    16
    
      failed:
    
    17
    
        runs-on: ubuntu-latest
    
    18
    
        steps:
    
    19
    
          - uses: fountainhead/action-wait-for-check@v1.2.0
    
    20
    
            id: check
    
    21
    
            with:
    
    22
    
              checkName: Supabase Preview
    
    23
    
              ref: ${{ github.event.pull_request.head.sha || github.sha }}
    
    24
    
              token: ${{ secrets.GITHUB_TOKEN }}
    
    25
    
    26
    
          - if: ${{ steps.check.outputs.conclusion == 'failure' }}
    
    27
    
            run: exit 1
[/code]