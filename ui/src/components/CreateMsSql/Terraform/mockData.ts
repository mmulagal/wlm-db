export const code = `terraform {
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
  new_ontap_fsx = var.fsx_file_system_id == "" ? true : false
  existing_ontap_fsx = local.new_ontap_fsx ? false : true
  is_standalone = var.sql_deployment_mode == "standalone" ? true : false
  is_failover_cluster = local.is_standalone ? false : true
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
 
variable "aws_location" {
  description = "Value of the location"
  type        = string
 
  validation {
    condition     = length(var.aws_location) > 0
    error_message = "The aws_location value must not be empty."
  }
  validation {
    condition     = can(regex("[a-z][a-z]-[a-z]+-[1-9]", var.aws_location))
    error_message = "Must be valid AWS Region names."
  }
}
 
variable "creator_tag" {
  description = "Value of the creator tag"
  type        = string
 
  validation {
    condition     = length(var.creator_tag) > 0
    error_message = "The creator_tag value must not be empty."
  }
}
 
variable "deployment_name" {
  description = "Value of the Deployment Name"
  type        = string
 
  validation {
    condition     = length(var.deployment_name) > 0
    error_message = "The deployment_name value must not be empty."
  }
}
 
variable "fsx_encryption_key" {
  description = "The encryption key for FSx"
  type        = string
}
 
# standalone mode
variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
 
  validation {
    condition     = length(var.vpc_id) > 0
    error_message = "The vpc_id value must not be empty."
  }
}
 
variable "vpc_cidr" {
  description = "The CIDR block of the VPC"
  type        = string
 
  validation {
    condition     = length(var.vpc_cidr) > 0
    error_message = "The vpc_cidr value must not be empty."
  }
}
 
variable "private_subnet1_id" {
  description = "The ID of the first private subnet"
  type        = string
 
  validation {
    condition     = length(var.private_subnet1_id) > 0
    error_message = "The private_subnet1_id value must not be empty."
  }
}
 
variable "route_table1_id" {
  description = "The ID of the first route table"
  type        = string
 
  validation {
    condition     = length(var.route_table1_id) > 0
    error_message = "The route_table1_id value must not be empty."
  }
}
 
variable "private_subnet2_id" {
  description = "The ID of the second private subnet"
  type        = string
 
  validation {
    condition     = var.sql_deployment_mode != "standalone" ? length(var.private_subnet2_id) > 0 : true
    error_message = "The private_subnet2_id value must not be empty when sql_deployment_mode is FCI."
  }
}
 
variable "route_table2_id" {
  description = "The ID of the second route table"
  type        = string
 
  validation {
    condition     = var.sql_deployment_mode != "standalone" ? length(var.route_table2_id) > 0 : true
    error_message = "The route_table2_id value must not be empty when sql_deployment_mode is FCI."
  }
}
 
variable "ad_scenario_type" {
  description = "The type of AD scenario"
  type        = string
 
  validation {
    condition     = length(var.ad_scenario_type) > 0
    error_message = "The ad_scenario_type value must not be empty."
  }
}
 
variable "domain_admin_password" {
  description = "The password of the domain admin"
  type        = string
  validation {
    condition     = length(var.domain_admin_password) > 0
    error_message = "The domain_admin_password variable must not be empty."
  }
}
 
variable "domain_dns_name" {
  description = "The DNS name of the domain"
  type        = string
 
  validation {
    condition     = length(var.domain_dns_name) > 0
    error_message = "The domain_dns_name value must not be empty."
  }
}
 
variable "dns_ip_addresses" {
  description = "The IP addresses of the DNS"
  type        = string
 
  validation {
    condition     = length(var.dns_ip_addresses) > 0
    error_message = "The dns_ip_addresses value must not be empty."
  }
}
 
variable "domain_member_sg_id" {
  description = "The ID of the domain member security group"
  type        = string
  default     = ""
 
  validation {
    condition     = length(var.domain_member_sg_id) > 0
    error_message = "The domain_member_sg_id value must not be empty."
  }
}
 
variable "tf_deploy_role_name" {
  description = "The name of the terraform deployment role"
  type        = string
}
 
variable "validation_ami" {
  description = "The AMI ID for validation"
  type        = string
 
  validation {
    condition     = length(var.validation_ami) > 0
    error_message = "The validation_ami value must not be empty."
  }
}
 
variable "validation_node_instance_type" {
  description = "The instance type for the validation node"
  type        = string
  default     = "t2.micro"
}
 
variable "account_id" {
  description = "The account ID"
  type        = string
}
 
variable "cloud_provider_account_id" {
  description = "The cloud provider's account ID"
  type        = number
}
 
variable "role_credentials_id" {
  description = "The ID of the role credentials"
  type        = string
}
 
variable "wlmdb_aws_account_id" {
  description = "The AWS account ID for WLMDB"
  type        = number
}
 
variable "metrics" {
  description = "The metrics"
  type        = string
}
 
variable "s3_endpoint_route_tables" {
  description = "The S3 endpoint route tables"
  type        = string
  default     = ""
}
 
variable "private_subnet1_cidrblock" {
  description = "The CIDR block for the first private subnet"
  type        = string
}
 
variable "private_subnet2_cidrblock" {
  description = "The CIDR block for the second private subnet"
  type        = string
  default     = ""
}
 
variable "encrypted_fsx_password" {
  description = "The encrypted password for FSx"
  type        = string
}
 
variable "ebs_volume_size" {
  description = "The size of the EBS volume"
  type        = number
 
  validation {
    condition     = var.ebs_volume_size > 0
    error_message = "The ebs_volume_size value must be greater than 0."
  }
}
 
variable "s3_endpoint_exists" {
  description = "Does the S3 endpoint exist?"
  type        = bool
 
  validation {
    condition     = var.s3_endpoint_exists != null
    error_message = "The s3_endpoint_exists value must not be empty."
  }
}
 
variable "ssm_endpoint_exists" {
  description = "Does the SSM endpoint exist?"
  type        = bool
 
  validation {
    condition     = var.ssm_endpoint_exists != null
    error_message = "The ssm_endpoint_exists value must not be empty."
  }
}
 
variable "cloudwatch_logs_endpoint_exists" {
  description = "Does the CloudWatch Logs endpoint exist?"
  type        = bool
 
  validation {
    condition     = var.cloudwatch_logs_endpoint_exists != null
    error_message = "The cloudwatch_logs_endpoint_exists value must not be empty."
  }
}
 
variable "fsx_endpoint_exists" {
  description = "Does the FSx endpoint exist?"
  type        = bool
 
  validation {
    condition     = var.fsx_endpoint_exists != null
    error_message = "The fsx_endpoint_exists value must not be empty."
  }
}
 
variable "ec2_endpoint_exists" {
  description = "Does the EC2 endpoint exist?"
  type        = bool
 
  validation {
    condition     = var.ec2_endpoint_exists != null
    error_message = "The ec2_endpoint_exists value must not be empty."
  }
}
 
variable "ec2_messages_endpoint_exists" {
  description = "Does the EC2 Messages endpoint exist?"
  type        = bool
 
  validation {
    condition     = var.ec2_messages_endpoint_exists != null
    error_message = "The ec2_messages_endpoint_exists value must not be empty."
  }
}
 
variable "ssm_messages_endpoint_exists" {
  description = "Does the SSM Messages endpoint exist?"
  type        = bool
 
  validation {
    condition     = var.ssm_messages_endpoint_exists != null
    error_message = "The ssm_messages_endpoint_exists value must not be empty."
  }
}
 
variable "unique_id" {
  description = "The unique ID"
  type        = string
 
  validation {
    condition     = length(var.unique_id) > 0
    error_message = "The unique_id value must not be empty."
  }
}
 
variable "fsx_file_system_name" {
  description = "The name of the FSx file system"
  type        = string
 
  validation {
    condition     = length(var.fsx_file_system_name) > 0
    error_message = "The fsx_file_system_name value must not be empty."
  }
}
 
variable "fsx_data_volume_name" {
  description = "The name of the FSx data volume"
  type        = string
 
  validation {
    condition     = length(var.fsx_data_volume_name) > 0
    error_message = "The fsx_data_volume_name value must not be empty."
  }
}
 
variable "fsx_data_volume_size" {
  description = "The size of the FSx data volume"
  type        = number
 
  validation {
    condition     = var.fsx_data_volume_size > 0
    error_message = "The fsx_data_volume_size value must be greater than 0."
  }
}
 
variable "fsx_log_volume_name" {
  description = "The name of the FSx log volume"
  type        = string
 
  validation {
    condition     = length(var.fsx_log_volume_name) > 0
    error_message = "The fsx_log_volume_name value must not be empty."
  }
}
 
variable "fsx_log_volume_size" {
  description = "The size of the FSx log volume"
  type        = number
 
  validation {
    condition     = var.fsx_log_volume_size > 0
    error_message = "The fsx_log_volume_size value must be greater than 0."
  }
}
 
variable "fsx_temp_db_volume_name" {
  description = "The name of the FSx temp DB volume"
  type        = string
 
  validation {
    condition     = length(var.fsx_temp_db_volume_name) > 0
    error_message = "The fsx_temp_db_volume_name value must not be empty."
  }
}
 
variable "fsx_temp_db_volume_size" {
  description = "The size of the FSx temp DB volume"
  type        = number
 
  validation {
    condition     = var.fsx_temp_db_volume_size > 0
    error_message = "The fsx_temp_db_volume_size value must be greater than 0."
  }
}
 
variable "fsx_quorum_volume_name" {
  description = "The name of the FSx quorum volume"
  type        = string
  default     = ""
 
  validation {
    condition     = var.sql_deployment_mode == "standalone" || length(var.fsx_quorum_volume_name) > 0
    error_message = "The fsx_quorum_volume_name value must not be empty when sql_deployment_mode is not standalone."
  }
}
 
variable "fsx_quorum_volume_size" {
  description = "The size of the FSx quorum volume"
  type        = number
  default     = 0
}
 
variable "fsx_svm_name" {
  description = "The name of the FSx SVM"
  type        = string
 
  validation {
    condition     = length(var.fsx_svm_name) > 0
    error_message = "The fsx_svm_name value must not be empty."
  }
}
 
variable "sql_igroup_name" {
  description = "The name of the SQL igroup"
  type        = string
 
  validation {
    condition     = length(var.sql_igroup_name) > 0
    error_message = "The sql_igroup_name value must not be empty."
  }
}
 
variable "sql_svm_name" {
  description = "The name of the SQL SVM"
  type        = string
 
  validation {
    condition     = length(var.sql_svm_name) > 0
    error_message = "The sql_svm_name value must not be empty."
  }
}
 
variable "node_net_bios_names" {
  description = "The NetBIOS names of the nodes"
  type        = string
 
  validation {
    condition     = length(var.node_net_bios_names) > 0
    error_message = "The node_net_bios_names value must not be empty."
  }
}
 
variable "fsx_storage_capacity" {
  description = "The storage capacity of FSx"
  type        = number
 
  validation {
    condition     = var.fsx_storage_capacity > 0
    error_message = "The fsx_storage_capacity value must be greater than 0."
  }
}
 
variable "fsx_data_lun_size" {
  description = "The size of the FSx data LUN"
  type        = number
 
  validation {
    condition     = var.fsx_data_lun_size > 0
    error_message = "The fsx_data_lun_size value must be greater than 0."
  }
}
 
variable "domain_admin_user" {
  description = "The username of the domain admin"
  type        = string
 
  validation {
    condition     = length(var.domain_admin_user) > 0
    error_message = "The domain_admin_user value must not be empty."
  }
}
 
variable "fsx_admin_username" {
  description = "The username of the FSx admin"
  type        = string
 
  validation {
    condition     = length(var.fsx_admin_username) > 0
    error_message = "The fsx_admin_username value must not be empty."
  }
}
 
variable "sql_service_account_name" {
  description = "The name of the SQL service account"
  type        = string
 
  validation {
    condition     = length(var.sql_service_account_name) > 0
    error_message = "The sql_service_account_name value must not be empty."
  }
}
 
variable "deployment_mode" {
  description = "The deployment mode"
  type        = string
 
  validation {
    condition     = length(var.deployment_mode) > 0
    error_message = "The deployment_mode value must not be empty."
  }
}
 
variable "fsx_file_system_id" {
  description = "The ID of the FSx file system"
  type        = string
  default     = ""
}
 
variable "fsx_admin_password" {
  description = "The password of the FSx admin"
  type        = string
 
  validation {
    condition     = length(var.fsx_admin_password) > 0
    error_message = "The fsx_admin_password value must not be empty."
  }
}
 
variable "fsx_volume_throughput_capacity" {
  description = "The throughput capacity of the FSx volume"
  type        = number
 
  validation {
    condition     = var.fsx_volume_throughput_capacity > 0
    error_message = "The fsx_volume_throughput_capacity value must be greater than 0."
  }
}
 
variable "fsx_disk_iops" {
  description = "The IOPS of the FSx disk"
  type        = number
 
  validation {
    condition     = var.fsx_disk_iops >= 3
    error_message = "The fsx_disk_iops value must be greater than 3."
  }
}
 
variable "file_system_encryption_key_id" {
  description = "The ID of the file system encryption key"
  type        = string
}
 
variable "ontap_security_group_id" {
  description = "The ID of the ONTAP security group. Comma-separated list of security group IDs is supported."
  type        = string
}
 
variable "fsx_volume_snapshot_policy" {
  description = "The snapshot policy of the FSx volume"
  type        = string
 
  validation {
    condition     = length(var.fsx_volume_snapshot_policy) > 0
    error_message = "The fsx_volume_snapshot_policy value must not be empty."
  }
}
 
variable "sql_deployment_mode" {
  description = "The deployment mode of SQL"
  type        = string
 
  validation {
    condition     = length(var.sql_deployment_mode) > 0
    error_message = "The sql_deployment_mode value must not be empty."
  }
}
 
variable "sql_service_account_password" {
  description = "The password of the SQL service account"
  type        = string
 
  validation {
    condition     = length(var.sql_service_account_password) > 0
    error_message = "The sql_service_account_password value must not be empty."
  }
}
 
variable "enable_cloud_watch_log_feature" {
  description = "Is the CloudWatch log feature enabled?"
  type        = bool
 
  validation {
    condition     = var.enable_cloud_watch_log_feature != null
    error_message = "The enable_cloud_watch_log_feature value must not be undefined."
  }
}
 
variable "sql_ami_id" {
  description = "The AMI ID of SQL"
  type        = string
 
  validation {
    condition     = length(var.sql_ami_id) > 0
    error_message = "The sql_ami_id value must not be empty."
  }
}
 
variable "sql_collation" {
  description = "The collation of SQL"
  type        = string
  default     = "SQL_Latin1_General_CP1_CI_AS"
 
  validation {
    condition     = length(var.sql_collation) > 0
    error_message = "The sql_collation value must not be empty."
  }
}
 
variable "sql_server_name" {
  description = "The name of the SQL server"
  type        = string
 
  validation {
    condition     = length(var.sql_server_name) > 0
    error_message = "The sql_server_name value must not be empty."
  }
}
 
variable "is_custom_ami" {
  description = "Is a custom AMI being used?"
  type        = string
  default     = "false"
 
  validation {
    condition     = length(var.is_custom_ami) > 0
    error_message = "The is_custom_ami value must not be empty."
  }
}
 
variable "workload_instance_type" {
  description = "The instance type of the workload"
  type        = string
  default     = "m5.large"
 
  validation {
    condition     = length(var.workload_instance_type) > 0
    error_message = "The workload_instance_type value must not be empty."
  }
}
 
variable "key_pair_name" {
  description = "The name of the key pair"
  type        = string
  default     = "occm_qa"
 
  validation {
    condition     = length(var.key_pair_name) > 0
    error_message = "The key_pair_name value must not be empty."
  }
}
 
variable "mssql_media_bucket_name" {
  description = "The name of the bucket containing the MSSQL media"
  type        = string
 
  validation {
    condition     = length(var.mssql_media_bucket_name) > 0
    error_message = "The mssql_media_bucket_name value must not be empty."
  }
}
 
variable "mssql_media_path_key" {
  description = "The path key to the MSSQL media in the bucket"
  type        = string
 
  validation {
    condition     = length(var.mssql_media_path_key) > 0
    error_message = "The mssql_media_path_key value must not be empty."
  }
}
 
variable "validation_node_initialization_s3_url" {
  description = "Value of the validaton node initialization URL"
  type        = string
 
  validation {
    condition     = length(var.validation_node_initialization_s3_url) > 0
    error_message = "The validation_node_initialization_s3_url value must not be empty."
  }
}
 
variable "sql_node_initialization_s3_url" {
  description = "Value of the sql node initialization URL"
  type        = string
 
  validation {
    condition     = length(var.sql_node_initialization_s3_url) > 0
    error_message = "The sql_node_initialization_s3_url value must not be empty."
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
  ontap_security_group_id        = var.ontap_security_group_id
  mssql_media_bucket_name        = var.mssql_media_bucket_name
  sql_fsx_server_net_bios_name   = element(split(",", var.node_net_bios_names), 0)
  workload_instance_type         = var.workload_instance_type
}`;
