import { describe, it, expect, vi } from 'vitest';
import { DBType } from '../../../utils/consts';

// ── Mock store & adjacent modules so GetWellUtils.ts can be imported in isolation ──
const { mockGetState, mockDispatch } = vi.hoisted(() => ({
    mockGetState: vi.fn(),
    mockDispatch: vi.fn()
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
    getRecommendation: vi.fn()
}));

vi.mock('../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setCardData: vi.fn(),
    setCloneDashboardData: vi.fn(),
    setCloneIsOptimizedRows: vi.fn(),
    setDriftAssessmentData: vi.fn(),
    setGwRefreshTimestamp: vi.fn(),
    setGwTimestamp: vi.fn(),
    setInProgressHostData: vi.fn(),
    setInProgressOptimizationData: vi.fn(),
    setInProgressResourceOptimizeData: vi.fn(),
    setIsInnerPageOptimize: vi.fn(),
    setOptimizationBreakDown: vi.fn(),
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
    setInstanceDetailsData: vi.fn()
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

// eslint-disable-next-line import/first
import { updateFlatAssessmentStatus } from '../GetWellUtils';

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
