variable "validation_node_vpc_id" {
  description = "The ID of the VPC"
  type        = string
}

variable "validation_node_aws_location" {
  description = "The location of the AWS"
  type        = string
}

variable "validation_node_subnet_id" {
  description = "The ID of the subnet"
  type        = string
}

variable "validation_node_dns_ip_addresses" {
  description = "The IP addresses of the DNS"
  type        = string
}

variable "validation_node_ec2_role_name" {
  description = "The name of the EC2 role"
  type        = string
}

variable "validation_node_is_custom_ami" {
  description = "Flag to indicate whether a custom AMI is used"
  type        = bool
}

variable "validation_node_key_pair_name" {
  description = "The name of the key pair"
  type        = string
}
# write variable for this with following the existing variable pattern
variable "validation_node_perform_ad_check" {
  description = "Flag to indicate whether to perform AD check"
  type        = bool
}
variable "validation_node_domain_dns_name" {
  description = "The domain DNS name"
  type        = string
}

variable "validation_node_domain_admin_user" {
  description = "The domain admin user"
  type        = string
}
variable "validation_node_perform_fsx_check" {
  description = "Flag to indicate whether to perform FSx check"
  type        = bool
}

variable "validation_node_fsx_file_system_id" {
  description = "The ID of the FSx file system"
  type        = string
}

variable "validation_node_enable_cloudwatch_log" {
  description = "Flag to indicate whether to enable CloudWatch log feature"
  type        = bool
}

variable "validation_node_deployment_name" {
  description = "The name of the parent deployment"
  type        = string
}

variable "validation_node_sql_deployment_mode" {
  description = "The deployment mode of the SQL server"
  type        = string
}

variable "validation_node_unique_id" {
  description = "The unique ID"
  type        = string
}

variable "validation_node_ami" {
  description = "The ID of the AMI"
  type        = string
}
variable "validation_node_instance_type" {
  description = "The instance type for the validation node"
  type        = string
}

# variable "validation_node_purpose_tag" {
#   description = "The purpose tag of the validation node"
#   type        = string
# }

variable "validation_node_s3_artifacts_url" {
  description = "The URL of the S3 artifacts"
  type        = string
}

variable "validation_node1_wait_handler" {
  description = "The wait handler for the validation node"
  type        = string
  default     = "test"
}

variable "validation_node_key_pair_private_key_path" {
  description = "The path to the private key of the key pair"
  type        = string
  default     = "/Users/sathish/Downloads/occm_qa.pem"
}
