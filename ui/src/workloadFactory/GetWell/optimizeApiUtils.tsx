/**
 * optimizeApiUtils — shared optimize infrastructure
 *
 * Extracted from DashboardInnerPage, DynamicOptimizeInnerPage, and StorageCardComponent.
 * Eliminates the three near-identical mutation maps and the duplicated payload builders.
 *
 * Exports:
 *  - useOptimizeMutations()             → single hook that returns the full mutation map
 *  - groupRowsToHosts()                 → bulk-row grouper (host ← instances)
 *  - buildOptimizeApiInput()            → canonical payload + API-arg builder (superset of all three files)
 *  - buildOptimizeInfoNotification()    → info notification action with i18n text + Job Monitoring link
 *  - buildOptimizeFailedMessage()       → failed notification JSX with View Job Monitoring link
 */

import {
    useOptimizeStorageConfigMutation,
    useOptimizeOracleStorageConfigMutation,
    useOptimizeOracleStorageLayoutAsmMutation,
    useOptimizeOracleOperatingSystemMutation,
    useOptimizeOperatingSystemForBulkMutation,
    useOptimizeStorageSizingForBulkMutation,
    useOptimizeStorageTierForBulkMutation,
    useOptimizeComputeConfigForBulkMutation,
    useOptimizeMTUConfigForBulkMutation,
    useOptimizeMaxdopConfigForBulkMutation,
    useOptimizeResiliencyMutation,
    useOptimizeAwsBackupMutation,
    useOptimizeCloneCleanupMutation,
    useOptimizeHAMssqlMutation
} from '../../utils/apiService';
import { Button } from '@netapp/design-system';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { TFunction } from 'i18next';
import type { AppDispatch } from '../../store/store';
import { OptimizeApiConfig } from '../../utils/configRegistry';
import {
    ACTION_TYPE,
    DBType,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    WLF_TABS
} from '../../utils/consts';
import { backupStartTime } from '../../utils/utilityFunctions';
import { uniqueHostRow } from '../InventoryV2/InventoryUtilsV2';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../store/notificationSlice';
import { setSelectedHeaderTab } from '../../store/workloadFactory/inventoryV2Slice';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OptimizeMutationFn = (input: Record<string, unknown>) => Promise<unknown>;
export type OptimizeMutationMap = Record<string, OptimizeMutationFn>;

/**
 * Context passed to buildOptimizeApiInput.
 * All "optional extras" (snapshot, backup, compute) are read from Redux by the caller
 * and passed in — keeping the builder a pure function.
 */
export interface OptimizePayloadContext {
    /** Flat config ID from the registry (e.g. 'snapshot-policy-vol', 'compute-rightsizing') */
    configId: string;
    engineType: string;
    /** Per-instance routing info for credential-scoped calls */
    credentialId: string;
    regionId: string;
    databaseHostId: string;
    instanceId: string;
    /**
     * Row data from the table.
     * Single object for 'single' fixes; array for ACTION_TYPE.BULK fixes.
     * May be undefined for StorageCard / Dynamic page (they read creds from Redux already).
     */
    rowData?: any;
    /** 'bulk' (ACTION_TYPE.BULK) or 'single' / undefined */
    operation?: string;
    /** Redux state extras — only required for the configs that need them */
    selectedSnapshot?: any;
    selectedAWSBackup?: any;
    selectedRecommendedInstance?: any;
    recommendedInstanceInBulk?: Record<string, any>;
}

// ─── Shared mutation hook ─────────────────────────────────────────────────────

/**
 * Returns the full mutation map used by all three optimize entry-points.
 * Call once per component; the returned object is stable across renders
 * because RTK Query hooks return stable function references.
 */
export const useOptimizeMutations = (): OptimizeMutationMap => {
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeOracleStorageConfig] = useOptimizeOracleStorageConfigMutation();
    const [optimizeOracleStorageLayoutAsm] = useOptimizeOracleStorageLayoutAsmMutation();
    const [optimizeOracleOs] = useOptimizeOracleOperatingSystemMutation();
    const [optimizeOperatingSystemForBulk] = useOptimizeOperatingSystemForBulkMutation();
    const [optimizeStorageSizingForBulk] = useOptimizeStorageSizingForBulkMutation();
    const [optimizeStorageTierForBulk] = useOptimizeStorageTierForBulkMutation();
    const [optimizeComputeConfigForBulk] = useOptimizeComputeConfigForBulkMutation();
    const [optimizeMaxdopConfigForBulk] = useOptimizeMaxdopConfigForBulkMutation();
    const [optimizeMTUConfigForBulk] = useOptimizeMTUConfigForBulkMutation();
    const [optimizeResiliency] = useOptimizeResiliencyMutation();
    const [optimizeAwsBackup] = useOptimizeAwsBackupMutation();
    const [optimizeCloneCleanup] = useOptimizeCloneCleanupMutation();
    const [optimizeHAMssql] = useOptimizeHAMssqlMutation();

    return {
        optimizeStorageConfig: optimizeStorageConfig as OptimizeMutationFn,
        optimizeOracleStorageConfig: optimizeOracleStorageConfig as OptimizeMutationFn,
        optimizeOracleStorageLayoutAsm: optimizeOracleStorageLayoutAsm as OptimizeMutationFn,
        optimizeOracleOperatingSystem: optimizeOracleOs as OptimizeMutationFn,
        optimizeOperatingSystemForBulk: optimizeOperatingSystemForBulk as OptimizeMutationFn,
        optimizeStorageSizingForBulk: optimizeStorageSizingForBulk as OptimizeMutationFn,
        optimizeStorageTierForBulk: optimizeStorageTierForBulk as OptimizeMutationFn,
        optimizeComputeConfigForBulk: optimizeComputeConfigForBulk as OptimizeMutationFn,
        optimizeMaxdopConfigForBulk: optimizeMaxdopConfigForBulk as OptimizeMutationFn,
        optimizeMTUConfigForBulk: optimizeMTUConfigForBulk as OptimizeMutationFn,
        optimizeResiliency: optimizeResiliency as OptimizeMutationFn,
        optimizeAwsBackup: optimizeAwsBackup as OptimizeMutationFn,
        optimizeCloneCleanup: optimizeCloneCleanup as OptimizeMutationFn,
        optimizeHAMssql: optimizeHAMssql as OptimizeMutationFn
    };
};

// ─── Bulk-host grouper ────────────────────────────────────────────────────────

/**
 * Groups an array of flat table rows into a `databaseHosts` array suitable for
 * `hostsToOptimize[].databaseHosts`. Rows for the same host are merged so the
 * instances array contains all instances on that host.
 *
 * @param rows         Flat row objects that have databaseHostId / credentialId / regionId / instanceId
 * @param instancesKey 'sqlServerInstances' for MSSQL, 'databases' for Oracle
 * @param extraHostFields Optional callback to add per-host fields from the first row seen
 */
export const groupRowsToHosts = (
    rows: any[],
    instancesKey: 'sqlServerInstances' | 'databases',
    extraHostFields?: (row: any) => Record<string, any>
): any[] =>
    Object.values(
        rows.reduce(
            (acc: Record<string, any>, row: any) => {
                const key = uniqueHostRow(row.databaseHostId, row.credentialId, row.regionId);
                if (!acc[key]) {
                    acc[key] = {
                        id: row.databaseHostId,
                        credentialsId: row.credentialId,
                        region: row.regionId,
                        [instancesKey]: [],
                        ...(extraHostFields ? extraHostFields(row) : {})
                    };
                }
                acc[key][instancesKey].push(row.instanceId);
                return acc;
            },
            {}
        )
    );

// ─── Payload builder ──────────────────────────────────────────────────────────

/**
 * Builds the full mutation argument (payload + routing fields) for any optimize call.
 *
 * Covers every payload shape used across DashboardInnerPage, DynamicOptimizeInnerPage,
 * and StorageCardComponent. Returns `null` when the config is not supported.
 *
 * The returned object is passed directly to the mutation function:
 *   mutationMap[apiConfig.mutation](buildOptimizeApiInput(apiConfig, ctx))
 */
export const buildOptimizeApiInput = (
    apiConfig: OptimizeApiConfig,
    ctx: OptimizePayloadContext
): Record<string, any> | null => {
    const {
        configId,
        engineType,
        credentialId,
        regionId,
        databaseHostId,
        instanceId,
        rowData,
        operation,
        selectedSnapshot,
        selectedAWSBackup,
        selectedRecommendedInstance,
        recommendedInstanceInBulk
    } = ctx;

    const configName = apiConfig.apiConfigName ?? configId;
    const isBulk = operation === ACTION_TYPE.BULK;
    const isOracle = engineType === DBType.ORACLE;

    // Resolve single-row routing fields — Dashboard passes them in rowData;
    // Dynamic / StorageCard pass them directly in ctx (already from Redux).
    const rowHostId = rowData?.databaseHostId ?? databaseHostId;
    const rowCredId = rowData?.credentialId ?? credentialId;
    const rowRegionId = rowData?.regionId ?? regionId;
    const rowInstanceId = rowData?.instanceId ?? instanceId;

    // ── Resiliency (snapshot policy) ─────────────────────────────────────────
    if (apiConfig.mutation === 'optimizeResiliency') {
        const configurationName = apiConfig.usesConfigNameArray ? [configId] : configId;
        const payload: Record<string, any> = { configurationName };
        if (selectedSnapshot) {
            payload.params = [
                {
                    snapshotPolicy: {
                        uuid: selectedSnapshot?.data?.uuid,
                        name: selectedSnapshot?.data?.name
                    },
                    volumes: rowData?.objectsInViolation
                }
            ];
        }
        return { credentialId, regionId, databaseHostId, instanceId, payload };
    }

    // ── Oracle AWS backup ─────────────────────────────────────────────────────
    if (apiConfig.oracleOsType === 'aws-backup' && isOracle) {
        return {
            payload: {
                type: 'aws-backup',
                hostsToOptimize: [
                    {
                        configurationName: 'aws-backup',
                        databaseHosts: [
                            {
                                id: rowHostId,
                                region: rowRegionId,
                                credentialsId: rowCredId,
                                fsxFileSystemId:
                                    rowData?.data?.assessments?.metadata?.fileSystemId ??
                                    rowData?.fsxFileSystemId,
                                databases: [rowInstanceId],
                                backupRetentionDays: selectedAWSBackup?.numberOfDays,
                                backupStartTime: backupStartTime(selectedAWSBackup)
                            }
                        ]
                    }
                ]
            }
        };
    }

    // ── MSSQL AWS backup ──────────────────────────────────────────────────────
    if (apiConfig.mutation === 'optimizeAwsBackup') {
        return {
            payload: {
                hostsToOptimize: [
                    {
                        configurationName: ['aws-backup'],
                        databaseHosts: [
                            {
                                id: rowHostId,
                                sqlServerInstances: [rowInstanceId],
                                fsxFileSystemId:
                                    rowData?.data?.assessments?.metadata?.fileSystemId ??
                                    rowData?.fsxFileSystemId,
                                backupRetentionDays: selectedAWSBackup?.numberOfDays,
                                backupStartTime: backupStartTime(selectedAWSBackup),
                                credentialsId: rowCredId,
                                region: rowRegionId
                            }
                        ]
                    }
                ]
            }
        };
    }

    // ── Oracle bulk (storage-operating-system, compute-host-os, storage-sizing, clone, headroom) ──
    if (isOracle && apiConfig.payloadScope === 'bulk') {
        if (isBulk) {
            return {
                payload: {
                    type: apiConfig.oracleOsType,
                    hostsToOptimize: [
                        {
                            configurationName: configName,
                            databaseHosts: groupRowsToHosts(rowData, 'databases')
                        }
                    ]
                }
            };
        }
        return {
            payload: {
                type: apiConfig.oracleOsType,
                hostsToOptimize: [
                    {
                        configurationName: configName,
                        databaseHosts: [
                            {
                                id: rowHostId,
                                credentialsId: rowCredId,
                                region: rowRegionId,
                                databases: [rowInstanceId]
                            }
                        ]
                    }
                ]
            }
        };
    }

    // ── Credential-scoped ─────────────────────────────────────────────────────
    if (apiConfig.payloadScope === 'credential-scoped') {
        // MSSQL OS uses bulk hostsToOptimize format even though it's credential-scoped
        if (apiConfig.mutation === 'optimizeOperatingSystemForBulk') {
            return {
                payload: {
                    hostsToOptimize: [
                        {
                            configurationName: configId,
                            databaseHosts: [
                                {
                                    id: databaseHostId,
                                    sqlServerInstances: [instanceId],
                                    credentialsId: credentialId,
                                    region: regionId
                                }
                            ]
                        }
                    ]
                }
            };
        }
        // All other credential-scoped (ONTAP, ASM layout, Oracle storage)
        return {
            credentialId,
            regionId,
            databaseHostId,
            instanceId,
            payload: {
                assessments: [
                    {
                        configurationName: rowData?.configurationName ?? configName,
                        objectsToOptimize: rowData?.objectsInViolation || []
                    }
                ]
            }
        };
    }

    // ── HA MSSQL ──────────────────────────────────────────────────────────────
    if (apiConfig.mutation === 'optimizeHAMssql') {
        return {
            configName: apiConfig.haUrlSegment,
            payload: {
                hostsToOptimize: [
                    {
                        configurationName: configId,
                        databaseHosts: [
                            {
                                id: databaseHostId,
                                sqlServerInstances: [instanceId],
                                credentialsId: credentialId,
                                region: regionId
                            }
                        ]
                    }
                ]
            }
        };
    }

    // ── Compute rightsizing ───────────────────────────────────────────────────
    if (apiConfig.mutation === 'optimizeComputeConfigForBulk' && configName === 'compute') {
        if (isBulk) {
            return {
                payload: {
                    hostsToOptimize: [
                        {
                            configurationName: 'compute',
                            databaseHosts: Object.values(
                                (rowData as any[]).reduce(
                                    (acc: Record<string, any>, row: any) => {
                                        const key = uniqueHostRow(
                                            row.databaseHostId,
                                            row.credentialId,
                                            row.regionId
                                        );
                                        if (!acc[key]) {
                                            acc[key] = {
                                                id: row.databaseHostId,
                                                sqlServerInstances: [],
                                                credentialsId: row.credentialId,
                                                region: row.regionId,
                                                instanceType:
                                                    recommendedInstanceInBulk?.[row.hostName]?.value || ''
                                            };
                                        }
                                        acc[key].sqlServerInstances.push(row.instanceId);
                                        return acc;
                                    },
                                    {}
                                )
                            )
                        }
                    ]
                }
            };
        }
        return {
            payload: {
                hostsToOptimize: [
                    {
                        configurationName: 'compute',
                        databaseHosts: [
                            {
                                id: rowHostId,
                                sqlServerInstances: [rowInstanceId],
                                credentialsId: rowCredId,
                                region: rowRegionId,
                                instanceType: selectedRecommendedInstance?.value || ''
                            }
                        ]
                    }
                ]
            }
        };
    }

    // ── RSS config ────────────────────────────────────────────────────────────
    if (configName === 'rss-config') {
        if (isBulk) {
            return {
                payload: {
                    hostsToOptimize: [
                        {
                            configurationName: 'rss-config',
                            databaseHosts: Object.values(
                                (rowData as any[]).reduce(
                                    (acc: Record<string, any>, row: any) => {
                                        const key = uniqueHostRow(
                                            row.databaseHostId,
                                            row.credentialId,
                                            row.regionId
                                        );
                                        if (!acc[key]) {
                                            acc[key] = {
                                                id: row.databaseHostId,
                                                sqlServerInstances: [],
                                                networkAdapters: [],
                                                credentialsId: row.credentialId,
                                                region: row.regionId
                                            };
                                        }
                                        acc[key].sqlServerInstances.push(row.instanceId);
                                        acc[key].networkAdapters.push(...(row.networkAdapters || []));
                                        return acc;
                                    },
                                    {}
                                )
                            )
                        }
                    ]
                }
            };
        }
        return {
            payload: {
                hostsToOptimize: [
                    {
                        configurationName: 'rss-config',
                        databaseHosts: [
                            {
                                id: rowHostId,
                                sqlServerInstances: [rowInstanceId],
                                networkAdapters: rowData?.networkAdapters,
                                credentialsId: rowCredId,
                                region: rowRegionId
                            }
                        ]
                    }
                ]
            }
        };
    }

    // ── MTU alignment ─────────────────────────────────────────────────────────
    if (configName === 'mtu-alignment') {
        if (isBulk) {
            return {
                payload: {
                    hostsToOptimize: [
                        {
                            configurationName: 'mtu-alignment',
                            databaseHosts: Object.values(
                                (rowData as any[]).reduce(
                                    (acc: Record<string, any>, row: any) => {
                                        const key = uniqueHostRow(
                                            row.databaseHostId,
                                            row.credentialId,
                                            row.regionId
                                        );
                                        if (!acc[key]) {
                                            acc[key] = {
                                                id: row.databaseHostId,
                                                sqlServerInstances: [],
                                                credentialsId: row.credentialId,
                                                region: row.regionId,
                                                interfaceNames: []
                                            };
                                        }
                                        acc[key].sqlServerInstances.push(row.instanceId);
                                        if (row.objectsInViolation) {
                                            acc[key].interfaceNames.push(...row.objectsInViolation);
                                        }
                                        return acc;
                                    },
                                    {}
                                )
                            )
                        }
                    ]
                }
            };
        }
        return {
            payload: {
                hostsToOptimize: [
                    {
                        configurationName: 'mtu-alignment',
                        databaseHosts: [
                            {
                                id: rowHostId,
                                sqlServerInstances: [rowInstanceId],
                                credentialsId: rowCredId,
                                region: rowRegionId,
                                interfaceNames: rowData?.objectsInViolation || []
                            }
                        ]
                    }
                ]
            }
        };
    }

    // ── Standard MSSQL bulk ───────────────────────────────────────────────────
    if (isBulk) {
        return {
            payload: {
                hostsToOptimize: [
                    {
                        configurationName: configName,
                        databaseHosts: groupRowsToHosts(rowData, 'sqlServerInstances')
                    }
                ]
            }
        };
    }

    // ── Standard MSSQL single ─────────────────────────────────────────────────
    return {
        payload: {
            hostsToOptimize: [
                {
                    configurationName: configName,
                    databaseHosts: [
                        {
                            id: rowHostId,
                            credentialsId: rowCredId,
                            region: rowRegionId,
                            sqlServerInstances: [rowInstanceId]
                        }
                    ]
                }
            ]
        }
    };
};

// ─── Shared notification builders ─────────────────────────────────────────────

interface OptimizeNotificationCtx {
    configName: string;
    t: TFunction;
    dispatch: AppDispatch;
    isWorkloadFactory: boolean;
}

/**
 * Returns the Redux `addNotification` action for the "fix initiated" info toast.
 * Standardised on i18n text across all entry-points.
 * Dispatch this directly: `dispatch(buildOptimizeInfoNotification(ctx))`
 */
export const buildOptimizeInfoNotification = ({
    configName,
    t,
    dispatch,
    isWorkloadFactory
}: OptimizeNotificationCtx) =>
    addNotification({
        notificationType: NOTIFICATION_TYPES.INFO,
        message: (
            <div>
                {`${t('databases.well-architect.fixing-process-initiated-for')} ${configName}. ${t(
                    'databases.well-architect.process-can-take-min'
                )} `}
                <Button
                    Component="button"
                    variant="text"
                    onClick={() => {
                        dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                        const path = isWorkloadFactory
                            ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                            : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;
                        postBlueXPMessage({
                            type: BlueXPListeners.navigate,
                            payload: { pathname: path, replace: true }
                        });
                        dispatch(clearNotifications());
                    }}
                >
                    {t('databases.general.job-monitoring')}.
                </Button>
            </div>
        )
    });

/**
 * Returns the JSX element shown in the "failed to optimize" error toast.
 * Pass to `handleOptimizeStorageJob` as the `failedMsgData` argument.
 */
export const buildOptimizeFailedMessage = ({
    configName,
    t,
    dispatch,
    isWorkloadFactory,
    className
}: OptimizeNotificationCtx & { className?: string }) => (
    <div className={className}>
        {`${configName} ${t('databases.well-architect.failed-to-optimize')}`}
        <Button
            Component="button"
            variant="text"
            onClick={() => {
                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                const path = isWorkloadFactory
                    ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                    : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: path, replace: true }
                });
                dispatch(clearNotifications());
            }}
        >
            {t('databases.general.view-job-monitoring')}.
        </Button>
    </div>
);
