import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES, WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography, useDialog } from '@netapp/design-system';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import { useEffect, useMemo, useState } from 'react';
import { cardDataDefault, setOptimizeInnerpageSummary } from '../../GetWell/GetWellUtils';
import RecommendationText from '../../GetWell/RecommendationText/RecommendationText';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../../GetWell/StorageCardComponent/DialogContent/DialogContent';
import { GENERAL } from '../../../utils/appConstants';
import {
    getAssessmentGroupedByConfigurations,
    mapHostStatusToAssessmentData
} from '../../DatabaseHomePage/DatabaseHomeUtils';

import DismissTable from './DismissTables/DismissTable';

const DashboardDismissPage = () => {
    const dispatch = useDispatch();
    const { selectedConfig, selectedConfigSummary } = useAppSelector(state => state.databaseHome);
    const { headerSelectedMultiCredIdsList, headerSelectedMultiRegionIdsList } = useAppSelector(state => state.headers);

    const { allmssqlHostAssessmentData, inventoryTableData, getDatabaseHosts } = useAppSelector(
        state => state.inventoryV2
    );
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

    const callDismissApi = (type: any, rowData?: any, operation?: string) => {
        // ToDO: Call the API to dismiss the selected configuration
    };

    const handleDialog = (type: string, rowData: any, operation?: string) => {
        setDialog(
            <DialogComponent
                header={`${type} optimization`}
                content={<DialogContent type={type} bulkRecommendationOptions={rowData} operation={operation} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callDismissApi(type, rowData, operation);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={type !== ASSESSMENT_CONFIG_NAMES.MAXDOP ? 'innerPage' : ''}
            />
        );
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
                    cardHeight: '208px',
                    tagHeight: '305px',
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
                        description: cardDataDefault?.scheduled_FSx_for_ONTAP_backups?.recommendation?.description
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

    /**type = like Storage tier
     * rowData = row data values
     * action = activate, dismiss, postpone
     */
    const handleSingleAction = (type: string, rowData: any, action: string) => {
        // ToDo: Call the API to dismiss the selected configuration
    };

    const handleBulkAction = (type: string, rowData: any) => {
        handleDialog(type, rowData, 'bulk');
    };

    const getConfigObj = (type: string, instanceData: any) => {
        if (type === ASSESSMENT_CONFIG_NAMES.STORAGE_TIER) {
            return instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                (item: any) => item.name === 'performance-tier'
            );
        } else if (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) {
            return instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                (item: any) => item.name === 'headroom'
            );
        } else if (type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE) {
            return instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                (item: any) => item.name === 'log-drive-size'
            );
        } else if (type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) {
            return instanceData?.assessments?.dismissedConfigurations?.storage?.sizing?.find(
                (item: any) => item.name === 'tempdb-drive-size'
            );
        } else if (type === ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF) {
            return instanceData?.assessments?.dismissedConfigurations?.storage?.layout?.find(
                (item: any) => item.name === 'data-files-location'
            );
        } else if (type === ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF) {
            return instanceData?.assessments?.dismissedConfigurations?.storage?.layout?.find(
                (item: any) => item.name === 'log-files-location'
            );
        } else if (type === ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT) {
            return instanceData?.assessments?.dismissedConfigurations?.storage?.layout?.find(
                (item: any) => item.name === 'tempdb-files-location'
            );
        } else if (type === ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING) {
            return instanceData?.assessments?.dismissedConfigurations?.compute;
        } else if (type === 'MAXDOP') {
            return instanceData?.assessments?.dismissedConfigurations?.maxDOP;
        } else if (type === GENERAL.MICROSOFT_SQL_PATCH) {
            return instanceData?.assessments?.dismissedConfigurations?.mssqlPatch;
        } else if (type === GENERAL.LICENSE_SQL_SERVER) {
            return instanceData?.assessments?.dismissedConfigurations?.license;
        } else if (type === GENERAL.RSS_CONFIGURATION) {
            return instanceData?.assessments?.dismissedConfigurations?.rssConfig;
        } else if (type === GENERAL.OPERATING_SYSTEM_PATCH) {
            return instanceData?.assessments?.dismissedConfigurations?.hostOsPatch;
        } else if (type === GENERAL.SCHEDULED_LOCAL_SNAPSHOT) {
            return instanceData?.assessments?.dismissedConfigurations?.snapshotPolicy;
        } else if (type === GENERAL.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) {
            return instanceData?.assessments?.dismissedConfigurations?.awsBackup;
        } else if (type === GENERAL.CLONE_MANAGEMENT) {
            return instanceData?.assessments?.dismissedConfigurations?.clone;
        } else {
            return;
        }
    };

    const getTableData = (type: string) => {
        let newAssessmentData: any = [];
        let uniqueResourceList: Array<string> = [];
        allmssqlHostAssessmentData?.map((hostData: any) => {
            if (
                !headerSelectedMultiCredIdsList.includes(hostData?.credentialId) ||
                !headerSelectedMultiRegionIdsList.includes(hostData?.regionId) ||
                uniqueResourceList.includes(hostData?.databaseHostId)
            ) {
                return;
            }
            uniqueResourceList.push(hostData?.databaseHostId);

            hostData?.instancesAssessment?.map((instanceData: any) => {
                if (!instanceData?.error) {
                    let configObj: any = getConfigObj(type, instanceData);

                    newAssessmentData.push({
                        credentialId: hostData?.credentialId,
                        regionId: hostData?.regionId,
                        databaseHostId: hostData?.databaseHostId,
                        instanceId: instanceData?.databaseInstanceId,
                        serverInstanceName: instanceData?.databaseInstanceName,
                        id: hostData?.databaseHostId + '_' + instanceData?.databaseInstanceId,
                        hostName: hostData?.databaseHostName,
                        configObj: configObj,
                        configState: configObj?.state || CONFIG_STATES.ACTIVE
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
                                title: `Manage configuration state for ${selectedConfig}`,
                                dataTestId: 'wlm-db-dismiss-configuration'
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography
                        data-testid={`wlm-db-${selectedConfig.toLowerCase().replace(/ /g, '-')}`}
                        variant="Semibold_20"
                    >
                        Manage configuration state for {selectedConfig}
                    </DsTypography>
                    <DsTypography
                        data-testid={`wlm-db-manage-instance-heading1-for-${selectedConfig
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Regular_16"
                    >
                        {GENERAL.DISMISS_PAGE_MSG[0]}
                    </DsTypography>
                    <DsTypography
                        data-testid={`wlm-db-manage-dismiss-heading2-for-${selectedConfig
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Regular_16"
                    >
                        {GENERAL.DISMISS_PAGE_MSG[1]}
                    </DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.leftSection}>
                        <ValueCard
                            instances={valueCardData.instances}
                            configurationState={valueCardData.configurationState}
                            severity={valueCardData.severity}
                            from="dismissPage"
                            tooltipText={valueCardData?.tooltipText || ''}
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

                <div className={styles.tableSection}>{renderTable}</div>
            </div>
        </div>
    );
};

export default DashboardDismissPage;
