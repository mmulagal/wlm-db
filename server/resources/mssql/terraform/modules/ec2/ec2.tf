locals {
  adsg_not_selected   = var.domain_member_sg_id == "" ? 1 : 0
  log_feature_enabled = var.enable_cloudwatch_log_feature == "true" ? 1 : 0
  group_set           = local.adsg_not_selected ? [aws_security_group.workload_security_group.id, var.ontap_security_group_id] : [aws_security_group.workload_security_group.id, var.ontap_security_group_id, var.domain_member_sg_id]
}

resource "aws_launch_template" "disable_imdsv1" {
  name_prefix = "disable_imdsv1"

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }
}

resource "aws_iam_instance_profile" "launch_wizard_sql_fsx_profile" {
  name = "launch_wizard_sql_fsx_profile"
  role = var.ec2_role_name
}

resource "aws_network_interface" "ni" {
  subnet_id         = var.private_subnet_id
  private_ips_count = 2
  security_groups   = local.group_set

  tags = {
    Name          = var.sql_fsx_server_net_bios_name
    SQLServerName = var.sql_server_name
  }
}

resource "aws_instance" "sql_node" {
  ami                  = var.ami_id
  instance_type        = var.workload_instance_type
  key_name             = var.key_pair_name
  iam_instance_profile = aws_iam_instance_profile.launch_wizard_sql_fsx_profile.name

  network_interface {
    network_interface_id = aws.aws_network_interface_ni.id
    device_index         = 0
  }

  ebs_block_device {
    device_name = "/dev/sda1"
    volume_size = var.ebs_volume_size
    volume_type = "gp3"
  }

  user_data = data.template_file.user_data.rendered
  tags = {
    Name = var.sql_fsx_server_net_bios_name
  }
}

# Wait for user data to complete execution on the instance
resource "null_resource" "sql_node_user_data" {
  triggers = {
    instance_id = aws_instance.sql_node.id
  }

  provisioner "remote-exec" {
    inline = [
      "while [ ! -f /tmp/user_data_done ]; do sleep 5; done"
    ]

    connection {
      type        = "ssh"
      user        = "ec2-user" # replace with the appropriate user
      private_key = file(var.sql_node_key_pair_private_key_path)
      host        = aws_instance.sql_node.public_ip
    }
  }
}

data "template_file" "user_data" {
  template = file("${path.module}/user_data.ps1")

  vars = {
    vars = {
      s3_artifacts_url           = var.sql_node_s3_artifacts_url
      region                     = var.sql_node_aws_location
      log_feature_enabled        = local.log_feature_enabled
      deployment_name            = var.deployment_name
      sql_server_name            = var.sql_server_name
      sql_svm_name               = var.sql_svm_name
      fsx_data_volume_name       = var.fsx_data_volume_name
      fsx_log_volume_name        = var.fsx_log_volume_name
      fsx_file_system_id         = var.fsx_file_system_id
      fsx_temp_db_volume_name    = var.fsx_temp_db_volume_name
      fsx_data_lun_size          = var.fsx_data_lun_size
      sql_igroup_name            = var.sql_igroup_name
      fsx_volume_snapshot_policy = var.fsx_volume_snapshot_policy
      ad_dns_ip_addresses        = var.ad_dns_ip_addresses
      domain_dns_name            = var.domain_dns_name
      domain_admin_user          = var.domain_admin_user
      sql_admin_accounts         = "sqlsa"
      sql_collation              = var.sql_collation
    }
  }
}


// subnet check in vpc
# data "aws_vpc" "selected" {
#   id = var.vpc_id
# }

# data "aws_subnet" "selected" {
#   for_each = toset(var.subnet_ids)
# }

# locals {
#   all_subnets_in_vpc = alltrue([
#     for subnet in data.aws_subnet.selected : subnet.vpc_id == data.aws_vpc.selected.id
#   ])
# }

# output "all_subnets_in_vpc" {
#   value       = local.all_subnets_in_vpc
#   description = "Are all subnets in the VPC?"
# }

