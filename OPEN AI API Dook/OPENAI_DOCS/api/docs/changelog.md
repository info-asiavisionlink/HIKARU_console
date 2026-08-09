---
source_url: https://developers.openai.com/api/docs/changelog
fetched_at: 2026-07-27T01:55:24Z
---

# Changelog

Upcoming deprecations can be found on the [deprecations page](deprecations.md).

### July, 2026

Jul 22

Feature

Added hard spend limits for organizations and projects on the OpenAI API platform. Set a monthly cap that causes affected API requests to return a `429` error when tracked spend reaches the limit. Use spend alerts for notification before traffic is interrupted. Read more in the [spend limits guide](guides/spend-limits.md).

Jul 9

Feature

gpt-5.6-sol

gpt-5.6-terra

gpt-5.6-luna

v1/responses

v1/chat/completions

v1/batch

Released the [GPT-5.6 model family](guides/latest-model.md), including GPT-5.6 Sol for frontier capability, GPT-5.6 Terra for a balance of intelligence and cost, and GPT-5.6 Luna for efficient, high-volume workloads. The `gpt-5.6` alias routes requests to `gpt-5.6-sol`.

GPT-5.6 adds [Programmatic Tool Calling](guides/tools-programmatic-tool-calling.md), [explicit prompt caching controls](guides/prompt-caching.md), [persisted reasoning, `max` reasoning effort, and Pro mode](guides/reasoning.md), and [Multi-agent orchestration in beta for the Responses API](guides/responses-multi-agent.md). GPT-5.6 also accepts images at their original dimensions with `original` or `auto` image detail.

Jul 6

Feature

gpt-realtime-2.1

gpt-realtime-2.1-mini

v1/realtime

Released [GPT-Realtime-2.1](models/gpt-realtime-2.md), an updated realtime reasoning model with improved alphanumeric recognition, silence and noise handling, and interruption behavior. Also released [GPT-Realtime-2.1 mini](models/gpt-realtime-2.md), a faster, lower-cost distilled reasoning model for realtime voice applications.

### June, 2026

Jun 24

Update

chat-latest

Updated the `chat-latest` snapshot, which points to the latest Instant model currently used in ChatGPT. We recommend leveraging [GPT-5.5](models/gpt-5.md) for production API usage, but feel free to use this model to test the latest improvements for chat use cases. The underlying model snapshot will be regularly updated. Read more [here](models/chat-latest.md).

Jun 23

Feature

Released the Safety Usage Dashboard on the OpenAI API platform. The Safety dashboard shows blocked Responses requests based on `safety_identifier` values sent on requests to identify end users. Visit the [Safety dashboard](https://platform.openai.com/usage/safety).

Jun 9

Feature

v1/responses

Web search can now return image results alongside regular text results. Use image search when your application needs current or web-grounded visuals, such as product photos, landmarks, places, events, or visual references. Read more in the [web search guide](guides/tools-web-search.md).

Jun 5

Update

Released a redesigned navigation for the OpenAI API platform, visit [here](https://platform.openai.com/login).

Jun 4

Feature

omni-moderation-latest

v1/responses

v1/chat/completions

Added moderation scores to the Responses API and Chat Completions API. Pass a `moderation` object in a generation request to receive moderation results for both the model input and generated output in the same response.

Learn more in the [Moderation guide](guides/moderation.md).

Jun 3

Update

Announced the deprecation of reusable prompt objects, the Evals platform, and Agent Builder. See the [deprecations page](deprecations.md) for shutdown timelines and migration guidance.

Jun 2

Update

Starting June 2, 2026, eligible container sessions will be billed per minute with a 5-minute minimum, instead of being billed at the full 20-minute session rate. The underlying per-minute rate will remain the same.

This update is intended to make billing more granular for shorter sessions and will lower effective cost for customers.

You can find current built-in tool pricing in our [API pricing docs](pricing.md).

Jun 1

Feature

gpt-5.4

gpt-5.5

v1/responses

OpenAI models are now available in Amazon Bedrock through an OpenAI-compatible Responses API endpoint. Supported models and features vary by AWS Region. [Learn more](guides/amazon-bedrock.md).

### May, 2026

May 29

Update

v1/responses

v1/chat/completions

v1/batch

For organizations without ZDR enabled, `prompt_cache_retention` now defaults to `24h` instead of `in_memory`, enabling extended prompt caching by default. [Learn more](guides/prompt-caching.md).

May 28

Update

chat-latest

Released `chat-latest` snapshot which points to the latest Instant model currently used in ChatGPT. We recommend leveraging [GPT-5.5](models/gpt-5.md) for production API usage, but feel free to use this model to test the latest improvements for chat use cases. The underlying model snapshot will be regularly updated. Read more [here](models/chat-latest.md).

May 26

Feature

Released [workload identity federation](guides/workload-identity-federation.md). Trusted workloads can exchange externally issued identity tokens for short-lived OpenAI access tokens without storing long-lived API keys.

May 26

Update

Added new [Admin API](guides/admin-apis.md) capabilities for managing spend alerts, model allowlists, data retention settings, and hosted tool permissions, plus querying granular billing line items.

May 19

Feature

Released [Secure MCP Tunnel](guides/secure-mcp-tunnels.md) for enterprise customers. Secure MCP Tunnel lets supported OpenAI products including ChatGPT web, Codex, Responses API, and AgentKit connect to private or on-prem MCP servers through a customer-hosted `tunnel-client` without exposing those servers to the public internet.

May 19

Update

You can now manage multiple IP allowlists and apply each one at the project level or across the whole organization. To configure them, go to [Settings > Security > IP allowlist](https://platform.openai.com/settings/organization/security/ip-allowlist).

May 12

Update

dall-e-2

dall-e-3

v1/realtime

Deprecated DALL·E model snapshots and the Realtime API Beta.

DALL·E model snapshots `dall-e-2` and `dall-e-3` were deprecated and removed from the API on May 12, 2026. We recommend using `gpt-image-2`, `gpt-image-1`, or `gpt-image-1-mini` instead.

The Realtime API Beta was deprecated and removed from the API on May 12, 2026. If you are still using the beta interface, migrate to the released Realtime API. See [the migration guide](guides/realtime.md) and the full [deprecations page](deprecations.md).

May 11

Feature

v1/responses

Added `return_token_budget` for the Responses API [web search tool](guides/tools-web-search.md). Use it to opt in to longer GPT-5+ reasoning web search runs for high-effort research and evaluation workloads.

May 7

Feature

gpt-realtime-2

gpt-realtime-translate

gpt-realtime-whisper

v1/realtime

v1/realtime/translations

v1/realtime/transcription\_sessions

Released [GPT-Realtime-2](models/gpt-realtime-2.md), a new realtime voice model with configurable reasoning for speech-to-speech agents, along with [GPT-Realtime-Translate](models/gpt-realtime-translate.md) for streaming speech translation and [GPT-Realtime-Whisper](models/gpt-realtime-whisper.md) for streaming speech-to-text.

Updated the [Realtime and audio guide](guides/realtime.md), added a dedicated [Realtime translation guide](guides/realtime-translation.md), refreshed [Realtime transcription](guides/realtime-transcription.md) for streaming transcripts, and moved realtime prompting guidance into [Using realtime models](guides/realtime-models-prompting.md).

May 7

Feature

Released the [OpenAI Developers plugin for Codex](https://developers.openai.com/learn/developers-codex-plugin). This helps you build AI applications and agents in Codex with OpenAI Platform access and OpenAI API setup guidance.

May 6

Update

The updated Agents SDK is now available in TypeScript, with support for sandbox agents and an open-source harness built in. Learn more [here](guides/agents.md).

May 5

Update

chat-latest

Released `chat-latest` snapshot which points to the latest Instant model currently used in ChatGPT. We recommend leveraging [GPT-5.5](guides/latest-model.md) for production API usage, but feel free to use this model to test our latest improvements for chat use cases. The underlying model snapshot will be regularly updated. Read more [here](models/chat-latest.md).

May 4

Update

Admin APIs are now supported in the OpenAI SDKs for Node, Python, Go, Ruby, and Java. See the [Admin APIs guide](guides/admin-apis.md) for setup instructions and examples.

### April, 2026

Apr 24

Feature

gpt-5.5

gpt-5.5-pro

v1/responses

v1/chat/completions

v1/batch

Released [GPT-5.5](models/gpt-5.md), a new frontier model for complex professional work, to the Chat Completions and Responses API, and released [GPT-5.5 Pro](models/gpt-5.md) for Responses API requests for tougher problems that benefit from more compute.

GPT-5.5 supports a 1M token context window, image input, structured outputs, function calling, prompt caching, Batch, tool search, built-in computer use, hosted shell, apply patch, Skills, MCP, and web search. Key updates include:

- Reasoning effort now defaults to `medium`.
- When `image_detail` is unset or set to `auto`, the model now uses [original behavior](guides/latest-model.md).
- Caching for GPT-5.5 only works with extended prompt caching. In-memory prompt caching is not supported.
  Learn more [here](guides/latest-model.md).

Apr 21

Feature

gpt-image-2

v1/images/generations

v1/images/edits

v1/batch

Released [GPT Image 2](models/gpt-image-2.md), a state-of-the-art image generation model for image generation and editing. GPT Image 2 supports flexible image sizes, high-fidelity image inputs, token-based image pricing, and Batch API support with a 50% discount.

Apr 15

Update

Updated the [Agents SDK](guides/agents.md) with new capabilities, including:

- running agents in controlled sandboxes;
- inspecting and customizing the open-source harness; and
- controlling when memories are created and where they're stored.

### March, 2026

Mar 17

Feature

gpt-5.4-mini

gpt-5.4-nano

v1/responses

v1/chat/completions

Released [GPT-5.4 mini](models/gpt-5.md) and [GPT-5.4 nano](models/gpt-5.md) to the Chat Completions and Responses API. GPT-5.4 mini brings GPT-5.4-class capabilities to a faster, more efficient model for high-volume workloads, while GPT-5.4 nano is optimized for simple high-volume tasks where speed and cost matter most.

GPT-5.4 mini supports [tool search](guides/tools-tool-search.md), built-in [computer use](guides/tools-computer-use.md), and [compaction](guides/compaction.md). GPT-5.4 nano supports compaction, but does not support tool search or computer use.

Mar 16

Update

gpt-5.3-chat-latest

Updated the [gpt-5.3-chat-latest](models/gpt-5.md) slug to point to the latest model currently used in ChatGPT.

Mar 13

Fix

gpt-5.4

v1/responses

v1/chat/completions

Updated our image encoder to fix a small bug with `input_image` inputs in GPT-5.4. Some image understanding use cases may now see improved quality. No action is required.

Mar 12

Feature

sora-2

sora-2-pro

v1/videos

v1/videos/characters

v1/videos/extensions

v1/batch

Expanded the Sora API with reusable character references, longer generations up to `20` seconds, `1080p` output for `sora-2-pro`, video extensions, and Batch API support for `POST /v1/videos`. `1080p` generations on `sora-2-pro` are billed at `$0.70` per second. Learn more [here](guides/video-generation.md).

Mar 12

Update

sora-2

sora-2-pro

v1/videos/edits

v1/videos/{video\_id}/remix

Added `POST /v1/videos/edits` for editing existing videos. This will replace `POST /v1/videos/{video_id}/remix`, which will be deprecated in `6` months. Learn more [here](guides/video-generation.md).

Mar 5

Feature

gpt-5.4

gpt-5.4-pro

v1/responses

v1/chat/completions

Released [GPT-5.4](models/gpt-5.md), our newest frontier model for professional work, to the Chat Completions and Responses API, and released [GPT-5.4 Pro](models/gpt-5.md) to the Responses API for tougher problems that benefit from more compute.

Also released:

- [Tool search](guides/tools-tool-search.md) in the Responses API, which lets models defer large tool surfaces until runtime to reduce token usage, preserve cache performance, and improve latency.
- Built-in [Computer use](guides/tools-computer-use.md) support in GPT-5.4 through the Responses API `computer` tool for screenshot-based UI interaction.
- A 1M token context window and native [Compaction](guides/compaction.md) support for longer-running agent workflows.

Mar 3

Feature

gpt-5.3-chat-latest

v1/chat/completions

v1/responses

Released `gpt-5.3-chat-latest` to the Chat Completions and Responses API. This model points to the GPT-5.3 Instant snapshot currently used in ChatGPT. Read more [here](models/gpt-5.md).

### February, 2026

Feb 24

Feature

v1/responses

v1/chat/completions

Expanded `input_file` support to accept more document, presentation, spreadsheet, code, and text file types. Learn more [here](guides/file-inputs.md).

Feb 24

Feature

v1/responses

Released `phase` to the Responses API. It labels an assistant message as intermediate commentary (`commentary`) or the final answer (`final_answer`). Read more [here](https://developers.openai.com/api/reference/resources/responses/methods/create#(resource)%20responses%20%3E%20(model)%20easy_input_message%20%3E%20(schema)%20%3E%20(property)%20phase).

Feb 24

Feature

gpt-5.3-codex

v1/responses

Released `gpt-5.3-codex` to the Responses API. Read more [here](models/gpt-5.md).

Feb 23

Feature

v1/responses

Launched WebSocket mode for the Responses API. Learn more [here](guides/websocket-mode/index.md).

Feb 23

Feature

gpt-realtime-1.5

gpt-audio-1.5

v1/realtime

v1/chat/completions

Released [GPT-Realtime-1.5](models/gpt-realtime-1.md) to the Realtime API.

Released `gpt-audio-1.5` to the Chat Completions API. Read more [here](models/gpt-audio-1.md).

Feb 10

Feature

gpt-image-1.5

gpt-image-1

gpt-image-1-mini

chatgpt-image-latest

v1/batch

[Batch API](guides/batch.md) is now supported for GPT Image models: `gpt-image-1.5`, `chatgpt-image-latest`, `gpt-image-1`, and `gpt-image-1-mini`.

Feb 10

Update

gpt-5.2-chat-latest

Updated the [gpt-5.2-chat-latest](models/gpt-5.md) slug to point to the latest model currently used in ChatGPT.

Feb 10

Feature

v1/responses

Launched [server-side compaction](guides/context-management.md) in the Responses API.

Feb 10

Feature

v1/responses

Launched support for [Skills](guides/tools-skills.md) in the Responses API. We support Skills across both local execution and hosted container-based execution.

Feb 10

Feature

v1/responses

Launched a new [Hosted Shell](guides/tools-shell.md) tool, as well as support for networking in containers.

Feb 9

Feature

gpt-image-1.5

gpt-image-1

gpt-image-1-mini

chatgpt-image-latest

v1/images/edits

Added support for `application/json` requests on `/v1/images/edits` for GPT image models. JSON requests use `images` (and optional `mask`) with `image_url` or `file_id` references instead of multipart uploads.

Feb 3

Update

gpt-5.2

gpt-5.2-codex

We have optimized our inference stack for API customers and [GPT-5.2](https://platform.openai.com/docs/models/gpt-5.2) and [GPT-5.2-Codex](https://platform.openai.com/docs/models/gpt-5.2-codex) now run ~40% faster. Model and model weights are unchanged.

### January, 2026

Jan 15

Announcement

Announced [Open Responses](https://www.openresponses.org/): an open-source spec for building multi-provider, interoperable LLM interfaces built on top of the original OpenAI Responses API.

Jan 14

Feature

gpt-5.2-codex

v1/responses

Released `gpt-5.2-codex` to the Responses API. GPT-5.2-Codex is a version of GPT-5.2 optimized for agentic coding tasks in Codex or similar environments. Read more [here](https://platform.openai.com/docs/models/gpt-5.2-codex).

Jan 13

Feature

v1/realtime

Added dedicated SIP IP ranges for Realtime API. `sip.api.openai.com` does GeoIP routing, and will direct SIP traffic to the closest region. [Learn more](guides/realtime-sip.md).

Jan 13

Update

gpt-realtime-mini

gpt-audio-mini

Updated the [`gpt-realtime-mini`](models/gpt-realtime-mini.md) and [`gpt-audio-mini`](https://platform.openai.com/docs/models/gpt-audio-mini) slugs to point to the 2025-12-15 snapshots. If you need the previous model snapshots, use `gpt-realtime-mini-2025-10-06` and `gpt-audio-mini-2025-10-06`.

Jan 13

Update

sora-2

Updated the [sora-2](https://platform.openai.com/docs/models/sora-2) slug to point to `sora-2-2025-12-08`. If you need the previous model snapshot, use `sora-2-2025-10-06`.

Jan 13

Update

gpt-4o-mini-tts

gpt-4o-mini-transcribe

Updated the `gpt-4o-mini-tts` and `gpt-4o-mini-transcribe` slugs to point to the `2025-12-15` snapshots. If you need the previous model snapshots, use `gpt-4o-mini-tts-2025-03-20` and `gpt-4o-mini-transcribe-2025-03-20`. We currently recomend using `gpt-4o-mini-transcribe` over `gpt-4o-transcribe` for the best results.

Jan 9

Fix

gpt-image-1.5

chatgpt-image-latest

Fixed an issue where `gpt-image-1.5` and `chatgpt-image-latest` were incorrectly using high fidelity for image edits through `/v1/images/edits`, even when `fidelity` was explicitly set to `low` (the default).

### December, 2025

Dec 19

Update

gpt-image-1.5

chatgpt-image-latest

Added `gpt-image-1.5` and `chatgpt-image-latest` to the Responses API image generation tool.

Dec 16

Feature

gpt-image-1.5

chatgpt-image-latest

Released [gpt-image-1.5](https://platform.openai.com/docs/models/gpt-image-1.5) and [chatgpt-image-latest](https://platform.openai.com/docs/models/chatgpt-image-latest), our latest and most advanced models for image generation. Read more [here](https://platform.openai.com/docs/guides/image-generation).

Dec 15

Feature

gpt-realtime-mini

gpt-audio-mini

gpt-4o-mini-transcribe

gpt-4o-mini-tts

Released four new dated audio snapshots. These updates deliver reliability, quality, and voice fidelity improvements for real-time, voice-driven applications. Read more [here](/blog/updates-audio-models).

- gpt-realtime-mini-2025-12-15
- gpt-audio-mini-2025-12-15
- gpt-4o-mini-transcribe-2025-12-15
- gpt-4o-mini-tts-2025-12-15

This launch also includes support for [Custom voices](https://platform.openai.com/docs/guides/text-to-speech#custom-voices) for eligible customers.

Dec 11

Feature

gpt-5.2

gpt-5.2-chat-latest

v1/responses

v1/chat/completions

Released [GPT-5.2](https://platform.openai.com/docs/models/gpt-5.2), the newest flagship model in the GPT-5 model family. GPT-5.2 shows improvements over the previous GPT-5.1 in:

- General intelligence
- Instruction following
- Accuracy and token efficiency
- Multimodality—especially vision
- Code generation—especially front-end UI creation
- Tool calling and context management in the API
- Spreadsheet understanding and creation.

What's new in 5.2 is a new xhigh reasoning effort level, concise reasoning summaries, and new context management using compaction.

Dec 11

Feature

v1/responses/compact

Released [client-side compaction](https://platform.openai.com/docs/guides/conversation-state#compaction-advanced). For long-running conversations with the Responses API, you can use the `/responses/compact` endpoint to shrink the context you send with each turn.

Dec 4

Feature

gpt-5.1-codex-max

v1/responses

Released `gpt-5.1-codex-max` to the Responses API. GPT-5.1-Codex is our most intelligent coding model optimized for long-horizon, agentic coding tasks. Read more [here](https://platform.openai.com/docs/models/gpt-5.1-codex-max).

### November, 2025

Nov 20

Feature

v1/realtime

Added support for DTMF key presses in the Realtime API. You can now receive DTMF events while using a Realtime sideband connection. See [docs here](https://platform.openai.com/docs/api-reference/realtime-server-events/input_audio_buffer/dtmf_event_received) for more information.

Nov 13

Feature

gpt-5.1

gpt-5.1-codex

gpt-5.1-chat-latest

gpt-5.1-codex-mini

v1/responses

v1/chat/completions

Released [GPT-5.1](models/gpt-5.md), the newest flagship model in the GPT-5 model family. GPT-5.1 is trained to be especially proficient in:

- Steerability and faster responses when less thinking's required
- Code generation and coding use cases
- Agentic workflows

Note that GPT-5.1 defaults to a new `none` reasoning setting for faster responses when less thinking's required—different from the previous `medium` default setting in GPT-5.

Nov 13

Feature

Released [enhanced role-based access controls (RBAC)](https://platform.openai.com/docs/guides/rbac#page-top). Role-based access control (RBAC) lets you decide who can do what across your organization and projects—both through the API and in the Dashboard.

Nov 13

Feature

gpt-5.1-codex

gpt-5.1-codex-mini

v1/responses

Released `gpt-5.1-codex` and `gpt-5.1-codex-mini` to the Responses API. GPT-5.1-Codex is a version of GPT-5.1 optimized for agentic coding tasks in Codex or similar environments. Read more [here](https://platform.openai.com/docs/models/gpt-5.1-codex).

Nov 13

Feature

Released [extended prompt cache retention](https://platform.openai.com/docs/guides/prompt-caching#extended-prompt-cache-retention). Extended prompt cache retention keeps cached prefixes active for longer, up to a maximum of 24 hours. Extended Prompt Caching works by offloading the key/value tensors to GPU-local storage when memory is full, significantly increasing the storage capacity available for caching.

### October, 2025

Oct 29

Feature

gpt-oss-safeguard-120b

gpt-oss-safeguard-20b

gpt-oss-safeguard-120b and gpt-oss-safeguard-20b are safety reasoning models built-upon gpt-oss. Read more [here](https://huggingface.co/collections/openai/gpt-oss-safeguard).

Oct 24

Feature

Released [Enterprise Key Management (EKM)](https://platform.openai.com/docs/guides/your-data#enterprise-key-management-ekm). Enterprise Key Management (EKM) allows you to encrypt your customer content at OpenAI using keys managed by your own external Key Management System (KMS).

Oct 24

Feature

Released [UK data residency](https://platform.openai.com/docs/guides/your-data#data-residency-controls).

Oct 6

Feature

gpt-5-pro

gpt-realtime-mini

gpt-audio-mini

gpt-image-1-mini

sora-2

sora-2-pro

v1/responses

v1/batch

v1/chat/completions

v1/videos

v1/realtime

v1/images/generations

Released several new features at [OpenAI DevDay](https://openai.com/devday/):

Released [GPT-5 Pro](models/gpt-5-pro.md), a version of [GPT-5](models/gpt-5.md) that uses more compute to think harder and provide consistently better answers.

Released [GPT-Realtime mini](models/gpt-realtime-mini.md) and [gpt-audio-mini](models/gpt-audio-mini.md) for more cost-efficient speech to speech performance.

Released [gpt-image-1-mini](models/gpt-image-1-mini.md) for more cost-efficient image generation and editing.

Launched [v1/videos](guides/video-generation.md) for rich, detailed, and dynamic video generation and remixing with our latest [Sora 2](models/sora-2.md) and [Sora 2 Pro](models/sora-2-pro.md) models.

Launched [Agent Builder](guides/agent-builder.md) for visually creating custom multi-agent workflows.

Launched [ChatKit](guides/chatkit.md), an embeddable chat interface for deploying agents.

Released [Trace Evals, Datasets, and Prompt Optimization tools](guides/agent-evals.md).

[Evals](guides/evals.md): Released Third-Party Model Support.

Launched [Service health dashboard](https://platform.openai.com/settings/organization/service-health).

Oct 1

Feature

Released [IP allowlist](https://platform.openai.com/settings/organization/security/ip-allowlist). IP allowlisting restricts API access to only the IP addresses or ranges you specify.

### September, 2025

Sep 26

Feature

v1/responses

Added support for image and file as a [tool call output](docs/guides/function-calling#how-it-works) in Responses API.

Sep 23

Feature

gpt-5-codex

v1/responses

Launched special-purpose model [gpt-5-codex](models/gpt-5-codex.md), built and optimized for use with the [Codex CLI](https://github.com/openai/codex).

### August, 2025

Aug 28

Feature

v1/realtime

The OpenAI Realtime API is now generally available. Learn more [in our Realtime API guide](guides/realtime.md).

Aug 21

Feature

v1/responses

Added support for [connectors](guides/tools-connectors-mcp.md) to the Responses API. Connectors are OpenAI-maintained MCP wrappers for popular services like Google apps, Dropbox, and more that can be used to give model read access to data stored in those services.

Aug 20

Feature

v1/conversations

v1/responses

v1/assistants

Released the Conversations API, which allows you to create and manage long-running conversations with the Responses API. See the [migration guide](assistants/migration.md) to see a side-by-side comparison and learn how to migrate from an Assistants API integration to Responses and Conversations.

Aug 7

Feature

v1/chat/completions

v1/responses

Released GPT-5 family of models in the API, including [`gpt-5`](models/gpt-5.md), [`gpt-5-mini`](models/gpt-5-mini.md), and [`gpt-5-nano`](models/gpt-5-nano.md).

Introduced the `minimal` [reasoning effort](guides/reasoning.md) value to optimize for fast responses in GPT-5 models (which support reasoning).

Introduced `custom` [tool call](guides/function-calling.md) type, which allows for freeform inputs to and outputs from the model when tool calling.

### June, 2025

Jun 27

Feature

Launched support for [Priority processing](https://platform.openai.com/docs/guides/priority-processing). Priority processing delivers significantly lower and more consistent latency compared to Standard processing while keeping pay-as-you-go flexibility.

Jun 24

Feature

o3-deep-research

o3-deep-research-2025-06-26

o4-mini-deep-research

o4-mini-deep-research-2025-06-26

v1/responses

Released [o3-deep-research](models/o3-deep-research.md) and [o4-mini-deep-research](models/o4-mini-deep-research.md), deep research variants of our o-series reasoning models optimized for deep analysis and research tasks. Learn more in the [deep research guide](guides/deep-research.md).

Added support for async event handling with [webhooks](guides/webhooks.md). [Reduced and simplified pricing](pricing.md) for the web search tool. Added support for the [web search tool](guides/tools-web-search.md).

Jun 13

Feature

v1/responses

[New reusable prompts](/chat/edit) are now available in the dashboard and [Responses API](api-reference/responses/create.md). Via API, you can now reference templates created in the dashboard via the `prompt` parameter (with a prompt `id`, optional `version`) and supply dynamic `variables` that can include strings, images, or file inputs. Reusable prompts are not available in Chat Completions. [Learn more](guides/text.md).

Jun 10

Feature

o3-pro

v1/responses

v1/batch

Released [o3-pro](models/o3-pro.md), a version of the [o3](models/o3.md) reasoning model that uses more compute to answer hard problems with better reasoning and consistency. [Prices for the o3 model have also been reduced](pricing.md) for all API requests, including batch and flex processing.

Jun 4

Feature

v1/fine\_tuning

Added fine-tuning support with [direct preference optimization](guides/direct-preference-optimization.md) for the models `gpt-4.1-2025-04-14`, `gpt-4.1-mini-2025-04-14`, and `gpt-4.1-nano-2025-04-14`.

Jun 3

Feature

v1/chat/completions

v1/realtime

New model snapshots available for [gpt-4o-audio-preview](models/gpt-4o-audio-preview.md) and [gpt-4o-realtime-preview](models/gpt-4o-realtime-preview.md). Released [Agents SDK for TypeScript](https://openai.github.io/openai-agents-js).

### May, 2025

May 20

Feature

v1/responses

Added support for new built-in tools in the Responses API, including [remote MCP servers](guides/tools-remote-mcp.md) and [code interpreter](guides/tools-code-interpreter.md). [Learn more about tools](guides/tools.md).

May 20

Feature

v1/responses

v1/chat/completions

Added support for using `strict` mode for tool schemas when using parallel tool calling with non-fine-tuned models.
Added new [schema features](guides/structured-outputs.md), including string validation for `email` and other patterns and specifying ranges for numbers and arrays.

May 15

Feature

codex-mini-latest

v1/responses

v1/chat/completions

Launched [codex-mini-latest](models/codex-mini-latest.md) in the API, optimized for use with the [Codex CLI](https://github.com/openai/codex).

May 7

Feature

v1/fine-tuning

v1/responses

v1/chat/completions

Launched support for [reinforcement fine-tuning](guides/reinforcement-fine-tuning.md). Learn about available [fine-tuning methods](guides/fine-tuning.md). [gpt-4.1-nano](models/gpt-4.md) is now available for fine-tuning.

### April, 2025

Apr 30

Feature

Launched support for [Enhanced API Budget Alerts & Auto-recharge Limits](https://platform.openai.com/settings/organization/limits).

Apr 23

Feature

v1/images/generations

v1/images/edits

Added a new image generation model, `gpt-image-1`. This model sets a new standard for image generation, with improved quality and instruction following.

Updated the Image Generation and Edit endpoints to support new parameters specific to the `gpt-image-1` model.

Apr 16

Feature

v1/chat/completions

v1/responses

Added two new o-series reasoning models, `o3` and `o4-mini`. They set a new standard for math, science, and coding, visual reasoning tasks, and technical writing.

Launched Codex, our code generation CLI tool.

Apr 14

Feature

gpt-4.1

gpt-4.1-mini

gpt-4.1-nano

v1/responses

v1/chat/completions

v1/fine\_tuning

Added [`gpt-4.1`](models/gpt-4.md), [`gpt-4.1-mini`](models/gpt-4.md), and [`gpt-4.1-nano`](models/gpt-4.md) models to the API. These new models feature improved instruction following, coding, and a larger context window (up to 1M tokens). `gpt-4.1` and `gpt-4.1-mini` are available for supervised fine-tuning. Announced deprecation of [`gpt-4.5-preview`](deprecations.md).

### March, 2025

Mar 20

Update

v1/audio

Added `gpt-4o-mini-tts`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, and `whisper-1` models to the Audio API.

Mar 19

Feature

o1-pro

v1/responses

v1/batch

Released [o1-pro](models/o1-pro.md), a version of the [o1](models/o1.md) reasoning model that uses more compute to answer hard problems with better reasoning and consistency.

Mar 11

Feature

gpt-4o-search-preview

gpt-4o-mini-search-preview

computer-use-preview

v1/chat/completions

v1/assistants

v1/responses

Released several new models and tools and a new API for agentic workflows:

- Released the [Responses API](guides/responses-vs-chat-completions.md), a new API for creating and using agents and tools.
- Released a set of built-in tools for the Responses API: [web search](guides/tools-web-search.md), [file search](guides/tools-file-search.md), and [computer use](guides/tools-computer-use.md).
- Released the [Agents SDK](guides/agents.md), an orchestration framework for designing, building, and deploying agents.
- Announced new models: `gpt-4o-search-preview`, `gpt-4o-mini-search-preview`, `computer-use-preview`.
- Announced plans to bring all [Assistants API](assistants.md) features to the easier to use [Responses API](guides/responses-vs-chat-completions.md), with an anticipated sunset date for Assistants in 2026 (after achieving full feature parity).

Mar 3

Feature

v1/fine\_tuning/jobs

Added `metadata` field support to fine-tuning jobs.

### February, 2025

Feb 27

Feature

GPT-4.5

v1/chat/completions

v1/assistants

v1/batch

Released a research preview of [GPT-4.5](models/gpt-4-5.md)—our largest and most capable chat model yet. GPT-4.5's high "EQ" and understanding of user intent make it better at creative tasks and agentic planning.

Feb 25

Feature

Launched the [API Usage Dashboard Update](https://help.openai.com/en/articles/10478918-api-usage-dashboard). This update addresses requests for additional data filters, such as project selection, date picker, and fine-grained intervals. There’s also better support for viewing usage across different products and service tiers.

Feb 5

Feature

Introducing data residency in Europe. Read more [here](https://platform.openai.com/docs/guides/your-data).

### January, 2025

Jan 31

Feature

o3-mini

o3-mini-2025-01-31

v1/chat/completions

Launched [o3-mini](models/o3-mini.md), a new small reasoning model that is optimized for science, math, and coding tasks.

Jan 21

Feature

o1

Expanded access to [o1 model](https://platform.openai.com/docs/models/o1). The o1 series of models are trained with reinforcement learning to perform complex reasoning.

### December, 2024

Dec 18

Feature

Launched [Admin API Key Rotations](api-reference/admin-api-keys.md), enabling customers to programmatically rotate their admin api keys.

Updated [Admin API Invites](api-reference/invite.md), enabling customers to programmatically invite users to projects at the same time they are invited to organizations.

Dec 17

Feature

o1

gpt-4o

gpt-4o-mini

v1/fine\_tuning

v1/chat/completions

v1/realtime

Added new models for [o1](models/o1.md), [gpt-4o-realtime](models/gpt-4o-realtime-preview.md), [gpt-4o-audio](models/gpt-4o-audio-preview.md) and [more](models.md).

Added WebRTC connection method for the [Realtime API](guides/realtime.md).

Added [`reasoning_effort` parameter](api-reference/chat/create.md) for o1 models.

Added [`developer` message role](api-reference/chat/create.md) for o1 model. Note that o1-preview and o1-mini do not support system or developer messages.

Launched Preference Fine-tuning using [Direct Preference Optimization (DPO)](guides/fine-tuning.md).

Launched beta SDKs for Go and Java. [Learn more](libraries.md).

Added [Realtime API](guides/realtime.md) support in the [Python SDK](https://github.com/openai/openai-python).

Dec 4

Feature

Launched [Usage API](api-reference/usage.md), enabling customers to programmatically query activities and spending across OpenAI APIs.

### November, 2024

Nov 20

Update

v1/chat/completions

Released [gpt-4o-2024-11-20](models/gpt-4o.md), our newest model in the gpt-4o series.

Nov 4

Feature

v1/chat/completions

Released [Predicted Outputs](guides/predicted-outputs.md), which greatly reduces latency for model responses where much of the response is known ahead of time. This is most common when regenerating the content of documents and code files with only minor changes.

### October, 2024

Oct 30

Feature

gpt-4o-realtime-preview

gpt-4o-audio-preview

v1/chat/completions

Added five new voice types in the [Realtime API](guides/realtime.md) and [Chat Completions API](guides/audio.md).

Oct 17

Feature

gpt-4o-audio-preview

v1/chat/completions

Released [new `gpt-4o-audio-preview` model](guides/audio.md) for chat completions, which supports both audio inputs and outputs. Uses the same underlying model as the [Realtime API](guides/realtime.md).

Oct 1

Feature

v1/realtime

v1/chat/completions

v1/fine\_tuning

Released several new features at [OpenAI DevDay in San Francisco](https://openai.com/devday/):

[Realtime API](guides/realtime.md): Build fast speech-to-speech experiences into your applications using a WebSockets interface.

[Model distillation](guides/distillation.md): Platform for fine-tuning cost-efficient models with your outputs from a large frontier model.

[Image fine-tuning](guides/fine-tuning.md): Fine-tune GPT-4o with images and text to improve vision capabilities.

[Evals](guides/evals.md): Create and run custom evaluations to measure model performance on specific tasks.

[Prompt caching](guides/prompt-caching.md): Discounts and faster processing times on recently seen input tokens.

[Generate in playground](/chat/edit): Easily generate prompts, function definitions, and structured output schemas in the playground using the Generate button.

### September, 2024

Sep 26

Feature

omni-moderation-latest

v1/moderations

Released [new `omni-moderation-latest` moderation model](guides/moderation.md), which supports both images and text (for some categories), supports two new text-only harm categories, and has more accurate scores.

Sep 12

Feature

o1-preview

o1-mini

v1/chat/completions

Released [o1-preview and o1-mini](guides/reasoning.md), new large language models trained with reinforcement learning to perform complex reasoning tasks.

### August, 2024

Aug 29

Feature

v1/assistants

Assistants API now supports [including file search results used by the file search tool, and customizing ranking behavior](assistants/tools/file-search.md).

Aug 20

Feature

gpt-4o

v1/fine\_tuning

GA release for [`gpt-4o-2024-08-06` fine-tuning](guides/fine-tuning.md)—all API users can now fine-tune the latest GPT-4o model.

Aug 15

Update

gpt-4o

v1/chat/completions

Released [dynamic model for `chatgpt-4o-latest`](models/chatgpt-4o-latest.md)—this model will point to the latest GPT-4o model used by ChatGPT.

Aug 6

Update

Launched [Structured Outputs](guides/structured-outputs.md)—model outputs now reliably adhere to developer supplied JSON Schemas.

Released [gpt-4o-2024-08-06](models/gpt-4o.md), our newest model in the gpt-4o series.

Aug 1

Update

Launched [Admin and Audit Log APIs](api-reference/administration.md), allowing customers to programmatically administer their organization and monitor changes using the audit logs. Audit logging must be enabled within [settings](settings/organization/general).

### July, 2024

Jul 24

Update

Launched [self-serve SSO configuration](https://help.openai.com/en/articles/9641482-api-platform-single-sign-on-sso-integration-for-existing-enterprise-customers), allowing Enterprise customers on custom and unlimited billing to set up authentication against their desired IDP.

Jul 23

Update

Launched [fine-tuning for GPT-4o mini](guides/fine-tuning.md), enabling even higher performance for specific use cases.

Jul 18

Update

Released [GPT-4o mini](models/gpt-4o-mini.md), our affordable an intelligent small model for fast, lightweight tasks.

Jul 17

Update

Released [Uploads](api-reference/uploads.md) to upload large files in multiple parts.

### June, 2024

Jun 6

Update

[Parallel function calling](guides/function-calling.md) can be disabled in Chat Completions and the Assistants API by passing `parallel_tool_calls=false`.

[.NET SDK](libraries.md) launched in Beta.

Jun 3

Update

Added support for [file search customizations](assistants/tools/file-search.md).

### May, 2024

May 15

Update

Added support for [archiving projects](/projects) . Only organization owners can access this functionality.

Added support for [setting cost limits](/settings/organization/general) on a per-project basis for pay as you go customers.

May 13

Update

Released [GPT-4o](models/gpt-4o.md) in the API. GPT-4o is our fastest and most affordable flagship model.

May 9

Update

Added support for [image inputs to the Assistants API.](assistants/overview.md)

May 7

Update

Added support for [fine-tuned models to the Batch API](guides/batch.md) .

May 6

Update

Added [`stream_options: {"include_usage": true}`](api-reference/chat/create.md) parameter to the Chat Completions and Completions APIs. Setting this gives developers access to usage stats when using streaming.

May 2

Update

Added [a new endpoint](api-reference/messages/deleteMessage.md) to delete a message from a thread in the Assistants API.

### April, 2024

Apr 29

Update

Added a new [function calling option `tool_choice: "required"`](guides/function-calling.md) to the Chat Completions and Assistants APIs.

Added a [guide for the Batch API](guides/batch.md) and Batch API support for [embeddings models](guides/batch.md)

Apr 17

Update

Introduced a [series of updates to the Assistants API](assistants/whats-new.md) , including a new file search tool allowing up to 10,000 files per assistant, new token controls, and support for tool choice.

Apr 16

Update

Introduced [project based hierarchy](../settings/organization/general) for organizing work by projects, including the ability to create [API keys](api-reference/authentication.md) and manage rate and cost limits on a per-project basis (cost limits available only for Enterprise customers).

Apr 15

Update

Released [Batch API](guides/batch.md)

Apr 9

Update

Released [GPT-4 Turbo with Vision](models/gpt-4-turbo.md) in general availability in the API

Apr 4

Update

Added support for [seed](api-reference/fine-tuning/create.md) in the fine-tuning API

Added support for [checkpoints](api-reference/fine-tuning/list-checkpoints.md) in the fine-tuning API

Added support for [adding Messages when creating a Run](api-reference/runs/createRun.md) in the Assistants API

Apr 1

Update

Added support for [filtering Messages by run\_id](api-reference/messages/listMessages.md) in the Assistants API

### March, 2024

Mar 29

Update

Added support for [temperature](api-reference/runs/createRun.md) and [assistant message creation](api-reference/messages/createMessage.md) in the Assistants API

Mar 14

Update

Added support for [streaming](assistants/overview.md) in the Assistants API

### February, 2024

Feb 9

Update

Added [`timestamp_granularities` parameter](guides/speech-to-text.md) to the Audio API

Feb 1

Update

Released [gpt-3.5-turbo-0125, an updated GPT-3.5 Turbo model](models/gpt-3-5-turbo.md)

### January, 2024

Jan 25

Update

Released embedding V3 models and an updated GPT-4 Turbo preview

Added [`dimensions` parameter](api-reference/embeddings/create.md) to the Embeddings API

### December, 2023

Dec 20

Update

Added [`additional_instructions` parameter](api-reference/runs/createRun.md) to run creation in the Assistants API

Dec 15

Update

Added [`logprobs` and `top_logprobs` parameters](api-reference/chat/create.md) to the Chat Completions API

Dec 14

Update

Changed [function parameters](api-reference/chat/create.md) argument on a tool call to be optional

### November, 2023

Nov 30

Update

Released [OpenAI Deno SDK](https://deno.land/x/openai)

Nov 6

Update

Released [GPT-4 Turbo Preview](models/gpt-4-turbo.md), [updated GPT-3.5 Turbo](models/gpt-3-5-turbo.md), [GPT-4 Turbo with Vision](guides/vision.md), [Assistants API](assistants/overview.md), [DALL·E 3 in the API](models/dall-e-3.md), and [text-to-speech API](guides/text-to-speech.md)

Deprecated the Chat Completions `functions` parameter [in favor of `tools`](api-reference/chat/create.md)

Released [OpenAI Python SDK V1.0](libraries.md)

### October, 2023

Oct 16

Update

Added [`encoding_format` parameter](api-reference/embeddings/create.md) to the Embeddings API

Added `max_tokens` to the [Moderation models](models/text-moderation-latest.md)

Oct 6

Update

Added [function calling support](guides/fine-tuning.md) to the Fine-tuning API