// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    BackupClient,
    CreateBackupPlanCommand,
    CreateBackupSelectionCommand,
    CreateBackupVaultCommand,
    DeleteBackupSelectionCommand,
    DeleteBackupVaultCommand,
    GetBackupPlanCommand,
    GetBackupSelectionCommand,
    ListBackupPlansCommand,
    ListBackupSelectionsCommand,
    ListBackupVaultsCommand,
    ListRecoveryPointsByResourceCommand
} from '@aws-sdk/client-backup';
import { mockClient } from 'aws-sdk-client-mock';
import listBackupPlansResponse from '../../responses/aws/list-backup-plans.json';
import getBackupPlanResponse from '../../responses/aws/get-backup-plan.json';
import listBackupSelectionsResponse from '../../responses/aws/list-backup-selections.json';
import getBackupSelectionResponse from '../../responses/aws/get-backup-selection.json';
import listBackupVaultsResponse from '../../responses/aws/list-backup-vaults.json';
import createBackupPlanResponse from '../../responses/aws/create-backup-plan.json';
import createBackupSelectionResponse from '../../responses/aws/create-backup-selection.json';
import createBackupVaultResponse from '../../responses/aws/create-backup-vault.json';
import listRecoveryPointsResponse from '../../responses/aws/list-recovery-points.json';

const backupMock = mockClient(BackupClient);

// Split the list-backup-plans fixture into two pages so the test can verify paginator concatenation in listBackupPlans.
const listBackupPlansPage1 = {
    BackupPlansList: [listBackupPlansResponse.BackupPlansList[0]],
    NextToken: 'page2'
};
const listBackupPlansPage2 = {
    BackupPlansList: [listBackupPlansResponse.BackupPlansList[1]]
};

backupMock
    .on(ListBackupPlansCommand)
    .callsFake(input => (input?.NextToken ? listBackupPlansPage2 : listBackupPlansPage1));
backupMock.on(GetBackupPlanCommand).resolves(getBackupPlanResponse);
backupMock.on(CreateBackupPlanCommand).resolves(createBackupPlanResponse);
backupMock.on(ListBackupSelectionsCommand).resolves(listBackupSelectionsResponse);
backupMock.on(GetBackupSelectionCommand).resolves(getBackupSelectionResponse);
backupMock.on(CreateBackupSelectionCommand).resolves(createBackupSelectionResponse);
backupMock.on(DeleteBackupSelectionCommand).resolves({});
backupMock.on(ListRecoveryPointsByResourceCommand).resolves(listRecoveryPointsResponse);
backupMock.on(ListBackupVaultsCommand).resolves(listBackupVaultsResponse);
backupMock.on(CreateBackupVaultCommand).resolves(createBackupVaultResponse);
backupMock.on(DeleteBackupVaultCommand).resolves({});

function resetBackupMockHistory() {
    backupMock.resetHistory();
}

export { backupMock, resetBackupMockHistory };
