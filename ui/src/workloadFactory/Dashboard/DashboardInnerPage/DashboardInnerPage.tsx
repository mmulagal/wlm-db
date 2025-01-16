import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import store from '../../../store/store';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { FINDINGS, GETWELL_STATUS, STATUS_CONST, WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography, useDialog, DsButton, Button, Popover } from '@netapp/design-system';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import { useEffect, useState } from 'react';
import { cardDataDefault, formatGetWellData, handleOptimizeStorageJob } from '../../GetWell/GetWellUtils';
import RecommendationText from '../../GetWell/RecommendationText/RecommendationText';
import StorageTierTable from './RenderTables/StorageTierTable';
import FileSystemHeadroomTable from './RenderTables/FileSystemHeadroom';
import LogDriveSizeTable from './RenderTables/LogDriveSizeTable';
import TempDBDriveSizeTable from './RenderTables/TempDBDriveSizeTable';
import UserDataFilesTable from './RenderTables/UserDataFilesTable';
import LogFileTable from './RenderTables/LogFileTable';
import TempDBPlacement from './RenderTables/TempDBPlacement';
import ComputeRightSizingTable from './RenderTables/ComputeRightSizingTable';
import OntapConfig from './RenderTables/OntapConfig';
import OperatingSystemTable from './RenderTables/OperatingSystemTable';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../../GetWell/StorageCardComponent/DialogContent/DialogContent';
import { GENERAL } from '../../../utils/appConstants';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeComputeConfigMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeStorageSizingMutation,
    useOptimizeStorageTierMutation
} from '../../../utils/apiService';
import {
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setGwDatabaseStorageType,
    setGwHostname,
    setGwResourceId,
    setInProgressHostData,
    setInProgressOptimizationData,
    setJobToInstanceMap,
    setLandingFrom,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { ReactComponent as OptimizeInProgressIcon } from '../../../assets/optimize-in-progress.svg';

const DashboardInnerPage = () => {
    const dispatch = useDispatch();
    const { selectedConfig, selectedConfigSummary } = useAppSelector(state => state.databaseHome);
    const { inProgressOptimizationData, inProgressHostData } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM } = useAppSelector(state => state.getWellOptimize);
    const { setDialog, closeDialog } = useDialog();
    const [valueCardData, setValueCardData] = useState<any>({
        optimizationScore: '',
        optimizedInstances: '',
        notOptimizedInstances: '',
        severity: '',
        cardHeight: '',
        tagHeight: '',
        data: {
            title: '',
            description: '',
            values: []
        },
        cardName: ''
    });

    const optimizingData = useAppSelector(state => state.getWellOptimize.optimizingData);
    const [optimizeStorageConfig] = useOptimizeStorageConfigMutation();
    const [optimizeComputeConfig] = useOptimizeComputeConfigMutation();
    const [optimizeStorageSizing] = useOptimizeStorageSizingMutation();
    const [optimizeStorageTier] = useOptimizeStorageTierMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const callOptimizeApi = (type: any, rowData?: any) => {
        let payload: null | object = {};
        let apiCall = null;
        const state = store.getState();
        const { selectedDatabaseInstance, selectedResourceId, landingFrom, cardData } = state.getWellOptimize;
        const { headerSelectedCred, headerSelectedRegion } = state.headers;
        if (type === GENERAL.COMPUTE_RIGHTSIZING) {
            apiCall = optimizeComputeConfig;
            const { selectedRecommendedInstance } = state.getWellOptimize;
            payload = {
                instanceType: selectedRecommendedInstance?.value
            };
        } else if (type === 'Log drive size' || type === 'File system headroom' || type === 'TempDB drive size') {
            apiCall = optimizeStorageSizing;
            payload = {
                type:
                    type === 'Log drive size'
                        ? 'log-drive-size'
                        : type === 'File system headroom'
                        ? 'headroom'
                        : 'tempdb-drive-size'
            };
        } else if (type === 'Storage tier') {
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
                [type === 'Log drive size'
                    ? 'log-drive-size'
                    : type === 'File system headroom'
                    ? 'headroom'
                    : type === 'TempDB drive size'
                    ? 'tempdb-drive-size'
                    : type === 'Storage tier'
                    ? 'performance-tier'
                    : 'compute-rightsizing']: 'optimizing'
            })
        );
        dispatch(
            setInProgressHostData({
                ...inProgressHostData,
                [type]: [...(inProgressHostData[type] || []), selectedResourceId]
            })
        );
        dispatch(
            setInProgressOptimizationData({
                ...inProgressOptimizationData,
                [type]: [...(inProgressOptimizationData[type] || []), selectedDatabaseInstance]
            })
        );
        formatGetWellData(dispatch, rowData?.assessments);
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
                { id: cardData?.id, name: type, hostId: selectedResourceId, instanceId: selectedDatabaseInstance },
                failedMsgData,
                getJobDetailApi,
                dispatch,
                type
            );
        });
    };

    const optimizeAction = (rowData: any) => {
        const updatedState = store.getState();
        const { inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost = inventoryTableData[rowData?.databaseHostId];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.data?.databaseInstanceName
        );
        dispatch(setGwHostname(rowData?.hostName));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setGwResourceId(targettedHost?.resourceId));
        dispatch(setGwDatabaseInstance(targettedDbInstance?.databaseInstanceId));
        dispatch(setGwDatabaseInstanceName(targettedDbInstance?.databaseInstanceName));
        dispatch(setGwDatabaseStorageType(targettedDbInstance?.sqlServerDeploymentType));
    };

    const handleDialog = (type: string, rowData: any) => {
        setDialog(
            <DialogComponent
                header={`${type} optimization`}
                content={
                    <DialogContent
                        type={type}
                        recommendationOptions={rowData?.recommendationOptions}
                        missingPermissions={rowData?.missingPermissions}
                        recommendedSizeInGib={rowData?.recommendedSizeInGib}
                    />
                }
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callOptimizeApi(type, rowData);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={'innerPage'}
                hidePrimaryButton={
                    (type === 'File system headroom' || type === 'Log drive size' || type === 'TempDB drive size') &&
                    rowData?.missingPermissions &&
                    rowData?.missingPermissions.length > 0
                }
            />
        );
    };

    useEffect(() => {
        switch (selectedConfig) {
            case 'Storage tier':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.storage_tier?.recommendation?.description
                    }
                });

                break;
            case 'File system headroom':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '144px',
                    tagHeight: '241px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.file_system_headroom?.recommendation?.description,
                        values: cardDataDefault?.file_system_headroom?.recommendation?.values
                    }
                });
                break;
            case 'Log drive size':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '168px',
                    tagHeight: '265px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_drive_size?.recommendation?.description,
                        values: cardDataDefault?.transaction_log_drive_size?.recommendation?.values
                    }
                });
                break;

            case 'TempDB drive size':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '192px',
                    tagHeight: '289px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_drive_size?.recommendation?.description,
                        values: cardDataDefault?.tempdb_drive_size?.recommendation?.values
                    }
                });
                break;
            case 'Data files (.mdf)':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.user_data_files?.recommendation?.description
                    }
                });
                break;
            case 'Log files (.ldf)':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_files?.recommendation?.description
                    }
                });
                break;
            case 'TempDB placement':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '160px',
                    tagHeight: '257px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_files?.recommendation?.description
                    }
                });
                break;

            case 'ONTAP':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'Expand instances to view recommendations.'
                    }
                });
                break;

            case 'Operating system':
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'Expand instances to view recommendations.'
                    }
                });
                break;
            case GENERAL.COMPUTE_RIGHTSIZING:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.compute_rightsizing?.recommendation?.description
                    },
                    cardName: 'compute_right_sizing'
                });
                break;
            case GENERAL.OPERATING_SYSTEM_PATCH:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.host_os_patch?.recommendation?.description
                    }
                });
                break;
            case GENERAL.RSS_CONFIGURATION:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.rss_config?.recommendation?.description
                    }
                });
                break;
            case GENERAL.APPLICATION_SQL_SERVER:
                setValueCardData({
                    optimizationScore: selectedConfigSummary.optimizationScore,
                    optimizedInstances: selectedConfigSummary.optimizedInstances,
                    notOptimizedInstances: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.sql_licenses?.recommendation?.description
                    }
                });
                break;
        }
    }, [selectedConfig]);

    const lastColDetails = (name: string, data?: any, inProgressOptimizationData?: any, inProgressHostData?: any) => {
        return {
            id: '4',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '318px',
            renderCell: (cellData: any, rowData: any) => {
                let isDisabled = false;
                let errorMessage = '';
                if (inProgressHostData?.[name]?.includes(rowData?.databaseHostId)) {
                    isDisabled = true;
                    errorMessage = 'Optimization in progress for this host';
                } else if (rowData?.status?.toLowerCase() !== STATUS_CONST.UP.toLowerCase()) {
                    isDisabled = true;
                    errorMessage = GENERAL.ONLINE_INSTANCE_ASSESS;
                } else if (
                    !rowData?.assessmentStatus ||
                    rowData?.assessmentStatus?.toLowerCase() === FINDINGS.NOT_APPLICABLE.toLowerCase()
                ) {
                    isDisabled = true;
                    errorMessage = name + ' ' + GENERAL.NO_ASSESSMENT_DATA;
                } else if (
                    name === 'Log drive size' &&
                    rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase()
                ) {
                    isDisabled = true;
                    errorMessage = GENERAL.LOG_DRIVE_OVER_PROVISIONED_ERROR;
                } else if (
                    name === 'TempDB drive size' &&
                    rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase()
                ) {
                    isDisabled = true;
                    errorMessage = GENERAL.TEMPDB_DRIVE_OVER_PROVISIONED_ERROR;
                } else if (
                    name === 'File system headroom' &&
                    rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.OVER_PROVISIONED.toLowerCase()
                ) {
                    isDisabled = true;
                    errorMessage = GENERAL.HEADROOM_OVER_PROVISIONED_ERROR;
                } else if (
                    (name === 'Log drive size' || name === 'TempDB drive size' || name === 'File system headroom') &&
                    rowData?.assessmentStatus?.toLowerCase() === GETWELL_STATUS.NOT_OPTIMIZED.toLowerCase()
                ) {
                    isDisabled = true;
                    errorMessage = GENERAL.NOT_OPTIMIZED_SHARED_DRIVES;
                }
                const isInProgress = inProgressOptimizationData?.[name]?.includes(rowData?.instanceId);
                return (
                    <div className={styles.buttonContainer}>
                        {isInProgress ? (
                            <div className={styles['optimize-in-progress']}>
                                <OptimizeInProgressIcon />
                                <DsTypography variant="Semibold_14">Optimizing</DsTypography>
                            </div>
                        ) : !isDisabled ? (
                            <DsButton
                                isThin
                                variant="secondary"
                                onClick={() => {
                                    optimizeAction(rowData);
                                    handleDialog(name, rowData);
                                }}
                            >
                                Optimize
                            </DsButton>
                        ) : (
                            <Popover
                                popoverClass={CommonStyles['popover']}
                                isAppendedToBody={true}
                                children={<DsTypography variant="Regular_14">{errorMessage}</DsTypography>}
                                trigger="hover"
                                delayHide={200}
                                interactive={true}
                                container={
                                    <DsButton variant="secondary" isDisabled={true}>
                                        Optimize
                                    </DsButton>
                                }
                            />
                        )}
                    </div>
                );
            }
        };
    };

    const handleBulkAction = (type: string, rowData: any) => {
        optimizeAction(rowData[0]);
        handleDialog(type, rowData[0]);
    };

    const renderTable = () => {
        switch (selectedConfig) {
            case 'Storage tier':
                return <StorageTierTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'File system headroom':
                return <FileSystemHeadroomTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'Log drive size':
                return <LogDriveSizeTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'TempDB drive size':
                return <TempDBDriveSizeTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'Data files (.mdf)':
                return <UserDataFilesTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'Log files (.ldf)':
                return <LogFileTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'TempDB placement':
                return <TempDBPlacement lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'Compute rightsizing':
                return <ComputeRightSizingTable lastColDetails={lastColDetails} handleBulkAction={handleBulkAction} />;
            case 'ONTAP':
                return <OntapConfig />;
            case 'Operating system':
                return <OperatingSystemTable />;
        }
    };
    return (
        <div className={styles.dashboardInnerPage}>
            <div className={styles.innerPage}>
                <div className={commonStyles.commonBreadCrumb}>
                    <BreadCrumbs
                        items={[
                            {
                                title: 'Dashboard',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                }
                            },
                            {
                                title: `Optimize configuration (${selectedConfig})`
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography variant="Semibold_20">{selectedConfig}</DsTypography>
                    <DsTypography variant="Semibold_16">Manage instance optimization</DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.leftSection}>
                        <ValueCard
                            optimizationScore={valueCardData.optimizationScore}
                            optimizedInstances={valueCardData.optimizedInstances}
                            notOptimizedInstances={valueCardData.notOptimizedInstances}
                            severity={valueCardData.severity}
                        />

                        <div className={styles.recommendation} style={{ height: valueCardData.cardHeight }}>
                            <RecommendationText
                                data={valueCardData?.data}
                                from={'dashboard'}
                                cardName={valueCardData?.cardName}
                            />
                        </div>
                    </div>
                    <div className={styles.rightSection}>
                        <TagComponent tagHeight={valueCardData.tagHeight} />
                    </div>
                </div>

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default DashboardInnerPage;
