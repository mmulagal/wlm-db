aws_location    = "ap-southeast-1"
creator_tag     = "wlmdb-terraform"
deployment_name = "wlmdb-terraform-SqlStandalone-deployment"

vpc_id                = "vpc-12345"
vpc_cidr              = "10.0.0.0/16"
private_subnet1_id    = "subnet-12344"
route_table1_id       = "rtb-12345"
private_subnet2_id    = ""
route_table2_id       = ""
ad_scenario_type      = "AWS_MANAGED_AD"
domain_admin_user     = "admin"
domain_admin_password = "test@123"
domain_dns_name       = "domain.com"
dns_ip_addresses      = "10.0.0.1,10.0.0.2"
domain_member_sg_id   = "sg-12345"

tf_deploy_role_name           = "wlm-role-name" # deploy_role_name
validation_ami                = "ami-0a27cc0b164d66785"
validation_node_instance_type = "t2.micro"
account_id                    = "account-test"
cloud_provider_account_id     = 12345678
role_credentials_id           = "asdf12312-3bca-4e8a-1ads-2321112"
wlmdb_aws_account_id          = 12345678

s3_endpoint_route_tables        = ""
private_subnet1_cidrblock       = "10.0.1.0/20"
private_subnet2_cidrblock       = ""
encrypted_fsx_password          = "test123"
ebs_volume_size                 = 100
s3_endpoint_exists              = true
ssm_endpoint_exists             = true
cloudwatch_logs_endpoint_exists = true
fsx_endpoint_exists             = true
ec2_endpoint_exists             = true
ec2_messages_endpoint_exists    = true
ssm_messages_endpoint_exists    = true

unique_id               = "1725147482401"
fsx_file_system_name    = "wlmdb-fsx-tf-1723065263786"
fsx_data_volume_name    = "wlmdb_sqldata_1724065163786"
fsx_data_volume_size    = 225281
fsx_log_volume_name     = "wlmdb_sqllog_1724065163786"
fsx_log_volume_size     = 56321
fsx_temp_db_volume_name = "wlmdb_sqltemp_1724065163786"
fsx_temp_db_volume_size = 22529
fsx_svm_name            = "wlmdb_svm_1724065163786"

sql_igroup_name          = "wlmdb_sqligroup_1724065163786"
sql_svm_name             = "wlmdb_sqlsvm_1724065163786"
node_net_bios_names      = "sqlnode-tf-test"
fsx_storage_capacity     = 1024
fsx_data_lun_size        = 204800
fsx_admin_username       = "fsxadmin" #fsx_user_name
sql_service_account_name = "sqladminaccount"

deployment_mode                = "SINGLE_AZ_1"
fsx_file_system_id             = ""
fsx_admin_password             = "Test123"
fsx_volume_throughput_capacity = 128
fsx_disk_iops                  = 3
file_system_encryption_key_id  = "12345-f57b-487c-a0fc-12345"
ontap_security_group_id        = "sg-12345"
fsx_volume_snapshot_policy     = "daily_weekretention"
sql_deployment_mode            = "standalone"
sql_ami_id                     = "ami-0017fb94c6269ce73"
sql_service_account_password   = "Test123"
sql_collation                  = "SQL_Latin1_General_CP1_CI_AS"
sql_server_name                = "sqlservername"


is_custom_ami                  = "false"
workload_instance_type         = "m5.large"
key_pair_name                  = "keypair"
enable_cloud_watch_log_feature = true
mssql_media_bucket_name        = "LaunchWizard-sqlha"
mssql_media_path_key           = "launchwizardscripts/sqlmedia/sqlserver.iso"

validation_node_initialization_s3_url = ""
sql_node_initialization_s3_url        = ""
fsx_encryption_key                    = ""
# for fci fsx
fsx_quorum_volume_name = "wlmdb-quorum"
fsx_quorum_volume_size = 100

