import { DsButton, DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES, CONFIG_STATES_UI, WLF_TABS } from '../../../utils/consts';
import { setSelectedConfig } from '../../../store/workloadFactory/databaseHomeSlice';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import { setLandingFrom } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setOptimizeInnerpageSummary } from '../../GetWell/GetWellUtils';
import BarComponent from '../../Dashboard/BarComponent/BarComponent';

const ManagedInstanceOptimizationBreakdownByConfig = ({ openAccordion }: boolean | any) => {
    const { t } = useTranslation();
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);
    const dispatch = useDispatch();
    const windowSize = useResize();

    const { multiDataLoading, showNA } = useAppSelector(state => state.headers);

    const handleOptimize = (type: string) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setSelectedConfig(type));
        setOptimizeInnerpageSummary(type, configData, dispatch);
    };

    const loading = useMemo(
        () => allmssqlHostAssessmentLoading || multiDataLoading,
        [allmssqlHostAssessmentLoading, multiDataLoading]
    );

    const configData = useMemo(
        () => getAssessmentGroupedByConfigurations(allmssqlHostAssessmentData),
        [allmssqlHostAssessmentData]
    );

    const hasDismissedOrPosponed = (state: any) => {
        if (state.includes(CONFIG_STATES.ACTIVE)) {
            return '';
        }
        if (state.includes(CONFIG_STATES.POSTPONED)) {
            return CONFIG_STATES_UI.POSTPONED;
        }
        if (state.includes(CONFIG_STATES.DISMISSED)) {
            return CONFIG_STATES_UI.DISMISSED;
        }
        return '';
    };

    const hasMixedState = (state: any) => {
        if (
            state.includes(CONFIG_STATES.ACTIVE) &&
            (state.includes(CONFIG_STATES.POSTPONED) || state.includes(CONFIG_STATES.DISMISSED))
        ) {
            return t('databases.well-architect.mixed-state-config-tooltip');
        }
        return '';
    };

    const renderOptimizationBar = (assessmentKey: string, headingText: string, key: string) => {
        const optimizedCount =
            (configData?.[key]?.optimized || 0) +
            (configData?.[key]?.dismissed || 0) +
            (configData?.[key]?.activating || 0);
        const configStateKey = configData?.configState?.[key] || [];
        const dismissedOrPostponedText = hasDismissedOrPosponed(configStateKey);
        const total = configData?.total || 1;
        const afterOutOfTotal = configData?.total;
        const optimizePercentage = Math.round(
            ((inProgressOptimizationData?.[assessmentKey]?.length || 0) / total) * 100
        );
        const isLoading = loading || (inProgressOptimizationData?.[assessmentKey]?.length || 0) > 0;
        const width = windowSize.width > 1700 ? '328px' : '248px';

        return (
            <BarComponent
                color="#5E8DCD"
                headingText={headingText}
                percentage={
                    showNA
                        ? t('databases.general.not-available')
                        : dismissedOrPostponedText
                        ? 0
                        : Math.round((optimizedCount / total) * 100)
                }
                beforeOutOf={showNA ? undefined : dismissedOrPostponedText ? undefined : optimizedCount}
                afterOutOf={showNA ? undefined : dismissedOrPostponedText ? undefined : afterOutOfTotal}
                bottomText={showNA ? undefined : dismissedOrPostponedText ? undefined : 'Well-architected:'}
                width={width}
                from="dashboard"
                optimizePercentage={showNA ? 100 : dismissedOrPostponedText ? 0 : optimizePercentage}
                loading={dismissedOrPostponedText ? loading : isLoading}
                textMessage={showNA ? undefined : dismissedOrPostponedText || undefined}
                textMessageVariant={showNA ? 'Regular_14' : undefined}
                tooltipMessage={dismissedOrPostponedText ? undefined : hasMixedState(configStateKey)}
                isDisabled={showNA}
            />
        );
    };

    return (
        <div className={`${styles.managedBreakdown} ${showNA ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {t('databases.dashboard.well-architected-breakdown-by-configurations')}
                </DsTypography>

                {loading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <div className={`${styles.tile} ${styles.firstTile}`}>
                    {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER, 'Storage tier', 'storageTier')}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER);
                            }}
                            data-testid="wlm-db-optimize-storage-tier"
                            isDisabled={
                                loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
                        'File system headroom',
                        'fileSystemHeadroom'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-file-system-headroom"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM);
                            }}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE, 'Log drive size', 'logDriveSize')}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE);
                            }}
                            data-testid="wlm-db-optimize-log-drive-size"
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
                        'TempDB drive size',
                        'tempdbDriveSize'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-temdb-drive-size"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE);
                            }}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF,
                        'Data files (.mdf)',
                        'userDataFiles'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            data-testid="wlm-db-optimize-data-files"
                            variant="secondary"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF);
                            }}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF, 'Log files (.ldf)', 'logFiles')}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            data-testid="wlm-db-optimize-log-files"
                            variant="secondary"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF);
                            }}
                            isDisabled={
                                loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
                        ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
                        'tempdbPlacement'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            data-testid="wlm-db-optimize-temdb-placement"
                            variant="secondary"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT);
                            }}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.ONTAP, 'ONTAP', 'ontapConfiguration')}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-ontap"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS);
                            }}
                            isDisabled={loading}
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.OS, 'Operating system', 'operatingSystem')}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-operating-system"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM);
                            }}
                            isDisabled={loading}
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
                        ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
                        'computeRightsizing'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-compute-right-sizing"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING);
                            }}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
                        ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
                        'operatingSystemPatch'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            data-testid="wlm-db-optimize-operating-system-patch"
                            isThin
                            variant="secondary"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH);
                            }}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION,
                        ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION,
                        'rssConfiguration'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION);
                            }}
                            data-testid="wlm-db-optimize-rss-configuration"
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>
                <div className={styles.tile}>
                    {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.MTU, t('databases.general.mtu'), 'mtuConfiguration')}
                    <SeparatorComponent variant="vertical" height="60px" />
                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-mtu"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.MTU);
                            }}
                            isDisabled={loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MTU]?.length > 0}
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>
                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.LICENSE,
                        ASSESSMENT_CONFIG_NAMES.LICENSE,
                        'applicationSqlServer'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            data-testid="wlm-db-optimize-license-sql-server"
                            isThin
                            variant="secondary"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.LICENSE);
                            }}
                            isDisabled={
                                loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LICENSE]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
                        ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
                        'mssqlPatch'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            data-testid="wlm-db-optimize-microsoft-sql-server"
                            variant="secondary"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH);
                            }}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH]?.length >
                                    0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.MAXDOP,
                        ASSESSMENT_CONFIG_NAMES.MAXDOP,
                        'maxdopPatch'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.MAXDOP);
                            }}
                            data-testid="wlm-db-optimize-maxdop"
                            isDisabled={
                                loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MAXDOP]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
                        ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
                        'scheduledLocalSnapshot'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT);
                            }}
                            data-testid="wlm-db-optimize-snapshot"
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(ASSESSMENT_CONFIG_NAMES.CRR, 'Cross-Region Replication (CRR)', 'crr')}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent title="" placement="bottom" width="120px" height="30px">
                            <div>
                                <DsButton
                                    data-testid="wlm-db-optimize-crr"
                                    variant="secondary"
                                    isThin
                                    onClick={() => {
                                        handleOptimize(ASSESSMENT_CONFIG_NAMES.CRR);
                                    }}
                                    isDisabled={
                                        loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CRR]?.length > 0
                                    }
                                >
                                    {t('databases.well-architect.view-and-fix')}
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
                        ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
                        'scheduledawsBackup'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS);
                            }}
                            data-testid="wlm-db-optimize-awsbackup"
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]
                                    ?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>
                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY,
                        t('databases.general.mssql-high-availability'),
                        'mssqlhighAvailability'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-mssql-high-availability"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY);
                            }}
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                        ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
                        'clone'
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT);
                            }}
                            data-testid="wlm-db-optimize-clone"
                            isDisabled={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length > 0
                            }
                        >
                            {t('databases.well-architect.view-and-fix')}
                        </DsButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByConfig;
