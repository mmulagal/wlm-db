variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
}

variable "aws_location" {
  description = "The location of the AWS"
  type        = string
}

variable "subnet_id" { # private_subnet1_id
  description = "The ID of the subnet"
  type        = string
}

variable "dns_ip_addresses" {
  description = "The IP addresses of the DNS"
  type        = string
}

variable "ec2_role_name" { # deployment_name
  description = "The name of the EC2 role"
  type        = string
}

variable "is_custom_ami" {
  description = "Flag to indicate whether a custom AMI is used"
  type        = string
  default     = "false"
}

variable "key_pair_name" {
  description = "The name of the key pair"
  type        = string
}

variable "perform_ad_check" {
  description = "Flag to indicate whether to perform AD check"
  type        = string
}
variable "domain_dns_name" {
  description = "The domain DNS name"
  type        = string
}

variable "domain_admin_user" {
  description = "The domain admin user"
  type        = string
}

variable "preferred_domain_controller" {
  description = "(optional) Preferred domain controller to use for domain join."
  type        = string
  default     = ""
}

variable "perform_fsx_check" {
  description = "Flag to indicate whether to perform FSx check"
  type        = string
}

variable "fsx_file_system_id" {
  description = "The ID of the FSx file system"
  type        = string
}

variable "enable_cloudwatch_log_feature" {
  description = "Flag to indicate whether to enable CloudWatch log feature"
  type        = bool
}

variable "deployment_name" {
  description = "The name of the parent deployment"
  type        = string
}


variable "unique_id" {
  description = "The unique ID"
  type        = string
}

variable "ami" {
  description = "The ID of the AMI"
  type        = string
  validation {
    condition     = var.ami != ""
    error_message = "The ami variable must not be empty."
  }
}

variable "validation_node_instance_type" {
  description = "The instance type for the validation node"
  type        = string
}

variable "validation_node_initialization_s3_url" {
  description = "Value of the validaton node initialization URL"
  type        = string
}

variable "validation_node1_wait_handler" {
  description = "The wait handler for the validation node"
  type        = string
}

variable "sql_deployment_mode" {
  description = "The deployment mode of SQL"
  type        = string
}

variable "operating_system" {
  description = "Terraform host operating system"
  type        = string
}

variable "validation_node_name" {
  description = "The name of the validation node"
  type        = string
}

variable "aws_profile" {
  description = "The name of the AWS profile configured on the host"
  type        = string
}
