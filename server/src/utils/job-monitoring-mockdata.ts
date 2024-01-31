import randomize from 'randomatic';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { randomUUID } from 'crypto';

function masterStackData(accountId: string, resourceName: string, stackName: string, masterStackId: string) {
    return [
        {
            id: masterStackId,
            account_id: accountId,
            name: `Microsoft SQL server deployment with stack ${stackName};href:mockLink`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        }
    ];
}

function sqlFciServerStackData(accountId: string, resourceName: string, serverStackId: string, masterStackId: string) {
    return [
        {
            id: serverStackId,
            account_id: accountId,
            name: 'Deploying an SQL Server FCI with recommended best practices',
            status: JOBSTATUS.COMPLETED,
            description: 'Deploying an SQL Server FCI with recommended best practices',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying SqlFSxInstanceMAD2(AWS::EC2::Instance)',
            description: 'Configuring Windows Cluster and SQL FCI instance on standby node',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying SqlFSxInstanceMAD1(AWS::EC2::Instance)',
            description: 'Configuring Windows Cluster and SQL FCI instance on primary node',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying NetworkInterface2(AWS::EC2::NetworkInterface)',
            description: 'Creating network interfaces for the EC2 instance in standby subnet',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying NetworkInterface1(AWS::EC2::NetworkInterface)',
            description: 'Creating network interfaces for the EC2 instance in primary subnet',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying WorkloadSecurityGroup(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for SQL Server workloads',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying LaunchWizardSqlFSxProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to EC2 instances for SQL Server nodes',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
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
    fsxType: string
) {
    return [
        {
            id: existingFSxStackId,
            account_id: accountId,
            name: `Deploying ${stackName}-${fsxType}-${randomize('A0', 17)} `,
            description:
                fsxType === 'NewFSxStack'
                    ? 'Deploying new FSx for ONTAP file system for SQL Server workload'
                    : 'Deploying a storage virtual machine for the SQL Server workload on the FSx for ONTAP file system',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying FSxTempDbVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host tempdb',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying FSxClusterQuorumVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host witness disk for Windows Cluster',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying FSxClusterQuorumVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host witness disk for Windows Cluster',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying FSxDataVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host data files',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying FSxLogVolumeConfiguration(AWS::FSx::Volume)',
            description: 'Creating a volume to host log files',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying FSxSvmConfiguration(AWS::FSx::StorageVirtualMachine)',
            description: 'Creating a dedicated storage virtual machine (SVM) for the database workload',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: existingFSxStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        }
    ];
}

function validationStack2Data(
    accountId: string,
    resourceName: string,
    stackname: string,
    validationStack2Id: string,
    masterStackId: string
) {
    return [
        {
            id: validationStack2Id,
            account_id: accountId,
            name: `Deploying ${stackname}-ValidationStack2-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description: 'Standby subnet validation for SQL Server FCI deployment',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying ValidationNode2(AWS::EC2::Instance)',
            description:
                'Validating outbound connection to deployment resources in Amazon S3, Active Directory, and FSx for ONTAP',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying ValidationNode2WaitCondition(AWS::CloudFormation::WaitCondition)',
            description: 'Waiting for validation completion',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying DomainMemberSG(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for the validation instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying ValidationNode2WaitHandler(AWS::CloudFormation::WaitConditionHandle)',
            description: 'Signaling wait condition to resume next steps',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying ValidationInstanceProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to the validation instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack2Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
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
    sqlDeploymentMode: string
) {
    return [
        {
            id: validationStack1Id,
            account_id: accountId,
            name: `Deploying ${stackName}-ValidationStack1-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description:
                sqlDeploymentMode.toLowerCase() === 'fci'
                    ? 'Primary subnet validation for SQL Server FCI deployment'
                    : 'Subnet Validation for deployment',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying ValidationNode1(AWS::EC2::Instance)',
            description:
                'Validating outbound connection to deployment resources in Amazon S3, Active Directory, and FSx for ONTAP',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying DomainMemberSG(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for the validation instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            status: JOBSTATUS.COMPLETED,
            description: 'Disabling instance metadata service v1 to use more secure v2',
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying ValidationInstanceProfile(AWS::IAM::InstanceProfile)',
            description: 'Attaching an instance profile to the validation instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying ValidationNode1WaitHandler(AWS::CloudFormation::WaitConditionHandle)',
            description: 'Signaling wait condition to resume next steps',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying ValidationNode1WaitCondition(AWS::CloudFormation::WaitCondition)',
            description: 'Waiting for validation completion',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: validationStack1Id,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        }
    ];
}

function sqlStandaloneStackData(
    accountId: string,
    resourceName: string,
    stackName: string,
    serverStackId: string,
    masterStackId: string
) {
    return [
        {
            id: serverStackId,
            account_id: accountId,
            name: `Deploying ${stackName}-SQLStandaloneStack-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description: 'Deploying an SQL Server standalone instance with recommended best practices',
            parent_job_id: masterStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying SqlNode(AWS::EC2::Instance)',
            description: 'Configuring SQL Server standalone on an EC2 instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying NetworkInterface(AWS::EC2::NetworkInterface)',
            description: 'Creating network interfaces for the EC2 instance',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying LaunchWizardSqlFSxProfile(AWS::IAM::InstanceProfile)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying DisableIMDSv1(AWS::EC2::LaunchTemplate)',
            description: 'Disabling instance metadata service v1 to use more secure v2',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        },
        {
            id: randomUUID(),
            account_id: accountId,
            name: 'Deploying WorkloadSecurityGroup(AWS::EC2::SecurityGroup)',
            description: 'Creating a security group for SQL Server workloads',
            status: JOBSTATUS.COMPLETED,
            parent_job_id: serverStackId,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        }
    ];
}

export {
    masterStackData,
    validationStack1Data,
    validationStack2Data,
    sqlFciServerStackData,
    sqlStandaloneStackData,
    fsxStackData
};
