# Read credentials from SSM parameters when ARNs are provided (GovCloud flow)
data "aws_ssm_parameter" "fsx_credentials" {
  count           = var.fsx_ssm_parameter_arn != "" ? 1 : 0
  name            = "/${regex("parameter/(.+)$", var.fsx_ssm_parameter_arn)[0]}"
  with_decryption = true
}

data "aws_ssm_parameter" "sql_credentials" {
  count           = var.sql_ssm_parameter_arn != "" ? 1 : 0
  name            = "/${regex("parameter/(.+)$", var.sql_ssm_parameter_arn)[0]}"
  with_decryption = true
}

locals {
  is_gov_region = can(regex("^us-gov-", var.aws_location))

  fsx_creds_raw = var.fsx_ssm_parameter_arn != "" ? jsondecode(data.aws_ssm_parameter.fsx_credentials[0].value) : null
  sql_creds_raw = var.sql_ssm_parameter_arn != "" ? jsondecode(data.aws_ssm_parameter.sql_credentials[0].value) : null

  # Normalize to consistent { username, password } shape to satisfy Terraform's type checker.
  # Supports nested format ({ fsx: { username, password } }) and flat format ({ username, password }).
  # Variadic try() evaluates left-to-right, returns first success; "" fallback is safe due to preconditions below.
  fsx_creds = local.fsx_creds_raw != null ? {
    username = try(local.fsx_creds_raw.fsx.username, local.fsx_creds_raw.username, "")
    password = try(local.fsx_creds_raw.fsx.password, local.fsx_creds_raw.password, "")
  } : null

  # Supports nested pgsql/sql array or flat format
  sql_creds = local.sql_creds_raw != null ? {
    username = try(local.sql_creds_raw.pgsql[0].username, local.sql_creds_raw.pgsql.username, local.sql_creds_raw.sql[0].username, local.sql_creds_raw.username, "")
    password = try(local.sql_creds_raw.pgsql[0].password, local.sql_creds_raw.pgsql.password, local.sql_creds_raw.sql[0].password, local.sql_creds_raw.password, "")
  } : null

  resolved_fsx_username = local.fsx_creds != null ? local.fsx_creds.username : var.fsx_admin_username
  resolved_fsx_password = local.fsx_creds != null ? local.fsx_creds.password : var.fsx_admin_password

  resolved_sql_password = local.sql_creds != null ? local.sql_creds.password : var.sql_service_account_password
}

resource "aws_ssm_parameter" "credentials_ssm_parameter" {
  name        = "/netapp/wlmdb/${var.deployment_name}"
  description = "SSM Parameter for FSxN and other credentials"
  type        = "SecureString"
  value       = <<EOF
{
  "fsx": {
    "username": "${local.resolved_fsx_username}",
    "password": "${local.resolved_fsx_password}"
  },
  "pgsql": [{
    "username": "postgres",
    "password": "${local.resolved_sql_password}"
  }]
}
EOF

  tags = {
    creator = var.creator_tag
  }

  lifecycle {
    create_before_destroy = true

    precondition {
      condition     = !local.is_gov_region || (var.fsx_ssm_parameter_arn != "" && var.sql_ssm_parameter_arn != "")
      error_message = "GovCloud deployments require fsx_ssm_parameter_arn and sql_ssm_parameter_arn to be provided."
    }

    precondition {
      condition     = local.is_gov_region || (var.fsx_admin_password != "" && var.sql_service_account_password != "")
      error_message = "Commercial deployments require fsx_admin_password and sql_service_account_password to be provided."
    }
  }
}
