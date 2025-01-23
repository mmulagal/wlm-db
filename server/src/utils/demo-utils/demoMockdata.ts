import randomize from 'randomatic';
import { DATABASE_DEPLOYMENT_TYPE, DATABASE_TYPE, JOBSTATUS, JOBTYPE } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AWS_REGIONS, RESOURCESTYPE } from '../consts';
import { checkAccount, getSubJobDescriptions } from '../utils';
import { OnPremTcoReportObject } from '../../lib/database/onprem-tco';

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
    const jobs = [];
    jobs.push({
        id: parentJobId,
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        name: `Assess online SQL Server instances out of 8 managed instances in your account ${accountId} for best practice misalignments.`,
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
            name: `Optimize storage for ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.WARNING,
            resource_name: resourceName,
            type: JOBTYPE.OPTIMIZATION,
            start_time: new Date(Date.now() - 12000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Optimized 1/3 volumes ${resourceName}\\${instanceName}`,
            description: `Optimized 1/3 volumes ${resourceName}\\${instanceName}`,
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
            name: `Optimize operating system configuration for ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            name: `Optimize operating system MPIO iSCSI sessions for ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
            start_time: new Date(Date.now() - 18000),
            end_time: new Date(Date.now() - 14000),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            name: `Optimize MPIO iSCSCI sessions on ${resourceName}\\${instanceName}.`,
            description: `Optimize MPIO iSCSCI sessions on ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            parent_job_id: parentJobId,
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
    region: string
) {
    const stackId = randomUUID();
    return [
        {
            id: stackId,
            account_id: accountId,
            name: 'Deploying WLMDB-PgSqlStandaloneStack-1732253190348-ValidationStack1-1UCL90TQ3CFAP',
            status: 'COMPLETED',
            resource_name: resourceName,
            credentials_id: credentialsId,
            type: 'DEPLOYMENT',
            start_time: new Date(Date.now() - 60000 * 14),
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
            description: 'Validating outbound connection to deployment resources in Amazon S3',
            start_time: new Date(Date.now() - 60000 * 15),
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
            start_time: new Date(Date.now() - 60000 * 16),
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
            start_time: new Date(Date.now() - 60000 * 17),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        }
    ];
}

function mockPGSqlStandaloneDeployementConfigureFSX(
    accountId: string,
    resourceName: string,
    parentJobId: string,
    credentialsId: string,
    region: string,
    stackName: string,
    FSXFileSystemId: string | undefined
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
            start_time: new Date(Date.now() - 60000 * 6),
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
            name: 'Deploying FSxTempDbVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host tempdb',
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
            name: 'Deploying FSxDataVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host data files',
            start_time: new Date(Date.now() - 60000 * 8),
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
            start_time: new Date(Date.now() - 60000 * 9),
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
            start_time: new Date(Date.now() - 60000 * 10),
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
            description: 'Creating a virtual machine (SVM) for the database workload',
            start_time: new Date(Date.now() - 60000 * 11),
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
            start_time: new Date(Date.now() - 60000 * 12),
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
            start_time: new Date(Date.now() - 60000 * 13),
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
    region: string
) {
    const stackId = randomUUID();
    return [
        {
            id: stackId,
            account_id: accountId,
            credentials_id: credentialsId,
            name: 'Deploying WLMDB-PgSqlStandaloneStack-1732253190348-SQLStandaloneStack-UT03Q9P3LGW2',
            status: 'COMPLETED',
            resource_name: resourceName,
            type: 'DEPLOYMENT',
            start_time: new Date(Date.now() - 60000 * 2),
            description: getSubJobDescriptions('PGSQL').SQLStandaloneStack,
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
            description: getSubJobDescriptions('PGSQL')['SqlNode(AWS::EC2::Instance)'],
            start_time: new Date(Date.now() - 60000 * 3),
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
            name: 'Deploying LaunchWizardSqlFSxProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to EC2 instances for PGSQL Server nodes',
            start_time: new Date(Date.now() - 60000 * 5),
            end_time: Date.now(),
            initiator: 'SYSTEM',
            parent_job_id: stackId
        }
    ];
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
            start_time: new Date(Date.now() - 60000 * 18),
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
            start_time: new Date(Date.now() - 60000 * 19),
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
    FSXFileSystemId: string | undefined
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
        region
    );
    const fsxStack = mockPGSqlStandaloneDeployementConfigureFSX(
        accountId,
        resourceName,
        stackId,
        credentialsId,
        region,
        stackName,
        FSXFileSystemId
    );
    const validationStack = mockPGSqlStandaloneDeployementValidationStack(
        accountId,
        resourceName,
        stackId,
        credentialsId,
        region
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
            name: `Optimize storage-tier for ${resourceName}\\${instanceName}.`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
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
            type: JOBTYPE.OPTIMIZATION,
            start_time: new Date(Date.now() - 14000),
            end_time: new Date(Date.now()),
            initiator: 'SYSTEM'
        }
    ];
}

const onPremRecords = (accountId: string): OnPremTcoReportObject[] => [
    {
        account_id: accountId,
        resource_id: randomize('A0', 8),
        database_type: DATABASE_TYPE.mssql,
        database_deployment_type: DATABASE_DEPLOYMENT_TYPE.AOAG,
        creation_time: new Date(),
        version: '1.0.0',
        host_config: {
            nodeDetails: [
                {
                    hostId: '3B791E42-87BF-0F62-A6B9-8879355A59BC',
                    ramSize: 8,
                    hostName: 'AOAG-Node1',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE1",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "E:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    }\r\n]',
                        RunspaceId: '39cbfe16-d06f-4545-b0c6-dac70bfe04c5',
                        PSComputerName: 'AOAG-Node1',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 4,
                    networkConfiguration: [
                        {
                            name: 'Intel(R) 82574L Gigabit Network Connection',
                            speedMbps: 953.67431640625,
                            adapterType: 'Ethernet 802.3'
                        },
                        {
                            name: 'Microsoft Failover Cluster Virtual Adapter',
                            speedMbps: 9536.7431640625,
                            adapterType: 'Ethernet 802.3'
                        }
                    ]
                },
                {
                    hostId: 'F5171E42-4C90-CCB7-ED0E-DAD2DC26DF09',
                    ramSize: 8,
                    hostName: 'AOAG-Node2',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE1",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "E:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    }\r\n]',
                        RunspaceId: '99c9529e-41f8-449b-bfa3-03d0e3f9546e',
                        PSComputerName: 'AOAG-Node2',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 4,
                    networkConfiguration: [
                        {
                            name: 'Intel(R) 82574L Gigabit Network Connection',
                            speedMbps: 953.67431640625,
                            adapterType: 'Ethernet 802.3'
                        },
                        {
                            name: 'Microsoft Failover Cluster Virtual Adapter',
                            speedMbps: 9536.7431640625,
                            adapterType: 'Ethernet 802.3'
                        }
                    ]
                }
            ],
            belongsToCluster: true,
            clusterNodeNames: ['AOAG-Node1', 'AOAG-Node2'],
            windowsSystemName: 'OnPrem-AOAG'
        },
        database_instances_data: [
            {
                iops: '[{"writeIops":"      10.18","readIops":"      10.00","writeBytesPerSec":"            10823456.36","readBytesPerSec":"              22147852.80"}]',
                collation: 'SQL_Romanian_CP1250_CS_AS',
                totalIops: '100.18',
                ownerNodes: '[{"primary":"AOAG-Node1"}]',
                sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
                sqlVersion: [
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                    '\tOct  8 2022 05:58:25 ',
                    '\tCopyright (C) 2022 Microsoft Corporation',
                    '\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor)',
                    ''
                ],
                instanceGuid: '8',
                isReadReplica: 'True',
                noOfDatabases: '1',
                cpuUtilization: '1',
                deploymentType: 'AOAG',
                memUtilization: '[{"used":6904355840,"total":8588910592,"remaining":7684554752,"percentUsed":10}]',
                sqlInstanceName: 'AOAG-Instance1',
                totalThroughput: '214511045.16',
                vcpusPerInstance: '8',
                storageDetailsByDb:
                    '[{"databaseName":"AG1NORMALDB1","allocatedSizeMb":160000,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":87021,"driveAvailableSizeMb":8679700},{"databaseName":"AOAGDB1","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86797},{"databaseName":"AOAGDB22","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86797},{"databaseName":"DB1","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86797},{"databaseName":"DB2","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86797},{"databaseName":"DB3","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86797}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"},{"IsUsingFeature":1,"FeatureDescription":"You have Availability Groups with > 1 database"}]'
            }
        ],
        assessment_data: {
            calculations: {
                multi: {
                    fsxCloneCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.25 },
                        ssdMonthlyCost: 0.02,
                        clonedCopiesCount: 1,
                        totalFsxnCapacity: 1073741824,
                        ssdStoragePerMonth: 85899345.92,
                        totalCloneMonthlyCost: 0.02,
                        desiredStorageCapacity: 85899345.92,
                        changeRateBetweenClones: 8,
                        monthlyChangeRatePercentage: 8,
                        effectiveFsxnStorageCapacity: 85899345.92,
                        percentageOfDataOnSsdStorage: 1,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapCalculation: {
                        maxSsdIops: 51200,
                        ebsCapacity: 1073741824,
                        includedIops: 3,
                        fsxnIopsPrice: 0.034,
                        maxThroughput: 4096,
                        maxSsdTierSize: 211106232532992,
                        ssdMonthlyCost: 256,
                        includedSsdIops: 3072,
                        numberOfVolumes: 1,
                        fsxnStoragePrice: { unit: 'UsdPerGiB', price: 0.25 },
                        requiredNumOfFsx: 1,
                        additionalSsdIops: 0,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0438 },
                        ratioAfterSavings: 1,
                        provisionedSsdIops: 3072,
                        ssdStoragePerMonth: 1073741824,
                        capacityMonthlyCost: 0,
                        capacityPoolStorage: 0,
                        fsxnThroughputPrice: 1.2,
                        desiredStorageCapacity: 1073741824,
                        billedAdditionalSsdIops: 0,
                        totalMonthlyCostForFSxSsd: 256,
                        totalMonthlyStorageCharge: 256,
                        requiredNumOfFsxFractional: 0.06,
                        minFileSystemsNumForSsdIops: 0.06,
                        minFileSystemsNumForStorage: 0.005208333333333333,
                        totalMonthlyCostForCapacity: 0,
                        effectiveFsxnStorageCapacity: 1073741824,
                        greaterOfSsdAndMinAllowedSsd: 1099511627776,
                        percentageOfDataOnSSDStorage: 1,
                        percentageOfDataOnSsdStorage: 1,
                        minThroughputCapacityRequired: 128,
                        provisionedThroughputCapacity: 128,
                        totalThroughputAndIopsMonthly: 153.6,
                        additionalBilledCostForSsdIops: 0,
                        dataOnCapacityPoolStorageFactor: 0,
                        suggestedFsxnThroughputCapacity: 128,
                        minFileSystemsNumForThroughputCapacity: 0.03125,
                        savingsFromCompressionAndDeduplication: 0,
                        totalMonthlyFsxnThroughputCapacityCost: 153.6,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapSnapshotCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.25 },
                        ssdMonthlyCost: 256,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0438 },
                        ratioAfterSavings: 1,
                        ssdStoragePerMonth: 8589934.592,
                        capacityMonthlyCost: 0.0031536,
                        capacityPoolStorage: 77309411.32800001,
                        desiredStorageCapacity: 85899345.92,
                        totalSnapshotMonthlyCost: 0.0051536,
                        totalMonthlyCostForCapacity: 0.0031536,
                        effectiveFsxnStorageCapacity: 85899345.92,
                        percentageOfDataOnSsdStorage: 0.1,
                        dataOnCapacityPoolStorageFactor: 0.9,
                        totalSnapshotMonthlyCostForFsxSsd: 0.002,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    }
                },
                ebsCalculation: {
                    gp2: {
                        ebsIopsCost: 0,
                        billableIops: 0,
                        billableMbps: 0,
                        hoursInAMonth: 730,
                        ebsStorageCost: 0.1,
                        numberOfVolumes: 1,
                        ebsCapacityPrice: { unit: 'UsdPerGiB', price: 0.1 },
                        ebsInstanceMonth: 1,
                        ebsThroughputCost: 0,
                        totalBillableIops: 0,
                        totalInstanceHours: 730,
                        ebsTotalCostMonthly: 0.152,
                        instanceAvgDuration: 730,
                        storageAmountPerVol: 1073741824,
                        billableThroughputGbps: 0,
                        billableThroughputMbps: 0
                    }
                },
                ebsCloneCalculation: {
                    gp2: { iops: 0, capacity: 0.1, throughput: 0, clonedCopiesCount: 1, totalCloneMonthlyCost: 0.1 }
                },
                ebsSnapshotCalculation: {
                    gp2: {
                        storageAmount: 1073741824,
                        totalSnapshots: 30,
                        ebsSnapshotCost: 0.052,
                        numberOfVolumes: 1,
                        ebsInstanceMonth: 1,
                        ebsSnapshotPrice: { unit: 'UsdPerGiB', price: 0.05 },
                        totalSnapshotCost: 0.052,
                        initialSnapshotCost: 0.05,
                        totalEbsSnapshotCost: 0.052,
                        monthlyCostOfSnapshots: 0.0001333333333333333,
                        monthlyCostPerSnapshot: 0.0001333333333333333,
                        incrementalSnapshotCost: 0.002,
                        amountChangedPerSnapshot: 2863311.530666667,
                        monthlyChangeRatePercentage: 8,
                        discountForPartialStorageMonth: 0.00006666666666666667
                    }
                },
                existingComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c3.xlarge',
                    machineDetails: [
                        {
                            price: 1.066,
                            basePrice: 0.376,
                            hoursInMonth: 730,
                            instanceType: 'c3.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 274.48,
                            licenseMonthlyPrice: 503.7,
                            instanceMonthlyPrice: 778.1800000000001
                        }
                    ],
                    computeHourlyPrice: 0.376,
                    computeMonthlyPrice: 274.48,
                    instanceMonthlyPrice: 778.1800000000001
                },
                existingLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Standard Edition',
                    licenseHourlyPrice: 0.6900000000000001,
                    licenseMonthlyPrice: 503.7
                },
                recommendedComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c3.xlarge',
                    machineDetails: [
                        {
                            price: 1.066,
                            basePrice: 0.376,
                            hoursInMonth: 730,
                            instanceType: 'c3.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 274.48,
                            licenseMonthlyPrice: 503.7,
                            instanceMonthlyPrice: 778.1800000000001
                        }
                    ],
                    computeHourlyPrice: 0.376,
                    computeMonthlyPrice: 274.48,
                    instanceMonthlyPrice: 778.1800000000001
                },
                recommendedLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Standard Edition',
                    licenseHourlyPrice: 0.6900000000000001,
                    licenseMonthlyPrice: 503.7
                }
            },
            storageSavings: {
                ebs: { iops: 0, total: 0.25, clones: 0.1, capacity: 0.1, snapshots: 0.05, throughput: 0 },
                fsx: { iops: 0, total: 409.63, clones: 0.02, capacity: 256, snapshots: 0.01, throughput: 153.6 },
                multi: {
                    fsxBreakdown: {
                        fsxDataLunSize: 473186907781,
                        fsxLogVolumeSize: 130126399640,
                        fsxDataVolumeSize: 520505598560,
                        fsxStorageCapacity: 1099511627776,
                        fsxBufferVolumeSize: 384829069722,
                        fsxQuorumVolumeSize: 12000000000,
                        fsxTempDbVolumeSize: 52050559856
                    },
                    fsxCalculation: {
                        ssdIop: 3072,
                        savings: 0,
                        useCase: 'Low-latency',
                        regionName: 'US East (N. Virginia)',
                        throughput: 0,
                        percentageSsd: 100,
                        deploymentType: 'Multi',
                        numberOfVolumes: 1,
                        capacityPoolTier: 0,
                        effectiveCapacity: 1073741824,
                        ssdTierReqCapacity: 1073741824,
                        throughputCapacity: 128,
                        totalStorageCapacity: 107374182400,
                        monthlySnapshotCapacity: 85899345.92
                    }
                },
                compute: {
                    existing: {
                        hoursInMonth: 730,
                        instanceType: 'c3.xlarge',
                        machineDetails: [
                            {
                                price: 1.066,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'c3.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 503.7,
                                instanceMonthlyPrice: 778.1800000000001
                            }
                        ],
                        computeHourlyPrice: 0.376,
                        computeMonthlyPrice: 274.48,
                        instanceMonthlyPrice: 778.1800000000001
                    },
                    recommended: {
                        hoursInMonth: 730,
                        instanceType: 'c3.xlarge',
                        machineDetails: [
                            {
                                price: 1.066,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'c3.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 503.7,
                                instanceMonthlyPrice: 778.1800000000001
                            }
                        ],
                        computeHourlyPrice: 0.376,
                        computeMonthlyPrice: 274.48,
                        instanceMonthlyPrice: 778.1800000000001
                    }
                },
                license: {
                    existing: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Standard Edition',
                        licenseHourlyPrice: 0.6900000000000001,
                        licenseMonthlyPrice: 503.7
                    },
                    recommended: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Standard Edition',
                        licenseHourlyPrice: 0.6900000000000001,
                        licenseMonthlyPrice: 503.7
                    }
                },
                totalSummary: { existing: 2778.4300000001, recommended: 1187.81 }
            }
        }
    },
    {
        account_id: accountId,
        resource_id: randomize('A0', 8),
        database_type: DATABASE_TYPE.mssql,
        database_deployment_type: DATABASE_DEPLOYMENT_TYPE.FCI,
        creation_time: new Date(),
        version: '1.0.0',
        host_config: {
            nodeDetails: [
                {
                    hostId: 'B1E71E42-B9BC-D5D4-9D4D-D828ED4C31AF',
                    ramSize: 8,
                    hostName: 'FCI-Node2',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE6",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "I:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE3",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE5",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "K:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE4",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "E:"\r\n    }\r\n]',
                        RunspaceId: 'e53b87a4-0509-41b5-bcbf-fb75a94aa85c',
                        PSComputerName: 'FCI-Node2',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 4,
                    networkConfiguration: [
                        {
                            name: 'Intel(R) 82574L Gigabit Network Connection',
                            speedMbps: 953.67431640625,
                            adapterType: 'Ethernet 802.3'
                        },
                        {
                            name: 'Microsoft Failover Cluster Virtual Adapter',
                            speedMbps: 9536.7431640625,
                            adapterType: 'Ethernet 802.3'
                        }
                    ]
                },
                {
                    hostId: '16D31E42-DDCA-BC7E-E26A-305FB0842EDD',
                    ramSize: 8,
                    hostName: 'FCI-Node1',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "G:"\r\n    }\r\n]',
                        RunspaceId: 'b8eea70a-90ea-467e-bc54-9190903449fa',
                        PSComputerName: 'FCI-Node1',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 4,
                    networkConfiguration: [
                        {
                            name: 'Intel(R) 82574L Gigabit Network Connection',
                            speedMbps: 953.67431640625,
                            adapterType: 'Ethernet 802.3'
                        },
                        {
                            name: 'Microsoft Failover Cluster Virtual Adapter',
                            speedMbps: 9536.7431640625,
                            adapterType: 'Ethernet 802.3'
                        }
                    ]
                },
                {
                    hostId: '9E031E42-5521-22B6-E0D1-1D1FCC152971',
                    ramSize: 8,
                    hostName: 'FCI-Node3',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '{\r\n    "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n    "model":  "VMware Virtual disk SCSI Disk Device",\r\n    "driveLetter":  "C:"\r\n}',
                        RunspaceId: 'a8faf787-a361-4f99-89c4-af667791a1e4',
                        PSComputerName: 'FCI-Node3',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 4,
                    networkConfiguration: [
                        {
                            name: 'Intel(R) 82574L Gigabit Network Connection',
                            speedMbps: 953.67431640625,
                            adapterType: 'Ethernet 802.3'
                        },
                        {
                            name: 'Microsoft Failover Cluster Virtual Adapter',
                            speedMbps: 9536.7431640625,
                            adapterType: 'Ethernet 802.3'
                        }
                    ]
                },
                {
                    hostId: '78FE1E42-0F35-F588-4AD6-1FBEC1365195',
                    ramSize: 8,
                    hostName: 'FCI-Node4',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '{\r\n    "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n    "model":  "VMware Virtual disk SCSI Disk Device",\r\n    "driveLetter":  "C:"\r\n}',
                        RunspaceId: 'e57a7c67-7f36-4ac6-a4e3-b363856b6f0f',
                        PSComputerName: 'FCI-Node4',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 4,
                    networkConfiguration: [
                        {
                            name: 'Intel(R) 82574L Gigabit Network Connection',
                            speedMbps: 953.67431640625,
                            adapterType: 'Ethernet 802.3'
                        },
                        {
                            name: 'Microsoft Failover Cluster Virtual Adapter',
                            speedMbps: 9536.7431640625,
                            adapterType: 'Ethernet 802.3'
                        }
                    ]
                }
            ],
            belongsToCluster: true,
            clusterNodeNames: ['FCI-Node1', 'FCI-Node2', 'FCI-Node3', 'FCI-Node4'],
            windowsSystemName: 'OnPrem-FCI'
        },
        database_instances_data: [
            {
                iops: '[{"writeIops":"      0.00","readIops":"      0.00","writeBytesPerSec":"               31.01","readBytesPerSec":"               66.47"}]',
                collation: 'SQL_Icelandic_Pref_CP1_CI_AS',
                totalIops: 0,
                ownerNodes:
                    '[{"nodeName":"FCI-Node3","nodeRole":"Standby"},{"nodeName":"FCI-Node4","nodeRole":"Standby"},{"nodeName":"FCI-Node2","nodeRole":"Standby"},{"nodeName":"FCI-Node1","nodeRole":"Primary"}]',
                sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
                sqlVersion: [
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                    '\tOct  8 2022 05:58:25 ',
                    '\tCopyright (C) 2022 Microsoft Corporation',
                    '\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor)',
                    ''
                ],
                instanceGuid: 'AD5BF4D8-E683-4E3A-BF88-EA5B40FE9AAC',
                totalStorage: 100.015625,
                noOfDatabases: '5',
                cpuUtilization: '1',
                deploymentType: 'fci',
                memUtilization: '[{"used":561774592,"total":8588910592,"remaining":8027136000,"percentUsed":6}]',
                sqlInstanceName: 'MSSQLSERVER',
                totalThroughput: 0.000002044202896211656,
                vcpusPerInstance: '4',
                storageDetailsByDb:
                    '[{"databaseName":"test1","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"G:","driveTotalSizeMb":25581,"driveAvailableSizeMb":24104}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]'
            },
            {
                iops: '[{"writeIops":"      0.00","readIops":"      0.00","writeBytesPerSec":"               33.18","readBytesPerSec":"               68.91"}]',
                collation: 'SQL_Croatian_CP1250_CI_AS',
                totalIops: 0,
                ownerNodes:
                    '[{"nodeName":"FCI-Node3","nodeRole":"Standby"},{"nodeName":"FCI-Node4","nodeRole":"Standby"},{"nodeName":"FCI-Node2","nodeRole":"Primary"}]',
                sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
                sqlVersion: [
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                    '\tOct  8 2022 05:58:25 ',
                    '\tCopyright (C) 2022 Microsoft Corporation',
                    '\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor)',
                    ''
                ],
                instanceGuid: 'E7A86AFB-12D4-4A69-8942-43E548CAD2B2',
                totalStorage: 100.015625,
                noOfDatabases: '5',
                cpuUtilization: '1',
                deploymentType: 'fci',
                memUtilization: '[{"used":574230528,"total":8588910592,"remaining":8014680064,"percentUsed":6}]',
                sqlInstanceName: 'FCIInstance1',
                totalThroughput: 0.000001980641866894355,
                vcpusPerInstance: '4',
                storageDetailsByDb:
                    '[{"databaseName":"test","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":26605,"driveAvailableSizeMb":24663}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]'
            },
            {
                iops: '[{"writeIops":"      0.00","readIops":"      0.00","writeBytesPerSec":"               33.20","readBytesPerSec":"               69.05"}]',
                collation: 'SQL_AltDiction_CP850_CI_AI',
                totalIops: 0,
                ownerNodes:
                    '[{"nodeName":"FCI-Node4","nodeRole":"Standby"},{"nodeName":"FCI-Node2","nodeRole":"Primary"}]',
                sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
                sqlVersion: [
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                    '\tOct  8 2022 05:58:25 ',
                    '\tCopyright (C) 2022 Microsoft Corporation',
                    '\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor)',
                    ''
                ],
                instanceGuid: '3',
                totalStorage: 100.015625,
                noOfDatabases: '5',
                cpuUtilization: '2',
                deploymentType: 'fci',
                memUtilization: '[{"used":565460992,"total":8588910592,"remaining":8023449600,"percentUsed":6}]',
                sqlInstanceName: 'FCIInstance2',
                totalThroughput: 0.000001983470227344926,
                vcpusPerInstance: '4',
                storageDetailsByDb:
                    '[{"databaseName":"test","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"K:","driveTotalSizeMb":27629,"driveAvailableSizeMb":26158}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]'
            }
        ],
        assessment_data: {
            calculations: {
                single: {
                    fsxCloneCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ssdMonthlyCost: 0.01,
                        clonedCopiesCount: 1,
                        totalFsxnCapacity: 1073741824,
                        ssdStoragePerMonth: 85899345.92,
                        totalCloneMonthlyCost: 0.01,
                        desiredStorageCapacity: 85899345.92,
                        changeRateBetweenClones: 8,
                        monthlyChangeRatePercentage: 8,
                        effectiveFsxnStorageCapacity: 85899345.92,
                        percentageOfDataOnSsdStorage: 1,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapCalculation: {
                        maxSsdIops: 51200,
                        ebsCapacity: 1073741824,
                        includedIops: 3,
                        fsxnIopsPrice: 0.017,
                        maxThroughput: 4096,
                        maxSsdTierSize: 211106232532992,
                        ssdMonthlyCost: 128,
                        includedSsdIops: 3072,
                        numberOfVolumes: 1,
                        fsxnStoragePrice: { unit: 'UsdPerGiB', price: 0.125 },
                        requiredNumOfFsx: 1,
                        additionalSsdIops: 0,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0219 },
                        ratioAfterSavings: 1,
                        provisionedSsdIops: 3072,
                        ssdStoragePerMonth: 1073741824,
                        capacityMonthlyCost: 0,
                        capacityPoolStorage: 0,
                        fsxnThroughputPrice: 0.72,
                        desiredStorageCapacity: 1073741824,
                        billedAdditionalSsdIops: 0,
                        totalMonthlyCostForFSxSsd: 128,
                        totalMonthlyStorageCharge: 128,
                        requiredNumOfFsxFractional: 0.06,
                        minFileSystemsNumForSsdIops: 0.06,
                        minFileSystemsNumForStorage: 0.005208333333333333,
                        totalMonthlyCostForCapacity: 0,
                        effectiveFsxnStorageCapacity: 1073741824,
                        greaterOfSsdAndMinAllowedSsd: 1099511627776,
                        percentageOfDataOnSSDStorage: 1,
                        percentageOfDataOnSsdStorage: 1,
                        minThroughputCapacityRequired: 128,
                        provisionedThroughputCapacity: 128,
                        totalThroughputAndIopsMonthly: 92.16,
                        additionalBilledCostForSsdIops: 0,
                        dataOnCapacityPoolStorageFactor: 0,
                        suggestedFsxnThroughputCapacity: 128,
                        minFileSystemsNumForThroughputCapacity: 0.03125,
                        savingsFromCompressionAndDeduplication: 0,
                        totalMonthlyFsxnThroughputCapacityCost: 92.16,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapSnapshotCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ssdMonthlyCost: 128,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0219 },
                        ratioAfterSavings: 1,
                        ssdStoragePerMonth: 8589934.592,
                        capacityMonthlyCost: 0.0015768,
                        capacityPoolStorage: 77309411.32800001,
                        desiredStorageCapacity: 85899345.92,
                        totalSnapshotMonthlyCost: 0.0025768,
                        totalMonthlyCostForCapacity: 0.0015768,
                        effectiveFsxnStorageCapacity: 85899345.92,
                        percentageOfDataOnSsdStorage: 0.1,
                        dataOnCapacityPoolStorageFactor: 0.9,
                        totalSnapshotMonthlyCostForFsxSsd: 0.001,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    }
                },
                ebsCalculation: {
                    gp2: {
                        ebsIopsCost: 0,
                        billableIops: 0,
                        billableMbps: 0,
                        hoursInAMonth: 730,
                        ebsStorageCost: 0.3,
                        numberOfVolumes: 3,
                        ebsCapacityPrice: { unit: 'UsdPerGiB', price: 0.1 },
                        ebsInstanceMonth: 3,
                        ebsThroughputCost: 0,
                        totalBillableIops: 0,
                        totalInstanceHours: 2190,
                        ebsTotalCostMonthly: 0.4560000000000001,
                        instanceAvgDuration: 730,
                        storageAmountPerVol: 1073741824,
                        billableThroughputGbps: 0,
                        billableThroughputMbps: 0
                    }
                },
                ebsCloneCalculation: {
                    gp2: { iops: 0, capacity: 0.3, throughput: 0, clonedCopiesCount: 1, totalCloneMonthlyCost: 0.3 }
                },
                ebsSnapshotCalculation: {
                    gp2: {
                        storageAmount: 3221225472,
                        totalSnapshots: 30,
                        ebsSnapshotCost: 0.156,
                        numberOfVolumes: 3,
                        ebsInstanceMonth: 3,
                        ebsSnapshotPrice: { unit: 'UsdPerGiB', price: 0.05 },
                        totalSnapshotCost: 0.052,
                        initialSnapshotCost: 0.05,
                        totalEbsSnapshotCost: 0.156,
                        monthlyCostOfSnapshots: 0.0001333333333333333,
                        monthlyCostPerSnapshot: 0.0001333333333333333,
                        incrementalSnapshotCost: 0.002,
                        amountChangedPerSnapshot: 2863311.530666667,
                        monthlyChangeRatePercentage: 8,
                        discountForPartialStorageMonth: 0.00006666666666666667
                    }
                },
                existingComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c5.xlarge, c5.xlarge',
                    machineDetails: [
                        {
                            price: 0.834,
                            basePrice: 0.354,
                            hoursInMonth: 730,
                            instanceType: 'c5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 258.42,
                            licenseMonthlyPrice: 700.8,
                            instanceMonthlyPrice: 608.8199999999999
                        },
                        {
                            price: 0.834,
                            basePrice: 0.354,
                            hoursInMonth: 730,
                            instanceType: 'c5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 258.42,
                            licenseMonthlyPrice: 700.8,
                            instanceMonthlyPrice: 608.8199999999999
                        }
                    ],
                    computeHourlyPrice: 0.708,
                    computeMonthlyPrice: 516.8399999999999,
                    instanceMonthlyPrice: 1217.64
                },
                existingLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Standard Edition',
                    licenseHourlyPrice: 0.96,
                    licenseMonthlyPrice: 700.8
                },
                recommendedComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c5.xlarge, c5.xlarge',
                    machineDetails: [
                        {
                            price: 0.834,
                            basePrice: 0.354,
                            hoursInMonth: 730,
                            instanceType: 'c5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 258.42,
                            licenseMonthlyPrice: 700.8,
                            instanceMonthlyPrice: 608.8199999999999
                        },
                        {
                            price: 0.834,
                            basePrice: 0.354,
                            hoursInMonth: 730,
                            instanceType: 'c5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 258.42,
                            licenseMonthlyPrice: 700.8,
                            instanceMonthlyPrice: 608.8199999999999
                        }
                    ],
                    computeHourlyPrice: 0.708,
                    computeMonthlyPrice: 516.8399999999999,
                    instanceMonthlyPrice: 1217.64
                },
                recommendedLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Standard Edition',
                    licenseHourlyPrice: 0.96,
                    licenseMonthlyPrice: 700.8
                }
            },
            storageSavings: {
                ebs: { iops: 0, total: 0.76, clones: 0.3, capacity: 0.3, snapshots: 0.16, throughput: 0 },
                fsx: { iops: 0, total: 220.17, clones: 0.01, capacity: 128, snapshots: 0, throughput: 92.16 },
                compute: {
                    existing: {
                        hoursInMonth: 730,
                        instanceType: 'c5.xlarge, c5.xlarge',
                        machineDetails: [
                            {
                                price: 0.834,
                                basePrice: 0.354,
                                hoursInMonth: 730,
                                instanceType: 'c5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 258.42,
                                licenseMonthlyPrice: 700.8,
                                instanceMonthlyPrice: 608.8199999999999
                            },
                            {
                                price: 0.834,
                                basePrice: 0.354,
                                hoursInMonth: 730,
                                instanceType: 'c5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 258.42,
                                licenseMonthlyPrice: 700.8,
                                instanceMonthlyPrice: 608.8199999999999
                            }
                        ],
                        computeHourlyPrice: 0.708,
                        computeMonthlyPrice: 516.8399999999999,
                        instanceMonthlyPrice: 1217.64
                    },
                    recommended: {
                        hoursInMonth: 730,
                        instanceType: 'c3.xlarge, c3.xlarge',
                        machineDetails: [
                            {
                                price: 1.066,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'c3.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 1007.4,
                                instanceMonthlyPrice: 778.1800000000001
                            },
                            {
                                price: 1.066,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'c3.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 1007.4,
                                instanceMonthlyPrice: 778.1800000000001
                            }
                        ],
                        computeHourlyPrice: 0.752,
                        computeMonthlyPrice: 548.96,
                        instanceMonthlyPrice: 1556.36
                    }
                },
                license: {
                    existing: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Standard Edition',
                        licenseHourlyPrice: 0.96,
                        licenseMonthlyPrice: 700.8
                    },
                    recommended: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Standard Edition',
                        licenseHourlyPrice: 1.38,
                        licenseMonthlyPrice: 1007.4
                    }
                },
                totalSummary: { existing: 2218.4, recommended: 1776.53 }
            }
        }
    },
    {
        account_id: accountId,
        resource_id: randomize('A0', 8),
        database_type: DATABASE_TYPE.mssql,
        database_deployment_type: DATABASE_DEPLOYMENT_TYPE.Standalone,
        creation_time: new Date(),
        version: '1.0.0',
        host_config: {
            nodeDetails: [
                {
                    hostId: '12C01E42-1349-4206-82FE-99795431ECEF',
                    ramSize: 8,
                    hostName: 'OnPrem-Standalone',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {},
                    numberOfVcpus: 4,
                    networkConfiguration: [
                        {
                            name: 'Intel(R) 82574L Gigabit Network Connection',
                            speedMbps: 953.67431640625,
                            adapterType: 'Ethernet 802.3'
                        },
                        {
                            name: 'Microsoft Failover Cluster Virtual Adapter',
                            speedMbps: 9536.7431640625,
                            adapterType: 'Ethernet 802.3'
                        }
                    ]
                }
            ],
            belongsToCluster: false,
            clusterNodeNames: ['OnPrem-Standalone'],
            windowsSystemName: 'OnPrem-Standalone'
        },
        database_instances_data: [
            {
                iops: '[{"writeIops":"      0.00","readIops":"      0.00","writeBytesPerSec":"               44.78","readBytesPerSec":"              218.64"}]',
                collation: 'SQL_Latin1_General_CP1_CI_AS',
                totalIops: 0,
                ownerNodes: '[{"primary":"OnPrem-Standalone"}]',
                sqlEdition: 'Enterprise Evaluation Edition (64-bit)',
                sqlVersion: [
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                    '\tOct  8 2022 05:58:25 ',
                    '\tCopyright (C) 2022 Microsoft Corporation',
                    '\tEnterprise Evaluation Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor)',
                    ''
                ],
                instanceGuid: '3',
                totalStorage: 0.15625,
                noOfDatabases: '1',
                cpuUtilization: '2',
                deploymentType: 'standalone',
                memUtilization: '[{"used":958869504,"total":8588910592,"remaining":7630041088,"percentUsed":11}]',
                sqlInstanceName: 'MSSQLSERVER',
                totalThroughput: 0.000004656349989706621,
                vcpusPerInstance: '4',
                storageDetailsByDb:
                    '[{"databaseName":"STDDB1","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"H:","driveTotalSizeMb":6125,"driveAvailableSizeMb":6092},{"databaseName":"stddb10","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"Z:","driveTotalSizeMb":30683,"driveAvailableSizeMb":30596},{"databaseName":"STDDB2","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"J:","driveTotalSizeMb":7149,"driveAvailableSizeMb":7115},{"databaseName":"STDDB3","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"L:","driveTotalSizeMb":8173,"driveAvailableSizeMb":8136},{"databaseName":"STDDB4","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"N:","driveTotalSizeMb":9197,"driveAvailableSizeMb":9158},{"databaseName":"STDDB5","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"Q:","driveTotalSizeMb":10221,"driveAvailableSizeMb":10179},{"databaseName":"STDDB6","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"S:","driveTotalSizeMb":11245,"driveAvailableSizeMb":11202},{"databaseName":"STDDB7","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"U:","driveTotalSizeMb":12269,"driveAvailableSizeMb":12222},{"databaseName":"STDDB8","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"W:","driveTotalSizeMb":13293,"driveAvailableSizeMb":13245},{"databaseName":"STDDB9","allocatedSizeMb":16,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"Y:","driveTotalSizeMb":14317,"driveAvailableSizeMb":14266}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":0,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":0,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]'
            }
        ],
        assessment_data: {
            calculations: {
                single: {
                    fsxCloneCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ssdMonthlyCost: 0.01,
                        clonedCopiesCount: 1,
                        totalFsxnCapacity: 1073741824,
                        ssdStoragePerMonth: 85899345.92,
                        totalCloneMonthlyCost: 0.01,
                        desiredStorageCapacity: 85899345.92,
                        changeRateBetweenClones: 8,
                        monthlyChangeRatePercentage: 8,
                        effectiveFsxnStorageCapacity: 85899345.92,
                        percentageOfDataOnSsdStorage: 1,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapCalculation: {
                        maxSsdIops: 51200,
                        ebsCapacity: 1073741824,
                        includedIops: 3,
                        fsxnIopsPrice: 0.017,
                        maxThroughput: 4096,
                        maxSsdTierSize: 211106232532992,
                        ssdMonthlyCost: 128,
                        includedSsdIops: 3072,
                        numberOfVolumes: 1,
                        fsxnStoragePrice: { unit: 'UsdPerGiB', price: 0.125 },
                        requiredNumOfFsx: 1,
                        additionalSsdIops: 0,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0219 },
                        ratioAfterSavings: 1,
                        provisionedSsdIops: 3072,
                        ssdStoragePerMonth: 1073741824,
                        capacityMonthlyCost: 0,
                        capacityPoolStorage: 0,
                        fsxnThroughputPrice: 0.72,
                        desiredStorageCapacity: 1073741824,
                        billedAdditionalSsdIops: 0,
                        totalMonthlyCostForFSxSsd: 128,
                        totalMonthlyStorageCharge: 128,
                        requiredNumOfFsxFractional: 0.06,
                        minFileSystemsNumForSsdIops: 0.06,
                        minFileSystemsNumForStorage: 0.005208333333333333,
                        totalMonthlyCostForCapacity: 0,
                        effectiveFsxnStorageCapacity: 1073741824,
                        greaterOfSsdAndMinAllowedSsd: 1099511627776,
                        percentageOfDataOnSSDStorage: 1,
                        percentageOfDataOnSsdStorage: 1,
                        minThroughputCapacityRequired: 128,
                        provisionedThroughputCapacity: 128,
                        totalThroughputAndIopsMonthly: 92.16,
                        additionalBilledCostForSsdIops: 0,
                        dataOnCapacityPoolStorageFactor: 0,
                        suggestedFsxnThroughputCapacity: 128,
                        minFileSystemsNumForThroughputCapacity: 0.03125,
                        savingsFromCompressionAndDeduplication: 0,
                        totalMonthlyFsxnThroughputCapacityCost: 92.16,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapSnapshotCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ssdMonthlyCost: 128,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0219 },
                        ratioAfterSavings: 1,
                        ssdStoragePerMonth: 8589934.592,
                        capacityMonthlyCost: 0.0015768,
                        capacityPoolStorage: 77309411.32800001,
                        desiredStorageCapacity: 85899345.92,
                        totalSnapshotMonthlyCost: 0.0025768,
                        totalMonthlyCostForCapacity: 0.0015768,
                        effectiveFsxnStorageCapacity: 85899345.92,
                        percentageOfDataOnSsdStorage: 0.1,
                        dataOnCapacityPoolStorageFactor: 0.9,
                        totalSnapshotMonthlyCostForFsxSsd: 0.001,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    }
                },
                ebsCalculation: {
                    gp2: {
                        ebsIopsCost: 0,
                        billableIops: 0,
                        billableMbps: 0,
                        hoursInAMonth: 730,
                        ebsStorageCost: 0.1,
                        numberOfVolumes: 1,
                        ebsCapacityPrice: { unit: 'UsdPerGiB', price: 0.1 },
                        ebsInstanceMonth: 1,
                        ebsThroughputCost: 0,
                        totalBillableIops: 0,
                        totalInstanceHours: 730,
                        ebsTotalCostMonthly: 0.152,
                        instanceAvgDuration: 730,
                        storageAmountPerVol: 1073741824,
                        billableThroughputGbps: 0,
                        billableThroughputMbps: 0
                    }
                },
                ebsCloneCalculation: {
                    gp2: { iops: 0, capacity: 0.1, throughput: 0, clonedCopiesCount: 1, totalCloneMonthlyCost: 0.1 }
                },
                ebsSnapshotCalculation: {
                    gp2: {
                        storageAmount: 1073741824,
                        totalSnapshots: 30,
                        ebsSnapshotCost: 0.052,
                        numberOfVolumes: 1,
                        ebsInstanceMonth: 1,
                        ebsSnapshotPrice: { unit: 'UsdPerGiB', price: 0.05 },
                        totalSnapshotCost: 0.052,
                        initialSnapshotCost: 0.05,
                        totalEbsSnapshotCost: 0.052,
                        monthlyCostOfSnapshots: 0.0001333333333333333,
                        monthlyCostPerSnapshot: 0.0001333333333333333,
                        incrementalSnapshotCost: 0.002,
                        amountChangedPerSnapshot: 2863311.530666667,
                        monthlyChangeRatePercentage: 8,
                        discountForPartialStorageMonth: 0.00006666666666666667
                    }
                },
                existingComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c5.xlarge',
                    machineDetails: [
                        {
                            price: 0.834,
                            basePrice: 0.354,
                            hoursInMonth: 730,
                            instanceType: 'c5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 258.42,
                            licenseMonthlyPrice: 350.4,
                            instanceMonthlyPrice: 608.8199999999999
                        }
                    ],
                    computeHourlyPrice: 0.354,
                    computeMonthlyPrice: 258.42,
                    instanceMonthlyPrice: 608.8199999999999
                },
                existingLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Standard Edition',
                    licenseHourlyPrice: 0.48,
                    licenseMonthlyPrice: 350.4
                },
                recommendedComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c5.xlarge',
                    machineDetails: [
                        {
                            price: 0.834,
                            basePrice: 0.354,
                            hoursInMonth: 730,
                            instanceType: 'c5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 258.42,
                            licenseMonthlyPrice: 350.4,
                            instanceMonthlyPrice: 608.8199999999999
                        }
                    ],
                    computeHourlyPrice: 0.354,
                    computeMonthlyPrice: 258.42,
                    instanceMonthlyPrice: 608.8199999999999
                },
                recommendedLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Standard Edition',
                    licenseHourlyPrice: 0.48,
                    licenseMonthlyPrice: 350.4
                }
            },
            storageSavings: {
                ebs: { iops: 0, total: 0.25, clones: 0.1, capacity: 0.1, snapshots: 0.05, throughput: 0 },
                fsx: { iops: 0, total: 220.17, clones: 0.01, capacity: 128, snapshots: 0, throughput: 92.16 },
                compute: {
                    existing: {
                        hoursInMonth: 730,
                        instanceType: 'c5.xlarge',
                        machineDetails: [
                            {
                                price: 0.834,
                                basePrice: 0.354,
                                hoursInMonth: 730,
                                instanceType: 'c5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 258.42,
                                licenseMonthlyPrice: 350.4,
                                instanceMonthlyPrice: 608.8199999999999
                            }
                        ],
                        computeHourlyPrice: 0.354,
                        computeMonthlyPrice: 258.42,
                        instanceMonthlyPrice: 608.8199999999999
                    },
                    recommended: {
                        hoursInMonth: 730,
                        instanceType: 'c3.xlarge',
                        machineDetails: [
                            {
                                price: 1.066,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'c3.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 503.7,
                                instanceMonthlyPrice: 778.1800000000001
                            }
                        ],
                        computeHourlyPrice: 0.376,
                        computeMonthlyPrice: 274.48,
                        instanceMonthlyPrice: 778.1800000000001
                    }
                },
                license: {
                    existing: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Standard Edition',
                        licenseHourlyPrice: 0.48,
                        licenseMonthlyPrice: 350.4
                    },
                    recommended: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Standard Edition',
                        licenseHourlyPrice: 0.6900000000000001,
                        licenseMonthlyPrice: 503.7
                    }
                },
                totalSummary: { existing: 1609.0699999999999, recommended: 998.35 }
            }
        }
    }
];

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
    optimizeMpioSessionsJobData,
    optimizeStorageTierJobData,
    enableMPIOJobData,
    DEMO_PRODUCT_RATE,
    onPremRecords
};
