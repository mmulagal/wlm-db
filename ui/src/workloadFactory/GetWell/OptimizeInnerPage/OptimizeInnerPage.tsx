import { Button, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import styles from './OptimizeInnerPage.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    ASSESSMENT_CONFIG_NAMES,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    WLF_TABS
} from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';
import { useAppSelector } from '../../../store/storeHooks';
import StorageTierOptimizeTable from './InnerTables/StorageTierOptimizeTable';
import store from '../../../store/store';
import { GENERAL } from '../../../utils/appConstants';
import {
    setCloneDashboardData,
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setLandingFromInnerPage,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { formatGetWellData, handleOptimizeStorageJob } from '../GetWellUtils';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeComputeConfigForBulkMutation,
    useOptimizeComputeConfigMutation,
    useOptimizeResiliencyMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeStorageTierMutation
} from '../../../utils/apiService';
import { handleDialog } from '../StorageCardComponent/optimizeUtils';
import FileSystemHeadroomOptimizeTable from './InnerTables/FileSystemHeaderoomOptimizeTable';
import LogDriveSizeOptimizeTable from './InnerTables/LogDriveSizeOptimizeTable';
import DataFilesOptimizeTable from './InnerTables/DataFilesOptimizeTable';
import LogFilesOptimizeTable from './InnerTables/LogFilesOptimizeTable';
import RSSOptimizeTable from './InnerTables/RSSOptimizeTable';
import ScheduledLocalSnapshotOptimizeTable from './InnerTables/ScheduledLocalSnapshotTable';
import CRROptimizeTable from './InnerTables/CRROptimizeTable';
import CloneTabs from './CloneTabs';
import TagComponent from '../../Dashboard/DashboardInnerPage/TagComponent/TagComponent';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';

const OptimizeInnerPage = () => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
    const [cardHeight, setCardHeight] = useState({
        recommendationSection: '',
        tagSection: ''
    });
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const { selectedRowsForOptimizeInnerPage } = useAppSelector(state => state.databaseHome);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        cloneIsOptimizedRows
    } = useAppSelector(state => state.getWellOptimize);

    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
    const [optimizeStorageSizing] = useOptimizeStorageSizingMutation();
    const [optimizeStorageTier] = useOptimizeStorageTierMutation();
    const [optimizeResiliency] = useOptimizeResiliencyMutation();
    const [optimizeComputeConfigForBulk] = useOptimizeComputeConfigForBulkMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const userNavigated = useRef(false);

    useEffect(() => {
        if (selectedOptimizeConfig?.type === GENERAL.CLONE_MANAGEMENT) {
            const cloneViolationsList =
                selectedOptimizeConfig?.data?.cloneDetails
                    ?.filter((clone: any) =>
                        selectedOptimizeConfig?.data?.objectsInViolation?.includes(clone.cloneDatabaseName)
                    )
                    ?.map((obj: any) => ({
                        ...obj,
                        isOptimized:
                            cloneIsOptimizedRows?.[
                                `${selectedResourceId}_${selectedDatabaseInstance}_${obj?.cloneDatabaseName}`
                            ],
                        credentialId: selectedGwInstanceCredId,
                        regionId: selectedGwInstanceRegionId,
                        resourceId: selectedResourceId,
                        hostName: selectedHostname,
                        instanceId: selectedDatabaseInstance,
                        serverInstanceName: selectedDatabaseInstanceName
                    })) || [];

            dispatch(
                setCloneDashboardData({
                    type: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                    objectsInViolation: cloneViolationsList,
                    severity: selectedOptimizeConfig?.data?.severity,
                    tags: selectedOptimizeConfig?.data?.tags,
                    recommendation: selectedOptimizeConfig?.data?.recommendation
                })
            );
        }
    }, [selectedOptimizeConfig]);

    useEffect(() => {
        switch (selectedOptimizeConfig?.type) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                setCardHeight({
                    recommendationSection: '144px',
                    tagSection: '240px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;

            case 'Data files':
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;
            case 'Log files':
                setCardHeight({
                    recommendationSection: '208px',
                    tagSection: '304px'
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION:
                setCardHeight({
                    recommendationSection: '450px',
                    tagSection: '546px'
                });
                break;
            case 'Cross-Region Replication (CRR)':
                setCardHeight({
                    recommendationSection: '160px',
                    tagSection: '256px'
                });

                break;
            case GENERAL.CLONE_MANAGEMENT:
                setCardHeight({
                    recommendationSection: '120px',
                    tagSection: '216px'
                });
                break;
            default:
                setCardHeight({
                    recommendationSection: '160px',
                    tagSection: '256px'
                });
                break;
        }
    }, [selectedOptimizeConfig]);

    const buttonComponent = (rowData: any) => {
        if (selectedOptimizeConfig?.type === 'Data files' || selectedOptimizeConfig?.type === 'Log files') {
            return (
                <Popover
                    isAppendedToBody
                    children={<DsTypography variant="Regular_14">Coming soon</DsTypography>}
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {GENERAL.OPTIMIZE}
                        </DsButton>
                    }
                />
            );
        }
        if (selectedOptimizeConfig?.type === GENERAL.CRR) {
            return (
                <DsButton isThin variant="secondary" isDisabled>
                    {GENERAL.OPTIMIZE}
                </DsButton>
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE &&
            (rowData?.status === 'Over-provisioned' || rowData?.status === 'Shared drive')
        ) {
            return (
                <Popover
                    isAppendedToBody
                    children={
                        rowData?.status === 'Over-provisioned' ? (
                            <DsTypography variant="Regular_14">{GENERAL.LOG_DRIVE_OVER_PROVISIONED_ERROR}</DsTypography>
                        ) : (
                            <DsTypography variant="Regular_14">{GENERAL.NOT_OPTIMIZED_SHARED_DRIVES}</DsTypography>
                        )
                    }
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {GENERAL.OPTIMIZE}
                        </DsButton>
                    }
                />
            );
        }
        if (selectedRowsForOptimizeInnerPage && selectedRowsForOptimizeInnerPage.length > 0) {
            return (
                <Popover
                    isAppendedToBody
                    children={<DsTypography variant="Regular_14">Bulk action is enabled on selected rows</DsTypography>}
                    trigger="hover"
                    delayHide={200}
                    interactive
                    container={
                        <DsButton variant="secondary" isDisabled isThin>
                            {GENERAL.OPTIMIZE}
                        </DsButton>
                    }
                />
            );
        }
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
            selectedOptimizeConfig?.type === GENERAL.RSS_CONFIGURATION ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
        ) {
            return (
                <DsButton
                    isThin
                    variant="secondary"
                    isDisabled={rowData?.status === 'Over-provisioned' || rowData?.status === 'Shared drive'}
                    onClick={() => {
                        // optimizeAction(rowData);
                        handleDialog(
                            setDialog,
                            selectedOptimizeConfig?.type,
                            callOptimizeApi,
                            closeDialog,
                            selectedOptimizeConfig?.data,
                            'single',
                            rowData
                        );
                    }}
                >
                    {GENERAL.OPTIMIZE}
                </DsButton>
            );
        }
        return (
            <Popover
                isAppendedToBody
                children={<DsTypography variant="Regular_14">Coming soon</DsTypography>}
                trigger="hover"
                delayHide={200}
                interactive
                container={
                    <DsButton variant="secondary" isDisabled isThin>
                        {GENERAL.OPTIMIZE}
                    </DsButton>
                }
            />
        );
    };

    const lastColDetails = (name: string, data?: any, width: any = '302px') => ({
        id: '4',
        Header: '',
        accessor: '',
        isSticky: true,
        width,
        renderCell: (cellData: any, rowData: any) => (
            <div className={styles.buttonContainer}>
                <div />
                {buttonComponent(rowData)}
            </div>
        )
    });

    // This is the function that will be called when the optimize button is clicked from main cards
    const callOptimizeApi = (type: any, operation: string, singleRowData: any) => {
        let payload: null | object = {};
        let apiCall = null;

        const state = store.getState();
        if (type === GENERAL.COMPUTE_RIGHTSIZING) {
            apiCall = optimizeComputeConfig;
            const { selectedRecommendedInstance } = state.getWellOptimize;
            payload = {
                instanceType: selectedRecommendedInstance?.value
            };
        } else if (type === GENERAL.RSS_CONFIGURATION) {
            apiCall = optimizeComputeConfigForBulk;
            if (operation === 'bulk') {
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'rss-config',
                            databaseHosts: [
                                {
                                    id: selectedResourceId,
                                    sqlServerInstances: [selectedDatabaseInstance],
                                    networkAdapters: selectedRowsForOptimizeInnerPage.map(
                                        (item: any) => item?.adapterName
                                    ),
                                    credentialsId: selectedGwInstanceCredId,
                                    region: selectedGwInstanceRegionId
                                }
                            ]
                        }
                    ]
                };
            } else {
                payload = {
                    hostsToOptimize: [
                        {
                            configurationName: 'rss-config',
                            databaseHosts: [
                                {
                                    id: selectedResourceId,
                                    sqlServerInstances: [selectedDatabaseInstance],
                                    networkAdapters: [singleRowData?.adapterName],
                                    credentialsId: selectedGwInstanceCredId,
                                    region: selectedGwInstanceRegionId
                                }
                            ]
                        }
                    ]
                };
            }
        } else if (
            type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
            type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE
        ) {
            apiCall = optimizeStorageSizing;
            payload = {
                configurationName: [selectedOptimizeConfig?.data?.id]
            };
        } else if (type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE) {
            apiCall = optimizeStorageSizing;

            if (operation === 'bulk') {
                payload = {
                    configurationName: 'log-drive-size',
                    objectsToOptimize: selectedRowsForOptimizeInnerPage.map((item: any) => item?.logAccessPath)
                };
            } else {
                payload = {
                    configurationName: 'log-drive-size',
                    objectsToOptimize: [singleRowData?.logAccessPath]
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            apiCall = optimizeStorageTier;
            if (operation === 'bulk') {
                payload = {
                    configurationName: 'storage-tier',
                    objectsToOptimize: selectedRowsForOptimizeInnerPage.map((item: any) => item?.objectName)
                };
            } else {
                payload = {
                    configurationName: 'storage-tier',
                    objectsToOptimize: [singleRowData?.objectName]
                };
            }
        } else if (type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT) {
            apiCall = optimizeResiliency;
            const state = store.getState();
            const { selectedSnapshot } = state.getWellOptimize;
            if (operation === 'bulk') {
                payload = {
                    configurationName: ['snapshot-policy'],
                    params: [
                        {
                            snapshotPolicy: {
                                uuid: selectedSnapshot?.data?.uuid,
                                name: selectedSnapshot?.data?.name
                            },
                            volumes: selectedRowsForOptimizeInnerPage.map(({ volumeName, ontapVolumeUuid }: any) => ({
                                ontapVolumeName: volumeName,
                                ontapVolumeUuid
                            }))
                        }
                    ]
                };
            } else {
                payload = {
                    configurationName: ['snapshot-policy'],
                    params: [
                        {
                            snapshotPolicy: {
                                uuid: selectedSnapshot?.data?.uuid,
                                name: selectedSnapshot?.data?.name
                            },
                            volumes: [
                                {
                                    ontapVolumeName: singleRowData?.volumeName,
                                    ontapVolumeUuid: singleRowData?.ontapVolumeUuid
                                }
                            ]
                        }
                    ]
                };
            }
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
                    `${selectedResourceId}_${selectedDatabaseInstance}`
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
                        {`Fixing process initiated for ${type}. This process can take upto 2 minutes. Track progress in `}
                        <Button
                            Component="button"
                            variant="text"
                            onClick={() => {
                                if (notificationTimeout) clearTimeout(notificationTimeout);
                                userNavigated.current = true;
                                dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                                const path = isWorkloadFactory
                                    ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                                    : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                                postBlueXPMessage({
                                    type: BlueXPListeners.navigate,
                                    payload: { pathname: path, replace: true }
                                });
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
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            payload
        }).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {type} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            if (notificationTimeout) clearTimeout(notificationTimeout);
                            userNavigated.current = true;
                            dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                            const path = isWorkloadFactory
                                ? FORM_TO_WLF_NAVIGATE_JOB_MONITORING
                                : FORM_TO_WLF_NAVIGATE_BLUEXP_JM;

                            postBlueXPMessage({
                                type: BlueXPListeners.navigate,
                                payload: { pathname: path, replace: true }
                            });
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
                        dispatch(setLandingFromInnerPage(true));
                    }
                }, 1000);

                setNotificationTimeout(timeoutId);
            }
            handleOptimizeStorageJob(
                res,
                {
                    id: selectedOptimizeConfig?.data?.id,
                    name: type,
                    hostId: selectedResourceId,
                    instanceId: selectedDatabaseInstance,
                    credentialId: selectedGwInstanceCredId,
                    regionId: selectedGwInstanceRegionId
                },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                type,
                '',
                {},
                true
            );
        });
    };

    const handleBulkAction = () => {
        handleDialog(
            setDialog,
            selectedOptimizeConfig?.type,
            callOptimizeApi,
            closeDialog,
            selectedOptimizeConfig?.data,
            'bulk'
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
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case 'Data files':
                return (
                    <DataFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case 'Log files':
                return (
                    <LogFilesOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case GENERAL.RSS_CONFIGURATION:
                return (
                    <RSSOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case GENERAL.SCHEDULED_LOCAL_SNAPSHOT:
                return (
                    <ScheduledLocalSnapshotOptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            case GENERAL.CRR:
                return (
                    <CRROptimizeTable
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                    />
                );
            default:
                return null;
        }
    };

    const setHeading = () => {
        if (selectedOptimizeConfig?.type === 'Data files') {
            return 'Data files (.mdf) placement';
        }
        if (selectedOptimizeConfig?.type === 'Log files') {
            return 'Log files (.ldf) placement';
        }
        return selectedOptimizeConfig?.type;
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
                                title:
                                    `${selectedHostname} / ${selectedDatabaseInstanceName}` ||
                                    'Host name/instance name',
                                dataTestId: 'wlm-db-optimize-configuration',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                    dispatch(setLandingFromInnerPage(true));
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

                <div className={styles.mainSection}>
                    <div className={styles.contentSection}>
                        <OptimizeCard recommendationHeight={cardHeight.recommendationSection} />
                    </div>

                    <div className={styles.tagSection}>
                        <TagComponent tagHeight={cardHeight.tagSection} type={selectedOptimizeConfig?.type} />
                    </div>
                </div>

                {selectedOptimizeConfig?.type === GENERAL.CLONE_MANAGEMENT && <CloneTabs />}

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default OptimizeInnerPage;
