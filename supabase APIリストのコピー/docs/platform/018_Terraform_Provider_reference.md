---
タイトル: Terraform Provider reference
URL: https://supabase.com/docs/guides/deployment/terraform/reference
カテゴリ: platform
更新日: 2026-08-02
タグ: deployment, platform, provider, reference, terraform
---

# Terraform Provider reference

**URL:** https://supabase.com/docs/guides/deployment/terraform/reference
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** deployment, platform, provider, reference, terraform

## 目次

- [Provider settings#](#provider-settings)
  - [Example usage#](#example-usage)
  - [Details#](#details)
- [Resources#](#resources)
- [Data sources#](#data-sources)

## 概要

Resources and data sources available through the Terraform Provider

---

The Terraform Provider provides access to [resources](<https://developer.hashicorp.com/terraform/language/resources>) and [data sources](<https://developer.hashicorp.com/terraform/language/data-sources>). Resources are infrastructure objects, such as a Supabase project, that you can declaratively configure. Data sources are sources of information about your Supabase instances.

## Provider settings#

Use these settings to configure your Supabase provider and authenticate to your Supabase project.

### Example usage#
[code]
    1provider "supabase" {
    2    access_token = ""
    3    endpoint = ""
    4}
[/code]

### Details#

Attribute| Description| Type| Optional| Sensitive  
---|---|---|---|---  
access_token| Supabase access token| string| true| true  
endpoint| Supabase API endpoint| string| true|   
  
## Resources#

You can configure these resources using the Supabase Terraform provider:

supabase_branchsupabase_projectsupabase_settings

#### Example usage#
[code]
    1resource "supabase_branch" "<label>" {
    2    git_branch = ""
    3    parent_project_ref = ""
    4    region = ""
    5}
[/code]

#### Details#

Attribute| Description| Type| Required| Optional| Read-only  
---|---|---|---|---|---  
`database`| Database connection details| Nested type| | | true  
`git_branch`| Git branch| string| true| |   
`id`| Branch identifier| string| | | true  
`parent_project_ref`| Parent project ref| string| true| |   
`region`| Database region| string| | true|   
  
## Data sources#

You can read these resources using the Supabase Terraform provider:

supabase_branch

#### Example usage#
[code]
    1resource "supabase_branch" "all" {
    2    parent_project_ref = ""
    3}
[/code]

#### Details#

Attribute| Description| Type| Required| Optional| Read-only  
---|---|---|---|---|---  
`branches`| Branch databases| Nested type| | | true  
`parent_project_ref`| Parent project ref| string| true| |