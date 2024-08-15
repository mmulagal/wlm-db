terraform {

  #############################################################
  ## AFTER RUNNING TERRAFORM APPLY (WITH LOCAL BACKEND)
  ## YOU WILL UNCOMMENT THIS CODE THEN RERUN TERRAFORM INIT
  ## TO SWITCH FROM LOCAL BACKEND TO REMOTE AWS BACKEND
  #############################################################
  backend "s3" {
    bucket         = "sathish-tf-poc" # REPLACE WITH YOUR BUCKET NAME
    key            = "bootstrap/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "terraform-state-locking"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.25.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.5.1"
    }
  }
}

locals {
  use_aws_directory_service_ee  = var.ad_type == "AWS_MANAGED_AD" ? true : false
  new_ontap_fsx                 = var.fsx_file_system_id == "" ? true : false
  existing_ontap_fsx            = local.new_ontap_fsx ? false : true
  exclude_notification          = var.notification_arn == "" ? true : false
  include_notification          = local.exclude_notification ? false : true
  is_standalone                 = var.sql_deployment_mode == "standalone" ? true : false
  is_failover_cluster           = local.is_standalone ? false : true
  should_send_saas_notification = var.role_credentials_id == "" ? false : true
}

provider "aws" {
  region = var.aws_location

  default_tags {
    tags = {
      "creator" = var.creator_tag
    }
  }
}

# These resources used to setup the s3 and dynamo table for state locking and versioning in remote backend instead of local
resource "aws_s3_bucket" "terraform_state" {
  bucket = var.bucket_for_state # REPLACE WITH YOUR BUCKET NAME

  force_destroy = true
}

resource "aws_s3_bucket_versioning" "terraform_bucket_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_crypto_conf" {
  bucket = aws_s3_bucket.terraform_state.bucket
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = var.terraform_state_locking
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}

module "vpc-endpoints-validation" {
  source = "./modules/vpc-endpoints-validation"

  endpoints_vpc_id           = var.vpc_id
  endpoints_aws_location     = var.aws_location
  preferred_subnet_id        = var.private_subnet1_id
  preferred_subnet_cidrblock = var.private_subnet1_cidr_block

  standby_subnet_id        = var.private_subnet2_id
  standby_subnet_cidrblock = var.private_subnet2_cidr_block
  s3_endpoint_route_tables = var.s3_gateway_endpoint_route_tables

  s3_endpoint_exists              = var.is_s3_endpoint_created
  cloudformation_endpoint_exists  = var.is_cloudformation_endpoint_created
  ssm_endpoint_exists             = var.is_ssm_endpoint_created
  sqs_endpoint_exists             = var.is_sqs_endpoint_created
  cloudwatch_logs_endpoint_exists = var.is_cloudwatch_logs_endpoint_created
  fsx_endpoint_exists             = var.is_fsx_endpoint_created
  ec2_endpoint_exists             = var.is_ec2_endpoint_created
  ec2_messages_endpoint_exists    = var.is_ec2_messages_endpoint_created
  ssm_messages_endpoint_exists    = var.is_ssm_messages_endpoint_created
}

module "validation-node" {
  source = "./modules/validation-node"

  validation_node_vpc_id                = var.vpc_id
  validation_node_aws_location          = var.aws_location
  validation_node_subnet_id             = var.private_subnet1_id
  validation_node_dns_ip_addresses      = var.dns_ip_addresses
  validation_node_ec2_role_name         = var.deployment_name
  validation_node_is_custom_ami         = false
  validation_node_key_pair_name         = var.ec2_instance_keypair
  validation_node_perform_ad_check      = true
  validation_node_domain_dns_name       = var.domain_dns_name
  validation_node_domain_admin_user     = var.domain_admin_user_name
  validation_node_perform_fsx_check     = true
  validation_node_fsx_file_system_id    = var.fsx_file_system_id
  validation_node_enable_cloudwatch_log = var.enable_cloud_watch_log
  validation_node_ami                   = var.validation_ami_id
  validation_node_instance_type         = var.validation_instance_type
  validation_node_deployment_name       = var.deployment_name
  validation_node_sql_deployment_mode   = var.sql_deployment_mode
  validation_node_unique_id             = var.unique_id
  validation_node_s3_artifacts_url      = var.s3_artifacts_url
  validation_node1_wait_handler         = ""
}
