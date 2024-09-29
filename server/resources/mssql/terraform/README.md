# Terraform Project

# Deploy an SQL Server on EC2 with Amazon FSx for NetApp ONTAP

The Terraform deployment will create a Single-AZ Amazon FSx for NetApp ONTAP filesystem, create three LUN's on FSxN volume, deploy EC2 instance with SQL Server 2016,2019 or 2022 Standard and attach the FSxN LUN's as **SQL Data** and **SQL Log** and **SQL TEMP** volumes.

## Prerequisites

-   Terraform v1.9.5 or later
-   AWS account
-   AWS CLI configured with your account

## Installation

### Windows

1. Download the appropriate package for your system from the [Terraform downloads page](https://www.terraform.io/downloads.html).

2. Unzip the downloaded file to a location where you want to store the Terraform binary. For example, you might create a directory named `terraform` in your `C:\` drive.

3. Add the directory containing the Terraform binary to your system's PATH environment variable. You can do this by searching for "Environment Variables" in your computer's settings.

### Mac

1. If you have Homebrew installed, you can install Terraform by running:

brew install terraform

If you don't have Homebrew, you can download the appropriate package for your system from the Terraform downloads page and move the Terraform binary to /usr/local/bin/.

## Variables

The following variables need to be set in the `terraform.tfvars` file:

-   `instance_type`: The type of instance to use (e.g., "t2.micro")

## Initial Setup And Usage

1. Initialize Terraform:
   terraform init

2. Create a terraform.tfvars file and fill in the necessary variables.
3. Plan the deployment:
   terraform plan
4. Apply the changes:
   terraform apply
5. Destroy the deployment: (Please use this carefully this will delete all the infrastructure created via terraform)
   terraform destroy
