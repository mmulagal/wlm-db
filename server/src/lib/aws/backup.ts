import {
    BackupClient,
    BackupPlan,
    BackupPlansListMember,
    BackupSelection,
    BackupSelectionsListMember,
    BackupVaultListMember,
    CreateBackupPlanCommand,
    CreateBackupPlanCommandInput,
    CreateBackupPlanCommandOutput,
    CreateBackupSelectionCommand,
    CreateBackupSelectionCommandOutput,
    CreateBackupVaultCommand,
    CreateBackupVaultCommandInput,
    CreateBackupVaultCommandOutput,
    DeleteBackupSelectionCommand,
    DeleteBackupSelectionCommandOutput,
    DeleteBackupVaultCommand,
    DeleteBackupVaultCommandOutput,
    GetBackupPlanCommand,
    GetBackupSelectionCommand,
    RecoveryPointByResource,
    paginateListBackupPlans,
    paginateListBackupSelections,
    paginateListBackupVaults,
    paginateListRecoveryPointsByResource
} from '@aws-sdk/client-backup';

import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import addCacheMiddleware from '../../utils/aws-sdk-middlewares';
import { AWSSDKCacheParams } from '../../utils/common-types';
import getLogger from '../../utils/logger';
import { getFsxVolumeArn } from '../../utils/utils';

const logger = getLogger();

interface FsxVolumeIds {
    awsAccountId: string;
    fsxFileSystemId: string;
    fsxVolumeId: string;
}

interface CreateBackupSelectionArgs extends FsxVolumeIds {
    backupPlanId: string;
    selectionName: string;
    iamRoleArn: string;
}

type VolumeRecoveryPointArgs = FsxVolumeIds;
async function getBackupClient(
    credentialsId: string,
    region: string,
    accountId?: string,
    cacheParams: AWSSDKCacheParams = {}
) {
    logger.debug('Getting AWS Backup client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return addCacheMiddleware(new BackupClient({ credentials, region }), { ...cacheParams, credentialsId });
}

async function listBackupPlans(
    credentialsId: string,
    region: string,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<BackupPlansListMember[]> {
    logger.info('Listing AWS Backup plans:', { credentialsId, region, accountId });

    const client = await getBackupClient(credentialsId, region, accountId, cacheParams);
    const plans: BackupPlansListMember[] = [];
    for await (const page of paginateListBackupPlans({ client }, {})) {
        if (page.BackupPlansList?.length) {
            plans.push(...page.BackupPlansList);
        }
    }
    logger.debug('List AWS Backup plans response:', plans);

    return plans;
}

async function getBackupPlan(
    credentialsId: string,
    region: string,
    backupPlanId: string,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<BackupPlan | undefined> {
    logger.info('Getting AWS Backup plan:', { credentialsId, region, backupPlanId, accountId });

    const client = await getBackupClient(credentialsId, region, accountId, cacheParams);
    const response = await client.send(new GetBackupPlanCommand({ BackupPlanId: backupPlanId }));
    logger.debug('Get AWS Backup plan response:', response);

    return response.BackupPlan;
}

async function createBackupPlan(
    credentialsId: string,
    region: string,
    input: CreateBackupPlanCommandInput,
    accountId?: string
): Promise<CreateBackupPlanCommandOutput> {
    logger.info('Creating AWS Backup plan:', {
        credentialsId,
        region,
        accountId,
        planName: input.BackupPlan?.BackupPlanName
    });

    const client = await getBackupClient(credentialsId, region, accountId);
    const response = await client.send(new CreateBackupPlanCommand(input));
    logger.debug('Create AWS Backup plan response:', response);

    return response;
}

async function listBackupSelections(
    credentialsId: string,
    region: string,
    backupPlanId: string,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<BackupSelectionsListMember[]> {
    logger.info('Listing AWS Backup selections:', { credentialsId, region, backupPlanId, accountId });

    const client = await getBackupClient(credentialsId, region, accountId, cacheParams);
    const selections: BackupSelectionsListMember[] = [];
    for await (const page of paginateListBackupSelections({ client }, { BackupPlanId: backupPlanId })) {
        if (page.BackupSelectionsList?.length) {
            selections.push(...page.BackupSelectionsList);
        }
    }
    logger.debug('List AWS Backup selections response:', selections);

    return selections;
}

async function getBackupSelection(
    credentialsId: string,
    region: string,
    backupPlanId: string,
    selectionId: string,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<BackupSelection | undefined> {
    logger.info('Getting AWS Backup selection:', { credentialsId, region, backupPlanId, selectionId, accountId });

    const client = await getBackupClient(credentialsId, region, accountId, cacheParams);
    const response = await client.send(
        new GetBackupSelectionCommand({ BackupPlanId: backupPlanId, SelectionId: selectionId })
    );
    logger.debug('Get AWS Backup selection response:', response);

    return response.BackupSelection;
}

async function createBackupSelection(
    credentialsId: string,
    region: string,
    args: CreateBackupSelectionArgs,
    accountId?: string
): Promise<CreateBackupSelectionCommandOutput> {
    const { backupPlanId, selectionName, iamRoleArn, awsAccountId, fsxFileSystemId, fsxVolumeId } = args;
    const resourceArn = getFsxVolumeArn(region, awsAccountId, fsxFileSystemId, fsxVolumeId);
    logger.info('Creating AWS Backup selection:', {
        credentialsId,
        region,
        accountId,
        backupPlanId,
        selectionName,
        resourceArn
    });

    const client = await getBackupClient(credentialsId, region, accountId);
    const response = await client.send(
        new CreateBackupSelectionCommand({
            BackupPlanId: backupPlanId,
            BackupSelection: {
                SelectionName: selectionName,
                IamRoleArn: iamRoleArn,
                Resources: [resourceArn]
            }
        })
    );
    logger.debug('Create AWS Backup selection response:', response);

    return response;
}

async function deleteBackupSelection(
    credentialsId: string,
    region: string,
    backupPlanId: string,
    selectionId: string,
    accountId?: string
): Promise<DeleteBackupSelectionCommandOutput> {
    logger.info('Deleting AWS Backup selection:', { credentialsId, region, backupPlanId, selectionId, accountId });

    const client = await getBackupClient(credentialsId, region, accountId);
    const response = await client.send(
        new DeleteBackupSelectionCommand({ BackupPlanId: backupPlanId, SelectionId: selectionId })
    );
    logger.debug('Delete AWS Backup selection response:', response);

    return response;
}

async function listBackupVaults(
    credentialsId: string,
    region: string,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<BackupVaultListMember[]> {
    logger.info('Listing AWS Backup vaults:', { credentialsId, region, accountId });

    const client = await getBackupClient(credentialsId, region, accountId, cacheParams);
    const vaults: BackupVaultListMember[] = [];
    for await (const page of paginateListBackupVaults({ client }, {})) {
        if (page.BackupVaultList?.length) {
            vaults.push(...page.BackupVaultList);
        }
    }
    logger.debug('List AWS Backup vaults response:', vaults);

    return vaults;
}

async function createBackupVault(
    credentialsId: string,
    region: string,
    input: CreateBackupVaultCommandInput,
    accountId?: string
): Promise<CreateBackupVaultCommandOutput> {
    logger.info('Creating AWS Backup vault:', {
        credentialsId,
        region,
        accountId,
        backupVaultName: input.BackupVaultName
    });

    const client = await getBackupClient(credentialsId, region, accountId);
    const response = await client.send(new CreateBackupVaultCommand(input));
    logger.debug('Create AWS Backup vault response:', response);

    return response;
}

async function deleteBackupVault(
    credentialsId: string,
    region: string,
    backupVaultName: string,
    accountId?: string
): Promise<DeleteBackupVaultCommandOutput> {
    logger.info('Deleting AWS Backup vault:', { credentialsId, region, backupVaultName, accountId });

    const client = await getBackupClient(credentialsId, region, accountId);
    const response = await client.send(new DeleteBackupVaultCommand({ BackupVaultName: backupVaultName }));
    logger.debug('Delete AWS Backup vault response:', response);

    return response;
}

async function listRecoveryPointsByVolume(
    credentialsId: string,
    region: string,
    args: VolumeRecoveryPointArgs,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<RecoveryPointByResource[]> {
    const { awsAccountId, fsxFileSystemId, fsxVolumeId } = args;
    const resourceArn = getFsxVolumeArn(region, awsAccountId, fsxFileSystemId, fsxVolumeId);
    logger.info('Listing AWS Backup recovery points for FSxN volume:', {
        credentialsId,
        region,
        accountId,
        resourceArn
    });

    const client = await getBackupClient(credentialsId, region, accountId, cacheParams);
    const recoveryPoints: RecoveryPointByResource[] = [];
    for await (const page of paginateListRecoveryPointsByResource({ client }, { ResourceArn: resourceArn })) {
        if (page.RecoveryPoints?.length) {
            recoveryPoints.push(...page.RecoveryPoints);
        }
    }
    logger.debug('List recovery points response:', recoveryPoints);

    return recoveryPoints;
}

export {
    listBackupPlans,
    getBackupPlan,
    createBackupPlan,
    listBackupSelections,
    getBackupSelection,
    createBackupSelection,
    deleteBackupSelection,
    listBackupVaults,
    createBackupVault,
    deleteBackupVault,
    listRecoveryPointsByVolume,
    CreateBackupSelectionArgs,
    VolumeRecoveryPointArgs,
    FsxVolumeIds
};
