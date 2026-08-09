---
source_url: https://developers.openai.com/api/docs/guides/audio
fetched_at: 2026-07-27T01:57:22Z
---

# Audio and speech

Copy Page

Audio models can understand spoken input, generate spoken output, or do both in the same interaction. This guide explains the vocabulary used across OpenAI’s audio docs. When you’re ready to choose an implementation path, start with the [Realtime and audio overview](realtime.md).

## Audio modalities

An audio application combines one or more of these modalities:

| Modality | Meaning | Common use cases |
| --- | --- | --- |
| Audio input | The model receives sound from a user or app. | Voice agents, transcription, translation. |
| Audio output | The model or API returns spoken audio. | Voice agents, text to speech, spoken responses. |
| Text transcript | Speech becomes text. | Captions, call analysis, search, records. |
| Text prompt | Text controls what the model says or does. | Speech generation, scripted voice flows, prompts. |

## Common speech tasks

**Speech to text** converts speech into text. Use it for captions, notes, transcripts, analytics, search, and accessibility. Transcription can be request-based for files or streaming for live audio.

**Text to speech** converts text into spoken audio. Use it for narration, assistants, accessibility, and generated voice responses. Speech generation can stream audio back as the model produces it.

**Speech to speech** lets a model listen, reason, and speak in one low-latency session. Use it for conversational voice agents when the assistant needs to respond, call tools, or maintain session state.

**Speech translation** listens to speech in one language and returns translated speech or transcript output in another language. Use a dedicated realtime translation session when translation should begin continuously as audio arrives.

## Streaming and latency

Streaming means the client and service exchange partial input or output while the interaction is still active. Streaming is useful when users expect immediate feedback, such as live captions, calls, voice agents, and translation.

Lower latency requires a realtime connection, more careful audio handling, and a session model that can emit partial events. Request-based APIs are simpler for file uploads and non-interactive work, but they don’t support the same live interaction patterns.

## Request-based APIs and realtime sessions

OpenAI supports two broad audio architectures:

| Architecture | Use when | Examples |
| --- | --- | --- |
| Request-based audio APIs | You have a file, a text input, or a bounded request. | [Speech to text](speech-to-text.md), [text to speech](text-to-speech.md). |
| Realtime sessions | Audio is live and the app needs low-latency events. | [Voice agents](voice-agents.md), [translation](realtime-translation.md), [transcription](realtime-transcription.md). |
| Multimodal chat completions | You are extending an existing chat flow with audio. | [Audio input or output](#add-audio-to-your-existing-application). |

For build-path guidance, see the [Realtime and audio overview](realtime.md).

## Add audio to your existing application

Models such as [`gpt-realtime-2.1`](../models/gpt-realtime-2.md) and [`gpt-audio-1.5`](../models/gpt-audio-1.md) are natively multimodal, meaning they can understand and generate audio and text as input and output.

For live browser speech-to-speech interactions, start with a realtime session in the JavaScript SDK:

Start a realtime voice session

javascript

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
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const agent = new RealtimeAgent({
  name: "Assistant",
  instructions: "You are a helpful voice assistant.",
});

const session = new RealtimeSession(agent, {
  model: "gpt-realtime-2.1",
});

await session.connect({
  apiKey: "ek_...(ephemeral key from your server)",
});
```

This example uses JavaScript because browser voice agents connect with WebRTC from the client. For Python voice workflows, use the [Voice agents guide](voice-agents.md), which covers chained voice pipelines.

If you already have a text-based LLM application with the [Chat Completions endpoint](../api-reference/chat/index.md), you may want to add audio capabilities. For example, if your chat application supports text input, you can add audio input and output: include `audio` in the `modalities` array and use an audio model, like [`gpt-audio-1.5`](../models/gpt-audio-1.md).

The [Responses API](../api-reference/responses.md) docs currently describe
text and image inputs with text outputs. For this audio-chat pattern, use Chat
Completions with an audio-capable model.

Audio output from modelAudio input to model

Audio output from model

Create a human-like audio response to a prompt

javascript

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
import { writeFileSync } from "node:fs";
import OpenAI from "openai";

const openai = new OpenAI();

// Generate an audio response to the given prompt
const response = await openai.chat.completions.create({
  model: "gpt-audio-1.5",
  modalities: ["text", "audio"],
  audio: { voice: "alloy", format: "wav" },
  messages: [
    {
      role: "user",
      content: "Is a golden retriever a good family dog?",
    },
  ],
  store: true,
});

// Inspect returned data
console.log(response.choices[0]);

// Write audio data to a file
writeFileSync(
  "dog.wav",
  Buffer.from(response.choices[0].message.audio.data, "base64"),
  { encoding: "utf-8" }
);
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
import base64
from openai import OpenAI

client = OpenAI()

completion = client.chat.completions.create(
    model="gpt-audio-1.5",
    modalities=["text", "audio"],
    audio={"voice": "alloy", "format": "wav"},
    messages=[{"role": "user", "content": "Is a golden retriever a good family dog?"}],
)

print(completion.choices[0])

wav_bytes = base64.b64decode(completion.choices[0].message.audio.data)
with open("dog.wav", "wb") as f:
    f.write(wav_bytes)
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
curl "https://api.openai.com/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
      "model": "gpt-audio-1.5",
      "modalities": ["text", "audio"],
      "audio": { "voice": "alloy", "format": "wav" },
      "messages": [
        {
          "role": "user",
          "content": "Is a golden retriever a good family dog?"
        }
      ]
    }'
```

Audio input to model

Use audio inputs for prompting a model

javascript

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
import OpenAI from "openai";
const openai = new OpenAI();

// Fetch an audio file and convert it to a base64 string
const url = "https://cdn.openai.com/API/docs/audio/alloy.wav";
const audioResponse = await fetch(url);
const buffer = await audioResponse.arrayBuffer();
const base64str = Buffer.from(buffer).toString("base64");

const response = await openai.chat.completions.create({
  model: "gpt-audio-1.5",
  modalities: ["text", "audio"],
  audio: { voice: "alloy", format: "wav" },
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What is in this recording?" },
        {
          type: "input_audio",
          input_audio: { data: base64str, format: "wav" },
        },
      ],
    },
  ],
  store: true,
});

console.log(response.choices[0]);
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
import base64
import requests
from openai import OpenAI

client = OpenAI()

# Fetch the audio file and convert it to a base64 encoded string
url = "https://cdn.openai.com/API/docs/audio/alloy.wav"
response = requests.get(url)
response.raise_for_status()
wav_data = response.content
encoded_string = base64.b64encode(wav_data).decode("utf-8")

completion = client.chat.completions.create(
    model="gpt-audio-1.5",
    modalities=["text", "audio"],
    audio={"voice": "alloy", "format": "wav"},
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is in this recording?"},
                {
                    "type": "input_audio",
                    "input_audio": {"data": encoded_string, "format": "wav"},
                },
            ],
        },
    ],
)

print(completion.choices[0].message)
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
20
21
22
23
curl "https://api.openai.com/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
      "model": "gpt-audio-1.5",
      "modalities": ["text", "audio"],
      "audio": { "voice": "alloy", "format": "wav" },
      "messages": [
        {
          "role": "user",
          "content": [
            { "type": "text", "text": "What is in this recording?" },
            { 
              "type": "input_audio", 
              "input_audio": { 
                "data": "<base64 bytes here>", 
                "format": "wav" 
              }
            }
          ]
        }
      ]
    }'
```