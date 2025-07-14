import { DsButton, DsTypography, FlashingDotsLoader, Popover } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES, CONFIG_STATES_UI, WLF_TABS } from '../../../utils/consts';
import { setDismissPageLanding, setSelectedConfig } from '../../../store/workloadFactory/databaseHomeSlice';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { GENERAL } from '../../../utils/appConstants';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import { setLandingFrom } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setOptimizeInnerpageSummary } from '../../GetWell/GetWellUtils';
import { ReactComponent as Edit } from '../../../assets/ic_edit.svg';

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

    const handleEdit = (type: string) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_DISMISS_PAGE));
        dispatch(setDismissPageLanding(WLF_TABS.DASHBOARD));
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
            return GENERAL.MIXED_STATE_CONFIG_TOOLTIP;
        }
        return '';
    };

    const renderOptimizationBar = (
        assessmentKey: string,
        optimizedCount: number,
        headingText: string,
        configStateKey: any
    ) => {
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
                percentage={showNA ? 0 : (dismissedOrPostponedText ? 0 : Math.round((optimizedCount / total) * 100))}
                beforeOutOf={showNA ? undefined : (dismissedOrPostponedText ? undefined : optimizedCount)}
                afterOutOf={showNA ? undefined : (dismissedOrPostponedText ? undefined : afterOutOfTotal)}
                bottomText={showNA ? undefined : (dismissedOrPostponedText ? undefined : 'Well-architected:')}
                width={width}
                from="dashboard"
                optimizePercentage={showNA ? 0 : (dismissedOrPostponedText ? 0 : optimizePercentage)}
                loading={dismissedOrPostponedText ? loading : isLoading}
                textMessage={showNA ? t('databases.general.not-available') : (dismissedOrPostponedText || undefined)}
                textMessageVariant={showNA ? "Regular_14" : undefined}
                tooltipMessage={dismissedOrPostponedText ? undefined : hasMixedState(configStateKey)}
                isDisabled={showNA}
            />
        );
    };

    return (
        <div className={`${styles.managedBreakdown} ${showNA ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Well-architected breakdown by configurations
                </DsTypography>

                {loading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <div className={`${styles.tile} ${styles.firstTile}`}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.STORAGE_TIER,
                        configData?.storageTier || 0,
                        'Storage tier',
                        configData?.configState?.storageTier
                    )}

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
                                showNA ||
                                hasDismissedOrPosponed(configData?.configState?.storageTier) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.storageTier === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
                        configData?.fileSystemHeadroom || 0,
                        'File system headroom',
                        configData?.configState?.fileSystemHeadroom
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
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.fileSystemHeadroom) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.fileSystemHeadroom === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
                        configData?.logDriveSize || 0,
                        'Log drive size',
                        configData?.configState?.logDriveSize
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE);
                            }}
                            data-testid="wlm-db-optimize-log-drive-size"
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.logDriveSize) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.logDriveSize === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
                        configData.tempdbDriveSize || 0,
                        'TempDB drive size',
                        configData?.configState?.tempdbDriveSize
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
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.tempdbDriveSize) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.tempdbDriveSize === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF,
                        configData.userDataFiles || 0,
                        'Data files (.mdf)',
                        configData?.configState?.userDataFiles
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div>
                                <DsButton data-testid="wlm-db-optimize-data-files" variant="secondary" isDisabled>
                                    {GENERAL.VIEW_AND_FIX}
                                </DsButton>
                            </div>
                        </TooltipComponent>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF,
                        configData.logFiles || 0,
                        'Log files (.ldf)',
                        configData?.configState?.logFiles
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div>
                                <DsButton data-testid="wlm-db-optimize-log-files" variant="secondary" isDisabled>
                                    {GENERAL.VIEW_AND_FIX}
                                </DsButton>
                            </div>
                        </TooltipComponent>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
                        configData.tempdbPlacement || 0,
                        ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
                        configData?.configState?.tempdbPlacement
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div>
                                <DsButton data-testid="wlm-db-optimize-temdb-placement" variant="secondary" isDisabled>
                                    {GENERAL.VIEW_AND_FIX}
                                </DsButton>
                            </div>
                        </TooltipComponent>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.ONTAP,
                        configData.ontapConfiguration || 0,
                        'ONTAP',
                        configData?.configState?.ontapConfiguration
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-ontap"
                            onClick={() => {
                                handleOptimize('ONTAP');
                            }}
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.ontapConfiguration) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.ontapConfiguration === configData?.total
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        <Popover
                            children={GENERAL.COMING_SOON}
                            trigger="hover"
                            container={
                                <div className={styles.editDisableIcon}>
                                    <Edit />
                                </div>
                            }
                        />
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.OS,
                        configData.operatingSystem || 0,
                        'Operating system',
                        configData?.configState?.operatingSystem
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-operating-system"
                            onClick={() => {
                                handleOptimize('Operating system');
                            }}
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.operatingSystem) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.operatingSystem === configData?.total
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        <Popover
                            children={GENERAL.COMING_SOON}
                            trigger="hover"
                            container={
                                <div className={styles.editDisableIcon}>
                                    <Edit />
                                </div>
                            }
                        />
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        GENERAL.COMPUTE_RIGHTSIZING,
                        configData.computeRightsizing || 0,
                        GENERAL.COMPUTE_RIGHTSIZING,
                        configData?.configState?.computeRightsizing
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            data-testid="wlm-db-optimize-compute-right-sizing"
                            onClick={() => {
                                handleOptimize(GENERAL.COMPUTE_RIGHTSIZING);
                            }}
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.computeRightsizing) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.computeRightsizing === configData?.total
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(GENERAL.COMPUTE_RIGHTSIZING)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        GENERAL.OPERATING_SYSTEM_PATCH,
                        configData.operatingSystemPatch || 0,
                        GENERAL.OPERATING_SYSTEM_PATCH,
                        configData?.configState?.operatingSystemPatch
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div>
                                <DsButton
                                    data-testid="wlm-db-optimize-operating-system-patch"
                                    variant="secondary"
                                    isDisabled
                                >
                                    {GENERAL.VIEW_AND_FIX}
                                </DsButton>
                            </div>
                        </TooltipComponent>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION,
                        configData.rssConfiguration || 0,
                        GENERAL.RSS_CONFIGURATION,
                        configData?.configState?.rssConfiguration
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin
                            onClick={() => {
                                handleOptimize(GENERAL.RSS_CONFIGURATION);
                            }}
                            data-testid="wlm-db-optimize-rss-configuration"
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.rssConfiguration) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData.rssConfiguration === configData?.total ||
                                inProgressOptimizationData[GENERAL.RSS_CONFIGURATION]?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>
                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.LICENSE,
                        configData.applicationSqlServer || 0,
                        GENERAL.LICENSE_SQL_SERVER,
                        configData?.configState?.applicationSqlServer
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div>
                                <DsButton
                                    data-testid="wlm-db-optimize-license-sql-server"
                                    variant="secondary"
                                    isDisabled
                                >
                                    {GENERAL.VIEW_AND_FIX}
                                </DsButton>
                            </div>
                        </TooltipComponent>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.LICENSE)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
                        configData.mssqlPatch || 0,
                        GENERAL.MICROSOFT_SQL_PATCH,
                        configData?.configState?.mssqlPatch
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div>
                                <DsButton
                                    data-testid="wlm-db-optimize-microsoft-sql-server"
                                    variant="secondary"
                                    isDisabled
                                >
                                    {GENERAL.VIEW_AND_FIX}
                                </DsButton>
                            </div>
                        </TooltipComponent>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.MAXDOP,
                        configData.maxdopPatch || 0,
                        GENERAL.MAXDOP_PATCH,
                        configData?.configState?.maxdopPatch
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
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.maxdopPatch) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.maxdopPatch === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MAXDOP]?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.MAXDOP)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
                        configData.scheduledLocalSnapshot || 0,
                        GENERAL.SCHEDULED_LOCAL_SNAPSHOT,
                        configData?.configState?.scheduledLocalSnapshot
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
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.scheduledLocalSnapshot) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.scheduledLocalSnapshot === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.CRR,
                        configData.crr || 0,
                        GENERAL.CRR,
                        configData?.configState?.crr
                    )}

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent title="" placement="bottom" width="120px" height="30px">
                            <div>
                                <DsButton data-testid="wlm-db-optimize-crr" variant="secondary" isDisabled>
                                    {GENERAL.VIEW_AND_FIX}
                                </DsButton>
                            </div>
                        </TooltipComponent>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.CRR)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    {renderOptimizationBar(
                        ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
                        configData.scheduledawsBackup || 0,
                        GENERAL.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
                        configData?.configState?.scheduledawsBackup
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
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.scheduledawsBackup) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.scheduledawsBackup === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]
                                    ?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() =>
                                            handleEdit(ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS)
                                        }
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>

                <div className={styles.tile}>
                    { hasDismissedOrPosponed(configData?.configState?.clone)|| showNA ? (
                        <BarComponent
                            color="#5E8DCD"
                            percentage={0}
                            headingText={GENERAL.CLONE_MANAGEMENT}
                            width={windowSize.width > 1700 ? '328px' : '248px'}
                            from="dashboard"
                            textMessage={showNA ? t('databases.general.not-available') : hasDismissedOrPosponed(configData?.configState?.clone)}
                            textMessageVariant={showNA ? "Regular_14" : undefined}
                            optimizePercentage={0}
                            loading={loading}
                            isDisabled={showNA}
                        />
                    ) : (
                        <BarComponent
                            color="#5E8DCD"
                            headingText={GENERAL.CLONE_MANAGEMENT}
                            percentage={Math.round(((configData.clone || 0) / (configData.total || 1)) * 100)}
                            beforeOutOf={configData.clone}
                            afterOutOf={configData.total}
                            bottomText="Well-architected databases:"
                            width={windowSize.width > 1700 ? '328px' : '248px'}
                            from="dashboard"
                            optimizePercentage={Math.round(
                                ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length || 0) /
                                    (configData.total || 1)) *
                                    100
                            )}
                            loading={
                                loading ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length > 0
                            }
                            tooltipMessage={hasMixedState(configData?.configState?.clone)}
                            isDisabled={showNA}
                        />
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
                            isDisabled={showNA ||
                                hasDismissedOrPosponed(configData?.configState?.clone) !== '' ||
                                loading ||
                                configData?.total === 0 ||
                                configData?.clone === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length > 0
                            }
                        >
                            {GENERAL.VIEW_AND_FIX}
                        </DsButton>

                        {loading || showNA ? (
                            <div className={styles.editDisableIcon}>
                                <Edit />
                            </div>
                        ) : (
                            <Popover
                                children={GENERAL.MANAGE_ANALYSIS_STATE}
                                trigger="hover"
                                container={
                                    <div
                                        onClick={() => handleEdit(ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT)}
                                        className={styles.editIcon}
                                    >
                                        <Edit />
                                    </div>
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByConfig;
