import randomize from 'randomatic';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { randomUUID } from 'crypto';

function masterStackData(accountId: string, resourceName: string, stackName: string, masterStackId: string) {
    return [
        {
            id: masterStackId,
            account_id: accountId,
            name: `Microsoft SQL server deployment with stack ${stackName}`,
            status: JOBSTATUS.COMPLETED,
            resource_name: resourceName,
            type: JOBTYPE.DEPLOYMENT,
            start_time: new Date(),
            end_time: new Date(),
            initiator: 'SYSTEM'
        }
    ];
}

function sqlFciServerStackData(
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
            name: `Deploying ${stackName}-SQLServerStack-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description: `Creating resource lt-${randomize('a0', 17)}`,
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
    cloudProviderId: string,
    fsxType: string,
    region: string
) {
    return [
        {
            id: existingFSxStackId,
            account_id: accountId,
            name: `Deploying ${stackName}-${fsxType}-${randomize('A0', 17)} `,
            description: `Creating resource arn:aws:cloudformation:${region}:${cloudProviderId}:stack`,
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
    masterStackId: string,
    cloudProviderId: string,
    region: string
) {
    return [
        {
            id: validationStack2Id,
            account_id: accountId,
            name: `Deploying ${stackname}-ValidationStack2-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description: `Creating resource arn:aws:cloudformation:${region}:${cloudProviderId}:stack/${stackname}-${randomize(
                'A0',
                12
            )}/${randomUUID()}`,
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
    cloudProviderId: string,
    region: string
) {
    return [
        {
            id: validationStack1Id,
            account_id: accountId,
            name: `Deploying ${stackName}-ValidationStack1-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description: `Creating resource arn:aws:cloudformation:${region}:${cloudProviderId}:stack/${stackName}-${randomize(
                'A0',
                12
            )}/${randomUUID()}`,
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
            description: `Creating resource sg-${randomize('a0', 17)}`,
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
            description: `Creating resource lt-${randomize('a0', 17)}`,
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
            description: `Creating resource ${stackName}-ValidationStack1-${randomize(
                'A0',
                13
            )}-ValidationInstanceProfile-${randomize('a0', 12)}`,
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
    masterStackId: string,
    cloudProviderId: string,
    region: string
) {
    return [
        {
            id: serverStackId,
            account_id: accountId,
            name: `Deploying ${stackName}-SQLStandaloneStack-${randomize('A0', 17)}`,
            status: JOBSTATUS.COMPLETED,
            description: `Creating resource arn:aws:cloudformation:${region}:${cloudProviderId}:stack/${stackName}-${randomize(
                'A0',
                12
            )}/${randomUUID()}`,
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
