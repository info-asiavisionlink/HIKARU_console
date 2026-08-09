---
source_url: https://developers.openai.com/api/docs/guides/moderation
fetched_at: 2026-07-27T01:57:31Z
---

# Moderation

Responses

Copy Page

Responses

Use OpenAI moderation models to detect harmful content in text and images. You can classify standalone inputs with the [moderation endpoint](../api-reference/moderations.md) or request moderation scores alongside a generated response. Use the results to enforce your application’s policy, such as filtering content, routing a request for review, or intervening with accounts that submit flagged content.

The `omni-moderation-latest` model accepts text and image inputs. It doesn’t classify audio. The moderation endpoint is free to use, and image files can be up to 20 MB.

## Choose a moderation workflow

| Workflow | Use when |
| --- | --- |
| [Moderate generated content](#moderate-generated-content) | Your application generates text with the Responses API or Chat Completions API and needs moderation signals. |
| [Classify standalone inputs](#classify-standalone-inputs) | Your application needs to classify text or images without generating a model response. |
| [Understand moderation results](#understand-moderation-results) | Your application needs to interpret flags, categories, scores, or applied input types. |
| [Review supported categories](#review-supported-categories) | Your application needs to know which harm categories apply to text, images, or both. |

## Moderate generated content

When your application needs generated text and moderation scores together, pass a top-level `moderation` object in the generation request. The API returns moderation scores for the model input and generated output without a separate moderation request.

The model still generates normally. Review the moderation results before you show the output to a user or take downstream actions.

Set `moderation.model` when you create a response:

Generate a response with moderation scores

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
20
21
22
23
24
25
26
27
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-5.6",
    input=[
        {
            "role": "user",
            "content": (
                "A user asks for instructions to make a harmful weapon. "
                "Draft a brief refusal and offer a safer alternative."
            ),
        }
    ],
    moderation={"model": "omni-moderation-latest"},
)

input_moderation = response.moderation.input
output_moderation = response.moderation.output
if input_moderation.type == "error":
    raise RuntimeError(input_moderation.message)
if output_moderation.type == "error":
    raise RuntimeError(output_moderation.message)

print(input_moderation.flagged)
print(output_moderation.flagged)
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
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5.6",
  input: [
    {
      role: "user",
      content:
        "A user asks for instructions to make a harmful weapon. Draft a brief refusal and offer a safer alternative.",
    },
  ],
  moderation: { model: "omni-moderation-latest" },
});

const inputModeration = response.moderation.input;
const outputModeration = response.moderation.output;
if (inputModeration.type === "error") {
  throw new Error(inputModeration.message);
}
if (outputModeration.type === "error") {
  throw new Error(outputModeration.message);
}

console.log(inputModeration.flagged);
console.log(outputModeration.flagged);
```

The Responses API returns an input `moderation_result` object at `response.moderation.input` and an output `moderation_result` object at `response.moderation.output`.

Set `moderation.model` when you create a chat completion:

Generate a chat completion with moderation scores

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
from openai import OpenAI

client = OpenAI()

completion = client.chat.completions.create(
    model="gpt-5.6",
    messages=[
        {
            "role": "user",
            "content": (
                "A user asks for instructions to make a harmful weapon. "
                "Draft a brief refusal and offer a safer alternative."
            ),
        }
    ],
    moderation={"model": "omni-moderation-latest"},
)

input_result = completion.moderation.input
output_result = completion.moderation.output
if input_result.type == "error":
    raise RuntimeError(input_result.message)
if output_result.type == "error":
    raise RuntimeError(output_result.message)

input_moderation = input_result.results[0]
output_moderation = output_result.results[0]

print(input_moderation.flagged)
print(output_moderation.flagged)
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
import OpenAI from "openai";

const client = new OpenAI();

const completion = await client.chat.completions.create({
  model: "gpt-5.6",
  messages: [
    {
      role: "user",
      content:
        "A user asks for instructions to make a harmful weapon. Draft a brief refusal and offer a safer alternative.",
    },
  ],
  moderation: { model: "omni-moderation-latest" },
});

const inputResult = completion.moderation.input;
const outputResult = completion.moderation.output;
if (inputResult.type === "error") throw new Error(inputResult.message);
if (outputResult.type === "error") throw new Error(outputResult.message);

const inputModeration = inputResult.results[0];
const outputModeration = outputResult.results[0];

console.log(inputModeration.flagged);
console.log(outputModeration.flagged);
```

Chat Completions returns moderation result containers at `completion.moderation.input` and `completion.moderation.output`. For a request with one generated choice, read the first input and output result at `results[0]`. If you request multiple choices, `completion.moderation.output.results[i]` corresponds to `completion.choices[i]`.

Inline moderation results use the same category fields as a standalone moderation result. Start with `flagged` for a first-pass decision, then inspect `categories` and `category_scores` for logging, routing, audit trails, or human-review queues. A refusal or other safety-aware response can still trigger a flag if it discusses harmful content. Treat moderation scores as signals for your application’s policy, not as an automatic blocking decision.

Check the moderation result type before you read scores if your application needs to handle moderation failures. If a moderation step can’t complete, the corresponding input or output moderation field can contain an error instead of moderation scores.

For tool-calling requests, moderation covers tool-call arguments and tool outputs when they appear in conversation content. It doesn’t cover tool names, tool descriptions, tool schemas, or response-format schemas.

If you stream a generated response, moderation scores arrive after the full generated output is available. They aren’t included with partial output deltas.

## Classify standalone inputs

Use the [moderation endpoint](../api-reference/moderations.md) to classify text or image inputs without generating a model response. The tabs below show how to use the [OpenAI libraries](../libraries.md) and the [`omni-moderation-latest` model](../models.md):

Moderate text inputsModerate images and text

Moderate text inputs

Get classification information for a text input

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
from openai import OpenAI

client = OpenAI()

response = client.moderations.create(
    model="omni-moderation-latest",
    input="...text to classify goes here...",
)

print(response)
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
import OpenAI from "openai";
const openai = new OpenAI();

const moderation = await openai.moderations.create({
  model: "omni-moderation-latest",
  input: "...text to classify goes here...",
});

console.log(moderation);
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
curl https://api.openai.com/v1/moderations \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "omni-moderation-latest",
    "input": "...text to classify goes here..."
  }'
```

Moderate images and text

Get classification information for image and text input

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
20
from openai import OpenAI

client = OpenAI()

response = client.moderations.create(
    model="omni-moderation-latest",
    input=[
        {"type": "text", "text": "...text to classify goes here..."},
        {
            "type": "image_url",
            "image_url": {
                "url": "https://example.com/image.png",
                # You can also use a Base64 encoded image URL.
                # "url": "data:image/jpeg;base64,abcdefg..."
            },
        },
    ],
)

print(response)
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
import OpenAI from "openai";
const openai = new OpenAI();

const moderation = await openai.moderations.create({
  model: "omni-moderation-latest",
  input: [
    { type: "text", text: "...text to classify goes here..." },
    {
      type: "image_url",
      image_url: {
        url: "https://example.com/image.png",
        // You can also use a Base64 encoded image URL.
        // url: "data:image/jpeg;base64,abcdefg...",
      },
    },
  ],
});

console.log(moderation);
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
curl https://api.openai.com/v1/moderations \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "omni-moderation-latest",
    "input": [
      { "type": "text", "text": "...text to classify goes here..." },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://example.com/image.png"
        }
      }
    ]
  }'
```

## Understand moderation results

Here’s a full example output for an image from a single frame of a war movie. The model identifies indicators of violence in the image, with a `violence` category score greater than 0.8.

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
43
44
45
46
47
48
49
50
51
52
53
54
{
  "id": "modr-970d409ef3bef3b70c73d8232df86e7d",
  "model": "omni-moderation-latest",
  "results": [
    {
      "flagged": true,
      "categories": {
        "sexual": false,
        "sexual/minors": false,
        "harassment": false,
        "harassment/threatening": false,
        "hate": false,
        "hate/threatening": false,
        "illicit": false,
        "illicit/violent": false,
        "self-harm": false,
        "self-harm/intent": false,
        "self-harm/instructions": false,
        "violence": true,
        "violence/graphic": false
      },
      "category_scores": {
        "sexual": 2.34135824776394e-7,
        "sexual/minors": 1.6346470245419304e-7,
        "harassment": 0.0011643905680426018,
        "harassment/threatening": 0.0022121340080906377,
        "hate": 3.1999824407395835e-7,
        "hate/threatening": 2.4923252458203563e-7,
        "illicit": 0.0005227032493135171,
        "illicit/violent": 3.682979260160596e-7,
        "self-harm": 0.0011175734280627694,
        "self-harm/intent": 0.0006264858507989037,
        "self-harm/instructions": 7.368592981140821e-8,
        "violence": 0.8599265510337075,
        "violence/graphic": 0.37701736389561064
      },
      "category_applied_input_types": {
        "sexual": ["image"],
        "sexual/minors": [],
        "harassment": [],
        "harassment/threatening": [],
        "hate": [],
        "hate/threatening": [],
        "illicit": [],
        "illicit/violent": [],
        "self-harm": ["image"],
        "self-harm/intent": ["image"],
        "self-harm/instructions": ["image"],
        "violence": ["image"],
        "violence/graphic": ["image"]
      }
    }
  ]
}
```

The JSON response includes fields that describe which categories are present in the input and the model’s confidence in each category.

| Output category | Description |
| --- | --- |
| `flagged` | Set to `true` if the model classifies the content as potentially harmful, `false` otherwise. |
| `categories` | Contains a dictionary of per-category violation flags. For each category, the value is `true` if the model flags the corresponding category as violated, `false` otherwise. |
| `category_scores` | Contains a dictionary of per-category scores. Each score represents the model’s confidence that the input contains content in the category. The value is between 0 and 1, where higher values denote higher confidence. |
| `category_applied_input_types` | Contains the input types that the category score applies to. For example, if the `violence/graphic` category applies to both image and text inputs, the `violence/graphic` property is set to `["image", "text"]`. |

We plan to continuously upgrade the moderation endpoint’s underlying model.
Therefore, custom policies that rely on `category_scores` may need
recalibration over time.

## Review supported categories

The table below describes the content categories that the moderation endpoint can detect and the input types that each category supports.

Categories marked as “Text only” do not support image inputs. If you send only
images (without accompanying text) to the `omni-moderation-latest` model, it
will return a score of 0 for these unsupported categories. Image files are
limited to 20 MB.

| **Category** | **Description** | **Inputs** |
| --- | --- | --- |
| `harassment` | Content that expresses, incites, or promotes harassing language towards any target. | Text only |
| `harassment/threatening` | Harassment content that also includes violence or serious harm towards any target. | Text only |
| `hate` | Content that expresses, incites, or promotes hate based on race, gender, ethnicity, religion, nationality, sexual orientation, disability status, or caste. Hateful content aimed at non-protected groups (e.g., chess players) is harassment. | Text only |
| `hate/threatening` | Hateful content that also includes violence or serious harm towards the targeted group based on race, gender, ethnicity, religion, nationality, sexual orientation, disability status, or caste. | Text only |
| `illicit` | Content that gives advice or instruction on how to commit illicit acts. A phrase like “how to shoplift” would fit this category. | Text only |
| `illicit/violent` | The same types of content flagged by the `illicit` category, but also includes references to violence or procuring a weapon. | Text only |
| `self-harm` | Content that promotes, encourages, or depicts acts of self-harm, such as suicide, cutting, and eating disorders. | Text and images |
| `self-harm/intent` | Content where the speaker expresses that they are engaging or intend to engage in acts of self-harm, such as suicide, cutting, and eating disorders. | Text and images |
| `self-harm/instructions` | Content that encourages performing acts of self-harm, such as suicide, cutting, and eating disorders, or that gives instructions or advice on how to commit such acts. | Text and images |
| `sexual` | Content meant to arouse sexual excitement, such as the description of sexual activity, or that promotes sexual services (excluding sex education and wellness). | Text and images |
| `sexual/minors` | Sexual content that includes an individual who is under 18 years old. | Text only |
| `violence` | Content that depicts death, violence, or physical injury. | Text and images |
| `violence/graphic` | Content that depicts death, violence, or physical injury in graphic detail. | Text and images |