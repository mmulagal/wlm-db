variable "deployment_mode" {
  description = "The deployment mode for the FSx for ONTAP file system."
  type        = string
  default     = "MULTI_AZ_1"
  validation {
    condition     = contains(["MULTI_AZ_1", "SINGLE_AZ_1", "SINGLE_AZ_2"], var.deployment_mode)
    error_message = "The deployment mode must be one of MULTI_AZ_1, SINGLE_AZ_1, or SINGLE_AZ_2."
  }
}

variable "fsx_file_system_name" {
  description = "Name for the FSx for ONTAP file system."
  type        = string
  default     = "wlmdb-fsx"
}

variable "fsx_administrator_password" {
  description = "Password for the 'fsxadmin' administrator account."
  type        = string
}

variable "fsx_disk_iops" {
  description = "The total number of SSD IOPS provisioned for the file system. The maximum is 80,000 IOPS."
  type        = number
  default     = 3
  # validation {
  #   condition     = (var.fsx_disk_iops >= 0 && var.fsx_disk_iops <= 80000) || var.fsx_disk_iops == 3
  #   error_message = "The number of IOPS must be between 0 and 80,000."
  # }
}

variable "fsx_storage_capacity" {
  description = "Storage capacity of the file system. The minimum is 1024 GiB. The maximum is 192 TiB."
  type        = number
  default     = 1024
  validation {
    condition     = (var.fsx_storage_capacity >= 1024 && var.fsx_storage_capacity <= 19922944) // 192 TiB in GiB
    error_message = "The storage capacity must be between 1024 GiB and 192 TiB."
  }
}

variable "fsx_volume_throughput_capacity" {
  description = "The sustained speed, in MB/s, at which the file server hosting your file system can serve data. The file server can also burst to higher speeds for periods of time. Valid values are 128, 256, 512, 1024, 2048 and 4096 MB/s."
  type        = number
  default     = 128
  validation {
    condition     = contains([128, 256, 512, 1024, 2048, 4096], var.fsx_volume_throughput_capacity)
    error_message = "The volume throughput capacity must be one of 128, 256, 512, 1024, 2048, or 4096 MB/s."
  }
}

variable "fsx_weekly_maintenance_start_time" {
  description = "A recurring weekly maintenance start time, in the format D:HH:MM. D is the day of the week, for which 1 represents Monday and 7 represents Sunday. HH is the zero-padded hour of the day (0-23), and MM is the zero-padded minute of the hour."
  type        = string
  default     = "1:05:00"
  # validation {
  #   condition     = can(regex("^([1-7]:[0-2][0-3]:[0-5][0-9])$", var.fsx_weekly_maintenance_start_time))
  #   error_message = "The weekly maintenance start time must be in the format D:HH:MM."
  # }
}

variable "fsx_kms_key_id" {
  description = "ID of the AWS Key Management Service key that's used to encrypt the file system."
  type        = string
}

variable "fsx_svm_name" {
  description = "Storage virtual machine name"
  type        = string
  default     = "wlmdb-fsx-svm"
}

variable "fsx_data_volume_name" {
  description = "The name of the volume for SQL Server data."
  type        = string
  default     = "wlmdb_fsx_data_volume"
}

variable "fsx_data_volume_size" {
  description = "The size of the data volume in megabytes (MiB)."
  type        = number
  default     = 200
}

variable "fsx_log_volume_name" {
  description = "The name of the volume for the SQL Server log."
  type        = string
  default     = "wlmdb_fsx_log_volume"
}

variable "fsx_log_volume_size" {
  description = "The size of the log volume in megabytes (MiB)."
  type        = number
  default     = 100
}

variable "fsx_temp_db_volume_name" {
  description = "The name of the volume for the tempdb system database."
  type        = string
  default     = "wlmdb_fsx_tempdb_volume"
}

variable "fsx_temp_db_volume_size" {
  description = "Size of the tempdb volume in megabytes (MiB)."
  type        = number
  default     = 200
}

variable "fsx_cluster_quorum_volume_name" {
  description = "The name of the volume for cluster quorum."
  type        = string
  default     = "wlmdb_fsx_cluster_quorum_volume"
}

variable "fsx_cluster_quorum_volume_size" {
  description = "The size of the cluster quorum volume in megabytes (MiB)."
  type        = number
  default     = 2048
}

variable "vpc_id" {
  description = "Specify the VPC from which the file system is accessible."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR Block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(regex("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}(?:\\/([0-9]|[1-2][0-9]|3[0-2]))?$", var.vpc_cidr))
    error_message = "The VPC CIDR block must be a valid CIDR notation."
  }
}

variable "preferred_subnet_id" {
  description = "Specify the preferred subnet for your file system."
  type        = string
}

variable "standby_subnet_id" {
  description = "Specify the standby subnet for your file system."
  type        = string
  default     = "subnet-123456"
}

variable "preferred_route_table_id" {
  description = "Preferred VPC route tables to associate with your file system."
  type        = string
}

variable "standby_route_table_id" {
  description = "Standby VPC route tables to associate with your file system."
  type        = string
  default     = "rtb-123456"
}

# variable "preferred_subnet_cidrblock" {
#   description = "Cidrblock for preferred subnet."
#   type        = string
#   validation {
#     condition     = can(regex("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}(?:\\/([0-9]|[1-2][0-9]|3[0-2]))?$", var.preferred_subnet_cidrblock))
#     error_message = "The preferred subnet CIDR block must be a valid CIDR notation."
#   }
# }

# variable "standby_subnet_cidrblock" {
#   description = "Cidrblock for standby subnet."
#   type        = string
#   default     = "10.1.1.1/18"
#   validation {
#     condition     = can(regex("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}(?:\\/([0-9]|[1-2][0-9]|3[0-2]))?$", var.standby_subnet_cidrblock))
#     error_message = "The standby subnet CIDR block must be a valid CIDR notation."
#   }
# }

# variable "deployment_name" {
#   description = "Name of the parent tf provisoning."
#   type        = string
# }

variable "fsxn_volume_security_style" {
  description = "The security style of the volume."
  type        = string
  default     = "NTFS"
  validation {
    condition     = contains(["UNIX", "NTFS"], var.fsxn_volume_security_style)
    error_message = "The security style must be one of UNIX or NTFS."
  }
}

variable "notification_arns" {
  description = "The Amazon Resource Name (ARN) of the Amazon SNS topic to which you want to publish FSx for ONTAP file system backup notifications."
  type        = list(string)
  default     = []
}

variable "fsx_file_system_id" {
  description = "ID of the FSx for ONTAP file system."
  type        = string
  default     = ""
}
