---
タイトル: Deploy MCP servers
URL: https://supabase.com/docs/guides/ai-tools/byo-mcp
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, ai-tools, byo-mcp, deploy, servers
---

# Deploy MCP servers

**URL:** https://supabase.com/docs/guides/ai-tools/byo-mcp
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, ai-tools, byo-mcp, deploy, servers

## 目次

- [Prerequisites#](#prerequisites)
- [Deploy your MCP server#](#deploy-your-mcp-server)
  - [Step 1: Create a new project#](#step-1-create-a-new-project)
  - [Step 2: Create the MCP server function#](#step-2-create-the-mcp-server-function)
  - [Step 3: Test locally#](#step-3-test-locally)
  - [Step 4: Deploy to production#](#step-4-deploy-to-production)
- [Examples#](#examples)
- [Resources#](#resources)

## 概要

Build and deploy remote MCP servers on Supabase Edge Functions

---

Build and deploy [Model Context Protocol](<https://modelcontextprotocol.io/specification/2025-11-25>) (MCP) servers on Supabase using [Edge Functions](</docs/guides/functions>).

This guide covers MCP servers that do not require authentication. Auth support for MCP on Edge Functions is coming soon.

## Prerequisites#

Before you begin, make sure you have:

  * [Docker](<https://docs.docker.com/get-docker/>) or a compatible runtime installed and running (required for local development)
  * [Deno](<https://deno.land/>) installed (Supabase Edge Functions runtime)
  * [Supabase CLI](</docs/guides/local-development>) installed and authenticated
  * [Node.js 20 or later](<https://nodejs.org/>) (required by Supabase CLI)


## Deploy your MCP server#

### Step 1: Create a new project#

Start by creating a new Supabase project:
[code] 
    1
    
    mkdir my-mcp-server
    
    2
    
    cd my-mcp-server
    
    3
    
    supabase init
[/code]

After this step, you should have a project directory with a `supabase` folder containing `config.toml` and an empty `functions` directory.

* * *

### Step 2: Create the MCP server function#

Create a new Edge Function for your MCP server:
[code] 
    1
    
    supabase functions new mcp
[/code]

This tutorial uses the [official MCP TypeScript SDK](<https://github.com/modelcontextprotocol/typescript-sdk>) with the `WebStandardStreamableHTTPServerTransport`, but you can use any MCP framework that's compatible with the [Edge Runtime](</docs/guides/functions>), such as [mcp-lite](<https://github.com/fiberplane/mcp-lite>) or [mcp-handler](<https://github.com/vercel/mcp-handler>).

Replace the contents of `supabase/functions/mcp/index.ts` with:

supabase/functions/mcp/index.ts
[code]
    1
    
    // Setup type definitions for built-in Supabase Runtime APIs
    
    2
    
    import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
    
    3
    
    4
    
    import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js'
    
    5
    
    import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js'
    
    6
    
    import { Hono } from 'npm:hono@^4.9.7'
    
    7
    
    import { z } from 'npm:zod@^4.1.13'
    
    8
    
    9
    
    // Create Hono app
    
    10
    
    const app = new Hono()
    
    11
    
    12
    
    // Create your MCP server
    
    13
    
    const server = new McpServer({
    
    14
    
      name: 'mcp',
    
    15
    
      version: '0.1.0',
    
    16
    
    })
    
    17
    
    18
    
    // Register an addition tool
    
    19
    
    server.registerTool(
    
    20
    
      'add',
    
    21
    
      {
    
    22
    
        title: 'Addition Tool',
    
    23
    
        description: 'Add two numbers together',
    
    24
    
        inputSchema: { a: z.number(), b: z.number() },
    
    25
    
      },
    
    26
    
      ({ a, b }) => ({
    
    27
    
        content: [{ type: 'text', text: String(a + b) }],
    
    28
    
      })
    
    29
    
    )
    
    30
    
    31
    
    // Handle MCP requests
    
    32
    
    app.all('*', async (c) => {
    
    33
    
      const transport = new WebStandardStreamableHTTPServerTransport()
    
    34
    
      await server.connect(transport)
    
    35
    
      return transport.handleRequest(c.req.raw)
    
    36
    
    })
    
    37
    
    38
    
    Deno.serve(app.fetch)
[/code]

After this step, you should have a new file at `supabase/functions/mcp/index.ts`.

Within Edge Functions, paths are prefixed with the function name. If your function is named something other than `mcp`, configure Hono with a base path: `new Hono().basePath('/your-function-name')`.

* * *

### Step 3: Test locally#

Start the Supabase local development stack:
[code] 
    1
    
    supabase start
[/code]

In a separate terminal, serve your function:
[code] 
    1
    
    supabase functions serve --no-verify-jwt mcp
[/code]

Your MCP server is now running at:
[code] 
    1
    
    http://localhost:54321/functions/v1/mcp
[/code]

The `--no-verify-jwt` flag disables JWT verification at the Edge Function layer so your MCP server can accept unauthenticated requests. Authenticated MCP support is coming soon.

#### Test with curl#

You can also test your MCP server directly with curl. Call the `add` tool:
[code] 
    1
    
    curl -X POST 'http://localhost:54321/functions/v1/mcp' \
    
    2
    
      -H 'Content-Type: application/json' \
    
    3
    
      -H 'Accept: application/json, text/event-stream' \
    
    4
    
      -d '{
    
    5
    
        "jsonrpc": "2.0",
    
    6
    
        "id": 1,
    
    7
    
        "method": "tools/call",
    
    8
    
        "params": {
    
    9
    
          "name": "add",
    
    10
    
          "arguments": {
    
    11
    
            "a": 5,
    
    12
    
            "b": 3
    
    13
    
          }
    
    14
    
        }
    
    15
    
      }'
[/code]

The MCP Streamable HTTP transport requires the `Accept: application/json, text/event-stream` header to indicate the client supports both JSON and Server-Sent Events responses.

**Expected response:**

The response uses Server-Sent Events (SSE) format:
[code] 
    1
    
    event: message
    
    2
    
    data: {"result":{"content":[{"type":"text","text":"8"}]},"jsonrpc":"2.0","id":1}
[/code]

#### Test with MCP Inspector#

Test your server with the official [MCP Inspector](<https://github.com/modelcontextprotocol/inspector>):
[code] 
    1
    
    npx -y @modelcontextprotocol/inspector
[/code]

Use the local endpoint `http://localhost:54321/functions/v1/mcp` in the inspector UI to explore available tools and test them interactively.

After this step, you should have your MCP server running locally and be able to test the `add` tool in the MCP Inspector.

### Step 4: Deploy to production#

When you're ready to deploy, link your project and deploy the function:
[code] 
    1
    
    supabase link --project-ref <your-project-ref>
    
    2
    
    supabase functions deploy --no-verify-jwt mcp
[/code]

Your MCP server will be available at:
[code] 
    1
    
    https://<your-project-ref>.supabase.co/functions/v1/mcp
[/code]

Update your MCP client configuration to use the production URL.

After this step, you have a fully deployed MCP server accessible from anywhere. You can test it using the MCP Inspector with your production URL.

## Examples#

You can find ready-to-use MCP server implementations here:

  * [Simple MCP server](<https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/mcp/simple-mcp-server>) \- Unauthenticated example


## Resources#

  * [Model Context Protocol Specification](<https://modelcontextprotocol.io/specification/2025-11-25>)
  * [MCP TypeScript SDK](<https://github.com/modelcontextprotocol/typescript-sdk>)
  * [Supabase Edge Functions](</docs/guides/functions>)
  * [OAuth 2.1 Server](</docs/guides/auth/oauth-server>)
  * [MCP Authentication](</docs/guides/auth/oauth-server/mcp-authentication>)
  * [Building MCP servers with mcp-lite](</docs/guides/functions/examples/mcp-server-mcp-lite>) \- Alternative lightweight framework