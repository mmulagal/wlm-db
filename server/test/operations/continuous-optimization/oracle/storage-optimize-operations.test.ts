import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';

import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import waitForJobCompletion from '../../../utils/utils';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { createDatabaseInstanceConfigData } from '../../../../src/lib/database/database-instance-config';
import {
    OptimizeStorageConfigurationRequestBody,
    OptimizeStorageLayoutRequestBody
} from '../../../../src/routes/types/oracle-continuous-optimization.types';
import {
    AssessmentCategoriesOracle,
    OptimizeStorageConfigs,
    ORACLE_OPTIMIZE_STORAGE_CONFIGURATION_FIX_API_CONFIG_NAMES,
    ORACLE_OPTIMIZE_STORAGE_LAYOUT_FIX_API_CONFIG_NAMES
} from '../../../../src/utils/continous-optimization-consts';

import ORACLE_GOLDEN_CONFIG from '../../../../src/operations/continuous-optimization/oracle/golden-config';
import {
    deriveOracleNonVolumeCombinedOutputs,
    optimizeOracleStorageLayout
} from '../../../../src/operations/continuous-optimization/oracle/storage-optimize-operations';
import { getJobs } from '../../../../src/operations/database/job-operations';

const dbInstanceSid = 'oradbopt';
const node1InstanceId = 'i-optimizetest123456';
const fsxNId = 'fs-0f53fbecdd3d85fb2';
const RESOURCE_ID = 'optim-storage-resource-1234';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: RESOURCE_ID,
        resourceName: dbInstanceSid,
        resourceType: 'ORACLE',
        coRelationId: fsxNId,
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: { node1InstanceId }
    });

    const DATABASE_INSTANCE_RECORD = {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: RESOURCE_ID,
        databaseInstanceId: dbInstanceSid,
        databaseInstanceName: dbInstanceSid,
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'Standalone',
        fsxSvmId: { [fsxNId]: 'svm-0123456789abcdef0' },
        fsxnIds: fsxNId,
        databaseType: 'Oracle',
        metadata: { node1InstanceId }
    };
    await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);

    const mappedVolConfigData = {
        account_id: ACCOUNT_ID,
        credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resource_id: RESOURCE_ID,
        database_instance_id: dbInstanceSid,
        creation_time: new Date(),
        last_updated: new Date(),
        config_data: {
            [fsxNId]: {
                DATADG: [{ lunId: 'BaselineLUN1', diskGroup: 'DATADG', svmName: 'svm1', svmId: 'svm1' }]
            }
        },
        config_data_type: AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
    };

    const storageLayoutConfigData = {
        account_id: ACCOUNT_ID,
        credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resource_id: RESOURCE_ID,
        database_instance_id: dbInstanceSid,
        creation_time: new Date(),
        last_updated: new Date(),
        config_data: {
            layout: [
                {
                    name: (() => {
                        const [config] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'data-dg-lun-layout');
                        return config.id;
                    })(),
                    violationDetails: [{ objectName: 'DATADG', value: '0', recommended: '1' }]
                }
            ]
        },
        config_data_type: AssessmentCategoriesOracle.STORAGE
    };

    await createDatabaseInstanceConfigData([mappedVolConfigData, storageLayoutConfigData]);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, RESOURCE_ID);
});

describe('optimizeOracleStorageLayout (integration style)', () => {
    it('should register a parent optimization job and attempt layout fix', async () => {
        const parentJobIdOrErr = await optimizeOracleStorageLayout({
            accountId: ACCOUNT_ID,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            databaseHostId: RESOURCE_ID,
            databaseInstanceId: dbInstanceSid,
            optimizationTargets: [
                {
                    configurationName: (() => {
                        const [config] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'data-dg-lun-layout');
                        return config.id;
                    })(),
                    objectsToOptimize: ['DATADG']
                }
            ]
        });

        expect(typeof parentJobIdOrErr).toBe('string');

        const { items: jobItems } = await getJobs(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            includeSubJobs: true
        } as Parameters<typeof getJobs>[1]);
        const parentJob = ((jobItems as Array<{ id: string; type: string }>) || []).find(
            j => j.id === parentJobIdOrErr
        );
        expect(parentJob).toBeDefined();
        expect(parentJob?.type).toBe('OPTIMIZATION');

        await waitForJobCompletion(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            parentJobIdOrErr as string
        );

        const { items: jobStatusAfterCompletion } = await getJobs(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            includeSubJobs: true
        } as Parameters<typeof getJobs>[1]);

        expect(jobStatusAfterCompletion).toBeDefined();
    });
});

describe('deriveOracleNonVolumeCombinedOutputs', () => {
    it('should expand block-device-space-management using violatedConfigs from mixed LUN/volume drift rows', () => {
        const { syntheticTargets, droppedCombined } = deriveOracleNonVolumeCombinedOutputs(
            [
                {
                    configurationName: OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT,
                    objectsToOptimize: ['/vol/v1/l1', '/vol/v2/l2', 'v2']
                }
            ],
            [
                {
                    id: OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT,
                    violationDetails: [
                        {
                            objectName: '/vol/v1/l1',
                            value: '',
                            violatedConfigs: [{ id: OptimizeStorageConfigs.SPACE_RESERVATION, current: 'false' }]
                        },
                        {
                            objectName: '/vol/v2/l2',
                            value: '',
                            violatedConfigs: [{ id: OptimizeStorageConfigs.SPACE_ALLOCATION, current: 'false' }]
                        },
                        {
                            objectName: 'v2',
                            value: '',
                            violatedConfigs: [{ id: OptimizeStorageConfigs.FRACTIONAL_RESERVE, current: '5' }]
                        }
                    ]
                }
            ]
        );

        expect(droppedCombined).toEqual([]);
        expect(syntheticTargets).toHaveLength(3);
        expect(syntheticTargets).toContainEqual({
            configurationName: OptimizeStorageConfigs.SPACE_RESERVATION,
            objectsToOptimize: ['/vol/v1/l1']
        });
        expect(syntheticTargets).toContainEqual({
            configurationName: OptimizeStorageConfigs.SPACE_ALLOCATION,
            objectsToOptimize: ['/vol/v2/l2']
        });
        expect(syntheticTargets).toContainEqual({
            configurationName: OptimizeStorageConfigs.FRACTIONAL_RESERVE,
            objectsToOptimize: ['v2']
        });
    });

    it('should report droppedCombined when no drift entry matches requested non-volume combined configs', () => {
        const { syntheticTargets, droppedCombined } = deriveOracleNonVolumeCombinedOutputs(
            [
                {
                    configurationName: OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT,
                    objectsToOptimize: ['/vol/v1/l1', 'v1']
                }
            ],
            [
                {
                    id: OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION,
                    violationDetails: []
                }
            ]
        );

        expect(syntheticTargets).toEqual([]);
        expect(droppedCombined).toEqual([OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT]);
    });

    it('should report droppedCombined when the drift entry is error-shaped', () => {
        const { syntheticTargets, droppedCombined } = deriveOracleNonVolumeCombinedOutputs(
            [
                {
                    configurationName: OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT,
                    objectsToOptimize: ['v1']
                }
            ],
            [
                {
                    id: OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT,
                    errorMessage: 'LUN assessment data unavailable'
                }
            ]
        );

        expect(syntheticTargets).toEqual([]);
        expect(droppedCombined).toEqual([OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT]);
    });

    it('should expand available combined configs and report only missing ones in droppedCombined', () => {
        const { syntheticTargets, droppedCombined } = deriveOracleNonVolumeCombinedOutputs(
            [
                {
                    configurationName: OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT,
                    objectsToOptimize: ['v1']
                },
                {
                    configurationName: OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION,
                    objectsToOptimize: ['v2']
                }
            ],
            [
                {
                    id: OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION,
                    violationDetails: [
                        {
                            objectName: 'v2',
                            value: '',
                            violatedConfigs: [{ id: OptimizeStorageConfigs.TIERING_POLICY, current: 'auto' }]
                        }
                    ]
                }
            ]
        );

        expect(droppedCombined).toEqual([OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT]);
        expect(syntheticTargets).toEqual([
            {
                configurationName: OptimizeStorageConfigs.TIERING_POLICY,
                objectsToOptimize: ['v2']
            }
        ]);
    });

    it('should filter malformed violationDetails rows and still expand valid rows', () => {
        const { syntheticTargets, droppedCombined } = deriveOracleNonVolumeCombinedOutputs(
            [
                {
                    configurationName: OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT,
                    objectsToOptimize: ['v1']
                }
            ],
            [
                {
                    id: OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT,
                    violationDetails: [
                        { objectName: 'v1', value: '' },
                        {
                            objectName: 'v1',
                            value: '',
                            violatedConfigs: [{ id: OptimizeStorageConfigs.FRACTIONAL_RESERVE, current: '5' }]
                        }
                    ]
                }
            ]
        );

        expect(droppedCombined).toEqual([]);
        expect(syntheticTargets).toEqual([
            {
                configurationName: OptimizeStorageConfigs.FRACTIONAL_RESERVE,
                objectsToOptimize: ['v1']
            }
        ]);
    });
});

describe('Oracle optimize storage request bodies', () => {
    it('should accept configuration names only on the configuration route and layout names only on the layout route', () => {
        const configurationName = ORACLE_OPTIMIZE_STORAGE_CONFIGURATION_FIX_API_CONFIG_NAMES[0];
        const layoutName = ORACLE_OPTIMIZE_STORAGE_LAYOUT_FIX_API_CONFIG_NAMES[0];
        const validAssessment = (name: string) => ({
            assessments: [{ configurationName: name, objectsToOptimize: ['vol-1'] }]
        });

        expect(Value.Check(OptimizeStorageConfigurationRequestBody, validAssessment(configurationName))).toBe(true);
        expect(Value.Check(OptimizeStorageLayoutRequestBody, validAssessment(layoutName))).toBe(true);
        expect(Value.Check(OptimizeStorageConfigurationRequestBody, validAssessment(layoutName))).toBe(false);
        expect(Value.Check(OptimizeStorageLayoutRequestBody, validAssessment(configurationName))).toBe(false);
    });
});
