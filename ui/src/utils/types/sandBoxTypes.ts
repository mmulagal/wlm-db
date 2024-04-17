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
    mountPath: string;
    selectedTag: string;
    isDBNameAdded: boolean;
    isCreateSandboxPressed: boolean;
    isMountPathAdded: boolean;
    isNA: boolean;
}

export interface CreateSandboxPayloadEntities {
    source: {
        host: string;
        instance: string;
        database: string;
    };
    target: {
        host: string;
        instance: string;
        database: string;
    };
    mountPt: string;
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
    creationTime: string;
    tag: string;
    error: string;
}

export interface SandboxEntities {
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
}
