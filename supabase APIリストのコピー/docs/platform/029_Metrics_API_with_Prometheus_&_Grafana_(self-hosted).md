---
タイトル: Metrics API with Prometheus & Grafana (self-hosted)
URL: https://supabase.com/docs/guides/monitoring-and-debugging/metrics/grafana-self-hosted
カテゴリ: platform
更新日: 2026-08-02
タグ: api, grafana, grafana-self-hosted, hosted, metrics, monitoring-and-debugging, platform, prometheus, self, with
---

# Metrics API with Prometheus & Grafana (self-hosted)

**URL:** https://supabase.com/docs/guides/monitoring-and-debugging/metrics/grafana-self-hosted
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** api, grafana, grafana-self-hosted, hosted, metrics, monitoring-and-debugging, platform, prometheus, self, with

## 目次

- [Architecture#](#architecture)
- [1. Deploy Prometheus#](#1-deploy-prometheus)
- [2. Deploy Grafana#](#2-deploy-grafana)
- [3. Import Supabase dashboards#](#3-import-supabase-dashboards)
- [4. Configure alerting#](#4-configure-alerting)
- [5. Operating tips#](#5-operating-tips)

## 概要

Deploy Prometheus and Grafana yourself to monitor Supabase metrics

---

Self-hosting [Prometheus](<https://prometheus.io/docs/prometheus/latest/installation/>) and Grafana gives you full control over retention, alert routing, and dashboards. The Supabase Metrics API slots into any standard Prometheus scrape job, so you can run everything locally, on a VM, or inside Kubernetes.

Use this guide only if you need full manual control (custom scrape topology, self-hosted Prometheus or non-standard auth).

Otherwise, use the [Grafana Cloud integration](</docs/guides/telemetry/metrics/grafana-cloud#installation>) available in the Supabase Dashboard.

## Architecture#

  1. **Prometheus** scrapes `https://<project-ref>.supabase.co/customer/v1/privileged/metrics` every minute using HTTP Basic Auth.
  2. **Grafana** reads from Prometheus and renders dashboards/alerts.
  3. **Prometheus Alertmanager** or your preferred system sends notifications when Prometheus rules fire (optional) .


## 1\. Deploy Prometheus#

Install [Prometheus](<https://prometheus.io/docs/prometheus/latest/installation/>) using your preferred method (Docker, Helm, binaries). Then add a Supabase-specific job to `prometheus.yml`:
[code] 
    1
    
    scrape_configs:
    
    2
    
      - job_name: 'supabase'
    
    3
    
        scrape_interval: 60s
    
    4
    
        metrics_path: /customer/v1/privileged/metrics
    
    5
    
        scheme: https
    
    6
    
        basic_auth:
    
    7
    
          username: username
    
    8
    
          password: '<secret API key (sb_secret_...)>'
    
    9
    
        static_configs:
    
    10
    
          - targets:
    
    11
    
              - '<project-ref>.supabase.co:443'
    
    12
    
            labels:
    
    13
    
              project: '<project-ref>'
[/code]

  * Keep the scrape interval at 60 seconds to match Supabase’s refresh cadence.
  * If you run Prometheus behind a proxy, make sure it can establish outbound HTTPS connections to `*.supabase.co`.
  * Store secrets (Secret API key) with your secret manager or inject them via environment variables.


## 2\. Deploy Grafana#

Install Grafana (Docker image, Helm chart, or packages) and connect it to Prometheus:

  1. In Grafana, go to **Connections → Data sources → Add data source**.
  2. Choose **Prometheus** , set the URL to your Prometheus endpoint (for example `http://prometheus:9090`), and click **Save & test**.


## 3\. Import Supabase dashboards#

  1. Go to **Dashboards → New → Import**.
  2. Paste the contents of [`supabase-grafana/dashboard.json`](<https://raw.githubusercontent.com/supabase/supabase-grafana/refs/heads/main/grafana/dashboard.json>).
  3. Select your Prometheus datasource when prompted.


You now have over 200 production-ready panels covering CPU, IO, WAL, replication, index bloat, and query throughput.

![Supabase Grafana dashboard showcasing database metrics](/docs/_next/image?url=%2Fdocs%2Fimg%2Fguides%2Fplatform%2Fsupabase-grafana-prometheus.png&w=3840&q=75)

## 4\. Configure alerting#

  * Import the sample rules from [`docs/example-alerts.md`](<https://github.com/supabase/supabase-grafana/blob/main/docs/example-alerts.md>) into Prometheus or Grafana Alerting.
  * Tailor thresholds (for example, disk utilization, long-running transactions, connection saturation) to your project’s size.
  * Route notifications via Alertmanager, Grafana OnCall, PagerDuty, or any other supported destination.


## 5\. Operating tips#

  * **Multiple projects:** add one scrape job per project ref so you can separate metrics and labels cleanly.
  * **Right-sizing guidance:** pair the dashboards with Supabase’s [Query Performance report](</dashboard/project/_/observability/query-performance>) and [Advisors](</dashboard/project/_/observability/database>) to decide when to optimize vs upgrade.
  * **Security:** rotate Secret API keys on a regular cadence and update the Prometheus config accordingly.