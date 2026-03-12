import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
    WorkloadFactoryDatabaseItem,
    WorkloadFactoryResourceEntities
} from '../../utils/types/workloadFactoryResourceTypes';

const initialState: WorkloadFactoryResourceEntities = {
    resourceLoading: true,
    resourceDetails: {
        id: '',
        name: '',
        status: '',
        databaseCount: 0,
        databaseInstanceTopology: {},
        databaseServer: {
            operatingSystem: '',
            serverEdition: '',
            serverVersion: '',
            nodeNames: [],
            activeConnections: 0,
            creationDate: '',
            clusterName: '',
            activeNode: ''
        },
        resourceTrend: {
            cpuUsed: [],
            readThroughput: [],
            writeThroughput: [],
            readIops: [],
            writeIops: [],
            readLatency: [],
            writeLatency: []
        },
        topology: {
            awsAccount: '',
            region: '',
            serverType: '',
            serverInstallationMode: '',
            fileSystemDeploymentMode: '',
            fileSystemName: '',
            fileSystemType: '',
            fileSystemId: '',
            fileSystemStatus: '',
            fileSystemStorageCapacity: '',
            fileSystemThroughputCapacity: '',
            vpcId: '',
            keyPairName: '',
            ec2Details: [
                {
                    id: '',
                    name: '',
                    instanceType: '',
                    ebsVolumeId: '',
                    vpcID: '',
                    availabilityZone: '',
                    subnetId: ''
                }
            ],
            activeDirectoryDetails: {
                name: '',
                address: ''
            }
        },

        protection: {
            isAwsBackupEnabled: {
                fsxn: false,
                fsxw: false,
                ebs: false
            },
            isFsxOntapSnapshotsEnabled: false,
            isSqlNativeEnabled: false
        },

        performance: {
            rwMetrics: {
                latency: {
                    current: 0,
                    assessment: '',
                    read: 0,
                    write: 0
                },
                iops: {
                    current: 0,
                    read: 0,
                    write: 0
                },
                throughput: {
                    current: 0,
                    read: 0,
                    write: 0
                }
            }
        },

        storage: {
            fsxn: {
                size: 0,
                used: 0,
                spaceSavings: 0,
                spaceSavingsPercent: 0
            },
            fsxw: {
                size: 0,
                used: 0,
                spaceSavings: 0,
                spaceSavingsPercent: 0
            },
            ebs: {
                size: 0
            }
        },

        estimatedUsageCost: {
            compute: 0,
            storage: {
                fsxn: 0,
                fsxw: 0,
                ebs: 0
            },
            connectivity: 0,
            others: 0
        },

        resourceUtilization: {
            cpu: [],
            disk: {
                percentUsed: '',
                used: '',
                total: '',
                remaining: ''
            },
            memory: {
                percentUsed: '',
                used: '',
                total: '',
                remaining: ''
            }
        }
    },
    databaseListLoading: true,
    databaseList: [],
    replicaDatabasesMap: {},
    replicaDatabasesLoading: false,
    selectedResourceId: '',
    selectedDatabaseInstance: '',
    selectedDatabaseInstanceName: '',
    selectedResourceCredId: '',
    selectedResourceRegionId: '',
    selectedHostname: '',
    isResourceRefresh: false,
    fsxAdminPasswords: {
        password: '',
        confirmPassword: ''
    },
    sqlServerPasswords: {
        password: '',
        confirmPassword: ''
    },
    passwordResetLoading: false,
    sqlServerUserName: '',
    instanceDetailsData: {
        fsxId: '',
        ec2InstanceId: '',
        databaseInstanceName: ''
    },
    selectedAuthenticationType: '',
    imageDataUrl: ''
};

const workloadFactoryResourceSlice = createSlice({
    name: 'workloadFactoryResource',
    initialState,
    reducers: {
        setDiagramImageData: (state, action: PayloadAction<string>) => {
            state.imageDataUrl = action.payload;
        },
        setInstanceDetailsData: (state, action: PayloadAction<any>) => {
            state.instanceDetailsData = action.payload;
        },
        setSqlServerUserName: (state, action: PayloadAction<any>) => {
            state.sqlServerUserName = action.payload;
        },
        setPasswordResetLoading: (state, action: PayloadAction<any>) => {
            state.passwordResetLoading = action.payload;
        },
        setFsxAdminPassword: (state, action: PayloadAction<any>) => {
            state.fsxAdminPasswords.password = action.payload;
        },
        setFsxAdminConfirmPassword: (state, action: PayloadAction<any>) => {
            state.fsxAdminPasswords.confirmPassword = action.payload;
        },
        setSqlServerPassword: (state, action: PayloadAction<any>) => {
            state.sqlServerPasswords.password = action.payload;
        },
        setSqlServerConfirmPassword: (state, action: PayloadAction<any>) => {
            state.sqlServerPasswords.confirmPassword = action.payload;
        },
        setResourceLoading: (state, action: PayloadAction<any>) => {
            state.resourceLoading = action.payload;
        },
        setResourceDetails: (state, action: PayloadAction<any>) => {
            state.resourceDetails = action.payload;
        },
        setDatabaseListLoading: (state, action: PayloadAction<any>) => {
            state.databaseListLoading = action.payload;
        },
        setDatabaseList: (state, action: PayloadAction<any>) => {
            state.databaseList = action.payload;
        },
        setReplicaDatabasesMap: (state, action: PayloadAction<Record<string, WorkloadFactoryDatabaseItem[]>>) => {
            state.replicaDatabasesMap = action.payload;
        },
        setReplicaDatabasesLoading: (state, action: PayloadAction<boolean>) => {
            state.replicaDatabasesLoading = action.payload;
        },
        resetWorkloadFactoryResourceData: state => {
            state.resourceDetails = initialState.resourceDetails;
            state.databaseList = initialState.databaseList;
            state.replicaDatabasesMap = {};
            state.replicaDatabasesLoading = false;
        },
        setSelectedResourceId: (state, action: PayloadAction<any>) => {
            state.selectedResourceId = action.payload;
        },
        setSelectedDatabaseInstance: (state, action: PayloadAction<any>) => {
            state.selectedDatabaseInstance = action.payload;
        },
        setSelectedDatabaseInstanceName: (state, action: PayloadAction<any>) => {
            state.selectedDatabaseInstanceName = action.payload;
        },
        setSelectedResourceCredId: (state, action: PayloadAction<any>) => {
            state.selectedResourceCredId = action.payload;
        },
        setSelectedResourceRegionId: (state, action: PayloadAction<any>) => {
            state.selectedResourceRegionId = action.payload;
        },
        setSelectedHostname: (state, action: PayloadAction<any>) => {
            state.selectedHostname = action.payload;
        },
        setIsResourceRefresh: (state, action: PayloadAction<any>) => {
            state.isResourceRefresh = action.payload;
        },
        setSelectedResourcePageHostData: (state, action: PayloadAction<any>) => {
            state.selectedResourceId = action.payload.resourceId;
            state.selectedDatabaseInstance = action.payload.databaseInstanceId;
            state.selectedDatabaseInstanceName = action.payload.databaseInstanceName;
            state.selectedResourceCredId = action.payload.credentialId;
            state.selectedResourceRegionId = action.payload.regionId;
        },
        setSelectedAuthenticationType: (state, action: PayloadAction<any>) => {
            state.selectedAuthenticationType = action.payload;
        },
        resetAllPasswords: state => {
            state.fsxAdminPasswords.password = '';
            state.fsxAdminPasswords.confirmPassword = '';
            state.sqlServerPasswords.password = '';
            state.sqlServerPasswords.confirmPassword = '';
            state.sqlServerUserName = '';
        }
    }
});

export const {
    setDiagramImageData,
    setInstanceDetailsData,
    setSqlServerUserName,
    setPasswordResetLoading,
    setFsxAdminPassword,
    setFsxAdminConfirmPassword,
    setSqlServerPassword,
    setSqlServerConfirmPassword,
    setResourceLoading,
    setResourceDetails,
    setDatabaseListLoading,
    setDatabaseList,
    setReplicaDatabasesMap,
    setReplicaDatabasesLoading,
    resetWorkloadFactoryResourceData,
    setSelectedResourceId,
    setSelectedDatabaseInstance,
    setSelectedDatabaseInstanceName,
    setSelectedResourceCredId,
    setSelectedResourceRegionId,
    setSelectedHostname,
    setIsResourceRefresh,
    setSelectedResourcePageHostData,
    setSelectedAuthenticationType,
    resetAllPasswords
} = workloadFactoryResourceSlice.actions;
export default workloadFactoryResourceSlice;
