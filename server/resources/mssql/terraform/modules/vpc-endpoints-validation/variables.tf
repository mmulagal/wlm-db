variable "endpoints_vpc_id" {
  description = "ID of the VPC"
  type        = string
  default = "vpc-046f7e26255458373"
} 

variable "endpoints_vpc_cidr" {
  description = "CIDR block of the vpc"
  default     = "10.0.0.0/16"
}

variable "endpoints_aws_location" {
  description = "Value of the location"
  type        = string
  default     = "ap-southeast-1"
}

variable preferred_subnet_id {
  description = "Specify the preferred subnet for your file system."
  type = string
}

variable preferred_subnet_cidrblock {
  description = "Cidrblock for preferred subnet."
  type = string
}

variable standby_subnet_id {
  description = "Specify the standby subnet for your file system."
  type = string
}

variable standby_subnet_cidrblock {
  description = "Cidrblock for standby subnet."
  type = string
}

variable s3_endpoint_route_tables {
  description = "Route table ids to attach to S3 gateway endpoint."
  type = string
}

variable s3_endpoint_exists {
  description = "Boolean to convey if an S3 endpoint exists in the vpc."
  type = bool
  default = false
}

variable cloudformation_endpoint_exists {
  description = "Boolean to convey if a Cloudformation endpoint exists in the vpc."
  type = bool
  default = false
}

variable ssm_endpoint_exists {
  description = "Boolean to convey if a SSM endpoint exists in the vpc."
  type = bool
  default = false
}

variable sqs_endpoint_exists {
  description = "Boolean to convey if a SQS endpoint exists in the vpc."
  type = bool
  default = false
}

variable cloudwatch_logs_endpoint_exists {
  description = "Boolean to convey if a Cloudwatch logs endpoint exists in the vpc."
  type = bool
  default = false
}

variable fsx_endpoint_exists {
  description = "Boolean to convey if a FSxN endpoint exists in the vpc."
  type = bool
  default = false
}

variable ec2_endpoint_exists {
  description = "Boolean to convey if a EC2 endpoint exists in the vpc."
  type = bool
  default = false
}

variable ec2_messages_endpoint_exists {
  description = "Boolean to convey if  EC2 messages endpoint exists in the vpc."
  type = bool
  default = false
}

variable ssm_messages_endpoint_exists {
  description = "Boolean to convey if SSM messages endpoint exists in the vpc."
  type = bool
  default = false
}