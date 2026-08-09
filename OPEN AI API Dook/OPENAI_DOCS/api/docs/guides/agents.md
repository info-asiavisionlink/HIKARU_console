---
source_url: https://developers.openai.com/api/docs/guides/agents
fetched_at: 2026-07-27T01:57:32Z
---

# Agents SDK

Copy Page

Agents are applications that plan, call tools, collaborate across specialists, and keep enough state to complete multi-step work.

## Get your first agent running

Start with the [Agents SDK quickstart](agents/quickstart.md) to install the SDK, define one agent, and run it. Once that works, return here to choose the next capability your application needs.

## Get the Agents SDK

Use the GitHub repositories for more examples, issues, and language-specific reference details.

[TypeScript SDK

Open the TypeScript SDK repository on GitHub.](https://github.com/openai/openai-agents-js)[Python SDK

Open the Python SDK repository on GitHub.](https://github.com/openai/openai-agents-python)

## Choose your starting point

| If you want to | Start here | Why |
| --- | --- | --- |
| Build a code-first agent app | [Quickstart](agents/quickstart.md) | This is the shortest path to a working SDK integration. |
| Define one specialist cleanly | [Agent definitions](agents/define-agents.md) | Start here when you are still shaping the contract for a single agent. |
| Choose models, defaults, and transport | [Models and providers](agents/models.md) | Use this when model choice, provider setup, or transport strategy affects the workflow. |
| Understand the runtime loop and state | [Running agents](agents/running-agents.md) | This is where the agent loop, streaming, and continuation strategies live. |
| Run work in a container-based environment | [Sandbox agents](agents/sandboxes.md) | Use this when the agent needs files, commands, packages, snapshots, mounts, or provider links. |
| Design specialist ownership | [Orchestration and handoffs](agents/orchestration.md) | Use this when you need more than one agent and must decide who owns the reply. |
| Add validation or human review | [Guardrails and human review](agents/guardrails-approvals.md) | Use this when the workflow should block or pause before risky work continues. |
| Understand what a run returns | [Results and state](agents/results.md) | This page explains final output, resumable state, and next-turn surfaces. |
| Add hosted tools, function tools, or MCP | [Using tools](tools.md) and [Integrations and observability](agents/integrations-observability.md) | Tool semantics live in the platform tools docs; SDK-specific MCP and tracing live here. |
| Inspect and improve runs | [Integrations and observability](agents/integrations-observability.md) and [evaluate agent workflows](agent-evals.md) | Use traces for debugging first, then move into evaluation loops. |
| Build a voice-first workflow | [Voice agents](voice-agents.md) | Use the SDK’s voice pipeline and realtime agent patterns. |

## Build with the SDK

Use the SDK track when your server owns deployment, tool implementations, state storage, and approval decisions, while the SDK runs the agent loop and invokes those tools. That path is the best fit when you want:

- typed application code in TypeScript or Python
- direct control over tools, MCP servers, and runtime behavior
- custom storage or server-managed conversation strategies
- tight integration with existing product logic or infrastructure

A typical SDK reading order is:

- Start with [Quickstart](agents/quickstart.md) to get one working run on screen.
- Use [Agent definitions](agents/define-agents.md) and [Models and providers](agents/models.md) to shape one specialist cleanly.
- Continue to [Running agents](agents/running-agents.md), [Orchestration and handoffs](agents/orchestration.md), and [Guardrails and human review](agents/guardrails-approvals.md) as the workflow grows more complex.
- Use [Results and state](agents/results.md) and [Integrations and observability](agents/integrations-observability.md) when application logic depends on the run object or deeper visibility into behavior.

## Agents SDK vs. Responses API

Use the Responses API when you want to own the loop. Use the Agents SDK when you want the SDK to run it.

### Choose the Responses API when

- You want direct control over model interactions, output items, tools, state, and orchestration, whether the workflow takes one call or many.
- You want to implement custom tool routing, loops, or branching directly in your application.

In the [Responses function-calling flow](function-calling.md), your application receives function calls, executes them, returns their output, and calls the model again.

For example, a Responses API workflow might search a knowledge base and generate a cited answer.

### Choose the Agents SDK when

- You want the SDK to manage the agent loop and recurring orchestration such as repeated tool calls or branching.
- Different specialists need different instructions, tools, or policies.
- You want built-in sessions, tracing, guardrails, or resumable approval flows.

The [Agents SDK runner](agents/running-agents.md) performs the tool loop, switches agents after handoffs, and stops when the run finishes or pauses for approval.

For example, an Agents SDK workflow might investigate a support request, hand it to the correct specialist, call internal systems, request approval for a refund, and record the result.

### Compare the Responses API and Agents SDK

|  | Responses API | Agents SDK |
| --- | --- | --- |
| **Best for** | Custom model-powered features and workflows | Bounded conversational or transactional workflows with defined tools and recurring orchestration patterns |
| **Core abstraction** | A model response | An agent run |
| **Tools** | Platform tools, function calling, and remote [Model Context Protocol (MCP)](tools-connectors-mcp.md) | Platform tools attached to reusable agents, plus tool wrappers, local MCP connections, and [agents as tools](agents/orchestration.md) |
| **Workflow orchestration** | You manage custom loops and branching | The SDK provides the agent loop and lifecycle |
| **Multi-agent workflows** | Build routing and delegation yourself | Built-in agents-as-tools and [handoffs](agents/orchestration.md) |
| **State** | Manual history, response chaining, or [Conversations](conversation-state.md) | The same options, plus [SDK sessions and resumable run state](agents/running-agents.md) |
| **Safety and approvals** | Tool-specific approvals; you build broader controls | Input, output, and tool [guardrails plus resumable approval flows](agents/guardrails-approvals.md) |
| **Debugging and tracing** | Response objects and API logs | [Built-in traces](agents/integrations-observability.md) across model calls, tools, agents, guardrails, and handoffs |