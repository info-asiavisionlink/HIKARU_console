---
source_url: https://developers.openai.com/api/docs/guides/prompt-optimizer
fetched_at: 2026-07-27T01:55:39Z
---

# Prompt optimizer

Responses

Copy Page

Responses

The [prompt optimizer](https://platform.openai.com/chat/edit?optimize=true) is a chat interface in the dashboard, where you enter a prompt, and we optimize it according to current best practices before returning it to you. Pairing the prompt optimizer with [datasets](evaluation-getting-started.md) is a powerful way to automatically improve prompts.

OpenAI is deprecating the dataset-backed prompt optimizer as part of the Evals
platform. Evals will become read-only for existing users on October 31, 2026,
and the platform is scheduled to shut down on November 30, 2026. See the
[deprecations page](../deprecations.md) for the
current timeline.

## Prepare your data

1. Set up a [dataset](evaluation-getting-started.md) containing the prompt you want to optimize and an evaluation dataset.
2. Create at least three rows of data with responses in your dataset.
3. For each row, create at least one grader result or human annotation.

The prompt optimizer can use the following from your dataset to improve your prompt:

- Annotations (Good/Bad and additional custom annotation columns you add)
- Text critiques written in **output\_feedback**
- Results from graders

For effective results, add annotations containing a Good/Bad rating *and* detailed, specific critiques. Create [graders](evaluation-getting-started.md) that precisely capture the properties that you desire from your prompt.

## Optimize your prompt

Once you’ve prepared your dataset, create an optimization.

1. In the bottom of the prompt pane, click **Optimize**. This will create a new tab for the optimized result and start an optimization process that runs in the background.
2. When the optimized prompt is ready, view and test the new prompt.
3. Repeat. While a single optimization run may achieve your desired result, experiment with repeating the optimization process on the new prompt—generate outputs, annotate outputs, run graders, and optimize.

The effectiveness of prompt optimization depends on the quality of your
graders. We recommend building narrowly-defined graders for each of the
desired output properties where you see your prompt failing.

Always evaluate and manually review optimized prompts before using them in production. While the prompt optimizer generally provides a strict improvement in your prompt’s effectiveness, it’s possible for the optimized prompt to perform worse than your original on specific inputs.

## Next steps

For more inspiration, visit the [OpenAI Cookbook](/cookbook), which contains example code and links to third-party resources, or learn more about our tools for evals:

[Cookbook: Building resilient prompts with evals

Operate a flywheel of continuous improvement using evaluations.](https://cookbook.openai.com/examples/evaluation/building_resilient_prompts_using_an_evaluation_flywheel)
[Working with evals

Evaluate against external models, interact with evals via API, and more.](evals.md)
[Graders

Build sophisticated graders to improve the effectiveness of your evals.](graders.md)
[Fine-tuning

Improve a model’s ability to generate responses tailored to your use case.](fine-tuning.md)