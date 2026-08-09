---
source_url: https://developers.openai.com/api/docs/assistants/tools
fetched_at: 2026-07-27T01:55:58Z
---

# Assistants API tools

Copy Page

After achieving feature parity in the Responses API, we've deprecated the Assistants API. It will shut down on August 26, 2026. Follow the [migration guide](/platform/assistants/migration) to update your integration. [Learn more](https://platform.openai.com/docs/guides/migrate-to-responses).

## Overview

Assistants created using the Assistants API can be equipped with tools that allow them to perform more complex tasks or interact with your application.
We provide built-in tools for assistants, but you can also define your own tools to extend their capabilities using Function Calling.

The Assistants API currently supports the following tools:

[File Search

Built-in RAG tool to process and search through files](tools/file-search.md)
[Code Interpreter

Write and run python code, process files and diverse data](tools/code-interpreter.md)
[Function Calling

Use your own custom functions to interact with your application](tools/function-calling.md)

## Next steps

- See the API reference to [submit tool outputs](../api-reference/runs/submitToolOutputs.md)
- Build a tool-using assistant with our [Quickstart app](https://github.com/openai/openai-assistants-quickstart)