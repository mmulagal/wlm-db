# aws provider configuration
aws_location            = "ap-southeast-1"
creator_tag             = "wlmdb-poc-sathish-terraform"
bucket_for_state        = "sathish-tf-poc"
terraform_state_locking = "terraform-state-locking"
deployment_name         = "wlmdb-poc-terraform-SqlStandalone-deployment"

vpc_id                = "vpc-046f7e26255458373"
vpc_cidr              = "10.0.0.0/16"
private_subnet1_id    = "subnet-0fcd4374d52d4faf0"
route_table1_id       = "rtb-044539dfce91103ab"
private_subnet2_id    = "" # subnet-03302cffd47acd237
route_table2_id       = "" #rtb-09a5394f5cee60073
ad_scenario_type      = "USER_MANAGED_AD"
domain_admin_password = "Collector@1234"
domain_dns_name       = "wlmnew.com"
dns_ip_addresses      = "10.0.141.68"
domain_member_sg_id   = "" # domain_security_group_id

tf_deploy_role_name           = "wlm-operate-permissions-role" # deploy_role_name
validation_ami                = "ami-07b4b6e7643cb29ed"        # validation_ami_id
validation_node_instance_type = "t3.large"                     # t2.micro change it later
account_id                    = "account-aHP3esT5"
cloud_provider_account_id     = 464262061435
role_credentials_id           = "0c9ba7d1-3bca-4e8a-b6e3-becd91160ab8"
wlmdb_aws_account_id          = 464262061435 # number
jwt_token                     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXIiOiJTWVNURU1AbmV0YXBwLmNvbSJ9LCJpYXQiOjE3MjQwNjUxNjUsImV4cCI6MTcyNDY2OTk2NX0.1hoOmaU6EnuXsIPVM6K61atNCDSZrURCPRQJtJWsF1c"
metrics                       = "triggered-from:rest-api,instance-type:m5.large,sql-version:2016,database-size:200,sql-host-name:sqldbspb9e,deployed-from:wlmdb"

s3_endpoint_route_tables        = ""             # s3_gateway_endpoint_route_tables
private_subnet1_cidrblock       = "10.0.16.0/20" # private_subnet1_cidr_block
private_subnet2_cidrblock       = ""             #private_subnet2_cidr_block
encrypted_fsx_password          = "Netapp123"    # fsx_encrypted_password
ebs_volume_size                 = 100            # number
s3_endpoint_exists              = true           # is_s3_endpoint_created
cloudformation_endpoint_exists  = true           # is_cloudformation_endpoint_created
ssm_endpoint_exists             = true           # is_ssm_endpoint_created
sqs_endpoint_exists             = true           # is_sqs_endpoint_created
cloudwatch_logs_endpoint_exists = true           # is_cloudwatch_logs_endpoint_created
fsx_endpoint_exists             = true           # is_fsx_endpoint_created
ec2_endpoint_exists             = true           # is_ec2_endpoint_created
ec2_messages_endpoint_exists    = true           # is_ec2_messages_endpoint_created
ssm_messages_endpoint_exists    = true           # is_ssm_messages_endpoint_created

unique_id               = "1724065163786"
fsx_file_system_name    = "wlmdb-fsx-1724065163786"
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
domain_admin_user        = "administrator" #domain_admin_user_name
fsx_admin_username       = "fsxadmin"      #fsx_user_name
sql_service_account_name = "sqladminadg4m"

deployment_mode                = "SINGLE_AZ_1"
fsx_file_system_id             = ""          # can have value if its existing
fsx_admin_password             = "Netapp123" #fsx_password
fsx_volume_throughput_capacity = 128         # number  fsx_vol_throughput
fsx_disk_iops                  = 3           # number fsx_iops
file_system_encryption_key_id  = "0a96542a-f57b-487c-a0fc-4db5d74c0a89"
ontap_security_group_id        = "sg-0e815f376e4ab473b"
fsx_volume_snapshot_policy     = "daily_weekretention"
sql_deployment_mode            = "standalone"
sql_ami_id                     = "ami-0c2a40c28c6020bd8"
sql_service_account_password   = "Netapp123"
sql_collation                  = "SQL_Latin1_General_CP1_CI_AS"
sql_server_name                = "sqldbspb9e" # change every time


is_custom_ami                  = "false"
workload_instance_type         = "m5.large"
key_pair_name                  = "occm_qa" # ec2_instance_keypair
notification_arn               = ""
enable_cloud_watch_log_feature = true # enable_cloud_watch_log
mssql_media_bucket_name        = "LaunchWizard-sqlha"
mssql_media_path_key           = "launchwizardscripts/sqlmedia/sqlserver.iso"

s3_artifacts_url   = "https://sathish-wlmdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/signed-url.json?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEEoaDmFwLXNvdXRoZWFzdC0xIkgwRgIhAO4lIaEU7UAbeHN37seTNnY%2FIbOshRNUJDi%2BI1HZ4fm%2BAiEAqcO2DsIyb2qsJefF0%2FQpuiUp%2FswEX%2BCOZiIZGwfB%2FmQq1gMIYxAAGgw0NjQyNjIwNjE0MzUiDN76lRYrn0qlMB3SwiqzA%2FdlPsX1sfVpU8kj3qljlRRI8Ll7HcjefqT6GWkYCOMru0Hj8adyCW09zGLkpVAaxezq5K8sPAdH4S0ILBg8bTKv8QkE2YsqxnXHQqNtME%2FqPoZBYDXeA90dO%2BuELTndnq4nXEwjJ%2FpPS7QIcJnqUdHO00TIZiose05ju33Pv4lQFWISRbY%2BZFu7jfQK0LVEnPgAldEAiht29Kk0AOtcduwd9bXtb6Rg4GbPOiwMc9xaA17W3CN%2BcnLPEwhxXuQS2koCxvHDvP7sjdXwYoVuUK9tjyiiiTP9090XECr4cK8qrz8oLMXBsGQzRRoAIMzA%2BK%2FGIEnzvB4QxJhqhssZi3R%2F%2Bzz0utv5%2FXLY%2FWpXckcHVXC7l8%2BtJSMSx1jtSewyOesMQGCoSpvBzlPuWnKb3R%2BxJ858AgT3%2BSb%2FFOdxpeZBWYdYu2SS3LneKta09Wtljyx1sz0oVmTwZ9TETkChcDDJKVCiHVMhRw3lg2eKZoFwoQZP1qCYnQWJQZmwBOJ794dwey629lyf7Xhh24zqRQ7YAwLnZN4IUABK2MqifmHP2STvipcp4ZP%2FhY7GNFgp58SsnDDr%2FMe2BjqTAtGdgrRYqdMGl53Bttq4mDn1Yaadlg5amhem3L2Hv%2BATnayZ140aGnxcD%2FiMvoY4c1pDE1%2FbIqCJWceMdHQdYxLqykVXWILfD1NNB5GbZA6CVXl335bozu6nnJuB55SyLgUMTC%2Fb%2FcfmMRUH%2FpsmTHju%2FhB7ZAqDmP0umrX0XDNhEMPp%2FC%2Fj8082OgSDV5BMdrnrAZVZMfdeC01LZa%2BQ6m5pMi6scvnDbLNOtvVarkzLCQSObJgVusChc%2BjluFsS%2F9JX0rMDKr95ImWgkNNAGypIuvAmPlKUE7OqXgEFNTsZEHCFeKi1gyTA6JgsKs7Bqk2hSc1hBdvY1NXS8UjhRFQItYq7KJ21BToq3B08hzBwOQ8X&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240830T192359Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V55TXWBQ42%2F20240830%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=70e06195309c7eaa9e91eb9f55334c17aa055a5b7d2ad53cc1a7a18cd091d3a5"
fsx_encryption_key = "arn:aws:kms:ap-southeast-1:464262061435:key/0ff7ae43-5a18-4bbb-af78-31e7a9127b71"
# for fci fsx
fsx_quorum_volume_name = "wlmdb-quorum"
fsx_quorum_volume_size = 100 #number

# ontap_sg_id
# sql_admin_accounts
