import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { DatabaseTypes } from '../../../src/utils/consts';
import {
    updateDismissConfigurations,
    filterExpiredDismissConfigs
} from '../../../src/operations/continuous-optimization/assessment-dismiss-operations';
import { fetchMssqlDriftAssessment } from '../../../src/operations/continuous-optimization/mssql/assessment-operations';
import {
    createResource,
    deleteDatabaseInstance,
    deleteResource,
    upsertDatabaseInstance
} from '../../../src/lib/database/db';
import { DismissConfig } from '../../../src/utils/common-types';

describe('MSSQL Assessment Dismiss Operations', () => {
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
        const result = await updateDismissConfigurations(
            mockAccountId,
            mockConfigurations,
            DatabaseTypes.MS_SQL_SERVER
        );
        expect(result).toEqual({ dismissedConfigurations: mockResponse });
        await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, '6cbdabbfe3fb147e', [
            'non-existing-instance'
        ]);
        await deleteResource(ACCOUNT_ID, '6cbdabbfe3fb147e');
    });

    describe('High Availability Dismiss Configuration Tests', () => {
        const testResourceId = 'ha-test-resource';
        const testInstanceId = 'ha-test-instance';

        beforeEach(async () => {
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
            await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, testResourceId, [testInstanceId]);
            await deleteResource(ACCOUNT_ID, testResourceId);
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

            const result = await updateDismissConfigurations(
                ACCOUNT_ID,
                heartbeatDismissConfig,
                DatabaseTypes.MS_SQL_SERVER
            );
            expect(result.dismissedConfigurations).toHaveLength(1);
            expect(result.dismissedConfigurations[0].configurationName).toBe('heartbeat-settings');
            expect(result.dismissedConfigurations[0].configState).toBe('DISMISSED');

            const driftAssessment = await fetchMssqlDriftAssessment(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                testResourceId,
                testInstanceId
            );

            const haConfigs = driftAssessment.dismissedConfigurations ?? [];
            const heartbeatConfig = haConfigs.find(config => config.configurationName === 'heartbeat-settings');
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

            const result = await updateDismissConfigurations(
                ACCOUNT_ID,
                sharedStorageDismissConfig,
                DatabaseTypes.MS_SQL_SERVER
            );
            expect(result.dismissedConfigurations).toHaveLength(1);
            expect(result.dismissedConfigurations[0].configurationName).toBe('shared-storage');
            expect(result.dismissedConfigurations[0].configState).toBe('POSTPONED');
            expect(result.dismissedConfigurations[0].endTime).toBeDefined();
        });

        it('Should combine host and instance level configurations properly', async () => {
            await updateDismissConfigurations(
                ACCOUNT_ID,
                [
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
                ],
                DatabaseTypes.MS_SQL_SERVER
            );
            await updateDismissConfigurations(
                ACCOUNT_ID,
                [
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
                ],
                DatabaseTypes.MS_SQL_SERVER
            );

            const driftAssessment = await fetchMssqlDriftAssessment(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                testResourceId,
                testInstanceId
            );

            const { dismissedConfigurations } = driftAssessment;
            const foundHeartbeat = dismissedConfigurations?.find(c => c.configurationName === 'heartbeat-settings');
            const foundSharedStorage = dismissedConfigurations?.find(c => c.configurationName === 'shared-storage');

            expect(foundHeartbeat?.configState).toBe('DISMISSED');
            expect(foundSharedStorage?.configState).toBe('POSTPONED');

            const clusterQuorum = dismissedConfigurations?.find(c => c.configurationName === 'cluster-quorum');
            expect(clusterQuorum).toBeUndefined();
        });

        it('Should merge dismiss configurations correctly (flat arrays)', () => {
            const instanceConfigs: DismissConfig[] = [
                {
                    id: 'shared-storage',
                    configState: 'POSTPONED',
                    startTime: Date.now(),
                    endTime: Date.now() + 30 * 24 * 60 * 60 * 1000
                }
            ];
            const hostConfigs: DismissConfig[] = [
                { id: 'heartbeat-settings', configState: 'DISMISSED', startTime: Date.now() }
            ];

            const result = [...instanceConfigs, ...hostConfigs];

            expect(result).toHaveLength(2);
            expect(result.find(c => c.id === 'shared-storage')?.configState).toBe('POSTPONED');
            expect(result.find(c => c.id === 'heartbeat-settings')?.configState).toBe('DISMISSED');
        });

        it('filterExpiredDismissConfigs should return only DISMISSED and non-expired POSTPONED ids', () => {
            const now = Date.now();
            const configs: DismissConfig[] = [
                { id: 'crr', configState: 'DISMISSED', startTime: now },
                { id: 'maxdop', configState: 'POSTPONED', startTime: now, endTime: now + 30 * 24 * 60 * 60 * 1000 },
                { id: 'compute-rightsizing', configState: 'ACTIVE', startTime: now },
                { id: 'sql-license', configState: 'ACTIVATING', startTime: now },
                { id: 'thin-provision', configState: 'POSTPONED', startTime: now - 1000, endTime: now - 100 }
            ];

            const { dismissedIds } = filterExpiredDismissConfigs(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                testResourceId,
                configs,
                []
            );

            expect(dismissedIds.has('crr')).toBe(true);
            expect(dismissedIds.has('maxdop')).toBe(true);
            expect(dismissedIds.has('compute-rightsizing')).toBe(false);
            expect(dismissedIds.has('sql-license')).toBe(false);
            expect(dismissedIds.has('thin-provision')).toBe(false); // expired
        });
    });

    describe('Database-type-specific dismiss id validation', () => {
        const mockHost = {
            id: 'host-id',
            sqlServerInstances: ['instance-id'],
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION
        };

        it('should reject MSSQL-only configuration ids on Oracle dismiss', async () => {
            const result = await updateDismissConfigurations(
                ACCOUNT_ID,
                [
                    {
                        configurationName: 'maxdop',
                        configState: 'DISMISSED',
                        databaseHosts: [mockHost]
                    }
                ],
                DatabaseTypes.ORACLE
            );

            expect(result.dismissedConfigurations[0].databaseHosts[0].status).toBe('FAILED');
            expect(result.dismissedConfigurations[0].databaseHosts[0].failedInstances?.[0].errorMessage).toContain(
                'maxdop'
            );
        });

        it('should reject Oracle-only configuration ids on MSSQL dismiss', async () => {
            const result = await updateDismissConfigurations(
                ACCOUNT_ID,
                [
                    {
                        configurationName: 'oracle-security-patch',
                        configState: 'DISMISSED',
                        databaseHosts: [mockHost]
                    }
                ],
                DatabaseTypes.MS_SQL_SERVER
            );

            expect(result.dismissedConfigurations[0].databaseHosts[0].status).toBe('FAILED');
            expect(result.dismissedConfigurations[0].databaseHosts[0].failedInstances?.[0].errorMessage).toContain(
                'oracle-security-patch'
            );
        });
    });
});
