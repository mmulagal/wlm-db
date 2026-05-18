terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.86.1"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.5.2"
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
  sql_fsx_server_net_bios_name   = element(split(",", var.node_net_bios_names), 0)
  sql_fsx_server_net_bios_name_2 = element(split(",", var.node_net_bios_names), 1)
  ontap_security_groups          = var.ontap_security_group_id == "" ? [] : split(",", var.ontap_security_group_id)
  group_set                      = concat([aws_security_group.workload_security_group.id], local.ontap_security_groups)
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

  depends_on = [aws_iam_role.ec2_iam_role, aws_iam_role_policy.ec2_iam_role_policy]

  vpc_id                          = var.vpc_id
  vpc_cidr                        = var.vpc_cidr
  aws_profile                     = var.aws_profile
  endpoints_aws_location          = var.aws_location
  preferred_subnet1_id            = var.private_subnet1_id
  preferred_subnet_cidrblock      = var.private_subnet1_cidrblock
  route_table1_id                 = var.route_table1_id
  standby_subnet1_id              = local.is_standalone ? "" : var.private_subnet2_id
  standby_subnet_cidrblock        = local.is_standalone ? "" : var.private_subnet2_cidrblock
  s3_endpoint_exists              = var.s3_endpoint_exists
  ssm_endpoint_exists             = var.ssm_endpoint_exists
  ec2_messages_endpoint_exists    = var.ec2_messages_endpoint_exists
  ssm_messages_endpoint_exists    = var.ssm_messages_endpoint_exists
  fsx_endpoint_exists             = var.fsx_endpoint_exists
  cloudwatch_logs_endpoint_exists = var.cloudwatch_logs_endpoint_exists
  ec2_endpoint_exists             = var.ec2_endpoint_exists
  s3_endpoint_route_tables        = var.s3_endpoint_route_tables
  deployment_name                 = var.deployment_name
}

module "fsxn_standalone" {
  source = "./modules/fsxn"
  count  = local.is_standalone ? 1 : 0

  depends_on                     = [aws_ssm_parameter.credentials_ssm_parameter, module.vpc_endpoints, module.validation_node1]
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
  fsx_administrator_password        = var.fsx_admin_password
  fsx_svm_name                      = var.sql_svm_name
  fsx_weekly_maintenance_start_time = "1:05:00"
  sql_deployment_mode               = var.sql_deployment_mode
  is_standalone                     = local.is_standalone
}

module "fsxn_ha" {
  source = "./modules/fsxn"
  count  = local.is_standalone ? 0 : 1

  depends_on                     = [module.vpc_endpoints, module.validation_node1, module.validation_node2]
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
  fsx_administrator_password        = var.fsx_admin_password
  fsx_svm_name                      = var.sql_svm_name
  fsx_weekly_maintenance_start_time = "1:05:00"
  sql_deployment_mode               = var.sql_deployment_mode
  is_standalone                     = local.is_standalone
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

module "validation_node2" {
  source = "./modules/validation-node"
  count  = local.is_standalone ? 0 : 1

  depends_on = [aws_iam_role.ec2_iam_role, aws_iam_role_policy.ec2_iam_role_policy, aws_ssm_parameter.credentials_ssm_parameter, module.vpc_endpoints]

  vpc_id                                = var.vpc_id
  aws_location                          = var.aws_location
  subnet_id                             = var.private_subnet2_id
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
  validation_node_name                  = "Validation-Node-2"
  operating_system                      = local.operating_system
  aws_profile                           = var.aws_profile
}

module "standalone_sql_node" {
  source = "./modules/ec2"
  count  = local.is_standalone ? 1 : 0

  depends_on                       = [module.vpc_endpoints, module.validation_node1, module.fsxn_standalone]
  ec2_role_name                    = var.deployment_name
  enable_cloudwatch_log_feature    = var.enable_cloud_watch_log_feature
  ami_id                           = var.sql_ami_id
  key_pair_name                    = var.key_pair_name
  private_subnet_id                = var.private_subnet1_id
  vpc_id                           = var.vpc_id
  vpc_cidr                         = var.vpc_cidr
  deployment_name                  = var.deployment_name
  sql_server_name                  = var.sql_server_name
  sql_svm_name                     = var.sql_svm_name
  fsx_data_volume_name             = var.fsx_data_volume_name
  fsx_log_volume_name              = var.fsx_log_volume_name
  fsx_file_system_id               = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn_standalone[0].fsx_fs_logical_id // may be the output of the fsx if its new
  pgsql_node_initialization_s3_url = var.pgsql_node_initialization_s3_url
  sql_node_aws_location            = var.aws_location
  route_table_id                   = var.route_table1_id
  ebs_volume_size                  = var.ebs_volume_size
  ontap_security_group_id          = var.ontap_security_group_id
  sql_fsx_server_net_bios_name     = local.sql_fsx_server_net_bios_name
  workload_instance_type           = var.workload_instance_type
  sql_node_name                    = "PGSQL-Node"
  operating_system                 = local.operating_system
  is_standalone                    = local.is_standalone
  aws_profile                      = var.aws_profile
  sql_version                      = var.sql_version
  sql_service_account_password     = var.sql_service_account_password
  fsx_svm_id                       = module.fsxn_standalone[0].fsx_svm_id
  fsx_aggr_name                    = var.fsx_aggr_name
  fsx_svm_uuid                     = module.fsxn_standalone[0].fsx_svm_uuid
  workload_security_group_id       = aws_security_group.workload_security_group.id
}

module "ha_pgsql_node1" {
  source = "./modules/ec2"
  count  = local.is_standalone ? 0 : 1

  depends_on                       = [module.vpc_endpoints, module.validation_node1, module.validation_node2, module.fsxn_ha]
  ec2_role_name                    = var.deployment_name
  enable_cloudwatch_log_feature    = var.enable_cloud_watch_log_feature
  ami_id                           = var.sql_ami_id
  key_pair_name                    = var.key_pair_name
  private_subnet_id                = var.private_subnet1_id
  vpc_id                           = var.vpc_id
  vpc_cidr                         = var.vpc_cidr
  deployment_name                  = var.deployment_name
  sql_server_name                  = var.sql_server_name
  sql_svm_name                     = var.sql_svm_name
  fsx_data_volume_name             = var.fsx_data_volume_name
  fsx_log_volume_name              = var.fsx_log_volume_name
  fsx_file_system_id               = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn_ha[0].fsx_fs_logical_id // may be the output of the fsx if its new
  pgsql_node_initialization_s3_url = var.pgsql_node_initialization_s3_url
  sql_node_aws_location            = var.aws_location
  route_table_id                   = var.route_table1_id
  ebs_volume_size                  = var.ebs_volume_size
  ontap_security_group_id          = var.ontap_security_group_id
  sql_fsx_server_net_bios_name     = local.sql_fsx_server_net_bios_name
  workload_instance_type           = var.workload_instance_type
  sql_node_name                    = "PGSQL-Node-1"
  operating_system                 = local.operating_system
  is_standalone                    = local.is_standalone
  aws_profile                      = var.aws_profile
  sql_version                      = var.sql_version
  sql_service_account_password     = var.sql_service_account_password
  fsx_svm_id                       = module.fsxn_ha[0].fsx_svm_id
  fsx_aggr_name                    = var.fsx_aggr_name
  fsx_svm_uuid                     = module.fsxn_ha[0].fsx_svm_uuid

  private_subnet2_id = var.private_subnet2_id
  route_table2_id    = var.route_table2_id

  network_interface_id   = aws_network_interface.pgsql_node_ni_1[0].id
  network_interface_1_id = aws_network_interface.pgsql_node_ni_1[0].id
  network_interface_2_id = aws_network_interface.pgsql_node_ni_2[0].id
  iam_instance_profile   = aws_iam_instance_profile.ha_pgsql_fsx_profile[0].name
}

module "ha_pgsql_node2" {
  source = "./modules/ec2"
  count  = local.is_standalone ? 0 : 1

  depends_on                       = [module.vpc_endpoints, module.validation_node1, module.validation_node2, module.fsxn_ha]
  ec2_role_name                    = var.deployment_name
  enable_cloudwatch_log_feature    = var.enable_cloud_watch_log_feature
  ami_id                           = var.sql_ami_id
  key_pair_name                    = var.key_pair_name
  private_subnet_id                = var.private_subnet1_id
  vpc_id                           = var.vpc_id
  vpc_cidr                         = var.vpc_cidr
  deployment_name                  = var.deployment_name
  sql_server_name                  = var.sql_server_name
  sql_svm_name                     = var.sql_svm_name
  fsx_data_volume_name             = var.fsx_data_volume_name
  fsx_log_volume_name              = var.fsx_log_volume_name
  fsx_file_system_id               = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn_ha[0].fsx_fs_logical_id // may be the output of the fsx if its new
  pgsql_node_initialization_s3_url = var.pgsql_node_initialization_s3_url
  sql_node_aws_location            = var.aws_location
  route_table_id                   = var.route_table1_id
  ebs_volume_size                  = var.ebs_volume_size
  ontap_security_group_id          = var.ontap_security_group_id
  sql_fsx_server_net_bios_name     = local.sql_fsx_server_net_bios_name_2
  workload_instance_type           = var.workload_instance_type
  sql_node_name                    = "PGSQL-Node-2"
  operating_system                 = local.operating_system
  is_standalone                    = local.is_standalone
  aws_profile                      = var.aws_profile
  sql_version                      = var.sql_version
  sql_service_account_password     = var.sql_service_account_password
  fsx_svm_id                       = module.fsxn_ha[0].fsx_replica_svm_id
  fsx_aggr_name                    = var.fsx_aggr_name
  fsx_svm_uuid                     = module.fsxn_ha[0].fsx_replica_svm_uuid

  private_subnet2_id     = var.private_subnet2_id
  route_table2_id        = var.route_table2_id
  network_interface_id   = aws_network_interface.pgsql_node_ni_2[0].id
  network_interface_1_id = aws_network_interface.pgsql_node_ni_1[0].id
  network_interface_2_id = aws_network_interface.pgsql_node_ni_2[0].id
  iam_instance_profile   = aws_iam_instance_profile.ha_pgsql_fsx_profile[0].name
}


module "ha_pgpool_node" {
  source = "./modules/ec2"
  count  = local.is_standalone ? 0 : 1

  depends_on                       = [module.vpc_endpoints, module.validation_node1, module.validation_node2, module.fsxn_ha]
  ec2_role_name                    = var.deployment_name
  enable_cloudwatch_log_feature    = var.enable_cloud_watch_log_feature
  ami_id                           = var.sql_ami_id
  key_pair_name                    = var.key_pair_name
  private_subnet_id                = var.private_subnet1_id
  vpc_id                           = var.vpc_id
  vpc_cidr                         = var.vpc_cidr
  deployment_name                  = var.deployment_name
  sql_server_name                  = var.sql_server_name
  sql_svm_name                     = var.sql_svm_name
  fsx_data_volume_name             = var.fsx_data_volume_name
  fsx_log_volume_name              = var.fsx_log_volume_name
  fsx_file_system_id               = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn_ha[0].fsx_fs_logical_id // may be the output of the fsx if its new
  pgsql_node_initialization_s3_url = var.pgsql_node_initialization_s3_url
  sql_node_aws_location            = var.aws_location
  route_table_id                   = var.route_table1_id
  ebs_volume_size                  = var.ebs_volume_size
  ontap_security_group_id          = var.ontap_security_group_id
  sql_fsx_server_net_bios_name     = "PgpoolNode"
  workload_instance_type           = "t3.medium"
  sql_node_name                    = "PgPoolNode"
  operating_system                 = local.operating_system
  is_standalone                    = local.is_standalone
  aws_profile                      = var.aws_profile
  sql_version                      = var.sql_version
  sql_service_account_password     = var.sql_service_account_password
  fsx_svm_id                       = module.fsxn_ha[0].fsx_replica_svm_id
  fsx_aggr_name                    = var.fsx_aggr_name
  fsx_svm_uuid                     = module.fsxn_ha[0].fsx_replica_svm_uuid

  private_subnet2_id     = var.private_subnet2_id
  route_table2_id        = var.route_table2_id
  network_interface_id   = aws_network_interface.pgpool_node_ni_3[0].id
  network_interface_1_id = aws_network_interface.pgsql_node_ni_1[0].id
  network_interface_2_id = aws_network_interface.pgpool_node_ni_3[0].id
  iam_instance_profile   = aws_iam_instance_profile.ha_pgsql_fsx_profile[0].name
}
