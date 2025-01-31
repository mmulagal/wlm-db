terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.25.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.5.1"
    }
  }
}

locals {
  new_ontap_fsx                  = var.fsx_file_system_id == "" ? true : false
  existing_ontap_fsx             = local.new_ontap_fsx ? false : true
  is_standalone                  = var.sql_deployment_mode == "standalone" ? true : false
  fsx_is_single_zone_deployment  = var.deployment_mode == "SINGLE_AZ_1" ? true : false
  is_windows                     = length(regexall("^[a-z]:", lower(abspath(path.root)))) > 0
  operating_system               = local.is_windows ? "Windows" : "Linux"
  #ad_dns_ip_addresses            = element(split(",", var.dns_ip_addresses), 0)
  #sql_fsx_server_net_bios_name   = element(split(",", var.node_net_bios_names), 0)
  #sql_fsx_server_net_bios_name_2 = element(split(",", var.node_net_bios_names), 1)
  #adsg_not_selected              = var.domain_member_sg_id == "" ? true : false
  #ontap_security_groups          = split(",", var.ontap_security_group_id)
  #group_set                      = local.adsg_not_selected ? concat([aws_security_group.workload_security_group.id], local.ontap_security_groups) : concat([aws_security_group.workload_security_group.id], local.ontap_security_groups, [var.domain_member_sg_id])
  #sql_fsx_fci_name               = var.sql_server_name
  # Terraform does not support doing validation of an variable based on another variable. So we have to do it like this.
  #fsx_file_system_name_required     = (local.new_ontap_fsx && var.fsx_file_system_name == "") ? tobool("Validation Error: The fsx_file_system_name variable must be set when new fsx is deployed.") : true
  #s3_endpoint_route_tables_required = (!var.s3_endpoint_exists && var.s3_endpoint_route_tables == "") ? tobool("Validation Error: The s3_endpoint_route_tables variable must be set when s3_endpoint_exists is false.") : true
  # validations for the fci deployment
  #subnet2_cidrblock_required      = (!local.is_standalone && var.private_subnet2_cidrblock == "") ? tobool("Validation Error: The private_subnet2_cidrblock variable must be set for fci deployment.") : true
  #subnet2_id_required             = (!local.is_standalone && var.private_subnet2_id == "") ? tobool("Validation Error: The private_subnet2_id variable must be set for fci deployment.") : true
  # route_table2_id_required        = (!local.is_standalone && var.route_table2_id == "") ? tobool("Validation Error: The route_table2_id variable must be set for fci deployment.") : true
  # fsx_quorum_volume_name_required = (!local.is_standalone && var.fsx_quorum_volume_name == "") ? tobool("Validation Error: The fsx_quorum_volume_name variable must be set for fci deployment.") : true
  #fsx_quorum_volume_size_required = (!local.is_standalone && var.fsx_quorum_volume_size == "") ? tobool("Validation Error: The fsx_quorum_volume_size variable must be set for fci deployment.") : true
  #sql_fsx_ws_fc_name_required     = (!local.is_standalone && var.sql_fsx_ws_fc_name == "") ? tobool("Validation Error: The sql_fsx_ws_fc_name variable must be set for fci deployment.") : true
}

provider "aws" {
  region  = var.aws_location
  profile = var.aws_profile

  default_tags {
    tags = {
      "creator" = var.creator_tag
    }
  }
}

module "vpc_endpoints" {
  source = "./modules/vpc-endpoints"

  vpc_id                     = var.vpc_id
  vpc_cidr = var.vpc_cidr
  aws_profile = var.aws_profile
  endpoints_aws_location     = var.aws_location
  preferred_subnet1_id       = var.private_subnet1_id
  preferred_subnet_cidrblock = var.private_subnet1_cidrblock
  route_table1_id = var.route_table1_id
  standby_subnet1_id       = local.is_standalone ? "" : var.private_subnet2_id
  standby_subnet_cidrblock = local.is_standalone ? "" : var.private_subnet2_cidrblock
  s3_endpoint_exists              = var.s3_endpoint_exists
  cloudformation_endpoint_exists = var.cloudformation_endpoint_exists
  sqs_endpoint_exists = var.sqs_endpoint_exists
  ssm_endpoint_exists             = var.ssm_endpoint_exists
  ec2_messages_endpoint_exists    = var.ec2_messages_endpoint_exists
  ssm_messages_endpoint_exists    = var.ssm_messages_endpoint_exists
  fsx_endpoint_exists             = var.fsx_endpoint_exists
  cloudwatch_logs_endpoint_exists = var.cloudwatch_logs_endpoint_exists
  ec2_endpoint_exists             = var.ec2_endpoint_exists
  s3_endpoint_route_tables = var.s3_endpoint_route_tables
  deployment_name            = var.deployment_name
}

module "fsxn_standalone" {
  source = "./modules/fsxn"
  count  = local.is_standalone ? 1 : 0

  depends_on                     = [module.vpc_endpoints, module.validation_node1]
  fsx_file_system_id             = var.fsx_file_system_id
  deployment_mode                = var.deployment_mode
  deployment_name                = var.deployment_name
  vpc_id                         = var.vpc_id
  vpc_cidr                       = var.vpc_cidr
  preferred_subnet_id            = var.private_subnet1_id
  standby_subnet_id              = var.private_subnet2_id
  preferred_route_table_id       = var.route_table1_id
  standby_route_table_id         = var.route_table2_id
  preferred_subnet_cidrblock     = var.private_subnet1_cidrblock
  standby_subnet_cidrblock       = var.private_subnet2_cidrblock
  fsx_file_system_name           = var.fsx_file_system_name
  fsx_storage_capacity           = var.fsx_storage_capacity
  fsx_volume_throughput_capacity = var.fsx_volume_throughput_capacity
  fsx_disk_iops                  = var.fsx_disk_iops

  fsx_kms_key_id                    = var.fsx_encryption_key # its kms key for fsx
  fsx_data_volume_name              = var.fsx_data_volume_name
  fsx_data_volume_size              = var.fsx_data_volume_size
  fsx_log_volume_name               = var.fsx_log_volume_name
  fsx_log_volume_size               = var.fsx_log_volume_size
  # fsx_temp_db_volume_name           = var.fsx_temp_db_volume_name
  # fsx_temp_db_volume_size           = var.fsx_temp_db_volume_size
  # fsx_cluster_quorum_volume_name    = var.fsx_quorum_volume_name
  # fsx_cluster_quorum_volume_size    = var.fsx_quorum_volume_size
  fsx_administrator_password        = var.fsx_admin_password
  fsx_svm_name                      = var.sql_svm_name
  fsx_weekly_maintenance_start_time = "1:05:00"
}

module "validation_node1" {
  source = "./modules/validation-node"

  depends_on = [aws_iam_role.ec2_iam_role, aws_iam_role_policy.ec2_iam_role_policy, aws_ssm_parameter.credentials_ssm_parameter, module.vpc_endpoints]

  vpc_id                                = var.vpc_id
  aws_location                          = var.aws_location
  subnet_id                             = var.private_subnet1_id
  ec2_role_name                         = var.deployment_name
  key_pair_name                         = var.key_pair_name

  perform_fsx_check                     = local.existing_ontap_fsx ? "true" : "false"
  fsx_file_system_id                    = local.existing_ontap_fsx ? var.fsx_file_system_id : ""
  enable_cloudwatch_log_feature         = var.enable_cloud_watch_log_feature
  ami                                   = var.validation_ami
  validation_node_instance_type         = var.validation_node_instance_type
  deployment_name                       = var.deployment_name
  unique_id                             = var.unique_id
  validation_node_initialization_s3_url = var.validation_node_initialization_s3_url
  validation_node1_wait_handler         = "wait"
  sql_deployment_mode                   = var.sql_deployment_mode
  validation_node_name                  = "Validation-Node-1"
  operating_system                      = local.operating_system
  aws_profile                           = var.aws_profile
}


module "standalone_sql_node" {
  source = "./modules/ec2"
  count  = local.is_standalone ? 1 : 0

  depends_on                    = [module.vpc_endpoints, module.validation_node1, module.fsxn_standalone]
  ec2_role_name                 = var.deployment_name
  enable_cloudwatch_log_feature = var.enable_cloud_watch_log_feature
  ami_id                        = var.sql_ami_id
  key_pair_name                 = var.key_pair_name
  private_subnet_id             = var.private_subnet1_id
  vpc_id                     = var.vpc_id
  vpc_cidr                   = var.vpc_cidr
  deployment_name            = var.deployment_name
  sql_server_name            = var.sql_server_name
  sql_svm_name               = var.sql_svm_name
  fsx_data_volume_name       = var.fsx_data_volume_name
  fsx_log_volume_name        = var.fsx_log_volume_name
  fsx_file_system_id         = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn_standalone[0].fsx_fs_logical_id // may be the output of the fsx if its new
  pgsql_node_initialization_s3_url = var.pgsql_node_initialization_s3_url
  sql_node_aws_location          = var.aws_location
  route_table_id                 = var.route_table1_id
  ebs_volume_size                = var.ebs_volume_size
  ontap_security_group_id        = local.new_ontap_fsx ? module.fsxn_standalone[0].fsxn_security_group_id : var.ontap_security_group_id
  sql_fsx_server_net_bios_name   = element(split(",", var.node_net_bios_names), 0)
  workload_instance_type         = var.workload_instance_type
  sql_node_name                  = "SQL-Node"
  operating_system               = local.operating_system
  is_standalone                  = local.is_standalone
  aws_profile                    = var.aws_profile
  sql_version                    = var.sql_version
  sql_service_account_password    = var.sql_service_account_password
  fsx_svm_id                       = var.fsx_svm_id
  fsx_aggr_name                     = var.fsx_aggr_name
  fsx_svm_uuid                      = var.fsx_svm_uuid
  number_of_nodes                 = var.number_of_nodes
}