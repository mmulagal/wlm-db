# logs-analyzer

## Overview
The `logs-analyzer` package is designed to analyze SQL logs and provide remediation recommendations for errors found in the logs. It uses advanced filtering and analysis techniques to identify issues and suggest actionable solutions. Under the hood, it leverages AWS Bedrock for AI-driven insights and supports both MSSQL and PostgreSQL logs.

## Steps to Generate the `pkg` Bundle
1. Ensure you have Node.js installed on your system.
2. Navigate to the `logs-analyzer` directory:
   ```bash
   cd logs-analyzer
   ```
3. Install the required dependencies:
   ```bash
   npm install
   ```
4. Run the following command to generate the `pkg` bundle:
   ```bash
   npm run pkg
   ```
   This will create platform-specific binaries for Windows, macOS, and Linux in the `dist` directory.

## Steps to Run the Binary
1. Navigate to the directory containing the generated binary (e.g., `dist`).
2. Make the binary executable (if on macOS/Linux):
   ```bash
   chmod +x ./logs-analyzer-macos
   ```
3. Run the binary with the required arguments. For example:
   ```bash
   ./logs-analyzer-macos \
     --logs-path "/path/to/logs" \
     --job-id "your-job-id" \
     --instance-id "your-instance-id" \
     --region "us-east-1" \
     --log-level "info" \
     --timestamp 1715558400000
   ```
   - `--logs-path` (required): Path to the database application logs folder.
   - `--job-id` (required): Workload Factory job ID.
   - `--instance-id` (required): Workload Factory instance ID.
   - `--region` (required): AWS region.
   - `--log-level` (optional): Log level (`debug`, `info`, `warn`, `error`). Default: `info`.
   - `--timestamp` (optional): Timestamp (in milliseconds) of the last log statement to process. Default: 24 hours ago.
   - `--help` (optional): Show help.
4. The binary will analyze the logs and output remediation recommendations to the console or the specified output file.


## What the Package Does Under the Hood
- **Log Analysis**: The package reads and filters SQL logs to identify errors and their context.
- **AI-Driven Insights**: It uses AWS Bedrock to analyze error patterns and provide detailed remediation recommendations.
- **Cross-Platform Support**: The package supports MSSQL and PostgreSQL logs, making it versatile for different database systems.
- **Script Execution**: If additional scripts are required to gather more information, the package can execute them and incorporate the results into its analysis.

This package is designed to streamline the process of identifying and resolving database issues, saving time and effort for developers and database administrators.
