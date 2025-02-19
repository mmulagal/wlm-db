import { Button, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import styles from './OptimizeInnerPage.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useDispatch } from 'react-redux';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';
import { useAppSelector } from '../../../store/storeHooks';
import StorageTierOptimizeTable from './InnerTables/StorageTierOptimizeTable';
import store from '../../../store/store';
import { GENERAL } from '../../../utils/appConstants';
import {
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeComputeConfigMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeStorageTierMutation
} from '../../../utils/apiService';
import { handleDialog } from '../StorageCardComponent/optimizeUtils';
import FileSystemHeadroomOptimizeTable from './InnerTables/FileSystemHeaderoomOptimizeTable';
import LogDriveSizeOptimizeTable from './InnerTables/LogDriveSizeOptimizeTable';
import DataFilesOptimizeTable from './InnerTables/DataFilesOptimizeTable';
import LogFilesOptimizeTable from './InnerTables/LogFilesOptimizeTable';

const OptimizeInnerPage = () => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const { selectedResourceId, selectedDatabaseInstance } = useAppSelector(state => state.getWellOptimize);
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
    const [optimizeStorageSizing] = useOptimizeStorageSizingMutation();
    const [optimizeStorageTier] = useOptimizeStorageTierMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const buttonComponent = () => {
        if (selectedRowsForOptimizeInnerPage && selectedRowsForOptimizeInnerPage.length > 0) {
            return (
                <Popover
                    isAppendedToBody={true}
                    children={<DsTypography variant="Regular_14">Bulk action is enabled on selected rows</DsTypography>}
                    trigger="hover"
                    delayHide={200}
                    interactive={true}
                    container={
                        <DsButton variant="secondary" isDisabled={true} isThin>
                            Optimize
                        </DsButton>
                    }
                />
            );
        } else if (selectedOptimizeConfig?.type === 'Data files' || selectedOptimizeConfig?.type === 'Log files') {
            return (
                <Popover
                    isAppendedToBody={true}
                    children={<DsTypography variant="Regular_14">Coming soon</DsTypography>}
                    trigger="hover"
                    delayHide={200}
                    interactive={true}
                    container={
                        <DsButton variant="secondary" isDisabled={true} isThin>
                            Optimize
                        </DsButton>
                    }
                />
            );
        } else {
            return (
                <DsButton
                    isThin
                    variant="secondary"
                    isDisabled={false}
                    onClick={() => {
                        // optimizeAction(rowData);
                        // handleDialog(name, rowData, 'single');
                    }}
                >
                    Optimize
                </DsButton>
            );
        }
    };

    const lastColDetails = (name: string, data?: any, width: any = '302px') => {
        return {
            id: '4',
            Header: '',
            accessor: '',
            isSticky: true,
            width: width,
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.buttonContainer}>
                        <div />
                        {buttonComponent()}
                    </div>
                );
            }
        };
    };

    // This is the function that will be called when the optimize button is clicked from main cards
    const callOptimizeApi = (type: any) => {
        let payload: null | object = {};
        let apiCall = null;
        const state = store.getState();
        if (type === GENERAL.COMPUTE_RIGHTSIZING) {
            apiCall = optimizeComputeConfig;
            const { selectedRecommendedInstance } = state.getWellOptimize;
            payload = {
                instanceType: selectedRecommendedInstance?.value
            };
        } else if (
            type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
            type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE
        ) {
            apiCall = optimizeStorageSizing;
            payload = {
                type: [selectedOptimizeConfig?.data?.id]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            apiCall = optimizeStorageTier;
            payload = null;
        } else {
            // ToDo - More type will come like optimize for sizing and layout here
            apiCall = optimizeStorageConfig;
            payload = {
                assessments: [
                    {
                        configurationName: type,
                        objectsToOptimize: []
                    }
                ]
            };
        }

        // call optimize api
        dispatch(setOptimizingInstanceData(true));
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [selectedOptimizeConfig?.data?.id]: 'optimizing'
            })
        );
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [type]: [
                    ...(inProgressOptimizationData[type] || []),
                    selectedResourceId + '_' + selectedDatabaseInstance
                ]
            })
        );
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [type]: [...(inProgressHostData[type] || []), selectedResourceId]
            })
        );
        formatGetWellData(dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Optimization process initiated for ${type}. This process can take upto 2 minutes. Track progress in `}
                        <Button
                            Component="button"
                            variant="text"
                            onClick={() => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                                dispatch(clearNotifications());
                            }}
                        >
                            {GENERAL.JOB_MONITORING}.
                        </Button>
                    </div>
                )
            })
        );

        apiCall({
            credentialId: landingFrom === WLF_TABS.INVENTORY ? headerSelectedCred?.data?.credentialsId : credIdFromJM,
            regionId: landingFrom === WLF_TABS.INVENTORY ? headerSelectedRegion?.label2 : regionFromJM,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload: payload
        }).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {type} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            dispatch(clearNotifications());
                        }}
                    >
                        {GENERAL.VIEW_JOB_MONITORING}.
                    </Button>
                </div>
            );
            if (!res.error) {
                dispatch(
                    setJobToInstanceMap({
                        ...state.getWellOptimize.jobToInstanceMap,
                        [res?.data?.jobId]: { hostId: selectedResourceId, instanceId: selectedDatabaseInstance }
                    })
                );
            }
            handleOptimizeStorageJob(
                res,
                {
                    id: selectedOptimizeConfig?.data?.id,
                    name: type,
                    hostId: selectedResourceId,
                    instanceId: selectedDatabaseInstance
                },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                type
            );
        });
    };

    const handleBulkAction = () => {
        handleDialog(
            setDialog,
            selectedOptimizeConfig?.type,
            callOptimizeApi,
            closeDialog,
            selectedOptimizeConfig?.data
        );
    };

    const renderTable = () => {
        switch (selectedOptimizeConfig?.type) {
            case 'Storage tier':
                return (
                    <StorageTierOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case 'File system headroom':
                return (
                    <FileSystemHeadroomOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case 'Log drive size':
                return (
                    <LogDriveSizeOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case 'Data files':
                return (
                    <DataFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case 'Log files':
                return (
                    <LogFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
        }
    };
    return (
        <div className={styles['optimize-inner-page']}>
            <div className={styles.innerPage}>
                <div className={commonStyles.commonBreadCrumb}>
                    <BreadCrumbs
                        items={[
                            {
                                title: 'Inventory',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                }
                            },
                            {
                                title: `Host name / Instance name`,
                                dataTestId: 'wlm-db-optimize-configuration'
                            },
                            {
                                title: `${selectedOptimizeConfig?.type}`,
                                dataTestId: `wlm-db-manage-instance-inner-page-heading-for-${selectedOptimizeConfig?.type
                                    .toLowerCase()
                                    .replace(/ /g, '-')}`
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography data-testid={`wlm-db-${selectedOptimizeConfig?.type}`} variant="Semibold_20">
                        {selectedOptimizeConfig?.type}
                    </DsTypography>
                    <DsTypography
                        data-testid={`wlm-db-manage-instance-inner-page-sub-heading-for-${selectedOptimizeConfig?.type
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Semibold_16"
                    >
                        Manage instance optimization
                    </DsTypography>
                </div>

                <div className={styles.contentSection}>
                    <OptimizeCard />
                </div>

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default OptimizeInnerPage;
