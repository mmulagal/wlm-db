import { useDispatch } from 'react-redux';
import { DsTypography, useDialog } from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import {
    CONFIG_STATES,
    CONFIG_STATE_ACTIONS,
    DBType,
    FROM_DIALOG,
    WLF_TABS
} from '../../../utils/consts';
import { getRecommendation } from '../../../utils/recommendations';
import { useAppSelector } from '../../../store/storeHooks';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import {
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
    mapHostStatusToAssessmentData,
    shouldSkipDatabaseHost
} from '../../DatabaseHomePage/DatabaseHomeUtils';

import { findFlatConfigItem, hasConfigStats } from '../../WellArchitectedTab/assessmentFormatUtils';
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

    const callDismissApi = (configId: any, rowData?: any, action?: string) => {
        const state = store.getState();
        const { inProgressStateData } = state.getWellOptimize;

        const payload = {
            configurationsToDismiss: [
                {
                    // TODO: verify field name with API team — server schema uses 'configurationName' today; update to 'id' once API migrates
                    // id: configId,
                    configurationName: configId,
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
                [configId]: [...(inProgressStateData[configId] || []), ...hostinstances]
            })
        );

        dismissMssqlAssessment({ payload })
            .then((res: any) => {
                if (!res.error) {
                    const { successList } = categorizeStateInstances(res?.data, configId);
                    updateConfigStateStatus(successList, dispatch, action);
                    dispatch(
                        setInProgressStateData({
                            ...inProgressStateData,
                            [configId]: (inProgressStateData[configId] || []).filter(
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
                            [configId]: (inProgressStateData[configId] || []).filter(
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
                        [configId]: (inProgressStateData[configId] || []).filter(
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

    const configData = useMemo(
        () => getAssessmentGroupedByConfigurations(allmssqlHostAssessmentData),
        [allmssqlHostAssessmentData]
    );

    useEffect(() => {
        if (selectedConfig) {
            setOptimizeInnerpageSummary(selectedConfig, configData, dispatch);
        }
    }, [selectedConfig, configData, dispatch]);

    useEffect(() => {
        if (!selectedConfig) {
            return;
        }

        if (hasConfigStats(configData, selectedConfig)) {
            const staticRec = getRecommendation(selectedConfig, DBType.MSSQL);
            const apiRecommendation = findFlatConfigItem(allmssqlHostAssessmentData, selectedConfig)?.recommendation;

            setValueCardData((prev: any) => ({
                ...selectedConfigSummary,
                configurationState: selectedConfigSummary.configState,
                cardHeight: prev.cardHeight || '136px',
                tagHeight: prev.tagHeight || '233px',
                data: staticRec
                    ? {
                          title: staticRec.title || 'Recommendations',
                          description: staticRec.description,
                          descriptionList: staticRec.descriptionList,
                          descriptionRssConfig: staticRec.descriptionRssConfig,
                          info: staticRec.info,
                          valuesHeading: staticRec.valuesHeading,
                          values: staticRec.values
                      }
                    : {
                          title: 'Recommendations',
                          description: apiRecommendation ?? ''
                      },
                tooltipText: selectedConfigSummary?.tooltipText,
                cardName: selectedConfig
            }));
        }
    }, [selectedConfig, selectedConfigSummary, configData, allmssqlHostAssessmentData]);

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

    const getConfigObj = (configId: string, instanceData: any) => {
        const dismissed: any[] = instanceData?.assessments?.dismissedConfigurations ?? [];
        return dismissed.find((d: any) => d.id === configId);
    };

    const getTableData = (type: string) => {
        const newAssessmentData: any = [];
        const uniqueResourceList: Array<string> = [];
        allmssqlHostAssessmentData?.map((hostData: any) => {
            if (
                shouldSkipDatabaseHost(
                    hostData,
                    headerSelectedMultiCredIdsList,
                    headerSelectedMultiRegionIdsList,
                    uniqueResourceList
                )
            ) {
                return;
            }

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
