output "credentials_ssm_parameter_name" {
  value = aws_ssm_parameter.credentials_ssm_parameter.name
}

output "credentials_ssm_parameter_description" {
  value = aws_ssm_parameter.credentials_ssm_parameter.description
}

output "credentials_ssm_parameter_value" {
  value     = aws_ssm_parameter.credentials_ssm_parameter.value
  sensitive = true
}

output "credentials_ssm_parameter_tags" {
  value = aws_ssm_parameter.credentials_ssm_parameter.tags
}

output "role_name" {
  value = aws_iam_role.ec2_iam_role.name
}

output "role_id" {
  value = aws_iam_role.ec2_iam_role.id
}

# Output policy name and policy ID
output "policy_name" {
  value = aws_iam_role_policy.ec2_iam_role_policy.name
}

output "policy_id" {
  value = aws_iam_role_policy.ec2_iam_role_policy.id
}
