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
output "standalone_sql_node_instance_id" {
  description = "The ID of the standalone SQL Node instance"
  value       = length(module.standalone_sql_node) > 0 ? module.standalone_sql_node[0].sql_node_instance_id : null
}

output "standalone_sql_node_private_ip" {
  description = "The private IP of the standalone SQL Node instance"
  value       = length(module.standalone_sql_node) > 0 ? module.standalone_sql_node[0].sql_node_private_ip : null
}

output "standalone_sql_node_instance_name" {
  description = "The name of the standalone SQL Node instance"
  value       = length(module.standalone_sql_node) > 0 ? module.standalone_sql_node[0].sql_node_instance_name : null
}

output "sql_node1_instance_id" {
  description = "The ID of the SQL Node 1 instance"
  value       = length(module.fci_sql_node1) > 0 ? module.fci_sql_node1[0].sql_node_instance_id : null
}

output "sql_node1_private_ip" {
  description = "The private IP of the SQL Node 1 instance"
  value       = length(module.fci_sql_node1) > 0 ? module.fci_sql_node1[0].sql_node_private_ip : null
}

output "sql_node1_instance_name" {
  description = "The name of the SQL Node 1 instance"
  value       = length(module.fci_sql_node1) > 0 ? module.fci_sql_node1[0].sql_node_instance_name : null
}

output "sql_node2_instance_id" {
  description = "The ID of the SQL Node 2 instance"
  value       = length(module.fci_sql_node2) > 0 ? module.fci_sql_node2[0].sql_node_instance_id : null
}

output "sql_node2_private_ip" {
  description = "The private IP of the SQL Node 2 instance"
  value       = length(module.fci_sql_node2) > 0 ? module.fci_sql_node2[0].sql_node_private_ip : null
}

output "sql_node2_instance_name" {
  description = "The name of the SQL Node 2 instance"
  value       = length(module.fci_sql_node2) > 0 ? module.fci_sql_node2[0].sql_node_instance_name : null
}

# output of fsx node
# For standalone
output "fsx_fs_standalone_logical_id" {
  description = "Logical ID of the FSx for ONTAP file system"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_fs_logical_id : null
}

output "fsx_svm_standalone_logical_id" {
  description = "Logical ID of the storage virtual machine"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_svm_logical_id : null
}

output "fsx_svm_standalone_arn" {
  description = "ARN of the storage virtual machine"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_svm_arn : null
}

output "fsx_svm_standalone_id" {
  description = "System generated ID of the storage virtual machine"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_svm_id : null
}

output "fsx_svm_standalone_uuid" {
  description = "System generated UUID of the storage virtual machine"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_svm_uuid : null
}

output "fsx_fs_standalone_resource_arn" {
  description = "ARN of the FSx for ONTAP file system"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_fs_resource_arn : null
}

output "fsx_data_volume_standalone_logical_id" {
  description = "Logical ID of the FSx for ONTAP data volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_data_volume_logical_id : null
}

output "fsx_data_volume_standalone_arn" {
  description = "ARN of the FSx for ONTAP data volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_data_volume_arn : null
}

output "fsx_data_volume_standalone_id" {
  description = "System generated ID of volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_data_volume_id : null
}

output "fsx_data_volume_standalone_uuid" {
  description = "System generated UUID of volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_data_volume_uuid : null
}

output "fsx_log_volume_standalone_logical_id" {
  description = "Logical ID of the FSx for ONTAP log volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_log_volume_logical_id : null
}

output "fsx_log_volume_standalone_arn" {
  description = "ARN of the FSx for ONTAP log volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_log_volume_arn : null
}

output "fsx_log_volume_standalone_id" {
  description = "System generated ID of log volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_log_volume_id : null
}

output "fsx_log_volume_standalone_uuid" {
  description = "System generated UUID of log volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_log_volume_uuid : null
}

output "fsx_cluster_volume_standalone_logical_id" {
  description = "Logical ID of the FSx for ONTAP cluster volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_cluster_volume_logical_id : "Not Created"
}

output "fsx_cluster_volume_standalone_arn" {
  description = "ARN of the FSx for ONTAP cluster volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_cluster_volume_arn : "Not Created"
}

output "fsx_cluster_volume_standalone_id" {
  description = "System generated ID of cluster volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_cluster_volume_id : "Not Created"
}

output "fsx_cluster_volume_standalone_uuid" {
  description = "System generated UUID of cluster volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_cluster_volume_uuid : "Not Created"
}

output "fsx_temp_dp_volume_standalone_logical_id" {
  description = "Logical ID of the FSx for ONTAP temp db volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_temp_dp_volume_logical_id : null
}

output "fsx_temp_dp_volume_standalone_arn" {
  description = "ARN of the FSx for ONTAP temp db volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_temp_dp_volume_arn : null
}

output "fsx_temp_dp_volume_standalone_id" {
  description = "System generated ID of temp db volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_temp_dp_volume_id : null
}

output "fsx_temp_dp_volume_standalone_uuid" {
  description = "System generated UUID of temp dp volume"
  value       = length(module.fsxn_standalone) > 0 ? module.fsxn_standalone[0].fsx_temp_dp_volume_uuid : null
}

# For FCI
output "fsx_fs_fci_logical_id" {
  description = "Logical ID of the FSx for ONTAP file system"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_fs_logical_id : null
}

output "fsx_svm_fci_logical_id" {
  description = "Logical ID of the storage virtual machine"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_svm_logical_id : null
}

output "fsx_svm_fci_arn" {
  description = "ARN of the storage virtual machine"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_svm_arn : null
}

output "fsx_svm_fci_id" {
  description = "System generated ID of the storage virtual machine"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_svm_id : null
}

output "fsx_svm_fci_uuid" {
  description = "System generated UUID of the storage virtual machine"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_svm_uuid : null
}

output "fsx_fs_fci_resource_arn" {
  description = "ARN of the FSx for ONTAP file system"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_fs_resource_arn : null
}

output "fsx_data_volume_fci_logical_id" {
  description = "Logical ID of the FSx for ONTAP data volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_data_volume_logical_id : null
}

output "fsx_data_volume_fci_arn" {
  description = "ARN of the FSx for ONTAP data volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_data_volume_arn : null
}

output "fsx_data_volume_fci_id" {
  description = "System generated ID of volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_data_volume_id : null
}

output "fsx_data_volume_fci_uuid" {
  description = "System generated UUID of volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_data_volume_uuid : null
}

output "fsx_log_volume_fci_logical_id" {
  description = "Logical ID of the FSx for ONTAP log volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_log_volume_logical_id : null
}

output "fsx_log_volume_fci_arn" {
  description = "ARN of the FSx for ONTAP log volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_log_volume_arn : null
}

output "fsx_log_volume_fci_id" {
  description = "System generated ID of log volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_log_volume_id : null
}

output "fsx_log_volume_fci_uuid" {
  description = "System generated UUID of log volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_log_volume_uuid : null
}

output "fsx_cluster_volume_fci_logical_id" {
  description = "Logical ID of the FSx for ONTAP cluster volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_cluster_volume_logical_id : "Not Created"
}

output "fsx_cluster_volume_fci_arn" {
  description = "ARN of the FSx for ONTAP cluster volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_cluster_volume_arn : "Not Created"
}

output "fsx_cluster_volume_fci_id" {
  description = "System generated ID of cluster volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_cluster_volume_id : "Not Created"
}

output "fsx_cluster_volume_fci_uuid" {
  description = "System generated UUID of cluster volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_cluster_volume_uuid : "Not Created"
}

output "fsx_temp_dp_volume_fci_logical_id" {
  description = "Logical ID of the FSx for ONTAP temp db volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_temp_dp_volume_logical_id : null
}

output "fsx_temp_dp_volume_fci_arn" {
  description = "ARN of the FSx for ONTAP temp db volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_temp_dp_volume_arn : null
}

output "fsx_temp_dp_volume_fci_id" {
  description = "System generated ID of temp db volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_temp_dp_volume_id : null
}

output "fsx_temp_dp_volume_fci_uuid" {
  description = "System generated UUID of temp dp volume"
  value       = length(module.fsxn_fci) > 0 ? module.fsxn_fci[0].fsx_temp_dp_volume_uuid : null
}

output "absolute_path" {
  value = abspath(path.root)
}

output "operating_system" {
  value = local.is_windows ? "Windows" : "Linux"
}


#output for fci resources
output "sql_node_ni_1_primary_private_ip" {
  value = length(aws_network_interface.sql_node_ni_1) > 0 ? tolist(aws_network_interface.sql_node_ni_1[0].private_ips)[0] : null
}

output "sql_node_ni_1_secondary_private_ip_1" {
  value = length(aws_network_interface.sql_node_ni_1) > 0 ? tolist(aws_network_interface.sql_node_ni_1[0].private_ips)[1] : null
}

output "sql_node_ni_1_secondary_private_ip_2" {
  value = length(aws_network_interface.sql_node_ni_1) > 0 ? tolist(aws_network_interface.sql_node_ni_1[0].private_ips)[2] : null
}


output "sql_node_ni_2_primary_private_ip" {
  value = length(aws_network_interface.sql_node_ni_2) > 0 ? tolist(aws_network_interface.sql_node_ni_2[0].private_ips)[0] : null
}

output "sql_node_ni_2_secondary_private_ip_1" {
  value = length(aws_network_interface.sql_node_ni_2) > 0 ? tolist(aws_network_interface.sql_node_ni_2[0].private_ips)[1] : null
}

output "sql_node_ni_2_secondary_private_ip_2" {
  value = length(aws_network_interface.sql_node_ni_2) > 0 ? tolist(aws_network_interface.sql_node_ni_2[0].private_ips)[2] : null
}


output "sql_workload_security_group_id" {
  description = "The ID of the workload security group"
  value       = aws_security_group.workload_security_group.id
}

output "sql_workload_security_group_arn" {
  description = "The ARN of the workload security group"
  value       = aws_security_group.workload_security_group.arn
}
