variable "aws_location" {
  description = "Value of the location"
  type        = string
  default     = "ap-southeast-1"

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
  default     = "POC"
}

variable "bucket_for_state" {
  description = "Value of the bucket for state"
  type        = string
}

variable "terraform_state_locking" {
  description = "Value of the terraform state locking"
  type        = string
}

# variable "s3_template_url" {
#   description = "Value of the S3 Template URL"
#   type        = string
# }

variable "deployment_name" {
  description = "Value of the Deployment Name"
  type        = string
  default     = "wlmdb-poc"
}

variable "s3_artifacts_url" {
  description = "Value of the S3 Artifacts URL"
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
  default     = "vpc-046f7e26255458373"
}

variable "vpc_cidr" {
  description = "The CIDR block of the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet1_id" {
  description = "The ID of the first private subnet"
  type        = string
  default     = "subnet-0fcd4374d52d4faf0"
}

variable "route_table1_id" {
  description = "The ID of the first route table"
  type        = string
  default     = "rtb-044539dfce91103ab"
}

variable "private_subnet2_id" {
  description = "The ID of the second private subnet"
  type        = string
  default     = "subnet-03302cffd47acd237"
}

variable "route_table2_id" {
  description = "The ID of the second route table"
  type        = string
  default     = "rtb-09a5394f5cee60073"
}

variable "ad_scenario_type" {
  description = "The type of AD scenario"
  type        = string
  default     = "USER_MANAGED_AD"
}

variable "domain_admin_password" {
  description = "The password of the domain admin"
  type        = string
  default     = "Collector@1234"
}

variable "domain_dns_name" {
  description = "The DNS name of the domain"
  type        = string
  default     = "wlmnew.com"
}

variable "dns_ip_addresses" {
  description = "The IP addresses of the DNS"
  type        = string
  default     = "10.0.141.68"
}

variable "domain_member_sg_id" {
  description = "The ID of the domain member security group"
  type        = string
  default     = ""
}

variable "tf_deploy_role_name" {
  description = "The name of the terraform deployment role"
  type        = string
  default     = "wlm-operate-permissions-role"
}

variable "validation_ami" {
  description = "The AMI ID for validation"
  type        = string
  default     = "ami-07b4b6e7643cb29ed"
}

variable "validation_node_instance_type" {
  description = "The instance type for the validation node"
  type        = string
  default     = "t2.micro"
}

variable "account_id" {
  description = "The account ID"
  type        = string
  default     = "account-aHP3esT5"
}

variable "cloud_provider_account_id" {
  description = "The cloud provider's account ID"
  type        = number
  default     = 464262061435
}

variable "role_credentials_id" {
  description = "The ID of the role credentials"
  type        = string
  default     = "0c9ba7d1-3bca-4e8a-b6e3-becd91160ab8"
}

variable "wlmdb_aws_account_id" {
  description = "The AWS account ID for WLMDB"
  type        = number
  default     = 464262061435
}

variable "jwt_token" {
  description = "The JWT token"
  type        = string
  default     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXIiOiJTWVNURU1AbmV0YXBwLmNvbSJ9LCJpYXQiOjE3MjQwNjUxNjUsImV4cCI6MTcyNDY2OTk2NX0.1hoOmaU6EnuXsIPVM6K61atNCDSZrURCPRQJtJWsF1c"
}

variable "metrics" {
  description = "The metrics"
  type        = string
  default     = "triggered-from:rest-api,instance-type:m5.large,sql-version:2016,database-size:200,sql-host-name:sqldbspb9e,deployed-from:wlmdb"
}

variable "s3_endpoint_route_tables" {
  description = "The S3 endpoint route tables"
  type        = string
  default     = ""
}

variable "private_subnet1_cidrblock" {
  description = "The CIDR block for the first private subnet"
  type        = string
  default     = "10.0.16.0/20"
}

variable "private_subnet2_cidrblock" {
  description = "The CIDR block for the second private subnet"
  type        = string
  default     = ""
}

variable "encrypted_fsx_password" {
  description = "The encrypted password for FSx"
  type        = string
  default     = "Netapp123"
}

variable "ebs_volume_size" {
  description = "The size of the EBS volume"
  type        = number
  default     = 100
}

variable "s3_endpoint_exists" {
  description = "Does the S3 endpoint exist?"
  type        = bool
  default     = true
}

variable "cloudformation_endpoint_exists" {
  description = "Does the CloudFormation endpoint exist?"
  type        = bool
  default     = true
}

variable "ssm_endpoint_exists" {
  description = "Does the SSM endpoint exist?"
  type        = bool
  default     = true
}

variable "sqs_endpoint_exists" {
  description = "Does the SQS endpoint exist?"
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
  default     = "1724065163786"
}

variable "fsx_file_system_name" {
  description = "The name of the FSx file system"
  type        = string
  default     = "wlmdb-fsx-1724065163786"
}

variable "fsx_data_volume_name" {
  description = "The name of the FSx data volume"
  type        = string
  default     = "wlmdb_sqldata_1724065163786"
}

variable "fsx_data_volume_size" {
  description = "The size of the FSx data volume"
  type        = number
  default     = 225281
}

variable "fsx_log_volume_name" {
  description = "The name of the FSx log volume"
  type        = string
  default     = "wlmdb_sqllog_1724065163786"
}

variable "fsx_log_volume_size" {
  description = "The size of the FSx log volume"
  type        = number
  default     = 56321
}

variable "fsx_temp_db_volume_name" {
  description = "The name of the FSx temp DB volume"
  type        = string
  default     = "wlmdb_sqltemp_1724065163786"
}

variable "fsx_temp_db_volume_size" {
  description = "The size of the FSx temp DB volume"
  type        = number
  default     = 22529
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
  default     = "wlmdb_svm_1724065163786"
}

variable "sql_igroup_name" {
  description = "The name of the SQL igroup"
  type        = string
  default     = "wlmdb_sqligroup_1724065163786"
}

variable "sql_svm_name" {
  description = "The name of the SQL SVM"
  type        = string
  default     = "wlmdb_sqlsvm_1724065163786"
}

variable "node_net_bios_names" {
  description = "The NetBIOS names of the nodes"
  type        = string
  default     = "sqlnode-77776"
}

variable "fsx_storage_capacity" {
  description = "The storage capacity of FSx"
  type        = number
  default     = 1024
}

variable "fsx_data_lun_size" {
  description = "The size of the FSx data LUN"
  type        = number
  default     = 204800
}

variable "domain_admin_user" {
  description = "The username of the domain admin"
  type        = string
  default     = "administrator"
}

variable "fsx_admin_username" {
  description = "The username of the FSx admin"
  type        = string
  default     = "fsxadmin"
}

variable "sql_service_account_name" {
  description = "The name of the SQL service account"
  type        = string
  default     = "sqladminapg5m"
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
  default     = "Netapp123"
}

variable "fsx_volume_throughput_capacity" {
  description = "The throughput capacity of the FSx volume"
  type        = number
  default     = 128
}

variable "fsx_disk_iops" {
  description = "The IOPS of the FSx disk"
  type        = number
  default     = 3
}

variable "file_system_encryption_key_id" {
  description = "The ID of the file system encryption key"
  type        = string
  default     = "0a96542a-f57b-487c-a0fc-4db5d74c0a89"
}

variable "ontap_security_group_id" {
  description = "The ID of the ONTAP security group"
  type        = string
  default     = "sg-0e815f376e4ab473b"
}

variable "fsx_volume_snapshot_policy" {
  description = "The snapshot policy of the FSx volume"
  type        = string
  default     = "daily_weekretention"
}

variable "sql_deployment_mode" {
  description = "The deployment mode of SQL"
  type        = string
  default     = "standalone"
}

variable "sql_ami_id" {
  description = "The AMI ID of SQL"
  type        = string
  default     = "ami-0c2a40c28c6020bd8"
}

variable "sql_service_account_password" {
  description = "The password of the SQL service account"
  type        = string
  default     = "Netapp123"
}

variable "sql_collation" {
  description = "The collation of SQL"
  type        = string
  default     = "SQL_Latin1_General_CP1_CI_AS"
}

variable "sql_server_name" {
  description = "The name of the SQL server"
  type        = string
  default     = "sqldbspb9e"
}

variable "is_custom_ami" {
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

variable "notification_arn" {
  description = "The ARN for notifications"
  type        = string
  default     = ""
}

variable "enable_cloud_watch_log_feature" {
  description = "Is the CloudWatch log feature enabled?"
  type        = bool
  default     = true
}

variable "mssql_media_bucket_name" {
  description = "The name of the bucket containing the MSSQL media"
  type        = string
  default     = "LaunchWizard-sqlha"
}

variable "mssql_media_path_key" {
  description = "The path key to the MSSQL media in the bucket"
  type        = string
  default     = "launchwizardscripts/sqlmedia/sqlserver.iso"
}

variable "validation_node_initialization_s3_url" {
  description = "Value of the validaton node initialization URL"
  type        = string
}

variable "sql_node_initialization_s3_url" {
  description = "Value of the sql node initialization URL"
  type        = string
}
