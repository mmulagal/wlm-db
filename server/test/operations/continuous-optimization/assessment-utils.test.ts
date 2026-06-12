import { buildDismissedConfigurations } from '../../../src/operations/continuous-optimization/assessment-utils';
import { DatabaseTypes } from '../../../src/utils/consts';

// ---------------------------------------------------------------------------
// buildDismissedConfigurations
// ---------------------------------------------------------------------------
describe('buildDismissedConfigurations', () => {
    it('returns empty array when dismissed is undefined', () => {
        expect(buildDismissedConfigurations(undefined, DatabaseTypes.MS_SQL_SERVER)).toEqual([]);
    });

    it('flattens storage configuration/sizing/layout entries preserving configurationName and configState', () => {
        const dismissed = {
            storage: {
                configuration: {
                    volumes: [{ configurationName: 'thin-provision', configState: 'dismissed' }],
                    luns: [],
                    os: []
                },
                sizing: [{ configurationName: 'headroom', configState: 'dismissed' }],
                layout: [{ configurationName: 'default-data-files-location', configState: 'dismissed' }]
            }
        } as any;

        const result = buildDismissedConfigurations(dismissed, DatabaseTypes.MS_SQL_SERVER);
        expect(result).toHaveLength(3);
        expect(result.map(r => r.configurationName)).toEqual(
            expect.arrayContaining(['thin-provision', 'headroom', 'default-data-files-location'])
        );
    });

    it('flattens highAvailability entries', () => {
        const dismissed = {
            highAvailability: [
                { configurationName: 'shared-storage', configState: 'dismissed' },
                { configurationName: 'cluster-quorum-configuration', configState: 'dismissed' }
            ]
        } as any;

        const result = buildDismissedConfigurations(dismissed, DatabaseTypes.MS_SQL_SERVER);
        expect(result).toHaveLength(2);
        expect(result[0].configurationName).toBe('shared-storage');
    });

    it('flattens single-object dismissed areas', () => {
        const dismissed = {
            license: { configurationName: 'sql-license', configState: 'dismissed' },
            hostOsPatch: { configurationName: 'host-os-patch', configState: 'dismissed' }
        } as any;

        const result = buildDismissedConfigurations(dismissed, DatabaseTypes.MS_SQL_SERVER);
        expect(result).toHaveLength(2);
        expect(result.map(r => r.configurationName)).toEqual(expect.arrayContaining(['sql-license', 'host-os-patch']));
    });

    it('enriches entries with golden-config fields (id, name, type, subType, recommendation, categories)', () => {
        const dismissed = {
            storage: {
                configuration: {
                    volumes: [{ configurationName: 'thin-provision', configState: 'dismissed' }],
                    luns: [],
                    os: []
                },
                sizing: [],
                layout: []
            },
            license: { configurationName: 'sql-license', configState: 'dismissed' }
        } as any;

        const result = buildDismissedConfigurations(dismissed, DatabaseTypes.MS_SQL_SERVER);
        const thinProvision = result.find(r => r.configurationName === 'thin-provision');
        expect(thinProvision).toMatchObject({
            id: 'thin-provision',
            name: expect.any(String),
            type: 'storage',
            subType: 'configuration',
            recommendation: expect.any(String),
            categories: expect.any(Array)
        });
        const license = result.find(r => r.configurationName === 'sql-license');
        expect(license).toMatchObject({
            id: 'sql-license',
            type: 'application',
            subType: 'application'
        });
    });
});
