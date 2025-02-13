resource "aws_ssm_parameter" "credentials_ssm_parameter" {
  name        = "/netapp/wlmdb/${var.deployment_name}"
  description = "SSM Parameter for FSxN and other credentials"
  type        = "String"
  value       = <<EOF
{
  "fsx": {
    "username": "${var.fsx_admin_username}",
    "password": "${var.fsx_admin_password}"
  },
  "pgsql": [{
    "username": "postgres",
    "password": "${var.sql_service_account_password}",
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
