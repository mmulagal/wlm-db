variable "aws_location" {
  description = "Value of the location"
  type        = string

  validation {
    condition     = length(var.aws_location) > 0
    error_message = "The aws_location value must not be empty."
  }
  validation {
    condition     = can(regex("^[a-z]{2}(-gov)?-[a-z]+-[1-9]$", var.aws_location))
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
}

variable "route_table2_id" {
  description = "The ID of the second route table"
  type        = string
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
  description = "The password of the domain admin. Can be empty when ad_ssm_parameter_arn is provided."
  type        = string
  default     = ""
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
}

variable "preferred_domain_controller" {
  description = "The preferred domain controller"
  type        = string
  default     = ""
}

variable "ou_path" {
  description = "The organizational unit path for domain join"
  type        = string
  default     = ""
}

variable "ad_group" {
  description = "The Active Directory group"
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
  default     = ""
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
  description = "The username of the domain admin. Can be empty when ad_ssm_parameter_arn is provided."
  type        = string
  default     = ""
}

variable "fsx_admin_username" {
  description = "The username of the FSx admin. Can be empty when fsx_ssm_parameter_arn is provided."
  type        = string
  default     = ""
}

variable "sql_service_account_name" {
  description = "The name of the SQL service account. Can be empty when sql_ssm_parameter_arn is provided."
  type        = string
  default     = ""
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
  description = "The password of the FSx admin. Can be empty when fsx_ssm_parameter_arn is provided."
  type        = string
  default     = ""
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


variable "ontap_security_group_id" {
  description = "The ID of the ONTAP security group"
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
  description = "The password of the SQL service account. Can be empty when is_managed_service_account is true."
  type        = string
  default     = ""
}

variable "is_managed_service_account" {
  description = "Is the SQL service account a managed service account?"
  type        = bool
  default     = false
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
variable "sql_fsx_ws_fc_name" {
  description = "Windows Server failover cluster name"
  type        = string
  default     = ""
}

variable "sql_fsx_fci_name" {
  description = "Name for the SQL Server failover cluster instance."
  type        = string
  default     = ""
}

variable "aws_profile" {
  description = "The AWS CLI profile to use for this deployment"
  type        = string
  default     = "default" # Change this profile name as per your usage
}

# GovCloud SSM Parameter ARN variables
# When provided, credentials are read from the SSM parameter instead of direct password/username variables.

variable "fsx_ssm_parameter_arn" {
  description = "ARN of a pre-created SSM parameter containing FSx credentials JSON ({username, password}). For GovCloud deployments."
  type        = string
  default     = ""

  validation {
    condition     = var.fsx_ssm_parameter_arn == "" || can(regex("^arn:aws-us-gov:ssm:us-gov-(east|west)-[1-9]:[0-9]{12}:parameter/netapp/wlmdb/.+$", var.fsx_ssm_parameter_arn))
    error_message = "fsx_ssm_parameter_arn must be a valid GovCloud SSM ARN (arn:aws-us-gov:ssm:REGION:ACCOUNT:parameter/netapp/wlmdb/...) or empty."
  }
}

variable "ad_ssm_parameter_arn" {
  description = "ARN of a pre-created SSM parameter containing AD credentials JSON ({username, password}). For GovCloud deployments."
  type        = string
  default     = ""

  validation {
    condition     = var.ad_ssm_parameter_arn == "" || can(regex("^arn:aws-us-gov:ssm:us-gov-(east|west)-[1-9]:[0-9]{12}:parameter/netapp/wlmdb/.+$", var.ad_ssm_parameter_arn))
    error_message = "ad_ssm_parameter_arn must be a valid GovCloud SSM ARN (arn:aws-us-gov:ssm:REGION:ACCOUNT:parameter/netapp/wlmdb/...) or empty."
  }
}

variable "sql_ssm_parameter_arn" {
  description = "ARN of a pre-created SSM parameter containing SQL service account credentials JSON ({username, password}). For GovCloud deployments."
  type        = string
  default     = ""

  validation {
    condition     = var.sql_ssm_parameter_arn == "" || can(regex("^arn:aws-us-gov:ssm:us-gov-(east|west)-[1-9]:[0-9]{12}:parameter/netapp/wlmdb/.+$", var.sql_ssm_parameter_arn))
    error_message = "sql_ssm_parameter_arn must be a valid GovCloud SSM ARN (arn:aws-us-gov:ssm:REGION:ACCOUNT:parameter/netapp/wlmdb/...) or empty."
  }
}
