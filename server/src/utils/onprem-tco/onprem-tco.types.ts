import { Static, Type } from '@fastify/type-provider-typebox';

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
    networkConfiguration: NetworkConfiguration[];
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
    windowsClusterName: string;
    belongsToCluster: boolean;
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
    sqlVersion: string[];
    storageDetailsByDb: string;
    sqlEdition: string;
    iops: string;
    collation: string;
    vcpusPerInstance: string;
    cpuUtilization: string;
    deploymentType: string;
    networkPerformance?: string;
}

interface OnPremCollectionObjectV1 {
    windowsConfig: WindowsConfig;
    sqlServerInfo: SqlInstanceDetails[];
    timestamp: string;
    scriptVersion: string;
}

const OnPremDatabaseResourceParams = Type.Object({
    resourceId: Type.String(),
    resourceName: Type.String(),
    deploymentModel: Type.String(),
    sqlServerInstances: Type.Array(Type.String()),
    onPremisesNodes: Type.Array(Type.String())
});

type OnPremDatabaseResourcesParamsType = Static<typeof OnPremDatabaseResourceParams>;

const OnPremDatabaseResourcesResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(OnPremDatabaseResourceParams),
    nextToken: Type.Optional(Type.String())
});

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
    OnPremDatabaseResourcesResponse,
    OnPremDatabaseResourcesParamsType,
    OnPremCollectionObjectV1
};
