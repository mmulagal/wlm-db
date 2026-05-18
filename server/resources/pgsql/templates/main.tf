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
variable "aws_location" {
  description = "Value of the location"
  type        = string
  default     = "{{aws_location}}"

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
  default     = "{{creator_tag}}"

  validation {
    condition     = length(var.creator_tag) > 0
    error_message = "The creator_tag value must not be empty."
  }
}

variable "deployment_name" {
  description = "Value of the Deployment Name"
  type        = string
  default     = "{{deployment_name}}"

  validation {
    condition     = length(var.deployment_name) > 0
    error_message = "The deployment_name value must not be empty."
  }
}

variable "fsx_encryption_key" {
  default     = "{{fsx_encryption_key}}"
  description = "The encryption key for FSx"
  type        = string
}

# standalone mode
variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
  default     = "{{vpc_id}}"

  validation {
    condition     = length(var.vpc_id) > 0
    error_message = "The vpc_id value must not be empty."
  }
}

variable "vpc_cidr" {
  description = "The CIDR block of the VPC"
  type        = string
  default     = "{{vpc_cidr}}"

  validation {
    condition     = length(var.vpc_cidr) > 0
    error_message = "The vpc_cidr value must not be empty."
  }
}

variable "private_subnet1_id" {
  description = "The ID of the first private subnet"
  type        = string
  default     = "{{private_subnet1_id}}"

  validation {
    condition     = length(var.private_subnet1_id) > 0
    error_message = "The private_subnet1_id value must not be empty."
  }
}

variable "route_table1_id" {
  description = "The ID of the first route table"
  type        = string
  default     = "{{route_table1_id}}"

  validation {
    condition     = length(var.route_table1_id) > 0
    error_message = "The route_table1_id value must not be empty."
  }
}

variable "private_subnet2_id" {
  description = "The ID of the second private subnet"
  type        = string
  default     = "{{private_subnet2_id}}"

  validation {
    condition     = var.sql_deployment_mode != "standalone" ? length(var.private_subnet2_id) > 0 : true
    error_message = "The private_subnet2_id value must not be empty when sql_deployment_mode is FCI."
  }
}

variable "route_table2_id" {
  description = "The ID of the second route table"
  type        = string
  default     = "{{route_table2_id}}"

  validation {
    condition     = var.sql_deployment_mode != "standalone" ? length(var.route_table2_id) > 0 : true
    error_message = "The route_table2_id value must not be empty when sql_deployment_mode is FCI."
  }
}

variable "validation_ami" {
  description = "The AMI ID for validation"
  type        = string
  default     = "{{validation_ami}}"

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

variable "s3_endpoint_route_tables" {
  description = "The S3 endpoint route tables"
  type        = string
  default     = "{{s3_endpoint_route_tables}}"
}

variable "private_subnet1_cidrblock" {
  description = "The CIDR block for the first private subnet"
  type        = string
  default     = "{{private_subnet1_cidrblock}}"
}

variable "private_subnet2_cidrblock" {
  description = "The CIDR block for the second private subnet"
  type        = string
  default     = "{{private_subnet2_cidrblock}}"
}

variable "ebs_volume_size" {
  description = "The size of the EBS volume"
  type        = number
  default     = "{{ebs_volume_size}}"

  validation {
    condition     = var.ebs_volume_size > 0
    error_message = "The ebs_volume_size value must be greater than 0."
  }
}

variable "s3_endpoint_exists" {
  description = "Does the S3 endpoint exist?"
  type        = bool
  default     = "{{s3_endpoint_exists}}"

  validation {
    condition     = var.s3_endpoint_exists != null
    error_message = "The s3_endpoint_exists value must not be empty."
  }
}

variable "ssm_endpoint_exists" {
  description = "Does the SSM endpoint exist?"
  type        = bool
  default     = "{{ssm_endpoint_exists}}"

  validation {
    condition     = var.ssm_endpoint_exists != null
    error_message = "The ssm_endpoint_exists value must not be empty."
  }
}

variable "cloudwatch_logs_endpoint_exists" {
  description = "Does the CloudWatch Logs endpoint exist?"
  type        = bool
  default     = "{{cloudwatch_logs_endpoint_exists}}"

  validation {
    condition     = var.cloudwatch_logs_endpoint_exists != null
    error_message = "The cloudwatch_logs_endpoint_exists value must not be empty."
  }
}

variable "fsx_endpoint_exists" {
  description = "Does the FSx endpoint exist?"
  type        = bool
  default     = "{{fsx_endpoint_exists}}"

  validation {
    condition     = var.fsx_endpoint_exists != null
    error_message = "The fsx_endpoint_exists value must not be empty."
  }
}

variable "ec2_endpoint_exists" {
  description = "Does the EC2 endpoint exist?"
  type        = bool
  default     = "{{ec2_endpoint_exists}}"

  validation {
    condition     = var.ec2_endpoint_exists != null
    error_message = "The ec2_endpoint_exists value must not be empty."
  }
}

variable "ec2_messages_endpoint_exists" {
  description = "Does the EC2 Messages endpoint exist?"
  type        = bool
  default     = "{{ec2_messages_endpoint_exists}}"

  validation {
    condition     = var.ec2_messages_endpoint_exists != null
    error_message = "The ec2_messages_endpoint_exists value must not be empty."
  }
}

variable "ssm_messages_endpoint_exists" {
  description = "Does the SSM Messages endpoint exist?"
  type        = bool
  default     = "{{ssm_messages_endpoint_exists}}"

  validation {
    condition     = var.ssm_messages_endpoint_exists != null
    error_message = "The ssm_messages_endpoint_exists value must not be empty."
  }
}

variable "unique_id" {
  description = "The unique ID"
  type        = string
  default     = "{{unique_id}}"

  validation {
    condition     = length(var.unique_id) > 0
    error_message = "The unique_id value must not be empty."
  }
}

variable "fsx_file_system_name" {
  description = "The name of the FSx file system"
  type        = string
  default     = "{{fsx_file_system_name}}"

  validation {
    condition     = length(var.fsx_file_system_name) > 0
    error_message = "The fsx_file_system_name value must not be empty."
  }
}

variable "fsx_data_volume_name" {
  description = "The name of the FSx data volume"
  type        = string
  default     = "{{fsx_data_volume_name}}"

  validation {
    condition     = length(var.fsx_data_volume_name) > 0
    error_message = "The fsx_data_volume_name value must not be empty."
  }
}

variable "fsx_data_volume_size" {
  description = "The size of the FSx data volume"
  type        = number
  default     = "{{fsx_data_volume_size}}"

  validation {
    condition     = var.fsx_data_volume_size > 0
    error_message = "The fsx_data_volume_size value must be greater than 0."
  }
}

variable "fsx_log_volume_name" {
  description = "The name of the FSx log volume"
  type        = string
  default     = "{{fsx_log_volume_name}}"

  validation {
    condition     = length(var.fsx_log_volume_name) > 0
    error_message = "The fsx_log_volume_name value must not be empty."
  }
}

variable "fsx_log_volume_size" {
  description = "The size of the FSx log volume"
  type        = number
  default     = "{{fsx_log_volume_size}}"

  validation {
    condition     = var.fsx_log_volume_size > 0
    error_message = "The fsx_log_volume_size value must be greater than 0."
  }
}

variable "fsx_svm_name" {
  description = "The name of the FSx SVM"
  type        = string
  default     = "{{fsx_svm_name}}"

  validation {
    condition     = length(var.fsx_svm_name) > 0
    error_message = "The fsx_svm_name value must not be empty."
  }
}

variable "sql_svm_name" {
  description = "The name of the SQL SVM"
  type        = string
  default     = "{{sql_svm_name}}"

  validation {
    condition     = length(var.sql_svm_name) > 0
    error_message = "The sql_svm_name value must not be empty."
  }
}

variable "node_net_bios_names" {
  description = "The NetBIOS names of the nodes"
  type        = string
  default     = "{{node_net_bios_names}}"

  validation {
    condition     = length(var.node_net_bios_names) > 0
    error_message = "The node_net_bios_names value must not be empty."
  }
}

variable "fsx_storage_capacity" {
  description = "The storage capacity of FSx"
  type        = number
  default     = "{{fsx_storage_capacity}}"

  validation {
    condition     = var.fsx_storage_capacity > 0
    error_message = "The fsx_storage_capacity value must be greater than 0."
  }
}

variable "deployment_mode" {
  description = "The deployment mode"
  type        = string
  default     = "{{deployment_mode}}"

  validation {
    condition     = length(var.deployment_mode) > 0
    error_message = "The deployment_mode value must not be empty."
  }
}

variable "fsx_file_system_id" {
  description = "The ID of the FSx file system"
  type        = string
  default     = "{{fsx_file_system_id}}"
}

variable "fsx_admin_password" {
  description = "The password of the FSx admin"
  type        = string
  default     = "{{fsx_admin_password}}"

  validation {
    condition     = length(var.fsx_admin_password) > 0
    error_message = "The fsx_admin_password value must not be empty."
  }
}

variable "fsx_volume_throughput_capacity" {
  description = "The throughput capacity of the FSx volume"
  type        = number
  default     = "{{fsx_volume_throughput_capacity}}"

  validation {
    condition     = var.fsx_volume_throughput_capacity > 0
    error_message = "The fsx_volume_throughput_capacity value must be greater than 0."
  }
}

variable "fsx_disk_iops" {
  description = "The IOPS of the FSx disk"
  type        = number
  default     = "{{fsx_disk_iops}}"

  validation {
    condition     = var.fsx_disk_iops >= 3
    error_message = "The fsx_disk_iops value must be greater than 3."
  }
}

variable "ontap_security_group_id" {
  description = "The ID of the ONTAP security group"
  type        = string
  default     = "{{ontap_security_group_id}}"
}

variable "sql_deployment_mode" {
  description = "The deployment mode of SQL"
  type        = string
  default     = "{{sql_deployment_mode}}"

  validation {
    condition     = length(var.sql_deployment_mode) > 0
    error_message = "The sql_deployment_mode value must not be empty."
  }
}

variable "sql_service_account_password" {
  description = "The password of the SQL service account"
  type        = string
  default     = "{{sql_service_account_password}}"

  validation {
    condition     = length(var.sql_service_account_password) > 0
    error_message = "The sql_service_account_password value must not be empty."
  }
}

variable "enable_cloud_watch_log_feature" {
  description = "Is the CloudWatch log feature enabled?"
  type        = bool
  default     = "{{enable_cloud_watch_log_feature}}"

  validation {
    condition     = var.enable_cloud_watch_log_feature != null
    error_message = "The enable_cloud_watch_log_feature value must not be undefined."
  }
}

variable "sql_ami_id" {
  description = "The AMI ID of SQL"
  type        = string
  default     = "{{sql_ami_id}}"

  validation {
    condition     = length(var.sql_ami_id) > 0
    error_message = "The sql_ami_id value must not be empty."
  }
}

variable "sql_server_name" {
  description = "The name of the SQL server"
  type        = string
  default     = "{{sql_server_name}}"

  validation {
    condition     = length(var.sql_server_name) > 0
    error_message = "The sql_server_name value must not be empty."
  }
}

variable "workload_instance_type" {
  description = "The instance type of the workload"
  type        = string
  default     = "{{workload_instance_type}}"

  validation {
    condition     = length(var.workload_instance_type) > 0
    error_message = "The workload_instance_type value must not be empty."
  }
}

variable "key_pair_name" {
  description = "The name of the key pair"
  type        = string
  default     = "{{key_pair_name}}"

  validation {
    condition     = length(var.key_pair_name) > 0
    error_message = "The key_pair_name value must not be empty."
  }
}

variable "validation_node_initialization_s3_url" {
  description = "Value of the validaton node initialization URL"
  type        = string
  default     = "{{validation_node_initialization_s3_url}}"

  validation {
    condition     = length(var.validation_node_initialization_s3_url) > 0
    error_message = "The validation_node_initialization_s3_url value must not be empty."
  }
}

variable "pgsql_node_initialization_s3_url" {
  description = "Value of the pgsql node initialization URL"
  type        = string
  default     = "{{pgsql_node_initialization_s3_url}}"

  validation {
    condition     = length(var.pgsql_node_initialization_s3_url) > 0
    error_message = "The pgsql_node_initialization_s3_url value must not be empty."
  }
}

variable "aws_profile" {
  description = "The AWS CLI profile to use for this deployment"
  type        = string
  default     = "default" # Change this profile name as per your usage
}

variable "account_id" {
  description = "The account ID"
  type        = string
  default     = "{{account_id}}"
}

variable "wlmdb_aws_account_id" {
  description = "The AWS account ID for WLMDB"
  type        = number
  default     = "{{wlmdb_aws_account_id}}"
}

variable "fsx_admin_username" {
  description = "The username of the FSx admin"
  type        = string
  default     = "{{fsx_admin_username}}"

  validation {
    condition     = length(var.fsx_admin_username) > 0
    error_message = "The fsx_admin_username value must not be empty."
  }
}

variable "fsx_volume_snapshot_policy" {
  description = "The snapshot policy of the FSx volume"
  type        = string
  default     = "{{fsx_volume_snapshot_policy}}"

  validation {
    condition     = length(var.fsx_volume_snapshot_policy) > 0
    error_message = "The fsx_volume_snapshot_policy value must not be empty."
  }
}

variable "sql_version" {
  description = "The version of PGSQL"
  type        = string
  default     = "{{sql_version}}"

  validation {
    condition     = length(var.sql_version) > 0
    error_message = "The sql_version value must not be empty."
  }
}

variable "fsx_aggr_name" {
  description = "Aggregate FSx for ONTAP file system."
  type        = string
  default     = "{{fsx_aggr_name}}"
}

variable "fsx_svm_uuid" {
  description = "UUID of the FSx Storage Virtual Machine"
  type        = string
  default     = "{{fsx_svm_uuid}}"
}

variable "fsx_svm_id" {
  description = "ID of the FSx Storage Virtual Machine"
  type        = string
  default     = "{{fsx_svm_id}}"
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
