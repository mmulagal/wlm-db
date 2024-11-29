resource "aws_security_group" "workload_security_group" {
  name        = "${var.deployment_name}_workload_security_group"
  description = "Allow access to the Workload instances"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = [
      {
        from_port = 53
        to_port   = 53
        protocol  = "tcp"
      },
      {
        from_port = 53
        to_port   = 53
        protocol  = "udp"
      },
      {
        from_port = 88
        to_port   = 88
        protocol  = "tcp"
      },
      {
        from_port = 88
        to_port   = 88
        protocol  = "udp"
      },
      {
        from_port = 464
        to_port   = 464
        protocol  = "tcp"
      },
      {
        from_port = 464
        to_port   = 464
        protocol  = "udp"
      },
      {
        from_port = 389
        to_port   = 389
        protocol  = "tcp"
      },
      {
        from_port = 389
        to_port   = 389
        protocol  = "udp"
      },
      {
        from_port = 123
        to_port   = 123
        protocol  = "udp"
      },
      {
        from_port = 135
        to_port   = 135
        protocol  = "tcp"
      },
      {
        from_port = 445
        to_port   = 445
        protocol  = "tcp"
      },
      {
        from_port = 636
        to_port   = 636
        protocol  = "tcp"
      },
      {
        from_port = 3268
        to_port   = 3269
        protocol  = "tcp"
      },
      {
        from_port = 5985
        to_port   = 5985
        protocol  = "tcp"
      },
      {
        from_port = 9389
        to_port   = 9389
        protocol  = "tcp"
      },
      {
        from_port = 49152
        to_port   = 65535
        protocol  = "tcp"
      },
    ]

    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = [format("%s/32", local.ad_dns_ip_addresses)]
    }
  }

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
    Name = "${var.deployment_name}_workload_security_group"
  }
}
