locals {
  log_feature_enabled   = var.enable_cloudwatch_log_feature == true ? "true" : "false"
  is_ha                 = var.is_standalone == false ? "true" : "false"
  ontap_security_groups = var.ontap_security_group_id == "" ? [] : split(",", var.ontap_security_group_id)
  group_set             = concat([var.workload_security_group_id], local.ontap_security_groups)
  node_type             = var.sql_node_name == "PGSQL-Node-1" ? "Primary" : "Secondary"
  # tagName             = (var.sql_node_name == "PGSQL-Node" || var.sql_node_name == "PGSQL-Node-1") ? var.sql_fsx_server_net_bios_name : var.sql_fsx_server_net_bios_name_2
  tagName = var.sql_fsx_server_net_bios_name

  user_data = templatefile("${path.module}/user_data.sh", {
    pgsql_node_initialization_s3_url = var.pgsql_node_initialization_s3_url
    aws_region                       = var.sql_node_aws_location
    log_feature_enabled              = local.log_feature_enabled
    deployment_name                  = var.deployment_name
    sql_server_name                  = var.sql_server_name
    sql_svm_name                     = var.sql_svm_name
    fsx_data_volume_name             = var.fsx_data_volume_name
    fsx_log_volume_name              = var.fsx_log_volume_name
    fsx_file_system_id               = var.fsx_file_system_id
    fsx_svm_id                       = var.fsx_svm_id
    sql_service_account_password     = var.sql_service_account_password
    sql_version                      = var.sql_version
    fsx_aggr_name                    = var.fsx_aggr_name
    fsx_svm_uuid                     = var.fsx_svm_uuid
    log_feature_enabled              = local.log_feature_enabled
    node_name                        = var.sql_node_name
    is_ha                            = local.is_ha
  })
}

resource "aws_iam_instance_profile" "standalone_pgsql_profile" {
  count = var.is_standalone ? 1 : 0
  name  = "${var.deployment_name}_pgsql_profile"
  role  = var.ec2_role_name
}

resource "aws_network_interface" "pgsql_node_ni" {
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
  ami                  = var.ami_id
  instance_type        = var.workload_instance_type
  key_name             = var.key_pair_name
  iam_instance_profile = var.is_standalone ? aws_iam_instance_profile.standalone_pgsql_profile[0].name : var.iam_instance_profile

  network_interface {
    network_interface_id = var.is_standalone ? aws_network_interface.pgsql_node_ni[0].id : var.network_interface_id
    device_index         = 0
  }

  ebs_block_device {
    device_name = "/dev/xvda"
    volume_size = var.ebs_volume_size
    volume_type = "gp3"
  }

  user_data = local.user_data

  timeouts {
    create = "90m"
  }

  tags = (
    {
      Name = local.tagName
    }
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
