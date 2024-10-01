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


# output of sql node
output "sql_node_instance_id" {
  description = "The ID of the SQL node instance"
  value       = module.ec2.sql_node_instance_id
}

output "sql_node_instance_name" {
  description = "The name of the SQL node instance"
  value       = module.ec2.sql_node_instance_name
}

output "sql_node_private_ip" {
  description = "The private IP address of the SQL node instance"
  value       = module.ec2.sql_node_private_ip
}

output "sql_workload_security_group_id" {
  description = "The ID of the workload security group"
  value       = module.ec2.sql_workload_security_group_id
}

output "sql_workload_security_group_arn" {
  description = "The ARN of the workload security group"
  value       = module.ec2.sql_workload_security_group_arn
}

# output of fsx node
output "fsx_fs_logical_id" {
  description = "Logical ID of the FSx for ONTAP file system"
  value       = module.fsxn.fsx_fs_logical_id
}

output "fsx_svm_logical_id" {
  description = "Logical ID of the storage virtual machine"
  value       = module.fsxn.fsx_svm_logical_id
}

# output of validation node
output "validation_instance_id" {
  description = "The ID of the validation node instance"
  value       = module.validation-node.instance_id
}

output "validation_instance_public_ip" {
  description = "The public IP of the validation node instance"
  value       = module.validation-node.instance_public_ip
}

output "validation_instance_private_ip" {
  description = "The private IP of the validation node instance"
  value       = module.validation-node.instance_private_ip
}

output "validation_instance_state" {
  description = "The state of the validation node instance"
  value       = module.validation-node.instance_state
}

output "validation_instance_name" {
  description = "The name of the validation instance"
  value       = module.validation-node.instance_name
}

output "absolute_path" {
  value = abspath(path.root)
}

output "operating_system" {
  value = local.is_windows ? "Windows" : "Linux"
}
