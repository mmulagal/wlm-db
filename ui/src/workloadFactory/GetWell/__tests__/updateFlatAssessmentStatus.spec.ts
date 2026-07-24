import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBType, CONFIG_STATES, GETWELL_STATUS } from '../../../utils/consts';

// ── Mock store & adjacent modules so GetWellUtils.ts can be imported in isolation ──
const { mockGetState, mockDispatch, mockGetRecommendation } = vi.hoisted(() => ({
    mockGetState: vi.fn(),
    mockDispatch: vi.fn(),
    mockGetRecommendation: vi.fn()
}));

vi.mock('../../../store/store', () => ({
    default: { getState: mockGetState, dispatch: mockDispatch }
}));

vi.mock('../../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { SUCCESS: 'SUCCESS', INFO: 'INFO', ERROR: 'ERROR' },
    addNotification: vi.fn((payload: any) => ({ type: 'addNotification', payload }))
}));

vi.mock('../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedConfigSummary: vi.fn()
}));

vi.mock('../../../utils/recommendations', () => ({
    getRecommendation: mockGetRecommendation
}));

vi.mock('../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setCardData: vi.fn((payload: any) => ({ type: 'setCardData', payload })),
    setCloneDashboardData: vi.fn(),
    setCloneIsOptimizedRows: vi.fn(),
    setDriftAssessmentData: vi.fn((payload: any) => ({ type: 'setDriftAssessmentData', payload })),
    setGwRefreshTimestamp: vi.fn((payload: any) => ({ type: 'setGwRefreshTimestamp', payload })),
    setGwTimestamp: vi.fn((payload: any) => ({ type: 'setGwTimestamp', payload })),
    setInProgressHostData: vi.fn(),
    setInProgressOptimizationData: vi.fn(),
    setInProgressResourceOptimizeData: vi.fn(),
    setIsInnerPageOptimize: vi.fn(),
    setOptimizationBreakDown: vi.fn((payload: any) => ({ type: 'setOptimizationBreakDown', payload })),
    setOptimizingData: vi.fn(),
    setOptimizingInstanceData: vi.fn(),
    setGwRefreshPage: vi.fn()
}));

vi.mock('../../../store/workloadFactory/oracleSlice', () => ({
    setRefreshOracleWellArchitect: vi.fn()
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    addAllMssqlHostAssessmentData: vi.fn((payload: any) => ({ type: 'addAllMssqlHostAssessmentData', payload })),
    addAllOracleHostAssessmentData: vi.fn((payload: any) => ({ type: 'addAllOracleHostAssessmentData', payload })),
    setSelectedHeaderTab: vi.fn()
}));

vi.mock('../../../store/workloadFactory/workloadFactoryResourceSlice', () => ({
    setInstanceDetailsData: vi.fn((payload: any) => ({ type: 'setInstanceDetailsData', payload }))
}));

vi.mock('../../DatabaseHomePage/DatabaseHomeUtils', () => ({
    isOptimized: vi.fn()
}));

vi.mock('../../WellArchitectedTab/assessmentFormatUtils', () => ({
    getConfigSeverity: vi.fn(),
    getConfigStateList: vi.fn(),
    getConfigStatsBucket: vi.fn(),
    hasConfigStats: vi.fn(),
    resolveConfigDisplayName: vi.fn()
}));

vi.mock('../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils', () => ({
    formatOracleWellArchitectedData: vi.fn()
}));

vi.mock('../../../utils/configRegistry', () => ({
    sortConfigsByPriority: vi.fn()
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatDateWithTime: vi.fn((timestamp: any) => `formatted-${timestamp}`),
    formatNumberWithCustomComma: vi.fn((num: any) => String(num))
}));

// eslint-disable-next-line import/first
import {
    updateFlatAssessmentStatus,
    formatFlatAssessments,
    formatGetWellDataFlat,
    groupConfigurationsByCategory
} from '../GetWellUtils';

const baseRow = {
    id: 'maxdop',
    name: 'MAXDOP',
    hostId: 'host1',
    credentialId: 'cred1',
    regionId: 'us-east-1',
    instanceId: 'inst1'
};

const makeHostData = (assessmentItems: any[]) => [
    {
        databaseHostId: 'host1',
        credentialId: 'cred1',
        regionId: 'us-east-1',
        instancesAssessment: [
            {
                databaseInstanceId: 'inst1',
                assessments: {
                    assessments: assessmentItems
                }
            }
        ]
    }
];

describe('updateFlatAssessmentStatus', () => {
    it('marks the matching flat assessment item as optimized', () => {
        const dispatch = vi.fn();
        mockGetState.mockReturnValue({
            inventoryV2: { allmssqlHostAssessmentData: makeHostData([{ id: 'maxdop', status: 'not-optimized' }]) },
            getWellOptimize: {}
        });

        updateFlatAssessmentStatus(baseRow, dispatch, DBType.MSSQL);

        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'addAllMssqlHostAssessmentData' }));
        const { payload } = dispatch.mock.calls[0][0];
        const updatedItem = payload[0].instancesAssessment[0].assessments.assessments[0];
        expect(updatedItem.status).toBe('optimized');
    });

    it('only updates the row matching hostId/credentialId/regionId/instanceId, leaving others untouched', () => {
        const dispatch = vi.fn();
        const otherHost = {
            databaseHostId: 'host2',
            credentialId: 'cred1',
            regionId: 'us-east-1',
            instancesAssessment: [
                {
                    databaseInstanceId: 'inst2',
                    assessments: { assessments: [{ id: 'maxdop', status: 'not-optimized' }] }
                }
            ]
        };
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: [...makeHostData([{ id: 'maxdop', status: 'not-optimized' }]), otherHost]
            },
            getWellOptimize: {}
        });

        updateFlatAssessmentStatus(baseRow, dispatch, DBType.MSSQL);

        const { payload } = dispatch.mock.calls[0][0];
        expect(payload[0].instancesAssessment[0].assessments.assessments[0].status).toBe('optimized');
        expect(payload[1].instancesAssessment[0].assessments.assessments[0].status).toBe('not-optimized');
    });

    it('supports bulk-style sequential calls across multiple instances (Dashboard bulk fix)', () => {
        const dispatch = vi.fn();
        const rowInstance1 = { ...baseRow, instanceId: 'inst1' };
        const rowInstance2 = { ...baseRow, hostId: 'host2', instanceId: 'inst2' };
        const hostData = [
            ...makeHostData([{ id: 'maxdop', status: 'not-optimized' }]),
            {
                databaseHostId: 'host2',
                credentialId: 'cred1',
                regionId: 'us-east-1',
                instancesAssessment: [
                    {
                        databaseInstanceId: 'inst2',
                        assessments: { assessments: [{ id: 'maxdop', status: 'not-optimized' }] }
                    }
                ]
            }
        ];
        mockGetState.mockReturnValue({ inventoryV2: { allmssqlHostAssessmentData: hostData }, getWellOptimize: {} });

        // Simulates the bulkRowData?.map((row) => updateFlatAssessmentStatus(row, dispatch, engineType)) call site.
        [rowInstance1, rowInstance2].forEach(row => {
            const latest = mockGetState().inventoryV2.allmssqlHostAssessmentData;
            mockGetState.mockReturnValue({ inventoryV2: { allmssqlHostAssessmentData: latest }, getWellOptimize: {} });
            updateFlatAssessmentStatus(row, dispatch, DBType.MSSQL);
            const { payload } = dispatch.mock.calls[dispatch.mock.calls.length - 1][0];
            mockGetState.mockReturnValue({ inventoryV2: { allmssqlHostAssessmentData: payload }, getWellOptimize: {} });
        });

        const finalData = mockGetState().inventoryV2.allmssqlHostAssessmentData;
        expect(finalData[0].instancesAssessment[0].assessments.assessments[0].status).toBe('optimized');
        expect(finalData[1].instancesAssessment[0].assessments.assessments[0].status).toBe('optimized');
    });

    it('marks clone-management as optimized when no other violations remain for the instance', () => {
        const dispatch = vi.fn();
        const cloneRow = { ...baseRow, id: 'clone-management', name: 'Clone cleanup' };
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: makeHostData([{ id: 'clone-management', status: 'not-optimized' }])
            },
            getWellOptimize: {
                cloneDashboardData: {
                    objectsInViolation: [{ resourceId: 'host1', instanceId: 'inst1', isOptimized: true }]
                }
            }
        });

        updateFlatAssessmentStatus(cloneRow, dispatch, DBType.MSSQL);

        const { payload } = dispatch.mock.calls[0][0];
        expect(payload[0].instancesAssessment[0].assessments.assessments[0].status).toBe('optimized');
    });

    it('keeps clone-management not-optimized when other clone objects for the instance are still unresolved', () => {
        const dispatch = vi.fn();
        const cloneRow = { ...baseRow, id: 'clone-management', name: 'Clone cleanup' };
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: makeHostData([{ id: 'clone-management', status: 'not-optimized' }])
            },
            getWellOptimize: {
                cloneDashboardData: {
                    objectsInViolation: [{ resourceId: 'host1', instanceId: 'inst1', isOptimized: false }]
                }
            }
        });

        updateFlatAssessmentStatus(cloneRow, dispatch, DBType.MSSQL);

        const { payload } = dispatch.mock.calls[0][0];
        expect(payload[0].instancesAssessment[0].assessments.assessments[0].status).toBe('not-optimized');
    });

    it('matches the flat clone-management item even though CloneTabs rows carry id: "clone" (the API payload configurationName)', () => {
        // CloneTabs.getBulkInstanceList sets id to the request payload's configurationName ('clone'),
        // not the 'clone-management' id used in the flat assessments[] array; only rowData.name
        // ('Clone cleanup') identifies it as clone-management.
        const dispatch = vi.fn();
        const cloneRow = { ...baseRow, id: 'clone', name: 'Clone cleanup' };
        mockGetState.mockReturnValue({
            inventoryV2: {
                allmssqlHostAssessmentData: makeHostData([{ id: 'clone-management', status: 'not-optimized' }])
            },
            getWellOptimize: {
                cloneDashboardData: {
                    objectsInViolation: [{ resourceId: 'host1', instanceId: 'inst1', isOptimized: true }]
                }
            }
        });

        updateFlatAssessmentStatus(cloneRow, dispatch, DBType.MSSQL);

        const { payload } = dispatch.mock.calls[0][0];
        expect(payload[0].instancesAssessment[0].assessments.assessments[0].status).toBe('optimized');
    });

    it('writes to allOracleHostAssessmentData when engineType is ORACLE', () => {
        const dispatch = vi.fn();
        mockGetState.mockReturnValue({
            inventoryV2: { allOracleHostAssessmentData: makeHostData([{ id: 'headroom', status: 'not-optimized' }]) },
            getWellOptimize: {}
        });

        updateFlatAssessmentStatus({ ...baseRow, id: 'headroom' }, dispatch, DBType.ORACLE);

        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'addAllOracleHostAssessmentData' }));
        const { payload } = dispatch.mock.calls[0][0];
        expect(payload[0].instancesAssessment[0].assessments.assessments[0].status).toBe('optimized');
    });
});

describe('formatFlatAssessments', () => {
    const mockTranslation = (key: string) => key;

    beforeEach(() => {
        mockGetRecommendation.mockReset();
    });

    it('formats a basic flat assessment into cardData structure', () => {
        const flatData = {
            metadata: {
                deploymentType: 'standalone',
                baseDeploymentType: 'standalone',
                isWad: false
            },
            assessments: [
                {
                    id: 'thin-provisioning',
                    name: 'Thin Provisioning',
                    status: 'not-optimized',
                    severity: 'critical',
                    type: 'storage',
                    current: '10%',
                    resourceType: 'Volume',
                    totalObjectsInViolation: 2,
                    totalObjectsAssessed: 5,
                    recommendation: 'Enable thin provisioning'
                }
            ],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData).toBeDefined();
        expect(result.cardsData['thin-provisioning']).toBeDefined();
        expect(result.cardsData['thin-provisioning'].name).toBe('Thin Provisioning');
        expect(result.cardsData['thin-provisioning'].category).toBe('storage');
        expect(result.cardsData['thin-provisioning'].block_two.value).toBe('Not optimized');
        expect(result.cardsData['thin-provisioning'].block_four.value).toBe('Critical');
    });

    it('includes deployment metadata in cardData', () => {
        const flatData = {
            metadata: {
                deploymentType: 'aoag',
                baseDeploymentType: 'cluster',
                isWad: true
            },
            assessments: [],
            dismissedConfigurations: []
        };

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData.deploymentType).toBe('aoag');
        expect(result.cardsData.baseDeploymentType).toBe('cluster');
        expect(result.cardsData.isWad).toBe(true);
    });

    it('sets isUnregistered when metadata.source is unregistered', () => {
        const flatData = {
            metadata: {
                deploymentType: 'standalone',
                baseDeploymentType: 'standalone',
                isWad: false,
                source: 'unregistered'
            },
            assessments: [],
            dismissedConfigurations: []
        };

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData.isUnregistered).toBe(true);
        expect(result.cardsData.isWad).toBe(false);
    });

    it('adds dismissedObj when config is dismissed', () => {
        const flatData = {
            metadata: { deploymentType: 'standalone', isWad: false },
            assessments: [
                {
                    id: 'autosize',
                    name: 'Autosize',
                    status: 'not-optimized',
                    type: 'storage',
                    severity: 'warning'
                }
            ],
            dismissedConfigurations: [
                {
                    id: 'autosize',
                    name: 'Autosize',
                    configState: 'DISMISSED',
                    startTime: 1234567890,
                    endTime: 1234567899
                }
            ]
        };

        mockGetRecommendation.mockReturnValue(null);

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData.autosize.dismissedObj).toBeDefined();
        expect(result.cardsData.autosize.dismissedObj.configState).toBe(CONFIG_STATES.DISMISSED);
        expect(result.cardsData.autosize.dismissedObj.startTime).toBe(1234567890);
    });

    it('creates synthetic card for dismissed configs not in assessments', () => {
        const flatData = {
            metadata: { deploymentType: 'standalone', isWad: false },
            assessments: [],
            dismissedConfigurations: [
                {
                    id: 'snapshot-reserve',
                    name: 'Snapshot Reserve',
                    type: 'storage',
                    severity: 'warning',
                    configState: 'POSTPONED',
                    startTime: 1234567890,
                    endTime: 1234567899
                }
            ]
        };

        mockGetRecommendation.mockReturnValue(null);

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData['snapshot-reserve']).toBeDefined();
        expect(result.cardsData['snapshot-reserve'].name).toBe('Snapshot Reserve');
        expect(result.cardsData['snapshot-reserve'].dismissedObj).toBeDefined();
        expect(result.cardsData['snapshot-reserve'].dismissedObj.configState).toBe(CONFIG_STATES.POSTPONED);
    });

    it('preserves optimizing state from optimizingData parameter', () => {
        const flatData = {
            metadata: { deploymentType: 'standalone', isWad: false },
            assessments: [
                {
                    id: 'thin-provisioning',
                    name: 'Thin Provisioning',
                    status: 'not-optimized',
                    type: 'storage'
                }
            ],
            dismissedConfigurations: []
        };

        const optimizingData = {
            'thin-provisioning': 'optimizing'
        };

        mockGetRecommendation.mockReturnValue(null);

        const result = formatFlatAssessments(flatData, optimizingData, false, mockTranslation);

        expect(result.cardsData['thin-provisioning'].status).toBe('optimizing');
    });

    it('handles assessment with errorMessage', () => {
        const flatData = {
            metadata: { deploymentType: 'standalone', isWad: false },
            assessments: [
                {
                    id: 'compute-rightsizing',
                    name: 'Compute Rightsizing',
                    status: 'not-optimized',
                    type: 'compute',
                    errorMessage: 'CloudWatch is not authorized for this account'
                }
            ],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData['compute-rightsizing'].block_two.value).toBe('databases.general.unavailable');
        expect(result.cardsData['compute-rightsizing'].errorMessage).toBe(
            'CloudWatch is not authorized for this account'
        );
        expect(result.cardsData['compute-rightsizing'].isMissingPermissions).toBe(true);
    });

    it('formats patch objects for OS patch configuration', () => {
        const flatData = {
            metadata: { deploymentType: 'standalone', isWad: false },
            assessments: [
                {
                    id: 'host-os-patch',
                    name: 'Operating System Patch',
                    status: 'not-optimized',
                    type: 'resiliency',
                    ec2InstancesToPatch: [
                        { criticalNonCompliantCount: 2, securityNonCompliantCount: 3, otherNonCompliantCount: 1 },
                        { criticalNonCompliantCount: 1, securityNonCompliantCount: 2, otherNonCompliantCount: 0 }
                    ]
                }
            ],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData['host-os-patch'].osPatchMissingPatches).toEqual({
            critical: 3,
            security: 5,
            other: 1
        });
        expect(result.cardsData['host-os-patch'].block_six.value).toBe('9');
    });

    it('formats patch objects for SQL patch configuration', () => {
        const flatData = {
            metadata: { deploymentType: 'standalone', isWad: false },
            assessments: [
                {
                    id: 'mssql-patch',
                    name: 'Microsoft SQL Server Patch',
                    status: 'not-optimized',
                    type: 'resiliency',
                    missingPatchesInEc2Instances: [
                        { criticalMissingPatchesCount: 3, importantMissingPatchesCount: 2 },
                        { criticalMissingPatchesCount: 1, importantMissingPatchesCount: 4 }
                    ]
                }
            ],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData['mssql-patch'].sqlPatchMissingPatches).toEqual({
            critical: 4,
            important: 6,
            total: 10
        });
        expect(result.cardsData['mssql-patch'].block_six.value).toBe('10');
    });

    it('uses static recommendations over API recommendations', () => {
        const staticRec = {
            title: 'Static Recommendation',
            description: 'This is from UI config',
            descriptionList: ['Point 1', 'Point 2']
        };

        mockGetRecommendation.mockReturnValue(staticRec);

        const flatData = {
            metadata: { deploymentType: 'standalone', isWad: false },
            assessments: [
                {
                    id: 'thin-provisioning',
                    name: 'Thin Provisioning',
                    status: 'not-optimized',
                    type: 'storage',
                    recommendation: 'API recommendation'
                }
            ],
            dismissedConfigurations: []
        };

        const result = formatFlatAssessments(flatData, {}, false, mockTranslation);

        expect(result.cardsData['thin-provisioning'].recommendation.title).toBe('Static Recommendation');
        expect(result.cardsData['thin-provisioning'].recommendation.description).toBe('This is from UI config');
        expect(result.cardsData['thin-provisioning'].recommendationText).toBe('This is from UI config');
    });
});

describe('formatGetWellDataFlat', () => {
    const mockTranslation = (key: string) => key;

    beforeEach(() => {
        mockDispatch.mockClear();
        mockGetRecommendation.mockReset();
        mockGetState.mockReturnValue({
            getWellOptimize: { optimizingData: {} }
        });
    });

    it('dispatches cardData and optimization breakdown', () => {
        const flatData = {
            metadata: {
                deploymentType: 'standalone',
                lastAssessmentTimestamp: 1234567890
            },
            assessments: [
                {
                    id: 'thin-provisioning',
                    name: 'Thin Provisioning',
                    status: 'optimized',
                    type: 'storage',
                    severity: 'warning'
                }
            ],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        formatGetWellDataFlat(mockDispatch, flatData, false, false, false, mockTranslation);

        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setCardData' }));
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setOptimizationBreakDown' }));
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setGwTimestamp' }));
    });

    it('formats timestamp correctly when lastAssessmentTimestamp is valid', () => {
        const flatData = {
            metadata: { deploymentType: 'standalone', lastAssessmentTimestamp: 1234567890 },
            assessments: [],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        formatGetWellDataFlat(mockDispatch, flatData, false, false, false, mockTranslation);

        const timestampCalls = mockDispatch.mock.calls.filter((call: any) => call[0]?.type === 'setGwTimestamp');
        expect(timestampCalls[0][0].payload).toBe('formatted-1234567890');
    });

    it('formats timestamp as "0" when lastAssessmentTimestamp is 0', () => {
        const flatData = {
            metadata: { deploymentType: 'standalone', lastAssessmentTimestamp: 0 },
            assessments: [],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        formatGetWellDataFlat(mockDispatch, flatData, false, false, false, mockTranslation);

        const timestampCalls = mockDispatch.mock.calls.filter((call: any) => call[0]?.type === 'setGwTimestamp');
        expect(timestampCalls[0][0].payload).toBe('0');
    });

    it('dispatches instance details when deploymentType is present', () => {
        const flatData = {
            metadata: {
                deploymentType: 'aoag',
                baseDeploymentType: 'cluster',
                lastAssessmentTimestamp: 1234567890
            },
            assessments: [],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        formatGetWellDataFlat(mockDispatch, flatData, false, false, false, mockTranslation);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'setInstanceDetailsData',
                payload: {
                    deploymentType: 'aoag',
                    baseDeploymentType: 'cluster'
                }
            })
        );
    });

    it('handles undefined data gracefully', () => {
        formatGetWellDataFlat(mockDispatch, undefined, false, false, false, mockTranslation);

        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('uses empty optimizingData when isRefresh is true', () => {
        mockGetState.mockReturnValue({
            getWellOptimize: { optimizingData: { 'thin-provisioning': 'optimizing' } }
        });

        const flatData = {
            metadata: { deploymentType: 'standalone', lastAssessmentTimestamp: 1234567890 },
            assessments: [
                {
                    id: 'thin-provisioning',
                    name: 'Thin Provisioning',
                    status: 'not-optimized',
                    type: 'storage'
                }
            ],
            dismissedConfigurations: []
        };

        mockGetRecommendation.mockReturnValue(null);

        formatGetWellDataFlat(mockDispatch, flatData, false, true, false, mockTranslation);

        const cardDataCalls = mockDispatch.mock.calls.filter((call: any) => call[0]?.type === 'setCardData');
        expect(cardDataCalls[0][0].payload['thin-provisioning'].status).toBe('');
    });
});

describe('groupConfigurationsByCategory', () => {
    it('groups configurations by category', () => {
        const cardData = {
            'thin-provisioning': { category: 'storage', name: 'Thin Provisioning' },
            'compute-rightsizing': { category: 'compute', name: 'Compute Rightsizing' },
            autosize: { category: 'storage', name: 'Autosize' },
            maxdop: { category: 'application', name: 'MAXDOP' }
        };

        const result = groupConfigurationsByCategory(cardData);

        expect(result.storage).toHaveLength(2);
        expect(result.compute).toHaveLength(1);
        expect(result.application).toHaveLength(1);
        expect(result.resiliency).toHaveLength(0);
        expect(result.cloning).toHaveLength(0);
    });

    it('skips metadata fields', () => {
        const cardData = {
            deploymentType: 'standalone',
            baseDeploymentType: 'standalone',
            isWad: false,
            'thin-provisioning': { category: 'storage', name: 'Thin Provisioning' }
        };

        const result = groupConfigurationsByCategory(cardData);

        expect(result.storage).toHaveLength(1);
    });

    it('handles empty cardData', () => {
        const result = groupConfigurationsByCategory({});

        expect(result.storage).toEqual([]);
        expect(result.compute).toEqual([]);
        expect(result.application).toEqual([]);
        expect(result.resiliency).toEqual([]);
        expect(result.cloning).toEqual([]);
    });

    it('handles null/undefined cardData', () => {
        const result1 = groupConfigurationsByCategory(null);
        const result2 = groupConfigurationsByCategory(undefined);

        expect(result1.storage).toEqual([]);
        expect(result2.storage).toEqual([]);
    });

    it('includes key and config in grouped items', () => {
        const cardData = {
            'thin-provisioning': { category: 'storage', name: 'Thin Provisioning' }
        };

        const result = groupConfigurationsByCategory(cardData);

        expect(result.storage[0]).toEqual({
            key: 'thin-provisioning',
            config: { category: 'storage', name: 'Thin Provisioning' }
        });
    });

    it('handles configurations with mixed case categories', () => {
        const cardData = {
            config1: { category: 'Storage', name: 'Config 1' },
            config2: { category: 'COMPUTE', name: 'Config 2' },
            config3: { category: 'storage', name: 'Config 3' }
        };

        const result = groupConfigurationsByCategory(cardData);

        expect(result.storage).toHaveLength(2);
        expect(result.compute).toHaveLength(1);
    });
});
