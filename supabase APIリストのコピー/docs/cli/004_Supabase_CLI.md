---
タイトル: Supabase CLI
URL: https://supabase.com/docs/guides/local-development/cli/getting-started
カテゴリ: cli
更新日: 2026-08-02
タグ: cli, getting-started, local-development, supabase
---

# Supabase CLI

**URL:** https://supabase.com/docs/guides/local-development/cli/getting-started
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** cli, getting-started, local-development, supabase

## 目次

- [Installing the Supabase CLI#](#installing-the-supabase-cli)
- [Beta channel#](#beta-channel)
- [Updating the Supabase CLI#](#updating-the-supabase-cli)
- [Running a local Supabase project#](#running-a-local-supabase-project)
- [Access your project's services#](#access-your-projects-services)
- [Stopping local services#](#stopping-local-services)
- [Telemetry#](#telemetry)
  - [How to opt out#](#how-to-opt-out)
- [Learn more#](#learn-more)

## 概要

The Supabase CLI provides tools to develop your project locally, deploy to the Supabase Platform, and set up CI/CD workflows.

---

The Supabase CLI enables you to run the entire Supabase stack locally, on your machine or in a CI environment. With two commands, you can set up and start a new local project:

  1. `supabase init` to create a new local project
  2. `supabase start` to launch the Supabase services


There are two ways to install the CLI, and they change the command you type:

  * **Project dependency** with `npm`, `pnpm`, or `yarn` installs the CLI into a single project (there is no global `supabase` command with this method). Run it through your package runner instead, for example `npx supabase <command>`.
  * **Global install** with Homebrew, Scoop, or Linux packages. Run commands as `supabase <command>`.


Either way, the CLI is **project-scoped** : most commands (including `start`) expect to run inside a directory that has been initialized with `supabase init`, which creates the `supabase/` folder and `config.toml`. Run `init` first, then the other commands from the same directory.

The rest of this page writes examples as `supabase <command>`; translate them to `npx supabase <command>` if you installed the CLI as a project dependency.

## Installing the Supabase CLI#

npmmacOSWindowsLinux

Install the CLI as a project dev dependency. This adds it to a single project rather than installing a global command:
[code]
    1
    
    npm install supabase --save-dev
    
    2
    
    # or: pnpm add -D supabase / yarn add -D supabase / bun add -D supabase
[/code]

Pin the version in `package.json` so your whole team uses the same CLI version. Then run every command through your package runner:
[code]
    1
    
    npx supabase --help
    
    2
    
    # or: pnpm supabase / yarn supabase / bunx supabase
[/code]

The Supabase CLI requires **Node.js 20 or later** when run via `npx` or `npm`. Older Node.js versions, such as 16, are not supported and fail to start the CLI.

## Beta channel#

Pre-release CLI builds ship from the development branch (`X.Y.Z-beta.N` versions). Use the npm `beta` dist-tag, or install `supabase-beta` via Homebrew / Scoop (separate packages from stable).

npmmacOSWindowsLinux

Install as a dev dependency:
[code]
    1
    
    npm install supabase@beta --save-dev
[/code]

Or run without installing:
[code]
    1
    
    npx supabase@beta --help
[/code]

## Updating the Supabase CLI#

When a new [version](<https://github.com/supabase/cli/releases>) is released, you can update the CLI using the same channels.

npmmacOSWindowsLinux

Update the CLI with [npm](<https://www.npmjs.com/package/supabase>):
[code]
    1
    
    npm update supabase --save-dev
[/code]

Update to the latest beta release or switch a stable install to the beta channel with:
[code]
    1
    
    npm install supabase@beta --save-dev
[/code]

If you have any Supabase containers running locally, stop them and delete their data volumes before proceeding with the upgrade. This ensures that Supabase managed services can apply new migrations on a clean state of the local database.

Backup and stop running containers

Remember to save any local schema and data changes before stopping because the `--no-backup` flag will delete them.
[code]
    1
    
    supabase db diff -f my_schema
    
    2
    
    supabase db dump --local --data-only > supabase/seed.sql
    
    3
    
    supabase stop --no-backup
[/code]

## Running a local Supabase project#

The most common thing you'll do with the CLI is run the full Supabase stack (Postgres, Auth, Storage, and the rest) on your own machine. That stack runs in Docker containers, so you need a container runtime installed first. Follow the official guide to install and configure [Docker Desktop](<https://docs.docker.com/desktop>) on your machine.

Alternately, you can use a different container tool that offers Docker compatible APIs.

  * [Rancher Desktop](<https://rancherdesktop.io/>) (macOS, Windows, Linux)
  * [Podman](<https://podman.io/>) (macOS, Windows, Linux)
  * [OrbStack](<https://orbstack.dev/>) (macOS)
  * [colima](<https://github.com/abiosoft/colima>) (macOS)


With a container runtime running, go to the folder where you want to create your project and initialize it:
[code] 
    1
    
    supabase init
[/code]

This creates a new `supabase` folder. It's safe to commit this folder to version control.

Now, from the same folder, start the Supabase stack:
[code] 
    1
    
    supabase start
[/code]

If you installed the CLI as a project dependency (npm, pnpm, yarn, or bun), run these as `npx supabase init` and `npx supabase start` instead. See the note above.

This takes time on your first run because the CLI needs to download the Docker images to your local machine. The CLI includes the entire Supabase stack, and a few additional images useful for local development (like a local SMTP server and a database diff tool).

## Access your project's services#

Once all the Supabase services are running, you'll see output containing your local Supabase credentials. It should look like the below, with urls and keys that you use in your local project:
[code] 
    1
    
    Started supabase local development setup.
    
    2
    
    3
    
    ╭──────────────────────────────────────╮
    
    4
    
    │ 🔧 Development Tools                 │
    
    5
    
    ├─────────┬────────────────────────────┤
    
    6
    
    │ Studio  │ http://127.0.0.1:54323     │
    
    7
    
    │ Mailpit │ http://127.0.0.1:54324     │
    
    8
    
    │ MCP     │ http://127.0.0.1:54321/mcp │
    
    9
    
    ╰─────────┴────────────────────────────╯
    
    10
    
    11
    
    ╭──────────────────────────────────────────────────────╮
    
    12
    
    │ 🌐 APIs                                              │
    
    13
    
    ├────────────────┬─────────────────────────────────────┤
    
    14
    
    │ Project URL    │ http://127.0.0.1:54321              │
    
    15
    
    │ REST           │ http://127.0.0.1:54321/rest/v1      │
    
    16
    
    │ GraphQL        │ http://127.0.0.1:54321/graphql/v1   │
    
    17
    
    │ Edge Functions │ http://127.0.0.1:54321/functions/v1 │
    
    18
    
    ╰────────────────┴─────────────────────────────────────╯
    
    19
    
    20
    
    ╭───────────────────────────────────────────────────────────────╮
    
    21
    
    │ ⛁ Database                                                    │
    
    22
    
    ├─────┬─────────────────────────────────────────────────────────┤
    
    23
    
    │ URL │ postgresql://postgres:postgres@127.0.0.1:54322/postgres │
    
    24
    
    ╰─────┴─────────────────────────────────────────────────────────╯
    
    25
    
    26
    
    ╭──────────────────────────────────────────────────────────────╮
    
    27
    
    │ 🔑 Authentication Keys                                       │
    
    28
    
    ├─────────────┬────────────────────────────────────────────────┤
    
    29
    
    │ Publishable │ sb_publishable_...                             │
    
    30
    
    │ Secret      │ sb_secret_...                                  │
    
    31
    
    ╰─────────────┴────────────────────────────────────────────────╯
[/code]

StudioPostgresAPI GatewayAnalytics
[code]
    1
    
    # Default URL:
    
    2
    
    http://localhost:54323
[/code]

The local development environment includes Supabase Studio, a graphical interface for working with your database.

![Local Studio](/docs/img/guides/cli/local-studio.png)

## Stopping local services#

When you are finished working on your Supabase project, you can stop the stack (without resetting your local database):
[code] 
    1
    
    supabase stop
[/code]

## Telemetry#

The Supabase CLI collects telemetry data about general usage. Participating in this program is optional, and you can opt out at any time.

### How to opt out#

You can disable telemetry by running:
[code] 
    1
    
    supabase telemetry disable
[/code]

You can check the current status and re-enable with:
[code] 
    1
    
    supabase telemetry status
    
    2
    
    supabase telemetry enable
[/code]

You can also opt out using the `SUPABASE_TELEMETRY_DISABLED=1` environment variable. The broader `DO_NOT_TRACK=1` convention is also respected.

## Learn more#

  * [CLI configuration](</docs/guides/local-development/cli/config>)
  * [CLI reference](</docs/reference/cli>)