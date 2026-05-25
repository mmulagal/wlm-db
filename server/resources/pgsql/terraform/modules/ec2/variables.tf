variable "ec2_role_name" {
  description = "EC2 instance role name."
  type        = string
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

variable "workload_instance_type" {
  description = "EC2 instance type for the workload instances."
  type        = string
}

variable "route_table_id" {
  description = "Route table id."
  type        = string
}

variable "sql_svm_name" {
  description = "Name of the storage virtual machine (SVM) that will host the SQL Server workload."
  type        = string
}

variable "fsx_data_volume_name" {
  description = "The name of the volume for SQL Server data."
  type        = string
}

variable "fsx_log_volume_name" {
  description = "The name of the volume for the SQL Server log."
  type        = string
}

variable "fsx_file_system_id" {
  description = "ID for the FSx for ONTAP file system."
  type        = string
}

variable "fsx_svm_id" {
  description = "ID of the FSx Storage Virtual Machine"
  type        = string
}

variable "fsx_svm_uuid" {
  description = "UUID of the FSx Storage Virtual Machine"
  type        = string
}

variable "fsx_aggr_name" {
  description = "Aggregate FSx for ONTAP file system."
  type        = string
}

variable "ebs_volume_size" {
  description = "Size of the EBS Volume in GiB."
  type        = number
}

variable "ami_id" {
  description = "ID of the AMI to use."
  type        = string
}

variable "sql_version" {
  description = "The version of PGSQL"
  type        = string

  validation {
    condition     = length(var.sql_version) > 0
    error_message = "The sql_version value must not be empty."
  }
}

variable "sql_fsx_server_net_bios_name" {
  description = "NetBIOS name of the SQL Server (up to 15 characters)."
  type        = string
  validation {
    condition     = can(regex("[a-zA-Z0-9\\-]+", var.sql_fsx_server_net_bios_name))
    error_message = "The NetBIOS name must contain only alphanumeric characters and hyphens."
  }
}

variable "sql_server_name" {
  description = "Name for the SQL Server."
  type        = string
}

variable "sql_service_account_password" {
  description = "The password of the SQL service account. Can be empty when credentials are resolved from SSM."
  type        = string
  default     = ""
}

variable "ontap_security_group_id" {
  description = "ID of the FSx for ONTAP security group."
  type        = string
}


variable "deployment_name" {
  description = "The name of the parent deployment"
  type        = string
}

variable "enable_cloudwatch_log_feature" {
  description = "Enable AWS CloudWatch logging."
  type        = bool
}

variable "sql_node_aws_location" {
  description = "The location of the AWS"
  type        = string
}

variable "pgsql_node_initialization_s3_url" {
  description = "The URL of the S3 initialization url"
  type        = string
}

variable "operating_system" {
  description = "Terraform host operating system"
  type        = string
}

variable "sql_node_name" {
  description = "The name of the SQL node"
  type        = string
}

variable "is_standalone" {
  description = "Whether the SQL Server is standalone or part of a failover cluster instance."
  type        = bool
}

variable "sql_fsx_server_net_bios_name_2" {
  description = "NetBIOS name 2 of the SQL Server (up to 15 characters)."
  type        = string
  default     = ""
}

variable "iam_instance_profile" {
  description = "IAM instance profile"
  type        = string
  default     = ""
}

variable "network_interface_id" {
  description = "Network interface  id"
  type        = string
  default     = ""
}

variable "aws_profile" {
  description = "The name of the AWS profile configured on the host"
  type        = string
}

variable "private_subnet2_id" {
  description = "ID of private subnet in an Availability Zone 2 for the workload (For example, subnet-a0246dcd)."
  type        = string
  default     = ""
}

variable "route_table2_id" {
  description = "Route table id for the second subnet."
  type        = string
  default     = ""
}

variable "workload_security_group_id" {
  description = "ID of the workload security group."
  type        = string
  default     = ""
}

variable "network_interface_1_id" {
  description = "Network interface 1 id"
  type        = string
  default     = ""
}

variable "network_interface_2_id" {
  description = "Network interface 2 id"
  type        = string
  default     = ""
}
