import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DatabaseTypes } from '../../src/utils/consts';
import { AssessmentCategoriesOracle } from '../../src/utils/continous-optimization-consts';
import { processAccountInstancesBatch } from '../../src/operations/cont-opt-assessment-operations';
import { DatabaseInstancesIncludingResource } from '../../src/utils/common-types';

const triggerMssqlAssessmentMock = vi.fn().mockResolvedValue(undefined);
const triggerOracleAssessmentMock = vi.fn().mockResolvedValue(undefined);
const updateMetadataMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/operations/continuous-optimization/mssql/assessment-operations', () => ({
    triggerMssqlAssessment: (...args: unknown[]) => triggerMssqlAssessmentMock(...args),
    updateAssessmentResultsInInstanceMetadata: (...args: unknown[]) => updateMetadataMock(...args)
}));

vi.mock('../../src/operations/continuous-optimization/oracle/assessment-operations', () => ({
    triggerOracleAssessment: (...args: unknown[]) => triggerOracleAssessmentMock(...args)
}));

function makeInstance(
    databaseType: string,
    resourceId: string,
    instanceId: string
): DatabaseInstancesIncludingResource {
    return {
        account_id: 'test-account',
        credentials_id: 'test-cred',
        region: 'us-east-1',
        resource_id: resourceId,
        database_instance_id: instanceId,
        database_type: databaseType,
        resource: {
            account_id: 'test-account',
            credentials_id: 'test-cred',
            region: 'us-east-1',
            id: resourceId,
            resource_name: `resource-${resourceId}`,
            resource_type: databaseType
        }
    } as unknown as DatabaseInstancesIncludingResource;
}

describe('processAccountInstancesBatch', () => {
    beforeEach(() => {
        triggerMssqlAssessmentMock.mockClear();
        triggerOracleAssessmentMock.mockClear();
        updateMetadataMock.mockClear();
    });

    it('routes MSSQL and Oracle resources to the correct host-level assessment function', async () => {
        const mssqlInstance = makeInstance(DatabaseTypes.MS_SQL_SERVER, 'resource-mssql', 'inst-mssql');
        const oracleInstance = makeInstance(DatabaseTypes.ORACLE, 'resource-oracle', 'inst-oracle');

        await processAccountInstancesBatch('test-account', [mssqlInstance, oracleInstance], 'parent-job-1', 1);

        // triggerMssqlAssessment must never receive the Oracle resource
        const mssqlCallsWithOracleResource = triggerMssqlAssessmentMock.mock.calls.filter(
            call => (call[0] as DatabaseInstancesIncludingResource).resource_id === 'resource-oracle'
        );
        expect(mssqlCallsWithOracleResource).toHaveLength(0);

        // triggerOracleAssessment must be called for the Oracle resource with only HOST_OS_PATCH
        // — once for instance-level, once for host-level (both use HOST_OS_PATCH)
        const oracleCalls = triggerOracleAssessmentMock.mock.calls.filter(
            call => (call[0] as DatabaseInstancesIncludingResource).resource_id === 'resource-oracle'
        );
        expect(oracleCalls.length).toBeGreaterThanOrEqual(1);

        // Host-level Oracle call passes exactly [HOST_OS_PATCH]
        const hostLevelOracleCall = oracleCalls.find(call => {
            const fields = call[2] as string[];
            return fields.length === 1 && fields[0] === AssessmentCategoriesOracle.HOST_OS_PATCH;
        });
        expect(hostLevelOracleCall).toBeTruthy();
    });

    it('continues processing when an Oracle instance returns no mapped volume data', async () => {
        const mssqlInstance = makeInstance(DatabaseTypes.MS_SQL_SERVER, 'resource-mssql-2', 'inst-mssql-2');
        const oracleInstance = makeInstance(DatabaseTypes.ORACLE, 'resource-oracle-2', 'inst-oracle-2');

        // Oracle assessment rejects with the exact error from the issue
        triggerOracleAssessmentMock.mockRejectedValueOnce(
            new Error('No mapped volume data found for resource resource-oracle-2,  in account test-account.')
        );

        // The batch should NOT throw — Oracle failure is skippable
        await expect(
            processAccountInstancesBatch('test-account', [mssqlInstance, oracleInstance], 'parent-job-2', 1)
        ).resolves.toBe(true);

        // MSSQL instance-level assessment still ran
        expect(triggerMssqlAssessmentMock).toHaveBeenCalled();
    });

    it('runs Oracle host-level HOST_OS_PATCH assessment for Oracle-only batches', async () => {
        const oracleInstance1 = makeInstance(DatabaseTypes.ORACLE, 'resource-oracle-3a', 'inst-oracle-3a');
        const oracleInstance2 = makeInstance(DatabaseTypes.ORACLE, 'resource-oracle-3b', 'inst-oracle-3b');

        await processAccountInstancesBatch('test-account', [oracleInstance1, oracleInstance2], 'parent-job-3', 1);

        // triggerMssqlAssessment must not be called for an Oracle-only batch
        expect(triggerMssqlAssessmentMock).not.toHaveBeenCalled();

        // triggerOracleAssessment is called: 2 instance-level + 2 host-level
        expect(triggerOracleAssessmentMock).toHaveBeenCalled();

        // Every host-level call must carry exactly [HOST_OS_PATCH]
        const hostLevelCalls = triggerOracleAssessmentMock.mock.calls.filter(call => {
            const fields = call[2] as string[];
            return fields.length === 1 && fields[0] === AssessmentCategoriesOracle.HOST_OS_PATCH;
        });
        expect(hostLevelCalls.length).toBeGreaterThanOrEqual(2);
    });
});
