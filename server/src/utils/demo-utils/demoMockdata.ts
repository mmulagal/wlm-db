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
        resource_id: '9cffb1f63983b62c',
        account_id: accountId,
        database_type: DATABASE_TYPE.mssql,
        database_deployment_type: DATABASE_DEPLOYMENT_TYPE.AOAG,
        host_config: {
            nodeDetails: [
                {
                    hostId: '3B791E42-87BF-0F62-A6B9-8879355A59BC',
                    ramSize: 8,
                    hostName: 'WLMDBAOAG1',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE1",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "E:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    }\r\n]',
                        RunspaceId: 'd42b88be-00d6-438f-b3fc-7497c1acb5ce',
                        PSComputerName: 'WLMDBAOAG1',
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
                    hostName: 'WLMDBAOAG2',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE1",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "E:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    }\r\n]',
                        RunspaceId: 'b92e1156-449a-41a9-97f3-679e412dd94e',
                        PSComputerName: 'WLMDBAOAG2',
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
                    hostId: '14DB1E42-579F-C010-0FA0-B115F6BFF8E2',
                    ramSize: 16,
                    hostName: 'WLMDBAOAG3',
                    osEdition: 'Microsoft Windows Server 2022 Datacenter',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE1",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "E:"\r\n    }\r\n]',
                        RunspaceId: '92576256-84ab-46eb-868a-5ad0db9c83aa',
                        PSComputerName: 'WLMDBAOAG3',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 8,
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
            clusterNodeNames: ['WLMDBAOAG1', 'WLMDBAOAG2', 'WLMDBAOAG3'],
            windowsSystemName: 'NEWAOAGONPREM'
        },
        database_instances_data: [
            {
                iops: '[{"writeIops":"      30","readIops":"      3000","writeBytesPerSec":"            7602.15","readBytesPerSec":"            850610000000.95"}]',
                collation: 'SQL_Icelandic_Pref_CP1_CI_AS',
                totalIops: 3030,
                ownerNodes: '[{"primary":"WLMDBAOAG2"}]',
                sqlEdition: 'Enterprise Edition (64-bit)',
                sqlVersion: [
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                    '\tOct  8 2022 05:58:25 ',
                    '\tCopyright (C) 2022 Microsoft Corporation',
                    '\tEnterprise Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor)',
                    ''
                ],
                instanceGuid: 'FF5408CC-54E1-45A4-BD84-99FD7CAF9777',
                totalStorage: 25.0068359375,
                isReadReplica: 'True',
                noOfDatabases: '8',
                cpuUtilization: '8',
                deploymentType: 'AOAG',
                memUtilization: '[{"used":7745544192,"total":8588910592,"remaining":843366400,"percentUsed":90}]',
                aoagReadReplica:
                    '[{"databaseName":"AOAGDB1","replicaId":"DF4954EE-EDE0-4C70-B085-1E666436CEFD","replicaServerName":"WLMDBAOAG2\\\\AOAG1_NODE2","syncStateDesc":"SYNCHRONIZED","replicaRole":"SECONDARY"},{"databaseName":"DB1","replicaId":"3362D24C-50C0-496E-A165-7AF9118B283B","replicaServerName":"WLMDBAOAG2\\\\AOAG1_NODE2","syncStateDesc":"SYNCHRONIZED","replicaRole":"SECONDARY"},{"databaseName":"DB2","replicaId":"3362D24C-50C0-496E-A165-7AF9118B283B","replicaServerName":"WLMDBAOAG2\\\\AOAG1_NODE2","syncStateDesc":"SYNCHRONIZED","replicaRole":"SECONDARY"},{"databaseName":"DB3","replicaId":"3362D24C-50C0-496E-A165-7AF9118B283B","replicaServerName":"WLMDBAOAG2\\\\AOAG1_NODE2","syncStateDesc":"SYNCHRONIZED","replicaRole":"SECONDARY"}]',
                sqlInstanceName: 'AOAG1_NODE2',
                totalThroughput: 106.7073012607258,
                vcpusPerInstance: '4',
                storageDetailsByDb:
                    '[{"databaseName":"AG2NORMALDB2","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":76781,"driveAvailableSizeMb":76542},{"databaseName":"AG2NORMALDB2","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":25581,"driveAvailableSizeMb":25479},{"databaseName":"AOAGDB1","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"E:","driveTotalSizeMb":76781,"driveAvailableSizeMb":76542},{"databaseName":"AOAGDB22","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"E:","driveTotalSizeMb":76781,"driveAvailableSizeMb":76542},{"databaseName":"AOAGDB22_DB2","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"E:","driveTotalSizeMb":76781,"driveAvailableSizeMb":76542},{"databaseName":"AOAGDB22_DB2","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"F:","driveTotalSizeMb":25581,"driveAvailableSizeMb":25479},{"databaseName":"DB1","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":76781,"driveAvailableSizeMb":76542},{"databaseName":"DB1","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":25581,"driveAvailableSizeMb":25479},{"databaseName":"DB2","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":76781,"driveAvailableSizeMb":76542},{"databaseName":"DB2","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":25581,"driveAvailableSizeMb":25479},{"databaseName":"DB3","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":76781,"driveAvailableSizeMb":76542},{"databaseName":"DB3","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":25581,"driveAvailableSizeMb":25479},{"databaseName":"master","allocatedSizeMb":7,"dataSizeMb":5,"logSizeMb":2,"driveLetter":"C:","driveTotalSizeMb":29942,"driveAvailableSizeMb":8535}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":1,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":1,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":1,"FeatureDescription":"You have Availability Groups with > 1 database"},{"IsUsingFeature":1,"FeatureDescription":"You have read-only Replicas"}]',
                totalSecondaryStorage: 35
            },
            {
                iops: '[{"writeIops":"      30","readIops":"      3000","writeBytesPerSec":"            7602.15","readBytesPerSec":"            850610000000.95"}]',
                collation: 'SQL_Latin1_General_CP1_CI_AS',
                totalIops: 3030,
                ownerNodes: '[{"primary":"WLMDBAOAG3"}]',
                sqlEdition: 'Enterprise Edition (64-bit)',
                sqlVersion: [
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) ',
                    '\tOct  8 2022 05:58:25 ',
                    '\tCopyright (C) 2022 Microsoft Corporation',
                    '\tEnterprise Edition (64-bit) on Windows Server 2022 Datacenter 10.0 <X64> (Build 20348: ) (Hypervisor)',
                    ''
                ],
                instanceGuid: '72CD136C-1E2B-47A8-8253-5A6B1CF04FE5',
                totalStorage: 0.0048828125,
                isReadReplica: 'True',
                noOfDatabases: '2',
                cpuUtilization: '2',
                deploymentType: 'AOAG',
                memUtilization: '[{"used":16507834368,"total":17178845184,"remaining":671010816,"percentUsed":90}]',
                aoagReadReplica:
                    '[{"databaseName":"AOAG3_DB1","replicaId":"F1A38D89-BD91-497D-913E-5CE26BA27997","replicaServerName":"WLMDBAOAG3\\\\AOAG3","syncStateDesc":"SYNCHRONIZING","replicaRole":"SECONDARY"}]',
                sqlInstanceName: 'AOAG3',
                totalThroughput: 106.7073012607258,
                vcpusPerInstance: '8',
                storageDetailsByDb:
                    '[{"databaseName":"AOAG3_DB1","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":61421,"driveAvailableSizeMb":61311},{"databaseName":"AOAG3_DB1","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":61421,"driveAvailableSizeMb":61311},{"databaseName":"master","allocatedSizeMb":5,"dataSizeMb":4,"logSizeMb":1,"driveLetter":"C:","driveTotalSizeMb":101622,"driveAvailableSizeMb":82830}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":1,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":1,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":1,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":1,"FeatureDescription":"You have Availability Groups with > 1 database"},{"IsUsingFeature":1,"FeatureDescription":"You have read-only Replicas"}]',
                totalSecondaryStorage: 10
            },
            {
                iops: '[{"writeIops":"      600000","readIops":"      3000","writeBytesPerSec":"            3602.15","readBytesPerSec":"            850610000000.95"}]',
                collation: 'SQL_Romanian_CP1250_CS_AS',
                totalIops: 603000,
                ownerNodes: '[{"primary":"WLMDBAOAG1"}]',
                sqlEdition: 'Enterprise Edition (64-bit)',
                sqlVersion:
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) \tOct  8 2022 05:58:25 \tCopyright (C) 2022 Microsoft Corporation\tEnterprise Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor)',
                instanceGuid: '8828F984-B541-456E-8EBE-D37C4D57B239',
                totalStorage: 55.0068359375,
                isReadReplica: 'True',
                noOfDatabases: '9',
                cpuUtilization: '26',
                deploymentType: 'AOAG',
                memUtilization: '[{"used":7504834560,"total":8588910592,"remaining":1084076032,"percentUsed":85}]',
                aoagReadReplica:
                    '[{"databaseName":"AOAGDB22","replicaId":"4B08A481-D542-4168-9B1B-976CA6B1B1DE","replicaServerName":"WLMDBAOAG1\\\\AOAG1_NODE1","syncStateDesc":"SYNCHRONIZED","replicaRole":"SECONDARY"},{"databaseName":"AOAGDB22_DB2","replicaId":"9CECFD61-8D8F-4953-AB8F-6DCAFE1DB035","replicaServerName":"WLMDBAOAG1\\\\AOAG1_NODE1","syncStateDesc":"SYNCHRONIZED","replicaRole":"SECONDARY"}]',
                sqlInstanceName: 'AOAG1_NODE1',
                totalThroughput: 225.2002027342632,
                vcpusPerInstance: '4',
                storageDetailsByDb:
                    '[{"databaseName":"AG1NORMALDB1","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86781},{"databaseName":"AG1NORMALDB1","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":40941,"driveAvailableSizeMb":40793},{"databaseName":"AOAG3_DB1","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86781},{"databaseName":"AOAG3_DB1","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":40941,"driveAvailableSizeMb":40793},{"databaseName":"AOAGDB1","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86781},{"databaseName":"AOAGDB22","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86781},{"databaseName":"AOAGDB22_DB2","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86781},{"databaseName":"AOAGDB22_DB2","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"F:","driveTotalSizeMb":40941,"driveAvailableSizeMb":40793},{"databaseName":"DB1","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86781},{"databaseName":"DB1","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":40941,"driveAvailableSizeMb":40793},{"databaseName":"DB2","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86781},{"databaseName":"DB2","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":40941,"driveAvailableSizeMb":40793},{"databaseName":"DB3","allocatedSizeMb":5120,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":87021,"driveAvailableSizeMb":86781},{"databaseName":"DB3","allocatedSizeMb":5120,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"F:","driveTotalSizeMb":40941,"driveAvailableSizeMb":40793},{"databaseName":"master","allocatedSizeMb":7,"dataSizeMb":5,"logSizeMb":2,"driveLetter":"C:","driveTotalSizeMb":29942,"driveAvailableSizeMb":10236}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":1,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":1,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":1,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":1,"FeatureDescription":"You have Availability Groups with > 1 database"},{"IsUsingFeature":1,"FeatureDescription":"You have read-only Replicas"}]',
                totalSecondaryStorage: 15
            }
        ],
        assessment_data: {
            calculations: {
                multi: {
                    fsxCloneCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.25 },
                        ssdMonthlyCost: 0.1,
                        clonedCopiesCount: 1,
                        totalFsxnCapacity: 5368709120,
                        ssdStoragePerMonth: 429496729.6,
                        totalCloneMonthlyCost: 0.1,
                        desiredStorageCapacity: 429496729.6,
                        changeRateBetweenClones: 8,
                        monthlyChangeRatePercentage: 8,
                        effectiveFsxnStorageCapacity: 429496729.6,
                        percentageOfDataOnSsdStorage: 1,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapCalculation: {
                        maxSsdIops: 51200,
                        ebsCapacity: 5368709120,
                        includedIops: 3,
                        fsxnIopsPrice: 0.034,
                        maxThroughput: 4096,
                        maxSsdTierSize: 211106232532992,
                        ssdMonthlyCost: 256,
                        includedSsdIops: 3072,
                        numberOfVolumes: 1,
                        fsxnStoragePrice: { unit: 'UsdPerGiB', price: 0.25 },
                        requiredNumOfFsx: 1,
                        additionalSsdIops: 16678,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0438 },
                        ratioAfterSavings: 1,
                        provisionedSsdIops: 19750,
                        ssdStoragePerMonth: 5368709120,
                        capacityMonthlyCost: 0,
                        capacityPoolStorage: 0,
                        fsxnThroughputPrice: 1.2,
                        desiredStorageCapacity: 5368709120,
                        billedAdditionalSsdIops: 16678,
                        totalMonthlyCostForFSxSsd: 256,
                        totalMonthlyStorageCharge: 256,
                        requiredNumOfFsxFractional: 0.3857421875,
                        minFileSystemsNumForSsdIops: 0.3857421875,
                        minFileSystemsNumForStorage: 0.005208333333333333,
                        totalMonthlyCostForCapacity: 0,
                        effectiveFsxnStorageCapacity: 5368709120,
                        greaterOfSsdAndMinAllowedSsd: 1099511627776,
                        percentageOfDataOnSSDStorage: 1,
                        percentageOfDataOnSsdStorage: 1,
                        minThroughputCapacityRequired: 128,
                        provisionedThroughputCapacity: 512,
                        totalThroughputAndIopsMonthly: 1181.452,
                        additionalBilledCostForSsdIops: 567.052,
                        dataOnCapacityPoolStorageFactor: 0,
                        suggestedFsxnThroughputCapacity: 512,
                        minFileSystemsNumForThroughputCapacity: 0.125,
                        savingsFromCompressionAndDeduplication: 0,
                        totalMonthlyFsxnThroughputCapacityCost: 614.4,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapSnapshotCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.25 },
                        ssdMonthlyCost: 256,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0438 },
                        ratioAfterSavings: 1,
                        ssdStoragePerMonth: 42949672.96,
                        capacityMonthlyCost: 0.015768,
                        capacityPoolStorage: 386547056.64,
                        desiredStorageCapacity: 429496729.6,
                        totalSnapshotMonthlyCost: 0.025768,
                        totalMonthlyCostForCapacity: 0.015768,
                        effectiveFsxnStorageCapacity: 429496729.6,
                        percentageOfDataOnSsdStorage: 0.1,
                        dataOnCapacityPoolStorageFactor: 0.9,
                        totalSnapshotMonthlyCostForFsxSsd: 0.01,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    }
                },
                ebsCalculation: {
                    gp3: {
                        ebsIopsCost: 0,
                        billableIops: 0,
                        billableMbps: 0,
                        hoursInAMonth: 730,
                        ebsStorageCost: 0.7999999999999999,
                        numberOfVolumes: 10,
                        ebsCapacityPrice: { unit: 'UsdPerGiB', price: 0.08 },
                        ebsInstanceMonth: 10,
                        ebsThroughputCost: 0,
                        totalBillableIops: 0,
                        totalInstanceHours: 7300,
                        ebsTotalCostMonthly: 0.852,
                        instanceAvgDuration: 730,
                        storageAmountPerVol: 2147483648,
                        billableThroughputGbps: 0,
                        billableThroughputMbps: 0
                    },
                    io2: {
                        ebsIopsCost: 17427.15,
                        billableIops: 83750,
                        billableMbps: 0,
                        hoursInAMonth: 730,
                        ebsStorageCost: 4.5,
                        numberOfVolumes: 9,
                        ebsCapacityPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ebsInstanceMonth: 9,
                        ebsThroughputCost: 0,
                        totalBillableIops: 83750,
                        totalInstanceHours: 6570,
                        ebsTotalCostMonthly: 17432.898,
                        instanceAvgDuration: 730,
                        storageAmountPerVol: 8589934592,
                        billableThroughputGbps: 0,
                        billableThroughputMbps: 0
                    }
                },
                ebsCloneCalculation: {
                    gp3: { iops: 0, capacity: 0.08, throughput: 0, clonedCopiesCount: 1, totalCloneMonthlyCost: 0.08 },
                    io2: {
                        iops: 6532.5,
                        capacity: 3,
                        throughput: 0,
                        clonedCopiesCount: 1,
                        totalCloneMonthlyCost: 6535.5
                    }
                },
                ebsSnapshotCalculation: {
                    gp3: {
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
                    },
                    io2: {
                        storageAmount: 25769803776,
                        totalSnapshots: 30,
                        ebsSnapshotCost: 1.248,
                        numberOfVolumes: 6,
                        ebsInstanceMonth: 6,
                        ebsSnapshotPrice: { unit: 'UsdPerGiB', price: 0.05 },
                        totalSnapshotCost: 0.208,
                        initialSnapshotCost: 0.2,
                        totalEbsSnapshotCost: 1.248,
                        monthlyCostOfSnapshots: 0.0005333333333333334,
                        monthlyCostPerSnapshot: 0.0005333333333333334,
                        incrementalSnapshotCost: 0.008,
                        amountChangedPerSnapshot: 11453246.12266667,
                        monthlyChangeRatePercentage: 8,
                        discountForPartialStorageMonth: 0.0002666666666666667
                    }
                },
                existingComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c5.2xlarge, c5.2xlarge',
                    machineDetails: [
                        {
                            price: 3.708,
                            basePrice: 0.708,
                            hoursInMonth: 730,
                            instanceType: 'c5.2xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 516.8399999999999,
                            licenseMonthlyPrice: 4380,
                            instanceMonthlyPrice: 2706.84
                        },
                        {
                            price: 3.708,
                            basePrice: 0.708,
                            hoursInMonth: 730,
                            instanceType: 'c5.2xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 516.8399999999999,
                            licenseMonthlyPrice: 4380,
                            instanceMonthlyPrice: 2706.84
                        }
                    ],
                    computeHourlyPrice: 1.416,
                    computeMonthlyPrice: 1033.68,
                    instanceMonthlyPrice: 5413.68
                },
                existingLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Enterprise Edition (64-bit)',
                    licenseHourlyPrice: 6,
                    licenseMonthlyPrice: 4380
                },
                recommendedComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'm5.xlarge, m5.xlarge',
                    machineDetails: [
                        {
                            price: 1.876,
                            basePrice: 0.376,
                            hoursInMonth: 730,
                            instanceType: 'm5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 274.48,
                            licenseMonthlyPrice: 700.8,
                            instanceMonthlyPrice: 1369.48
                        },
                        {
                            price: 1.876,
                            basePrice: 0.376,
                            hoursInMonth: 730,
                            instanceType: 'm5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 274.48,
                            licenseMonthlyPrice: 700.8,
                            instanceMonthlyPrice: 1369.48
                        }
                    ],
                    computeHourlyPrice: 0.752,
                    computeMonthlyPrice: 548.96,
                    instanceHourlyPrice: 1.712,
                    instanceMonthlyPrice: 1249.76
                },
                recommendedLicenseCalculation: {
                    message:
                        'Downgrade Enterprise Edition to Standard Edition if you are not using any of the enterprise features',
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Standard Edition',
                    licenseHourlyPrice: 0.96,
                    licenseMonthlyPrice: 700.8
                }
            },
            storageSavings: {
                ebs: { iops: 17427.15, total: 23969.33, clones: 6535.58, capacity: 5.3, snapshots: 1.3, throughput: 0 },
                fsx: { iops: 567.05, total: 1437.58, clones: 0.1, capacity: 256, snapshots: 0.03, throughput: 614.4 },
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
                        ssdIop: 19750,
                        savings: 0,
                        useCase: 'Low-latency',
                        regionName: 'US East (N. Virginia)',
                        throughput: 125,
                        percentageSsd: 100,
                        deploymentType: 'Multi',
                        numberOfVolumes: 1,
                        capacityPoolTier: 0,
                        effectiveCapacity: 5368709120,
                        ssdTierReqCapacity: 5368709120,
                        throughputCapacity: 512,
                        totalStorageCapacity: 5368709120,
                        monthlySnapshotCapacity: 429496729.6
                    }
                },
                compute: {
                    existing: {
                        hoursInMonth: 730,
                        instanceType: 'c5.2xlarge, c5.2xlarge',
                        machineDetails: [
                            {
                                price: 3.708,
                                basePrice: 0.708,
                                hoursInMonth: 730,
                                instanceType: 'c5.2xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 516.8399999999999,
                                licenseMonthlyPrice: 4380,
                                instanceMonthlyPrice: 2706.84
                            },
                            {
                                price: 3.708,
                                basePrice: 0.708,
                                hoursInMonth: 730,
                                instanceType: 'c5.2xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 516.8399999999999,
                                licenseMonthlyPrice: 4380,
                                instanceMonthlyPrice: 2706.84
                            }
                        ],
                        computeHourlyPrice: 1.416,
                        computeMonthlyPrice: 1033.68,
                        instanceMonthlyPrice: 5413.68
                    },
                    recommended: {
                        hoursInMonth: 730,
                        instanceType: 'm5.xlarge, m5.xlarge',
                        machineDetails: [
                            {
                                price: 1.876,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'm5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 700.8,
                                instanceMonthlyPrice: 1369.48
                            },
                            {
                                price: 1.876,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'm5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 700.8,
                                instanceMonthlyPrice: 1369.48
                            }
                        ],
                        computeHourlyPrice: 0.752,
                        computeMonthlyPrice: 548.96,
                        instanceHourlyPrice: 1.712,
                        instanceMonthlyPrice: 1249.76
                    }
                },
                license: {
                    finding: 'OPTIMIZED',
                    existing: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        licenseHourlyPrice: 6,
                        licenseMonthlyPrice: 4380
                    },
                    recommended: {
                        message:
                            'Downgrade Enterprise Edition to Standard Edition if you are not using any of the enterprise features',
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Standard Edition',
                        licenseHourlyPrice: 0.96,
                        licenseMonthlyPrice: 700.8
                    }
                },
                totalSummary: { existing: 29383.01, recommended: 2687.34 }
            }
        },
        creation_time: new Date(),
        version: '1.0.0'
    },
    {
        resource_id: 'b2237ee4dab29877',
        account_id: accountId,
        database_type: DATABASE_TYPE.mssql,
        database_deployment_type: DATABASE_DEPLOYMENT_TYPE.Standalone,
        host_config: {
            nodeDetails: [
                {
                    hostId: '12C01E42-1349-4206-82FE-99795431ECEF',
                    ramSize: 8,
                    hostName: 'WLMDBSTD1',
                    osEdition: 'Microsoft Windows Server 2022 Standard',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE1",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "H:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE3",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "I:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE4",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "J:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE5",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "K:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE6",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "L:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE7",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "M:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE8",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "N:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE9",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "O:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE10",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "Q:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE11",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "R:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE12",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "S:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE13",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "T:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE14",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "U:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE15",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "V:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE16",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "W:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE17",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "X:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE18",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "Y:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE19",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "Z:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE20",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "Z:"\r\n    }\r\n]',
                        RunspaceId: '7e940eb1-3701-416f-a1eb-f7ba03593a09',
                        PSComputerName: 'WLMDBSTD1',
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
            belongsToCluster: false,
            clusterNodeNames: ['WLMDBSTD1'],
            windowsSystemName: 'WLMDBSTD1'
        },
        database_instances_data: [
            {
                iops: '[{"writeIops":"      600000","readIops":"      3000","writeBytesPerSec":"            3602.15","readBytesPerSec":"            850610000000.95"}]',
                collation: 'SQL_Latin1_General_CP1_CI_AS',
                totalIops: 603000,
                ownerNodes: '[{"primary":"WLMDBSTD1"}]',
                sqlEdition: 'Enterprise Edition (64-bit)',
                sqlVersion:
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) \tOct  8 2022 05:58:25 \tCopyright (C) 2022 Microsoft Corporation\tEnterprise Edition (64-bit) on Windows Server 2022 Standard 10.0 <X64> (Build 20348: ) (Hypervisor)',
                instanceGuid: '39D4A504-A372-4D49-B381-40B847EA8DE5',
                totalStorage: 735,
                noOfDatabases: '10',
                cpuUtilization: '41',
                deploymentType: 'standalone',
                memUtilization: '[{"used":7052099584,"total":8588910592,"remaining":1536811008,"percentUsed":82}]',
                sqlInstanceName: 'MSSQLSERVER',
                totalThroughput: 225.2002027342632,
                vcpusPerInstance: '4',
                storageDetailsByDb:
                    '[{"databaseName":"master","allocatedSizeMb":500000,"dataSizeMb":4,"logSizeMb":1,"driveLetter":"C:","driveTotalSizeMb":29942,"driveAvailableSizeMb":5925},{"databaseName":"stddb10","allocatedSizeMb":16000,"dataSizeMb":8,"logSizeMb":8,"driveLetter":"Z:","driveTotalSizeMb":30683,"driveAvailableSizeMb":30596},{"databaseName":"STDDB2","allocatedSizeMb":8000,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"I:","driveTotalSizeMb":7149,"driveAvailableSizeMb":7115},{"databaseName":"STDDB2","allocatedSizeMb":8000,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"J:","driveTotalSizeMb":7149,"driveAvailableSizeMb":7115},{"databaseName":"STDDB3","allocatedSizeMb":25680,"dataSizeMb":2568,"logSizeMb":0,"driveLetter":"K:","driveTotalSizeMb":8173,"driveAvailableSizeMb":5576},{"databaseName":"STDDB3","allocatedSizeMb":42960,"dataSizeMb":0,"logSizeMb":4296,"driveLetter":"L:","driveTotalSizeMb":8173,"driveAvailableSizeMb":3848},{"databaseName":"STDDB4","allocatedSizeMb":19280,"dataSizeMb":1928,"logSizeMb":0,"driveLetter":"M:","driveTotalSizeMb":9197,"driveAvailableSizeMb":7238},{"databaseName":"STDDB4","allocatedSizeMb":18640,"dataSizeMb":0,"logSizeMb":1864,"driveLetter":"N:","driveTotalSizeMb":9197,"driveAvailableSizeMb":7302},{"databaseName":"STDDB5","allocatedSizeMb":22480,"dataSizeMb":2248,"logSizeMb":0,"driveLetter":"O:","driveTotalSizeMb":10221,"driveAvailableSizeMb":7939},{"databaseName":"STDDB5","allocatedSizeMb":27600,"dataSizeMb":0,"logSizeMb":2760,"driveLetter":"Q:","driveTotalSizeMb":10221,"driveAvailableSizeMb":7427},{"databaseName":"STDDB6","allocatedSizeMb":8000,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"R:","driveTotalSizeMb":11245,"driveAvailableSizeMb":11202},{"databaseName":"STDDB6","allocatedSizeMb":8000,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"S:","driveTotalSizeMb":11245,"driveAvailableSizeMb":11202},{"databaseName":"STDDB7","allocatedSizeMb":8000,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"T:","driveTotalSizeMb":12269,"driveAvailableSizeMb":12222},{"databaseName":"STDDB7","allocatedSizeMb":8000,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"U:","driveTotalSizeMb":12269,"driveAvailableSizeMb":12222},{"databaseName":"STDDB8","allocatedSizeMb":8000,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"V:","driveTotalSizeMb":13293,"driveAvailableSizeMb":13245},{"databaseName":"STDDB8","allocatedSizeMb":8000,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"W:","driveTotalSizeMb":13293,"driveAvailableSizeMb":13245},{"databaseName":"STDDB9","allocatedSizeMb":8000,"dataSizeMb":8,"logSizeMb":0,"driveLetter":"X:","driveTotalSizeMb":14317,"driveAvailableSizeMb":14266},{"databaseName":"STDDB9","allocatedSizeMb":8000,"dataSizeMb":0,"logSizeMb":8,"driveLetter":"Y:","driveTotalSizeMb":14317,"driveAvailableSizeMb":14266}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":1,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":1,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]'
            }
        ],
        assessment_data: {
            calculations: {
                single: {
                    fsxCloneCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ssdMonthlyCost: 0.04,
                        clonedCopiesCount: 1,
                        totalFsxnCapacity: 4294967296,
                        ssdStoragePerMonth: 343597383.68,
                        totalCloneMonthlyCost: 0.04,
                        desiredStorageCapacity: 343597383.68,
                        changeRateBetweenClones: 8,
                        monthlyChangeRatePercentage: 8,
                        effectiveFsxnStorageCapacity: 343597383.68,
                        percentageOfDataOnSsdStorage: 1,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapCalculation: {
                        maxSsdIops: 51200,
                        ebsCapacity: 4294967296,
                        includedIops: 3,
                        fsxnIopsPrice: 0.017,
                        maxThroughput: 4096,
                        maxSsdTierSize: 211106232532992,
                        ssdMonthlyCost: 128,
                        includedSsdIops: 3072,
                        numberOfVolumes: 1,
                        fsxnStoragePrice: { unit: 'UsdPerGiB', price: 0.125 },
                        requiredNumOfFsx: 1,
                        additionalSsdIops: 2958,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0219 },
                        ratioAfterSavings: 1,
                        provisionedSsdIops: 6030,
                        ssdStoragePerMonth: 4294967296,
                        capacityMonthlyCost: 0,
                        capacityPoolStorage: 0,
                        fsxnThroughputPrice: 0.72,
                        desiredStorageCapacity: 4294967296,
                        billedAdditionalSsdIops: 2958,
                        totalMonthlyCostForFSxSsd: 128,
                        totalMonthlyStorageCharge: 128,
                        requiredNumOfFsxFractional: 0.1177734375,
                        minFileSystemsNumForSsdIops: 0.1177734375,
                        minFileSystemsNumForStorage: 0.005208333333333333,
                        totalMonthlyCostForCapacity: 0,
                        effectiveFsxnStorageCapacity: 4294967296,
                        greaterOfSsdAndMinAllowedSsd: 1099511627776,
                        percentageOfDataOnSSDStorage: 1,
                        percentageOfDataOnSsdStorage: 1,
                        minThroughputCapacityRequired: 128,
                        provisionedThroughputCapacity: 256,
                        totalThroughputAndIopsMonthly: 234.606,
                        additionalBilledCostForSsdIops: 50.286,
                        dataOnCapacityPoolStorageFactor: 0,
                        suggestedFsxnThroughputCapacity: 256,
                        minFileSystemsNumForThroughputCapacity: 0.0625,
                        savingsFromCompressionAndDeduplication: 0,
                        totalMonthlyFsxnThroughputCapacityCost: 184.32,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapSnapshotCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ssdMonthlyCost: 128,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0219 },
                        ratioAfterSavings: 1,
                        ssdStoragePerMonth: 34359738.368,
                        capacityMonthlyCost: 0.006307200000000001,
                        capacityPoolStorage: 309237645.312,
                        desiredStorageCapacity: 343597383.68,
                        totalSnapshotMonthlyCost: 0.0103072,
                        totalMonthlyCostForCapacity: 0.006307200000000001,
                        effectiveFsxnStorageCapacity: 343597383.68,
                        percentageOfDataOnSsdStorage: 0.1,
                        dataOnCapacityPoolStorageFactor: 0.9,
                        totalSnapshotMonthlyCostForFsxSsd: 0.004,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    }
                },
                ebsCalculation: {
                    io1: {
                        ebsIopsCost: 3919.5,
                        billableIops: 6030,
                        billableMbps: 0,
                        hoursInAMonth: 730,
                        ebsStorageCost: 5,
                        numberOfVolumes: 10,
                        ebsCapacityPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ebsInstanceMonth: 10,
                        ebsThroughputCost: 0,
                        totalBillableIops: 6030,
                        totalInstanceHours: 7300,
                        ebsTotalCostMonthly: 3926.58,
                        instanceAvgDuration: 730,
                        storageAmountPerVol: 4294967296,
                        billableThroughputGbps: 0,
                        billableThroughputMbps: 0
                    }
                },
                ebsCloneCalculation: {
                    io1: {
                        iops: 3919.5,
                        capacity: 5,
                        throughput: 0,
                        clonedCopiesCount: 1,
                        totalCloneMonthlyCost: 3924.5
                    }
                },
                ebsSnapshotCalculation: {
                    io1: {
                        storageAmount: 42949672960,
                        totalSnapshots: 30,
                        ebsSnapshotCost: 2.08,
                        numberOfVolumes: 10,
                        ebsInstanceMonth: 10,
                        ebsSnapshotPrice: { unit: 'UsdPerGiB', price: 0.05 },
                        totalSnapshotCost: 0.208,
                        initialSnapshotCost: 0.2,
                        totalEbsSnapshotCost: 2.08,
                        monthlyCostOfSnapshots: 0.0005333333333333334,
                        monthlyCostPerSnapshot: 0.0005333333333333334,
                        incrementalSnapshotCost: 0.008,
                        amountChangedPerSnapshot: 11453246.12266667,
                        monthlyChangeRatePercentage: 8,
                        discountForPartialStorageMonth: 0.0002666666666666667
                    }
                },
                existingComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c5.xlarge',
                    machineDetails: [
                        {
                            price: 1.854,
                            basePrice: 0.354,
                            hoursInMonth: 730,
                            instanceType: 'c5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 258.42,
                            licenseMonthlyPrice: 1095,
                            instanceMonthlyPrice: 1353.42
                        }
                    ],
                    computeHourlyPrice: 0.354,
                    computeMonthlyPrice: 258.42,
                    instanceMonthlyPrice: 1353.42
                },
                existingLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Enterprise Edition (64-bit)',
                    licenseHourlyPrice: 1.5,
                    licenseMonthlyPrice: 1095
                },
                recommendedComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c5.xlarge',
                    machineDetails: [
                        {
                            price: 1.854,
                            basePrice: 0.354,
                            hoursInMonth: 730,
                            instanceType: 'c5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 258.42,
                            licenseMonthlyPrice: 1095,
                            instanceMonthlyPrice: 1353.42
                        }
                    ],
                    computeHourlyPrice: 0.354,
                    computeMonthlyPrice: 258.42,
                    instanceMonthlyPrice: 1353.42
                },
                recommendedLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Enterprise Edition',
                    licenseHourlyPrice: 1.5,
                    licenseMonthlyPrice: 1095
                }
            },
            storageSavings: {
                ebs: { iops: 3919.5, total: 7851.08, clones: 3924.5, capacity: 5, snapshots: 2.08, throughput: 0 },
                fsx: { iops: 50.29, total: 362.66, clones: 0.04, capacity: 128, snapshots: 0.01, throughput: 184.32 },
                single: {
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
                        ssdIop: 6030,
                        savings: 0,
                        useCase: 'Low-latency',
                        regionName: 'US East (N. Virginia)',
                        throughput: 0,
                        percentageSsd: 100,
                        deploymentType: 'Single',
                        numberOfVolumes: 1,
                        capacityPoolTier: 0,
                        effectiveCapacity: 4294967296,
                        ssdTierReqCapacity: 4294967296,
                        throughputCapacity: 256,
                        totalStorageCapacity: 4294967296,
                        monthlySnapshotCapacity: 343597383.68
                    }
                },
                compute: {
                    existing: {
                        hoursInMonth: 730,
                        instanceType: 'c5.xlarge',
                        machineDetails: [
                            {
                                price: 1.854,
                                basePrice: 0.354,
                                hoursInMonth: 730,
                                instanceType: 'c5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 258.42,
                                licenseMonthlyPrice: 1095,
                                instanceMonthlyPrice: 1353.42
                            }
                        ],
                        computeHourlyPrice: 0.354,
                        computeMonthlyPrice: 258.42,
                        instanceMonthlyPrice: 1353.42
                    },
                    recommended: {
                        hoursInMonth: 730,
                        instanceType: 'c5.xlarge',
                        machineDetails: [
                            {
                                price: 1.854,
                                basePrice: 0.354,
                                hoursInMonth: 730,
                                instanceType: 'c5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 258.42,
                                licenseMonthlyPrice: 1095,
                                instanceMonthlyPrice: 1353.42
                            }
                        ],
                        computeHourlyPrice: 0.354,
                        computeMonthlyPrice: 258.42,
                        instanceMonthlyPrice: 1353.42
                    }
                },
                license: {
                    finding: 'OPTIMIZED',
                    existing: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        licenseHourlyPrice: 1.5,
                        licenseMonthlyPrice: 1095
                    },
                    recommended: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Enterprise Edition',
                        licenseHourlyPrice: 1.5,
                        licenseMonthlyPrice: 1095
                    }
                },
                totalSummary: { existing: 9204.5, recommended: 1716.08 }
            }
        },
        creation_time: new Date(),
        version: '1.0.0'
    },
    {
        resource_id: 'c7c7d367510a5350',
        account_id: accountId,
        database_type: DATABASE_TYPE.mssql,
        database_deployment_type: DATABASE_DEPLOYMENT_TYPE.FCI,
        host_config: {
            nodeDetails: [
                {
                    hostId: 'EFFE1E42-F45B-D755-970E-375B496CF6C1',
                    ramSize: 16,
                    hostName: 'WLMDBFCINEW11',
                    osEdition: 'Microsoft Windows Server 2022 Datacenter',
                    driveDetails: {
                        value: '{\r\n    "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n    "model":  "VMware Virtual disk SCSI Disk Device",\r\n    "driveLetter":  "C:"\r\n}',
                        RunspaceId: 'b6047d18-fff8-403f-9f75-66f4fac8c18d',
                        PSComputerName: 'WLMDBFCINEW11',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 8,
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
                    hostId: 'FF551E42-5D98-83A6-7CE0-8EFF691ADB3D',
                    ramSize: 16,
                    hostName: 'WLMDBFCINEW12',
                    osEdition: 'Microsoft Windows Server 2022 Datacenter',
                    driveDetails: {
                        value: '[\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE0",\r\n        "model":  "VMware Virtual disk SCSI Disk Device",\r\n        "driveLetter":  "C:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE1",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "E:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE2",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "F:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE3",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "G:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE4",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "H:"\r\n    },\r\n    {\r\n        "deviceId":  "\\\\\\\\.\\\\PHYSICALDRIVE5",\r\n        "model":  "NETAPP LUN C-Mode SCSI Disk Device",\r\n        "driveLetter":  "I:"\r\n    }\r\n]',
                        RunspaceId: 'fdc4c1be-4309-4f44-ab3d-117af34acc67',
                        PSComputerName: 'WLMDBFCINEW12',
                        PSShowComputerName: true
                    },
                    numberOfVcpus: 8,
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
            clusterNodeNames: ['WLMDBFCINEW11', 'WLMDBFCINEW12'],
            windowsSystemName: 'TWONODEFCI'
        },
        database_instances_data: [
            {
                iops: '[{"writeIops":"      100000","readIops":"      3000","writeBytesPerSec":"            3602.15","readBytesPerSec":"            850610000000.95"}]',
                collation: 'SQL_Latin1_General_CP1_CI_AS',
                totalIops: 103000,
                ownerNodes:
                    '[{"nodeName":"WLMDBFCINEW12","nodeRole":"Primary"},{"nodeName":"WLMDBFCINEW11","nodeRole":"Standby"}]',
                sqlEdition: 'Enterprise Edition (64-bit)',
                sqlVersion:
                    'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6 (X64) \tOct  8 2022 05:58:25 \tCopyright (C) 2022 Microsoft Corporation\tEnterprise Edition (64-bit) on Windows Server 2022 Datacenter 10.0 <X64> (Build 20348: ) (Hypervisor)',
                instanceGuid: '3CD4B457-0BE9-44F5-A8E5-8E44EB93D1DF',
                totalStorage: 785.0048828125,
                noOfDatabases: '4',
                cpuUtilization: '4',
                deploymentType: 'fci',
                memUtilization: '[{"used":9992437760,"total":17178845184,"remaining":7186407424,"percentUsed":58}]',
                sqlInstanceName: 'MSSQLSERVER',
                totalThroughput: 225.2002027342632,
                vcpusPerInstance: '8',
                storageDetailsByDb:
                    '[{"databaseName":"DB1_ENG1","allocatedSizeMb":5120,"dataSizeMb":5120,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":81901,"driveAvailableSizeMb":34084},{"databaseName":"DB1_ENG1","allocatedSizeMb":102400,"dataSizeMb":0,"logSizeMb":1024,"driveLetter":"F:","driveTotalSizeMb":81901,"driveAvailableSizeMb":59262},{"databaseName":"DB1_ENG1","allocatedSizeMb":512000,"dataSizeMb":5120,"logSizeMb":0,"driveLetter":"G:","driveTotalSizeMb":61421,"driveAvailableSizeMb":54143},{"databaseName":"DB1_ENG1","allocatedSizeMb":51200,"dataSizeMb":5120,"logSizeMb":0,"driveLetter":"H:","driveTotalSizeMb":61421,"driveAvailableSizeMb":53119},{"databaseName":"DB1_ENG2","allocatedSizeMb":10240,"dataSizeMb":1024,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":81901,"driveAvailableSizeMb":34084},{"databaseName":"DB1_ENG2","allocatedSizeMb":10240,"dataSizeMb":0,"logSizeMb":1024,"driveLetter":"F:","driveTotalSizeMb":81901,"driveAvailableSizeMb":59262},{"databaseName":"DB1_ENG2","allocatedSizeMb":20480,"dataSizeMb":2048,"logSizeMb":0,"driveLetter":"G:","driveTotalSizeMb":61421,"driveAvailableSizeMb":54143},{"databaseName":"DB1_ENG2","allocatedSizeMb":30720,"dataSizeMb":3072,"logSizeMb":0,"driveLetter":"H:","driveTotalSizeMb":61421,"driveAvailableSizeMb":53119},{"databaseName":"DB2_HR4","allocatedSizeMb":40960,"dataSizeMb":40960,"logSizeMb":0,"driveLetter":"E:","driveTotalSizeMb":81901,"driveAvailableSizeMb":34084},{"databaseName":"DB2_HR4","allocatedSizeMb":20480,"dataSizeMb":0,"logSizeMb":20480,"driveLetter":"F:","driveTotalSizeMb":81901,"driveAvailableSizeMb":59262},{"databaseName":"master","allocatedSizeMb":5,"dataSizeMb":4,"logSizeMb":1,"driveLetter":"E:","driveTotalSizeMb":81901,"driveAvailableSizeMb":34084}]',
                licenceUsageDetails:
                    '[{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 128 GB Memory"},{"IsUsingFeature":0,"FeatureDescription":"SQL Server has > 48 vCPU"},{"IsUsingFeature":0,"FeatureDescription":"Tempdb metadata memory-optimized is enabled"},{"IsUsingFeature":1,"FeatureDescription":"User Databases are using Enterprise Level Features"},{"IsUsingFeature":1,"FeatureDescription":"You are using asynchronous mirroring"},{"IsUsingFeature":0,"FeatureDescription":"You are using peer-to-peer replication"},{"IsUsingFeature":0,"FeatureDescription":"You are using R or Python extensions"},{"IsUsingFeature":0,"FeatureDescription":"You are using Resource Governor"},{"IsUsingFeature":0,"FeatureDescription":"You have Asynchronous commit Replicas"},{"IsUsingFeature":0,"FeatureDescription":"You have read-only Replicas"}]'
            }
        ],
        assessment_data: {
            calculations: {
                single: {
                    fsxCloneCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ssdMonthlyCost: 0.04,
                        clonedCopiesCount: 1,
                        totalFsxnCapacity: 4294967296,
                        ssdStoragePerMonth: 343597383.68,
                        totalCloneMonthlyCost: 0.04,
                        desiredStorageCapacity: 343597383.68,
                        changeRateBetweenClones: 8,
                        monthlyChangeRatePercentage: 8,
                        effectiveFsxnStorageCapacity: 343597383.68,
                        percentageOfDataOnSsdStorage: 1,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapCalculation: {
                        maxSsdIops: 51200,
                        ebsCapacity: 4294967296,
                        includedIops: 3,
                        fsxnIopsPrice: 0.017,
                        maxThroughput: 4096,
                        maxSsdTierSize: 211106232532992,
                        ssdMonthlyCost: 128,
                        includedSsdIops: 3072,
                        numberOfVolumes: 1,
                        fsxnStoragePrice: { unit: 'UsdPerGiB', price: 0.125 },
                        requiredNumOfFsx: 1,
                        additionalSsdIops: 3366,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0219 },
                        ratioAfterSavings: 1,
                        provisionedSsdIops: 6438,
                        ssdStoragePerMonth: 4294967296,
                        capacityMonthlyCost: 0,
                        capacityPoolStorage: 0,
                        fsxnThroughputPrice: 0.72,
                        desiredStorageCapacity: 4294967296,
                        billedAdditionalSsdIops: 3366,
                        totalMonthlyCostForFSxSsd: 128,
                        totalMonthlyStorageCharge: 128,
                        requiredNumOfFsxFractional: 0.1257421875,
                        minFileSystemsNumForSsdIops: 0.1257421875,
                        minFileSystemsNumForStorage: 0.005208333333333333,
                        totalMonthlyCostForCapacity: 0,
                        effectiveFsxnStorageCapacity: 4294967296,
                        greaterOfSsdAndMinAllowedSsd: 1099511627776,
                        percentageOfDataOnSSDStorage: 1,
                        percentageOfDataOnSsdStorage: 1,
                        minThroughputCapacityRequired: 128,
                        provisionedThroughputCapacity: 256,
                        totalThroughputAndIopsMonthly: 241.542,
                        additionalBilledCostForSsdIops: 57.222,
                        dataOnCapacityPoolStorageFactor: 0,
                        suggestedFsxnThroughputCapacity: 256,
                        minFileSystemsNumForThroughputCapacity: 0.0625,
                        savingsFromCompressionAndDeduplication: 0,
                        totalMonthlyFsxnThroughputCapacityCost: 184.32,
                        storageSavingsFromCompressionAndDeduplication: 0
                    },
                    fsxOntapSnapshotCalculation: {
                        fsxnSsdPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ssdMonthlyCost: 128,
                        fsxnCapacityPrice: { unit: 'UsdPerGiB', price: 0.0219 },
                        ratioAfterSavings: 1,
                        ssdStoragePerMonth: 34359738.368,
                        capacityMonthlyCost: 0.006307200000000001,
                        capacityPoolStorage: 309237645.312,
                        desiredStorageCapacity: 343597383.68,
                        totalSnapshotMonthlyCost: 0.0103072,
                        totalMonthlyCostForCapacity: 0.006307200000000001,
                        effectiveFsxnStorageCapacity: 343597383.68,
                        percentageOfDataOnSsdStorage: 0.1,
                        dataOnCapacityPoolStorageFactor: 0.9,
                        totalSnapshotMonthlyCostForFsxSsd: 0.004,
                        savingsFromCompressionAndDeduplication: 0,
                        storageSavingsFromCompressionAndDeduplication: 0
                    }
                },
                ebsCalculation: {
                    io1: {
                        ebsIopsCost: 1673.75,
                        billableIops: 6437.5,
                        billableMbps: 0,
                        hoursInAMonth: 730,
                        ebsStorageCost: 2,
                        numberOfVolumes: 4,
                        ebsCapacityPrice: { unit: 'UsdPerGiB', price: 0.125 },
                        ebsInstanceMonth: 4,
                        ebsThroughputCost: 0,
                        totalBillableIops: 6437.5,
                        totalInstanceHours: 2920,
                        ebsTotalCostMonthly: 1676.582,
                        instanceAvgDuration: 730,
                        storageAmountPerVol: 4294967296,
                        billableThroughputGbps: 0,
                        billableThroughputMbps: 0
                    }
                },
                ebsCloneCalculation: {
                    io1: {
                        iops: 1673.75,
                        capacity: 2,
                        throughput: 0,
                        clonedCopiesCount: 1,
                        totalCloneMonthlyCost: 1675.75
                    }
                },
                ebsSnapshotCalculation: {
                    io1: {
                        storageAmount: 17179869184,
                        totalSnapshots: 30,
                        ebsSnapshotCost: 0.8320000000000001,
                        numberOfVolumes: 4,
                        ebsInstanceMonth: 4,
                        ebsSnapshotPrice: { unit: 'UsdPerGiB', price: 0.05 },
                        totalSnapshotCost: 0.208,
                        initialSnapshotCost: 0.2,
                        totalEbsSnapshotCost: 0.8320000000000001,
                        monthlyCostOfSnapshots: 0.0005333333333333334,
                        monthlyCostPerSnapshot: 0.0005333333333333334,
                        incrementalSnapshotCost: 0.008,
                        amountChangedPerSnapshot: 11453246.12266667,
                        monthlyChangeRatePercentage: 8,
                        discountForPartialStorageMonth: 0.0002666666666666667
                    }
                },
                existingComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'c5.2xlarge, c5.2xlarge',
                    machineDetails: [
                        {
                            price: 3.708,
                            basePrice: 0.708,
                            hoursInMonth: 730,
                            instanceType: 'c5.2xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 516.8399999999999,
                            licenseMonthlyPrice: 4380,
                            instanceMonthlyPrice: 2706.84
                        },
                        {
                            price: 3.708,
                            basePrice: 0.708,
                            hoursInMonth: 730,
                            instanceType: 'c5.2xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 516.8399999999999,
                            licenseMonthlyPrice: 4380,
                            instanceMonthlyPrice: 2706.84
                        }
                    ],
                    computeHourlyPrice: 1.416,
                    computeMonthlyPrice: 1033.68,
                    instanceMonthlyPrice: 5413.68
                },
                existingLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Enterprise Edition (64-bit)',
                    licenseHourlyPrice: 6,
                    licenseMonthlyPrice: 8760
                },
                recommendedComputeCalculation: {
                    hoursInMonth: 730,
                    instanceType: 'm5.xlarge, m5.xlarge',
                    machineDetails: [
                        {
                            price: 1.876,
                            basePrice: 0.376,
                            hoursInMonth: 730,
                            instanceType: 'm5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 274.48,
                            licenseMonthlyPrice: 2190,
                            instanceMonthlyPrice: 1369.48
                        },
                        {
                            price: 1.876,
                            basePrice: 0.376,
                            hoursInMonth: 730,
                            instanceType: 'm5.xlarge',
                            licenseIncluded: true,
                            computeMonthlyPrice: 274.48,
                            licenseMonthlyPrice: 2190,
                            instanceMonthlyPrice: 1369.48
                        }
                    ],
                    computeHourlyPrice: 0.752,
                    computeMonthlyPrice: 548.96,
                    instanceMonthlyPrice: 2738.96
                },
                recommendedLicenseCalculation: {
                    hoursInMonth: 730,
                    licenseIncluded: true,
                    sqlServerEdition: 'Enterprise Edition',
                    licenseHourlyPrice: 3,
                    licenseMonthlyPrice: 4380
                }
            },
            storageSavings: {
                ebs: { iops: 1673.75, total: 3352.33, clones: 1675.75, capacity: 2, snapshots: 0.83, throughput: 0 },
                fsx: { iops: 57.22, total: 369.59, clones: 0.04, capacity: 128, snapshots: 0.01, throughput: 184.32 },
                single: {
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
                        ssdIop: 6438,
                        savings: 0,
                        useCase: 'Low-latency',
                        regionName: 'US East (N. Virginia)',
                        throughput: 0,
                        percentageSsd: 100,
                        deploymentType: 'Single',
                        numberOfVolumes: 1,
                        capacityPoolTier: 0,
                        effectiveCapacity: 4294967296,
                        ssdTierReqCapacity: 4294967296,
                        throughputCapacity: 256,
                        totalStorageCapacity: 4294967296,
                        monthlySnapshotCapacity: 343597383.68
                    }
                },
                compute: {
                    existing: {
                        hoursInMonth: 730,
                        instanceType: 'c5.2xlarge, c5.2xlarge',
                        machineDetails: [
                            {
                                price: 3.708,
                                basePrice: 0.708,
                                hoursInMonth: 730,
                                instanceType: 'c5.2xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 516.8399999999999,
                                licenseMonthlyPrice: 4380,
                                instanceMonthlyPrice: 2706.84
                            },
                            {
                                price: 3.708,
                                basePrice: 0.708,
                                hoursInMonth: 730,
                                instanceType: 'c5.2xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 516.8399999999999,
                                licenseMonthlyPrice: 4380,
                                instanceMonthlyPrice: 2706.84
                            }
                        ],
                        computeHourlyPrice: 1.416,
                        computeMonthlyPrice: 1033.68,
                        instanceMonthlyPrice: 5413.68
                    },
                    recommended: {
                        hoursInMonth: 730,
                        instanceType: 'm5.xlarge, m5.xlarge',
                        machineDetails: [
                            {
                                price: 1.876,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'm5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 2190,
                                instanceMonthlyPrice: 1369.48
                            },
                            {
                                price: 1.876,
                                basePrice: 0.376,
                                hoursInMonth: 730,
                                instanceType: 'm5.xlarge',
                                licenseIncluded: true,
                                computeMonthlyPrice: 274.48,
                                licenseMonthlyPrice: 2190,
                                instanceMonthlyPrice: 1369.48
                            }
                        ],
                        computeHourlyPrice: 0.752,
                        computeMonthlyPrice: 548.96,
                        instanceMonthlyPrice: 2738.96
                    }
                },
                license: {
                    finding: 'OPTIMIZED',
                    existing: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Enterprise Edition (64-bit)',
                        licenseHourlyPrice: 6,
                        licenseMonthlyPrice: 8760
                    },
                    recommended: {
                        hoursInMonth: 730,
                        licenseIncluded: true,
                        sqlServerEdition: 'Enterprise Edition',
                        licenseHourlyPrice: 3,
                        licenseMonthlyPrice: 4380
                    }
                },
                totalSummary: { existing: 13146.01, recommended: 5298.55 }
            }
        },
        creation_time: new Date(),
        version: '1.0.0'
    }
];

const onpremStdUploadObject = {
    fileContent:
        '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',
    fileName: 'SQLServerDataResponse-GOLDEN-STD1.json'
};

const onPremFCIUploadObject = {
    fileContent:
        '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',
    fileName: 'SQLServerDataResponse-GOLD-FCI.json'
};

const onPremAOAGAUploadObject = {
    fileContent:
        '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',
    fileName: 'SQLServerDataResponse-GOLDEN-AOAG.json'
};

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
    onpremStdUploadObject,
    onPremAOAGAUploadObject,
    onPremFCIUploadObject,
    onPremRecords
};
