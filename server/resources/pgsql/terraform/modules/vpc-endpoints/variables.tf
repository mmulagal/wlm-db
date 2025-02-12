variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
  default     = "vpc-046f7e26255458373"
}

variable "vpc_cidr" {
  description = "CIDR block of the vpc"
  default     = "10.0.0.0/16"
}
variable "aws_profile" {
  description = "The AWS CLI profile to use for this deployment"
  type        = string
  default     = "default" # Change this profile name as per your usage
}

variable "endpoints_aws_location" {
  description = "Value of the location"
  type        = string
  default     = "ap-southeast-1"
}

variable "standby_subnet1_id" {
  description = "Specify the standby subnet for your file system."
  type        = string
}

variable "standby_subnet_cidrblock" {
  description = "Cidrblock for standby subnet."
  type        = string
}

variable "preferred_subnet1_id" {
  description = "Specify the preferred subnet for your file system."
  type        = string
}

variable "route_table1_id" {
  description = "Specify the route table for your file system."
  type        = string
}

variable "preferred_subnet_cidrblock" {
  description = "Cidrblock for preferred subnet."
  type        = string
}

variable "s3_endpoint_exists" {
  description = "Boolean to convey if an S3 endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "cloudformation_endpoint_exists" {
  description = "Boolean to convey if a Cloudwatch logs endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "sqs_endpoint_exists" {
  description = "Boolean to convey if a SQS endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "ssm_endpoint_exists" {
  description = "Boolean to convey if a SSM endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "ec2_messages_endpoint_exists" {
  description = "Boolean to convey if  EC2 messages endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "ssm_messages_endpoint_exists" {
  description = "Boolean to convey if SSM messages endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "fsx_endpoint_exists" {
  description = "Boolean to convey if a FSxN endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "cloudwatch_logs_endpoint_exists" {
  description = "Boolean to convey if a Cloudwatch logs endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "ec2_endpoint_exists" {
  description = "Boolean to convey if a EC2 endpoint exists in the vpc."
  type        = bool
  default     = false
}

variable "s3_endpoint_route_tables" {
  description = "Route table ids to attach to S3 gateway endpoint."
  type        = string
}

variable "deployment_name" {
  description = "The name of the parent deployment"
  type        = string
}
