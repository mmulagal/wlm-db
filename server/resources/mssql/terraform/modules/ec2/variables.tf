variable "parent_stack_name" {
  description = "Stack name for the parent CloudFormation stack."
  type        = string
}

variable "ec2_role_name" {
  description = "EC2 instance role name."
  type        = string
  default     = "AmazonEC2RoleForLaunchWizard"
}

variable "enable_cloudwatch_log_feature" {
  description = "Enable AWS CloudWatch logging."
  type        = bool
  default     = "false"
}

variable "log_group_name" {
  description = "A name for the log group."
  type        = string
  default     = "SQLDLOG"
}

variable "unique_id" {
  description = "Automation execution unique ID."
  type        = string
  default     = "SQL123"
}

variable "ami_id" {
  description = "ID of the AMI to use."
  type        = string
  default     = "ami-06c634c2148dc0856"
}

# not used
variable "byol_ami" {
  description = "Whether the AMI is license included or bring your own license."
  type        = string
  default     = "false"
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair. All instances will launch with this key pair."
  type        = string
  validation {
    condition     = var.key_pair_name != ""
    error_message = "Key Pair must not be empty."
  }
}

variable "private_subnet_id" {
  description = "ID of private subnet in an Availability Zone 1 for the workload (For example, subnet-a0246dcd)."
  type        = string
}

variable "vpc_id" {
  description = "ID of your existing VPC for deployment."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR Block for the VPC."
  type        = string
  validation {
    condition     = can(regex("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}(?:\\/([0-9]|[1-2][0-9]|3[0-2]))?$", var.vpc_cidr))
    error_message = "The VPC CIDR block must be a valid CIDR notation."
  }
}

variable "sql_fsx_server_net_bios_name" {
  description = "NetBIOS name of the SQL Server (up to 15 characters)."
  type        = string
  default     = "SqlFSx1"
  validation {
    condition     = can(regex("[a-zA-Z0-9\\-]+", var.sql_fsx_server_net_bios_name))
    error_message = "The NetBIOS name must contain only alphanumeric characters and hyphens."
  }
}

variable "domain_admin_user" {
  description = "User name for the account that will be used as Domain Administrator. This is separate from the default 'Administrator' account."
  type        = string
  default     = "admin"
  validation {
    condition     = can(regex("([a-zA-Z0-9]+(\\.|_|-|@)*)+", var.domain_admin_user))
    error_message = "The user name must contain only alphanumeric characters, periods, underscores, hyphens, or at signs."
  }
}

variable "domain_dns_name" {
  description = "Fully qualified domain name (FQDN). For example, example.com."
  type        = string
  validation {
    condition     = can(regex("[a-zA-Z0-9\\-]+\\..+", var.domain_dns_name))
    error_message = "The domain name must be a valid FQDN."
  }
}

variable "ad_dns_ip_addresses" {
  description = "A comma separated list of DNS IP addresses."
  type        = string
}

variable "domain_member_sg_id" {
  description = "ID of the domain member security group (for example, sg-9cb7d0e5)."
  type        = string
}

variable "workload_instance_type" {
  description = "EC2 instance type for the workload instances."
  type        = string
  default     = "m5.large"
}

variable "mssql_media_bucket_name" {
  description = "The S3 bucket name from where the SQL Server media can be downloaded. This string can include numbers, lowercase letters, uppercase letters, and hyphens (-). It cannot start or end with a hyphen (-)."
  type        = string
}

variable "mssql_media_path_key" {
  description = "The S3 bucket key from where the SQL Server media can be downloaded. This string can include numbers, lowercase letters, uppercase letters, hyphens (-), and a forward slash (/)."
  type        = string
  default     = "launchwizardscripts/sqlmedia/sqlserver.iso"
}

variable "sql_admin_accounts" {
  description = "User name for the SQL Server DB service account administrator. It can be the AD domain admin or other local or domain users."
  type        = string
  default     = "sqlsa"
}
variable "number_of_nodes" {
  description = "The number of SQL Server nodes to create."
  type        = string
  default     = "1"
}

variable "route_table_id" {
  description = "Comma separated list of all route table IDs for SQL Server subnets."
  type        = string
}

variable "sql_svm_name" {
  description = "Name of the storage virtual machine (SVM) that will host the SQL Server workload."
  type        = string
  default     = "SQLVM"
}

variable "sql_igroup_name" {
  description = "igroup name for the SQL Server."
  type        = string
  default     = "SQLIQN"
}

variable "fsx_data_volume_name" {
  description = "The name of the volume for SQL Server data."
  type        = string
  default     = "SQLData"
}

variable "fsx_log_volume_name" {
  description = "The name of the volume for the SQL Server log."
  type        = string
  default     = "SQLLog"
}

variable "fsx_temp_db_volume_name" {
  description = "The name of the volume for the tempdb system database."
  type        = string
  default     = "SQLTempDb"
}

variable "fsx_data_lun_size" {
  description = "The size of the LUN for SQL data, in GB."
  type        = string
}

variable "ontap_security_group_id" {
  description = "ID of the FSx for ONTAP security group."
  type        = string
}

variable "fsx_file_system_id" {
  description = "ID for the FSx for ONTAP file system."
  type        = string
}

variable "sql_server_name" {
  description = "Name for the SQL Server."
  type        = string
}

variable "sql_collation" {
  description = "Collation for the SQL Server."
  type        = string
}

variable "fsx_volume_snapshot_policy" {
  description = "Snapshot policy for the volume. Can be either daily_weekretention or none."
  type        = string
  default     = "daily_weekretention"
  validation {
    condition     = contains(["daily_weekretention", "none"], var.fsx_volume_snapshot_policy)
    error_message = "The snapshot policy must be either 'daily_weekretention' or 'none'."
  }
}

variable "ebs_volume_size" {
  description = "Size of the EBS Volume in GiB."
  type        = number
}

variable "subnet_ids" {
  description = "IDs of the subnets"
  type        = list(string)
  default     = []
}

variable "sql_node_key_pair_private_key_path" {
  description = "The path to the private key of the key pair"
  type        = string
  default     = "/Users/sathish/Downloads/occm_qa.pem"
}

variable "sql_node_aws_location" {
  description = "The location of the AWS"
  type        = string
}

variable "sql_node_initialization_s3_url" {
  description = "The URL of the S3 initialization url"
  type        = string
}

variable "deployment_name" {
  description = "The name of the parent deployment"
  type        = string
}
