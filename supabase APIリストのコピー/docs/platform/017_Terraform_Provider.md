---
タイトル: Terraform Provider
URL: https://supabase.com/docs/guides/deployment/terraform
カテゴリ: platform
更新日: 2026-08-02
タグ: deployment, platform, provider, terraform
---

# Terraform Provider

**URL:** https://supabase.com/docs/guides/deployment/terraform
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** deployment, platform, provider, terraform

## 目次

- [Using the provider#](#using-the-provider)

## 概要

Searchdocs...

---

The [Supabase Provider](<https://registry.terraform.io/providers/supabase/supabase/latest/docs>) allows Terraform to manage resources hosted on [Supabase](<https://supabase.com/>) platform.

You may use this provider to version control your project settings or setup CI/CD pipelines for automatically provisioning projects and branches.

  * [CI/CD example](<https://github.com/supabase/supabase-action-example/tree/main/supabase/remotes>)
  * [Step-by-step tutorials](</docs/guides/deployment/terraform/tutorial>)
  * [Contributing guide](<https://github.com/supabase/terraform-provider-supabase/blob/v1.1.3/CONTRIBUTING.md>)


## Using the provider#

This simple example imports an existing Supabase project and synchronises its API settings.
[code] 
    1
    
    terraform {
    
    2
    
      required_providers {
    
    3
    
        supabase = {
    
    4
    
          source  = "supabase/supabase"
    
    5
    
          version = "~> 1.0"
    
    6
    
        }
    
    7
    
      }
    
    8
    
    }
    
    9
    
    10
    
    provider "supabase" {
    
    11
    
      access_token = file("${path.module}/access-token")
    
    12
    
    }
    
    13
    
    14
    
    # Define a linked project variable as user input
    
    15
    
    variable "linked_project" {
    
    16
    
      type = string
    
    17
    
    }
    
    18
    
    19
    
    # Import the linked project resource
    
    20
    
    import {
    
    21
    
      to = supabase_project.production
    
    22
    
      id = var.linked_project
    
    23
    
    }
    
    24
    
    25
    
    resource "supabase_project" "production" {
    
    26
    
      organization_id   = "nknnyrtlhxudbsbuazsu"
    
    27
    
      name              = "tf-project"
    
    28
    
      database_password = "tf-example"
    
    29
    
      region            = "ap-southeast-1"
    
    30
    
    31
    
      lifecycle {
    
    32
    
        ignore_changes = [database_password]
    
    33
    
      }
    
    34
    
    }
    
    35
    
    36
    
    # Configure api settings for the linked project
    
    37
    
    resource "supabase_settings" "production" {
    
    38
    
      project_ref = var.linked_project
    
    39
    
    40
    
      api = jsonencode({
    
    41
    
        db_schema            = "public,storage,graphql_public"
    
    42
    
        db_extra_search_path = "public,extensions"
    
    43
    
        max_rows             = 1000
    
    44
    
      })
    
    45
    
    }
[/code]