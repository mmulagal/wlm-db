resource "aws_iam_instance_profile" "fci_sql_fsx_profile" {
  count = local.is_standalone ? 0 : 1
  name  = "${var.deployment_name}_fci_sql_fsx_profile"
  role  = var.deployment_name
}

resource "aws_network_interface" "sql_node_ni_1" {
  count             = local.is_standalone ? 0 : 1
  subnet_id         = var.private_subnet1_id
  private_ips_count = 2
  security_groups   = local.group_set

  tags = {
    Name = local.sql_fsx_server_net_bios_name
  }
}

resource "aws_network_interface" "sql_node_ni_2" {
  count             = local.is_standalone ? 0 : 1
  subnet_id         = var.private_subnet2_id
  private_ips_count = 2
  security_groups   = local.group_set

  tags = {
    Name = local.sql_fsx_server_net_bios_name_2
  }
}
