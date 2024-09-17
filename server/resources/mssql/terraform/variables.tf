variable "aws_location" {
  description = "Value of the location"
  type        = string

  validation {
    condition     = can(regex("[a-z][a-z]-[a-z]+-[1-9]", var.aws_location))
    error_message = "Must be valid AWS Region names."
  }
}

variable "creator_tag" {
  description = "Value of the creator tag"
  type        = string
}

variable "environment" {
  description = "Deployment Environment"
  default     = "WLMDB"
}
variable "deployment_name" {
  description = "Value of the Deployment Name"
  type        = string
}

variable "fsx_encryption_key" {
  description = "The encryption key for FSx"
  type        = string
}

# standalone mode
variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
}

variable "vpc_cidr" {
  description = "The CIDR block of the VPC"
  type        = string
}

variable "private_subnet1_id" {
  description = "The ID of the first private subnet"
  type        = string
}

variable "route_table1_id" {
  description = "The ID of the first route table"
  type        = string
}

variable "private_subnet2_id" {
  description = "The ID of the second private subnet"
  type        = string
}

variable "route_table2_id" {
  description = "The ID of the second route table"
  type        = string
}

variable "ad_scenario_type" {
  description = "The type of AD scenario"
  type        = string
}

variable "domain_admin_password" {
  description = "The password of the domain admin"
  type        = string
  validation {
    condition     = var.domain_admin_password != ""
    error_message = "The domain_admin_password variable must not be empty."
  }
}

variable "domain_dns_name" {
  description = "The DNS name of the domain"
  type        = string
}

variable "dns_ip_addresses" {
  description = "The IP addresses of the DNS"
  type        = string
}

variable "domain_member_sg_id" {
  description = "The ID of the domain member security group"
  type        = string
  default     = ""
}

variable "tf_deploy_role_name" {
  description = "The name of the terraform deployment role"
  type        = string
}

variable "validation_ami" {
  description = "The AMI ID for validation"
  type        = string
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
}

variable "s3_endpoint_exists" {
  description = "Does the S3 endpoint exist?"
  type        = bool
  default     = true
}

variable "ssm_endpoint_exists" {
  description = "Does the SSM endpoint exist?"
  type        = bool
  default     = true
}

variable "cloudwatch_logs_endpoint_exists" {
  description = "Does the CloudWatch Logs endpoint exist?"
  type        = bool
  default     = true
}

variable "fsx_endpoint_exists" {
  description = "Does the FSx endpoint exist?"
  type        = bool
  default     = true
}

variable "ec2_endpoint_exists" {
  description = "Does the EC2 endpoint exist?"
  type        = bool
  default     = true
}

variable "ec2_messages_endpoint_exists" {
  description = "Does the EC2 Messages endpoint exist?"
  type        = bool
  default     = true
}

variable "ssm_messages_endpoint_exists" {
  description = "Does the SSM Messages endpoint exist?"
  type        = bool
  default     = true
}

variable "unique_id" {
  description = "The unique ID"
  type        = string
}

variable "fsx_file_system_name" {
  description = "The name of the FSx file system"
  type        = string
}

variable "fsx_data_volume_name" {
  description = "The name of the FSx data volume"
  type        = string
}

variable "fsx_data_volume_size" {
  description = "The size of the FSx data volume"
  type        = number
}

variable "fsx_log_volume_name" {
  description = "The name of the FSx log volume"
  type        = string
}

variable "fsx_log_volume_size" {
  description = "The size of the FSx log volume"
  type        = number
}

variable "fsx_temp_db_volume_name" {
  description = "The name of the FSx temp DB volume"
  type        = string
}

variable "fsx_temp_db_volume_size" {
  description = "The size of the FSx temp DB volume"
  type        = number
}

variable "fsx_quorum_volume_name" {
  description = "The name of the FSx quorum volume"
  type        = string
  default     = "wlmdb_quorum"
}

variable "fsx_quorum_volume_size" {
  description = "The size of the FSx quorum volume"
  type        = number
  default     = 100
}


variable "fsx_svm_name" {
  description = "The name of the FSx SVM"
  type        = string
}

variable "sql_igroup_name" {
  description = "The name of the SQL igroup"
  type        = string
}

variable "sql_svm_name" {
  description = "The name of the SQL SVM"
  type        = string
}

variable "node_net_bios_names" {
  description = "The NetBIOS names of the nodes"
  type        = string
}

variable "fsx_storage_capacity" {
  description = "The storage capacity of FSx"
  type        = number
}

variable "fsx_data_lun_size" {
  description = "The size of the FSx data LUN"
  type        = number
}

variable "domain_admin_user" {
  description = "The username of the domain admin"
  type        = string
}

variable "fsx_admin_username" {
  description = "The username of the FSx admin"
  type        = string
}

variable "sql_service_account_name" {
  description = "The name of the SQL service account"
  type        = string
}

variable "deployment_mode" {
  description = "The deployment mode"
  type        = string
  default     = "SINGLE_AZ_1"
}

variable "fsx_file_system_id" {
  description = "The ID of the FSx file system"
  type        = string
  default     = ""
}

variable "fsx_admin_password" {
  description = "The password of the FSx admin"
  type        = string
}

variable "fsx_volume_throughput_capacity" {
  description = "The throughput capacity of the FSx volume"
  type        = number
}

variable "fsx_disk_iops" {
  description = "The IOPS of the FSx disk"
  type        = number
}

variable "file_system_encryption_key_id" {
  description = "The ID of the file system encryption key"
  type        = string
}

variable "ontap_security_group_id" {
  description = "The ID of the ONTAP security group"
  type        = string
}

variable "fsx_volume_snapshot_policy" {
  description = "The snapshot policy of the FSx volume"
  type        = string
}

variable "sql_deployment_mode" {
  description = "The deployment mode of SQL"
  type        = string
}

variable "sql_ami_id" {
  description = "The AMI ID of SQL"
  type        = string
}

variable "sql_service_account_password" {
  description = "The password of the SQL service account"
  type        = string
  validation {
    condition     = var.sql_service_account_password != ""
    error_message = "The sql_service_account_password variable must not be empty."
  }
}

variable "sql_collation" {
  description = "The collation of SQL"
  type        = string
  default     = "SQL_Latin1_General_CP1_CI_AS"
}

variable "sql_server_name" {
  description = "The name of the SQL server"
  type        = string
}

variable "is_custom_ami" { // check type in api
  description = "Is a custom AMI being used?"
  type        = string
  default     = "false"
}

variable "workload_instance_type" {
  description = "The instance type of the workload"
  type        = string
  default     = "m5.large"
}

variable "key_pair_name" {
  description = "The name of the key pair"
  type        = string
  default     = "occm_qa"
}
variable "enable_cloud_watch_log_feature" {
  description = "Is the CloudWatch log feature enabled?"
  type        = bool
  default     = true
}

variable "mssql_media_bucket_name" {
  description = "The name of the bucket containing the MSSQL media"
  type        = string
}

variable "mssql_media_path_key" {
  description = "The path key to the MSSQL media in the bucket"
  type        = string
}

variable "validation_node_initialization_s3_url" {
  description = "Value of the validaton node initialization URL"
  type        = string
}

variable "sql_node_initialization_s3_url" {
  description = "Value of the sql node initialization URL"
  type        = string
}
