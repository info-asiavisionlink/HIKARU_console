---
タイトル: Logs field reference
URL: https://supabase.com/docs/guides/monitoring-and-debugging/log-field-reference
カテゴリ: platform
更新日: 2026-08-02
タグ: field, log-field-reference, logs, monitoring-and-debugging, platform, reference
---

# Logs field reference

**URL:** https://supabase.com/docs/guides/monitoring-and-debugging/log-field-reference
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** field, log-field-reference, logs, monitoring-and-debugging, platform, reference

## 目次

（目次なし）

## 概要

Supabase Logs field reference

---

Refer to the full field reference for each available source below. To access each nested key, you need to perform the [necessary unnesting joins](</docs/guides/monitoring-and-debugging/advanced-log-filtering#unnesting-arrays>)

API GatewayAuthAuth Audit LogsStorageFunction EdgeFunction RuntimePostgresRealtimePostgRESTSupavisor (Shared Pooler)PgBouncer (Dedicated Pooler)Database Version UpgradeMultigres

Path| Type  
---|---  
id| string  
timestamp| datetime  
event_message| string  
identifier| string  
metadata.load_balancer_redirect_identifier| string  
metadata.request.cf.asOrganization| string  
metadata.request.cf.asn| number  
metadata.request.cf.botManagement.corporateProxy| boolean  
metadata.request.cf.botManagement.detectionIds| number[]  
metadata.request.cf.botManagement.ja3Hash| string  
metadata.request.cf.botManagement.score| number  
metadata.request.cf.botManagement.staticResource| boolean  
metadata.request.cf.botManagement.verifiedBot| boolean  
metadata.request.cf.city| string  
metadata.request.cf.clientTcpRtt| number  
metadata.request.cf.clientTrustScore| number  
metadata.request.cf.colo| string  
metadata.request.cf.continent| string  
metadata.request.cf.country| string  
metadata.request.cf.edgeRequestKeepAliveStatus| number  
metadata.request.cf.httpProtocol| string  
metadata.request.cf.latitude| string  
metadata.request.cf.longitude| string  
metadata.request.cf.metroCode| string  
metadata.request.cf.postalCode| string  
metadata.request.cf.region| string  
metadata.request.cf.timezone| string  
metadata.request.cf.tlsCipher| string  
metadata.request.cf.tlsClientAuth.certPresented| string  
metadata.request.cf.tlsClientAuth.certRevoked| string  
metadata.request.cf.tlsClientAuth.certVerified| string  
metadata.request.cf.tlsExportedAuthenticator.clientFinished| string  
metadata.request.cf.tlsExportedAuthenticator.clientHandshake| string  
metadata.request.cf.tlsExportedAuthenticator.serverFinished| string  
metadata.request.cf.tlsExportedAuthenticator.serverHandshake| string  
metadata.request.cf.tlsVersion| string  
metadata.request.headers.cf_connecting_ip| string  
metadata.request.headers.cf_ipcountry| string  
metadata.request.headers.cf_ray| string  
metadata.request.headers.host| string  
metadata.request.headers.referer| string  
metadata.request.headers.x_client_info| string  
metadata.request.headers.x_forwarded_proto| string  
metadata.request.headers.x_real_ip| string  
metadata.request.host| string  
metadata.request.method| string  
metadata.request.path| string  
metadata.request.protocol| string  
metadata.request.search| string  
metadata.request.url| string  
metadata.response.headers.cf_cache_status| string  
metadata.response.headers.cf_ray| string  
metadata.response.headers.content_location| string  
metadata.response.headers.content_range| string  
metadata.response.headers.content_type| string  
metadata.response.headers.date| string  
metadata.response.headers.sb_gateway_version| string  
metadata.response.headers.transfer_encoding| string  
metadata.response.headers.x_kong_proxy_latency| string  
metadata.response.origin_time| number  
metadata.response.status_code| number