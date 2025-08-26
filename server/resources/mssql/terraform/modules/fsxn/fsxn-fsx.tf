locals {
  fsx_is_provision_mode_automatic = var.fsx_disk_iops == 3 ? true : false
  fsx_is_kms_key_id_empty         = var.fsx_kms_key_id == "" ? true : false
  fsx_is_single_zone_deployment   = (var.deployment_mode == "SINGLE_AZ_1" || var.deployment_mode == "SINGLE_AZ_2") ? true : false
  fsx_is_multi_zone_deployment    = (var.deployment_mode == "MULTI_AZ_1" || var.deployment_mode == "MULTI_AZ_2")  ? true : false
  fsx_is_existing                 = var.fsx_file_system_id != "" ? true : false
  is_route_table_ids_same         = var.preferred_route_table_id == var.standby_route_table_id
  sg_cidr_blocks                  = local.fsx_is_single_zone_deployment ? [var.preferred_subnet_cidrblock] : [var.preferred_subnet_cidrblock, var.standby_subnet_cidrblock]
  route_table_ids                 = local.fsx_is_multi_zone_deployment ? (local.is_route_table_ids_same ? [var.preferred_route_table_id] : [var.preferred_route_table_id, var.standby_route_table_id]) : null
}

resource "aws_fsx_ontap_file_system" "fsx_ontap_fs" {
  // Create the fsx only when its new
  count = local.fsx_is_existing ? 0 : 1

  depends_on         = [aws_security_group.ontap_security_group]
  kms_key_id         = local.fsx_is_kms_key_id_empty ? null : var.fsx_kms_key_id
  security_group_ids = [aws_security_group.ontap_security_group[0].id]
  storage_capacity   = var.fsx_storage_capacity
  storage_type       = "SSD"
  subnet_ids         = local.fsx_is_multi_zone_deployment ? [var.preferred_subnet_id, var.standby_subnet_id] : [var.preferred_subnet_id]

  # ontap_configuration 
  automatic_backup_retention_days = 0
  weekly_maintenance_start_time   = var.fsx_weekly_maintenance_start_time
  deployment_type                 = var.deployment_mode
  fsx_admin_password              = var.fsx_administrator_password
  preferred_subnet_id             = var.preferred_subnet_id
  route_table_ids                 = local.route_table_ids
  throughput_capacity             = var.fsx_volume_throughput_capacity

  dynamic "disk_iops_configuration" {
    for_each = var.fsx_disk_iops != 3 ? [1] : []
    content {
      iops = var.fsx_disk_iops
      mode = "USER_PROVISIONED"
    }
  }

  tags = {
    Name = var.fsx_file_system_name
  }
}


