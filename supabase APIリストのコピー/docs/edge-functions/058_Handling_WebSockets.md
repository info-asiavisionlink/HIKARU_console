---
タイトル: Handling WebSockets
URL: https://supabase.com/docs/guides/functions/websockets
カテゴリ: edge-functions
更新日: 2026-08-02
タグ: edge-functions, functions, handling, websockets
---

# Handling WebSockets

**URL:** https://supabase.com/docs/guides/functions/websockets
**カテゴリ:** edge-functions
**更新日:** 2026-08-02
**タグ:** edge-functions, functions, handling, websockets

## 目次

- [Creating WebSocket servers#](#creating-websocket-servers)
  - [Outbound WebSockets#](#outbound-websockets)
- [Authentication#](#authentication)
- [Testing WebSockets locally#](#testing-websockets-locally)

## 概要

How to handle WebSocket connections in Edge Functions

---

Edge Functions supports hosting WebSocket servers that can facilitate bi-directional communications with browser clients.

This allows you to:

  * Build real-time applications like chat or live updates
  * Create WebSocket relay servers for external APIs
  * Establish both incoming and outgoing WebSocket connections


For a production-ready reconnect pattern with session persistence and replay, see [Resumable WebSockets with Edge Functions](</docs/guides/functions/examples/resumable-websockets>).

* * *

## Creating WebSocket servers#

Here are some basic examples of setting up WebSocket servers using Deno and Node.js APIs.

DenoNode.js
[code]
    1
    
    export default {
    
    2
    
      fetch: (req) => {
    
    3
    
        const upgrade = req.headers.get('upgrade') || ''
    
    4
    
    5
    
        if (upgrade.toLowerCase() != 'websocket') {
    
    6
    
          return Response.json(
    
    7
    
            { error: "request isn't trying to upgrade to WebSocket." },
    
    8
    
            { status: 400 }
    
    9
    
          )
    
    10
    
        }
    
    11
    
    12
    
        const { socket, response } = Deno.upgradeWebSocket(req)
    
    13
    
    14
    
        socket.onopen = () => console.log('socket opened')
    
    15
    
        socket.onmessage = (e) => {
    
    16
    
          console.log('socket message:', e.data)
    
    17
    
          socket.send(new Date().toString())
    
    18
    
        }
    
    19
    
    20
    
        socket.onerror = (e) => console.log('socket errored:', e.message)
    
    21
    
        socket.onclose = () => console.log('socket closed')
    
    22
    
    23
    
        return response
    
    24
    
      },
    
    25
    
    }
[/code]

* * *

### Outbound WebSockets#

You can also establish an outbound WebSocket connection to another server from an Edge Function.

Combining it with incoming WebSocket servers, it's possible to use Edge Functions as a WebSocket proxy, for example as a [relay server](<https://github.com/supabase-community/openai-realtime-console?tab=readme-ov-file#using-supabase-edge-functions-as-a-relay-server>) for the [OpenAI Realtime API](<https://platform.openai.com/docs/guides/realtime/overview>).
[code] 
    1
    
    import { createServer } from "node:http";
    
    2
    
    import { WebSocketServer } from "npm:ws";
    
    3
    
    import { RealtimeClient } from "https://raw.githubusercontent.com/openai/openai-realtime-api-beta/refs/heads/main/lib/client.js";
    
    4
    
    5
    
    // ...
    
    6
    
    7
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    8
    
    9
    
    const server = createServer();
    
    10
    
    // Since we manually created the HTTP server,
    
    11
    
    // turn on the noServer mode.
    
    12
    
    const wss = new WebSocketServer({ noServer: true });
    
    13
    
    14
    
    wss.on("connection", async (ws) => {
    
    15
    
      console.log("socket opened");
    
    16
    
      if (!OPENAI_API_KEY) {
    
    17
    
        throw new Error("OPENAI_API_KEY is not set");
    
    18
    
      }
    
    19
    
      // Instantiate new client
    
    20
    
      console.log(`Connecting with key "${OPENAI_API_KEY.slice(0, 3)}..."`);
    
    21
    
      const client = new RealtimeClient({ apiKey: OPENAI_API_KEY });
    
    22
    
    23
    
      // Relay: OpenAI Realtime API Event -> Browser Event
    
    24
    
      client.realtime.on("server.*", (event) => {
    
    25
    
        console.log(`Relaying "${event.type}" to Client`);
    
    26
    
        ws.send(JSON.stringify(event));
    
    27
    
      });
    
    28
    
      client.realtime.on("close", () => ws.close());
    
    29
    
    30
    
      // Relay: Browser Event -> OpenAI Realtime API Event
    
    31
    
      // We need to queue data waiting for the OpenAI connection
    
    32
    
      const messageQueue = [];
    
    33
    
      const messageHandler = (data) => {
    
    34
    
        try {
    
    35
    
          const event = JSON.parse(data);
    
    36
    
          console.log(`Relaying "${event.type}" to OpenAI`);
    
    37
    
          client.realtime.send(event.type, event);
    
    38
    
        } catch (e) {
    
    39
    
          console.error(e.message);
    
    40
    
          console.log(`Error parsing event from client: ${data}`);
    
    41
    
        }
    
    42
    
      };
    
    43
    
    44
    
      ws.on("message", (data) => {
    
    45
    
        if (!client.isConnected()) {
    
    46
    
          messageQueue.push(data);
    
    47
    
        } else {
    
    48
    
          messageHandler(data);
    
    49
    
        }
    
    50
    
      });
    
    51
    
      ws.on("close", () => client.disconnect());
    
    52
    
    53
    
      // Connect to OpenAI Realtime API
    
    54
    
      try {
    
    55
    
        console.log(`Connecting to OpenAI...`);
    
    56
    
        await client.connect();
    
    57
    
      } catch (e) {
    
    58
    
        console.log(`Error connecting to OpenAI: ${e.message}`);
    
    59
    
        ws.close();
    
    60
    
        return;
    
    61
    
      }
    
    62
    
      console.log(`Connected to OpenAI successfully!`);
    
    63
    
      while (messageQueue.length) {
    
    64
    
        messageHandler(messageQueue.shift());
    
    65
    
      }
    
    66
    
    });
    
    67
    
    68
    
    server.on("upgrade", (req, socket, head) => {
    
    69
    
      wss.handleUpgrade(req, socket, head, (ws) => {
    
    70
    
        wss.emit("connection", ws, req);
    
    71
    
      });
    
    72
    
    });
    
    73
    
    74
    
    server.listen(8080);
[/code]

[View source](<https://github.com/supabase-community/openai-realtime-console/blob/0f93657a71670704fbf77c48cf54d6c9eb956698/supabase/functions/relay/index.ts>)

* * *

## Authentication#

WebSocket browser clients don't have the option to send custom headers. Because of this, Edge Functions won't be able to perform the usual authorization header check to verify the JWT.

You can skip the default authorization header checks by explicitly providing `--no-verify-jwt` when serving and deploying functions.

To authenticate the user making WebSocket requests, you can pass the JWT in URL query params or via a custom protocol. The [`withSupabase`](</docs/guides/functions/auth>) wrapper validates credentials on request headers, so it can't authenticate WebSocket clients. Verify the JWT yourself, as shown below.

Using query paramsUsing custom protocol
[code]
    1
    
    import { createClient } from 'npm:@supabase/supabase-js@^2'
    
    2
    
    3
    
    const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
    
    4
    
    const supabase = createClient(
    
    5
    
      Deno.env.get('SUPABASE_URL'),
    
    6
    
      // If you want to use a different api key, change 'default' to your preferred key name
    
    7
    
      SUPABASE_SECRET_KEYS['default']
    
    8
    
    )
    
    9
    
    10
    
    export default {
    
    11
    
      fetch: async (req) => {
    
    12
    
        const upgrade = req.headers.get('upgrade') || ''
    
    13
    
        if (upgrade.toLowerCase() != 'websocket') {
    
    14
    
          return Response.json(
    
    15
    
            { error: "request isn't trying to upgrade to WebSocket." },
    
    16
    
            { status: 400 }
    
    17
    
          )
    
    18
    
        }
    
    19
    
    20
    
        // Please be aware query params may be logged in some logging systems.
    
    21
    
        const url = new URL(req.url)
    
    22
    
        const jwt = url.searchParams.get('jwt')
    
    23
    
    24
    
        if (!jwt) {
    
    25
    
          console.error('Auth token not provided')
    
    26
    
          return Response.json({ error: 'Auth token not provided' }, { status: 403 })
    
    27
    
        }
    
    28
    
    29
    
        const { error, data } = await supabase.auth.getUser(jwt)
    
    30
    
    31
    
        if (error) {
    
    32
    
          console.error(error)
    
    33
    
          return Response.json({ error: 'Invalid token provided' }, { status: 403 })
    
    34
    
        }
    
    35
    
    36
    
        if (!data.user) {
    
    37
    
          console.error('user is not authenticated')
    
    38
    
          return Response.json({ error: 'User is not authenticated' }, { status: 403 })
    
    39
    
        }
    
    40
    
    41
    
        const { socket, response } = Deno.upgradeWebSocket(req)
    
    42
    
    43
    
        socket.onopen = () => console.log('socket opened')
    
    44
    
        socket.onmessage = (e) => {
    
    45
    
          console.log('socket message:', e.data)
    
    46
    
          socket.send(new Date().toString())
    
    47
    
        }
    
    48
    
    49
    
        socket.onerror = (e) => console.log('socket errored:', e.message)
    
    50
    
        socket.onclose = () => console.log('socket closed')
    
    51
    
    52
    
        return response
    
    53
    
      },
    
    54
    
    }
[/code]

The maximum duration is capped based on the wall-clock, CPU, and memory limits. The Function will shutdown when it reaches one of these [limits](</docs/guides/functions/limits>).

When using WebSockets, keep in mind that the HTTP request is considered complete after `Deno.upgradeWebSocket(req)` returns the response. To prevent early worker retirement while the socket is still open, keep an unresolved `EdgeRuntime.waitUntil()` promise that resolves in `socket.onclose`.

* * *

## Testing WebSockets locally#

When testing Edge Functions locally with Supabase CLI, the instances are terminated automatically after a request is completed. This will prevent keeping WebSocket connections open.

To prevent that, you can update the `supabase/config.toml` with the following settings:
[code] 
    1
    
    [edge_runtime]
    
    2
    
    policy = "per_worker"
[/code]

When running with `per_worker` policy, Function won't auto-reload on edits. You will need to manually restart it by running `supabase functions serve`.