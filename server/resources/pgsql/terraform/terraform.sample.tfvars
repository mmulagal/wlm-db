aws_location    = "ap-southeast-1"
creator_tag     = "wlmdb-terraform"
deployment_name = "wlmdb-terraform-PgsqlStandalone-deployment1234"
aws_profile     = "default"

vpc_id             = "vpc-test"
vpc_cidr           = "10.0.0.0/16"
private_subnet1_id = "subnet-test"
route_table1_id    = "rtb-test"
private_subnet2_id = ""

tf_deploy_role_name           = "wlm-operate-permissions-role" # deploy_role_name
validation_ami                = "ami-test"
validation_node_instance_type = "m5.xlarge"
account_id                    = "account-test" #have to be added
cloud_provider_account_id     = 123456         #have to be added
wlmdb_aws_account_id          = 123456         #have to be added

s3_endpoint_route_tables        = ""
private_subnet1_cidrblock       = "10.0.128.0/20"
private_subnet2_cidrblock       = ""
ebs_volume_size                 = 100
s3_endpoint_exists              = true
sqs_endpoint_exists             = true
ssm_endpoint_exists             = true
cloudwatch_logs_endpoint_exists = true
fsx_endpoint_exists             = true
ec2_endpoint_exists             = true
ec2_messages_endpoint_exists    = true
ssm_messages_endpoint_exists    = true

unique_id            = "123456"
fsx_file_system_name = "wlmdb-fsx-1738215314977"
fsx_data_volume_name = "wlmdb_sqldata_1738215314979_tf"
fsx_data_volume_size = 225281
fsx_log_volume_name  = "wlmdb_sqllog_1738215314979"
fsx_log_volume_size  = 56321
fsx_svm_name         = "wlmdb_svm_1738215314979"

sql_svm_name         = "wlmdb_sqlsvm_1738215314979"
node_net_bios_names  = "pgsqlnode-73598"
fsx_storage_capacity = 1024
fsx_admin_username   = "fsxadmin" #fsx_user_name

deployment_mode                = "SINGLE_AZ_1"
fsx_file_system_id             = ""
fsx_admin_password             = "test1!"
fsx_volume_throughput_capacity = 128
fsx_disk_iops                  = 3
file_system_encryption_key_id  = "0a96542a-f57b-487c-a0fc-4db5d74c0a89" #added
ontap_security_group_id        = "sg-test"
fsx_volume_snapshot_policy     = "daily_weekretention"
sql_deployment_mode            = "standalone"
sql_version                    = "postgresql16"
sql_ami_id                     = "ami-test"
sql_service_account_password   = "test1!"
sql_server_name                = "pgstvy163daq9y"

workload_instance_type         = "m5.large"
key_pair_name                  = "test"
enable_cloud_watch_log_feature = true
notification_ARN               = "1234" #has to be removed
jwt_token                      = "123"  #has to be removed

validation_node_initialization_s3_url = ""
pgsql_node_initialization_s3_url      = ""
fsx_encryption_key                    = ""

cloudformation_endpoint_exists = true #has to be removed
route_table2_id                = ""

ec2_role_name   = "AmazonEC2RoleForLaunchWizard"
number_of_nodes = ""
fsx_svm_id      = ""
fsx_svm_uuid    = ""
fsx_aggr_name   = "aggr1"
