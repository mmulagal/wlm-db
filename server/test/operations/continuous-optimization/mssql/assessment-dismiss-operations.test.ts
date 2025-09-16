import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/opentelemetry-scope';
import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/aws/ec2-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';
import '../../../simulator/scopes/aws/compute-optimizer-scope';
import {
    updateDismissConfigurations,
    updateFieldsBasedOnDismissedConfigurations,
    mergeDismissConfigurations,
    updateConfig,
    DismissConfigType,
    getOrCreateGroup,
    formatDismissConfigurations
} from '../../../../src/operations/continuous-optimization/assessment-dismiss-operations';
import { fetchMssqlDriftAssessment } from '../../../../src/operations/continuous-optimization/mssql/assessment-operations';
import { createResource, deleteDatabaseInstance, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import {
    DatabaseInstanceDismissConfigs,
    DismissHostGroup,
    DismissInstanceGroup,
    InstanceDismissParams
} from '../../../../src/utils/common-types';

describe('Assessment Dismiss Operations', () => {
    it('Should filter out fields based on dismissed configurations', () => {
        const fieldsValues = ['crr', 'maxdop', 'compute', 'storage', 'license'];
        const dismissedConfigurations = {
            crr: {
                configurationName: 'crr',
                endTime: 1747502704221,
                startTime: 1744910704221,
                configState: 'POSTPONED'
            }
        };

        const result = updateFieldsBasedOnDismissedConfigurations(fieldsValues, dismissedConfigurations);

        expect(result).toEqual(['maxdop', 'compute', 'storage', 'license']);
    });

    it('Should update dismiss configurations successfully', async () => {
        await createResource(ACCOUNT_ID, {
            resourceId: '6cbdabbfe3fb147e',
            resourceName: 'test-resource',
            resourceType: 'MSSQL',
            coRelationId: 'fs-f6082f35c1db',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId: 'i-07e76a4b916548dc0',
                node2InstanceId: 'i-0880a21327284f67c',
                sqlDeploymentType: 'FCI'
            }
        });
        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: '6cbdabbfe3fb147e',
            databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-0f53fbecdd3d85fb2',
            databaseType: ''
        });
        const mockAccountId = ACCOUNT_ID;
        const mockConfigurations = [
            {
                configurationName: 'compute-rightsizing',
                configState: 'ACTIVE',
                databaseHosts: [
                    {
                        id: '6cbdabbfe3fb147e',
                        sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        region: DEFAULT_AWS_REGION
                    }
                ]
            }
        ];
        const mockResponse = [
            {
                configurationName: 'compute-rightsizing',
                startTime: expect.any(Number),
                endTime: undefined,
                configState: 'ACTIVE',
                databaseHosts: [
                    {
                        id: '6cbdabbfe3fb147e',
                        sqlServerInstances: ['f4b7c5d3-e1f6-4g2a-9b5d'],
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        region: DEFAULT_AWS_REGION,
                        status: 'SUCCESS'
                    }
                ]
            }
        ];
        const result = await updateDismissConfigurations(mockAccountId, mockConfigurations);
        expect(result).toEqual({ dismissedConfigurations: mockResponse });
        // Cleanup the database instance
        const DATABASE_INSTANCE_RECORD = {
            resourceId: '6cbdabbfe3fb147e'
        };
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DATABASE_INSTANCE_RECORD.resourceId, [
            'non-existing-instance'
        ]);
    });
});

describe('High Availability Dismiss Configuration Tests', () => {
    const testResourceId = 'ha-test-resource';
    const testInstanceId = 'ha-test-instance';

    beforeEach(async () => {
        // Create test resource
        await createResource(ACCOUNT_ID, {
            resourceId: testResourceId,
            resourceName: 'ha-test-resource',
            resourceType: 'MSSQL',
            coRelationId: 'fs-ha-test',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId: 'i-ha-node1',
                node2InstanceId: 'i-ha-node2',
                sqlDeploymentType: 'FCI'
            }
        });

        // Create test database instance
        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: testResourceId,
            databaseInstanceId: testInstanceId,
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-ha-test': 'svm-ha-test' },
            fsxnIds: 'fs-ha-test',
            databaseType: ''
        });
    });

    afterEach(async () => {
        // Cleanup test data
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResourceId, [testInstanceId]);
    });

    it('Should dismiss heartbeat settings (host level) and verify in assessment', async () => {
        const heartbeatDismissConfig = [
            {
                configurationName: 'heartbeat-settings',
                configState: 'DISMISSED',
                databaseHosts: [
                    {
                        id: testResourceId,
                        sqlServerInstances: [testInstanceId],
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        region: DEFAULT_AWS_REGION
                    }
                ]
            }
        ];

        const result = await updateDismissConfigurations(ACCOUNT_ID, heartbeatDismissConfig);
        expect(result.dismissedConfigurations).toHaveLength(1);
        expect(result.dismissedConfigurations[0].configurationName).toBe('heartbeat-settings');
        expect(result.dismissedConfigurations[0].configState).toBe('DISMISSED');

        // Verify in assessment response
        const driftAssessment = await fetchMssqlDriftAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            testResourceId,
            testInstanceId
        );

        expect(driftAssessment.dismissedConfigurations?.highAvailability).toBeDefined();
        const haConfigs = driftAssessment.dismissedConfigurations?.highAvailability as InstanceDismissParams[];
        const heartbeatConfig = haConfigs?.find(config => config.configurationName === 'heartbeat-settings');
        expect(heartbeatConfig).toBeDefined();
        expect(heartbeatConfig?.configState).toBe('DISMISSED');
    });

    it('Should dismiss shared storage (instance level) and verify in assessment', async () => {
        const sharedStorageDismissConfig = [
            {
                configurationName: 'shared-storage',
                configState: 'POSTPONED',
                databaseHosts: [
                    {
                        id: testResourceId,
                        sqlServerInstances: [testInstanceId],
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        region: DEFAULT_AWS_REGION
                    }
                ]
            }
        ];

        const result = await updateDismissConfigurations(ACCOUNT_ID, sharedStorageDismissConfig);
        expect(result.dismissedConfigurations).toHaveLength(1);
        expect(result.dismissedConfigurations[0].configurationName).toBe('shared-storage');
        expect(result.dismissedConfigurations[0].configState).toBe('POSTPONED');
        expect(result.dismissedConfigurations[0].endTime).toBeDefined();

        // Verify in assessment response
        const driftAssessment = await fetchMssqlDriftAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            testResourceId,
            testInstanceId
        );

        expect(driftAssessment.dismissedConfigurations?.highAvailability).toBeDefined();
        const haConfigs2 = driftAssessment.dismissedConfigurations?.highAvailability as InstanceDismissParams[];
        const sharedStorageConfig = haConfigs2?.find(config => config.configurationName === 'shared-storage');
        expect(sharedStorageConfig).toBeDefined();
        expect(sharedStorageConfig?.configState).toBe('POSTPONED');
        expect(sharedStorageConfig?.endTime).toBeDefined();
    });

    it('Should combine host and instance level HA configurations properly', async () => {
        // First dismiss heartbeat settings (host level)
        const heartbeatConfigRequest = [
            {
                configurationName: 'heartbeat-settings',
                configState: 'DISMISSED',
                databaseHosts: [
                    {
                        id: testResourceId,
                        sqlServerInstances: [testInstanceId],
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        region: DEFAULT_AWS_REGION
                    }
                ]
            }
        ];
        await updateDismissConfigurations(ACCOUNT_ID, heartbeatConfigRequest);

        // Then dismiss shared storage (instance level)
        const sharedStorageConfigRequest = [
            {
                configurationName: 'shared-storage',
                configState: 'POSTPONED',
                databaseHosts: [
                    {
                        id: testResourceId,
                        sqlServerInstances: [testInstanceId],
                        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                        region: DEFAULT_AWS_REGION
                    }
                ]
            }
        ];
        await updateDismissConfigurations(ACCOUNT_ID, sharedStorageConfigRequest);

        // Verify both configurations are present in assessment
        const driftAssessment = await fetchMssqlDriftAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            testResourceId,
            testInstanceId
        );

        const { dismissedConfigurations } = driftAssessment;
        expect(dismissedConfigurations?.highAvailability).toBeDefined();

        // Verify host level config
        const haConfigs3 = dismissedConfigurations?.highAvailability as InstanceDismissParams[];
        const foundHeartbeatConfig = haConfigs3?.find(config => config.configurationName === 'heartbeat-settings');
        expect(foundHeartbeatConfig).toBeDefined();
        expect(foundHeartbeatConfig?.configState).toBe('DISMISSED');

        // Verify instance level config
        const foundSharedStorageConfig = haConfigs3?.find(config => config.configurationName === 'shared-storage');
        expect(foundSharedStorageConfig).toBeDefined();
        expect(foundSharedStorageConfig?.configState).toBe('POSTPONED');

        // Verify other HA subcategories are not set
        const clusterQuorumConfig = haConfigs3?.find(config => config.configurationName === 'cluster-quorum');
        const sqlserverServiceConfig = haConfigs3?.find(config => config.configurationName === 'sqlserver-service');
        expect(clusterQuorumConfig).toBeUndefined();
        expect(sqlserverServiceConfig).toBeUndefined();
    });

    it('Should filter out high-availability field when HA subcategories are dismissed', () => {
        const fieldsValues = ['high-availability', 'compute', 'storage', 'license'];
        const dismissedConfigurations: DatabaseInstanceDismissConfigs = {
            highAvailability: [
                {
                    configurationName: 'heartbeat-settings',
                    endTime: undefined,
                    startTime: Date.now(),
                    configState: 'DISMISSED'
                },
                {
                    configurationName: 'shared-storage',
                    endTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
                    startTime: Date.now(),
                    configState: 'POSTPONED'
                }
            ]
        };

        const result = updateFieldsBasedOnDismissedConfigurations(fieldsValues, dismissedConfigurations);

        // Should NOT filter out high-availability since only SOME subcategories are dismissed/postponed (not ALL)
        expect(result).toEqual(['high-availability', 'compute', 'storage', 'license']);
        expect(result).toContain('high-availability');
    });

    it('Should filter out high-availability field when ALL HA subcategories are dismissed', () => {
        const fieldsValues = ['high-availability', 'compute', 'storage', 'license'];
        const dismissedConfigurations: DatabaseInstanceDismissConfigs = {
            highAvailability: [
                {
                    configurationName: 'heartbeat-settings',
                    endTime: undefined,
                    startTime: Date.now(),
                    configState: 'DISMISSED'
                },
                {
                    configurationName: 'shared-storage',
                    endTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
                    startTime: Date.now(),
                    configState: 'POSTPONED'
                },
                {
                    configurationName: 'cluster-quorum',
                    endTime: undefined,
                    startTime: Date.now(),
                    configState: 'DISMISSED'
                },
                {
                    configurationName: 'sqlserver-service',
                    endTime: undefined,
                    startTime: Date.now(),
                    configState: 'DISMISSED'
                },
                {
                    configurationName: 'drive-letter',
                    endTime: undefined,
                    startTime: Date.now(),
                    configState: 'DISMISSED'
                }
            ]
        };

        const result = updateFieldsBasedOnDismissedConfigurations(fieldsValues, dismissedConfigurations);

        // Should filter out high-availability since ALL subcategories are dismissed/postponed
        expect(result).toEqual(['compute', 'storage', 'license']);
        expect(result).not.toContain('high-availability');
    });

    it('Should merge dismiss configurations correctly with nested high-availability', () => {
        const instanceConfigs: DatabaseInstanceDismissConfigs = {
            highAvailability: [
                {
                    configurationName: 'shared-storage',
                    endTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
                    startTime: Date.now(),
                    configState: 'POSTPONED'
                }
            ]
        };

        const hostConfigs: DatabaseInstanceDismissConfigs = {
            highAvailability: [
                {
                    configurationName: 'heartbeat-settings',
                    endTime: undefined,
                    startTime: Date.now(),
                    configState: 'DISMISSED'
                }
            ]
        };

        const result = mergeDismissConfigurations(instanceConfigs, hostConfigs);

        // Should merge both host and instance level high-availability configurations
        expect(result.highAvailability).toBeDefined();
        expect(result.highAvailability).toHaveLength(2);

        const haConfigs4 = result.highAvailability as InstanceDismissParams[];
        const sharedStorageConfig = haConfigs4?.find(config => config.configurationName === 'shared-storage');
        const heartbeatConfig = haConfigs4?.find(config => config.configurationName === 'heartbeat-settings');

        expect(sharedStorageConfig).toBeDefined();
        expect(heartbeatConfig).toBeDefined();
        expect(sharedStorageConfig?.configState).toBe('POSTPONED');
        expect(heartbeatConfig?.configState).toBe('DISMISSED');
    });

    it('Should handle undefined configurations in merge', () => {
        const instanceConfigs: DatabaseInstanceDismissConfigs = {
            highAvailability: [
                {
                    configurationName: 'shared-storage',
                    endTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
                    startTime: Date.now(),
                    configState: 'POSTPONED'
                }
            ]
        };

        const result1 = mergeDismissConfigurations(instanceConfigs, undefined);
        const result2 = mergeDismissConfigurations(undefined, instanceConfigs);
        const result3 = mergeDismissConfigurations(undefined, undefined);

        const haConfigs5 = result1.highAvailability as InstanceDismissParams[];
        const haConfigs6 = result2.highAvailability as InstanceDismissParams[];
        const sharedStorageConfig1 = haConfigs5?.find(config => config.configurationName === 'shared-storage');
        const sharedStorageConfig2 = haConfigs6?.find(config => config.configurationName === 'shared-storage');

        expect(sharedStorageConfig1).toBeDefined();
        expect(sharedStorageConfig2).toBeDefined();
        expect(result3).toEqual({});
    });
    test('updateConfig should work with DismissConfigType enum for common', () => {
        const initial = {};
        const updated = updateConfig({
            currentConfigs: initial,
            configKey: 'maxDop',
            configType: DismissConfigType.Common,
            configurationName: 'maxdop',
            configState: 'DISMISSED',
            startTime: Date.now()
        });
        expect(updated.maxDop).toBeDefined();
        expect(updated.maxDop?.configurationName).toBe('maxdop');
        expect(updated.maxDop?.configState).toBe('DISMISSED');
    });

    test('updateConfig should work with DismissConfigType enum for storage', () => {
        const initial = {};
        const updated = updateConfig({
            currentConfigs: initial,
            configKey: 'sizing',
            configType: DismissConfigType.Storage,
            configurationName: 'sizing',
            configState: 'POSTPONED',
            startTime: Date.now()
        });
        expect(updated.storage?.sizing).toBeDefined();
        expect(Array.isArray(updated.storage?.sizing)).toBe(true);
        expect(updated.storage?.sizing?.[0]?.configurationName).toBe('sizing');
    });

    test('updateConfig should work with DismissConfigType enum for storageConfig', () => {
        const initial = {};
        const updated = updateConfig({
            currentConfigs: initial,
            configKey: 'volumes',
            configType: DismissConfigType.StorageConfig,
            configurationName: 'volumes',
            configState: 'DISMISSED',
            startTime: Date.now()
        });
        expect(updated.storage?.configuration?.volumes).toBeDefined();
        expect(Array.isArray(updated.storage?.configuration?.volumes)).toBe(true);
        expect(updated.storage?.configuration?.volumes?.[0]?.configurationName).toBe('volumes');
    });

    test('updateConfig should work with DismissConfigType enum for highAvailability', () => {
        const initial = {};
        const updated = updateConfig({
            currentConfigs: initial,
            configKey: 'heartbeatSettings',
            configType: DismissConfigType.HighAvailability,
            configurationName: 'heartbeat-settings',
            configState: 'DISMISSED',
            startTime: Date.now()
        });

        expect(updated.highAvailability).toBeDefined();
        const haConfigs7 = updated.highAvailability as InstanceDismissParams[];
        const heartbeatConfig = haConfigs7?.find(config => config.configurationName === 'heartbeat-settings');
        expect(heartbeatConfig).toBeDefined();
        expect(heartbeatConfig?.configurationName).toBe('heartbeat-settings');
    });

    test('getOrCreateGroup should create and retrieve host/instance groups with direct data', () => {
        const hostGroups = new Map<string, DismissHostGroup>();
        const instanceGroups = new Map<string, DismissInstanceGroup>();
        const hostKey = 'cred:region:host';
        const instanceKey = 'cred:region:host:instance';

        // Test host group creation with direct data
        const hostGroupData: DismissHostGroup = {
            credentialsId: 'cred',
            region: 'region',
            hostId: 'host',
            configs: []
        };
        const hostGroup = getOrCreateGroup(hostGroups, hostKey, hostGroupData);
        expect(hostGroups.get(hostKey)).toBe(hostGroup);
        expect(hostGroup.credentialsId).toBe('cred');
        expect(hostGroup.region).toBe('region');
        expect(hostGroup.hostId).toBe('host');
        expect(hostGroup.configs).toEqual([]);

        // Test instance group creation with direct data
        const instanceGroupData: DismissInstanceGroup = {
            credentialsId: 'cred',
            region: 'region',
            hostId: 'host',
            instanceId: 'instance',
            configs: []
        };
        const instanceGroup = getOrCreateGroup(instanceGroups, instanceKey, instanceGroupData);
        expect(instanceGroups.get(instanceKey)).toBe(instanceGroup);
        expect(instanceGroup.credentialsId).toBe('cred');
        expect(instanceGroup.region).toBe('region');
        expect(instanceGroup.hostId).toBe('host');
        expect(instanceGroup.instanceId).toBe('instance');
        expect(instanceGroup.configs).toEqual([]);
    });

    test('getOrCreateGroup should return existing group when key already exists', () => {
        const groups = new Map<string, DismissHostGroup>();
        const groupKey = 'existing-key';

        // Create initial group
        const initialGroupData: DismissHostGroup = {
            credentialsId: 'initial-cred',
            region: 'initial-region',
            hostId: 'initial-host',
            configs: [
                {
                    configName: 'test',
                    configState: 'DISMISSED',
                    startTime: Date.now(),
                    endTime: Date.now() + 1000,
                    originalConfigIndex: 0
                }
            ]
        };
        const initialGroup = getOrCreateGroup(groups, groupKey, initialGroupData);

        // Try to create with different data - should return existing group
        const newGroupData: DismissHostGroup = {
            credentialsId: 'new-cred',
            region: 'new-region',
            hostId: 'new-host',
            configs: []
        };
        const retrievedGroup = getOrCreateGroup(groups, groupKey, newGroupData);

        expect(retrievedGroup).toBe(initialGroup);
        expect(retrievedGroup.credentialsId).toBe('initial-cred'); // Should keep original data
        expect(retrievedGroup.configs).toHaveLength(1); // Should keep original configs
        expect(groups.size).toBe(1); // Should only have one group
    });

    test('getOrCreateGroup should work with generic types', () => {
        interface TestGroup {
            id: string;
            name: string;
            items: string[];
        }

        const testGroups = new Map<string, TestGroup>();
        const testKey = 'test-key';
        const testData: TestGroup = {
            id: 'test-id',
            name: 'test-name',
            items: ['item1', 'item2']
        };

        const group = getOrCreateGroup(testGroups, testKey, testData);
        expect(group).toBe(testData);
        expect(testGroups.get(testKey)).toBe(testData);
        expect(group.id).toBe('test-id');
        expect(group.name).toBe('test-name');
        expect(group.items).toEqual(['item1', 'item2']);
    });

    describe('formatDismissConfigurations', () => {
        const mockCurrentConfigs = {};
        const currentTime = Date.now();

        it('should format common assessment configuration (compute)', async () => {
            const newConfigs = {
                configurationName: 'compute-rightsizing',
                startTime: currentTime,
                configState: 'DISMISSED',
                endTime: undefined
            };

            const result = await formatDismissConfigurations(mockCurrentConfigs, newConfigs);

            expect(result).toEqual({
                compute: {
                    configurationName: 'compute-rightsizing',
                    startTime: currentTime,
                    configState: 'DISMISSED',
                    endTime: undefined,
                    reactivationReason: undefined
                }
            });
        });

        it('should format license assessment configuration', async () => {
            const newConfigs = {
                configurationName: 'sql-license',
                startTime: currentTime,
                configState: 'POSTPONED',
                endTime: currentTime + 30 * 24 * 60 * 60 * 1000 // 30 days later
            };

            const result = await formatDismissConfigurations(mockCurrentConfigs, newConfigs);

            expect(result).toEqual({
                license: {
                    configurationName: 'sql-license',
                    startTime: currentTime,
                    configState: 'POSTPONED',
                    endTime: currentTime + 30 * 24 * 60 * 60 * 1000,
                    reactivationReason: undefined
                }
            });
        });

        it('should format high availability sub-configuration', async () => {
            const newConfigs = {
                configurationName: 'heartbeat-settings',
                startTime: currentTime,
                configState: 'DISMISSED',
                endTime: undefined
            };

            const result = await formatDismissConfigurations(mockCurrentConfigs, newConfigs);

            expect(result).toEqual({
                highAvailability: [
                    {
                        configurationName: 'heartbeat-settings',
                        startTime: currentTime,
                        configState: 'DISMISSED',
                        endTime: undefined,
                        reactivationReason: undefined
                    }
                ]
            });
        });

        it('should format storage assessment configuration', async () => {
            const newConfigs = {
                configurationName: 'performance-tier',
                startTime: currentTime,
                configState: 'ACTIVE',
                endTime: undefined
            };

            const result = await formatDismissConfigurations(mockCurrentConfigs, newConfigs);

            expect(result).toEqual({
                storage: {
                    sizing: [
                        {
                            configurationName: 'performance-tier',
                            startTime: currentTime,
                            configState: 'ACTIVATING',
                            endTime: undefined,
                            reactivationReason: 'USER'
                        }
                    ]
                }
            });
        });

        it('should format storage configuration assessment', async () => {
            const newConfigs = {
                configurationName: 'thin-provision',
                startTime: currentTime,
                configState: 'DISMISSED',
                endTime: undefined
            };

            const result = await formatDismissConfigurations(mockCurrentConfigs, newConfigs);

            expect(result).toEqual({
                storage: {
                    configuration: {
                        volumes: [
                            {
                                configurationName: 'thin-provision',
                                startTime: currentTime,
                                configState: 'DISMISSED',
                                endTime: undefined,
                                reactivationReason: undefined
                            }
                        ]
                    }
                }
            });
        });

        it('should merge with existing configurations', async () => {
            const existingConfigs = {
                compute: {
                    configurationName: 'compute-rightsizing',
                    startTime: currentTime - 1000,
                    configState: 'DISMISSED',
                    endTime: undefined,
                    reactivationReason: undefined
                }
            };

            const newConfigs = {
                configurationName: 'sql-license',
                startTime: currentTime,
                configState: 'POSTPONED',
                endTime: currentTime + 30 * 24 * 60 * 60 * 1000
            };

            const result = await formatDismissConfigurations(existingConfigs, newConfigs);

            expect(result).toEqual({
                compute: {
                    configurationName: 'compute-rightsizing',
                    startTime: currentTime - 1000,
                    configState: 'DISMISSED',
                    endTime: undefined,
                    reactivationReason: undefined
                },
                license: {
                    configurationName: 'sql-license',
                    startTime: currentTime,
                    configState: 'POSTPONED',
                    endTime: currentTime + 30 * 24 * 60 * 60 * 1000,
                    reactivationReason: undefined
                }
            });
        });

        it('should handle ACTIVATING state properly', async () => {
            const newConfigs = {
                configurationName: 'maxdop',
                startTime: currentTime,
                configState: 'ACTIVATING',
                endTime: undefined
            };

            const result = await formatDismissConfigurations(mockCurrentConfigs, newConfigs);

            expect(result).toEqual({
                maxDOP: {
                    configurationName: 'maxdop',
                    startTime: currentTime,
                    configState: 'ACTIVATING',
                    endTime: undefined,
                    reactivationReason: 'USER'
                }
            });
        });

        it('should throw error for unknown configuration name', async () => {
            const newConfigs = {
                configurationName: 'unknown-config',
                startTime: currentTime,
                configState: 'DISMISSED',
                endTime: undefined
            };

            await expect(formatDismissConfigurations(mockCurrentConfigs, newConfigs)).rejects.toThrow(
                'No matching key found for the configuration name: unknown-config'
            );
        });

        it('should update existing storage configurations array', async () => {
            const existingConfigs = {
                storage: {
                    sizing: [
                        {
                            configurationName: 'performance-tier',
                            startTime: currentTime - 1000,
                            configState: 'POSTPONED',
                            endTime: currentTime + 1000,
                            reactivationReason: undefined
                        }
                    ]
                }
            };

            const newConfigs = {
                configurationName: 'performance-tier',
                startTime: currentTime,
                configState: 'DISMISSED',
                endTime: undefined
            };

            const result = await formatDismissConfigurations(existingConfigs, newConfigs);

            expect(result.storage?.sizing).toHaveLength(1);
            expect(result.storage?.sizing?.[0]).toEqual({
                configurationName: 'performance-tier',
                startTime: currentTime,
                configState: 'DISMISSED',
                endTime: undefined,
                reactivationReason: undefined
            });
        });
    });
});
