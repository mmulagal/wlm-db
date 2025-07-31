locals {
  user_data = templatefile("${path.module}/user_data.ps1", {
    region                                = var.aws_location
    deployment_name                       = var.deployment_name
    validation_node_initialization_s3_url = var.validation_node_initialization_s3_url
    dns_ip_addresses                      = var.dns_ip_addresses
    domain_dns_name                       = var.domain_dns_name
    subnet_id                             = var.subnet_id
    domain_admin_user                     = var.domain_admin_user
    preferred_domain_controller           = var.preferred_domain_controller
    validation_node1_wait_handler         = var.validation_node1_wait_handler
    is_custom_ami                         = var.is_custom_ami
    perform_fsx_check                     = var.perform_fsx_check
    fsx_file_system_id                    = var.fsx_file_system_id
    log_group                             = var.deployment_name
    sql_deployment_mode                   = var.sql_deployment_mode
    validation_node_name                  = var.validation_node_name
  })
}

resource "aws_iam_instance_profile" "validation_instance_profile" {
  name = "${var.deployment_name}_${var.validation_node_name}_validation_instance_profile"
  role = var.ec2_role_name
}

data "aws_vpc" "selected" {
  id = var.vpc_id
}

resource "aws_security_group" "domain_member_sg" {
  name        = "${var.deployment_name}_${var.validation_node_name}_domain_member_sg"
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

  tags = {
    ResourceGroupID = var.unique_id
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

  user_data = local.user_data

  instance_initiated_shutdown_behavior = "terminate" // enable this to terminate once we are done with staging testing so this will get terminated

  timeouts {
    create = "30m"
  }

  tags = {
    Name = "${var.deployment_name}-${var.validation_node_name}"
  }
}


#Wait for user data to complete execution on the instance for mac and linux hosts
resource "null_resource" "wait_for_tag_mac_or_linux" {
  count = var.operating_system == "Linux" ? 1 : 0

  triggers = {
    instance_id = aws_instance.validation_node.id
  }

  provisioner "local-exec" {
    command = "sh '${path.root}/scripts/wait_for_tag.sh' '${path.root}' '${aws_instance.validation_node.id}' '${var.aws_location}' '${var.validation_node_name}' '${var.aws_profile}'"
  }
}

# Wait for user data to complete execution on the instance for windows host
resource "null_resource" "wait_for_tag_windows" {
  count = var.operating_system == "Windows" ? 1 : 0

  triggers = {
    instance_id = aws_instance.validation_node.id
  }

  provisioner "local-exec" {
    command = "powershell.exe -ExecutionPolicy Bypass -File ${path.root}/scripts/wait_for_tag.ps1 ${path.root} ${aws_instance.validation_node.id} ${var.aws_location} ${var.validation_node_name} ${var.aws_profile}"
  }
}
