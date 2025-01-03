import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import store from '../../../store/store';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { STATUS_CONST, WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography, useDialog, DsButton, Button } from '@netapp/design-system';
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
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import {
    useLazyGetSubTaskListQuery,
    useOptimizeComputeConfigMutation,
    useOptimizeStorageConfigMutation,
    useOptimizeStorageTierMutation
} from '../../../utils/apiService';
import {
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setGwDatabaseStorageType,
    setGwHostname,
    setGwResourceId,
    setInProgressOptimizationData,
    setLandingFrom,
    setOptimizingData,
    setOptimizingInstanceData
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { addNotification, clearNotifications, NOTIFICATION_TYPES } from '../../../store/notificationSlice';

const DashboardInnerPage = () => {
    const dispatch = useDispatch();
    const { selectedConfig, selectedConfigSummary } = useAppSelector(state => state.databaseHome);
    const { cardData, inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);
    const { credIdFromJM, regionFromJM } = useAppSelector(state => state.getWellOptimize);
    const { selectedResourceId } = useAppSelector(state => state.getWellOptimize);
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
    const [optimizeStorageSizing] = useOptimizeStorageConfigMutation();
    const [optimizeStorageTier] = useOptimizeStorageTierMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const callOptimizeApi = (type: any, rowData?: any) => {
        let payload: null | object = {};
        let apiCall = null;
        const state = store.getState();
        const { selectedDatabaseInstance, landingFrom, cardData } = state.getWellOptimize;
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
            handleOptimizeStorageJob(
                res,
                { id: cardData?.id, name: type },
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
                        recommendationOptions={cardData?.recommendationOptions}
                        missingPermissions={cardData?.missingPermissions}
                        recommendedSizeInGib={cardData?.recommendedSizeInGib}
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
                customClass={styles.colorSet}
                hidePrimaryButton={
                    (type === 'File system headroom' || type === 'Log drive size' || type === 'TempDB drive size') &&
                    cardData?.missingPermissions &&
                    cardData?.missingPermissions.length > 0
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
            case 'User data files (.mdf)':
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

            case 'ONTAP configuration':
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

    const lastColDetails = (name: string, data?: any) => {
        return {
            id: '4',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '318px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.buttonContainer}>
                        {rowData?.status?.toLowerCase() === STATUS_CONST.UP.toLowerCase() ? (
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
                            <TooltipComponent
                                title={GENERAL.ONLINE_INSTANCE_ASSESS}
                                placement="bottom"
                                width="280px"
                                height="30px"
                            >
                                <div>
                                    <DsButton variant="secondary" isDisabled={true}>
                                        Optimize
                                    </DsButton>
                                </div>
                            </TooltipComponent>
                        )}
                    </div>
                );
            }
        };
    };

    const renderTable = () => {
        switch (selectedConfig) {
            case 'Storage tier':
                return <StorageTierTable lastColDetails={lastColDetails} />;
            case 'File system headroom':
                return <FileSystemHeadroomTable lastColDetails={lastColDetails} />;
            case 'Log drive size':
                return <LogDriveSizeTable lastColDetails={lastColDetails} />;
            case 'TempDB drive size':
                return <TempDBDriveSizeTable lastColDetails={lastColDetails} />;
            case 'User data files (.mdf)':
                return <UserDataFilesTable lastColDetails={lastColDetails} />;
            case 'Log files (.ldf)':
                return <LogFileTable lastColDetails={lastColDetails} />;
            case 'TempDB placement':
                return <TempDBPlacement lastColDetails={lastColDetails} />;
            case 'Compute rightsizing':
                return <ComputeRightSizingTable lastColDetails={lastColDetails} />;
            case 'ONTAP configuration':
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
