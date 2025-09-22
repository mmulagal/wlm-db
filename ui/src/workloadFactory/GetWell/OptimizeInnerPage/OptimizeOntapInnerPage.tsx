import { Button, DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import { useTranslation } from 'react-i18next';
import styles from './OptimizeInnerPage.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    ASSESSMENT_CONFIG_NAMES,
    DBType,
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM,
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING,
    WLF_TABS
} from '../../../utils/consts';
import OptimizeCard from './OptimizeCard/OptimizeCard';
import { useAppSelector } from '../../../store/storeHooks';

import store from '../../../store/store';
import { GENERAL } from '../../../utils/appConstants';
import {
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
    useOptimizeStorageConfigMutation,
    useOptimizeOperatingSystemMutation,
    useOptimizeHAMssqlMutation,
    useOptimizeOracleStorageConfigMutation
} from '../../../utils/apiService';
import { handleOntapDialog } from '../StorageCardComponent/optimizeUtils';

import OntapTable from './InnerTables/OntapTable';
import OSMultiPathIOPolicy from './InnerTables/OSMultiPathIOPolicy';
import NTFSAllocationTable from './InnerTables/NTFSAllocationTable';
import OntapTableWithData from './InnerTables/OntapTableWithData';
import TagComponent from '../../Dashboard/DashboardInnerPage/TagComponent/TagComponent';
import MSSQLHighAvailabilityTableWithData from './InnerTables/MSSQLHighAvailabilityTableWithData';
import { formatOracleWellArchitectedData } from '../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';

const OptimizeOntapInnerPage = () => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const { t } = useTranslation();
    const [notificationTimeout, setNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
    const [cardHeight, setCardHeight] = useState({
        recommendationSection: '',
        tagSection: ''
    });
    const userNavigated = useRef(false);
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
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
    const [optimizeOracleStorageConfig] = useOptimizeOracleStorageConfigMutation();
    const [optimizeOs] = useOptimizeOperatingSystemMutation();
    const [optimizeHAMssql] = useOptimizeHAMssqlMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    useEffect(() => {
        if (selectedOptimizeConfig?.engineType === DBType.ORACLE) {
            switch (selectedOptimizeConfig?.type) {
                case 'Thin provisioning':
                case 'Snapshot copy reserve':
                case 'Fractional reserve':
                case 'Snapshot policy':
                case 'Space management':
                case 'OS type':
                case 'Space reservation':
                case 'Space allocation':
                    setCardHeight({
                        recommendationSection: '160px',
                        tagSection: '256px'
                    });
                    break;
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO:
                case ASSESSMENT_CONFIG_NAMES.SELINUX:
                    setCardHeight({
                        recommendationSection: '190px',
                        tagSection: '286px'
                    });
                    break;
                case ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES:
                case ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES:
                case ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT:
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES:
                case ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS:
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS:
                    setCardHeight({
                        recommendationSection: '170px',
                        tagSection: '266px'
                    });
                    break;
                case ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS:
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT:
                    setCardHeight({
                        recommendationSection: '140px',
                        tagSection: '236px'
                    });
                    break;
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION:
                    setCardHeight({
                        recommendationSection: '200px',
                        tagSection: '296px'
                    });
                    break;
                default:
                    setCardHeight({
                        recommendationSection: '210px',
                        tagSection: '306px'
                    });
                    break;
            }
        } else {
            switch (selectedOptimizeConfig?.type) {
                case 'OS type':
                case 'Space reservation':
                case 'NTFS allocation unit size':
                    setCardHeight({
                        recommendationSection: '140px',
                        tagSection: '236px'
                    });
                    break;
                case 'Space allocation':
                    setCardHeight({
                        recommendationSection: '160px',
                        tagSection: '256px'
                    });
                    break;
                case 'Tiering minimum cooling days':
                    setCardHeight({
                        recommendationSection: '260px',
                        tagSection: '356px'
                    });
                    break;
                case 'Multipath I/O Policy':
                    setCardHeight({
                        recommendationSection: '180px',
                        tagSection: '276px'
                    });
                    break;
                case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
                case ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE:
                case ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER:
                case ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS:
                case ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM:
                case ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE:
                    setCardHeight({
                        recommendationSection: '180px',
                        tagSection: '276px'
                    });
                    break;
                default:
                    setCardHeight({
                        recommendationSection: '260px',
                        tagSection: '356px'
                    });
                    break;
            }
        }
    }, [selectedOptimizeConfig]);

    const buttonComponent = (rowData: any) => {
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
                            Fix
                        </DsButton>
                    }
                />
            );
        }
        return (
            <DsButton
                isThin
                variant="secondary"
                isDisabled={false}
                onClick={() => {
                    handleOntapDialog(
                        setDialog,
                        callOptimizeApi,
                        closeDialog,
                        selectedOptimizeConfig,
                        'single',
                        rowData
                    );
                }}
            >
                Fix
            </DsButton>
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

    const getSharedStoragePayload = (operation: string, singleRowData: any, selectedRows: any[]) => {
        const ontapLunUuidsList =
            operation === 'bulk' ? selectedRows.map((item: any) => item?.objectName) : [singleRowData?.objectName];
        return {
            hostsToOptimize: [
                {
                    configurationName: 'shared-storage',
                    databaseHosts: [
                        {
                            id: selectedResourceId || selectedOptimizeConfig?.hostId,
                            sqlServerInstances: [
                                {
                                    databaseInstanceId: selectedDatabaseInstance || selectedOptimizeConfig?.instanceId,
                                    ontapLunPaths: ontapLunUuidsList
                                }
                            ],
                            credentialsId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                            region: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
                        }
                    ]
                }
            ]
        };
    };

    const getVolumeOrLunPayload = (operation: string, singleRowData: any, selectedRows: any[], rowData: any) => {
        const objectsToOptimize =
            operation === 'bulk' ? selectedRows.map((item: any) => item?.objectName) : [singleRowData?.objectName];
        return {
            assessments: [
                {
                    configurationName: rowData?.id,
                    objectsToOptimize
                }
            ]
        };
    };

    const getOsPayload = (operation: string, singleRowData: any, selectedRows: any[], rowData: any) => {
        const objectsToOptimize =
            operation === 'bulk' ? selectedRows.map((item: any) => item?.objectName) : [singleRowData?.objectName];
        return {
            configurationName: rowData?.id,
            objectsToOptimize
        };
    };

    // This is the function that will be called when the optimize button is clicked from main cards
    // This is the function that will be called when the user clicks on the optimize button from sub menus
    const callOptimizeApi = (rowData: any, operation: string, singleRowData: any) => {
        // Only 1 config can be passed at a time
        const state = store.getState();
        let payload = {};
        let apiInput = {};
        let apiCall = null;
        let statusType = '';
        if (
            selectedOptimizeConfig?.engineType === DBType.ORACLE &&
            (rowData?.type === 'volume' || rowData?.type === 'lun')
        ) {
            // For Oracle storage configuration ontap
            statusType = ASSESSMENT_CONFIG_NAMES.ONTAP;
            apiCall = optimizeOracleStorageConfig;
            payload = getVolumeOrLunPayload(operation, singleRowData, selectedRowsForOptimizeInnerPage, rowData);
            apiInput = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId || selectedOptimizeConfig?.hostId,
                instanceId: selectedDatabaseInstance || selectedOptimizeConfig?.instanceId,
                payload
            };
        } else if (rowData?.name === ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE) {
            // For MSSQL shared storage
            statusType = ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY;
            apiCall = optimizeHAMssql;
            payload = getSharedStoragePayload(operation, singleRowData, selectedRowsForOptimizeInnerPage);
            apiInput = { configName: 'shared-storage', payload };
        } else if (rowData?.type === 'volume' || rowData?.type === 'lun') {
            // For MSSQL storage configuration ontap
            statusType = ASSESSMENT_CONFIG_NAMES.ONTAP;
            apiCall = optimizeStorageConfig;
            payload = getVolumeOrLunPayload(operation, singleRowData, selectedRowsForOptimizeInnerPage, rowData);
            apiInput = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId || selectedOptimizeConfig?.hostId,
                instanceId: selectedDatabaseInstance || selectedOptimizeConfig?.instanceId,
                payload
            };
        } else {
            // For MSSQL storage configuration OS
            statusType = ASSESSMENT_CONFIG_NAMES.OS;
            apiCall = optimizeOs;
            payload = getOsPayload(operation, singleRowData, selectedRowsForOptimizeInnerPage, rowData);
            apiInput = {
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId || selectedOptimizeConfig?.hostId,
                instanceId: selectedDatabaseInstance || selectedOptimizeConfig?.instanceId,
                payload
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
                    `${selectedResourceId}_${selectedDatabaseInstance}`
                ]
            })
        );
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [statusType]: [...(inProgressHostData[statusType] || []), selectedResourceId]
            })
        );
        if (selectedOptimizeConfig?.engineType === DBType.ORACLE) {
            // Format data call for oracle
            formatOracleWellArchitectedData(dispatch);
        } else {
            // Format data call for MSSQL
            formatGetWellData(dispatch);
        }
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: (
                    <div>
                        {`Fixing process initiated for ${rowData?.name}. This process can take upto 2 minutes. Track progress in `}
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

        apiCall(apiInput).then((res: any) => {
            const failedMsgData = (
                <div className={styles.notification}>
                    {rowData?.name} failed to optimize.
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => {
                            if (notificationTimeout) clearTimeout(notificationTimeout);
                            userNavigated.current = true;

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
                        if (selectedOptimizeConfig?.engineType === DBType.ORACLE) {
                            // Redirect to oracle well architect page
                            dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                        } else {
                            // Redirect to MSSQL well architect page
                            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                        }
                        dispatch(setLandingFromInnerPage(true));
                    }
                }, 1000);

                setNotificationTimeout(timeoutId);
            }
            handleOptimizeStorageJob(
                res,
                {
                    ...rowData,
                    hostId: selectedResourceId || selectedOptimizeConfig?.hostId,
                    instanceId: selectedDatabaseInstance || selectedOptimizeConfig?.instanceId,
                    credentialId: selectedGwInstanceCredId,
                    regionId: selectedGwInstanceRegionId
                },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                statusType,
                '',
                {},
                true
            );
        });
    };

    const handleBulkAction = () => {
        handleOntapDialog(setDialog, callOptimizeApi, closeDialog, selectedOptimizeConfig, 'bulk');
    };

    const renderTable = () => {
        if (selectedOptimizeConfig?.engineType === DBType.ORACLE) {
            // Default we have ontap config which has inner page so directly returning it.
            // Once we have cases with more inner page than add switch cases.
            switch (selectedOptimizeConfig?.type) {
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO:
                case ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES:
                case ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES:
                case ASSESSMENT_CONFIG_NAMES.SELINUX:
                case ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT:
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES:
                case ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS:
                case ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS:
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT:
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS:
                case ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION:
                    return (
                        <OntapTableWithData
                            type={selectedOptimizeConfig?.type}
                            data={selectedOptimizeConfig?.data}
                            lastColDetails={lastColDetails}
                            handleBulkAction={handleBulkAction}
                            engineType={selectedOptimizeConfig?.engineType}
                            isRecommendation={false}
                        />
                    );
                default:
                    return (
                        <OntapTableWithData
                            type={selectedOptimizeConfig?.type}
                            data={selectedOptimizeConfig?.data}
                            lastColDetails={lastColDetails}
                            handleBulkAction={handleBulkAction}
                            engineType={selectedOptimizeConfig?.engineType}
                            isRecommendation
                        />
                    );
            }
        }
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
            case ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY:
            case 'OS type':
                return (
                    <OntapTableWithData
                        type={selectedOptimizeConfig?.type}
                        data={selectedOptimizeConfig?.data}
                        lastColDetails={lastColDetails}
                        handleBulkAction={handleBulkAction}
                        engineType={selectedOptimizeConfig?.engineType}
                    />
                );
            case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
            case ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE:
            case ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER:
            case ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS:
            case ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM:
            case ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE:
                return (
                    <MSSQLHighAvailabilityTableWithData
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
                        engineType={selectedOptimizeConfig?.engineType}
                    />
                );
        }
    };

    const setHeading = () => {
        if (
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM ||
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE
        ) {
            return `${t('databases.general.mssql-high-availability')} / ${selectedOptimizeConfig?.type}`;
        }
        if (
            selectedOptimizeConfig?.type !== 'Multipath I/O Policy' &&
            selectedOptimizeConfig?.type !== 'NTFS allocation unit size'
        ) {
            return `ONTAP / ${selectedOptimizeConfig?.type}`;
        }
        return `Operating system |  ${selectedOptimizeConfig?.type}`;
    };
    return (
        <div className={styles['optimize-inner-page']}>
            <div className={styles.innerPage}>
                <div className={styles.breadCrump}>
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
                                    if (selectedOptimizeConfig?.engineType === DBType.ORACLE) {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
                                    } else {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
                                    }

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
                        <TagComponent
                            tagHeight={cardHeight.tagSection}
                            type={selectedOptimizeConfig?.type}
                            engineType={selectedOptimizeConfig?.engineType}
                        />
                    </div>
                </div>

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default OptimizeOntapInnerPage;
