# aws provider configuration
aws_location            = "ap-southeast-1"
creator_tag             = "wlmdb-poc-sathish-terraform"
bucket_for_state        = "sathish-tf-poc"
terraform_state_locking = "terraform-state-locking"

#aws
account_id                = "account-aHP3esT5"
cloud-provider-account-id = 464262061435

#networking configuration variables
vpc_id             = "vpc-046f7e26255458373"
vpc_cidr           = "10.0.0.0/16"
private_subnet1_id = "subnet-03302cffd47acd237"
private_subnet2_id = "subnet-0fcd4374d52d4faf0"
route_table1_id    = "rtb-09a5394f5cee60073"
route_table2_id    = "rtb-044539dfce91103ab"
availability_zone1 = "ap-southeast-1a"
availability_zone2 = "ap-southeast-1c"
security_group_id  = "sg-06989f7dcc767bcdf"

#ec2 configuration variables
workload_instance_type = "m5.large"
ec2_instance_keypair   = "occm_qa"

#ad configuration variables
ad_scenario_type         = "AWS_MANAGED_AD"
domain_admin_user_name   = "admin"
domain_admin_password    = "Collector@123" # replace with your actual password
domain_dns_name          = "wlmqa2.com"
domain_security_group_id = "sg-06989f7dcc767bcdf"
dns_ip_addresses         = "10.0.11.153,10.0.25.246"

deployment_mode = "SINGLE_AZ_1"
ebs_volume_size = 100
is_custom_ami   = false

#fsx configuration variables
fsx_file_system_id         = "fs-0011587aebf65b1d4" # replace with your actual file system id
fsx_file_system_name       = "wlmdb-fsx-1723505901110"
fsx_data_volume_name       = "wlmdb-fsx-data-1723505901110"
fsx_log_volume_name        = "wlmdb-fsx-log-1723505901110"
fsx_temp_db_volume_name    = "wlmdb-fsx-tempdb-1723505901110"
fsx_data_volume_size       = 1153434
fsx_log_volume_size        = 288359
fsx_temp_db_volume_size    = 115344
fsx_quorum_volume_name     = "wlmdb-quorum"
fsx_quorum_volume_size     = 100
fsx_storage_capacity       = 1826
fsx_data_lun_size          = 1048576
fsx_svm_name               = "wlmdb_svm_1723514570290"
fsx_user_name              = "fsxadmin"
fsx_password               = "netapp1!" # replace with your actual password
fsx_volume_snapshot_policy = "daily_weekretention"
fsx_vol_throughput         = 256
fsx_iops                   = "3"
fsx_encryption_key         = "arn:aws:kms:ap-southeast-1:464262061435:key/0ff7ae43-5a18-4bbb-af78-31e7a9127b71"
ontap_sg_id                = "sg-0e815f376e4ab473b"
fsx_encrypted_password     = "netapp1!" # replace with your actual password

#sql configuration variables
sql_deployment_mode          = "standalone"
sql_ami_id                   = "ami-0017fb94c6269ce73"
sql_service_account_name     = "sqladminapsm7"
sql_service_account_password = "netapp1!" # replace with your actual password
sql_collation                = "SQL_Latin1_General_CP1_CI_AS"
sql_server_name              = "sqldbapd1o"
sql_svm_name                 = "sqlsvm1"
sql_igroup_name              = "sqligroup1"

#vpc endpoint configuration variables
private_subnet1_cidr_block          = "10.0.128.0/20"
private_subnet2_cidr_block          = "10.0.128.0/20"
s3_gateway_endpoint_route_tables    = ""
is_s3_endpoint_created              = true
is_cloudformation_endpoint_created  = true
is_ssm_endpoint_created             = true
is_sqs_endpoint_created             = true
is_cloudwatch_logs_endpoint_created = true
is_fsx_endpoint_created             = true
is_ec2_endpoint_created             = true
is_ec2_messages_endpoint_created    = true
is_ssm_messages_endpoint_created    = true

#variables for provisioning the ec2 instance
s3_template_url          = "https://s3.amazonaws.com/aws-quickstart/quickstart-netapp-ontap/templates/netapp-ontap-aws-master.template"
deployment_name          = "wlmdb-poc-terraform-SqlStandalone-deployment"
node_net_bios_names      = "sqlnode-81451"
deploy_role_name         = "wlm-operate-permissions-role"
validation_ami_id        = "ami-0dc86cd5724f1007c"
validation_instance_type = "t2.micro"
role_credentials_id      = "0c9ba7d1-3bca-4e8a-b6e3-becd91160ab8"
wlmdb_aws_account_id     = "718273455463"
jwt_token                = "eyJhbG"
notification_arn         = "testarn"

s3_artifacts_url       = "https://wlfdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb"
enable_cloud_watch_log = true
unique_id              = 124324324
sql_admin_accounts     = "sqlsa"
