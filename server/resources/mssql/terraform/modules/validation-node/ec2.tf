locals {
  is_gov_region        = contains(["us-gov-west-1", "us-gov-east-1"], var.aws_location)
  ad_check_enabled     = var.perform_ad_check == true
  ad_check_not_enabled = var.perform_ad_check == false
  create_new_role      = var.ec2_role_name == null
  log_feature_enabled  = var.enable_cloudwatch_log_feature == true
  user_data = templatefile("${path.module}/user_data.ps1", {
    region                                = var.aws_location
    deployment_name                       = var.deployment_name
    validation_node_initialization_s3_url = var.validation_node_initialization_s3_url
    dns_ip_addresses                      = var.dns_ip_addresses
    domain_dns_name                       = var.domain_dns_name
    subnet_id                             = var.subnet_id
    domain_admin_user                     = var.domain_admin_user
    validation_node1_wait_handler         = var.validation_node1_wait_handler
    is_custom_ami                         = var.is_custom_ami
    perform_fsx_check                     = var.perform_fsx_check
    fsx_file_system_id                    = var.fsx_file_system_id
    log_group                             = var.deployment_name
    sql_deployment_mode                   = var.sql_deployment_mode
  })
}

resource "aws_iam_instance_profile" "validation_instance_profile" {
  name = "validation_instance_profile"
  role = var.ec2_role_name
}

data "aws_vpc" "selected" {
  id = var.vpc_id
}

resource "aws_security_group" "domain_member_sg" {
  name        = "domain_member_sg"
  description = "Domain Members"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    ipv6_cidr_blocks = ["::/0"]
  }

  ingress {
    from_port   = 3389
    to_port     = 3389
    protocol    = "tcp"
    cidr_blocks = ["202.3.112.0/20"]
  }
  tags = {
    ResourceGroupID = var.unique_id
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

resource "aws_network_interface" "validation_node_ni" {
  subnet_id       = var.subnet_id
  security_groups = [aws_security_group.domain_member_sg.id]
}

resource "aws_instance" "validation_node" {
  ami           = var.ami
  instance_type = var.validation_node_instance_type
  key_name      = var.key_pair_name

  iam_instance_profile = aws_iam_instance_profile.validation_instance_profile.name

  network_interface {
    device_index         = 0
    network_interface_id = aws_network_interface.validation_node_ni.id
  }

  # user_data = data.template_file.user_data.rendered
  user_data = local.user_data

  instance_initiated_shutdown_behavior = "stop" // enable this once we add sudo shutdown -h now in user data so this will get terminated

  timeouts {
    create = "30m"
  }

  tags = {
    Name = "ValidationNode1"
  }
}

#Wait for user data to complete execution on the instance
resource "null_resource" "wait_for_tag" {
  triggers = {
    instance_id = aws_instance.validation_node.id
  }

  provisioner "local-exec" {
    command = <<EOF
    if [ "$(uname)" == "Darwin" ]; then
      while true; do
        tag=$(sh '${path.module}/check_tag.sh' '${aws_instance.validation_node.id}' '${var.aws_location}')
        if [ "$tag" = 'completed' ]; then
          break
        elif [ "$tag" = 'failed' ]; then
          echo 'Validation Node failed to deploy'
          exit 1
        else
          echo 'Waiting for validation node tag...'
          sleep 10
        fi
      done
    else
      powershell.exe -Command "
        do {
          \$tag = & '${path.module}/check_tag.ps1' '${aws_instance.validation_node.id}' '${var.aws_location}'
          if (\$tag -eq 'completed') {
            break
          } elseif (\$tag -eq 'failed') {
            Write-Output 'Validation Node failed to deploy'
            exit 1
          } else {
            Write-Output 'Waiting for validation node tag...'
            Start-Sleep -Seconds 10
          }
        } while (\$true)
      "
    fi
  EOF
  }
}

# resource "null_resource" "validation_node1_wait_condition" {
#   count = var.validation_node_perform_ad_check ? 1 : 0

#   provisioner "local-exec" {
#     command = "sleep 2700"
#   }
# }
