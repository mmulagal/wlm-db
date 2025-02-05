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
        'H4sIAHU/o2cAA81b2XqqShp9JUDdp73oC1HAYgdskGK6C5CNTMavnYCn71WFSdRM7NM5Zl/wxUhR9Q/rH2oVPhyFn2Q6yWLJbO59WXArt4ml8hBl5AeZkvoun+yNKdnOrMeUTPU29mon9HUJlx5V4YHkj6nXzZGS+dacZvjLPk/1TbQ2hcAb5SFNxHvPyhbZJDPaUjEVRTRm1s5yjIGRCYI9s0Z3lLSLmbIzZ/J0MbMGNlWGtkJFkh3P59zee2YZVWbp+uYqlFwl9O3VvVe3TA5S7v7yp7oei257743WduWukrnbhO4xW+STLe5poacKia+Xtua2wUDfxHN7E0mjmOSbmJSm7Uzlk34kvdfUlqg1ZJ204XJSG3ma2gJJHc/dRQN9hPnGd/NdTIqyhTybqEqe5/en5IcxrXEvLAPfFuOKyWrmcVUeEw32LSETLiqqBlHNMl6HZZzJj4FvpP6cHo2ZWZKZNSTzcEZVNyZrYfsgHrOlb7rwzz4UnueF7I/HO/WYPetL7fLJn/feeM9kgaw09MRjqJE08lz4xV4lmsI+c13uvDGTa3fvb8pwKm/iRoad1SzS3OIr9MRzTD8FY1ZBpbYh9AzwPJl3viKKu080YG8On0g0dTRXCr1j+qyTb36FDcJoQC/XhY8fgNH7uX6IqrEIvWEDvYFNmJ7/zJpzuQS+don2r12sucwu0E9m2IZPOpv9Wtb/J5bLQ7KUV3FF04T7LE5pJh+wlvXg24+RNExDfyWE3gjzj/cxdPxH1qzcNhq4TQCf2tKY5Y09bPtldkWMSuFSluNBuQ+kVQNZDgnDljTeRV4pEFUvY63eBJLafgWOPW8sEm21SqAjxqzCqQjc1KPrdfzlU87kuStjceb6sJVW/sD8sNmQ50NvAHnWbht6NtN7YMxoY8yKkemkArNBoo0Rq5Arfxziu+HCUY6mUzTsHtbfBV65Z77i8ju0NfO0NpzJccF0WctljFwZrW3YmMUx+bGYvSFbNf5PWLB8oGYBi9Omy/0vef80bpDs4b9FJMEffIweMR+ymI08tXlgOGGxLtSmreiOq1j1W7aIB+p2CdxhPfjMXQSeWPL8XYgOy4dUcJdu4S6vcj+rPR7W53g9jd8Ag4dYGlcJ8jalx5RKbpOghpEZORo5SX+qOnWWRXqH/G1mw+NdriC3TvZmNnn0ZoHwcynHiTLOE6yxmE5ge4JnJ+Iip8NFTkTkf8GSxscHX9+E0kog09Xs5/I0TrlYfwZcH3GdYrgWbG8kQN4jMIT6IauhVnL8kmkqmVMxu/etDdHwv5oAi/YhGRiv5KcDe4V7iCkrhV9RiyEv/GtIZmDm9ukzTX8qOmpsXfDnWmsIbG0gK3nwgYF1iJw6bn6+8oN9iCt1zeILvthEc3P6QO3srJYWz/majlbAcBfnlbjCs2UMXzMcAp/bSGK5yy2oVP4IqZgxrJlMttmEx3KoqULgmpuHyjUDFku5xfIJnkscVnMcDzkhf6z5WOAJNjBQ25n9ujULAzFP2DMF7CmFLuylqdvz9YwccTM7G0NVCfGxDTx9G16sTUdG7na5ALZ9wr1TqTue6zAG+hWolbUBeT7S0XACpiNfk9nq/B6Pwao+hOL52umZfHWZzDs78tzC9MzYMzZyXVi6Xeyf26c1ZsHQaF7GWH7I+h/4qC4v5GqBYSf8UEcq2oqtkOZk11Wk1QfkL9QE+3zN4fs+5Lpc+7Ab+6YPi099aLaKsFh+rh/G1abf1RAul6evkON4LjnVB+QfW7FyrM1tqm4jbZzDR2WoXujwrv94PfgN/y0/99/AcNDrvthHTirEHXyDPutqnCKe6vHbMViaFN6bGtD/Q3zmVFq8px+796aO3fg3dWw/1XFoOHHbQ0fRdGLpK3REzI/Mk8z9fGg1Cyd4V0dn9mU6Yk9jDfvoaH6aZ4rmXT+ye7/pR8f5VMcR5h30wmpufJGOqIu/FYvK0OzqyNs6fh6P/XVsJ00vHZFbP45HIrwfj7j3u378PB5r1qsYvXJq0S565VTo/GFOJQPE4zs1g+tyXTMasw3erxul8nntd9CT5UqP2h8LRp70qYvSzepiyWz7mX5KY85oD/0U8BQ9sfpJ/wacHru443Z6pQt8v37d73QYw/5dYPv5J9wwu57pTyPW115ghsltiT1iEfsb9Lin/ePHOMX+/W/W/t+NQ/fzmgH9iNSnt4F+wPJpr/oxRgd/H6NvxuHwfYzSHhgljZkXfTAK/UgvjC4+qRkfYJTrco3R09i3MOr1wGiLPUaful8bLRH69aerm/Wnbp9a0ZJRr/2FYyAffbyHOmEUPOmt8mjaA6NWi96tD0ZRJ4Je/enik5r/hXk07IFRwWiVPj1Njb5ZMtdi8gbP8sJVcJ7lkpu1PXvDOQ5wKOi/dkFVgke55Bbw7PGcI0rAFWIOPRrI4Md4vXsaKzH/GzO5w+ZaL8FNvzUOe9/J8eTfAXwnhFQfYc6WQjbwJvnV+Ofn0Is04H3E07MNOL/CWuN537SAHSf0wC3zXvHiuZTMUnD/AfqnjscwpsMR6+9+uUJ2NzmdebCrMg/Adsf78HMTHVxU/csBnu+9Ye0LCbh0cKBe/csSJ/jf1H1Bda7sLgUDWYxF8DVFuQf/AN4HZwDM/rl1vd4xcV3MXcPvbI2Tn3KrvpqzYLxyNCh34HkFd14ewyWXj3NviDfgdVSS9On8RuDP+svTHGvwlJ7Lxu5i2BacIOO9YBPGMU1E9FzoV5/PhgbgIQtwhC34sn1YlWsm0+l8id3PI/DfDEdONS5OccTPbbxG97HdVSwWTzMle16/4yYx9omfMsCZytELzuS/zjDH1oCNRY5xNu9iem4LZrfVAXbVw06X2iiMo0GpgDMo5D3syx0L+gU7cKSavRRGCycGD4t8Qd2ZTYNLH3DZEJvg1e4F+L8KNyHjuZ+53XM5u+vFFucyMTtQzgWDE0VuPD7SrEgXsLPZ2gZREvCOKuMKU+dpvQZcozTaA7ed7y98fhbHOFsIFRH8LLPbBLoYezDaLD+wfZaE/f95zD7rxc6GwOujbtijWOtks3FmwLj7EHIgnyGejOz62V8vfnvHP092Q43ocGjizANnLeYhXFs462F5ip0RkNSSapFzjJns4TxGSDx1SxQVeVhG3JJrX3TX2jyGnlsgv3W5Z1aIRhvszZbl/ECAbxvzlYzcVivEAnh+tzmLETXRVuDPRyW4YdQosjcacq3f+EI/Vbiyp/4I3QReE7s5L3B+jadTvr4403yNGeQJrxZP80X+XI+Rh7mtXz53F6tboR/iTMLVQ9QD+JF9F/tq3V3TEf9LlVVIhXJm0VqhRYnq3OXiuKzBVT/rynjfQ6i5yKFsbfxfhmYiqQ247RcfaTZqxDalguksl7Jy75v/JQritypz1hfcqXXja8Mzm71Vy2FDfG+xfqV8GY9a/CIT+o7X8p3WoSU/6+hkPOmK6677bC3V0llSU3YUe7l0Q9V4R67IQ+7pzl74/07hUsuVLaLUrpPJszvK7EG/RFeb9xM30JX3D9+r65LtlW6hK+cNv1lXxrPdQNeOW/tmXW+E4Y5j+2Zdb5SbOo7me3XlfPgtdP0D4pXz4jfQteM1vlnXG8Vrtz/+Zl1v1Uv07Z2KkeoqqkWnsuHSYWo1osneq8C7YDMqFKmtlS36fPSCvH97Z87XHEEnJ+PL9TP9hO0/0ycqeL8De+rX8+2YLtHLXAvbtWWqTlJHdRdEMXYO8/1SdizR1OFT3jPinSKJvd/3zpyvOa1u7iXjRM70G5/j4kF8AyOndZbdOzf8u2dd1eO++ysTzzV1S1ANW9V1MDr1n9A70ZvhGJzIt+PYuhWOhT8Ax+6tcPwn9E/urfY7TvgH4Di+FY6786DvxXFwKxz/CT2Ud6N+0XDKPwDHjzfCMel4/u/F8f01jvnn8or755duAUuHyJfFjt/uxfex55YJ3oONNZXjoePwk3LhWOAx8dsL9vsI/psIRQozcWV4bnbnBYOgwjusLd5hlJTj4vLcpbtKvAsrrQ7JWzLN7Sbx6AWP+Yq3rUZi5OF95mJcueyswef8sfCK/x6YV+dEF+/D+k/nAS+/bzi9N6vy34WAy9WL57MHJod1+nzOo1Z6CU54Hw5MGgnmFu+Vc/4X/HoFHhTv1b6cFSTsPXJtPIhFc8S444ifMXT89fk7yd2ajLvdMP723/8D/viWZgQzAAA=',
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
