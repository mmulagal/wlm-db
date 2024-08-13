# aws provider configuration
aws_location = "ap-southeast-1"
creator_tag = "wlmdb-poc-terraform"
bucket_for_state = "sathish-tf-poc"
terraform_state_locking = "terraform-state-locking"

#networking configuration variables
vpc_id = "vpc-046f7e26255458373"
vpc_cidr = "10.0.0.0/16"
private_subnet1_id = "subnet-03302cffd47acd237"
private_subnet2_id = "subnet-0fcd4374d52d4faf0"
route_table1_id = "rtb-09a5394f5cee60073"
route_table2_id = "rtb-044539dfce91103ab"
availability_zone1 = "ap-southeast-1a"
availability_zone2 = "ap-southeast-1c"
security_group_id = "sg-06989f7dcc767bcdf"
default_security_group_id = "sg-05f4939d6670b405f"

#ec2 configuration variables
ec2_instance_type = "m5.large"
ec2_instance_keypair = "occm_qa"

#ad configuration variables
ad_type = "AWS_MANAGED_AD"
domain_user_name = "admin"
domain_password = "Collector@123" # replace with your actual password
domain_dns_name = "wlmqa2.com"
ad_security_group_id = "sg-06989f7dcc767bcdf"
dns_ip_addresses = ["10.0.140.140","10.0.29.45"]

#fsx configuration variables
fsx_deployment_mode = "SINGLE_AZ_1"
fsx_file_system_id = "your_file_system_id_here" # replace with your actual file system id
fsx_user_name = "fsxadmin"
fsx_password = "netapp1!" # replace with your actual password
database_size = "200"
fsx_vol_throughput = "128"
fsx_iops = "3"
encryption_key = "0a96542a-f57b-487c-a0fc-4db5d74c0a89"
ontap_sg_id = ["sg-0e815f376e4ab473b"]

#sql configuration variables
sql_deployment_mode = "standalone"
sql_ami_id = "ami-0017fb94c6269ce73"
service_account_name = "sqladminapsm7"
service_account_password = "netapp1!" # replace with your actual password
sql_collation = "SQL_Latin1_General_CP1_CI_AS"
sql_server_name = "sqldbapd1o"
sql_ami_name = "Windows_Server-2022-English-Full-SQL_2022_Standard-2023.12.13"

#vpc endpoint configuration variables
private_subnet1_cidr_block = "10.0.128.20" 
private_subnet2_cidr_block = "" 
s3_gateway_endpoint_route_tables = ""
is_s3_endpoint_created = false
is_cloudformation_endpoint_created = false
is_ssm_endpoint_created = false
is_sqs_endpoint_created = false
is_cloudwatch_logs_endpoint_created = false
is_fsx_endpoint_created = false
is_ec2_endpoint_created = false
is_ec2_messages_endpoint_created = false
is_ssm_messages_endpoint_created = false
