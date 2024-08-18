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

variable "s3_template_url" {
  description = "Value of the S3 Template URL"
  type        = string
}

variable "deployment_name" {
  description = "Value of the Deployment Name"
  type        = string
  default     = "wlmdb-poc"
}

# Networking configuration variables
variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
  default     = "vpc-046f7e26255458373"
}

variable "vpc_cidr" {
  description = "CIDR block of the vpc"
  default     = "10.0.0.0/16"
}

variable "private_subnet1_id" {
  description = "ID of the private subnet 1"
  type        = string
  default     = "subnet-03302cffd47acd237"
}

variable "private_subnet2_id" {
  description = "ID of the private subnet 2"
  type        = string
  default     = "subnet-0fcd4374d52d4faf0"
}

variable "private_subnet1_cidr_block" {
  description = "CIDR block for Private Subnet 1"
  type        = string
  default     = "10.0.128.0/20"
}

variable "private_subnet2_cidr_block" {
  description = "CIDR block for Private Subnet 2"
  type        = string
  default     = "10.0.128.0/20"
}

variable "route_table1_id" {
  description = "ID of the routable table 1"
  type        = string
  default     = "rtb-09a5394f5cee60073"
}

variable "route_table2_id" {
  description = "ID of the routable table 2"
  type        = string
  default     = "rtb-044539dfce91103ab"
}

variable "availability_zone1" { // not there
  description = "Availability Zone 1"
  type        = string
  default     = "ap-southeast-1a"
}

variable "availability_zone2" { // not there
  description = "Availability Zone 2"
  type        = string
  default     = "ap-southeast-1c"
}

variable "security_group_id" { // not there
  description = "ID of the Security Group"
  type        = string
  default     = "sg-06989f7dcc767bcdf"
}

# Ec2 configuration variables
variable "workload_instance_type" {
  description = "Value of the instance type"
  type        = string
  default     = "m5.large"
}
variable "ec2_instance_keypair" {
  description = "Value of the instance key pair"
  type        = string
  default     = "occm_qa"
}

# AD configuration variables
variable "ad_scenario_type" {
  description = "Value of the ad type"
  type        = string
  default     = "AWS_MANAGED_AD"
  validation {
    condition     = contains(["USER_MANAGED_AD", "AWS_MANAGED_AD"], var.ad_scenario_type)
    error_message = "The ad_scenario_type must be either USER_MANAGED_AD or AWS_MANAGED_AD."
  }
}

variable "domain_admin_user_name" {
  description = "Value of the domain admin user name"
  type        = string
  default     = "admin"
}

variable "domain_admin_password" {
  description = "Value of the domain admin password"
  type        = string
  sensitive   = true
}

variable "domain_dns_name" {
  description = "Value of the domain dns name"
  type        = string
  default     = "wlmqa2.com"
}

variable "domain_security_group_id" {
  description = "Value of the domain security group id"
  type        = string
  default     = "sg-06989f7dcc767bcdf"
}

variable "dns_ip_addresses" {
  description = "Value of the dns ip addresses"
  type        = string
  default     = "10.0.11.153,10.0.25.246"
}

variable "node_net_bios_names" {
  description = "Value of the node net bios name"
  type        = string
  default     = "sqlnode-81451"
}

#FSx configuration variables
variable "deployment_mode" {
  description = "Value of the deployment mode"
  type        = string
  default     = "SINGLE_AZ_1"

  validation {
    condition     = contains(["SINGLE_AZ_1", "MULTI_AZ_1"], var.deployment_mode)
    error_message = "The deployment mode must be either SINGLE_AZ_1 or MULTI_AZ_1."
  }
}

variable "fsx_file_system_id" {
  description = "Value of the FSx file system id"
  type        = string
}

variable "fsx_file_system_name" {
  description = "Value of the FSx file system name"
  type        = string
}

variable "fsx_data_volume_name" {
  description = "Value of the FSx data volume name"
  type        = string
}

variable "fsx_log_volume_name" {
  description = "Value of the FSx log volume name"
  type        = string
}

variable "fsx_quorum_volume_name" {
  description = "Value of the FSx quorum volume name"
  type        = string
}

variable "fsx_data_volume_size" {
  description = "Value of the FSx data volume size"
  type        = number
  default     = 1153434
}

variable "fsx_log_volume_size" {
  description = "Value of the FSx log volume size"
  type        = number
  default     = 288359
}

variable "fsx_quorum_volume_size" {
  description = "Value of the FSx quorum volume size"
  type        = number
  default     = 100
}

variable "fsx_temp_db_volume_name" {
  description = "Value of the FSx temp db volume name"
  type        = string
}

variable "fsx_temp_db_volume_size" {
  description = "Value of the FSx temp db volume size"
  type        = number
  default     = 115344
}

variable "fsx_storage_capacity" {
  description = "Value of the FSx storage capacity"
  type        = number
  default     = 1826
}

variable "fsx_data_lun_size" {
  description = "Value of the FSx data lun size"
  type        = number
  default     = 1048576
}

variable "fsx_svm_name" {
  description = "Value of the FSx SVM name"
  type        = string
  default     = "svm1"
}
variable "fsx_user_name" {
  description = "Value of the FSx user name"
  type        = string
  default     = "fsxadmin"
}

variable "fsx_password" {
  description = "Value of the FSx password"
  type        = string
  sensitive   = true
}

variable "fsx_encrypted_password" {
  description = "Value of the FSx encrypted password"
  type        = string
  sensitive   = true
}

variable "fsx_vol_throughput" {
  description = "The throughput of the FSx volume"
  type        = number
  default     = 256
}

variable "fsx_iops" {
  description = "The IOPS of the FSx volume"
  type        = string
  default     = "3"
}

variable "fsx_volume_snapshot_policy" {
  type        = string
  description = "snapshot policy for the fsx volume"
  default     = "daily_weekretention"
}

variable "fsx_encryption_key" {
  description = "The encryption key"
  type        = string
  default     = "0a96542a-f57b-487c-a0fc-4db5d74c0a89"
}

variable "ebs_volume_size" {
  description = "Value of the ebs volume size"
  type        = number
  default     = 100
}

variable "ontap_sg_id" {
  description = "The security group ID for ONTAP"
  type        = string
  default     = "sg-0e815f376e4ab473b"
}

# SQL Server configuration variables
variable "sql_deployment_mode" {
  description = "The deployment mode for SQL"
  type        = string
  default     = "standalone"
  validation {
    condition     = contains(["standalone", "fci"], var.sql_deployment_mode)
    error_message = "The sql_deployment_mode must be either 'standalone' or 'fci'."
  }
}

variable "sql_ami_id" {
  description = "The AMI ID for SQL"
  type        = string
  default     = "ami-0017fb94c6269ce73"
}

variable "sql_service_account_name" {
  description = "The name of the sql service account"
  type        = string
  default     = "sqladminapsm7"
}

variable "sql_service_account_password" {
  description = "The password of the sql service account"
  type        = string
  sensitive   = true
}

variable "sql_collation" {
  description = "The collation for SQL"
  type        = string
  default     = "SQL_Latin1_General_CP1_CI_AS"
}

variable "sql_server_name" {
  description = "The name of the SQL server"
  type        = string
  default     = "sqldbapd1o"
}

variable "sql_svm_name" {
  description = "The SVM name for SQL"
  type        = string
  default     = "sqlsvm1"
}

variable "sql_igroup_name" {
  description = "The igroup name for SQL"
  type        = string
  default     = "sqligroup1"
}

#extra params added from backend
variable "deploy_role_name" {
  description = "Value of the IAM Role"
  type        = string
  default     = "wlm-operate-permissions-role"
}

variable "validation_ami_id" {
  description = "Value of the AMI ID"
  type        = string
  default     = "ami-0dc86cd5724f1007c"
}

variable "validation_instance_type" {
  description = "Value of the instance type"
  type        = string
  default     = "t3.micro"
}

variable "account_id" {
  description = "Value of the account ID"
  type        = string
  default     = "account-aHP3esT5"
}

variable "cloud-provider-account-id" {
  description = "Value of the cloud provider account ID"
  type        = number
  default     = 464262061435
}

variable "role_credentials_id" {
  description = "Value of the role credentials ID"
  type        = string
  default     = "0c9ba7d1-3bca-4e8a-b6e3-becd91160ab8"
}

variable "wlmdb_aws_account_id" {
  description = "Value of the AWS account ID"
  type        = string
  default     = "718273455463"
}

variable "jwt_token" {
  description = "Value of the JWT Token"
  type        = string
  sensitive   = true
}

# vpc end points configuration variables
variable "is_s3_endpoint_created" {
  description = "Determines if S3 endpoint is created"
  type        = bool
  default     = true
}

variable "is_cloudformation_endpoint_created" {
  description = "Determines if CloudFormation endpoint is created"
  type        = bool
  default     = true
}

variable "is_ssm_endpoint_created" {
  description = "Determines if SSM endpoint is created"
  type        = bool
  default     = true
}

variable "is_sqs_endpoint_created" {
  description = "Determines if SQS endpoint is created"
  type        = bool
  default     = true
}

variable "is_cloudwatch_logs_endpoint_created" {
  description = "Determines if CloudWatch Logs endpoint is created"
  type        = bool
  default     = true
}

variable "is_fsx_endpoint_created" {
  description = "Determines if FSx endpoint is created"
  type        = bool
  default     = true
}

variable "is_ec2_endpoint_created" {
  description = "Determines if EC2 endpoint is created"
  type        = bool
  default     = true
}

variable "is_ec2_messages_endpoint_created" {
  description = "Determines if EC2 Messages endpoint is created"
  type        = bool
  default     = true
}

variable "is_ssm_messages_endpoint_created" {
  description = "Determines if SSM Messages endpoint is created"
  type        = bool
  default     = true
}

variable "s3_gateway_endpoint_route_tables" {
  description = "Route table ids to attach to S3 gateway endpoint."
  type        = string
}

variable "notification_arn" {
  description = "Value of the Notification ARN"
  type        = string
}

variable "s3_artifacts_url" {
  description = "Value of the S3 Artifacts URL"
  type        = string
}

variable "enable_cloud_watch_log" {
  description = "Flag to enable CloudWatch log"
  type        = bool
  default     = true
}

variable "unique_id" {
  description = "Value of the Unique ID"
  type        = number
}

variable "is_custom_ami" {
  description = "Flag to determine if custom AMI is used"
  type        = bool
  default     = false
}

variable "ms_sql_media_bucket_name" {
  description = "Value of the MS SQL Media Bucket Name"
  type        = string
  default     = "LaunchWizard-sqlha"
}

variable "ms_sql_media_path_key" {
  description = "Value of the MS SQL Media path Key"
  type        = string
  default     = "launchwizardscripts/sqlmedia/sqlserver.iso"
}

variable "perform_ad_check_node_1" {
  description = "value of the perform ad check node 1"
  type        = bool
  default     = true
}

variable "perform_ad_check_node_2" {
  description = "value of the perform ad check node 2"
  type        = bool
  default     = false
}

# variable "ec2_instance_type" {
#   description = "Value of the instance type"
#   type        = string
# }

# variable "ec2_instance_keypair" {
#   description = "Value of the instance key pair"
#   type        = string
# }

# variable "fsxn_password" {
#   description = "Default Password"
#   type        = string
#   sensitive   = true
# }

# variable "volume_security_style" {
#   description = "Default Volume Security Style"
#   type        = string
#   default     = "NTFS"
# }

# variable "vpc_cidr" {
#   description = "CIDR block of the vpc"
#   default     = "10.0.0.0/16"
# }

# variable "public_subnets_cidr" {
#   type        = list(any)
#   description = "CIDR block for Public Subnet"
#   default     = ["10.0.0.0/20", "10.0.16.0/20"]
# }

# variable "private_subnets_cidr" {
#   type        = list(any)
#   description = "CIDR block for Private Subnet"
#   default     = ["10.0.128.0/20", "10.0.144.0/20"]
# }

# variable "availability_zones" {
#   type        = list(any)
#   description = "AZ in which all the resources will be deployed"
#   default     = ["ap-southeast-1a", "ap-southeast-1b"]
# }
