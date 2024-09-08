# aws provider configuration
aws_location            = "ap-southeast-1"
creator_tag             = "wlmdb-poc-sathish-terraform"
bucket_for_state        = "sathish-tf-poc"
terraform_state_locking = "terraform-state-locking"
deployment_name         = "wlmdb-poc-terraform-SqlStandalone-deployment"

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
validation_ami                = "ami-07b4b6e7643cb29ed"        # validation_ami_id
validation_node_instance_type = "t3.large"                     # t2.micro change it later
account_id                    = "account-aHP3esT5"
cloud_provider_account_id     = 464262061435
role_credentials_id           = "0c9ba7d1-3bca-4e8a-b6e3-becd91160ab8"
wlmdb_aws_account_id          = 464262061435 # number
jwt_token                     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXIiOiJTWVNURU1AbmV0YXBwLmNvbSJ9LCJpYXQiOjE3MjQwNjUxNjUsImV4cCI6MTcyNDY2OTk2NX0.1hoOmaU6EnuXsIPVM6K61atNCDSZrURCPRQJtJWsF1c"
metrics                       = "triggered-from:rest-api,instance-type:m5.large,sql-version:2016,database-size:200,sql-host-name:sqldbspb9e,deployed-from:wlmdb"

s3_endpoint_route_tables        = ""              # s3_gateway_endpoint_route_tables
private_subnet1_cidrblock       = "10.0.128.0/20" # private_subnet1_cidr_block
private_subnet2_cidrblock       = ""              #private_subnet2_cidr_block
encrypted_fsx_password          = "Netapp123"     # fsx_encrypted_password
ebs_volume_size                 = 100             # number
s3_endpoint_exists              = true            # is_s3_endpoint_created
cloudformation_endpoint_exists  = true            # is_cloudformation_endpoint_created
ssm_endpoint_exists             = true            # is_ssm_endpoint_created
sqs_endpoint_exists             = true            # is_sqs_endpoint_created
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
sql_service_account_name = "sqladminmag9m" # change every time

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
sql_server_name                = "sqldcedd5e" # change every time


is_custom_ami                  = "false"
workload_instance_type         = "m5.large"
key_pair_name                  = "occm_qa" # ec2_instance_keypair
notification_arn               = ""
enable_cloud_watch_log_feature = true # enable_cloud_watch_log
mssql_media_bucket_name        = "LaunchWizard-sqlha"
mssql_media_path_key           = "launchwizardscripts/sqlmedia/sqlserver.iso"

s3_artifacts_url                      = "https://sathish-wlmdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/signed-url.json?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEKD%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIgFDlyAH4neLZIEymTpFWFdPOEC2wwea0vRkGZvBTdmZwCIQDKI74bOF%2Fbg%2FIp9OH4ZyT8WZdrgRRtzD6RnNkptcgpTyrfAwi5%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAAaDDQ2NDI2MjA2MTQzNSIM14nnV8g2zdN%2Bk%2BA3KrMDTECzb3pKYp5QdXPZm70HFD67njzOBofYdY2mB3EBrsxrvMudNekP1JTC4lFASjqUMAM1CeSQN1E%2BpyMvdDm2EZtMi1WuOVueujHDVqfu5axaIiW60nWfQnlweluq9hVZ%2F2xGZuGAYa5Swt%2Fb9XH1lnDH%2FWaPXGLMu0bA2Z5BI9GdjYXzuLGpX%2FxgxukmKkeFDxUva8eughdtR9ZvzNswlicKk8l4l%2F%2FZN7fryGfdgk5tlr%2BWAn2pVoAsx7wHGAd%2B2BMuwwgNg4TZrlayW3Fn6bk59oIYmNluLeW3HFx%2BW2meS4bSXhoMi16THbcL7dKNi94p3TtrGyd7Ad6Z10I9%2FKEnCsSl9ImG9BCFopdqdrVp1oIwvoArR6s7oOotCGjMinDNVTUlOVDNeyTAy9BHdwpoTPbjZjhVKxhJPUjDRpvMe7pLo7IfG3DXPDD0m29gG55tNTCTadrbaPAbF0Cq0895AvVtyy79OHgLkkNVcbw6HkiCfN77xK8MBZMPAVDQ%2FVLPmEmwkBaSkK8lqAUEaSdMo%2Frb0upqICzkFhYM0rADdanwe03Hkbho9E%2FerwU%2F%2BFxKMJP42rYGOpQCGH9EtAAgGMV65LT6gCYiqtdQ0imdaOZRpaa35no8%2F6r%2F9SHv%2FeSTrlBg%2FeocjB2Eqak6EdUqwlOtAZSIus4YmtLfSAYDwur%2B%2F1ioZI0%2Fwif%2Bb12ZGQzZqHAMn4tIRYmaIfj38qPwVg%2FdlSeo1DTxoR8goyj%2FcH8gWwzjKlMHiEO0BfCAOCPEkt8xstBGVxbGuQyDFRAl0Z%2FegVOYvE6aMh%2BogFOnl1dSUoAiPZBD8HQN8MKBXfvnGdfe23029P2yb6t5R%2BRGxbhDvsQXpMLZMErgqxjqa2HJMXpyx7UC%2FBsfocEfGeNOFd9TRt29W9NIaXxW%2FPu%2FSnRjqCaU8p4UqtpY2vxLnkdmcBvB%2Bt%2BbxY6gKt65&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240903T123936Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5XMCEGJPW%2F20240903%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=a80b537d44bbcb55ec303cd6db911b40e41e65feefd250a46a21f7329e274afe"
validation_node_initialization_s3_url = "https://sathish-wlmdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/terraform/validation/instance-initializer.ps1?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEBcaDmFwLXNvdXRoZWFzdC0xIkgwRgIhAPmIv1LsslrOlNoGRC1JbfZyt5n49vEejOCwYpMgLSWSAiEA6Gq2eOwxNNJ%2BazmgTdv2VgauqzN6WGw6ZDZD22f0C0Yq1gMIQBAAGgw0NjQyNjIwNjE0MzUiDHvlVhehi97LfoYccyqzA0%2BiAdPOWxAEA%2BN1T0%2BVOTXI2m4KhePaGHT7mcY6Iymax%2F6LTY3D4vbxDKDSwf5bWdVgnKmNqqDeBVjNdhN8m%2BxkySinxNOQ9LIa327rJ73TaILf077ajJvoFzDo5lnoIbXlsXYT%2FaYLsDN6IvBvHi8N9GS1GFZT97FW0JSGbgwxRlEzbJQr9aqE910nOQwaFbiauuXxvGgGulcSJfXzNCNLK5tKq4AUKUE1bWpxZfL7gEulM3i3ekt2o%2FUWQt2pCfDhbp4Peh3lOPmcjbUXHHiGhsUCDAY3%2FXlNKMaS15dkKnK5%2BeN3S4iaJSiLQ1EBO5JHyXkRmAElk8d7HHBXEhQa0rTt9w9wXyThVtAbRCJEEhSAoXn35LJlGmAdPjXes%2Fx3H5%2BoDw5SpJ8Ib4%2BoEa5NvvKx4cD%2BhpgUxOzvRZft4D0pdjFbUdmEEaa8pDMiH18CW94D84FrUZBx1IkZmUENQR%2FcMzsTEPcJeVtijSr4WY5J1LOgSW1wE57%2FgVpxcvMRdNPRWb5PcOzdf5pOtOMI2CE9Xugl1M2hqZ6XUPN7D9s1Hp4SEx18cBBfVsGsaHlvxzDUh%2FW2BjqTArF3KPcDvZqbPIvBeVS%2FMSWDvs5tE9uiOd3QR4cTLF0GoKeZDYFSYEtlDs5hHfgKCqyexSJaAVMy1wSTl4PKD63IjC5yd0aPvX0rXEDYyWL%2BebPdJMZToNb39NkmWkreZiZ1gx2lDrNMTDQdl2%2B72nABQiOzOfZvJXh2npV0%2B5qwywlMh1ciCjItr8iMjavPATb7hcxL5IedxqCRJ3xTlCHefY%2BwZNyeO3xZa0%2FRZzG7xN3Pe9Rndxhn%2B1SNZTv1l8bdkafjF0DsNFCEzYnvefvkw7DIF%2BIDliPyNmjyauLbnyMx7HtUjNWP7gULi7%2Bu9%2F9PNilzFPx56dSe5DPbdiIjCWH71e7EvqqIZy%2FFyDXnxocZ&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240908T070210Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5QRY6EI6Y%2F20240908%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=399f7af281f347c027874c38aacbde64e15ec7852cabc715cb90e30096408c1e"
sql_node_initialization_s3_url        = "https://sathish-wlmdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/signed-url.json?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEKD%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkcwRQIgFDlyAH4neLZIEymTpFWFdPOEC2wwea0vRkGZvBTdmZwCIQDKI74bOF%2Fbg%2FIp9OH4ZyT8WZdrgRRtzD6RnNkptcgpTyrfAwi5%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAAaDDQ2NDI2MjA2MTQzNSIM14nnV8g2zdN%2Bk%2BA3KrMDTECzb3pKYp5QdXPZm70HFD67njzOBofYdY2mB3EBrsxrvMudNekP1JTC4lFASjqUMAM1CeSQN1E%2BpyMvdDm2EZtMi1WuOVueujHDVqfu5axaIiW60nWfQnlweluq9hVZ%2F2xGZuGAYa5Swt%2Fb9XH1lnDH%2FWaPXGLMu0bA2Z5BI9GdjYXzuLGpX%2FxgxukmKkeFDxUva8eughdtR9ZvzNswlicKk8l4l%2F%2FZN7fryGfdgk5tlr%2BWAn2pVoAsx7wHGAd%2B2BMuwwgNg4TZrlayW3Fn6bk59oIYmNluLeW3HFx%2BW2meS4bSXhoMi16THbcL7dKNi94p3TtrGyd7Ad6Z10I9%2FKEnCsSl9ImG9BCFopdqdrVp1oIwvoArR6s7oOotCGjMinDNVTUlOVDNeyTAy9BHdwpoTPbjZjhVKxhJPUjDRpvMe7pLo7IfG3DXPDD0m29gG55tNTCTadrbaPAbF0Cq0895AvVtyy79OHgLkkNVcbw6HkiCfN77xK8MBZMPAVDQ%2FVLPmEmwkBaSkK8lqAUEaSdMo%2Frb0upqICzkFhYM0rADdanwe03Hkbho9E%2FerwU%2F%2BFxKMJP42rYGOpQCGH9EtAAgGMV65LT6gCYiqtdQ0imdaOZRpaa35no8%2F6r%2F9SHv%2FeSTrlBg%2FeocjB2Eqak6EdUqwlOtAZSIus4YmtLfSAYDwur%2B%2F1ioZI0%2Fwif%2Bb12ZGQzZqHAMn4tIRYmaIfj38qPwVg%2FdlSeo1DTxoR8goyj%2FcH8gWwzjKlMHiEO0BfCAOCPEkt8xstBGVxbGuQyDFRAl0Z%2FegVOYvE6aMh%2BogFOnl1dSUoAiPZBD8HQN8MKBXfvnGdfe23029P2yb6t5R%2BRGxbhDvsQXpMLZMErgqxjqa2HJMXpyx7UC%2FBsfocEfGeNOFd9TRt29W9NIaXxW%2FPu%2FSnRjqCaU8p4UqtpY2vxLnkdmcBvB%2Bt%2BbxY6gKt65&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240903T123936Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5XMCEGJPW%2F20240903%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=a80b537d44bbcb55ec303cd6db911b40e41e65feefd250a46a21f7329e274afe"
fsx_encryption_key                    = "arn:aws:kms:ap-southeast-1:464262061435:key/0ff7ae43-5a18-4bbb-af78-31e7a9127b71"
# for fci fsx
fsx_quorum_volume_name = "wlmdb-quorum"
fsx_quorum_volume_size = 100 #number

# ontap_sg_id
# sql_admin_accounts
