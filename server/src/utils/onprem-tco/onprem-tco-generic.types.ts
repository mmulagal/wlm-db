import { Type } from '@fastify/type-provider-typebox';

const UploadMetricsFileBody = Type.Object({
    fileName: Type.String(),
    fileContent: Type.String()
});

interface DriveDetail {
    deviceID: string;
    model: string;
    driveLetter: string;
}

interface NetworkConfiguration {
    name: string;
    speedMbps: number;
    adapterType: string;
}

interface NodeDetail {
    ramSize: number;
    hostId: string;
    networkConfiguration: NetworkConfiguration | NetworkConfiguration[];
    driveDetails: {
        value: string;
        PSComputerName: string;
        RunspaceId: string;
        PSShowComputerName: boolean;
    };
    osEdition?: string;
    numberOfVcpus: number;
}

interface WindowsConfig {
    clusterNodeNames: string[];
    nodeDetails: NodeDetail[];
    windowsSystemName: string;
    belongsToCluster: boolean;
    totalAllocatedCapacity?: string;
}

interface LicenceUsageDetail {
    isUsingFeature: number;
    featureDescription: string;
}

interface MemUtilization {
    used: number;
    total: number;
    remaining: number;
    percentUsed: number;
}

interface OwnerNode {
    nodeName: string;
    nodeRole: string;
}

interface Iops {
    writeIops: string;
    readIops: string;
    writeBytesPerSec: string;
    readBytesPerSec: string;
}

interface CpuUtilization {
    maxCpuUtilization: number;
    eventTime: string;
}

interface StorageDetailByDB {
    databaseName: string;
    allocatedSizeMb: number;
    dataSizeMb: number;
    logSizeMb: number;
    driveLetter: string;
    driveTotalSizeMb: number;
    driveAvailableSizeMb: number;
}

interface SqlInstanceDetails {
    instanceGuid: string;
    licenceUsageDetails: string;
    memUtilization: string;
    noOfDatabases: string;
    ownerNodes: string;
    sqlInstanceName: string;
    sqlVersion: string;
    storageDetailsByDb: string;
    sqlEdition: string;
    iops: string;
    collation: string;
    vcpusPerInstance: string;
    cpuUtilization: string;
    deploymentType: string;
    isReadReplica?: string;
    aoagReadReplica?: string;
    networkPerformance?: string;
    totalIops?: number;
    totalThroughput?: number;
    totalStorage?: number;
    totalSecondaryStorage?: number;
    memory?: number;
    noOfVcpusInUse?: number;
}

interface OnPremCollectionObject {
    windowsConfig: WindowsConfig;
    sqlServerInfo: SqlInstanceDetails[];
    timestamp: string;
    scriptVersion: string;
}

interface OracleScriptInfo {
    scriptVersion: string;
    outputFormat: string;
    lookbackDays: number;
    collectionTimestamp: string;
    collectionMethod: 'AWR' | 'STATSPACK';
}

interface OracleHostInfo {
    collectionTimestamp: string;
    hostname: string;
    operatingSystem: string;
    cpuCount: number;
    totalRamBytes: number;
    uniqueHostId: string;
    ipAddresses: string;
    storageProtocol: string;
    storageDetails: string;
    nfsMounts: string;
}

interface OracleInstanceInfo {
    dbName: string;
    dbId: number;
    instanceName: string;
    hostName: string;
    oracleVersion: string;
    isRacEnabled: boolean;
    isDataGuardEnabled: boolean;
    databaseRole: string;
    logMode: string;
    isCDB: boolean;
    containerName: string;
    containerId: number;
    vCPUs: number;
    sgaTargetGB: number;
    pgaTargetGB: number;
    oracleEdition?: string;
    oracleEditionFull?: string;
    pdbCount?: number;
    pdbList?: string[];
    standbyDatabases?: OracleStandbyDatabase[];
    partnerNodes?: string[];
}

interface OracleStandbyDatabase {
    dbUniqueName: string;
    destination: string;
    destId: number;
    status: string;
    error: string;
}

interface OracleStatsSummary {
    min: number;
    avg: number;
    max: number;
    p50: number;
    p95: number;
}

interface OracleSizingStatistics {
    // Statistics computed from AVERAGE values per snapshot
    avgOfAverages: number; // Mean of all average values
    p95OfAverages: number; // 95th percentile of average values

    // Statistics computed from PEAK (max) values per snapshot
    avgOfPeaks: number; // Mean of all peak values
    p50OfPeaks: number; // Median (50th percentile) of peak values
    maxOfPeaks: number; // Maximum of all peak values (absolute max)

    // The recommended sizing value: MAX(P95 of Averages, P50 of Peaks)
    recommendedValue: number;
}

interface OracleMemoryUtilization {
    sgaAllocatedGB: number;
    pgaAllocatedGB: number;
    totalOracleMemoryGB: number;
    memoryTargetGB: number;
    hostPhysicalMemoryGB: number;
}

interface OracleResourceUtilization {
    cpuUtilization: OracleStatsSummary | { current: number; note: string };
    memoryUtilization: OracleMemoryUtilization;
    dbTimePerSec: OracleStatsSummary;
}

interface OraclePerformanceSnapshot {
    snapId: number;
    instanceNumber: number;
    beginTime: string;
    endTime: string;
    intervalSeconds: number;

    // Average values during the snapshot interval
    readIOPS: number;
    writeIOPS: number;
    readMBps: number;
    writeMBps: number;
    activeSessions: number;

    // Peak (max) values during the snapshot interval
    peakReadIOPS?: number;
    peakWriteIOPS?: number;
    peakReadMBps?: number;
    peakWriteMBps?: number;
    peakActiveSessions?: number;
}

interface OraclePerformanceSummary {
    snapshotCount: number;

    // Traditional statistics (backward compatible)
    readIOPS: OracleStatsSummary;
    writeIOPS: OracleStatsSummary;
    readThroughputMBps: OracleStatsSummary;
    writeThroughputMBps: OracleStatsSummary;
    activeSessions: OracleStatsSummary;

    // Sizing-specific statistics (for algorithm: MAX(P95 of Averages, P50 of Peaks))
    sizingStats?: {
        readIOPS: OracleSizingStatistics;
        writeIOPS: OracleSizingStatistics;
        totalIOPS: OracleSizingStatistics;
        readThroughputMBps: OracleSizingStatistics;
        writeThroughputMBps: OracleSizingStatistics;
        totalThroughputMBps: OracleSizingStatistics;
    };
}

// Storage Info Types
interface OracleTablespace {
    name: string;
    sizeGB: number;
    usedGB: number;
}

interface OracleAsmDiskgroup {
    name: string;
    redundancy: string;
    state: string;
    totalGB: number;
    freeGB: number;
    usedGB: number;
    percentUsed: number;
}

interface OracleAsmInfo {
    isAsmUsed: boolean;
    diskgroups: OracleAsmDiskgroup[];
}

interface OracleStorageInfo {
    totalDatabaseSizeGB: number;
    tempTablespaceSizeGB: number;
    redoLogCount: number;
    totalRedoSizeMB: number;
    tablespaces: OracleTablespace[];
    asmInfo?: OracleAsmInfo;
}

interface AWSEC2SizingRecommendation {
    recommendedVCPUs: number;
    recommendedMemoryGB: number;
    calculationDetails: {
        cpu: {
            p95OfAverages: number;
            p50OfPeaks: number;
            selectedValue: number;
            selectionReason: 'P95_OF_AVERAGES' | 'P50_OF_PEAKS';
        };
        memory: {
            totalOracleMemoryGB: number;
            bufferPercent: number;
            finalValueGB: number;
        };
    };
}

interface AWSFSxNSizingRecommendation {
    recommendedIOPS: number;
    recommendedThroughputMBps: number;
    recommendedCapacityGB: number;
    calculationDetails: {
        iops: {
            p95OfAverages: number;
            p50OfPeaks: number;
            selectedValue: number;
            selectionReason: 'P95_OF_AVERAGES' | 'P50_OF_PEAKS';
        };
        throughput: {
            p95OfAverages: number;
            p50OfPeaks: number;
            selectedValue: number;
            selectionReason: 'P95_OF_AVERAGES' | 'P50_OF_PEAKS';
        };
        capacity: {
            totalDatabaseSizeGB: number;
            bufferPercent: number;
            finalValueGB: number;
        };
    };
}

interface AWSSizingRecommendations {
    ec2: AWSEC2SizingRecommendation;
    fsxn: AWSFSxNSizingRecommendation;
    generatedAt: string;
    algorithmVersion: string;
    notes: string[];
}

// A single Oracle database (SID) entry within a multi-SID collection
interface OracleDatabaseEntry {
    instanceInfo: OracleInstanceInfo;
    resourceUtilization?: OracleResourceUtilization;
    performanceSnapshots: OraclePerformanceSnapshot[];
    performanceSummary: OraclePerformanceSummary;
    storageInfo: OracleStorageInfo;
    sizingRecommendations?: AWSSizingRecommendations;
    collectionMethod?: 'AWR' | 'STATSPACK';
}

// Main Collection Object Type for Oracle TCO -- multi-SID format
interface OracleCollectionObject {
    scriptInfo: OracleScriptInfo;
    hostInfo: OracleHostInfo;
    databases: OracleDatabaseEntry[];
    timestamp?: string;
}

export {
    UploadMetricsFileBody,
    LicenceUsageDetail,
    DriveDetail,
    NetworkConfiguration,
    NodeDetail,
    WindowsConfig,
    MemUtilization,
    OwnerNode,
    Iops,
    CpuUtilization,
    StorageDetailByDB,
    SqlInstanceDetails,
    OnPremCollectionObject,
    OracleScriptInfo,
    OracleHostInfo,
    OracleInstanceInfo,
    OracleStandbyDatabase,
    OracleStatsSummary,
    OracleSizingStatistics,
    OracleMemoryUtilization,
    OracleResourceUtilization,
    OraclePerformanceSnapshot,
    OraclePerformanceSummary,
    OracleTablespace,
    OracleAsmDiskgroup,
    OracleAsmInfo,
    OracleStorageInfo,
    OracleDatabaseEntry,
    OracleCollectionObject
};
