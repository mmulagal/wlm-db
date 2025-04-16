import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import store from '../../../store/store';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography, useDialog } from '@netapp/design-system';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import { useEffect, useState } from 'react';
import { cardDataDefault, setOptimizeInnerpageSummary } from '../../GetWell/GetWellUtils';
import RecommendationText from '../../GetWell/RecommendationText/RecommendationText';
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

import { setGwPageLoadInstanceData, setLandingFrom } from '../../../store/workloadFactory/getWellOptimizeSlice';

import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import MaxDopTable from './RenderTables/MaxDopTable';
import MicrosoftSQLPatchTable from './RenderTables/MicrosoftSQLPatchTable';
import LicenseTable from './RenderTables/LicenseTable';
import NetworkAdapterTable from './RenderTables/NetworkAdapterTable';
import OSPatchTable from './RenderTables/OSPatchTable';
import ScheduledLocalSnapshotTable from './RenderTables/ScheduledLocalSnapshotTable';
import ScheduledAWSBackupTable from './RenderTables/ScheduledAWSBackupTable';
import { uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';

import DismissTable from './DismissTables/DismissTable';

const DashboardDismissPage = () => {
    const dispatch = useDispatch();
    const { selectedConfig, selectedConfigSummary } = useAppSelector(state => state.databaseHome);

    const { allmssqlHostAssessmentData } = useAppSelector(state => state.inventoryV2);
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

    const { selectedRowsForOptimize } = useAppSelector(state => state.databaseHome);

    const callOptimizeApi = (type: any, rowData?: any, operation?: string) => {};

    const optimizeAction = (rowData: any) => {
        const updatedState = store.getState();
        const { inventoryTableData }: any = updatedState.inventoryV2;
        const targettedHost =
            inventoryTableData[uniqueHostRow(rowData?.databaseHostId, rowData?.credentialId, rowData?.regionId)];
        const targettedDbInstance = targettedHost?.sqlServerInstances?.find(
            (instanceItem: any) => instanceItem.databaseInstanceName === rowData?.data?.databaseInstanceName
        );
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(
            setGwPageLoadInstanceData({
                hostname: rowData?.hostName,
                resourceId: targettedHost?.resourceId,
                instanceId: targettedDbInstance?.databaseInstanceId,
                instanceName: targettedDbInstance?.databaseInstanceName,
                credId: targettedHost?.credentialId,
                regionId: targettedHost?.regionId,
                storageType: targettedDbInstance?.sqlServerDeploymentType
            })
        );
    };

    const handleDialog = (type: string, rowData: any, operation?: string) => {
        setDialog(
            <DialogComponent
                header={`${type} optimization`}
                content={
                    <DialogContent
                        type={type}
                        recommendationOptions={rowData?.recommendationOptions}
                        missingPermissions={rowData?.missingPermissions}
                        recommendedSizeInGib={rowData?.recommendedSizeInGib}
                        bulkRecommendationOptions={rowData}
                        operation={operation}
                    />
                }
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    callOptimizeApi(type, rowData, operation);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={type !== ASSESSMENT_CONFIG_NAMES.MAXDOP ? 'innerPage' : ''}
                hidePrimaryButton={
                    (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM ||
                        type === ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE ||
                        type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE) &&
                    rowData?.missingPermissions &&
                    rowData?.missingPermissions.length > 0
                }
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
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.storage_tier?.recommendation?.description
                    }
                });

                break;
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.file_system_headroom?.recommendation?.description,
                        values: cardDataDefault?.file_system_headroom?.recommendation?.values,
                        valuesHeading: cardDataDefault?.file_system_headroom?.recommendation?.valuesHeading
                    }
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '208px',
                    tagHeight: '305px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_drive_size?.recommendation?.description,
                        values: cardDataDefault?.transaction_log_drive_size?.recommendation?.values,
                        valuesHeading: cardDataDefault?.transaction_log_drive_size?.recommendation?.valuesHeading
                    }
                });
                break;

            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '232px',
                    tagHeight: '329px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_drive_size?.recommendation?.description,
                        values: cardDataDefault?.tempdb_drive_size?.recommendation?.values,
                        valuesHeading: cardDataDefault?.tempdb_drive_size?.recommendation?.valuesHeading
                    }
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '190px',
                    tagHeight: '287px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.user_data_files?.recommendation?.description
                    }
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '190px',
                    tagHeight: '287px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_files?.recommendation?.description
                    }
                });
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
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
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
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
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
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
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '214px',
                    tagHeight: '311px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.compute_rightsizing?.recommendation?.description
                    },
                    cardName: 'compute_right_sizing'
                });
                break;
            case GENERAL.OPERATING_SYSTEM_PATCH:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.host_os_patch?.recommendation?.description
                    }
                });
                break;
            case GENERAL.RSS_CONFIGURATION:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '450px',
                    tagHeight: '547px',
                    data: {
                        title: 'Recommendations',
                        descriptionRssConfig: cardDataDefault?.rss_config?.recommendation?.descriptionRssConfig
                    }
                });
                break;
            case GENERAL.LICENSE_SQL_SERVER:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '228px',
                    tagHeight: '325px',
                    data: cardDataDefault?.sql_licenses?.recommendation
                });
                break;
            case GENERAL.MICROSOFT_SQL_PATCH:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '160px',
                    tagHeight: '257px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.microsoft_sql_patch?.recommendation?.description
                    }
                });
                break;
            case GENERAL.MAXDOP_PATCH:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '216px',
                    tagHeight: '313px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.maxdop?.recommendation?.descriptionRssConfig?.first
                    }
                });
                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.scheduled_local_snapshot?.recommendation?.description
                    }
                });

                break;

            case ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                setValueCardData({
                    instances: selectedConfigSummary.optimizedInstances,
                    configurationState: selectedConfigSummary.notOptimizedInstances,
                    severity: selectedConfigSummary.severity,
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.scheduled_FSx_for_ONTAP_backups?.recommendation?.description
                    }
                });
                break;
        }
    }, [selectedConfig, selectedConfigSummary]);

    const lastColDetails = (name: string, data?: any, inProgressOptimizationData?: any, inProgressHostData?: any) => {};

    /**type = like Storage tier
     * rowData = row data values
     * action = activate, dismiss, postpone
     */
    const handleSingleAction = (type: string, rowData: any, action: string) => {
        console.log(rowData);
    };

    const handleBulkAction = (type: string, rowData: any) => {
        handleDialog(type, rowData, 'bulk');
    };

    const renderTable = () => {
        switch (selectedConfig) {
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                return <DismissTable handleSingleAction={handleSingleAction} handleBulkAction={handleBulkAction} />;
            default:
                return <DismissTable handleSingleAction={handleSingleAction} handleBulkAction={handleBulkAction} />;
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
                        You can dismiss or postpone a configuration for all instances or specific ones. Dismissed or
                        postponed configurations won't affect the total optimization score.
                    </DsTypography>
                    <DsTypography
                        data-testid={`wlm-db-manage-dismiss-heading2-for-${selectedConfig
                            .toLowerCase()
                            .replace(/ /g, '-')}`}
                        variant="Regular_16"
                    >
                        When you postpone or dismiss a configuration, it won't be assessed until the end of the 30-day
                        postponement period or until manually activated.
                    </DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.leftSection}>
                        <ValueCard
                            instances={valueCardData.instances}
                            configurationState={valueCardData.configurationState}
                            severity={valueCardData.severity}
                            from="dismissPage"
                            tooltipText=""
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

export default DashboardDismissPage;
