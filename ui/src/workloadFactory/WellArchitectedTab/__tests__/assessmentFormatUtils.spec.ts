import { describe, it, expect, vi } from 'vitest';
import {
    getAssessmentMetadata,
    getAssessmentItemSource,
    isOfflineAssessmentItem,
    isUnregisteredAssessmentItem,
    getLastAssessmentTimestamp,
    hasAssessmentTimestamp,
    getAssessmentItems,
    getAssessmentById,
    findFlatConfigItem,
    getDismissedConfigurations,
    getDismissedConfig,
    mapAssessmentSeverityToFilterLabel,
    createDashboardTableConfig,
    getConfigSeverity,
    hasConfigStats,
    getConfigStatsBucket,
    getConfigStateList,
    resolveConfigDisplayName,
    isNotApplicableStatus,
    isFixDisabledAssessmentStatus,
    isExcludedFromOptimizationCountForCard,
    isExcludedFromOptimizationCountForAssessment
} from '../assessmentFormatUtils';
import { GETWELL_DISPLAY, DBType } from '../../../utils/consts';

vi.mock('../../../utils/consts', () => ({
    GETWELL_STATUS: {
        CRITICAL: 'Critical',
        WARNING: 'Warning',
        NOT_APPLICABLE: 'not-applicable'
    },
    GETWELL_DISPLAY: {
        NOT_APPLICABLE: 'Not applicable',
        UNAVAILABLE: 'Unavailable'
    },
    WELL_ARCHITECTED_STATUS: {
        NOT_APPLICABLE: 'not-applicable',
        NOT_AVAILABLE: 'not-available'
    },
    ASSESSMENT_METADATA_SOURCE: {
        OFFLINE: 'offline',
        UNREGISTERED: 'unregistered',
        REGISTERED: 'registered'
    },
    CONFIG_NAMES: {
        'thin-provisioning': 'Thin Provisioning',
        autosize: 'Autosize',
        'compute-rightsizing': 'Compute Rightsizing'
    },
    DBType: {
        MSSQL: 'MSSQL',
        ORACLE: 'ORACLE'
    }
}));

describe('assessmentFormatUtils', () => {
    describe('getAssessmentItemSource', () => {
        it('reads source from assessments.metadata', () => {
            expect(
                getAssessmentItemSource({
                    assessments: { metadata: { source: 'unregistered' } }
                })
            ).toBe('unregistered');
        });

        it('returns empty string when metadata is missing', () => {
            expect(getAssessmentItemSource({ assessments: {} })).toBe('');
        });
    });

    describe('isOfflineAssessmentItem / isUnregisteredAssessmentItem', () => {
        it('classifies offline and unregistered sources', () => {
            const offline = { assessments: { metadata: { source: 'offline' } } };
            const unregistered = { assessments: { metadata: { source: 'unregistered' } } };
            const missing = { assessments: { metadata: {} } };

            expect(isOfflineAssessmentItem(offline)).toBe(true);
            expect(isUnregisteredAssessmentItem(offline)).toBe(false);
            expect(isOfflineAssessmentItem(unregistered)).toBe(false);
            expect(isUnregisteredAssessmentItem(unregistered)).toBe(true);
            expect(isOfflineAssessmentItem(missing)).toBe(true);
        });
    });

    describe('getAssessmentMetadata', () => {
        it('returns empty object when instanceAssessments is null', () => {
            const result = getAssessmentMetadata(null);
            expect(result).toEqual({});
        });

        it('returns empty object when instanceAssessments is undefined', () => {
            const result = getAssessmentMetadata(undefined);
            expect(result).toEqual({});
        });

        it('returns metadata when present', () => {
            const instanceAssessments: any = {
                metadata: {
                    lastAssessmentTimestamp: 1234567890,
                    deploymentType: 'standalone'
                }
            };
            const result = getAssessmentMetadata(instanceAssessments);
            expect(result).toEqual({
                lastAssessmentTimestamp: 1234567890,
                deploymentType: 'standalone'
            });
        });

        it('returns empty object when metadata is missing', () => {
            const instanceAssessments: any = {};
            const result = getAssessmentMetadata(instanceAssessments);
            expect(result).toEqual({});
        });
    });

    describe('getLastAssessmentTimestamp', () => {
        it('returns undefined when instanceAssessments is null', () => {
            const result = getLastAssessmentTimestamp(null);
            expect(result).toBeUndefined();
        });

        it('returns timestamp when present in metadata', () => {
            const instanceAssessments: any = {
                metadata: { lastAssessmentTimestamp: 1234567890 }
            };
            const result = getLastAssessmentTimestamp(instanceAssessments);
            expect(result).toBe(1234567890);
        });

        it('returns undefined when metadata has no timestamp', () => {
            const instanceAssessments: any = {
                metadata: { deploymentType: 'standalone' }
            };
            const result = getLastAssessmentTimestamp(instanceAssessments);
            expect(result).toBeUndefined();
        });
    });

    describe('hasAssessmentTimestamp', () => {
        it('returns false when instanceAssessments is null', () => {
            const result = hasAssessmentTimestamp(null);
            expect(result).toBe(false);
        });

        it('returns false when timestamp is missing', () => {
            const instanceAssessments: any = {
                metadata: {}
            };
            const result = hasAssessmentTimestamp(instanceAssessments);
            expect(result).toBe(false);
        });

        it('returns true when timestamp is present', () => {
            const instanceAssessments: any = {
                metadata: { lastAssessmentTimestamp: 1234567890 }
            };
            const result = hasAssessmentTimestamp(instanceAssessments);
            expect(result).toBe(true);
        });

        it('returns false when timestamp is 0', () => {
            const instanceAssessments: any = {
                metadata: { lastAssessmentTimestamp: 0 }
            };
            const result = hasAssessmentTimestamp(instanceAssessments);
            expect(result).toBe(false);
        });
    });

    describe('getAssessmentItems', () => {
        const sampleAssessments: any = {
            assessments: [
                { id: 'thin-provisioning', type: 'storage', subType: 'volume' },
                { id: 'autosize', type: 'storage', subType: 'volume' },
                { id: 'compute-rightsizing', type: 'compute', subType: 'instance' }
            ]
        };

        it('returns empty array when instanceAssessments is null', () => {
            const result = getAssessmentItems(null);
            expect(result).toEqual([]);
        });

        it('returns empty array when assessments is not an array', () => {
            const instanceAssessments: any = { assessments: 'not-an-array' };
            const result = getAssessmentItems(instanceAssessments);
            expect(result).toEqual([]);
        });

        it('returns all assessment items when no filter provided', () => {
            const result = getAssessmentItems(sampleAssessments);
            expect(result).toHaveLength(3);
        });

        it('filters by id', () => {
            const result = getAssessmentItems(sampleAssessments, { id: 'autosize' });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('autosize');
        });

        it('filters by type', () => {
            const result = getAssessmentItems(sampleAssessments, { type: 'storage' });
            expect(result).toHaveLength(2);
        });

        it('filters by subType', () => {
            const result = getAssessmentItems(sampleAssessments, { subType: 'instance' });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('compute-rightsizing');
        });

        it('filters by multiple criteria', () => {
            const result = getAssessmentItems(sampleAssessments, { type: 'storage', subType: 'volume' });
            expect(result).toHaveLength(2);
        });

        it('returns empty array when no items match filter', () => {
            const result = getAssessmentItems(sampleAssessments, { id: 'non-existent' });
            expect(result).toEqual([]);
        });
    });

    describe('getAssessmentById', () => {
        it('returns undefined when instanceAssessments is null', () => {
            const result = getAssessmentById(null, 'thin-provisioning');
            expect(result).toBeUndefined();
        });

        it('returns matching assessment item', () => {
            const instanceAssessments: any = {
                assessments: [
                    { id: 'thin-provisioning', name: 'Thin Provisioning' },
                    { id: 'autosize', name: 'Autosize' }
                ]
            };
            const result = getAssessmentById(instanceAssessments, 'autosize');
            expect(result).toBeDefined();
            expect(result?.id).toBe('autosize');
        });

        it('returns undefined when id not found', () => {
            const instanceAssessments: any = {
                assessments: [{ id: 'thin-provisioning', name: 'Thin Provisioning' }]
            };
            const result = getAssessmentById(instanceAssessments, 'non-existent');
            expect(result).toBeUndefined();
        });
    });

    describe('findFlatConfigItem', () => {
        const sampleHosts: any[] = [
            {
                instancesAssessment: [
                    {
                        assessments: {
                            assessments: [
                                { id: 'thin-provisioning', name: 'Thin Provisioning' },
                                { id: 'autosize', name: 'Autosize' }
                            ]
                        }
                    }
                ]
            },
            {
                instancesAssessment: [
                    {
                        assessments: {
                            assessments: [{ id: 'compute-rightsizing', name: 'Compute Rightsizing' }]
                        }
                    }
                ]
            }
        ];

        it('returns undefined when hosts is null', () => {
            const result = findFlatConfigItem(null, 'thin-provisioning');
            expect(result).toBeUndefined();
        });

        it('returns undefined when hosts is undefined', () => {
            const result = findFlatConfigItem(undefined, 'thin-provisioning');
            expect(result).toBeUndefined();
        });

        it('finds config item in first host', () => {
            const result = findFlatConfigItem(sampleHosts, 'thin-provisioning');
            expect(result).toBeDefined();
            expect(result?.id).toBe('thin-provisioning');
        });

        it('finds config item in second host', () => {
            const result = findFlatConfigItem(sampleHosts, 'compute-rightsizing');
            expect(result).toBeDefined();
            expect(result?.id).toBe('compute-rightsizing');
        });

        it('returns undefined when config not found', () => {
            const result = findFlatConfigItem(sampleHosts, 'non-existent');
            expect(result).toBeUndefined();
        });

        it('handles empty hosts array', () => {
            const result = findFlatConfigItem([], 'thin-provisioning');
            expect(result).toBeUndefined();
        });

        it('handles hosts with no instancesAssessment', () => {
            const hostsWithoutInstances: any[] = [{}];
            const result = findFlatConfigItem(hostsWithoutInstances, 'thin-provisioning');
            expect(result).toBeUndefined();
        });
    });

    describe('getDismissedConfigurations', () => {
        it('returns empty array when instanceAssessments is null', () => {
            const result = getDismissedConfigurations(null);
            expect(result).toEqual([]);
        });

        it('returns empty array when dismissedConfigurations is not an array', () => {
            const instanceAssessments: any = {
                dismissedConfigurations: 'not-an-array'
            };
            const result = getDismissedConfigurations(instanceAssessments);
            expect(result).toEqual([]);
        });

        it('returns dismissed configurations array', () => {
            const instanceAssessments: any = {
                dismissedConfigurations: [
                    { id: 'autosize', configState: 'DISMISSED' },
                    { id: 'snapshot-reserve', configState: 'POSTPONED' }
                ]
            };
            const result = getDismissedConfigurations(instanceAssessments);
            expect(result).toHaveLength(2);
        });

        it('returns empty array when dismissedConfigurations is missing', () => {
            const instanceAssessments: any = {};
            const result = getDismissedConfigurations(instanceAssessments);
            expect(result).toEqual([]);
        });
    });

    describe('getDismissedConfig', () => {
        it('returns undefined when instanceAssessments is null', () => {
            const result = getDismissedConfig(null, 'autosize');
            expect(result).toBeUndefined();
        });

        it('returns matching dismissed config', () => {
            const instanceAssessments: any = {
                dismissedConfigurations: [
                    { id: 'autosize', configState: 'DISMISSED' },
                    { id: 'snapshot-reserve', configState: 'POSTPONED' }
                ]
            };
            const result = getDismissedConfig(instanceAssessments, 'snapshot-reserve');
            expect(result).toBeDefined();
            expect(result?.id).toBe('snapshot-reserve');
        });

        it('returns undefined when config not found', () => {
            const instanceAssessments: any = {
                dismissedConfigurations: [{ id: 'autosize', configState: 'DISMISSED' }]
            };
            const result = getDismissedConfig(instanceAssessments, 'non-existent');
            expect(result).toBeUndefined();
        });
    });

    describe('mapAssessmentSeverityToFilterLabel', () => {
        it('maps critical severity', () => {
            expect(mapAssessmentSeverityToFilterLabel('critical')).toBe('Critical');
            expect(mapAssessmentSeverityToFilterLabel('Critical')).toBe('Critical');
            expect(mapAssessmentSeverityToFilterLabel('CRITICAL')).toBe('Critical');
        });

        it('maps warning severity', () => {
            expect(mapAssessmentSeverityToFilterLabel('warning')).toBe('Warning');
            expect(mapAssessmentSeverityToFilterLabel('Warning')).toBe('Warning');
            expect(mapAssessmentSeverityToFilterLabel('WARNING')).toBe('Warning');
        });

        it('returns empty string for undefined', () => {
            expect(mapAssessmentSeverityToFilterLabel(undefined)).toBe('');
        });

        it('returns original value for unknown severity', () => {
            expect(mapAssessmentSeverityToFilterLabel('info')).toBe('info');
        });
    });

    describe('createDashboardTableConfig', () => {
        it('creates basic table config', () => {
            const result = createDashboardTableConfig('thin-provisioning');
            expect(result.configId).toBe('thin-provisioning');
            expect(result.configName).toBe('thin-provisioning');
            expect(result.dismissConfigName).toBe('thin-provisioning');
            expect(result.isFixSupported).toBe(true);
            expect(result.customColumns).toEqual([]);
        });

        it('dataMapping extracts common fields from assessment item', () => {
            const config = createDashboardTableConfig('autosize');
            const mockItem: any = {
                id: 'autosize',
                totalObjectsAssessed: 10,
                totalObjectsInViolation: 5,
                violationDetails: [{ detail: 'test' }],
                objectsInViolation: [{ object: 'vol1' }],
                severity: 'warning',
                categories: ['storage']
            };

            const result = config.dataMapping(mockItem);

            expect(result.totalObjectsAssessed).toBe(10);
            expect(result.totalObjectsInViolation).toBe(5);
            expect(result.violationDetails).toEqual([{ detail: 'test' }]);
            expect(result.objectsInViolation).toEqual([{ object: 'vol1' }]);
            expect(result.tags).toEqual(['storage']);
            expect(result.severity).toBe('warning');
            expect(result.configurationName).toBe('autosize');
        });

        it('dataMapping handles missing optional fields', () => {
            const config = createDashboardTableConfig('test-config');
            const mockItem: any = { id: 'test-config' };

            const result = config.dataMapping(mockItem);

            expect(result.violationDetails).toEqual([]);
            expect(result.objectsInViolation).toEqual([]);
            expect(result.tags).toBeUndefined();
        });

        it('dataMapping extracts special fields for specific configs', () => {
            const config = createDashboardTableConfig('compute-rightsizing');
            const mockItem: any = {
                id: 'compute-rightsizing',
                sizingViolations: { undersized: 2, oversized: 3 },
                cloneDetails: [{ clone: 'c1' }],
                ec2InterfacesToFix: [{ interface: 'eth0' }],
                missingPermissions: ['CloudWatch'],
                recommendationOptions: [{ option: 'opt1' }],
                recommendedSizeInGib: 500
            };

            const result = config.dataMapping(mockItem);

            expect(result.sizingViolations).toEqual({ undersized: 2, oversized: 3 });
            expect(result.cloneDetails).toEqual([{ clone: 'c1' }]);
            expect(result.ec2InterfacesToFix).toEqual([{ interface: 'eth0' }]);
            expect(result.missingPermissions).toEqual(['CloudWatch']);
            expect(result.recommendationOptions).toEqual([{ option: 'opt1' }]);
            expect(result.recommendedSizeInGib).toBe(500);
        });
    });

    describe('getConfigSeverity', () => {
        it('returns severity from config data', () => {
            const configData = {
                mssqlSeverityObj: {
                    'thin-provisioning': 'critical'
                }
            };

            const result = getConfigSeverity(configData, 'thin-provisioning');
            expect(result).toBe('critical');
        });

        it('returns empty string when config not found', () => {
            const configData = {
                mssqlSeverityObj: {}
            };
            const result = getConfigSeverity(configData, 'non-existent');
            expect(result).toBe('');
        });

        it('returns empty string when configData is null', () => {
            const result = getConfigSeverity(null, 'thin-provisioning');
            expect(result).toBe('');
        });
    });

    describe('hasConfigStats', () => {
        it('returns true when config has stats bucket', () => {
            const configData = {
                mssqlStats: {
                    'thin-provisioning': {
                        optimized: 5,
                        notOptimized: 3,
                        dismissed: 2,
                        activating: 0,
                        total: 10
                    }
                }
            };

            const result = hasConfigStats(configData, 'thin-provisioning');
            expect(result).toBe(true);
        });

        it('returns false when config not found', () => {
            const configData = {
                mssqlStats: {}
            };
            const result = hasConfigStats(configData, 'non-existent');
            expect(result).toBe(false);
        });

        it('returns false when configData is null', () => {
            const result = hasConfigStats(null, 'thin-provisioning');
            expect(result).toBe(false);
        });
    });

    describe('getConfigStatsBucket', () => {
        it('returns stats bucket from config data', () => {
            const configData = {
                mssqlStats: {
                    'thin-provisioning': {
                        optimized: 5,
                        notOptimized: 3,
                        dismissed: 2,
                        activating: 0,
                        total: 10
                    }
                }
            };

            const result = getConfigStatsBucket(configData, 'thin-provisioning');

            expect(result?.optimized).toBe(5);
            expect(result?.notOptimized).toBe(3);
            expect(result?.dismissed).toBe(2);
            expect(result?.total).toBe(10);
        });

        it('returns undefined when config not found', () => {
            const configData = {
                mssqlStats: {}
            };
            const result = getConfigStatsBucket(configData, 'non-existent');

            expect(result).toBeUndefined();
        });

        it('returns undefined when configData is null', () => {
            const result = getConfigStatsBucket(null, 'autosize');

            expect(result).toBeUndefined();
        });
    });

    describe('getConfigStateList', () => {
        it('returns state list from config data', () => {
            const configData = {
                mssqlConfigState: {
                    'thin-provisioning': ['optimized', 'not-optimized']
                }
            };

            const result = getConfigStateList(configData, 'thin-provisioning');

            expect(result).toHaveLength(2);
            expect(result).toContain('optimized');
            expect(result).toContain('not-optimized');
        });

        it('returns empty array when config not found', () => {
            const configData = {
                mssqlConfigState: {}
            };
            const result = getConfigStateList(configData, 'non-existent');
            expect(result).toEqual([]);
        });

        it('returns empty array when configData is null', () => {
            const result = getConfigStateList(null, 'thin-provisioning');
            expect(result).toEqual([]);
        });
    });

    describe('resolveConfigDisplayName', () => {
        it('returns display name from CONFIG_NAMES when config ID is known', () => {
            const result = resolveConfigDisplayName('thin-provisioning');
            expect(result).toBe('Thin Provisioning');
        });

        it('returns the input when config not found in CONFIG_NAMES', () => {
            const result = resolveConfigDisplayName('non-existent');
            expect(result).toBe('non-existent');
        });

        it('resolves config type to ID first, then gets display name', () => {
            const result = resolveConfigDisplayName('autosize');
            expect(result).toBe('Autosize');
        });

        it('handles display names that are passed in', () => {
            // If display name is passed, it tries to find the ID first
            const result = resolveConfigDisplayName('Thin Provisioning');
            // Since 'Thin Provisioning' isn't a key in CONFIG_NAMES, it returns as-is
            expect(result).toBe('Thin Provisioning');
        });
    });

    describe('optimization count exclusions', () => {
        it('detects not-applicable status in backend and display formats', () => {
            expect(isNotApplicableStatus('not-applicable')).toBe(true);
            expect(isNotApplicableStatus('Not applicable')).toBe(true);
            expect(isNotApplicableStatus('Not optimized')).toBe(false);
        });

        it('disables fix for not-applicable and unavailable well-architected statuses', () => {
            expect(isFixDisabledAssessmentStatus('Not applicable')).toBe(true);
            expect(isFixDisabledAssessmentStatus(GETWELL_DISPLAY.UNAVAILABLE)).toBe(true);
            expect(isFixDisabledAssessmentStatus('Not optimized')).toBe(false);
            expect(isFixDisabledAssessmentStatus(undefined)).toBe(true);
        });

        it('excludes unavailable and not-applicable cards from optimization counts', () => {
            expect(
                isExcludedFromOptimizationCountForCard({
                    block_two: { value: 'Not applicable' },
                    id: 'thin-provision'
                })
            ).toBe(true);
            expect(
                isExcludedFromOptimizationCountForCard({
                    block_two: { value: 'Unavailable' },
                    id: 'compute-rightsizing',
                    errorMessage: 'Insufficient metrics'
                })
            ).toBe(true);
            expect(
                isExcludedFromOptimizationCountForCard({
                    block_two: { value: 'Not optimized' },
                    id: 'autosize'
                })
            ).toBe(false);

            expect(
                isExcludedFromOptimizationCountForAssessment({
                    id: 'thin-provision',
                    status: 'not-applicable',
                    severity: 'critical'
                })
            ).toBe(true);
            expect(
                isExcludedFromOptimizationCountForAssessment({
                    id: 'thin-provision',
                    status: 'not-available',
                    severity: 'critical'
                })
            ).toBe(true);
            expect(
                isExcludedFromOptimizationCountForAssessment({
                    id: 'compute-rightsizing',
                    status: 'not-optimized',
                    errorMessage: 'CloudWatch is not authorized'
                })
            ).toBe(true);
            expect(
                isExcludedFromOptimizationCountForAssessment({
                    id: 'autosize',
                    severity: 'critical'
                })
            ).toBe(true);
        });
    });
});
