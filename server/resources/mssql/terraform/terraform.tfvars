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
node_net_bios_names      = "sqlnode-77776"
fsx_storage_capacity     = 1024            # number
fsx_data_lun_size        = 204800          # number
domain_admin_user        = "administrator" #domain_admin_user_name
fsx_admin_username       = "fsxadmin"      #fsx_user_name
sql_service_account_name = "sqladminapg5m"

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

s3_artifacts_url   = "https://sathish-wlmdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/signed-url.json?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEOf%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkYwRAIgK0h7DbeOekMIHkbVoTL4MQThgqq78HgExeuW%2Bq7gkfoCIGQFJGuBM%2F5CIKgwjz67rIgmLyqyDgcJ3yHhTb5KxIsfKt8DCPD%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMNDY0MjYyMDYxNDM1IgyXfHRs5trlzpDP3qwqswPdJgVyMAm5e0baw87pmGeB%2BBm%2B98raXCMgCtC7Tkb3813cdYp1WBo%2FtYhZduZ40rXKqB4ZSXaePaCD5djZ9poT2vyHwFDcigkKKIKpSczVZwJMf9ghk2bxaFPEJjS%2FpvM%2Fuvks1q0YFRzIcaBsoMaPDH0Vnfo4J%2BLLVtYyOLgoLebiWYuhYtw%2BP07FVyU%2B8TeJLxaL6XUZXljsERRjaXUMeh1s7F8klKUsUMD163cwrW%2F5GImqFL2sqBsZIaOLhmE0H2ahT8HILCWMIX6d4AVCfntyswb6Zw6equLXYMC2NfjKgXnvq6RMjvTLSNp8sKTfu%2BIY2O%2F7LM0XjQjPX2oaDQkgsKqiMKUlLJMjZM7K%2F6TiIdtswbJBWSAU%2F7pcaKRPRshJQ9fI3iTyk6uQXNUG8hw5PkRjc0U7zGSp2Hhkuz%2FpKyKuFvspQntkb0j9bKp0zIjOzH6%2F7uIEareC682Sg%2BWI3sX3pW0BloU%2BwKb3CAH2BHQMSbZ3XCT%2B%2B0VppuekrYl42Ke%2FVHqs7cf9H225HzDsgsFD6CDAAq4M1RR0neXwW9CZN%2F6ywnDdMxOw%2F5MGunEwtbqytgY6lQLQ%2BYXJ9HISXGuP1hH4%2BLSmNhF3fs4tTEzCbwvu9pSVStDjsTwZQddm7s006Zuij6QNRrgWd93fFhDXnH8GVikNRUkHThPFgkeNjiD9l7wAmfkcOF6SYdczNKBCu%2BrADq8X%2B0ebFCwjlzlC28W45Ho2meJ6Jpn180c6fpdy%2B1JuffDDnOVSWzWYdAdUSR90sOsDLjmURXe22zT2QSTaukb0AREHcFes7Pwsoj%2BoVRaVmLH%2Br92hnLSBUl%2B%2F8IDMC%2BGlfDda2hwo%2FrATPzcVmdXjjznLGYauUJ8CZnbM8vKoOexkQ5zDaUWcYcxC5HCUdipF3RmWUwMhuQoXQVvMTS19QhurRiV3rUBaTAqQF58wqJ%2Bj2XI4&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240826T174849Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5WXBVBH6M%2F20240826%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=39884709d3e1cad4a57b936b3b1da50a612cee2789e18e597643be1c150633af"
fsx_encryption_key = "arn:aws:kms:ap-southeast-1:464262061435:key/0ff7ae43-5a18-4bbb-af78-31e7a9127b71"
# for fci fsx
fsx_quorum_volume_name = "wlmdb-quorum"
fsx_quorum_volume_size = 100 #number

# ontap_sg_id
# sql_admin_accounts
