---
タイトル: Using the Supabase Terraform Provider
URL: https://supabase.com/docs/guides/deployment/terraform/tutorial
カテゴリ: platform
更新日: 2026-08-02
タグ: deployment, platform, provider, supabase, terraform, tutorial, using
---

# Using the Supabase Terraform Provider

**URL:** https://supabase.com/docs/guides/deployment/terraform/tutorial
**カテゴリ:** platform
**更新日:** 2026-08-02
**タグ:** deployment, platform, provider, supabase, terraform, tutorial, using

## 目次

- [Setting up a TF module#](#setting-up-a-tf-module)
- [Creating a project#](#creating-a-project)
  - [Importing a project#](#importing-a-project)
- [Configuring a project#](#configuring-a-project)
  - [Configuring branches#](#configuring-branches)
- [Committing your changes#](#committing-your-changes)
- [Resolving config drift#](#resolving-config-drift)

## 概要

Searchdocs...

---

## Setting up a TF module#

  1. Create a Personal Access Token from Supabase Dashboard.
  2. Save your access token locally to `access-token` file or a secure credentials store.
  3. Create `module/provider.tf` with the following contents:


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
    
      access_token = file("${path.cwd}/access-token")
    
    12
    
    }
[/code]

Run the command `terraform -chdir=module apply` which should succeed in finding the provider.

## Creating a project#

Supabase projects are represented as a TF resource called `supabase_project`.

Create a `module/resource.tf` file with the following contents.
[code] 
    1
    
    # Create a project resource
    
    2
    
    resource "supabase_project" "production" {
    
    3
    
      organization_id   = "<your-org-id>"
    
    4
    
      name              = "tf-example"
    
    5
    
      database_password = "<your-password>"
    
    6
    
      region            = "ap-southeast-1"
    
    7
    
    8
    
      lifecycle {
    
    9
    
        ignore_changes = [database_password]
    
    10
    
      }
    
    11
    
    }
[/code]

Remember to substitue placeholder values with your own. For sensitive fields like password, you may consider retrieving it from a secure credentials store.

Next, run `terraform -chdir=module apply` and confirm creating the new project resource.

### Importing a project#

If you have an existing project hosted on Supabase, you may import it into your local terraform state for tracking and management.

Edit `module/resource.tf` with the following changes.
[code] 
    1
    
    # Define a linked project variable as user input
    
    2
    
    variable "linked_project" {
    
    3
    
      type = string
    
    4
    
    }
    
    5
    
    6
    
    import {
    
    7
    
      to = supabase_project.production
    
    8
    
      id = var.linked_project
    
    9
    
    }
    
    10
    
    11
    
    # Create a project resource
    
    12
    
    resource "supabase_project" "production" {
    
    13
    
      organization_id   = "<your-org-id>"
    
    14
    
      name              = "tf-example"
    
    15
    
      database_password = "<your-password>"
    
    16
    
      region            = "ap-southeast-1"
    
    17
    
    18
    
      lifecycle {
    
    19
    
        ignore_changes = [database_password]
    
    20
    
      }
    
    21
    
    }
[/code]

Run `terraform -chdir=module apply` and you will be prompted to enter the reference ID of an existing Supabase project. If your local TF state is empty, your project will be imported from remote rather than recreated.

Alternatively, you may use the `terraform import ...` command without editing the resource file.

## Configuring a project#

Keeping your project settings in-sync is easy with the `supabase_settings` resource.

Create `module/settings.tf` with the following contents.
[code] 
    1
    
    # Configure api settings for the linked project
    
    2
    
    resource "supabase_settings" "production" {
    
    3
    
      project_ref = var.linked_project
    
    4
    
    5
    
      api = jsonencode({
    
    6
    
        db_schema            = "public,storage,graphql_public"
    
    7
    
        db_extra_search_path = "public,extensions"
    
    8
    
        max_rows             = 1000
    
    9
    
      })
    
    10
    
    }
[/code]

Project settings don't exist on their own. They are created and destroyed together with their corresponding project resource referenced by the `project_ref` field. This means there is no difference between creating and updating `supabase_settings` resource while deletion is always a no-op.

You may declare any subset of fields to be managed by your TF module. The Supabase provider always performs a partial update when you run `terraform -chdir=module apply`. The underlying API call is also idempotent so it's safe to apply again if the local state is lost.

To see the full list of settings available, try importing the `supabase_settings` resource instead.

### Configuring branches#

One of the most powerful features of TF is the ability to fan out configs to multiple resources. You can easily mirror the configurations of your production project to your branch databases using the `for_each` meta-argument.

Create a `module/branches.tf` file.
[code] 
    1
    
    # Fetch all branches of a linked project
    
    2
    
    data "supabase_branch" "all" {
    
    3
    
      parent_project_ref = var.linked_project
    
    4
    
    }
    
    5
    
    6
    
    # Override settings for each preview branch
    
    7
    
    resource "supabase_settings" "branch" {
    
    8
    
      for_each = { for b in data.supabase_branch.all.branches : b.project_ref => b }
    
    9
    
    10
    
      project_ref = each.key
    
    11
    
    12
    
      api = supabase_settings.production.api
    
    13
    
    14
    
      auth = jsonencode({
    
    15
    
        site_url = "http://localhost:3001"
    
    16
    
      })
    
    17
    
    }
[/code]

When you run `terraform -chdir=module apply`, the provider will configure all branches associated with your `linked_project` to mirror the `api` settings of your production project.

In addition, the `auth.site_url` settings of your branches will be customised to a localhost URL for all branches. This allows your users to login via a separate domain for testing.

## Committing your changes#

Finally, you may commit the entire `module` directory to git for version control. This allows your CI runner to run `terraform apply` automatically on new config changes. Any command line variables can be passed to CI via `TF_VAR_*` environment variables instead.

## Resolving config drift#

Tracking your configs in TF module does not mean that you lose the ability to change configs through the dashboard. However, doing so could introduce config drift that you need to resolve manually by adding them to your `*.tf` files.