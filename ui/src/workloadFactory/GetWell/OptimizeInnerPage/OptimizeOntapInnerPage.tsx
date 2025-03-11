import { Button, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import styles from './OptimizeInnerPage.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useDispatch } from 'react-redux';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { WLF_TABS } from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';
import { useAppSelector } from '../../../store/storeHooks';

import store from '../../../store/store';
import { GENERAL } from '../../../utils/appConstants';
import {
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setLandingFrom,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeStorageConfigMutation,
    useOptimizeOperatingSystemMutation
} from '../../../utils/apiService';
import { handleOntapDialog } from '../StorageCardComponent/optimizeUtils';

import OntapTable from './InnerTables/OntapTable';
import OSMultiPathIOPolicy from './InnerTables/OSMultiPathIOPolicy';
import NTFSAllocationTable from './InnerTables/NTFSAllocationTable';
import { useRef, useState } from 'react';
import OntapTableWithData from './InnerTables/OntapTableWithData';

const OptimizeOntapInnerPage = () => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
    const userNavigated = useRef(false);
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId
    } = useAppSelector(state => state.getWellOptimize);
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeOs] = useOptimizeOperatingSystemMutation();
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

    const lastColDetails = (name: string, data?: any, width: any = '372px') => {
        //302
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
                        {/* {buttonComponent()} */}
                    </div>
                );
            }
        };
    };

    // This is the function that will be called when the optimize button is clicked from main cards
    // This is the function that will be called when the user clicks on the optimize button from sub menus
    const callOptimizeApi = (rowData: any) => {
        // Only 1 config can be passed at a time
        const state = store.getState();
        let payload = {};
        let apiCall = null;
        let statusType = '';
        if (rowData?.type === 'volume' || rowData?.type === 'lun') {
            statusType = 'ontap';
            apiCall = optimizeStorageConfig;
            payload = {
                assessments: [
                    {
                        configurationName: rowData?.id,
                        objectsToOptimize: rowData?.objectsInViolation
                    }
                ]
            };
        } else {
            statusType = 'os';
            apiCall = optimizeOs;
            payload = {
                configurationName: rowData?.id
            };
        }

        // call optimize api
        dispatch(setOptimizingInstanceData(true));
        dispatch(
            setOptimizingData({
                ...optimizingData,
                [rowData?.id]: 'optimizing'
            })
        );
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [statusType]: [
                    ...(inProgressOptimizationData[statusType] || []),
                    selectedResourceId + '_' + selectedDatabaseInstance
                ]
            })
        );
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [statusType]: [...(inProgressHostData[statusType] || []), selectedResourceId]
            })
        );
        formatGetWellData(dispatch);
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Optimization process initiated for ${rowData?.name}. This process can take upto 2 minutes. Track progress in `}
                        <Button
                            Component="button"
                            variant="text"
                            onClick={() => {
                                if (notificationTimeout) clearTimeout(notificationTimeout);
                                userNavigated.current = true;
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
            credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
            regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
            databaseHostId: selectedResourceId || selectedOptimizeConfig?.hostId,
            instanceId: selectedDatabaseInstance || selectedOptimizeConfig?.instanceId,
            payload: payload
        }).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {rowData?.name} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            if (notificationTimeout) clearTimeout(notificationTimeout);
                            userNavigated.current = true;
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

                const timeoutId = setTimeout(() => {
                    if (!userNavigated.current) {
                        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                    }
                }, 1000);

                setNotificationTimeout(timeoutId);
            }
            handleOptimizeStorageJob(
                res,
                {
                    ...rowData,
                    hostId: selectedResourceId || selectedOptimizeConfig?.hostId,
                    instanceId: selectedDatabaseInstance || selectedOptimizeConfig?.instanceId
                },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                statusType
            );
        });
    };

    const handleBulkAction = () => {
        handleOntapDialog(setDialog, callOptimizeApi, closeDialog, selectedOptimizeConfig?.data);
    };

    const renderTable = () => {
        switch (selectedOptimizeConfig?.type) {
            case 'Multipath I/O Policy':
                return (
                    <OSMultiPathIOPolicy
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );

            case 'NTFS allocation unit size':
                return (
                    <NTFSAllocationTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case 'Autosize-mode':
            case 'Snapshot copy reserve':
            case 'Tiering policy':
            case 'Tiering minimum cooling days':
            case 'OS type':
                return (
                    <OntapTableWithData
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            default:
                return (
                    <OntapTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
        }
    };

    const setHeading = () => {
        if (
            selectedOptimizeConfig?.type !== 'Multipath I/O Policy' &&
            selectedOptimizeConfig?.type !== 'NTFS allocation unit size'
        ) {
            return `ONTAP / ${selectedOptimizeConfig?.type}`;
        } else {
            return `Operating system |  ${selectedOptimizeConfig?.type}`;
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
                                    dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                }
                            },
                            {
                                title: `${selectedHostname} / ${selectedDatabaseInstanceName}`,
                                dataTestId: 'wlm-db-optimize-configuration',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                }
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
                        {setHeading()}
                    </DsTypography>
                    <DsTypography
                        data-testid={`wlm-db-manage-instance-inner-page-sub-heading-for-${selectedOptimizeConfig?.type
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Semibold_16"
                    >
                        {selectedDatabaseInstanceName || ''}
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

export default OptimizeOntapInnerPage;
