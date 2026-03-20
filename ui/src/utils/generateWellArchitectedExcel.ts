import * as ExcelJS from 'exceljs';
import store from '../store/store';
import getActionSummaryMessages from './wellArchitectedActionSummaryMessages';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_NAMES, DBType } from './consts';
import { GENERAL } from './appConstants';
import { formatOptimizationBreakDown, getCardsData, cardDataDefault } from '../workloadFactory/GetWell/GetWellUtils';
import {
    oracleCardData,
    getOracleCardsData,
    formatOracleOptimizationBreakDown
} from '../workloadFactory/Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';

// Static ordered lists for MSSQL and Oracle configuration keys
const MSSQL_CONFIG_ORDER = [
    // Storage sizing
    'performance-tier',
    'headroom',
    'log-drive-size',
    'tempdb-drive-size',
    // Storage layout
    'tempdb-files-location',
    'data-files-location',
    'log-files-location',
    // Storage configuration - volumes
    'thin-provision',
    'autosize',
    'autosize-mode',
    'fractional-reserve',
    'snapshot-copy-reserve',
    'snapshot-autodelete',
    'space-mgmt-try-first',
    'tiering-policy',
    'tiering-min-cooling-days',
    // Storage configuration - luns
    'os-type',
    'space-reservation-enabled',
    'space-allocation-allocated',
    // Storage configuration - os
    'mpio-enabled',
    'mpio-iscsi-count',
    'ntfs-allocation-unit-size',
    'mpio-load-balance-policy',
    'mpio-timeout',
    // Compute
    'compute-rightsizing',
    'host-os-patch',
    'rss-config',
    'mtu-alignment',
    // Application
    'sql-license',
    'mssql-patch',
    'maxdop',
    // Resiliency
    'snapshot-policy',
    'backup-configuration',
    'crr',
    'snapcenter-snapshot',
    // High Availability
    'shared-storage',
    'drive-letter',
    'cluster-quorum',
    'heartbeat-settings',
    'sqlServer-service',
    // Cloning
    'clone-management'
];

const ORACLE_CONFIG_ORDER = [
    'headroom',
    'swap-space',
    'oracle-binary-placement',
    'datafiles-placement',
    'controlfiles-placement',
    'redologs-placement',
    'templogs-placement',
    'archive-placement',

    'data-dg-lun-layout',
    'log-dg-lun-layout',
    'fra-dg-lun-layout',
    'archivelog-dg-lun-layout',
    'thin-provision',
    'autosize',
    'autosize-mode',
    'fractional-reserve',
    'snapshot-policy',
    'snapshot-copy-reserve',
    'snapshot-autodelete',
    'space-mgmt-try-first',
    'tiering-policy',
    'tiering-min-cooling-days',
    'compression',
    'deduplication',
    'compaction',
    'nfs-rootonly',
    'export-policy',
    'os-type',
    'space-reservation-enabled',
    'space-allocation-allocated',
    'snapshot-policy-vol',
    'multipath-io',
    'host-utilities',
    'transparent-hugepages',
    'selinux',
    'iscsi-replacement-timeout',
    'multipath-friendly-names',
    'tcp-advanced-options',
    'filesystems-io-options',
    'multiblock-readcount',
    'multipath-io-sessions',
    'multipath-configuration',
    'kernel-parameters',
    'nfs-mount-options-databasefiles',
    'nfs-mount-options-adrhome',
    'nfs-caching-options',
    'nfsv4-domain-name',
    'asm-setup',
    'asm-external-redundancy',
    'afd-logical-block-size',
    'asmlib-logical-block-size',
    'ontap-configuration',
    'os-configuration'
];

function getOrderedConfigurationKeys(data: ComprehensiveAssessmentData, databaseType: string): string[] {
    // Choose the correct static order
    const staticOrder = databaseType === DBType.ORACLE ? ORACLE_CONFIG_ORDER : MSSQL_CONFIG_ORDER;

    // Collect all existing configuration names from the data
    const existingConfigNames = new Set<string>();
    const orderedKeys: string[] = [];

    // Collect names from storage configurations
    if (data.storage?.configuration) {
        data.storage.configuration.volumes?.forEach(item => existingConfigNames.add(item.name));
        data.storage.configuration.luns?.forEach(item => existingConfigNames.add(item.name));
        data.storage.configuration.os?.forEach(item => existingConfigNames.add(item.name));
    }

    // Collect names from storage sizing and layout
    data.storage?.sizing?.forEach(item => existingConfigNames.add(item.name));
    data.storage?.layout?.forEach(item => existingConfigNames.add(item.name));

    // Collect names from high availability
    data.highAvailability?.forEach(item => existingConfigNames.add(item.name));

    // Add names from top-level configurations
    const topLevelConfigs = [
        { data: data.compute, name: 'compute-rightsizing' },
        { data: data.hostOsPatch, name: 'host-os-patch' },
        { data: data.oracleSecurityPatch, name: 'oracle-security-patch' },
        { data: data.rssConfig, name: 'rss-config' },
        { data: data.mtuAlignment, name: 'mtu-alignment' },
        { data: data.license, name: 'sql-license' },
        { data: data.mssqlPatch, name: 'mssql-patch' },
        { data: data.maxDOP, name: 'maxdop' },
        { data: data.snapshotPolicy, name: 'snapshot-policy' },
        { data: data.awsBackup, name: 'backup-configuration' },
        { data: data.crr, name: 'crr' },
        { data: data.snapcenterSnapshot, name: 'snapcenter-snapshot' },
        { data: data.clone, name: 'clone-management' }
    ];

    topLevelConfigs.forEach(config => {
        if (config.data) {
            existingConfigNames.add(config.name);
        }
    });

    // First, add configs from staticOrder that exist in the data
    staticOrder.forEach(configName => {
        if (existingConfigNames.has(configName)) {
            orderedKeys.push(configName);
            existingConfigNames.delete(configName); // Remove so we don't add it again
        }
    });

    // Add any remaining configs that weren't in the static order
    existingConfigNames.forEach(configName => {
        orderedKeys.push(configName);
    });

    return orderedKeys;
}

// Function to get proper display name for configuration
const getConfigurationDisplayName = (internalName: string, databaseType?: string): string => {
    // Use unified CONFIG_NAMES mapping for both Oracle and MSSQL
    if (internalName in CONFIG_NAMES) {
        return CONFIG_NAMES[internalName as keyof typeof CONFIG_NAMES];
    }

    // Return the internal name if no mapping is found
    return internalName;
};

// Function to sanitize worksheet names for Excel compliance
const sanitizeWorksheetName = (name: string): string => {
    let sanitized = name.replace(/[*?:\\/[\]]/g, '_');

    if (sanitized.length > 31) {
        sanitized = sanitized.substring(0, 31);
    }

    return sanitized;
};

interface AssessmentItem {
    name: string;
    status: string;
    severity: string;
    recommendation: string;
    current?: string;
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
    violationDetails?: any[];
    resourceType?: string;
    sizingViolations?: any;
    tags?: string[];
    ec2InterfacesToFix?: any[];
    missingPatchesInEc2Instances?: any[];
    ec2InstancesToPatch?: any[];
    missingPatchDetails?: any[];
    sqlServerInstances?: any[];
    rssAdapters?: any[];
    recommendedAdapterSettings?: any;
    tcpOffloadState?: string;
    objectsInViolation?: string[];
    recommendationOptions?: any[];
    oldCloneDetails?: any[];
}

interface ComprehensiveAssessmentData {
    storage?: {
        configuration?: {
            volumes?: AssessmentItem[];
            luns?: AssessmentItem[];
            os?: AssessmentItem[];
        };
        sizing?: AssessmentItem[];
        layout?: AssessmentItem[];
    };
    highAvailability?: AssessmentItem[];
    compute?: AssessmentItem;
    snapshotPolicy?: AssessmentItem;
    crr?: AssessmentItem;
    snapcenterSnapshot?: AssessmentItem;
    awsBackup?: AssessmentItem;
    license?: AssessmentItem;
    hostOsPatch?: AssessmentItem;
    oracleSecurityPatch?: AssessmentItem;
    rssConfig?: AssessmentItem;
    mssqlPatch?: AssessmentItem;
    mtuAlignment?: AssessmentItem;
    maxDOP?: AssessmentItem;
    clone?: AssessmentItem;
    lastAssessmentTimestamp?: number;
    fileSystemId?: string;
    ec2InstanceId?: string;
    databaseInstanceName?: string;
    deploymentType?: string;
    baseDeploymentType?: string;
    databaseHostName?: string;
}

const EXCLUDED_FIELDS = [
    'storage',
    'highAvailability',
    'lastAssessmentTimestamp',
    'dismissedConfigurations',
    'fileSystemId',
    'ec2InstanceId',
    'databaseInstanceName',
    'deploymentType'
];

const COLORS = {
    LIGHT_BLUE: 'FFADD8E6',
    STEEL_BLUE: 'FF4682B4',
    SKY_BLUE: 'FF87CEEB',
    WHITE: 'FFFFFFFF',
    BLACK: 'FF000000',
    DARK_SLATE_GRAY: 'FF2F4F4F'
};

const MULTI_TABLE_CONFIGS = [
    'mtu-alignment',
    'mssql-patch',
    'host-os-patch',
    'oracle-security-patch',
    'sql-license',
    'rss-config',
    'log-drive-size',
    'tempdb-drive-size',
    'compute-rightsizing',
    'clone-management'
];

const TWO_COLUMN_CONFIGS = [
    'snapshot-copy-reserve',
    'performance-tier',
    'tiering-policy',
    'heartbeat-settings',
    'cluster-quorum',
    'drive-letter',
    'tiering-min-cooling-days',
    'os-type',
    'fractional-reserve',
    'ntfs-allocation-unit-size',
    'mpio-load-balance-policy',
    'backup-configuration'
];

const SINGLE_COLUMN_CONFIGS = [
    'thin-provision',
    'snapshot-autodelete',
    'autosize',
    'autosize-mode',
    'space-mgmt-try-first',
    'space-reservation-enabled',
    'space-allocation-allocated',
    'shared-storage',
    'tempdb-files-location',
    'data-files-location',
    'log-files-location'
];

const getAllItems = (data: ComprehensiveAssessmentData): AssessmentItem[] => {
    const allItems: AssessmentItem[] = [];

    if (data.storage?.configuration) {
        allItems.push(...(data.storage.configuration.volumes || []));
        allItems.push(...(data.storage.configuration.luns || []));
        allItems.push(...(data.storage.configuration.os || []));
    }
    if (data.storage?.sizing) allItems.push(...data.storage.sizing);
    if (data.storage?.layout) allItems.push(...data.storage.layout);
    if (data.highAvailability) allItems.push(...data.highAvailability);

    Object.keys(data).forEach(key => {
        if (!EXCLUDED_FIELDS.includes(key)) {
            const item = data[key as keyof ComprehensiveAssessmentData] as AssessmentItem;
            if (item && typeof item === 'object') {
                // Skip items with error messages when status is unavailable
                if ('errorMessage' in item && item.errorMessage) {
                } else if (item.name) {
                    allItems.push(item);
                }
            }
        }
    });

    return allItems;
};

const createCellStyle = (fill?: string, font?: any, alignment?: any, border = true) => ({
    ...(fill && {
        fill: {
            type: 'pattern' as const,
            pattern: 'solid' as const,
            fgColor: { argb: fill }
        }
    }),
    ...(font && { font }),
    ...(alignment && { alignment }),
    ...(border && {
        border: {
            top: { style: 'thin' as const, color: { argb: COLORS.BLACK } },
            left: { style: 'thin' as const, color: { argb: COLORS.BLACK } },
            bottom: { style: 'thin' as const, color: { argb: COLORS.BLACK } },
            right: { style: 'thin' as const, color: { argb: COLORS.BLACK } }
        }
    })
});

const addImpactedResourcesHeader = (details: any[], isTwoColumnTable = false) => {
    details.push({}, {});

    if (isTwoColumnTable) {
        details.push({
            'Configuration name': 'Impacted resources',
            Status: ''
        });
    } else {
        details.push({
            'Configuration name': 'Impacted resources'
        });
    }
};

function generateGeneralInformationData(data: ComprehensiveAssessmentData, databaseType: string = DBType.MSSQL) {
    let cardsData: any;
    let breakdown: any;

    if (databaseType === DBType.ORACLE) {
        // Use Oracle-specific functions for Oracle database type
        ({ cardsData } = getOracleCardsData(data as any, {}));
        breakdown = formatOracleOptimizationBreakDown(cardsData, data as any);
    } else {
        // Use MSSQL functions for MSSQL database type
        ({ cardsData } = getCardsData(data as any, {}));
        breakdown = formatOptimizationBreakDown(cardsData, data);
    }
    const state = store.getState();
    const { isDemoMode } = state.auth;

    // Extract totals from breakdown
    const criticalIssues = breakdown.total.critical;
    const warningIssues = breakdown.total.warning;
    const wellArchitectedConfigurations = breakdown.total.optimized;
    const { total } = breakdown.total;
    const totalIssues = criticalIssues + warningIssues;
    const score = total > 0 ? Math.round((wellArchitectedConfigurations / total) * 100) : 0;

    const currentDate = new Date();
    const lastAnalysisDate = data.lastAssessmentTimestamp
        ? new Date(data.lastAssessmentTimestamp)
        : new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    const databaseHostName = data.databaseHostName || '';
    const instanceName = isDemoMode
        ? data.databaseInstanceName?.replace(databaseHostName, '') || ''
        : data.databaseInstanceName || '';
    const fileName = `WorkloadfactoryDB-well-architected-report-${instanceName}.xlsx`;
    const generalInfo = {
        'Host name': data.databaseHostName,
        [databaseType === DBType.ORACLE ? 'Database name' : 'Instance name']: instanceName,
        'EC2 Instance Id': data.ec2InstanceId,
        'Time stamp (export timestamp)': currentDate.toLocaleString(),
        'Last analysis': lastAnalysisDate.toLocaleString(),
        'Well-architected status': `${totalIssues} issues`,
        'Well-architected score': `${score}%`,
        'Not-Optimized configuration (Critical)': criticalIssues.toString(),
        'Not-Optimized configuration (Warning)': warningIssues.toString(),
        'Well-architected configurations': wellArchitectedConfigurations.toString(),
        Total: total.toString()
    };

    return {
        fileName,
        generalInfo
    };
}

function generateConfigurationStatusData(data: ComprehensiveAssessmentData, databaseType: string = DBType.MSSQL) {
    const configurations: any[] = [];
    const displayToInternal = new Map<string, string>();
    const orderedKeys = getOrderedConfigurationKeys(data, databaseType);

    const processItems = (
        items: AssessmentItem[] | undefined,
        category: string,
        subCategory: string,
        parentConfigurationName: string = 'n/a'
    ) => {
        if (!items) return;

        items.forEach(item => {
            // Skip items with error messages when status is unavailable
            if ('errorMessage' in item && item.errorMessage) {
                return;
            }

            const displayName = getConfigurationDisplayName(item.name, databaseType);
            displayToInternal.set(displayName, item.name);

            configurations.push({
                'Configuration name': displayName,
                'Parent-configuration name': parentConfigurationName,
                Category: category,
                'Sub-category': subCategory,
                Status: item.status,
                Severity: item.severity?.charAt(0).toUpperCase() + item.severity?.slice(1) || 'Unknown',
                'Resource type': item.resourceType || 'Resource',
                'Impacted resources (X out of Y)':
                    typeof item.totalObjectsAssessed === 'number'
                        ? `${item.totalObjectsInViolation || 0} out of ${item.totalObjectsAssessed}`
                        : 'n/a'
            });
        });
    };

    // Process configurations in the order they appear in orderedKeys
    orderedKeys.forEach(configName => {
        // Check storage configurations
        if (data.storage?.configuration?.volumes?.find(item => item.name === configName)) {
            const item = data.storage.configuration.volumes.find(item => item.name === configName);
            if (item) processItems([item], 'Storage', 'Storage configuration', 'ONTAP');
        } else if (data.storage?.configuration?.luns?.find(item => item.name === configName)) {
            const item = data.storage.configuration.luns.find(item => item.name === configName);
            if (item) processItems([item], 'Storage', 'Storage configuration', 'ONTAP');
        } else if (data.storage?.configuration?.os?.find(item => item.name === configName)) {
            const item = data.storage.configuration.os.find(item => item.name === configName);
            if (item) processItems([item], 'Storage', 'Storage configuration', 'Operating System');
        }

        // Check storage sizing
        else if (data.storage?.sizing?.find(item => item.name === configName)) {
            const item = data.storage.sizing.find(item => item.name === configName);
            if (item) processItems([item], 'Storage', 'Storage sizing');
        }

        // Check storage layout
        else if (data.storage?.layout?.find(item => item.name === configName)) {
            const item = data.storage.layout.find(item => item.name === configName);
            if (item) processItems([item], 'Storage', 'Storage layout');
        }

        // Check high availability
        else if (data.highAvailability?.find(item => item.name === configName)) {
            const item = data.highAvailability.find(item => item.name === configName);
            if (item) processItems([item], 'Resiliency', 'Protection', 'High Availability');
        }

        // Check top-level configurations
        else {
            switch (configName) {
                case 'compute-rightsizing':
                    if (data.compute) processItems([data.compute], 'Compute', 'Compute');
                    break;
                case 'host-os-patch':
                    if (data.hostOsPatch) processItems([data.hostOsPatch], 'Compute', 'Compute');
                    break;
                case 'oracle-security-patch':
                    if (data.oracleSecurityPatch)
                        processItems([data.oracleSecurityPatch], 'Application', 'Application');
                    break;
                case 'rss-config':
                    if (data.rssConfig) processItems([data.rssConfig], 'Compute', 'Compute');
                    break;
                case 'mtu-alignment':
                    if (data.mtuAlignment) processItems([data.mtuAlignment], 'Compute', 'Compute');
                    break;
                case 'sql-license':
                    if (data.license) processItems([data.license], 'Application', 'Application');
                    break;
                case 'mssql-patch':
                    if (data.mssqlPatch) processItems([data.mssqlPatch], 'Application', 'Application');
                    break;
                case 'maxdop':
                    if (data.maxDOP) processItems([data.maxDOP], 'Application', 'Application');
                    break;
                case 'snapshot-policy':
                    if (data.snapshotPolicy) processItems([data.snapshotPolicy], 'Resiliency', 'Protection');
                    break;
                case 'backup-configuration':
                    if (data.awsBackup) processItems([data.awsBackup], 'Resiliency', 'Protection');
                    break;
                case 'crr':
                    if (data.crr) processItems([data.crr], 'Resiliency', 'Protection');
                    break;
                case 'snapcenter-snapshot':
                    if (data.snapcenterSnapshot) processItems([data.snapcenterSnapshot], 'Resiliency', 'Protection');
                    break;
                case 'clone-management':
                    if (data.clone) processItems([data.clone], 'Cloning', 'Cloning');
                    break;
            }
        }
    });

    return { configurations, displayToInternal };
}

// Special Configuration Handlers
const createMTUAlignmentData = (config: AssessmentItem, details: any[]) => {
    if (config.ec2InterfacesToFix && config.ec2InterfacesToFix.length > 0) {
        details.push({}, {});

        details.push({
            ec2InstanceId: 'Impacted resources',
            name: '',
            currentMTU: '',
            recommendedMTU: ''
        });

        details.push({
            ec2InstanceId: 'ec2InstanceId',
            name: 'name',
            currentMTU: 'currentMTU',
            recommendedMTU: 'recommendedMTU'
        });

        config.ec2InterfacesToFix.forEach((interfaceData: any) => {
            details.push({
                ec2InstanceId: interfaceData.ec2InstanceId || '',
                name: interfaceData.name || '',
                currentMTU: interfaceData.currentMTU || '',
                recommendedMTU: interfaceData.recommendedMTU || ''
            });
        });
    }
};

const createPatchData = (
    config: AssessmentItem,
    details: any[],
    instanceKey: string,
    headerText: string,
    databaseType?: string
) => {
    const instances = config[instanceKey as keyof AssessmentItem] as any[];
    if (instances && instances.length > 0) {
        details.push({}, {});

        const isOracle = databaseType === DBType.ORACLE;
        const idColumnName = isOracle ? 'CVE ID' : 'KB';

        if (config.name === 'oracle-security-patch') {
            details.push({
                [idColumnName]: headerText,
                Component: '',
                Description: '',
                'Published Date': ''
            });

            details.push({
                [idColumnName]: idColumnName,
                Component: 'Component',
                Description: 'Description',
                'Published Date': 'Published Date'
            });
        } else if (isOracle && config.name === 'host-os-patch') {
            details.push({
                Component: headerText,
                'Package name': '',
                'Update type': '',
                Severity: ''
            });

            details.push({
                Component: 'Component',
                'Package name': 'Package name',
                'Update type': 'Update type',
                Severity: 'Severity'
            });
        } else {
            details.push({
                [idColumnName]: headerText,
                Name: '',
                Classification: '',
                Severity: ''
            });

            details.push({
                [idColumnName]: idColumnName,
                Name: 'Name',
                Classification: 'Classification',
                Severity: 'Severity'
            });
        }

        instances.forEach((instanceData: any) => {
            if (config.name === 'oracle-security-patch') {
                if (instanceData.missingPatches && instanceData.missingPatches.length > 0) {
                    instanceData.missingPatches.forEach((patch: any) => {
                        details.push({
                            [idColumnName]: patch.cveId || 'N/A',
                            Component: patch.component || 'N/A',
                            Description: patch.description || 'N/A',
                            'Published Date': patch.releaseDate || 'N/A'
                        });
                    });
                }
            } else if (
                isOracle &&
                config.name === 'host-os-patch' &&
                instanceData.missingPatchDetails &&
                instanceData.missingPatchDetails.length > 0
            ) {
                instanceData.missingPatchDetails.forEach((patch: any) => {
                    details.push({
                        Component: patch.cveIds || 'N/A',
                        'Package name': patch.title || 'N/A',
                        'Update type': patch.classification || 'N/A',
                        Severity: patch.severity || 'N/A'
                    });
                });
            } else if (instanceData.missingPatchDetails && instanceData.missingPatchDetails.length > 0) {
                instanceData.missingPatchDetails.forEach((patch: any) => {
                    details.push({
                        [idColumnName]: patch.kbId || 'N/A',
                        Name: patch.title || 'N/A',
                        Classification: patch.classification || 'N/A',
                        Severity: patch.severity || 'N/A'
                    });
                });
            }
        });
    }
};

const createSQLLicenseData = (config: AssessmentItem, details: any[]) => {
    if (config.sqlServerInstances && config.sqlServerInstances.length > 0) {
        details.push({}, {});

        details.push({
            'SQL Server Instance': 'SQL Instances License details',
            'SQL Server State': '',
            'SQL Server Version': '',
            'SQL Server Edition': '',
            'Product Year': '',
            'SQL Server Name': ''
        });

        details.push({
            'SQL Server Instance': 'SQL Server Instance',
            'SQL Server State': 'SQL Server State',
            'SQL Server Version': 'SQL Server Version',
            'SQL Server Edition': 'SQL Server Edition',
            'Product Year': 'Product Year',
            'SQL Server Name': 'SQL Server Name'
        });

        config.sqlServerInstances.forEach((instance: any) => {
            details.push({
                'SQL Server Instance': instance.sqlServerInstance || 'N/A',
                'SQL Server State': instance.sqlServerState || 'N/A',
                'SQL Server Version': instance.sqlServerVersion || 'N/A',
                'SQL Server Edition': instance.sqlServerEdition || 'N/A',
                'Product Year': instance.sqlServerProductYear?.toString() || 'N/A',
                'SQL Server Name': instance.sqlServerName || 'N/A'
            });
        });
    }
};

const createRSSConfigData = (config: AssessmentItem, details: any[]) => {
    details.push({}, {});

    details.push({
        Setting: 'Setting',
        Value: 'Value'
    });

    if (config.recommendedAdapterSettings) {
        const settings = config.recommendedAdapterSettings;

        if (settings.recommendedRssProfile) {
            details.push({
                Setting: 'RSS Profile',
                Value: settings.recommendedRssProfile
            });
        }

        if (settings.recommendedBaseProcessorNumber !== undefined) {
            details.push({
                Setting: 'Base Processor Number',
                Value: settings.recommendedBaseProcessorNumber.toString()
            });
        }

        if (settings.recommendedReceiveQueues) {
            details.push({
                Setting: 'Receive Queues',
                Value: settings.recommendedReceiveQueues.toString()
            });
        }
    }

    if (config.tcpOffloadState) {
        details.push({
            Setting: 'TCP Offload State',
            Value: config.tcpOffloadState
        });
    }

    details.push({}, {});

    details.push({
        'Adapter Name': 'Adapter Name',
        'RSS Enabled': 'RSS Enabled',
        'RSS Profile': 'RSS Profile',
        'Base Processor Number': 'Base Processor Number',
        'Number of Receive Queues': 'Number of Receive Queues'
    });

    if (config.rssAdapters && config.rssAdapters.length > 0) {
        config.rssAdapters.forEach((adapter: any) => {
            details.push({
                'Adapter Name': adapter.adapterName || '',
                'RSS Enabled': adapter.rssEnabled ? 'True' : 'False',
                'RSS Profile': adapter.rssProfile || '',
                'Base Processor Number': adapter.baseProcessorNumber?.toString() || '',
                'Number of Receive Queues': adapter.numberOfReceiveQueues?.toString() || ''
            });
        });
    }
};

const createDriveSizeData = (config: AssessmentItem, details: any[], columns: any, isLogDrive = false) => {
    if (!config.sizingViolations) return;

    details.push({}, {});

    const headerObj: any = { [Object.keys(columns)[0]]: 'Impacted resources' };
    Object.keys(columns)
        .slice(1)
        .forEach(key => {
            headerObj[key] = '';
        });
    details.push(headerObj);

    details.push(columns);

    const addViolationData = (violations: any[], violationType: string) => {
        violations?.forEach((drive: any) => {
            const dataObj: any = { 'Violation Type': violationType };

            if (isLogDrive) {
                dataObj.Databases = (drive.databases || []).join(', ');
                dataObj['Drive name'] = drive.logAccessPath || '';
                dataObj['Data Drive Total Size MB'] = drive.dataDriveTotalSizeMB?.toString() || '';
                dataObj['Log Drive Total Size MB'] = drive.logDriveTotalSizeMB?.toString() || '';
                dataObj['ONTAP Volume Name'] = drive.ontapVolumeName || '';
                dataObj['Size Percent To Data Drive'] = drive.sizePercentToDataDrive?.toString() || '';
            } else {
                dataObj['ONTAP Volume Name'] = drive.ontapVolumeName || '';
                dataObj['Data Drive Total Size MB'] = drive.dataDriveTotalSizeMB?.toString() || '';
                dataObj['Size Percent To Data Drive'] = drive.sizePercentToDataDrive?.toString() || '';
            }

            details.push(dataObj);
        });
    };

    addViolationData(config.sizingViolations.overProvisionedDrives, 'Over-Provisioned');
    addViolationData(config.sizingViolations.underProvisionedDrives, 'Under-Provisioned');
    addViolationData(config.sizingViolations.ignoredDrives, 'Ignored');
};

const createComputeRightsizingData = (config: AssessmentItem, details: any[]) => {
    if (config.recommendationOptions && config.recommendationOptions.length > 0) {
        details.push({}, {});

        details.push({
            'Instance Type': 'Recommendation Options',
            Rank: '',
            'Savings Opportunity Percentage': '',
            'Estimated Monthly Savings Value': '',
            Currency: ''
        });

        details.push({
            'Instance Type': 'Instance Type',
            Rank: 'Rank',
            'Savings Opportunity Percentage': 'Savings Opportunity Percentage',
            'Estimated Monthly Savings Value': 'Estimated Monthly Savings Value',
            Currency: 'Currency'
        });

        config.recommendationOptions.forEach((option: any) => {
            details.push({
                'Instance Type': option.instanceType || '',
                Rank: option.rank?.toString() || '',
                'Savings Opportunity Percentage':
                    option.savingsOpportunity?.savingsOpportunityPercentage?.toString() || '',
                'Estimated Monthly Savings Value':
                    option.savingsOpportunity?.estimatedMonthlySavings?.value?.toString() || '',
                Currency: option.savingsOpportunity?.estimatedMonthlySavings?.currency || ''
            });
        });
    }

    if (config.objectsInViolation && config.objectsInViolation.length > 0) {
        details.push({}, {}, {});

        details.push({
            'Violation Type': 'Objects in Violation'
        });

        details.push({
            'Violation Type': 'Violation Type'
        });

        config.objectsInViolation.forEach((violation: string) => {
            details.push({
                'Violation Type': violation
            });
        });
    }
};

const createBaseConfigurationObject = (
    config: AssessmentItem,
    databaseType: string,
    data: ComprehensiveAssessmentData
) => ({
    'Configuration name': getConfigurationDisplayName(config.name, databaseType),
    ...(config.status && { Status: config.status }),
    ...(config.severity && { Severity: config.severity }),
    ...(config.recommendation && { Recommendation: config.recommendation }),
    ...(config.current && { Current: config.current }),
    ...(config.tags?.length && { Tags: config.tags.join(', ') }),
    'Action Summary':
        getActionSummaryMessages(
            getConfigurationDisplayName(config.name, databaseType),
            databaseType,
            config.objectsInViolation,
            data?.deploymentType,
            data?.baseDeploymentType
        ) || 'n/a',
    'Impacted resources (X out of Y)':
        'errorMessage' in config && config.errorMessage
            ? config.errorMessage
            : typeof config.totalObjectsAssessed === 'number'
            ? `${config.totalObjectsInViolation || 0} out of ${config.totalObjectsAssessed}`
            : 'n/a'
});

const createCloneManagementData = (config: AssessmentItem, details: any[]) => {
    const oldCloneDetails = config.oldCloneDetails || [];

    if (oldCloneDetails && oldCloneDetails.length > 0) {
        details.push({}, {});

        details.push({
            'Clone database name': 'Impacted Resources'
        });

        details.push({
            'Clone database name': 'Clone database name',
            'Source database': 'Source database',
            'Source volume': 'Source volume',
            'Clone age': 'Clone age',
            'Cloned by': 'Cloned by'
        });

        oldCloneDetails.forEach((clone: any) => {
            let sourceDatabase = '';
            if (clone.sourceDatabaseName) {
                sourceDatabase = clone.sourceDatabaseName;
                if (clone.sourceDatabaseHostName) {
                    sourceDatabase = `${clone.sourceDatabaseHostName}/${sourceDatabase}`;
                }
                if (clone.sourceDatabaseInstanceName && clone.sourceDatabaseInstanceName !== 'MSSQLSERVER') {
                    sourceDatabase = `${sourceDatabase} (${clone.sourceDatabaseInstanceName})`;
                }
            }

            if (!sourceDatabase) {
                sourceDatabase = 'n/a';
            }

            let sourceVolumeNames = '';
            if (clone.clonedVolumeDetails && clone.clonedVolumeDetails.length > 0) {
                const sourceVolumes = Array.from(
                    new Set(
                        clone.clonedVolumeDetails.map((vol: any) => vol.sourceVolumeName).filter((name: string) => name)
                    )
                );
                sourceVolumeNames = sourceVolumes.join(', ');
            }

            let clonedBy = clone.clonedBy || 'other';
            if (clonedBy === 'netapp_wf') {
                clonedBy = 'NetApp Workload Factory (Sandboxes)';
            } else {
                clonedBy = 'Outside Workload Factory';
            }

            details.push({
                'Clone database name': clone.cloneDatabaseName || '',
                'Source database': sourceDatabase,
                'Source volume': sourceVolumeNames,
                'Clone age': clone.cloneAge ? `${clone.cloneAge} days` : '',
                'Cloned by': clonedBy
            });
        });
    }
};

const createViolationDetailsData = (config: AssessmentItem, details: any[]) => {
    const configHandlers: { [key: string]: () => void } = {
        'thin-provision': () => createSimpleViolationData(config, details, 'Volume Names'),
        'snapshot-autodelete': () => createSimpleViolationData(config, details, 'Volume Names'),
        autosize: () => createSimpleViolationData(config, details, 'Volume Names'),
        'autosize-mode': () => createSimpleViolationData(config, details, 'Volume Names'),
        'space-mgmt-try-first': () => createSimpleViolationData(config, details, 'Volume Names'),
        'space-reservation-enabled': () => createSimpleViolationData(config, details, 'LUN Names'),
        'space-allocation-allocated': () => createSimpleViolationData(config, details, 'LUN Names'),
        'fractional-reserve': () =>
            createTwoColumnViolationData(config, details, 'Volume Names', 'Current Value in percentage'),
        'snapshot-copy-reserve': () =>
            createTwoColumnViolationData(config, details, 'Volume Names', 'Current Value in percentage'),
        'performance-tier': () => createTwoColumnViolationData(config, details, 'Volume Names', 'Current Value'),
        'tiering-policy': () => createTwoColumnViolationData(config, details, 'Volume name', 'Tiering policy'),
        'heartbeat-settings': () =>
            createTwoColumnViolationData(config, details, 'Configuration Name', 'Current Value'),
        'cluster-quorum': () => createTwoColumnViolationData(config, details, 'Configuration Name', 'Current Value'),
        'drive-letter': () => createTwoColumnViolationData(config, details, 'Configuration Name', 'Current Value'),
        'tiering-min-cooling-days': () => createTwoColumnViolationData(config, details, 'Volume name', 'Current Value'),
        'os-type': () => createTwoColumnViolationData(config, details, 'LUN Names', 'Current Value'),
        'ntfs-allocation-unit-size': () =>
            createTwoColumnViolationData(config, details, 'Drive Letter', 'Current Value'),
        'mpio-load-balance-policy': () => createTwoColumnViolationData(config, details, 'Drive Letter', 'Current Value')
    };

    const handler = configHandlers[config.name];
    if (handler) {
        handler();
    } else {
        // Fallback: treat unknown configurations as two-column tables
        createTwoColumnViolationData(config, details, 'Object Name', 'Current Value');
    }
};

const createSimpleViolationData = (config: AssessmentItem, details: any[], headerText: string) => {
    addImpactedResourcesHeader(details);

    details.push({
        'Configuration name': headerText
    });

    config.violationDetails?.forEach((violation: any) => {
        if (violation.objectName) {
            details.push({
                'Configuration name': violation.objectName
            });
        }
    });
};

const createTwoColumnViolationData = (
    config: AssessmentItem,
    details: any[],
    firstColumn: string,
    secondColumn: string
) => {
    addImpactedResourcesHeader(details, true);

    details.push({
        'Configuration name': firstColumn,
        Status: secondColumn
    });

    config.violationDetails?.forEach((violation: any) => {
        if (violation.objectName) {
            details.push({
                'Configuration name': violation.objectName,
                Status: violation.value || ''
            });
        }
    });
};

const createObjectsInViolationData = (config: AssessmentItem, details: any[], headerText: string) => {
    if (!config.objectsInViolation?.length) return;

    addImpactedResourcesHeader(details);

    details.push({
        'Configuration name': headerText
    });

    config.objectsInViolation.forEach((item: any) => {
        const value = typeof item === 'string' ? item : item.ontapVolumeName || item.objectName || '';
        details.push({
            'Configuration name': value
        });
    });
};

function generateDetailedConfigurationData(
    data: ComprehensiveAssessmentData,
    configName: string,
    databaseType: string
) {
    const allItems = getAllItems(data);
    const config = allItems.find(item => item.name === configName);

    if (!config) {
        return [
            {
                'Configuration name': getConfigurationDisplayName(configName, databaseType),
                Status: 'No data available',
                Details: 'Configuration not found in assessment data'
            }
        ];
    }

    const details: any[] = [];

    // Base configuration info
    const baseConfig = createBaseConfigurationObject(config, databaseType, data);

    details.push(baseConfig);

    // Check if second table should be generated
    if (config.status === 'optimized' || config.status === 'n/a') {
        return details;
    }

    // Special configuration handlers
    const specialHandlers: { [key: string]: () => void } = {
        'mtu-alignment': () => createMTUAlignmentData(config, details),
        'mssql-patch': () =>
            createPatchData(config, details, 'missingPatchesInEc2Instances', 'Impacted resources', databaseType),
        'host-os-patch': () =>
            createPatchData(config, details, 'ec2InstancesToPatch', 'Impacted resources', databaseType),
        'oracle-security-patch': () =>
            createPatchData(config, details, 'missingPatchDetails', 'Impacted resources', databaseType),
        'sql-license': () => createSQLLicenseData(config, details),
        'rss-config': () => createRSSConfigData(config, details),
        'log-drive-size': () =>
            createDriveSizeData(
                config,
                details,
                {
                    Databases: 'Databases',
                    'Drive name': 'Drive name',
                    'Data Drive Total Size MB': 'Data Drive Total Size MB',
                    'Log Drive Total Size MB': 'Log Drive Total Size MB',
                    'ONTAP Volume Name': 'ONTAP Volume Name',
                    'Size Percent To Data Drive': 'Size Percent To Data Drive',
                    'Violation Type': 'Violation Type'
                },
                true
            ),
        'tempdb-drive-size': () =>
            createDriveSizeData(config, details, {
                'ONTAP Volume Name': 'ONTAP Volume Name',
                'Data Drive Total Size MB': 'Data Drive Total Size MB',
                'Size Percent To Data Drive': 'Size Percent To Data Drive',
                'Violation Type': 'Violation Type'
            }),
        'compute-rightsizing': () => createComputeRightsizingData(config, details),
        'clone-management': () => createCloneManagementData(config, details),
        'shared-storage': () => createObjectsInViolationData(config, details, 'LUN Names'),
        'tempdb-files-location': () => createObjectsInViolationData(config, details, 'Databases'),
        'data-files-location': () => createObjectsInViolationData(config, details, 'Databases'),
        'log-files-location': () => createObjectsInViolationData(config, details, 'Databases')
    };

    const handler = specialHandlers[config.name];
    if (handler) {
        handler();
    } else if (config.violationDetails && config.violationDetails.length > 0) {
        createViolationDetailsData(config, details);
    } else if (config.name === 'backup-configuration') {
        addImpactedResourcesHeader(details, true);

        details.push({
            'Configuration name': 'ONTAP Volume Name',
            Status: 'ONTAP Volume UUID'
        });

        config.objectsInViolation?.forEach((violation: any) => {
            if (violation && typeof violation === 'object') {
                details.push({
                    'Configuration name': violation.ontapVolumeName || '',
                    Status: violation.ontapVolumeUuid || ''
                });
            }
        });
    } else if (config.objectsInViolation && config.objectsInViolation.length > 0) {
        addImpactedResourcesHeader(details);

        details.push({
            'Configuration name': 'Objects in violation'
        });

        config.objectsInViolation.forEach((violation: string) => {
            details.push({
                'Configuration name': violation
            });
        });
    }

    return details;
}

// Styling Functions
function applyCellStyle(cell: ExcelJS.Cell, style: any) {
    if (style.fill) cell.fill = style.fill;
    if (style.font) cell.font = style.font;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
}

function styleImpactedResourcesHeader(worksheet: ExcelJS.Worksheet, rowIndex: number, columnSpan: number = 1): void {
    const style = createCellStyle(
        COLORS.STEEL_BLUE,
        { bold: true, color: { argb: COLORS.WHITE } },
        { horizontal: 'center', vertical: 'middle', wrapText: true }
    );

    for (let col = 1; col <= columnSpan; col += 1) {
        applyCellStyle(worksheet.getCell(rowIndex, col), style);
    }

    worksheet.getRow(rowIndex).height = 25;
}

function styleFilterHeaders(worksheet: ExcelJS.Worksheet, rowIndex: number, columnCount: number): void {
    const style = createCellStyle(
        COLORS.SKY_BLUE,
        { bold: true, color: { argb: COLORS.BLACK } },
        { horizontal: 'center', vertical: 'middle', wrapText: true }
    );

    for (let col = 1; col <= columnCount; col += 1) {
        applyCellStyle(worksheet.getCell(rowIndex, col), style);
    }

    worksheet.getRow(rowIndex).height = 25;
}

function addHeaderStyling(worksheet: ExcelJS.Worksheet, data: any[]): void {
    if (!data || data.length === 0) return;

    const columns = Object.keys(data[0] || {});
    worksheet.getRow(1).height = 25;

    const headerStyle = createCellStyle(
        COLORS.LIGHT_BLUE,
        { bold: true, color: { argb: COLORS.BLACK } },
        { horizontal: 'center', vertical: 'middle', wrapText: true }
    );

    columns.forEach((columnKey, index) => {
        const cell = worksheet.getCell(1, index + 1);
        cell.value = columnKey.toUpperCase();
        applyCellStyle(cell, headerStyle);
    });
}

function styleDataRows(
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
): void {
    const dataStyle = createCellStyle(COLORS.WHITE, undefined, {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: true
    });

    for (let row = startRow; row <= endRow; row += 1) {
        for (let col = startCol; col <= endCol; col += 1) {
            applyCellStyle(worksheet.getCell(row, col), dataStyle);
        }
    }
}

function styleTableBorders(
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
): void {
    for (let row = startRow; row <= endRow; row += 1) {
        for (let col = startCol; col <= endCol; col += 1) {
            const cell = worksheet.getCell(row, col);
            cell.border = {
                top: { style: 'thin', color: { argb: COLORS.BLACK } },
                left: { style: 'thin', color: { argb: COLORS.BLACK } },
                bottom: { style: 'thin', color: { argb: COLORS.BLACK } },
                right: { style: 'thin', color: { argb: COLORS.BLACK } }
            };
        }
    }
}

// Worksheet Functions
function addDataToWorksheet(worksheet: ExcelJS.Worksheet, data: any[]): void {
    if (!data || data.length === 0) return;

    const allColumns = new Set<string>();
    data.forEach(row => {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(key => allColumns.add(key));
        }
    });

    const columns = Array.from(allColumns);

    columns.forEach((header, index) => {
        worksheet.getCell(1, index + 1).value = header;
    });

    data.forEach((row, rowIndex) => {
        columns.forEach((column, colIndex) => {
            worksheet.getCell(rowIndex + 2, colIndex + 1).value = row[column] || '';
        });
    });
}

// Column width constants for autoFitColumns
const COLUMN_WIDTH_PADDING = 3;
const MIN_COLUMN_WIDTH = 10;
const MAX_COLUMN_WIDTH = 60;

function autoFitColumns(worksheet: ExcelJS.Worksheet, data: any[]): void {
    if (!data || data.length === 0) return;

    const allKeys = new Set<string>();
    data.forEach(row => {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(key => allKeys.add(key));
        }
    });

    const keys = Array.from(allKeys);
    keys.forEach((key, index) => {
        let maxWidth = key.length;

        data.forEach(row => {
            if (row && row[key] !== undefined && row[key] !== null) {
                const cellValue = row[key].toString();
                maxWidth = Math.max(maxWidth, cellValue.length);
            }
        });

        if (key.toUpperCase() === 'RECOMMENDATION') {
            maxWidth = Math.max(maxWidth, 20);
        } else if (key.includes('Savings Opportunity Percentage')) {
            maxWidth = Math.max(maxWidth, 25);
        } else if (key.includes('Estimated Monthly Savings Value')) {
            maxWidth = Math.max(maxWidth, 25);
        } else if (key === 'Instance Type') {
            maxWidth = Math.max(maxWidth, 15);
        } else if (key === 'Violation Type') {
            maxWidth = Math.max(maxWidth, 30);
        }

        const width = Math.min(Math.max(maxWidth + COLUMN_WIDTH_PADDING, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH);
        worksheet.getColumn(index + 1).width = width;
    });
}

function addAutoFilter(worksheet: ExcelJS.Worksheet, data: any[]): void {
    if (!data || data.length === 0) return;

    const rowCount = data.length;
    const colCount = Object.keys(data[0] || {}).length;

    if (colCount > 0) {
        worksheet.autoFilter = {
            from: 'A1',
            to: `${String.fromCharCode(65 + colCount - 1)}${rowCount}`
        };
    }
}

// Multi-table worksheet function
function addMultiTableDataToWorksheet(worksheet: ExcelJS.Worksheet, data: any[], configName: string): void {
    if (!data || data.length === 0) return;

    if (configName === 'rss-config') {
        addRSSConfigToWorksheet(worksheet, data);
        return;
    }

    if (configName === 'compute-rightsizing') {
        addComputeRightsizingToWorksheet(worksheet, data);
        return;
    }

    if (configName === 'clone-management') {
        addCloneManagementToWorksheet(worksheet, data);
        return;
    }

    const secondTableMarkers = [
        'Impacted resources',
        'SQL Instances License details',
        'Recommended Adapter Settings',
        'Recommendation Options'
    ];

    let secondTableIndex = -1;
    for (let i = 0; i < data.length; i += 1) {
        const row = data[i];
        if (row && secondTableMarkers.some(marker => Object.values(row).includes(marker))) {
            secondTableIndex = i;
            break;
        }
    }

    if (secondTableIndex === -1) {
        addDataToWorksheet(worksheet, data);
        return;
    }

    const baseConfigData = data.slice(0, secondTableIndex);
    const secondTableData = data.slice(secondTableIndex);

    // Add base configuration table
    const baseColumns = new Set<string>();
    baseConfigData.forEach(row => {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(key => baseColumns.add(key));
        }
    });
    const baseColumnArray = Array.from(baseColumns);

    baseColumnArray.forEach((header, index) => {
        worksheet.getCell(1, index + 1).value = header;
    });

    baseConfigData.forEach((row, rowIndex) => {
        if (row && Object.keys(row).length > 0) {
            baseColumnArray.forEach((column, colIndex) => {
                worksheet.getCell(rowIndex + 2, colIndex + 1).value = row[column] || '';
            });
        }
    });

    // Add second table starting from row 5
    const secondTableColumns = new Set<string>();
    secondTableData.forEach((row: any) => {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(key => secondTableColumns.add(key));
        }
    });
    const secondTableColumnArray = Array.from(secondTableColumns);
    const secondTableStartRow = 5;

    secondTableData.forEach((row: any, rowIndex: number) => {
        if (row && Object.keys(row).length > 0) {
            secondTableColumnArray.forEach((column, colIndex) => {
                const excelRow = secondTableStartRow + rowIndex;
                const excelCol = colIndex + 1;
                worksheet.getCell(excelRow, excelCol).value = row[column] || '';
            });
        }
    });
}

// Utility functions for table creation
interface TableConfig<T = any> {
    title: string;
    columnHeaders: string[];
    columnSpan: number;
    dataExtractor: (row: T) => string[];
    dataFilter: (row: T) => boolean;
}

function createBaseConfigTable(worksheet: ExcelJS.Worksheet, data: any[], startRow: number = 1): number {
    if (!data.length) return startRow;

    const baseColumns = Object.keys(data[0] || {});

    // Add headers
    baseColumns.forEach((header, index) => {
        const cell = worksheet.getCell(startRow, index + 1);
        cell.value = header.toUpperCase();
        applyCellStyle(
            cell,
            createCellStyle(
                COLORS.LIGHT_BLUE,
                { bold: true, color: { argb: COLORS.BLACK } },
                { horizontal: 'center', vertical: 'middle', wrapText: true }
            )
        );
    });

    // Add data rows
    data.forEach((row, rowIndex) => {
        if (row && Object.keys(row).length > 0) {
            baseColumns.forEach((column, colIndex) => {
                const cell = worksheet.getCell(startRow + rowIndex + 1, colIndex + 1);
                cell.value = row[column] || '';
                applyCellStyle(
                    cell,
                    createCellStyle(COLORS.WHITE, undefined, {
                        horizontal: 'left',
                        vertical: 'middle',
                        wrapText: true
                    })
                );
            });
        }
    });

    // Apply styling
    const endRow = startRow + data.length;
    styleTableBorders(worksheet, startRow, endRow, 1, baseColumns.length);
    worksheet.getRow(startRow).height = 25;

    return endRow + 2;
}

function createStyledTable(worksheet: ExcelJS.Worksheet, config: TableConfig, data: any[], startRow: number): number {
    const filteredData = data.filter(config.dataFilter);
    if (!filteredData.length) return startRow;

    let currentRow = startRow;

    // Add table header
    const headerCell = worksheet.getCell(currentRow, 1);
    headerCell.value = config.title;
    worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + config.columnSpan)}${currentRow}`);
    applyCellStyle(
        headerCell,
        createCellStyle(
            COLORS.STEEL_BLUE,
            { bold: true, color: { argb: COLORS.WHITE } },
            { horizontal: 'center', vertical: 'middle', wrapText: true }
        )
    );
    worksheet.getRow(currentRow).height = 25;
    currentRow++;

    // Add column headers
    config.columnHeaders.forEach((header, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);
        cell.value = header;
        applyCellStyle(
            cell,
            createCellStyle(
                COLORS.SKY_BLUE,
                { bold: true, color: { argb: COLORS.BLACK } },
                { horizontal: 'center', vertical: 'middle', wrapText: true }
            )
        );
    });
    worksheet.getRow(currentRow).height = 25;
    currentRow++;

    // Add data rows
    const dataStartRow = currentRow;
    filteredData.forEach(row => {
        const dataValues = config.dataExtractor(row);
        dataValues.forEach((value, colIndex) => {
            const cell = worksheet.getCell(currentRow, colIndex + 1);
            cell.value = value;
            applyCellStyle(
                cell,
                createCellStyle(COLORS.WHITE, undefined, {
                    horizontal: 'left',
                    vertical: 'middle',
                    wrapText: true
                })
            );
        });
        currentRow++;
    });

    // Apply borders and auto-filter
    const tableEndRow = currentRow - 1;
    styleTableBorders(worksheet, dataStartRow - 2, tableEndRow, 1, config.columnSpan);

    if (tableEndRow >= dataStartRow) {
        const endColumn = String.fromCharCode(64 + config.columnSpan);
        worksheet.autoFilter = {
            from: `A${dataStartRow - 1}`,
            to: `${endColumn}${tableEndRow}`
        };
    }

    return currentRow + 1;
}

function addComputeRightsizingToWorksheet(worksheet: ExcelJS.Worksheet, data: any[]): void {
    if (!data || data.length === 0) return;

    const recommendationOptionsStart = data.findIndex(row => row && row['Instance Type'] === 'Recommendation Options');
    const objectsInViolationStart = data.findIndex(row => row && row['Violation Type'] === 'Objects in Violation');

    // Process base configuration data
    const baseConfigData = data.slice(
        0,
        Math.min(
            recommendationOptionsStart >= 0 ? recommendationOptionsStart : data.length,
            objectsInViolationStart >= 0 ? objectsInViolationStart : data.length
        )
    );

    let nextAvailableRow = 1;
    if (baseConfigData.length > 0) {
        nextAvailableRow = createBaseConfigTable(worksheet, baseConfigData);
    }

    // Process recommendation options table
    if (recommendationOptionsStart >= 0) {
        const recommendationEndIndex =
            objectsInViolationStart >= 0
                ? data.findIndex(
                      (row, idx) => idx > recommendationOptionsStart && (!row || Object.keys(row).length === 0)
                  )
                : data.length;

        const recommendationData = data.slice(
            recommendationOptionsStart,
            recommendationEndIndex > 0 ? recommendationEndIndex : data.length
        );

        const recommendationConfig: TableConfig = {
            title: 'Recommendation Options',
            columnHeaders: [
                'Instance Type',
                'Rank',
                'Savings Opportunity Percentage',
                'Estimated Monthly Savings Value',
                'Currency'
            ],
            columnSpan: 5,
            dataFilter: row =>
                row &&
                Object.keys(row).length > 0 &&
                row['Instance Type'] &&
                row['Instance Type'] !== 'Recommendation Options' &&
                row['Instance Type'] !== 'Instance Type',
            dataExtractor: row => [
                row['Instance Type'],
                row.Rank || '',
                row['Savings Opportunity Percentage'] || '',
                row['Estimated Monthly Savings Value'] || '',
                row.Currency || ''
            ]
        };

        nextAvailableRow = createStyledTable(worksheet, recommendationConfig, recommendationData, nextAvailableRow);
    }

    // Process objects in violation table
    if (objectsInViolationStart >= 0) {
        const violationData = data.slice(objectsInViolationStart);

        const violationConfig: TableConfig = {
            title: 'Objects in Violation',
            columnHeaders: ['Violation Type'],
            columnSpan: 1,
            dataFilter: row => row && Object.keys(row).length > 0 && row['Violation Type'],
            dataExtractor: row => [row['Violation Type']]
        };

        createStyledTable(worksheet, violationConfig, violationData, nextAvailableRow);
    }
}

function addRSSConfigToWorksheet(worksheet: ExcelJS.Worksheet, data: any[]): void {
    if (!data || data.length === 0) return;

    // Find table boundaries
    const recommendedSettingsIndex = data.findIndex(row => row && row.Setting === 'Setting' && row.Value === 'Value');
    const rssAdaptersIndex = data.findIndex(
        row => row && row['Adapter Name'] === 'Adapter Name' && row['RSS Enabled'] === 'RSS Enabled'
    );

    // Process base configuration data
    const baseConfigData = data.slice(
        0,
        Math.min(
            recommendedSettingsIndex > 0 ? recommendedSettingsIndex - 2 : data.length,
            rssAdaptersIndex > 0 ? rssAdaptersIndex - 2 : data.length
        )
    );

    let nextAvailableRow = 1;
    if (baseConfigData.length > 0) {
        nextAvailableRow = createBaseConfigTable(worksheet, baseConfigData);
    }

    // Start recommended settings table at row 5 as requested
    nextAvailableRow = 5;

    // Process recommended adapter settings
    if (recommendedSettingsIndex >= 0) {
        const recommendedEndIndex =
            rssAdaptersIndex >= 0
                ? data.findIndex(
                      (row, idx) => idx > recommendedSettingsIndex && (!row || Object.keys(row).length === 0)
                  )
                : data.length;

        const recommendedData = data.slice(
            recommendedSettingsIndex + 1,
            recommendedEndIndex > 0 ? recommendedEndIndex : data.length
        );

        const recommendedConfig: TableConfig = {
            title: 'Recommended Adapter Settings',
            columnHeaders: ['Setting', 'Value'],
            columnSpan: 2,
            dataFilter: row => row && Object.keys(row).length > 0 && row.Setting && row.Setting !== 'Setting',
            dataExtractor: row => [row.Setting, row.Value || '']
        };

        nextAvailableRow = createStyledTable(worksheet, recommendedConfig, recommendedData, nextAvailableRow);
    }

    // Process RSS adapters table
    if (rssAdaptersIndex >= 0) {
        const rssData = data.slice(rssAdaptersIndex + 1);

        const rssConfig: TableConfig = {
            title: 'RSS Adapters',
            columnHeaders: [
                'Adapter Name',
                'RSS Enabled',
                'RSS Profile',
                'Base Processor Number',
                'Number of Receive Queues'
            ],
            columnSpan: 5,
            dataFilter: row =>
                row && Object.keys(row).length > 0 && row['Adapter Name'] && row['Adapter Name'] !== 'Adapter Name',
            dataExtractor: row => [
                row['Adapter Name'],
                row['RSS Enabled'] || '',
                row['RSS Profile'] || '',
                row['Base Processor Number'] || '',
                row['Number of Receive Queues'] || ''
            ]
        };

        createStyledTable(worksheet, rssConfig, rssData, nextAvailableRow);
    }
}

function addCloneManagementToWorksheet(worksheet: ExcelJS.Worksheet, data: any[]): void {
    if (!data || data.length === 0) return;

    const impactedResourcesStart = data.findIndex(row => row && row['Clone database name'] === 'Impacted Resources');

    const baseConfigData = impactedResourcesStart > 0 ? data.slice(0, impactedResourcesStart) : data;

    let nextAvailableRow = 1;
    if (baseConfigData.length > 0) {
        nextAvailableRow = createBaseConfigTable(worksheet, baseConfigData);
    }

    if (impactedResourcesStart >= 0) {
        const impactedData = data.slice(impactedResourcesStart + 1);

        const impactedConfig: TableConfig = {
            title: 'Impacted Resources',
            columnHeaders: ['Clone database name', 'Source database', 'Source volume', 'Clone age', 'Cloned by'],
            columnSpan: 5,
            dataFilter: row =>
                row &&
                Object.keys(row).length > 0 &&
                row['Clone database name'] &&
                row['Clone database name'] !== 'Clone database name',
            dataExtractor: row => [
                row['Clone database name'],
                row['Source database'] || '',
                row['Source volume'] || '',
                row['Clone age'] || '',
                row['Cloned by'] || ''
            ]
        };

        createStyledTable(worksheet, impactedConfig, impactedData, nextAvailableRow);
    }
}

const applySpecialConfigurationStyling = (
    worksheet: ExcelJS.Worksheet,
    configName: string,
    configDetails: any[],
    impactedResourcesRowIndex: number,
    filterHeaderRowIndex: number,
    databaseType?: string
) => {
    const violationTableEndRow = configDetails.length + 1;

    if (TWO_COLUMN_CONFIGS.includes(configName)) {
        worksheet.mergeCells(`A${impactedResourcesRowIndex}:B${impactedResourcesRowIndex}`);
        styleTableBorders(worksheet, impactedResourcesRowIndex, violationTableEndRow, 1, 2);
        styleDataRows(worksheet, filterHeaderRowIndex + 1, violationTableEndRow, 1, 2);
        styleImpactedResourcesHeader(worksheet, impactedResourcesRowIndex, 2);
        styleFilterHeaders(worksheet, filterHeaderRowIndex, 2);
    } else if (SINGLE_COLUMN_CONFIGS.includes(configName)) {
        styleTableBorders(worksheet, impactedResourcesRowIndex, violationTableEndRow, 1, 1);
        styleDataRows(worksheet, filterHeaderRowIndex + 1, violationTableEndRow, 1, 1);
        styleImpactedResourcesHeader(worksheet, impactedResourcesRowIndex, 1);
        styleFilterHeaders(worksheet, filterHeaderRowIndex, 1);
    } else {
        // Handle special multi-column configurations
        const specialConfigs = {
            'mtu-alignment': 4,
            'mssql-patch': 3,
            'host-os-patch': databaseType === DBType.ORACLE ? 4 : 3,
            'oracle-security-patch': 4,
            'sql-license': 6,
            'rss-config': 2,
            'log-drive-size': 7,
            'tempdb-drive-size': 4
        };

        const columnCount = specialConfigs[configName as keyof typeof specialConfigs];
        if (columnCount) {
            const columnLetter = String.fromCharCode(64 + columnCount);
            worksheet.mergeCells(`A${impactedResourcesRowIndex}:${columnLetter}${impactedResourcesRowIndex}`);

            if (configName === 'log-drive-size') {
                // Special handling for log-drive-size
                styleTableBorders(worksheet, impactedResourcesRowIndex, violationTableEndRow, 1, columnCount);
                styleImpactedResourcesHeader(worksheet, impactedResourcesRowIndex, columnCount);
                styleFilterHeaders(worksheet, filterHeaderRowIndex, columnCount);
                styleDataRows(worksheet, filterHeaderRowIndex + 1, violationTableEndRow, 1, columnCount);
            } else {
                styleTableBorders(worksheet, impactedResourcesRowIndex, violationTableEndRow, 1, columnCount);
                styleDataRows(worksheet, filterHeaderRowIndex + 1, violationTableEndRow, 1, columnCount);
                styleImpactedResourcesHeader(worksheet, impactedResourcesRowIndex, columnCount);
                styleFilterHeaders(worksheet, filterHeaderRowIndex, columnCount);
            }
        } else {
            // Check if this is actually single-column data by looking at the data structure
            const hasOnlyConfigurationNameColumn =
                configDetails[4] &&
                Object.keys(configDetails[4]).length === 1 &&
                'Configuration name' in configDetails[4];

            if (hasOnlyConfigurationNameColumn) {
                // Treat as single-column configuration
                styleTableBorders(worksheet, impactedResourcesRowIndex, violationTableEndRow, 1, 1);
                styleDataRows(worksheet, filterHeaderRowIndex + 1, violationTableEndRow, 1, 1);
                styleImpactedResourcesHeader(worksheet, impactedResourcesRowIndex, 1);
                styleFilterHeaders(worksheet, filterHeaderRowIndex, 1);
            } else {
                // Fallback: treat unknown configurations with impacted resources as two-column configs
                worksheet.mergeCells(`A${impactedResourcesRowIndex}:B${impactedResourcesRowIndex}`);
                styleTableBorders(worksheet, impactedResourcesRowIndex, violationTableEndRow, 1, 2);
                styleDataRows(worksheet, filterHeaderRowIndex + 1, violationTableEndRow, 1, 2);
                styleImpactedResourcesHeader(worksheet, impactedResourcesRowIndex, 2);
                styleFilterHeaders(worksheet, filterHeaderRowIndex, 2);
            }
        }
    }
};

// Function to add hyperlink to Configuration Status sheet
function addConfigurationStatusHyperlink(worksheet: ExcelJS.Worksheet): void {
    // Find an empty cell on row 15 in the right area (let's use column I, row 1)
    const hyperlinkCell = worksheet.getCell('I1');

    hyperlinkCell.value = {
        text: '↖ Back to Configuration Status',
        hyperlink: "#'Configuration Status'!A1",
        tooltip: 'Navigate to Configuration Status sheet'
    };

    // Style the hyperlink
    hyperlinkCell.font = {
        color: { argb: 'FF0000FF' }, // Blue color
        underline: true,
        bold: true,
        size: 10
    };

    hyperlinkCell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
    };

    // Set column width to accommodate the text
    worksheet.getColumn('I').width = 25;
}

// Auto-filter configuration
const addConfigurationAutoFilter = (
    worksheet: ExcelJS.Worksheet,
    configName: string,
    configDetails: any[],
    filterHeaderRowIndex: number
) => {
    const dataEndRow = configDetails.length + 1;

    const autoFilterConfigs = {
        'snapshot-copy-reserve': { range: 'B', condition: 'Volume Names' },
        'performance-tier': { range: 'B', condition: 'Volume Names' },
        'fractional-reserve': { range: 'B', condition: 'Volume Names' },
        'tiering-policy': { range: 'B', condition: 'Volume name' },
        'heartbeat-settings': { range: 'B', condition: 'Configuration Name' },
        'cluster-quorum': { range: 'B', condition: 'Configuration Name' },
        'drive-letter': { range: 'B', condition: 'Configuration Name' },
        'backup-configuration': { range: 'B', condition: 'ONTAP Volume Name' },
        'log-drive-size': { range: 'G', condition: 'Databases' },
        'tempdb-drive-size': { range: 'D', condition: 'ONTAP Volume Name' }
    };

    const config = autoFilterConfigs[configName as keyof typeof autoFilterConfigs];
    if (config && configDetails[4] && configDetails[4]['Configuration name'] === config.condition) {
        worksheet.autoFilter = {
            from: `A${filterHeaderRowIndex}`,
            to: `${config.range}${dataEndRow}`
        };
    }

    // Single column configs
    if (SINGLE_COLUMN_CONFIGS.includes(configName)) {
        const hasVolumeNames = configDetails[4] && configDetails[4]['Configuration name'] === 'Volume Names';
        const hasDatabases = configDetails[4] && configDetails[4]['Configuration name'] === 'Databases';

        if (hasVolumeNames || hasDatabases) {
            worksheet.autoFilter = {
                from: `A${filterHeaderRowIndex}`,
                to: `A${dataEndRow}`
            };
        }
    }

    // Fallback: auto-filter for unknown configurations with violation details (treat as two-column)
    const allKnownConfigs = [...TWO_COLUMN_CONFIGS, ...SINGLE_COLUMN_CONFIGS, ...MULTI_TABLE_CONFIGS];
    if (
        !allKnownConfigs.includes(configName) &&
        configDetails[4] &&
        configDetails[4]['Configuration name'] === 'Object Name'
    ) {
        worksheet.autoFilter = {
            from: `A${filterHeaderRowIndex}`,
            to: `B${dataEndRow}`
        };
    }
};

// Main workbook generation function
async function generateProperXlsxWorkbook(
    data: ComprehensiveAssessmentData,
    databaseType: string
): Promise<{ fileName: string; arrayBuffer: ArrayBuffer }> {
    const workbook = new ExcelJS.Workbook();

    // 1. Generate General Information worksheet
    const { fileName, generalInfo } = generateGeneralInformationData(data, databaseType);
    const generalInfoSheet = workbook.addWorksheet('General Information');

    addDataToWorksheet(generalInfoSheet, [generalInfo]);
    autoFitColumns(generalInfoSheet, [generalInfo]);

    const generalInfoColumns = Object.keys(generalInfo).length;
    styleTableBorders(generalInfoSheet, 1, 2, 1, generalInfoColumns);
    styleDataRows(generalInfoSheet, 2, 2, 1, generalInfoColumns);
    addHeaderStyling(generalInfoSheet, [generalInfo]);

    // 2. Generate Configuration Status worksheet
    const { configurations: configurationStatus, displayToInternal } = generateConfigurationStatusData(
        data,
        databaseType
    );
    const configStatusSheet = workbook.addWorksheet('Configuration Status');

    addDataToWorksheet(configStatusSheet, configurationStatus);
    autoFitColumns(configStatusSheet, configurationStatus);
    addAutoFilter(configStatusSheet, configurationStatus);

    const configStatusColumns = Object.keys(configurationStatus[0] || {}).length;
    const configStatusEndRow = configurationStatus.length + 1;

    styleTableBorders(configStatusSheet, 1, configStatusEndRow, 1, configStatusColumns);
    styleDataRows(configStatusSheet, 2, configStatusEndRow, 1, configStatusColumns);
    addHeaderStyling(configStatusSheet, configurationStatus);

    // Add hyperlinks
    configurationStatus.forEach((config, index) => {
        const configName = config['Configuration name'];
        if (configName && typeof configName === 'string') {
            const sheetName = sanitizeWorksheetName(configName);
            const cell = configStatusSheet.getCell(index + 2, 1);

            cell.value = {
                text: configName,
                hyperlink: `#'${sheetName}'!A1`,
                tooltip: `Go to ${configName} details`
            };
            cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
    });

    // 3. Generate individual configuration detail worksheets
    const orderedKeys = getOrderedConfigurationKeys(data, databaseType);
    const orderedUniqueConfigs: string[] = [];

    // Add configurations in the order defined by cardDataDefault or oracleCardData
    orderedKeys.forEach(configKey => {
        const matchingConfig = configurationStatus.find(config => {
            const internalName = displayToInternal.get(config['Configuration name']);
            return internalName === configKey;
        });

        if (matchingConfig && matchingConfig['Configuration name']) {
            const displayName = matchingConfig['Configuration name'];
            if (!orderedUniqueConfigs.includes(displayName)) {
                orderedUniqueConfigs.push(displayName);
            }
        }
    });

    configurationStatus.forEach(config => {
        const configName = config['Configuration name'];
        if (configName && typeof configName === 'string' && !orderedUniqueConfigs.includes(configName)) {
            orderedUniqueConfigs.push(configName);
        }
    });

    orderedUniqueConfigs.forEach(displayName => {
        if (!displayName || typeof displayName !== 'string') return;

        const internalName = displayToInternal.get(displayName);
        if (!internalName) return;

        const configDetails = generateDetailedConfigurationData(data, internalName, databaseType);
        if (configDetails.length === 0) return;

        const sheetName = sanitizeWorksheetName(displayName);
        const configSheet = workbook.addWorksheet(sheetName);

        // Add hyperlink to Configuration Status sheet
        addConfigurationStatusHyperlink(configSheet);

        // Add data
        if (MULTI_TABLE_CONFIGS.includes(internalName)) {
            addMultiTableDataToWorksheet(configSheet, configDetails, internalName);
        } else {
            addDataToWorksheet(configSheet, configDetails);
        }
        autoFitColumns(configSheet, configDetails);

        const columnCount = Object.keys(configDetails[0] || {}).length;

        // Find impacted resources section
        let impactedResourcesStartRow = -1;
        for (let i = 0; i < configDetails.length; i += 1) {
            const row = configDetails[i];
            const impactedResourcesMarkers = [
                'Impacted resources',
                'SQL Instances License details',
                'Recommended Adapter Settings'
            ];

            if (row && impactedResourcesMarkers.some(marker => Object.values(row).includes(marker))) {
                impactedResourcesStartRow = i + 2;
                break;
            }
        }

        const allSpecialConfigs = [...TWO_COLUMN_CONFIGS, ...SINGLE_COLUMN_CONFIGS, ...MULTI_TABLE_CONFIGS];

        // Check if configuration has impacted resources (either known config or unknown with violation details)
        const hasImpactedResources = allSpecialConfigs.includes(internalName) || impactedResourcesStartRow > 0;

        if (hasImpactedResources && impactedResourcesStartRow > 0) {
            const mainTableEndRow = impactedResourcesStartRow - 3;
            styleTableBorders(configSheet, 1, mainTableEndRow, 1, columnCount);
            styleDataRows(configSheet, 2, mainTableEndRow, 1, columnCount);
            addHeaderStyling(configSheet, configDetails);

            const impactedResourcesRowIndex = impactedResourcesStartRow;
            const filterHeaderRowIndex = impactedResourcesRowIndex + 1;

            if (internalName === 'compute-rightsizing') {
                const recommendationOptionsStart = configDetails.findIndex(
                    row => row && row['Instance Type'] === 'Recommendation Options'
                );
                const objectsInViolationStart = configDetails.findIndex(
                    row => row && row['Violation Type'] === 'Objects in Violation'
                );

                if (recommendationOptionsStart >= 0) {
                    const firstTableHeaderRow = recommendationOptionsStart + 2;
                    const firstTableColumnsRow = firstTableHeaderRow + 1;
                    const firstTableDataStartRow = firstTableColumnsRow + 1;

                    let firstTableEndRow;
                    if (objectsInViolationStart >= 0) {
                        let emptyRowsBeforeSecondTable = 0;
                        for (let i = objectsInViolationStart - 1; i >= recommendationOptionsStart; i--) {
                            const row = configDetails[i];
                            if (!row || Object.keys(row).length === 0 || Object.values(row).every(val => val === '')) {
                                emptyRowsBeforeSecondTable++;
                            } else {
                                break;
                            }
                        }
                        firstTableEndRow = objectsInViolationStart + 2 - emptyRowsBeforeSecondTable;
                    } else {
                        firstTableEndRow = configDetails.length + 1;
                    }

                    configSheet.mergeCells(`A${firstTableHeaderRow}:E${firstTableHeaderRow}`);

                    styleTableBorders(configSheet, firstTableHeaderRow, firstTableEndRow, 1, 5);
                    styleImpactedResourcesHeader(configSheet, firstTableHeaderRow, 5);
                    styleFilterHeaders(configSheet, firstTableColumnsRow, 5);

                    if (firstTableDataStartRow <= firstTableEndRow) {
                        styleDataRows(configSheet, firstTableDataStartRow, firstTableEndRow, 1, 5);
                    }

                    if (firstTableDataStartRow <= firstTableEndRow) {
                        configSheet.autoFilter = {
                            from: `A${firstTableColumnsRow}`,
                            to: `E${firstTableEndRow}`
                        };
                    }
                }

                if (objectsInViolationStart >= 0) {
                    const secondTableHeaderRow = objectsInViolationStart + 2; // +2 for 1-based indexing
                    const secondTableColumnsRow = secondTableHeaderRow + 1;
                    const secondTableDataStartRow = secondTableColumnsRow + 1;
                    const secondTableEndRow = configDetails.length + 1;

                    styleTableBorders(configSheet, secondTableHeaderRow, secondTableEndRow, 1, 1);
                    styleImpactedResourcesHeader(configSheet, secondTableHeaderRow, 1);
                    styleFilterHeaders(configSheet, secondTableColumnsRow, 1);

                    if (secondTableDataStartRow <= secondTableEndRow) {
                        styleDataRows(configSheet, secondTableDataStartRow, secondTableEndRow, 1, 1);
                    }

                    if (secondTableDataStartRow <= secondTableEndRow) {
                        configSheet.autoFilter = {
                            from: `A${secondTableColumnsRow}`,
                            to: `A${secondTableEndRow}`
                        };
                    }
                }
            } else {
                applySpecialConfigurationStyling(
                    configSheet,
                    internalName,
                    configDetails,
                    impactedResourcesRowIndex,
                    filterHeaderRowIndex,
                    databaseType
                );
            }

            addConfigurationAutoFilter(configSheet, internalName, configDetails, filterHeaderRowIndex);
        } else {
            const totalRows = 2;
            styleTableBorders(configSheet, 1, totalRows, 1, columnCount);
            styleDataRows(configSheet, 2, totalRows, 1, columnCount);
            addHeaderStyling(configSheet, configDetails);
        }
    });

    // Generate XLSX buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);
    const view = new Uint8Array(arrayBuffer);
    view.set(new Uint8Array(buffer));

    return { fileName, arrayBuffer };
}

// Export function
async function generateReport(jsonString: string, databaseType: string): Promise<void> {
    try {
        let jsonData;
        try {
            jsonData = JSON.parse(jsonString);
        } catch (parseError) {
            throw new Error('Malformed input data: Invalid JSON format.');
        }
        const { fileName, arrayBuffer } = await generateProperXlsxWorkbook(
            jsonData as unknown as ComprehensiveAssessmentData,
            databaseType
        );

        if (!arrayBuffer) {
            throw new Error('Failed to generate XLSX buffer');
        }

        const blob = new Blob([arrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();

        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generating well-architected Excel report:', error);
        throw error;
    }
}

export default generateReport;
