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
  ad_dns_ip_addresses            = element(split(",", var.dns_ip_addresses), 0)
  sql_fsx_server_net_bios_name   = element(split(",", var.node_net_bios_names), 0)
  sql_fsx_server_net_bios_name_2 = element(split(",", var.node_net_bios_names), 1)
  adsg_not_selected              = var.domain_member_sg_id == "" ? true : false
  ontap_security_groups          = split(",", var.ontap_security_group_id)
  group_set                      = local.adsg_not_selected ? concat([aws_security_group.workload_security_group.id], local.ontap_security_groups) : concat([aws_security_group.workload_security_group.id], local.ontap_security_groups, [var.domain_member_sg_id])
  sql_fsx_fci_name               = var.sql_server_name
  # Terraform does not support doing validation of an variable based on another variable. So we have to do it like this.
  fsx_file_system_name_required     = (local.new_ontap_fsx && var.fsx_file_system_name == "") ? tobool("Validation Error: The fsx_file_system_name variable must be set when new fsx is deployed.") : true
  s3_endpoint_route_tables_required = (!var.s3_endpoint_exists && var.s3_endpoint_route_tables == "") ? tobool("Validation Error: The s3_endpoint_route_tables variable must be set when s3_endpoint_exists is false.") : true
  # validation for sql_service_account_password
  sql_service_account_password_required = (!var.is_managed_service_account && var.sql_service_account_password == "") ? tobool("Validation Error: The sql_service_account_password variable must be set when is_managed_service_account is false.") : true
  # validations for the fci deployment
  subnet2_cidrblock_required      = (!local.is_standalone && var.private_subnet2_cidrblock == "") ? tobool("Validation Error: The private_subnet2_cidrblock variable must be set for fci deployment.") : true
  subnet2_id_required             = (!local.is_standalone && var.private_subnet2_id == "") ? tobool("Validation Error: The private_subnet2_id variable must be set for fci deployment.") : true
  route_table2_id_required        = (!local.is_standalone && var.route_table2_id == "") ? tobool("Validation Error: The route_table2_id variable must be set for fci deployment.") : true
  fsx_quorum_volume_name_required = (!local.is_standalone && var.fsx_quorum_volume_name == "") ? tobool("Validation Error: The fsx_quorum_volume_name variable must be set for fci deployment.") : true
  fsx_quorum_volume_size_required = (!local.is_standalone && var.fsx_quorum_volume_size == "") ? tobool("Validation Error: The fsx_quorum_volume_size variable must be set for fci deployment.") : true
  sql_fsx_ws_fc_name_required     = (!local.is_standalone && var.sql_fsx_ws_fc_name == "") ? tobool("Validation Error: The sql_fsx_ws_fc_name variable must be set for fci deployment.") : true
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

variable "ad_scenario_type" {
  description = "The type of AD scenario"
  type        = string
  default     = "{{ad_scenario_type}}"

  validation {
    condition     = length(var.ad_scenario_type) > 0
    error_message = "The ad_scenario_type value must not be empty."
  }
}

variable "domain_admin_password" {
  description = "The password of the domain admin"
  type        = string
  default     = "{{domain_admin_password}}"
  validation {
    condition     = length(var.domain_admin_password) > 0
    error_message = "The domain_admin_password variable must not be empty."
  }
}

variable "domain_dns_name" {
  description = "The DNS name of the domain"
  type        = string
  default     = "{{domain_dns_name}}"

  validation {
    condition     = length(var.domain_dns_name) > 0
    error_message = "The domain_dns_name value must not be empty."
  }
}

variable "dns_ip_addresses" {
  description = "The IP addresses of the DNS"
  type        = string
  default     = "{{dns_ip_addresses}}"

  validation {
    condition     = length(var.dns_ip_addresses) > 0
    error_message = "The dns_ip_addresses value must not be empty."
  }
}

variable "domain_member_sg_id" {
  description = "The ID of the domain member security group"
  type        = string
  default     = "{{domain_member_sg_id}}"

  validation {
    condition     = length(var.domain_member_sg_id) > 0
    error_message = "The domain_member_sg_id value must not be empty."
  }
}

variable "preferred_domain_controller" {
  description = "The preferred domain controller"
  type        = string
  default     = "{{preferred_domain_controller}}"
}

variable "ou_path" {
  description = "The organizational unit path for domain join"
  type        = string
  default     = "{{ou_path}}"
}

variable "ad_group" {
  description = "The Active Directory group"
  type        = string
  default     = "{{ad_group}}"
}

variable "tf_deploy_role_name" {
  description = "The name of the terraform deployment role"
  type        = string
  default     = "{{tf_deploy_role_name}}"
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

variable "account_id" {
  description = "The account ID"
  type        = string
  default     = "{{account_id}}"
}

variable "cloud_provider_account_id" {
  description = "The cloud provider's account ID"
  type        = number
  default     = "{{cloud_provider_account_id}}"
}

variable "role_credentials_id" {
  description = "The ID of the role credentials"
  type        = string
  default     = "{{role_credentials_id}}"
}

variable "wlmdb_aws_account_id" {
  description = "The AWS account ID for WLMDB"
  type        = number
  default     = "{{wlmdb_aws_account_id}}"
}

variable "metrics" {
  description = "The metrics"
  type        = string
  default     = "{{metrics}}"
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

variable "encrypted_fsx_password" {
  description = "The encrypted password for FSx"
  type        = string
  default     = "{{encrypted_fsx_password}}"
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

variable "fsx_temp_db_volume_name" {
  description = "The name of the FSx temp DB volume"
  type        = string
  default     = "{{fsx_temp_db_volume_name}}"

  validation {
    condition     = length(var.fsx_temp_db_volume_name) > 0
    error_message = "The fsx_temp_db_volume_name value must not be empty."
  }
}

variable "fsx_temp_db_volume_size" {
  description = "The size of the FSx temp DB volume"
  type        = number
  default     = "{{fsx_temp_db_volume_size}}"

  validation {
    condition     = var.fsx_temp_db_volume_size > 0
    error_message = "The fsx_temp_db_volume_size value must be greater than 0."
  }
}

variable "fsx_quorum_volume_name" {
  description = "The name of the FSx quorum volume"
  type        = string
  default     = "{{fsx_quorum_volume_name}}"

  validation {
    condition     = var.sql_deployment_mode == "standalone" || length(var.fsx_quorum_volume_name) > 0
    error_message = "The fsx_quorum_volume_name value must not be empty when sql_deployment_mode is not standalone."
  }
}

variable "fsx_quorum_volume_size" {
  description = "The size of the FSx quorum volume"
  type        = number
  default     = "{{fsx_quorum_volume_size}}"
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

variable "sql_igroup_name" {
  description = "The name of the SQL igroup"
  type        = string
  default     = "{{sql_igroup_name}}"

  validation {
    condition     = length(var.sql_igroup_name) > 0
    error_message = "The sql_igroup_name value must not be empty."
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

variable "fsx_data_lun_size" {
  description = "The size of the FSx data LUN"
  type        = number
  default     = "{{fsx_data_lun_size}}"

  validation {
    condition     = var.fsx_data_lun_size > 0
    error_message = "The fsx_data_lun_size value must be greater than 0."
  }
}

variable "domain_admin_user" {
  description = "The username of the domain admin"
  type        = string
  default     = "{{domain_admin_user}}"

  validation {
    condition     = length(var.domain_admin_user) > 0
    error_message = "The domain_admin_user value must not be empty."
  }
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

variable "sql_service_account_name" {
  description = "The name of the SQL service account"
  type        = string
  default     = "{{sql_service_account_name}}"

  validation {
    condition     = length(var.sql_service_account_name) > 0
    error_message = "The sql_service_account_name value must not be empty."
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

variable "file_system_encryption_key_id" {
  description = "The ID of the file system encryption key"
  type        = string
  default     = "{{file_system_encryption_key_id}}"
}

variable "ontap_security_group_id" {
  description = "The ID of the ONTAP security group"
  type        = string
  default     = "{{ontap_security_group_id}}"

  validation {
    condition     = length(var.ontap_security_group_id) > 0
    error_message = "The ontap_security_group_id value must not be empty."
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
  description = "The password of the SQL service account. Can be empty when is_managed_service_account is true."
  type        = string
  default     = "{{sql_service_account_password}}"
}

variable "is_managed_service_account" {
  description = "Is the SQL service account a managed service account?"
  type        = bool
  default     = "{{is_managed_service_account}}"
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

variable "sql_collation" {
  description = "The collation of SQL"
  type        = string
  default     = "{{sql_collation}}"

  validation {
    condition     = length(var.sql_collation) > 0
    error_message = "The sql_collation value must not be empty."
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

variable "is_custom_ami" {
  description = "Is a custom AMI being used?"
  type        = string
  default     = "{{is_custom_ami}}"

  validation {
    condition     = length(var.is_custom_ami) > 0
    error_message = "The is_custom_ami value must not be empty."
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

variable "mssql_media_bucket_name" {
  description = "The name of the bucket containing the MSSQL media"
  type        = string
  default     = "{{mssql_media_bucket_name}}"

  validation {
    condition     = length(var.mssql_media_bucket_name) > 0
    error_message = "The mssql_media_bucket_name value must not be empty."
  }
}

variable "mssql_media_path_key" {
  description = "The path key to the MSSQL media in the bucket"
  type        = string
  default     = "{{mssql_media_path_key}}"

  validation {
    condition     = length(var.mssql_media_path_key) > 0
    error_message = "The mssql_media_path_key value must not be empty."
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

variable "sql_node_initialization_s3_url" {
  description = "Value of the sql node initialization URL"
  type        = string
  default     = "{{sql_node_initialization_s3_url}}"

  validation {
    condition     = length(var.sql_node_initialization_s3_url) > 0
    error_message = "The sql_node_initialization_s3_url value must not be empty."
  }
}

variable "sql_fsx_ws_fc_name" {
  description = "Windows Server failover cluster name"
  type        = string
  default     = "{{sql_fsx_ws_fc_name}}"
}

variable "sql_fsx_fci_name" {
  description = "Name for the SQL Server failover cluster instance."
  type        = string
  default     = "{{sql_fsx_fci_name}}"
}

variable "aws_profile" {
  description = "The AWS CLI profile to use for this deployment"
  type        = string
  default     = "default" # Change this profile name as per your usage
}


module "vpc_endpoints" {
  source = "./modules/vpc-endpoints"

  vpc_id                     = var.vpc_id
  endpoints_aws_location     = var.aws_location
  preferred_subnet1_id       = var.private_subnet1_id
  preferred_subnet_cidrblock = var.private_subnet1_cidrblock
  deployment_name            = var.deployment_name

  standby_subnet1_id       = local.is_standalone ? "" : var.private_subnet2_id
  standby_subnet_cidrblock = local.is_standalone ? "" : var.private_subnet2_cidrblock
  s3_endpoint_route_tables = var.s3_endpoint_route_tables

  s3_endpoint_exists              = var.s3_endpoint_exists
  ssm_endpoint_exists             = var.ssm_endpoint_exists
  cloudwatch_logs_endpoint_exists = var.cloudwatch_logs_endpoint_exists
  fsx_endpoint_exists             = var.fsx_endpoint_exists
  ec2_endpoint_exists             = var.ec2_endpoint_exists
  ec2_messages_endpoint_exists    = var.ec2_messages_endpoint_exists
  ssm_messages_endpoint_exists    = var.ssm_messages_endpoint_exists
}

module "validation_node1" {
  source = "./modules/validation-node"

  depends_on = [aws_iam_role.ec2_iam_role, aws_iam_role_policy.ec2_iam_role_policy, aws_ssm_parameter.credentials_ssm_parameter, module.vpc_endpoints]

  vpc_id                                = var.vpc_id
  aws_location                          = var.aws_location
  subnet_id                             = var.private_subnet1_id
  dns_ip_addresses                      = var.dns_ip_addresses
  ec2_role_name                         = var.deployment_name
  is_custom_ami                         = var.is_custom_ami
  key_pair_name                         = var.key_pair_name
  perform_ad_check                      = "true"
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
  validation_node_name                  = "Validation-Node-1"
  operating_system                      = local.operating_system
  aws_profile                           = var.aws_profile
}

// This is only created for the FCI Deployment
module "validation_node2" {
  source = "./modules/validation-node"
  count  = local.is_standalone ? 0 : 1

  depends_on = [aws_iam_role.ec2_iam_role, aws_iam_role_policy.ec2_iam_role_policy, aws_ssm_parameter.credentials_ssm_parameter, module.vpc_endpoints]

  vpc_id                                = var.vpc_id
  aws_location                          = var.aws_location
  subnet_id                             = var.private_subnet2_id
  dns_ip_addresses                      = var.dns_ip_addresses
  ec2_role_name                         = var.deployment_name
  key_pair_name                         = var.key_pair_name
  perform_ad_check                      = "false"
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
  validation_node_name                  = "Validation-Node-2"
  operating_system                      = local.operating_system
  aws_profile                           = var.aws_profile
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
  fsx_temp_db_volume_name           = var.fsx_temp_db_volume_name
  fsx_temp_db_volume_size           = var.fsx_temp_db_volume_size
  fsx_cluster_quorum_volume_name    = var.fsx_quorum_volume_name
  fsx_cluster_quorum_volume_size    = var.fsx_quorum_volume_size
  fsx_administrator_password        = var.fsx_admin_password
  fsx_svm_name                      = var.sql_svm_name
  fsx_weekly_maintenance_start_time = "1:05:00"
}

module "fsxn_fci" {
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
  fsx_temp_db_volume_name           = var.fsx_temp_db_volume_name
  fsx_temp_db_volume_size           = var.fsx_temp_db_volume_size
  fsx_cluster_quorum_volume_name    = var.fsx_quorum_volume_name
  fsx_cluster_quorum_volume_size    = var.fsx_quorum_volume_size
  fsx_administrator_password        = var.fsx_admin_password
  fsx_svm_name                      = var.sql_svm_name
  fsx_weekly_maintenance_start_time = "1:05:00"
}

module "standalone_sql_node" {
  source = "./modules/ec2"
  count  = local.is_standalone ? 1 : 0

  depends_on                    = [module.vpc_endpoints, module.validation_node1, module.fsxn_standalone]
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
  fsx_file_system_id         = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn_standalone[0].fsx_fs_logical_id // may be the output of the fsx if its new
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
  ontap_security_group_id        = local.new_ontap_fsx ? module.fsxn_standalone[0].fsxn_security_group_id : var.ontap_security_group_id
  mssql_media_bucket_name        = var.mssql_media_bucket_name
  sql_fsx_server_net_bios_name   = element(split(",", var.node_net_bios_names), 0)
  workload_instance_type         = var.workload_instance_type
  sql_node_name                  = "SQL-Node"
  operating_system               = local.operating_system
  is_standalone                  = local.is_standalone
  workload_security_group_id     = aws_security_group.workload_security_group.id
  aws_profile                    = var.aws_profile
}

// This is only created for the FCI Deployment
module "fci_sql_node1" {
  source = "./modules/ec2"
  count  = local.is_standalone ? 0 : 1

  depends_on                    = [module.vpc_endpoints, module.validation_node1, module.validation_node2, module.fsxn_fci, aws_iam_instance_profile.fci_sql_fsx_profile, aws_network_interface.sql_node_ni_1, aws_network_interface.sql_node_ni_2]
  ec2_role_name                 = var.deployment_name
  enable_cloudwatch_log_feature = var.enable_cloud_watch_log_feature
  unique_id                     = var.unique_id # check not used
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
  fsx_file_system_id         = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn_fci[0].fsx_fs_logical_id // may be the output of the fsx if its new
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
  ontap_security_group_id        = local.new_ontap_fsx ? module.fsxn_fci[0].fsxn_security_group_id : var.ontap_security_group_id
  mssql_media_bucket_name        = var.mssql_media_bucket_name
  mssql_media_path_key           = var.mssql_media_path_key
  sql_fsx_server_net_bios_name   = local.sql_fsx_server_net_bios_name
  sql_fsx_server_net_bios_name_2 = local.sql_fsx_server_net_bios_name_2
  workload_instance_type         = var.workload_instance_type
  sql_node_name                  = "SQL-Node-1"
  operating_system               = local.operating_system

  fsx_quorum_volume_name     = var.fsx_quorum_volume_name
  sql_fsx_ws_fc_name         = var.sql_fsx_ws_fc_name
  sql_fsx_fci_name           = local.sql_fsx_fci_name
  is_standalone              = local.is_standalone
  workload_security_group_id = aws_security_group.workload_security_group.id
  iam_instance_profile       = aws_iam_instance_profile.fci_sql_fsx_profile[0].name
  network_interface_id       = aws_network_interface.sql_node_ni_1[0].id
  network_interface_1_id     = aws_network_interface.sql_node_ni_1[0].id
  network_interface_2_id     = aws_network_interface.sql_node_ni_2[0].id
  private_subnet1_id         = var.private_subnet1_id
  private_subnet2_id         = var.private_subnet2_id
  aws_profile                = var.aws_profile
}

module "fci_sql_node2" {
  source = "./modules/ec2"
  count  = local.is_standalone ? 0 : 1

  depends_on                    = [module.vpc_endpoints, module.validation_node1, module.validation_node2, module.fsxn_fci, aws_iam_instance_profile.fci_sql_fsx_profile, aws_network_interface.sql_node_ni_1, aws_network_interface.sql_node_ni_2]
  ec2_role_name                 = var.deployment_name
  enable_cloudwatch_log_feature = var.enable_cloud_watch_log_feature
  unique_id                     = var.unique_id
  ami_id                        = var.sql_ami_id
  byol_ami                      = var.is_custom_ami
  key_pair_name                 = var.key_pair_name

  vpc_id                     = var.vpc_id
  vpc_cidr                   = var.vpc_cidr
  deployment_name            = var.deployment_name
  sql_server_name            = var.sql_server_name
  sql_svm_name               = var.sql_svm_name
  fsx_data_volume_name       = var.fsx_data_volume_name
  fsx_log_volume_name        = var.fsx_log_volume_name
  fsx_file_system_id         = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn_fci[0].fsx_fs_logical_id // may be the output of the fsx if its new
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
  ebs_volume_size                = var.ebs_volume_size
  domain_member_sg_id            = var.domain_member_sg_id
  ontap_security_group_id        = local.new_ontap_fsx ? module.fsxn_fci[0].fsxn_security_group_id : var.ontap_security_group_id
  mssql_media_bucket_name        = var.mssql_media_bucket_name
  mssql_media_path_key           = var.mssql_media_path_key
  workload_instance_type         = var.workload_instance_type
  sql_node_name                  = "SQL-Node-2"
  operating_system               = local.operating_system

  private_subnet_id              = var.private_subnet2_id
  route_table_id                 = var.route_table2_id
  sql_fsx_server_net_bios_name   = local.sql_fsx_server_net_bios_name
  sql_fsx_server_net_bios_name_2 = local.sql_fsx_server_net_bios_name_2

  fsx_quorum_volume_name     = var.fsx_quorum_volume_name
  sql_fsx_ws_fc_name         = var.sql_fsx_ws_fc_name
  sql_fsx_fci_name           = local.sql_fsx_fci_name
  is_standalone              = local.is_standalone
  workload_security_group_id = aws_security_group.workload_security_group.id
  iam_instance_profile       = aws_iam_instance_profile.fci_sql_fsx_profile[0].name
  network_interface_id       = aws_network_interface.sql_node_ni_2[0].id
  network_interface_1_id     = aws_network_interface.sql_node_ni_1[0].id
  network_interface_2_id     = aws_network_interface.sql_node_ni_2[0].id
  private_subnet1_id         = var.private_subnet1_id
  private_subnet2_id         = var.private_subnet2_id
  aws_profile                = var.aws_profile
}
