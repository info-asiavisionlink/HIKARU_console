---
source_url: https://developers.openai.com/api/docs/guides/streaming-responses
fetched_at: 2026-07-27T01:55:14Z
---

# Streaming API responses

Responses

Copy Page

Responses

By default, when you make a request to the OpenAI API, we generate the model’s entire output before sending it back in a single HTTP response. When generating long outputs, waiting for a response can take time. Streaming responses lets you start printing or processing the beginning of the model’s output while it continues generating the full response.

This guide focuses on HTTP streaming (`stream=true`) over server-sent events (SSE). For persistent WebSocket transport with incremental inputs via `previous_response_id`, see [the Responses API WebSocket mode](websocket-mode.md).

## Enable streaming

To start streaming responses, set `stream=True` in your request to the Responses endpoint:

python

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
import { OpenAI } from "openai";
const client = new OpenAI();

const stream = await client.responses.create({
  model: "gpt-5.6",
  input: [
    {
      role: "user",
      content: "Say 'double bubble bath' ten times fast.",
    },
  ],
  stream: true,
});

for await (const event of stream) {
  console.log(event);
}
```

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
from openai import OpenAI

client = OpenAI()

stream = client.responses.create(
    model="gpt-5.6",
    input=[
        {
            "role": "user",
            "content": "Say 'double bubble bath' ten times fast.",
        },
    ],
    stream=True,
)

for event in stream:
    print(event)
```

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
using OpenAI.Responses;

string key = Environment.GetEnvironmentVariable("OPENAI_API_KEY")!;
OpenAIResponseClient client = new(model: "gpt-5.6", apiKey: key);

var responses = client.CreateResponseStreamingAsync([
    ResponseItem.CreateUserMessageItem([
        ResponseContentPart.CreateInputTextPart("Say 'double bubble bath' ten times fast."),
    ]),
]);

await foreach (var response in responses)
{
    if (response is StreamingResponseOutputTextDeltaUpdate delta)
    {
        Console.Write(delta.Delta);
    }
}
```

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
require "openai"

openai = OpenAI::Client.new

stream = openai.responses.stream(
  model: "gpt-5.6",
  input: [
    {
      role: "user",
      content: "Say 'double bubble bath' ten times fast."
    }
  ]
)

stream.each do |event|
  puts(event)
end
```

The Responses API uses semantic events for streaming. Each event is typed with a predefined schema, so you can listen for events you care about.

For a full list of event types, see the [API reference for streaming](../api-reference/responses-streaming.md). Here are a few examples:

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
StreamingEvent = (
    ResponseCreatedEvent
    | ResponseInProgressEvent
    | ResponseFailedEvent
    | ResponseCompletedEvent
    | ResponseOutputItemAdded
    | ResponseOutputItemDone
    | ResponseContentPartAdded
    | ResponseContentPartDone
    | ResponseOutputTextDelta
    | ResponseOutputTextAnnotationAdded
    | ResponseTextDone
    | ResponseRefusalDelta
    | ResponseRefusalDone
    | ResponseFunctionCallArgumentsDelta
    | ResponseFunctionCallArgumentsDone
    | ResponseFileSearchCallInProgress
    | ResponseFileSearchCallSearching
    | ResponseFileSearchCallCompleted
    | ResponseCodeInterpreterInProgress
    | ResponseCodeInterpreterCallCodeDelta
    | ResponseCodeInterpreterCallCodeDone
    | ResponseCodeInterpreterCallInterpreting
    | ResponseCodeInterpreterCallCompleted
    | Error
)
```

Streaming Chat Completions is fairly straightforward. However, we recommend using the [Responses API for streaming](streaming-responses.md), as we designed it with streaming in mind. The Responses API uses semantic events for streaming and is type-safe.

### Stream a chat completion

To stream completions, set `stream=True` when calling the Chat Completions or legacy Completions endpoints. This returns an object that streams back the response as data-only server-sent events.

The response is sent back incrementally in chunks with an event stream. You can iterate over the event stream with a `for` loop, like this:

python

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
import OpenAI from "openai";
const openai = new OpenAI();

const stream = await openai.chat.completions.create({
  model: "gpt-5.6",
  messages: [
    {
      role: "user",
      content: "Say 'double bubble bath' ten times fast.",
    },
  ],
  stream: true,
});

for await (const chunk of stream) {
  console.log(chunk);
  console.log(chunk.choices[0].delta);
  console.log("****************");
}
```

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
from openai import OpenAI

client = OpenAI()

stream = client.chat.completions.create(
    model="gpt-5.6",
    messages=[
        {
            "role": "user",
            "content": "Say 'double bubble bath' ten times fast.",
        },
    ],
    stream=True,
)

for chunk in stream:
    print(chunk)
    print(chunk.choices[0].delta)
    print("****************")
```

## Read the responses

If you’re using our SDK, every event is a typed instance. You can also identity individual events using the `type` property of the event.

Some key lifecycle events are emitted only once, while others are emitted multiple times as the response is generated. Common events to listen for when streaming text are:

```
- `response.created`
- `response.output_text.delta`
- `response.completed`
- `error`
```

For a full list of events you can listen for, see the [API reference for streaming](../api-reference/responses-streaming.md).

When you stream a chat completion, the responses has a `delta` field rather than a `message` field. The `delta` field can hold a role token, content token, or nothing.

```
{ role: 'assistant', content: '', refusal: null }
****************
{ content: 'Why' }
****************
{ content: " don't" }
****************
{ content: ' scientists' }
****************
{ content: ' trust' }
****************
{ content: ' atoms' }
****************
{ content: '?\n\n' }
****************
{ content: 'Because' }
****************
{ content: ' they' }
****************
{ content: ' make' }
****************
{ content: ' up' }
****************
{ content: ' everything' }
****************
{ content: '!' }
****************
{}
****************
```

To stream only the text response of your chat completion, your code would like this:

python

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
import OpenAI from "openai";
const client = new OpenAI();

const stream = await client.chat.completions.create({
  model: "gpt-5.6",
  messages: [
    {
      role: "user",
      content: "Say 'double bubble bath' ten times fast.",
    },
  ],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

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
from openai import OpenAI

client = OpenAI()

stream = client.chat.completions.create(
    model="gpt-5.6",
    messages=[
        {
            "role": "user",
            "content": "Say 'double bubble bath' ten times fast.",
        },
    ],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

## Advanced use cases

For more advanced use cases, like streaming tool calls, check out the following dedicated guides:

- [Streaming function calls](function-calling.md)
- [Streaming structured output](structured-outputs.md)

## Moderation risk

Note that streaming the model’s output in a production application makes it more difficult to moderate the content of the completions, as partial completions may be more difficult to evaluate. This may have implications for approved usage.

If you request [moderation scores with a generation request](moderation.md), the scores arrive after the full generated output is available. They aren’t included with partial output deltas.