# Deploy an SQL Server on EC2 with Amazon FSx for NetApp ONTAP

The sample terraform deployment will create a Single-AZ Amazon FSx for NetApp ONTAP filesystem, create two LUN's on FSxN volume, deploy EC2 instance with SQL Server 2022 Standard and attach the FSxN LUN's as **SQL Data** and **SQL Log** volumes.

#Install And Setup

Install the Terraform
Initialize the terraform on the directory using terraform init
Dry run the plan using terraform plan -out <planName>
Execute the plan using terraform apply <planName>
Remove the resources using terraform destroy
