---
source_url: https://developers.openai.com/api/docs/guides/realtime-webrtc
fetched_at: 2026-07-27T01:58:13Z
---

# Realtime API with WebRTC

Copy Page

[Realtime Console

Test harness for the Realtime API w/ WebRTC.](https://github.com/openai/openai-realtime-console)

[WebRTC](https://webrtc.org/) is a powerful set of standard interfaces for building real-time applications. The OpenAI Realtime API supports connecting to realtime models through a WebRTC peer connection.

For browser-based speech-to-speech voice applications, we recommend starting with [Voice agents](voice-agents.md), which covers the Agents SDK’s higher-level helpers and APIs for managing Realtime sessions. The WebRTC interface is powerful and flexible, but lower level than the Agents SDK.

When connecting to a Realtime model from the client (like a web browser or
mobile device), we recommend using WebRTC rather than WebSockets for more
consistent performance.

For more guidance on building user interfaces on top of WebRTC, [refer to the docs on MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API).

## Overview

The Realtime API supports two mechanisms for connecting to the Realtime API from the browser, either using ephemeral API keys ([generated via the OpenAI REST API](../api-reference/realtime-sessions.md)), or via the new unified interface. Generally, using the unified interface is simpler, but puts your application server in the critical path for session initialization.

### Connecting using the unified interface

The process for initializing a WebRTC connection using the unified interface is as follows (assuming a web browser client):

1. The browser makes a request to a developer-controlled server using the SDP data from its WebRTC peer connection.
2. The server combines that SDP with its session configuration in a multipart form and sends that to the OpenAI Realtime API, authenticating it with its [standard API key](https://platform.openai.com/settings/organization/api-keys).

#### Creating a session via the unified interface

To create a realtime API session via the unified interface, you will need to build a small server-side application (or integrate with an existing one) to make an request to `/v1/realtime/calls`. You will use a [standard API key](https://platform.openai.com/settings/organization/api-keys) to authenticate this request on your backend server.

Below is an example of a simple Node.js [express](https://expressjs.com/) server which creates a realtime API session:

```
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
import express from "express";

const app = express();

// Parse raw SDP payloads posted from the browser
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

const sessionConfig = JSON.stringify({
  type: "realtime",
  model: "gpt-realtime-2.1",
  audio: { output: { voice: "marin" } },
});

// An endpoint which creates a Realtime API session.
app.post("/session", async (req, res) => {
  const fd = new FormData();
  fd.set("sdp", req.body);
  fd.set("session", sessionConfig);

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": "hashed-user-id",
      },
      body: fd,
    });
    // Send back the SDP we received from the OpenAI REST API
    const sdp = await r.text();
    res.send(sdp);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

app.listen(3000);
```

If your application assigns a [safety identifier](safety-best-practices.md)
for each end user, include it as the `OpenAI-Safety-Identifier` header in this
server-side request. Use a stable, privacy-preserving value, such as a hashed
internal user ID. The header should be set by your trusted backend, not by the
browser.

#### Connecting to the server

In the browser, you can use standard WebRTC APIs to connect to the Realtime API via your application server. The client directly POSTs its SDP data to your server.

```
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
// Create a peer connection
const pc = new RTCPeerConnection();

// Set up to play remote audio from the model
audioElement.current = document.createElement("audio");
audioElement.current.autoplay = true;
pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

// Add local audio track for microphone input in the browser
const ms = await navigator.mediaDevices.getUserMedia({
  audio: true,
});
pc.addTrack(ms.getTracks()[0]);

// Set up data channel for sending and receiving events
const dc = pc.createDataChannel("oai-events");

// Start the session using the Session Description Protocol (SDP)
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const sdpResponse = await fetch("/session", {
  method: "POST",
  body: offer.sdp,
  headers: {
    "Content-Type": "application/sdp",
  },
});

const answer = {
  type: "answer",
  sdp: await sdpResponse.text(),
};
await pc.setRemoteDescription(answer);
```

### Connecting using an ephemeral token

The process for initializing a WebRTC connection using an ephemeral API key is as follows (assuming a web browser client):

1. The browser makes a request to a developer-controlled server to mint an ephemeral API key.
2. The developer’s server uses a [standard API key](https://platform.openai.com/settings/organization/api-keys) to request an ephemeral key from the [OpenAI REST API](../api-reference/realtime-sessions.md), and returns that new key to the browser.
3. The browser uses the ephemeral key to authenticate a session directly with the OpenAI Realtime API as a [WebRTC peer connection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection).

![connect to realtime via WebRTC](../../../assets/api_file_55b47800-9aaf-48b9-90d5-793ab227ddd3)

#### Creating an ephemeral token

To create an ephemeral token to use on the client-side, you will need to build a small server-side application (or integrate with an existing one) to make an [OpenAI REST API](../api-reference/realtime-sessions.md) request for an ephemeral key. You will use a [standard API key](https://platform.openai.com/settings/organization/api-keys) to authenticate this request on your backend server.

Below is an example of a simple Node.js [express](https://expressjs.com/) server which mints an ephemeral API key using the REST API:

```
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
import express from "express";

const app = express();

const sessionConfig = JSON.stringify({
  session: {
    type: "realtime",
    model: "gpt-realtime-2.1",
    audio: {
      output: {
        voice: "marin",
      },
    },
  },
});

// An endpoint which would work with the client code above - it returns
// the contents of a REST API request to this protected endpoint
app.get("/token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": "hashed-user-id",
        },
        body: sessionConfig,
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

app.listen(3000);
```

You can create a server endpoint like this one on any platform that can send and receive HTTP requests. Just ensure that **you only use standard OpenAI API keys on the server, not in the browser.**

When using ephemeral tokens, set `OpenAI-Safety-Identifier` on the server-side
request that creates the client secret. The Realtime API binds the identifier to
the resulting ephemeral token, so the browser does not need to send the safety
identifier when it later connects with that token.

#### Connecting to the server

In the browser, you can use standard WebRTC APIs to connect to the Realtime API with an ephemeral token. The client first fetches a token from your server endpoint, and then POSTs its SDP data (with the ephemeral token) to the Realtime API.

```
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
// Get a session token for OpenAI Realtime API
const tokenResponse = await fetch("/token");
const data = await tokenResponse.json();
const EPHEMERAL_KEY = data.value;

// Create a peer connection
const pc = new RTCPeerConnection();

// Set up to play remote audio from the model
audioElement.current = document.createElement("audio");
audioElement.current.autoplay = true;
pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

// Add local audio track for microphone input in the browser
const ms = await navigator.mediaDevices.getUserMedia({
  audio: true,
});
pc.addTrack(ms.getTracks()[0]);

// Set up data channel for sending and receiving events
const dc = pc.createDataChannel("oai-events");

// Start the session using the Session Description Protocol (SDP)
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
  method: "POST",
  body: offer.sdp,
  headers: {
    Authorization: `Bearer ${EPHEMERAL_KEY}`,
    "Content-Type": "application/sdp",
  },
});

const answer = {
  type: "answer",
  sdp: await sdpResponse.text(),
};
await pc.setRemoteDescription(answer);
```

## Sending and receiving events

Realtime API sessions are managed using a combination of [client-sent events](../api-reference/realtime_client_events/session.md) emitted by you as the developer, and [server-sent events](../api-reference/realtime_server_events/error.md) created by the Realtime API to indicate session lifecycle events.

When connecting to a Realtime model via WebRTC, you don’t have to handle audio events from the model in the same granular way you must with [WebSockets](realtime-websocket.md). The WebRTC peer connection object, if configured as above, will do all that work for you.

To send and receive other client and server events, you can use the WebRTC peer connection’s [data channel](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels).

```
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
// This is the data channel set up in the browser code above...
const dc = pc.createDataChannel("oai-events");

// Listen for server events
dc.addEventListener("message", (e) => {
  const event = JSON.parse(e.data);
  console.log(event);
});

// Send client events
const event = {
  type: "conversation.item.create",
  item: {
    type: "message",
    role: "user",
    content: [
      {
        type: "input_text",
        text: "hello there!",
      },
    ],
  },
};
dc.send(JSON.stringify(event));
```

To learn more about managing Realtime conversations, refer to the [Realtime conversations guide](realtime-conversations.md).

[Realtime Console

Check out the WebRTC Realtime API in this light weight example app.](https://github.com/openai/openai-realtime-console/)