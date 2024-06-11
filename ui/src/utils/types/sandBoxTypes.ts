import Sandbox from '../../workloadFactory/Sandbox/Sandbox';
import { DatabaseHostItem } from './databaseHomeTypes';
import { WorkloadFactoryDatabaseItem } from './workloadFactoryResourceTypes';

export interface CreateSandboxEntities {
    getDatabaseHosts: {
        databaseHostsData: DatabaseHostItem[] | null;
        databaseHostsLoading: boolean;
        databaseHostsError: string | null;
    };
    aggregatedDbHostList: DatabaseHostItem[];
    getDatabaseList: {
        databaseListData: WorkloadFactoryDatabaseItem[] | null;
        databaseListLoading: boolean;
        databaseListError: string | null;
    };
    getDriveInfo: {
        driveInfoLoading: boolean;
        driveInfoData: any;
    };
    getDbMountPoints: {
        dbMountPointsData: any;
        dbMountPointsLoading: boolean;
    };
    source: {
        selectedDatabaseHost: any;
        selectedDatabaseInstance: any;
        selectedDatabase: any;
    };
    target: {
        selectedDatabaseHost: any;
        selectedDatabaseInstance: any;
        selectedDatabase: any;
    };
    selectedMount: string;
    dataDriveMountPoint: string | null;
    logDriveMountPoint: string | null;
    selectedTag: string;
    isCreateSandboxPressed: boolean;
    isMountPathAdded: boolean;
    isNA: boolean;
    isSourceSelected: boolean;
    isTargetSelected: boolean;
    showError: boolean;
    dataFilePath: string;
    logFilePath: string;
}

export interface CreateSandboxPayloadEntities {
    source: {
        host: string;
        instance: string;
        database: string;
    };
    destination: {
        host: string;
        instance: string;
        database: string;
    };
    mountPoints: {
        dataDrive: string;
        logDrive: string;
    };
    tag: string;
}

export interface SandboxListEntities extends Array<SandboxItemEntities> {}

export interface SandboxItemEntities {
    sandboxName: string;
    databaseHostName: string;
    databaseHostId: string;
    databaseInstanceName: string;
    sourceDatabaseName: string;
    sourceDatabaseHostName: string;
    sourceDatabaseInstanceName: string;
    updatedAt: string;
    createdAt: string;
    tag: string;
    error: string;
    baseSnapshot: string;
}

export interface SandboxEntities {
    showBanner: boolean;
    isNA: boolean;
    getSandboxList: {
        sandboxListData: SandboxListEntities;
        sandboxListLoading: boolean;
        sandboxListError: string;
    };
    aggregatedSandboxList: SandboxListEntities;
    getSandboxSavings: {
        sandboxSavings: {
            consumedStorage: number;
            savedStorage: number;
            sandboxSavingsPercentage: number;
        };
        sandboxSavingsLoading: boolean;
        sandboxSavingsError: string;
    };
    connectionInfo: {
        selectedDatabaseHostId?: string | null;
        selectedSandboxName?: string | null;
        connectionString?: string | null;
        isLoading: boolean;
    };
    splitEstimateLoading: boolean;
}

export type SandboxActions = 'delete' | 'refresh' | 'rebaseline' | 'split' | 'integrityCheck';
