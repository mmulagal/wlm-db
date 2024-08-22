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
}

variable "key_pair_name" {
  description = "The name of the key pair"
  type        = string
}

variable "perform_ad_check" {
  description = "Flag to indicate whether to perform AD check"
  type        = bool
}
variable "domain_dns_name" {
  description = "The domain DNS name"
  type        = string
}

variable "domain_admin_user" {
  description = "The domain admin user"
  type        = string
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

variable "deployment_name" { # parent_stack_name
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
}
variable "validation_node_instance_type" {
  description = "The instance type for the validation node"
  type        = string
}

# variable "purpose_tag" {
#   description = "The purpose tag of the validation node"
#   type        = string
# }

variable "s3_artifacts_url" {
  description = "The URL of the S3 artifacts"
  type        = string
}

variable "validation_node1_wait_handler" {
  description = "The wait handler for the validation node"
  type        = string
  default     = "test"
}

variable "key_pair_private_key_path" {
  description = "The path to the private key of the key pair"
  type        = string
  default     = "/Users/sathish/Downloads/occm_qa.pem"
}

variable "verify_signature" {
  description = "signed s3 url"
  type        = string
}

variable "unzip_archive" {
  description = "signed s3 url"
  type        = string
}
variable "aws_launch_wizard_for_fcn" {
  description = "signed s3 url"
  type        = string
}
variable "validation_zip" {
  description = "signed s3 url"
  type        = string
}
variable "signing_files_zip" {
  description = "signed s3 url"
  type        = string
}

variable "open_ssl_win64_zip" {
  description = "signed s3 url"
  type        = string
}

variable "sql_deployment_mode" {
  description = "The deployment mode of SQL"
  type        = string
}
