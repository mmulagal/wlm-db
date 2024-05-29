export interface InventorySliceData {
    inventoryTableData: { [key: string]: InventoryTableData } | null;
    inventoryChartData: InventoryChartData | null;
}

export interface InventoryTableData {
    ec2InstanceId?: string;
    ec2InstanceName?: string;
    id?: string;
    name?: string;
    status?: string;
    ssmState?: string;
    totalInstance?: number;
    managedInstance?: number;
    serverInstallationMode?: string;
    vpcId?: string;
    vpcName?: string;
    vpcCidr?: string;
    action?: string;
    ec2Details?: Array<{
        id?: string;
        name?: string;
        ebsVolumeId?: string;
    }>;
    estimatedUsageCost?: {
        compute?: number;
        storage?: { fsxn?: number; fsxw?: number; ebs?: number };
        connectivity?: number;
        others?: number;
        estimationType?: string;
    };
    allocatedCapacity?: number;
    sqlServerInstances?: Array<{
        name?: string;
        isDetected?: boolean;
        isManaged?: boolean;
        fileSystemDeploymentMode?: string;
        fileSystemType?: string;
        protection?: {
            isAwsBackupEnabled?: { fsxn?: boolean; fsxw?: boolean; ebs?: boolean };
            isFsxOntapSnapshotsEnabled?: boolean;
            isSqlNativeEnabled?: boolean;
            protectedDatabases?: number;
        };
        performance?: {
            assessment?: string;
        };
        storage?: {
            fsxn?: {
                protocol?: Array<String>;
                size?: number;
                used?: number;
                spaceSavings?: number;
                spaceSavingsPercentage?: number;
            };
            fsxw?: {
                size?: number;
                used?: number;
                spaceSavings?: number;
                spaceSavingsPercentage?: number;
            };
            ebs?: {
                size?: number;
            };
        };
        allocatedCapacity?: number;
    }>;
}

export interface InventoryChartData {}
