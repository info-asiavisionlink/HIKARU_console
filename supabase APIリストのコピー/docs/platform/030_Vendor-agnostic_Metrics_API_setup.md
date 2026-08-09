---
タイトル: Vendor-agnostic Metrics API setup
URL: https://supabase.com/docs/guides/monitoring-and-debugging/metrics/vendor-agnostic
カテゴリ: platform
更新日: 2026-08-02
タグ: agnostic, api, metrics, monitoring-and-debugging, platform, setup, vendor, vendor-agnostic
---

# Vendor-agnostic Metrics API setup

**URL:** https://supabase.com/docs/guides/monitoring-and-debugging/metrics/vendor-agnostic
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** agnostic, api, metrics, monitoring-and-debugging, platform, setup, vendor, vendor-agnostic

## 目次

  - What you can do with the Metrics API
- [Components#](#components)
- [1. Define the scrape job#](#1-define-the-scrape-job)
  - [Collector-specific notes#](#collector-specific-notes)
- [2. Secure the credentials#](#2-secure-the-credentials)
- [3. Downstream dashboards#](#3-downstream-dashboards)
- [4. Alerts and automation#](#4-alerts-and-automation)
- [5. Multi-project setups#](#5-multi-project-setups)

## 概要

Connect Supabase metrics to any Prometheus-compatible platform

---

The Supabase Metrics API is intentionally vendor-agnostic. Any collector that can scrape a Prometheus text endpoint over HTTPS can ingest the data. This guide explains the moving pieces so you can adapt them to AWS Managed Prometheus, Grafana Mimir, VictoriaMetrics, Thanos, or any other system.

### What you can do with the Metrics API

## Components#

  * **Collector** – Prometheus, Grafana Agent, VictoriaMetrics agent, Mimir scraper, etc.
  * **Long-term store (optional)** – Managed Prometheus, Thanos, Mimir, VictoriaMetrics.
  * **Visualization/alerting** – Grafana, Datadog, New Relic, custom code.


## 1\. Define the scrape job#

No matter which collector you use, you need to hit the Metrics API once per minute with HTTP Basic Auth:
[code] 
    1
    
    - job_name: supabase
    
    2
    
      scrape_interval: 60s
    
    3
    
      metrics_path: /customer/v1/privileged/metrics
    
    4
    
      scheme: https
    
    5
    
      basic_auth:
    
    6
    
        username: username
    
    7
    
        password: '<secret API key (sb_secret_...)>'
    
    8
    
      static_configs:
    
    9
    
        - targets:
    
    10
    
            - '<project-ref>.supabase.co:443'
    
    11
    
          labels:
    
    12
    
            project: '<project-ref>'
[/code]

### Collector-specific notes#

  * **Grafana Agent / Alloy:** use the [`prometheus.scrape` component](<https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-supabase/#manual-configuration>) with the same parameters.
  * **AWS Managed Prometheus (AMP):** deploy the Grafana Agent or AWS Distro for OpenTelemetry (ADOT) in your VPC, then remote-write the scraped metrics into AMP.
  * **VictoriaMetrics / Mimir:** reuse the same scrape block; configure remote-write or retention rules as needed.


## 2\. Secure the credentials#

  * Store the Secret API key in your secret manager (AWS Secrets Manager, GCP Secret Manager, Vault, etc.).
  * Rotate the key periodically via [Project Settings → API Keys](</dashboard/project/_/settings/api-keys>) and update your collector.
  * If you need to give observability vendors access without exposing a broadly-scoped key, create a dedicated Secret API key for metrics-only automation.


## 3\. Downstream dashboards#

  * Import the [Supabase Grafana dashboard](<https://github.com/supabase/supabase-grafana>) regardless of where Grafana is hosted.
  * For other tools, group metrics by categories (CPU, IO, WAL, replication, connections) and recreate the visualizations that matter most to your team.
  * Tag or relabel series with `project`, `env`, or `team` labels to make multi-project views easier.

![Supabase Grafana dashboard showcasing database metrics](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Fsupabase-grafana-prometheus.png&w=3840&q=75)

## 4\. Alerts and automation#

  * Start with the [example alert rules](<https://github.com/supabase/supabase-grafana/blob/main/docs/example-alerts.md>) and adapt thresholds for your workload sizes.
  * Pipe alerts into PagerDuty, Slack, Opsgenie, or any other compatible target.
  * Combine Metrics API data with log drains, Query Performance, and Advisors to build right-sizing playbooks.


## 5\. Multi-project setups#

  * Create one scrape job per project ref so you can control sampling individually.
  * If you run many projects, consider templating the scrape jobs via Helm, Terraform, or the Grafana Agent Operator.
  * Use label joins (`project`, `instance_class`, `org`) to aggregate across tenants or environments.