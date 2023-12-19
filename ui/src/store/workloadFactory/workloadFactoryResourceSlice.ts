import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WorkloadFactoryResourceEntities } from '../../utils/types/workloadFactoryResourceTypes';

const initialState: WorkloadFactoryResourceEntities = {
    resourceLoading: true,
    resourceDetails: {
        id: '',
        name: '',
        status: '',
        databaseCount: 0,
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
            isAwsBackUpEnabled: false,
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
            size: 0,
            used: 0,
            spaceSavings: 0,
            spaceSavingsPercent: 0
        },

        estimatedUsageCost: {
            compute: 0,
            storage: 0,
            connectivity: 0,
            others: 0
        },

        resourceUtilization: {
            cpu: {
                percentUsed: '',
                used: '',
                total: '',
                remaining: ''
            },
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
    databaseList: []
};

const workloadFactoryResourceSlice = createSlice({
    name: 'workloadFactoryResource',
    initialState,
    reducers: {
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
        resetWorkloadFactoryResourceData: state => {
            state.resourceDetails = initialState.resourceDetails;
            state.databaseList = initialState.databaseList;
        }
    }
});

export const {
    setResourceLoading,
    setResourceDetails,
    setDatabaseListLoading,
    setDatabaseList,
    resetWorkloadFactoryResourceData
} = workloadFactoryResourceSlice.actions;
export default workloadFactoryResourceSlice;
