import { beforeEach } from 'vitest';
import {
    CreateBackupPlanCommand,
    CreateBackupPlanCommandInput,
    CreateBackupSelectionCommand,
    CreateBackupVaultCommand,
    DeleteBackupSelectionCommand,
    DeleteBackupVaultCommand,
    ListRecoveryPointsByResourceCommand
} from '@aws-sdk/client-backup';
import { backupMock, resetBackupMockHistory } from '../../simulator/scopes/aws/backup-scope';
import listBackupPlansResponse from '../../simulator/responses/aws/list-backup-plans.json';
import getBackupPlanResponse from '../../simulator/responses/aws/get-backup-plan.json';
import listBackupSelectionsResponse from '../../simulator/responses/aws/list-backup-selections.json';
import getBackupSelectionResponse from '../../simulator/responses/aws/get-backup-selection.json';
import listBackupVaultsResponse from '../../simulator/responses/aws/list-backup-vaults.json';
import createBackupPlanResponse from '../../simulator/responses/aws/create-backup-plan.json';
import createBackupSelectionResponse from '../../simulator/responses/aws/create-backup-selection.json';
import createBackupVaultResponse from '../../simulator/responses/aws/create-backup-vault.json';
import listRecoveryPointsResponse from '../../simulator/responses/aws/list-recovery-points.json';
import {
    createBackupPlan,
    createBackupSelection,
    createBackupVault,
    deleteBackupSelection,
    deleteBackupVault,
    getBackupPlan,
    getBackupSelection,
    listBackupPlans,
    listBackupSelections,
    listBackupVaults,
    listRecoveryPointsByVolume
} from '../../../src/lib/aws/backup';
import { DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';

const REGION = 'ap-southeast-1';
const AWS_ACCOUNT_ID = '464262061435';
const FSX_FILE_SYSTEM_ID = 'fs-0d5efc3057c4f12cb';
const FSX_VOLUME_ID = 'fsvol-044997d746f7b236b';
const BACKUP_PLAN_ID = '263fc531-ebf1-4d06-91dc-3ede5bd3e62b';
const BACKUP_SELECTION_ID = 'sel-0000000000000001';
const EXPECTED_VOLUME_ARN = `arn:aws:fsx:${REGION}:${AWS_ACCOUNT_ID}:volume/${FSX_FILE_SYSTEM_ID}/${FSX_VOLUME_ID}`;

describe('Testcases for AWS Backup lib wrapper', () => {
    // Backup scope uses a single aws-sdk-client-mock instance per client class; clear call history so assertions on
    // command inputs are scoped to the current test and not polluted by previous ones.
    beforeEach(() => {
        resetBackupMockHistory();
    });

    describe('listBackupPlans', () => {
        it('should concatenate paginated backup plans', async () => {
            const plans = await listBackupPlans(DEFAULT_AWS_CREDENTIALS_TYPE, REGION);
            expect(plans).toEqual(listBackupPlansResponse.BackupPlansList);
            expect(plans).toHaveLength(2);
        });
    });

    describe('getBackupPlan', () => {
        it('should return the BackupPlan body for a given plan id', async () => {
            const plan = await getBackupPlan(DEFAULT_AWS_CREDENTIALS_TYPE, REGION, BACKUP_PLAN_ID);
            expect(plan).toEqual(getBackupPlanResponse.BackupPlan);
        });
    });

    describe('createBackupPlan', () => {
        it('should pass through CreateBackupPlanCommandOutput', async () => {
            const input: CreateBackupPlanCommandInput = {
                BackupPlan: {
                    BackupPlanName: 'UnitTestPlan',
                    Rules: [
                        {
                            RuleName: 'DailyRule',
                            TargetBackupVaultName: 'Default',
                            ScheduleExpression: 'cron(0 5 ? * * *)',
                            Lifecycle: { DeleteAfterDays: 7 }
                        }
                    ]
                }
            };
            const response = await createBackupPlan(DEFAULT_AWS_CREDENTIALS_TYPE, REGION, input);
            expect(response).toMatchObject(createBackupPlanResponse);

            const calls = backupMock.commandCalls(CreateBackupPlanCommand);
            expect(calls).toHaveLength(1);
            expect(calls[0].args[0].input).toEqual(input);
        });
    });

    describe('listBackupSelections', () => {
        it('should return the BackupSelectionsList for a given plan', async () => {
            const selections = await listBackupSelections(DEFAULT_AWS_CREDENTIALS_TYPE, REGION, BACKUP_PLAN_ID);
            expect(selections).toEqual(listBackupSelectionsResponse.BackupSelectionsList);
        });
    });

    describe('getBackupSelection', () => {
        it('should return BackupSelection body', async () => {
            const selection = await getBackupSelection(
                DEFAULT_AWS_CREDENTIALS_TYPE,
                REGION,
                BACKUP_PLAN_ID,
                BACKUP_SELECTION_ID
            );
            expect(selection).toEqual(getBackupSelectionResponse.BackupSelection);
        });
    });

    describe('createBackupSelection', () => {
        it('should send CreateBackupSelection with the FSxN volume ARN built from IDs', async () => {
            const response = await createBackupSelection(DEFAULT_AWS_CREDENTIALS_TYPE, REGION, {
                backupPlanId: BACKUP_PLAN_ID,
                selectionName: 'Netapp-WorkloadFactory-Test',
                iamRoleArn: 'arn:aws:iam::464262061435:role/service-role/AWSBackupDefaultServiceRole',
                awsAccountId: AWS_ACCOUNT_ID,
                fsxFileSystemId: FSX_FILE_SYSTEM_ID,
                fsxVolumeId: FSX_VOLUME_ID
            });
            expect(response).toMatchObject(createBackupSelectionResponse);

            const calls = backupMock.commandCalls(CreateBackupSelectionCommand);
            expect(calls).toHaveLength(1);
            expect(calls[0].args[0].input).toEqual({
                BackupPlanId: BACKUP_PLAN_ID,
                BackupSelection: {
                    SelectionName: 'Netapp-WorkloadFactory-Test',
                    IamRoleArn: 'arn:aws:iam::464262061435:role/service-role/AWSBackupDefaultServiceRole',
                    Resources: [EXPECTED_VOLUME_ARN]
                }
            });
        });
    });

    describe('deleteBackupSelection', () => {
        it('should call DeleteBackupSelection with plan + selection ids', async () => {
            await expect(
                deleteBackupSelection(DEFAULT_AWS_CREDENTIALS_TYPE, REGION, BACKUP_PLAN_ID, BACKUP_SELECTION_ID)
            ).resolves.toBeDefined();

            const calls = backupMock.commandCalls(DeleteBackupSelectionCommand);
            expect(calls).toHaveLength(1);
            expect(calls[0].args[0].input).toEqual({
                BackupPlanId: BACKUP_PLAN_ID,
                SelectionId: BACKUP_SELECTION_ID
            });
        });
    });

    describe('listBackupVaults', () => {
        it('should return BackupVaultList for the account + region', async () => {
            const vaults = await listBackupVaults(DEFAULT_AWS_CREDENTIALS_TYPE, REGION);
            expect(vaults).toEqual(listBackupVaultsResponse.BackupVaultList);
        });
    });

    describe('createBackupVault', () => {
        it('should send CreateBackupVault with the given input and return the response', async () => {
            const response = await createBackupVault(DEFAULT_AWS_CREDENTIALS_TYPE, REGION, {
                BackupVaultName: 'wlmdb-poc',
                BackupVaultTags: { Project: 'wlmdb' }
            });
            expect(response).toMatchObject(createBackupVaultResponse);

            const calls = backupMock.commandCalls(CreateBackupVaultCommand);
            expect(calls).toHaveLength(1);
            expect(calls[0].args[0].input).toEqual({
                BackupVaultName: 'wlmdb-poc',
                BackupVaultTags: { Project: 'wlmdb' }
            });
        });
    });

    describe('deleteBackupVault', () => {
        it('should call DeleteBackupVault with the vault name', async () => {
            await expect(deleteBackupVault(DEFAULT_AWS_CREDENTIALS_TYPE, REGION, 'wlmdb-poc')).resolves.toBeDefined();

            const calls = backupMock.commandCalls(DeleteBackupVaultCommand);
            expect(calls).toHaveLength(1);
            expect(calls[0].args[0].input).toEqual({ BackupVaultName: 'wlmdb-poc' });
        });
    });

    describe('listRecoveryPointsByVolume', () => {
        it('should list recovery points using the FSxN volume ARN built from IDs', async () => {
            const recoveryPoints = await listRecoveryPointsByVolume(DEFAULT_AWS_CREDENTIALS_TYPE, REGION, {
                awsAccountId: AWS_ACCOUNT_ID,
                fsxFileSystemId: FSX_FILE_SYSTEM_ID,
                fsxVolumeId: FSX_VOLUME_ID
            });

            expect(recoveryPoints).toEqual(listRecoveryPointsResponse.RecoveryPoints);

            const calls = backupMock.commandCalls(ListRecoveryPointsByResourceCommand);
            expect(calls).toHaveLength(1);
            expect(calls[0].args[0].input).toMatchObject({ ResourceArn: EXPECTED_VOLUME_ARN });
        });
    });
});
