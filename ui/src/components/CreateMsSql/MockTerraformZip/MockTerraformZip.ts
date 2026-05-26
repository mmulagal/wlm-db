import JSZip from 'jszip';

export const downloadTerraformZip = (deploymentModel?: string, from = 'mssql') => {
    // Create a new instance of JSZip
    const zip = new JSZip();

    // Add files to the ZIP
    zip.file(
        'iam_policy.tf',
        `resource "aws_iam_role_policy" "ec2_iam_role_policy" {
  name = "\${var.deployment_name}_WLMDB_Policy_1"
  role = aws_iam_role.ec2_iam_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchDeploymentStatement"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricAlarm",
          "cloudwatch:DeleteAlarms",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:List*",
          "cloudwatch:Get*",
          "cloudwatch:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudLogDeploymentCreateStatement"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:CreateLogGroup",
          "logs:GetLogEvents",
          "logs:GetLogDelivery",
          "logs:GetLogRecord",
          "logs:ListLogDeliveries",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents",
          "logs:TagResource"
        ]
        Resource = "*"
      },
      {
        Sid    = "STSStatement"
        Effect = "Allow"
        Action = [
          "sts:GetCallerIdentity"
        ]
        Resource = "*"
      },
      {
        Sid    = "IAMStatement"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:GetPolicy",
          "iam:GetRolePolicy",
          "iam:PassRole",
          "iam:GetUser",
          "iam:GetPolicyVersion"
        ]
        Resource = "*"
      },
      {
        Sid    = "SSMListStatement"
        Effect = "Allow"
        Action = [
          "ssm:DescribeAssociation",
          "ssm:GetDeployablePatchSnapshotForInstance",
          "ssm:GetDocument",
          "ssm:DescribeDocument",
          "ssm:GetManifest",
          "ssm:ListAssociations",
          "ssm:ListInstanceAssociations",
          "ssm:GetCommandInvocation",
          "ec2messages:GetEndpoint",
          "ec2messages:GetMessages"
        ]
        Resource = "*"
      },
      {
        Sid    = "SSMCreateStatement"
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
          "ssm:PutInventory",
          "ssm:PutComplianceItems",
          "ssm:PutConfigurePackageResult",
          "ssm:UpdateAssociationStatus",
          "ssm:UpdateInstanceAssociationStatus",
          "ssm:UpdateInstanceInformation",
          "ssm:SendCommand"
        ]
        Resource = "*"
      },
      {
        Sid    = "EC2MessagesStatement"
        Effect = "Allow"
        Action = [
          "ec2messages:AcknowledgeMessage",
          "ec2messages:DeleteMessage",
          "ec2messages:FailMessage",
          "ec2messages:SendReply"
        ]
        Resource = "*"
      },
      {
        Sid    = "FsxStatement"
        Effect = "Allow"
        Action = [
          "fsx:DescribeFileSystems",
          "fsx:DescribeVolumes",
          "fsx:DescribeStorageVirtualMachines"
        ]
        Resource = "*"
      },
      {
        Sid    = "EC2Statement"
        Effect = "Allow"
        Action = [
          "ec2:Get*",
          "ec2:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "EC2TaggingStatement"
        Effect = "Allow"
        Action = [
          "ec2:CreateTags",
          "ec2:AuthorizeSecurityGroupIngress"
        ]
        Resource = "*"
      },
      {
        Sid    = "SSMGetPutParameter"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:PutParameter",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:*:*:parameter/netapp/wlmdb/*"
      }
    ]
  })
}


`
    );
    zip.file(
        'iam_role.tf',
        `resource "aws_iam_role" "ec2_iam_role" {
  name = var.deployment_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Effect = "Allow"
      }
    ]
  })
  path = "/"
  tags = {
    tag-key = var.creator_tag
  }
}`
    );
    zip.file(
        'main.tf',
        `terraform {
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
  new_ontap_fsx                 = var.fsx_file_system_id == "" ? true : false
  existing_ontap_fsx            = local.new_ontap_fsx ? false : true
  is_standalone                 = var.sql_deployment_mode == "standalone" ? true : false
  is_failover_cluster           = local.is_standalone ? false : true
  fsx_is_single_zone_deployment = var.deployment_mode == "SINGLE_AZ_1" ? true : false
}

provider "aws" {
  region = var.aws_location

  default_tags {
    tags = {
      "creator" = var.creator_tag
    }
  }
}

module "vpc-endpoints" {
  source = "./modules/vpc-endpoints"

  vpc_id                     = var.vpc_id
  endpoints_aws_location     = var.aws_location
  preferred_subnet1_id       = var.private_subnet1_id
  preferred_subnet_cidrblock = var.private_subnet1_cidrblock

  standby_subnet1_id       = local.is_failover_cluster ? var.private_subnet2_id : ""
  standby_subnet_cidrblock = local.is_failover_cluster ? var.private_subnet2_cidrblock : ""
  s3_endpoint_route_tables = var.s3_endpoint_route_tables

  s3_endpoint_exists              = var.s3_endpoint_exists
  ssm_endpoint_exists             = var.ssm_endpoint_exists
  cloudwatch_logs_endpoint_exists = var.cloudwatch_logs_endpoint_exists
  fsx_endpoint_exists             = var.fsx_endpoint_exists
  ec2_endpoint_exists             = var.ec2_endpoint_exists
  ec2_messages_endpoint_exists    = var.ec2_messages_endpoint_exists
  ssm_messages_endpoint_exists    = var.ssm_messages_endpoint_exists
}

module "validation-node" {
  source = "./modules/validation-node"

  depends_on = [aws_iam_role.ec2_iam_role, aws_iam_role_policy.ec2_iam_role_policy, aws_ssm_parameter.credentials_ssm_parameter, module.vpc-endpoints]

  vpc_id                                = var.vpc_id
  aws_location                          = var.aws_location
  subnet_id                             = var.private_subnet1_id
  dns_ip_addresses                      = var.dns_ip_addresses
  ec2_role_name                         = var.deployment_name
  is_custom_ami                         = var.is_custom_ami
  key_pair_name                         = var.key_pair_name
  perform_ad_check                      = true
  domain_dns_name                       = var.domain_dns_name
  domain_admin_user                     = var.domain_admin_user
  perform_fsx_check                     = local.existing_ontap_fsx ? "true" : "false"
  fsx_file_system_id                    = local.existing_ontap_fsx ? var.fsx_file_system_id : ""
  enable_cloudwatch_log_feature         = var.enable_cloud_watch_log_feature
  ami                                   = var.validation_ami
  validation_node_instance_type         = var.validation_node_instance_type
  deployment_name                       = var.deployment_name
  unique_id                             = var.unique_id
  validation_node_initialization_s3_url = var.validation_node_initialization_s3_url
  validation_node1_wait_handler         = "wait"
  sql_deployment_mode                   = var.sql_deployment_mode
}

module "fsxn" {
  source = "./modules/fsxn"

  depends_on                     = [module.vpc-endpoints, module.validation-node]
  fsx_file_system_id             = var.fsx_file_system_id // set this id to provision using existing fsx
  deployment_mode                = var.deployment_mode
  vpc_id                         = var.vpc_id
  vpc_cidr                       = var.vpc_cidr
  preferred_subnet_id            = var.private_subnet1_id
  standby_subnet_id              = var.private_subnet2_id
  preferred_route_table_id       = var.route_table1_id
  standby_route_table_id         = var.route_table2_id
  fsx_file_system_name           = var.fsx_file_system_name
  fsx_storage_capacity           = var.fsx_storage_capacity
  fsx_volume_throughput_capacity = var.fsx_volume_throughput_capacity
  fsx_disk_iops                  = var.fsx_disk_iops

  fsx_kms_key_id                    = var.fsx_encryption_key # its kms key for fsx
  fsx_data_volume_name              = var.fsx_data_volume_name
  fsx_data_volume_size              = var.fsx_data_volume_size
  fsx_log_volume_name               = var.fsx_log_volume_name
  fsx_log_volume_size               = var.fsx_log_volume_size
  fsx_temp_db_volume_name           = var.fsx_temp_db_volume_name
  fsx_temp_db_volume_size           = var.fsx_temp_db_volume_size
  fsx_cluster_quorum_volume_name    = var.fsx_quorum_volume_name
  fsx_cluster_quorum_volume_size    = var.fsx_quorum_volume_size
  fsx_administrator_password        = var.fsx_admin_password
  fsx_svm_name                      = var.sql_svm_name
  fsx_weekly_maintenance_start_time = "1:05:00"
}

module "ec2" {
  source = "./modules/ec2"

  depends_on                    = [module.vpc-endpoints, module.validation-node, module.fsxn]
  ec2_role_name                 = var.deployment_name
  enable_cloudwatch_log_feature = var.enable_cloud_watch_log_feature
  unique_id                     = var.unique_id
  ami_id                        = var.sql_ami_id
  byol_ami                      = var.is_custom_ami
  key_pair_name                 = var.key_pair_name
  private_subnet_id             = var.private_subnet1_id

  vpc_id                     = var.vpc_id
  vpc_cidr                   = var.vpc_cidr
  deployment_name            = var.deployment_name
  sql_server_name            = var.sql_server_name
  sql_svm_name               = var.sql_svm_name
  fsx_data_volume_name       = var.fsx_data_volume_name
  fsx_log_volume_name        = var.fsx_log_volume_name
  fsx_file_system_id         = local.existing_ontap_fsx ? var.fsx_file_system_id : module.fsxn.fsx_fs_logical_id // may be the output of the fsx if its new
  fsx_temp_db_volume_name    = var.fsx_temp_db_volume_name
  fsx_data_lun_size          = tostring(var.fsx_data_lun_size)
  sql_igroup_name            = var.sql_igroup_name
  fsx_volume_snapshot_policy = var.fsx_volume_snapshot_policy
  ad_dns_ip_addresses        = element(split(",", var.dns_ip_addresses), 0)
  domain_dns_name            = var.domain_dns_name
  domain_admin_user          = var.domain_admin_user
  sql_admin_accounts         = var.sql_service_account_name
  sql_collation              = var.sql_collation

  sql_node_initialization_s3_url = var.sql_node_initialization_s3_url
  sql_node_aws_location          = var.aws_location
  route_table_id                 = var.route_table1_id
  ebs_volume_size                = var.ebs_volume_size
  domain_member_sg_id            = var.domain_member_sg_id
  ontap_security_group_id        = var.ontap_security_group_id
  mssql_media_bucket_name        = var.mssql_media_bucket_name
  sql_fsx_server_net_bios_name   = element(split(",", var.node_net_bios_names), 0)
  workload_instance_type         = var.workload_instance_type
}
`
    );
    zip.file(
        'outputs.tf',
        `output "credentials_ssm_parameter_name" {
  value = aws_ssm_parameter.credentials_ssm_parameter.name
}

output "credentials_ssm_parameter_description" {
  value = aws_ssm_parameter.credentials_ssm_parameter.description
}

output "credentials_ssm_parameter_value" {
  value     = aws_ssm_parameter.credentials_ssm_parameter.value
  sensitive = true
}

output "credentials_ssm_parameter_tags" {
  value = aws_ssm_parameter.credentials_ssm_parameter.tags
}

output "role_name" {
  value = aws_iam_role.ec2_iam_role.name
}

output "role_id" {
  value = aws_iam_role.ec2_iam_role.id
}

# Output policy name and policy ID
output "policy_name" {
  value = aws_iam_role_policy.ec2_iam_role_policy.name
}

output "policy_id" {
  value = aws_iam_role_policy.ec2_iam_role_policy.id
}


# output of sql node
output "sql_node_instance_id" {
  description = "The ID of the SQL node instance"
  value       = module.ec2.sql_node_instance_id
}

output "sql_node_instance_name" {
  description = "The name of the SQL node instance"
  value       = module.ec2.sql_node_instance_name
}

output "sql_node_private_ip" {
  description = "The private IP address of the SQL node instance"
  value       = module.ec2.sql_node_private_ip
}

output "sql_workload_security_group_id" {
  description = "The ID of the workload security group"
  value       = module.ec2.sql_workload_security_group_id
}

output "sql_workload_security_group_arn" {
  description = "The ARN of the workload security group"
  value       = module.ec2.sql_workload_security_group_arn
}

# output of fsx node
output "fsx_fs_logical_id" {
  description = "Logical ID of the FSx for ONTAP file system"
  value       = module.fsxn.fsx_fs_logical_id
}

output "fsx_svm_logical_id" {
  description = "Logical ID of the storage virtual machine"
  value       = module.fsxn.fsx_svm_logical_id
}

# output of validation node
output "validation_instance_id" {
  description = "The ID of the validation node instance"
  value       = module.validation-node.instance_id
}

output "validation_instance_public_ip" {
  description = "The public IP of the validation node instance"
  value       = module.validation-node.instance_public_ip
}

output "validation_instance_private_ip" {
  description = "The private IP of the validation node instance"
  value       = module.validation-node.instance_private_ip
}

output "validation_instance_state" {
  description = "The state of the validation node instance"
  value       = module.validation-node.instance_state
}

output "validation_instance_name" {
  description = "The name of the validation instance"
  value       = module.validation-node.instance_name
}
`
    );
    zip.file(
        'README.md',
        `# Terraform Project

# Deploy an SQL Server on EC2 with Amazon FSx for NetApp ONTAP

The Terraform deployment will create a Single-AZ Amazon FSx for NetApp ONTAP filesystem, create three LUN's on FSxN volume, deploy EC2 instance with SQL Server 2016,2019 or 2022 Standard and attach the FSxN LUN's as **SQL Data** and **SQL Log** and **SQL TEMP** volumes.

## Prerequisites

-   Terraform v1.9.5 or later
-   AWS account
-   AWS CLI configured with your account

## Installation

### Windows

1. Download the appropriate package for your system from the [Terraform downloads page](https://www.terraform.io/downloads.html).

2. Unzip the downloaded file to a location where you want to store the Terraform binary. For example, you might create a directory named \`terraform\` in your \`C:\` drive.

3. Add the directory containing the Terraform binary to your system's PATH environment variable. You can do this by searching for "Environment Variables" in your computer's settings.

### Mac

1. If you have Homebrew installed, you can install Terraform by running:

brew install terraform

If you don't have Homebrew, you can download the appropriate package for your system from the Terraform downloads page and move the Terraform binary to /usr/local/bin/.

## Variables

The following variables need to be set in the \`terraform.tfvars\` file:

-   \`instance_type\`: The type of instance to use (e.g., "t2.micro")

## Initial Setup And Usage

1. Initialize Terraform:
   terraform init

2. Create a terraform.tfvars file and fill in the necessary variables.
3. Plan the deployment:
   terraform plan
4. Apply the changes:
   terraform apply
5. Destroy the deployment: (Please use this carefully this will delete all the infrastructure created via terraform)
   terraform destroy
`
    );
    zip.file(
        'ssm_parameter.tf',
        `resource "aws_ssm_parameter" "credentials_ssm_parameter" {
  name        = "/netapp/wlmdb/\${var.deployment_name}"
  description = "SSM Parameter for active directory, FSxN and SQL service account credentials"
  type        = "SecureString"
  value       = <<EOF
{
  "fsx": {
    "username": "\${var.fsx_admin_username}",
    "password": "\${var.fsx_admin_password}"
  },
  "domain": {
    "username": "\${var.domain_admin_user}",
    "password": "\${var.domain_admin_password}"
  },
  "sql": [{
    "username": "\${var.sql_service_account_name}",
    "password": "\${var.sql_service_account_password}",
    "sqlinstancename": "MSSQL"
  }]
}
EOF

  tags = {
    creator = var.creator_tag
  }

  lifecycle {
    create_before_destroy = true
  }
}
`
    );
    zip.file(
        'terraform.sample.tfvars',
        `aws_location    = "ap-southeast-1"
creator_tag     = "wlmdb-poc-terraform"
deployment_name = "wlmdb-poc-terraform-SqlStandalone-deployment"

vpc_id                = "vpc-046f7e26255458373"
vpc_cidr              = "10.0.0.0/16"
private_subnet1_id    = "subnet-03302cffd47acd237"
route_table1_id       = "rtb-09a5394f5cee60073"
private_subnet2_id    = "" # subnet-03302cffd47acd237
route_table2_id       = "" #rtb-09a5394f5cee60073
ad_scenario_type      = "AWS_MANAGED_AD"
domain_admin_user     = "admin" #domain_admin_user_name
domain_admin_password = "Collector@123"
domain_dns_name       = "wlmqa2.com"
dns_ip_addresses      = "10.0.140.140,10.0.29.45"
domain_member_sg_id   = "sg-0e4f106bcf2831cba" # domain_security_group_id sg-0e4f106bcf2831cba

tf_deploy_role_name           = "wlm-operate-permissions-role" # deploy_role_name
validation_ami                = "ami-0a27cc0b164d66785"        # validation_ami_id #ami-07b4b6e7643cb29ed
validation_node_instance_type = "t2.micro"                     # t2.micro change it later
account_id                    = "account-aHP3esT5"
cloud_provider_account_id     = 464262061435
role_credentials_id           = "0c9ba7d1-3bca-4e8a-b6e3-becd91160ab8"
wlmdb_aws_account_id          = 464262061435 # number
metrics                       = "triggered-from:rest-api,instance-type:m5.large,sql-version:2016,database-size:200,sql-host-name:sqldbspb9e,deployed-from:wlmdb"

s3_endpoint_route_tables        = ""              # s3_gateway_endpoint_route_tables
private_subnet1_cidrblock       = "10.0.128.0/20" # private_subnet1_cidr_block
private_subnet2_cidrblock       = ""              #private_subnet2_cidr_block
encrypted_fsx_password          = "Netapp123"     # fsx_encrypted_password
ebs_volume_size                 = 100             # number
s3_endpoint_exists              = true            # is_s3_endpoint_created
ssm_endpoint_exists             = true            # is_ssm_endpoint_created
cloudwatch_logs_endpoint_exists = true            # is_cloudwatch_logs_endpoint_created
fsx_endpoint_exists             = true            # is_fsx_endpoint_created
ec2_endpoint_exists             = true            # is_ec2_endpoint_created
ec2_messages_endpoint_exists    = true            # is_ec2_messages_endpoint_created
ssm_messages_endpoint_exists    = true            # is_ssm_messages_endpoint_created

unique_id               = "1725147482401"
fsx_file_system_name    = "wlmdb-fsx-tf-1723065263786"
fsx_data_volume_name    = "wlmdb_sqldata_1724065163786"
fsx_data_volume_size    = 225281 # number
fsx_log_volume_name     = "wlmdb_sqllog_1724065163786"
fsx_log_volume_size     = 56321 # number
fsx_temp_db_volume_name = "wlmdb_sqltemp_1724065163786"
fsx_temp_db_volume_size = 22529 # number
fsx_svm_name            = "wlmdb_svm_1724065163786"

sql_igroup_name          = "wlmdb_sqligroup_1724065163786"
sql_svm_name             = "wlmdb_sqlsvm_1724065163786"
node_net_bios_names      = "sqlnode-tf-sathish"
fsx_storage_capacity     = 1024            # number
fsx_data_lun_size        = 204800          # number
fsx_admin_username       = "fsxadmin"      #fsx_user_name
sql_service_account_name = "sqladminmvs9m" # change every time

deployment_mode                = "SINGLE_AZ_1"
fsx_file_system_id             = ""          # can have value if its existing
fsx_admin_password             = "Netapp123" #fsx_password
fsx_volume_throughput_capacity = 128         # number  fsx_vol_throughput
fsx_disk_iops                  = 3           # number fsx_iops
file_system_encryption_key_id  = "0a96542a-f57b-487c-a0fc-4db5d74c0a89"
ontap_security_group_id        = "sg-05f4939d6670b405f"
fsx_volume_snapshot_policy     = "daily_weekretention"
sql_deployment_mode            = "standalone"
sql_ami_id                     = "ami-0017fb94c6269ce73"
sql_service_account_password   = "Netapp123"
sql_collation                  = "SQL_Latin1_General_CP1_CI_AS"
sql_server_name                = "sqldcged5e" # change every time


is_custom_ami                  = "false"
workload_instance_type         = "m5.large"
key_pair_name                  = "occm_qa" # ec2_instance_keypair
enable_cloud_watch_log_feature = true      # enable_cloud_watch_log
mssql_media_bucket_name        = "LaunchWizard-sqlha"
mssql_media_path_key           = "launchwizardscripts/sqlmedia/sqlserver.iso"

validation_node_initialization_s3_url = ""
sql_node_initialization_s3_url        = ""
fsx_encryption_key                    = ""
# for fci fsx
fsx_quorum_volume_name = "wlmdb-quorum"
fsx_quorum_volume_size = 100 #number

`
    );

    zip.file(
        'terraform.tfvars',
        `tf_deploy_role_name = ""
validation_ami = ""
validation_node_instance_type = "t2.micro"
account_id = "account-i6vJXvZW"
cloud_provider_account_id = ""
wlmdb_aws_account_id = "718273455463"
s3_endpoint_route_tables = ""
private_subnet1_cidrblock = ""
private_subnet2_cidrblock = ""
ebs_volume_size = 100
s3_endpoint_exists = true
ssm_endpoint_exists = true
cloudwatch_logs_endpoint_exists = true
fsx_endpoint_exists = true
ec2_endpoint_exists = true
ec2_messages_endpoint_exists = true
ssm_messages_endpoint_exists = true
unique_id = "1727282094403"
fsx_file_system_name = "wlmdb-fsx-1727282094403"
fsx_data_volume_name = "wlmdb_sqldata_1727282094403"
fsx_data_volume_size = 1153434
fsx_log_volume_name = "wlmdb_sqllog_1727282094403"
fsx_log_volume_size = 288359
fsx_temp_db_volume_name = "wlmdb_sqltemp_1727282094403"
fsx_temp_db_volume_size = 115344
fsx_svm_name = "wlmdb_svm_1727282094403"
sql_igroup_name = "wlmdb_sqligroup_1727282094403"
sql_svm_name = "wlmdb_sqlsvm_1727282094403"
node_net_bios_names = "sqlnode1-48197%2Csqlnode2-48197"
fsx_storage_capacity = 1840
fsx_data_lun_size = 1048576
fsx_quorum_volume_name = "wlmdb_quorum_1727282094403"
fsx_quorum_volume_size = 12000
domain_admin_user = ""
fsx_admin_username = "fsxadmin"
sql_service_account_name = "sqlsa"
vpc_id = ""
vpc_cidr = ""
private_subnet1_id = ""
route_table1_id = ""
ad_scenario_type = "AWS_MANAGED_AD"
domain_admin_password = ""
domain_dns_name = ""
dns_ip_addresses = ""
domain_member_sg_id = ""
deployment_mode = "MULTI_AZ_1"
fsx_file_system_id = ""
fsx_admin_password = ""
ontap_security_group_id = ""
fsx_volume_throughput_capacity = 128
fsx_disk_iops = 3
file_system_encryption_key_id = ""
fsx_volume_snapshot_policy = "daily_weekretention"
sql_deployment_mode = "fci"
is_custom_ami = false
sql_ami_id = ""
sql_service_account_password = ""
sql_collation = "SQL_Latin1_General_CP1_CI_AS"
sql_server_name = "sqldatabasecm0u"
workload_instance_type = ""
key_pair_name = ""
enable_cloud_watch_log_feature = true
private_subnet2_id = ""
route_table2_id = ""
mssql_media_bucket_name = "LaunchWizard-sqlha"
mssql_media_path_key = "launchwizardscripts%2Fsqlmedia%2Fsqlserver.iso"
validation_node_initialization_s3_url = "https://staging-templates-workloads-netapp-com.s3.us-east-1.amazonaws.com/wlmdb/WLMDB-SqlFciStack-1727282094403/terraform/validation/Validation-Instance-initializer.ps1?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240925%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240925T163454Z&X-Amz-Expires=604800&X-Amz-Signature=19a42fa1ce355c7b4709d647ae96ee83448abc637a6d2335dcbd45082260670e&X-Amz-SignedHeaders=host&x-id=GetObject"
sql_node_initialization_s3_url = "https://staging-templates-workloads-netapp-com.s3.us-east-1.amazonaws.com/wlmdb/WLMDB-SqlFciStack-1727282094403/terraform/standalone/Sql-Instance-initializer.ps1?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240925%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240925T163454Z&X-Amz-Expires=604800&X-Amz-Signature=36a386f4c70b493aeb1bdb731af5bd54a748c81ffa22335e1d6b4da7abd40075&X-Amz-SignedHeaders=host&x-id=GetObject"
aws_location = "us-east-1"
creator_tag = "WLMDB-SqlFciStack-1727282094403"
deployment_name = "WLMDB-SqlFciStack-1727282094403"
role_credentials_id = ""
metrics = "triggered-from:rest-api,deployed-from:cloudformation,instance-type:,sql-version:,database-size:1024,sql-host-name:sqldatabasecm0u"
fsx_encryption_key = ""
`
    );

    zip.file(
        'variables.tf',
        `variable "aws_location" {
  description = "Value of the location"
  type        = string

  validation {
    condition     = length(var.aws_location) > 0
    error_message = "The aws_location value must not be empty."
  }
  validation {
    condition     = can(regex("[a-z][a-z]-[a-z]+-[1-9]", var.aws_location))
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

  validation {
    condition     = var.sql_deployment_mode != "standalone" ? length(var.private_subnet2_id) > 0 : true
    error_message = "The private_subnet2_id value must not be empty when sql_deployment_mode is FCI."
  }
}

variable "route_table2_id" {
  description = "The ID of the second route table"
  type        = string

  validation {
    condition     = var.sql_deployment_mode != "standalone" ? length(var.route_table2_id) > 0 : true
    error_message = "The route_table2_id value must not be empty when sql_deployment_mode is FCI."
  }
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
  description = "The password of the domain admin"
  type        = string
  validation {
    condition     = length(var.domain_admin_password) > 0
    error_message = "The domain_admin_password variable must not be empty."
  }
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

  validation {
    condition     = length(var.domain_member_sg_id) > 0
    error_message = "The domain_member_sg_id value must not be empty."
  }
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

variable "metrics" {
  description = "The metrics"
  type        = string
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

variable "encrypted_fsx_password" {
  description = "The encrypted password for FSx"
  type        = string
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

  validation {
    condition     = length(var.fsx_file_system_name) > 0
    error_message = "The fsx_file_system_name value must not be empty."
  }
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

  validation {
    condition     = var.sql_deployment_mode == "standalone" || length(var.fsx_quorum_volume_name) > 0
    error_message = "The fsx_quorum_volume_name value must not be empty when sql_deployment_mode is not standalone."
  }
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
  description = "The username of the domain admin"
  type        = string

  validation {
    condition     = length(var.domain_admin_user) > 0
    error_message = "The domain_admin_user value must not be empty."
  }
}

variable "fsx_admin_username" {
  description = "The username of the FSx admin"
  type        = string

  validation {
    condition     = length(var.fsx_admin_username) > 0
    error_message = "The fsx_admin_username value must not be empty."
  }
}

variable "sql_service_account_name" {
  description = "The name of the SQL service account"
  type        = string

  validation {
    condition     = length(var.sql_service_account_name) > 0
    error_message = "The sql_service_account_name value must not be empty."
  }
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
  description = "The password of the FSx admin"
  type        = string

  validation {
    condition     = length(var.fsx_admin_password) > 0
    error_message = "The fsx_admin_password value must not be empty."
  }
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

variable "file_system_encryption_key_id" {
  description = "The ID of the file system encryption key"
  type        = string
}

variable "ontap_security_group_id" {
  description = "The ID of the ONTAP security group. Comma-separated list of security group IDs is supported."
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
  description = "The password of the SQL service account"
  type        = string

  validation {
    condition     = length(var.sql_service_account_password) > 0
    error_message = "The sql_service_account_password value must not be empty."
  }
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
`
    );

    zip.folder('modules');

    // Generate the ZIP file
    zip.generateAsync({ type: 'blob' }).then(content => {
        // Create an anchor element
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);

        if (from === 'pgsql') {
            // Set the download attribute with a default file name
            link.download = `TF-WLMDB-Pgsql${deploymentModel === 'fci' ? 'Ha' : 'Standalone'}-${new Date().getTime()}`;
        } else {
            // Set the download attribute with a default file name
            link.download = `TF-WLMDB-Sql${deploymentModel === 'fci' ? 'Fci' : 'Standalone'}-${new Date().getTime()}`;
        }

        // Append the anchor to the body
        document.body.appendChild(link);

        // Programmatically click the anchor to trigger the download
        link.click();

        // Remove the anchor from the document
        document.body.removeChild(link);
    });
};
