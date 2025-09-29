import randomize from 'randomatic';
import * as fs from 'fs';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { randomUUID } from 'crypto';
import { compressSync } from 'fflate';
import path from 'path';
import { AWS_REGIONS, RESOURCESTYPE } from '../consts';
import { checkAccount, getSubJobDescriptions } from '../utils';

const DEMO_PRODUCT_RATE = {
    ec2Instance: {
        compute: {
            pricePerUnit: 29.408,
            unit: 'Hrs'
        }
    },
    ec2Storage: {
        storage: {
            pricePerUnit: 0.08,
            unit: 'GB-Mo'
        }
    },
    vpc: {
        unknown: {
            pricePerUnit: 0.05,
            unit: 'Hourly'
        }
    },
    'ebsStorage-gp2': {
        storage: {
            pricePerUnit: 0.1,
            unit: 'GB-Mo'
        }
    },
    fsxnStorage: {
        iops: {
            pricePerUnit: 0.034,
            unit: 'IOPS-Mo'
        },
        unknown: {
            pricePerUnit: 0.0438,
            unit: 'GB-Mo'
        },
        readRequest: {
            pricePerUnit: 4e-7,
            unit: 'Operations'
        },
        storageSsd: {
            pricePerUnit: 0.25,
            unit: 'GB-Mo'
        },
        throughput: {
            pricePerUnit: 1.2,
            unit: 'MiBps-Mo'
        },
        writeRequest: {
            pricePerUnit: 0.000005,
            unit: 'Operations'
        }
    }
};
function masterStackData(
    accountId: string,
    resourceName: string,
    stackName: string,
    masterStackId: string,
    credentialsId: string,
    region: string
) {
    return [
        {
            id: masterStackId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Microsoft SQL server deployment with stack ${stackName};href:mockLink`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 420000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        }
    ];
}

function sqlFciServerStackData(
    accountId: string,
    resourceName: string,
    serverStackId: string,
    masterStackId: string,
    credentialsId: string,
    region: string
) {
    return [
        {
            id: serverStackId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying an SQL Server FCI with recommended best practices',
            status: JOBSTATUS.COMPLETED,
            description: 'Deploying an SQL Server FCI with recommended best practices',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 80000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying SqlFSxInstanceMAD2(AWS::EC2::Instance)',
            description: 'Configuring Windows Cluster and SQL FCI instance on standby node',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 80000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying SqlFSxInstanceMAD1(AWS::EC2::Instance)',
            description: 'Configuring Windows Cluster and SQL FCI instance on primary node',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 80000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying NetworkInterface2(AWS::EC2::NetworkInterface)',
            description: 'Creating network interfaces for the EC2 instance in standby subnet',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 80000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying NetworkInterface1(AWS::EC2::NetworkInterface)',
            description: 'Creating network interfaces for the EC2 instance in primary subnet',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 80000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 80000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying WorkloadSecurityGroup(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for SQL Server workloads',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 80000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying LaunchWizardSqlFSxProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to EC2 instances for SQL Server nodes',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 80000),
            initiator: 'SYSTEM'
        }
    ];
}

function fsxStackData(
    accountId: string,
    resourceName: string,
    stackName: string,
    existingFSxStackId: string,
    masterStackId: string,
    fsxType: string,
    credentialsId: string,
    region: string
) {
    return [
        {
            id: existingFSxStackId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Deploying ${stackName}-${fsxType}-${randomize('A0', 17)} `,
            description:
                fsxType === 'NewFSxStack'
                    ? 'Deploying new FSx for ONTAP file system for SQL Server workload'
                    : 'Deploying a storage virtual machine for the SQL Server workload on the FSx for ONTAP file system',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 180000),
            end_time: new Date(Date.now() - 150000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying FSxTempDbVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host tempdb',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 180000),
            end_time: new Date(Date.now() - 150000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying FSxClusterQuorumVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host witness disk for Windows Cluster',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 180000),
            end_time: new Date(Date.now() - 150000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying FSxClusterQuorumVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host witness disk for Windows Cluster',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 180000),
            end_time: new Date(Date.now() - 150000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying FSxDataVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host data files',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 180000),
            end_time: new Date(Date.now() - 150000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying FSxLogVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host log files',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 180000),
            end_time: new Date(Date.now() - 150000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying FSxSvmConfiguration(AWS::FSx::StorageVirtualMachine)',
            description: 'Creating a dedicated storage virtual machine (SVM) for the database workload',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 180000),
            end_time: new Date(Date.now() - 150000),
            initiator: 'SYSTEM'
        }
    ];
}

function validationStack2Data(
    accountId: string,
    resourceName: string,
    stackname: string,
    validationStack2Id: string,
    masterStackId: string,
    credentialsId: string,
    region: string
) {
    return [
        {
            id: validationStack2Id,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Deploying ${stackname}-ValidationStack2-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description: 'Standby subnet validation for SQL Server FCI deployment',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 240000),
            end_time: new Date(Date.now() - 200000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying ValidationNode2(AWS::EC2::Instance)',
            description:
                'Validating outbound connection to deployment resources in Amazon S3, Active Directory, and FSx for ONTAP',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 240000),
            end_time: new Date(Date.now() - 200000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying ValidationNode2WaitCondition(AWS::CloudFormation::WaitCondition)',
            description: 'Waiting for validation completion',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 240000),
            end_time: new Date(Date.now() - 200000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying DomainMemberSG(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for the validation instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 240000),
            end_time: new Date(Date.now() - 200000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 240000),
            end_time: new Date(Date.now() - 200000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying ValidationNode2WaitHandler(AWS::CloudFormation::WaitConditionHandle)',
            description: 'Signaling wait condition to resume next steps',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 240000),
            end_time: new Date(Date.now() - 200000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying ValidationInstanceProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to the validation instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 240000),
            end_time: new Date(Date.now() - 200000),
            initiator: 'SYSTEM'
        }
    ];
}

function validationStack1Data(
    accountId: string,
    resourceName: string,
    stackName: string,
    validationStack1Id: string,
    masterStackId: string,
    sqlDeploymentMode: string,
    credentialsId: string,
    region: string
) {
    return [
        {
            id: validationStack1Id,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Deploying ${stackName}-ValidationStack1-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description:
                sqlDeploymentMode.toLowerCase() === 'fci'
                    ? 'Primary subnet validation for SQL Server FCI deployment'
                    : 'Subnet Validation for deployment',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 300000),
            end_time: new Date(Date.now() - 280000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying ValidationNode1(AWS::EC2::Instance)',
            description:
                'Validating outbound connection to deployment resources in Amazon S3, Active Directory, and FSx for ONTAP',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 300000),
            end_time: new Date(Date.now() - 280000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying DomainMemberSG(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for the validation instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 300000),
            end_time: new Date(Date.now() - 280000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            status: JOBSTATUS.COMPLETED,
            description: 'Disabling instance metadata service v1 to use more secure v2',
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 300000),
            end_time: new Date(Date.now() - 280000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying ValidationInstanceProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to the validation instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 300000),
            end_time: new Date(Date.now() - 280000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying ValidationNode1WaitHandler(AWS::CloudFormation::WaitConditionHandle)',
            description: 'Signaling wait condition to resume next steps',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 300000),
            end_time: new Date(Date.now() - 280000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying ValidationNode1WaitCondition(AWS::CloudFormation::WaitCondition)',
            description: 'Waiting for validation completion',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 300000),
            end_time: new Date(Date.now() - 280000),
            initiator: 'SYSTEM'
        }
    ];
}

function sqlStandaloneStackData(
    accountId: string,
    resourceName: string,
    stackName: string,
    serverStackId: string,
    masterStackId: string,
    credentialsId: string,
    region: string
) {
    return [
        {
            id: serverStackId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Deploying ${stackName}-SQLStandaloneStack-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description: 'Deploying an SQL Server standalone instance with recommended best practices',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying SqlNode(AWS::EC2::Instance)',
            description: 'Configuring SQL Server standalone on an EC2 instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying NetworkInterface(AWS::EC2::NetworkInterface)',
            description: 'Creating network interfaces for the EC2 instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying LaunchWizardSqlFSxProfile(AWS::IAM::InstanceProfile)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Deploying WorkloadSecurityGroup(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for SQL Server workloads',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(),
            initiator: 'SYSTEM'
        }
    ];
}

function endpointData(
    accountId: string,
    resourceName: string,
    endpointStackId: string,
    masterStackId: string,
    credentialsId: string,
    region: string
) {
    return [
        {
            id: endpointStackId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'VpcEndpointStack',
            status: JOBSTATUS.COMPLETED,
            description: 'Creating VPC endpoints for S3 CloudFormation, SQS, SSM, CloudWatch services',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'HttpsSecurityGroup(AWS::EC2::SecurityGroup)',
            description: 'Creating security group to allow HTTPs access',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'S3Endpoint(AWS::EC2::VPCEndpoint)',
            description: 'Creating S3 gateway endpoint',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'CloudformationEndpoint(AWS::EC2::VPCEndpoint)',
            status: JOBSTATUS.COMPLETED,
            description: 'Creating CloudFormation endpoint',
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Ec2MessagesEndpoint(AWS::EC2::VPCEndpoint)',
            description: 'Creating EC2Messages endpoint',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'SqsEndpoint(AWS::EC2::VPCEndpoint)',
            description: 'Creating SQS endpoint',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'SsmEndpoint(AWS::EC2::VPCEndpoint)',
            description: 'Creating SSM endpoint',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'SsmMessagesEndpoint(AWS::EC2::VPCEndpoint)',
            description: 'Creating SSMMessages endpoint',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'FsxEndpoint(AWS::EC2::VPCEndpoint)',
            description: 'Creating FSxN endpoint',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'CloudwatchLogsEndpoint(AWS::EC2::VPCEndpoint)',
            description: 'Creating CloudWatch logs endpoint',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: endpointStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(Date.now() - 360000),
            end_time: new Date(Date.now() - 330000),
            initiator: 'SYSTEM'
        }
    ];
}

function saveFciConfigurationData(
    region: string,
    awsAccountId: string,
    credentialsId: string,
    dbName: string,
    configName: string
) {
    return {
        awsAccount: {
            selectedCredential: {
                value: `DemoDefaultCredential | Account: ${awsAccountId}`,
                label: `DemoDefaultCredential | Account: ${awsAccountId}`,
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    credentialsId,
                    name: 'DemoDefaultCredential',
                    arn: `arn:aws:iam::${awsAccountId}:role/demo_role`,
                    providerAccountId: awsAccountId
                }
            }
        },
        regionAndVpc: {
            selectedRegion: {
                value: region,
                label: region,
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    regionCode: region,
                    regionName: AWS_REGIONS.get(region)!
                }
            },
            selectedVPC: {
                value: 'VPC-1 | 172.30.0.0/20',
                label: 'VPC-1 | 172.30.0.0/20',
                label2: 'vpc-7d4a2818',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'vpc-7d4a2818',
                    name: 'VPC-1',
                    cidrBlock: '172.30.0.0/20',
                    availabilityZones: {
                        'availability-zone-1': [
                            {
                                id: 'subnet-5a37222d',
                                state: 'available',
                                vpcId: 'vpc-ba1ed1de',
                                cidrBlock: '192.168.16.0/24',
                                availabilityZone: 'availability-zone-1',
                                availableIps: 251,
                                tags: [
                                    {
                                        Key: 'KubernetesCluster',
                                        Value: 'netehenfhk'
                                    },
                                    {
                                        Key: 'eco-groupname',
                                        Value: 'HCL'
                                    },
                                    {
                                        Key: 'Name',
                                        Value: 'HCL-CC-1'
                                    },
                                    {
                                        Key: 'eco-shared-resource',
                                        Value: 'Y'
                                    }
                                ],
                                name: 'HCL-CC-1',
                                routeTableId: 'rtb-0dde1132a1c54f5e6'
                            }
                        ],
                        'availability-zone-2': [
                            {
                                id: 'subnet-74a1b303',
                                state: 'available',
                                vpcId: 'vpc-ba1ed1de',
                                cidrBlock: '192.168.17.0/24',
                                availabilityZone: 'availability-zone-2',
                                availableIps: 251,
                                tags: [
                                    {
                                        Key: 'Name',
                                        Value: 'HCL-CC-2'
                                    },
                                    {
                                        Key: 'eco-shared-resource',
                                        Value: 'Y'
                                    },
                                    {
                                        Key: 'eco-groupname',
                                        Value: 'HCL'
                                    }
                                ],
                                name: 'HCL-CC-2',
                                routeTableId: 'rtb-00d7acd615fac5414'
                            }
                        ]
                    }
                }
            }
        },
        availabilityZones: {
            selectedAzNode1: {
                value: 'availability-zone-1',
                label: 'availability-zone-1',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    availabilityZone: 'availability-zone-1',
                    subnets: ['subnet-5a37222d']
                }
            },
            selectedSubnetNode1: {
                value: '192.168.16.0/24',
                label: 'HCL-CC-1 | 192.168.16.0/24',
                label2: 'subnet-5a37222d',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'subnet-5a37222d',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.16.0/24',
                    availabilityZone: 'availability-zone-1',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'KubernetesCluster',
                            Value: 'netehenfhk'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        },
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-1'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        }
                    ],
                    name: 'HCL-CC-1',
                    routeTableId: 'rtb-0dde1132a1c54f5e6'
                }
            },
            selectedAzNode2: {
                value: 'availability-zone-2',
                label: 'availability-zone-2',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    availabilityZone: 'availability-zone-2',
                    subnets: ['subnet-74a1b303']
                }
            },
            selectedSubnetNode2: {
                value: '192.168.17.0/24',
                label: 'HCL-CC-2 | 192.168.17.0/24',
                label2: 'subnet-74a1b303',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'subnet-74a1b303',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.17.0/24',
                    availabilityZone: 'availability-zone-2',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-2'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        }
                    ],
                    name: 'HCL-CC-2',
                    routeTableId: 'rtb-00d7acd615fac5414'
                }
            }
        },
        securityGroup: {
            selectedSecurityType: 'Create a new security group',
            selectedExistingSecurityGroup: ''
        },
        operatingSystem: {
            label: 'Windows server 2016',
            value: '2016'
        },
        dbVersion: {
            value: '2019',
            label: 'SQL Server 2019'
        },
        dbDeploymentModel: {
            label: 'Failover cluster instance (FCI)',
            value: 'fci'
        },
        dbEdition: {
            label: 'SQL Server Standard Edition',
            value: 'Standard'
        },
        license: {
            selectedLicenseType: 'License included AMI',
            selectedLicenseId: {
                value: 'ami-0d8c9345f9123cfed',
                label: 'ami-0d8c9345f9123cfed',
                label2: 'Windows_Server-2019-English-Full-SQL_2022_Enterprise-2023.07.12',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    architecture: 'x86_64',
                    amiVal: 'ami-0d8c9345f9123cfed',
                    amiName: 'Windows_Server-2019-English-Full-SQL_2022_Enterprise-2023.07.12'
                }
            },
            selectedCustomAMI: null
        },
        dbName,
        dbCredentials: {
            name: 'sqlsa',
            password: ''
        },
        keyPair: {
            selectedKeyPair: {
                value: 'Key-Pair-1',
                label: 'Key-Pair-1',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'BbaGg1n7hqv8yUBMNb4R',
                    name: 'Key-Pair-1'
                }
            }
        },
        activeDirectory: {
            scenarioType: 'AWS_MANAGED_AD',
            domainName: {
                value: 'wlmdb1.com',
                label: 'wlmdb1.com',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    domainName: 'wlmdb1.com',
                    dnsIpAddress: '172.30.21.228,172.30.9.82',
                    adScenarioType: 'AWS_MANAGED_AD'
                }
            },
            domainAddress: '172.30.21.228,172.30.9.82',
            userName: 'admin',
            password: ''
        },
        instanceType: {
            value: 'm5.xlarge',
            label: 'm5.xlarge',
            label2: '4vCPU, 16 GiB RAM, 4750Mbps',
            isDisabled: false,
            disabledTitle: '',
            data: {
                instanceType: 'm5.xlarge',
                vCpus: 4,
                ramInMib: 16384,
                iopsInMbps: 4750,
                architecture: ['x86_64']
            }
        },
        fsxN: {
            fsxNType: 'Create new FSxN',
            fsxNName: '',
            fsxNNewUserName: 'fsxadmin',
            fsxNExistingUserName: 'fsxadmin',
            fsxNPassword: ''
        },
        storageCapacity: {
            capacity: '1024',
            unit: {
                value: 'GiB',
                label: 'GiB',
                label2: '',
                isDisabled: false,
                disabledTitle: ''
            }
        },
        provisionedIOPS: {
            provisionedType: 'Automatic',
            IOPSValue: ''
        },
        throughput: {
            value: '128 MBps',
            label: '128 MBps',
            label2: '',
            isDisabled: false,
            disabledTitle: ''
        },
        simpleNotification: {
            snsState: false,
            snsARN: ''
        },
        cloudWatch: true,
        encryption: {
            encryptionType: 'Select a key from your account',
            selectedRow: [
                {
                    id: 'V7TLB65sHeaGtk0SpA9N',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                }
            ],
            encryptionArn: ''
        },
        tags: [
            {
                key: '',
                value: ''
            }
        ],
        saveConfigName: configName,
        selectConfig: 'Easy create',
        loadConfig: 'bea41d12-95fc-4736-859b-0c9eba9acbba'
    };
}

function saveStandaloneConfigurationData(
    region: string,
    awsAccountId: string,
    credentialsId: string,
    dbName: string,
    configName: string
) {
    return {
        awsAccount: {
            selectedCredential: {
                value: `DemoDefaultCredential | Account: ${awsAccountId}`,
                label: `DemoDefaultCredential | Account: ${awsAccountId}`,
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    credentialsId,
                    name: 'DemoDefaultCredential',
                    arn: `arn:aws:iam::${awsAccountId},:role/demo_role`,
                    providerAccountId: awsAccountId
                }
            }
        },
        regionAndVpc: {
            selectedRegion: {
                value: region,
                label: AWS_REGIONS.get(region)!,
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    regionCode: region,
                    regionName: AWS_REGIONS.get(region)!
                }
            },
            selectedVPC: {
                value: 'VPC-1 | 172.30.0.0/20',
                label: 'VPC-1 | 172.30.0.0/20',
                label2: 'vpc-7d4a2818',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'vpc-7d4a2818',
                    name: 'VPC-1',
                    cidrBlock: '172.30.0.0/20',
                    availabilityZones: {
                        'availability-zone-1': [
                            {
                                id: 'subnet-5a37222d',
                                state: 'available',
                                vpcId: 'vpc-ba1ed1de',
                                cidrBlock: '192.168.16.0/24',
                                availabilityZone: 'availability-zone-1',
                                availableIps: 251,
                                tags: [
                                    {
                                        Key: 'KubernetesCluster',
                                        Value: 'netehenfhk'
                                    },
                                    {
                                        Key: 'eco-groupname',
                                        Value: 'HCL'
                                    },
                                    {
                                        Key: 'Name',
                                        Value: 'HCL-CC-1'
                                    },
                                    {
                                        Key: 'eco-shared-resource',
                                        Value: 'Y'
                                    }
                                ],
                                name: 'HCL-CC-1',
                                routeTableId: 'rtb-0dde1132a1c54f5e6'
                            }
                        ],
                        'availability-zone-2': [
                            {
                                id: 'subnet-74a1b303',
                                state: 'available',
                                vpcId: 'vpc-ba1ed1de',
                                cidrBlock: '192.168.17.0/24',
                                availabilityZone: 'availability-zone-2',
                                availableIps: 251,
                                tags: [
                                    {
                                        Key: 'Name',
                                        Value: 'HCL-CC-2'
                                    },
                                    {
                                        Key: 'eco-shared-resource',
                                        Value: 'Y'
                                    },
                                    {
                                        Key: 'eco-groupname',
                                        Value: 'HCL'
                                    }
                                ],
                                name: 'HCL-CC-2',
                                routeTableId: 'rtb-00d7acd615fac5414'
                            }
                        ]
                    }
                }
            }
        },
        availabilityZones: {
            selectedAzNode1: {
                value: 'availability-zone-1',
                label: 'availability-zone-1',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    availabilityZone: 'availability-zone-1',
                    subnets: ['subnet-5a37222d']
                }
            },
            selectedSubnetNode1: {
                value: '192.168.16.0/24',
                label: 'HCL-CC-1 | 192.168.16.0/24',
                label2: 'subnet-5a37222d',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'subnet-5a37222d',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.16.0/24',
                    availabilityZone: 'availability-zone-1',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'KubernetesCluster',
                            Value: 'netehenfhk'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        },
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-1'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        }
                    ],
                    name: 'HCL-CC-1',
                    routeTableId: 'rtb-0dde1132a1c54f5e6'
                }
            },
            selectedAzNode2: null
        },
        securityGroup: {
            selectedSecurityType: 'Use an existing security group',
            selectedExistingSecurityGroup: {
                value: 'sg-ad2b38d1',
                label: 'sg-ad2b38d1',
                label2: 'default',
                isDisabled: false,
                disabledTitle: ''
            }
        },
        operatingSystem: {
            label: 'Windows server 2019',
            value: '2019'
        },
        dbVersion: {
            value: '2019',
            label: 'SQL Server 2019',
            label2: '',
            isDisabled: false,
            disabledTitle: ''
        },
        dbDeploymentModel: {
            label: 'Single Instance',
            value: 'standalone'
        },
        dbEdition: {
            label: 'SQL Server Standard Edition',
            value: 'Standard'
        },
        license: {
            selectedLicenseType: 'License included AMI',
            selectedLicenseId: {
                value: 'ami-0fc838ee72f5b11fb',
                label: 'ami-0fc838ee72f5b11fb',
                label2: 'Windows_Server-2016-English-Full-Base_2017_Standard-2023.07.12',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    architecture: 'x86_64',
                    amiVal: 'ami-0fc838ee72f5b11fb',
                    amiName: 'Windows_Server-2016-English-Full-Base_2017_Standard-2023.07.12'
                }
            },
            selectedCustomAMI: null
        },
        dbName,
        dbCredentials: {
            name: 'sqlsa',
            password: ''
        },
        keyPair: {
            selectedKeyPair: {
                value: 'Key-Pair-1',
                label: 'Key-Pair-1',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'zPTwkI53Uufi0rq8p3Ia',
                    name: 'Key-Pair-1'
                }
            }
        },
        activeDirectory: {
            scenarioType: 'AWS_MANAGED_AD',
            domainName: {
                value: 'wlmdb1.com',
                label: 'wlmdb1.com',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    domainName: 'wlmdb1.com',
                    dnsIpAddress: '172.30.21.228,172.30.9.82',
                    adScenarioType: 'AWS_MANAGED_AD'
                }
            },
            domainAddress: '172.30.21.228,172.30.9.82',
            userName: 'admin',
            password: ''
        },
        instanceType: {
            value: 'm5.xlarge',
            label: 'm5.xlarge',
            label2: '4vCPU, 16 GiB RAM, 4750Mbps',
            isDisabled: false,
            disabledTitle: '',
            data: {
                instanceType: 'm5.xlarge',
                vCpus: 4,
                ramInMib: 16384,
                iopsInMbps: 4750,
                architecture: ['x86_64']
            }
        },
        fsxN: {
            fsxNType: 'Create new FSxN',
            fsxNName: '',
            fsxNNewUserName: 'fsxadmin',
            fsxNExistingUserName: 'fsxadmin',
            fsxNPassword: ''
        },
        storageCapacity: {
            capacity: '1024',
            unit: {
                value: 'GiB',
                label: 'GiB',
                label2: '',
                isDisabled: false,
                disabledTitle: ''
            }
        },
        provisionedIOPS: {
            provisionedType: 'Automatic',
            IOPSValue: ''
        },
        throughput: {
            value: '128 MBps',
            label: '128 MBps',
            label2: '',
            isDisabled: false,
            disabledTitle: ''
        },
        simpleNotification: {
            snsState: false,
            snsARN: null
        },
        cloudWatch: true,
        encryption: {
            encryptionType: 'Select a key from your account',
            selectedRow: [
                {
                    id: 'R6N9VibxGkKmE9TXPzUh',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                },
                {
                    id: 'Ox6ejEmJ8AyBORByhcLB',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                },
                {
                    id: '3SX1jZIl5TNU0rkwlRwN',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                }
            ],
            encryptionArn: ''
        },
        tags: [
            {
                key: '',
                value: ''
            }
        ],
        saveConfigName: configName,
        selectConfig: 'Standard create',
        loadConfig: ''
    };
}

function savePGSQLConfigurationData(
    region: string,
    awsAccountId: string,
    credentialsId: string,
    dbName: string,
    configName: string
) {
    return {
        awsAccount: {
            selectedCredential: {
                value: `DemoDefaultCredential | ${awsAccountId}`,
                label: `DemoDefaultCredential | ${awsAccountId}`,
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    credentialsId,
                    name: 'DemoDefaultCredential',
                    arn: `arn:aws:iam::${awsAccountId}:role/demo_role`,
                    providerAccountId: awsAccountId
                }
            }
        },
        regionAndVpc: {
            selectedRegion: {
                value: region,
                label: AWS_REGIONS.get(region)!,
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    regionCode: region,
                    regionName: AWS_REGIONS.get(region)!
                }
            },
            selectedVPC: {
                value: 'VPC-1 | 172.30.0.0/20',
                label: 'VPC-1 | 172.30.0.0/20',
                label2: 'vpc-7d4a2818',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'vpc-7d4a2818',
                    name: 'VPC-1',
                    cidrBlock: '172.30.0.0/20',
                    availabilityZones: {
                        'availability-zone-1': [
                            {
                                id: 'subnet-5a37222d',
                                state: 'available',
                                vpcId: 'vpc-ba1ed1de',
                                cidrBlock: '192.168.16.0/24',
                                availabilityZone: 'availability-zone-1',
                                availableIps: 251,
                                tags: [
                                    {
                                        Key: 'KubernetesCluster',
                                        Value: 'netehenfhk'
                                    },
                                    {
                                        Key: 'eco-groupname',
                                        Value: 'HCL'
                                    },
                                    {
                                        Key: 'Name',
                                        Value: 'HCL-CC-1'
                                    },
                                    {
                                        Key: 'eco-shared-resource',
                                        Value: 'Y'
                                    }
                                ],
                                name: 'HCL-CC-1',
                                routeTableId: 'rtb-0dde1132a1c54f5e6'
                            }
                        ],
                        'availability-zone-2': [
                            {
                                id: 'subnet-74a1b303',
                                state: 'available',
                                vpcId: 'vpc-ba1ed1de',
                                cidrBlock: '192.168.17.0/24',
                                availabilityZone: 'availability-zone-2',
                                availableIps: 251,
                                tags: [
                                    {
                                        Key: 'Name',
                                        Value: 'HCL-CC-2'
                                    },
                                    {
                                        Key: 'eco-shared-resource',
                                        Value: 'Y'
                                    },
                                    {
                                        Key: 'eco-groupname',
                                        Value: 'HCL'
                                    }
                                ],
                                name: 'HCL-CC-2',
                                routeTableId: 'rtb-00d7acd615fac5414'
                            }
                        ]
                    }
                }
            }
        },
        availabilityZones: {
            selectedAzNode1: {
                value: 'availability-zone-1',
                label: 'availability-zone-1',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    availabilityZone: 'availability-zone-1',
                    subnets: ['subnet-5a37222d']
                }
            },
            selectedSubnetNode1: {
                value: '192.168.16.0/24',
                label: 'HCL-CC-1 | 192.168.16.0/24',
                label2: 'subnet-5a37222d',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'subnet-5a37222d',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.16.0/24',
                    availabilityZone: 'availability-zone-1',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'KubernetesCluster',
                            Value: 'netehenfhk'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        },
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-1'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        }
                    ],
                    name: 'HCL-CC-1',
                    routeTableId: 'rtb-0dde1132a1c54f5e6'
                }
            },
            selectedAzNode2: null
        },
        securityGroup: {
            selectedSecurityType: 'Use an existing security group',
            selectedExistingSecurityGroup: {
                value: 'sg-ad2b38d1',
                label: 'sg-ad2b38d1',
                label2: 'default',
                isDisabled: false,
                disabledTitle: ''
            }
        },
        operatingSystem: {
            label: 'Amazon Linux 2023',
            value: '2023'
        },
        dbVersion: {
            value: '2016',
            label: 'PostgreSql Server 2016'
        },
        dbDeploymentModel: {
            label: 'Single Instance',
            value: 'standalone'
        },
        license: {
            selectedLicenseType: 'License included AMI',
            selectedLicenseId: null,
            selectedCustomAMI: null
        },
        sqlServerCollation: {},
        dbName,
        dbCredentials: {
            name: 'postgres',
            password: ''
        },
        keyPair: {
            selectedKeyPair: {
                value: 'Key-Pair-1',
                label: 'Key-Pair-1',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'uePZEMUrLI4A46GOkzJN',
                    name: 'Key-Pair-1'
                }
            }
        },
        instanceType: {
            value: 'm5.xlarge',
            label: 'm5.xlarge',
            label2: '4vCPU, 16 GiB RAM, 4750Mbps',
            isDisabled: false,
            disabledTitle: '',
            data: {
                instanceType: 'm5.xlarge',
                vCpus: 4,
                ramInMib: 16384,
                iopsInMbps: 4750,
                architecture: ['x86_64']
            }
        },
        fsxN: {
            fsxNType: 'fsxn_new',
            fsxNName: '',
            fsxNNewUserName: 'fsxadmin',
            fsxNExistingName: {
                value: 'fsx-wlmdb-DEFAULT | fs-56c418fc78',
                label: 'fsx-wlmdb-DEFAULT | fs-56c418fc78',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    fileSystemId: 'fs-56c418fc78',
                    fileSystemName: 'fsx-wlmdb-DEFAULT',
                    kmsKeyId: 'arn:aws:kms:us-east-1:951911461994:key/43XANJG1T14TPTKGG'
                }
            },
            fsxNExistingUserName: 'fsxadmin',
            fsxNPassword: ''
        },
        storageCapacity: {
            capacity: '1024',
            unit: {
                value: 'GiB',
                label: 'GiB',
                label2: '',
                isDisabled: false,
                disabledTitle: ''
            }
        },
        provisionedIOPS: {
            provisionedType: 'Automatic',
            IOPSValue: ''
        },
        throughput: {
            value: '128 MBps',
            label: '128 MBps',
            label2: '',
            isDisabled: false,
            disabledTitle: ''
        },
        simpleNotification: {
            snsState: false,
            snsARN: null
        },
        cloudWatch: true,
        snapshotPolicyToggle: true,
        encryption: {
            encryptionType: 'Select a key from your account',
            selectedRow: [
                {
                    id: 'es0MDhh64DcLgU86BJkb',
                    arn: 'PVnsnAPEFgREDT8LdEhL',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                },
                {
                    id: 'B9LDoBbmsIe5p7ksJLCh',
                    arn: 'riJwozxNXYKZ7dv9d6dA',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                },
                {
                    id: 'fo72p2xMzLLQcULnW5IH',
                    arn: 'RXAvRNBOekLAj7EB7XUB',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                }
            ],
            encryptionArn: ''
        },
        tags: [
            {
                key: '',
                value: ''
            }
        ],
        saveConfigName: configName,
        selectConfig: 'Standard create',
        loadConfig: '',
        selectedDatabaseType: 'PostgreSQL',
        postgreDeploymentType: 'Standalone instance',
        postgreOS: {
            value: 'Amazon Linux 2023 AMI',
            label: 'Amazon Linux 2023 AMI',
            label2: 'Amazon Linux 2023 AMI',
            isDisabled: false,
            disabledTitle: ''
        },
        postgreVersion: {
            value: 'postgresql16',
            label: 'postgresql16',
            label2: 'postgresql16',
            isDisabled: false,
            disabledTitle: ''
        },
        postgreServerName: 'pgsqlserver'
    };
}

function savePGSQLHaConfigurationData(
    region: string,
    awsAccountId: string,
    credentialsId: string,
    dbName: string,
    configName: string
) {
    return {
        awsAccount: {
            selectedCredential: {
                value: `DemoDefaultCredential | ${awsAccountId}`,
                label: `DemoDefaultCredential | ${awsAccountId}`,
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    credentialsId,
                    name: 'DemoDefaultCredential',
                    arn: `arn:aws:iam::${awsAccountId}:role/demo_role_auth0637c80cf46e3b8daf81a914e`,
                    providerAccountId: awsAccountId
                }
            }
        },
        regionAndVpc: {
            selectedRegion: {
                value: region,
                label: AWS_REGIONS.get(region)!,
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    regionCode: region,
                    regionName: AWS_REGIONS.get(region)!
                }
            },
            selectedVPC: {
                value: 'VPC-1 | 172.30.0.0/20',
                label: 'VPC-1 | 172.30.0.0/20',
                label2: 'vpc-7d4a2818',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'vpc-7d4a2818',
                    name: 'VPC-1',
                    cidrBlock: '172.30.0.0/20',
                    availabilityZones: {
                        'availability-zone-1': [
                            {
                                id: 'subnet-5a37222d',
                                state: 'available',
                                vpcId: 'vpc-ba1ed1de',
                                cidrBlock: '192.168.16.0/24',
                                availabilityZone: 'availability-zone-1',
                                availableIps: 251,
                                tags: [
                                    {
                                        Key: 'KubernetesCluster',
                                        Value: 'netehenfhk'
                                    },
                                    {
                                        Key: 'eco-groupname',
                                        Value: 'HCL'
                                    },
                                    {
                                        Key: 'Name',
                                        Value: 'HCL-CC-1'
                                    },
                                    {
                                        Key: 'eco-shared-resource',
                                        Value: 'Y'
                                    }
                                ],
                                name: 'HCL-CC-1',
                                routeTableId: 'rtb-0dde1132a1c54f5e6'
                            }
                        ],
                        'availability-zone-2': [
                            {
                                id: 'subnet-74a1b303',
                                state: 'available',
                                vpcId: 'vpc-ba1ed1de',
                                cidrBlock: '192.168.17.0/24',
                                availabilityZone: 'availability-zone-2',
                                availableIps: 251,
                                tags: [
                                    {
                                        Key: 'Name',
                                        Value: 'HCL-CC-2'
                                    },
                                    {
                                        Key: 'eco-shared-resource',
                                        Value: 'Y'
                                    },
                                    {
                                        Key: 'eco-groupname',
                                        Value: 'HCL'
                                    }
                                ],
                                name: 'HCL-CC-2',
                                routeTableId: 'rtb-00d7acd615fac5414'
                            }
                        ]
                    }
                }
            }
        },
        availabilityZones: {
            selectedAzNode1: {
                value: 'availability-zone-1',
                label: 'availability-zone-1',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    availabilityZone: 'availability-zone-1',
                    subnets: ['subnet-5a37222d']
                }
            },
            selectedSubnetNode1: {
                value: '192.168.16.0/24',
                label: 'HCL-CC-1 | 192.168.16.0/24',
                label2: 'subnet-5a37222d',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'subnet-5a37222d',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.16.0/24',
                    availabilityZone: 'availability-zone-1',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'KubernetesCluster',
                            Value: 'netehenfhk'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        },
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-1'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        }
                    ],
                    name: 'HCL-CC-1',
                    routeTableId: 'rtb-0dde1132a1c54f5e6'
                }
            },
            selectedAzNode2: {
                value: 'availability-zone-2',
                label: 'availability-zone-2',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    availabilityZone: 'availability-zone-2',
                    subnets: ['subnet-74a1b303']
                }
            },
            selectedSubnetNode2: {
                value: '192.168.17.0/24',
                label: 'HCL-CC-2 | 192.168.17.0/24',
                label2: 'subnet-74a1b303',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'subnet-74a1b303',
                    state: 'available',
                    vpcId: 'vpc-ba1ed1de',
                    cidrBlock: '192.168.17.0/24',
                    availabilityZone: 'availability-zone-2',
                    availableIps: 251,
                    tags: [
                        {
                            Key: 'Name',
                            Value: 'HCL-CC-2'
                        },
                        {
                            Key: 'eco-shared-resource',
                            Value: 'Y'
                        },
                        {
                            Key: 'eco-groupname',
                            Value: 'HCL'
                        }
                    ],
                    name: 'HCL-CC-2',
                    routeTableId: 'rtb-00d7acd615fac5414'
                }
            }
        },
        securityGroup: {
            selectedSecurityType: 'Use an existing security group',
            selectedExistingSecurityGroup: {
                value: 'sg-ad2b38d1',
                label: 'sg-ad2b38d1',
                label2: 'default',
                isDisabled: false,
                disabledTitle: ''
            }
        },
        operatingSystem: {
            label: 'Amazon Linux 2023',
            value: '2023'
        },
        dbVersion: {
            value: '2016',
            label: 'PostgreSql Server 2016'
        },
        dbDeploymentModel: {
            label: 'Failover cluster instance (FCI)',
            value: 'fci'
        },
        license: {
            selectedLicenseType: 'License included AMI',
            selectedLicenseId: null,
            selectedCustomAMI: null
        },
        sqlServerCollation: {},
        dbName,
        dbCredentials: {
            name: 'postgres',
            password: ''
        },
        keyPair: {
            selectedKeyPair: {
                value: 'Key-Pair-1',
                label: 'Key-Pair-1',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    id: 'EcP2PDOX6NUQFDKSOMXE',
                    name: 'Key-Pair-1'
                }
            }
        },
        instanceType: {
            value: 'm5.xlarge',
            label: 'm5.xlarge',
            label2: '4vCPU, 16 GiB RAM, 4750Mbps',
            isDisabled: false,
            disabledTitle: '',
            data: {
                instanceType: 'm5.xlarge',
                vCpus: 4,
                ramInMib: 16384,
                iopsInMbps: 4750,
                architecture: ['x86_64']
            }
        },
        fsxN: {
            fsxNType: 'fsxn_new',
            fsxNName: '',
            fsxNNewUserName: 'fsxadmin',
            fsxNExistingName: {
                value: 'fsx-wlmdb-DEFAULT | fs-a1d234bb6e87a',
                label: 'fsx-wlmdb-DEFAULT | fs-a1d234bb6e87a',
                label2: '',
                isDisabled: false,
                disabledTitle: '',
                data: {
                    fileSystemId: 'fs-a1d234bb6e87a',
                    fileSystemName: 'fsx-wlmdb-DEFAULT',
                    kmsKeyId: 'arn:aws:kms:eu-south-2:951911461994:key/XESZQNNYHHSRE6VFL'
                }
            },
            fsxNExistingUserName: 'fsxadmin',
            fsxNPassword: ''
        },
        storageCapacity: {
            capacity: '1024',
            unit: {
                value: 'GiB',
                label: 'GiB',
                label2: '',
                isDisabled: false,
                disabledTitle: ''
            }
        },
        provisionedIOPS: {
            provisionedType: 'Automatic',
            IOPSValue: ''
        },
        throughput: {
            value: '128 MBps',
            label: '128 MBps',
            label2: '',
            isDisabled: false,
            disabledTitle: ''
        },
        simpleNotification: {
            snsState: false,
            snsARN: null
        },
        cloudWatch: true,
        snapshotPolicyToggle: true,
        encryption: {
            encryptionType: 'Select a key from your account',
            selectedRow: [
                {
                    id: 'PzYId8vguOMMrUE6Nqhb',
                    arn: 'NWDnBoaBUkmdOahJLYss',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                },
                {
                    id: 'Vn0yCBjUEcLlnkFhQCVi',
                    arn: 'Bvahsy3LuDVcSBJIdow3',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                },
                {
                    id: 'QKHC2REqZJI9vWY9OMfL',
                    arn: '9iULssaon4glR7XEQWrA',
                    name: 'aws/fsx',
                    origin: 'AWS_KMS',
                    state: 'Enabled',
                    isDefault: true,
                    default: true
                }
            ],
            encryptionArn: ''
        },
        tags: [
            {
                key: '',
                value: ''
            }
        ],
        saveConfigName: configName,
        selectConfig: 'Standard create',
        loadConfig: '',
        selectedDatabaseType: 'PostgreSQL',
        postgreDeploymentType: 'High Availability instance',
        postgreOS: {
            value: 'Amazon Linux 2023 AMI',
            label: 'Amazon Linux 2023 AMI',
            label2: 'Amazon Linux 2023 AMI',
            isDisabled: false,
            disabledTitle: ''
        },
        postgreVersion: {
            value: 'postgresql16',
            label: 'postgresql16',
            label2: 'postgresql16',
            isDisabled: false,
            disabledTitle: ''
        },
        postgreServerName: 'postgres'
    };
}

function sandboxJobData(
    accountId: string,
    region: string,
    srcHost: string,
    targetHost: string,
    srcDb: string,
    destDb: string,
    parentJobId: string,
    credentialsId: string
) {
    return [
        {
            id: parentJobId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Creating sandbox ${destDb} in the target host ${targetHost}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: srcDb,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now() - 390000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Validate if the sandbox ${destDb} already exists in the target host ${targetHost}`,
            description: `Validate if the sandbox ${destDb} already exists in the target host ${targetHost}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: srcDb,
            parent_job_id: parentJobId,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now() - 300000),
            end_time: new Date(Date.now() - 300000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Get volume LUN mappings for source database ${srcDb}`,
            description: `Get the volume LUN mapping for the source database ${srcDb} of the host ${srcHost}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: srcDb,
            parent_job_id: parentJobId,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now() - 240000),
            end_time: new Date(Date.now() - 240000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Create ONTAP FlexClone volumes',
            description: 'Create ONTAP FlexClone volumes from the volumes mapped to the source SQL server',
            status: JOBSTATUS.COMPLETED,
            resource_name: srcDb,
            parent_job_id: parentJobId,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now() - 180000),
            end_time: new Date(Date.now() - 180000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: 'Discover cloned LUNs and create virtual mount point',
            description: `Discover cloned LUNs and create virtual mount points in the target host ${targetHost}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: srcDb,
            parent_job_id: parentJobId,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now() - 120000),
            end_time: new Date(Date.now() - 120000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Create sandbox ${destDb}`,
            description: `Create sandbox ${destDb} on the target host ${targetHost}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: srcDb,
            parent_job_id: parentJobId,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now() - 60000),
            end_time: new Date(Date.now() - 60000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Add extended properties to sandbox ${destDb}`,
            description: `Add extended properties to sandbox ${destDb} on the target host ${targetHost}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: srcDb,
            parent_job_id: parentJobId,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now()),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        }
    ];
}

function assessmentJobData(
    accountId: string,
    instanceDetails: any,
    credentialsId: string,
    region: string,
    parentJobId: string
) {
    accountId = checkAccount(accountId);
    const jobs = [];
    jobs.push({
        id: parentJobId,
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        name: `Assess online database server instances in your account ${accountId} for best practice misalignments.`,
        status: JOBSTATUS.COMPLETED,
        resource_name: accountId,
        type: JOBTYPE.ASSESSMENT,
        start_time: new Date(Date.now()),
        end_time: new Date(Date.now()),
        initiator: 'SYSTEM'
    });
    instanceDetails.forEach(
        (host: {
            resourceId: string;
            hostName: string;
            sqlInstances: { sqlInstanceId: string; sqlInstanceName: string }[];
        }) => {
            jobs.push({
                id: randomUUID(),
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                name: `Assess SQL Server host ${host.hostName} compute right sizing`,
                description: `Assess SQL Server host ${host.hostName} compute right sizing`,
                status: JOBSTATUS.COMPLETED,
                resource_name: host.hostName,
                parent_job_id: parentJobId,
                type: JOBTYPE.ASSESSMENT,
                start_time: new Date(Date.now()),
                end_time: new Date(Date.now()),
                initiator: 'SYSTEM'
            });
            host.sqlInstances.forEach((sqlInstance: { sqlInstanceId: string; sqlInstanceName: string }) => {
                sqlInstance.sqlInstanceName = sqlInstance.sqlInstanceName.replace(host.hostName, '');
                const instanceDetailsForJob = {
                    hostName: host.hostName,
                    resourceId: host.resourceId,
                    databaseInstanceId: sqlInstance.sqlInstanceId,
                    databaseInstanceName: sqlInstance.sqlInstanceName,
                    sqlServerDeploymentType: RESOURCESTYPE.MSSQL
                };
                const instanceDetailsForJobString = JSON.stringify(instanceDetailsForJob);
                jobs.push({
                    id: randomUUID(),
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    name: `Microsoft SQL Server storage assessment for instance ${host.hostName}\\${sqlInstance.sqlInstanceName}`,
                    description: `Microsoft SQL Server storage assessment for instance ${host.hostName}\\${sqlInstance.sqlInstanceName}. Review detailed findings and recommendations in.;${instanceDetailsForJobString}`,
                    status: JOBSTATUS.COMPLETED,
                    resource_name: `${host.hostName}\\${sqlInstance.sqlInstanceName}`,
                    parent_job_id: parentJobId,
                    type: JOBTYPE.ASSESSMENT,
                    start_time: new Date(Date.now()),
                    end_time: new Date(Date.now()),
                    initiator: 'SYSTEM'
                });
            });
        }
    );

    return jobs;
}

function optimizeStorageJobData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    instanceIds: string,
    resourceId: string
) {
    const instanceDetailsForJob = {
        hostName: resourceName,
        resourceId,
        databaseInstanceId: instanceIds,
        databaseInstanceName: instanceName,
        sqlServerDeploymentType: RESOURCESTYPE.MSSQL
    };
    const instanceDetailsForJobString = JSON.stringify(instanceDetailsForJob);
    return [
        {
            id: parentJobId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Fix storage for ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.WARNING,
            resource_name: resourceName,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 12000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Fixed 1/3 volumes ${resourceName}\\${instanceName}`,
            description: `Fixed 1/3 volumes ${resourceName}\\${instanceName}`,
            status: JOBSTATUS.FAILED,
            error: 'Setting storage parameter failed on volumes  datavol and sqldata',
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now() - 12000),
            end_time: new Date(Date.now() - 8000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            description: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.SANDBOX,
            start_time: new Date(Date.now() - 6000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        }
    ];
}

function optimizeOperatingSystemJobData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    instanceId: string,
    resourceId: string
) {
    const instanceDetailsForJob = {
        hostName: resourceName,
        resourceId,
        databaseInstanceId: instanceId,
        databaseInstanceName: instanceName,
        sqlServerDeploymentType: RESOURCESTYPE.MSSQL
    };
    const instanceDetailsForJobString = JSON.stringify(instanceDetailsForJob);
    return [
        {
            id: parentJobId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Fix operating system configuration for ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Validate MPIO policy to Round Robin on ${resourceName}\\${instanceName}`,
            description: `Validate MPIO policy to Round Robin on ${resourceName}\\${instanceName}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now() - 14000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Setting MPIO policy to Round Robin on ${resourceName}\\${instanceName}.`,
            description: `Setting MPIO policy to Round Robin on ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 14000),
            end_time: new Date(Date.now() - 8000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Validate MPIO policy to Round Robin on ${resourceName}\\${instanceName}`,
            description: `Validate MPIO policy to Round Robin on ${resourceName}\\${instanceName}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 8000),
            end_time: new Date(Date.now() - 4000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            description: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 4000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        }
    ];
}

function optimizeMpioSessionsJobData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    instanceId: string,
    resourceId: string
) {
    const instanceDetailsForJob = {
        hostName: resourceName,
        resourceId,
        databaseInstanceId: instanceId,
        databaseInstanceName: instanceName,
        sqlServerDeploymentType: RESOURCESTYPE.MSSQL
    };
    const instanceDetailsForJobString = JSON.stringify(instanceDetailsForJob);
    return [
        {
            id: parentJobId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Fix operating system MPIO iSCSI sessions for ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Validate MPIO iSCSCI sessions on ${resourceName}\\${instanceName}`,
            description: `Validate MPIO iSCSCI sessions on ${resourceName}\\${instanceName}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now() - 14000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Fix MPIO iSCSCI sessions on ${resourceName}\\${instanceName}.`,
            description: `Fix MPIO iSCSCI sessions on ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 14000),
            end_time: new Date(Date.now() - 8000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            description: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 4000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        }
    ];
}
function mockPGSqlStandaloneDeployementValidationStack(
    accountId: string,
    resourceName: string,
    parentJobId: string,
    credentialsId: string,
    region: string,
    sqlDeploymentMode: string
) {
    const stackType = sqlDeploymentMode === 'ha' ? 'PgSqlHAStack' : 'PgSqlStandaloneStack';
    const stackId = randomUUID();
    const jobStack = [
        {
            id: stackId,
            account_id: accountId,
            name: `Deploying WLMDB-${stackType}-1732253190348-ValidationStack1-1UCL90TQ3CFAP`,
            status: 'COMPLETED',
            resource_name: resourceName,
            credentials_id: credentialsId,
            type: 'DEPLOYMENT',
            start_time: new Date(Date.now() - 60000 * 17),
            description: 'Subnet Validation for deployment',
            parent_job_id: parentJobId,
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying ValidationNode1(AWS::EC2::Instance)',
            description: getSubJobDescriptions('PGSQL', sqlDeploymentMode)['ValidationNode1(AWS::EC2::Instance)'],
            start_time: new Date(Date.now() - 60000 * 18),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying ValidationInstanceProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to the validation instance',
            start_time: new Date(Date.now() - 60000 * 20),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            start_time: new Date(Date.now() - 60000 * 21),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        }
    ];

    if (sqlDeploymentMode === 'ha') {
        jobStack.push({
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying ValidationNode2(AWS::EC2::Instance)',
            description: getSubJobDescriptions('PGSQL', sqlDeploymentMode)['ValidationNode2(AWS::EC2::Instance)'],
            start_time: new Date(Date.now() - 60000 * 19),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        });
    }

    return jobStack;
}

function mockPGSqlStandaloneDeployementConfigureFSX(
    accountId: string,
    resourceName: string,
    parentJobId: string,
    credentialsId: string,
    region: string,
    stackName: string,
    FSXFileSystemId: string | undefined,
    sqlDeploymentMode: string
) {
    const fsxType = FSXFileSystemId ? 'ExistingFSxStack' : 'NewFSxStack';
    const stackId = randomUUID();
    const FSXDeployementJobStack = [
        {
            id: stackId,
            account_id: accountId,
            name: `Deploying ${stackName}-${fsxType}-${randomize('A0', 17)}`,
            status: 'COMPLETED',
            resource_name: resourceName,
            credentials_id: credentialsId,
            type: 'DEPLOYMENT',
            start_time: new Date(Date.now() - 60000 * 9),
            description:
                fsxType === 'NewFSxStack'
                    ? getSubJobDescriptions('PGSQL').NewFSxStack
                    : getSubJobDescriptions('PGSQL').ExistingFSxStack,
            parent_job_id: parentJobId,
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying FSxDataVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host data files',
            start_time: new Date(Date.now() - 60000 * 12),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying FSxLogVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host log files',
            start_time: new Date(Date.now() - 60000 * 13),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying FSxSvmConfiguration(AWS::FSx::StorageVirtualMachine)',
            description: 'Creating a dedicated storage virtual machine (SVM) for the database workload',
            start_time: new Date(Date.now() - 60000 * 14),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        }
    ];

    if (fsxType === 'NewFSxStack') {
        FSXDeployementJobStack.push({
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying FSxFileSystemConfiguration(AWS::FSx::FileSystem)',
            description: 'Creating a new FSx for ONTAP file system',
            start_time: new Date(Date.now() - 60000 * 15),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        });
        FSXDeployementJobStack.push({
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying ONTAPSecurityGroup(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for FSx for ONTAP',
            start_time: new Date(Date.now() - 60000 * 16),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        });
    }
    if (sqlDeploymentMode === 'ha') {
        FSXDeployementJobStack.push({
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying FSxReplicaLogVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host log files for replica instance',
            start_time: new Date(Date.now() - 60000 * 10),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        });
        FSXDeployementJobStack.push({
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying FSxReplicaDataVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host data files for replica instance',
            start_time: new Date(Date.now() - 60000 * 11),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        });
    }
    return FSXDeployementJobStack;
}

function mockPGSqlStandaloneDeploymentStackDeployPGSqlInstance(
    accountId: string,
    resourceName: string,
    parentJobId: string,
    credentialsId: string,
    region: string,
    sqlDeploymentMode: string
) {
    const stackType = sqlDeploymentMode === 'ha' ? 'PgSqlHAStack' : 'PgSqlStandaloneStack';
    const stackId = randomUUID();
    const jobStack = [
        {
            id: stackId,
            account_id: accountId,
            credentials_id: credentialsId,
            name: `Deploying WLMDB-${stackType}-1732253190348-PGSQLServerStack-UT03Q9P3LGW2`,
            status: 'COMPLETED',
            resource_name: resourceName,
            type: 'DEPLOYMENT',
            start_time: new Date(Date.now() - 60000 * 2),
            description: getSubJobDescriptions('PGSQL', sqlDeploymentMode).PGSQLServerStack,
            parent_job_id: parentJobId,
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying SqlNode(AWS::EC2::Instance)',
            description: getSubJobDescriptions('PGSQL', sqlDeploymentMode)['SqlNode1(AWS::EC2::Instance)'],
            start_time: new Date(Date.now() - 60000 * 4),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying NetworkInterface1(AWS::EC2::NetworkInterface)',
            description: getSubJobDescriptions('PGSQL', sqlDeploymentMode)[
                'NetworkInterface1(AWS::EC2::NetworkInterface)'
            ],
            start_time: new Date(Date.now() - 60000 * 5),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying WorkloadSecurityGroup(AWS::EC2::SecurityGroup)',
            description: getSubJobDescriptions('PGSQL')['WorkloadSecurityGroup(AWS::EC2::SecurityGroup)'],
            start_time: new Date(Date.now() - 60000 * 7),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying LaunchWizardSqlFSxProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to EC2 instances for PGSQL Server nodes',
            start_time: new Date(Date.now() - 60000 * 8),
            end_time: Date.now(),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        }
    ];
    if (sqlDeploymentMode === 'ha') {
        jobStack.push({
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying SqlNode2(AWS::EC2::Instance)',
            description: getSubJobDescriptions('PGSQL', sqlDeploymentMode)['SqlNode2(AWS::EC2::Instance)'],
            start_time: new Date(Date.now() - 60000 * 3),
            end_time: Date.now(),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        });
        jobStack.push({
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying NetworkInterface2(AWS::EC2::NetworkInterface)',
            description: getSubJobDescriptions('PGSQL', sqlDeploymentMode)[
                'NetworkInterface2(AWS::EC2::NetworkInterface)'
            ],
            start_time: new Date(Date.now() - 60000 * 6),
            end_time: Date.now(),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        });
    }

    return jobStack;
}

function mockCreateVpcEndpoint(
    accountId: string,
    resourceName: string,
    parentJobId: string,
    credentialsId: string,
    region: string
) {
    const stackId = randomUUID();
    return [
        {
            id: stackId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying WLMDB-PgSqlStandaloneStack-1732697250244-VpcEndpointStack-DEZ6RSGUG92G',
            description: 'Creating VPC endpoints for S3 CloudFormation, SQS, SSM, CloudWatch services',
            start_time: new Date(Date.now() - 60000 * 22),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: parentJobId
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            type: 'DEPLOYMENT',
            status: 'COMPLETED',
            resource_name: resourceName,
            name: 'Deploying HttpsSecurityGroup(AWS::EC2::SecurityGroup)',
            description: 'Creating security group to allow HTTPs access',
            start_time: new Date(Date.now() - 60000 * 23),
            end_time: Date.now(),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        }
    ];
}

async function mockPGSqlStandaloneDeploymentStack(
    accountId: string,
    resourceName: string,
    credentialsId: string,
    region: string,
    stackName: string,
    FSXFileSystemId: string | undefined,
    sqlDeploymentMode: string
) {
    accountId = checkAccount(accountId);
    const stackId = randomUUID();
    const parentStack = [
        {
            id: stackId,
            account_id: accountId,
            name: `PostgreSQL server deployment with stack ${stackName};href:mocklink`,
            status: 'COMPLETED',
            resource_name: resourceName,
            type: 'DEPLOYMENT',
            start_time: new Date(Date.now() - 60000).getTime(),
            credentials_id: credentialsId,
            region,
            end_time: Date.now()
        }
    ];
    const pgServerStack = mockPGSqlStandaloneDeploymentStackDeployPGSqlInstance(
        accountId,
        resourceName,
        stackId,
        credentialsId,
        region,
        sqlDeploymentMode
    );
    const fsxStack = mockPGSqlStandaloneDeployementConfigureFSX(
        accountId,
        resourceName,
        stackId,
        credentialsId,
        region,
        stackName,
        FSXFileSystemId,
        sqlDeploymentMode
    );
    const validationStack = mockPGSqlStandaloneDeployementValidationStack(
        accountId,
        resourceName,
        stackId,
        credentialsId,
        region,
        sqlDeploymentMode
    );
    const vpcEndpointStack = mockCreateVpcEndpoint(accountId, resourceName, stackId, credentialsId, region);
    return [...parentStack, ...vpcEndpointStack, ...validationStack, ...fsxStack, ...pgServerStack];
}

function optimizeStorageTierJobData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    instanceId: string,
    resourceId: string
) {
    const instanceDetailsForJob = {
        hostName: resourceName,
        resourceId,
        databaseInstanceId: instanceId,
        databaseInstanceName: instanceName,
        sqlServerDeploymentType: RESOURCESTYPE.MSSQL
    };
    const instanceDetailsForJobString = JSON.stringify(instanceDetailsForJob);
    return [
        {
            id: parentJobId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Fix storage-tier for ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Set volume tiering-policy to snapshot-only and cloud-retrieval-policy to promote for ${resourceName}\\${instanceName}`,
            description: `Set volume tiering-policy to snapshot-only and cloud-retrieval-policy to promote for ${resourceName}\\${instanceName}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now() - 14000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            description: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 14000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        }
    ];
}

function enableMPIOJobData(
    accountId: string,
    resourceName: string,
    instanceName: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    instanceId: string,
    resourceId: string
) {
    const instanceDetailsForJob = {
        hostName: resourceName,
        resourceId,
        databaseInstanceId: instanceId,
        databaseInstanceName: instanceName,
        sqlServerDeploymentType: RESOURCESTYPE.MSSQL
    };
    const instanceDetailsForJobString = JSON.stringify(instanceDetailsForJob);
    return [
        {
            id: parentJobId,
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Enable MPIO and configure for MPIO iSCSI sessions ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Check if MPIO is installed on ${resourceName}\\${instanceName}`,
            description: `Check if MPIO is installed on ${resourceName}\\${instanceName}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now() - 14000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Configure MPIO on ${resourceName}\\${instanceName}`,
            description: `Configure MPIO on ${resourceName}\\${instanceName}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now() - 14000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            description: `SQL Server instance(s) ${instanceName} has been scanned for best practice misalignments. Review detailed findings and recommendations in;${instanceDetailsForJobString}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.WELL_ARCHITECTED,
            start_time: new Date(Date.now() - 14000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        }
    ];
}

function generateBase64ForOnPrem(fileName: string) {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const JsonFilePath = path.join(__dirname, `onPremRecords/${fileName}`);
    const jsonData = fs.readFileSync(JsonFilePath, 'utf8');
    const jsonString = jsonData as string;

    // Encode JSON to Base64
    const base64Encoded = btoa(jsonString);

    // Convert Base64 string to Uint8Array
    const base64Bytes = new TextEncoder().encode(base64Encoded);

    // Compress the Base64 data using fflate
    const compressedData = compressSync(base64Bytes);

    // Convert the compressed data to Base64
    const compressedBase64 = btoa(String.fromCharCode(...compressedData));
    return compressedBase64;
}

const onpremStdBase64Content = generateBase64ForOnPrem('SQLServerDataResponse-DemoSTD.json');

const onpremStdUploadObject = {
    fileContent: onpremStdBase64Content,
    fileName: 'SQLServerDataResponse-GOLDEN-STD1.json'
};

const onpremFCIBase64Content = generateBase64ForOnPrem('SQLServerDataResponse-DemoFCI.json');

const onPremFCIUploadObject = {
    fileContent: onpremFCIBase64Content,
    fileName: 'SQLServerDataResponse-GOLD-FCI.json'
};

const onpremAOAGBase64Content = generateBase64ForOnPrem('SQLServerDataResponse-DemoAOAG.json');

const onPremAOAGAUploadObject = {
    fileContent: onpremAOAGBase64Content,
    fileName: 'SQLServerDataResponse-GOLDEN-AOAG.json'
};

const DEMO_REGISTER_RESPONSE = {
    databaseCount: '10',
    databaseServerEdition: 'Standard Edition (64-bit)',
    manageReadiness: {
        missingSqlCmd: false,
        assessment: {
            missingSqlPermissions: [],
            missingModules: []
        },
        remediation: {
            missingSqlPermissions: [],
            missingModules: []
        },
        dbcreation: {
            missingSqlPermissions: [],
            missingModules: []
        },
        sandbox: {
            missingSqlPermissions: [],
            missingModules: []
        },
        oracle: {
            missingModules: [],
            missingPermissions: []
        }
    }
};

const MockOracleServerDetails = {
    '7450008296037943419': {
        prettyName: 'Red Hat Enterprise Linux 8.10 (Ootpa)',
        name: 'Red Hat Enterprise Linux',
        version: '8.10 (Ootpa)',
        serverEdition: 'Enterprise Edition',
        serverVersion: '19c',
        activeNode: 'i-055ed011c2068033a',
        nodeNames: 'i-055ed011c2068033a',
        activeConnections: 54,
        creationDate: '2025-02-20T04:37:27Z'
    }
};

const demoFsxId = 'fs-0d5efc3057c4f12cb';

export {
    masterStackData,
    validationStack1Data,
    validationStack2Data,
    endpointData,
    sqlFciServerStackData,
    sqlStandaloneStackData,
    fsxStackData,
    saveFciConfigurationData,
    saveStandaloneConfigurationData,
    sandboxJobData,
    assessmentJobData,
    optimizeStorageJobData,
    optimizeOperatingSystemJobData,
    mockPGSqlStandaloneDeploymentStack,
    savePGSQLConfigurationData,
    savePGSQLHaConfigurationData,
    optimizeMpioSessionsJobData,
    optimizeStorageTierJobData,
    enableMPIOJobData,
    DEMO_PRODUCT_RATE,
    onpremStdUploadObject,
    onPremAOAGAUploadObject,
    onPremFCIUploadObject,
    DEMO_REGISTER_RESPONSE,
    MockOracleServerDetails,
    demoFsxId
};
