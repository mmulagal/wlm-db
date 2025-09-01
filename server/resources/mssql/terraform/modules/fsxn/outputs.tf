# For Fsx for ONTAP
output "fsx_fs_logical_id" {
  description = "Logical ID of the FSx for ONTAP file system"
  value       = local.fsx_is_existing ? var.fsx_file_system_id : aws_fsx_ontap_file_system.fsx_ontap_fs[0].id
}

#For SVM
output "fsx_svm_logical_id" {
  description = "Logical ID of the storage virtual machine"
  value       = aws_fsx_ontap_storage_virtual_machine.fsx_svm_01.id
}

output "fsx_svm_arn" {
  description = "ARN of the storage virtual machine"
  value       = aws_fsx_ontap_storage_virtual_machine.fsx_svm_01.arn
}

output "fsx_svm_id" {
  description = "System generated ID of the storage virtual machine"
  value       = aws_fsx_ontap_storage_virtual_machine.fsx_svm_01.id
}

output "fsx_svm_uuid" {
  description = "System generated UUID of the storage virtual machine"
  value       = aws_fsx_ontap_storage_virtual_machine.fsx_svm_01.uuid
}

output "fsx_fs_resource_arn" {
  description = "ARN of the FSx for ONTAP file system"
  value       = local.fsx_is_existing ? null : aws_fsx_ontap_file_system.fsx_ontap_fs[0].arn
}

# For Data Volume
output "fsx_data_volume_logical_id" {
  description = "Logical ID of the FSx for ONTAP data volume"
  value       = aws_fsx_ontap_volume.fsx_data_volume.id
}

output "fsx_data_volume_arn" {
  description = "ARN of the FSx for ONTAP data volume"
  value       = aws_fsx_ontap_volume.fsx_data_volume.arn
}

output "fsx_data_volume_id" {
  description = "System generated ID of volume"
  value       = aws_fsx_ontap_volume.fsx_data_volume.id
}

output "fsx_data_volume_uuid" {
  description = "System generated UUID of volume"
  value       = aws_fsx_ontap_volume.fsx_data_volume.uuid
}

# For Log Volume
output "fsx_log_volume_logical_id" {
  description = "Logical ID of the FSx for ONTAP log volume"
  value       = aws_fsx_ontap_volume.fsx_log_volume.id
}

output "fsx_log_volume_arn" {
  description = "ARN of the FSx for ONTAP log volume"
  value       = aws_fsx_ontap_volume.fsx_log_volume.arn
}

output "fsx_log_volume_id" {
  description = "System generated ID of log volume"
  value       = aws_fsx_ontap_volume.fsx_log_volume.id
}

output "fsx_log_volume_uuid" {
  description = "System generated UUID of log volume"
  value       = aws_fsx_ontap_volume.fsx_log_volume.uuid
}

# For Cluster Volume
output "fsx_cluster_volume_logical_id" {
  description = "Logical ID of the FSx for ONTAP cluster volume"
  value       = local.fsx_is_multi_zone_deployment && var.sql_deployment_mode != "standalone" ? aws_fsx_ontap_volume.fsx_cluster_quorum_volume[0].id : "Not Created"
}

output "fsx_cluster_volume_arn" {
  description = "ARN of the FSx for ONTAP cluster volume"
  value       = local.fsx_is_multi_zone_deployment && var.sql_deployment_mode != "standalone" ? aws_fsx_ontap_volume.fsx_cluster_quorum_volume[0].arn : "Not Created"
}

output "fsx_cluster_volume_id" {
  description = "System generated ID of cluster volume"
  value       = local.fsx_is_multi_zone_deployment && var.sql_deployment_mode != "standalone" ? aws_fsx_ontap_volume.fsx_cluster_quorum_volume[0].id : "Not Created"
}

output "fsx_cluster_volume_uuid" {
  description = "System generated UUID of cluster volume"
  value       = local.fsx_is_multi_zone_deployment && var.sql_deployment_mode != "standalone" ? aws_fsx_ontap_volume.fsx_cluster_quorum_volume[0].uuid : "Not Created"
}

# For Temp DP Volume
output "fsx_temp_dp_volume_logical_id" {
  description = "Logical ID of the FSx for ONTAP temp db volume"
  value       = aws_fsx_ontap_volume.fsx_temp_db_volume.id
}

output "fsx_temp_dp_volume_arn" {
  description = "ARN of the FSx for ONTAP temp db volume"
  value       = aws_fsx_ontap_volume.fsx_temp_db_volume.arn
}

output "fsx_temp_dp_volume_id" {
  description = "System generated ID of temp db volume"
  value       = aws_fsx_ontap_volume.fsx_temp_db_volume.id
}

output "fsx_temp_dp_volume_uuid" {
  description = "System generated UUID of temp dp volume"
  value       = aws_fsx_ontap_volume.fsx_temp_db_volume.uuid
}

#For FSX Security Group
output "fsxn_security_group_id" {
  description = "The ID of the fsxn security group."
  value       = local.fsx_is_existing ? null : aws_security_group.ontap_security_group[0].id
}
