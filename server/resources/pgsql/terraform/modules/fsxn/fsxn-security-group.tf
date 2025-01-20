resource "aws_security_group" "ontap_security_group" {
  name        = "${var.deployment_name}_ontap_security_group"
  description = "Allow access to the Workload instances"
  vpc_id      = var.vpc_id

  // Create the sg only when its new
  count = local.fsx_is_existing ? 0 : 1

  dynamic "ingress" {
    for_each = [
      { from_port = -1, to_port = -1, protocol = "icmp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 139, to_port = 139, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 443, to_port = 443, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 4045, to_port = 4045, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 111, to_port = 111, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 2049, to_port = 2049, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 10000, to_port = 10000, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 635, to_port = 635, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 4046, to_port = 4046, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 2049, to_port = 2049, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 3260, to_port = 3260, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 4046, to_port = 4046, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 11104, to_port = 11104, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 11105, to_port = 11105, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 4049, to_port = 4049, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 139, to_port = 139, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 161, to_port = 162, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 4045, to_port = 4045, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 135, to_port = 135, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 135, to_port = 135, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 749, to_port = 749, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 111, to_port = 111, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 22, to_port = 22, protocol = "tcp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 161, to_port = 162, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 635, to_port = 635, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
      { from_port = 137, to_port = 137, protocol = "udp", cidr_blocks = local.sg_cidr_blocks },
    ]

    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }
}
