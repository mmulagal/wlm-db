locals {
  is_gov_region        = contains(["us-gov-west-1", "us-gov-east-1"], var.validation_node_aws_location)
  ad_check_enabled     = var.validation_node_perform_ad_check == true
  ad_check_not_enabled = var.validation_node_perform_ad_check == false
  create_new_role      = var.validation_node_ec2_role_name == null
  log_feature_enabled  = var.validation_node_enable_cloudwatch_log == true
}

resource "aws_iam_instance_profile" "validation_instance_profile" {
  name = "validation_instance_profile"
  role = var.validation_node_ec2_role_name
}

resource "aws_security_group" "domain_member_sg" {
  name        = "domain_member_sg"
  description = "Domain Members"
  vpc_id      = var.validation_node_vpc_id

  tags = {
    ResourceGroupID = var.validation_node_unique_id
  }
}

resource "aws_launch_template" "disable_imdsv1" {
  name = "disable_imdsv1"

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_size = 8
    }
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }
}

resource "null_resource" "validation_node1_wait_condition" {
  count = var.validation_node_perform_ad_check ? 1 : 0

  provisioner "local-exec" {
    command = "sleep 2700"
  }
}

resource "aws_network_interface" "validation_node_ni" {
  subnet_id       = var.validation_node_subnet_id
  security_groups = [aws_security_group.domain_member_sg.id]
}

resource "aws_instance" "validation_node" {
  ami           = var.validation_node_ami
  instance_type = var.validation_node_instance_type
  key_name      = var.validation_node_key_pair_name

  iam_instance_profile = aws_iam_instance_profile.validation_instance_profile.name

  network_interface {
    device_index         = 0
    network_interface_id = aws_network_interface.validation_node_ni.id
  }

  user_data = data.template_file.user_data.rendered

  instance_initiated_shutdown_behavior = "terminate"

  tags = {
    Name = "ValidationNode1"
  }
}

data "template_file" "user_data" {
  template = file("${path.module}/user_data.ps1")

  vars = {
    region             = var.validation_node_aws_location
    deployment_name    = var.validation_node_deployment_name
    s3_artifacts_url   = var.validation_node_s3_artifacts_url
    dns_ip_addresses   = var.validation_node_dns_ip_addresses
    domain_dns_name    = var.validation_node_domain_dns_name
    subnet_id          = var.validation_node_subnet_id
    domain_admin_user  = var.validation_node_domain_admin_user
    wait_handler       = var.validation_node1_wait_handler
    is_custom_ami      = var.validation_node_is_custom_ami
    perform_fsx_check  = var.validation_node_perform_fsx_check
    fsx_file_system_id = var.validation_node_fsx_file_system_id
    log_group          = var.validation_node_deployment_name
  }
}
