/* eslint-disable no-await-in-loop */
import randomize from 'randomatic';
import * as fs from 'fs';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { randomUUID } from 'crypto';
import { compressSync } from 'fflate';
import path from 'path';
import { offlineAssessmentDemoSTD } from './offlineAssessmentRecords/offlineAssessmentDemoSTD';
import { offlineAssessmentDemoFCI } from './offlineAssessmentRecords/offlineAssessmentDemoFCI';
import { offlineAssessmentDemoAOAG } from './offlineAssessmentRecords/offlineAssessmentDemoAOAG';
import {
    AWS_REGIONS,
    DatabaseTypes,
    DEFAULT_INSTANCE_NAME,
    RESOURCESTYPE,
    SqlServerDeploymentModel,
    STORAGE_PROTOCOLS
} from '../consts';
import { checkAccount, getSubJobDescriptions } from '../utils';
import { AssessmentCategories } from '../continous-optimization-consts';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../../lib/database/database-instance-config';
import { DatabaseInstanceConfigData } from '../../lib/database/db-types';
import getLogger from '../logger';

const logger = getLogger();
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

function mockPGSqlStandaloneDeploymentStack(
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

function generateBase64FromJsonFile(directory: string, fileName: string) {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const JsonFilePath = path.join(__dirname, `${directory}/${fileName}`);
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

function generateBase64ForOnPrem(fileName: string) {
    return generateBase64FromJsonFile('onPremRecords', fileName);
}

const onpremStdBase64Content = generateBase64FromJsonFile('onPremRecords', 'SQLServerDataResponse-DemoSTD.json');

const onpremStdUploadObject = {
    fileContent: onpremStdBase64Content,
    fileName: 'SQLServerDataResponse-GOLDEN-STD1.json'
};

const onpremFCIBase64Content = generateBase64FromJsonFile('onPremRecords', 'SQLServerDataResponse-DemoFCI.json');

const onPremFCIUploadObject = {
    fileContent: onpremFCIBase64Content,
    fileName: 'SQLServerDataResponse-GOLD-FCI.json'
};

const onpremAOAGBase64Content = generateBase64FromJsonFile('onPremRecords', 'SQLServerDataResponse-DemoAOAG.json');

const onPremAOAGAUploadObject = {
    fileContent: onpremAOAGBase64Content,
    fileName: 'SQLServerDataResponse-GOLDEN-AOAG.json'
};

function generateBase64FromData(data: object): string {
    const jsonString = JSON.stringify(data);
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

const offlineAssessmentStdBase64Content = generateBase64FromData(offlineAssessmentDemoSTD);

const offlineAssessmentStdUploadObject = {
    fileContent: offlineAssessmentStdBase64Content,
    fileName: 'OfflineAssessment-DemoSTD.json'
};

const offlineAssessmentFCIBase64Content = generateBase64FromData(offlineAssessmentDemoFCI);

const offlineAssessmentFCIUploadObject = {
    fileContent: offlineAssessmentFCIBase64Content,
    fileName: 'OfflineAssessment-DemoFCI.json'
};

const offlineAssessmentAOAGBase64Content = generateBase64FromData(offlineAssessmentDemoAOAG);

const offlineAssessmentAOAGUploadObject = {
    fileContent: offlineAssessmentAOAGBase64Content,
    fileName: 'OfflineAssessment-DemoAOAG.json'
};

const oracleStandaloneBase64 = generateBase64ForOnPrem('OracleDataResponse-DemoStandalone.json');
const oracleStandaloneUploadObject = {
    fileContent: oracleStandaloneBase64,
    fileName: 'OracleDataResponse-DemoStandalone.json'
};

const oracleDataGuardBase64 = generateBase64ForOnPrem('OracleDataResponse-DemoDataGuard.json');
const oracleDataGuardUploadObject = {
    fileContent: oracleDataGuardBase64,
    fileName: 'OracleDataResponse-DemoDataGuard.json'
};

const oracleMultiDBBase64 = generateBase64ForOnPrem('OracleDataResponse-DemoMultiDB.json');
const oracleMultiDBUploadObject = {
    fileContent: oracleMultiDBBase64,
    fileName: 'OracleDataResponse-DemoMultiDB.json'
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
        }
    }
};

const demoFsxId = 'fs-0d5efc3057c4f12cb';

const MAPPED_ONTAP_VOLUMES_DATA = {
    SQL1: {
        lunRecords: [
            {
                name: '/vol/wlmdb_sqllog_1737955806953/sqllog',
                uuid: '5b2c2bfb-2bbf-4acd-be19-f690944c1451',
                serial_number: 'SERIAL1'
            },
            {
                name: '/vol/wlmdb_sqldata_1737955806953/sqldata',
                uuid: '81e84adc-cdb8-4cf1-8a85-a5559d18f2c7',
                serial_number: 'SERIAL2'
            }
        ],
        volumeDBMap: [
            {
                databaseName: 'dsfs',
                ontapVolumeuuid: '73df15ec-dc72-11ef-b430-bb0ad6a3b8df'
            },
            {
                databaseName: 'dsfs',
                ontapVolumeuuid: '73c4863d-dc72-11ef-b430-bb0ad6a3b8df'
            },
            {
                databaseName: 'kljghfgf',
                ontapVolumeuuid: '73df15ec-dc72-11ef-b430-bb0ad6a3b8df'
            },
            {
                databaseName: 'kljghfgf',
                ontapVolumeuuid: '73c4863d-dc72-11ef-b430-bb0ad6a3b8df'
            }
        ],
        volumeRecords: [
            {
                svm: {
                    uuid: '2b03dfe8-dc72-11ef-b430-bb0ad6a3b8df',
                    _links: {
                        self: {
                            href: '/api/svm/svms/2b03dfe8-dc72-11ef-b430-bb0ad6a3b8df'
                        }
                    }
                },
                name: 'wlmdb_sqllog_1737955806953',
                uuid: '73c4863d-dc72-11ef-b430-bb0ad6a3b8df',
                fsxVolumeId: 'fsvol-043070d5487',
                snapshot_count: 9
            },
            {
                svm: {
                    uuid: '2b03dfe8-dc72-11ef-b430-bb0ad6a3b8df',
                    _links: {
                        self: {
                            href: '/api/svm/svms/2b03dfe8-dc72-11ef-b430-bb0ad6a3b8df'
                        }
                    }
                },
                name: 'wlmdb_sqldata_1737955806953',
                uuid: '73df15ec-dc72-11ef-b430-bb0ad6a3b8df',
                fsxVolumeId: 'fsvol-0e5d5b33d988',
                snapshot_count: 15
            }
        ]
    }
};

const PDB_DETAILS = {
    name: 'pdb1',
    size: 2500000000,
    status: 'online',
    type: 'PDB',
    created: `${new Date(Date.now()).toISOString().split('.')[0]}Z`,
    service: 'ip-172-31-48-50.ap-southeast-1.compute.internal:1521'
};

const ORACLE_MAPPED_ONTAP_VOLUMES_DATA = (fsxId: string, protocol: string, oracleSid: string, isCDB: boolean) => {
    if (isCDB) {
        oracleSid = 'PDB1';
    }

    const mappedVolData = {
        [fsxId]: {
            protocol,
            lunRecords: [],
            isASMManaged: protocol === STORAGE_PROTOCOLS.ISCSI,
            volumeMappings: [
                {
                    [oracleSid]: {
                        isCDB,
                        ontapVolumes: {}
                    }
                }
            ]
        }
    };

    const volData = {
        REDO_LOGS: [
            {
                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                volumeId: 'cc802ccc-eee7-11ef-8fbb-837e18df6f7a',
                volumeName: 'oraclearch2',
                lunName: '/vol/wlmdb_oraclearch_1735809893269/lun4',
                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7d',
                diskGroup: 'DISK4',
                diskName: 'DISK1',
                copiesCount: 1
            }
        ],
        DATA_FILES: [
            {
                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                volumeId: 'db1ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                volumeName: 'oracledata2',
                lunName: '/vol/wlmdb_oracledata_1735809893269/lun2',
                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7b',
                diskGroup: 'DISK2',
                diskName: 'DISK1',
                copiesCount: 1
            }
        ],
        TEMP_FILES: [
            {
                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                volumeId: 'db3ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                volumeName: 'oracleredo2',
                lunName: '/vol/wlmdb_oracletemp_1735809893269/lun3',
                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7c',
                diskGroup: 'DISK3',
                diskName: 'DISK1',
                copiesCount: 1
            }
        ],
        ARCHIVE_LOGS: [
            {
                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                volumeId: 'cc802ccc-eee7-11ef-8fbb-837e18df6f7a',
                volumeName: 'oraclearch2',
                lunName: '/vol/wlmdb_oraclearch_1735809893269/lun4',
                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7d',
                diskGroup: 'DISK4',
                diskName: 'DISK1',
                copiesCount: 1
            }
        ],
        CONTROL_FILES: [
            {
                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                volumeId: 'db1ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                volumeName: 'oracledata2',
                lunName: '/vol/wlmdb_oraclectrl_1735809893269/lun5',
                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7e',
                diskGroup: 'DISK5',
                diskName: 'DISK1',
                copiesCount: 1
            },
            {
                svmId: '4a56fd34-c8ec-11ef-a881-1fbfd81226d0',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                volumeId: 'cc802ccc-eee7-11ef-8fbb-837e18df6f7a',
                volumeName: 'oraclearch2',
                lunName: '/vol/wlmdb_oraclearch_1735809893269/lun4',
                lunId: '1b1ed9f2-eee7-11ef-8fbb-837e18df6f7d',
                diskGroup: 'DISK4',
                diskName: 'DISK1',
                copiesCount: 1
            }
        ]
    };

    if (isCDB) {
        mappedVolData[fsxId].volumeMappings[0][oracleSid].ontapVolumes = {
            PDB1: volData
        };
    } else {
        mappedVolData[fsxId].volumeMappings[0][oracleSid].ontapVolumes = volData;
    }

    return mappedVolData;
};

const ASSESMENT_CONFIG_DATA = {
    os: {
        'mpio-enabled': false,
        'mpio-iscsi-count': '50',
        'ntfs-allocation-details': [
            { DriveLetter: 'S', BlockSize: 6553 },
            { DriveLetter: 'T', BlockSize: 6553 },
            { DriveLetter: 'L', BlockSize: 6553 }
        ],
        'ntfs-allocation-unit-size': 6553,
        'mpio-load-balance-policy': 'Other',
        'mpio-load-balance-policy-details': [
            {
                disk: 'Disk 4',
                accessPath: 'L:\\',
                policy: 'LB'
            },
            {
                disk: 'Disk 1',
                accessPath: 'S:\\',
                policy: 'LB'
            },
            {
                disk: 'Disk 8',
                accessPath: 'T:\\',
                policy: 'LB'
            }
        ],
        'mpio-timeout': 40
    },
    luns: [
        {
            name: '/vol/wlmdb_sqldata_1728552629461/sqldata',
            'os-type': 'windows',
            'space-reservation-enabled': false,
            'space-allocation-allocated': false
        },
        {
            name: '/vol/wlmdb_sqltemp_1728552629461/tempdb',
            'os-type': 'windows',
            'space-reservation-enabled': false,
            'space-allocation-allocated': false
        },
        {
            name: '/vol/wlmdb_sqldata_1728574994/sqldata',
            'os-type': 'windows',
            'space-reservation-enabled': false,
            'space-allocation-allocated': false
        }
    ],
    layout: {
        'user-database-layout': {
            log: [
                {
                    name: 'RetailBanking',
                    lunPath: '/vol/wlmdb_sqldata_1750140716368/sqldata',
                    lunUuid: '00fd15a5-ff14-4ad2-a9a5-b5c66d0a3381',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 23.8125,
                    diskNumber: 1,
                    accessPaths: ['S:\\', '\\\\?\\Volume{68d026b4-dc23-4799-aecb-2bb59d251e32}\\'],
                    databaseDetails: [
                        {
                            name: 'RetailBanking',
                            sizeInMb: 23.8125
                        }
                    ],
                    lunSerialNumber: 'lWB5g?XW76m/',
                    ontapVolumeName: 'wlmdb_sqldata_1750140716368',
                    ontapVolumeUuid: 'af03a358-4b44-11f0-a105-fda4bda8e620'
                }
            ],
            data: [
                {
                    name: 'RetailBanking',
                    lunPath: '/vol/wlmdb_sqldata_1750140716368/sqldata',
                    lunUuid: '00fd15a5-ff14-4ad2-a9a5-b5c66d0a3381',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 16.875,
                    diskNumber: 1,
                    accessPaths: ['S:\\', '\\\\?\\Volume{68d026b4-dc23-4799-aecb-2bb59d251e32}\\'],
                    databaseDetails: [
                        {
                            name: 'RetailBanking',
                            sizeInMb: 16.875
                        }
                    ],
                    lunSerialNumber: 'lWB5g?XW76m/',
                    ontapVolumeName: 'wlmdb_sqldata_1750140716368',
                    ontapVolumeUuid: 'af03a358-4b44-11f0-a105-fda4bda8e620'
                }
            ],
            tempDb: [
                {
                    name: 'tempdev',
                    lunPath: '/vol/wlmdb_sqltemp_1750140716368/tempdb',
                    lunUuid: 'c8bcdf6e-060c-4cb9-b07e-d8036108379f',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 8,
                    diskNumber: 3,
                    accessPaths: ['T:\\', '\\\\?\\Volume{f3a06d64-ba64-40e9-af09-123ca22ac071}\\'],
                    lunSerialNumber: 'lWB5g?XW76mb',
                    ontapVolumeName: 'wlmdb_sqltemp_1750140716368',
                    ontapVolumeUuid: 'b50523e3-4b44-11f0-a105-fda4bda8e620'
                }
            ]
        },
        'tempdb-files-location': 'separate-drive',
        'default-log-files-location': 'shared-drive',
        'default-data-files-location': 'shared-drive'
    },
    sizing: {
        'performance-tier': [
            {
                volumeName: 'wlmdb_sqldata_1740015122754',
                performanceTierPercent: 95
            },
            {
                volumeName: 'wlmdb_sqllog_1740027207',
                performanceTierPercent: 94
            },
            {
                volumeName: 'wlmdb_sqltemp_1740015122754',
                performanceTierPercent: 100
            }
        ],
        'data-log-drive-details': [
            {
                databaseName: 'msdb',
                logDrivePath: 'S:\\mssql\\system\\MSSQL15.MSSQLSERVER\\MSSQL\\DATA\\MSDBLog.ldf',
                dataDrivePath: 'S:\\mssql\\system\\MSSQL15.MSSQLSERVER\\MSSQL\\DATA\\MSDBData.mdf',
                logAccessPath: 'S:\\mssql',
                dataAccessPath: 'S:\\mssql',
                logDriveLetter: 'S:',
                dataDriveLetter: 'S:',
                logDriveTotalSizeMB: 307,
                dataDriveTotalSizeMB: 3071820
            },
            {
                lunUuid: 'ce0cca99-e9fd-42af-9daa-50039625d44d',
                svmName: 'wlmdb_sqlsvm_1731915150431',
                diskNumber: 8,
                databaseName: 'Nachos',
                logDrivePath: 'G:\\MSSQL\\log\\Nachos_log.ldf',
                dataDrivePath: 'F:\\MSSQL\\data\\Nachos_data.mdf',
                logAccessPath: 'G:\\MSSQL',
                dataAccessPath: 'F:\\MSSQL',
                logDriveLetter: 'G:',
                dataDriveLetter: 'F:',
                ontapVolumeName: 'wlmdb_sqllog_1731988070',
                ontapVolumeUuid: '1c3c25e9-a629-11ef-8dba-75539f3dc73f',
                diskSerialNumber: 'lWB4c$XRevTA',
                logDriveTotalSizeMB: 97,
                dataDriveTotalSizeMB: 429420
            },
            {
                lunUuid: '74897647-0db1-4e4c-934a-8faa6cae7087',
                svmName: 'wlmdb_sqlsvm_1731915150431',
                diskNumber: 6,
                databaseName: 'Primordial',
                logDrivePath: 'E:\\MSSQL\\log\\Primordial_log.ldf',
                dataDrivePath: 'D:\\MSSQL\\data\\Primordial_data.mdf',
                logAccessPath: 'E:\\MSSQL',
                dataAccessPath: 'D:\\MSSQL',
                logDriveLetter: 'E:',
                dataDriveLetter: 'D:',
                ontapVolumeName: 'wlmdb_sqllog_1731987160',
                ontapVolumeUuid: 'f3c8df60-a626-11ef-8dba-75539f3dc73f',
                diskSerialNumber: 'lWB4c$XRevT9',
                logDriveTotalSizeMB: 107,
                dataDriveTotalSizeMB: 1072200
            }
        ],
        'data-tempdb-drive-details': {
            lunUuid: 'ab3fd3b5-b2e2-4c97-b026-52ba19accc41',
            svmName: 'wlmdb_sqlsvm_1731915150431',
            diskNumber: 6,
            ontapVolumeName: 'wlmdb_sqltemp_1731915150431',
            ontapVolumeUuid: 'c4585626-a581-11ef-8dba-75539f3dc73f',
            tempdbDrivePath: 'T:\\mssql\\data\\tempdb.mdf',
            diskSerialNumber: 'lWB4c$XRevT9',
            tempdbDriveLetter: 'T:',
            dataDriveTotalSizeMB: 9731000,
            defaultDataDriveLetter: 'S:',
            tempdbDriveTotalSizeMB: 42
        }
    },
    volumes: [
        {
            name: 'wlmdb_sqldata_1728552629461',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': false,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 0,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'daily_weekretention',
            'tiering-min-cooling-days': 17,
            uuid: 'c4585626-a581-11ef-8dba-75539f3dc73f'
        },
        {
            name: 'wlmdb_sqltemp_1728552629461',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': false,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 0,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'daily_weekretention',
            'tiering-min-cooling-days': 17,
            uuid: 'c4585626-a581-11ef-8dba-75539f3dc73f'
        },
        {
            name: 'wlmdb_sqldata_1728574994',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': true,
            'tiering-policy': 'auto',
            'space-guarantee': 'volume',
            'fractional-reserve': 0,
            'snapshot-autodelete': false,
            'snapshot-copy-reserve': 15,
            'snapshot-policy': 'none',
            'tiering-min-cooling-days': 17,
            uuid: 'c4585626-a581-11ef-8dba-75539f3dc73f'
        }
    ],
    filesystemId: 'fs-07a22f282fd4f5a20',
    ec2InstanceId: 'i-0abcd1234efgh5678',
    databaseInstanceName: 'MSSQLSERVER'
};

const ASSESSMENT_CRR_CONFIG_DATA = {
    errors: '',
    crrDetails: [
        {
            volumeName: 'wlmdb_sqldata_1728552629461',
            peerSVMName: 'wlmdb_sqlsvm_1737955690776',
            isCRREnabled: true,
            sourceSvmUuid: '6aec6a14-b23f-11ef-a881-1fbfd81226d0',
            isSnapMirrored: true,
            peerClusterName: 'FsxId01d9727eb6a7d3e9a',
            peerClusterAWSId: 'fs-01d9727eb6a7d3e9a',
            destinationVolumeName: 'wlmdb_sqldata_1728552629461_dp',
            destinationPath: 'wlmdb_sqlsvm_1737955690776:wlmdb_sqldata_1728552629461_dp'
        },
        {
            volumeName: 'wlmdb_sqltemp_1728552629461',
            peerSVMName: 'wlmdb_sqlsvm_1737955690776',
            isCRREnabled: true,
            sourceSvmUuid: '6aec6a14-b23f-11ef-a881-1fbfd81226d0',
            isSnapMirrored: true,
            peerClusterName: 'FsxId01d9727eb6a7d3e9a',
            peerClusterAWSId: 'fs-01d9727eb6a7d3e9a',
            destinationVolumeName: 'wlmdb_sqltemp_1728552629461_dp',
            destinationPath: 'wlmdb_sqlsvm_1737955690776:wlmdb_sqltemp_1728552629461_dp'
        },
        {
            volumeName: 'wlmdb_sqldata_1728574994',
            peerSVMName: 'wlmdb_sqlsvm_1737955690776',
            isCRREnabled: true,
            sourceSvmUuid: '6aec6a14-b23f-11ef-a881-1fbfd81226d0',
            isSnapMirrored: true,
            peerClusterName: 'FsxId01d9727eb6a7d3e9a',
            peerClusterAWSId: 'fs-01d9727eb6a7d3e9a',
            destinationVolumeName: 'wlmdb_sqldata_1728574994_dp',
            destinationPath: 'wlmdb_sqlsvm_1737955690776:wlmdb_sqldata_1728574994_dp'
        }
    ]
};

const ASSESSMENT_AWS_BACKUP_DATA = {
    filesystemId: 'fs-07a22f282fd4f5a20',
    isAWSBackupEnabled: true
};

const ASSESSMENT_MAXDOP_CONFIG_DATA = { status: 'not-optimized', current: '2', recommendedMaxDOP: '4' };

const ASSESSMENT_CLONE_CONFIG_DATA = {
    cloneDetails: [
        {
            cloneDatabaseName: 'sandbox_1743487277979',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'apr1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743487515',
                    cloneVolumeUuid: '4bc548cb-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:05:22+00:00',
                    cloneDatabaseName: 'sandbox_1743487277979',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743487515',
                    cloneVolumeUuid: '4d307ed8-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:05:24+00:00',
                    cloneDatabaseName: 'sandbox_1743487277979',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'sandbox_ap90',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'test1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743494323',
                    cloneVolumeUuid: '2686b0fe-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:51+00:00',
                    cloneDatabaseName: 'sandbox_ap90',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743494323',
                    cloneVolumeUuid: '27cbcb75-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:53+00:00',
                    cloneDatabaseName: 'sandbox_ap90',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'sandbox_test234',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'test1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743487598',
                    cloneVolumeUuid: '7dc7d028-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:06:46+00:00',
                    cloneDatabaseName: 'sandbox_test234',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743487598',
                    cloneVolumeUuid: '7f32d8e6-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:06:48+00:00',
                    cloneDatabaseName: 'sandbox_test234',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'apr11',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743494323',
                    cloneVolumeUuid: '2686b0fe-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:51+00:00',
                    cloneDatabaseName: 'apr11'
                }
            ]
        },
        {
            cloneDatabaseName: 'test1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743494323',
                    cloneVolumeUuid: '27cbcb75-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:53+00:00',
                    cloneDatabaseName: 'test1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743494327',
                    cloneVolumeUuid: '29ef6b80-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:57+00:00',
                    cloneDatabaseName: 'test1'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_ap90002',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743494327',
                    cloneVolumeUuid: '29ef6b80-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:57+00:00',
                    cloneDatabaseName: 'sandbox_ap90002'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743494327',
                    cloneVolumeUuid: '2bfe23e8-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:59:00+00:00',
                    cloneDatabaseName: 'sandbox_ap90002'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_test1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743494327',
                    cloneVolumeUuid: '2bfe23e8-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:59:00+00:00',
                    cloneDatabaseName: 'sandbox_test1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743486831',
                    cloneVolumeUuid: 'b519f67b-0ebd-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T05:53:59+00:00',
                    cloneDatabaseName: 'sandbox_test1'
                }
            ]
        },
        {
            cloneDatabaseName: 'master',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'master'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'master'
                }
            ]
        },
        {
            cloneDatabaseName: 'model',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'model'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'model'
                }
            ]
        },
        {
            cloneDatabaseName: 'msdb',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'msdb'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'msdb'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567890',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'sandbox_apr567890'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'sandbox_apr567890'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes0',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes0'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes0'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes1'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes11',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes11'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes11'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes12',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes12'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes12'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes13',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes13'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes13'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes14',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes14'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes14'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes15',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes15'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes15'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes16',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes16'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes16'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes17',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes17'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes17'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes18',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes18'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes18'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes19',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes19'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes19'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes2',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes2'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes2'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes20',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes20'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes20'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes3',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes3'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes3'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes4',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes4'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes4'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes5',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes5'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes5'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes6',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes6'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes6'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes7',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes7'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes7'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes8',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes8'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes8'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes9',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes9'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes9'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567234',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743487633',
                    cloneVolumeUuid: '933ce6d6-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:07:22+00:00',
                    cloneDatabaseName: 'sandbox_apr567234'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743487633',
                    cloneVolumeUuid: '954842b3-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:07:25+00:00',
                    cloneDatabaseName: 'sandbox_apr567234'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567tyu',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743487675',
                    cloneVolumeUuid: 'abdada62-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:08:03+00:00',
                    cloneDatabaseName: 'sandbox_apr567tyu'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743487675',
                    cloneVolumeUuid: 'addfcb67-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:08:06+00:00',
                    cloneDatabaseName: 'sandbox_apr567tyu'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567xcvbn',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743487753',
                    cloneVolumeUuid: 'da7d2a9a-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:09:21+00:00',
                    cloneDatabaseName: 'sandbox_apr567xcvbn'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743487753',
                    cloneVolumeUuid: 'dc855cd7-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:09:25+00:00',
                    cloneDatabaseName: 'sandbox_apr567xcvbn'
                }
            ]
        }
    ],
    status: 'not-optimized',
    oldClones: 34,
    oldCloneDetails: [
        {
            cloneDatabaseName: 'sandbox_1743487277979',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'apr1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743487515',
                    cloneVolumeUuid: '4bc548cb-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:05:22+00:00',
                    cloneDatabaseName: 'sandbox_1743487277979',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743487515',
                    cloneVolumeUuid: '4d307ed8-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:05:24+00:00',
                    cloneDatabaseName: 'sandbox_1743487277979',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'sandbox_ap90',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'test1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743494323',
                    cloneVolumeUuid: '2686b0fe-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:51+00:00',
                    cloneDatabaseName: 'sandbox_ap90',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743494323',
                    cloneVolumeUuid: '27cbcb75-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:53+00:00',
                    cloneDatabaseName: 'sandbox_ap90',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'sandbox_test234',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseHostName: 'stvyar9',
            sourceDatabaseInstanceName: 'MSSQLSERVER',
            sourceDatabaseName: 'test1',
            tag: 'Development',
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743487598',
                    cloneVolumeUuid: '7dc7d028-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:06:46+00:00',
                    cloneDatabaseName: 'sandbox_test234',
                    cloneVolumeType: 'data',
                    isFlexClone: true
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743487598',
                    cloneVolumeUuid: '7f32d8e6-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:06:48+00:00',
                    cloneDatabaseName: 'sandbox_test234',
                    cloneVolumeType: 'log',
                    isFlexClone: true
                }
            ],
            cloneAge: 60,
            clonedBy: 'netapp_wf'
        },
        {
            cloneDatabaseName: 'apr11',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743494323',
                    cloneVolumeUuid: '2686b0fe-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:51+00:00',
                    cloneDatabaseName: 'apr11'
                }
            ]
        },
        {
            cloneDatabaseName: 'test1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743494323',
                    cloneVolumeUuid: '27cbcb75-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:53+00:00',
                    cloneDatabaseName: 'test1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743494327',
                    cloneVolumeUuid: '29ef6b80-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:57+00:00',
                    cloneDatabaseName: 'test1'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_ap90002',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486245',
                    cloneVolumeName: 'wlmdb_sqldata_1743486245_clone_1743494327',
                    cloneVolumeUuid: '29ef6b80-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:58:57+00:00',
                    cloneDatabaseName: 'sandbox_ap90002'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743494327',
                    cloneVolumeUuid: '2bfe23e8-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:59:00+00:00',
                    cloneDatabaseName: 'sandbox_ap90002'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_test1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743494327',
                    cloneVolumeUuid: '2bfe23e8-0ecf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:59:00+00:00',
                    cloneDatabaseName: 'sandbox_test1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486245',
                    cloneVolumeName: 'wlmdb_sqllog_1743486245_clone_1743486831',
                    cloneVolumeUuid: 'b519f67b-0ebd-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T05:53:59+00:00',
                    cloneDatabaseName: 'sandbox_test1'
                }
            ]
        },
        {
            cloneDatabaseName: 'master',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'master'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'master'
                }
            ]
        },
        {
            cloneDatabaseName: 'model',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'model'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'model'
                }
            ]
        },
        {
            cloneDatabaseName: 'msdb',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'msdb'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'msdb'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567890',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'sandbox_apr567890'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'sandbox_apr567890'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes0',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes0'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes0'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes1',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes1'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes1'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes11',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes11'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes11'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes12',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes12'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes12'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes13',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes13'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes13'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes14',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes14'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes14'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes15',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes15'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes15'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes16',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes16'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes16'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes17',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes17'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes17'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes18',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes18'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes18'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes19',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes19'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes19'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes2',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes2'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes2'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes20',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes20'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes20'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes3',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes3'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes3'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes4',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes4'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes4'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes5',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes5'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes5'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes6',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes6'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes6'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes7',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes7'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes7'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes8',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes8'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes8'
                }
            ]
        },
        {
            cloneDatabaseName: 'tes9',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4de8fe3d-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:48+00:00',
                    cloneDatabaseName: 'tes9'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743493961',
                    cloneVolumeUuid: '4ff5f452-0ece-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T07:52:51+00:00',
                    cloneDatabaseName: 'tes9'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567234',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743485894',
                    cloneVolumeName: 'wlmdb_sqldata_1743485894_clone_1743487633',
                    cloneVolumeUuid: '933ce6d6-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:07:22+00:00',
                    cloneDatabaseName: 'sandbox_apr567234'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743485894',
                    cloneVolumeName: 'wlmdb_sqllog_1743485894_clone_1743487633',
                    cloneVolumeUuid: '954842b3-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:07:25+00:00',
                    cloneDatabaseName: 'sandbox_apr567234'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567tyu',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743487675',
                    cloneVolumeUuid: 'abdada62-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:08:03+00:00',
                    cloneDatabaseName: 'sandbox_apr567tyu'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743487675',
                    cloneVolumeUuid: 'addfcb67-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:08:06+00:00',
                    cloneDatabaseName: 'sandbox_apr567tyu'
                }
            ]
        },
        {
            cloneDatabaseName: 'sandbox_apr567xcvbn',
            databaseHostName: 'test-resource',
            databaseHostId: '6cbdabbfe3fb147e',
            databaseInstanceName: 'MSSQLSERVER',
            clonedBy: 'other',
            cloneAge: 60,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'wlmdb_sqldata_1743486097',
                    cloneVolumeName: 'wlmdb_sqldata_1743486097_clone_1743487753',
                    cloneVolumeUuid: 'da7d2a9a-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:09:21+00:00',
                    cloneDatabaseName: 'sandbox_apr567xcvbn'
                },
                {
                    sourceVolumeName: 'wlmdb_sqllog_1743486097',
                    cloneVolumeName: 'wlmdb_sqllog_1743486097_clone_1743487753',
                    cloneVolumeUuid: 'dc855cd7-0ebf-11f0-b44e-dff3c689d4ce',
                    cloneVolumeCreateTime: '2025-02-28T06:09:25+00:00',
                    cloneDatabaseName: 'sandbox_apr567xcvbn'
                }
            ]
        }
    ],
    oldCloneDatabaseNames: [
        'sandbox_1743487277979',
        'sandbox_ap90',
        'sandbox_test234',
        'apr11',
        'test1',
        'sandbox_ap90002',
        'sandbox_test1',
        'master',
        'model',
        'msdb',
        'sandbox_apr567890',
        'tes0',
        'tes1',
        'tes11',
        'tes12',
        'tes13',
        'tes14',
        'tes15',
        'tes16',
        'tes17',
        'tes18',
        'tes19',
        'tes2',
        'tes20',
        'tes3',
        'tes4',
        'tes5',
        'tes6',
        'tes7',
        'tes8',
        'tes9',
        'sandbox_apr567234',
        'sandbox_apr567tyu',
        'sandbox_apr567xcvbn'
    ]
};

const MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA = { status: 'optimized', current: '4', recommendedMaxDOP: '4' };

const MSSQL_ASSESSMENT_CLONE_CONFIG_DATA = {
    status: 'optimized',
    oldClones: 0,
    cloneDetails: [],
    oldCloneDetails: [],
    oldCloneDatabaseNames: []
};

const MSSQL_ASSESMENT_CONFIG_DATA = {
    os: {
        'mpio-enabled': true,
        'mpio-timeout': '60',
        'mpio-iscsi-count': '5',
        'ntfs-allocation-details': [
            {
                BlockSize: 65536,
                DriveLetter: 'S:'
            },
            {
                BlockSize: 65536,
                DriveLetter: 'T:'
            }
        ],
        'mpio-load-balance-policy': 'RR',
        'ntfs-allocation-unit-size': 65536,
        'mpio-load-balance-policy-details': [
            {
                disk: 'Disk 3',
                policy: 'RRWS',
                accessPath: 'T:\\'
            },
            {
                disk: 'Disk 1',
                policy: 'RRWS',
                accessPath: 'S:\\'
            }
        ]
    },
    luns: [
        {
            name: '/vol/wlmdb_sqldata_1750140716368/sqldata',
            'os-type': 'windows_2008',
            'space-reservation-enabled': true,
            'space-allocation-allocated': true
        },
        {
            name: '/vol/wlmdb_sqltemp_1750140716368/tempdb',
            'os-type': 'windows_2008',
            'space-reservation-enabled': true,
            'space-allocation-allocated': true
        }
    ],
    errors: {},
    layout: {
        'user-database-layout': {
            log: [
                {
                    name: 'RetailBanking',
                    lunPath: '/vol/wlmdb_sqllog_1750140716369/sqllog',
                    lunUuid: '00fd15a5-ff14-4ad2-a9a5-b5c66d0a3381',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 23.8125,
                    diskNumber: 1,
                    accessPaths: ['S:\\', '\\\\?\\Volume{68d026b4-dc23-4799-aecb-2bb59d251e33}\\'],
                    databaseDetails: [
                        {
                            name: 'RetailBanking',
                            sizeInMb: 23.8125
                        }
                    ],
                    lunSerialNumber: 'lWB5g?XW76m/',
                    ontapVolumeName: 'wlmdb_sqllog_1750140716368',
                    ontapVolumeUuid: 'af03a358-4b44-11f0-a105-fda4bda8e621'
                }
            ],
            data: [
                {
                    name: 'RetailBanking',
                    lunPath: '/vol/wlmdb_sqldata_1750140716368/sqldata',
                    lunUuid: '00fd15a5-ff14-4ad2-a9a5-b5c66d0a3381',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 16.875,
                    diskNumber: 1,
                    accessPaths: ['S:\\', '\\\\?\\Volume{68d026b4-dc23-4799-aecb-2bb59d251e32}\\'],
                    databaseDetails: [
                        {
                            name: 'RetailBanking',
                            sizeInMb: 16.875
                        }
                    ],
                    lunSerialNumber: 'lWB5g?XW76m/',
                    ontapVolumeName: 'wlmdb_sqldata_1750140716368',
                    ontapVolumeUuid: 'af03a358-4b44-11f0-a105-fda4bda8e620'
                }
            ],
            tempDb: [
                {
                    name: 'tempdev',
                    lunPath: '/vol/wlmdb_sqltemp_1750140716368/tempdb',
                    lunUuid: 'c8bcdf6e-060c-4cb9-b07e-d8036108379f',
                    svmName: 'wlmdb_sqlsvm_1750140716368',
                    sizeInMb: 8,
                    diskNumber: 3,
                    accessPaths: ['T:\\', '\\\\?\\Volume{f3a06d64-ba64-40e9-af09-123ca22ac071}\\'],
                    lunSerialNumber: 'lWB5g?XW76mb',
                    ontapVolumeName: 'wlmdb_sqltemp_1750140716368',
                    ontapVolumeUuid: 'b50523e3-4b44-11f0-a105-fda4bda8e620'
                }
            ]
        },
        'tempdb-files-location': 'separate-drive',
        'default-log-files-location': 'shared-drive',
        'default-data-files-location': 'shared-drive'
    },
    sizing: {
        'performance-tier': [
            {
                volumeName: 'wlmdb_sqldata_1750140716368',
                performanceTierPercent: 100
            },
            {
                volumeName: 'wlmdb_sqltemp_1750140716368',
                performanceTierPercent: 100
            }
        ],
        'data-log-drive-details': [
            {
                lunUuid: '00fd15a5-ff14-4ad2-a9a5-b5c66d0a3381',
                svmName: 'wlmdb_sqlsvm_1750140716368',
                diskNumber: 1,
                databaseName: 'msdb',
                logAccessPath: 'S:\\',
                dataAccessPath: 'S:\\',
                logDriveLetter: 'S:',
                dataDriveLetter: 'S:',
                ontapVolumeName: 'wlmdb_sqldata_1750140716368',
                ontapVolumeUuid: 'af03a358-4b44-11f0-a105-fda4bda8e620',
                diskSerialNumber: 'lWB5g?XW76m/',
                logDriveTotalSizeMB: 204782,
                dataDriveTotalSizeMB: 204782
            }
        ],
        'data-tempdb-drive-details': {
            lunUuid: 'c8bcdf6e-060c-4cb9-b07e-d8036108379f',
            svmName: 'wlmdb_sqlsvm_1750140716368',
            diskNumber: 3,
            dataDriveLetter: 'S:',
            ontapVolumeName: 'wlmdb_sqltemp_1750140716368',
            ontapVolumeUuid: 'b50523e3-4b44-11f0-a105-fda4bda8e620',
            tempdbDrivePath: 'T:\\mssql\\data\\tempdb.mdf',
            diskSerialNumber: 'lWB5g?XW76mb',
            tempdbDriveLetter: 'T:',
            dataDriveTotalSizeMB: 204782,
            tempdbDriveTotalSizeMB: 20462
        }
    },
    volumes: [
        {
            name: 'wlmdb_sqldata_1750140716368',
            uuid: 'af03a358-4b44-11f0-a105-fda4bda8e620',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': true,
            'tiering-policy': 'snapshot_only',
            'snapshot-policy': 'daily_weekretention',
            'space-guarantee': 'none',
            'fractional-reserve': 0,
            'snapshot-autodelete': true,
            'snapshot-copy-reserve': 0,
            'tiering-min-cooling-days': 7
        },
        {
            name: 'wlmdb_sqltemp_1750140716368',
            uuid: 'b50523e3-4b44-11f0-a105-fda4bda8e620',
            autosize: 'on',
            'autosize-mode': 'grow',
            'thin-provision': true,
            'tiering-policy': 'snapshot_only',
            'snapshot-policy': 'daily_weekretention',
            'space-guarantee': 'none',
            'fractional-reserve': 0,
            'snapshot-autodelete': true,
            'snapshot-copy-reserve': 0,
            'tiering-min-cooling-days': 7
        }
    ],
    filesystemId: 'fs-07a22f282fd4f5a20'
};

const ORACLE_ASSESSMENT_CRR_CONFIG_DATA = {
    errors: '',
    crrDetails: [
        {
            volumeName: 'oracledata2',
            peerSVMName: ['wlmdb_sqlsvm_1737955690776'],
            isCRREnabled: true,
            sourceSvmName: 'wlmdb_sqlsvm_1733286308083',
            isSnapMirrored: true,
            peerClusterName: ['FsxId01d9727eb6a7d3e9a'],
            peerClusterFsxId: ['fs-01d9727eb6a7d3e9a']
        },
        {
            volumeName: 'oraclearch2',
            peerSVMName: ['wlmdb_sqlsvm_1737955690776'],
            isCRREnabled: true,
            sourceSvmName: 'wlmdb_sqlsvm_1733286308083',
            isSnapMirrored: true,
            peerClusterName: ['FsxId01d9727eb6a7d3e9a'],
            peerClusterFsxId: ['fs-01d9727eb6a7d3e9a']
        }
    ]
};

const ORACLE_STORAGE_ASSESSMENT_DATA = {
    layout: [
        {
            name: 'archive-placement',
            status: 'optimized',
            recommended: 'separate-volume',
            severity: 'warning',
            recommendation:
                'Placing archive logs on a dedicated volume enhances performance and recovery processes. This isolation prevents high I/O demands from interfering with other operations, ensuring efficient logging, sorting, and reliable backup and recovery.',
            tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
            objectsInViolation: [],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 0
        },
        {
            name: 'datafiles-placement',
            status: 'optimized',
            recommended: 'separate-volume-or-shared-with-control-files',
            severity: 'warning',
            recommendation:
                'Placing data files on a dedicated volume or shared with control files boosts performance by isolating their random I/O from redo or archive log writes, reducing contention. This separation allows you to benefit from customized snapshot configurations, tiering policies, and efficiency mechanisms to optimize performance and cost.',
            tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
            objectsInViolation: [],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 0
        },
        {
            name: 'controlfiles-placement',
            status: 'not-optimized',
            recommended: 'two-multiplexed-volumes',
            severity: 'warning',
            recommendation:
                'Oracle strongly recommends multiplexing control files to avoid a single point of failure in production environments. Maintain at least two, preferably three, control file copies across separate volumes or disks to enhance redundancy and reduce the risk of losing all copies. Control files can be placed on a dedicated volume or shared with redo logs or data files, but avoid placing them on volumes tiered to object storage, such as archive volumes, as its slower access pattern is incompatible with control file performance needs.',
            tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
            objectsInViolation: [],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 0
        },
        {
            name: 'redologs-placement',
            status: 'optimized',
            recommended: 'separate-volume-or-shared-with-temp-control-files',
            severity: 'warning',
            recommendation:
                'Placing redo logs, whether multiplexed or not, on a dedicated volume or shared with temp/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed redo log copy should reside on a separate volume for redundancy. Frequent changes make redo logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Redo logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storages slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.',
            tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
            objectsInViolation: [],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 0
        },
        {
            name: 'templogs-placement',
            status: 'optimized',
            recommended: 'separate-volume-or-shared-with-redo-control-files',
            severity: 'warning',
            recommendation:
                'Placing temp logs on a dedicated volume or shared with redo/control files isolates their high-write I/O from data file transactions, improving performance. Each multiplexed temp log copy should reside on a separate volume for redundancy. Frequent changes make temp logs unsuitable for snapshotted volumes, like data volumes, as they inflate snapshot sizes. Temp logs must not be placed on volumes tiered to object storage, such as archive volumes, as their frequent updates are incompatible with object storages slower access patterns. This separation enables customized efficiency mechanisms and tiering configurations for optimal database performance and cost efficiency.',
            tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
            objectsInViolation: [],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 0
        },
        {
            name: 'oracle-binary-placement',
            status: 'optimized',
            recommended: 'separate-volume',
            severity: 'warning',
            recommendation:
                'Placing Oracle binaries on a dedicated volume ensures optimal performance and stability by reducing I/O contention with other files. This separation simplifies software updates and minimizes the risk of accidental modifications or corruption, ensuring the database runs smoothly.',
            tags: ['Cost optimization', 'Operational excellence', 'Performance efficiency'],
            objectsInViolation: [],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 0
        },
        {
            name: 'data-dg-lun-layout',
            status: 'not-optimized',
            recommended: 'associated-lun-count',
            severity: 'warning',
            recommendation:
                'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that ASM Disk Group that contains data files will consist of at least 4-8 LUNs.',
            tags: ['Operational excellence', 'Performance efficiency'],
            objectsInViolation: ['DISK1'],
            violationDetails: [
                {
                    objectName: 'DISK1',
                    value: '1',
                    objectType: 'Disk Group',
                    recommended: '4',
                    dataCategory: 'Data'
                }
            ],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 1
        },
        {
            name: 'redolog-dg-lun-layout',
            status: 'not-optimized',
            recommended: 'associated-lun-count',
            severity: 'warning',
            recommendation:
                'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance.It is recommended that ASM Disk Group that contains redo logs will consist of at least 2-8 LUNs.',
            tags: ['Operational excellence', 'Performance efficiency'],
            objectsInViolation: ['DISK1'],
            violationDetails: [
                {
                    objectName: 'DISK1',
                    value: '1',
                    objectType: 'Disk Group',
                    recommended: '2',
                    dataCategory: 'Redo Log'
                }
            ],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 1
        },
        {
            name: 'archivelog-dg-lun-layout',
            status: 'not-optimized',
            recommended: 'associated-lun-count',
            severity: 'warning',
            recommendation:
                'Multiple LUNs laid out within an Amazon FSx ONTAP volume provides better performance. It is recommended that  ASM Disk Group for archive logs will consist of at least 2-8 LUNs.',
            tags: ['Operational excellence', 'Performance efficiency'],
            objectsInViolation: ['DISK1'],
            violationDetails: [
                {
                    objectName: 'DISK1',
                    value: '1',
                    objectType: 'Disk Group',
                    recommended: '2',
                    dataCategory: 'Archive Log'
                }
            ],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: 1
        }
    ],
    volumes: {
        data: [
            {
                name: 'oracleredo2',
                uuid: 'db3ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                junctionPath: '/oracleredo2',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                autosize: 'off',
                compaction: 'inline',
                compression: 'inline',
                autosizeMode: 'off',
                deduplication: 'both',
                thinProvision: true,
                tieringPolicy: 'none',
                efficiencyType: 'efficient',
                snapshotPolicy: 'default',
                spaceGuarantee: 'none',
                compressionType: 'adaptive',
                fractionalReserve: 100,
                snapshotAutodelete: true,
                snapshotDeleteOrder: 'newest_first',
                snapshotCopyReserve: 5,
                tieringMinCoolingDays: 4,
                spaceMgmtTryFirst: 'volume_grow'
            },
            {
                name: 'oraclearch2',
                uuid: 'cc802ccc-eee7-11ef-8fbb-837e18df6f7a',
                junctionPath: '/oraclearch2',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                autosize: 'off',
                compaction: 'inline',
                compression: 'inline',
                autosizeMode: 'off',
                deduplication: 'both',
                thinProvision: true,
                tieringPolicy: 'none',
                efficiencyType: 'efficient',
                snapshotPolicy: 'default',
                spaceGuarantee: 'none',
                compressionType: 'adaptive',
                fractionalReserve: 100,
                snapshotAutodelete: true,
                snapshotDeleteOrder: 'newest_first',
                snapshotCopyReserve: 5,
                tieringMinCoolingDays: 4,
                spaceMgmtTryFirst: 'volume_grow'
            },
            {
                name: 'oracledata2',
                uuid: 'db3ed9f2-eee7-11ef-8fbb-837e18df6f7a',
                junctionPath: '/oracledata2',
                svmName: 'wlmdb_sqlsvm_1735809893269',
                autosize: 'off',
                compaction: 'inline',
                compression: 'inline',
                autosizeMode: 'off',
                deduplication: 'both',
                thinProvision: true,
                tieringPolicy: 'all',
                efficiencyType: 'efficient',
                snapshotPolicy: 'default',
                spaceGuarantee: 'none',
                compressionType: 'adaptive',
                fractionalReserve: 100,
                snapshotAutodelete: true,
                snapshotDeleteOrder: 'newest_first',
                snapshotCopyReserve: 5,
                tieringMinCoolingDays: 4,
                spaceMgmtTryFirst: 'volume_grow'
            }
        ],
        error: '',
        filesystemId: 'fs-0d5efc3057c4f12cb'
    },
    binaryVolumes: {
        data: [
            {
                nfsInfo: {
                    rules: [
                        {
                            clients: ['10.0.140.145'],
                            superuser: ['any'],
                            allow_suid: false
                        },
                        {
                            clients: ['13.127.25.212'],
                            superuser: ['none'],
                            allow_suid: false
                        }
                    ],
                    svmName: 'wlmdb_sqlsvm_1737955690776',
                    svmUuid: '2b2ae63e-dc72-11ef-b430-bb0ad6a3b8df',
                    volumeId: 'a678830e-a9e0-11f0-bb42-83fc639f5501',
                    instanceInfo: {
                        domain: 'ap-south-1.compute.internal',
                        hostname: 'ip-10-0-140-145.ap-south-1.compute.internal',
                        publicIp: '13.127.25.212',
                        privateIp: '10.0.140.145'
                    },
                    exportPolicyName: 'wf2_policy'
                },
                volumeId: 'a678830e-a9e0-11f0-bb42-83fc639f5501',
                mountPath: '/mnt/orahome',
                oracleSid: 'ordbsdl',
                isNfsMount: true,
                oracleHome: '/mnt/orahome/app/oracle/product/19c/db_1',
                volumeName: 'orahome',
                hasBinaries: true
            }
        ],
        error: ''
    },
    os: {
        selinux: {
            error: null,
            'selinux-value': 'enforcing',
            'selinux-disabled': false
        },
        'multipath-io': {
            error: null,
            'multipath-io-is-active': true,
            'multipath-io-status': 'active',
            'multipath-io-is-enabled': true,
            'multipath-io-enabled-status': 'enabled'
        },
        'host-utilities': {
            error: 'sanlun command not found',
            'sanlun-version': null,
            'sanlun-installed': false,
            'os-version': 'sles15'
        },
        'oracle-parameters': {
            error: null,
            'filesystemio-options': {
                found: true,
                value: 'none'
            },
            'db-file-multiblock-read-count': {
                found: true,
                value: '128'
            }
        },
        'tcp-advanced-options': {
            error: null,
            'tcp-features': {
                'tcp-sack-value': '0',
                'tcp-sack-enabled': false,
                'tcp-timestamps-value': '0',
                'tcp-timestamps-enabled': false,
                'tcp-window-scaling-value': '0',
                'tcp-window-scaling-enabled': false
            }
        },
        'transparent-hugepages': {
            error: null,
            'thp-status': 'enabled',
            'thp-disabled': false
        },
        'iscsi-targets-sessions': {
            error: null,
            'iscsi-targets': [
                {
                    portal: '172.31.48.72:3260,1031 iqn.1992-08.com.netapp:sn.b2853ecdb1f911efa8811fbfd81226d0:vs.345',
                    target_name: '172.31.48.72',
                    active_sessions: 1
                },
                {
                    portal: '172.31.6.100:3260,1032 iqn.1992-08.com.netapp:sn.b2853ecdb1f911efa8811fbfd81226d0:vs.345',
                    target_name: '172.31.6.100',
                    active_sessions: 0
                }
            ],
            'iscsi-targets-found': 2,
            'total-active-sessions': 1,
            'iscsi-sessions-per-target': {
                '172.31.48.72': 1,
                '172.31.6.100': 0
            }
        },
        'multipath-configuration': {
            error: null,
            defaults: {
                find_multipaths: 'yes',
                polling_interval: 5,
                user_friendly_names: 'yes'
            },
            'netapp-device': {
                prio: 'ontap',
                vendor: 'NETAPP',
                product: 'LUN',
                failback: 'immediate',
                features: '2 pg_init_retries 50',
                dev_loss_tmo: 'infinity',
                no_path_retry: 'queue',
                flush_on_last_del: 'yes',
                user_friendly_names: 'no',
                path_grouping_policy: 'group_by_prio'
            },
            'multipath-config-found': true
        },
        'iscsi-replacement-timeout': {
            error: null,
            'replacement-timeout': 120
        },
        'oracle-parameters-from-init': {
            error: null,
            'db-file-multiblock-read-count-in-init': [
                {
                    path: '/u01/app/oracle/product/19c/db_1/dbs/spfilepdbnas1.ora',
                    error: null,
                    'parameter-found': true,
                    'parameter-value': '128'
                }
            ]
        },
        'adr-info': {
            error: null,
            'adr-home': '/mnt/orahome/app/oracle/diag/rdbms/ordbsdl/ordbsdl',
            'adr-home-mount': '198.19.255.89:/orahome',
            'adr-home-mount-info': {
                error: null,
                'mount-point': '198.19.255.89:/orahome',
                'mount-options': {
                    bg: true,
                    rw: true,
                    hard: true,
                    vers: '3',
                    proto: 'tcp',
                    rsize: '32768',
                    timeo: '600',
                    wsize: '32768',
                    acdirmax: '0',
                    acdirmin: '0',
                    acregmax: '0',
                    acregmin: '0'
                },
                'filesystem-type': 'nfs'
            }
        },
        'kernel-parameters': {
            error: null,
            'sunrpc-tcp-slot-entries': {
                'tcp-slot-table': '2',
                'tcp-max-slot-table': '65536'
            }
        },
        'nfs-mount-options': {
            error: null,
            'nfs-mount-options': [
                {
                    server: '172.31.255.231',
                    options: {
                        rw: true,
                        sec: 'sys',
                        addr: '172.31.255.231',
                        hard: true,
                        vers: '4.2',
                        proto: 'tcp',
                        rsize: '65536',
                        timeo: '600',
                        wsize: '65536',
                        namlen: '255',
                        retrans: '2',
                        relatime: true,
                        clientaddr: '172.31.48.99',
                        local_lock: 'none',
                        noac: true
                    },
                    'mount-point': '/mnt/oradata',
                    'remote-path': '/oracledata2',
                    'filesystem-type': 'nfs4'
                },
                {
                    server: '172.31.255.231',
                    options: {
                        rw: true,
                        sec: 'sys',
                        addr: '172.31.255.231',
                        hard: true,
                        vers: '4.2',
                        proto: 'tcp',
                        rsize: '65536',
                        timeo: '600',
                        wsize: '65536',
                        namlen: '255',
                        retrans: '2',
                        relatime: true,
                        clientaddr: '172.31.48.99',
                        local_lock: 'none',
                        noac: true
                    },
                    'mount-point': '/mnt/oraarch',
                    'remote-path': '/oraclearch2',
                    'filesystem-type': 'nfs4'
                },
                {
                    server: '172.31.255.231',
                    options: {
                        rw: true,
                        sec: 'sys',
                        addr: '172.31.255.231',
                        hard: true,
                        vers: '4.2',
                        proto: 'tcp',
                        rsize: '65536',
                        timeo: '600',
                        wsize: '65536',
                        namlen: '255',
                        retrans: '2',
                        relatime: true,
                        clientaddr: '172.31.48.99',
                        local_lock: 'none',
                        noac: true
                    },
                    'mount-point': '/mnt/oraredoctl',
                    'remote-path': '/oracleredo2',
                    'filesystem-type': 'nfs4'
                }
            ]
        },
        'asm-os-config': {
            isIscsi: 'true',
            'asm-setup': 'true',
            'asm-external-redundancy': {
                error: '',
                assessment: {
                    violations: [],
                    result: 'true',
                    totalObjects: 2
                }
            },
            'afd-logical-block-size': {},
            'asmlib-logical-block-size': {
                assessment: {
                    result: 'N'
                },
                error: ''
            }
        },
        'idmapd-domain-config': {
            error: null,
            domain: 'dbsqa.mssql.com',
            'config-file': '/etc/idmapd.conf',
            'config-exists': true
        },
        'dnfs-oranfstab': {
            oranfstab_servers: [
                {
                    server: 'fsxnfsv3',
                    paths: ['172.31.255.252'],
                    exports: [
                        { export: '/oracledata2', mount: '/mnt/oradata' },
                        { export: '/oraclearch2', mount: '/mnt/oraarch' }
                    ],
                    nfs_version: 'NFSv3',
                    options: ['rsize:262144', 'wsize:262144', 'tcp_nodelay', 'noactimeo', 'nolock']
                },
                {
                    server: 'fsxnfsv4',
                    paths: ['172.31.255.231'],
                    exports: [{ export: '/oracleredo2', mount: '/mnt/oraredoctl' }],
                    nfs_version: 'NFSv4',
                    options: ['rsize:65536', 'wsize:65536', 'tcp_nodelay']
                }
            ],
            error: null
        },
        'dnfs-ip-resolution': {
            dns_resolution: {
                fsxnfsv3: ['172.31.255.252'],
                fsxnfsv4: ['172.31.255.231'],
                '172.31.255.231': ['172.31.255.231']
            },
            error: null
        }
    },
    nfsv4DomainData: {
        data: {
            v40Enabled: true,
            v41Enabled: true,
            v4IdDomain: 'ap-south-1.compute.internal'
        },
        error: ''
    },
    dnfsServers: {
        data: [
            {
                dirname: '/oracledata2',
                svrname: '172.31.255.231',
                nfsversion: 'NFSv3.0'
            },
            {
                dirname: '/oracleredo2',
                svrname: 'fsxnfsv3',
                nfsversion: 'NFSv4.0'
            }
        ],
        error: ''
    },
    nfsRootonly: [
        {
            svmName: 'wlmdb_sqlsvm_1735809893269',
            nfsRootonly: 'disabled'
        }
    ],
    sizing: {
        swapSpace: {
            error: '',
            ramSizeInKb: '2117632',
            swapSizeInKb: '1048576',
            hugepagesSizeInKb: '20480'
        }
    }
};

const MSSQL_ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA = {
    driveLetter: {
        status: 'optimized',
        details: {
            missingDriveLetters: [],
            primaryNodeDriveLetters: ['S:', 'S:', 'T:']
        }
    },
    sharedStorage: {
        status: 'optimized',
        lunDetails: [
            {
                status: 'optimized',
                lunUuid: '96bd5d5e-877e-4846-b37c-4d2782dc02d8',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: [
                    'iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com',
                    'iqn.1991-05.com.microsoft:sqlnode2-45242.wlmqaauto.com'
                ]
            },
            {
                status: 'optimized',
                lunUuid: '956531bd-9468-407e-a4ac-41b29140831a',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: [
                    'iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com',
                    'iqn.1991-05.com.microsoft:sqlnode2-45242.wlmqaauto.com'
                ]
            }
        ]
    },
    sqlServerServices: {
        status: 'optimized',
        nodesInViolation: [],
        totalNodes: 2,
        details: [
            {
                Name: 'MSSQLSERVER',
                Status: 'Running',
                StartType: 'Manual',
                DisplayName: 'SQL Server (MSSQLSERVER)'
            }
        ]
    }
};

const ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA = {
    sharedStorage: {
        status: 'not-optimized',
        lunDetails: [
            {
                status: 'optimized',
                lunUuid: '96bd5d5e-877e-4846-b37c-4d2782dc02d8',
                lunName: '/vol/wlmdb_sqldata_1753227905582/sqldata',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: [
                    'iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com',
                    'iqn.1991-05.com.microsoft:sqlnode2-45242.wlmqaauto.com'
                ]
            },
            {
                status: 'not-optimized',
                lunUuid: '956531bd-9468-407e-a4ac-41b29140831a',
                lunName: '/vol/wlmdb_sqldata_1753227905523/sqldata',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: ['iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com']
            },
            {
                status: 'not-optimized',
                lunUuid: '956531bd-9468-407e-a4ac-41b29140831b',
                lunName: '/vol/wlmdb_sqldata_1753227905523/sqllog',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: ['iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com']
            },
            {
                status: 'not-optimized',
                lunUuid: '956531bd-9468-407e-a4ac-41b29140831c',
                lunName: '/vol/wlmdb_sqldata_1753227905567/sqldata',
                igroupName: 'wlmdb_sqligroup_1753227808629',
                igroupUuid: 'c9272d32-6761-11f0-980e-53fb760838dd',
                initiatorNames: ['iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com']
            }
        ],
        allHostIqns: [
            'iqn.1991-05.com.microsoft:sqlnode1-45242.wlmqaauto.com',
            'iqn.1991-05.com.microsoft:sqlnode2-45242.wlmqaauto.com'
        ]
    },
    driveLetter: {
        status: 'optimized',
        details: { missingDriveLetters: [], primaryNodeDriveLetters: ['S:', 'S:', 'T:'] }
    },
    sqlServerServices: {
        status: 'not-optimized',
        nodesInViolation: ['demo-sql-prod-fci-001'],
        totalNodes: 2,
        details: [
            { Name: 'MSSQLSERVER', Status: 'Running', StartType: 'Automatic', DisplayName: 'SQL Server (MSSQLSERVER)' }
        ]
    }
};

const AOAG_STANDALONE_HIGH_AVAILABILITY_CONFIG_DATA = {
    clusterQuorum: {
        status: 'not-optimized',
        details: {
            isMajority: true,
            quorumType: 1,
            isPhysicalDisk: false,
            quorumResourceName: 'Quorum',
            isPhysicalDiskAndMajority: true
        }
    },
    heartbeat: {
        status: 'not-optimized',
        details: {
            CrossSiteDelay: {
                status: 'optimized',
                current: 1000,
                recommended: 1000
            },
            SameSubnetDelay: {
                status: 'not-optimized',
                current: 100,
                recommended: 1000
            },
            CrossSubnetDelay: {
                status: 'optimized',
                current: 1000,
                recommended: 1000
            },
            CrossSiteThreshold: {
                status: 'optimized',
                current: 20,
                recommended: 20
            },
            SameSubnetThreshold: {
                status: 'not-optimized',
                current: 20,
                recommended: 10
            },
            CrossSubnetThreshold: {
                status: 'optimized',
                current: 20,
                recommended: 20
            }
        }
    },
    sqlServerServices: {
        status: 'optimized',
        nodesInViolation: [],
        totalNodes: 2,
        details: [
            { Name: 'MSSQLSERVER', Status: 'Running', StartType: 'Automatic', DisplayName: 'SQL Server (MSSQLSERVER)' }
        ]
    }
};

async function createAssessmentData(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    databaseInstanceId: string,
    databaseInstanceName: string = DEFAULT_INSTANCE_NAME,
    sqlDeploymentType: string = SqlServerDeploymentModel.SQL_STANDALONE_SHORT
) {
    accountId = checkAccount(accountId);
    const baseConfig = {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: resourceId,
        database_instance_id: databaseInstanceId,
        creation_time: new Date(Date.now())
    };
    const instanceConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.STORAGE,
        config_data:
            databaseInstanceName === DEFAULT_INSTANCE_NAME ? MSSQL_ASSESMENT_CONFIG_DATA : ASSESMENT_CONFIG_DATA
    };
    const instanceConfigMappedOntapDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.MAPPED_ONTAP_VOLUMES,
        config_data: MAPPED_ONTAP_VOLUMES_DATA
    };

    const instanceCRRConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.CRR,
        config_data: ASSESSMENT_CRR_CONFIG_DATA
    };
    const instanceAWSBackupConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.AWS_BACKUP,
        config_data: ASSESSMENT_AWS_BACKUP_DATA
    };
    const instanceMaxdopConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.MAXDOP,
        config_data:
            databaseInstanceName === DEFAULT_INSTANCE_NAME
                ? MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA
                : ASSESSMENT_MAXDOP_CONFIG_DATA
    };
    const instanceCloneConfigDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.CLONE,
        config_data:
            databaseInstanceName === DEFAULT_INSTANCE_NAME
                ? MSSQL_ASSESSMENT_CLONE_CONFIG_DATA
                : ASSESSMENT_CLONE_CONFIG_DATA
    };
    const haConfigData =
        sqlDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT
            ? AOAG_STANDALONE_HIGH_AVAILABILITY_CONFIG_DATA
            : databaseInstanceName === DEFAULT_INSTANCE_NAME
            ? MSSQL_ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA
            : ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA;

    const instanceHighAvailabilityDataRecord = {
        ...baseConfig,
        config_data_type: AssessmentCategories.HIGH_AVAILABILITY,
        config_data: haConfigData
    };
    const configDataRecords = [
        instanceConfigDataRecord,
        instanceCRRConfigDataRecord,
        instanceAWSBackupConfigDataRecord,
        instanceMaxdopConfigDataRecord,
        instanceCloneConfigDataRecord,
        instanceConfigMappedOntapDataRecord
    ];

    const newConfigDataRecords =
        sqlDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT
            ? configDataRecords
            : [...configDataRecords, instanceHighAvailabilityDataRecord];

    await createAssessmentDataWithRetry(
        newConfigDataRecords,
        {
            accountId,
            region,
            credentialsId,
            resourceId,
            databaseInstanceId
        },
        DatabaseTypes.MS_SQL_SERVER
    );
}
async function createAssessmentDataWithRetry(
    configDataRecords: DatabaseInstanceConfigData[],
    verificationParams: {
        accountId: string;
        region: string;
        credentialsId: string;
        resourceId: string;
        databaseInstanceId: string;
    },
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
) {
    await createDatabaseInstanceConfigData(configDataRecords);

    logger.info(`Creating demo assessment data for ${databaseType} in ${verificationParams.region}`);

    let retryCount = 0;
    const maxRetries = 2;
    let verificationSuccessful = false;

    while (retryCount <= maxRetries && !verificationSuccessful) {
        try {
            await new Promise(resolve => {
                setTimeout(resolve, 500);
            });

            const verificationResult = await listDatabaseInstanceConfigData({
                accountId: verificationParams.accountId,
                region: verificationParams.region,
                credentialsId: verificationParams.credentialsId,
                resourceId: verificationParams.resourceId,
                databaseInstanceIds: [verificationParams.databaseInstanceId]
            });

            const expectedRecordCount = configDataRecords.length;
            const actualRecordCount = verificationResult?.length || 0;

            if (actualRecordCount >= expectedRecordCount) {
                logger.info(`${databaseType} assessment data verification successful`, {
                    accountId: verificationParams.accountId,
                    databaseInstanceId: verificationParams.databaseInstanceId,
                    expectedRecords: expectedRecordCount,
                    actualRecords: actualRecordCount
                });
                verificationSuccessful = true;
            } else if (retryCount < maxRetries) {
                logger.info(`${databaseType} assessment data verification failed, retrying...`, {
                    accountId: verificationParams.accountId,
                    databaseInstanceId: verificationParams.databaseInstanceId,
                    expectedRecords: expectedRecordCount,
                    actualRecords: actualRecordCount,
                    retryCount: retryCount + 1
                });

                // Retry creating the data
                await createDatabaseInstanceConfigData(configDataRecords);
                retryCount += 1;
            } else {
                logger.error(`${databaseType} assessment data verification failed after all retries`, {
                    accountId: verificationParams.accountId,
                    databaseInstanceId: verificationParams.databaseInstanceId,
                    expectedRecords: expectedRecordCount,
                    actualRecords: actualRecordCount
                });
                throw new Error(`Failed to create ${databaseType} assessment data after ${maxRetries + 1} attempts`);
            }
        } catch (error) {
            if (retryCount < maxRetries) {
                logger.error(`Error during ${databaseType} assessment data verification, retrying...`, {
                    accountId: verificationParams.accountId,
                    databaseInstanceId: verificationParams.databaseInstanceId,
                    error: error instanceof Error ? error.message : error,
                    retryCount: retryCount + 1
                });
                try {
                    await createDatabaseInstanceConfigData(configDataRecords);
                } catch (retryError) {
                    logger.error(`Error during ${databaseType} retry attempt`, {
                        accountId: verificationParams.accountId,
                        databaseInstanceId: verificationParams.databaseInstanceId,
                        retryError: retryError instanceof Error ? retryError.message : retryError
                    });
                }
                retryCount += 1;
            } else {
                logger.error(`${databaseType} assessment data creation and verification failed`, {
                    accountId: verificationParams.accountId,
                    databaseInstanceId: verificationParams.databaseInstanceId,
                    error: error instanceof Error ? error.message : error
                });
                throw error;
            }
        }
    }
}

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
    offlineAssessmentStdUploadObject,
    offlineAssessmentFCIUploadObject,
    offlineAssessmentAOAGUploadObject,
    DEMO_REGISTER_RESPONSE,
    demoFsxId,
    ASSESMENT_CONFIG_DATA,
    ASSESSMENT_CRR_CONFIG_DATA,
    ASSESSMENT_AWS_BACKUP_DATA,
    ASSESSMENT_MAXDOP_CONFIG_DATA,
    ASSESSMENT_CLONE_CONFIG_DATA,
    MSSQL_ASSESSMENT_MAXDOP_CONFIG_DATA,
    MSSQL_ASSESSMENT_CLONE_CONFIG_DATA,
    MSSQL_ASSESMENT_CONFIG_DATA,
    MAPPED_ONTAP_VOLUMES_DATA,
    MSSQL_ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA,
    ASSESSMENT_HIGH_AVAILABILITY_CONFIG_DATA,
    AOAG_STANDALONE_HIGH_AVAILABILITY_CONFIG_DATA,
    ORACLE_STORAGE_ASSESSMENT_DATA,
    ORACLE_ASSESSMENT_CRR_CONFIG_DATA,
    ORACLE_MAPPED_ONTAP_VOLUMES_DATA,
    PDB_DETAILS,
    createAssessmentData,
    createAssessmentDataWithRetry,
    oracleStandaloneUploadObject,
    oracleDataGuardUploadObject,
    oracleMultiDBUploadObject
};
