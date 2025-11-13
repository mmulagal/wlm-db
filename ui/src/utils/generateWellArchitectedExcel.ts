import * as ExcelJS from 'exceljs';

interface AssessmentItem {
    name: string;
    status: string;
    recommended: string;
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
    sqlServerInstances?: any[];
    rssAdapters?: any[];
    recommendedAdapterSettings?: any;
    tcpOffloadState?: string;
    objectsInViolation?: string[];
    recommendationOptions?: any[];
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
    awsBackup?: AssessmentItem;
    license?: AssessmentItem;
    hostOsPatch?: AssessmentItem;
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
    'sql-license',
    'rss-config',
    'log-drive-size',
    'tempdb-drive-size',
    'compute-rightsizing'
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
            if (item && typeof item === 'object' && item.name) {
                allItems.push(item);
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

function generateGeneralInformationData(data: ComprehensiveAssessmentData) {
    const allItems = getAllItems(data);
    let criticalIssues = 0;
    let warningIssues = 0;
    let wellArchitectedConfigurations = 0;

    allItems.forEach(item => {
        if (item.status === 'optimized') {
            wellArchitectedConfigurations += 1;
        } else if (item.severity === 'critical') {
            criticalIssues += 1;
        } else if (item.severity === 'warning') {
            warningIssues += 1;
        }
    });

    const total = allItems.length;
    const totalIssues = criticalIssues + warningIssues;
    const score = total > 0 ? Math.round((wellArchitectedConfigurations / total) * 100) : 0;

    const currentDate = new Date();
    const lastAnalysisDate = data.lastAssessmentTimestamp
        ? new Date(data.lastAssessmentTimestamp)
        : new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);

    return {
        'Instance name': data.databaseInstanceName,
        'Host name': data.ec2InstanceId,
        'Time stamp (export timestamp)': currentDate.toLocaleString(),
        'Last analysis': lastAnalysisDate.toLocaleString(),
        'Well-architected status': `${totalIssues} issues`,
        'Well-architected score': `${score}%`,
        'Not-Optimized configuration (Critical)': criticalIssues,
        'Not-Optimized configuration (Warning)': warningIssues,
        'Well-architected configurations': wellArchitectedConfigurations,
        Total: total
    };
}

function generateConfigurationStatusData(data: ComprehensiveAssessmentData) {
    const configurations: any[] = [];

    const processItems = (
        items: AssessmentItem[] | undefined,
        category: string,
        subCategory: string,
        parentConfigurationName: string = 'n/a'
    ) => {
        if (!items) return;

        items.forEach(item => {
            configurations.push({
                'Configuration name': item.name,
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

    if (data.storage?.configuration) {
        processItems(data.storage.configuration.volumes, 'Storage', 'Storage configuration', 'ONTAP');
        processItems(data.storage.configuration.luns, 'Storage', 'Storage configuration', 'ONTAP');
        processItems(data.storage.configuration.os, 'Storage', 'Storage configuration', 'Operating System');
    }
    processItems(data.storage?.sizing, 'Storage', 'Storage sizing');
    processItems(data.storage?.layout, 'Storage', 'Storage layout');
    processItems(data.highAvailability, 'Resiliency', 'Protection', 'High Availability');

    processItems(data.compute ? [data.compute] : undefined, 'Compute', 'Compute');
    processItems(data.hostOsPatch ? [data.hostOsPatch] : undefined, 'Compute', 'Compute');
    processItems(data.rssConfig ? [data.rssConfig] : undefined, 'Compute', 'Compute');
    processItems(data.mtuAlignment ? [data.mtuAlignment] : undefined, 'Compute', 'Compute');

    processItems(data.license ? [data.license] : undefined, 'Application', 'Application');
    processItems(data.mssqlPatch ? [data.mssqlPatch] : undefined, 'Application', 'Application');
    processItems(data.maxDOP ? [data.maxDOP] : undefined, 'Application', 'Application');

    processItems(data.snapshotPolicy ? [data.snapshotPolicy] : undefined, 'Resiliency', 'Protection');
    processItems(data.crr ? [data.crr] : undefined, 'Resiliency', 'Protection');
    processItems(data.awsBackup ? [data.awsBackup] : undefined, 'Resiliency', 'Protection');

    processItems(data.clone ? [data.clone] : undefined, 'Cloning', 'Cloning');

    return configurations;
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

const createPatchData = (config: AssessmentItem, details: any[], instanceKey: string, headerText: string) => {
    const instances = config[instanceKey as keyof AssessmentItem] as any[];
    if (instances && instances.length > 0) {
        details.push({}, {});

        details.push({
            'Instance Name': headerText,
            KB: '',
            Name: '',
            Classification: ''
        });

        details.push({
            'Instance Name': 'Instance Name',
            KB: 'KB',
            Name: 'Name',
            Classification: 'Classification'
        });

        instances.forEach((instanceData: any) => {
            if (instanceData.missingPatchDetails && instanceData.missingPatchDetails.length > 0) {
                instanceData.missingPatchDetails.forEach((patch: any) => {
                    details.push({
                        'Instance Name': instanceData.ec2InstanceName || instanceData.ec2InstanceId || 'N/A',
                        KB: patch.kbId || 'N/A',
                        Name: patch.title || 'N/A',
                        Classification: patch.classification || 'N/A'
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
        Setting: 'Recommended Adapter Settings',
        Value: ''
    });

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
        'Adapter Name': 'RSS Adapters',
        'RSS Enabled': '',
        'RSS Profile': '',
        'Base Processor Number': '',
        'Number of Receive Queues': ''
    });

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
                dataObj['Data Access Path'] = (drive.dataAccessPath || []).join(', ');
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
        details.push({}, {});

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

function generateDetailedConfigurationData(data: ComprehensiveAssessmentData, configName: string) {
    const allItems = getAllItems(data);
    const config = allItems.find(item => item.name === configName);

    if (!config) {
        return [
            {
                'Configuration name': configName,
                Status: 'No data available',
                Details: 'Configuration not found in assessment data'
            }
        ];
    }

    const details: any[] = [];

    // Base configuration info
    const baseConfig = {
        'Configuration name': config.name,
        ...(config.status && { Status: config.status }),
        ...(config.severity && { Severity: config.severity }),
        ...(config.recommendation && { Recommendation: config.recommendation }),
        ...(config.current && { Current: config.current }),
        ...(config.recommended && { Recommended: config.recommended }),
        ...(config.tags?.length && { Tags: config.tags.join(', ') }),
        'Impacted resources (X out of Y)':
            typeof config.totalObjectsAssessed === 'number'
                ? `${config.totalObjectsInViolation || 0} out of ${config.totalObjectsAssessed}`
                : 'n/a'
    };

    details.push(baseConfig);

    // Check if second table should be generated
    if (config.status === 'optimized' || config.status === 'n/a') {
        return details;
    }

    // Special configuration handlers
    const specialHandlers: { [key: string]: () => void } = {
        'mtu-alignment': () => createMTUAlignmentData(config, details),
        'mssql-patch': () => createPatchData(config, details, 'missingPatchesInEc2Instances', 'Impacted resources'),
        'host-os-patch': () => createPatchData(config, details, 'ec2InstancesToPatch', 'Impacted resources'),
        'sql-license': () => createSQLLicenseData(config, details),
        'rss-config': () => createRSSConfigData(config, details),
        'log-drive-size': () =>
            createDriveSizeData(
                config,
                details,
                {
                    Databases: 'Databases',
                    'Data Access Path': 'Data Access Path',
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

        if (key.toUpperCase() === 'RECOMMENDED') {
            maxWidth = Math.max(maxWidth, 15);
        }

        const width = Math.min(Math.max(maxWidth + 2, 8), 50);
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

function addRSSConfigToWorksheet(worksheet: ExcelJS.Worksheet, data: any[]): void {
    if (!data || data.length === 0) return;

    let recommendedSettingsIndex = -1;
    let rssAdaptersIndex = -1;

    for (let i = 0; i < data.length; i += 1) {
        const row = data[i];
        if (row && row.Setting === 'Recommended Adapter Settings') {
            recommendedSettingsIndex = i;
        }
        if (row && row['Adapter Name'] === 'RSS Adapters') {
            rssAdaptersIndex = i;
        }
    }

    // Add base configuration table
    const baseConfigData = data.slice(0, Math.min(recommendedSettingsIndex, rssAdaptersIndex));
    const baseColumns = Object.keys(baseConfigData[0] || {});

    baseColumns.forEach((header, index) => {
        worksheet.getCell(1, index + 1).value = header;
    });

    baseConfigData.forEach((row, rowIndex) => {
        if (row && Object.keys(row).length > 0) {
            baseColumns.forEach((column, colIndex) => {
                worksheet.getCell(rowIndex + 2, colIndex + 1).value = row[column] || '';
            });
        }
    });

    let nextAvailableRow = baseConfigData.length + 3; // Start after base config table

    // Add Recommended Adapter Settings table
    if (recommendedSettingsIndex >= 0) {
        const recommendedEndIndex =
            rssAdaptersIndex >= 0
                ? data.findIndex(
                      (row, idx) => idx > recommendedSettingsIndex && (!row || Object.keys(row).length === 0)
                  )
                : data.length;

        const recommendedData = data.slice(
            recommendedSettingsIndex,
            recommendedEndIndex > 0 ? recommendedEndIndex : data.length
        );

        // Write recommended settings data starting from column 1
        recommendedData.forEach((row, rowIndex) => {
            if (row && Object.keys(row).length > 0) {
                if (row.Setting) {
                    worksheet.getCell(nextAvailableRow + rowIndex, 1).value = row.Setting;
                    worksheet.getCell(nextAvailableRow + rowIndex, 2).value = row.Value || '';
                }
            }
        });

        // Style recommended table
        const recommendedTableEndRow = nextAvailableRow + recommendedData.length - 1;
        styleTableBorders(worksheet, nextAvailableRow, recommendedTableEndRow, 1, 2);
        styleDataRows(worksheet, nextAvailableRow + 2, recommendedTableEndRow, 1, 2);
        styleImpactedResourcesHeader(worksheet, nextAvailableRow, 2);
        styleFilterHeaders(worksheet, nextAvailableRow + 1, 2);

        nextAvailableRow = recommendedTableEndRow + 2; // Update next available row
    }

    // Add RSS Adapters table
    if (rssAdaptersIndex >= 0) {
        const rssData = data.slice(rssAdaptersIndex);

        // Write RSS adapters data starting from column 1
        rssData.forEach((row, rowIndex) => {
            if (row && Object.keys(row).length > 0) {
                if (row['Adapter Name']) {
                    worksheet.getCell(nextAvailableRow + rowIndex, 1).value = row['Adapter Name'];
                    worksheet.getCell(nextAvailableRow + rowIndex, 2).value = row['RSS Enabled'] || '';
                    worksheet.getCell(nextAvailableRow + rowIndex, 3).value = row['RSS Profile'] || '';
                    worksheet.getCell(nextAvailableRow + rowIndex, 4).value = row['Base Processor Number'] || '';
                    worksheet.getCell(nextAvailableRow + rowIndex, 5).value = row['Number of Receive Queues'] || '';
                }
            }
        });

        // Style RSS adapters table
        const rssTableEndRow = nextAvailableRow + rssData.length - 1;
        styleTableBorders(worksheet, nextAvailableRow, rssTableEndRow, 1, 5);
        styleDataRows(worksheet, nextAvailableRow + 2, rssTableEndRow, 1, 5);
        styleImpactedResourcesHeader(worksheet, nextAvailableRow, 5);
        styleFilterHeaders(worksheet, nextAvailableRow + 1, 5);
    }
}

// Configuration-specific styling functions
const applySpecialConfigurationStyling = (
    worksheet: ExcelJS.Worksheet,
    configName: string,
    configDetails: any[],
    impactedResourcesRowIndex: number,
    filterHeaderRowIndex: number
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
            'mssql-patch': 4,
            'host-os-patch': 4,
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
            // Fallback: treat unknown configurations with impacted resources as two-column configs
            worksheet.mergeCells(`A${impactedResourcesRowIndex}:B${impactedResourcesRowIndex}`);
            styleTableBorders(worksheet, impactedResourcesRowIndex, violationTableEndRow, 1, 2);
            styleDataRows(worksheet, filterHeaderRowIndex + 1, violationTableEndRow, 1, 2);
            styleImpactedResourcesHeader(worksheet, impactedResourcesRowIndex, 2);
            styleFilterHeaders(worksheet, filterHeaderRowIndex, 2);
        }
    }
};

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
async function generateProperXlsxWorkbook(data: ComprehensiveAssessmentData): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();

    // 1. Generate General Information worksheet
    const generalInfo = generateGeneralInformationData(data);
    const generalInfoSheet = workbook.addWorksheet('General Information');

    addDataToWorksheet(generalInfoSheet, [generalInfo]);
    autoFitColumns(generalInfoSheet, [generalInfo]);

    const generalInfoColumns = Object.keys(generalInfo).length;
    styleTableBorders(generalInfoSheet, 1, 2, 1, generalInfoColumns);
    styleDataRows(generalInfoSheet, 2, 2, 1, generalInfoColumns);
    addHeaderStyling(generalInfoSheet, [generalInfo]);

    // 2. Generate Configuration Status worksheet
    const configurationStatus = generateConfigurationStatusData(data);
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
            const cleanSheetName = configName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 31);
            const cell = configStatusSheet.getCell(index + 2, 1);

            cell.value = {
                text: configName,
                hyperlink: `#'${cleanSheetName}'!A1`,
                tooltip: `Go to ${configName} details`
            };
            cell.font = { color: { argb: 'FF0000FF' }, underline: true };
        }
    });

    // 3. Generate individual configuration detail worksheets
    const uniqueConfigs = Array.from(
        new Set(
            configurationStatus
                .filter(
                    config => config && config['Configuration name'] && typeof config['Configuration name'] === 'string'
                )
                .map(config => config['Configuration name'])
        )
    );

    uniqueConfigs.forEach(configName => {
        if (!configName || typeof configName !== 'string') return;

        const configDetails = generateDetailedConfigurationData(data, configName);
        if (configDetails.length === 0) return;

        const cleanSheetName = configName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 31);
        const configSheet = workbook.addWorksheet(cleanSheetName);

        // Add data
        if (MULTI_TABLE_CONFIGS.includes(configName)) {
            addMultiTableDataToWorksheet(configSheet, configDetails, configName);
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
        const hasImpactedResources = allSpecialConfigs.includes(configName) || impactedResourcesStartRow > 0;

        if (hasImpactedResources && impactedResourcesStartRow > 0) {
            // Style main configuration table
            const mainTableEndRow = impactedResourcesStartRow - 3;
            styleTableBorders(configSheet, 1, mainTableEndRow, 1, columnCount);
            styleDataRows(configSheet, 2, mainTableEndRow, 1, columnCount);
            addHeaderStyling(configSheet, configDetails);

            const impactedResourcesRowIndex = impactedResourcesStartRow;
            const filterHeaderRowIndex = impactedResourcesRowIndex + 1;

            if (configName === 'compute-rightsizing') {
                // Special handling for compute-rightsizing dual tables
                const recommendationOptionsStart = configDetails.findIndex(
                    row => row && row['Instance Type'] === 'Recommendation Options'
                );
                const objectsInViolationStart = configDetails.findIndex(
                    row => row && row['Violation Type'] === 'Objects in Violation'
                );

                if (recommendationOptionsStart >= 0) {
                    const firstTableHeaderRow = recommendationOptionsStart + 2;
                    const firstTableDataStartRow = firstTableHeaderRow + 1;
                    const firstTableEndRow =
                        objectsInViolationStart >= 0 ? objectsInViolationStart + 1 : configDetails.length + 1;

                    configSheet.mergeCells(`A${firstTableHeaderRow}:E${firstTableHeaderRow}`);

                    if (firstTableDataStartRow <= firstTableEndRow) {
                        styleTableBorders(configSheet, firstTableHeaderRow, firstTableEndRow, 1, 5);
                        styleDataRows(configSheet, firstTableDataStartRow + 1, firstTableEndRow, 1, 5);
                    }

                    styleImpactedResourcesHeader(configSheet, firstTableHeaderRow, 5);
                    styleFilterHeaders(configSheet, firstTableDataStartRow, 5);
                }

                if (objectsInViolationStart >= 0) {
                    const secondTableHeaderRow = objectsInViolationStart + 2;
                    const secondTableDataStartRow = secondTableHeaderRow + 1;
                    const secondTableEndRow = configDetails.length + 1;

                    // Write Objects in Violation table starting from column 1
                    const objectsInViolationData = configDetails.slice(objectsInViolationStart);
                    objectsInViolationData.forEach((row, rowIndex) => {
                        if (row && Object.keys(row).length > 0 && row['Violation Type']) {
                            configSheet.getCell(objectsInViolationStart + 2 + rowIndex, 1).value =
                                row['Violation Type'];
                        }
                    });

                    if (secondTableDataStartRow <= secondTableEndRow) {
                        styleTableBorders(configSheet, secondTableHeaderRow, secondTableEndRow, 1, 1);
                        styleDataRows(configSheet, secondTableDataStartRow + 1, secondTableEndRow, 1, 1);
                    }

                    styleImpactedResourcesHeader(configSheet, secondTableHeaderRow, 1);
                    styleFilterHeaders(configSheet, secondTableDataStartRow, 1);
                }
            } else {
                applySpecialConfigurationStyling(
                    configSheet,
                    configName,
                    configDetails,
                    impactedResourcesRowIndex,
                    filterHeaderRowIndex
                );
            }

            // Add auto-filters
            addConfigurationAutoFilter(configSheet, configName, configDetails, filterHeaderRowIndex);
        } else {
            // Simple configurations
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

    return arrayBuffer;
}

// Export function
async function generateReport(jsonString: string): Promise<void> {
    try {
        let jsonData;
        try {
            jsonData = JSON.parse(jsonString);
        } catch (parseError) {
            throw new Error('Malformed input data: Invalid JSON format.');
        }
        const xlsxBuffer = await generateProperXlsxWorkbook(jsonData as unknown as ComprehensiveAssessmentData);

        if (!xlsxBuffer) {
            throw new Error('Failed to generate XLSX buffer');
        }

        const timestampMs = Date.now();
        const filename = `wlmdb-well-architected-assessment-${timestampMs}.xlsx`;

        const blob = new Blob([xlsxBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generating well-architected Excel report:', error);
        throw error;
    }
}

export default generateReport;
