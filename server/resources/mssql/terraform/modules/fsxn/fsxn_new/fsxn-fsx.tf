locals {
  fsx_is_provision_mode_automatic = var.fsx_disk_iops == 3 ? true : false
  fsx_is_kms_key_id_empty         = var.fsx_kms_key_id == "" ? true : false
  fsx_is_single_zone_deployment   = var.deployment_mode == "SINGLE_AZ_1" ? true : false
  fsx_is_multi_zone_deployment    = var.deployment_mode == "MULTI_AZ_1" ? true : false
}

resource "aws_fsx_ontap_file_system" "fsx_ontap_fs" {
  # file_system_type   = "ONTAP"

  kms_key_id         = local.fsx_is_kms_key_id_empty ? null : var.fsx_kms_key_id
  security_group_ids = [aws_security_group.ontap_security_group.id]
  storage_capacity   = var.fsx_storage_capacity
  storage_type       = "SSD"
  subnet_ids         = local.fsx_is_multi_zone_deployment ? [var.preferred_subnet_id, var.standby_subnet_id] : [var.preferred_subnet_id]
  # ontap_configuration 
  automatic_backup_retention_days = 0
  weekly_maintenance_start_time   = var.fsx_weekly_maintenance_start_time
  deployment_type                 = var.deployment_mode
  disk_iops_configuration {
    iops = local.fsx_is_provision_mode_automatic ? null : var.fsx_disk_iops
    mode = local.fsx_is_provision_mode_automatic ? "AUTOMATIC" : "USER_PROVISIONED"
  }
  fsx_admin_password  = var.fsx_administrator_password
  preferred_subnet_id = var.preferred_subnet_id
  route_table_ids     = local.fsx_is_multi_zone_deployment ? [var.preferred_route_table_id, var.standby_route_table_id] : null
  throughput_capacity = var.fsx_volume_throughput_capacity

  tags = {
    Name = var.fsx_file_system_name
  }
}


