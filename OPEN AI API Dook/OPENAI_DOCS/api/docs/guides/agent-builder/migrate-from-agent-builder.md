---
source_url: https://developers.openai.com/api/docs/guides/agent-builder/migrate-from-agent-builder
fetched_at: 2026-07-27T01:55:31Z
---

# Migrate from Agent Builder

Copy Page

Use this guide to export an existing Agent Builder workflow as Agents SDK code.
You can use the export to recreate the workflow as a ChatGPT Workspace Agent or
continue with the Agents SDK in your application.

This process does not convert your workflow graph or guarantee that every
behavior transfers unchanged.

## Choose a migration path

- **Agents SDK**: Best for building agents through code.
- **ChatGPT Workspace Agents**: Best for building agents through natural
  language and sharing them with teams.

## Before you migrate

You need access to the workflow in
[Agent Builder](../agent-builder.md).

## Export your workflow

1. Open your workflow in Agent Builder.
2. Select **Code** in the top navigation.
3. Select **Agents SDK** in the code dialog.
4. Select **TypeScript** or **Python**, then copy the complete export.

![Agent Builder Code dialog with Agents SDK selected](../../../../assets/images_platform_guides_agent-builder_agents-sdk-export.png)

## Option 1: Continue with the Agents SDK

Use this option when you want to run the exported workflow in an application
you build and deploy.

Copy the TypeScript or Python export into your application, install and
configure the matching Agents SDK, and test the workflow in your runtime. For
guidance on configuring and running the export, see the
[Agents SDK overview](../agents.md) and
[quickstart](../agents/quickstart.md).
Validate your application’s configuration and behavior before deploying it.

## Option 2: Create a workspace agent from the export

To use this option, you need a ChatGPT Business, Enterprise, or Edu workspace
with access to [workspace agents](https://chatgpt.com/agents) and permission to
create agents.

In ChatGPT, [create a workspace agent](https://chatgpt.com/agents/studio/new).
Paste your exported code into the chat with this prompt:

```
Please help me convert this workflow into an agent:

<paste your exported code here>
```

Review any behavior that the builder identifies as requiring changes before you
continue.

## Review and test the agent

Some workflow behavior may need manual recreation. Review control flow,
triggers, tools, and permissions as you test the migrated agent.

Before creating the agent:

1. Review the generated instructions and configured capabilities.
2. Configure any required apps, tools, skills, authentication, and connection
   permissions.
3. Select **Preview** and test representative inputs from the original
   workflow.
4. Compare the previewed behavior with the original workflow’s expected
   behavior.
5. Select **Create** only after you have validated the migrated agent.

Follow the same safety practices you used for your workflow, especially when
the agent can access private data or take actions through connected tools.

## Limitations

- Workflows with strong determinism at their core may not migrate faithfully to
  a workspace agent.
- Connected apps, authentication, publishing, and permission configuration
  require separate review in ChatGPT.
- An Agents SDK implementation requires you to validate your application’s
  runtime configuration, tools, authentication, permissions, and deployment.

## Related resources

- [Agent Builder](../agent-builder.md)
- [Safety in building agents](../agent-builder-safety.md)
- [Agents SDK overview](../agents.md)
- [Agents SDK quickstart](../agents/quickstart.md)
- [Build workspace agents in ChatGPT for repeatable work](/cookbook/articles/chatgpt-agents-sales-meeting-prep)