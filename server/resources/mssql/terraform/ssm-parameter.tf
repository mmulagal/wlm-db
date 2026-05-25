# Read credentials from SSM parameters when ARNs are provided (GovCloud flow)
data "aws_ssm_parameter" "fsx_credentials" {
  count           = var.fsx_ssm_parameter_arn != "" ? 1 : 0
  name            = "/${regex("parameter/(.+)$", var.fsx_ssm_parameter_arn)[0]}"
  with_decryption = true
}

data "aws_ssm_parameter" "ad_credentials" {
  count           = var.ad_ssm_parameter_arn != "" ? 1 : 0
  name            = "/${regex("parameter/(.+)$", var.ad_ssm_parameter_arn)[0]}"
  with_decryption = true
}

data "aws_ssm_parameter" "sql_credentials" {
  count           = var.sql_ssm_parameter_arn != "" ? 1 : 0
  name            = "/${regex("parameter/(.+)$", var.sql_ssm_parameter_arn)[0]}"
  with_decryption = true
}

locals {
  is_gov_region = can(regex("^us-gov-", var.aws_location))

  fsx_creds = var.fsx_ssm_parameter_arn != "" ? jsondecode(data.aws_ssm_parameter.fsx_credentials[0].value) : null
  ad_creds  = var.ad_ssm_parameter_arn != "" ? jsondecode(data.aws_ssm_parameter.ad_credentials[0].value) : null
  sql_creds = var.sql_ssm_parameter_arn != "" ? jsondecode(data.aws_ssm_parameter.sql_credentials[0].value) : null

  resolved_fsx_username = local.fsx_creds != null ? local.fsx_creds.username : var.fsx_admin_username
  resolved_fsx_password = local.fsx_creds != null ? local.fsx_creds.password : var.fsx_admin_password

  resolved_ad_username = local.ad_creds != null ? local.ad_creds.username : var.domain_admin_user
  resolved_ad_password = local.ad_creds != null ? local.ad_creds.password : var.domain_admin_password

  resolved_sql_username = local.sql_creds != null ? local.sql_creds.username : var.sql_service_account_name
  resolved_sql_password = local.sql_creds != null ? local.sql_creds.password : var.sql_service_account_password
}

resource "aws_ssm_parameter" "credentials_ssm_parameter" {
  name        = "/netapp/wlmdb/${var.deployment_name}"
  description = "SSM Parameter for active directory, FSxN and SQL service account credentials"
  type        = "SecureString"
  value       = <<EOF
{
  "fsx": {
    "username": "${local.resolved_fsx_username}",
    "password": "${local.resolved_fsx_password}"
  },
  "domain": {
    "username": "${local.resolved_ad_username}",
    "password": "${local.resolved_ad_password}"
  },
  "sql": [{
    "username": "${local.resolved_sql_username}",
    "password": "${local.resolved_sql_password}",
    "sqlinstancename": "MSSQL"
  }]
}
EOF

  tags = {
    creator = var.creator_tag
  }

  lifecycle {
    create_before_destroy = true

    precondition {
      condition     = !local.is_gov_region || (var.fsx_ssm_parameter_arn != "" && var.ad_ssm_parameter_arn != "" && var.sql_ssm_parameter_arn != "")
      error_message = "GovCloud deployments require fsx_ssm_parameter_arn, ad_ssm_parameter_arn, and sql_ssm_parameter_arn to be provided."
    }

    precondition {
      condition     = local.is_gov_region || (var.fsx_admin_password != "" && var.domain_admin_password != "" && var.sql_service_account_password != "")
      error_message = "Commercial deployments require fsx_admin_password, domain_admin_password, and sql_service_account_password to be provided."
    }
  }
}
