locals {
  log_feature_enabled = var.enable_cloudwatch_log_feature == true ? "true" : "false"

  user_data = templatefile("${path.module}/user_data.sh", {
    aws_region                            = var.aws_location
    subnet_id                             = var.subnet_id
    perform_fsx_check                     = var.perform_fsx_check
    fsx_file_system_id                    = var.fsx_file_system_id
    deployment_name                       = var.deployment_name
    validation_node_initialization_s3_url = var.validation_node_initialization_s3_url
    log_feature_enabled                   = local.log_feature_enabled
  })
}

resource "aws_iam_instance_profile" "validation_instance_profile" {
  name = "${var.deployment_name}_${var.validation_node_name}_validation_instance_profile"
  role = var.ec2_role_name
}

data "aws_vpc" "selected" {
  id = var.vpc_id
}

resource "aws_instance" "validation_node" {
  ami           = var.ami
  instance_type = var.validation_node_instance_type
  key_name      = var.key_pair_name

  iam_instance_profile = aws_iam_instance_profile.validation_instance_profile.name
  subnet_id            = var.subnet_id

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

# # Wait for user data to complete execution on the instance for windows host
resource "null_resource" "wait_for_tag_windows" {
  count = var.operating_system == "Windows" ? 1 : 0

  triggers = {
    instance_id = aws_instance.validation_node.id
  }

  provisioner "local-exec" {
    command = "powershell.exe -ExecutionPolicy Bypass -File ${path.root}/scripts/wait_for_tag.ps1 ${path.root} ${aws_instance.validation_node.id} ${var.aws_location} ${var.validation_node_name} ${var.aws_profile}"
  }
}
