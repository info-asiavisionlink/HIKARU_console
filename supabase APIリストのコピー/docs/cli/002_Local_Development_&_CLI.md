---
タイトル: Local Development & CLI
URL: https://supabase.com/docs/guides/local-development
カテゴリ: cli
更新日: 2026-08-02
タグ: cli, development, local, local-development
---

# Local Development & CLI

**URL:** https://supabase.com/docs/guides/local-development
**カテゴリ:** cli
**更新日:** 2026-08-02
**タグ:** cli, development, local, local-development

## 目次

- [Quickstart#](#quickstart)
- [Local development#](#local-development)
- [CLI#](#cli)

## 概要

Learn how to develop locally and use the Supabase CLI

---

To develop your applications using the locally running Supabase stack, you'll need to install the Supabase CLI and a container runtime.

A container manager compatible with Docker APIs is a prerequisite:

  * [Docker Desktop](<https://docs.docker.com/desktop/>) (macOS, Windows, Linux) - preferred option
  * [Rancher Desktop](<https://rancherdesktop.io/>) (macOS, Windows, Linux)
  * [Podman](<https://podman.io/>) (macOS, Windows, Linux)
  * [OrbStack](<https://orbstack.dev/>) (macOS)


## Quickstart#

Pick an install method and use the same tab in every step below. **Homebrew** gives you a global `supabase` command. **npm, pnpm, and yarn** install the CLI into your project as a dev dependency, so you run it through your package runner (`npx supabase`, `pnpm supabase`, or `yarn supabase`). See [Install and run the CLI](</docs/guides/local-development/cli/getting-started>) for details.

  1. Install the Supabase CLI:

npmyarnpnpmbrew
[code]1
         
         npm install supabase --save-dev
[/code]

  2. In your repo, initialize the local Supabase project:

npmyarnpnpmbrew
[code]1
         
         npx supabase init
[/code]

  3. Start the local Supabase stack:

npmyarnpnpmbrew
[code]1
         
         npx supabase start
[/code]

  4. View your local Supabase instance at <http://localhost:54323>[](<http://localhost:54323>).


If your local development machine is connected to an untrusted public network, you should create a separate Docker network and bind to 127.0.0.1 before starting the local development stack. This restricts network access to only your localhost machine.
[code]
    1
    
    docker network create -o 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1' local-network
    
    2
    
    npx supabase start --network-id local-network
[/code]

You should never expose your local development stack publicly.

## Local development#

Local development with Supabase allows you to work on your projects in a self-contained environment on your local machine. Working locally has several advantages:

  1. Faster development: You can make changes and see results instantly without waiting for remote deployments.
  2. Offline work: You can continue development even without an internet connection.
  3. Cost-effective: Local development is free and doesn't consume your project's quota.
  4. Enhanced privacy: Sensitive data remains on your local machine during development.
  5. Safe testing: You can experiment with different configurations and features without affecting your production environment.


Once set up, you can initialize a new Supabase project, start the local stack, and begin developing your application using local Supabase services. This includes access to a local Postgres database, Auth, Storage, and other Supabase features.

## CLI#

The Supabase CLI is a tool that enables developers to run Supabase services locally and manage hosted projects directly from the terminal. It provides a suite of commands for various tasks, including:

  * Setting up and managing local development environments
  * Generating TypeScript types for your database schema
  * Handling database migrations
  * Managing environment variables and secrets
  * Deploying your project to the Supabase platform


With the CLI, you can streamline your development workflow, automate repetitive tasks, and maintain consistency across different environments. It's an essential tool for both local development and CI/CD pipelines.

See the [CLI Getting Started guide](</docs/guides/local-development/cli/getting-started>) for more information.