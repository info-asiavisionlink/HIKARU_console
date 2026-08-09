---
タイトル: Log Drains
URL: https://supabase.com/docs/guides/monitoring-and-debugging/log-drains
カテゴリ: platform
更新日: 2026-08-02
タグ: ai, drains, log-drains, monitoring-and-debugging, platform
---

# Log Drains

**URL:** https://supabase.com/docs/guides/monitoring-and-debugging/log-drains
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** ai, drains, log-drains, monitoring-and-debugging, platform

## 目次

- [What you can do with log drains#](#what-you-can-do-with-log-drains)
- [Choose your destination#](#choose-your-destination)
- [Custom endpoint#](#custom-endpoint)
  - Edge Function walkthrough (uncompressed)
  - Edge Function walkthrough (Gzip)
- [OpenTelemetry (OTLP)#](#opentelemetry-otlp)
  - OpenTelemetry Collector example
  - Authentication examples
- [Datadog#](#datadog)
  - Parsing and pipeline configuration
- [Loki#](#loki)
- [Amazon S3#](#amazon-s3)
- [Sentry#](#sentry)
- [Axiom#](#axiom)
- [Last9#](#last9)
- [Syslog#](#syslog)
- [Additional resources#](#additional-resources)

## 概要

Getting started with Supabase Log Drains

---

Log drains send all logs of the Supabase stack to one or more desired destinations. It is only available for customers on Pro, Team and Enterprise Plans. Log drains are available in the dashboard under [Project Settings > Log Drains](</dashboard/project/_/settings/log-drains>).

## What you can do with log drains#

  * Route Supabase logs (Postgres, Auth, Storage, Edge Functions, and more) to any observability platform.
  * Combine Supabase logs with application-level traces — see [Tracing with the JS SDK](</docs/guides/monitoring-and-debugging/client-side-tracing>) to extend your traces into Supabase.
  * Archive logs to S3 for long-term retention and compliance.
  * Build alerts and dashboards on top of Supabase log data in your preferred vendor.


## Choose your destination#

  * [Custom EndpointForward logs as a POST request to any custom HTTP endpoint.](</docs/guides/monitoring-and-debugging/log-drains#custom-endpoint>)
  * [OpenTelemetry (OTLP)Send logs to any OTLP-compatible endpoint using Protocol Buffers over HTTP.](</docs/guides/monitoring-and-debugging/log-drains#opentelemetry-otlp>)
  * [DatadogStream logs directly into Datadog for monitoring and analysis.](</docs/guides/monitoring-and-debugging/log-drains#datadog>)
  * [LokiIngest logs into Grafana Loki using the HTTP push API.](</docs/guides/monitoring-and-debugging/log-drains#loki>)
  * [Amazon S3Write batched log files directly to an S3 bucket you own.](</docs/guides/monitoring-and-debugging/log-drains#amazon-s3>)
  * [SentrySend logs to Sentry's Logging product for filtering and grouping.](</docs/guides/monitoring-and-debugging/log-drains#sentry>)
  * [AxiomForward logs to an Axiom dataset for storage and analysis.](</docs/guides/monitoring-and-debugging/log-drains#axiom>)
  * [Last9Stream logs to Last9 for OpenTelemetry-native observability.](</docs/guides/monitoring-and-debugging/log-drains#last9>)
  * [SyslogForward logs to a remote Syslog receiver over TCP or TLS (RFC 5424).](</docs/guides/monitoring-and-debugging/log-drains#syslog>)


HTTP destinations receive logs as batched POST requests with a maximum of 250 events or 1-second intervals, whichever comes first.

## Custom endpoint#

Logs are delivered as a JSON array via HTTP POST. Both HTTP/1 and HTTP/2 are supported. Custom headers can be added to every request for authentication or routing.

**Required configuration:**

  * URL — your endpoint URL (`http://` or `https://`)
  * HTTP Version — `HTTP/1` or `HTTP/2`
  * Gzip — enable to compress the payload before sending
  * Headers — optional key/value pairs added to every request


Requests to custom endpoints are currently unsigned. Signed requests are coming in a future release.

### Edge Function walkthrough (uncompressed)

### Edge Function walkthrough (Gzip)

## OpenTelemetry (OTLP)#

Logs are sent to any OTLP-compatible endpoint using the OpenTelemetry Protocol over HTTP with Protocol Buffers encoding, following the [OpenTelemetry Logs specification](<https://opentelemetry.io/docs/specs/otel/logs/>).

**Required configuration:**

  * Endpoint — full URL of your OTLP HTTP endpoint (typically ends in `/v1/logs`)
  * Protocol — `http/protobuf` (the only supported protocol)
  * Gzip — enable to reduce bandwidth (recommended)
  * Headers — optional authentication headers


Your OTLP endpoint must accept logs at the `/v1/logs` path with `application/x-protobuf` content type.

Compatible platforms include OpenTelemetry Collector, Grafana Cloud, New Relic, Honeycomb, Datadog (OTLP ingestion), Elastic, and any other OTLP-compatible observability tool.

### OpenTelemetry Collector example

### Authentication examples

## Datadog#

Logs are batched and sent to Datadog with Gzip compression. Each event's log source is mapped to the `service` field, and the source is set to `Supabase`. The payload message is a JSON string of the raw log event, prefixed with the event timestamp.

**Required configuration:**

  * API Key — from [Datadog Organization Settings](<https://app.datadoghq.com/organization-settings/api-keys>)
  * Region — the Datadog site your account uses (US1, US3, US5, EU, AP1, AP2, US1-FED)


**Steps:**

  1. Generate an API key in the [Datadog dashboard](<https://app.datadoghq.com/organization-settings/api-keys>).
  2. Create the drain in [Project Settings > Log Drains](</dashboard/project/_/settings/log-drains>).
  3. Watch incoming events on the [Datadog Logs page](<https://app.datadoghq.com/logs>).


### Parsing and pipeline configuration

## Loki#

Logs are formatted and sent to the Loki HTTP push API. The log source and product name are used as stream labels. The `event_message` and `timestamp` fields are dropped from events to avoid duplicate data. Events are batched with a maximum of 250 events per request.

**Required configuration:**

  * URL — your Loki push endpoint (e.g. `https://my-logs.grafana.net/loki/api/v1/push`)
  * Username — optional, required for Grafana Cloud and other authenticated Loki instances
  * Password — optional, required for Grafana Cloud and other authenticated Loki instances
  * Headers — optional additional headers


Loki must be configured to accept **structured metadata**. Increase the default maximum number of structured metadata fields to at least 500 to accommodate large log event payloads across different Supabase products.

See the official [Loki HTTP API documentation](<https://grafana.com/docs/loki/latest/reference/loki-http-api/#ingest-logs>) for more details on the push API format.

## Amazon S3#

Logs are written as batched files to an existing S3 bucket that you own.

**Required configuration:**

  * S3 Bucket — name of an existing S3 bucket
  * Region — AWS region where the bucket is located
  * Access Key ID — used for authentication
  * Secret Access Key — used for authentication
  * Batch Timeout (ms) — maximum wait before flushing a batch (recommended: 2000–5000ms)


The AWS account tied to the Access Key ID must have write permissions on the specified S3 bucket.

## Sentry#

Logs are sent to [Sentry's Logging product](<https://docs.sentry.io/product/explore/logs/>). All log event fields are attached as Sentry log attributes, which can be used for filtering and grouping. There are no cardinality limits on the number of attributes.

**Required configuration:**

  * DSN — your Sentry project DSN in the format `{PROTOCOL}://{PUBLIC_KEY}@{HOST}/{PROJECT_ID}`


**Steps:**

  1. Get your DSN from [Sentry project settings](<https://docs.sentry.io/concepts/key-terms/dsn-explainer/>).
  2. Create the drain in [Project Settings > Log Drains](</dashboard/project/_/settings/log-drains>).
  3. Watch incoming logs on the [Sentry Logs page](<https://sentry.io/explore/logs/>).


Ingesting Supabase logs as Sentry _errors_ is not supported. If you are self-hosting Sentry, Sentry Logs requires self-hosted version [25.9.0](<https://github.com/getsentry/self-hosted/releases/tag/25.9.0>) or later.

## Axiom#

Logs are sent to an Axiom dataset as JSON, with the timestamp adjusted for Axiom's ingestion format.

**Required configuration:**

  * Dataset Name — name of the target dataset in Axiom
  * API Token — an Axiom API token with ingest permissions on the dataset


**Steps:**

  1. Create a dataset in Axiom Console under **Datasets**.
  2. Generate an API token with ingest access (see [Axiom token docs](<https://axiom.co/docs/reference/tokens#create-basic-api-token>)).
  3. Create the drain in [Project Settings > Log Drains](</dashboard/project/_/settings/log-drains>).
  4. Watch incoming events in the Axiom Console **Stream** panel.


## Last9#

Logs are sent to Last9 using its OpenTelemetry-native ingestion endpoint. Credentials are obtained from the Last9 OTEL integration panel.

**Required configuration:**

  * Region — your Last9 cluster region (US West 1 or AP South 1)
  * Username — from the Last9 OTEL integration panel
  * Password — from the Last9 OTEL integration panel


**Steps:**

  1. In the Last9 dashboard, open the OTEL integration panel and note your region, username, and password.
  2. Create the drain in [Project Settings > Log Drains](</dashboard/project/_/settings/log-drains>).


## Syslog#

Logs are forwarded to a remote Syslog receiver using TCP or TLS, adhering to [RFC 5424](<https://datatracker.ietf.org/doc/html/rfc5424>).

**Required configuration:**

  * Host — hostname or IP address of the Syslog receiver
  * Port — port of the Syslog receiver (0–65535)
  * TLS — enable to connect via SSL/TLS instead of plain TCP


**Optional configuration:**

  * Structured Data — static RFC 5424 structured data included in every log frame (e.g. `[exampleSDID@32473 iut="3"]`)
  * Cipher Key — base64-encoded 32-byte key for AES-256-GCM encryption of the log body


**TLS-only options:**

  * CA Certificate — PEM-encoded CA certificate for server verification (falls back to the system CA bundle if omitted)
  * Client Certificate — PEM-encoded client certificate for mutual TLS (mTLS)
  * Client Key — PEM-encoded client private key (required when a client certificate is provided)


## Additional resources#

  * [Log Drains pricing breakdown](</docs/guides/platform/manage-your-usage/log-drains>) — cost per drain, per million events, and egress charges.
  * [Metrics API](</docs/guides/monitoring-and-debugging/metrics>) — export Postgres performance metrics alongside your logs.
  * [Tracing with the JS SDK](</docs/guides/monitoring-and-debugging/client-side-tracing>) — instrument your application and combine traces with Supabase logs.