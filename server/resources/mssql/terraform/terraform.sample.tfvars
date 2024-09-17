aws_location    = "ap-southeast-1"
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
notification_arn               = ""
enable_cloud_watch_log_feature = true # enable_cloud_watch_log
mssql_media_bucket_name        = "LaunchWizard-sqlha"
mssql_media_path_key           = "launchwizardscripts/sqlmedia/sqlserver.iso"

validation_node_initialization_s3_url = ""
sql_node_initialization_s3_url        = ""
fsx_encryption_key                    = ""
# for fci fsx
fsx_quorum_volume_name = "wlmdb-quorum"
fsx_quorum_volume_size = 100 #number

