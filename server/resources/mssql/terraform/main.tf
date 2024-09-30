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
  new_ontap_fsx                 = var.fsx_file_system_id == "" ? true : false
  existing_ontap_fsx            = local.new_ontap_fsx ? false : true
  is_standalone                 = var.sql_deployment_mode == "standalone" ? true : false
  is_failover_cluster           = local.is_standalone ? false : true
  fsx_is_single_zone_deployment = var.deployment_mode == "SINGLE_AZ_1" ? true : false
}

provider "aws" {
  region = var.aws_location

  default_tags {
    tags = {
      "creator" = var.creator_tag
    }
  }
}

module "vpc-endpoints" {
  source = "./modules/vpc-endpoints"

  vpc_id                     = var.vpc_id
  endpoints_aws_location     = var.aws_location
  preferred_subnet1_id       = var.private_subnet1_id
  preferred_subnet_cidrblock = var.private_subnet1_cidrblock

  standby_subnet1_id       = local.is_failover_cluster ? var.private_subnet2_id : ""
  standby_subnet_cidrblock = local.is_failover_cluster ? var.private_subnet2_cidrblock : ""
  s3_endpoint_route_tables = var.s3_endpoint_route_tables

  s3_endpoint_exists              = var.s3_endpoint_exists
  ssm_endpoint_exists             = var.ssm_endpoint_exists
  cloudwatch_logs_endpoint_exists = var.cloudwatch_logs_endpoint_exists
  fsx_endpoint_exists             = var.fsx_endpoint_exists
  ec2_endpoint_exists             = var.ec2_endpoint_exists
  ec2_messages_endpoint_exists    = var.ec2_messages_endpoint_exists
  ssm_messages_endpoint_exists    = var.ssm_messages_endpoint_exists
}

module "validation-node" {
  source = "./modules/validation-node"

  depends_on = [aws_iam_role.ec2_iam_role, aws_iam_role_policy.ec2_iam_role_policy, aws_ssm_parameter.credentials_ssm_parameter, module.vpc-endpoints]

  vpc_id                                = var.vpc_id
  aws_location                          = var.aws_location
  subnet_id                             = var.private_subnet1_id
  dns_ip_addresses                      = var.dns_ip_addresses
  ec2_role_name                         = var.deployment_name
  is_custom_ami                         = var.is_custom_ami
  key_pair_name                         = var.key_pair_name
  perform_ad_check                      = true
  domain_dns_name                       = var.domain_dns_name
  domain_admin_user                     = var.domain_admin_user
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
}

module "fsxn" {
  source = "./modules/fsxn"

  depends_on                     = [module.vpc-endpoints, module.validation-node]
  fsx_file_system_id             = var.fsx_file_system_id // set this id to provision using existing fsx
  deployment_mode                = var.deployment_mode
  vpc_id                         = var.vpc_id
  vpc_cidr                       = var.vpc_cidr
  preferred_subnet_id            = var.private_subnet1_id
  standby_subnet_id              = var.private_subnet2_id
  preferred_route_table_id       = var.route_table1_id
  standby_route_table_id         = var.route_table2_id
  fsx_file_system_name           = var.fsx_file_system_name
  fsx_storage_capacity           = var.fsx_storage_capacity
  fsx_volume_throughput_capacity = var.fsx_volume_throughput_capacity
  fsx_disk_iops                  = var.fsx_disk_iops

  fsx_kms_key_id                    = var.fsx_encryption_key # its kms key for fsx
  fsx_data_volume_name              = var.fsx_data_volume_name
  fsx_data_volume_size              = var.fsx_data_volume_size
  fsx_log_volume_name               = var.fsx_log_volume_name
  fsx_log_volume_size               = var.fsx_log_volume_size
  fsx_temp_db_volume_name           = var.fsx_temp_db_volume_name
  fsx_temp_db_volume_size           = var.fsx_temp_db_volume_size
  fsx_cluster_quorum_volume_name    = var.fsx_quorum_volume_name
  fsx_cluster_quorum_volume_size    = var.fsx_quorum_volume_size
  fsx_administrator_password        = var.fsx_admin_password
  fsx_svm_name                      = var.sql_svm_name
  fsx_weekly_maintenance_start_time = "1:05:00"
}

module "ec2" {
  source = "./modules/ec2"

  depends_on                    = [module.vpc-endpoints, module.validation-node, module.fsxn]
  ec2_role_name                 = var.deployment_name
  enable_cloudwatch_log_feature = var.enable_cloud_watch_log_feature
  unique_id                     = var.unique_id
  ami_id                        = var.sql_ami_id
  byol_ami                      = var.is_custom_ami
  key_pair_name                 = var.key_pair_name
  private_subnet_id             = var.private_subnet1_id

  vpc_id                     = var.vpc_id
  vpc_cidr                   = var.vpc_cidr
  deployment_name            = var.deployment_name
  sql_server_name            = var.sql_server_name
  sql_svm_name               = var.sql_svm_name
  fsx_data_volume_name       = var.fsx_data_volume_name
  fsx_log_volume_name        = var.fsx_log_volume_name
  fsx_file_system_id         = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn.fsx_fs_logical_id // may be the output of the fsx if its new
  fsx_temp_db_volume_name    = var.fsx_temp_db_volume_name
  fsx_data_lun_size          = tostring(var.fsx_data_lun_size)
  sql_igroup_name            = var.sql_igroup_name
  fsx_volume_snapshot_policy = var.fsx_volume_snapshot_policy
  ad_dns_ip_addresses        = element(split(",", var.dns_ip_addresses), 0)
  domain_dns_name            = var.domain_dns_name
  domain_admin_user          = var.domain_admin_user
  sql_admin_accounts         = var.sql_service_account_name
  sql_collation              = var.sql_collation

  sql_node_initialization_s3_url = var.sql_node_initialization_s3_url
  sql_node_aws_location          = var.aws_location
  route_table_id                 = var.route_table1_id
  ebs_volume_size                = var.ebs_volume_size
  domain_member_sg_id            = var.domain_member_sg_id
  ontap_security_group_id        = local.new_ontap_fsx ? module.fsxn.fsxn_security_group_id : var.ontap_security_group_id
  mssql_media_bucket_name        = var.mssql_media_bucket_name
  sql_fsx_server_net_bios_name   = element(split(",", var.node_net_bios_names), 0)
  workload_instance_type         = var.workload_instance_type
}
