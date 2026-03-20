import { useDispatch } from 'react-redux';
import { DsTypography, useDialog } from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    CONFIG_STATE_ACTIONS,
    FROM_DIALOG,
    WLF_TABS
} from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import {
    cardDataDefault,
    isWadExcludedConfig,
    setOptimizeInnerpageSummary,
    updateConfigStateStatus
} from '../../GetWell/GetWellUtils';
import RecommendationText from '../../GetWell/RecommendationText/RecommendationText';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import {
    categorizeStateInstances,
    getAssessmentGroupedByConfigurations,
    mapHostStatusToAssessmentData
} from '../../DatabaseHomePage/DatabaseHomeUtils';

import DismissTable from './DismissTables/DismissTable';
import { useDismissMssqlAssessmentMutation } from '../../../utils/apiService';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import { setInProgressStateData } from '../../../store/workloadFactory/getWellOptimizeSlice';
import store from '../../../store/store';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';

const DashboardDismissPage = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { selectedConfig, selectedConfigSummary, dismissPageLanding } = useAppSelector(state => state.databaseHome);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);
    const { credentialData } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData } = useAppSelector(state => state.headers.getRegions);

    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );

    const [dismissMssqlAssessment] = useDismissMssqlAssessmentMutation();

    const { setDialog, closeDialog } = useDialog();
    const [valueCardData, setValueCardData] = useState<any>({
        instances: '',
        configurationState: '',
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

    const getPayloadType = (type: string) => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                type = 'performance-tier';
                break;
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                type = 'headroom';
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                type = 'log-drive-size';
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                type = 'tempdb-drive-size';
                break;
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                type = 'data-files-location';
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                type = 'log-files-location';
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                type = 'tempdb-files-location';
                break;
            case GENERAL.COMPUTE_RIGHTSIZING:
                type = 'compute-rightsizing';
                break;
            case GENERAL.RSS_CONFIGURATION:
                type = 'rss-config';
                break;
            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                type = 'snapshot-policy';
                break;
            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                type = 'backup-configuration';
                break;
            case ASSESSMENT_CONFIG_NAMES.MAXDOP:
                type = 'maxdop';
                break;
            case ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH:
                type = 'mssql-patch';
                break;
            case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH:
                type = 'host-os-patch';
                break;
            case ASSESSMENT_CONFIG_NAMES.LICENSE:
                type = 'sql-license';
                break;
            case ASSESSMENT_CONFIG_NAMES.CRR:
                type = 'crr';
                break;
            case ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT:
                type = 'snapcenter-snapshot';
                break;
            case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
                type = 'clone-management';
                break;
            case ASSESSMENT_CONFIG_NAMES.MTU:
                type = 'mtu-alignment';
                break;
            default:
                break;
        }
        return type;
    };

    const callDismissApi = (type: any, rowData?: any, action?: string) => {
        const state = store.getState();
        const { inProgressStateData } = state.getWellOptimize;

        const name = getPayloadType(type);

        const payload = {
            configurationsToDismiss: [
                {
                    configurationName: name,
                    configState: action,
                    databaseHosts: Object.values(
                        rowData.reduce(
                            (
                                acc: Record<
                                    string,
                                    {
                                        id: string;
                                        sqlServerInstances: string[];
                                        credentialsId: string;
                                        region: string;
                                    }
                                >,
                                {
                                    databaseHostId,
                                    instanceId,
                                    hostName,
                                    credentialId,
                                    regionId,
                                    configState
                                }: {
                                    databaseHostId: string;
                                    instanceId: string;
                                    hostName: string;
                                    credentialId: string;
                                    regionId: string;
                                    configState: string;
                                }
                            ) => {
                                if (configState !== action) {
                                    const uniqueRow = uniqueHostRow(databaseHostId, credentialId, regionId);
                                    if (!acc[uniqueRow]) {
                                        acc[uniqueRow] = {
                                            id: databaseHostId,
                                            sqlServerInstances: [],
                                            credentialsId: credentialId,
                                            region: regionId
                                        };
                                    }
                                    acc[uniqueRow].sqlServerInstances.push(instanceId);
                                }
                                return acc;
                            },
                            {}
                        )
                    )
                }
            ]
        };

        const hostinstances = payload?.configurationsToDismiss?.flatMap((host: any) =>
            host.databaseHosts.flatMap((databaseHost: any) =>
                databaseHost.sqlServerInstances.map(
                    (instance: any) =>
                        `${databaseHost.id}_${instance}_${databaseHost?.credentialsId}_${databaseHost?.region}`
                )
            )
        );
        dispatch(
            setInProgressStateData({
                ...inProgressStateData,
                [type]: [...(inProgressStateData[type] || []), ...hostinstances]
            })
        );

        dismissMssqlAssessment({ payload })
            .then((res: any) => {
                if (!res.error) {
                    const { successList, failedList } = categorizeStateInstances(res?.data, type);
                    updateConfigStateStatus(successList, dispatch, action, res?.data);
                    dispatch(
                        setInProgressStateData({
                            ...inProgressStateData,
                            [type]: (inProgressStateData[type] || []).filter(
                                (instance: string) => !hostinstances.includes(instance)
                            )
                        })
                    );

                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: GENERAL.ANALYSIS_STATE_CHANGE_SUCCESS
                        })
                    );
                } else {
                    dispatch(
                        setInProgressStateData({
                            ...inProgressStateData,
                            [type]: (inProgressStateData[type] || []).filter(
                                (instance: string) => !hostinstances.includes(instance)
                            )
                        })
                    );
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message: GENERAL.ANALYSIS_STATE_CHANGE_FAILED
                        })
                    );
                }
            })
            .catch(err => {
                dispatch(
                    setInProgressStateData({
                        ...inProgressStateData,
                        [type]: (inProgressStateData[type] || []).filter(
                            (instance: string) => !hostinstances.includes(instance)
                        )
                    })
                );
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: err
                    })
                );
            });
    };

    useEffect(() => {
        if (selectedConfig) {
            const configData = getAssessmentGroupedByConfigurations(allmssqlHostAssessmentData);
            setOptimizeInnerpageSummary(selectedConfig, configData, dispatch);
        }
    }, [allmssqlHostAssessmentData]);

    useEffect(() => {
        switch (selectedConfig) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.storage_tier?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });

                break;
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.file_system_headroom?.recommendation?.description,
                        values: cardDataDefault?.file_system_headroom?.recommendation?.values,
                        valuesHeading: cardDataDefault?.file_system_headroom?.recommendation?.valuesHeading
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '228px',
                    tagHeight: '325px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_drive_size?.recommendation?.description,
                        values: cardDataDefault?.transaction_log_drive_size?.recommendation?.values,
                        valuesHeading: cardDataDefault?.transaction_log_drive_size?.recommendation?.valuesHeading
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;

            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '232px',
                    tagHeight: '329px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_drive_size?.recommendation?.description,
                        values: cardDataDefault?.tempdb_drive_size?.recommendation?.values,
                        valuesHeading: cardDataDefault?.tempdb_drive_size?.recommendation?.valuesHeading
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '190px',
                    tagHeight: '287px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.user_data_files?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '190px',
                    tagHeight: '287px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_files?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '160px',
                    tagHeight: '257px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_files?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;

            case 'ONTAP':
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'Expand instances to view recommendations.'
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;

            case 'Operating system':
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'Expand instances to view recommendations.'
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'Expand instances to view recommendations.'
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case GENERAL.COMPUTE_RIGHTSIZING:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '214px',
                    tagHeight: '311px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.compute_rightsizing?.recommendation?.description
                    },
                    cardName: 'compute_right_sizing',
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case GENERAL.OPERATING_SYSTEM_PATCH:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.host_os_patch?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case GENERAL.RSS_CONFIGURATION:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '450px',
                    tagHeight: '547px',
                    data: {
                        title: 'Recommendations',
                        descriptionRssConfig: cardDataDefault?.rss_config?.recommendation?.descriptionRssConfig
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.MTU:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '214px',
                    tagHeight: '311px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.mtu?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case GENERAL.LICENSE_SQL_SERVER:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '228px',
                    tagHeight: '325px',
                    data: cardDataDefault?.sql_licenses?.recommendation,
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case GENERAL.MICROSOFT_SQL_PATCH:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '160px',
                    tagHeight: '257px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.microsoft_sql_patch?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
            case GENERAL.MAXDOP_PATCH:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '216px',
                    tagHeight: '313px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.maxdop?.recommendation?.descriptionRssConfig?.first
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.scheduled_local_snapshot?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });

                break;

            case ASSESSMENT_CONFIG_NAMES.CRR:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '156px',
                    tagHeight: '253px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.crr?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });

                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.scheduled_fsx_for_ontap_backups?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;

            case ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT:
                setValueCardData({
                    instances: selectedConfigSummary.totalInstances,
                    configurationState: selectedConfigSummary.configState,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '126px',
                    tagHeight: '223px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.clone_management?.recommendation?.description
                    },
                    tooltipText: selectedConfigSummary?.tooltipText
                });
                break;
        }
    }, [selectedConfig, selectedConfigSummary]);

    /** type = like Storage tier
     * rowData = row data values
     * action = activate, dismiss, postpone
     */
    const handleSingleAction = (type: string, rowData: any, action: string) => {
        callDismissApi(type, [rowData], action);
    };

    const handleBulkAction = (type: string, rowData: any, action: string, dialogCheck: boolean) => {
        let setHeader = '';
        let setContent: Array<string> = [];
        let setPrimaryButton = '';
        const typeText = type?.toLowerCase() || '';
        if (dialogCheck && action === CONFIG_STATE_ACTIONS.ACTIVE) {
            setHeader = `Reactivate ${typeText} analysis`;
            setContent = [
                'The analysis will continue for selected instances that are already actively analyzed.',
                `Are you ready to reactivate the ${typeText} analysis for the selected SQL Server instances?`
            ];
            setPrimaryButton = 'Reactivate';
        } else if (dialogCheck && action === CONFIG_STATE_ACTIONS.POSTPONED) {
            setHeader = `Postpone ${typeText} analysis`;
            setContent = [
                "Selected instances that are postponed won't get analyzed for 30 days.",
                `Are you ready to postpone the ${typeText} analysis for the selected SQL Server instances?`
            ];
            setPrimaryButton = 'Postpone for 30 days';
        } else if (dialogCheck && action === CONFIG_STATE_ACTIONS.DISMISS) {
            setHeader = `Dismiss ${typeText} analysis`;
            setContent = [
                "Selected instances that you dismiss won't get analyzed.",
                `Are you ready to dismiss the ${typeText} analysis for the selected SQL Server instances?`
            ];
            setPrimaryButton = 'Dismiss';
        }

        if (dialogCheck) {
            setDialog(
                <DialogComponent
                    header={setHeader}
                    content={
                        <>
                            <DsTypography variant="Regular_14">{setContent[0]}</DsTypography>
                            <DsTypography variant="Regular_14" style={{ marginTop: '24px' }}>
                                {setContent[1]}
                            </DsTypography>
                            <DsTypography variant="Regular_14" style={{ marginTop: '24px' }}>
                                {setContent[2]}
                            </DsTypography>
                        </>
                    }
                    primaryButton={setPrimaryButton}
                    secondaryButton={GENERAL.CANCEL}
                    dialogFrom={FROM_DIALOG.DISMISS}
                    callback={() => {
                        callDismissApi(type, rowData, action);
                    }}
                    closeCallback={() => {
                        closeDialog();
                    }}
                />
            );
        } else {
            callDismissApi(type, rowData, action);
        }
    };

    const getConfigObj = (type: string, instanceData: any) => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                return instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'performance-tier'
                );
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                return instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'headroom'
                );
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                return instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'log-drive-size'
                );
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                return instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                    (item: any) => item?.configurationName === 'tempdb-drive-size'
                );
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                return instanceData?.assessments?.dismissedConfigurations?.storage?.layout?.find(
                    (item: any) => item?.configurationName === 'data-files-location'
                );
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                return instanceData?.assessments?.dismissedConfigurations?.storage?.layout?.find(
                    (item: any) => item?.configurationName === 'log-files-location'
                );
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                return instanceData?.assessments?.dismissedConfigurations?.storage?.layout?.find(
                    (item: any) => item?.configurationName === 'tempdb-files-location'
                );
            case ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING:
                return instanceData?.assessments?.dismissedConfigurations?.compute;
            case 'MAXDOP':
                return instanceData?.assessments?.dismissedConfigurations?.maxDOP;
            case GENERAL.MICROSOFT_SQL_PATCH:
                return instanceData?.assessments?.dismissedConfigurations?.mssqlPatch;
            case GENERAL.LICENSE_SQL_SERVER:
                return instanceData?.assessments?.dismissedConfigurations?.license;
            case GENERAL.RSS_CONFIGURATION:
                return instanceData?.assessments?.dismissedConfigurations?.rssConfig;
            case GENERAL.OPERATING_SYSTEM_PATCH:
                return instanceData?.assessments?.dismissedConfigurations?.hostOsPatch;
            case GENERAL.SCHEDULED_LOCAL_SNAPSHOT:
                return instanceData?.assessments?.dismissedConfigurations?.snapshotPolicy;
            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                return instanceData?.assessments?.dismissedConfigurations?.awsBackup;
            case GENERAL.CLONE_MANAGEMENT:
                return instanceData?.assessments?.dismissedConfigurations?.clone;
            case ASSESSMENT_CONFIG_NAMES.CRR:
                return instanceData?.assessments?.dismissedConfigurations?.crr;
            case ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT:
                return instanceData?.assessments?.dismissedConfigurations?.snapcenterSnapshot;
            case ASSESSMENT_CONFIG_NAMES.MTU:
                return instanceData?.assessments?.dismissedConfigurations?.mtuAlignment;
            default:
        }
    };

    const getTableData = (type: string) => {
        const newAssessmentData: any = [];
        const uniqueResourceList: Array<string> = [];
        allmssqlHostAssessmentData?.map((hostData: any) => {
            if (
                (!hostData?.isWad && !headerSelectedMultiCredIdsList.includes(hostData?.credentialId)) ||
                (!hostData?.isWad && !headerSelectedMultiRegionIdsList.includes(hostData?.regionId)) ||
                uniqueResourceList.includes(hostData?.databaseHostId)
            ) {
                return;
            }
            uniqueResourceList.push(hostData?.databaseHostId);

            const matchingCredEntry =
                credentialData && credentialData?.find(entry => entry.credentialsId === hostData?.credentialId);

            const matchingRegionEntry =
                regionsData && regionsData?.regions?.find(entry => entry.regionCode === hostData?.regionId);

            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    // Skip WAD-excluded configurations for WAD (offline assessment) instances
                    if (isWadExcludedConfig(type, hostData?.isWad)) {
                        return;
                    }

                    const configObj: any = getConfigObj(type, instanceData);

                    newAssessmentData.push({
                        credentialId: hostData?.credentialId,
                        regionId: hostData?.regionId,
                        databaseHostId: hostData?.databaseHostId,
                        instanceId: instanceData?.databaseInstanceId,
                        serverInstanceName: instanceData?.databaseInstanceName,
                        id: `${hostData?.databaseHostId}_${instanceData?.databaseInstanceId}`,
                        hostName: hostData?.databaseHostName,
                        configObj,
                        configState: configObj?.configState || CONFIG_STATES.ACTIVE,
                        credentialName: matchingCredEntry?.name,
                        regionName: matchingRegionEntry?.regionName,
                        accountId: matchingCredEntry?.providerAccountId,
                        isWad: hostData?.isWad
                    });
                }
            });
        });
        return mapHostStatusToAssessmentData(
            inventoryTableData,
            newAssessmentData,
            getDatabaseHosts?.fullHostDataLoading || getDatabaseHosts?.databaseHostsLoading
        );
    };

    const renderTable = useMemo(() => {
        const tableData = getTableData(selectedConfig);
        return (
            <DismissTable
                handleSingleAction={handleSingleAction}
                handleBulkAction={handleBulkAction}
                tableData={tableData}
                type={selectedConfig}
            />
        );
    }, [
        allmssqlHostAssessmentData,
        inventoryTableData,
        getDatabaseHosts,
        headerSelectedMultiCredIdsList,
        headerSelectedMultiRegionIdsList
    ]);

    const setBreadcrumbs = () => {
        if (dismissPageLanding === WLF_TABS.DASHBOARD) {
            return (
                <BreadCrumbs
                    items={[
                        {
                            title: 'Dashboard',
                            onClick: () => {
                                dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                            }
                        },
                        {
                            title: `Update configuration analysis state for ${selectedConfig}`,
                            dataTestId: 'wlm-db-dismiss-configuration'
                        }
                    ]}
                />
            );
        }
        return (
            <BreadCrumbs
                items={[
                    {
                        title: 'Dashboard',
                        onClick: () => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                        }
                    },
                    {
                        title: `${t('databases.well-architect.fix-configuration')} (${selectedConfig})`,
                        onClick: () => {
                            dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
                        }
                    },

                    {
                        title: `Update configuration analysis state for ${selectedConfig}`,
                        dataTestId: 'wlm-db-dismiss-configuration'
                    }
                ]}
            />
        );
    };

    return (
        <div className={styles.dashboardInnerPage}>
            <div className={styles.innerPage}>
                <div className={commonStyles.commonBreadCrumb}>{setBreadcrumbs()}</div>

                <div className={styles.headingSection}>
                    <DsTypography
                        data-testid={`wlm-db-${selectedConfig.toLowerCase().replace(/ /g, '-')}`}
                        variant="Semibold_20"
                    >
                        {t('databases.dashboard.update-configuration-state-for')} {selectedConfig}
                    </DsTypography>
                    <DsTypography
                        className={styles.dismissPageMessage}
                        data-testid={`wlm-db-manage-instance-heading1-for-${selectedConfig
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Regular_16"
                    >
                        {GENERAL.DISMISS_PAGE_MESSAGE}
                    </DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.leftSection}>
                        <ValueCard valueCardData={valueCardData} />

                        <div className={styles.recommendation} style={{ height: valueCardData.cardHeight }}>
                            <RecommendationText
                                data={valueCardData?.data}
                                from="dashboard"
                                cardName={valueCardData?.cardName}
                            />
                        </div>
                    </div>
                    <div className={styles.rightSection}>
                        <TagComponent tagHeight={valueCardData.tagHeight} severity={valueCardData?.severity} />
                    </div>
                </div>

                <div className={styles.tableSection}>{renderTable}</div>
            </div>
        </div>
    );
};

export default DashboardDismissPage;
