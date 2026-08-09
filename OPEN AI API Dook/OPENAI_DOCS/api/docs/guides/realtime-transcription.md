---
source_url: https://developers.openai.com/api/docs/guides/realtime-transcription
fetched_at: 2026-07-27T01:58:10Z
---

# Realtime transcription

Copy Page

Use realtime transcription when your application needs live speech-to-text without a spoken assistant response. Realtime transcription sessions stream transcript deltas as audio arrives, so users can see text before the full utterance is complete.

For the lowest-latency streaming transcription path, use [`gpt-realtime-whisper`](../models/gpt-realtime-whisper.md). For offline files or workflows that don’t need streaming deltas, use the standard speech-to-text models in the Audio API.

## Choose a transcription model

| Model | Best for | Notes |
| --- | --- | --- |
| [gpt-realtime-whisper](../models/gpt-realtime-whisper.md) | Live audio, transcript deltas, tunable latency. | Natively streaming and designed for realtime sessions. |
| [gpt-4o-transcribe](../models/gpt-4o-transcribe.md) | Higher-accuracy speech-to-text where streaming isn’t required. | Use for file and request-response transcription workflows. |
| [gpt-4o-mini-transcribe](../models/gpt-4o-mini-transcribe.md) | Lower-cost transcription. | Use when cost matters more than top accuracy. |
| [whisper-1](../models/whisper-1.md) | Existing Whisper integrations. | Not natively streaming in the same way as `gpt-realtime-whisper`. |

`gpt-realtime-whisper` is an alternative for live transcription, not a blanket replacement for every transcription model. Test it against your audio, languages, vocabulary, and latency requirements before switching production traffic.

## Create a transcription session

Realtime transcription uses a session with `type: "transcription"`. You can connect with [WebSocket](realtime-websocket.md) for server-side audio pipelines or [WebRTC](realtime-webrtc.md) for browser audio.

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
{
  "type": "session.update",
  "session": {
    "type": "transcription",
    "audio": {
      "input": {
        "format": {
          "type": "audio/pcm",
          "rate": 24000
        },
        "transcription": {
          "model": "gpt-realtime-whisper",
          "language": "en"
        }
      }
    }
  }
}
```

### Session fields

- `type`: Set to `transcription` for transcription-only sessions.
- `audio.input.format`: Input encoding for audio appended to the buffer. Use 24 kHz mono PCM when sending `audio/pcm`.
- `audio.input.transcription.model`: Use `gpt-realtime-whisper` for streaming transcription.
- `audio.input.transcription.language`: Optional language hint such as `en`.
- `audio.input.transcription.delay`: Optional latency/accuracy tradeoff for `gpt-realtime-whisper`. Supported values are `minimal`, `low`, `medium`, `high`, and `xhigh`.
- `audio.input.turn_detection`: Optional voice activity detection for models that support it. For `gpt-realtime-whisper`, omit this field or set it to `null`, then commit audio manually.

## Stream audio

Send audio chunks with `input_audio_buffer.append`:

```
1
2
3
4
5
6
ws.send(
  JSON.stringify({
    type: "input_audio_buffer.append",
    audio: base64Pcm16,
  })
);
```

If you disable turn detection, commit the buffer when you want transcription to begin:

```
1
2
3
4
5
ws.send(
  JSON.stringify({
    type: "input_audio_buffer.commit",
  })
);
```

For models that support server VAD, the session commits audio automatically when it detects a turn boundary.

## Handle transcript events

Listen for incremental transcript deltas and completion events:

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
ws.on("message", (data) => {
  const event = JSON.parse(data);

  if (event.type === "conversation.item.input_audio_transcription.delta") {
    process.stdout.write(event.delta);
  }

  if (event.type === "conversation.item.input_audio_transcription.completed") {
    console.log("\nFinal transcript:", event.transcript);
  }
});
```

A delta event contains newly available transcript text:

```
1
2
3
4
5
6
{
  "type": "conversation.item.input_audio_transcription.delta",
  "item_id": "item_003",
  "content_index": 0,
  "delta": "Hello,"
}
```

A completion event contains the final transcript for the committed item:

```
1
2
3
4
5
6
{
  "type": "conversation.item.input_audio_transcription.completed",
  "item_id": "item_003",
  "content_index": 0,
  "transcript": "Hello, how are you?"
}
```

Ordering between completion events from different speech turns isn’t guaranteed. Use `item_id` to match transcription events to committed input items.

## Tune latency and accuracy

Streaming transcription trades latency for transcript quality. Lower delay settings can produce earlier partial text. Higher delay settings give the model more audio context before emitting text and can improve word error rate.

Start by setting `audio.input.transcription.delay` and testing against your real audio. Useful starting points are:

- `minimal` for the most latency-sensitive interactions;
- `low` for low-latency live captions;
- `medium` for a balanced latency/accuracy tradeoff;
- `high` when accuracy matters more than immediate display;
- `xhigh` when your workflow can tolerate the most delay for additional context.

The exact delay in milliseconds can vary by model configuration, so benchmark with representative audio instead of assuming a fixed timing per level.

Don’t choose a setting from synthetic audio alone. Test with representative microphones, telephony audio, accents, background noise, code-switching, domain vocabulary, and long sessions.

## Guide vocabulary and domain terms

If your application depends on exact domain vocabulary, include a language hint and use prompt or keyword steering only when your selected model supports it. For `gpt-realtime-whisper` in GA Realtime sessions, `prompt` is not supported.

Where prompt steering is available, use short keyword lists rather than long instructions. The model is already instructed to transcribe, so focus prompts on domain vocabulary, spelling, or style rather than re-stating the transcription task.

Example keyword style:

```
Keywords: metoprolol, atorvastatin, A1C, systolic, diastolic
```

For production, treat keyword steering as an aid rather than a guarantee. Continue to evaluate names, numbers, dates, medication names, product names, artist names, and other high-value entities manually.

## Handle confidence, timestamps, and diarization

Only request optional fields that your selected model and endpoint support. If your application needs confidence scoring, timestamps, or diarization, verify support before launch and add fallbacks for fields that aren’t available.

When log probabilities are available, request them with `include`:

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
{
  "type": "session.update",
  "session": {
    "type": "transcription",
    "audio": {
      "input": {
        "transcription": {
          "model": "gpt-realtime-whisper"
        }
      }
    },
    "include": ["item.input_audio_transcription.logprobs"]
  }
}
```

## Production checklist

- Pick a target latency and accuracy threshold before tuning.
- Test against real production audio, not only clean samples.
- Test each target language.
- Include numbers, dates, currency, email addresses, product names, and domain terms in your eval set.
- Track empty, truncated, and delayed transcripts apart from word error rate.
- Decide how your UI should revise partial text when later deltas correct earlier text.
- Use `item_id` to order and reconcile final transcripts.
- Keep a fallback path for unsupported timestamps, diarization, or confidence fields.

## Related guides

[Realtime and audio overview

Compare voice-agent, translation, and transcription sessions.](realtime.md)
[Realtime translation

Translate live speech with a dedicated translation session.](realtime-translation.md)
[WebSocket connection

Stream raw audio through a server-side media pipeline.](realtime-websocket.md)
[Voice activity detection

Configure turn detection for live audio streams.](realtime-vad.md)