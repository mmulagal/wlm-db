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

s3_artifacts_url   = "https://sathish-wlmdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/signed-url.json?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEIL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0xIkgwRgIhAMB4YMoEMj4jcYX%2FBDWO1e%2Fp9Ssguy%2FzfwqYddyf6FXZAiEA%2FnpSSraxL9TdkbHZhY%2FMHFXOePiS3RheWsjDgJnvOFsq3wMIi%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgw0NjQyNjIwNjE0MzUiDKXXR%2FhSkmMjyQ0mXCqzA%2Ba2JU9II7tim2GT0SGJ1W%2Ft3f5zwb%2Fyioz8uNq6U7Fpv2eLDKy8vnrKrr8Mju0ClB%2BxBWKNFIVS9%2B9De3dkie4IcFevyqXzqj7Cai2yx1EkpQ1eRai46EuxveK4BszJ6%2FdoxU%2Bq8AloyYpo5smMil0bHAUqVtO%2BwzCB%2Bpxr2Cp8yjgQlWNZr%2BNzkDgkewF8VAF%2B008On9v2VQI6%2B4e7Bz0HMXdJUiFvjuqaDXzRM5w92U4GoFyHtfcHc4lFeor%2Bb%2FXIzf2S05gbGKsOxHULUmWbsNDGQfd85gSF8mwrJBGoPS80UoScRpQQ8AXGVia%2BB6quZgCzE3BxQlLfgpyusxLDJCgkOQUu7e%2BNtinem84ACe7En5hxdrqYKv9XUYLTKE2SUd6yM97uU6RI2gsIPZyyMhYYX9Of%2Fn7QjHTytVkBxmKXnpGt4IiL0j3YPioZB1FcPqkEZVMmxESdxVESAdOnxEwDTHtj0v4gb8GvvsI3YkErNvqLNDSns%2Bxqeqxu8oQ%2BZRe1ahG7lu7NfHf%2BKahapnH%2B28Lgb5dnVsWUqZ6Fft9NYWT0kUCngGP7JZsldWGTXTD%2BwZu2BjqTAh5MOrXo7UjLli92TJi47FSqIKmMW%2BVQ9zfwrdWfJE5OCAJlO1wyaBBVQijAegI%2FAhF2SgF6PIJ%2FVPtehEmzmtxqTui7qa5vO8g0u%2BNpnlLje3sd%2F6SuFU55yCKmZ5XAvICBOElOu5pjvAcA06QpQzmc4H%2BMv15KsPPeojSS6N44dyg9bVwwPPp7BUbJda2JPMUHlBVqfMSzpFbZayjB9sH%2BZioMULJybvJQc%2BjJfd%2B6slErxcpcvUvCGNbM5nV9PnNkQXLIm8jhHYEsc0zyq5T2icU0qJkW6njxwg86kuefOApX%2BagJYTn405H5QaNu6jnUF4%2FFx7ROOMENN0qyhkIVI1aBElH1sq9DN6q5iSICG%2Buf&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240822T094442Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5TQ6ZJYGB%2F20240822%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=0e1eff1fcabce347bc29bdeb59e9e4e233341dfbbd80b0d03472c04fd3b00ce9"
fsx_encryption_key = "arn:aws:kms:ap-southeast-1:464262061435:key/0ff7ae43-5a18-4bbb-af78-31e7a9127b71"

verify_signature          = "https://wlfdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/scripts/Verify-Signature.ps1?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaDmFwLXNvdXRoZWFzdC0xIkcwRQIhAL6eYiqwzIUG6LLxHVlvji46HB6zjYjIZfVmR0z9JGFiAiA5Eqx7bEsQ3Y6hNQ1orrePp2bIoIg7irFRPrOJqIq9XyrWAwhZEAAaDDQ2NDI2MjA2MTQzNSIM3MA3RtQzaLOL%2FTjGKrMDD2E60ddzTjYLSvdA%2Fp531KIgb9PJgDCZE3PvCW0BYeFKWMDiiE5J81uqc5K57JizuFGt%2Fz1o85%2BJy%2BjMH3qzXTrlJT6BgMzU4F9VkxLbcC%2FEJSUSKXmHZ7SXl6WOMQYY7QrqwRRTyuJhBgcgsJNJpo469TsdG2HNLHOoLvOh0r1qUb4NShRQXbvyrW5sVJRwnA9tiCLMVLWjWEJ4V5lZM9vN8oggjjRKK%2BavxfW0aZ7ker3lMII%2BCyK00hUq8zrBU6gMgCDY4xLORQNo3UVtiuMCpvTIWs00An5gAnU3Qk6%2FImYflyqeMRJ71MdWfL4VCNB26YZK3h7CTv1hHDmCOV1rvf4%2BedJx9vSsWlkIEz05Yby1XENRBg3JLDx0hUqDmJ9OWotexaL6Ksgd5A70mWmi5GSNI%2FK9zrse1UfviKVG5rT0ddGtdBUrjeWotIftC2v1BOA531w9VSf0H%2BVraMHt6NaD0SdvyphaG6fK4ehFnZOHkz5H4POk5Saod6PrMKfEpD5wHljRlV5kNu9TNOJ%2FjBC5GIMSLEKWr%2BMIixP0QbYu6xNnL8Pa7DWBY2Yf4XbTMMXZkLYGOpQCY7wbkL0qZqz%2BoriqgdERsshMO175%2FowVP3ErbmX9nRLkI1ZVeEfdof4a8d7QbpaGwg1iXRfLC8wwYnYhn1%2FF4OlnaKTvYKJ85wQnSWl5oqZ0STEn6m%2FQZponZawM7wlyl3k63YQ8IWjUfHczCQIpGvK9p7d0Q7J4r0jldXnUAFBDUlns%2FC6v5XWF0Tu%2FYZqY6gBDaVNOmIpPT1mqt3iCNLLE3rrPTcmeXhgFZbVCRQ6qSAN0vHL3GGlkfFbtGmXbfqULEjl5y39GmL1mGiegpQoP1Rl%2FNICadFBCHfBmXE%2Bhj8t9X9ACiIrOf205WXjv4jZ49I7X7po7vqVunlUymA9aJf4Iy0W%2B81t1bqwnc%2FJ5H%2BeT&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240820T081016Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5U2UU6JFS%2F20240820%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=1c99ac1ee70a1e33e0078654504dda734f1b5c650b60bce7c9e8a85e68573024"
unzip_archive             = "https://wlfdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/scripts/Unzip-Archive.ps1?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaDmFwLXNvdXRoZWFzdC0xIkcwRQIhAL6eYiqwzIUG6LLxHVlvji46HB6zjYjIZfVmR0z9JGFiAiA5Eqx7bEsQ3Y6hNQ1orrePp2bIoIg7irFRPrOJqIq9XyrWAwhZEAAaDDQ2NDI2MjA2MTQzNSIM3MA3RtQzaLOL%2FTjGKrMDD2E60ddzTjYLSvdA%2Fp531KIgb9PJgDCZE3PvCW0BYeFKWMDiiE5J81uqc5K57JizuFGt%2Fz1o85%2BJy%2BjMH3qzXTrlJT6BgMzU4F9VkxLbcC%2FEJSUSKXmHZ7SXl6WOMQYY7QrqwRRTyuJhBgcgsJNJpo469TsdG2HNLHOoLvOh0r1qUb4NShRQXbvyrW5sVJRwnA9tiCLMVLWjWEJ4V5lZM9vN8oggjjRKK%2BavxfW0aZ7ker3lMII%2BCyK00hUq8zrBU6gMgCDY4xLORQNo3UVtiuMCpvTIWs00An5gAnU3Qk6%2FImYflyqeMRJ71MdWfL4VCNB26YZK3h7CTv1hHDmCOV1rvf4%2BedJx9vSsWlkIEz05Yby1XENRBg3JLDx0hUqDmJ9OWotexaL6Ksgd5A70mWmi5GSNI%2FK9zrse1UfviKVG5rT0ddGtdBUrjeWotIftC2v1BOA531w9VSf0H%2BVraMHt6NaD0SdvyphaG6fK4ehFnZOHkz5H4POk5Saod6PrMKfEpD5wHljRlV5kNu9TNOJ%2FjBC5GIMSLEKWr%2BMIixP0QbYu6xNnL8Pa7DWBY2Yf4XbTMMXZkLYGOpQCY7wbkL0qZqz%2BoriqgdERsshMO175%2FowVP3ErbmX9nRLkI1ZVeEfdof4a8d7QbpaGwg1iXRfLC8wwYnYhn1%2FF4OlnaKTvYKJ85wQnSWl5oqZ0STEn6m%2FQZponZawM7wlyl3k63YQ8IWjUfHczCQIpGvK9p7d0Q7J4r0jldXnUAFBDUlns%2FC6v5XWF0Tu%2FYZqY6gBDaVNOmIpPT1mqt3iCNLLE3rrPTcmeXhgFZbVCRQ6qSAN0vHL3GGlkfFbtGmXbfqULEjl5y39GmL1mGiegpQoP1Rl%2FNICadFBCHfBmXE%2Bhj8t9X9ACiIrOf205WXjv4jZ49I7X7po7vqVunlUymA9aJf4Iy0W%2B81t1bqwnc%2FJ5H%2BeT&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240820T081046Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5U2UU6JFS%2F20240820%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=4cf930693778565b92da63d02e08673eaf8d7768eb15cf4359cae508cccba0e2"
aws_launch_wizard_for_fcn = "https://wlfdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/modules/AWSLaunchWizardForCFN.zip?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaDmFwLXNvdXRoZWFzdC0xIkcwRQIhAL6eYiqwzIUG6LLxHVlvji46HB6zjYjIZfVmR0z9JGFiAiA5Eqx7bEsQ3Y6hNQ1orrePp2bIoIg7irFRPrOJqIq9XyrWAwhZEAAaDDQ2NDI2MjA2MTQzNSIM3MA3RtQzaLOL%2FTjGKrMDD2E60ddzTjYLSvdA%2Fp531KIgb9PJgDCZE3PvCW0BYeFKWMDiiE5J81uqc5K57JizuFGt%2Fz1o85%2BJy%2BjMH3qzXTrlJT6BgMzU4F9VkxLbcC%2FEJSUSKXmHZ7SXl6WOMQYY7QrqwRRTyuJhBgcgsJNJpo469TsdG2HNLHOoLvOh0r1qUb4NShRQXbvyrW5sVJRwnA9tiCLMVLWjWEJ4V5lZM9vN8oggjjRKK%2BavxfW0aZ7ker3lMII%2BCyK00hUq8zrBU6gMgCDY4xLORQNo3UVtiuMCpvTIWs00An5gAnU3Qk6%2FImYflyqeMRJ71MdWfL4VCNB26YZK3h7CTv1hHDmCOV1rvf4%2BedJx9vSsWlkIEz05Yby1XENRBg3JLDx0hUqDmJ9OWotexaL6Ksgd5A70mWmi5GSNI%2FK9zrse1UfviKVG5rT0ddGtdBUrjeWotIftC2v1BOA531w9VSf0H%2BVraMHt6NaD0SdvyphaG6fK4ehFnZOHkz5H4POk5Saod6PrMKfEpD5wHljRlV5kNu9TNOJ%2FjBC5GIMSLEKWr%2BMIixP0QbYu6xNnL8Pa7DWBY2Yf4XbTMMXZkLYGOpQCY7wbkL0qZqz%2BoriqgdERsshMO175%2FowVP3ErbmX9nRLkI1ZVeEfdof4a8d7QbpaGwg1iXRfLC8wwYnYhn1%2FF4OlnaKTvYKJ85wQnSWl5oqZ0STEn6m%2FQZponZawM7wlyl3k63YQ8IWjUfHczCQIpGvK9p7d0Q7J4r0jldXnUAFBDUlns%2FC6v5XWF0Tu%2FYZqY6gBDaVNOmIpPT1mqt3iCNLLE3rrPTcmeXhgFZbVCRQ6qSAN0vHL3GGlkfFbtGmXbfqULEjl5y39GmL1mGiegpQoP1Rl%2FNICadFBCHfBmXE%2Bhj8t9X9ACiIrOf205WXjv4jZ49I7X7po7vqVunlUymA9aJf4Iy0W%2B81t1bqwnc%2FJ5H%2BeT&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240820T081112Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5U2UU6JFS%2F20240820%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=6f9a1bc9a91aaba69bcdd7ca72a4aab8848e4052bc26368da4526064208c10e6"
validation_zip            = "https://wlfdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/scripts/validation.zip?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaDmFwLXNvdXRoZWFzdC0xIkcwRQIhAL6eYiqwzIUG6LLxHVlvji46HB6zjYjIZfVmR0z9JGFiAiA5Eqx7bEsQ3Y6hNQ1orrePp2bIoIg7irFRPrOJqIq9XyrWAwhZEAAaDDQ2NDI2MjA2MTQzNSIM3MA3RtQzaLOL%2FTjGKrMDD2E60ddzTjYLSvdA%2Fp531KIgb9PJgDCZE3PvCW0BYeFKWMDiiE5J81uqc5K57JizuFGt%2Fz1o85%2BJy%2BjMH3qzXTrlJT6BgMzU4F9VkxLbcC%2FEJSUSKXmHZ7SXl6WOMQYY7QrqwRRTyuJhBgcgsJNJpo469TsdG2HNLHOoLvOh0r1qUb4NShRQXbvyrW5sVJRwnA9tiCLMVLWjWEJ4V5lZM9vN8oggjjRKK%2BavxfW0aZ7ker3lMII%2BCyK00hUq8zrBU6gMgCDY4xLORQNo3UVtiuMCpvTIWs00An5gAnU3Qk6%2FImYflyqeMRJ71MdWfL4VCNB26YZK3h7CTv1hHDmCOV1rvf4%2BedJx9vSsWlkIEz05Yby1XENRBg3JLDx0hUqDmJ9OWotexaL6Ksgd5A70mWmi5GSNI%2FK9zrse1UfviKVG5rT0ddGtdBUrjeWotIftC2v1BOA531w9VSf0H%2BVraMHt6NaD0SdvyphaG6fK4ehFnZOHkz5H4POk5Saod6PrMKfEpD5wHljRlV5kNu9TNOJ%2FjBC5GIMSLEKWr%2BMIixP0QbYu6xNnL8Pa7DWBY2Yf4XbTMMXZkLYGOpQCY7wbkL0qZqz%2BoriqgdERsshMO175%2FowVP3ErbmX9nRLkI1ZVeEfdof4a8d7QbpaGwg1iXRfLC8wwYnYhn1%2FF4OlnaKTvYKJ85wQnSWl5oqZ0STEn6m%2FQZponZawM7wlyl3k63YQ8IWjUfHczCQIpGvK9p7d0Q7J4r0jldXnUAFBDUlns%2FC6v5XWF0Tu%2FYZqY6gBDaVNOmIpPT1mqt3iCNLLE3rrPTcmeXhgFZbVCRQ6qSAN0vHL3GGlkfFbtGmXbfqULEjl5y39GmL1mGiegpQoP1Rl%2FNICadFBCHfBmXE%2Bhj8t9X9ACiIrOf205WXjv4jZ49I7X7po7vqVunlUymA9aJf4Iy0W%2B81t1bqwnc%2FJ5H%2BeT&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240820T081132Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5U2UU6JFS%2F20240820%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=696cebf459244ce024f5ed7dfc287c286e86b86cec51d64383325073f5b8d97c"
signing_files_zip         = "https://wlfdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/signig_files.zip?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaDmFwLXNvdXRoZWFzdC0xIkcwRQIhAL6eYiqwzIUG6LLxHVlvji46HB6zjYjIZfVmR0z9JGFiAiA5Eqx7bEsQ3Y6hNQ1orrePp2bIoIg7irFRPrOJqIq9XyrWAwhZEAAaDDQ2NDI2MjA2MTQzNSIM3MA3RtQzaLOL%2FTjGKrMDD2E60ddzTjYLSvdA%2Fp531KIgb9PJgDCZE3PvCW0BYeFKWMDiiE5J81uqc5K57JizuFGt%2Fz1o85%2BJy%2BjMH3qzXTrlJT6BgMzU4F9VkxLbcC%2FEJSUSKXmHZ7SXl6WOMQYY7QrqwRRTyuJhBgcgsJNJpo469TsdG2HNLHOoLvOh0r1qUb4NShRQXbvyrW5sVJRwnA9tiCLMVLWjWEJ4V5lZM9vN8oggjjRKK%2BavxfW0aZ7ker3lMII%2BCyK00hUq8zrBU6gMgCDY4xLORQNo3UVtiuMCpvTIWs00An5gAnU3Qk6%2FImYflyqeMRJ71MdWfL4VCNB26YZK3h7CTv1hHDmCOV1rvf4%2BedJx9vSsWlkIEz05Yby1XENRBg3JLDx0hUqDmJ9OWotexaL6Ksgd5A70mWmi5GSNI%2FK9zrse1UfviKVG5rT0ddGtdBUrjeWotIftC2v1BOA531w9VSf0H%2BVraMHt6NaD0SdvyphaG6fK4ehFnZOHkz5H4POk5Saod6PrMKfEpD5wHljRlV5kNu9TNOJ%2FjBC5GIMSLEKWr%2BMIixP0QbYu6xNnL8Pa7DWBY2Yf4XbTMMXZkLYGOpQCY7wbkL0qZqz%2BoriqgdERsshMO175%2FowVP3ErbmX9nRLkI1ZVeEfdof4a8d7QbpaGwg1iXRfLC8wwYnYhn1%2FF4OlnaKTvYKJ85wQnSWl5oqZ0STEn6m%2FQZponZawM7wlyl3k63YQ8IWjUfHczCQIpGvK9p7d0Q7J4r0jldXnUAFBDUlns%2FC6v5XWF0Tu%2FYZqY6gBDaVNOmIpPT1mqt3iCNLLE3rrPTcmeXhgFZbVCRQ6qSAN0vHL3GGlkfFbtGmXbfqULEjl5y39GmL1mGiegpQoP1Rl%2FNICadFBCHfBmXE%2Bhj8t9X9ACiIrOf205WXjv4jZ49I7X7po7vqVunlUymA9aJf4Iy0W%2B81t1bqwnc%2FJ5H%2BeT&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240820T081145Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5U2UU6JFS%2F20240820%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=589c952e4e833c77efeafcc1c7a1dfd49e9994c1728b689f3e1dab7f98a0f063"
open_ssl_win64_zip        = "https://wlfdb-artifacts.s3.ap-southeast-1.amazonaws.com/wlmdb/OpenSSL-Win64.zip?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaDmFwLXNvdXRoZWFzdC0xIkcwRQIhAL6eYiqwzIUG6LLxHVlvji46HB6zjYjIZfVmR0z9JGFiAiA5Eqx7bEsQ3Y6hNQ1orrePp2bIoIg7irFRPrOJqIq9XyrWAwhZEAAaDDQ2NDI2MjA2MTQzNSIM3MA3RtQzaLOL%2FTjGKrMDD2E60ddzTjYLSvdA%2Fp531KIgb9PJgDCZE3PvCW0BYeFKWMDiiE5J81uqc5K57JizuFGt%2Fz1o85%2BJy%2BjMH3qzXTrlJT6BgMzU4F9VkxLbcC%2FEJSUSKXmHZ7SXl6WOMQYY7QrqwRRTyuJhBgcgsJNJpo469TsdG2HNLHOoLvOh0r1qUb4NShRQXbvyrW5sVJRwnA9tiCLMVLWjWEJ4V5lZM9vN8oggjjRKK%2BavxfW0aZ7ker3lMII%2BCyK00hUq8zrBU6gMgCDY4xLORQNo3UVtiuMCpvTIWs00An5gAnU3Qk6%2FImYflyqeMRJ71MdWfL4VCNB26YZK3h7CTv1hHDmCOV1rvf4%2BedJx9vSsWlkIEz05Yby1XENRBg3JLDx0hUqDmJ9OWotexaL6Ksgd5A70mWmi5GSNI%2FK9zrse1UfviKVG5rT0ddGtdBUrjeWotIftC2v1BOA531w9VSf0H%2BVraMHt6NaD0SdvyphaG6fK4ehFnZOHkz5H4POk5Saod6PrMKfEpD5wHljRlV5kNu9TNOJ%2FjBC5GIMSLEKWr%2BMIixP0QbYu6xNnL8Pa7DWBY2Yf4XbTMMXZkLYGOpQCY7wbkL0qZqz%2BoriqgdERsshMO175%2FowVP3ErbmX9nRLkI1ZVeEfdof4a8d7QbpaGwg1iXRfLC8wwYnYhn1%2FF4OlnaKTvYKJ85wQnSWl5oqZ0STEn6m%2FQZponZawM7wlyl3k63YQ8IWjUfHczCQIpGvK9p7d0Q7J4r0jldXnUAFBDUlns%2FC6v5XWF0Tu%2FYZqY6gBDaVNOmIpPT1mqt3iCNLLE3rrPTcmeXhgFZbVCRQ6qSAN0vHL3GGlkfFbtGmXbfqULEjl5y39GmL1mGiegpQoP1Rl%2FNICadFBCHfBmXE%2Bhj8t9X9ACiIrOf205WXjv4jZ49I7X7po7vqVunlUymA9aJf4Iy0W%2B81t1bqwnc%2FJ5H%2BeT&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240820T081159Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAWYGBM3V5U2UU6JFS%2F20240820%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Signature=3a054f49effd56b47b0fe96b796806d319c7b6b06cbed60ef430ff2d7c2350be"

# for fci fsx
fsx_quorum_volume_name = "wlmdb-quorum"
fsx_quorum_volume_size = 100 #number

# ontap_sg_id
# sql_admin_accounts
