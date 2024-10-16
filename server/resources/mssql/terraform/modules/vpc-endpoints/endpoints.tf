data "aws_region" "current" {}

locals {
  single_zone = var.standby_subnet1_id == null || var.standby_subnet1_id == "" ? true : false

  create_ssm_endpoint             = var.ssm_endpoint_exists == false
  create_s3_endpoint              = var.s3_endpoint_exists == false
  create_cloudwatch_logs_endpoint = var.cloudwatch_logs_endpoint_exists == false
  create_fsx_endpoint             = var.fsx_endpoint_exists == false
  create_ec2_endpoint             = var.ec2_endpoint_exists == false
  create_ec2_messages_endpoint    = var.ec2_messages_endpoint_exists == false
  create_ssm_messages_endpoint    = var.ssm_messages_endpoint_exists == false

  create_sg = anytrue([
    local.create_ssm_endpoint,
    local.create_s3_endpoint,
    local.create_cloudwatch_logs_endpoint,
    local.create_fsx_endpoint,
    local.create_ec2_endpoint,
    local.create_ec2_messages_endpoint,
    local.create_ssm_messages_endpoint
  ])
  create_multi_zone_sg = !local.single_zone && local.create_sg
}

resource "aws_security_group" "https_security_group" {
  count       = local.create_sg ? 1 : 0
  name        = "${var.deployment_name}_https_security_group"
  description = "Allow HTTPS traffic from the VPC"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = local.create_multi_zone_sg ? [var.vpc_cidr, var.preferred_subnet_cidrblock, var.standby_subnet_cidrblock] : [var.vpc_cidr, var.preferred_subnet_cidrblock]
  }
}

resource "aws_vpc_endpoint" "s3_endpoint" {
  count             = local.create_s3_endpoint ? 1 : 0
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${var.endpoints_aws_location}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = split(",", var.s3_endpoint_route_tables)
}

resource "aws_vpc_endpoint" "ssm_endpoint" {
  count               = local.create_ssm_endpoint ? 1 : 0
  vpc_id              = var.vpc_id
  vpc_endpoint_type   = "Interface"
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ssm"
  subnet_ids          = local.single_zone ? [var.preferred_subnet1_id] : [var.preferred_subnet1_id, var.standby_subnet1_id]
  private_dns_enabled = true
  security_group_ids  = [aws_security_group.https_security_group[0].id]
}

resource "aws_vpc_endpoint" "ssm_messages_endpoint" {
  count               = local.create_ssm_messages_endpoint ? 1 : 0
  vpc_id              = var.vpc_id
  vpc_endpoint_type   = "Interface"
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ssmmessages"
  subnet_ids          = local.single_zone ? [var.preferred_subnet1_id] : [var.preferred_subnet1_id, var.standby_subnet1_id]
  private_dns_enabled = true
  security_group_ids  = [aws_security_group.https_security_group[0].id]
}

resource "aws_vpc_endpoint" "ec2_messages_endpoint" {
  count               = local.create_ec2_messages_endpoint ? 1 : 0
  vpc_id              = var.vpc_id
  vpc_endpoint_type   = "Interface"
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ec2messages"
  subnet_ids          = local.single_zone ? [var.preferred_subnet1_id] : [var.preferred_subnet1_id, var.standby_subnet1_id]
  private_dns_enabled = true
  security_group_ids  = [aws_security_group.https_security_group[0].id]
}

resource "aws_vpc_endpoint" "cloudwatch_logs_endpoint" {
  count               = local.create_cloudwatch_logs_endpoint ? 1 : 0
  vpc_id              = var.vpc_id
  vpc_endpoint_type   = "Interface"
  service_name        = "com.amazonaws.${data.aws_region.current.name}.logs"
  subnet_ids          = local.single_zone ? [var.preferred_subnet1_id] : [var.preferred_subnet1_id, var.standby_subnet1_id]
  private_dns_enabled = true
  security_group_ids  = [aws_security_group.https_security_group[0].id]
}

resource "aws_vpc_endpoint" "fsx_endpoint" {
  count               = local.create_fsx_endpoint ? 1 : 0
  vpc_id              = var.vpc_id
  vpc_endpoint_type   = "Interface"
  service_name        = "com.amazonaws.${data.aws_region.current.name}.fsx"
  subnet_ids          = local.single_zone ? [var.preferred_subnet1_id] : [var.preferred_subnet1_id, var.standby_subnet1_id]
  private_dns_enabled = true
  security_group_ids  = [aws_security_group.https_security_group[0].id]
}

resource "aws_vpc_endpoint" "ec2_endpoint" {
  count               = local.create_ec2_endpoint ? 1 : 0
  vpc_id              = var.vpc_id
  vpc_endpoint_type   = "Interface"
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ec2"
  subnet_ids          = local.single_zone ? [var.preferred_subnet1_id] : [var.preferred_subnet1_id, var.standby_subnet1_id]
  private_dns_enabled = true
  security_group_ids  = [aws_security_group.https_security_group[0].id]
}
