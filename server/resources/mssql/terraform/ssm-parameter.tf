resource "aws_ssm_parameter" "credentials_ssm_parameter" {
  name        = "/netapp/wlmdb/${var.deployment_name}"
  description = "SSM Parameter for active directory, FSxN and SQL service account credentials"
  type        = "SecureString"
  value       = <<EOF
{
  "fsx": {
    "username": "${var.fsx_admin_username}",
    "password": "${var.fsx_admin_password}"
  },
  "domain": {
    "username": "${var.domain_admin_user}",
    "password": "${var.domain_admin_password}"
  },
  "sql": [{
    "username": "${var.sql_service_account_name}",
    "password": "${var.sql_service_account_password}",
    "sqlinstancename": "MSSQL"
  }]
}
EOF

  tags = {
    creator = var.creator_tag
  }

  lifecycle {
    create_before_destroy = true
  }
}
