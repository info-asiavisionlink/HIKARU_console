---
source_url: https://developers.openai.com/api/docs/guides/agents/models
fetched_at: 2026-07-27T01:57:34Z
---

# Models and providers

Copy Page

Every SDK run eventually resolves a model and a transport. Most applications should keep that setup straightforward: choose models explicitly, use the standard OpenAI path by default, and reach for provider or transport overrides only when the workflow actually needs them.

## Start with explicit model selection

In production, prefer explicit model choice over whichever runtime default your SDK release happens to ship with.

- Set `model` on an agent when that specialist consistently needs a different quality, latency, or cost profile.
- Set a run-level default when one workflow should override several agents at once.
- Set `OPENAI_DEFAULT_MODEL` when you want a process-wide fallback for agents that omit `model`.

Set models per agent and per run

typescript

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
import { Agent, Runner } from "@openai/agents";

const fastAgent = new Agent({
  name: "Fast support agent",
  instructions: "Handle routine support questions.",
  model: "gpt-5.6-terra",
});

const generalAgent = new Agent({
  name: "General support agent",
  instructions: "Handle support questions carefully.",
});

const runner = new Runner({
  model: "gpt-5.6",
});

await runner.run(fastAgent, "Summarize ticket 123.");
const result = await runner.run(
  generalAgent,
  "Investigate the billing issue on account 456."
);

console.log(result.finalOutput);
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
import asyncio

from agents import Agent, RunConfig, Runner

fast_agent = Agent(
    name="Fast support agent",
    instructions="Handle routine support questions.",
    model="gpt-5.6-terra",
)

general_agent = Agent(
    name="General support agent",
    instructions="Handle support questions carefully.",
)

async def main() -> None:
    await Runner.run(fast_agent, "Summarize ticket 123.")

    result = await Runner.run(
        general_agent,
        "Investigate the billing issue on account 456.",
        run_config=RunConfig(model="gpt-5.6"),
    )
    print(result.final_output)

if __name__ == "__main__":
    asyncio.run(main())
```

For most new SDK workflows, start with [`gpt-5.6`](../../models/gpt-5.md) and move to a smaller variant only when latency or cost matters enough to justify it. Use the platform-wide [Model guidance](../latest-model.md) page for current model-selection advice.

## Choose the simplest default strategy

| If you need | Start with | Why |
| --- | --- | --- |
| One explicit model per specialist | Set `model` on each agent | The workflow stays readable in code and traces |
| One fallback across a whole process | `OPENAI_DEFAULT_MODEL` | Agents that omit `model` still resolve predictably |
| One workflow-level override | A run-level default | You can swap models for a script, worker, or environment without editing every agent |
| Different model sizes across the same workflow | Mix per-agent models | A fast triage agent and a slower deep specialist can coexist cleanly |

If your team cares about the exact default, don’t rely on the SDK fallback. Set it yourself.

## Providers and transport

| Need | Start with |
| --- | --- |
| Standard SDK runs on OpenAI | The default OpenAI provider path |
| Many repeated Responses model round trips over a socket | Responses WebSocket transport in the SDK |
| Non-OpenAI models or a mixed-provider stack | The provider or adapter surface in the language-specific SDK docs |

Two distinctions matter:

- The Responses WebSocket transport still uses the normal text-and-tools agent loop. It’s separate from the voice session path.
- Live audio sessions over WebRTC or WebSocket are for low-latency voice or image interactions. Use [Voice agents](../voice-agents.md) and the [live audio API guide](../realtime.md) for that path.

Exact provider configuration, provider lifecycle management, and transport helper APIs remain language-specific material. Keep those details in the SDK docs instead of duplicating them here.

## Model settings, prompts, and feature support

Model choice is only part of the runtime contract.

- Use `modelSettings` for tuning such as reasoning effort, verbosity, and tool behavior.
- Use `prompt` when you want a stored prompt configuration to control the run instead of embedding the full system prompt in code.
- Some SDK features depend on the OpenAI Responses path rather than older compatibility surfaces, so check the SDK docs when you need advanced tool-loading or transport features.

Keep the model contract close to the agent definition when it’s intrinsic to that specialist. Move it to a workflow-level default only when a group of agents should share the same runtime choice.

## Next steps

Once the runtime contract is clear, continue with the guide that matches the rest of the workflow design.

[Agent definitions

Keep model choices aligned with the responsibilities of each specialist.](define-agents.md)[Running agents

See how transport and model choices affect the runtime loop.](running-agents.md)[External models

Compare broader provider options when a mixed-model stack matters.](../external-models.md)