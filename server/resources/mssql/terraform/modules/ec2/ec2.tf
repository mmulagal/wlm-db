locals {
  adsg_not_selected     = var.domain_member_sg_id == "" ? true : false
  log_feature_enabled   = var.enable_cloudwatch_log_feature == true ? "true" : "false"
  ontap_security_groups = var.ontap_security_group_id == "" ? [] : split(",", var.ontap_security_group_id)
  group_set             = local.adsg_not_selected ? concat([var.workload_security_group_id], local.ontap_security_groups) : concat([var.workload_security_group_id], local.ontap_security_groups, [var.domain_member_sg_id])
  node_type             = var.sql_node_name == "SQL-Node-1" ? "Primary" : "Secondary"
  tagName               = (var.sql_node_name == "SQL-Node" || var.sql_node_name == "SQL-Node-1") ? var.sql_fsx_server_net_bios_name : var.sql_fsx_server_net_bios_name_2

  user_data = templatefile("${path.module}/user_data.ps1", {
    sql_node_initialization_s3_url = var.sql_node_initialization_s3_url
    region                         = var.sql_node_aws_location
    log_feature_enabled            = local.log_feature_enabled
    deployment_name                = var.deployment_name
    sql_server_name                = var.sql_server_name
    sql_svm_name                   = var.sql_svm_name
    fsx_data_volume_name           = var.fsx_data_volume_name
    fsx_log_volume_name            = var.fsx_log_volume_name
    fsx_file_system_id             = var.fsx_file_system_id
    fsx_temp_db_volume_name        = var.fsx_temp_db_volume_name
    fsx_quorum_volume_name         = var.fsx_quorum_volume_name
    fsx_data_lun_size              = var.fsx_data_lun_size
    sql_igroup_name                = var.sql_igroup_name
    fsx_volume_snapshot_policy     = var.fsx_volume_snapshot_policy
    ad_dns_ip_addresses            = var.ad_dns_ip_addresses
    domain_dns_name                = var.domain_dns_name
    preferred_domain_controller    = var.preferred_domain_controller
    ou_path                        = var.ou_path
    domain_admin_user              = var.domain_admin_user
    sql_admin_accounts             = var.sql_admin_accounts
    sql_collation                  = var.sql_collation

    sql_node_name                  = var.sql_node_name
    is_standalone                  = var.is_standalone
    workload_security_group_id     = var.workload_security_group_id
    mssql_media_bucket_name        = var.mssql_media_bucket_name
    ami_id                         = var.ami_id
    mssql_media_path_key           = var.mssql_media_path_key
    sql_fsx_ws_fc_name             = var.sql_fsx_ws_fc_name
    sql_fsx_fci_name               = var.sql_fsx_fci_name
    sql_fsx_server_net_bios_name   = var.sql_fsx_server_net_bios_name
    sql_fsx_server_net_bios_name_2 = var.sql_fsx_server_net_bios_name_2
    network_interface_1_id         = var.network_interface_1_id
    network_interface_2_id         = var.network_interface_2_id
    private_subnet1_id             = var.private_subnet1_id
    private_subnet2_id             = var.private_subnet2_id
  })
}

resource "aws_iam_instance_profile" "standalone_sql_fsx_profile" {
  count = var.is_standalone ? 1 : 0
  name  = "${var.deployment_name}_sql_fsx_profile"
  role  = var.ec2_role_name
}

resource "aws_network_interface" "sql_node_ni" {
  count             = var.is_standalone ? 1 : 0
  subnet_id         = var.private_subnet_id
  private_ips_count = 2
  security_groups   = local.group_set

  tags = {
    Name          = local.tagName
    SQLServerName = var.sql_server_name
  }
}

resource "aws_instance" "sql_node" {
  # depends_on = [null_resource.check_user_data_tag]

  ami                  = var.ami_id
  instance_type        = var.workload_instance_type
  key_name             = var.key_pair_name
  iam_instance_profile = var.is_standalone ? aws_iam_instance_profile.standalone_sql_fsx_profile[0].name : var.iam_instance_profile

  network_interface {
    network_interface_id = var.is_standalone ? aws_network_interface.sql_node_ni[0].id : var.network_interface_id
    device_index         = 0
  }

  ebs_block_device {
    device_name = "/dev/sda1"
    volume_size = var.ebs_volume_size
    volume_type = "gp3"
  }

  user_data = local.user_data

  timeouts {
    create = "90m"
  }

  tags = merge(
    {
      Name = local.tagName
    },
    var.is_standalone ? {} : { FCIName = var.sql_fsx_fci_name, FCIRole = local.node_type }
  )
}


#Wait for user data to complete execution on the instance for mac and linux hosts
resource "null_resource" "wait_for_tag_mac_or_linux" {
  count = var.operating_system == "Linux" ? 1 : 0

  triggers = {
    instance_id = aws_instance.sql_node.id
  }

  provisioner "local-exec" {
    command = "sh '${path.root}/scripts/wait_for_tag.sh' '${path.root}' '${aws_instance.sql_node.id}' '${var.sql_node_aws_location}' '${var.sql_node_name}' '${var.aws_profile}'"
  }
}

# Wait for user data to complete execution on the instance for windows host
resource "null_resource" "wait_for_tag_windows" {
  count = var.operating_system == "Windows" ? 1 : 0

  triggers = {
    instance_id = aws_instance.sql_node.id
  }

  provisioner "local-exec" {
    command = "powershell.exe -ExecutionPolicy Bypass -File ${path.root}/scripts/wait_for_tag.ps1 ${path.root} ${aws_instance.sql_node.id} ${var.sql_node_aws_location} ${var.sql_node_name} ${var.aws_profile}"
  }
}
