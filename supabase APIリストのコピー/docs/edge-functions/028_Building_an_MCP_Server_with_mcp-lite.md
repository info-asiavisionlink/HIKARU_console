---
タイトル: Building an MCP Server with mcp-lite
URL: https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: building, edge-functions, examples, functions, lite, mcp-server-mcp-lite, server, with
---

# Building an MCP Server with mcp-lite

**URL:** https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** building, edge-functions, examples, functions, lite, mcp-server-mcp-lite, server, with

## 目次

- [What is mcp-lite?#](#what-is-mcp-lite)
- [Why Supabase Edge Functions + mcp-lite?#](#why-supabase-edge-functions--mcp-lite)
- [Prerequisites#](#prerequisites)
- [Create a new MCP server#](#create-a-new-mcp-server)
- [Understanding the project structure#](#understanding-the-project-structure)
  - [Minimal config.toml#](#minimal-configtoml)
  - [Two Hono apps pattern#](#two-hono-apps-pattern)
  - [Deno import maps#](#deno-import-maps)
- [Local development#](#local-development)
  - [Start Supabase#](#start-supabase)
  - [Serve your function#](#serve-your-function)
  - [Testing your server#](#testing-your-server)
- [How it works#](#how-it-works)
- [Adding more tools#](#adding-more-tools)
- [Deploy to production#](#deploy-to-production)
- [Authentication considerations#](#authentication-considerations)
  - [Security best practices#](#security-best-practices)
- [What's next#](#whats-next)
- [Resources#](#resources)

## 概要

Build and deploy a Model Context Protocol (MCP) server on Supabase Edge Functions using mcp-lite.

---

The [Model Context Protocol](<https://modelcontextprotocol.io/introduction>) (MCP) enables Large Language Models (LLMs) to interact with external tools and data sources. With `mcp-lite`, you can build lightweight MCP servers that run on Supabase Edge Functions, giving your AI assistants the ability to execute custom tools at the edge.

This guide shows you how to scaffold, develop, and deploy an MCP server using mcp-lite on Supabase Edge Functions.

## What is mcp-lite?#

[mcp-lite](<https://github.com/fiberplane/mcp-lite>) is a lightweight, zero-dependency TypeScript framework for building MCP servers. It works everywhere the Fetch API is available, including Node, Bun, Cloudflare Workers, Deno, and Supabase Edge Functions.

## Why Supabase Edge Functions + mcp-lite?#

This combination offers several advantages:

  * **Zero cold starts** : Edge Functions stay warm for fast responses
  * **Global distribution** : Deploy once and run everywhere
  * **Direct database access** : Connect directly to your Supabase Postgres
  * **Minimal footprint** : mcp-lite has zero runtime dependencies
  * **Full type safety** : TypeScript support in Deno
  * **Basic deployment** : One command to production


## Prerequisites#

You need:

  * [Docker](<https://docs.docker.com/get-docker/>) (to run Supabase locally)
  * [Deno](<https://deno.land/>) (Supabase Edge Functions runtime)
  * [Supabase CLI](</docs/guides/local-development/cli/getting-started>)


## Create a new MCP server#

Starting with `create-mcp-lite@0.3.0`, you can scaffold a complete MCP server that runs on Supabase Edge Functions:
[code] 
    1
    
    npm create mcp-lite@latest
[/code]

When prompted, select **Supabase Edge Functions (MCP server)** from the template options.

The template creates a focused structure for Edge Functions development:
[code] 
    1
    
    my-mcp-server/
    
    2
    
    ├── supabase/
    
    3
    
    │   ├── config.toml                    # Minimal Supabase config (Edge Functions only)
    
    4
    
    │   └── functions/
    
    5
    
    │       └── mcp-server/
    
    6
    
    │           ├── index.ts               # MCP server implementation
    
    7
    
    │           └── deno.json              # Deno imports and configuration
    
    8
    
    ├── package.json
    
    9
    
    └── tsconfig.json
[/code]

## Understanding the project structure#

### Minimal config.toml#

The template includes a minimal `config.toml` that runs only Edge Functions - no database, storage, or Studio UI. This keeps your local setup lightweight:
[code] 
    1
    
    # Minimal config for running only Edge Functions (no DB, storage, or studio)
    
    2
    
    project_id = "starter-mcp-supabase"
    
    3
    
    4
    
    [api]
    
    5
    
    enabled = true
    
    6
    
    port = 54321
    
    7
    
    8
    
    [edge_runtime]
    
    9
    
    enabled = true
    
    10
    
    policy = "per_worker"
    
    11
    
    deno_version = 2
[/code]

You can always add more services as needed.

### Two Hono apps pattern#

The template uses a specific pattern required by Supabase Edge Functions:
[code] 
    1
    
    // Root handler - matches the function name
    
    2
    
    const app = new Hono()
    
    3
    
    4
    
    // MCP protocol handler
    
    5
    
    const mcpApp = new Hono()
    
    6
    
    7
    
    mcpApp.get('/', (c) => {
    
    8
    
      return c.json({
    
    9
    
        message: 'MCP Server on Supabase Edge Functions',
    
    10
    
        endpoints: {
    
    11
    
          mcp: '/mcp',
    
    12
    
          health: '/health',
    
    13
    
        },
    
    14
    
      })
    
    15
    
    })
    
    16
    
    17
    
    mcpApp.all('/mcp', async (c) => {
    
    18
    
      const response = await httpHandler(c.req.raw)
    
    19
    
      return response
    
    20
    
    })
    
    21
    
    22
    
    // Mount at /mcp-server (the function name)
    
    23
    
    app.route('/mcp-server', mcpApp)
[/code]

This is required because Supabase routes all requests to `/<function-name>/*`. The outer `app` handles the function-level routing, while `mcpApp` handles your actual MCP endpoints.

### Deno import maps#

The template uses Deno's import maps in `deno.json` to manage dependencies:
[code] 
    1
    
    {
    
    2
    
      "compilerOptions": {
    
    3
    
        "lib": ["deno.window", "deno.ns"],
    
    4
    
        "strict": true
    
    5
    
      },
    
    6
    
      "imports": {
    
    7
    
        "hono": "npm:hono@^4.6.14",
    
    8
    
        "mcp-lite": "npm:mcp-lite@0.8.2",
    
    9
    
        "zod": "npm:zod@^4.1.12"
    
    10
    
      }
    
    11
    
    }
[/code]

This gives you npm package access while staying in the Deno ecosystem.

## Local development#

### Start Supabase#

Navigate to your project directory and start Supabase services:
[code] 
    1
    
    supabase start
[/code]

### Serve your function#

In a separate terminal, serve your MCP function locally:
[code] 
    1
    
    supabase functions serve --no-verify-jwt mcp-server
[/code]

Or use the npm script (which runs the same command):
[code] 
    1
    
    npm run dev
[/code]

Your MCP server is available at:
[code] 
    1
    
    http://localhost:54321/functions/v1/mcp-server/mcp
[/code]

### Testing your server#

Test the MCP server by adding it to your Claude Code, Claude Desktop, Cursor, or your preferred MCP client.

Using Claude Code:
[code] 
    1
    
    claude mcp add my-mcp-server -t http http://localhost:54321/functions/v1/mcp-server/mcp
[/code]

You can also test it using the MCP inspector:
[code] 
    1
    
    npx @modelcontextprotocol/inspector
[/code]

Then add the MCP endpoint URL in the inspector UI.

## How it works#

The MCP server setup is straightforward:
[code] 
    1
    
    import { McpServer, StreamableHttpTransport } from 'mcp-lite'
    
    2
    
    import { z } from 'zod'
    
    3
    
    4
    
    // Create MCP server instance
    
    5
    
    const mcp = new McpServer({
    
    6
    
      name: 'starter-mcp-supabase-server',
    
    7
    
      version: '1.0.0',
    
    8
    
      schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
    
    9
    
    })
    
    10
    
    11
    
    // Define a tool
    
    12
    
    mcp.tool('sum', {
    
    13
    
      description: 'Adds two numbers together',
    
    14
    
      inputSchema: z.object({
    
    15
    
        a: z.number(),
    
    16
    
        b: z.number(),
    
    17
    
      }),
    
    18
    
      handler: (args: { a: number; b: number }) => ({
    
    19
    
        content: [{ type: 'text', text: String(args.a + args.b) }],
    
    20
    
      }),
    
    21
    
    })
    
    22
    
    23
    
    // Bind to HTTP transport
    
    24
    
    const transport = new StreamableHttpTransport()
    
    25
    
    const httpHandler = transport.bind(mcp)
[/code]

## Adding more tools#

Extend your MCP server by adding tools directly to the `mcp` instance. Here's an example of adding a database search tool:
[code] 
    1
    
    mcp.tool('searchDatabase', {
    
    2
    
      description: 'Search your Supabase database',
    
    3
    
      inputSchema: z.object({
    
    4
    
        table: z.string(),
    
    5
    
        query: z.string(),
    
    6
    
      }),
    
    7
    
      handler: async (args) => {
    
    8
    
        // Access Supabase client here
    
    9
    
        // const { data } = await supabase.from(args.table).select('*')
    
    10
    
        return {
    
    11
    
          content: [{ type: 'text', text: `Searching ${args.table}...` }],
    
    12
    
        }
    
    13
    
      },
    
    14
    
    })
[/code]

You can add tools that:

  * Query your Supabase database
  * Access Supabase Storage for file operations
  * Call external APIs
  * Process data with custom logic
  * Integrate with other Supabase features


## Deploy to production#

When ready, deploy to Supabase's global edge network:
[code] 
    1
    
    supabase functions deploy --no-verify-jwt mcp-server
[/code]

Or use the npm script:
[code] 
    1
    
    npm run deploy
[/code]

Your MCP server will be live at:
[code] 
    1
    
    https://your-project-ref.supabase.co/functions/v1/mcp-server/mcp
[/code]

## Authentication considerations#

The template uses `--no-verify-jwt` for quick development. This means authentication is not enforced by Supabase's JWT layer.

For production, you should implement authentication at the MCP server level following the [MCP Authorization specification](<https://modelcontextprotocol.io/specification/draft/basic/authorization>). This gives you control over who can access your MCP tools.

### Security best practices#

When deploying MCP servers:

  * **Don't expose sensitive data** : Use the server in development environments with non-production data
  * **Implement authentication** : Add proper authentication for production deployments
  * **Validate inputs** : Always validate and sanitize tool inputs
  * **Limit tool scope** : Only expose tools that are necessary for your use case
  * **Monitor usage** : Track tool calls and monitor for unusual activity


For more security guidance, see the [MCP security guide](</guides/getting-started/mcp#security-risks>).

## What's next#

With your MCP server running on Supabase Edge Functions, you can:

  * Connect it to your Supabase database for data-driven tools
  * Use Supabase Auth to secure your endpoints
  * Access Supabase Storage for file operations
  * Deploy to multiple regions automatically
  * Scale to handle production traffic
  * Integrate with AI assistants like Claude, Cursor, or custom MCP clients


## Resources#

  * [mcp-lite on GitHub](<https://github.com/fiberplane/mcp-lite>)
  * [Model Context Protocol Spec](<https://modelcontextprotocol.io/>)
  * [Supabase Edge Functions Docs](</guides/functions>)
  * [Deno Runtime Documentation](<https://deno.land/>)
  * [Fiberplane tutorial](<https://blog.fiberplane.com/blog/mcp-lite-supabase-edge-functions/>)