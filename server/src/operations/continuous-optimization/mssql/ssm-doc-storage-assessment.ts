import createError from 'http-errors';
import { isEmpty } from 'lodash-es';

import {
    getWindowsRegistryContent,
    getFileSystemContent,
    isFleetManagerCollectionFailure,
    type RegistryEntry
} from '../../aws/ssm-fleet-manager-operations';
import {
    AssessmentStatus,
    ASSESSMENT_RESOURCE_TYPE,
    DEFAULT_MPIO_TIMEOUT
} from '../../../utils/continous-optimization-consts';
import { DEFAULT_INSTANCE_NAME, HttpErrorCodes } from '../../../utils/consts';
import { IS_DEMO_FLOW } from '../../../utils/utils';
import getLogger from '../../../utils/logger';

import type {
    AssessmentErrorItemType,
    GenericViolationResponseType
} from '../../../routes/types/continuous-optimization.types';
import type { MssqlAssessmentItemType } from '../../../routes/types/mssql-continuous-optimisation.types';
import {
    getGoldenConfigEntryById,
    mssqlLayoutConfigData as layoutConfigData,
    mssqlOsConfigData as osConfigData,
    type GoldenConfigEntry
} from '../assessment-utils';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

const logger = getLogger();

const SQL_INSTANCE_NAMES_PATH = 'HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL';
const MPIO_PARAMETERS_PATH = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\mpio\\Parameters';
const DISK_TIMEOUT_PATH = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Disk';
const CLUSTER_QUORUM_REGISTRY_PATH = 'HKLM:\\Cluster\\Quorum';
const CLUSTER_QUORUM_PHYSICAL_DISK_TYPE = 'Physical Disk';
const CLUSTER_QUORUM_FILE_SHARE_WITNESS_TYPE = 'File Share Witness';
const CLUSTER_QUORUM_RECOMMENDED_TYPES = [CLUSTER_QUORUM_PHYSICAL_DISK_TYPE, CLUSTER_QUORUM_FILE_SHARE_WITNESS_TYPE];
const DRIVE_LETTER_PATTERN = /^[A-Za-z]:/;
const SYSTEM_DATABASE_FILE_PATTERN = /^(master|mastlog|model|tempdb|templog|msdb)/i;
const clusterResourceRegistryPath = (resourceId: string): string => `HKLM:\\Cluster\\Resources\\${resourceId}`;
const mssqlInstanceRegistryPath = (registryInstanceId: string, suffix = ''): string =>
    `HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\${registryInstanceId}\\MSSQLServer${suffix}`;
const mssqlInstanceSetupRegistryPath = (registryInstanceId: string): string =>
    `HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\${registryInstanceId}\\Setup`;
const mssqlInstanceClusterRegistryPath = (registryInstanceId: string): string =>
    `HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\${registryInstanceId}\\Cluster`;

const findRegistryValue = (entries: RegistryEntry[], name: string): string | undefined =>
    entries.find(entry => entry.name === name && entry.type !== 'Key')?.value;

const extractDriveLetter = (path: string): string | undefined => DRIVE_LETTER_PATTERN.exec(path)?.[0];

interface DiscoveredSqlInstance {
    instanceName: string;
    registryInstanceId: string;
}

interface SqlDefaultPaths {
    installRoot?: string;
    defaultData?: string;
    defaultLog?: string;
    backupDirectory?: string;
    error?: string;
}

interface MultipathConfig {
    mpioEnabled?: boolean;
    pathVerifyEnabled?: string;
    pathVerificationPeriod?: string;
    diskTimeoutValue?: string;
    error?: string;
}

interface ClusterQuorumConfig {
    weight?: string;
    resourceType?: string;
    error?: string;
}

interface DirectoryLayoutCheck {
    path?: string;
    mdfCount: number;
    ldfCount: number;
    ndfCount: number;
    otherFileNames: string[];
    systemFileNames: string[];
    error?: string;
}

interface LayoutBySection {
    'default-data-files-location': DirectoryLayoutCheck;
    'default-log-files-location': DirectoryLayoutCheck;
}

interface SqlInstanceAssessment {
    instanceName: string;
    registryInstanceId: string;
    paths: SqlDefaultPaths;
    layout: LayoutBySection;
    mpio: MultipathConfig;
    activeOnThisHost?: boolean;
    deploymentType?: 'FCI' | 'Standalone';
}

function classifyDirectoryListing(fileNames: string[]): Omit<DirectoryLayoutCheck, 'path' | 'error'> {
    const otherFileNames: string[] = [];
    const systemFileNames: string[] = [];
    let mdfCount = 0;
    let ldfCount = 0;
    let ndfCount = 0;

    fileNames.forEach(fileName => {
        if (SYSTEM_DATABASE_FILE_PATTERN.test(fileName)) {
            systemFileNames.push(fileName);
            return;
        }

        const extension = fileName.split('.').pop()?.toLowerCase();
        if (extension === 'mdf') {
            mdfCount += 1;
        } else if (extension === 'ldf') {
            ldfCount += 1;
        } else if (extension === 'ndf') {
            ndfCount += 1;
        } else {
            otherFileNames.push(fileName);
        }
    });

    return { mdfCount, ldfCount, ndfCount, otherFileNames, systemFileNames };
}

function emptyDirectoryLayoutCheck(path?: string, error?: string): DirectoryLayoutCheck {
    return { path, mdfCount: 0, ldfCount: 0, ndfCount: 0, otherFileNames: [], systemFileNames: [], error };
}

async function discoverSqlInstances(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    accountId?: string
): Promise<DiscoveredSqlInstance[]> {
    logger.info('Discovering SQL instances via AWSFleetManager-GetWindowsRegistryContent', {
        credentialsId,
        region,
        ec2InstanceId
    });

    const { found, entries, error } = await getWindowsRegistryContent(
        credentialsId,
        region,
        ec2InstanceId,
        SQL_INSTANCE_NAMES_PATH,
        accountId
    );

    if (!found) {
        if (isFleetManagerCollectionFailure(error)) {
            logger.error('SQL instance discovery failed due to collection error', { ec2InstanceId, error });
            throw createError(HttpErrorCodes.FAILED_DEPENDENCY, error!);
        }
        logger.debug('No SQL instances registry key on host', { ec2InstanceId, error });
        return [];
    }

    return entries
        .filter(entry => entry.type !== 'Key')
        .map(entry => ({ instanceName: entry.name, registryInstanceId: entry.value }));
}

async function getSqlDefaultPaths(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    registryInstanceId: string,
    accountId?: string
): Promise<SqlDefaultPaths> {
    logger.info('Reading SQL default paths via registry read', {
        credentialsId,
        accountId,
        ec2InstanceId,
        registryInstanceId
    });

    const [defaultPaths, setup] = await Promise.all([
        getWindowsRegistryContent(
            credentialsId,
            region,
            ec2InstanceId,
            mssqlInstanceRegistryPath(registryInstanceId),
            accountId
        ),
        getWindowsRegistryContent(
            credentialsId,
            region,
            ec2InstanceId,
            mssqlInstanceSetupRegistryPath(registryInstanceId),
            accountId
        )
    ]);

    if (!defaultPaths.found) {
        return { error: defaultPaths.error };
    }

    return {
        installRoot: setup.found ? findRegistryValue(setup.entries, 'SQLDataRoot') : undefined,
        defaultData: findRegistryValue(defaultPaths.entries, 'DefaultData'),
        defaultLog: findRegistryValue(defaultPaths.entries, 'DefaultLog'),
        backupDirectory: findRegistryValue(defaultPaths.entries, 'BackupDirectory')
    };
}

async function getMultipathConfig(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    accountId?: string
): Promise<MultipathConfig> {
    logger.info('Reading MPIO configuration via registry read', { ec2InstanceId });

    const [mpioParameters, diskSettings] = await Promise.all([
        getWindowsRegistryContent(credentialsId, region, ec2InstanceId, MPIO_PARAMETERS_PATH, accountId),
        getWindowsRegistryContent(credentialsId, region, ec2InstanceId, DISK_TIMEOUT_PATH, accountId)
    ]);

    if (!mpioParameters.found) {
        if (isFleetManagerCollectionFailure(mpioParameters.error)) {
            return { error: mpioParameters.error };
        }
        return { mpioEnabled: false };
    }

    return {
        mpioEnabled: true,
        pathVerifyEnabled: findRegistryValue(mpioParameters.entries, 'PathVerifyEnabled'),
        pathVerificationPeriod: findRegistryValue(mpioParameters.entries, 'PathVerificationPeriod'),
        diskTimeoutValue: diskSettings.found ? findRegistryValue(diskSettings.entries, 'TimeOutValue') : undefined
    };
}

async function getClusterQuorumConfig(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    accountId?: string
): Promise<ClusterQuorumConfig> {
    logger.info('Reading cluster quorum configuration via registry read', { credentialsId, accountId, ec2InstanceId });

    const { found, entries, error } = await getWindowsRegistryContent(
        credentialsId,
        region,
        ec2InstanceId,
        CLUSTER_QUORUM_REGISTRY_PATH,
        accountId
    );

    if (!found) {
        return { error: error ?? NO_CLUSTER_QUORUM_DATA_ERROR };
    }

    const weight = findRegistryValue(entries, 'Weight');
    const resourceId = findRegistryValue(entries, 'Resource');
    if (!resourceId) {
        return { weight };
    }

    const resourceResult = await getWindowsRegistryContent(
        credentialsId,
        region,
        ec2InstanceId,
        clusterResourceRegistryPath(resourceId),
        accountId
    );

    const resourceType = resourceResult.found ? findRegistryValue(resourceResult.entries, 'Type') : undefined;
    return { weight, resourceType };
}

async function getDirectoryLayoutCheck(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    directoryPath?: string,
    accountId?: string
): Promise<DirectoryLayoutCheck> {
    logger.info('Checking directory layout via file system read', {
        credentialsId,
        accountId,
        ec2InstanceId,
        directoryPath
    });

    if (isEmpty(directoryPath)) {
        return emptyDirectoryLayoutCheck(undefined, 'Path not available');
    }

    const { found, entries, error } = await getFileSystemContent(
        credentialsId,
        region,
        ec2InstanceId,
        directoryPath!,
        accountId
    );

    if (!found) {
        return emptyDirectoryLayoutCheck(directoryPath, error);
    }

    return {
        path: directoryPath,
        ...classifyDirectoryListing(entries.map(entry => entry.name))
    };
}

async function getLayoutViolations(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    paths: SqlDefaultPaths,
    accountId?: string
): Promise<LayoutBySection> {
    logger.info('Getting layout violations for default data/log directories', {
        credentialsId,
        accountId,
        ec2InstanceId
    });

    const [defaultDataLayout, defaultLogLayout] = await Promise.all([
        getDirectoryLayoutCheck(credentialsId, region, ec2InstanceId, paths.defaultData, accountId),
        getDirectoryLayoutCheck(credentialsId, region, ec2InstanceId, paths.defaultLog, accountId)
    ]);

    return {
        'default-data-files-location': defaultDataLayout,
        'default-log-files-location': defaultLogLayout
    };
}

async function assessSqlInstance(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instance: DiscoveredSqlInstance,
    accountId?: string
): Promise<Omit<SqlInstanceAssessment, 'mpio'>> {
    logger.info('Assessing SQL instance', {
        credentialsId,
        accountId,
        ec2InstanceId,
        instanceName: instance.instanceName
    });

    const [paths, clusterKeyResult] = await Promise.all([
        getSqlDefaultPaths(credentialsId, region, ec2InstanceId, instance.registryInstanceId, accountId),
        getWindowsRegistryContent(
            credentialsId,
            region,
            ec2InstanceId,
            mssqlInstanceClusterRegistryPath(instance.registryInstanceId),
            accountId
        )
    ]);

    const deploymentType: SqlInstanceAssessment['deploymentType'] = clusterKeyResult.found ? 'FCI' : 'Standalone';

    const layout = await getLayoutViolations(credentialsId, region, ec2InstanceId, paths, accountId);
    const attemptedLayouts = [layout['default-data-files-location'], layout['default-log-files-location']].filter(
        (entry): entry is DirectoryLayoutCheck => Boolean(entry.path)
    );
    const activeOnThisHost = attemptedLayouts.length > 0 ? attemptedLayouts.every(entry => !entry.error) : undefined;

    return { ...instance, paths, layout, activeOnThisHost, deploymentType };
}

async function runLayoutAssessment(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    accountId?: string
): Promise<Omit<SqlInstanceAssessment, 'mpio'>> {
    logger.info('Running SSM-doc-based layout assessment', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceName
    });

    const discoveredInstances = await discoverSqlInstances(credentialsId, region, ec2InstanceId, accountId);
    const lookupInstanceName = IS_DEMO_FLOW ? DEFAULT_INSTANCE_NAME : instanceName;
    const matchedInstance = discoveredInstances.find(instance => instance.instanceName === lookupInstanceName);
    if (!matchedInstance) {
        const errorMessage = `SQL instance ${instanceName} not found on host ${ec2InstanceId}`;
        logger.error(errorMessage, { ec2InstanceId, instanceName });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }
    return assessSqlInstance(credentialsId, region, ec2InstanceId, matchedInstance, accountId);
}

const NO_ASSESSABLE_PATH_ERROR =
    'No SQL instance on this host has a registry path that resolves to a drive letter for this location.';
const NO_MPIO_DATA_ERROR = 'The MPIO Parameters registry key was not found on this host.';
const MPIO_DISABLED_TIMEOUT_ERROR = 'MPIO is disabled on this host; the path verification timeout is not applicable.';
const NO_CLUSTER_QUORUM_DATA_ERROR = 'The Cluster Quorum registry key was not found on this host.';
const INCOMPLETE_CLUSTER_QUORUM_DATA_ERROR =
    'The Cluster Quorum weight and/or resource type could not be determined from the registry.';

interface LayoutViolationEntry {
    instanceName: string;
    sharedDriveLetter?: string;
    misplacedFilesPath?: string;
}

interface InstanceDriveLetters {
    instanceName: string;
    dataDrive?: string;
    logDrive?: string;
}

function getInstanceDriveLetters(instance: SqlInstanceAssessment): InstanceDriveLetters {
    return {
        instanceName: instance.instanceName,
        dataDrive: extractDriveLetter(instance.paths.defaultData ?? ''),
        logDrive: extractDriveLetter(instance.paths.defaultLog ?? '')
    };
}

function buildDriveSharingViolations(entries: LayoutViolationEntry[]): {
    objectsInViolation: string[];
    violationDetails: GenericViolationResponseType[];
} {
    const violationsByDrive = new Map<string, { objectName: string; driveLetter: string }>();
    const addViolation = (objectName: string, driveLetter: string): void => {
        violationsByDrive.set(objectName, { objectName, driveLetter });
    };

    entries.forEach(({ sharedDriveLetter, misplacedFilesPath }) => {
        if (sharedDriveLetter) {
            addViolation(sharedDriveLetter, sharedDriveLetter);
        }
        if (misplacedFilesPath) {
            const driveLetter = extractDriveLetter(misplacedFilesPath);
            addViolation(driveLetter ?? misplacedFilesPath, driveLetter ?? '');
        }
    });

    const rows = [...violationsByDrive.values()];
    // No database name is obtainable at this privilege level, so identify it by its drive.
    const violationDetails: GenericViolationResponseType[] = rows.map(({ objectName, driveLetter }) => ({
        objectName,
        value: `Database on ${driveLetter || objectName}`,
        objectType: ASSESSMENT_RESOURCE_TYPE.DRIVE,
        additionalInfo: { driveLetter }
    }));
    return { objectsInViolation: rows.map(row => row.objectName), violationDetails };
}

function buildRegistryLayoutFinding(
    goldenData: GoldenConfigEntry,
    totalObjectsAssessed: number,
    entries: LayoutViolationEntry[]
): MssqlAssessmentItemType {
    const { objectsInViolation, violationDetails } = buildDriveSharingViolations(entries);
    const status = objectsInViolation.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
    const hasDriveViolation = entries.some(e => e.sharedDriveLetter);
    const hasContentViolation = entries.some(e => e.misplacedFilesPath);
    const current =
        status === AssessmentStatus.OPTIMIZED
            ? 'Separate drive'
            : hasDriveViolation
            ? 'Shared drive with log/data files'
            : hasContentViolation
            ? 'Log/data files co-located in same directory'
            : 'Shared drive with log/data files';
    return {
        ...goldenData,
        recommended: (goldenData.value ?? '').toString(),
        status,
        current,
        objectsInViolation,
        totalObjectsAssessed,
        totalObjectsInViolation: objectsInViolation.length,
        violationDetails: violationDetails.length > 0 ? violationDetails : undefined
    } as unknown as MssqlAssessmentItemType;
}

function calculateRegistryStorageLayoutDrift(
    instances: SqlInstanceAssessment[]
): (MssqlAssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Calculating registry-based storage layout drift', { instanceCount: instances.length });

    const driveLetters = instances.map(getInstanceDriveLetters);
    const dataAssessableCount = driveLetters.filter(d => d.dataDrive).length;
    const logAssessableCount = driveLetters.filter(d => d.logDrive).length;

    const dataFilesGoldenData = getGoldenConfigEntryById(layoutConfigData, 'data-files-location');
    const logFilesGoldenData = getGoldenConfigEntryById(layoutConfigData, 'log-files-location');

    const sharedDriveLetterOf = (d: InstanceDriveLetters): string | undefined =>
        d.dataDrive && d.logDrive && d.dataDrive === d.logDrive ? d.dataDrive : undefined;

    const dataEntries: LayoutViolationEntry[] = instances.map((instance, i) => ({
        instanceName: driveLetters[i].instanceName,
        sharedDriveLetter: sharedDriveLetterOf(driveLetters[i]),
        misplacedFilesPath:
            instance.layout['default-data-files-location']?.ldfCount > 0
                ? instance.layout['default-data-files-location'].path
                : undefined
    }));
    const logEntries: LayoutViolationEntry[] = instances.map((instance, i) => ({
        instanceName: driveLetters[i].instanceName,
        sharedDriveLetter: sharedDriveLetterOf(driveLetters[i]),
        misplacedFilesPath:
            instance.layout['default-log-files-location']?.mdfCount > 0
                ? instance.layout['default-log-files-location'].path
                : undefined
    }));

    return [
        dataAssessableCount === 0
            ? { ...dataFilesGoldenData, errorMessage: NO_ASSESSABLE_PATH_ERROR }
            : buildRegistryLayoutFinding(dataFilesGoldenData, dataAssessableCount, dataEntries),
        logAssessableCount === 0
            ? { ...logFilesGoldenData, errorMessage: NO_ASSESSABLE_PATH_ERROR }
            : buildRegistryLayoutFinding(logFilesGoldenData, logAssessableCount, logEntries)
    ];
}

function buildRegistryBooleanFinding(
    goldenData: GoldenConfigEntry,
    status: AssessmentStatus,
    current: string,
    recommended: string
): MssqlAssessmentItemType {
    const isViolation = status === AssessmentStatus.NOT_OPTIMIZED;
    return {
        ...goldenData,
        recommended,
        status,
        current,
        objectsInViolation: isViolation ? [goldenData.id] : [],
        totalObjectsAssessed: 1,
        totalObjectsInViolation: isViolation ? 1 : 0,
        violationDetails: isViolation
            ? [{ objectName: goldenData.id, value: current, objectType: ASSESSMENT_RESOURCE_TYPE.STORAGE_MULTIPATH }]
            : undefined
    } as unknown as MssqlAssessmentItemType;
}

function calculateRegistryMpioDrift(
    instances: SqlInstanceAssessment[]
): (MssqlAssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Calculating registry-based MPIO drift', { instanceCount: instances.length });

    const mpioEnabledGoldenData = getGoldenConfigEntryById(osConfigData, 'mpio-enabled');
    const mpioTimeoutGoldenData = getGoldenConfigEntryById(osConfigData, 'mpio-timeout');
    const mpio = instances[0]?.mpio;

    if (!mpio) {
        return [
            { ...mpioEnabledGoldenData, errorMessage: NO_MPIO_DATA_ERROR },
            { ...mpioTimeoutGoldenData, errorMessage: NO_MPIO_DATA_ERROR }
        ];
    }

    const enabledStatus = mpio.mpioEnabled ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
    const mpioEnabledFinding = buildRegistryBooleanFinding(
        mpioEnabledGoldenData,
        enabledStatus,
        mpio.mpioEnabled ? 'Enabled' : 'Disabled',
        'Enabled'
    );

    if (!mpio.mpioEnabled) {
        return [mpioEnabledFinding, { ...mpioTimeoutGoldenData, errorMessage: MPIO_DISABLED_TIMEOUT_ERROR }];
    }

    const timeoutStatus =
        Number(mpio.diskTimeoutValue) === DEFAULT_MPIO_TIMEOUT
            ? AssessmentStatus.OPTIMIZED
            : AssessmentStatus.NOT_OPTIMIZED;
    const mpioTimeoutFinding = buildRegistryBooleanFinding(
        mpioTimeoutGoldenData,
        timeoutStatus,
        mpio.diskTimeoutValue !== undefined ? String(mpio.diskTimeoutValue) : 'Unknown',
        `${DEFAULT_MPIO_TIMEOUT}`
    );

    return [mpioEnabledFinding, mpioTimeoutFinding];
}

function calculateRegistryClusterQuorumDrift(
    quorum: ClusterQuorumConfig | undefined,
    ec2InstanceId: string
): (MssqlAssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Calculating registry-based cluster quorum drift', { hasQuorumData: Boolean(quorum) });

    const goldenData = getGoldenConfigEntryById(MSSQL_GOLDEN_CONFIG, 'cluster-quorum');

    if (!quorum || quorum.error) {
        return [{ ...goldenData, errorMessage: quorum?.error ?? NO_CLUSTER_QUORUM_DATA_ERROR }];
    }

    if (!quorum.resourceType) {
        return [{ ...goldenData, errorMessage: INCOMPLETE_CLUSTER_QUORUM_DATA_ERROR }];
    }

    const isFileShareWitness = quorum.resourceType === CLUSTER_QUORUM_FILE_SHARE_WITNESS_TYPE;
    if (!isFileShareWitness && !quorum.weight) {
        return [{ ...goldenData, errorMessage: INCOMPLETE_CLUSTER_QUORUM_DATA_ERROR }];
    }

    const isPhysicalDiskMajority =
        quorum.resourceType === CLUSTER_QUORUM_PHYSICAL_DISK_TYPE && Number(quorum.weight) === 1;
    const status =
        isFileShareWitness || isPhysicalDiskMajority ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
    const isViolation = status === AssessmentStatus.NOT_OPTIMIZED;

    return [
        {
            ...goldenData,
            recommended: goldenData.recommended ?? '',
            status,
            current: `Weight=${quorum.weight ?? 'Unknown'}, Type=${quorum.resourceType ?? 'Unknown'}`,
            objectsInViolation: isViolation ? [ec2InstanceId] : [],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: isViolation ? 1 : 0,
            violationDetails: isViolation
                ? [
                      {
                          objectName: 'weight',
                          value: quorum.weight ?? 'Unknown',
                          objectType: ASSESSMENT_RESOURCE_TYPE.WINDOWS_CLUSTER,
                          recommended: '1'
                      },
                      {
                          objectName: 'resourceType',
                          value: quorum.resourceType ?? 'Unknown',
                          objectType: ASSESSMENT_RESOURCE_TYPE.WINDOWS_CLUSTER,
                          recommended: CLUSTER_QUORUM_RECOMMENDED_TYPES.join(' or ')
                      }
                  ]
                : undefined
        } as unknown as MssqlAssessmentItemType
    ];
}

export {
    discoverSqlInstances,
    getSqlDefaultPaths,
    getMultipathConfig,
    getLayoutViolations,
    runLayoutAssessment,
    extractDriveLetter,
    mssqlInstanceRegistryPath,
    mssqlInstanceClusterRegistryPath,
    SQL_INSTANCE_NAMES_PATH,
    MPIO_PARAMETERS_PATH,
    getInstanceDriveLetters,
    buildDriveSharingViolations,
    buildRegistryLayoutFinding,
    calculateRegistryStorageLayoutDrift,
    buildRegistryBooleanFinding,
    calculateRegistryMpioDrift,
    getClusterQuorumConfig,
    calculateRegistryClusterQuorumDrift
};
export type {
    DiscoveredSqlInstance,
    SqlDefaultPaths,
    MultipathConfig,
    DirectoryLayoutCheck,
    LayoutBySection,
    SqlInstanceAssessment,
    LayoutViolationEntry,
    InstanceDriveLetters,
    ClusterQuorumConfig
};
