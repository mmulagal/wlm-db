# WLMDB Terraform Deployment

# Deploy an SQL Server on EC2 with Amazon FSx for NetApp ONTAP

This Terraform automates the deployment of a Windows SQL Server on Amazon EC2, utilizing Amazon FSx for NetApp ONTAP for storage. The deployment can be configured in two different models:

1. **Failover Cluster Instances (FCI)** with Multi-AZ Amazon FSx for NetApp ONTAP filesystem.
2. **Standalone Instance (Standalone)** with Single-AZ Amazon FSx for NetApp ONTAP filesystem.

### Features

- **VPC Endpoints**: Creates VPC Endpoints for private network deployments.
- **Validation Node**: Creates Single/Multiple validation Ec2 instances to do the set of validations for the Deployment.
- **FSx for NetApp ONTAP Volumes**: Configures three LUNs on FSxN volumes for SQL Data, SQL Log, and SQL TEMP.
- **Failover Cluster Support**: If the failover cluster deployment model is chosen, an additional SQL Quorum volume is created.
- **EC2 Instances**: Deploys EC2 instances with SQL Server 2016, 2019, or 2022 Standard editions.

### Deployment Models

1. **Failover Cluster Instances (FCI)**:
   - Multi-AZ deployment for high availability.
   - Creates multiple validation EC2 instances.
   - Configures SQL Quorum volume for cluster management.

2. **Standalone Instance**:
   - Single-AZ deployment.
   - Creates a single validation EC2 instance.

## Prerequisites

-   Terraform v1.9.5 or later
-   AWS account
-   AWS CLI installed and configured with your account
    - By default, this project will use the default profile.
    - To use a specific profile, mention the profile name in the `tfvars` file as `aws_profile`.

### Installation

### Windows

**Terraform**

1. Download the appropriate package for your system from the [Terraform downloads page](https://www.terraform.io/downloads.html).
2. Unzip the downloaded file to a location where you want to store the Terraform binary. For example, you might create a directory named `terraform` in your `C:\` drive.
3. Add the directory containing the Terraform binary to your system's PATH environment variable. You can do this by searching for "Environment Variables" in your computer's settings.

**AWS CLI**

1. Download the AWS CLI MSI installer for Windows from the [AWS CLI installation page](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-windows.html).
2. Run the downloaded MSI installer and follow the on-screen instructions.

### Mac

**Terraform**

1. If you have Homebrew installed, you can install Terraform by running:
   ```sh
   brew install terraform
   ```
2. If you don't have Homebrew, you can download the appropriate package for your system from the [Terraform downloads page](https://www.terraform.io/downloads.html) and move the Terraform binary to `/usr/local/bin/`.

**AWS CLI**

1. If you have Homebrew installed, you can install AWS CLI by running:
   ```sh
   brew install awscli
   ```
2. If you don't have Homebrew, you can download the AWS CLI package from the [AWS CLI installation page](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-mac.html) and follow the instructions to install it.

### Linux

**Terraform**

1. Download the appropriate package for your system from the [Terraform downloads page](https://www.terraform.io/downloads.html).
2. Unzip the downloaded file to a directory of your choice.
3. Move the Terraform binary to `/usr/local/bin/`:
   ```sh
   sudo mv terraform /usr/local/bin/
   ```

**AWS CLI**

1. Download the AWS CLI package from the [AWS CLI installation page](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-linux.html).
2. Unzip the package:
   ```sh
   unzip awscliv2.zip
   ```
3. Run the install script:
   ```sh
   sudo ./aws/install
   ```
```

## Variables

If any validation errors are thrown while running `terraform plan`, please fill in the necessary values to continue the deployment.

```markdown
## Initial Setup And Usage

### Step 1: Initialize Terraform

Before you can use Terraform, you need to initialize your working directory. This step downloads the necessary provider plugins and sets up the backend configuration.

```sh
terraform init
```

### Step 2: Update `terraform.tfvars` File

Update a file named `terraform.tfvars` in your project directory if any changes required. This file will contain the values for the variables required by your Terraform configuration. Fill in the necessary variables as described in the [Variables](#variables) section.

Example `terraform.tfvars` file:

```hcl
aws_profile = "default"
region      = "us-west-2"
instance_type = "t2.medium"
```

### Step 3: Plan the Deployment

The `terraform plan` command creates an execution plan, showing you what actions Terraform will take to achieve the desired state defined in your configuration files. This step helps you verify that the changes are as expected before applying them.

```sh
terraform plan
```

### Step 4: Apply the Changes

The `terraform apply` command executes the actions proposed in the plan to create, update, or delete resources in your infrastructure. Review the plan output carefully before confirming the apply operation.

```sh
terraform apply
```

### Step 5: Destroy the Deployment

When you no longer need the infrastructure, you can use the `terraform destroy` command to delete all the resources created by Terraform. Use this command with caution, as it will remove all the infrastructure defined in your configuration.

```sh
terraform destroy
```

**Note:** Please use the `terraform destroy` command carefully, as it will delete all the infrastructure created via Terraform.
```