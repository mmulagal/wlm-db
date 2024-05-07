import { setSelectedDeploymentModel, setSelectedHostDetails, setSelectedInstanceId, setSelectedServerName } from '../../store/workloadFactory/exploreSavingsSlice';
import { setSelectedHeaderTab } from '../../store/workloadFactory/inventorySlice';
import { TIB_IN_BYTE, WLF_TABS } from '../../utils/consts';

export const onClickESHost = (dispatch: any, rowData: any, isDemoMode: any) => {
    const deploymentModel = (() => {
        const nodes = rowData?.sqlServerInstances?.[0]?.sqlServerNodes;
        if (nodes && nodes.length > 1) {
            return 'aoag';
        } else {
            return 'standalone';
        }
    })();
    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    dispatch(setSelectedInstanceId(rowData?.id));
    dispatch(setSelectedDeploymentModel(deploymentModel));
    dispatch(setSelectedServerName(rowData.sqlServerInstances?.[0].sqlServerName || 'Server name'));
    setESInstanceData(rowData, isDemoMode, deploymentModel, dispatch);
}

export const setESInstanceData = (data: any, isDemoMode: any, type: string, dispatch: any) => {
    if (isDemoMode) {
        let demoData = {};
        if (type === 'standalone') {
            demoData = {
                ...data,
                topology: {
                    ...data?.topology,
                    ec2Details: [
                        {
                            ...data?.topology?.ec2Details?.[0],
                            instanceType: 'm5.2xlarge'
                        }
                    ]
                },
                serverInstallationMode: 'Standalone',
                databaseServer: {
                    ...data?.databaseServer,
                    activeNode: 'SQLserver-Finance-01',
                    serverEdition: 'SQL Server Standard Edition'
                },
                databaseCount: 2,
                ebsResourceInfo: [
                    {
                        id: 'vol1',
                        size: 2 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 64
                    },
                    {
                        id: 'vol2',
                        size: 2 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 64
                    }
                ],
                recommendedInstance: {
                    serverInstallationMode: 'Standalone',
                    serverEdition: 'SQL Server Standard Edition',
                    serverVersion: 'Microsoft SQL Server 2019',
                    instanceType: 'm5.2xlarge'
                }
            };
        } else {
            demoData = {
                ...data,
                topology: {
                    ...data?.topology,
                    ec2Details: [
                        {
                            ...data?.topology?.ec2Details?.[0],
                            instanceType: 'm5.2xlarge'
                        },
                        {
                            ...data?.topology?.ec2Details?.[0],
                            instanceType: 'm5.2xlarge'
                        }
                    ]
                },
                serverInstallationMode: 'Always on availability group',
                databaseServer: {
                    ...data?.databaseServer,
                    activeNode: 'SQLserver-PLM',
                    serverEdition: 'SQL Server Enterprise Edition'
                },
                databaseCount: 2,
                ebsResourceInfo: [
                    {
                        id: 'vol1',
                        size: 5 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 64
                    },
                    {
                        id: 'vol2',
                        size: 5 * TIB_IN_BYTE,
                        volumeType: 'io2',
                        iops: 40000,
                        throughput: 64
                    }
                ],
                recommendedInstance: {
                    serverInstallationMode: 'Failover Cluster Instances',
                    serverEdition: 'SQL Server Standard Edition',
                    serverVersion: 'Microsoft SQL Server 2019',
                    instanceType: 'm5.2xlarge'
                }
            };
        }
        dispatch(setSelectedHostDetails(demoData));
    } else {
        dispatch(
            setSelectedHostDetails({
                ...data,
                recommendedInstance: {
                    serverInstallationMode: data?.serverInstallationMode,
                    serverEdition: data?.databaseServer?.serverEdition,
                    serverVersion: data?.databaseServer?.serverVersion,
                    instanceType: data?.topology?.ec2Details?.map((inst: any) => inst?.instanceType)
                }
            })
        );
    }
};
