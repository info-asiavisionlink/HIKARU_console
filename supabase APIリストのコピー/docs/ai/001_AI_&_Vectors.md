---
タイトル: AI & Vectors
URL: https://supabase.com/docs/guides/ai
カテゴリ: ai
更新日: 2026-08-02
タグ: ai, vector, vectors
---

# AI & Vectors

**URL:** https://supabase.com/docs/guides/ai
**カテゴリ:** ai
**更新日:** 2026-08-02
**タグ:** ai, vector, vectors

## 目次

- [Search#](#search)
- [Examples#](#examples)
- [Integrations#](#integrations)
- [Case studies#](#case-studies)

## 概要

The best vector database is the database you already have.

---

Supabase provides an open source toolkit for developing AI applications using Postgres and pgvector. Use the Supabase client libraries to store, index, and query your vector embeddings at scale.

The toolkit includes:

  * A [vector store](</docs/guides/ai/vector-columns>) and embeddings support using Postgres and pgvector.
  * A [Python client](</docs/guides/ai/vecs-python-client>) for managing unstructured embeddings.
  * An [embedding generation](</docs/guides/ai/quickstarts/generate-text-embeddings>) process using open source models directly in Edge Functions.
  * [Database migrations](</docs/guides/ai/examples/headless-vector-search#prepare-your-database>) for managing structured embeddings.
  * Integrations with all popular AI providers, such as [OpenAI](</docs/guides/ai/examples/openai>), [Hugging Face](</docs/guides/ai/hugging-face>), [LangChain](</docs/guides/ai/langchain>), and more.


## Search#

You can use Supabase to build different types of search features for your app, including:

  * [Semantic search](</docs/guides/ai/semantic-search>): search by meaning rather than exact keywords
  * [Keyword search](</docs/guides/ai/keyword-search>): search by words or phrases
  * [Hybrid search](</docs/guides/ai/hybrid-search>): combine semantic search with keyword search


## Examples#

Check out all of the AI [templates and examples](<https://github.com/supabase/supabase/tree/master/examples/ai>) in our GitHub repository.

[![](/docs/img/icons/github-icon-light.svg)Headless Vector SearchA toolkit to perform vector similarity search on your knowledge base embeddings.](</docs/guides/ai/examples/headless-vector-search>)

[![](/docs/img/icons/github-icon-light.svg)Image Search with OpenAI CLIPImplement image search with the OpenAI CLIP Model and Supabase Vector.](</docs/guides/ai/examples/image-search-openai-clip>)

[![](/docs/img/icons/github-icon-light.svg)Hugging Face inferenceGenerate image captions using Hugging Face.](</docs/guides/ai/examples/huggingface-image-captioning>)

[![](/docs/img/icons/github-icon-light.svg)OpenAI completionsGenerate GPT text completions using OpenAI in Edge Functions.](</docs/guides/ai/examples/openai>)

[![](/docs/img/icons/github-icon-light.svg)Building ChatGPT PluginsUse Supabase as a Retrieval Store for your ChatGPT plugin.](</docs/guides/ai/examples/building-chatgpt-plugins>)

[![](/docs/img/icons/github-icon-light.svg)Vector search with Next.js and OpenAILearn how to build a ChatGPT-style doc search powered by Next.js, OpenAI, and Supabase.](</docs/guides/ai/examples/nextjs-vector-search>)

## Integrations#

[OpenAIOpenAI is an AI research and deployment company. Supabase provides a way to use OpenAI in your applications.](</docs/guides/ai/examples/building-chatgpt-plugins>)

[Amazon BedrockA fully managed service that offers a choice of high-performing foundation models from leading AI companies.](</docs/guides/ai/integrations/amazon-bedrock>)

[Hugging FaceHugging Face is an open-source provider of NLP technologies. Supabase provides a way to use Hugging Face's models in your applications.](</docs/guides/ai/hugging-face>)

[LangChainLangChain is a language-agnostic, open-source, and self-hosted API for text translation, summarization, and sentiment analysis.](</docs/guides/ai/langchain>)

[LlamaIndexLlamaIndex is a data framework for your LLM applications.](</docs/guides/ai/integrations/llamaindex>)

## Case studies#

[Berri AI Boosts Productivity by Migrating from AWS RDS to Supabase with pgvectorLearn how Berri AI overcame challenges with self-hosting their vector database on AWS RDS and successfully migrated to Supabase.](<https://supabase.com/customers/berriai>)

[Firecrawl switches from Pinecone to Supabase for Postgres vector embeddingsHow Firecrawl boosts efficiency and accuracy of chat powered search for documentation using Supabase with pgvector](<https://supabase.com/customers/firecrawl>)

[Markprompt: GDPR-Compliant AI Chatbots for Docs and WebsitesAI-powered chatbot platform, Markprompt, empowers developers to deliver efficient and GDPR-compliant prompt experiences on top of their content, by leveraging Supabase's secure and privacy-focused database and authentication solutions](<https://supabase.com/customers/markprompt>)