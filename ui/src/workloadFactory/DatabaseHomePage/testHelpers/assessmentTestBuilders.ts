type ConfigPatch = { status?: string; severity?: string; name?: string };

const PATCH_KEY_ALIASES: Record<string, string> = {
    compute: 'compute-rightsizing',
    rssConfig: 'rss-config',
    hostOsPatch: 'host-os-patch',
    mtuAlignment: 'mtu-alignment',
    license: 'sql-license',
    mssqlPatch: 'mssql-patch',
    maxDOP: 'maxdop',
    clone: 'clone-management',
    snapshotPolicy: 'snapshot-policy',
    crr: 'crr',
    awsBackup: 'backup-configuration',
    oracleSecurityPatch: 'oracle-security-patch'
};

const MSSQL_FLAT_CONFIGS: Array<{ id: string; type: string; status: string; severity: string }> = [
    { id: 'compute-rightsizing', type: 'compute', status: 'optimized', severity: 'warning' },
    { id: 'rss-config', type: 'application', status: 'optimized', severity: 'warning' },
    { id: 'host-os-patch', type: 'application', status: 'optimized', severity: 'critical' },
    { id: 'mtu-alignment', type: 'application', status: 'optimized', severity: 'critical' },
    { id: 'sql-license', type: 'application', status: 'optimized', severity: 'warning' },
    { id: 'mssql-patch', type: 'application', status: 'optimized', severity: 'warning' },
    { id: 'maxdop', type: 'application', status: 'optimized', severity: 'warning' },
    { id: 'clone-management', type: 'cloning', status: 'optimized', severity: 'warning' },
    { id: 'snapshot-policy', type: 'resiliency', status: 'optimized', severity: 'warning' },
    { id: 'crr', type: 'resiliency', status: 'optimized', severity: 'warning' },
    { id: 'backup-configuration', type: 'resiliency', status: 'optimized', severity: 'warning' },
    { id: 'data-files-location', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'log-files-location', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'tempdb-files-location', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'headroom', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'tempdb-drive-size', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'log-drive-size', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'performance-tier', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'thin-provision', type: 'storage', status: 'optimized', severity: 'critical' }
];

const ORACLE_FLAT_CONFIGS: Array<{ id: string; type: string; status: string; severity: string }> = [
    { id: 'host-os-patch', type: 'application', status: 'optimized', severity: 'warning' },
    { id: 'oracle-security-patch', type: 'application', status: 'optimized', severity: 'critical' },
    { id: 'crr', type: 'resiliency', status: 'optimized', severity: 'warning' },
    { id: 'redologs-placement', type: 'storage', status: 'optimized', severity: 'warning' },
    { id: 'datafiles-placement', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'swap-space', type: 'storage', status: 'optimized', severity: 'critical' },
    { id: 'headroom', type: 'storage', status: 'optimized', severity: 'warning' }
];

const resolveConfigId = (key: string) => PATCH_KEY_ALIASES[key] ?? key;

const normalizeDismissedConfigurations = (dismissed: unknown) => {
    if (Array.isArray(dismissed)) {
        return dismissed.map(item =>
            item && typeof item === 'object' && 'id' in item
                ? { ...item, id: resolveConfigId(String((item as { id: string }).id)) }
                : item
        );
    }
    if (!dismissed || typeof dismissed !== 'object') {
        return [];
    }

    const entries: Array<{ id: string; configState: string; configurationName?: string }> = [];

    Object.entries(dismissed as Record<string, unknown>).forEach(([key, value]) => {
        if (key === 'highAvailability' && Array.isArray(value)) {
            value.forEach(item => {
                if (item && typeof item === 'object' && 'configurationName' in item) {
                    entries.push({
                        id: resolveConfigId(String((item as { configurationName: string }).configurationName)),
                        configState: String((item as { configState: string }).configState)
                    });
                }
            });
            return;
        }

        if (key.endsWith('_configuration') && value && typeof value === 'object' && 'configState' in value) {
            const configId = key.replace(/_configuration$/, '');
            entries.push({ id: resolveConfigId(configId), configState: String((value as { configState: string }).configState) });
            return;
        }

        if (value && typeof value === 'object' && 'configState' in value) {
            entries.push({ id: resolveConfigId(key), configState: String((value as { configState: string }).configState) });
        }
    });

    return entries;
};

const applyStoragePatches = (
    assessments: Array<{ id: string; type: string; status: string; severity: string }>,
    storage?: {
        layout?: ConfigPatch[];
        sizing?: ConfigPatch[];
        configuration?: { volumes?: ConfigPatch[] };
    }
) => {
    if (!storage) {
        return;
    }

    storage.layout?.forEach(item => {
        const id = resolveConfigId(item.name ?? '');
        const idx = assessments.findIndex(entry => entry.id === id);
        if (idx >= 0) {
            assessments[idx] = { ...assessments[idx], ...item, id };
        }
    });
    storage.sizing?.forEach(item => {
        const id = resolveConfigId(item.name ?? '');
        const idx = assessments.findIndex(entry => entry.id === id);
        if (idx >= 0) {
            assessments[idx] = { ...assessments[idx], ...item, id };
        }
    });
    storage.configuration?.volumes?.forEach(item => {
        const id = resolveConfigId(item.name ?? '');
        const idx = assessments.findIndex(entry => entry.id === id);
        if (idx >= 0) {
            assessments[idx] = { ...assessments[idx], ...item, id };
        }
    });
};

const buildFlatAssessment = (
    defaults: Array<{ id: string; type: string; status: string; severity: string }>,
    overrides: Record<string, unknown> = {}
) => {
    const {
        deploymentType = 'Standalone',
        lastAssessmentTimestamp = '1730074791000',
        dismissedConfigurations,
        highAvailability,
        storage,
        ...configPatches
    } = overrides;

    const assessments = defaults.map(item => ({ ...item }));

    Object.entries(configPatches).forEach(([key, value]) => {
        if (value && typeof value === 'object' && 'status' in value) {
            const id = resolveConfigId(key);
            const idx = assessments.findIndex(entry => entry.id === id);
            if (idx >= 0) {
                assessments[idx] = { ...assessments[idx], ...(value as ConfigPatch) };
            }
        }
    });

    applyStoragePatches(assessments, storage as Parameters<typeof applyStoragePatches>[1]);

    if (Array.isArray(highAvailability)) {
        highAvailability.forEach(item => {
            if (item && typeof item === 'object' && 'name' in item) {
                assessments.push({
                    id: resolveConfigId(String((item as ConfigPatch).name)),
                    type: 'resiliency',
                    status: String((item as ConfigPatch).status ?? 'optimized'),
                    severity: String((item as ConfigPatch).severity ?? 'critical'),
                    subType: 'highAvailability'
                } as (typeof assessments)[number] & { subType: string });
            }
        });
    }

    return {
        metadata: { lastAssessmentTimestamp, deploymentType },
        dismissedConfigurations: normalizeDismissedConfigurations(dismissedConfigurations ?? []),
        assessments
    };
};

export const buildMssqlAssessment = (overrides: Record<string, unknown> = {}) =>
    buildFlatAssessment(MSSQL_FLAT_CONFIGS, overrides);

export const buildOracleAssessment = (overrides: Record<string, unknown> = {}) =>
    buildFlatAssessment(ORACLE_FLAT_CONFIGS, overrides);
