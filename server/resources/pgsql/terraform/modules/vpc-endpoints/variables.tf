variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block of the vpc"
}
variable "aws_profile" {
  description = "The AWS CLI profile to use for this deployment"
  type        = string
}

variable "endpoints_aws_location" {
  description = "Value of the location"
  type        = string
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
}

variable "ssm_endpoint_exists" {
  description = "Boolean to convey if a SSM endpoint exists in the vpc."
  type        = bool
}

variable "ec2_messages_endpoint_exists" {
  description = "Boolean to convey if  EC2 messages endpoint exists in the vpc."
  type        = bool
}

variable "ssm_messages_endpoint_exists" {
  description = "Boolean to convey if SSM messages endpoint exists in the vpc."
  type        = bool
}

variable "fsx_endpoint_exists" {
  description = "Boolean to convey if a FSxN endpoint exists in the vpc."
  type        = bool
}

variable "cloudwatch_logs_endpoint_exists" {
  description = "Boolean to convey if a Cloudwatch logs endpoint exists in the vpc."
  type        = bool
}

variable "ec2_endpoint_exists" {
  description = "Boolean to convey if a EC2 endpoint exists in the vpc."
  type        = bool
}

variable "s3_endpoint_route_tables" {
  description = "Route table ids to attach to S3 gateway endpoint."
  type        = string
}

variable "deployment_name" {
  description = "The name of the parent deployment"
  type        = string
}
